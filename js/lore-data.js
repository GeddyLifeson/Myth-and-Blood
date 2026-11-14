/**
 * Myth and Blood — the words of the siege.
 *
 * One voice: grim, spare, close to the mud. Short sentences. No numbers and no system
 * names inside a story line; the rules live in the encyclopedia and the README.
 *
 * Everything here is keyed by unit, enemy or wave id and never by a display name, so a
 * rename in data/*.json cannot leave a stale name behind. Names are read from the
 * definitions when a line is shown.
 *
 * The siege has no end and no win. Beats mark how long the line has stood.
 */
const LoreData = (() => {
  function entry(cat, name, body, extras = {}) {
    return { cat, name, body, ...extras };
  }

  /** One line for each of your troops. Shown above the rules in "Your army". */
  const TROOP_LINES = {
    footman: "Farmers' sons who learned the shield before they learned to be afraid.",
    archer: 'They count arrows the way other men count days.',
    crossbowman: 'The windlass is slow; the quarrel does not care about plate.',
    mage: 'They left the tower for this. None of them say why.',
    cavalry: 'What runs, they ride down. What stands, they go around.',
    healer: 'Mercy with a bone saw and a steady hand.',
    builder: 'They raise by night what the day tears down.',
    courier: 'Fast, unarmed, and carrying words that move more men than spears do.',
    scout: 'They read dust and silence, and come back to say how many.',
    bard: 'A song is thin armour. It is still armour.',
    ballista: "Timber and sinew. It throws a bolt the length of a man's leg.",
    pikeman: 'A hedge of points. Horses know better than their riders.',
    sapper: 'All night on his knees in the mud. All day counting fuses.',
    knight: 'Plate, oath and a long sword. He costs what a village costs.',
    general: 'One man for the whole line to look at. The enemy looks at him too.',
  };

  /** One line for each thing that comes out of the north. */
  const ENEMY_LINES = {
    goblin: 'Small, cruel, without number.',
    orc: "The host's iron spine.",
    orc_archer: 'They loose from behind the shields and step back when you come.',
    dark_knight: 'A dead lord in stolen plate, on a horse that does not breathe.',
    warg_rider: 'It comes low and fast and goes for the soft ones first.',
    dark_mage: 'Court mages once. What they throw now makes strong arms weak.',
    troll: 'It heals while it walks, and it walks toward your walls.',
    goblin_sapper: 'They love your walls more than you do. Briefly.',
    necromancer: 'It stands well back and refills the host from your dead.',
    berserker: 'No armour, no fear, no tomorrow.',
    assassin: "It smells the General's banner.",
    shaman: 'It chants over the wounded, and they get up.',
    siege_tower: 'A rolling keep. It does not stop for arrows.',
    goblin_engineer: 'It builds cover for the host a plank at a time.',
    war_chief: 'Where he stands, they fight harder. Where he falls, they remember fear.',
    harpy: 'Wings like wet leather. It drops on whoever is not looking up.',
    goblin_burrower: 'The ground behind you moves.',
    bone_summoner: 'It calls, and the bones on the field answer.',
    sky_drake: 'Young, and already it burns what it looks at.',
    orc_shieldbearer: 'A door torn from a burned keep, carried by something that hates you.',
    goblin_firebrand: 'It giggles while it lights the fuse.',
    wailing_wraith: 'The sound gets into the ranks before the thing itself does.',
    plague_rat: 'A squealing tide of teeth and fever.',
    hellbound_legionnaire: 'It fires in ranks, without hurry, like something drilled in the pit.',
    nightmare_strider: 'Long legs, no eyes. It runs at whatever is weakest.',
    dreadborn_champion: 'It carries a banner of skin. The host gathers under it.',
    warp_prophet: 'It speaks, and good steel grows heavy in the hand.',
    grim_revenant: 'It remembers how to aim. It remembers nothing else.',
    umbral_stalker: 'You see it when it is already behind you.',
    cinderbound_juggernaut: 'Slow as a furnace door. To strike it is to be burned.',
    hellmortar_pack: 'Three of them carry the tube. The fourth feeds it.',
    abomination: 'Sewn from the dead and still growing. Do not be near it when it bursts.',
    behemoth: 'The ground shakes before you see it. Walls mean nothing.',
    iron_colossus: 'Riveted hatred on two legs. A siege tower that walks.',
    void_stalker: 'Taller than a man, eyes like coals. It wants one life on the field.',
    elder_wyrm: 'Older than the drakes, and hungrier. The horizon burns when it comes.',
  };

  /**
   * What is said when a warlord takes the field and when he falls. Keyed by enemy id;
   * the name is read from the enemy definitions when the line is shown.
   */
  const BOSS_LINES = {
    boss_gorath: {
      arrive: 'His axe opens the way for a thousand boots.',
      fall: 'The axe lies in the mud. Nobody on either side will touch it.',
    },
    boss_morwen: {
      arrive: 'She counts your dead as hers.',
      fall: 'She falls without a sound. The things she raised fall with her.',
    },
    boss_thokk: {
      arrive: 'Walls crumble when he exhales.',
      fall: 'He goes down like a hillside. The field is a different shape after.',
    },
    boss_grimm: {
      arrive: 'Steel and flame. Nothing else of him remains.',
      fall: 'The fire goes out. There was no man inside the armour.',
    },
    boss_vexis: {
      arrive: "Your General's heartbeat is its compass.",
      fall: 'It comes apart like smoke. The General does not sleep that night.',
    },
    boss_karg: {
      arrive: 'A foundry on legs. It is coming for what you built.',
      fall: 'It stops mid-stride and stands there, cooling.',
    },
    boss_sylvara: {
      arrive: 'The horizon is her throat.',
      fall: 'She falls burning. Her brood circles once and is gone.',
    },
    boss_rotfather: {
      arrive: 'Flesh obeys him. Even yours, a little.',
      fall: 'He bursts. Burn what is left and do not breathe.',
    },
    boss_volk: {
      arrive: 'Siege engines kneel when he passes.',
      fall: 'His banner falls, and for one breath the host stands still.',
    },
    boss_malachar: {
      arrive: 'He has died here before. He does not remember it kindly.',
      fall: 'The Eternal falls. No one on the wall believes it will keep.',
    },
  };

  /** Lines for things that happen on the field. Several each, so they do not wear thin. */
  const FIELD_LINES = {
    breach: [
      'One got through. Behind the line, something screams.',
      'It is past you. It will not stop to fight.',
      'The line has a hole in it the shape of a running thing.',
    ],
    veteranFalls: [
      'His name is cut into the wall tonight.',
      'The young ones saw him fall. They will not forget how.',
      'An old shield lies face down. Someone picks it up.',
    ],
    spoils: [
      'The dead have no use for it now.',
      'Taken from the field while it was still warm.',
      'It is yours. It was paid for.',
    ],
    firstNight: [
      'The fires are small. Past them the dark is very large.',
      'Dig, build, and stand where you mean to die.',
    ],
  };

  let lineTurn = 0;
  /** A field line of one kind; cycles so the same line is not said twice running. */
  function line(kind) {
    const pool = FIELD_LINES[kind];
    if (!pool || !pool.length) return '';
    lineTurn = (lineTurn + 1) % 997;
    return pool[lineTurn % pool.length];
  }

  /** A warlord's arrival or death line, or '' when the id is unknown (a modded boss). */
  function bossLine(type, moment) {
    const lines = BOSS_LINES[type];
    return (lines && lines[moment === 'fall' ? 'fall' : 'arrive']) || '';
  }

  /**
   * Milestones of one endless siege. Each is a title, a line and an afterthought, spoken
   * as the wave begins. They sit where a run actually is: most runs end before wave 30.
   */
  const SIEGE_BEATS = {
    3: {
      title: 'They Know the Ground',
      hook: 'They have stopped coming straight at you. Some run for the gaps.',
      sub: 'What gets past the line does not come back.',
    },
    5: {
      title: 'The First Flood',
      hook: 'The treeline empties all at once. There is no counting them.',
      sub: 'Thin them before they thicken.',
    },
    10: {
      title: 'A Name in the North',
      hook: 'The host parts, and something with a name walks out in front of it.',
      sub: 'Every tenth dawn it will be so.',
    },
    15: {
      title: 'Old Hands',
      hook: 'The ones who are left have stopped flinching at the horn.',
      sub: 'They sharpen in silence and sleep standing.',
    },
    20: {
      title: 'The Pale Court',
      hook: 'The dead on the field do not all stay down.',
      sub: 'Burn what you can before nightfall.',
    },
    25: {
      title: 'No Birdsong',
      hook: 'Nothing has sung here in weeks. The men have stopped noticing.',
      sub: 'The camps in the north are bigger each night.',
    },
    30: {
      title: 'The Mountain Walks',
      hook: 'The ground shakes before anything can be seen.',
      sub: 'Stone will not hold it. Men will have to.',
    },
    40: {
      title: 'Cinder Oath',
      hook: 'Smoke stands in the north by day and glows by night.',
      sub: 'What marches under it took an oath to finish this.',
    },
    50: {
      title: 'Half a Hundred',
      hook: 'Fifty dawns. No one who lit the first fire is here to see it.',
      sub: 'The line is the same line. The men are not.',
    },
    75: {
      title: 'The Wall of Names',
      hook: 'There is no room left on the wall. They cut the new names over the old.',
      sub: 'The dead are still counted at every muster.',
    },
    100: {
      title: 'The Hundredth Dawn',
      hook: 'A hundred dawns. The Eternal comes to end it himself.',
      sub: 'Break him and the horn will sound again tomorrow. It always does.',
    },
    150: {
      title: 'Salt and Ash',
      hook: 'Nothing grows on the field now. It is all salt, ash and iron.',
      sub: 'Still they come over it.',
    },
    200: {
      title: 'The Old Dark',
      hook: 'What comes now was old before the realm had a name.',
      sub: 'It has been waiting for the small things to tire you.',
    },
    300: {
      title: 'No Count',
      hook: 'The tally was given up long ago. There is the line, and there is the north.',
      sub: 'Nobody asks how it ends.',
    },
    500: {
      title: 'The Unending',
      hook: 'Five hundred dawns. The enemy has stopped being an army and become weather.',
      sub: 'You stand in it.',
    },
    1000: {
      title: 'The Pit Opens',
      hook: 'The sky in the north is the wrong colour. What comes out of it is not a host.',
      sub: 'There is no one left to tell. Hold anyway.',
    },
  };

  /** Wave markers the game records as run highlights: { wave, name, hook }. */
  const ERA_BEATS = Object.keys(SIEGE_BEATS)
    .map(Number)
    .sort((a, b) => a - b)
    .map((wave) => ({ wave, name: SIEGE_BEATS[wave].title, hook: SIEGE_BEATS[wave].hook }));

  /** In-run framing read by the game: lines per wave, and the first warlord slain. */
  const CAMPAIGN_NARRATIVE = {
    waves: SIEGE_BEATS,
    firstBoss: {
      title: 'A Warlord Falls',
      hook: 'It had a name, and it died like the rest. The host stood still for one breath.',
      sub: 'There are more names in the north. One comes every tenth dawn.',
    },
  };

  /** The world, for the last tab of the encyclopedia. Lore only: no rules, no numbers. */
  const WORLD = [
    [
      'The realm',
      'A small country of fields, mills and one road north. It had a king once. It has a line of soldiers now, and whoever commands it.',
    ],
    [
      'The line',
      'A strip of trampled ground at the south edge of the field. Everything behind it is why you are here. The men do not speak of what is behind it.',
    ],
    [
      'The field',
      'One field. It has been fought over every day since the first horn. The grass is gone. The mud keeps what falls in it.',
    ],
    [
      'The north',
      'The treeline, and past it the camps, and past them nobody has gone and come back. The host comes out of it at dawn. By night you can see the fires.',
    ],
    [
      'The host',
      'Not one people. Goblins, orcs, the walking dead and worse, driven by the same thing in the same direction. They do not parley. No one has heard them ask for anything.',
    ],
    [
      'The warlords',
      'Ten have names. One leads the host every tenth dawn. Kill one and another comes; kill all ten and the first returns, stronger. The oldest of them is called the Eternal, and has earned it.',
    ],
    [
      'The war camps',
      'Hide tents and stake fences raised in the night at the north edge. A camp left standing feeds the next host. Men sent to burn one do not always come back.',
    ],
    [
      'The watch',
      'Night belongs to the line. Fires are banked, walls are raised, the wounded are carried in. The horn at dawn ends it.',
    ],
    [
      'The horn',
      'One long note at first light. It can be sounded early by a commander who is ready. The men hate the sound and would follow no other.',
    ],
    [
      'The wall of names',
      'A soldier who lasts is given a name by the others. When he dies it is cut into the wall. The names are read at every muster, and the ranks stand straighter for it.',
    ],
    [
      'The spoils',
      'Every fifth dawn the dead are stripped and the field is searched. What is found is shared out by the commander: an edge, a shield, a purse, a rule. It was all paid for.',
    ],
    [
      'The ribbons',
      'Strips of dyed cloth tied to the standard, one for each thing the line has done that was thought worth remembering. They are faded and they are not taken down.',
    ],
    [
      'The champions',
      'Fighters from outside the realm who swore to the line for their own reasons. Each company keeps its own hall and its own customs. They are paid well, and they earn it.',
    ],
    [
      'The pit',
      'An old word for where the worst of the host comes from. Those who have looked north on the wrong night say the sky there is the wrong colour.',
    ],
    [
      'The end',
      'There is none. The siege is not won. It is held, for one more dawn, and then the next.',
    ],
  ];

  function buildWorldEntries() {
    return WORLD.map(([name, body]) => entry('world', name, body));
  }

  /** Kept under its old name for callers that ask the lore module for its entries. */
  function getExpandedEntries() {
    return buildWorldEntries();
  }

  return {
    TROOP_LINES,
    ENEMY_LINES,
    BOSS_LINES,
    FIELD_LINES,
    SIEGE_BEATS,
    ERA_BEATS,
    CAMPAIGN_NARRATIVE,
    line,
    bossLine,
    buildWorldEntries,
    getExpandedEntries,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.LoreData = LoreData;
