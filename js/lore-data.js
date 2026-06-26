/**
 * Myth and Blood — lore database, classified gates, bestiary, campaign beats.
 */
const LoreData = (() => {
  function achCount() {
    return typeof Achievements !== 'undefined' ? (Achievements.getCount?.()?.unlocked || 0) : 0;
  }

  function maxWave() {
    return typeof Legacy !== 'undefined' ? (Legacy.get?.()?.maxWaveEver || 0) : 0;
  }

  function wavesCleared() {
    return typeof Legacy !== 'undefined' ? (Legacy.get?.()?.totalWavesCleared || 0) : 0;
  }

  function honorCount() {
    return typeof Legacy !== 'undefined' ? (Legacy.get?.()?.honorCount || 0) : 0;
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
        const runs = typeof Legacy !== 'undefined' ? (Legacy.get?.()?.totalRuns || 0) : 0;
        return runs >= parseInt(val, 10);
      }
      case 'kill': {
        const [etype, n] = val.split(',');
        return enemyKills(etype) >= parseInt(n, 10);
      }
      case 'era': {
        const w = maxWave();
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
      era: {
        academy: 'Survive to Academy Era (wave 100)',
        rts: 'Survive to RTS Era (wave 100+)',
        enemy_rts: 'Survive to Enemy RTS (wave 200)',
        hellscape: 'Survive to Hellscape (wave 1000+)',
        multifront: 'Survive to multi-front war (wave 25+)',
      }[val] || `Unlock era: ${val}`,
      meta_wwe: 'Unlock the WWE Academy',
      meta_doom: 'Unlock the Doomslayer',
      meta_crossover: 'Unlock any crossover faction',
      faction: `Recruit ${val} crossover operatives`,
    };
    return hints[kind] || `Progress required: ${rule}`;
  }

  function entry(cat, name, body, extras = {}) {
    return { cat, name, body, ...extras };
  }

  const ALLY_LORE = {
    footman: {
      flavor: 'The backbone of every crown army — farmers\' sons who learned spear and shield before they learned fear.',
      mechanics: 'Cheap melee line-holder. Garrisons walls when a General commands the Keep. Bronze stars from kills; 3 gold may earn an honor name.',
      classified: 'Footmen promoted to General retain their honor name; stars reset and only improve command aura — the Crown never forgets who held the wall.',
      rule: 'honor:1',
    },
    archer: {
      flavor: 'Longbowmen from the eastern marches, trained to loose volleys while stone still holds.',
      mechanics: 'Long-range DPS. Garrison outposts for extended range. Fragile — keep behind cover.',
      classified: 'Outpost garrison grants +55 range — archers behind walls can outshoot orc archers two fields away.',
      rule: 'wave:10',
    },
    mage: {
      flavor: 'Court arcanists who traded tower solitude for the scream of battle.',
      mechanics: 'Arcane bolts with splash damage. Strong vs clustered foes.',
      classified: 'Splash radius punishes goblin swarms and plague rat floods — pair with fireball for overlapping kill zones.',
      rule: 'kill:goblin,50',
    },
    cavalry: {
      flavor: 'Knights-errant on warhorses bred for the southern downs.',
      mechanics: 'Fast melee with charge bonus. Excellent for hunting stragglers.',
      classified: 'Charge timer builds while pathing unengaged — first strike can delete warg riders before they kite.',
      rule: 'wave:15',
    },
    healer: {
      flavor: 'Sisters and brothers of the field hospital — mercy with a mortar and pestle.',
      mechanics: 'Heals allies in range. Ranks when healing (once per wave). Med tents handle wounded below 38% HP.',
      classified: 'Academy Era: healer academy trains one free healer every 5 waves — plan specialist ranks around siege cycles.',
      rule: 'era:academy',
    },
    knight: {
      flavor: 'Plate-clad champions sworn to the banner — walking bastions.',
      mechanics: 'Heavy armored melee with damage resistance. Banner courier can summon one.',
      classified: '22% flat mitigation stacks with cover and General aura — knights anchor wall slots against dark knights.',
      rule: 'wave:25',
    },
    sapper: {
      flavor: 'Demolition experts who see every wall as a puzzle to solve — friend or foe.',
      mechanics: 'Demolishes walls and siege engines with bonus siege damage (×2.5).',
      classified: 'Priority target siege towers and enemy hamlets in RTS era — sappers end structures faster than any strike.',
      rule: 'era:rts',
    },
    general: {
      flavor: 'One commander to hold the line — aura, garrison, and the weight of every soldier\'s eyes.',
      mechanics: 'Global enemy priority. Station in Keep for command aura and wall garrison. Stars after promotion buff aura only.',
      classified: 'Auto-rallies demoralized troops wall-to-wall; while rallying he hits harder and shrugs blows. Tombstone perk resurrects fallen equal to total star count each night.',
      rule: 'wave:50',
    },
    builder: {
      flavor: 'Masons and carpenters who build kingdoms between waves.',
      mechanics: 'Erects structures (2 projects max). ×5 required for Hamlets and Guilds. Ranks when building.',
      classified: 'Night phase: +35% build speed. After wave 100, settlements define victory — protect builders like royalty.',
      rule: 'era:academy',
    },
    courier: {
      flavor: 'Swift riders carrying decrees that move armies more than spears.',
      mechanics: 'One royal message per wave. Ranks when dispatching.',
      classified: 'Tax levy grants +6 TP next round; call banner spawns an immediate knight — economy and tempo in one slot.',
      rule: 'waves_cleared:10',
    },
    scout: {
      flavor: 'Pathfinders who read dust and silence before the horde arrives.',
      mechanics: 'Fast skirmisher with stealth detection. Pair with watchtowers.',
      classified: 'Reveals burrowers and stealth — mandatory when goblin burrowers appear (wave 9+).',
      rule: 'kill:goblin_burrower,10',
    },
    bard: {
      flavor: 'Minstrels whose songs stitch broken morale back together.',
      mechanics: 'Morale aura support. Weak in direct combat.',
      classified: 'Royal Court loadout (wave 100+) boosts bard and courier morale caps — songs stack with mess hall auras.',
      rule: 'era:academy',
    },
    ballista: {
      flavor: 'Timber engines that throw bolts the size of a man\'s femur.',
      mechanics: 'Long-range siege. Bonus vs flying foes and siege targets. Anti-air.',
      classified: 'Sky drakes and harpies die to focused ballista fire — place behind walls with watchtower intel.',
      rule: 'kill:harpy,15',
    },
    pikeman: {
      flavor: 'Halberd blocks that turn cavalry charges into slaughter.',
      mechanics: 'Anti-cavalry and anti-air melee. Cheap line holder.',
      classified: 'Hard counter to warg riders and harpies — low cost answer before academy ballistas come online.',
      rule: 'kill:warg_rider,20',
    },
  };

  const ENEMY_LORE = {
    goblin: { flavor: 'Small, cruel, infinite.', threat: 'Swarm', weak: 'AoE, splash', counter: 'Mage, Fireball, clustered archers' },
    orc: { flavor: 'The horde\'s iron spine.', threat: 'Bruiser', weak: 'Focus fire', counter: 'Knights, focused archers' },
    orc_archer: { flavor: 'Back-line pressure while shields advance.', threat: 'Ranged', weak: 'Cavalry rush, outposts', counter: 'Cavalry, outpost archers' },
    dark_knight: { flavor: 'Purple-glow elites — warlords in stolen plate.', threat: 'Elite', weak: 'Sustained DPS', counter: 'Knights, veterans, lightning' },
    warg_rider: { flavor: 'Fast harassment from the steppe clans.', threat: 'Cavalry', weak: 'Pikes, traps', counter: 'Pikemen, spike traps' },
    dark_mage: { flavor: 'Corrupted court mages lobbing hate from afar.', threat: 'Caster', weak: 'Assassins, rush', counter: 'Scouts, cavalry, spy assassinate' },
    troll: { flavor: 'Regenerating bruisers that eat walls.', threat: 'Siege', weak: 'Burst, fire', counter: 'Sappers, fireball, focus fire' },
    goblin_sapper: { flavor: 'They love your walls more than you do — briefly.', threat: 'Structure', weak: 'Intercept', counter: 'Hunt mode, melee intercept' },
    necromancer: { flavor: 'Death priests who refill the horde from corpses.', threat: 'Elite caster', weak: 'Hamon, burst', counter: 'JoJo operatives, focus fire' },
    berserker: { flavor: 'No armor, no fear, no tomorrow.', threat: 'Elite melee', weak: 'Kite, walls', counter: 'Archers, outposts, fortify' },
    assassin: { flavor: 'They smell the General\'s banner.', threat: 'Elite striker', weak: 'Bodyguards', counter: 'Keep garrison, knights on General' },
    shaman: { flavor: 'Enemy healers chanting over the fallen.', threat: 'Support', weak: 'Focus, burst', counter: 'Assassinate spy, priority kills' },
    siege_tower: { flavor: 'Rolling castles that link to your walls and burn.', threat: 'Siege boss', weak: 'Sappers, sabotage', counter: 'Sappers, sabotage spy, ballistas' },
    goblin_engineer: { flavor: 'Mirror-builders for the enemy RTS.', threat: 'Economy', weak: 'Hunt', counter: 'Hunt ON, early kills before hamlets complete' },
    war_chief: { flavor: 'Boss-tier warlord — the wave ends when he falls.', threat: 'Boss', weak: 'Focus, elites', counter: 'All strikes, crossover burst, wall focus' },
    harpy: { flavor: 'Winged scavengers that dive the unprepared.', threat: 'Flyer', weak: 'Anti-air', counter: 'Pikemen, ballistas, WWE aerial finishers' },
    goblin_burrower: { flavor: 'Dirt-mouth goblins that surface behind your line.', threat: 'Ambush', weak: 'Reveal', counter: 'Scouts, watchtowers, scout flare, tunnel spy' },
    bone_summoner: { flavor: 'Raises goblins from every corpse you leave.', threat: 'Summoner', weak: 'Burst', counter: 'Priority kill, JoJo hamon bonus vs undead' },
    sky_drake: { flavor: 'Young dragons — fire from above, arrogance included.', threat: 'Elite flyer', weak: 'Anti-air', counter: 'Ballistas, Halo/DB crossover, frost nova' },
    plague_rat: { flavor: 'A squealing tide of teeth and fever.', threat: 'Swarm', weak: 'AoE', counter: 'Mage splash, fireball, meteor' },
    abomination: { flavor: 'A walking tumor of eyes and hunger — it heals while you hesitate.', threat: 'Elite horror', weak: 'Burst, fire', counter: 'Focus fire, fireball, do not let it regenerate' },
    behemoth: { flavor: 'The ground trembles before you see it. Walls mean nothing.', threat: 'Colossus', weak: 'Kite, fortify', counter: 'Sappers, fortify zones, ballistas, all strikes' },
    iron_colossus: { flavor: 'Riveted hatred on two legs — a siege tower that walks.', threat: 'Siege titan', weak: 'Sappers, sabotage', counter: 'Sappers, sabotage spy, meteor, sustained siege focus' },
    void_stalker: { flavor: 'A shadow taller than a man, eyes like coals, claws like scythes.', threat: 'General hunter', weak: 'Bodyguards', counter: 'Keep garrison, knights on General, kill before it reaches him' },
    elder_wyrm: { flavor: 'Older than the sky drakes. Hungrier. The horizon burns when it arrives.', threat: 'Dragon boss', weak: 'Anti-air', counter: 'Ballistas, frost nova, crossover anti-air, focus fire' },
    boss_gorath: { flavor: 'The first named warlord most commanders learn to fear.', threat: 'Named boss', weak: 'Focus fire', counter: 'All strikes, wall focus, kill before enrage' },
    boss_morwen: { flavor: 'Pale queen who raises the dead faster than you bury them.', threat: 'Named summoner', weak: 'Burst', counter: 'Priority kill, JoJo hamon vs undead' },
    boss_thokk: { flavor: 'A walking landslide with opinions about your gates.', threat: 'Named colossus', weak: 'Fortify, kite', counter: 'Sappers, fortify zones, sustained siege DPS' },
    boss_grimm: { flavor: 'Oath-bound knight wreathed in cinder.', threat: 'Named duelist', weak: 'Range', counter: 'Archers, outposts, frost nova' },
    boss_vexis: { flavor: 'Hollow shadow that smells your General\'s fear.', threat: 'Named assassin', weak: 'Bodyguards', counter: 'Keep garrison, knights on General' },
    boss_karg: { flavor: 'Foundry on legs — hamlets are his favorite snack.', threat: 'Named siege', weak: 'Sappers', counter: 'Sappers, sabotage, meteor' },
    boss_sylvara: { flavor: 'Mother of drakes; the sky is her nursery.', threat: 'Named dragon', weak: 'Anti-air', counter: 'Ballistas, pikemen, crossover flyers' },
    boss_rotfather: { flavor: 'Patriarch of pus — wounds fester in his presence.', threat: 'Named horror', weak: 'Burst', counter: 'Focus fire before regen stacks' },
    boss_volk: { flavor: 'Marshal who makes siege towers look quaint.', threat: 'Named siege lord', weak: 'Sustained DPS', counter: 'Sappers, wall repair, all strikes' },
    boss_malachar: { flavor: 'Wave one hundred wears his name like a verdict.', threat: 'Ultimate boss', weak: 'Everything you saved', counter: 'Full army, all strikes, crossover burst, do not hold TP back' },
  };

  const BESTIARY_EXTRA = {
    necromancer: { classified: 'JoJo hamon deals +55% damage — classified field test confirms undead resist conventional steel.', rule: 'faction:jojo' },
    harpy: { classified: 'WWE aerial finishers and Baki/FotNS melee struggle without anti-air — crossover dossier 7-B.', rule: 'meta_crossover' },
    sky_drake: { classified: 'UNSC and Capsule Corp operatives register elevated anti-air efficacy vs drakes.', rule: 'faction:halo' },
    war_chief: { classified: 'Ultimis rush tactics punished — War Chiefs absorb Element 115 alpha strikes and counter-push.', rule: 'faction:ultimis' },
    behemoth: { classified: 'Field reports describe Behemoths shrugging off fireball barrages below wave 100 — bring siege crews.', rule: 'wave:25' },
    elder_wyrm: { classified: 'UNSC ballistas and Capsule Corp beam weapons register highest efficacy vs Elder Wyrms.', rule: 'wave:50' },
    void_stalker: { classified: 'Void Stalkers bypass wall garrisons — General must not roam alone after wave 32.', rule: 'wave:32' },
    shaman: { classified: 'Martial arts crossover burst partially negated by enemy heal-over-time — assassinate or focus.', rule: 'kill:shaman,25' },
  };

  const ERA_BEATS = [
    { wave: 1, name: 'The First Dawn', hook: 'Scouts report movement in the northern treeline. The Crown gives you spears, walls, and little else. Hold.', rule: 'runs:1' },
    { wave: 5, name: 'First Horde', hook: 'Wave five is never a duel — it is a flood. Goblins and rats pour in faster than you have seen. Thin them before they thicken.', rule: 'wave:5' },
    { wave: 10, name: 'Expanding Horizon', hook: 'Every ten waves the map widens — more room to build, more ground to lose. And on each tenth wave, a named warlord leads the host personally.', rule: 'wave:10' },
    { wave: 25, name: 'Second Front', hook: 'Horns from the east. The war is no longer a line — it is a box. Flank markers appear on your war table.', rule: 'era:multifront' },
    { wave: 50, name: 'Four Winds', hook: 'North, east, west — soon south. Commanders who survived this far speak of sleepless nights and courier horses ridden to death.', rule: 'wave:50' },
    { wave: 100, name: 'Academy Proclamation', hook: 'Advanced academies open their gates. The war becomes an economy — hamlets, guilds, and trained specialists decide who survives.', rule: 'era:academy' },
    { wave: 100, name: 'RTS Threshold', hook: 'Enemy counts swell ~35%. Hamlets and guilds are no longer luxury — they are oxygen.', rule: 'era:rts' },
    { wave: 200, name: 'Mirror War', hook: 'The map widens again. Goblin engineers raise hamlets in the north. Every guild you build, they learn to copy.', rule: 'era:enemy_rts' },
    { wave: 316, name: 'The 316 Club', hook: 'Achievements line the road to the squared circle. Veterans whisper of a WWE Academy beyond mortal milestones.', rule: 'achievements:316' },
    { wave: 1000, name: 'Hellscape Breach', hook: 'Reality thins. Even legends falter. The Doomslayer\'s blade returns to mortal scale — the true endgame begins.', rule: 'era:hellscape' },
  ];

  const HONOR_LORE = [
    { name: 'Crown Naming Tradition', body: 'At three gold stars, the Crown grants a prefix (Syr, Dame, Magister…) and a name from the royal ledger — hashed from the soldier\'s service ID so no two stories repeat.', rule: 'honor:1' },
    { name: 'Veteran Upgrade', body: 'Honor coincides with a veteran stat surge — HP, damage, speed, and morale climb. Generals keep the name; stars reset for aura growth only.', rule: 'honor:1' },
    { name: 'Prefix by Role', body: 'Footmen become Syr or Captain; mages Magister; healers Sister or Brother; builders Craftlord. Crossover operatives may earn honors if they serve long enough in your roster.', rule: 'honor:3' },
    { name: 'Tombstone Resurrection', body: 'A General with Tombstone perk resurrects fallen troops each night equal to total bronze-star count — honored veterans return first in the scribes\' accounts.', rule: 'wave:75' },
    { name: 'Wall Garrison Honors', body: 'Honored footmen garrisoned under a General become immovable — enemy assassins prioritize the General, but honored names on the wall break assault math.', rule: 'wave:40' },
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
      return entry('bestiary', def?.name || id,
        `Threat level: ${lore.threat}. Primary weakness: ${lore.weak}. Recommended counters: ${lore.counter}.`,
        {
          bestiaryWeak: lore.weak,
          bestiaryCounter: lore.counter,
          bestiaryThreat: lore.threat,
          classified: extra?.classified,
          classifiedRule: extra?.rule,
        });
    });
  }

  function buildBuildingEntries() {
    const notes = {
      outpost: ['Forward cover +1 garrison slot. Extends archer range +55.', 'wave:5'],
      wall: ['Blocks movement. 2 footman slots per wall under General command. Siege priority.', 'wave:3'],
      castle: ['Compound: 4 walls, 4 outposts, Keep, med tent, mess hall. Command center.', 'wave:15'],
      medical_tent: ['Wounded below 38% HP retreat here instead of fighting to death.', 'wave:8'],
      mess_hall: ['Morale aura for nearby troops — stack with bards and rallies.', 'wave:12'],
      watchtower: ['Vision reveals stealth/burrowers. Enemies in range suffer accuracy penalties.', 'kill:goblin_burrower,5'],
      spike_trap: ['Hidden spikes — first crossing enemy takes heavy damage per cooldown.', 'wave:20'],
      quarry: ['30 TP, 2 Builders. +1 TP/round (shared 6-site cap with trade posts). Blocks movement.', 'waves_cleared:15'],
      trade_outpost: ['38 TP, 2 Builders. +1 TP/round + morale aura. Shared 6-site cap — hamlets win late.', 'waves_cleared:20'],
      fortress_upgrade: ['Fortify completed hamlet: +HP, cover, +1 TP/round.', 'era:rts'],
      hamlet: ['100 TP, 5 Builders, 5-wave build. +5 TP/round. Huge & siegeable — safest after wave 100.', 'era:academy'],
      merchant_guild: ['150 TP, 5 Builders. +1 TP/round per guild in hamlet aura. Enemy RTS priority target.', 'era:rts'],
      enemy_hamlet: ['After wave 200 enemies raise hamlets — each completed adds +1 spawn.', 'era:enemy_rts'],
      enemy_merchant_guild: ['Enemy mirror of your guild — destroy to slow their economy war.', 'era:enemy_rts'],
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
          body = 'Secret squared-circle campus. Unlocks WWE superstar recruitment.';
          classified = 'Build: 1000 TP, 10 Builders (2+ hamlets & 1+ guild recommended). Unlocks at 316 Club achievement milestone.';
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
        const effect = def.healAmount ? `heals ${def.healAmount} in radius ${def.radius}`
          : def.units ? `spawns ${def.units.length} troops`
          : `damage ${def.damage} radius ${def.radius}`;
        entries.push(entry('orders', def.name,
          `${effect}. Cost ${def.cost} TP.`,
          {
            classified: def.upgradeTier ? 'Academy Era cost reductions may apply after wave 100.' : 'Strike cooldown shared with tactical economy — spend wisely during siege waves.',
            classifiedRule: def.upgradeTier ? 'era:academy' : 'waves_cleared:5',
          }));
      }
    }
    if (typeof SpyActions !== 'undefined') {
      for (const [id, def] of Object.entries(SpyActions)) {
        entries.push(entry('orders', def.name, `${def.desc}. Cost ${def.cost} TP. One spy action per wave.`, {
          classified: 'Sleight of Hand perk reduces spy/courier costs by 1 TP.',
          classifiedRule: 'achievements:50',
        }));
      }
    }
    if (typeof CourierMessages !== 'undefined') {
      for (const [id, def] of Object.entries(CourierMessages)) {
        entries.push(entry('orders', def.name, `${def.desc}. Cost ${def.cost} TP. One message per wave.`, {
          classified: 'Couriers rank each dispatch — faster cooldowns and morale on veteran envoys.',
          classifiedRule: 'waves_cleared:8',
        }));
      }
    }
    entries.push(
      entry('orders', 'Morale & Routing',
        'Troops witness fallen allies and lose morale. Routing causes desertion before wave 100; after, demoralized troops idle until rallied. General auto-paths for pep talks.',
        { classified: 'Battle Rally snaps routing instantly — keep 4 TP in reserve during multi-front waves.', classifiedRule: 'era:multifront' }),
      entry('orders', 'Wave Events',
        'Blood Moon (÷13): flying predators. Supply Caravan (÷17): +5 TP. Siege Push (÷23): extra towers.',
        { classified: 'Royal Herald courier previews next event — plan academies and strikes around caravan waves.', classifiedRule: 'wave:30' }),
      entry('orders', 'Loadouts (Wave 100+)',
        'Shield Wall, Arrow Storm, Siege Crew, Royal Court — passive bonuses to academy-trained troops.',
        { classified: 'Loadouts apply at train time — switch before academy production spikes.', classifiedRule: 'era:academy' }),
    );
    return entries;
  }

  function buildStarEntries() {
    return [
      entry('stars', 'Bronze Stars', 'Combat troops earn bronze from kills. 3 bronze → 1 silver → 1 gold → veteran upgrade.',
        { classified: 'Vulture Aid: kills may grant +1 TP — bronze farmers become economy engines.', classifiedRule: 'achievements:25' }),
      entry('stars', 'Specialist Ranks', 'Healers, Builders, Couriers earn one star step per wave when they work.',
        { classified: 'Specialist rank titles: Acolyte → Saint of the Realm (healers), Apprentice → Imperial Engineer (builders).', classifiedRule: 'waves_cleared:12' }),
      entry('stars', 'Gold & Honor Names', 'At 3 gold stars, the Crown grants a name plus veteran upgrade.',
        { classified: 'Honor names persist through promotions — a footman named Syr Gwyn promoted to General keeps Syr Gwyn on the banner.', classifiedRule: 'honor:1' }),
      entry('stars', 'General Promotion', '3-gold-star Footman promoted via General Academy — stats kept, stars reset for aura.',
        { classified: 'Each general star adds ~4.5% command aura — endgame armies scale off one honored leader.', classifiedRule: 'wave:60' }),
      entry('stars', 'Crossover & WWE Stars', 'Crossover operatives and WWE superstars earn perks at night based on stars (max 4 perks).',
        { classified: 'Perk-a-Cola machines require secret roster unlock — Jugger-Nog, Tombstone (General only), Double Tap, and more.', classifiedRule: 'meta_crossover' }),
    ];
  }

  function buildEraEntries() {
    return [
      entry('eras', 'Tactical Points', 'TP per cleared wave (+8 base, scaling). Uncapped storage. Settlements add bonus TP/round.',
        { classified: 'Soft cap warning at 18 settlement TP — diminishing returns encourage spreading hamlets.', classifiedRule: 'era:academy' }),
      entry('eras', 'Territory (Every 10 Waves)', 'Map expands +90 wide, +110 deep.',
        { classified: 'Territory tier drives pathfinding load — use night phase to reposition before expansion.', classifiedRule: 'wave:10' }),
      entry('eras', 'Multi-Front (Every 25 Waves)', 'New attack flank until all four sides assault.',
        { classified: 'Flank order: North → East (25) → West (50) → South (75). Spy scout reveals flank roster.', classifiedRule: 'era:multifront' }),
      entry('eras', 'Academy Era (Wave 100)', 'Escalation milestone — enemy pressure and settlement raids intensify. Academies, hamlets, and TP deploy are available from wave 1.',
        { classified: 'TP deploy stays available — academies add free training each round on top of manual deployment.', classifiedRule: 'era:academy' }),
      entry('eras', 'RTS Era (Wave 100+)', 'Enemy counts swell ~35%. Protect economy buildings.',
        { classified: 'Fortress upgrades on hamlets add +1 TP and cover — anchor settlement defense.', classifiedRule: 'era:rts' }),
      entry('eras', 'Enemy RTS (Wave 200)', 'Enemies build hamlets and guilds mirroring your bonuses.',
        { classified: 'Each enemy completed settlement adds +1 spawn — hunt engineers before structures finish.', classifiedRule: 'era:enemy_rts' }),
      entry('eras', 'Day & Night Cycle', 'Day: assaults. Night: prep, +35% builder speed, perk collection.',
        { classified: 'Bray Wyatt lantern punishes enemy accuracy at dusk — schedule elite waves around light level.', classifiedRule: 'meta_wwe' }),
      entry('eras', 'Hellscape (Wave 1001+)', 'Reality thins — legendary damage falls to mortal scale.',
        { classified: 'Doomslayer one-shots end here. Only sustained crossover synergies and settlement economy survive.', classifiedRule: 'era:hellscape' }),
    ];
  }

  function buildCampaignEntries() {
    return ERA_BEATS.map(b => entry('campaign', b.name, b.hook, {
      classified: `Strategic note — milestone wave ${b.wave}. Chronicles record commanders who pass this threshold.`,
      classifiedRule: b.rule,
      campaignWave: b.wave,
    }));
  }

  function buildHonorEntries() {
    return HONOR_LORE.map(h => entry('honor', h.name, h.body, {
      classified: 'Your legacy tracks every honor granted — see Legacy tab for the roll of named veterans.',
      classifiedRule: h.rule,
    }));
  }

  function getExpandedEntries() {
    return [
      ...buildAllyEntries(),
      ...buildEnemyEntries(),
      ...buildBuildingEntries(),
      ...buildOrderEntries(),
      ...buildStarEntries(),
      ...buildEraEntries(),
      ...buildBestiaryEntries(),
      ...buildCampaignEntries(),
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
  };
})();