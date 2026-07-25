/**
 * Monster Boss Evolution — named warlords return stronger each cycle and bring a pack
 * of themed minions plus northern field structures.
 */
const MonsterBosses = (() => {
  const EVOLUTION_TIERS = [
    {
      minAppearance: 1,
      label: '',
      short: 'Prime',
      scaleBonus: 0,
      minionBonus: 0,
      structureBonus: 0,
    },
    {
      minAppearance: 2,
      label: 'Returned',
      short: 'Returned',
      scaleBonus: 0.18,
      minionBonus: 2,
      structureBonus: 1,
    },
    {
      minAppearance: 3,
      label: 'Ascendant',
      short: 'Ascendant',
      scaleBonus: 0.36,
      minionBonus: 4,
      structureBonus: 2,
    },
    {
      minAppearance: 4,
      label: 'Eternal',
      short: 'Eternal',
      scaleBonus: 0.55,
      minionBonus: 6,
      structureBonus: 3,
    },
  ];

  const BOSS_PACKS = {
    boss_gorath: {
      minions: ['berserker', 'orc', 'warg_rider', 'orc_archer'],
      eliteMinions: ['war_chief', 'troll', 'iron_colossus'],
      structures: ['enemy_trade_outpost', 'enemy_quarry'],
      spawnSide: 'north',
      packName: 'Ash March Warband',
    },
    boss_morwen: {
      minions: ['necromancer', 'bone_summoner', 'grim_revenant', 'shaman'],
      eliteMinions: ['dreadborn_champion', 'bone_summoner', 'grim_revenant'],
      structures: ['enemy_trade_outpost', 'enemy_shadow_academy'],
      spawnSide: 'north',
      packName: 'Bone Court',
    },
    boss_thokk: {
      minions: ['siege_tower', 'goblin_sapper', 'troll', 'berserker'],
      eliteMinions: ['iron_colossus', 'behemoth', 'siege_tower'],
      structures: ['enemy_quarry', 'enemy_trade_outpost'],
      spawnSide: 'north',
      packName: 'Gatebreakers',
    },
    boss_grimm: {
      minions: ['dark_knight', 'hellbound_legionnaire', 'berserker', 'dark_mage'],
      eliteMinions: ['cinderbound_juggernaut', 'dreadborn_champion'],
      structures: ['enemy_trade_outpost'],
      spawnSide: 'north',
      packName: 'Cinder Oath',
    },
    boss_vexis: {
      minions: ['void_stalker', 'umbral_stalker', 'assassin', 'nightmare_strider'],
      eliteMinions: ['void_stalker', 'abomination'],
      structures: ['enemy_quarry'],
      spawnSide: 'north',
      packName: 'Hollow Stalkers',
    },
    boss_karg: {
      minions: ['iron_colossus', 'siege_tower', 'goblin_engineer', 'war_chief'],
      eliteMinions: ['iron_colossus', 'elder_wyrm'],
      structures: ['enemy_hamlet', 'enemy_quarry'],
      spawnSide: 'north',
      packName: 'Iron Foundry',
    },
    boss_sylvara: {
      minions: ['sky_drake', 'harpy', 'elder_wyrm', 'bone_summoner'],
      eliteMinions: ['elder_wyrm', 'sky_drake'],
      structures: ['enemy_quarry', 'enemy_trade_outpost'],
      spawnSide: 'north',
      packName: 'Burning Sky Brood',
    },
    boss_rotfather: {
      minions: ['plague_rat', 'necromancer', 'grim_revenant', 'abomination'],
      eliteMinions: ['bone_summoner', 'abomination'],
      structures: ['enemy_trade_outpost', 'enemy_shadow_academy'],
      spawnSide: 'north',
      packName: 'Rot Host',
    },
    boss_volk: {
      minions: ['siege_tower', 'war_chief', 'hellmortar_pack', 'orc'],
      eliteMinions: ['iron_colossus', 'war_chief'],
      structures: ['enemy_hamlet', 'enemy_quarry'],
      spawnSide: 'north',
      packName: 'North Hammer',
    },
    boss_malachar: {
      minions: ['dreadborn_champion', 'grim_revenant', 'void_stalker', 'necromancer', 'elder_wyrm'],
      eliteMinions: ['elder_wyrm', 'cinderbound_juggernaut', 'iron_colossus'],
      structures: ['enemy_hamlet', 'enemy_war_academy', 'enemy_shadow_academy'],
      spawnSide: 'north',
      packName: 'Endless Siege Host',
    },
  };

  /** Roster order — wave 10, 20, … 100, then cycles every 100 waves. */
  const BOSS_ROSTER = [
    {
      type: 'boss_gorath',
      debutWave: 10,
      name: 'Gorath the Breaker',
      title: 'Warlord of the Ash March',
      tagline: 'His axe opens the way for a thousand boots.',
      faction: 'Orc Warbands',
      lore: 'The first named warlord most commanders learn to fear. Gorath led the Ash March through three fallen kingdoms before the Crown heard his name. He does not siege — he walks through gates others must batter for days.',
      mechanics:
        'Melee bruiser · enrages below ~50% HP (+45% damage, +20% while enrage timer active) · large sprite.',
      counter: 'All strikes, evolved ally burst, wall focus — kill before enrage stacks.',
      evolutionNote:
        'Returns with Ash March warbands (berserkers, orcs, warg riders). Eternal cycles may field war chiefs and iron colossi in the pack.',
    },
    {
      type: 'boss_morwen',
      debutWave: 20,
      name: 'Morwen the Pale',
      title: 'Queen of the Bone Court',
      tagline: 'She counts your dead and bills you in ghouls.',
      faction: 'Dark Legions',
      lore: 'Pale queen of the Bone Court. Morwen turned defeat into recruitment long before necromancers were fashionable. Every corpse you leave is a line item on her ledger.',
      mechanics: 'Ranged summoner · periodically raises goblins (summon cooldown ~220 ticks).',
      counter: 'Priority kill, Solar Pulse bonus vs undead, fireball on summons.',
      evolutionNote:
        'Bone Court injects necromancers, bone summoners, and grim revenants. Ascendant+ may raise shadow academies in the north.',
    },
    {
      type: 'boss_thokk',
      debutWave: 30,
      name: 'Thokk the Mountain',
      title: 'Walker of Shattered Gates',
      tagline: 'Walls crumble when he exhales.',
      faction: 'Orc Warbands',
      lore: 'A walking landslide with opinions about your gates. Thokk does not climb walls — he becomes the breach. Sappers speak of him in whispers and refund requests.',
      mechanics:
        'Colossal melee · siegeMult ×3.5 vs structures · enrages below ~50% HP · very slow.',
      counter: 'Sappers, fortify zones, ballistas — do not let him reach hamlets.',
      evolutionNote:
        'Gatebreakers embed siege towers and sappers in the spawn queue from wave one.',
    },
    {
      type: 'boss_grimm',
      debutWave: 40,
      name: 'Grimm Ashborne',
      title: 'Knight of the Cinder Oath',
      tagline: 'Steel and flame — nothing else remains.',
      faction: 'Dark Legions',
      lore: 'Oath-bound knight wreathed in cinder. Grimm burned his own standard to light the march south. He fights as if the battlefield owes him a debt.',
      mechanics: 'Melee duelist · fireAura damages nearby allies.',
      counter: 'Outposts, ranged focus, keep melee out of his aura radius.',
      evolutionNote:
        'Cinder Oath brings hellbound legionnaires and dark knights; Eternal cycles add cinderbound juggernauts.',
    },
    {
      type: 'boss_vexis',
      debutWave: 50,
      name: 'Vexis the Hollow',
      title: 'Shadow That Hungers',
      tagline: "Your General's heartbeat is his compass.",
      faction: 'Void / Abyssal',
      lore: "Hollow shadow that smells your General's fear. Vexis was a court assassin before the host made him a warlord. He does not want your walls — he wants your banner.",
      mechanics: 'Fast melee assassin · huntsGeneral — paths toward your General.',
      counter: 'Keep garrison on the Keep; knights screen the General.',
      evolutionNote:
        'Hollow Stalkers field void stalkers, umbral stalkers, and assassins alongside the boss.',
    },
    {
      type: 'boss_karg',
      debutWave: 60,
      name: 'Iron Lord Karg',
      title: 'Forge-Walker',
      tagline: 'A walking foundry that wants your hamlets.',
      faction: 'Orc Warbands',
      lore: 'Foundry on legs. Karg ate three hamlets in the Border Wars and wore the rivets as trophies. RTS-era commanders learn his footsteps mean economy damage, not duel damage.',
      mechanics: 'Siege colossus · siegeMult ×4.5 · 540 base HP · extremely slow.',
      counter: 'Sappers, sabotage spy, meteor — hunt before he reaches settlements.',
      evolutionNote:
        'Iron Foundry may raise enemy hamlets on debut — economy threat from wave 60 boss waves onward.',
    },
    {
      type: 'boss_sylvara',
      debutWave: 70,
      name: 'Sylvara Wyrm-Mother',
      title: 'Matriarch of the Burning Sky',
      tagline: 'The horizon is her throat.',
      faction: 'Void / Abyssal',
      lore: 'Mother of drakes; the sky is her nursery. Sylvara darkens the horizon before her brood arrives. Anti-air becomes mandatory, not optional.',
      mechanics: 'Flying ranged dragon · extreme range (180) · high damage.',
      counter: 'Ballistas, pikemen, anti-air evolved allies, frost nova.',
      evolutionNote:
        'Burning Sky Brood stacks harpies, sky drakes, and elder wyrms in the assault wave.',
    },
    {
      type: 'boss_rotfather',
      debutWave: 80,
      name: 'The Rotfather',
      title: 'Pustulent Patriarch',
      tagline: 'Flesh obeys him, even its own.',
      faction: 'Dark Legions',
      lore: 'Patriarch of pus — wounds fester in his presence. The Rotfather regenerates while you hesitate. Scribes recommend fire and urgency in equal measure.',
      mechanics: 'Regenerating horror · heals ~1.2% max HP every 50 ticks while wounded.',
      counter: 'Burst damage — fireball, meteor, focus fire; do not chip slowly.',
      evolutionNote:
        'Rot Host floods plague rats and abominations; may seed shadow academies on return visits.',
    },
    {
      type: 'boss_volk',
      debutWave: 90,
      name: 'Dread Marshal Volk',
      title: 'Hammer of the North Host',
      tagline: 'Siege engines kneel when he passes.',
      faction: 'Mirror Empires (late)',
      lore: 'Marshal who makes siege towers look quaint. Volk coordinated the North Host through four named campaigns. He arrives when your walls are proudest.',
      mechanics: 'Siege lord · siegeMult ×3.8 · enrages below ~50% HP.',
      counter: 'Wall repair builders, sappers, all strikes, sustained DPS.',
      evolutionNote:
        'North Hammer leads with siege towers and hellmortar packs; may raise hamlets in the north.',
    },
    {
      type: 'boss_malachar',
      debutWave: 100,
      name: 'Malachar the Eternal',
      title: 'Voice of the Endless Siege',
      tagline: 'Wave one hundred was only his rehearsal.',
      faction: 'Void / Abyssal',
      lore: 'Wave one hundred wears his name like a verdict. Malachar has fallen before — the host insists he is eternal. He hunts generals, regenerates, and sieges in the same breath. Empire Ascendant truly begins when he does.',
      mechanics: 'Ultimate boss · regen · huntsGeneral · siegeMult ×2.5 · enrage · 520 base HP.',
      counter: 'Full army, all strikes, evolved ally burst — spend saved TP before wave 100.',
      evolutionNote:
        'Endless Siege Host is the heaviest pack — dreadborn champions, elder wyrms, hamlets, war academies, and shadow academies. Worldheart Tyrant at wave 500+ scales from Malachar.',
    },
  ];

  const ROSTER_BY_TYPE = Object.fromEntries(BOSS_ROSTER.map((b) => [b.type, b]));

  let appearances = {};
  let kills = {};
  let currentWavePack = null;

  function resetRun() {
    appearances = {};
    kills = {};
    currentWavePack = null;
  }

  function unitExists(type) {
    return typeof EnemyDefs === 'undefined' || !!EnemyDefs[type];
  }

  function filterExisting(types) {
    return (types || []).filter(unitExists);
  }

  function getEvolutionTier(appearanceCount) {
    let tier = EVOLUTION_TIERS[0];
    for (const t of EVOLUTION_TIERS) {
      if (appearanceCount >= t.minAppearance) tier = t;
    }
    return { ...tier, appearance: appearanceCount };
  }

  function getAppearanceCount(bossType) {
    return appearances[bossType] || 0;
  }

  function getKillCount(bossType) {
    return kills[bossType] || 0;
  }

  function getPackDef(bossType) {
    return BOSS_PACKS[bossType] || null;
  }

  function buildMinionList(bossType, evolution) {
    const pack = getPackDef(bossType);
    if (!pack) return [];
    const base = filterExisting(pack.minions);
    const elite = filterExisting(pack.eliteMinions);
    const pool = evolution.appearance >= 3 && elite.length ? [...base, ...elite] : base;
    if (!pool.length) return [];
    const count = Math.min(12, base.length + (evolution.minionBonus || 0));
    const out = [];
    for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
    return out;
  }

  function computeTotalScale(bossType, baseScale = 1) {
    const evo = getEvolutionTier(getAppearanceCount(bossType) + 1);
    return baseScale * (1 + (evo.scaleBonus || 0));
  }

  function formatPackSummary(bossType, evolution) {
    const pack = getPackDef(bossType);
    if (!pack) return '';
    const minions = buildMinionList(bossType, evolution).length;
    const structs = Math.min(pack.structures?.length || 0, 1 + (evolution.structureBonus || 0));
    const evoNote = evolution.label ? `${evolution.label} ` : '';
    return `${evoNote}${pack.packName} — ${minions} pack, ${structs} hold${structs > 1 ? 's' : ''}`;
  }

  function prepareBossWave(bossType, wave, baseScale = 1) {
    const w = wave | 0;
    // Wave restart re-calls prepareBossWave for the same boss+wave — do not farm evolutions.
    let nextAppearance = getAppearanceCount(bossType);
    if (!(currentWavePack?.bossType === bossType && currentWavePack?.wave === w)) {
      nextAppearance = getAppearanceCount(bossType) + 1;
      appearances[bossType] = nextAppearance;
    }
    const evolution = getEvolutionTier(nextAppearance);
    const minions = buildMinionList(bossType, evolution);
    const totalScale = baseScale * (1 + (evolution.scaleBonus || 0));
    const packSummary = formatPackSummary(bossType, evolution);
    currentWavePack = { bossType, wave: w, evolution, minions, totalScale, packSummary };
    return {
      bossType,
      wave: w,
      evolution,
      totalScale,
      minions,
      packSummary,
      displayName: evolution.label || 'Prime',
    };
  }

  function getCurrentWavePack() {
    return currentWavePack;
  }

  function isPackMinion(unitType) {
    return !!currentWavePack?.minions?.includes(unitType);
  }

  function injectPackIntoQueue(queue, bossType, packCtx) {
    const ctx = packCtx || currentWavePack;
    if (!ctx || ctx.bossType !== bossType || !ctx.minions?.length) return queue;
    const out = [...queue];
    const bossIdx = out.indexOf(bossType);
    if (bossIdx >= 0) {
      out.splice(bossIdx + 1, 0, ...ctx.minions);
    } else {
      out.unshift(bossType, ...ctx.minions);
    }
    return out;
  }

  function spawnPackStructures(bossType, wave, tryPlaceFn, packCtx, hooks = {}) {
    const ctx = packCtx || currentWavePack;
    const pack = getPackDef(bossType);
    if (!pack?.structures?.length || !tryPlaceFn || !ctx) return 0;
    const evolution = ctx.evolution || getEvolutionTier(getAppearanceCount(bossType));
    const cap = Math.min(pack.structures.length, 1 + (evolution.structureBonus || 0));
    const northX = hooks.worldW ? Math.floor(hooks.worldW * 0.68) : null;
    const northY = hooks.worldH ? Math.floor(hooks.worldH * 0.18) : null;
    let placed = 0;
    for (let i = 0; i < cap; i++) {
      const type = pack.structures[i % pack.structures.length];
      const factionId =
        typeof EnemyFactions !== 'undefined' ? EnemyFactions.getBuildingFaction(type) : null;
      if (tryPlaceFn(type, northX, northY, factionId)) placed++;
    }
    if (placed > 0 && hooks.showMessage) {
      const name = pack.packName || 'Warlord pack';
      hooks.showMessage(
        `${name} raises ${placed} northern hold${placed > 1 ? 's' : ''} with the boss!`,
        300
      );
    }
    return placed;
  }

  function announceEvolution(packCtx, bossEntry, hooks = {}) {
    const ctx = packCtx || currentWavePack;
    if (!ctx?.evolution?.label || !bossEntry) return null;
    const { showMessage, floatingText, addHighlight, worldW } = hooks;
    addHighlight?.('boss', `${bossEntry.name} — ${ctx.evolution.label}`);
    showMessage?.(
      `${bossEntry.name} returns (${ctx.evolution.label} cycle)! ${ctx.packSummary}.`,
      420
    );
    floatingText?.(
      worldW / 2,
      100,
      `${ctx.evolution.label.toUpperCase()} ${bossEntry.name.split(' ')[0]}`,
      '#ff5050'
    );
    return ctx.evolution;
  }

  function onBossSlain(bossType, wave) {
    kills[bossType] = (kills[bossType] || 0) + 1;
    if (currentWavePack?.bossType === bossType) currentWavePack = null;
    return {
      bossType,
      kills: kills[bossType],
      appearances: getAppearanceCount(bossType),
      nextEvolution: getEvolutionTier(getAppearanceCount(bossType) + 1),
    };
  }

  function applyPackTags(unit, bossType) {
    if (!unit) return unit;
    if (unit.type === bossType || unit.isNamedBoss) {
      unit.bossPackLeader = true;
      unit.monsterEvolution = currentWavePack?.evolution?.label || '';
      return unit;
    }
    if (isPackMinion(unit.type) && currentWavePack?.bossType === bossType) {
      unit.bossPackMember = bossType;
      unit.bossPackMinion = true;
    }
    return unit;
  }

  function formatUnitList(types) {
    return (
      filterExisting(types || [])
        .map((t) => EnemyDefs?.[t]?.name || t)
        .join(', ') || '—'
    );
  }

  function formatStructureList(types) {
    return (
      (types || [])
        .map((t) => BuildDefs?.[t]?.name || t.replace(/^enemy_/, '').replace(/_/g, ' '))
        .join(', ') || '—'
    );
  }

  function formatEvolutionTable() {
    return EVOLUTION_TIERS.map((t) => {
      const label = t.label || 'Prime (1st visit)';
      return `${label}: +${Math.round(t.scaleBonus * 100)}% boss stats · +${t.minionBonus} pack minions · +${t.structureBonus} northern hold${t.structureBonus === 1 ? '' : 's'}`;
    }).join('\n');
  }

  function getBossDebutWave(bossType) {
    return (
      ROSTER_BY_TYPE[bossType]?.debutWave ||
      (BOSS_ROSTER.findIndex((b) => b.type === bossType) + 1) * 10
    );
  }

  function getEncyclopediaEntries() {
    const entries = [
      {
        cat: 'bosses',
        name: 'Boss Wave Cadence',
        body: 'Every 10th wave (10, 20, 30…) is a named boss wave instead of a horde. The roster cycles Gorath → Morwen → … → Malachar, then repeats at wave 110 with +20% base scale per full loop (stacks with Academy/RTS curves). Boss warn audio, floating titles, and MONSTER HUD announce the warlord. Kill the named boss before mop-up — spawn pressure and morale pivot on their fall. First boss kill earns a chronicle entry.',
      },
      {
        cat: 'bosses',
        name: 'Monster Evolution System',
        body:
          'Each warlord tracks how many times they have led a wave this run. Evolution tiers stack on top of roster cycle scaling:\n\n' +
          formatEvolutionTable() +
          '\n\nOn return visits the game announces the evolution label (RETURNED, ASCENDANT, ETERNAL) and injects the themed minion pack into the spawn queue. Northern holds (trade posts, quarries, hamlets, academies) may appear with the boss — hunt them during night prep.',
      },
      {
        cat: 'bosses',
        name: 'Roster Cycle & Scaling',
        body: 'Debut waves: Gorath W10, Morwen W20, Thokk W30, Grimm W40, Vexis W50, Karg W60, Sylvara W70, Rotfather W80, Volk W90, Malachar W100. After Malachar the roster restarts at W110 with +20% HP/damage per cycle. Post–wave-100 waves add +0.4% scale per wave. Total boss scale = roster cycle × evolution tier bonus × wave pressure. Spy assassinate removes elites from the wave but never the warlord.',
      },
      {
        cat: 'bosses',
        name: 'Boss Packs & Northern Holds',
        body: 'Each warlord brings a named pack injected after the boss in the spawn queue. Minion count = base pack size + evolution minion bonus (up to 12). From Ascendant (3rd visit) onward, elite minions join the rotation. Structures placed in the north scale with evolution — Returned +1, Ascendant +2, Eternal +3 holds. Pack names: Ash March, Bone Court, Gatebreakers, Cinder Oath, Hollow Stalkers, Iron Foundry, Burning Sky Brood, Rot Host, North Hammer, Endless Siege Host.',
      },
    ];

    for (const boss of BOSS_ROSTER) {
      const pack = getPackDef(boss.type);
      const def = typeof EnemyDefs !== 'undefined' ? EnemyDefs[boss.type] : null;
      const stats = def
        ? `Base stats (Prime): HP ${def.hp} · DMG ${def.damage} · ${def.type}${def.siegeMult ? ` · siegeMult ×${def.siegeMult}` : ''}${def.flying ? ' · flying' : ''}.`
        : '';
      const repeatWaves = [];
      for (let w = boss.debutWave; w <= 200; w += 100) repeatWaves.push(`W${w}`);
      const evoLines = EVOLUTION_TIERS.slice(1)
        .map(
          (t) =>
            `${t.label} (${t.minAppearance}${t.minAppearance === 2 ? 'nd' : t.minAppearance === 3 ? 'rd' : 'th+'} visit): +${Math.round(t.scaleBonus * 100)}% stats, +${t.minionBonus} minions, +${t.structureBonus} holds`
        )
        .join(' · ');

      entries.push({
        cat: 'bosses',
        name: `${boss.name} (Wave ${boss.debutWave}+)`,
        body: [
          `${boss.title} — "${boss.tagline}"`,
          `Faction: ${boss.faction}. Debut ${boss.debutWave}; repeats ${repeatWaves.join(', ')} and every +100 thereafter.`,
          '',
          boss.lore,
          '',
          `Mechanics: ${boss.mechanics}`,
          stats,
          '',
          pack
            ? `Pack: ${pack.packName}. Minions: ${formatUnitList(pack.minions)}. Elite pool (Ascendant+): ${formatUnitList(pack.eliteMinions)}. Northern holds: ${formatStructureList(pack.structures)}.`
            : '',
          `Evolution: ${evoLines}.`,
          boss.evolutionNote ? `Note: ${boss.evolutionNote}` : '',
          '',
          `Counter: ${boss.counter}`,
        ]
          .filter(Boolean)
          .join('\n'),
        campaignWave: boss.debutWave,
      });
    }
    return entries;
  }

  function getStateSnapshot(bossType, wave) {
    const pack = bossType ? getPackDef(bossType) : null;
    const appearance = bossType ? getAppearanceCount(bossType) : 0;
    const evolution = bossType ? getEvolutionTier(appearance) : null;
    return {
      currentPack: currentWavePack
        ? {
            bossType: currentWavePack.bossType,
            evolution: currentWavePack.evolution?.label || 'Prime',
            packSummary: currentWavePack.packSummary,
            minionCount: currentWavePack.minions?.length || 0,
          }
        : null,
      bossType,
      appearances: { ...appearances },
      kills: { ...kills },
      evolution: evolution?.label || null,
      packName: pack?.packName || null,
      wave,
    };
  }

  return {
    EVOLUTION_TIERS,
    BOSS_PACKS,
    resetRun,
    getPackDef,
    getAppearanceCount,
    getKillCount,
    getEvolutionTier,
    computeTotalScale,
    prepareBossWave,
    getCurrentWavePack,
    isPackMinion,
    injectPackIntoQueue,
    spawnPackStructures,
    announceEvolution,
    onBossSlain,
    applyPackTags,
    formatPackSummary,
    getStateSnapshot,
    getEncyclopediaEntries,
    BOSS_ROSTER,
    getBossDebutWave,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MonsterBosses = MonsterBosses;
