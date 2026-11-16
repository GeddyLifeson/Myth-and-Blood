/**
 * Named warlords: who leads each boss wave, the guard he brings, how he grows on each
 * return, and his signature moves (telegraphed, countered, and phased by health).
 * Moves run from Roster.update and Roster.drawOverlays; the boss bar from game-render.js.
 */
const MonsterBosses = (() => {
  // Each boss belongs to a faction (EnemyFactions.HOSTS[...].bosses): his wave is led by that
  // faction and plays its tactic, and his guard below is drawn from the same faction.
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
      minions: ['berserker', 'orc_shieldbearer', 'orc_archer', 'orc'],
      eliteMinions: ['war_chief', 'berserker'],
      structures: ['enemy_trade_outpost', 'enemy_quarry'],
      spawnSide: 'north',
      packName: 'Ash March Warband',
    },
    boss_morwen: {
      minions: ['necromancer', 'bone_summoner', 'dark_knight', 'necromancer'],
      eliteMinions: ['dreadborn_champion', 'abomination'],
      structures: ['enemy_trade_outpost', 'enemy_shadow_academy'],
      spawnSide: 'north',
      packName: 'Bone Court',
    },
    boss_thokk: {
      minions: ['troll', 'warg_rider', 'warg_rider', 'behemoth'],
      eliteMinions: ['behemoth', 'troll'],
      structures: ['enemy_quarry', 'enemy_trade_outpost'],
      spawnSide: 'north',
      packName: 'Gatebreakers',
    },
    boss_grimm: {
      minions: ['sky_drake', 'hellbound_legionnaire', 'harpy', 'wailing_wraith'],
      eliteMinions: ['cinderbound_juggernaut', 'elder_wyrm'],
      structures: ['enemy_trade_outpost'],
      spawnSide: 'north',
      packName: 'Cinder Oath',
    },
    boss_vexis: {
      minions: ['void_stalker', 'umbral_stalker', 'assassin', 'nightmare_strider'],
      eliteMinions: ['void_stalker', 'umbral_stalker'],
      structures: ['enemy_quarry'],
      spawnSide: 'north',
      packName: 'Hollow Stalkers',
    },
    boss_karg: {
      minions: ['iron_colossus', 'siege_tower', 'goblin_engineer', 'goblin_sapper'],
      eliteMinions: ['iron_colossus', 'siege_tower'],
      structures: ['enemy_hamlet', 'enemy_quarry'],
      spawnSide: 'north',
      packName: 'Iron Foundry',
    },
    boss_sylvara: {
      minions: ['sky_drake', 'harpy', 'elder_wyrm', 'wailing_wraith'],
      eliteMinions: ['elder_wyrm', 'sky_drake'],
      structures: ['enemy_quarry', 'enemy_trade_outpost'],
      spawnSide: 'north',
      packName: 'Burning Sky Brood',
    },
    boss_rotfather: {
      minions: ['abomination', 'necromancer', 'grim_revenant', 'bone_summoner'],
      eliteMinions: ['bone_summoner', 'abomination'],
      structures: ['enemy_trade_outpost', 'enemy_shadow_academy'],
      spawnSide: 'north',
      packName: 'Rot Host',
    },
    boss_volk: {
      minions: ['war_chief', 'orc_shieldbearer', 'berserker', 'orc_archer'],
      eliteMinions: ['war_chief', 'berserker'],
      structures: ['enemy_hamlet', 'enemy_quarry'],
      spawnSide: 'north',
      packName: 'North Hammer',
    },
    boss_malachar: {
      minions: ['dreadborn_champion', 'grim_revenant', 'dark_knight', 'necromancer', 'abomination'],
      eliteMinions: ['dreadborn_champion', 'abomination'],
      structures: ['enemy_hamlet', 'enemy_war_academy', 'enemy_shadow_academy'],
      spawnSide: 'north',
      packName: 'Endless Siege Host',
    },
  };

  /**
   * Roster order: wave 10, 20, ... 100, then the cycle repeats every 100 waves.
   * `moves` are the boss's signature attacks (MOVES below). `arrive`, `lastStand` and
   * `death` are what he says when he takes the field, drops under a fifth of his
   * health, and falls.
   */
  const BOSS_ROSTER = [
    {
      type: 'boss_gorath',
      debutWave: 10,
      name: 'Gorath the Breaker',
      title: 'Warlord of the Ash March',
      tagline: 'His axe opens the way for a thousand boots.',
      faction: 'Orc Warbands',
      lore: 'The first named warlord most commanders learn to fear. Gorath led the Ash March through three fallen kingdoms before the Crown heard his name. He does not besiege a gate. He walks through it.',
      moves: ['ash_charge'],
      mechanics:
        'War banner over his warband. Ash Charge: he marks a lane into your thickest ranks, then runs it, knocking down everyone in it. At half health he enrages and his warband charges with him.',
      counter:
        'Put pikemen or knights in the marked lane, or keep footmen shoulder to shoulder there: the charge breaks on them and he stands stunned and exposed.',
      arrive: 'Gorath: "Open the gate, or be the gate."',
      lastStand: 'Gorath: "Ash March! To me, to the end!"',
      death: 'Gorath falls, and the Ash March loses its voice.',
      evolutionNote:
        'Returns with a bigger Ash March warband; from his third visit war chiefs ride with him.',
    },
    {
      type: 'boss_morwen',
      debutWave: 20,
      name: 'Morwen the Pale',
      title: 'Queen of the Bone Court',
      tagline: 'She counts your dead and bills you in ghouls.',
      faction: 'Dark Legions',
      lore: 'Pale queen of the Bone Court. Morwen turned defeat into recruitment long before necromancers were fashionable. Every corpse you leave is a line on her ledger.',
      moves: ['grave_call'],
      mechanics:
        'Hexes from range and keeps her distance. Grave Call: she stops and chants inside a ring of bone, then raises revenants around her. At half health she raises a pack of plague rats.',
      counter:
        'Send cavalry, scouts or knights at her the moment the ring appears. Enough of their blows break the chant and leave her stunned and exposed.',
      arrive: 'Morwen: "Your dead are already mine. I have only come to collect."',
      lastStand: 'Morwen: "Rise. All of you. RISE."',
      death: 'Morwen crumbles, and her court of bone goes still.',
      evolutionNote:
        'Bone Court returns with more necromancers and bone summoners; each visit raises one more revenant.',
    },
    {
      type: 'boss_thokk',
      debutWave: 30,
      name: 'Thokk the Mountain',
      title: 'Walker of Shattered Gates',
      tagline: 'Walls crumble when he exhales.',
      faction: 'The Wild Hunt',
      lore: 'A walking landslide with opinions about your gates. Thokk does not climb walls. He becomes the breach.',
      moves: ['earthshatter'],
      mechanics:
        'Tramples everything beside his target and regrows his hide; pins do not hold him. Earthshatter: he raises both fists, a ring cracks open around him, and the ground breaks, stunning all inside. At half health his regrowth doubles.',
      counter:
        'Ballistae and crossbows: bolts that land while his fists are raised topple him. Without them, pull your melee out of the ring.',
      arrive: 'Thokk lowers his head. The ground already trembles.',
      lastStand: 'Thokk bellows, and the stones answer.',
      death: 'Thokk topples like a mountain, and the field shakes once.',
      evolutionNote:
        'Gatebreakers return with more trolls and warg riders; behemoths from his third visit.',
    },
    {
      type: 'boss_grimm',
      debutWave: 40,
      name: 'Grimm Ashborne',
      title: 'Knight of the Cinder Oath',
      tagline: 'Steel and flame. Nothing else remains.',
      faction: 'Cinder Flight',
      lore: 'Oath-bound knight wreathed in cinder. Grimm burned his own standard to light the march south. He fights as if the battlefield owes him a debt.',
      moves: ['cinder_brand'],
      mechanics:
        'Plate shrugs off arrows and his hide burns whoever strikes him; pins do not hold him. Cinder Brand: he brands a patch of ground under your ranks, and it erupts in fire. At half health he enrages.',
      counter:
        'Mages unmake the brand: their spells during the burn break it and leave him exposed. Otherwise step out of the marked ground.',
      arrive: 'Grimm: "I swore an oath to ash. You will help me keep it."',
      lastStand: 'Grimm: "The oath burns brightest at the end."',
      death: 'Grimm kneels in his own embers, and the oath goes out.',
      evolutionNote:
        'Cinder Oath returns with more legionnaires and drakes; juggernauts from his third visit.',
    },
    {
      type: 'boss_vexis',
      debutWave: 50,
      name: 'Vexis the Hollow',
      title: 'Shadow That Hungers',
      tagline: "Your General's heartbeat is his compass.",
      faction: 'The Void Court',
      lore: "Hollow shadow that smells your General's fear. Vexis was a court assassin before the host made him a warlord. He does not want your walls. He wants your banner.",
      moves: ['shadow_pounce'],
      mechanics:
        'Hunts archers, mages and healers and strikes hard from behind. Shadow Pounce: he marks one of your shooters or healers, then steps out of the dark beside them. At half health he strikes 40% harder.',
      counter:
        'Keep a footman, pikeman, knight or the General beside the marked soldier: the bodyguard turns the pounce and Vexis lands stunned and exposed.',
      arrive: 'Vexis: "Which of you is the heart? I can hear it."',
      lastStand: 'Vexis: "No more games."',
      death: 'Vexis unravels into smoke that does not settle.',
      evolutionNote: 'Hollow Stalkers return in greater numbers each visit.',
    },
    {
      type: 'boss_karg',
      debutWave: 60,
      name: 'Iron Lord Karg',
      title: 'Forge-Walker',
      tagline: 'A walking foundry that wants your hamlets.',
      faction: 'Goblin Hordes',
      lore: 'Foundry on legs. Karg ate three hamlets in the Border Wars and wore the rivets as trophies. His footsteps mean lost buildings, not lost duels.',
      moves: ['foundry_ram'],
      mechanics:
        'Iron shell against arrows, heads for your buildings, pins do not hold him. Foundry Ram: he marks a lane towards your nearest building and rams down it, smashing walls and soldiers alike. At half health he calls goblin sappers.',
      counter:
        'Sappers and ballistae: their hits while he builds up steam crack the ram and leave him exposed.',
      arrive: "Karg's furnace roars. Somewhere a bellows answers.",
      lastStand: 'Karg vents every furnace at once.',
      death: 'Karg grinds to a halt, and his fires go cold.',
      evolutionNote: 'Iron Foundry returns with more colossi and engineers each visit.',
    },
    {
      type: 'boss_sylvara',
      debutWave: 70,
      name: 'Sylvara Wyrm-Mother',
      title: 'Matriarch of the Burning Sky',
      tagline: 'The horizon is her throat.',
      faction: 'Cinder Flight',
      lore: 'Mother of drakes; the sky is her nursery. Sylvara darkens the horizon before her brood arrives.',
      moves: ['wyrmfire_rain'],
      mechanics:
        'Flies, keeps her distance, and every breath burns around the target. Wyrmfire Rain: three patches of ground glow under your ranks, then fire falls on them. At half health she calls a flight of harpies.',
      counter:
        'Ballistae and crossbows: their bolts during the dive drive her off. Spread your ranks so one patch takes one soldier.',
      arrive: 'A shadow crosses the sun, and it is still growing.',
      lastStand: 'Sylvara: "Burn with me, then."',
      death: 'Sylvara falls out of the sky, and her brood scatters.',
      evolutionNote:
        'Burning Sky Brood returns with more drakes; elder wyrms from her third visit.',
    },
    {
      type: 'boss_rotfather',
      debutWave: 80,
      name: 'The Rotfather',
      title: 'Pustulent Patriarch',
      tagline: 'Flesh obeys him, even its own.',
      faction: 'Dark Legions',
      lore: 'Patriarch of pus. Wounds fester in his presence and his own close while you hesitate.',
      moves: ['rupture'],
      mechanics:
        'Plague on every blow, regrows, and bursts when he dies. Rupture: he swells inside a sickly ring, then bursts, poisoning all inside and healing himself for each soldier caught. At half health rats pour out of him.',
      counter:
        'Mages and ballistae lance the swell before it bursts and leave him exposed. Keep your line out of the ring and kill him far from it.',
      arrive: 'The Rotfather: "Come closer, children. Let me hold you."',
      lastStand: 'The Rotfather swells until his skin creaks.',
      death: 'The Rotfather bursts one last time and lies still.',
      evolutionNote: 'Rot Host returns with more abominations each visit.',
    },
    {
      type: 'boss_volk',
      debutWave: 90,
      name: 'Dread Marshal Volk',
      title: 'Hammer of the North Host',
      tagline: 'Siege engines kneel when he passes.',
      faction: 'Orc Warbands',
      lore: 'Marshal who makes siege towers look quaint. Volk coordinated the North Host through four named campaigns. He arrives when your walls are proudest.',
      moves: ['hammerfall'],
      mechanics:
        'War banner and a hex on whoever he strikes; pins do not hold him. Hammerfall: he raises his signal and his batteries mark four of your shooters; the hammers fall a moment later. At half health he enrages.',
      counter:
        'Cavalry, knights and scouts on Volk silence the signal before the hammers fall, and leave him exposed. Move your shooters off the marks.',
      arrive: 'Volk: "Batteries, mark them."',
      lastStand: 'Volk: "Every gun, on me!"',
      death: 'Volk falls, and the batteries go quiet.',
      evolutionNote: 'North Hammer returns with more war chiefs each visit.',
    },
    {
      type: 'boss_malachar',
      debutWave: 100,
      name: 'Malachar the Eternal',
      title: 'Voice of the Endless Siege',
      tagline: 'Wave one hundred was only his rehearsal.',
      faction: 'Dark Legions',
      lore: 'Wave one hundred wears his name like a verdict. Malachar has fallen before; the host insists he is eternal. He hunts generals, regrows, and besieges in the same breath.',
      moves: ['ash_charge', 'cinder_brand', 'grave_call', 'earthshatter'],
      mechanics:
        'Hex, regrowth and a war banner; pins do not hold him. He uses the signature moves of four warlords in turn: Ash Charge, Cinder Brand, Grave Call and Earthshatter. At half health he enrages and calls dark knights.',
      counter:
        'Every counter you have: read which move he marks and answer it with pikes, mages, riders or bolts.',
      arrive: 'Malachar: "I have died here before. It did not take."',
      lastStand: 'Malachar: "Again, then. Always again."',
      death: 'Malachar falls. The host waits to see if he rises.',
      evolutionNote:
        'Endless Siege Host is the heaviest guard: dreadborn champions, revenants, dark knights and abominations.',
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
    const evoNote = evolution.label ? `${evolution.label} ` : '';
    return `${evoNote}${pack.packName}, a guard of ${minions}`;
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
      deathLine: deathLine(bossType),
    };
  }

  function formatUnitList(types) {
    return (
      filterExisting(types || [])
        .map((t) => EnemyDefs?.[t]?.name || t)
        .join(', ') || '—'
    );
  }

  // ------------------------------------------------------------ signature moves
  // Every move is marked on the ground for its whole wind-up, and each has one counter:
  //   block  a soldier of `types` (or a braced shield line) inside the marked area when it lands
  //   hit    damage from `types` during the wind-up worth `pct` of the boss's health
  //   guard  a soldier of `types` within `r` of the marked soldier when it lands
  // A countered move does nothing and leaves the boss stunned and exposed.
  const MOVES = {
    ash_charge: {
      name: 'Ash Charge',
      shape: 'lane',
      windup: 110,
      reach: 230,
      len: 190,
      width: 40,
      dmg: 1.5,
      stun: 50,
      counter: { kind: 'block', types: ['pikeman', 'knight'], braced: true },
      hint: 'Pikes, knights or a tight shield line in the lane stop it.',
    },
    grave_call: {
      name: 'Grave Call',
      shape: 'self',
      windup: 150,
      reach: 420,
      radius: 64,
      summon: ['grim_revenant', 3],
      counter: { kind: 'hit', types: ['cavalry', 'scout', 'knight'], pct: 0.05 },
      hint: 'Riders who reach her break the chant.',
    },
    earthshatter: {
      name: 'Earthshatter',
      shape: 'self',
      windup: 120,
      reach: 100,
      radius: 92,
      dmg: 1.3,
      stun: 90,
      counter: { kind: 'hit', types: ['ballista', 'crossbowman'], pct: 0.04 },
      hint: 'Bolts topple him; or pull out of the ring.',
    },
    cinder_brand: {
      name: 'Cinder Brand',
      shape: 'circle',
      windup: 100,
      reach: 260,
      radius: 62,
      dmg: 1.1,
      burn: 4,
      counter: { kind: 'hit', types: ['mage'], pct: 0.04 },
      hint: 'Mages unmake the brand; or step off the mark.',
    },
    shadow_pounce: {
      name: 'Shadow Pounce',
      shape: 'mark',
      windup: 100,
      reach: 360,
      radius: 22,
      dmg: 2.2,
      prey: 'support',
      counter: { kind: 'guard', types: ['footman', 'pikeman', 'knight', 'general'], r: 50 },
      hint: 'A bodyguard beside the marked soldier turns it.',
    },
    foundry_ram: {
      name: 'Foundry Ram',
      shape: 'lane',
      windup: 130,
      reach: 300,
      len: 210,
      width: 46,
      dmg: 1.2,
      stun: 40,
      siege: true,
      counter: { kind: 'hit', types: ['sapper', 'ballista'], pct: 0.04 },
      hint: 'Sappers and ballistae crack the ram.',
    },
    wyrmfire_rain: {
      name: 'Wyrmfire Rain',
      shape: 'circles',
      windup: 110,
      reach: 300,
      radius: 42,
      count: 3,
      dmg: 0.9,
      burn: 4,
      counter: { kind: 'hit', types: ['ballista', 'crossbowman'], pct: 0.05 },
      hint: 'Bolts drive her off; spread your ranks.',
    },
    rupture: {
      name: 'Rupture',
      shape: 'self',
      windup: 120,
      reach: 110,
      radius: 96,
      dmg: 0.9,
      plague: 5,
      healPer: 0.04,
      counter: { kind: 'hit', types: ['mage', 'ballista'], pct: 0.04 },
      hint: 'Mages and ballistae lance the swell.',
    },
    hammerfall: {
      name: 'Hammerfall',
      shape: 'circles',
      windup: 120,
      reach: 340,
      radius: 44,
      count: 4,
      dmg: 1.0,
      prey: 'ranged',
      counter: { kind: 'hit', types: ['cavalry', 'knight', 'scout'], pct: 0.04 },
      hint: 'Riders on Volk silence the signal.',
    },
  };

  /** Ticks between moves, then the share of that in phase II (half health) and III. */
  const MOVE_COOLDOWN = 540;
  const FIRST_MOVE_DELAY = 240;
  const PHASE_COOLDOWN = [1, 0.65, 0.5];
  const LAST_STAND = 0.2;
  const STAGGER_TICKS = 150;
  const EXPOSE_PCT = 0.35;
  const SUPPORT = { archer: 1, crossbowman: 1, mage: 1, healer: 1, bard: 1, ballista: 1 };

  function movesFor(type) {
    return ROSTER_BY_TYPE[type]?.moves || [];
  }

  function currentMove(unit) {
    const bm = unit.bossMove;
    return bm && bm.id ? MOVES[bm.id] : null;
  }

  /** The move the boss will use next, for the boss bar. */
  function nextMove(unit) {
    const list = movesFor(unit.type);
    if (!list.length) return null;
    const idx = unit.bossMove ? unit.bossMove.idx || 0 : 0;
    return MOVES[list[idx % list.length]] || null;
  }

  function phaseOf(unit) {
    const f = unit.hp / Math.max(1, unit.maxHp);
    return f <= LAST_STAND ? 3 : f <= 0.5 ? 2 : 1;
  }

  function foes(ctx) {
    const out = [];
    for (const u of ctx.units) if (u.team === 'player' && u.hp > 0) out.push(u);
    return out;
  }

  function dist2(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  /** The player soldier within `reach` with the most comrades within `r` of him. */
  function densest(boss, list, reach, r) {
    const reach2 = reach * reach;
    const r2 = r * r;
    let best = null;
    let bestN = -1;
    for (const u of list) {
      if (dist2(u, boss) > reach2) continue;
      let n = 0;
      for (const o of list) if (dist2(o, u) <= r2) n++;
      if (n > bestN) {
        best = u;
        bestN = n;
      }
    }
    return best;
  }

  function nearestBuilding(boss, ctx, reach) {
    let best = null;
    let bestD = reach * reach;
    for (const b of ctx.walls || []) {
      if (b.owner !== 'player' || !(b.hp > 0)) continue;
      const d = dist2(b, boss);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  /** Where the move lands, or null when nothing is in reach (the boss tries again shortly). */
  function aim(boss, m, ctx) {
    const list = foes(ctx);
    if (!list.length) return null;
    const reach2 = m.reach * m.reach;
    if (m.shape === 'self') {
      const inside = m.summon ? reach2 : (m.radius + 10) * (m.radius + 10);
      return list.some((u) => dist2(u, boss) <= inside) ? { x: boss.x, y: boss.y } : null;
    }
    if (m.shape === 'mark') {
      const prey =
        list.filter((u) => SUPPORT[u.type] && dist2(u, boss) <= reach2)[0] ||
        list.filter((u) => dist2(u, boss) <= reach2)[0];
      return prey ? { x: prey.x, y: prey.y, targetId: prey.id } : null;
    }
    if (m.shape === 'circles') {
      const near = list.filter((u) => dist2(u, boss) <= reach2);
      const shooters = near.filter((u) => (u.range || 0) > 60);
      const pool = m.prey === 'ranged' && shooters.length ? shooters : near;
      if (!pool.length) return null;
      pool.sort((a, b) => dist2(a, boss) - dist2(b, boss));
      const spots = [];
      for (const u of pool) {
        if (spots.some((s) => dist2(s, u) < (m.radius * 1.4) ** 2)) continue;
        spots.push({ x: u.x, y: u.y });
        if (spots.length >= m.count) break;
      }
      return { x: spots[0].x, y: spots[0].y, spots };
    }
    const building = m.siege ? nearestBuilding(boss, ctx, m.reach) : null;
    const t = building || densest(boss, list, m.reach, 50);
    if (!t) return null;
    if (m.shape === 'circle') return { x: t.x, y: t.y };
    // A lane runs from the boss through the target, `len` long.
    const dx = t.x - boss.x;
    const dy = t.y - boss.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: t.x, y: t.y, ex: boss.x + (dx / d) * m.len, ey: boss.y + (dy / d) * m.len };
  }

  /** Where a point lies along the lane (0 at the boss, 1 at the end) and how far off it. */
  function laneHit(bm, p, width) {
    const lx = bm.ex - bm.sx;
    const ly = bm.ey - bm.sy;
    const l2 = lx * lx + ly * ly || 1;
    const t = ((p.x - bm.sx) * lx + (p.y - bm.sy) * ly) / l2;
    if (t < 0 || t > 1) return -1;
    const off = Math.hypot(bm.sx + lx * t - p.x, bm.sy + ly * t - p.y);
    return off <= width / 2 ? t : -1;
  }

  function insideMove(bm, m, u, boss) {
    if (m.shape === 'lane') return laneHit(bm, u, m.width) >= 0;
    if (m.shape === 'circles') return bm.spots.some((s) => dist2(s, u) <= m.radius * m.radius);
    if (m.shape === 'mark') return u.id === bm.targetId;
    return dist2(m.shape === 'self' ? boss : bm, u) <= m.radius * m.radius;
  }

  function bossLabel(unit) {
    return ROSTER_BY_TYPE[unit.type]?.name || unit.bossName || 'The warlord';
  }

  /** Stun a soldier caught by a move. */
  function stun(unit, ticks) {
    unit.pinned = true;
    unit.pinTimer = Math.max(unit.pinTimer || 0, ticks);
  }

  // A boss winding up or staggered stands still and holds his blows. This is not a pin:
  // players cannot pin a named boss, and the rules that say so stay true.
  function hold(unit, until) {
    const bm = unit.bossMove;
    if (!(bm.holdUntil > until)) bm.holdUntil = until;
    bm.hx = unit.x;
    bm.hy = unit.y;
  }

  function keepHeld(unit, tick) {
    const bm = unit.bossMove;
    if (!(bm.holdUntil > tick)) return;
    unit.x = bm.hx;
    unit.y = bm.hy;
    unit.path = [];
    unit.actionTimer = Math.max(unit.actionTimer || 0, 2);
  }

  function startMove(unit, ctx, rushed) {
    const bm = unit.bossMove;
    const list = movesFor(unit.type);
    const id = list[(bm.idx || 0) % list.length];
    const m = MOVES[id];
    const at = m && aim(unit, m, ctx);
    if (!at) {
      bm.cd = 30;
      return false;
    }
    const windup = Math.round(m.windup * (rushed ? 0.7 : 1));
    Object.assign(bm, {
      id,
      t: windup,
      total: windup,
      broke: 0,
      sx: unit.x,
      sy: unit.y,
      x: at.x,
      y: at.y,
      ex: at.ex ?? at.x,
      ey: at.ey ?? at.y,
      spots: at.spots || null,
      targetId: at.targetId ?? null,
    });
    hold(unit, ctx.tick + windup + 1);
    ctx.float(unit.x, unit.y - 40, m.name.toUpperCase(), '#ff5040');
    ctx.playSfx('bossWarn');
    return true;
  }

  function endMove(unit) {
    const bm = unit.bossMove;
    bm.id = null;
    bm.idx = (bm.idx || 0) + 1;
    bm.cd = Math.round(MOVE_COOLDOWN * PHASE_COOLDOWN[phaseOf(unit) - 1]);
    bm.holdUntil = 0;
  }

  function stagger(unit, ctx, why) {
    const m = currentMove(unit);
    endMove(unit);
    unit.bossMove.staggered = (unit.bossMove.staggered || 0) + 1;
    unit.bossMove.stunUntil = ctx.tick + STAGGER_TICKS;
    hold(unit, ctx.tick + STAGGER_TICKS);
    unit.exposeUntil = ctx.tick + STAGGER_TICKS + 30;
    unit.exposePct = Math.max(unit.exposePct || 0, EXPOSE_PCT);
    ctx.float(unit.x, unit.y - 40, 'STAGGERED', '#ffd040');
    ctx.shake(4);
    ctx.playSfx('shieldBlock');
    ctx.showMessage(
      `${why || `${m ? m.name : 'The move'} is broken`}! ${bossLabel(unit)} is stunned and exposed: strike now.`,
      220
    );
  }

  function hurtFoe(boss, u, m, ctx) {
    ctx.hurt(u, boss.damage * m.dmg, boss);
    if (m.stun && u.hp > 0) stun(u, m.stun);
    if ((m.burn || m.plague) && u.hp > 0) {
      u.poisonUntil = ctx.tick + 240;
      u.poisonDps = m.burn || m.plague;
      if (m.burn) u.burnUntil = u.poisonUntil;
    }
  }

  function land(unit, ctx) {
    const bm = unit.bossMove;
    const m = currentMove(unit);
    if (!m) return;
    const list = foes(ctx);
    if (m.counter.kind === 'block') {
      let block = null;
      let blockT = 2;
      for (const u of list) {
        const t = laneHit(bm, u, m.width);
        if (t < 0) continue;
        const stops =
          m.counter.types.includes(u.type) || (m.counter.braced && (u.braceN || 0) >= 2);
        if (stops && t < blockT) {
          block = u;
          blockT = t;
        }
      }
      if (block) {
        unit.x = bm.sx + (bm.ex - bm.sx) * Math.max(0, blockT - 0.08);
        unit.y = bm.sy + (bm.ey - bm.sy) * Math.max(0, blockT - 0.08);
        ctx.burst('critBurst', block.x, block.y);
        stagger(unit, ctx, `The charge breaks on ${ctx.unitName(block)}`);
        return;
      }
    }
    if (m.counter.kind === 'guard') {
      const prey = list.find((u) => u.id === bm.targetId);
      if (!prey) return endMove(unit);
      bm.x = prey.x;
      bm.y = prey.y;
      const r2 = m.counter.r * m.counter.r;
      const guard = list.find(
        (u) =>
          u !== prey &&
          (m.counter.types.includes(u.type) ||
            (u.isGeneral && m.counter.types.includes('general'))) &&
          dist2(u, prey) <= r2
      );
      moveTo(unit, prey.x, prey.y - 20, ctx);
      if (guard) {
        stagger(unit, ctx, `${ctx.unitName(guard)} turns the pounce`);
        return;
      }
    }
    if (m.shape === 'lane') moveTo(unit, bm.ex, bm.ey, ctx);
    if (m.summon) {
      const appearance = getAppearanceCount(unit.type) || 1;
      const [type, base] = m.summon;
      const n = base + appearance - 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.spawnEnemy(type, unit.x + Math.cos(a) * 40, unit.y + Math.sin(a) * 40);
      }
    }
    let caught = 0;
    if (m.dmg) {
      for (const u of list) {
        if (!insideMove(bm, m, u, unit)) continue;
        hurtFoe(unit, u, m, ctx);
        caught++;
      }
    }
    if (m.siege && ctx.hurtBuilding) {
      for (const b of ctx.walls || []) {
        if (b.owner === 'player' && b.hp > 0 && laneHit(bm, b, m.width + 30) >= 0) {
          ctx.hurtBuilding(b, unit.damage * m.dmg * (unit.siegeMult || 1), unit);
        }
      }
    }
    if (m.healPer && caught) {
      unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * m.healPer * Math.min(5, caught));
    }
    ctx.shake(m.shape === 'self' || m.shape === 'lane' ? 7 : 4);
    ctx.playSfx('gateHit');
    for (const s of bm.spots || [m.shape === 'self' ? unit : bm]) ctx.burst('critBurst', s.x, s.y);
    endMove(unit);
  }

  function moveTo(unit, x, y, ctx) {
    const nx = Math.max(10, Math.min((ctx.worldW || 9999) - 10, x));
    const ny = Math.max(10, Math.min((ctx.worldH || 9999) - 10, y));
    if (ctx.blocked && ctx.blocked(nx, ny, unit)) return;
    unit.x = nx;
    unit.y = ny;
    unit.path = [];
    unit.pathIndex = 0;
  }

  /** Called every tick from Roster.update. */
  function update(ctx) {
    for (const u of ctx.units) {
      if (!u.isNamedBoss || u.team !== 'enemy' || u.hp <= 0) continue;
      const entry = ROSTER_BY_TYPE[u.type];
      if (!entry) continue;
      if (!u.bossMove) u.bossMove = { idx: 0, cd: FIRST_MOVE_DELAY, id: null };
      const bm = u.bossMove;
      if (!bm.saidArrive) {
        bm.saidArrive = true;
        ctx.showMessage(entry.arrive, 320);
        const m = nextMove(u);
        if (m) ctx.showMessage(`Watch for ${m.name}. ${entry.counter}`, 420);
      }
      if (!bm.saidLast && phaseOf(u) === 3) {
        bm.saidLast = true;
        ctx.showMessage(entry.lastStand, 320);
        ctx.float(u.x, u.y - 52, 'LAST STAND', '#ff3030');
        if (!bm.id && !((bm.stunUntil || 0) > ctx.tick)) {
          bm.cd = 0;
          bm.rushNext = true;
        }
      }
      keepHeld(u, ctx.tick);
      if (bm.id) {
        if (--bm.t <= 0) land(u, ctx);
        continue;
      }
      if ((bm.stunUntil || 0) > ctx.tick) continue;
      if (--bm.cd <= 0) {
        if (startMove(u, ctx, bm.rushNext || phaseOf(u) === 3)) bm.rushNext = false;
      }
    }
  }

  /** Called from Roster.modifyDamageTaken for every blow a named boss takes. */
  function onHit(unit, amount, attacker, ctx) {
    const bm = unit.bossMove;
    const m = bm && bm.id ? MOVES[bm.id] : null;
    if (!m || m.counter.kind !== 'hit' || !attacker || attacker.team !== 'player') return;
    if (!m.counter.types.includes(attacker.type)) return;
    bm.broke = (bm.broke || 0) + amount;
    if (bm.broke >= unit.maxHp * m.counter.pct) stagger(unit, ctx);
  }

  // ------------------------------------------------------------------- drawing
  const INK = '#07050a';
  const BONE = '#e4dcc4';

  function strokeShape(c, bm, m, boss, r) {
    c.beginPath();
    if (m.shape === 'lane') {
      const ang = Math.atan2(bm.ey - bm.sy, bm.ex - bm.sx);
      const len = Math.hypot(bm.ex - bm.sx, bm.ey - bm.sy) * r;
      c.save();
      c.translate(bm.sx, bm.sy);
      c.rotate(ang);
      c.rect(0, -m.width / 2, len, m.width);
      c.restore();
    } else if (m.shape === 'circles') {
      for (const s of bm.spots) {
        c.moveTo(s.x + m.radius * r, s.y);
        c.arc(s.x, s.y, m.radius * r, 0, Math.PI * 2);
      }
    } else {
      const at = m.shape === 'self' ? boss : bm;
      c.arc(at.x, at.y, m.radius * r, 0, Math.PI * 2);
    }
  }

  /** The marked ground under every wind-up, filling as the strike draws near. */
  function drawOver(c, units, tick) {
    if (!c || !units) return;
    for (const u of units) {
      if (!u.isNamedBoss || u.hp <= 0 || !u.bossMove || !u.bossMove.id) continue;
      const bm = u.bossMove;
      const m = MOVES[bm.id];
      if (!m) continue;
      if (m.shape === 'mark') {
        const prey = units.find((o) => o.id === bm.targetId && o.hp > 0);
        if (prey) {
          bm.x = prey.x;
          bm.y = prey.y;
        }
      }
      const p = 1 - bm.t / Math.max(1, bm.total);
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.3);
      c.save();
      c.fillStyle = `rgba(192,32,42,${0.1 + 0.12 * pulse})`;
      c.strokeStyle = 'rgba(192,32,42,0.95)';
      c.lineWidth = 2;
      c.setLineDash([6, 4]);
      strokeShape(c, bm, m, u, 1);
      c.fill();
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = `rgba(240,60,40,${0.25 + 0.2 * p})`;
      strokeShape(c, bm, m, u, m.shape === 'lane' ? p : Math.max(0.05, p));
      c.fill();
      if (m.shape === 'mark' || m.shape === 'circle' || m.shape === 'circles') {
        c.strokeStyle = 'rgba(192,32,42,0.6)';
        c.lineWidth = 1;
        c.setLineDash([2, 5]);
        c.beginPath();
        c.moveTo(u.x, u.y);
        c.lineTo(bm.x, bm.y);
        c.stroke();
        c.setLineDash([]);
      }
      c.font = 'bold 12px Cinzel, serif';
      c.textAlign = 'center';
      c.lineWidth = 3;
      c.strokeStyle = INK;
      c.fillStyle = BONE;
      const label = m.name.toUpperCase();
      c.strokeText(label, u.x, u.y - 46);
      c.fillText(label, u.x, u.y - 46);
      c.restore();
    }
  }

  /** The boss bar at the top of the field: name, phases, and what to do about him. */
  function drawBar(c, unit, viewW, tick) {
    const entry = ROSTER_BY_TYPE[unit.type];
    const label = (entry?.name || unit.bossName || 'Warlord').toUpperCase();
    const barW = Math.min(viewW - 32, 340);
    const x = viewW / 2 - barW / 2;
    const y = 80;
    const f = Math.max(0, unit.hp / Math.max(1, unit.maxHp));
    const phase = phaseOf(unit);
    c.save();
    c.textAlign = 'center';
    c.fillStyle = 'rgba(7,5,10,0.85)';
    c.fillRect(x - 2, y - 2, barW + 4, 16);
    c.fillStyle = phase === 3 ? '#e02020' : phase === 2 ? '#c03020' : '#a04020';
    c.fillRect(x, y, barW * f, 12);
    c.fillStyle = BONE;
    for (const cut of [0.5, LAST_STAND]) c.fillRect(x + barW * cut - 1, y - 2, 2, 16);
    c.font = 'bold 12px Cinzel, serif';
    c.fillStyle = '#ffe8a0';
    c.fillText(`${label}  ·  ${['I', 'II', 'III'][phase - 1]}`, viewW / 2, y - 6);
    const bm = unit.bossMove || {};
    const now = bm.id ? MOVES[bm.id] : null;
    let line;
    let color = 'rgba(228,220,196,0.9)';
    if ((bm.stunUntil || 0) > tick) {
      line = 'STAGGERED: he takes 35% more damage';
      color = '#ffd040';
    } else if (now) {
      line = `${now.name.toUpperCase()}! ${now.hint}`;
      color = '#ff6050';
    } else {
      const next = nextMove(unit);
      line = next ? `Next: ${next.name}. ${next.hint}` : entry?.title || '';
    }
    for (let px = 11; px >= 8; px--) {
      c.font = `${px}px Cinzel, serif`;
      if (c.measureText(line).width <= viewW - 24) break;
    }
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.strokeText(line, viewW / 2, y + 27);
    c.fillStyle = color;
    c.fillText(line, viewW / 2, y + 27);
    c.restore();
  }

  const sec = (ticks) => `${+(ticks / 60).toFixed(1)} s`;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const COUNTER_NAMES = {
    pikeman: 'pikemen',
    knight: 'knights',
    cavalry: 'cavalry',
    scout: 'scouts',
    ballista: 'ballistae',
    crossbowman: 'crossbowmen',
    mage: 'mages',
    sapper: 'sappers',
    footman: 'footmen',
    general: 'the General',
  };
  const listOf = (types) => {
    const n = types.map((t) => COUNTER_NAMES[t] || t);
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} or ${n[n.length - 1]}` : n[0];
  };

  /** One move in exact numbers: wind-up, area, effect, and what breaks it. */
  function describeMove(id) {
    const m = MOVES[id];
    if (!m) return '';
    const area =
      m.shape === 'lane'
        ? `a lane ${m.len} px long and ${m.width} px wide towards ${m.siege ? 'your nearest building' : 'your thickest ranks'} (within ${m.reach} px)`
        : m.shape === 'self'
          ? `a ${m.radius} px ring around himself`
          : m.shape === 'mark'
            ? `one of your archers, crossbowmen, mages, healers, bards or ballistae within ${m.reach} px`
            : m.shape === 'circles'
              ? `${m.count} circles of ${m.radius} px on ${m.prey === 'ranged' ? 'your shooters' : 'your soldiers'} within ${m.reach} px`
              : `a ${m.radius} px circle on your thickest ranks within ${m.reach} px`;
    const fx = [];
    if (m.summon) fx.push(`raises ${m.summon[1]} revenants (+1 for each return visit)`);
    if (m.dmg)
      fx.push(
        `${pct(m.dmg)} of his damage to ${m.shape === 'mark' ? 'the marked soldier' : 'everyone inside'}`
      );
    if (m.shape === 'lane') fx.push('he ends at the far end of the lane');
    if (m.shape === 'mark') fx.push('he steps out beside the marked soldier');
    if (m.stun) fx.push(`${sec(m.stun)} stun`);
    if (m.burn) fx.push(`burning for ${m.burn} a second for 4 s`);
    if (m.plague) fx.push(`plague for ${m.plague} a second for 4 s`);
    if (m.siege) fx.push('buildings in the lane take his siege damage');
    if (m.healPer) fx.push(`he heals ${pct(m.healPer)} of his health per soldier caught (up to 5)`);
    const c = m.counter;
    const answer =
      c.kind === 'block'
        ? `${listOf(c.types)} in the lane${c.braced ? ', or a footman or pikeman with 2 shield mates beside him,' : ''} stop it`
        : c.kind === 'guard'
          ? `${listOf(c.types)} within ${c.r} px of the marked soldier turn it`
          : `hits from ${listOf(c.types)} worth ${pct(c.pct)} of his health during the wind-up break it`;
    return `${m.name}: ${sec(m.windup)} wind-up, held in place, on ${area}; then ${fx.join(', ')}. Answer: ${answer}; he is then stunned for ${sec(STAGGER_TICKS)} and takes ${pct(EXPOSE_PCT)} more damage. Every ${sec(MOVE_COOLDOWN)} (II: ${sec(MOVE_COOLDOWN * PHASE_COOLDOWN[1])}, III: ${sec(MOVE_COOLDOWN * PHASE_COOLDOWN[2])}, wind-up 30% shorter).`;
  }

  function deathLine(bossType) {
    return ROSTER_BY_TYPE[bossType]?.death || null;
  }

  function formatEvolutionTable() {
    return EVOLUTION_TIERS.map((t) => {
      const label = t.label || 'Prime (first visit)';
      return `${label}: +${Math.round(t.scaleBonus * 100)}% boss stats, +${t.minionBonus} in his guard`;
    }).join('\n');
  }

  function getEncyclopediaEntries() {
    const entries = [
      {
        cat: 'bosses',
        name: 'Boss Wave Cadence',
        body: 'Every 10th wave (10, 20, 30 and on) is led by a named warlord and his own guard instead of a horde. Named warlords appear on their wave and nowhere else. The roster runs Gorath to Malachar, then repeats from wave 110, stronger each time round.',
      },
      {
        cat: 'bosses',
        name: 'Reading a Warlord',
        body: 'Every warlord has a signature move. Before it lands he stops and its ground is marked in red, filling as the strike draws near, and the boss bar names the move and its answer. Answer it in time (the right troops in the marked lane, or the right troops hitting him during the wind-up) and the move fails: he is stunned and takes 35% more damage for a few seconds.\n\nPhases: at half health (phase II) he turns savage and uses his move more often. Under a fifth (phase III, last stand) he uses it at once, winds up faster and repeats it sooner. Warlords never rout.',
      },
      {
        cat: 'bosses',
        name: 'Monster Evolution System',
        body:
          'Each warlord tracks how many times he has led a wave this run. Evolution tiers stack on top of roster cycle scaling:\n\n' +
          formatEvolutionTable() +
          '\n\nOn return visits the game announces the evolution label (RETURNED, ASCENDANT, ETERNAL) and his guard grows; from the third visit elite troops join it.',
      },
      {
        cat: 'bosses',
        name: 'Warlord Guards',
        body: 'Each warlord marches with his own guard from his own faction: Ash March, Bone Court, Gatebreakers, Cinder Oath, Hollow Stalkers, Iron Foundry, Burning Sky Brood, Rot Host, North Hammer and the Endless Siege Host. The guard grows with each return; from the third visit his elite troops join it. Spy assassination removes the guard but never the warlord.',
      },
    ];

    for (const boss of BOSS_ROSTER) {
      const pack = getPackDef(boss.type);
      const moves = boss.moves.map((id) => MOVES[id]?.name).filter(Boolean);
      const evoLines = EVOLUTION_TIERS.slice(1)
        .map(
          (t) => `${t.label}: +${Math.round(t.scaleBonus * 100)}% stats, +${t.minionBonus} guard`
        )
        .join(', ');

      entries.push({
        cat: 'bosses',
        name: `${boss.name} (Wave ${boss.debutWave}+)`,
        body: [
          `${boss.title}. "${boss.tagline}"`,
          `Faction: ${boss.faction}. Leads wave ${boss.debutWave}, then every 100 waves after.`,
          '',
          boss.lore,
          '',
          `Signature: ${moves.join(', ')}.`,
          ...boss.moves.map(describeMove),
          boss.mechanics,
          '',
          `Answer: ${boss.counter}`,
          '',
          pack
            ? `Guard: ${pack.packName}. ${formatUnitList(pack.minions)}; elite (third visit on): ${formatUnitList(pack.eliteMinions)}.`
            : '',
          `Evolution: ${evoLines}.`,
          boss.evolutionNote || '',
        ]
          .filter((l, i, all) => l || all[i - 1])
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

  // Run state in saves: see js/save-registry.js.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('MonsterBosses', {
      save: () => ({ appearances, kills, currentWavePack }),
      load(data) {
        resetRun();
        if (!data) return;
        if (data.appearances && typeof data.appearances === 'object')
          appearances = data.appearances;
        if (data.kills && typeof data.kills === 'object') kills = data.kills;
        currentWavePack = data.currentWavePack ?? null;
      },
    });
  }

  return {
    BOSS_PACKS,
    resetRun,
    getPackDef,
    getAppearanceCount,
    getEvolutionTier,
    computeTotalScale,
    prepareBossWave,
    isPackMinion,
    injectPackIntoQueue,
    spawnPackStructures,
    announceEvolution,
    onBossSlain,
    getStateSnapshot,
    getEncyclopediaEntries,
    BOSS_ROSTER,
    MOVES,
    update,
    onHit,
    drawOver,
    drawBar,
    nextMove,
    phaseOf,
    describeMove,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MonsterBosses = MonsterBosses;
