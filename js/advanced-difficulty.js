/**
 * Advanced difficulty modifiers — stacks on base difficulty %.
 * Baby 50%, Normal 100%, Chad 150%, Doomslayer 200%.
 */
const DIFFICULTY_BASE_PERCENT = {
  baby: 50,
  normal: 100,
  chad: 150,
  doomslayer: 200,
};

const AdvancedDifficulty = (() => {
  const MODIFIERS = [
    { id: 'ally_hp_up', label: 'Ally HP +15%', pct: -12, allyHpMult: 1.15 },
    { id: 'ally_hp_down', label: 'Ally HP -15%', pct: 12, allyHpMult: 0.85 },
    { id: 'ally_dmg_up', label: 'Ally Damage +12%', pct: -10, allyDmgMult: 1.12 },
    { id: 'ally_dmg_down', label: 'Ally Damage -12%', pct: 10, allyDmgMult: 0.88 },
    { id: 'tp_bonus', label: 'TP Income +20%', pct: -8, tpMult: 1.2 },
    { id: 'tp_penalty', label: 'TP Income -15%', pct: 8, tpMult: 0.85 },
    { id: 'enemy_hp_up', label: 'Enemy HP +20%', pct: 18, enemyHpMult: 1.2 },
    { id: 'enemy_hp_down', label: 'Enemy HP -15%', pct: -14, enemyHpMult: 0.85 },
    { id: 'enemy_dmg_up', label: 'Enemy Damage +18%', pct: 16, enemyDmgMult: 1.18 },
    { id: 'enemy_count_up', label: 'Enemy Count +25%', pct: 20, enemyCountMult: 1.25 },
    { id: 'spawn_faster', label: 'Faster Spawns', pct: 14, spawnIntervalMult: 0.78 },
    { id: 'spawn_slower', label: 'Slower Spawns', pct: -10, spawnIntervalMult: 1.25 },
    { id: 'elite_more', label: 'More Elites', pct: 12, eliteChanceMult: 1.35 },
    { id: 'elite_less', label: 'Fewer Elites', pct: -8, eliteChanceMult: 0.7 },
    { id: 'goblin_swarm', label: 'Goblin Swarm +30%', pct: 6, enemyWeight: { goblin: 1.3, goblin_sapper: 1.2 } },
    { id: 'orc_horde', label: 'Orc Horde +25%', pct: 8, enemyWeight: { orc: 1.25, orc_archer: 1.2 } },
    { id: 'siege_heavy', label: 'Siege Heavy +40%', pct: 15, enemyWeight: { siege_tower: 1.4, goblin_sapper: 1.3 } },
    { id: 'mage_storm', label: 'Dark Mage Storm', pct: 10, enemyWeight: { dark_mage: 1.5, necromancer: 1.4 } },
    { id: 'cavalry_raiders', label: 'Warg Raider Rush', pct: 9, enemyWeight: { warg_rider: 1.45, berserker: 1.2 } },
    { id: 'boss_heavy', label: 'Boss Pressure', pct: 18, enemyWeight: { war_chief: 1.5, troll: 1.3, dark_knight: 1.25 } },
    { id: 'miss_tight', label: 'Tighter Breakthrough Limit', pct: 10, missLimitDelta: -2 },
    { id: 'miss_loose', label: 'Forgiving Breakthroughs', pct: -6, missLimitDelta: 2 },
    { id: 'morale_crisis', label: 'Morale Crisis', pct: 11, playerMoraleDelta: -4 },
    { id: 'iron_resolve', label: 'Iron Resolve', pct: -7, playerMoraleDelta: 4 },
    { id: 'flyer_swarm', label: 'Flyer Swarm +35%', pct: 9, enemyWeight: { harpy: 1.35, sky_drake: 1.25 } },
    { id: 'burrower_wave', label: 'Burrower Infestation', pct: 8, enemyWeight: { goblin_burrower: 1.5, plague_rat: 1.2 } },
    { id: 'undead_rise', label: 'Undead Rise', pct: 11, enemyWeight: { necromancer: 1.4, bone_summoner: 1.35, shaman: 1.15 } },
    { id: 'assassin_hunt', label: 'Assassin Contract', pct: 13, enemyWeight: { assassin: 1.6, dark_knight: 1.2 } },
    { id: 'night_terror', label: 'Night Terror', pct: 7, nightPrepMult: 0.7 },
    { id: 'tp_drought', label: 'TP Drought -25%', pct: 9, tpMult: 0.75 },
    { id: 'builder_slow', label: 'Builder Fatigue', pct: 6, buildSpeedMult: 0.8 },
    { id: 'ally_acc_down', label: 'Ally Accuracy -10%', pct: 8, allyAccDelta: -10 },
    { id: 'ally_acc_up', label: 'Ally Accuracy +10%', pct: -8, allyAccDelta: 10 },
    { id: 'double_siege', label: 'Double Siege Waves', pct: 16, siegeWaveMult: 1.5 },
    { id: 'no_elites', label: 'No Elites (Swarm)', pct: -12, forceNoElites: true },
    { id: 'elite_only', label: 'Elite Parade', pct: 22, eliteChanceMult: 2, enemyWeight: { dark_knight: 1.4, war_chief: 1.3 } },
  ];

  const CONFLICT_GROUPS = [
    ['ally_hp_up', 'ally_hp_down'],
    ['ally_dmg_up', 'ally_dmg_down'],
    ['enemy_hp_up', 'enemy_hp_down'],
    ['tp_bonus', 'tp_drought'],
    ['spawn_faster', 'spawn_slower'],
    ['elite_more', 'elite_less', 'no_elites', 'elite_only'],
    ['miss_tight', 'miss_loose'],
    ['morale_crisis', 'iron_resolve'],
    ['ally_acc_up', 'ally_acc_down'],
  ];

  const PRESETS = [
    { id: 'siege_nightmare', label: 'Siege Nightmare', desc: 'Heavy towers, fast spawns, tougher walls to crack.', mods: ['siege_heavy', 'spawn_faster', 'enemy_hp_up', 'double_siege'] },
    { id: 'economy_crunch', label: 'Economy Crunch', desc: 'Tight TP and morale — plan every purchase.', mods: ['tp_drought', 'morale_crisis', 'miss_tight'] },
    { id: 'goblin_hell', label: 'Goblin Hell', desc: 'Swarms, burrowers, and plague rats.', mods: ['goblin_swarm', 'burrower_wave', 'spawn_faster'] },
    { id: 'elite_gauntlet', label: 'Elite Gauntlet', desc: 'Boss pressure and assassins hunting your General.', mods: ['elite_only', 'boss_heavy', 'assassin_hunt'] },
    { id: 'iron_wall', label: 'Iron Wall', desc: 'Buffed allies, forgiving breakthroughs.', mods: ['ally_hp_up', 'ally_dmg_up', 'miss_loose', 'iron_resolve'] },
    { id: 'blitz', label: 'Blitz Pace', desc: 'Fast spawns, fewer elites, TP bonus — race the waves.', mods: ['spawn_faster', 'elite_less', 'tp_bonus', 'night_terror'] },
    { id: 'mage_apocalypse', label: 'Mage Apocalypse', desc: 'Dark mages and undead casters dominate.', mods: ['mage_storm', 'undead_rise', 'enemy_dmg_up'] },
    { id: 'sky_raid', label: 'Sky Raid', desc: 'Flyers and warg riders — bring anti-air.', mods: ['flyer_swarm', 'cavalry_raiders', 'enemy_count_up'] },
  ];

  let active = new Set();
  let lockedForRun = false;

  function getModifiers() {
    return MODIFIERS;
  }

  function getConflictGroups() {
    return CONFLICT_GROUPS;
  }

  function conflictsWithActive(id) {
    for (const g of CONFLICT_GROUPS) {
      if (!g.includes(id)) continue;
      if (g.some(x => x !== id && active.has(x))) return true;
    }
    return false;
  }

  function toggle(id) {
    if (lockedForRun) return active.has(id);
    if (active.has(id)) active.delete(id);
    else {
      if (conflictsWithActive(id)) return false;
      active.add(id);
    }
    return active.has(id);
  }

  function setActive(ids) {
    active = new Set(ids || []);
  }

  function applyPreset(presetId) {
    if (lockedForRun) return false;
    const p = PRESETS.find(x => x.id === presetId);
    if (!p) return false;
    setActive(p.mods);
    return true;
  }

  function lockForRun(lock = true) {
    lockedForRun = !!lock;
  }

  function unlockForRun() {
    lockedForRun = false;
  }

  function isLockedForRun() {
    return lockedForRun;
  }

  function getActiveIds() {
    return [...active];
  }

  function getCombinedMods() {
    const combined = {
      allyHpMult: 1, allyDmgMult: 1, tpMult: 1,
      enemyHpMult: 1, enemyDmgMult: 1, enemyCountMult: 1,
      spawnIntervalMult: 1, eliteChanceMult: 1,
      enemyWeight: {},
      missLimitDelta: 0, playerMoraleDelta: 0,
      allyAccDelta: 0, nightPrepMult: 1, buildSpeedMult: 1,
      siegeWaveMult: 1, forceNoElites: false,
      pctDelta: 0,
    };
    for (const id of active) {
      const m = MODIFIERS.find(x => x.id === id);
      if (!m) continue;
      combined.pctDelta += m.pct || 0;
      if (m.allyHpMult) combined.allyHpMult *= m.allyHpMult;
      if (m.allyDmgMult) combined.allyDmgMult *= m.allyDmgMult;
      if (m.tpMult) combined.tpMult *= m.tpMult;
      if (m.enemyHpMult) combined.enemyHpMult *= m.enemyHpMult;
      if (m.enemyDmgMult) combined.enemyDmgMult *= m.enemyDmgMult;
      if (m.enemyCountMult) combined.enemyCountMult *= m.enemyCountMult;
      if (m.spawnIntervalMult) combined.spawnIntervalMult *= m.spawnIntervalMult;
      if (m.eliteChanceMult) combined.eliteChanceMult *= m.eliteChanceMult;
      if (m.missLimitDelta) combined.missLimitDelta += m.missLimitDelta;
      if (m.playerMoraleDelta) combined.playerMoraleDelta += m.playerMoraleDelta;
      if (m.allyAccDelta) combined.allyAccDelta += m.allyAccDelta;
      if (m.nightPrepMult) combined.nightPrepMult *= m.nightPrepMult;
      if (m.buildSpeedMult) combined.buildSpeedMult *= m.buildSpeedMult;
      if (m.siegeWaveMult) combined.siegeWaveMult *= m.siegeWaveMult;
      if (m.forceNoElites) combined.forceNoElites = true;
      if (m.enemyWeight) {
        for (const [k, v] of Object.entries(m.enemyWeight)) {
          combined.enemyWeight[k] = (combined.enemyWeight[k] || 1) * v;
        }
      }
    }
    return combined;
  }

  function getDifficultyPercent(baseId) {
    const base = DIFFICULTY_BASE_PERCENT[baseId] ?? 100;
    return Math.max(10, Math.round(base + getCombinedMods().pctDelta));
  }

  function renderPanel() {
    const grid = document.getElementById('advanced-diff-grid');
    const pctEl = document.getElementById('advanced-diff-pct');
    const pctPanel = document.getElementById('advanced-diff-pct-panel');
    if (!grid) return;
    const baseId = document.querySelector('.diff-btn.selected')?.dataset.diff || 'normal';
    const pct = `${getDifficultyPercent(baseId)}%`;
    if (pctEl) pctEl.textContent = `Effective: ${pct}`;
    if (pctPanel) pctPanel.textContent = `Effective: ${pct}`;
    const presetEl = document.getElementById('advanced-diff-presets');
    if (presetEl) {
      presetEl.innerHTML = PRESETS.map(p => `
        <button type="button" class="adv-preset-btn" data-preset="${p.id}" title="${p.desc}" ${lockedForRun ? 'disabled' : ''}>${p.label}</button>
      `).join('');
      presetEl.querySelectorAll('.adv-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (applyPreset(btn.dataset.preset)) {
            renderPanel();
            if (typeof GameModes !== 'undefined') {
              const diff = document.querySelector('.diff-btn.selected')?.dataset.diff || 'normal';
              GameModes.renderScalingPanel(diff);
            }
            AudioEngine?.SFX?.click?.();
          }
        });
      });
    }

    const scaleEl = document.getElementById('scaling-breakdown');
    if (scaleEl && typeof GameModes !== 'undefined') {
      GameModes.renderScalingPanel(baseId);
    }

    if (lockedForRun) {
      grid.innerHTML = `<p class="adv-locked-msg">Modifiers locked for this run (Roguelike / Daily / Weekly).</p>
        ${[...active].map(id => {
          const m = MODIFIERS.find(x => x.id === id);
          return m ? `<div class="adv-mod-row on locked"><span class="adv-mod-label">${m.label}</span></div>` : '';
        }).join('')}`;
      return;
    }

    grid.innerHTML = MODIFIERS.map(m => `
      <label class="adv-mod-row ${active.has(m.id) ? 'on' : ''} ${conflictsWithActive(m.id) && !active.has(m.id) ? 'conflict' : ''}">
        <input type="checkbox" data-mod="${m.id}" ${active.has(m.id) ? 'checked' : ''} ${conflictsWithActive(m.id) && !active.has(m.id) ? 'disabled' : ''}>
        <span class="adv-mod-label">${m.label}</span>
        <span class="adv-mod-pct">${m.pct > 0 ? '+' : ''}${m.pct}%</span>
      </label>
    `).join('');
    grid.querySelectorAll('input[data-mod]').forEach(inp => {
      inp.addEventListener('change', () => {
        toggle(inp.dataset.mod);
        renderPanel();
        AudioEngine?.SFX?.click?.();
      });
    });
  }

  function togglePanel() {
    const panel = document.getElementById('advanced-diff-screen');
    if (!panel) return;
    const open = panel.classList.toggle('active');
    if (open) renderPanel();
  }

  function init() {
    document.getElementById('advanced-diff-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      togglePanel();
    });
    document.getElementById('advanced-diff-close')?.addEventListener('click', () => {
      document.getElementById('advanced-diff-screen')?.classList.remove('active');
    });
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pctEl = document.getElementById('advanced-diff-pct');
        if (pctEl) pctEl.textContent = `${getDifficultyPercent(btn.dataset.diff)}%`;
      });
    });
  }

  function getActiveModCount() {
    return active.size;
  }

  return {
    init, toggle, setActive, getActiveIds, getActiveModCount, getCombinedMods,
    getDifficultyPercent, getModifiers, getPresets: () => PRESETS,
    getConflictGroups, applyPreset, lockForRun, unlockForRun, isLockedForRun,
    renderPanel, togglePanel,
  };
})();