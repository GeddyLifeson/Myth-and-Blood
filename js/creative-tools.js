/**
 * Creative Mode tools — scenarios, wave composer, replays, stress tests, sandbox stats.
 */
const CreativeTools = (() => {
  const VERSION = 1;
  const SANDBOX_KEY = 'myth-and-blood-creative-sandbox-v1';

  const TEMPLATES = [
    {
      id: 'empty',
      name: 'Empty Sandbox',
      desc: 'Four footmen, full TP, wave 0.',
      wave: 0, tp: 9999,
      allies: [{ type: 'footman', count: 4 }],
      settings: { freeResources: true, noGameOver: true, noAutoCycle: true },
    },
    {
      id: 'siege_drill',
      name: 'Siege Drill',
      desc: 'Walls + siege wave at wave 12.',
      wave: 12, tp: 8000,
      allies: [{ type: 'footman', count: 6 }, { type: 'archer', count: 4 }, { type: 'knight', count: 2 }],
      buildings: [{ type: 'wall', count: 8 }],
      customWave: 'siege_tower*2,goblin_sapper*2,orc*6,goblin*8',
      settings: { freeResources: true, noGameOver: true, noAutoCycle: true, instantBuild: true },
    },
    {
      id: 'boss_rush',
      name: 'Boss Rush',
      desc: 'Wave 30 boss composition.',
      wave: 30, tp: 12000,
      allies: [{ type: 'knight', count: 4 }, { type: 'mage', count: 2 }, { type: 'healer', count: 1 }],
      customWave: 'war_chief*1,dark_knight*3,necromancer*2,siege_tower*2,berserker*4',
      interval: 55,
    },
    {
      id: 'crossover_duel',
      name: 'Crossover Duel',
      desc: 'Wave 25 — test crossover vs elites.',
      wave: 25, tp: 15000,
      customWave: 'dark_knight*4,assassin*3,harpy*2,sky_drake*1',
      settings: { unlockAll: true, academyDeploy: true, freeResources: true },
    },
    {
      id: 'horde_stress',
      name: 'Horde Stress',
      desc: 'Auto-spawn goblins — perf test.',
      wave: 50, tp: 5000,
      allies: [{ type: 'ballista', count: 2 }, { type: 'pikeman', count: 4 }],
      stress: { type: 'goblin', every: 20, max: 200 },
      settings: { freeResources: true, noGameOver: true, noAutoCycle: true },
    },
    {
      id: 'wall_defense',
      name: 'Wall Defense',
      desc: 'Castle compound + mixed assault.',
      wave: 18, tp: 6000,
      buildings: [{ type: 'castle', count: 1 }],
      allies: [{ type: 'archer', count: 6 }, { type: 'footman', count: 4 }],
      customWave: 'orc*10,goblin*12,troll*2,warg_rider*3',
    },
    {
      id: 'academy_era',
      name: 'Academy Era',
      desc: 'Wave 105 — academy rules on.',
      wave: 105, tp: 4000,
      settings: { academyDeploy: false, freeResources: false, noGameOver: true, noAutoCycle: true },
    },
    {
      id: 'night_siege',
      name: 'Night Siege',
      desc: 'Force night + plague rats.',
      wave: 22, tp: 7000,
      customWave: 'plague_rat*8,goblin_burrower*4,orc*6,bone_summoner*1',
      forceNight: true,
    },
  ];

  const UNIT_PRESETS = {
    balanced: { label: 'Default', hp: null, damage: null, accuracy: null, speed: null },
    glass: { label: 'Glass Cannon', hpMult: 0.55, damageMult: 2.2, accuracy: null, speed: null },
    tank: { label: 'Tank', hpMult: 2.8, damageMult: 0.75, accuracy: null, speedMult: 0.85 },
    sniper: { label: 'Sniper', hpMult: 0.8, damageMult: 1.5, accuracy: 95, rangeMult: 1.35, speed: null },
    elite: { label: 'Elite Vet', vetGold: 3, hpMult: 1.2, damageMult: 1.15 },
    speedy: { label: 'Swift', speedMult: 1.6, hpMult: 0.9 },
  };

  let sandboxStats = {
    sessions: 0, spawns: 0, wavesLaunched: 0, templatesUsed: 0,
    scenariosExported: 0, scenariosImported: 0, replayFrames: 0,
    stressSpawns: 0, lastSession: null,
  };

  let recording = false;
  let replayFrames = [];
  let replayPlaying = false;
  let replayIndex = 0;
  let replayTimer = 0;

  let stress = { active: false, type: 'goblin', every: 30, max: 150, acc: 0 };
  let recordAcc = 0;

  function loadSandboxStats() {
    try {
      const raw = localStorage.getItem(SANDBOX_KEY);
      if (raw) sandboxStats = { ...sandboxStats, ...JSON.parse(raw) };
    } catch (_) { /* ignore */ }
  }

  function saveSandboxStats() {
    try {
      localStorage.setItem(SANDBOX_KEY, JSON.stringify(sandboxStats));
    } catch (_) { /* ignore */ }
    return sandboxStats;
  }

  function bumpStat(key, n = 1) {
    sandboxStats[key] = (sandboxStats[key] || 0) + n;
    saveSandboxStats();
  }

  function onSessionStart() {
    sandboxStats.sessions = (sandboxStats.sessions || 0) + 1;
    sandboxStats.lastSession = new Date().toISOString();
    saveSandboxStats();
  }

  function parseWaveComposer(text) {
    const queue = [];
    const parts = String(text || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^([\w]+)(?:\s*[*x×]\s*(\d+))?$/i);
      if (!m) continue;
      const type = m[1].toLowerCase();
      if (!EnemyDefs[type]) continue;
      const n = Math.min(500, parseInt(m[2], 10) || 1);
      for (let i = 0; i < n; i++) queue.push(type);
    }
    return queue;
  }

  function formatWaveComposer(queue) {
    const counts = {};
    for (const t of queue || []) counts[t] = (counts[t] || 0) + 1;
    return Object.entries(counts).map(([t, n]) => `${t}*${n}`).join(', ');
  }

  function captureSnapshot(label) {
    if (!Game?.getState || !Game?.getUnitsSnapshot) return null;
    const gs = Game.getState();
    return {
      v: VERSION,
      tick: gs.updateTick || 0,
      wave: gs.wave,
      tactical: gs.tactical,
      timeOfDay: gs.timeOfDay,
      label: label || '',
      units: Game.getUnitsSnapshot(),
      buildings: Game.getBuildingsSnapshot?.() || [],
      settings: { ...gs.creativeSettings },
    };
  }

  function recordFrame(label) {
    if (!recording) return;
    const snap = captureSnapshot(label);
    if (!snap) return;
    replayFrames.push(snap);
    bumpStat('replayFrames', 1);
    if (replayFrames.length > 800) replayFrames.shift();
  }

  function startRecording() {
    recording = true;
    replayFrames = [];
    recordFrame('start');
    return replayFrames.length;
  }

  function stopRecording() {
    recording = false;
    recordFrame('stop');
    return replayFrames.length;
  }

  function exportReplay() {
    return JSON.stringify({ version: VERSION, type: 'replay', frames: replayFrames }, null, 2);
  }

  function importReplay(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      replayFrames = data.frames || [];
      replayIndex = 0;
      replayPlaying = false;
      return replayFrames.length;
    } catch (_) { return 0; }
  }

  function playReplay(step = 1) {
    if (!replayFrames.length) return false;
    replayPlaying = true;
    replayIndex = Math.min(replayFrames.length - 1, replayIndex + step);
    const frame = replayFrames[replayIndex];
    Game?.restoreCreativeSnapshot?.(frame);
    return true;
  }

  function rewindReplay() {
    if (!replayFrames.length) return false;
    replayIndex = Math.max(0, replayIndex - 1);
    Game?.restoreCreativeSnapshot?.(replayFrames[replayIndex]);
    return true;
  }

  function stopReplay() {
    replayPlaying = false;
  }

  function tickRecord() {
    if (!recording || !Game?.isCreativeMode?.()) return;
    recordAcc++;
    if (recordAcc % 90 === 0) recordFrame('auto');
  }

  function setStress(opts = {}) {
    stress = { ...stress, ...opts };
    if (opts.active != null) stress.active = !!opts.active;
    return stress;
  }

  function tickStress() {
    if (!stress.active || !Game?.isCreativeMode?.()) return;
    stress.acc++;
    if (stress.acc < stress.every) return;
    stress.acc = 0;
    const enemies = Game.countEnemies?.() ?? 0;
    if (enemies >= stress.max) return;
    const pos = Game.randomMapEdgePos?.();
    if (pos && Game.creativeSpawnEnemyAt?.(stress.type, pos.x, pos.y)) {
      bumpStat('stressSpawns', 1);
      bumpStat('spawns', 1);
    }
  }

  function serializeScenario(name) {
    const snap = captureSnapshot(name || 'scenario');
    if (!snap) return null;
    snap.name = name || 'Custom Scenario';
    snap.customWave = Game.getCustomWave?.() || null;
    snap.stress = { ...stress };
    bumpStat('scenariosExported', 1);
    return JSON.stringify(snap, null, 2);
  }

  function deserializeScenario(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data || data.v !== VERSION) return { ok: false, msg: 'Invalid scenario version.' };
      Game?.restoreCreativeSnapshot?.(data);
      if (data.settings) {
        for (const [k, v] of Object.entries(data.settings)) {
          Game?.setCreativeSetting?.(k, v);
        }
      }
      if (data.customWave) Game?.setCustomWave?.(data.customWave);
      if (data.stress) setStress(data.stress);
      bumpStat('scenariosImported', 1);
      return { ok: true, name: data.name || data.label || 'Scenario' };
    } catch (e) {
      return { ok: false, msg: e.message || 'Parse failed.' };
    }
  }

  function applyTemplate(id) {
    const tpl = TEMPLATES.find(t => t.id === id);
    if (!tpl || !Game?.isCreativeMode?.()) return false;

    Game.creativeClearWaveSpawns?.();
    Game.creativeClearEnemies?.();
    Game.creativeClearEnemyBuildings?.();

    if (tpl.settings) {
      for (const [k, v] of Object.entries(tpl.settings)) Game.setCreativeSetting?.(k, v);
    }
    if (tpl.wave != null) Game.creativeSetWave?.(tpl.wave);
    if (tpl.tp != null) Game.creativeSetTp?.(tpl.tp);

    const cx = Game.getWorldCenter?.() || { x: 400, y: 300 };
    let ox = -60;
    for (const row of tpl.allies || []) {
      for (let i = 0; i < row.count; i++) {
        Game.creativeSpawnPlayerAt?.(row.type, cx.x + ox, cx.y + 20 + (i % 3) * 22);
        ox += 18;
      }
    }
    ox = 80;
    for (const row of tpl.buildings || []) {
      for (let i = 0; i < row.count; i++) {
        Game.creativeSpawnPlayerBuildingAt?.(row.type, cx.x + ox + i * 35, cx.y - 40);
      }
    }
    if (tpl.customWave) {
      Game.setCustomWave?.({ text: tpl.customWave, interval: tpl.interval || 50 });
    }
    if (tpl.forceNight) Game.creativeForceNight?.();
    if (tpl.stress) setStress({ ...tpl.stress, active: true });
    else setStress({ active: false });

    bumpStat('templatesUsed', 1);
    Game.showMessage?.(`Template: ${tpl.name}`, 280);
    recordFrame(`template:${id}`);
    return true;
  }

  function applyUnitPreset(presetId, unit) {
    const preset = UNIT_PRESETS[presetId];
    if (!preset || !unit) return false;
    return Game?.applyCreativeUnitPreset?.(unit, preset) ?? false;
  }

  function getSandboxStats() {
    return { ...sandboxStats };
  }

  function getTemplates() {
    return TEMPLATES.map(t => ({ id: t.id, name: t.name, desc: t.desc }));
  }

  function getUnitPresets() {
    return Object.entries(UNIT_PRESETS).map(([id, p]) => ({ id, label: p.label }));
  }

  function getReplayInfo() {
    return {
      recording,
      replayPlaying,
      frameCount: replayFrames.length,
      frameIndex: replayIndex,
      stress: { ...stress },
    };
  }

  loadSandboxStats();

  return {
    VERSION,
    TEMPLATES,
    UNIT_PRESETS,
    parseWaveComposer,
    formatWaveComposer,
    onSessionStart,
    bumpStat,
    getSandboxStats,
    getTemplates,
    getUnitPresets,
    applyTemplate,
    applyUnitPreset,
    serializeScenario,
    deserializeScenario,
    startRecording,
    stopRecording,
    exportReplay,
    importReplay,
    playReplay,
    rewindReplay,
    stopReplay,
    recordFrame,
    tickRecord,
    tickStress,
    setStress,
    getReplayInfo,
  };
})();