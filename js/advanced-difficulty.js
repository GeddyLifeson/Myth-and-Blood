/**
 * Advanced difficulty modifiers — stacks on base difficulty %.
 * Baby 50%, Normal 100%, Chad 150%, Hellbane 200%.
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
    {
      id: 'goblin_swarm',
      label: 'Goblin Swarm +30%',
      pct: 6,
      enemyWeight: { goblin: 1.3, goblin_sapper: 1.2 },
    },
    {
      id: 'orc_horde',
      label: 'Orc Horde +25%',
      pct: 8,
      enemyWeight: { orc: 1.25, orc_archer: 1.2 },
    },
    {
      id: 'siege_heavy',
      label: 'Siege Heavy +40%',
      pct: 15,
      enemyWeight: { siege_tower: 1.4, goblin_sapper: 1.3 },
    },
    {
      id: 'mage_storm',
      label: 'Dark Mage Storm',
      pct: 10,
      enemyWeight: { dark_mage: 1.5, necromancer: 1.4 },
    },
    {
      id: 'cavalry_raiders',
      label: 'Warg Raider Rush',
      pct: 9,
      enemyWeight: { warg_rider: 1.45, berserker: 1.2 },
    },
    {
      id: 'boss_heavy',
      label: 'Boss Pressure',
      pct: 18,
      enemyWeight: { war_chief: 1.5, troll: 1.3, dark_knight: 1.25 },
    },
    { id: 'miss_tight', label: 'Harsher Attrition', pct: 10, missLimitDelta: -2 },
    { id: 'miss_loose', label: 'Forgiving Attrition', pct: -6, missLimitDelta: 2 },
    { id: 'morale_crisis', label: 'Morale Crisis', pct: 11, playerMoraleDelta: -4 },
    { id: 'iron_resolve', label: 'Iron Resolve', pct: -7, playerMoraleDelta: 4 },
    {
      id: 'flyer_swarm',
      label: 'Flyer Swarm +35%',
      pct: 9,
      enemyWeight: { harpy: 1.35, sky_drake: 1.25 },
    },
    {
      id: 'burrower_wave',
      label: 'Burrower Infestation',
      pct: 8,
      enemyWeight: { goblin_burrower: 1.5, plague_rat: 1.2 },
    },
    {
      id: 'undead_rise',
      label: 'Undead Rise',
      pct: 11,
      enemyWeight: { necromancer: 1.4, bone_summoner: 1.35, shaman: 1.15 },
    },
    {
      id: 'assassin_hunt',
      label: 'Assassin Contract',
      pct: 13,
      enemyWeight: { assassin: 1.6, dark_knight: 1.2 },
    },
    { id: 'night_terror', label: 'Night Terror', pct: 7, nightPrepMult: 0.7 },
    { id: 'tp_drought', label: 'TP Drought -25%', pct: 9, tpMult: 0.75 },
    { id: 'builder_slow', label: 'Builder Fatigue', pct: 6, buildSpeedMult: 0.8 },
    { id: 'ally_acc_down', label: 'Ally Accuracy -10%', pct: 8, allyAccDelta: -10 },
    { id: 'ally_acc_up', label: 'Ally Accuracy +10%', pct: -8, allyAccDelta: 10 },
    { id: 'double_siege', label: 'Double Siege Waves', pct: 16, siegeWaveMult: 1.5 },
    { id: 'no_elites', label: 'No Elites (Swarm)', pct: -12, forceNoElites: true },
    {
      id: 'elite_only',
      label: 'Elite Parade',
      pct: 22,
      eliteChanceMult: 2,
      enemyWeight: { dark_knight: 1.4, war_chief: 1.3 },
    },
    {
      id: 'fog_of_war',
      label: 'Fog of War',
      pct: 12,
      fogOfWar: true,
      fogVisionMult: 0.78,
    },
    {
      id: 'deep_fog',
      label: 'Deep Fog',
      pct: 17,
      fogOfWar: true,
      fogVisionMult: 0.55,
    },
    {
      id: 'clear_skies',
      label: 'Clear Skies',
      pct: -7,
      fogVisionMult: 1.28,
    },
    {
      id: 'resource_scarcity',
      label: 'Resource Scarcity',
      pct: 11,
      settlementTpMult: 0.65,
      tpMult: 0.88,
    },
    {
      id: 'lean_harvest',
      label: 'Lean Harvest',
      pct: 7,
      settlementTpMult: 0.72,
    },
    {
      id: 'harsh_winter',
      label: 'Harsh Winter',
      pct: 9,
      nightPrepMult: 0.82,
      buildSpeedMult: 0.82,
    },
    {
      id: 'relentless_push',
      label: 'Relentless Push',
      pct: 13,
      spawnIntervalMult: 0.72,
      enemyDmgMult: 1.08,
    },
    {
      id: 'plague_supply',
      label: 'Plague Supply Lines',
      pct: 10,
      tpMult: 0.82,
      playerMoraleDelta: -3,
      enemyWeight: { plague_rat: 1.35, goblin_burrower: 1.15 },
    },
    {
      id: 'iron_tax',
      label: 'Iron Tax',
      pct: 8,
      tpMult: 0.9,
      buildSpeedMult: 0.88,
    },
    {
      id: 'scorched_earth',
      label: 'Scorched Earth',
      pct: 14,
      settlementTpMult: 0.58,
      enemyCountMult: 1.12,
    },
  ];

  const CONFLICT_GROUPS = [
    ['ally_hp_up', 'ally_hp_down'],
    ['ally_dmg_up', 'ally_dmg_down'],
    ['enemy_hp_up', 'enemy_hp_down'],
    [
      'tp_bonus',
      'tp_penalty',
      'tp_drought',
      'resource_scarcity',
      'lean_harvest',
      'iron_tax',
      'scorched_earth',
    ],
    ['night_terror', 'harsh_winter'],
    // clear_skies stacks with fog (boosts vision radius) — only fog tiers conflict.
    ['fog_of_war', 'deep_fog'],
    ['spawn_faster', 'spawn_slower'],
    ['elite_more', 'elite_less', 'no_elites', 'elite_only'],
    ['miss_tight', 'miss_loose'],
    ['morale_crisis', 'iron_resolve'],
    ['ally_acc_up', 'ally_acc_down'],
  ];

  const PRESETS = [
    {
      id: 'siege_nightmare',
      label: 'Siege Nightmare',
      desc: 'Heavy towers, fast spawns, tougher walls to crack.',
      mods: ['siege_heavy', 'spawn_faster', 'enemy_hp_up', 'double_siege'],
    },
    {
      id: 'economy_crunch',
      label: 'Economy Crunch',
      desc: 'Tight TP and morale: plan every purchase.',
      mods: ['tp_drought', 'morale_crisis', 'miss_tight'],
    },
    {
      id: 'goblin_hell',
      label: 'Goblin Hell',
      desc: 'Swarms, burrowers, and plague rats.',
      mods: ['goblin_swarm', 'burrower_wave', 'spawn_faster'],
    },
    {
      id: 'elite_gauntlet',
      label: 'Elite Gauntlet',
      desc: 'Boss pressure and assassins hunting your General.',
      mods: ['elite_only', 'boss_heavy', 'assassin_hunt'],
    },
    {
      id: 'iron_wall',
      label: 'Iron Wall',
      desc: 'Buffed allies, forgiving attrition.',
      mods: ['ally_hp_up', 'ally_dmg_up', 'miss_loose', 'iron_resolve'],
    },
    {
      id: 'blitz',
      label: 'Blitz Pace',
      desc: 'Fast spawns, fewer elites, TP bonus: race the waves.',
      mods: ['spawn_faster', 'elite_less', 'tp_bonus', 'night_terror'],
    },
    {
      id: 'mage_apocalypse',
      label: 'Mage Apocalypse',
      desc: 'Dark mages and undead casters dominate.',
      mods: ['mage_storm', 'undead_rise', 'enemy_dmg_up'],
    },
    {
      id: 'sky_raid',
      label: 'Sky Raid',
      desc: 'Flyers and warg riders: bring anti-air.',
      mods: ['flyer_swarm', 'cavalry_raiders', 'enemy_count_up'],
    },
    {
      id: 'fog_siege',
      label: 'Fog Siege',
      desc: 'Limited vision: scouts and watchtowers under siege pressure.',
      mods: ['fog_of_war', 'siege_heavy', 'spawn_faster'],
    },
    {
      id: 'scarcity_run',
      label: 'Scarcity Run',
      desc: 'Tight hamlet income, TP drought, harsh attrition.',
      mods: ['resource_scarcity', 'morale_crisis', 'miss_tight'],
    },
    {
      id: 'total_war',
      label: 'Total War',
      desc: 'Deep fog, scarce resources, relentless host assault.',
      mods: ['deep_fog', 'scorched_earth', 'relentless_push', 'enemy_count_up'],
    },
    {
      id: 'winter_campaign',
      label: 'Winter Campaign',
      desc: 'Short nights, slow builders, undead pressure.',
      mods: ['harsh_winter', 'undead_rise', 'plague_supply'],
    },
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
      if (g.some((x) => x !== id && active.has(x))) return true;
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
    const p = PRESETS.find((x) => x.id === presetId);
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

  function getActiveIds() {
    return [...active];
  }

  function getCombinedMods() {
    const combined = {
      allyHpMult: 1,
      allyDmgMult: 1,
      tpMult: 1,
      enemyHpMult: 1,
      enemyDmgMult: 1,
      enemyCountMult: 1,
      spawnIntervalMult: 1,
      eliteChanceMult: 1,
      enemyWeight: {},
      missLimitDelta: 0,
      playerMoraleDelta: 0,
      allyAccDelta: 0,
      nightPrepMult: 1,
      buildSpeedMult: 1,
      siegeWaveMult: 1,
      settlementTpMult: 1,
      fogOfWar: false,
      fogVisionMult: 1,
      forceNoElites: false,
      pctDelta: 0,
    };
    for (const id of active) {
      const m = MODIFIERS.find((x) => x.id === id);
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
      if (m.settlementTpMult) combined.settlementTpMult *= m.settlementTpMult;
      if (m.fogOfWar) combined.fogOfWar = true;
      if (m.fogVisionMult) combined.fogVisionMult *= m.fogVisionMult;
      if (m.forceNoElites) combined.forceNoElites = true;
      if (m.enemyWeight) {
        for (const [k, v] of Object.entries(m.enemyWeight)) {
          combined.enemyWeight[k] = (combined.enemyWeight[k] || 1) * v;
        }
      }
    }
    // Muster trade-off perks pay their cost through the same wave and breach rules.
    if (typeof CrownLegacies !== 'undefined' && CrownLegacies.getCombinedEffects) {
      const perk = CrownLegacies.getCombinedEffects();
      combined.missLimitDelta += perk.missLimitDelta || 0;
      combined.enemyCountMult *= perk.enemyCountMult || 1;
    }
    return combined;
  }

  function getPlayerVisionRange(unit, visionMult = 1) {
    if (!unit || unit.team !== 'player' || unit.hp <= 0) return 0;
    let range = 155;
    if (unit.type === 'scout') range = 265;
    else if (unit.type === 'knight') range = 195;
    else if (unit.type === 'archer' || unit.combatType === 'ranged') range = 205;
    else if (unit.type === 'general') range = 220;
    if (unit.revealsStealth) range += 45;
    return range * visionMult;
  }

  function isEnemySpotted(unit, ctx = {}) {
    if (!unit || unit.team !== 'enemy' || unit.hp <= 0) return true;
    const units = ctx.units || [];
    const buildings = ctx.buildings || [];
    const rallyY = ctx.rallyY ?? 500;
    const dayPhase = ctx.isDayPhase !== false;
    const visionMult = ctx.visionMult ?? 1;

    if (dayPhase && unit.y > rallyY - 55) return true;

    for (const u of units) {
      if (u.team !== 'player' || u.hp <= 0) continue;
      const dist = Math.hypot(u.x - unit.x, u.y - unit.y);
      if (dist <= 88) return true;
      if (dist <= getPlayerVisionRange(u, visionMult)) return true;
    }

    for (const b of buildings) {
      if (b.owner !== 'player' || b.hp <= 0 || !b.complete) continue;
      const dist = Math.hypot(b.x - unit.x, b.y - unit.y);
      if (b.type === 'watchtower' || b.isWatchtower) {
        const vr = (b.visionRadius || 220) * visionMult;
        if (dist <= vr) return true;
      }
      if (b.type === 'castle' || b.type === 'keep') {
        if (dist <= 300 * visionMult) return true;
      }
      if (b.type === 'outpost' && dist <= 180 * visionMult) return true;
    }
    return false;
  }

  function isEnemyFogHidden(unit, ctx = {}) {
    const mods = getCombinedMods();
    if (!mods.fogOfWar || !unit || unit.team !== 'enemy' || unit.hp <= 0) return false;
    return !isEnemySpotted(unit, { ...ctx, visionMult: mods.fogVisionMult || 1 });
  }

  function getDifficultyPercent(baseId) {
    const base = DIFFICULTY_BASE_PERCENT[baseId] ?? 100;
    return Math.max(10, Math.round(base + getCombinedMods().pctDelta));
  }

  /** Same rule as SiegeLoop.computeScore: each modifier scales the score by 1 + pct/100. */
  function scoreMult(m) {
    return Math.max(0.5, 1 + (Number(m.pct) || 0) / 100);
  }

  function getScoreMultiplier() {
    let mult = 1;
    for (const id of active) {
      const m = MODIFIERS.find((x) => x.id === id);
      if (m) mult *= scoreMult(m);
    }
    return Math.round(mult * 1000) / 1000;
  }

  /** Easier/harder pairs (one negative, one positive) shown as one three-state row. */
  function getPairs() {
    const out = [];
    for (const g of CONFLICT_GROUPS) {
      if (g.length !== 2) continue;
      const [a, b] = g.map((id) => MODIFIERS.find((m) => m.id === id));
      if (!a || !b || Math.sign(a.pct) === Math.sign(b.pct)) continue;
      out.push(a.pct < 0 ? [a, b] : [b, a]);
    }
    return out;
  }

  function conflictReason(id) {
    for (const g of CONFLICT_GROUPS) {
      if (!g.includes(id)) continue;
      const other = g.find((x) => x !== id && active.has(x));
      if (other) return `Conflicts with ${MODIFIERS.find((m) => m.id === other)?.label || other}`;
    }
    return '';
  }

  const fmtMult = (m) => `×${scoreMult(m).toFixed(2)}`;

  function pairRow(easy, hard) {
    const state = active.has(easy.id) ? easy.id : active.has(hard.id) ? hard.id : '';
    const opt = (id, label, title) =>
      `<button type="button" class="adv-tri-btn${state === id ? ' on' : ''}" data-tri="${easy.id}|${hard.id}" data-set="${id}"${lockedForRun ? ' disabled' : ''} title="${title}">${label}</button>`;
    return (
      `<div class="adv-mod-row adv-tri${state ? ' on' : ''}">` +
      opt(
        easy.id,
        `${easy.label} <span class="adv-mod-pct">${fmtMult(easy)}</span>`,
        'Easier: lowers the score'
      ) +
      opt('', 'Off', 'No change') +
      opt(
        hard.id,
        `${hard.label} <span class="adv-mod-pct">${fmtMult(hard)}</span>`,
        'Harder: raises the score'
      ) +
      `</div>`
    );
  }

  function singleRow(m) {
    const on = active.has(m.id);
    const reason = on ? '' : conflictReason(m.id);
    const kind = m.pct >= 0 ? 'Handicap' : 'Aid';
    return (
      `<label class="adv-mod-row ${on ? 'on' : ''} ${reason ? 'conflict' : ''}" title="${reason || kind}">` +
      `<input type="checkbox" data-mod="${m.id}" ${on ? 'checked' : ''} ${reason || lockedForRun ? 'disabled' : ''}>` +
      `<span class="adv-mod-label">${m.label}${reason ? `<span class="adv-mod-reason">${reason}</span>` : ''}</span>` +
      `<span class="adv-mod-pct">${fmtMult(m)} score</span>` +
      `</label>`
    );
  }

  function refreshTotals(baseId) {
    const pct = `${getDifficultyPercent(baseId)}%`;
    const pctEl = document.getElementById('advanced-diff-pct');
    const pctPanel = document.getElementById('advanced-diff-pct-panel');
    if (pctEl) pctEl.textContent = `Effective: ${pct}`;
    const mult = getScoreMultiplier();
    if (pctPanel) {
      const n = active.size;
      pctPanel.textContent = `Effective difficulty ${pct} · score ×${mult.toFixed(2)} from ${n} modifier${n === 1 ? '' : 's'}`;
    }
  }

  function renderPanel() {
    const grid = document.getElementById('advanced-diff-grid');
    if (!grid) return;
    const baseId = document.querySelector('.diff-btn.selected')?.dataset.diff || 'normal';
    refreshTotals(baseId);
    const rerender = () => {
      renderPanel();
      if (typeof GameModes !== 'undefined') GameModes.renderScalingPanel(baseId);
      globalThis.AudioEngine?.SFX?.click?.();
    };
    const presetEl = document.getElementById('advanced-diff-presets');
    if (presetEl) {
      presetEl.innerHTML =
        `<button type="button" class="adv-preset-btn" data-preset="" ${lockedForRun ? 'disabled' : ''}>Clear all</button>` +
        PRESETS.map(
          (p) =>
            `<button type="button" class="adv-preset-btn" data-preset="${p.id}" title="${p.desc}" ${lockedForRun ? 'disabled' : ''}>${p.label}</button>`
        ).join('');
      presetEl.querySelectorAll('.adv-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (lockedForRun) return;
          if (!btn.dataset.preset) setActive([]);
          else if (!applyPreset(btn.dataset.preset)) return;
          rerender();
        });
      });
    }

    const scaleEl = document.getElementById('scaling-breakdown');
    if (scaleEl && typeof GameModes !== 'undefined') {
      GameModes.renderScalingPanel(baseId);
    }

    if (lockedForRun) {
      grid.innerHTML = `<p class="adv-locked-msg">Handicaps are set by this mode (Roguelike, Daily or Weekly) and cannot change.</p>
        ${[...active]
          .map((id) => {
            const m = MODIFIERS.find((x) => x.id === id);
            return m
              ? `<div class="adv-mod-row on locked"><span class="adv-mod-label">${m.label}</span><span class="adv-mod-pct">${fmtMult(m)}</span></div>`
              : '';
          })
          .join('')}`;
      return;
    }

    const pairs = getPairs();
    const paired = new Set(pairs.flat().map((m) => m.id));
    grid.innerHTML =
      `<div class="adv-section-head">Trade-offs: easier lowers the score, harder raises it</div>` +
      pairs.map(([e, h]) => pairRow(e, h)).join('') +
      `<div class="adv-section-head">Handicaps</div>` +
      MODIFIERS.filter((m) => !paired.has(m.id) && m.pct >= 0)
        .map(singleRow)
        .join('') +
      `<div class="adv-section-head">Aids</div>` +
      MODIFIERS.filter((m) => !paired.has(m.id) && m.pct < 0)
        .map(singleRow)
        .join('');
    grid.querySelectorAll('input[data-mod]').forEach((inp) => {
      inp.addEventListener('change', () => {
        toggle(inp.dataset.mod);
        rerender();
      });
    });
    grid.querySelectorAll('button[data-tri]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (lockedForRun) return;
        for (const id of btn.dataset.tri.split('|')) active.delete(id);
        if (btn.dataset.set) active.add(btn.dataset.set);
        rerender();
      });
    });
  }

  function togglePanel() {
    const panel = document.getElementById('advanced-diff-screen');
    if (!panel) return;
    const open = panel.classList.toggle('active');
    if (open) {
      renderPanel();
      if (typeof CrownLegacies !== 'undefined') {
        CrownLegacies.bindMuster?.();
        CrownLegacies.renderMuster?.();
      }
    }
  }

  function init() {
    for (const id of ['advanced-diff-btn', 'menu-muster-btn']) {
      document.getElementById(id)?.addEventListener('click', () => {
        AudioEngine?.SFX?.click?.();
        togglePanel();
      });
    }
    document.getElementById('advanced-diff-close')?.addEventListener('click', () => {
      document.getElementById('advanced-diff-screen')?.classList.remove('active');
    });
    document.getElementById('muster-start')?.addEventListener('click', () => {
      document.getElementById('advanced-diff-screen')?.classList.remove('active');
      document.getElementById('start-btn')?.click();
    });
    document.querySelectorAll('.diff-btn').forEach((btn) => {
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
    init,
    toggle,
    setActive,
    getActiveIds,
    getActiveModCount,
    getCombinedMods,
    isEnemyFogHidden,
    getDifficultyPercent,
    getModifiers,
    getConflictGroups,
    getPairs,
    getScoreMultiplier,
    applyPreset,
    lockForRun,
    unlockForRun,
    renderPanel,
    togglePanel,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.AdvancedDifficulty = AdvancedDifficulty;
