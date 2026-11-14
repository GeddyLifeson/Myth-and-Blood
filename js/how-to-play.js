/**
 * How to Play — the manual, on one screen.
 *
 * Eight short sections, each a few sentences and a small drawing made with the game's own
 * sprite functions (read only). It opens from the main menu (HOW TO PLAY), the pause menu
 * and the "?" key sheet, and pauses a siege while it is open.
 *
 * Numbers are read from the game's tables (prices, breach limits, upkeep) and keys from
 * Hotkeys, so the text follows the rules and the bindings instead of repeating them.
 */
const HowToPlay = (() => {
  const ART_W = 720;
  const ART_H = 190;
  const INK = '#07050a';
  const BONE = '#ece4d0';
  const BLOOD = '#c8202a';

  // ------------------------------------------------------------------ reading the game
  const esc = (t) =>
    String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kbd = (name) => (name ? `<kbd>${esc(name)}</kbd>` : '');

  /** The key bound to an action right now, as a key cap, or '' when it has none. */
  function key(action, arg = null, states = ['night', 'day', 'unit_selected']) {
    if (typeof Hotkeys === 'undefined') return '';
    for (const s of states) {
      const k = Hotkeys.keyFor(s, action, arg);
      if (k) return kbd(Hotkeys.keyLabel(k));
    }
    return '';
  }
  /** " (key)" after a name, or nothing. */
  const withKey = (k) => (k ? ` (${k})` : '');
  /** "key or " before a button name, or nothing. */
  const keyOr = (k) => (k ? `${k} or ` : '');

  const cost = (type) =>
    typeof BuildDefs !== 'undefined' && BuildDefs[type] ? BuildDefs[type].cost : null;
  const tp = (type, fallback) => `${cost(type) ?? fallback} TP`;

  function breachLimits() {
    const d = typeof DIFFICULTIES !== 'undefined' ? DIFFICULTIES : null;
    const ids = ['baby', 'normal', 'chad', 'doomslayer'];
    if (!d || !ids.every((id) => d[id] && d[id].missLimit)) return '14, 10, 8 or 6';
    const n = ids.map((id) => d[id].missLimit);
    return `${n[0]}, ${n[1]}, ${n[2]} or ${n[3]}`;
  }

  function rules() {
    const eco = typeof EconomyRules !== 'undefined' ? EconomyRules.BUILDINGS : null;
    return {
      wallHolds: eco?.wall?.holdsPerWave ?? 3,
      labScience: eco?.research_lab?.dawnScience ?? 6,
    };
  }

  // ------------------------------------------------------------------------- sections
  /** Each section: id, title, words() -> paragraphs of HTML, art(ctx) -> the drawing. */
  const SECTIONS = [
    {
      id: 'line',
      title: 'The line',
      words: () => [
        'Enemies come from the top of the field. They form up there, then advance. The rope at the bottom is your <b>line</b>.',
        `An enemy that crosses the line is a <b>breach</b>. Line-breakers carry a <b>red pennant</b>: from wave 3 they run past your soldiers, straight for it. They are fast but weak.`,
        `The breach count is at the top left. The siege is lost at ${breachLimits()} breaches (Baby, Normal, Chad, Hellbane), or when your last soldier falls. Soldiers who die are gone for good.`,
      ],
      art: drawLineArt,
    },
    {
      id: 'night',
      title: 'Night and day',
      words: () => [
        `<b>Night</b> is for getting ready: hire soldiers and build. Press ${keyOr(key('beginDay', null, ['night']))}BEGIN DAY when you are done. Calling the day early pays 1 TP for every 10 seconds left, up to 5.`,
        '<b>Day</b> is the attack. Clear the wave to earn TP. From wave 2, supply crates land by day: walk a soldier onto one for TP, bandages or rations. From wave 3 a crate can be bait.',
        `At night a note at the top left says what the next wave brings, and red chevrons on the edge show where it comes from. A Watchtower${withKey(key('build', 'watchtower'))} turns the note into a head count.`,
      ],
      art: drawNightArt,
    },
    {
      id: 'soldiers',
      title: 'Your soldiers',
      words: () => [
        'Click a troop on the left, or press the key on its button, then click the field. <b>Shift+click</b> hires another of the same and keeps going.',
        'Past 14 soldiers, every hire costs 7% more for each soldier over. The price on the button is the price you pay.',
        'Each troop beats something. Footmen hold the front. Archers kill goblins and rats. Mages and Crossbowmen break armour. Pikemen stop riders. Cavalry and Knights ride down archers and casters. A Healer mends the men near her.',
        'A soldier who lives gains kills and stars. Click him to see his record and what he is strong against.',
      ],
      art: drawSoldiersArt,
    },
    {
      id: 'orders',
      title: 'Orders',
      words: () => [
        'Every soldier has a <b>post</b>: where you put him. He <b>hunts</b> on his own: he leaves his post to fight what comes near, then walks back.',
        'Click a soldier, then click the field to move his post. <b>Shift+click</b> sends him there to <b>hold</b>: he stays put and fights only what reaches him. A small shield at his feet marks him.',
        `HUNT${withKey(key('hunt'))} and HOLD${withKey(key('holdHere'))} at the top order the selected soldiers, or the whole army if none are selected. ${key('backToPosts', null, ['unit_selected']) || 'Back to posts'} sends the selected soldiers back to their posts at once.`,
        `A General gives two orders by day to the soldiers near him: War Cry${withKey(key('order', 'warCry'))}, 20% more damage for 8 seconds, and Hold the Line${withKey(key('order', 'holdLine'))}, 40% less damage taken for 7 seconds.`,
      ],
      art: drawOrdersArt,
    },
    {
      id: 'buildings',
      title: 'Buildings',
      words: () => {
        const r = rules();
        return [
          'Hire a <b>Builder</b> first. Then pick a building on the Build tab and click the field. Builders work faster at night.',
          `<b>Wall</b>${withKey(key('build', 'wall'))}, ${tp('wall', 5)}: cover for your soldiers, and it stops ${r.wallHolds} line-breakers each wave.`,
          `<b>Medical Tent</b>${withKey(key('build', 'medical_tent'))}, ${tp('medical_tent', 5)}: a wounded soldier walks to it before anything else, heals and returns to his post. In a fight he stays until he is below half health. It treats four at a time.`,
          `<b>Watchtower</b>${withKey(key('build', 'watchtower'))}, ${tp('watchtower', 4)}: a head count of the next wave. <b>Research Lab</b>, ${tp('research_lab', 18)}: science.`,
        ];
      },
      art: drawBuildingsArt,
    },
    {
      id: 'research',
      title: 'Research',
      words: () => {
        const r = rules();
        return [
          `A standing <b>Research Lab</b> earns ${r.labScience} science at every dawn, and a little from each kill. Only the first two labs count.`,
          'Open RESEARCH on the Build tab and pick a project. One runs at a time.',
          'Start with <b>Iron Weapons</b> (20 science, from wave 3). It opens the Knight, the Crossbowman and the Sapper.',
          'The <b>Sapper</b> buries mines in front of his post each night and throws satchel charges by day. His blasts go through armour and shields. He cannot reach flyers, and he is weak up close.',
        ];
      },
      art: drawResearchArt,
    },
    {
      id: 'spoils',
      title: 'Spoils and ribbons',
      words: () => [
        'After every fifth wave you choose one of three <b>spoils</b>. The siege waits until you choose. You keep it for the rest of the siege.',
        '<b>Ribbons</b> are earned across all your sieges. Each gives a small bonus for good, such as starting TP.',
        'Your <b>score</b>: 100 for each wave cleared and 5 for each kill, less 40 for each breach and 15 for each soldier lost. Harder difficulties multiply it. The best score on each difficulty is kept.',
        'A cheat code voids the siege it is used in: no score, no ribbons, no achievements.',
      ],
      art: drawSpoilsArt,
    },
    {
      id: 'enemies',
      title: 'Enemies',
      words: () => [
        '<b>Goblins</b> come in numbers: Archers thin them out. <b>Berserkers</b> hit hard: Footmen stand up to them. <b>Orc archers</b> and <b>dark mages</b> shoot from behind: send riders at them.',
        '<b>Trolls</b>, <b>dark knights</b> and <b>war chiefs</b> wear armour. Arrows do little. Use Mages, Crossbowmen and Sappers. <b>Warg riders</b> run down archers and healers: Pikemen stop them.',
        'Every fifth wave is a horde. Every tenth wave brings a named warlord.',
        'A blow from behind does 25% more damage and shakes morale. That is true for both sides, so do not let them get behind you.',
      ],
      art: drawEnemiesArt,
    },
  ];

  // --------------------------------------------------------------------------- drawing
  const UP = -90; // a soldier facing the enemy
  const DOWN = 90; // an enemy facing the line

  /** One unit sprite, centred on (x, y). */
  function unit(ctx, type, x, y, team, rot, scale = 2, anim = 'idle', frame = 0) {
    if (typeof SpriteGen === 'undefined') return;
    // Always ask for the same sharp sprite and size it here: the sprite cache rounds the
    // scales it is asked for. `scale` 1.5 draws a figure about 40 px wide.
    const cv = SpriteGen.getUnitCanvas(type, rot, team, frame, 2, anim);
    if (!cv) return;
    const k = (scale * 0.9) / 2;
    const dw = cv.width * k;
    const dh = cv.height * k;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, x - dw / 2, y - dh / 2, dw, dh);
  }

  /** One finished building of the player's, centred on (x, y). */
  function building(ctx, type, x, y, scale = 1.4) {
    const d = typeof BuildDefs !== 'undefined' ? BuildDefs[type] : null;
    const b = {
      id: `htp-${type}`,
      type,
      x: 0,
      y: 0,
      owner: 'player',
      complete: true,
      hp: d?.hp || 100,
      maxHp: d?.hp || 100,
      radius: d?.radius || 18,
      facing: 'north',
      buildProgress: 1,
      buildTime: 1,
      ...(d || {}),
    };
    b.x = 0;
    b.y = 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    try {
      if (typeof BuildingArt !== 'undefined') BuildingArt.draw(ctx, b, 0);
      else if (typeof SpriteGen !== 'undefined') SpriteGen.drawBuilding(ctx, b);
    } catch (_) {
      /* a missing sprite leaves a gap, not a broken screen */
    }
    ctx.restore();
  }

  function ground(ctx, top = '#2a2420', bottom = '#1c1614') {
    const g = ctx.createLinearGradient(0, 0, 0, ART_H);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ART_W, ART_H);
    // Scuffs, so the ground is not a flat card.
    ctx.strokeStyle = 'rgba(236,228,208,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const x = (i * 131) % ART_W;
      const y = (i * 67) % ART_H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y + 2);
      ctx.stroke();
    }
  }

  /** The rope line with posts and red flags. */
  function rope(ctx, y, x0 = 0, x1 = ART_W) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.strokeStyle = '#a01018';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 60) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 30, y + 7, Math.min(x1, x + 60), y);
    }
    ctx.stroke();
    for (let x = x0 + 30; x < x1; x += 60) {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 2, y - 14, 4, 18);
      ctx.fillStyle = BLOOD;
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 14);
      ctx.lineTo(x + 11, y - 11);
      ctx.lineTo(x + 2, y - 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** The red pennant a line-breaker carries. */
  function pennant(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 22);
    ctx.stroke();
    ctx.fillStyle = '#e0241c';
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x + 15, y - 17);
    ctx.lineTo(x, y - 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function label(ctx, text, x, y, opts = {}) {
    ctx.save();
    ctx.font = `${opts.bold === false ? 600 : 700} ${opts.size || 12}px 'Source Sans 3', 'Segoe UI', sans-serif`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = opts.color || BONE;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function arrow(ctx, x0, y0, x1, y1, color = BONE, dash = null) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 9 * Math.cos(a - 0.45), y1 - 9 * Math.sin(a - 0.45));
    ctx.lineTo(x1 - 9 * Math.cos(a + 0.45), y1 - 9 * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function crate(ctx, x, y) {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 12, y - 11, 24, 22);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x - 10, y - 9, 20, 18);
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 9);
    ctx.lineTo(x + 10, y + 9);
    ctx.moveTo(x + 10, y - 9);
    ctx.lineTo(x - 10, y + 9);
    ctx.stroke();
  }

  /** The post marker: a small bone diamond. */
  function postMark(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = BONE;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The planted shield that marks a soldier on Hold. */
  function holdMark(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = BONE;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 6, y - 6);
    ctx.lineTo(x + 6, y + 1);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 6, y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLineArt(ctx) {
    ground(ctx);
    // The muster zone at the top.
    ctx.fillStyle = 'rgba(200,32,42,0.13)';
    ctx.fillRect(0, 0, ART_W, 62);
    ctx.strokeStyle = 'rgba(200,32,42,0.7)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, 62);
    ctx.lineTo(ART_W, 62);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'THEY FORM UP HERE', 92, 14, { color: '#ff6a5a', size: 11 });
    const foes = ['goblin', 'orc', 'goblin', 'orc_archer', 'goblin', 'orc'];
    foes.forEach((t, i) => unit(ctx, t, 250 + i * 44, 34 + (i % 2) * 8, 'enemy', DOWN, 1.5));
    arrow(ctx, 360, 66, 360, 92, '#ff6a5a');
    // Your soldiers.
    [200, 262, 324, 386].forEach((x) => unit(ctx, 'footman', x, 128, 'player', UP, 1.6));
    unit(ctx, 'archer', 232, 152, 'player', UP, 1.5);
    unit(ctx, 'archer', 354, 152, 'player', UP, 1.5);
    label(ctx, 'YOUR SOLDIERS', 120, 132, { size: 11 });
    // A line-breaker running round the flank.
    unit(ctx, 'goblin', 560, 112, 'enemy', DOWN, 1.5, 'walk', 1);
    pennant(ctx, 572, 104);
    arrow(ctx, 560, 132, 560, 164, '#ff6a5a', [5, 4]);
    label(ctx, 'LINE-BREAKER', 628, 96, { color: '#ff6a5a', size: 11 });
    rope(ctx, 172);
    label(ctx, 'THE LINE', 660, 160, { size: 11 });
  }

  function drawNightArt(ctx) {
    const half = ART_W / 2;
    // Night on the left.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, half, ART_H);
    ctx.clip();
    ground(ctx, '#161420', '#0c0a12');
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.arc(46, 36, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#161420';
    ctx.beginPath();
    ctx.arc(53, 31, 13, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, 'NIGHT: HIRE AND BUILD', 180, 22, { size: 12 });
    unit(ctx, 'footman', 110, 120, 'player', UP, 1.6);
    unit(ctx, 'footman', 166, 120, 'player', UP, 1.6);
    unit(ctx, 'builder', 236, 132, 'player', 0, 1.5);
    building(ctx, 'wall', 296, 122, 1.1);
    // Chevrons on the top edge: where the next wave comes from.
    ctx.strokeStyle = '#e0241c';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const y = 40 + i * 9;
      ctx.beginPath();
      ctx.moveTo(190, y);
      ctx.lineTo(202, y + 8);
      ctx.lineTo(214, y);
      ctx.stroke();
    }
    rope(ctx, 172, 0, half);
    ctx.restore();
    // Day on the right.
    ctx.save();
    ctx.beginPath();
    ctx.rect(half, 0, half, ART_H);
    ctx.clip();
    ground(ctx, '#3a302a', '#241c18');
    ctx.fillStyle = '#e8b040';
    ctx.beginPath();
    ctx.arc(ART_W - 46, 36, 13, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, 'DAY: THE ATTACK', half + 170, 22, { size: 12 });
    ['goblin', 'orc', 'goblin'].forEach((t, i) =>
      unit(ctx, t, half + 120 + i * 46, 64, 'enemy', DOWN, 1.5, 'walk', i)
    );
    unit(ctx, 'footman', half + 130, 124, 'player', UP, 1.6, 'attack', 1);
    unit(ctx, 'archer', half + 196, 138, 'player', UP, 1.5, 'attack', 1);
    crate(ctx, half + 284, 120);
    label(ctx, 'CRATE', half + 284, 144, { size: 11 });
    rope(ctx, 172, half, ART_W);
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.fillRect(half - 2, 0, 4, ART_H);
  }

  function drawSoldiersArt(ctx) {
    ground(ctx);
    const row = [
      ['footman', 'Footman', 'holds the front'],
      ['archer', 'Archer', 'goblins, rats'],
      ['mage', 'Mage', 'armour'],
      ['crossbowman', 'Crossbowman', 'armour'],
      ['pikeman', 'Pikeman', 'riders'],
      ['cavalry', 'Cavalry', 'archers, casters'],
      ['healer', 'Healer', 'mends'],
    ];
    const step = ART_W / row.length;
    row.forEach(([type, name, beats], i) => {
      const x = step * (i + 0.5);
      unit(ctx, type, x, 76, 'player', UP, 2);
      label(ctx, name, x, 136, { size: 13 });
      label(ctx, beats, x, 154, { size: 11, color: '#ff8a7a', bold: false });
    });
    label(ctx, 'WHAT EACH ONE BEATS', ART_W / 2, 16, { size: 11, color: '#a89c88' });
  }

  function drawOrdersArt(ctx) {
    ground(ctx);
    // Hunt: out from the post and back.
    postMark(ctx, 130, 132);
    unit(ctx, 'footman', 196, 70, 'player', -50, 1.7, 'attack', 1);
    unit(ctx, 'goblin', 236, 44, 'enemy', 130, 1.5);
    arrow(ctx, 138, 124, 180, 86, BONE, [5, 4]);
    label(ctx, 'HUNT', 150, 22, { size: 13 });
    label(ctx, 'his post', 130, 152, { size: 11, bold: false });
    // Move: a click sets a new post.
    unit(ctx, 'archer', 330, 130, 'player', UP, 1.6);
    arrow(ctx, 346, 118, 410, 78, '#ffd080');
    postMark(ctx, 420, 70);
    label(ctx, 'CLICK: NEW POST', 380, 22, { size: 13 });
    // Hold: stays put.
    unit(ctx, 'footman', 590, 96, 'player', UP, 1.8);
    holdMark(ctx, 590, 128);
    ctx.strokeStyle = 'rgba(236,228,208,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(590, 96, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'SHIFT+CLICK: HOLD', 590, 22, { size: 13 });
    label(ctx, 'stays, fights what reaches him', 590, 152, { size: 11, bold: false });
    rope(ctx, 176);
  }

  function drawBuildingsArt(ctx) {
    ground(ctx);
    const row = [
      ['wall', 'Wall'],
      ['medical_tent', 'Medical Tent'],
      ['watchtower', 'Watchtower'],
      ['research_lab', 'Research Lab'],
    ];
    unit(ctx, 'builder', 70, 84, 'player', 0, 2);
    label(ctx, 'Builder', 70, 140, { size: 13 });
    label(ctx, 'first', 70, 157, { size: 11, color: '#ff8a7a', bold: false });
    arrow(ctx, 112, 84, 150, 84, BONE);
    const step = (ART_W - 170) / row.length;
    row.forEach(([type, name], i) => {
      const x = 170 + step * (i + 0.5);
      building(ctx, type, x, 86, 1.5);
      label(ctx, name, x, 140, { size: 13 });
      label(ctx, `${cost(type) ?? '?'} TP`, x, 157, { size: 11, color: '#ff8a7a', bold: false });
    });
  }

  function drawResearchArt(ctx) {
    ground(ctx);
    building(ctx, 'research_lab', 96, 84, 1.7);
    label(ctx, 'Research Lab', 96, 146, { size: 13 });
    label(ctx, `+${rules().labScience} science each dawn`, 96, 163, {
      size: 11,
      color: '#ff8a7a',
      bold: false,
    });
    arrow(ctx, 176, 84, 232, 84, BONE);
    label(ctx, 'IRON WEAPONS', 300, 84, { size: 14, color: '#ffd080' });
    arrow(ctx, 368, 84, 420, 84, BONE);
    [
      ['knight', 'Knight'],
      ['crossbowman', 'Crossbowman'],
      ['sapper', 'Sapper'],
    ].forEach(([type, name], i) => {
      const x = 474 + i * 92;
      unit(ctx, type, x, 80, 'player', UP, 2);
      label(ctx, name, x, 146, { size: 13 });
    });
    // A buried mine in front of the Sapper.
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(658, 28, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.arc(658, 28, 3, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, 'mine', 690, 28, { size: 11, bold: false });
  }

  function drawSpoilsArt(ctx) {
    ground(ctx, '#201a1a', '#120e0e');
    label(ctx, 'AFTER WAVES 5, 10, 15 ...  CHOOSE ONE', 250, 20, { size: 12 });
    const names =
      typeof SiegeLoop !== 'undefined'
        ? ['sharpened_steel', 'second_wall', 'field_surgeons'].map(
            (id) => SiegeLoop.EDICTS[id]?.name || ''
          )
        : ['', '', ''];
    names.forEach((name, i) => {
      const x = 44 + i * 144;
      ctx.fillStyle = INK;
      ctx.fillRect(x + 4, 42, 124, 118);
      ctx.fillStyle = '#0b0809';
      ctx.fillRect(x, 38, 124, 118);
      ctx.strokeStyle = i === 1 ? BONE : BLOOD;
      ctx.lineWidth = i === 1 ? 3 : 2;
      ctx.strokeRect(x, 38, 124, 118);
      label(ctx, String(i + 1), x + 62, 70, { size: 26, color: i === 1 ? BONE : '#ff4a3a' });
      label(ctx, name, x + 62, 118, { size: 12 });
    });
    // A ribbon.
    const rx = 590;
    ctx.fillStyle = '#a01018';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx - 18, 86);
    ctx.lineTo(rx - 26, 150);
    ctx.lineTo(rx - 9, 136);
    ctx.lineTo(rx, 152);
    ctx.lineTo(rx + 9, 136);
    ctx.lineTo(rx + 26, 150);
    ctx.lineTo(rx + 18, 86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.arc(rx, 70, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = BLOOD;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 8 : 19;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(rx + r * Math.cos(a), 70 + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    label(ctx, 'RIBBONS: KEPT FOR GOOD', rx, 172, { size: 12 });
  }

  function drawEnemiesArt(ctx) {
    ground(ctx);
    const row = [
      ['goblin', 'Goblin', 'archers'],
      ['berserker', 'Berserker', 'footmen'],
      ['orc_archer', 'Orc Archer', 'riders'],
      ['warg_rider', 'Warg Rider', 'pikemen'],
      ['dark_knight', 'Dark Knight', 'mages, bolts'],
      ['troll', 'Troll', 'mages, sappers'],
    ];
    const step = ART_W / row.length;
    row.forEach(([type, name, answer], i) => {
      const x = step * (i + 0.5);
      unit(ctx, type, x, 78, 'enemy', DOWN, 2);
      label(ctx, name, x, 138, { size: 13 });
      label(ctx, answer, x, 156, { size: 11, color: '#9fe0a8', bold: false });
    });
    label(ctx, 'WHAT TO SEND AGAINST EACH', ART_W / 2, 16, { size: 11, color: '#a89c88' });
  }

  // ---------------------------------------------------------------------------- screen
  let root = null;
  let current = 0;
  let pausedByUs = false;

  const hasDom = () => typeof document !== 'undefined' && !!document.body;

  function build() {
    if (root || !hasDom()) return root;
    root = document.createElement('div');
    root.id = 'how-to-play';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'How to play');
    root.innerHTML =
      '<div class="htp-box">' +
      '<div class="htp-head"><h2 class="htp-title">How to <b>Play</b></h2>' +
      '<button type="button" class="htp-close" data-htp="close">CLOSE</button></div>' +
      '<div class="htp-body">' +
      '<div class="htp-tabs" role="tablist" aria-label="Sections">' +
      SECTIONS.map(
        (s, i) =>
          `<button type="button" class="htp-tab" role="tab" data-htp-tab="${i}" aria-selected="false"><i>${i + 1}</i>${esc(s.title)}</button>`
      ).join('') +
      '</div>' +
      '<div class="htp-page" role="tabpanel">' +
      `<canvas class="htp-art" width="${ART_W}" height="${ART_H}" aria-hidden="true"></canvas>` +
      '<h3 class="htp-section-title"></h3><div class="htp-words"></div>' +
      '</div></div>' +
      '<div class="htp-foot"><span class="htp-foot-note">Arrow keys turn the page. Esc closes.</span>' +
      '<div class="htp-nav"><button type="button" data-htp="prev">BACK</button>' +
      '<button type="button" data-htp="next">NEXT</button></div></div>' +
      '</div>';
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const t = e.target && e.target.closest ? e.target.closest('[data-htp], [data-htp-tab]') : null;
      if (!t) {
        // A click on the dimmed backdrop closes; a click inside the box does nothing.
        if (e.target === root) close();
        return;
      }
      if (t.dataset.htpTab != null) show(Number(t.dataset.htpTab));
      else if (t.dataset.htp === 'close') close();
      else if (t.dataset.htp === 'prev') show(current - 1);
      else if (t.dataset.htp === 'next') show(current + 1);
    });
    return root;
  }

  /** The words of a section as HTML paragraphs (also used by the tests). */
  function sectionHtml(i) {
    const s = SECTIONS[i];
    return s
      ? s
          .words()
          .map((p) => `<p>${p}</p>`)
          .join('')
      : '';
  }

  function show(i) {
    if (!root) return;
    current = Math.max(0, Math.min(SECTIONS.length - 1, i));
    const s = SECTIONS[current];
    root.querySelectorAll('.htp-tab').forEach((tab, n) => {
      tab.setAttribute('aria-selected', n === current ? 'true' : 'false');
    });
    root.querySelector('.htp-section-title').textContent = s.title;
    root.querySelector('.htp-words').innerHTML = sectionHtml(current);
    root.querySelector('[data-htp="prev"]').disabled = current === 0;
    root.querySelector('[data-htp="next"]').disabled = current === SECTIONS.length - 1;
    root.querySelector('.htp-page').scrollTop = 0;
    const cv = root.querySelector('.htp-art');
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ART_W, ART_H);
    try {
      s.art(ctx);
    } catch (_) {
      /* the words still stand without the drawing */
    }
  }

  function isOpen() {
    return !!root && !root.hidden;
  }

  function open(section) {
    if (!build()) return false;
    // A siege does not run on while the manual is open.
    pausedByUs = false;
    if (typeof Game !== 'undefined' && Game.isPlaying?.()) {
      const gs = Game.getState?.();
      if (gs && !gs.paused) {
        Game.setPaused?.(true);
        pausedByUs = true;
      }
    }
    document.getElementById('key-sheet')?.remove();
    root.hidden = false;
    const idx = typeof section === 'string' ? SECTIONS.findIndex((s) => s.id === section) : section;
    show(Number.isInteger(idx) && idx >= 0 ? idx : 0);
    root.querySelector('.htp-close')?.focus?.();
    return true;
  }

  function close() {
    if (!isOpen()) return;
    root.hidden = true;
    if (pausedByUs && typeof Game !== 'undefined') Game.setPaused?.(false);
    pausedByUs = false;
  }

  /** While the manual is open it takes the keyboard: nothing reaches the game behind it. */
  function onKey(e) {
    if (!isOpen()) return;
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') show(current + 1);
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') show(current - 1);
    else if (/^[1-9]$/.test(k) && Number(k) <= SECTIONS.length) show(Number(k) - 1);
    else if (k === 'Tab' || k === 'Enter' || k === ' ') return; // focus and buttons still work
    e.preventDefault();
    e.stopPropagation();
  }

  function linkButton(label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'htp-link';
    b.dataset.htpOpen = '1';
    b.textContent = label;
    return b;
  }

  /** The pause menu gets a HOW TO PLAY button beside Encyclopedia and Settings. */
  function addPauseButton() {
    const row = document.querySelector('#pause-screen .pause-util-row');
    if (!row || row.querySelector('[data-htp-open]')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'pause-howto-btn';
    b.className = 'menu-btn small-btn';
    b.dataset.htpOpen = '1';
    b.textContent = 'HOW TO PLAY';
    row.insertBefore(b, row.firstChild);
  }

  /** The "?" key sheet is rebuilt each time it opens: give each new one a link. */
  function addKeySheetLink(sheet) {
    const foot = sheet && sheet.querySelector ? sheet.querySelector('.key-sheet-foot') : null;
    const host = foot || (sheet && sheet.querySelector ? sheet.querySelector('.key-sheet-box') : null);
    if (!host || host.querySelector('[data-htp-open]')) return;
    host.appendChild(linkButton('How to play'));
  }

  function init() {
    if (!hasDom() || !document.addEventListener) return;
    addPauseButton();
    document.addEventListener('keydown', onKey, true);
    // One listener for every way in. The menu's two buttons are caught on the way down, so
    // the old inline text block and the retired callout tutorial never open.
    document.addEventListener(
      'click',
      (e) => {
        const t = e.target && e.target.closest ? e.target : null;
        if (!t) return;
        if (t.closest('#howto-btn') || t.closest('[data-htp-open]')) {
          e.preventDefault();
          e.stopPropagation();
          AudioEngine?.SFX?.click?.();
          open();
        } else if (t.closest('#howto-interactive-btn')) {
          e.preventDefault();
          e.stopPropagation();
          AudioEngine?.SFX?.click?.();
          if (typeof Onboarding !== 'undefined') Onboarding.startTutorial?.();
        }
      },
      true
    );
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver((list) => {
        for (const m of list) {
          for (const n of m.addedNodes) if (n && n.id === 'key-sheet') addKeySheetLink(n);
        }
      }).observe(document.body, { childList: true });
    }
  }

  if (hasDom() && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return {
    SECTIONS,
    open,
    close,
    isOpen,
    sectionHtml,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.HowToPlay = HowToPlay;
