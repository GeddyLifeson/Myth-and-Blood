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

  function allowShake() {
    const s = settings();
    return s.combatShake && !reducedMotion();
  }

  function allowHitStop() {
    const s = settings();
    return s.hitStop && !reducedMotion();
  }

  function allowDamageNumbers() {
    return settings().damageNumbers;
  }

  function allowGore() {
    return settings().gore;
  }

  function showBanner(text, sub = '', color = '#ffd080', life = 90, kind = 'info') {
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
      tips.push({ id: 'economy', icon: '💰', text: 'Strong TP — expand or research.', priority: 4 });
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

  /** Suggest a one-line spend when player has free TP at night. */
  function suggestSpend(ctx = {}) {
    const tips = buildNightTips(ctx);
    return tips[0] || null;
  }

  function onWaveStart(wave, opts = {}) {
    const label = opts.boss
      ? 'BOSS WAVE'
      : opts.horde
        ? 'HORDE WAVE'
        : opts.siege
          ? 'SIEGE WAVE'
          : `WAVE ${wave}`;
    const color = opts.boss ? '#ff4040' : opts.horde ? '#ff7030' : opts.siege ? '#c08040' : '#e8d5b0';
    showBanner(label, opts.subtitle || 'Hold the line', color, 72, 'wave');
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
    if (banner) {
      banner.life--;
      if (banner.life <= 0) banner = null;
    }
  }

  function drawBanner(ctx, canvasW, canvasH) {
    if (!banner || !ctx) return;
    const a = banner.maxLife > 0 ? Math.min(1, banner.life / Math.min(20, banner.maxLife)) : 0;
    const intro = banner.maxLife > 0 ? 1 - banner.life / banner.maxLife : 0;
    const pop = intro < 0.15 ? intro / 0.15 : 1;
    const fade = banner.life < 18 ? banner.life / 18 : 1;
    const alpha = Math.min(a, fade) * 0.95;
    if (alpha <= 0.02) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const y = canvasH * 0.18 + (1 - pop) * 12;
    const size = (banner.kind === 'perfect' ? 28 : banner.kind === 'streak' ? 24 : 22) * (0.85 + pop * 0.2);

    // Soft plate behind text
    const plateW = Math.min(canvasW * 0.7, 420);
    ctx.fillStyle = 'rgba(12,8,6,0.55)';
    ctx.fillRect(canvasW / 2 - plateW / 2, y - size * 0.85, plateW, size * 1.9);

    ctx.font = `bold ${size}px Cinzel, serif`;
    ctx.fillStyle = '#1a1008';
    ctx.fillText(banner.text, canvasW / 2 + 1.5, y + 1.5);
    ctx.fillStyle = banner.color;
    if (banner.kind === 'perfect' || banner.kind === 'streak') {
      ctx.shadowColor = banner.color;
      ctx.shadowBlur = 12;
    }
    ctx.fillText(banner.text, canvasW / 2, y);
    ctx.shadowBlur = 0;

    if (banner.sub) {
      ctx.font = '12px Cinzel, serif';
      ctx.fillStyle = 'rgba(232,213,176,0.9)';
      ctx.fillText(banner.sub, canvasW / 2, y + size * 0.7);
    }
    ctx.restore();
  }

  function drawDangerVignette(ctx, w, h) {
    if (!settings().dangerVignette || dangerLevel < 0.08 || !ctx) return;
    const d = dangerLevel;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(w / 2, h * 0.55, w * 0.2, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, `rgba(80,10,10,${0.05 * d})`);
    g.addColorStop(1, `rgba(120,8,8,${0.22 + d * 0.35})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (d > 0.45) {
      ctx.globalAlpha = (d - 0.45) * 1.4;
      ctx.strokeStyle = `rgba(255,60,40,${0.25 + d * 0.35})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.font = 'bold 11px Cinzel';
      ctx.fillStyle = `rgba(255,120,90,${0.5 + d * 0.4})`;
      ctx.textAlign = 'center';
      ctx.fillText('LINE BREACHED — RALLY!', w / 2, h - 36);
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

  function getLastSummary() {
    return lastSummary;
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

  function getBestStreak() {
    return bestStreak;
  }

  function getCleanSweeps() {
    return cleanSweeps;
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
    showBanner,
    onEnemyKilled,
    onPlayerDeath,
    onWaveClear,
    onWaveStart,
    buildNightTips,
    getNightTips,
    suggestSpend,
    getRunSnapshot,
    updateDanger,
    update,
    drawBanner,
    drawDangerVignette,
    drawLowHpPulse,
    getKillStreak,
    getBestStreak,
    getCleanSweeps,
    getWaveStats,
    getLastSummary,
    getDangerLevel,
    getMinimapDangerPulse,
    getBanner,
    getHighlights,
    shouldAutoPauseNight,
  };
})();

