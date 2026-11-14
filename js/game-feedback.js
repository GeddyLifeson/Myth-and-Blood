/**
 * GameFeedback — kill streaks, wave summaries, danger vignette, low-HP cues.
 * Keeps combat/readability juice out of the 16k-line game.js core.
 */
const GameFeedback = (() => {
  let killStreak = 0;
  let streakTimer = 0;
  let waveKills = 0;
  let wavePlayerDeaths = 0;
  let lastSummary = null;
  let banner = null; // { text, sub, color, life, maxLife, kind }
  let dangerLevel = 0; // 0..1 enemies deep in player territory
  let multiKillLife = 0;
  let multiKillCount = 0;
  let bestStreak = 0;
  let cleanSweeps = 0;
  let totalWaveClears = 0;
  let peakWaveKills = 0;
  let runHighlights = []; // { wave, text }
  let nightTips = [];

  const STREAK_WINDOW = 90; // ticks between kills to keep streak
  const STREAK_LABELS = {
    3: 'TRIPLE KILL',
    5: 'RAMPAGE',
    8: 'UNSTOPPABLE',
    12: 'LEGENDARY',
    18: 'GODLIKE',
  };

  function resetRun() {
    killStreak = 0;
    streakTimer = 0;
    waveKills = 0;
    wavePlayerDeaths = 0;
    lastSummary = null;
    banner = null;
    dangerLevel = 0;
    breachCount = 0;
    breachLimit = 0;
    breachPulse = 0;
    rumble = 0;
    rumbleRest = 0;
    if (typeof BannerArt !== 'undefined') BannerArt.reset();
    multiKillLife = 0;
    multiKillCount = 0;
    bestStreak = 0;
    cleanSweeps = 0;
    totalWaveClears = 0;
    peakWaveKills = 0;
    runHighlights = [];
    nightTips = [];
  }

  function resetWave() {
    waveKills = 0;
    wavePlayerDeaths = 0;
    killStreak = 0;
    streakTimer = 0;
    multiKillLife = 0;
    multiKillCount = 0;
  }

  function pushHighlight(wave, text) {
    if (!text) return;
    runHighlights.push({ wave: wave || 0, text: String(text) });
    if (runHighlights.length > 24) runHighlights.shift();
  }

  function settings() {
    if (typeof Settings === 'undefined') {
      return {
        combatShake: true,
        damageNumbers: true,
        hitStop: true,
        gore: true,
        killStreaks: true,
        waveSummary: true,
        autoPauseNight: false,
        dangerVignette: true,
        lowHpPulse: true,
      };
    }
    return {
      combatShake: Settings.get('combatShake') !== false,
      damageNumbers: Settings.get('damageNumbers') !== false,
      hitStop: Settings.get('hitStop') !== false,
      gore: Settings.get('gore') !== false,
      killStreaks: Settings.get('killStreaks') !== false,
      waveSummary: Settings.get('waveSummary') !== false,
      autoPauseNight: !!Settings.get('autoPauseNight'),
      dangerVignette: Settings.get('dangerVignette') !== false,
      lowHpPulse: Settings.get('lowHpPulse') !== false,
    };
  }

  function reducedMotion() {
    return typeof Settings !== 'undefined' && !!Settings.get('reducedMotion');
  }

  // Motion ration. Shake, hit-stop and slow motion each ask here before they act, so they
  // cannot pile up: after about two thirds of a second of unbroken shaking the camera is
  // held still for a while, and nothing shakes while a banner for the end of the run plays.
  const RUMBLE_LIMIT = 40; // ticks of near-continuous shake before the rest
  const RUMBLE_REST = 50; // ticks the camera is then held still
  let rumble = 0;
  let rumbleRest = 0;
  let shookThisTick = false;

  function allowShake() {
    const s = settings();
    if (!s.combatShake || reducedMotion()) return false;
    if (rumbleRest > 0) return false;
    shookThisTick = true;
    return true;
  }

  function allowHitStop() {
    const s = settings();
    return s.hitStop && !reducedMotion();
  }

  function updateMotionRation() {
    if (rumbleRest > 0) rumbleRest--;
    if (shookThisTick) rumble += 1;
    else if (rumble > 0) rumble = Math.max(0, rumble - 2);
    shookThisTick = false;
    if (rumble >= RUMBLE_LIMIT) {
      rumble = 0;
      rumbleRest = RUMBLE_REST;
    }
  }

  function allowDamageNumbers() {
    return settings().damageNumbers;
  }

  function allowGore() {
    return settings().gore;
  }

  const BANNER_KIND = { streak: 'streak', perfect: 'perfect', clear: 'clear', wave: 'wave' };

  function showBanner(text, sub = '', color = '#ffd080', life = 90, kind = 'info') {
    if (kind !== 'wave' && typeof BannerArt !== 'undefined') {
      BannerArt.show(BANNER_KIND[kind] || 'info', { title: text, sub });
    }
    banner = {
      text: String(text || ''),
      sub: String(sub || ''),
      color: color || '#ffd080',
      life,
      maxLife: life,
      kind,
    };
  }

  function onEnemyKilled(unit, opts = {}) {
    waveKills++;
    if (!settings().killStreaks) return null;

    killStreak++;
    if (killStreak > bestStreak) bestStreak = killStreak;
    streakTimer = STREAK_WINDOW;
    multiKillCount = killStreak;
    multiKillLife = 50;

    const label = STREAK_LABELS[killStreak];
    if (label) {
      showBanner(label, opts.killerName ? `${opts.killerName}` : '', '#ff8040', 70, 'streak');
      if (typeof AudioEngine !== 'undefined') AudioEngine.SFX.multiKill?.(killStreak);
      if (killStreak >= 5) pushHighlight(opts.wave, `${label} (${killStreak} streak)`);
      return { streak: killStreak, label };
    }
    if (killStreak >= 2 && killStreak % 2 === 0) {
      return { streak: killStreak, label: `${killStreak} KILL STREAK` };
    }
    return { streak: killStreak, label: null };
  }

  function onPlayerDeath() {
    wavePlayerDeaths++;
    killStreak = 0;
    streakTimer = 0;
  }

  /**
   * Build wave-clear summary after awardRoundTP.
   * @returns {{ lines: string[], banner: string, clean: boolean, tp: number }}
   */
  function onWaveClear(ctx = {}) {
    const tp = Math.max(0, Math.floor(ctx.tpGained || 0));
    // Prefer this-wave counters (internal or provided). Never fall back to lifetime kills.
    const kills =
      ctx.waveKills != null ? ctx.waveKills : waveKills > 0 ? waveKills : (ctx.killsThisWave ?? 0);
    const deaths =
      ctx.casualties != null
        ? ctx.casualties
        : wavePlayerDeaths > 0
          ? wavePlayerDeaths
          : (ctx.deathsThisWave ?? 0);
    const wave = ctx.wave || 0;
    const clean = deaths === 0 && kills > 0;
    const perfect = clean && kills >= 5;

    const lines = [
      `Wave ${wave} cleared`,
      `+${tp} TP · ${kills} kill${kills === 1 ? '' : 's'} · ${deaths} lost`,
    ];
    if (perfect) lines.push('CLEAN SWEEP');
    else if (clean) lines.push('No casualties');
    else if (deaths >= 5) lines.push('Heavy losses — reinforce at night');

    totalWaveClears++;
    if (kills > peakWaveKills) peakWaveKills = kills;
    if (clean) cleanSweeps++;
    lastSummary = { wave, tp, kills, deaths, clean, perfect, lines };

    if (perfect) pushHighlight(wave, `Clean sweep — ${kills} kills, 0 lost`);
    else if (deaths >= 5) pushHighlight(wave, `Heavy losses — ${deaths} fallen`);

    if (settings().waveSummary) {
      const title = perfect ? 'CLEAN SWEEP' : clean ? 'WAVE CLEAR' : 'WAVE CLEAR';
      const color = perfect ? '#80ffa0' : clean ? '#c0e080' : '#ffd080';
      showBanner(title, lines[1], color, perfect ? 110 : 90, perfect ? 'perfect' : 'clear');
      if (typeof AudioEngine !== 'undefined') {
        if (perfect) AudioEngine.SFX.perfectClear?.();
        else if (typeof AudioEngine.play === 'function') AudioEngine.play('waveClear');
        else AudioEngine.SFX.waveClear?.();
      }
    }

    // Reset per-wave counters after summary snapshot
    const snap = { ...lastSummary };
    resetWave();
    return snap;
  }

  /**
   * Night prep coaching tips based on army composition and economy.
   * Short, actionable lines only — never dump raw intel blobs.
   */
  function buildNightTips(ctx = {}) {
    const tips = [];
    const tp = Math.floor(ctx.tactical || 0);
    const army = ctx.army || 0;
    const builders = ctx.liveBuilders || 0;
    const walls = ctx.wallCount || 0;
    const wave = ctx.wave || 0;
    const hasHealer = !!ctx.hasHealer;
    const hasRanged = !!ctx.hasRanged;
    const hasMelee = !!ctx.hasMelee;
    const casualties = ctx.lastCasualties || lastSummary?.deaths || 0;

    if (tp >= 12 && army < 4)
      tips.push({ id: 'recruit', icon: '⚔', text: 'Low army — recruit before dawn.', priority: 9 });
    if (builders === 0 && tp >= 5 && wave < 40)
      tips.push({ id: 'builder', icon: '🔨', text: 'Deploy a Builder to fortify.', priority: 8 });
    if (walls < 2 && wave >= 3 && tp >= 6)
      tips.push({ id: 'walls', icon: '🧱', text: 'Thin walls — place cover.', priority: 7 });
    if (!hasRanged && army >= 3 && tp >= 4)
      tips.push({ id: 'ranged', icon: '🏹', text: 'No ranged — add archers.', priority: 6 });
    if (!hasMelee && army >= 2)
      tips.push({ id: 'melee', icon: '🛡', text: 'No front line — add footmen.', priority: 6 });
    if (!hasHealer && army >= 6 && wave >= 5 && tp >= 5)
      tips.push({ id: 'healer', icon: '✚', text: 'Bring a Healer or Med Tent.', priority: 5 });
    if (casualties >= 3)
      tips.push({ id: 'losses', icon: '⚠', text: 'Heavy losses — reinforce.', priority: 8 });
    if (tp >= 50 && wave >= 8)
      tips.push({
        id: 'economy',
        icon: '💰',
        text: 'Strong TP — expand or research.',
        priority: 4,
      });
    if (tp < 3 && army > 0)
      tips.push({ id: 'tight', icon: '⏳', text: 'Tight TP — hold and clear.', priority: 3 });

    tips.sort((a, b) => b.priority - a.priority);
    // One tip max — night prep card should stay scannable.
    nightTips = tips.slice(0, 1);
    return nightTips;
  }

  function getNightTips() {
    return nightTips;
  }

  function getRunSnapshot() {
    return {
      bestStreak,
      cleanSweeps,
      totalWaveClears,
      peakWaveKills,
      highlights: runHighlights.slice(),
      lastSummary,
      dangerLevel,
      killStreak,
    };
  }

  function onWaveStart(wave, opts = {}) {
    const label = opts.boss
      ? 'BOSS WAVE'
      : opts.horde
        ? 'HORDE WAVE'
        : opts.siege
          ? 'SIEGE WAVE'
          : `WAVE ${wave}`;
    const color = opts.boss
      ? '#ff4040'
      : opts.horde
        ? '#ff7030'
        : opts.siege
          ? '#c08040'
          : '#e8d5b0';
    showBanner(label, opts.subtitle || 'Hold the line', color, 72, 'wave');
    if (typeof BannerArt !== 'undefined') BannerArt.waveStart(wave, opts);
  }

  // ---------------------------------------------------------------- breaches
  let breachCount = 0;
  let breachLimit = 0;
  let breachPulse = 0; // 1 at the moment of a breach, decaying

  /** How many have got through, and how many the realm can bear. Drives the vignette. */
  function setBreachState(count, limit) {
    breachCount = Math.max(0, count | 0);
    breachLimit = Math.max(0, limit | 0);
  }

  function onBreach() {
    breachPulse = 1;
  }

  /** 0 with a clean line, 1 at the limit. */
  function breachPressure() {
    if (breachLimit <= 0 || breachCount <= 0) return 0;
    return Math.min(1, breachCount / breachLimit);
  }

  function updateDanger(units, worldH, homeY) {
    if (!settings().dangerVignette || !Array.isArray(units)) {
      dangerLevel *= 0.9;
      return dangerLevel;
    }
    const threshold = homeY != null ? homeY : worldH * 0.55;
    let deep = 0;
    let total = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u || u.hp <= 0 || u.team !== 'enemy') continue;
      total++;
      // How far past the threshold toward the player edge (south is higher y)
      if (u.y > threshold) {
        const depth = Math.min(1, (u.y - threshold) / Math.max(40, worldH - threshold));
        deep += depth;
      }
    }
    const target = total > 0 ? Math.min(1, deep / Math.max(3, total * 0.35)) : 0;
    dangerLevel += (target - dangerLevel) * 0.12;
    return dangerLevel;
  }

  function update() {
    if (streakTimer > 0) {
      streakTimer--;
      if (streakTimer <= 0) killStreak = 0;
    }
    if (multiKillLife > 0) multiKillLife--;
    updateMotionRation();
    if (breachPulse > 0) breachPulse = breachPulse < 0.02 ? 0 : breachPulse * 0.93;
    if (banner) {
      banner.life--;
      if (banner.life <= 0) banner = null;
    }
  }

  function drawBanner(ctx, canvasW, canvasH) {
    if (!ctx) return;
    // BannerArt owns every banner when it is loaded: one style, one queue.
    if (typeof BannerArt !== 'undefined') {
      BannerArt.draw(ctx, canvasW, canvasH);
      return;
    }
    if (!banner) return;
    const fade = Math.min(1, banner.life / 18, (banner.maxLife - banner.life + 1) / 8);
    if (fade <= 0.02) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = canvasH * 0.2;
    const plateW = Math.min(canvasW * 0.7, 420);
    ctx.fillStyle = '#07050a';
    ctx.fillRect(canvasW / 2 - plateW / 2, y - 22, plateW, 50);
    ctx.font = 'bold 24px Cinzel, serif';
    ctx.fillStyle = '#e4dcc4';
    ctx.fillText(banner.text, canvasW / 2, y);
    if (banner.sub) {
      ctx.font = '12px Cinzel, serif';
      ctx.fillText(banner.sub, canvasW / 2, y + 18);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- vignette
  // A blood-red vignette inked round the edge of the screen: hatched brush strokes reaching
  // in from every side. It reaches further in with every breach and lunges when one lands.
  // It is painted once per size and reach onto a half-size canvas and then only blitted.
  let vigCanvas = null;
  let vigKey = '';
  const VIG_LEVELS = 6;

  function paintVignette(w, h, level) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const cw = Math.max(2, Math.round(w / 2));
    const ch = Math.max(2, Math.round(h / 2));
    const c = vigCanvas || document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext && c.getContext('2d');
    if (!g) return null;
    g.clearRect(0, 0, cw, ch);
    const reach = Math.min(cw, ch) * (0.07 + 0.055 * level);
    // Deterministic scatter, so the edge does not crawl between repaints.
    let seed = 7 + level * 13;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    g.lineCap = 'round';
    const edge = (n, place) => {
      for (let i = 0; i < n; i++) {
        const k = (i + rnd() * 0.8) / n;
        const len = reach * (0.45 + rnd() * 0.9);
        const [x, y, dx, dy] = place(k);
        const skew = (rnd() - 0.5) * 0.5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (dx + dy * skew) * len, y + (dy + dx * skew) * len);
        g.stroke();
      }
    };
    const strokes = (n, width, color, alpha) => {
      g.strokeStyle = color;
      g.globalAlpha = alpha;
      g.lineWidth = width;
      edge(Math.round((n * cw) / 400), (k) => [k * cw, 0, 0, 1]);
      edge(Math.round((n * cw) / 400), (k) => [k * cw, ch, 0, -1]);
      edge(Math.round((n * ch) / 400), (k) => [0, k * ch, 1, 0]);
      edge(Math.round((n * ch) / 400), (k) => [cw, k * ch, -1, 0]);
    };
    // Blood first, long; then ink over the outer part, shorter; then a hard black rim.
    strokes(46, Math.max(3, reach * 0.16), '#8a0c14', 0.75);
    strokes(60, Math.max(2, reach * 0.09), '#c8141c', 0.6);
    const hold = reach;
    g.globalAlpha = 1;
    g.save();
    g.strokeStyle = '#07050a';
    g.lineWidth = Math.max(2, hold * 0.1);
    g.globalAlpha = 0.85;
    const short = (n, place) => {
      for (let i = 0; i < n; i++) {
        const k = (i + rnd() * 0.8) / n;
        const len = hold * (0.2 + rnd() * 0.45);
        const [x, y, dx, dy] = place(k);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + dx * len, y + dy * len);
        g.stroke();
      }
    };
    short(Math.round(cw / 7), (k) => [k * cw, 0, 0, 1]);
    short(Math.round(cw / 7), (k) => [k * cw, ch, 0, -1]);
    short(Math.round(ch / 7), (k) => [0, k * ch, 1, 0]);
    short(Math.round(ch / 7), (k) => [cw, k * ch, -1, 0]);
    g.restore();
    g.globalAlpha = 1;
    return c;
  }

  function drawDangerVignette(ctx, w, h) {
    if (!settings().dangerVignette || !ctx) return;
    const pressure = breachPressure();
    const d = dangerLevel;
    // Shown for breaches taken, for enemies deep past the line, and for the moment of a breach.
    const strength = Math.max(pressure, d * 0.6, breachPulse * 0.8);
    if (strength < 0.06) return;
    const level = Math.min(VIG_LEVELS - 1, Math.round(pressure * (VIG_LEVELS - 1)));
    const key = `${w}x${h}:${level}`;
    if (key !== vigKey || !vigCanvas) {
      const painted = paintVignette(w, h, level);
      if (!painted) return;
      vigCanvas = painted;
      vigKey = key;
    }
    const calm = reducedMotion();
    // A breach makes the edge lunge inward and settle back; the last breach left makes it throb.
    const lunge = calm ? 0 : breachPulse * 0.07;
    const beat =
      !calm && breachLimit > 0 && breachCount >= breachLimit - 1 && breachCount > 0
        ? 0.012 * (1 + Math.sin(Date.now() / 260))
        : 0;
    const m = lunge + beat;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(0.92, 0.3 + strength * 0.5 + breachPulse * 0.25);
    // Drawing the edge art a little smaller pushes it inward from all four sides; the strip
    // it leaves at the border is filled with ink.
    const mx = (w * m) / 2;
    const my = (h * m) / 2;
    if (m > 0.001) {
      ctx.fillStyle = '#07050a';
      ctx.fillRect(0, 0, w, my);
      ctx.fillRect(0, h - my, w, my);
      ctx.fillRect(0, my, mx, h - my * 2);
      ctx.fillRect(w - mx, my, mx, h - my * 2);
    }
    ctx.drawImage(vigCanvas, mx, my, w - mx * 2, h - my * 2);
    if (d > 0.45) {
      ctx.globalAlpha = Math.min(1, (d - 0.45) * 1.8);
      ctx.font = 'bold 12px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#07050a';
      ctx.lineWidth = 3.5;
      if (ctx.strokeText) ctx.strokeText('THEY ARE THROUGH THE LINE', w / 2, h - 36);
      ctx.fillStyle = '#e8564c';
      ctx.fillText('THEY ARE THROUGH THE LINE', w / 2, h - 36);
    }
    ctx.restore();
  }

  /** World-space low HP pulse under a unit. */
  function drawLowHpPulse(ctx, unit, tick = 0) {
    if (!settings().lowHpPulse || !unit || !(unit.hp > 0) || !unit.maxHp) return;
    const ratio = unit.hp / unit.maxHp;
    if (ratio > 0.28) return;
    const pulse = 0.35 + Math.sin(tick * 0.18 + (unit.x || 0) * 0.01) * 0.25;
    const r = 10 + (unit.spriteScale || 1) * 4;
    ctx.save();
    ctx.globalAlpha = pulse * (1 - ratio / 0.28) * 0.7;
    ctx.strokeStyle = ratio < 0.12 ? '#ff3030' : '#ff8040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function getKillStreak() {
    return killStreak;
  }

  function getWaveStats() {
    return { kills: waveKills, deaths: wavePlayerDeaths };
  }

  function getDangerLevel() {
    return dangerLevel;
  }

  function getBanner() {
    return banner;
  }

  function shouldAutoPauseNight() {
    return settings().autoPauseNight;
  }

  function getHighlights() {
    return runHighlights.slice();
  }

  /** Minimap corner danger pulse alpha 0..1 */
  function getMinimapDangerPulse(tick = 0) {
    if (dangerLevel < 0.25) return 0;
    const pulse = 0.5 + Math.sin(tick * 0.15) * 0.5;
    return dangerLevel * pulse;
  }

  return {
    resetRun,
    resetWave,
    settings,
    allowShake,
    allowHitStop,
    allowDamageNumbers,
    allowGore,
    onEnemyKilled,
    onPlayerDeath,
    onWaveClear,
    onWaveStart,
    buildNightTips,
    getNightTips,
    getRunSnapshot,
    updateDanger,
    update,
    drawBanner,
    drawDangerVignette,
    drawLowHpPulse,
    getKillStreak,
    getWaveStats,
    getDangerLevel,
    setBreachState,
    onBreach,
    breachPressure,
    showBanner,
    getMinimapDangerPulse,
    getBanner,
    getHighlights,
    shouldAutoPauseNight,
  };
})();
