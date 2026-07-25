/**
 * Myth and Blood — lore database, classified gates, bestiary, campaign beats.
 */
const LoreData = (() => {
  function achCount() {
    return typeof Achievements !== 'undefined' ? Achievements.getCount?.()?.unlocked || 0 : 0;
  }

  function maxWave() {
    return typeof Legacy !== 'undefined' ? Legacy.get?.()?.maxWaveEver || 0 : 0;
  }

  function wavesCleared() {
    return typeof Legacy !== 'undefined' ? Legacy.get?.()?.totalWavesCleared || 0 : 0;
  }

  function honorCount() {
    return typeof Legacy !== 'undefined' ? Legacy.get?.()?.honorCount || 0 : 0;
  }

  function enemyKills(type) {
    if (typeof Achievements === 'undefined') return 0;
    try {
      const raw = localStorage.getItem('myth-and-blood-achievements-v3');
      if (!raw) return 0;
      const d = JSON.parse(raw);
      return d.lifetimeEnemyKills?.[type] || 0;
    } catch (_) {
      return 0;
    }
  }

  function checkUnlock(rule) {
    if (!rule) return true;
    const parts = String(rule).split(':');
    const kind = parts[0];
    const val = parts.slice(1).join(':');

    switch (kind) {
      case 'wave':
        return maxWave() >= parseInt(val, 10);
      case 'waves_cleared':
        return wavesCleared() >= parseInt(val, 10);
      case 'achievements':
        return achCount() >= parseInt(val, 10);
      case 'honor':
        return honorCount() >= parseInt(val, 10);
      case 'runs': {
        const runs = typeof Legacy !== 'undefined' ? Legacy.get?.()?.totalRuns || 0 : 0;
        return runs >= parseInt(val, 10);
      }
      case 'kill': {
        const [etype, n] = val.split(',');
        return enemyKills(etype) >= parseInt(n, 10);
      }
      case 'era': {
        const w = maxWave();
        if (val === 'kingdom_rising') return w >= 31;
        if (val === 'academy') return w >= 100;
        if (val === 'rts') return w >= 100;
        if (val === 'enemy_rts') return w >= 200;
        if (val === 'hellscape') return w >= 1000;
        if (val === 'multifront') return w >= 25;
        return false;
      }
      case 'meta_wwe':
        return typeof MetaProgress !== 'undefined' && MetaProgress.isWweUnlocked?.();
      case 'meta_doom':
        return typeof MetaProgress !== 'undefined' && MetaProgress.isDoomslayerHeroUnlocked?.();
      case 'meta_crossover':
        return typeof MetaProgress !== 'undefined' && MetaProgress.isAnyCrossoverUnlocked?.();
      case 'faction': {
        const map = {
          wwe: () => MetaProgress?.isWweUnlocked?.(),
          doom: () => MetaProgress?.isDoomslayerHeroUnlocked?.(),
          ultimis: () => MetaProgress?.is115Unlocked?.(),
          primis: () => MetaProgress?.isPrimusUnlocked?.(),
          halo: () => MetaProgress?.isHaloUnlocked?.(),
          gears: () => MetaProgress?.isGearsUnlocked?.(),
          lotr: () => MetaProgress?.isLotrUnlocked?.(),
          baki: () => MetaProgress?.isBakiUnlocked?.(),
          jojo: () => MetaProgress?.isJojoUnlocked?.(),
          fotns: () => MetaProgress?.isFotnsUnlocked?.(),
          dragonball: () => MetaProgress?.isDragonballUnlocked?.(),
          imperium: () => MetaProgress?.isImperiumUnlocked?.(),
          crystal: () => MetaProgress?.isCrystalUnlocked?.(),
          warp: () => MetaProgress?.isWarpUnlocked?.(),
          tes: () => MetaProgress?.isTesUnlocked?.(),
        };
        return map[val]?.() ?? false;
      }
      default:
        return false;
    }
  }

  function getUnlockHint(rule) {
    if (!rule) return '';
    const parts = String(rule).split(':');
    const kind = parts[0];
    const val = parts.slice(1).join(':');
    const hints = {
      wave: `Reach wave ${val}`,
      waves_cleared: `Clear ${val} waves (lifetime)`,
      achievements: `Unlock ${val} achievements`,
      honor: `Earn ${val} honor name${val === '1' ? '' : 's'}`,
      runs: `Complete ${val} run${val === '1' ? '' : 's'}`,
      kill: `Slay ${val.split(',')[1]} ${EnemyDefs?.[val.split(',')[0]]?.name || val.split(',')[0]}`,
      era:
        {
          academy: 'Survive to Academy Era (wave 100)',
          rts: 'Survive to RTS Era (wave 100+)',
          enemy_rts: 'Survive to Enemy RTS (wave 200)',
          hellscape: 'Survive to Hellscape (wave 1000+)',
          multifront: 'Survive to multi-front war (wave 25+)',
        }[val] || `Unlock era: ${val}`,
      meta_wwe: 'Unlock the Grand Coliseum',
      meta_doom: 'Unlock the Doomslayer',
      meta_crossover: 'Unlock any evolved faction',
      faction: `Recruit ${val} evolved operatives`,
    };
    return hints[kind] || `Progress required: ${rule}`;
  }

  function entry(cat, name, body, extras = {}) {
    return { cat, name, body, ...extras };
  }

  const ALLY_LORE = {
    footman: {
      flavor:
        "The backbone of every crown army — farmers' sons who learned spear and shield before they learned fear.",
      mechanics:
        'Cheap melee line-holder. Garrisons walls when a General commands the Keep. Bronze stars from kills; 3 gold may earn an honor name.',
      classified:
        'Footmen promoted to General retain their honor name; stars reset and only improve command aura — the Crown never forgets who held the wall.',
      rule: 'honor:1',
    },
    archer: {
      flavor:
        'Longbowmen from the eastern marches, trained to loose volleys while stone still holds.',
      mechanics:
        'Long-range DPS. Garrison outposts for extended range. Fragile — keep behind cover.',
      classified:
        'Outpost garrison grants +55 range — archers behind walls can outshoot orc archers two fields away.',
      rule: 'wave:10',
    },
    mage: {
      flavor: 'Court arcanists who traded tower solitude for the scream of battle.',
      mechanics: 'Arcane bolts with splash damage. Strong vs clustered foes.',
      classified:
        'Splash radius punishes goblin swarms and plague rat floods — pair with fireball for overlapping kill zones.',
      rule: 'kill:goblin,50',
    },
    cavalry: {
      flavor: 'Knights-errant on warhorses bred for the southern downs.',
      mechanics: 'Fast melee with charge bonus. Excellent for hunting stragglers.',
      classified:
        'Charge timer builds while pathing unengaged — first strike can delete warg riders before they kite.',
      rule: 'wave:15',
    },
    healer: {
      flavor: 'Sisters and brothers of the field hospital — mercy with a mortar and pestle.',
      mechanics:
        'Heals allies in range — including other healers. Ranks when healing (once per wave). On any damage, retreats to the nearest med tent until safe. At 3 gold stars unlocks Mass Mend — AOE pulse heal. Select to preview rank and late ability in the unit panel.',
      classified:
        'Mass Mend pulses ~every 3s at 60% heal strength to all wounded allies in range. Promote with TP after Veteran Doctrine or earn gold-star credits by healing each wave.',
      rule: 'era:academy',
    },
    knight: {
      flavor: 'Plate-clad champions sworn to the banner — walking bastions.',
      mechanics: 'Heavy armored melee with damage resistance. Banner courier can summon one.',
      classified:
        '22% flat mitigation stacks with cover and General aura — knights anchor wall slots against dark knights.',
      rule: 'wave:25',
    },
    sapper: {
      flavor: 'Demolition experts who see every wall as a puzzle to solve — friend or foe.',
      mechanics: 'Demolishes walls and siege engines with bonus siege damage (×2.5).',
      classified:
        'Priority target siege towers and enemy hamlets in RTS era — sappers end structures faster than any strike.',
      rule: 'era:rts',
    },
    general: {
      flavor:
        "One commander to hold the line — aura, garrison, and the weight of every soldier's eyes.",
      mechanics:
        'Global enemy priority. Station in Keep for command aura and wall garrison. Stars after promotion buff aura only.',
      classified:
        'Auto-rallies demoralized troops wall-to-wall; while rallying he hits harder and shrugs blows. Tombstone perk resurrects fallen equal to total star count each night.',
      rule: 'wave:50',
    },
    builder: {
      flavor: 'Masons and carpenters who build kingdoms between waves.',
      mechanics:
        'Erects structures (2 projects max). ×5 required for Hamlets and Guilds. Ranks when building. At 3 gold stars unlocks Rapid Repair — surge patches while repairing. Unit panel shows rank progress and unlock path.',
      classified:
        'Rapid Repair: 2% chance per repair tick to restore +8% of structure max HP. Night +35% build speed stacks with veteran build speed.',
      rule: 'era:academy',
    },
    courier: {
      flavor: 'Swift riders carrying decrees that move armies more than spears.',
      mechanics:
        'One royal message per wave. Ranks when dispatching. At 3 gold stars unlocks Twin Dispatch — two messages per wave.',
      classified:
        'Tax levy grants +6 TP next round; call banner spawns an immediate knight. Twin Dispatch lets veteran couriers send a second dispatch the same wave.',
      rule: 'waves_cleared:10',
    },
    scout: {
      flavor: 'Pathfinders who read dust and silence before the horde arrives.',
      mechanics: 'Fast skirmisher with stealth detection. Pair with watchtowers.',
      classified:
        'Reveals burrowers and stealth — mandatory when goblin burrowers appear (wave 9+).',
      rule: 'kill:goblin_burrower,10',
    },
    bard: {
      flavor: 'Minstrels whose songs stitch broken morale back together.',
      mechanics: 'Morale aura support. Weak in direct combat.',
      classified:
        'Royal Court loadout (wave 100+) boosts bard and courier morale caps — songs stack with mess hall auras.',
      rule: 'era:academy',
    },
    ballista: {
      flavor: "Timber engines that throw bolts the size of a man's femur.",
      mechanics: 'Long-range siege. Bonus vs flying foes and siege targets. Anti-air.',
      classified:
        'Sky drakes and harpies die to focused ballista fire — place behind walls with watchtower intel.',
      rule: 'kill:harpy,15',
    },
    pikeman: {
      flavor: 'Halberd blocks that turn cavalry charges into slaughter.',
      mechanics: 'Anti-cavalry and anti-air melee. Cheap line holder.',
      classified:
        'Hard counter to warg riders and harpies — low cost answer before academy ballistas come online.',
      rule: 'kill:warg_rider,20',
    },
  };

  const ENEMY_LORE = {
    goblin: {
      flavor: 'Small, cruel, infinite.',
      threat: 'Swarm',
      weak: 'AoE, splash',
      counter: 'Mage, Fireball, clustered archers',
    },
    orc: {
      flavor: "The horde's iron spine.",
      threat: 'Bruiser',
      weak: 'Focus fire',
      counter: 'Knights, focused archers',
    },
    orc_archer: {
      flavor: 'Back-line pressure while shields advance.',
      threat: 'Ranged',
      weak: 'Cavalry rush, outposts',
      counter: 'Cavalry, outpost archers',
    },
    dark_knight: {
      flavor: 'Purple-glow elites — warlords in stolen plate.',
      threat: 'Elite',
      weak: 'Sustained DPS',
      counter: 'Knights, veterans, lightning',
    },
    warg_rider: {
      flavor: 'Fast harassment from the steppe clans.',
      threat: 'Cavalry',
      weak: 'Pikes, traps',
      counter: 'Pikemen, spike traps',
    },
    dark_mage: {
      flavor: 'Corrupted court mages lobbing hate from afar.',
      threat: 'Caster',
      weak: 'Assassins, rush',
      counter: 'Scouts, cavalry, spy assassinate',
    },
    troll: {
      flavor: 'Regenerating bruisers that eat walls.',
      threat: 'Siege',
      weak: 'Burst, fire',
      counter: 'Sappers, fireball, focus fire',
    },
    goblin_sapper: {
      flavor: 'They love your walls more than you do — briefly.',
      threat: 'Structure',
      weak: 'Intercept',
      counter: 'Hunt mode, melee intercept',
    },
    necromancer: {
      flavor: 'Death priests who refill the horde from corpses.',
      threat: 'Elite caster',
      weak: 'Hamon, burst',
      counter: 'bound spirit operatives, focus fire',
    },
    berserker: {
      flavor: 'No armor, no fear, no tomorrow.',
      threat: 'Elite melee',
      weak: 'Kite, walls',
      counter: 'Archers, outposts, fortify',
    },
    assassin: {
      flavor: "They smell the General's banner.",
      threat: 'Elite striker',
      weak: 'Bodyguards',
      counter: 'Keep garrison, knights on General',
    },
    shaman: {
      flavor: 'Enemy healers chanting over the fallen.',
      threat: 'Support',
      weak: 'Focus, burst',
      counter: 'Assassinate spy, priority kills',
    },
    siege_tower: {
      flavor: 'Rolling castles that link to your walls and burn.',
      threat: 'Siege boss',
      weak: 'Sappers, sabotage',
      counter: 'Sappers, sabotage spy, ballistas',
    },
    goblin_engineer: {
      flavor: 'Mirror-builders for the enemy RTS.',
      threat: 'Economy',
      weak: 'Hunt',
      counter: 'Hunt ON, early kills before hamlets complete',
    },
    war_chief: {
      flavor: 'Boss-tier warlord — the wave ends when he falls.',
      threat: 'Boss',
      weak: 'Focus, elites',
      counter: 'All strikes, evolved ally burst, wall focus',
    },
    harpy: {
      flavor: 'Winged scavengers that dive the unprepared.',
      threat: 'Flyer',
      weak: 'Anti-air',
      counter: 'Pikemen, ballistas, coliseum aerial finishers',
    },
    goblin_burrower: {
      flavor: 'Dirt-mouth goblins that surface behind your ranks.',
      threat: 'Ambush',
      weak: 'Reveal',
      counter: 'Scouts, watchtowers, scout flare, tunnel spy',
    },
    bone_summoner: {
      flavor: 'Raises goblins from every corpse you leave.',
      threat: 'Summoner',
      weak: 'Burst',
      counter: 'Priority kill, solar pulse bonus vs undead',
    },
    sky_drake: {
      flavor: 'Young dragons — fire from above, arrogance included.',
      threat: 'Elite flyer',
      weak: 'Anti-air',
      counter: 'Ballistas, orbital/skyburst evolved allies, frost nova',
    },
    plague_rat: {
      flavor: 'A squealing tide of teeth and fever.',
      threat: 'Swarm',
      weak: 'AoE',
      counter: 'Mage splash, fireball, meteor',
    },
    abomination: {
      flavor: 'A walking tumor of eyes and hunger — it heals while you hesitate.',
      threat: 'Elite horror',
      weak: 'Burst, fire',
      counter: 'Focus fire, fireball, do not let it regenerate',
    },
    behemoth: {
      flavor: 'The ground trembles before you see it. Walls mean nothing.',
      threat: 'Colossus',
      weak: 'Kite, fortify',
      counter: 'Sappers, fortify zones, ballistas, all strikes',
    },
    iron_colossus: {
      flavor: 'Riveted hatred on two legs — a siege tower that walks.',
      threat: 'Siege titan',
      weak: 'Sappers, sabotage',
      counter: 'Sappers, sabotage spy, meteor, sustained siege focus',
    },
    void_stalker: {
      flavor: 'A shadow taller than a man, eyes like coals, claws like scythes.',
      threat: 'General hunter',
      weak: 'Bodyguards',
      counter: 'Keep garrison, knights on General, kill before it reaches him',
    },
    elder_wyrm: {
      flavor: 'Older than the sky drakes. Hungrier. The horizon burns when it arrives.',
      threat: 'Dragon boss',
      weak: 'Anti-air',
      counter: 'Ballistas, frost nova, evolved anti-air, focus fire',
    },
    boss_gorath: {
      flavor: 'The first named warlord most commanders learn to fear.',
      threat: 'Named boss',
      weak: 'Focus fire',
      counter: 'All strikes, wall focus, kill before enrage',
    },
    boss_morwen: {
      flavor: 'Pale queen who raises the dead faster than you bury them.',
      threat: 'Named summoner',
      weak: 'Burst',
      counter: 'Priority kill, solar pulse vs undead',
    },
    boss_thokk: {
      flavor: 'A walking landslide with opinions about your gates.',
      threat: 'Named colossus',
      weak: 'Fortify, kite',
      counter: 'Sappers, fortify zones, sustained siege DPS',
    },
    boss_grimm: {
      flavor: 'Oath-bound knight wreathed in cinder.',
      threat: 'Named duelist',
      weak: 'Range',
      counter: 'Archers, outposts, frost nova',
    },
    boss_vexis: {
      flavor: "Hollow shadow that smells your General's fear.",
      threat: 'Named assassin',
      weak: 'Bodyguards',
      counter: 'Keep garrison, knights on General',
    },
    boss_karg: {
      flavor: 'Foundry on legs — hamlets are his favorite snack.',
      threat: 'Named siege',
      weak: 'Sappers',
      counter: 'Sappers, sabotage, meteor',
    },
    boss_sylvara: {
      flavor: 'Mother of drakes; the sky is her nursery.',
      threat: 'Named dragon',
      weak: 'Anti-air',
      counter: 'Ballistas, pikemen, evolved flyers',
    },
    boss_rotfather: {
      flavor: 'Patriarch of pus — wounds fester in his presence.',
      threat: 'Named horror',
      weak: 'Burst',
      counter: 'Focus fire before regen stacks',
    },
    boss_volk: {
      flavor: 'Marshal who makes siege towers look quaint.',
      threat: 'Named siege lord',
      weak: 'Sustained DPS',
      counter: 'Sappers, wall repair, all strikes',
    },
    boss_malachar: {
      flavor: 'Wave one hundred wears his name like a verdict.',
      threat: 'Ultimate boss',
      weak: 'Everything you saved',
      counter: 'Full army, all strikes, evolved ally burst, do not hold TP back',
    },
  };

  const BESTIARY_EXTRA = {
    necromancer: {
      classified:
        'solar pulse deals +55% damage — classified field test confirms undead resist conventional steel.',
      rule: 'faction:jojo',
    },
    harpy: {
      classified:
        'coliseum aerial finishers and Baki/FotNS melee struggle without anti-air — evolved dossier 7-B.',
      rule: 'meta_crossover',
    },
    sky_drake: {
      classified: 'Orbital Vanguard and Skyburst Foundry operatives register elevated anti-air efficacy vs drakes.',
      rule: 'faction:halo',
    },
    war_chief: {
      classified:
        'Void Residue rush tactics punished — War Chiefs absorb Void Residue alpha strikes and counter-push.',
      rule: 'faction:ultimis',
    },
    behemoth: {
      classified:
        'Field reports describe Behemoths shrugging off fireball barrages below wave 100 — bring siege crews.',
      rule: 'wave:25',
    },
    elder_wyrm: {
      classified:
        'Orbital ballistas and Skyburst beam weapons register highest efficacy vs Elder Wyrms.',
      rule: 'wave:50',
    },
    void_stalker: {
      classified:
        'Void Stalkers bypass wall garrisons — General must not roam alone after wave 32.',
      rule: 'wave:32',
    },
    shaman: {
      classified:
        'Martial arts evolved ally burst partially negated by enemy heal-over-time — assassinate or focus.',
      rule: 'kill:shaman,25',
    },
  };

  const ERA_BEATS = [
    {
      wave: 1,
      name: 'The First Dawn',
      hook: 'Scouts report movement in the northern treeline. The Crown gives you spears, walls, and little else. Survive.',
      rule: 'runs:1',
    },
    {
      wave: 5,
      name: 'First Horde',
      hook: 'Wave five is never a duel — it is a flood. Goblins and rats pour in faster than you have seen. Thin them before they thicken.',
      rule: 'wave:5',
    },
    {
      wave: 10,
      name: 'Expanding Horizon',
      hook: 'Every ten waves the map widens — more room to build, more ground to lose. And on each tenth wave, a named warlord leads the host personally.',
      rule: 'wave:10',
    },
    {
      wave: 25,
      name: 'Second Front',
      hook: 'Horns from the east. The war is no longer a single northern march — assaults close from every compass point.',
      rule: 'era:multifront',
    },
    {
      wave: 31,
      name: 'Kingdom Rising',
      hook: 'Wave thirty-one. The Outpost Realm hardens into a kingdom — academies answer, veterans earn names, and the research tree opens in earnest.',
      rule: 'era:kingdom_rising',
    },
    {
      wave: 50,
      name: 'Four Winds',
      hook: 'North, east, west — soon south. Commanders who survived this far speak of sleepless nights and courier horses ridden to death.',
      rule: 'wave:50',
    },
    {
      wave: 100,
      name: 'Academy Proclamation',
      hook: 'Advanced academies open their gates. The war becomes an economy — hamlets, guilds, and trained specialists decide who survives.',
      rule: 'era:academy',
    },
    {
      wave: 100,
      name: 'RTS Threshold',
      hook: 'Enemy counts swell ~35%. Hamlets and guilds are no longer luxury — they are oxygen.',
      rule: 'era:rts',
    },
    {
      wave: 150,
      name: 'Settlement Raids',
      hook: 'Wave one hundred fifty. The Crown authorizes northern strike missions — hunt enemy hamlets before their economy outpaces yours.',
      rule: 'era:rts',
    },
    {
      wave: 200,
      name: 'Mirror War',
      hook: 'The map widens again. Goblin engineers raise hamlets in the north. Every guild you build, they learn to copy.',
      rule: 'era:enemy_rts',
    },
    {
      wave: 316,
      name: 'The Iron Creed',
      hook: 'Achievements line the road to the grand arena. Veterans whisper of a Grand Coliseum beyond mortal milestones.',
      rule: 'achievements:316',
    },
    {
      wave: 500,
      name: 'Planet Conquest',
      hook: 'Wave five hundred. Sectors split the north by realm — conquer each hostile domain or face the Worldheart Tyrant when two realms fall.',
      rule: 'wave:500',
    },
    {
      wave: 1000,
      name: 'Hellscape Breach',
      hook: "Reality thins. Even legends falter. The Doomslayer's blade returns to mortal scale — the true endgame begins.",
      rule: 'era:hellscape',
    },
  ];

  /** In-run narrative framing for major campaign milestones (HUD messages / floating text). */
  const CAMPAIGN_NARRATIVE = {
    kingdomEvolution: KINGDOM_EVOLUTION_STAGES,
    waves: {
      10: {
        title: 'Named Warlords',
        hook: 'The map widens — and a named warlord leads the host in person. From this day, every tenth dawn brings a legend you must break.',
        sub: 'Scouts report enemy trade posts rising in the far north. Their economy has teeth now.',
      },
      31: {
        title: 'Kingdom Rising',
        hook: 'Wave thirty-one. Your force evolves — the Outpost Realm becomes a kingdom. Academies train, settlements charter, and evolved dossiers unlock.',
        sub: 'Survival gave way to growth. Veterans and research now decide whether the next tenth wave breaks you.',
      },
      50: {
        title: 'Mid Realm',
        hook: 'Wave fifty. Four winds, four flanks — the mid campaign belongs to veterans, evolved allies, and settlement charters.',
        sub: 'Pressure climbs steadily now; the Crown expects a realm, not a rally point.',
      },
      65: {
        title: 'Veteran Legion',
        hook: 'Wave sixty-five. Tenure-hardened troops and evolved operatives anchor the line while the host tests every weakness.',
        sub: 'Promote core veterans with TP — the north no longer forgives obsolete rosters.',
      },
      75: {
        title: 'Tombstone Rite',
        hook: 'Wave seventy-five. Fallen names stir in the royal ledger — honored dead may rise when a General bears Tombstone.',
        sub: 'Morale and memory decide whether your army breaks before the academy proclamation.',
      },
      85: {
        title: 'Academy Threshold',
        hook: 'Wave eighty-five. Pressure builds before the proclamation — economy, training, and colony value decide who survives the climb.',
        sub: 'Enemy scaling eases in over the next waves instead of striking all at once at dawn one hundred.',
      },
      100: {
        title: 'Empire Ascendant',
        hook: 'Wave one hundred. Empire Ascendant — full academy training, hamlets and guilds, fortress upgrades, and loadouts shape every dawn.',
        sub: 'Kingdom strength now steers the host. Rich realms swell the assault; lean ones catch their breath. Hunt enemy northern holds.',
      },
      115: {
        title: 'Empire Consolidation',
        hook: 'Wave one hundred fifteen. Loadouts lock in and colony value steers assault composition — tailor your realm or suffer the host.',
        sub: 'The post-academy curve keeps climbing; consolidation waves separate thriving empires from brittle ones.',
      },
      150: {
        title: 'Raid Authority',
        hook: 'Wave one hundred fifty. The Crown authorizes northern strike missions — hunt enemy hamlets before their economy compounds.',
        sub: 'Settlement raids pay full loot when holds fall. Keep a home guard — counter-raids never sleep.',
      },
      175: {
        title: 'Mirror Pressure',
        hook: 'Wave one hundred seventy-five. Hostile mirror settlements multiply and the frontier widens before full planetary war.',
        sub: 'Map growth eases in through the RTS threshold — the north will not wait for wave two hundred.',
      },
      200: {
        title: 'Planetary Dominion',
        hook: 'Wave two hundred. Planetary Dominion — mirror war at scale, hostile territory creep, and counter-hold couriers.',
        sub: 'Launch settlement raids through the spy network or raise counter-holds by courier. Raze every foe structure — the campaign ends when their economy is ash.',
      },
      500: {
        title: 'Planet Conquest',
        hook: 'Wave five hundred. The north fractures into hostile sectors — true victory now demands the Worldheart Tyrant, not economy purge alone.',
        sub: 'CONQUEST HUD tracks sector control. Eliminate two+ realms to awaken the Worldheart — field three+ unit types to pierce its ward, then shatter it for true victory.',
      },
    },
    trueVictory: {
      title: 'Worldheart Shattered',
      hook: 'The Worldheart Tyrant falls. True victory — every hostile realm is broken and the planet bows to your crown.',
      sub: 'The chronicles record a planetary conquest. No northern sector remains to challenge the Crown.',
    },
    firstBoss: {
      title: 'Warlord Slain',
      hook: 'The Crown records your first named warlord defeated. The host hesitates — for a moment, the north feels beatable.',
      sub: 'Keep pressing. Each tenth wave brings another legend until Malachar at wave one hundred.',
    },
    economyVictory: {
      title: 'Northern Holds Fallen',
      hook: 'The last enemy holdfast is ash. Their northern economy is broken — the endless siege ends here.',
      sub: 'The Crown declares the campaign won. Your builders may rest; the chronicles will remember this purge.',
    },
  };

  const HONOR_LORE = [
    {
      name: 'Crown Naming Tradition',
      body: "At three gold stars, the Crown grants a prefix (Syr, Dame, Magister…) and a name from the royal ledger — hashed from the soldier's service ID so no two stories repeat.",
      rule: 'honor:1',
    },
    {
      name: 'Veteran Upgrade',
      body: 'Honor coincides with a veteran stat surge — HP, damage, speed, and morale climb. Generals keep the name; stars reset for aura growth only.',
      rule: 'honor:1',
    },
    {
      name: 'Prefix by Role',
      body: 'Footmen become Syr or Captain; mages Magister; healers Sister or Brother; builders Craftlord. Evolved operatives may earn honors if they serve long enough in your roster.',
      rule: 'honor:3',
    },
    {
      name: 'Tombstone Resurrection',
      body: "A General with Tombstone perk resurrects fallen troops each night equal to total bronze-star count — honored veterans return first in the scribes' accounts.",
      rule: 'wave:75',
    },
    {
      name: 'Wall Garrison Honors',
      body: 'Honored footmen garrisoned under a General become immovable — enemy assassins prioritize the General, but honored names on the wall break assault math.',
      rule: 'wave:40',
    },
  ];

  function buildAllyEntries() {
    return Object.entries(ALLY_LORE).map(([id, lore]) => {
      const def = UnitDefs?.[id];
      const stats = def ? ` · ${def.cost} TP · HP ${def.hp} · DMG ${def.damage}` : '';
      return entry('allies', def?.name || id, `${lore.flavor} ${lore.mechanics}${stats}`, {
        classified: lore.classified,
        classifiedRule: lore.rule,
      });
    });
  }

  function buildEnemyEntries() {
    return Object.entries(ENEMY_LORE).map(([id, lore]) => {
      const def = EnemyDefs?.[id];
      const stats = def ? ` · HP ${def.hp} · DMG ${def.damage} · ${def.type}` : '';
      return entry('enemies', def?.name || id, `${lore.flavor}${stats}`, {
        classified: `Threat: ${lore.threat}. Weakness: ${lore.weak}. Counter with: ${lore.counter}.`,
        classifiedRule: `kill:${id},5`,
      });
    });
  }

  function buildBestiaryEntries() {
    return Object.entries(ENEMY_LORE).map(([id, lore]) => {
      const def = EnemyDefs?.[id];
      const extra = BESTIARY_EXTRA[id];
      return entry(
        'bestiary',
        def?.name || id,
        `Threat level: ${lore.threat}. Primary weakness: ${lore.weak}. Recommended counters: ${lore.counter}.`,
        {
          bestiaryWeak: lore.weak,
          bestiaryCounter: lore.counter,
          bestiaryThreat: lore.threat,
          classified: extra?.classified,
          classifiedRule: extra?.rule,
        }
      );
    });
  }

  function buildBuildingEntries() {
    const notes = {
      outpost: ['Forward cover +1 garrison slot. Extends archer range +55.', 'wave:5'],
      wall: [
        'Blocks movement. 2 footman slots per wall under General command. Siege priority.',
        'wave:3',
      ],
      castle: [
        'Compound: 4 walls, 4 outposts, Keep, med tent, mess hall. Requires Fortification research.',
        'wave:6',
      ],
      medical_tent: [
        'All wounded allies below 40% HP retreat here when damaged instead of fighting to death.',
        'wave:8',
      ],
      mess_hall: ['Morale aura for nearby troops — stack with bards and rallies.', 'wave:12'],
      watchtower: [
        'Vision reveals stealth/burrowers. Enemies in range suffer accuracy penalties.',
        'kill:goblin_burrower,5',
      ],
      spike_trap: [
        'Hidden spikes — first crossing enemy takes heavy damage per cooldown.',
        'wave:20',
      ],
      quarry: [
        '14 TP, 2 Builders. +1 TP/round (shared 6-site cap with trade posts). Blocks movement.',
        'waves_cleared:15',
      ],
      trade_outpost: [
        '16 TP, 2 Builders. +1 TP/round + morale aura. Shared 6-site cap — hamlets win late.',
        'waves_cleared:20',
      ],
      fortress_upgrade: ['Fortify completed settlement: +HP, cover, +1 TP/round.', 'era:rts'],
      hamlet: [
        '100 TP, 5 Builders, 5-wave build. +5 TP/round. Settlement Charter research.',
        'era:academy',
      ],
      village: [
        '180 TP, 6 Builders, 6-wave build. +8 TP/round. Village Rights research.',
        'era:rts',
      ],
      town: ['280 TP, 7 Builders, 7-wave build. +10 TP/round. Town Charter research.', 'era:rts'],
      city: ['420 TP, 8 Builders, 8-wave build. +12 TP/round. Urban Planning research.', 'era:rts'],
      metropolis: [
        '600 TP, 10 Builders, 10-wave build. +15 TP/round. Imperial Metropolis research.',
        'era:rts',
      ],
      merchant_guild: [
        '150 TP, 5 Builders. +1 TP/round per guild in settlement aura. Merchant Charter research.',
        'era:rts',
      ],
      enemy_hamlet: [
        'After wave 200 enemies raise hamlets — each completed adds +1 spawn.',
        'era:enemy_rts',
      ],
      enemy_merchant_guild: [
        'Enemy mirror of your guild — destroy to slow their economy war.',
        'era:enemy_rts',
      ],
      enemy_trade_outpost: [
        'Goblin engineers raise these after wave 10 — siege to blunt foe TP income.',
        'wave:10',
      ],
      enemy_quarry: ['Enemy quarry sites — destroy before they fund larger hordes.', 'wave:20'],
    };
    const academyFlavor = 'Academy Era structure — trains one free unit per round when built.';
    const entries = [];
    if (typeof BuildDefs !== 'undefined') {
      for (const [id, def] of Object.entries(BuildDefs)) {
        if (def.isPerkMachine) continue;
        const note = notes[id];
        let body = def.isAcademy
          ? `${academyFlavor} Trains: ${def.academyUnit || 'specialist'}. Cost ${def.cost} TP.`
          : `${def.name}: ${note?.[0] || `Cost ${def.cost} TP · build time ${def.buildTime} ticks.`}`;
        let classified = null;
        let classifiedRule = note?.[1] || null;
        if (id === 'wwe_academy') {
          body = 'Secret grand-arena campus. Unlocks coliseum champion recruitment.';
          classified =
            'Build: 1000 TP, 10 Builders (2+ hamlets & 1+ guild recommended). Unlocks at Iron Creed achievement milestone.';
          classifiedRule = 'meta_wwe';
        } else if (def.factionLore) {
          classified = `${def.factionLore} Available from wave 1 once cheat-unlocked.`;
          classifiedRule = 'meta_crossover';
        }
        entries.push(entry('buildings', def.name, body, { classified, classifiedRule }));
      }
    }
    return entries;
  }

  function buildOrderEntries() {
    const entries = [];
    if (typeof Abilities !== 'undefined') {
      for (const [id, def] of Object.entries(Abilities)) {
        const effect = def.healAmount
          ? `heals ${def.healAmount} in radius ${def.radius}`
          : def.units
            ? `spawns ${def.units.length} troops`
            : `damage ${def.damage} radius ${def.radius}`;
        entries.push(
          entry('orders', def.name, `${effect}. Cost ${def.cost} TP.`, {
            classified: def.upgradeTier
              ? 'Academy Era cost reductions may apply after wave 100.'
              : 'Strike cooldown shared with tactical economy — spend wisely during siege waves.',
            classifiedRule: def.upgradeTier ? 'era:academy' : 'waves_cleared:5',
          })
        );
      }
    }
    if (typeof SpyActions !== 'undefined') {
      for (const [id, def] of Object.entries(SpyActions)) {
        entries.push(
          entry('orders', def.name, `${def.desc}. Cost ${def.cost} TP. One spy action per wave.`, {
            classified: 'Sleight of Hand perk reduces spy/courier costs by 1 TP.',
            classifiedRule: 'achievements:50',
          })
        );
      }
    }
    if (typeof CourierMessages !== 'undefined') {
      for (const [id, def] of Object.entries(CourierMessages)) {
        entries.push(
          entry('orders', def.name, `${def.desc}. Cost ${def.cost} TP. One message per wave.`, {
            classified:
              'Couriers rank each dispatch — faster cooldowns and morale on veteran envoys.',
            classifiedRule: 'waves_cleared:8',
          })
        );
      }
    }
    entries.push(
      entry(
        'orders',
        'Morale & Routing',
        'Troops witness fallen allies and lose morale. Routing causes desertion before wave 100; after, demoralized troops idle until rallied. General auto-paths for pep talks.',
        {
          classified:
            'Battle Rally snaps routing instantly — keep 4 TP in reserve during multi-front waves.',
          classifiedRule: 'era:multifront',
        }
      ),
      entry(
        'orders',
        'Wave Events',
        'Blood Moon (÷13): flying predators. Supply Caravan (÷17): +5 TP. Siege Push (÷23): extra towers.',
        {
          classified:
            'Royal Herald courier previews next event — plan academies and strikes around caravan waves.',
          classifiedRule: 'wave:30',
        }
      ),
      entry(
        'orders',
        'Loadouts (Wave 100+)',
        'Empire Ascendant unlocks five army doctrines in the right HUD: Balanced (none), Shield Wall (+15% HP footmen/knights), Arrow Storm (+12% damage archers/mages), Siege Crew (×1.25 siegeMult sappers/ballistas), Royal Court (+6 morale cap bards/couriers, faster courier cooldown). Applies to new TP deploys and academy graduates — press Z to cycle.',
        {
          classified:
            'Siege Crew before ballista academy nights; Royal Court stacks with Twin Dispatch couriers. See Loadouts encyclopedia tab.',
          classifiedRule: 'era:academy',
        }
      )
    );
    return entries;
  }

  function buildStarEntries() {
    return [
      entry(
        'stars',
        'Bronze Stars',
        'Combat troops earn bronze from kills. 3 bronze → 1 silver → 1 gold → TP promotion eligibility (Veteran Doctrine research required).',
        {
          classified: 'Vulture Aid: kills may grant +1 TP — bronze farmers become economy engines.',
          classifiedRule: 'achievements:25',
        }
      ),
      entry(
        'stars',
        'Specialist Ranks',
        "Healers, Builders, and Couriers earn one star step per wave when they work (heal, build, or dispatch). Rank titles progress to V6 — e.g. Acolyte → Archbishop → Saint of the Realm (healers); Apprentice → Master Builder → Imperial Engineer (builders); Runner → King's Sworn → Crown Envoy (couriers).",
        {
          classified:
            'Work once per wave for a free rank step, or spend TP after a full gold-star cycle under Veteran Doctrine.',
          classifiedRule: 'waves_cleared:12',
        }
      ),
      entry(
        'stars',
        'Mass Mend (Healer · 3 gold stars)',
        "At 3 gold stars, healers unlock Mass Mend. ~Every 3 seconds, pulse-heals all wounded allies within range for 60% of the healer's heal strength. Shown as ACTIVE in the selected unit panel.",
        {
          classified:
            'Pair Mass Mend healers behind your wall line during horde waves — they sustain the blob while footmen hold.',
          classifiedRule: 'waves_cleared:30',
        }
      ),
      entry(
        'stars',
        'Rapid Repair (Builder · 3 gold stars)',
        "At 3 gold stars, builders unlock Rapid Repair. While repairing a structure, each tick has a 2% chance to restore +8% of that structure's max HP — sudden surge patches during siege.",
        {
          classified:
            'Stack with night +35% build speed and veteran build ticks — one Master Builder on the Keep can outrace siege tower DPS.',
          classifiedRule: 'waves_cleared:30',
        }
      ),
      entry(
        'stars',
        'Twin Dispatch (Courier · 3 gold stars)',
        'At 3 gold stars, couriers unlock Twin Dispatch — send two royal messages in the same wave (still subject to ride cooldown between dispatches).',
        {
          classified:
            'Royal Court loadout further cuts courier cooldown mult — veteran envoys become tempo engines.',
          classifiedRule: 'waves_cleared:30',
        }
      ),
      entry(
        'stars',
        'Selected Unit Panel',
        'Click any living ally to open the unit info panel (bottom of screen). Shows HP/morale, veteran stars, tenure scaling bars, combat % vs wave (core troops), specialist rank progress, late-ability lock/unlock state, perks, and quick actions (Hunt, Focus, Promote).',
        {
          classified:
            'Evolved operatives display dual HP/DMG tenure bars (caps ×2.15 HP / ×1.75 DMG). Specialists show rank bar to V6 and progress toward V4 masteries.',
          classifiedRule: 'wave:5',
        }
      ),
      entry(
        'stars',
        'Field Tenure (All Troops)',
        'Every unit tracks spawn wave — each dawn survived adds field tenure. Evolved operatives gain real HP/DMG mults (up to ×2.15 HP, ×1.75 DMG). Core footmen/archers get combat-pace offset vs wave pressure instead of raw inflation — panel shows tenure bars and obsolete %.',
        {
          classified:
            'Tenure softens obsolete pressure on vanilla troops (~+0.6% combat eff. per wave, cap +10%). IP operatives stack wave scaling + tenure each dawn.',
          classifiedRule: 'wave:15',
        }
      ),
      entry(
        'stars',
        'Gold & Honor Names',
        'At 3 gold stars, the Crown grants a name (e.g. Syr Gwyn) and promotion eligibility. Research Veteran Doctrine, then spend TP — core troops do not auto-scale with waves.',
        {
          classified:
            'Honor names persist through promotions — a footman named Syr Gwyn promoted to General keeps Syr Gwyn on the banner.',
          classifiedRule: 'honor:1',
        }
      ),
      entry(
        'stars',
        'Immortal Mentors for Academies',
        'Max-rank veterans (Immortal for combat troops; Saint of the Realm for specialists) are the only commanders recognized as academy founders. Without the matching mentor alive on the field, academy placement stays locked.',
        {
          classified:
            'Hover any academy in the build panel for the exact mentor required. General Academy needs a footman who completed a gold-star honor cycle.',
          classifiedRule: 'era:academy',
        }
      ),
      entry(
        'stars',
        'General Promotion',
        '3-gold-star Footman promoted via General Academy — stats kept, stars reset for aura growth only.',
        {
          classified:
            'Each general star adds ~4.5% command aura — endgame armies scale off one honored leader.',
          classifiedRule: 'wave:60',
        }
      ),
      entry(
        'stars',
        'Crossover Scaling',
        'Coliseum and evolved operatives scale with wave number automatically plus field tenure. Core footmen stay viable through veteran promotions and tenure offset — after wave ~40, TP promotions under Veteran Doctrine keep pace with evil operatives.',
        {
          classified:
            'Tonic Stations machines require secret roster unlock — Ironbrew, Tombstone (General only), Twinshot Brew, and more.',
          classifiedRule: 'meta_crossover',
        }
      ),
    ];
  }

  function buildEraEntries() {
    return [
      entry(
        'eras',
        'Kingdom Strength (STRENGTH HUD)',
        "Your kingdom's strength directly shapes the enemy's aggression and composition. Live score = Army + Works + Treasury ledgers. The STRENGTH block in the top bar (after WAVE) shows threat stage (Humble I → Empire V), your ratio vs baseline, a bar with a gold tick at 1.00× on-pace, and a tooltip with ledger breakdown and next-wave host preview. See Kingdom Strength tab for full formulas and counter tables.",
        {
          classified:
            'Above 1.00× swells spawn counts, tightens cadence, injects elites, and tilts composition toward counters for your walls, evolved allies, and economy. Night snapshot locks pressure; the bar updates live during the wave.',
          classifiedRule: 'wave:10',
        }
      ),
      entry(
        'eras',
        'Wave Pressure from Kingdom Strength',
        'Each night, kingdom strength feeds adaptive wave pressure on top of core wave hpScale/dmgScale — host size (~±55% at extremes), modest enemy HP/damage caps, faster spawns when Treasury is bloated, and 1–3 elite injection slots at Dominant/Empire tiers.',
        {
          classified:
            'Adaptive composition reads your battlefield: walls → sappers/towers; evolved allies → faction counters; hamlets → engineers. Full breakdown in Kingdom Strength tab.',
          classifiedRule: 'era:academy',
        }
      ),
      entry(
        'eras',
        'Tactical Points',
        'TP per cleared wave (+8 base, scaling). Uncapped storage. Settlements add bonus TP/round.',
        {
          classified:
            'Soft cap warning at 18 settlement TP — diminishing returns encourage spreading hamlets. Large TP hoards raise Treasury ledger and can tighten spawn cadence.',
          classifiedRule: 'era:academy',
        }
      ),
      entry('eras', 'Territory (Every 10 Waves)', 'Map expands +90 wide, +110 deep.', {
        classified:
          'Territory tier drives pathfinding load — use night phase to reposition before expansion.',
        classifiedRule: 'wave:10',
      }),
      entry(
        'eras',
        'Multi-Front (Every 25 Waves)',
        'New attack flank until all four sides assault: North → East (25) → West (50) → South (75). Each dawn rolls which unlocked flanks are active — glowing edge bands, marching chevrons, and the corner compass show assaulting sides.',
        {
          classified:
            'THREAT compass (▲▶◀▼) matches multi-front assignments. Spy scout reveals the exact roster before dawn.',
          classifiedRule: 'era:multifront',
        }
      ),
      entry(
        'eras',
        'Horde Waves (Every 5)',
        'Waves 5, 15, 25… spawn faster swarms — slightly weaker individually but numerous. Pulsing red edge and intensity meter (Swarm → Heavy → Critical). Every 15th horde embeds siege tower + sappers. Waves 10, 20, 30… are named boss waves instead.',
        {
          classified:
            'Listen for the drum stomp as spawns accelerate. Scout intel warns "HORDE expected."',
          classifiedRule: 'wave:5',
        }
      ),
      entry(
        'eras',
        'Academy Era (Wave 100)',
        'Escalation milestone — enemy pressure and settlement raids intensify. Academies, hamlets, and TP deploy are available from wave 1.',
        {
          classified:
            'TP deploy stays available — academies add free training each round on top of manual deployment.',
          classifiedRule: 'era:academy',
        }
      ),
      entry('eras', 'RTS Era (Wave 100+)', 'Enemy counts swell ~35%. Protect economy buildings.', {
        classified: 'Fortress upgrades on hamlets add +1 TP and cover — anchor settlement defense.',
        classifiedRule: 'era:rts',
      }),
      entry(
        'eras',
        'Enemy RTS (Wave 200)',
        'Enemies build hamlets and guilds mirroring your bonuses.',
        {
          classified:
            'Each enemy completed settlement adds +1 spawn — hunt engineers before structures finish.',
          classifiedRule: 'era:enemy_rts',
        }
      ),
      entry(
        'eras',
        'Planet Warfare (Wave 200+)',
        'Hostile territory creeps south each wave unless you push back. CONTROL HUD tracks map dominance — high control means closer spawns, faster assaults, and fog north of the red front line. Raze enemy structures and clear the north to reclaim vision.',
        {
          classified:
            'Watchtowers and scouts pierce the fog. Hunt northern holds before the front reaches your hamlets.',
          classifiedRule: 'era:enemy_rts',
        }
      ),
      entry(
        'eras',
        'Evolved Allies',
        'Evolved operatives are your evolved allies — rare power spikes early (1–2 operatives flip sieges), full faction armies with synergies mid-game, and Planet Warfare demolition experts after wave 200. See Crossover System tab for full curve, secret rosters, and operative list.',
        {
          classified:
            'Planet Warfare operatives (Baird, Stone Axe Lord, Kael Skyburst, Cataclysm Lord, Marcus, etc.) gain settlement-siege bonuses and splash raze vs northern holds.',
          classifiedRule: 'meta_crossover',
        }
      ),
      entry(
        'eras',
        'Kingdom Evolution',
        'Four Evolve-style growth stages for your force: Outpost Realm (1–30), Kingdom Rising (31–99), Empire Ascendant (100–199), Planetary Dominion (200+). HUD shows your stage; each tier unlocks stronger kingdom bonuses.',
        {
          classified:
            'Stage 3 amplifies colony-value wave pressure. Stage 4 unlocks Settlement Raid spy and Counter-Hold courier.',
          classifiedRule: 'era:kingdom_rising',
        }
      ),
      entry(
        'eras',
        'Evolution Meter & Banner',
        'Banner grows from pennant → crest → empire cloth → hell-forged standard. Meter fill blends colony value (35%), buildings (25%), veterans (25%), and research (15%).',
        {
          classified:
            'Fill the meter within a stage before the next wave milestone — doctrines unlock by stage, not meter %.',
          classifiedRule: 'era:kingdom_rising',
        }
      ),
      entry(
        'orders',
        'Kingdom Doctrines',
        'One per wave: Outpost Stand (S1), Royal Muster (S2), Imperial March (S3 map rally), Hellforge Decree (S4 map wrath).',
        {
          classified:
            'Imperial March clears demoralized troops globally — use before a multi-front boss wave.',
          classifiedRule: 'era:academy',
        }
      ),
      entry(
        'eras',
        'Day & Night Cycle',
        'Day: assaults. Night: prep, +35% builder speed, perk collection.',
        {
          classified:
            'Bray Wyatt lantern punishes enemy accuracy at dusk — schedule elite waves around light level.',
          classifiedRule: 'meta_wwe',
        }
      ),
      entry(
        'eras',
        'Hellscape (Wave 1001+)',
        'Reality thins — legendary damage falls to mortal scale.',
        {
          classified:
            'Doomslayer one-shots end here. Only sustained evolved synergies and settlement economy survive.',
          classifiedRule: 'era:hellscape',
        }
      ),
      entry(
        'campaign',
        'Campaign Victory — Northern Purge',
        'Standard Campaign and Academy Era runs end in victory when every enemy economy structure is destroyed — trade posts, quarries, hamlets, guilds, shadow academies, and war academies. Survival and challenge modes remain endless.',
        {
          classified:
            'Enable Hunt on sappers and knights after wave 200; enemy structures appear on the minimap as red settlement dots.',
          classifiedRule: 'era:enemy_rts',
        }
      ),
    ];
  }

  function buildCampaignEntries() {
    return ERA_BEATS.map((b) =>
      entry('campaign', b.name, b.hook, {
        classified: `Strategic note — milestone wave ${b.wave}. Chronicles record commanders who pass this threshold.`,
        classifiedRule: b.rule,
        campaignWave: b.wave,
      })
    );
  }

  function buildHonorEntries() {
    return HONOR_LORE.map((h) =>
      entry('honor', h.name, h.body, {
        classified:
          'Your legacy tracks every honor granted — see Legacy tab for the roll of named veterans.',
        classifiedRule: h.rule,
      })
    );
  }

  function buildFactionOverviewEntries() {
    if (typeof EnemyFactions !== 'undefined' && EnemyFactions.getEncyclopediaEntries) {
      const detailed = EnemyFactions.getEncyclopediaEntries();
      const extras = [
        entry(
          'enemies',
          'Horde Grunts',
          'Goblins, orcs, plague rats, and sappers scale slowly — filler that falls behind as waves climb. The host replaces them with evil operatives.',
          {
            classified:
              'Horde waves (every 5th) still flood with grunts even after operatives dominate — AoE answers never go out of style.',
            classifiedRule: 'wave:5',
          }
        ),
        entry(
          'enemies',
          'Evil Operatives',
          'Fantasy horrors that scale with waves like your evolved roster — hellbound legionnaires, grim revenants, cinderbound juggernauts, and more. Purple glow marks operatives on the field.',
          {
            classified:
              "Core footmen fall behind ~wave 40 without Veteran Doctrine promotions — operatives are the host's evolved mirror.",
            classifiedRule: 'wave:25',
          }
        ),
        entry(
          'enemies',
          'Named Bosses (Every 10 Waves)',
          'Waves 10–100 debut Gorath → Malachar, then the roster cycles every 100 waves with +20% cycle scaling. Monster Evolution tiers on return visits: Prime, Returned (+18%), Ascendant (+36%), Eternal (+55%) — each adds pack minions and northern holds (Ash March, Bone Court, Endless Siege Host, etc.). Bosses encyclopedia tab has full lore and counters.',
          {
            classified:
              'MONSTER HUD shows evolution label and pack summary. Spy assassinate removes elites but not the warlord.',
            classifiedRule: 'wave:10',
          }
        ),
      ];
      return [...detailed, ...extras];
    }
    return [
      entry(
        'enemies',
        'Enemy Faction Evolution',
        'Each major hostile archetype follows a 4-stage track in the HOST HUD. Open the Enemies tab after the game loads for full per-faction stage pages.',
        {
          classified:
            'Five factions: Goblin Hordes, Orc Warbands, Dark Legions, Void/Abyssal, Mirror Empires (post-200).',
          classifiedRule: 'wave:8',
        }
      ),
    ];
  }

  function buildCampaignSystemEntries() {
    return [
      entry(
        'campaign',
        'Game Modes',
        'Campaign — standard defense; destroy all enemy northern settlements to win (or conquer sectors at wave 500+). Survival Endless — score chase. Roguelike — random modifiers. Timed Blitz — shorter nights. Seed Run — deterministic spawns. Academy Era — jump to wave 100–200. Planet Conquest — starts at wave 500 with sector warfare endgame.',
        {
          classified: 'Co-op and Versus are listed as future modes on the main menu.',
          classifiedRule: 'runs:1',
        }
      ),
      entry(
        'campaign',
        'Kingdom Evolution (Player Growth)',
        'Four Evolve-style stages in the Kingdom HUD: Outpost Realm (1–30, +5% line HP), Kingdom Rising (31–99, +3% army damage), Empire Ascendant (100–199, colony value steers pressure; wave 150+ raids), Planetary Dominion (200+, mirror settlements, Counter-Hold courier, +5% army / +10% siege).',
        {
          classified:
            'Evolution meter blends colony value 35%, buildings 25%, veterans 25%, research 15%. Banner grows pennant → hell-forged standard.',
          classifiedRule: 'era:kingdom_rising',
        }
      ),
      entry(
        'campaign',
        'Settlement Raid Missions (Wave 150+)',
        'SETTLEMENT RAIDS panel lists northern targets with TP and science rewards. Select 2+ hunters, dispatch a strike force — full loot when the hold is razed. Organic hunts pay a smaller scavenger cut. Spy Settlement Raid sabotages weakest hold for 45% HP.',
        {
          classified:
            'Enemy Stage 4 counter-raids strike your hamlets — keep a home guard while hunters are north.',
          classifiedRule: 'era:rts',
        }
      ),
      entry(
        'campaign',
        'Multi-Front Siege Warfare',
        'From wave 12 with 2+ active factions, coordinated multi-front sieges. Doctrines: Siege Line (north walls), Economy Raid (south hamlets/guilds), Wide Flank (east/west), Opportunist. Coordinated waves split fronts; competing waves may stack factions on one flank.',
        {
          classified:
            'INTEL HUD shows the plan; Threat Map cards show per-faction front assignment.',
          classifiedRule: 'era:multifront',
        }
      ),
      entry(
        'campaign',
        'Planet Conquest (Wave 500+)',
        'Endgame sector warfare — active from wave 500 in Campaign or Planet Conquest mode. Map splits into horizontal sectors per realm (CONQUEST HUD + north overlay). Raise sector % by razing holds and hunting armies; sectors creep back if ignored. Below 12% control with no live units/buildings = ELIMINATED. After two eliminations, Worldheart Tyrant awakens — ward needs 3+ different unit types; summons fallen-faction remnants at 75/50/25% HP.',
        {
          classified:
            'True victory: shatter the Worldheart Tyrant after two+ realms fall. Economy purge alone no longer ends the campaign at wave 500+.',
          classifiedRule: 'wave:500',
        }
      ),
      entry(
        'campaign',
        'Worldheart Tyrant',
        'Scaled boss_malachar amalgam — awakens when two realms are eliminated during Planet Conquest. Damage ward until three or more different player unit types are on the field. Phase summons pull elites from fallen factions.',
        {
          classified:
            'Mix footmen, ranged, and specialists before the fight — mono-army comps stall the ward.',
          classifiedRule: 'wave:500',
        }
      ),
      entry(
        'campaign',
        'Asymmetric Warfare',
        'YOU: Kingdom Commander (macro builds + micro orders). HOST: Evolving Threat (auto-spawns, faction kingdoms, Threat Lv 1–25+). COMMAND vs HOST HUDs compare authority. High Commander Authority = longer nights, faster builders, bonus TP. High Host Threat = more spawns, multi-flank bias, elite injections.',
        {
          classified: 'Raze northern holds to push host threat level down.',
          classifiedRule: 'wave:15',
        }
      ),
      entry(
        'campaign',
        'Player Counter-Evolution (Wave 15+)',
        'COUNTER-OFFENSIVE doctrines (left panel) debuff weakest active faction — reduced stage, fewer spawns, skipped northern builds. One per wave. Night EXPEDITIONS (wave 25+) send 1–4 hunters off-map for heavier debuffs. Probing Raid (15) → Border Sortie (35) → Northern Campaign (60) → Dominion Offensive (120).',
        {
          classified: 'Weakened factions show in HOST HUD tooltip and Threat Map cards.',
          classifiedRule: 'wave:15',
        }
      ),
      entry(
        'campaign',
        'Faction Reputation & Hostility',
        'From wave 6 each realm tracks aggression: Cordial → Wary → Hostile → Vengeful → Blood Feud. High hostility accelerates evolution and counter-raids. Courier Truce eases tension. Quiet waves ease hostility −2.',
        {
          classified:
            'Threat Map shows hostility per realm. Blood Feud realms inject extra sub-bosses.',
          classifiedRule: 'wave:6',
        }
      ),
      entry(
        'campaign',
        'Living Planet (Map Biomes)',
        'Biomes unlock with Land tiers: Plains (+5% march), Forest Reaches (+14% cover, −12% speed), Mountain Frontier (−22% damage taken, −26% speed), Corrupted Border (+10% damage taken after wave 200). Wave 1001+ bleeds Hellscape north.',
        {
          classified: 'REALM HUD lists active biomes; minimap tints regions.',
          classifiedRule: 'wave:20',
        }
      ),
      entry(
        'campaign',
        'Faction Environmental Hazards',
        'Land II+: Goblin Plague Zones, Orc Fire Pits, Void Corruption — scale with faction stage and wave. Route around or accept losses.',
        {
          classified: 'INTEL HUD lists active zones when no spy report is showing.',
          classifiedRule: 'wave:18',
        }
      ),
      entry(
        'campaign',
        'Neutral Wildlife & Environmental Events',
        'Wave 8+: neutral beasts (amber minimap rings) attack nearest army — TP and morale on kill. Beast Migration, Predator Circle, Ancient Grove, Carrion Feed events.',
        { classified: 'Lure beasts into enemy lines during quiet waves.', classifiedRule: 'wave:8' }
      ),
      entry(
        'campaign',
        'Dynamic Map Events — Planet Fights Back',
        'Wave 12+: volcanic eruptions, awakening ruins, geothermal surges, mana storms, titan quakes. Night PLANET EVENT panel — harness, evacuate, or hold. Ignoring is free but punishing.',
        {
          classified: 'PLANET HUD and INTEL show active threat during the event window.',
          classifiedRule: 'wave:12',
        }
      ),
      entry(
        'campaign',
        'Crown Legacies (Multi-Run)',
        'Main menu — up to 3 permanent perks per run. Milestones: win (+4 TP), 3 honors, wave 50/100, kills, builders, etc. HONOR HEIRS: up to 2 named veterans spawn at dawn with title, +1 bronze, +5% HP, +4 morale.',
        {
          classified:
            'Creative Mode ignores legacies. See Legacy tab for your roll of honored veterans.',
          classifiedRule: 'runs:2',
        }
      ),
      entry(
        'campaign',
        'Kingdom Evolution Meter',
        'Banner beside Kingdom label fills from colony value 35%, buildings 25%, veterans 25%, research 15%. Pennant → Crest → Empire Banner → Hell-Forged Banner.',
        {
          classified: 'Doctrines unlock by evolution stage, not meter percentage.',
          classifiedRule: 'era:kingdom_rising',
        }
      ),
      entry(
        'campaign',
        'Campaign Chronicle Beats',
        'Chronicle messages at wave 10 (named warlords), 31 (Kingdom Rising), 100 (Empire Ascendant), 200 (Planetary Dominion), 500 (Planet Conquest). First named boss kill earns a special entry.',
        {
          classified:
            'Chronicles tab stores wave reports, choice logs, and branch narratives. Story Arc tab tracks Iron Crown, Silver Diplomat, Arcane Scholar, and Pragmatist paths from planet event and doctrine choices.',
          classifiedRule: 'wave:10',
        }
      ),
      entry(
        'campaign',
        'Branching Narratives',
        'Planet event responses and kingdom doctrines shift your story branch mid-run. Waves 31, 100, 200, and 500 play alternate chronicle beats per path. The hint bar shows your active thread.',
        { classifiedRule: 'wave:31' }
      ),
    ];
  }

  function getExpandedEntries() {
    return [
      ...buildAllyEntries(),
      ...buildFactionOverviewEntries(),
      ...buildEnemyEntries(),
      ...buildBuildingEntries(),
      ...buildOrderEntries(),
      ...buildStarEntries(),
      ...buildEraEntries(),
      ...buildBestiaryEntries(),
      ...buildCampaignEntries(),
      ...buildCampaignSystemEntries(),
      ...buildHonorEntries(),
    ];
  }

  return {
    checkUnlock,
    getUnlockHint,
    getExpandedEntries,
    buildBestiaryEntries,
    buildCampaignEntries,
    buildHonorEntries,
    ERA_BEATS,
    CAMPAIGN_NARRATIVE,
  };
})();
