/**
 * Procedural top-down sprites for Myth and Blood.
 * MnB2-style: rotatable unit markers on a flat battlefield.
 */
const SpriteGen = (() => {
  // Crowd-tier sprites are smaller, which pays for the larger count.
  const CACHE_MAX = 1000;
  let cacheTouch = 0;
  /**
   * Logical size of a cached unit sprite; the game draws it at UNIT_DRAW_SIZE world
   * units. The two are kept in the ratio 72:62, so widening the canvas (to leave room
   * for long weapons, fallen bodies and boss marks) does not change anyone's size.
   */
  const UNIT_CANVAS_UNITS = 88;
  const UNIT_DRAW_SIZE = (UNIT_CANVAS_UNITS * 62) / 72;
  const cache = new Map();
  let battlefieldCache = null;
  let battlefieldCacheKey = '';

  // Palette: bone, blood and black. Player troops are bone and ash with one steel-blue
  // accent; every enemy faction is a dark body with its own muted accent (goblins ochre,
  // orcs blood, the dead corpse-green, the dark host violet, hellspawn ember, the void
  // cold teal). `body` is the torso, `accent` the pauldrons and trim, `mark` the secondary
  // detail (weapon wrap, orb, sash).
  const STEEL = '#6d8fb3';
  const UNIT_STYLE = {
    footman: { body: '#cfc5a8', accent: STEEL, mark: '#8f9aa8', size: 9 },
    archer: { body: '#9c9078', accent: STEEL, mark: '#5d564a', size: 8 },
    mage: { body: '#d8d0b8', accent: STEEL, mark: '#bcd6e4', size: 8 },
    cavalry: { body: '#b8ad90', accent: STEEL, mark: '#3a2e28', size: 11 },
    healer: { body: '#ece6d4', accent: STEEL, mark: '#d8ecf4', size: 8 },
    builder: { body: '#a89a7c', accent: '#8a7f6a', mark: STEEL, size: 9 },
    courier: { body: '#b4a88a', accent: '#8a7f6a', mark: STEEL, size: 8 },
    sapper: { body: '#77705f', accent: STEEL, mark: '#2a2622', size: 8 },
    knight: { body: '#d2d4d2', accent: '#aab4c0', mark: STEEL, size: 10 },
    general: { body: '#e4dcc4', accent: STEEL, mark: '#3f5d7e', size: 11 },
    scout: { body: '#857c6a', accent: '#6a6254', mark: STEEL, size: 8 },
    bard: { body: '#c9bfa4', accent: STEEL, mark: '#8a6a48', size: 8 },
    ballista: { body: '#8a8170', accent: STEEL, mark: '#5a4a38', size: 10 },
    pikeman: { body: '#c4baa0', accent: STEEL, mark: '#8f9aa8', size: 9 },
    crossbowman: { body: '#8d8270', accent: STEEL, mark: '#5a4a38', size: 9 },
    doomslayer_hero: { body: '#8f8a7c', accent: '#57534e', mark: STEEL, size: 11 },
    // Greenskins: goblins wear ochre, orcs wear blood.
    goblin: { body: '#5e5c46', accent: '#c79a2e', mark: '#8f8a86', size: 7 },
    goblin_sapper: { body: '#5a5844', accent: '#c79a2e', mark: '#1c1a18', size: 7 },
    goblin_engineer: { body: '#625e4a', accent: '#c79a2e', mark: '#8f8a86', size: 7 },
    goblin_burrower: { body: '#54503e', accent: '#c79a2e', mark: '#6a5a44', size: 7 },
    goblin_firebrand: { body: '#5c5640', accent: '#c79a2e', mark: '#e0701c', size: 7 },
    orc: { body: '#4c4438', accent: '#b5281c', mark: '#8f8a86', size: 10 },
    orc_archer: { body: '#4a463a', accent: '#b5281c', mark: '#6a5a44', size: 8 },
    orc_shieldbearer: { body: '#48443a', accent: '#b5281c', mark: '#8f8a86', size: 11 },
    troll: { body: '#58523f', accent: '#b5281c', mark: '#6a5a44', size: 12 },
    berserker: { body: '#54322e', accent: '#b5281c', mark: '#8f8a86', size: 11 },
    shaman: { body: '#4a4a3c', accent: '#b5281c', mark: '#e4dcc4', size: 8 },
    warg_rider: { body: '#4a4038', accent: '#b5281c', mark: '#34343c', size: 10 },
    war_chief: { body: '#3c3430', accent: '#b5281c', mark: '#e4dcc4', size: 12 },
    // The dark host: violet.
    dark_knight: { body: '#2c2630', accent: '#8460a8', mark: '#a01018', size: 11 },
    dark_mage: { body: '#2e2636', accent: '#8460a8', mark: '#b48ad0', size: 8 },
    assassin: { body: '#34323a', accent: '#8460a8', mark: '#8f8a86', size: 8 },
    // The dead: corpse green on bone.
    necromancer: { body: '#2e2c30', accent: '#86b08a', mark: '#a8d8a8', size: 9 },
    bone_summoner: { body: '#3a3630', accent: '#86b08a', mark: '#a8d8a8', size: 9 },
    plague_rat: { body: '#4a4438', accent: '#86b08a', mark: '#c9a0a0', size: 6 },
    wailing_wraith: { body: '#3a3a40', accent: '#86b08a', mark: '#c8d8d0', size: 9 },
    grim_revenant: { body: '#34363a', accent: '#86b08a', mark: '#6a5a44', size: 9 },
    // Hellspawn: ember.
    hellbound_legionnaire: { body: '#3e2a28', accent: '#e0701c', mark: '#6a5a44', size: 9 },
    nightmare_strider: { body: '#342628', accent: '#e0701c', mark: '#1c0c12', size: 10 },
    dreadborn_champion: { body: '#2e2022', accent: '#e0701c', mark: '#8f8a86', size: 12 },
    hellmortar_pack: { body: '#40302a', accent: '#e0701c', mark: '#1c1a18', size: 10 },
    cinderbound_juggernaut: { body: '#4a3020', accent: '#e0701c', mark: '#ff4020', size: 17 },
    // The void: cold teal.
    warp_prophet: { body: '#28303a', accent: '#4fb0c0', mark: '#9ad8e0', size: 9 },
    umbral_stalker: { body: '#1e2026', accent: '#4fb0c0', mark: '#8f8a86', size: 8 },
    void_stalker: { body: '#18181e', accent: '#30303a', mark: '#ff2040', size: 14 },
    // Beasts and engines.
    harpy: { body: '#5a5248', accent: '#8a7f6a', mark: '#e4dcc4', size: 8 },
    sky_drake: { body: '#4a4240', accent: '#7a6a60', mark: '#e0701c', size: 11 },
    siege_tower: { body: '#483828', accent: '#806040', mark: '#a01018', size: 14 },
    abomination: { body: '#5c3438', accent: '#8a4a4a', mark: '#ff4060', size: 16 },
    behemoth: { body: '#4a4436', accent: '#6a604c', mark: '#ff6020', size: 18 },
    iron_colossus: { body: '#4a4a4e', accent: '#7a7a80', mark: '#ff8040', size: 19 },
    elder_wyrm: { body: '#3c3432', accent: '#6a5a54', mark: '#ff6040', size: 17 },
    boss_gorath: { body: '#4a3020', accent: '#8a5030', mark: '#ff4020', size: 19 },
    boss_morwen: { body: '#3a3438', accent: '#6c6068', mark: '#e4dcc4', size: 17 },
    boss_thokk: { body: '#4a4840', accent: '#6c685c', mark: '#c06020', size: 20 },
    boss_grimm: { body: '#302022', accent: '#604040', mark: '#ff6020', size: 18 },
    boss_vexis: { body: '#141218', accent: '#2c2830', mark: '#ff1030', size: 16 },
    boss_karg: { body: '#444448', accent: '#74747a', mark: '#ffa040', size: 21 },
    boss_sylvara: { body: '#302a2c', accent: '#5c4a4c', mark: '#ff8040', size: 19 },
    boss_rotfather: { body: '#4c3a30', accent: '#7a6a48', mark: '#ff3060', size: 18 },
    boss_volk: { body: '#382828', accent: '#684040', mark: '#ffd040', size: 20 },
    boss_malachar: { body: '#2a2026', accent: '#50404a', mark: '#ff2080', size: 22 },
    // Evolved allies: bone and steel like the rest of the line; each is told apart by
    // its silhouette (see ROSTER_LOOK), not by a tint.
    roster_ultimis: { body: '#8a8170', accent: STEEL, mark: '#5a4a38', size: 10 },
    roster_primis: { body: '#b8ad90', accent: STEEL, mark: '#5d564a', size: 10 },
    roster_halo: { body: '#aab0b0', accent: STEEL, mark: '#57534e', size: 10 },
    roster_gears: { body: '#77705f', accent: '#57534e', mark: STEEL, size: 10 },
    roster_lotr: { body: '#857c6a', accent: '#6a6254', mark: STEEL, size: 10 },
    roster_baki: { body: '#d9b08c', accent: '#d9b08c', mark: '#e4dcc4', size: 10 },
    roster_jojo: { body: '#c4baa0', accent: STEEL, mark: '#bcd6e4', size: 10 },
    roster_fotns: { body: '#9c9078', accent: '#d9b08c', mark: STEEL, size: 10 },
    roster_dragonball: { body: '#d8d0b8', accent: '#b8ad90', mark: STEEL, size: 10 },
    roster_imperium: { body: '#cfc5a8', accent: '#aab4c0', mark: STEEL, size: 10 },
    roster_crystal: { body: '#b4bcc0', accent: '#bcd6e4', mark: STEEL, size: 10 },
    roster_warp: { body: '#6e6a70', accent: '#57534e', mark: STEEL, size: 10 },
    roster_tes: { body: '#8d8270', accent: '#8f9aa8', mark: STEEL, size: 10 },
    roster_wwe: { body: '#d9b08c', accent: '#d9b08c', mark: STEEL, size: 10 },
  };
  // Other modules still write their own colours into UNIT_STYLE at start-up. The ink
  // palette is kept apart from that table so the roster stays on one palette; a type
  // that is not in it (a modded unit) is drawn from UNIT_STYLE as before.
  const INK_PALETTE = {};
  for (const k of Object.keys(UNIT_STYLE)) INK_PALETTE[k] = { ...UNIT_STYLE[k] };

  const MONSTER_SPRITES = [
    'abomination',
    'behemoth',
    'iron_colossus',
    'void_stalker',
    'elder_wyrm',
    'cinderbound_juggernaut',
  ];

  const BOSS_ARCHETYPE = {
    boss_gorath: 'behemoth',
    boss_thokk: 'behemoth',
    boss_morwen: 'abomination',
    boss_grimm: 'void_stalker',
    boss_vexis: 'void_stalker',
    boss_karg: 'iron_colossus',
    boss_volk: 'iron_colossus',
    boss_sylvara: 'elder_wyrm',
    boss_rotfather: 'abomination',
    boss_malachar: 'behemoth',
  };

  function resolveUnitStyle(type, team, fallback = 'footman') {
    const ext = UNIT_STYLE[type];
    const ink = INK_PALETTE[type];
    let base = ink || ext || INK_PALETTE[fallback] || INK_PALETTE.footman;
    // Size is gameplay data (collision, hit boxes): always take the live value.
    if (ink && ext && ext.size !== ink.size) base = { ...ink, size: ext.size };
    if (team !== 'player' || typeof Cosmetics === 'undefined') return base;
    return Cosmetics.applyUnitSkin(base);
  }

  // ── Lighting helpers ─────────────────────────────────────────
  // Unit sprites are rendered once per (type, rotation, team, frame, animState)
  // combo onto a small offscreen canvas and cached (see getUnitCanvas below), so
  // gradient construction here only costs anything on a cache miss — safe to use
  // freely on every body fill, not a per-frame cost once the cache is warm.
  // Capped like the sibling sprite `cache` above (same evict-oldest pattern) —
  // in practice this stays tiny (fixed shade amounts x the UNIT_STYLE palette),
  // but an explicit bound keeps it consistent rather than implicit.
  const SHADE_CACHE_MAX = 256;
  const shadeCache = new Map();

  function shadeHex(hex, amt) {
    const key = hex + '|' + amt;
    const hit = shadeCache.get(key);
    if (hit) return hit;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 0xff;
    let g = (n >> 8) & 0xff;
    let b = n & 0xff;
    if (amt >= 0) {
      r += (255 - r) * amt;
      g += (255 - g) * amt;
      b += (255 - b) * amt;
    } else {
      r *= 1 + amt;
      g *= 1 + amt;
      b *= 1 + amt;
    }
    const out = `rgb(${r | 0},${g | 0},${b | 0})`;
    shadeCache.set(key, out);
    if (shadeCache.size > SHADE_CACHE_MAX) {
      const oldest = shadeCache.keys().next().value;
      shadeCache.delete(oldest);
    }
    return out;
  }

  /** Radial "lit sphere" gradient: bright highlight offset toward the light, dark rim. */
  function bodyGradient(ctx, cx, cy, r, hex) {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.12, cx, cy, r * 1.05);
    g.addColorStop(0, shadeHex(hex, 0.5));
    g.addColorStop(0.55, hex);
    g.addColorStop(1, shadeHex(hex, -0.4));
    return g;
  }

  /** Vertical gradient for rectangular/tall bodies (siege engines, iron colossus). */
  function bodyGradientV(ctx, x, y, h, hex) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shadeHex(hex, 0.35));
    g.addColorStop(0.6, hex);
    g.addColorStop(1, shadeHex(hex, -0.35));
    return g;
  }

  function drawMinimalMarker(ctx, style, team, r) {
    ctx.fillStyle = style.body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = teamStrokeAlt(team);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const CASTER_TYPES = new Set([
    'mage',
    'dark_mage',
    'bone_summoner',
    'warp_prophet',
    'necromancer',
    'shaman',
    'healer',
  ]);
  const MOUNTED_TYPES = new Set(['cavalry', 'warg_rider', 'nightmare_strider']);

  function drawMonsterUnit(ctx, type, team, frame, animState, lod = 0) {
    if (lod >= 3) {
      const style = resolveUnitStyle(type, team, 'behemoth');
      drawMinimalMarker(ctx, style, team, style.size * 0.82);
      return;
    }
    drawInkMonster(ctx, type, team, frame, animState);
  }

  function drawSiegeTowerUnit(ctx, style, team, frame, animState, lod = 0) {
    if (lod >= 3) {
      drawMinimalMarker(ctx, style, team, style.size * 0.75);
      return;
    }
    const r = style.size;
    const dying = animState.startsWith('die');
    // Rolling: the tower rocks on its wheels.
    const cyc = Math.floor(frame) % 4;
    const walkBob = animState === 'walk' ? [0, 1.2, 0, -1.2][cyc] : 0;
    if (!dying) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = bodyGradientV(ctx, 0, -r * 0.55 + walkBob, r * 1.1, style.body);
    ctx.fillRect(-r * 0.75, -r * 0.55 + walkBob, r * 1.5, r * 1.1);
    ctx.fillStyle = style.accent;
    ctx.fillRect(-r * 0.65, -r * 0.45 + walkBob, r * 1.3, r * 0.25);
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#3a2818';
      ctx.beginPath();
      ctx.arc(side * r * 0.85, r * 0.45 + walkBob, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = dying ? INK : teamStrokeAlt(team);
    ctx.lineWidth = 2;
    ctx.strokeRect(-r * 0.75, -r * 0.55 + walkBob, r * 1.5, r * 1.1);
    ctx.fillStyle = style.mark;
    ctx.fillRect(-3, -r * 0.2 + walkBob, 6, r * 0.5);
  }

  // ── Ink style ────────────────────────────────────────────────────────────
  // Heavy black outlines, bone and blood accents, horned and skull-faced enemies:
  // a dark horror-comic look, drawn entirely in code.
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';
  const UNDEAD_RE = /bone|skelet|revenant|necro|lich|wraith|ghoul|zombie|undead|grim|plague/;
  const SHIELD_TYPES = new Set([
    'footman',
    'knight',
    'pikeman',
    'dark_knight',
    'general',
    'orc_shieldbearer',
  ]);
  const CLOAK_TYPES = new Set(['general', 'knight', 'dark_knight', 'scout', 'assassin', 'bard']);

  const BOW_TYPES = new Set([
    'archer',
    'crossbowman',
    'orc_archer',
    'scout',
    'hellbound_legionnaire',
    'grim_revenant',
    'goblin_firebrand',
  ]);

  /**
   * The visible part of an attack, drawn in the figure's own space (forward is up):
   * a slash arc for melee, a drawn and loosed bow, a flare at the staff tip for casters.
   */
  function drawAttackFlourish(ctx, kind, f, r, style, enemy, hand) {
    ctx.save();
    ctx.lineCap = 'round';
    if (kind === 'melee') {
      if (f === 1 || f === 2) {
        // Big figures would otherwise swing the arc off the sprite canvas.
        const reach = Math.min(r * (f === 1 ? 1.9 : 2.2), 29.5 - r * 0.2);
        const from = -Math.PI * (f === 1 ? 0.95 : 0.8);
        const to = -Math.PI * (f === 1 ? 0.45 : 0.1);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, reach, from, to);
        ctx.stroke();
        ctx.strokeStyle = enemy ? '#ff5040' : BONE;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, reach, from, to);
        ctx.stroke();
      }
      if (f === 3) {
        // Follow-through: a few flecks of blood off the blade.
        ctx.fillStyle = BLOOD;
        for (const [x, y] of [
          [0.9, -1.7],
          [1.3, -1.2],
          [1.5, -0.6],
        ]) {
          ctx.beginPath();
          ctx.arc(x * r, y * r, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (kind === 'bow') {
      // A recurve held out ahead of the body: grip furthest forward, limbs sweeping
      // back to tips that flick forward again. Frames 0-1 draw, 2-3 loose.
      const bx = r * 0.6;
      const by = -r * 1.25;
      const w = r * 1.02;
      const drawn = f <= 1;
      const pull = drawn ? r * (f === 0 ? 0.7 : 1.15) : 0;
      // The limbs bend further back the harder the string is pulled.
      const flex = r * (0.2 + (pull / r) * 0.07);
      const limbs = () => {
        ctx.beginPath();
        ctx.moveTo(bx - w, by + flex - r * 0.05);
        ctx.quadraticCurveTo(bx - w * 0.9, by + flex + r * 0.16, bx - w * 0.68, by + flex * 0.9);
        ctx.quadraticCurveTo(bx - w * 0.3, by + r * 0.02, bx, by);
        ctx.quadraticCurveTo(bx + w * 0.3, by + r * 0.02, bx + w * 0.68, by + flex * 0.9);
        ctx.quadraticCurveTo(bx + w * 0.9, by + flex + r * 0.16, bx + w, by + flex - r * 0.05);
      };
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.2;
      limbs();
      ctx.stroke();
      ctx.strokeStyle = enemy ? '#9a5a40' : '#b87a38';
      ctx.lineWidth = 2.2;
      limbs();
      ctx.stroke();
      // Grip wrap
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - r * 0.1, by + r * 0.01);
      ctx.lineTo(bx + r * 0.1, by + r * 0.01);
      ctx.stroke();
      const sy = by + flex - r * 0.05;
      const nock = sy + pull;
      // String: taut to the nock while drawn, straight (and humming) once loosed.
      for (const [c, lw] of [
        [INK, 2],
        [BONE, 0.9],
      ]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(bx - w, sy);
        ctx.lineTo(bx, nock);
        ctx.lineTo(bx + w, sy);
        ctx.stroke();
      }
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.9;
      if (f === 2) {
        ctx.globalAlpha = 0.5;
        for (const d of [-0.07, 0.07]) {
          ctx.beginPath();
          ctx.moveTo(bx - w, sy);
          ctx.quadraticCurveTo(bx, sy + r * d * 2, bx + w, sy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // Never let the arrow or its streak leave the sprite canvas.
      const lim = -29;
      if (drawn) {
        const tip = Math.max(lim, by - r * (f === 0 ? 0.75 : 0.4));
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(bx, nock);
        ctx.lineTo(bx, tip + 2);
        ctx.stroke();
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, nock);
        ctx.lineTo(bx, tip + 2);
        ctx.stroke();
        // Fletching at the nock, a barbed head at the tip
        ctx.strokeStyle = enemy ? '#ff5040' : BONE;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(bx - 1.8, nock + 1.2);
        ctx.lineTo(bx, nock - 1.4);
        ctx.lineTo(bx + 1.8, nock + 1.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, tip - 2.2);
        ctx.lineTo(bx - 2.4, tip + 2.2);
        ctx.lineTo(bx + 2.4, tip + 2.2);
        ctx.closePath();
        ctx.fillStyle = enemy ? '#ff5040' : BONE;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        // Drawing hand at the nock
        ctx.beginPath();
        ctx.arc(bx, nock, r * 0.17, 0, Math.PI * 2);
        inkFill(ctx, hand || BONE, 1);
      } else {
        // Loosed: the arrow is a streak already clear of the bow.
        const head = Math.max(lim, by - r * (f === 2 ? 0.9 : 1.5));
        const tail = Math.min(by - r * 0.15, head + r * (f === 2 ? 1.0 : 0.7));
        ctx.strokeStyle = INK;
        ctx.globalAlpha = f === 2 ? 0.9 : 0.4;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(bx, tail);
        ctx.lineTo(bx, head);
        ctx.stroke();
        ctx.strokeStyle = enemy ? '#ff7a50' : BONE;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(bx, tail);
        ctx.lineTo(bx, head);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Bow hand on the grip
      ctx.beginPath();
      ctx.arc(bx, by + r * 0.08, r * 0.17, 0, Math.PI * 2);
      inkFill(ctx, hand || BONE, 1);
    } else if (kind === 'lance') {
      // Couched on the wind-up, driven straight out on the strike.
      const x = r * 0.72;
      const tip = Math.max(-26.5, -r * [1.25, 1.05, 2.5, 2.15][f]);
      const butt = tip + r * 2.3;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(x, butt);
      ctx.lineTo(x, tip + 3);
      ctx.stroke();
      ctx.strokeStyle = enemy ? '#5a4a52' : '#b08a50';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, butt);
      ctx.lineTo(x, tip + 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, tip - 2.5);
      ctx.lineTo(x - 2.6, tip + 4);
      ctx.lineTo(x + 2.6, tip + 4);
      ctx.closePath();
      inkFill(ctx, enemy ? '#ff5040' : BONE, 1.1);
      // Vamplate guarding the hand
      ctx.beginPath();
      ctx.arc(x, tip + r * 1.45, r * 0.24, 0, Math.PI * 2);
      inkFill(ctx, style.accent, 1.1);
      if (f === 2) {
        ctx.strokeStyle = enemy ? '#ff5040' : BONE;
        ctx.lineWidth = 1.4;
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + sd * 3.5, tip + 1);
          ctx.lineTo(x + sd * 7, tip - 2);
          ctx.stroke();
        }
      }
    } else if (kind === 'claw') {
      // The mount rakes with both forepaws.
      const reach = Math.max(-28, -r * [1.15, 0.95, 2.1, 1.8][f]);
      for (const sd of [-1, 1]) {
        const px = sd * r * (f >= 2 ? 0.42 : 0.62);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(sd * r * 0.4, -r * 0.55);
        ctx.lineTo(px, reach + 3);
        ctx.stroke();
        for (const k of [-1, 0, 1]) {
          ctx.beginPath();
          ctx.moveTo(px + k * 1.6 - 0.9, reach + 3);
          ctx.lineTo(px + k * 2.4, reach - 1.5);
          ctx.lineTo(px + k * 1.6 + 0.9, reach + 3);
          ctx.closePath();
          inkFill(ctx, BONE, 0.8);
        }
        if (f === 2) {
          ctx.strokeStyle = enemy ? '#ff5040' : BONE;
          ctx.lineWidth = 1.3;
          for (const k of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.moveTo(px + k * 2.6 + sd * 2, reach + r * 0.75);
            ctx.lineTo(px + k * 2.6, reach + r * 0.2);
            ctx.stroke();
          }
        }
      }
    } else {
      const cx = r * 0.55;
      const cy = -r * 1.75;
      // Flare and rays are held inside the sprite canvas.
      const glow = Math.min(2.5 + f * 1.8, 29 + cy - 3);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx, cy, glow + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.arc(cx, cy, glow, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = style.mark;
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + f * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (glow + 2), cy + Math.sin(a) * (glow + 2));
        const tipR = Math.min(glow + 5 + f, 30 + cy);
        ctx.lineTo(cx + Math.cos(a) * tipR, cy + Math.sin(a) * tipR);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function inkFill(ctx, fill, lw = 1.3) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  /** A stroke with a black edge: the basic line of the ink style. */
  function inkStroke(ctx, color, lw, edge = 1.9) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw + edge;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  function inkPoly(ctx, pts, fill, lw = 1.1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    inkFill(ctx, fill, lw);
  }

  function inkDot(ctx, x, y, rad, fill, lw = 1) {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    inkFill(ctx, fill, lw);
  }

  // ── Families: who a unit belongs to decides its skin, its accent and how it moves ──
  const FAMILY_OF = {
    goblin: 'goblin',
    goblin_sapper: 'goblin',
    goblin_engineer: 'goblin',
    goblin_burrower: 'goblin',
    goblin_firebrand: 'goblin',
    orc: 'orc',
    orc_archer: 'orc',
    orc_shieldbearer: 'orc',
    troll: 'orc',
    war_chief: 'orc',
    berserker: 'orc',
    shaman: 'orc',
    warg_rider: 'orc',
    dark_knight: 'dark',
    dark_mage: 'dark',
    assassin: 'dark',
    necromancer: 'undead',
    bone_summoner: 'undead',
    grim_revenant: 'undead',
    wailing_wraith: 'wraith',
    plague_rat: 'rat',
    hellbound_legionnaire: 'hell',
    nightmare_strider: 'hell',
    dreadborn_champion: 'hell',
    hellmortar_pack: 'hell',
    warp_prophet: 'void',
    umbral_stalker: 'void',
    harpy: 'flyer',
    sky_drake: 'flyer',
  };
  const FAMILY_SKIN = {
    goblin: '#989c6e',
    orc: '#7e8a62',
    dark: '#b0a498',
    undead: BONE,
    wraith: '#c8d0c4',
    rat: '#6a6052',
    hell: '#8c3c3a',
    void: '#5a5e70',
    flyer: '#8a7a68',
  };
  /**
   * Walk cycles. `period` is ticks per frame (four frames to a stride), `stride` how far
   * a foot reaches, `twist` how much the shoulders counter-rotate, `bob` the rise at
   * the passing frames, `feet` how wide the stance is.
   */
  const GAIT = {
    // Soldiers: an even march.
    human: { period: 6, stride: 0.72, twist: 0.13, bob: 0.04, feet: 0.4 },
    // Goblins scuttle: low, fast, zig-zagging, arms wide.
    goblin: { period: 3, stride: 0.5, twist: 0.22, bob: 0.015, feet: 0.62, lean: 0.24, zig: 0.16 },
    // Orcs stomp: wide, heavy, the shoulders rolling, dust at each footfall.
    orc: { period: 8, stride: 0.6, twist: 0.26, bob: 0.075, feet: 0.62, stomp: 1 },
    // The dead lurch: one good leg steps, the other is dragged after it.
    undead: { period: 10, stride: 0.62, twist: 0.2, bob: 0.02, feet: 0.42, lurch: 1 },
    // Wraiths have no legs: they drift and their rags trail.
    wraith: { period: 9, stride: 0, twist: 0.06, bob: 0, feet: 0, drift: 1 },
    // Mounts and beasts lope: gathered, then stretched.
    beast: { period: 4, stride: 0.5, twist: 0.05, bob: 0.03, feet: 0.4, lope: 1 },
    rat: { period: 3, stride: 0.4, twist: 0.1, bob: 0, feet: 0.5, lope: 1 },
    flyer: { period: 5, stride: 0, twist: 0.04, bob: 0.03, feet: 0, wings: 1 },
    dark: { period: 6, stride: 0.74, twist: 0.1, bob: 0.03, feet: 0.4 },
    hell: { period: 7, stride: 0.66, twist: 0.18, bob: 0.055, feet: 0.5 },
    void: { period: 5, stride: 0.6, twist: 0.08, bob: 0.01, feet: 0.36 },
  };

  function familyOf(type, team) {
    const fam = FAMILY_OF[type];
    if (fam) return fam;
    if (team === 'enemy' && UNDEAD_RE.test(type)) return 'undead';
    return 'human';
  }

  /** Ticks per walk frame for a unit type, so the frame clock can match the gait. */
  function gaitOf(type, team) {
    if (MOUNTED_TYPES.has(type)) return GAIT.beast;
    return GAIT[familyOf(type, team)] || GAIT.human;
  }

  // What each type carries and wears. w: weapon, h: headgear.
  const KIT = {
    footman: { w: 'sword', h: 'helm' },
    archer: { w: 'bow', h: 'hood' },
    crossbowman: { w: 'crossbow', h: 'helm' },
    mage: { w: 'staff', h: 'hat' },
    cavalry: { w: 'lance', h: 'helm' },
    healer: { w: 'crook', h: 'hat' },
    builder: { w: 'hammer', h: 'cap' },
    courier: { w: 'scroll', h: 'cap' },
    scout: { w: 'javelin', h: 'hood' },
    bard: { w: 'lute', h: 'cap' },
    ballista: { w: 'none', h: 'helm', engine: 'ballista' },
    pikeman: { w: 'pike', h: 'helm' },
    sapper: { w: 'bomb', h: 'helm' },
    knight: { w: 'greatsword', h: 'greathelm' },
    general: { w: 'sword', h: 'crown' },
    doomslayer_hero: { w: 'greatsword', h: 'greathelm' },
    goblin: { w: 'shortspear', h: 'bare' },
    goblin_sapper: { w: 'bomb', h: 'bare' },
    goblin_engineer: { w: 'hammer', h: 'goggles' },
    goblin_burrower: { w: 'pick', h: 'bare' },
    goblin_firebrand: { w: 'torch', h: 'bare' },
    orc: { w: 'axe', h: 'bare' },
    orc_archer: { w: 'bow', h: 'hood' },
    orc_shieldbearer: { w: 'cleaver', h: 'bare' },
    troll: { w: 'club', h: 'bare' },
    berserker: { w: 'twinaxe', h: 'horned' },
    shaman: { w: 'skullstaff', h: 'horned' },
    warg_rider: { w: 'shortspear', h: 'horned' },
    war_chief: { w: 'greataxe', h: 'crown' },
    dark_knight: { w: 'lance', h: 'greathelm' },
    dark_mage: { w: 'staff', h: 'hat' },
    assassin: { w: 'daggers', h: 'hood' },
    necromancer: { w: 'scythe', h: 'hat' },
    bone_summoner: { w: 'skullstaff', h: 'hat' },
    grim_revenant: { w: 'bow', h: 'bare' },
    wailing_wraith: { w: 'none', h: 'hood' },
    plague_rat: { w: 'none', h: 'bare' },
    hellbound_legionnaire: { w: 'bow', h: 'spiked' },
    nightmare_strider: { w: 'cleaver', h: 'spiked' },
    dreadborn_champion: { w: 'jaggedsword', h: 'spiked' },
    hellmortar_pack: { w: 'none', h: 'spiked', engine: 'mortar' },
    warp_prophet: { w: 'eyestaff', h: 'hat' },
    umbral_stalker: { w: 'daggers', h: 'hood' },
    harpy: { w: 'none', h: 'bare' },
    sky_drake: { w: 'none', h: 'bare' },
    // Evolved allies: one archetype each, told apart by hat, weapon and build.
    roster_ultimis: { w: 'musket', h: 'flatcap' },
    roster_primis: { w: 'twinblades', h: 'brimhat' },
    roster_halo: { w: 'carbine', h: 'visor', plates: 1 },
    roster_gears: { w: 'sawblade', h: 'bandana', brute: 1 },
    roster_lotr: { w: 'bow', h: 'hood', cloak: 1 },
    roster_baki: { w: 'fists', h: 'cropped', brute: 1, bare: 1 },
    roster_jojo: { w: 'fists', h: 'tallcap', spirit: 1 },
    roster_fotns: { w: 'fists', h: 'headband', bare: 1, cloak: 1 },
    roster_dragonball: { w: 'orb', h: 'topknot', sash: 1 },
    roster_imperium: { w: 'mace', h: 'crest', bigPauldrons: 1 },
    roster_crystal: { w: 'crystalspear', h: 'shards', shards: 1 },
    roster_warp: { w: 'jaggedaxe', h: 'onehorn', tentacle: 1 },
    roster_tes: { w: 'axe', h: 'hornhelm', shield: 1 },
    roster_wwe: { w: 'fists', h: 'mask', bare: 1, belt: 1 },
  };
  const DEFAULT_KIT = { w: 'sword', h: 'bare' };
  const GUN_WEAPONS = new Set(['musket', 'carbine']);

  /**
   * A weapon in the ink style. Drawn with the grip at the origin and the business end
   * toward -y. `r` is the figure radius; `pal` holds blade, haft, trim and glow colours.
   * `f` is the animation frame, for the few weapons that move on their own.
   */
  function drawInkWeapon(ctx, kind, r, pal, f = 0, firing = false, room = 27) {
    const line = (x0, y0, x1, y1, color, lw) => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      inkStroke(ctx, color, lw);
    };
    // Nothing may reach past the sprite canvas, whatever the figure's size.
    const reach = (k) => -Math.max(r * 0.7, Math.min(r * k, room));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const blade = (len, w, tipLen = 0.3) => {
      const y1 = reach(len);
      inkPoly(
        ctx,
        [
          [-w, 0],
          [-w, y1 + r * tipLen],
          [0, y1],
          [w, y1 + r * tipLen],
          [w, 0],
        ],
        pal.blade
      );
      line(-w * 2.6, 0, w * 2.6, 0, pal.trim, 1.5);
      line(0, 0, 0, r * 0.32, pal.haft, 1.5);
    };
    const haft = (len, back = 0.5, lw = 1.5) => line(0, r * back, 0, reach(len), pal.haft, lw);
    const axeHead = (y, w, h, sd = 1) =>
      inkPoly(
        ctx,
        [
          [0, y - h * 0.4],
          [sd * w, y - h],
          [sd * w * 1.25, y],
          [sd * w, y + h],
          [0, y + h * 0.4],
        ],
        pal.blade
      );
    switch (kind) {
      case 'sword':
        blade(1.55, r * 0.13);
        break;
      case 'greatsword':
        blade(2.0, r * 0.19);
        break;
      case 'jaggedsword': {
        const y1 = reach(1.9);
        const w = r * 0.2;
        inkPoly(
          ctx,
          [
            [-w, 0],
            [-w * 1.5, y1 * 0.35],
            [-w * 0.7, y1 * 0.45],
            [-w * 1.4, y1 * 0.75],
            [0, y1],
            [w, y1 * 0.8],
            [w, 0],
          ],
          pal.blade
        );
        line(-w * 2.4, 0, w * 2.4, 0, pal.trim, 1.6);
        break;
      }
      case 'cleaver': {
        const y1 = reach(1.35);
        inkPoly(
          ctx,
          [
            [-r * 0.1, 0],
            [-r * 0.1, y1],
            [r * 0.34, y1 * 0.92],
            [r * 0.34, y1 * 0.3],
            [r * 0.1, 0],
          ],
          pal.blade
        );
        line(0, 0, 0, r * 0.35, pal.haft, 1.6);
        break;
      }
      case 'daggers':
      case 'twinblades': {
        const len = kind === 'daggers' ? 0.95 : 1.3;
        blade(len, r * 0.1, 0.22);
        break;
      }
      case 'axe':
        haft(1.5);
        axeHead(reach(1.25), r * 0.42, r * 0.3);
        break;
      case 'twinaxe':
        haft(1.5);
        axeHead(reach(1.25), r * 0.4, r * 0.3);
        axeHead(reach(1.25), r * 0.4, r * 0.3, -1);
        break;
      case 'greataxe':
        haft(1.95, 0.6, 1.9);
        axeHead(reach(1.62), r * 0.52, r * 0.4);
        axeHead(reach(1.62), r * 0.3, r * 0.26, -1);
        break;
      case 'jaggedaxe': {
        haft(1.6);
        const y = reach(1.3);
        inkPoly(
          ctx,
          [
            [0, y - r * 0.2],
            [r * 0.5, y - r * 0.42],
            [r * 0.34, y - r * 0.1],
            [r * 0.6, y + r * 0.08],
            [r * 0.3, y + r * 0.16],
            [r * 0.42, y + r * 0.42],
            [0, y + r * 0.2],
          ],
          pal.blade
        );
        break;
      }
      case 'sawblade': {
        // A broad blade with a toothed edge.
        const y1 = reach(1.6);
        const pts = [
          [-r * 0.14, 0],
          [-r * 0.14, y1],
          [r * 0.1, y1],
        ];
        for (let i = 0; i < 5; i++) {
          const y = y1 + ((0 - y1) * (i + 0.5)) / 5.5;
          pts.push([r * 0.3, y - r * 0.02], [r * 0.12, y + r * 0.1]);
        }
        pts.push([r * 0.12, 0]);
        inkPoly(ctx, pts, pal.blade);
        line(-r * 0.3, 0, r * 0.3, 0, pal.trim, 1.6);
        break;
      }
      case 'club': {
        const y1 = reach(1.55);
        inkPoly(
          ctx,
          [
            [-r * 0.1, r * 0.3],
            [-r * 0.26, y1 * 0.8],
            [-r * 0.16, y1],
            [r * 0.16, y1],
            [r * 0.26, y1 * 0.8],
            [r * 0.1, r * 0.3],
          ],
          pal.haft
        );
        for (const [x, y] of [
          [-0.3, 0.86],
          [0.3, 0.7],
          [-0.28, 0.58],
        ])
          inkPoly(
            ctx,
            [
              [x * r * 0.8, y1 * y - 1.4],
              [x * r * 1.5, y1 * y],
              [x * r * 0.8, y1 * y + 1.4],
            ],
            BONE,
            0.8
          );
        break;
      }
      case 'mace': {
        haft(1.35);
        const y = reach(1.35);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          line(0, y, Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36, pal.blade, 1.3);
        }
        inkDot(ctx, 0, y, r * 0.22, pal.blade);
        break;
      }
      case 'hammer': {
        haft(1.15, 0.3);
        const y = reach(1.15);
        inkPoly(
          ctx,
          [
            [-r * 0.36, y - r * 0.17],
            [r * 0.3, y - r * 0.17],
            [r * 0.3, y + r * 0.17],
            [-r * 0.36, y + r * 0.17],
          ],
          pal.blade
        );
        break;
      }
      case 'pick': {
        haft(1.2, 0.3);
        const y = reach(1.15);
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, y + r * 0.22);
        ctx.quadraticCurveTo(0, y - r * 0.22, r * 0.5, y + r * 0.22);
        inkStroke(ctx, pal.blade, 1.8);
        break;
      }
      case 'pike':
      case 'javelin':
      case 'shortspear':
      case 'lance':
      case 'crystalspear': {
        const len = { pike: 2.55, javelin: 1.7, shortspear: 1.55, lance: 2.3, crystalspear: 2.1 }[
          kind
        ];
        const y1 = reach(len);
        haft(
          len - 0.2,
          kind === 'pike' || kind === 'lance' ? 0.9 : 0.5,
          kind === 'lance' ? 2 : 1.4
        );
        const hw = r * (kind === 'crystalspear' ? 0.2 : 0.14);
        inkPoly(
          ctx,
          [
            [0, y1],
            [hw, y1 + r * 0.3],
            [0, y1 + r * (kind === 'crystalspear' ? 0.6 : 0.42)],
            [-hw, y1 + r * 0.3],
          ],
          kind === 'crystalspear' ? pal.glow : pal.blade
        );
        if (kind === 'lance') inkDot(ctx, 0, -r * 0.1, r * 0.2, pal.trim);
        if (kind === 'pike')
          inkPoly(
            ctx,
            [
              [0, y1 + r * 0.5],
              [r * 0.5, y1 + r * 0.6],
              [0, y1 + r * 0.78],
            ],
            pal.trim,
            0.9
          );
        break;
      }
      case 'staff':
      case 'crook':
      case 'skullstaff':
      case 'eyestaff': {
        haft(1.75, 0.7);
        const y = reach(1.75);
        if (kind === 'crook') {
          ctx.beginPath();
          ctx.arc(-r * 0.2, y, r * 0.2, Math.PI * 0.1, Math.PI * 1.25, true);
          inkStroke(ctx, pal.haft, 1.5);
          inkDot(ctx, -r * 0.2, y, r * 0.09, pal.glow, 0.8);
        } else if (kind === 'skullstaff') {
          inkDot(ctx, 0, y, r * 0.24, BONE);
          ctx.fillStyle = INK;
          ctx.fillRect(-r * 0.14, y - r * 0.08, r * 0.09, r * 0.1);
          ctx.fillRect(r * 0.05, y - r * 0.08, r * 0.09, r * 0.1);
        } else {
          inkDot(ctx, 0, y, r * 0.22, pal.glow);
          if (kind === 'eyestaff') {
            ctx.fillStyle = INK;
            ctx.beginPath();
            ctx.ellipse(0, y, r * 0.06, r * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'scythe': {
        haft(1.8, 0.7);
        const y = reach(1.75);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(-r * 0.75, y - r * 0.12, -r * 0.95, y + r * 0.5);
        ctx.quadraticCurveTo(-r * 0.55, y + r * 0.2, 0, y + r * 0.22);
        ctx.closePath();
        inkFill(ctx, pal.blade, 1.1);
        break;
      }
      case 'bow': {
        // Carried strung, held upright at the side.
        ctx.beginPath();
        ctx.moveTo(0, r * 0.75);
        ctx.quadraticCurveTo(r * 0.55, -r * 0.35, 0, -r * 1.45);
        inkStroke(ctx, pal.haft, 1.5);
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.75);
        ctx.lineTo(0, -r * 1.45);
        ctx.stroke();
        break;
      }
      case 'crossbow': {
        line(0, r * 0.35, 0, -r * 1.2, pal.haft, 2);
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.72);
        ctx.quadraticCurveTo(0, -r * 1.25, r * 0.62, -r * 0.72);
        inkStroke(ctx, pal.blade, 1.5);
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-r * 0.62, -r * 0.72);
        ctx.lineTo(r * 0.62, -r * 0.72);
        ctx.stroke();
        break;
      }
      case 'musket':
      case 'carbine': {
        const len = kind === 'musket' ? 1.9 : 1.3;
        // Leave room past the muzzle for the bayonet and the flash.
        const y1 = Math.min(-r * 0.7, reach(len) + r * 0.75);
        line(0, r * 0.45, 0, -r * 0.2, pal.haft, 2.6);
        line(0, -r * 0.2, 0, y1, pal.blade, 1.5);
        if (kind === 'musket') line(0, y1, 0, y1 - r * 0.3, BONE, 0.9);
        else line(r * 0.16, -r * 0.5, r * 0.16, -r * 0.15, pal.trim, 1.4);
        if (firing) {
          const my = y1 - (kind === 'musket' ? r * 0.3 : 0);
          for (let i = -2; i <= 2; i++) {
            const a = -Math.PI / 2 + i * 0.42;
            const l = r * (i === 0 ? 0.62 : 0.42);
            line(
              Math.cos(a) * 2,
              my + Math.sin(a) * 2,
              Math.cos(a) * l,
              my + Math.sin(a) * l,
              BONE,
              1.2
            );
          }
        }
        break;
      }
      case 'bomb': {
        inkDot(ctx, 0, -r * 0.5, r * 0.3, '#1c1a18');
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.8);
        ctx.quadraticCurveTo(r * 0.25, -r * 1.0, r * 0.12, -r * 1.15);
        inkStroke(ctx, BONE, 0.9, 1.2);
        ctx.fillStyle = f % 2 ? '#ffd040' : '#e0701c';
        ctx.fillRect(r * 0.12 - 1, -r * 1.15 - 2, 2.2, 2.2);
        break;
      }
      case 'torch': {
        haft(1.1, 0.3);
        const y = reach(1.1);
        const lick = f % 2 ? 0.12 : 0;
        inkPoly(
          ctx,
          [
            [-r * 0.22, y],
            [-r * 0.1, y - r * (0.3 + lick)],
            [0, y - r * 0.18],
            [r * 0.08, y - r * (0.62 - lick)],
            [r * 0.24, y],
          ],
          '#e0701c',
          1
        );
        ctx.fillStyle = '#ffd040';
        ctx.fillRect(-1.2, y - r * 0.16, 2.4, 2.4);
        break;
      }
      case 'lute': {
        line(0, -r * 0.4, 0, -r * 1.3, pal.haft, 1.5);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.1, r * 0.32, r * 0.42, 0, 0, Math.PI * 2);
        inkFill(ctx, pal.haft);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(0, -r * 0.18, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'scroll': {
        inkPoly(
          ctx,
          [
            [-r * 0.14, -r * 0.1],
            [r * 0.14, -r * 0.1],
            [r * 0.14, -r * 0.85],
            [-r * 0.14, -r * 0.85],
          ],
          BONE
        );
        line(-r * 0.14, -r * 0.48, r * 0.14, -r * 0.48, pal.trim, 1.3);
        break;
      }
      case 'orb': {
        // Held between both hands, ahead of the body.
        inkDot(ctx, 0, -r * 0.45, r * (0.26 + (f % 2) * 0.04), pal.glow);
        ctx.fillStyle = BONE;
        ctx.beginPath();
        ctx.arc(-r * 0.07, -r * 0.52, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'fists':
        // Wrapped knuckles: the hand itself is the weapon.
        inkDot(ctx, 0, -r * 0.3, r * 0.24, BONE);
        line(-r * 0.2, -r * 0.3, r * 0.2, -r * 0.3, pal.trim, 0.9);
        break;
      default:
        break;
    }
  }

  /** Crew-served engines, drawn ahead of the man who works them. */
  function drawEngine(ctx, kind, r, pal, f, attacking) {
    ctx.lineCap = 'round';
    if (kind === 'ballista') {
      const flex = attacking ? [0.2, 0.34, -0.05, 0][f] : 0;
      // Trail and wheels
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sd * r * 0.85, -r * 0.55, r * 0.16, r * 0.34, 0, 0, Math.PI * 2);
        inkFill(ctx, '#3a2e28');
      }
      inkPoly(
        ctx,
        [
          [-r * 0.24, -r * 0.1],
          [r * 0.24, -r * 0.1],
          [r * 0.2, -r * 1.75],
          [-r * 0.2, -r * 1.75],
        ],
        pal.haft
      );
      // Bow arms and string
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, -r * (1.15 - flex));
      ctx.quadraticCurveTo(0, -r * 1.9, r * 1.15, -r * (1.15 - flex));
      inkStroke(ctx, pal.blade, 2);
      const pull = attacking && f <= 1 ? r * (0.5 + f * 0.3) : 0;
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, -r * (1.15 - flex));
      ctx.lineTo(0, -r * 1.2 + pull);
      ctx.lineTo(r * 1.15, -r * (1.15 - flex));
      ctx.stroke();
      // The bolt: on the slide while loaded, gone once loosed
      if (!attacking || f <= 1) {
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.15 + pull);
        ctx.lineTo(0, -r * 2.15 + pull);
        inkStroke(ctx, BONE, 1.2);
        inkPoly(
          ctx,
          [
            [0, -r * 2.4 + pull],
            [r * 0.14, -r * 2.1 + pull],
            [-r * 0.14, -r * 2.1 + pull],
          ],
          pal.trim,
          0.9
        );
      } else if (f === 2) {
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 1.2;
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sd * r * 0.3, -r * 2.0);
          ctx.lineTo(sd * r * 0.5, -r * 2.3);
          ctx.stroke();
        }
      }
    } else {
      // Hell mortar: a squat black barrel on a sled, glowing at the mouth.
      const kick = attacking ? [0, -0.05, 0.16, 0.06][f] : 0;
      inkPoly(
        ctx,
        [
          [-r * 0.7, -r * 0.35],
          [r * 0.7, -r * 0.35],
          [r * 0.55, -r * 1.25],
          [-r * 0.55, -r * 1.25],
        ],
        pal.haft
      );
      ctx.beginPath();
      ctx.ellipse(0, -r * (1.0 - kick), r * 0.5, r * 0.6, 0, 0, Math.PI * 2);
      inkFill(ctx, '#1c1a18', 1.5);
      ctx.beginPath();
      ctx.ellipse(0, -r * (1.2 - kick), r * 0.3, r * 0.24, 0, 0, Math.PI * 2);
      inkFill(ctx, attacking && f >= 1 ? '#ffd040' : pal.trim, 1);
      if (attacking && f === 2) {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#ffd040';
        for (let i = -2; i <= 2; i++) {
          const a = -Math.PI / 2 + i * 0.45;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.45, -r * 1.2 + Math.sin(a) * r * 0.4);
          ctx.lineTo(Math.cos(a) * r * 0.85, -r * 1.2 + Math.sin(a) * r * 0.85);
          ctx.stroke();
        }
      }
    }
  }

  /** Headgear, drawn over the head disc at (0, hy). Forward is -y. */
  function drawHeadgear(ctx, kind, type, hy, hr, style, pal, enemy) {
    const arcCap = (fill, k = 1.06) => {
      ctx.beginPath();
      ctx.arc(0, hy, hr * k, -Math.PI * 0.05, Math.PI * 1.05);
      ctx.closePath();
      inkFill(ctx, fill);
    };
    const horns = (spread, len, lw = 1.6) => {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * hr * 0.6, hy);
        ctx.quadraticCurveTo(
          side * hr * spread,
          hy - hr * 0.2,
          side * hr * (spread - 0.6),
          hy - hr * len
        );
        inkStroke(ctx, BONE, lw);
      }
    };
    switch (kind) {
      case 'helm':
        arcCap(enemy ? '#57534e' : '#9aa4b0');
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, hy + hr * 1.05);
        ctx.lineTo(0, hy - hr * 0.05);
        ctx.stroke();
        break;
      case 'greathelm': {
        inkDot(ctx, 0, hy, hr * 1.08, enemy ? '#1a1420' : '#b4bcc6', 1.3);
        ctx.fillStyle = INK;
        ctx.fillRect(-hr * 0.7, hy - hr * 0.55, hr * 1.4, hr * 0.22);
        ctx.beginPath();
        ctx.ellipse(0, hy + hr * 1.3, hr * 0.32, hr * 1.1, 0, 0, Math.PI * 2);
        inkFill(ctx, enemy ? BLOOD : pal.accent, 1);
        if (type === 'dark_knight') horns(2.1, 2, 1.6);
        break;
      }
      case 'hood':
        ctx.beginPath();
        ctx.arc(0, hy + hr * 0.15, hr * 1.14, -Math.PI * 0.1, Math.PI * 1.1);
        ctx.lineTo(0, hy + hr * 1.75);
        ctx.closePath();
        inkFill(ctx, shadeHex(style.body, -0.38));
        break;
      case 'hat': {
        // A pointed hat or cowl sweeping back.
        inkPoly(
          ctx,
          [
            [-hr * 1.05, hy - hr * 0.1],
            [hr * 1.05, hy - hr * 0.1],
            [hr * 0.25, hy + hr * 2.6],
          ],
          type === 'healer' ? '#ece6d4' : shadeHex(style.body, enemy ? -0.2 : -0.45),
          1.2
        );
        ctx.fillStyle = type === 'healer' ? BLOOD : pal.accent;
        ctx.fillRect(-hr * 0.8, hy + hr * 0.25, hr * 1.6, hr * 0.3);
        if (type === 'healer') {
          ctx.fillRect(-hr * 0.15, hy + hr * 0.7, hr * 0.3, hr * 1.1);
          ctx.fillRect(-hr * 0.5, hy + hr * 1.05, hr, hr * 0.3);
        }
        break;
      }
      case 'cap':
        arcCap(type === 'builder' ? '#8a7f6a' : type === 'bard' ? '#5d564a' : '#77705f');
        if (type !== 'builder') {
          // A feather
          ctx.beginPath();
          ctx.moveTo(hr * 0.5, hy);
          ctx.quadraticCurveTo(hr * 1.8, hy + hr * 0.6, hr * 1.2, hy + hr * 2);
          inkStroke(ctx, type === 'bard' ? pal.accent : BONE, 1.2, 1.4);
        }
        break;
      case 'crown': {
        if (!enemy) arcCap('#b4bcc6');
        for (let i = -2; i <= 2; i++) {
          const a = -Math.PI / 2 + i * 0.45;
          inkPoly(
            ctx,
            [
              [Math.cos(a - 0.16) * hr, hy + Math.sin(a - 0.16) * hr],
              [Math.cos(a) * hr * 1.7, hy + Math.sin(a) * hr * 1.7],
              [Math.cos(a + 0.16) * hr, hy + Math.sin(a + 0.16) * hr],
            ],
            BONE,
            1
          );
        }
        if (enemy) horns(2.2, 1.6, 1.8);
        break;
      }
      case 'horned':
        horns(2.1, 2);
        break;
      case 'spiked': {
        // A black iron cap with a row of ember-lit spikes.
        arcCap('#1c1a18');
        for (const x of [-0.6, 0, 0.6])
          inkPoly(
            ctx,
            [
              [x * hr - hr * 0.2, hy + hr * 0.2],
              [x * hr, hy + hr * (x === 0 ? 1.7 : 1.3)],
              [x * hr + hr * 0.2, hy + hr * 0.2],
            ],
            pal.accent,
            0.9
          );
        break;
      }
      case 'goggles':
        ctx.fillStyle = INK;
        ctx.fillRect(-hr, hy - hr * 0.2, hr * 2, hr * 0.3);
        inkDot(ctx, -hr * 0.4, hy - hr * 0.45, hr * 0.3, pal.accent, 0.9);
        inkDot(ctx, hr * 0.4, hy - hr * 0.45, hr * 0.3, pal.accent, 0.9);
        break;
      // ── Evolved allies ──
      case 'flatcap':
        inkDot(ctx, 0, hy + hr * 0.1, hr * 1.05, '#57534e');
        ctx.beginPath();
        ctx.ellipse(0, hy - hr * 0.85, hr * 0.8, hr * 0.42, 0, 0, Math.PI * 2);
        inkFill(ctx, '#3a3632');
        break;
      case 'brimhat':
        ctx.beginPath();
        ctx.ellipse(0, hy, hr * 1.9, hr * 1.6, 0, 0, Math.PI * 2);
        inkFill(ctx, '#5d564a', 1.3);
        inkDot(ctx, 0, hy, hr * 0.9, '#77705f');
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, hy, hr * 0.98, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'visor':
        inkDot(ctx, 0, hy, hr * 1.12, '#aab0b0', 1.3);
        ctx.beginPath();
        ctx.arc(0, hy, hr * 0.86, -Math.PI * 0.86, -Math.PI * 0.14);
        ctx.closePath();
        inkFill(ctx, pal.accent, 1);
        ctx.beginPath();
        ctx.moveTo(hr * 0.8, hy + hr * 0.5);
        ctx.lineTo(hr * 1.5, hy + hr * 1.9);
        inkStroke(ctx, BONE, 0.8, 1.2);
        break;
      case 'bandana':
        ctx.beginPath();
        ctx.arc(0, hy, hr * 1.04, -Math.PI * 0.95, -Math.PI * 0.05);
        ctx.closePath();
        inkFill(ctx, '#2a2622');
        for (const dx of [0.25, 0.6]) {
          ctx.beginPath();
          ctx.moveTo(hr * 0.2, hy + hr * 0.9);
          ctx.quadraticCurveTo(hr * (dx + 0.6), hy + hr * 1.6, hr * dx, hy + hr * 2.5);
          inkStroke(ctx, '#2a2622', 1.4, 1.2);
        }
        break;
      case 'cropped':
        ctx.beginPath();
        ctx.arc(0, hy + hr * 0.1, hr * 0.8, 0, Math.PI);
        ctx.closePath();
        inkFill(ctx, '#2a2622', 0.9);
        break;
      case 'tallcap':
        inkPoly(
          ctx,
          [
            [-hr * 0.95, hy - hr * 0.3],
            [hr * 0.95, hy - hr * 0.3],
            [hr * 0.8, hy + hr * 1.5],
            [-hr * 0.8, hy + hr * 1.5],
          ],
          '#3a3632'
        );
        ctx.fillStyle = pal.accent;
        ctx.fillRect(-hr * 0.9, hy - hr * 0.1, hr * 1.8, hr * 0.3);
        break;
      case 'headband':
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, hy, hr * 0.98, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (const dx of [-0.5, 0.3]) {
          ctx.beginPath();
          ctx.moveTo(0, hy + hr);
          ctx.quadraticCurveTo(hr * dx * 2, hy + hr * 2, hr * dx, hy + hr * 3.1);
          inkStroke(ctx, pal.accent, 1.2, 1.2);
        }
        break;
      case 'topknot':
        ctx.beginPath();
        ctx.arc(0, hy + hr * 0.15, hr * 0.92, -Math.PI * 0.02, Math.PI * 1.02);
        ctx.closePath();
        inkFill(ctx, '#2a2622', 0.9);
        inkDot(ctx, 0, hy + hr * 1.15, hr * 0.42, '#2a2622');
        break;
      case 'crest':
        inkDot(ctx, 0, hy, hr * 1.1, '#b4bcc6', 1.3);
        ctx.fillStyle = INK;
        ctx.fillRect(-hr * 0.12, hy - hr * 0.95, hr * 0.24, hr * 0.7);
        ctx.fillRect(-hr * 0.5, hy - hr * 0.6, hr, hr * 0.2);
        inkPoly(
          ctx,
          [
            [-hr * 1.75, hy + hr * 0.1],
            [hr * 1.75, hy + hr * 0.1],
            [hr * 1.4, hy + hr * 0.62],
            [-hr * 1.4, hy + hr * 0.62],
          ],
          pal.accent
        );
        break;
      case 'shards':
        for (let i = -2; i <= 2; i++) {
          const a = Math.PI / 2 + i * 0.5;
          inkPoly(
            ctx,
            [
              [Math.cos(a - 0.2) * hr * 0.9, hy + Math.sin(a - 0.2) * hr * 0.9],
              [Math.cos(a) * hr * (i % 2 ? 1.7 : 2.2), hy + Math.sin(a) * hr * (i % 2 ? 1.7 : 2.2)],
              [Math.cos(a + 0.2) * hr * 0.9, hy + Math.sin(a + 0.2) * hr * 0.9],
            ],
            '#bcd6e4',
            0.9
          );
        }
        break;
      case 'onehorn':
        arcCap('#57534e');
        ctx.beginPath();
        ctx.moveTo(-hr * 0.5, hy);
        ctx.bezierCurveTo(
          -hr * 2.2,
          hy + hr * 0.4,
          -hr * 2.4,
          hy - hr * 1.6,
          -hr * 1.3,
          hy - hr * 1.5
        );
        inkStroke(ctx, BONE, 1.8);
        break;
      case 'hornhelm':
        arcCap('#8f9aa8', 1.1);
        for (const side of [-1, 1])
          inkPoly(
            ctx,
            [
              [side * hr * 0.85, hy - hr * 0.3],
              [side * hr * 2.0, hy - hr * 0.75],
              [side * hr * 0.95, hy + hr * 0.4],
            ],
            BONE,
            1
          );
        break;
      case 'mask':
        inkDot(ctx, 0, hy, hr * 1.04, BONE, 1.2);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(-hr * 0.5, hy - hr * 0.9, hr * 0.26, hr * 1.8);
        ctx.fillRect(hr * 0.24, hy - hr * 0.9, hr * 0.26, hr * 1.8);
        ctx.fillStyle = INK;
        ctx.fillRect(-hr * 0.55, hy - hr * 0.5, hr * 0.36, hr * 0.2);
        ctx.fillRect(hr * 0.19, hy - hr * 0.5, hr * 0.36, hr * 0.2);
        break;
      default:
        break;
    }
  }

  /** Plague rat: a quadruped, drawn nose-forward. */
  function drawRat(ctx, r, style, s, walk) {
    const stretch = walk ? 1 + s * 0.14 : 1;
    // Tail
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(r * (0.9 * s + 0.4), r * 1.6, -r * 0.7, r * 2.1, r * 0.2 * s, r * 2.7);
    inkStroke(ctx, style.mark, 1.3);
    // Paws
    for (const [sx, y, ph] of [
      [-1, -0.55, 1],
      [1, -0.55, -1],
      [-1, 0.6, -1],
      [1, 0.6, 1],
    ]) {
      ctx.beginPath();
      ctx.ellipse(
        sx * r * 0.85,
        r * (y - (walk ? ph * s * 0.4 : 0)),
        r * 0.22,
        r * 0.3,
        0,
        0,
        Math.PI * 2
      );
      inkFill(ctx, style.mark, 1);
    }
    ctx.beginPath();
    ctx.ellipse(0, r * 0.1, r * 0.8, r * 1.15 * stretch, 0, 0, Math.PI * 2);
    inkFill(ctx, style.body, 1.5);
    // Sores along the back
    ctx.fillStyle = style.accent;
    for (const [x, y] of [
      [-0.3, 0.3],
      [0.25, 0.6],
      [0.1, -0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    // Head, ears, eyes
    for (const sd of [-1, 1]) inkDot(ctx, sd * r * 0.5, -r * 0.95, r * 0.26, style.mark, 1);
    inkPoly(
      ctx,
      [
        [-r * 0.5, -r * 0.9],
        [r * 0.5, -r * 0.9],
        [0, -r * 2.0 * (walk ? 1 + s * 0.05 : 1)],
      ],
      shadeHex(style.body, 0.15),
      1.3
    );
    ctx.fillStyle = '#ff3a1c';
    ctx.fillRect(-r * 0.28, -r * 1.3, r * 0.14, r * 0.14);
    ctx.fillRect(r * 0.14, -r * 1.3, r * 0.14, r * 0.14);
  }

  function drawInkFigure(ctx, type, rotation, team, frame, animState) {
    const style = resolveUnitStyle(type, team, 'footman');
    const kit = KIT[type] || (type.startsWith('roster_') ? KIT.roster_ultimis : DEFAULT_KIT);
    const r = style.size * 1.3;
    const enemy = team === 'enemy';
    const fam = familyOf(type, team);
    const mounted = MOUNTED_TYPES.has(type);
    const gait = mounted ? GAIT.beast : GAIT[fam] || GAIT.human;
    const fi = Math.max(0, Math.floor(frame));
    const dying = animState.startsWith('die');
    const walk = animState === 'walk';
    const rout = animState === 'rout';
    const moving = walk || rout;
    const attacking = animState === 'attack';
    const hurt = animState === 'hurt' || dying;
    const cheer = animState === 'celebrate';
    const healing = animState === 'heal';
    const building = animState === 'build';
    const idle = animState === 'idle';
    const swingFrame = attacking || building ? Math.min(3, fi) : 0;
    // Step back on the wind-up, then drive forward as the blow lands.
    const lunge = attacking ? [-3, -1, 5, 3][swingFrame] : building ? [-1, 0, 2, 1][swingFrame] : 0;
    const undead = fam === 'undead' || fam === 'wraith';
    const wraith = fam === 'wraith';
    const flyer = fam === 'flyer';
    const caster = CASTER_TYPES.has(type);
    const gun = GUN_WEAPONS.has(kit.w);
    const fightKind =
      BOW_TYPES.has(type) || kit.w === 'bow'
        ? 'bow'
        : type === 'cavalry' || type === 'dark_knight'
          ? 'lance'
          : mounted
            ? 'claw'
            : caster || kit.w === 'orb'
              ? 'cast'
              : gun || kit.engine
                ? 'shoot'
                : 'melee';
    const greenskin = fam === 'goblin' || fam === 'orc';
    const skin = enemy ? FAMILY_SKIN[fam] || '#b0a498' : '#d9b08c';
    const brute =
      !!kit.brute ||
      type === 'orc' ||
      type === 'orc_shieldbearer' ||
      type === 'troll' ||
      type === 'war_chief' ||
      type === 'berserker' ||
      type === 'dreadborn_champion';
    const pal = {
      blade: enemy ? '#8f8a86' : BONE,
      haft: enemy ? '#3a302a' : '#5a4a38',
      trim: style.accent,
      glow: caster || kit.w === 'orb' || kit.w === 'crystalspear' ? style.mark : style.accent,
      accent: style.accent,
    };

    // ── Pose ──
    // s: stride phase (-1..1, +1 = left foot forward). pass: the high frame between.
    const cyc = fi % 4;
    // The passing frames keep a little of the stride so all four frames differ.
    const s = moving ? [1, 0.28, -1, -0.28][cyc] : 0;
    const pass = moving && cyc % 2 === 1;
    const strideK = rout ? 1.3 : 1;
    let grow = pass ? 1 + gait.bob : 1;
    let twist = -s * gait.twist * (rout ? 1.4 : 1);
    let dx = moving && gait.zig ? s * gait.zig * r : 0;
    let dy = 0;
    let headTurn = 0;
    let lean = (gait.lean || 0) + (rout ? 0.18 : 0);
    let breath = 0;
    let shift = 0;
    if (idle) {
      // 0 rest, 1 breath in, 2/3 weight on the left/right foot, 4/5 a look to either side.
      breath = fi === 1 ? 1 : 0;
      shift = fi === 2 ? -1 : fi === 3 ? 1 : 0;
      headTurn = fi === 4 ? -0.6 : fi === 5 ? 0.6 : 0;
      grow = 1 + breath * 0.035;
      dx = shift * r * 0.09;
      twist = shift * 0.07;
    }
    if (moving && gait.lurch) {
      // The good leg steps and the body is hauled over it; then the dead leg follows.
      twist = [0.2, 0.08, -0.1, 0][cyc];
      dx = [0.12, 0.05, -0.06, 0][cyc] * r;
      dy = [-0.1, 0, 0.06, 0][cyc] * r;
      headTurn = [0.25, 0.1, -0.15, 0][cyc];
    }
    if (moving && gait.drift) dx = [0.14, 0.05, -0.14, -0.05][cyc] * r;
    if (rout) headTurn = cyc < 2 ? 2.2 : -1.9;
    const vet = cheer && fi >= 4;
    if (cheer) {
      // The line cheers with a hop; veterans only lift the blade and nod.
      grow = vet ? 1 + (fi % 2) * 0.015 : [1, 1.08, 1.02, 0.98][cyc];
      headTurn = vet ? 0 : [0, -0.2, 0, 0.2][cyc];
    }
    if (healing) {
      // Bent over the wounded.
      dy = -r * 0.14;
      grow = 0.95;
      lean = 0.22;
    }

    // Ground shadow and team mark stay unrotated so facing never hides them.
    if (!dying) {
      const floatUp = wraith || flyer;
      ctx.fillStyle = floatUp ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(
        floatUp ? 3.5 : 1.5,
        floatUp ? 6 : 3,
        r * (floatUp ? 0.95 : 1.2),
        r * (floatUp ? 0.6 : 0.85),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 1.5, r * 1.22, r * 0.95, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = teamStrokeAlt(team);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(((rotation + 90) * Math.PI) / 180);
    ctx.translate(dx, dy - lunge * 0.5);
    if (hurt) {
      // Flinch: knocked back off the front foot, twisted away from the blow.
      ctx.translate(-r * 0.12, r * 0.34);
      ctx.rotate(0.2);
      ctx.scale(1.04, 0.9);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (fam === 'rat') {
      drawRat(ctx, r, style, s, moving);
      if (attacking && swingFrame >= 1)
        drawAttackFlourish(ctx, 'melee', swingFrame, r, style, enemy);
      drawHurtFlecks(ctx, r, hurt);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    // Mount under the rider
    if (mounted) {
      const hide = type === 'cavalry' ? '#3a2e28' : type === 'warg_rider' ? '#34343c' : '#1c0c12';
      // Rearing: the forequarters swell and the head tosses forward, peaking on the wind-up.
      const rear = attacking ? [0.6, 1, 0.35, 0.1][swingFrame] : 0;
      // Lope: gathered (0), reaching (1), full stretch (2), landing (3).
      const ext = moving ? [-0.14, 0.06, 0.16, 0.02][cyc] : 0;
      const paw = type === 'cavalry' ? '#1c1a18' : hide;
      for (const [sx, base, ph] of [
        [-1, -1.0, 1],
        [1, -1.0, 0.6],
        [-1, 1.35, -1],
        [1, 1.35, -0.6],
      ]) {
        const py = base + (moving ? ext * 2.6 * ph : 0);
        ctx.beginPath();
        ctx.ellipse(sx * r * 0.5, r * py, r * 0.17, r * 0.3, 0, 0, Math.PI * 2);
        inkFill(ctx, paw, 1);
      }
      // Tail streams behind
      ctx.beginPath();
      ctx.moveTo(0, r * 1.6);
      ctx.quadraticCurveTo(r * (0.5 - ext * 3), r * 2, r * (0.2 + s * 0.25), r * (2.2 + ext));
      inkStroke(ctx, hide, 1.6);
      ctx.beginPath();
      ctx.ellipse(
        0,
        r * (0.3 - rear * 0.06),
        r * (0.62 + rear * 0.1 - ext * 0.3),
        r * (1.4 + ext),
        0,
        0,
        Math.PI * 2
      );
      inkFill(ctx, hide);
      ctx.beginPath();
      ctx.ellipse(
        0,
        -r * (1.25 + rear * 0.16 + ext * 1.3),
        r * (0.32 + rear * 0.07),
        r * (0.5 + rear * 0.08),
        0,
        0,
        Math.PI * 2
      );
      inkFill(ctx, shadeHex(hide, 0.14));
      if (type !== 'cavalry') {
        // Wargs and nightmares: lit eyes
        ctx.fillStyle = '#ff3a1c';
        for (const sd of [-1, 1])
          ctx.fillRect(sd * r * 0.16 - 0.7, -r * (1.45 + ext * 1.3), 1.4, 1.4);
      }
      if (rear > 0.5) {
        ctx.fillStyle = type === 'cavalry' ? INK : '#ff3a1c';
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(sd * r * 0.14, -r * (1.6 + rear * 0.16), r * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // The rider rocks back as the mount stretches.
      ctx.translate(0, ext * r * 0.6);
    }

    // The bound spirit: a pale double standing behind its master.
    if (kit.spirit) {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.translate(-r * 0.75, r * 0.95 + breath * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
      inkFill(ctx, style.mark, 1.2);
      inkDot(ctx, 0, -r * 0.1, r * 0.44, BONE, 1.1);
      ctx.fillStyle = INK;
      ctx.fillRect(-r * 0.28, -r * 0.28, r * 0.2, r * 0.1);
      ctx.fillRect(r * 0.08, -r * 0.28, r * 0.2, r * 0.1);
      ctx.restore();
    }

    // Cloak, robe or a wraith's rags trailing behind, with a ragged hem
    const cloaked = caster || CLOAK_TYPES.has(type) || undead || !!kit.cloak;
    if (cloaked) {
      const cloth =
        type === 'general' || type === 'knight'
          ? style.mark === STEEL
            ? '#3f5d7e'
            : style.mark
          : type === 'dark_knight'
            ? BLOOD
            : undead
              ? '#26232a'
              : shadeHex(style.body, enemy ? -0.3 : -0.42);
      // The hem swings against the stride and streams when running.
      const sw = (moving ? -s * 0.22 : shift * -0.08) * r;
      const len = (rout ? 1.3 : pass ? 1.1 : 1) * (wraith ? 1.75 : 1) + breath * 0.04;
      const wave = wraith && moving ? [0.2, 0.08, -0.2, -0.08][cyc] * r : 0;
      inkPoly(
        ctx,
        [
          [-r * 0.9, -r * 0.1],
          [r * 0.9, -r * 0.1],
          [r * 0.75 + sw + wave, r * 1.1 * len],
          [r * 0.4 + sw, r * 0.85 * len],
          [r * 0.1 + sw * 1.4 - wave, r * 1.3 * len],
          [-r * 0.25 + sw, r * 0.9 * len],
          [-r * 0.6 + sw * 1.2 + wave, r * 1.2 * len],
        ],
        cloth
      );
    }

    // Feet
    if (!mounted && gait.feet > 0) {
      // Light enough to read against dark ground by day and by night.
      const boot = enemy ? '#6a5f58' : '#9a8a6c';
      const fw = r * gait.feet;
      const foot = (x, y, k = 1) => {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.2 * k, r * 0.34 * k, 0, 0, Math.PI * 2);
        inkFill(ctx, boot, 1);
      };
      if (moving && gait.lurch) {
        // Right leg steps; the left is dragged, scoring the ground behind it.
        const lead = [-0.85, -0.45, -0.2, -0.5][cyc] * r;
        const drag = [0.95, 1.05, 0.8, 0.55][cyc] * r;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-fw - 1, drag + r * 0.3);
        ctx.lineTo(-fw - 1.5, drag + r * 0.85);
        ctx.moveTo(-fw + 1.5, drag + r * 0.3);
        ctx.lineTo(-fw + 1.2, drag + r * 0.7);
        ctx.stroke();
        foot(-fw, drag);
        foot(fw, lead);
      } else if (moving) {
        const st = gait.stride * strideK * r;
        const big = gait.stomp ? 1.25 : 1;
        if (gait.stomp && !pass) {
          // Dust kicked out from under the planted foot.
          const fx = s > 0 ? -fw : fw;
          ctx.strokeStyle = BONE;
          ctx.lineWidth = 1.1;
          for (const a of [-0.9, 0, 0.9]) {
            ctx.beginPath();
            ctx.moveTo(fx + Math.sin(a) * r * 0.45, -st - Math.cos(a) * r * 0.5);
            ctx.lineTo(fx + Math.sin(a) * r * 0.72, -st - Math.cos(a) * r * 0.8);
            ctx.stroke();
          }
        }
        foot(-fw, -s * st, big);
        foot(fw, s * st, big);
      } else if (shift) {
        // Weight on one foot: the other shows at the side.
        foot(-shift * fw * 1.5, r * 0.3);
      }
    }

    // Engines sit ahead of their crew.
    if (kit.engine) drawEngine(ctx, kit.engine, r, pal, swingFrame, attacking);

    // ── Arms and weapon ──
    // Grip positions, in body space. The weapon hand is on the right.
    const armSwing = moving ? s * r * 0.42 * strideK : 0;
    let gx = mounted ? r * 0.72 : r * 0.82;
    let gy = -r * 0.32 + armSwing;
    let wrot = moving && !mounted ? s * 0.16 : shift * 0.06 + breath * 0.03;
    let ox = -r * 0.92;
    let oy = -r * 0.25 - armSwing;
    if (hurt) wrot = 0.55;
    if (attacking && fightKind === 'melee') {
      // A melee swing winds up behind the shoulder and follows through across the body.
      wrot = [-1.0, -0.25, 0.75, 1.05][swingFrame];
      gy = -r * 0.32;
    }
    if (attacking && fightKind === 'shoot') {
      gx = r * 0.5;
      gy = -r * (0.55 - (swingFrame === 2 ? 0.2 : 0));
      wrot = 0;
    }
    if (building) {
      wrot = [-1.15, -0.4, 0.7, 0.35][swingFrame];
      gy = -r * 0.4;
      // The off hand steadies the work.
      ox = -r * 0.35;
      oy = -r * 1.0;
    }
    if (rout) {
      // Weapon trailing low behind, the off arm flung out for balance.
      wrot = 2.55 + s * 0.12;
      gx = r * 0.95;
      gy = r * 0.15;
      ox = -r * 1.2;
      oy = -r * 0.5 + s * r * 0.3;
    }
    if (cheer) {
      // Thrust up and out. From above a raised weapon swings wide of the shoulder.
      const up = vet ? 0.35 : [0.45, 1, 0.6, 0.2][cyc];
      wrot = vet ? -0.12 : 0.25 + up * 0.75;
      gx = r * (0.85 + up * 0.35);
      gy = -r * (0.3 + up * 0.55);
      if (!vet) {
        ox = -r * (0.95 + up * 0.25);
        oy = -r * (0.2 + up * 0.75);
      }
    }
    if (healing) {
      // Staff grounded at the side; both hands forward, binding.
      wrot = 0.3;
      gx = r * 1.0;
      gy = r * 0.15;
      ox = -r * 0.26;
      oy = -r * (1.0 + (cyc % 2) * 0.1);
    }
    const twoHand = kit.w === 'orb' || fam === 'wraith' || (moving && gait.lurch);
    if (twoHand && !attacking) {
      // Both hands held out ahead: an orb between them, or the reach of the dead.
      gx = r * 0.3;
      ox = -r * 0.3;
      gy = -r * (gait.lurch || wraith ? 1.15 + (cyc % 2) * 0.08 : 0.85);
      oy = gy + (gait.lurch ? r * 0.18 : 0);
      wrot = 0;
    }
    const showWeapon = !(attacking && fightKind === 'bow') && kit.w !== 'none';
    const handR = r * 0.2;
    const arm = (x, y, sx) => {
      // A sleeve from the shoulder to the hand, only when the hand is well clear.
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.8, -r * 0.05);
      ctx.lineTo(x, y);
      inkStroke(ctx, kit.bare ? skin : shadeHex(style.body, -0.18), r * 0.26, 1.6);
    };
    arm(ox, oy, -1);
    if (!healing) arm(gx, gy, 1);
    if (kit.tentacle) {
      // A warped off arm: a lash instead of a hand.
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.05);
      ctx.bezierCurveTo(
        -r * 1.7,
        -r * 0.3,
        -r * (1.0 - s * 0.3),
        -r * 1.2,
        -r * (1.6 + breath * 0.1),
        -r * 1.5
      );
      inkStroke(ctx, '#57534e', r * 0.2, 1.6);
    }
    if (showWeapon) {
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(wrot);
      // How far the weapon may reach before it would leave the sprite canvas.
      const room =
        UNIT_CANVAS_UNITS / 2 - 3.5 - r * 0.42 - Math.hypot(gx + dx, gy + dy - lunge * 0.5);
      drawInkWeapon(ctx, kit.w, r, pal, fi, attacking && gun && swingFrame === 2, room);
      ctx.restore();
      if (kit.w === 'daggers' || kit.w === 'twinblades' || kit.w === 'fists') {
        // The off hand carries its twin.
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(attacking ? -wrot * 0.6 : -wrot - 0.1);
        drawInkWeapon(ctx, kit.w, r, pal, fi);
        ctx.restore();
      }
    }
    if (attacking && fightKind !== 'bow' && fightKind !== 'shoot')
      drawAttackFlourish(ctx, fightKind, swingFrame, r, style, enemy);
    if (flyer) {
      // Wings beat: spread wide on the down-stroke, swept back on the up-stroke.
      const beat = moving
        ? [0.25, 0, -0.3, 0][cyc]
        : attacking
          ? [0.3, 0.1, -0.3, 0][swingFrame]
          : breath * 0.08;
      const span = type === 'sky_drake' ? 1.95 : 2.05;
      for (const side of [-1, 1]) {
        inkPoly(
          ctx,
          [
            [side * r * 0.6, -r * 0.2],
            [side * r * (span + beat * 0.3), -r * (0.9 + beat * 1.2)],
            [side * r * (span - 0.4), r * (0.1 - beat * 0.5)],
            [side * r * (span - 0.1 + beat * 0.2), r * (0.6 - beat * 0.9)],
            [side * r * 0.8, r * 0.4],
          ],
          shadeHex(style.body, -0.25)
        );
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.7, 0);
        ctx.lineTo(side * r * (span - 0.4), r * (0.1 - beat * 0.5));
        ctx.stroke();
      }
    }

    // ── Torso ──
    ctx.save();
    ctx.rotate(twist);
    ctx.scale(grow, grow * (gait.lean ? 0.9 : 1));
    const bare = !!kit.bare;
    const sw = r * (brute ? 1.22 : 1.05);
    const sh = r * (brute ? 0.78 : 0.66);
    if (kit.belt) {
      // A champion's belt, wide enough to show past the shoulders.
      inkPoly(
        ctx,
        [
          [-sw * 0.9, r * 0.3],
          [sw * 0.9, r * 0.3],
          [sw * 0.8, r * 0.8],
          [-sw * 0.8, r * 0.8],
        ],
        '#2a2622'
      );
      inkDot(ctx, 0, r * 0.62, r * 0.24, BONE, 1);
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, sw, sh, 0, 0, Math.PI * 2);
    inkFill(ctx, bodyGradient(ctx, 0, 0, r, bare ? skin : undead ? '#3a3640' : style.body), 1.5);
    if (kit.sash) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, sw, sh, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = style.mark;
      ctx.lineWidth = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-sw, -sh * 0.2);
      ctx.lineTo(sw, sh * 1.1);
      ctx.stroke();
      ctx.restore();
    }

    // Pauldrons; enemies get bone spikes
    if (!bare) {
      const pk = kit.bigPauldrons ? 1.45 : 1;
      for (const side of [-1, 1]) {
        if (kit.plates) {
          inkPoly(
            ctx,
            [
              [side * r * 0.55, -r * 0.42],
              [side * r * 1.3, -r * 0.42],
              [side * r * 1.3, r * 0.34],
              [side * r * 0.55, r * 0.34],
            ],
            style.accent
          );
        } else {
          inkDot(
            ctx,
            side * r * 0.9,
            -r * 0.02,
            r * 0.36 * pk,
            enemy ? shadeHex(style.accent, -0.12) : style.accent,
            1.3
          );
        }
        if (enemy && !greenskin && !flyer) {
          inkPoly(
            ctx,
            [
              [side * r * 1.1, -r * 0.25],
              [side * r * 1.75, -r * 0.1],
              [side * r * 1.1, r * 0.2],
            ],
            BONE,
            1
          );
        }
        if (kit.shards) {
          for (const [ax, ay] of [
            [1.55, -0.55],
            [1.75, 0.05],
            [1.4, 0.5],
          ])
            inkPoly(
              ctx,
              [
                [side * r * 0.85, -r * 0.22 + ay * r * 0.3],
                [side * r * ax, ay * r],
                [side * r * 0.95, r * 0.2 + ay * r * 0.3],
              ],
              '#bcd6e4',
              0.9
            );
        }
      }
    } else if (kit.h === 'headband') {
      // Bare arms under a torn vest.
      for (const side of [-1, 1]) inkDot(ctx, side * r * 0.9, 0, r * 0.3, style.body, 1.2);
    }

    // Shield on the off hand
    if (SHIELD_TYPES.has(type) || kit.shield) {
      // Raised across the body on the wind-up, dropped back as the blow goes in;
      // it rocks with the stride on the march, is flung wide by a hit and is slung
      // across the back in a rout.
      const raise = attacking ? [1, 0.55, 0, 0.15][swingFrame] : cheer && !vet ? 0.3 : 0;
      const sway = walk ? s * r * 0.1 : 0;
      const sx = rout ? 0 : -r * (0.95 - raise * 0.5) - (hurt ? r * 0.25 : 0);
      const sy = rout ? r * 0.5 : -r * (0.6 + raise * 0.5) - sway + (hurt ? r * 0.3 : 0);
      ctx.beginPath();
      if (type === 'footman' || type === 'pikeman' || kit.shield) {
        ctx.arc(sx, sy, r * 0.55, 0, Math.PI * 2);
      } else {
        ctx.moveTo(sx - r * 0.45, sy - r * 0.5);
        ctx.lineTo(sx + r * 0.45, sy - r * 0.5);
        ctx.lineTo(sx + r * 0.4, sy + r * 0.2);
        ctx.lineTo(sx, sy + r * 0.75);
        ctx.lineTo(sx - r * 0.4, sy + r * 0.2);
        ctx.closePath();
      }
      inkFill(ctx, enemy ? '#1c1a1e' : shadeHex(style.body, 0.18));
      inkDot(ctx, sx, sy, r * 0.18, enemy ? BLOOD : style.accent, 0.9);
    }
    ctx.restore();

    // Hands sit over the weapon grips.
    if (!mounted || showWeapon) inkDot(ctx, gx, gy, handR, kit.w === 'fists' ? BONE : skin, 1);
    if (!(SHIELD_TYPES.has(type) || kit.shield) || rout || healing || building)
      inkDot(ctx, ox, oy, handR, kit.w === 'fists' ? BONE : skin, 1);
    if (healing) {
      inkDot(ctx, -ox, oy + r * 0.06, handR, skin, 1);
      // A bone-white binding wound between the hands, and the mend lit beneath it.
      ctx.beginPath();
      ctx.ellipse(0, oy - r * 0.3, r * (0.34 + (cyc % 2) * 0.1), r * 0.2, 0, 0, Math.PI * 2);
      inkStroke(ctx, BONE, 1.1, 1.4);
      const k = [0.3, 0.55, 0.8, 0.5][cyc];
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + cyc * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.5, oy - r * 0.3 + Math.sin(a) * r * 0.36);
        ctx.lineTo(
          Math.cos(a) * r * (0.5 + k * 0.5),
          oy - r * 0.3 + Math.sin(a) * r * (0.36 + k * 0.4)
        );
        ctx.stroke();
      }
    }
    if (building && swingFrame === 2) {
      // Sparks where the hammer lands.
      ctx.strokeStyle = '#ffd040';
      ctx.lineWidth = 1.2;
      const hx = gx - r * 0.75;
      const hy2 = gy - r * 0.95;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.9 + i * 0.42;
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(a) * r * 0.2, hy2 + Math.sin(a) * r * 0.2);
        ctx.lineTo(hx + Math.cos(a) * r * 0.55, hy2 + Math.sin(a) * r * 0.55);
        ctx.stroke();
      }
    }
    if (cheer && !vet && cyc === 1) {
      // Shout marks off the raised weapon.
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 1.2;
      for (const a of [-2.1, -1.57, -1.0]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.75, -r * 0.5 + Math.sin(a) * r * 0.75);
        ctx.lineTo(Math.cos(a) * r * 1.1, -r * 0.5 + Math.sin(a) * r * 1.1);
        ctx.stroke();
      }
    }

    // ── Head ──
    const hy = -r * (0.12 + lean) + (mounted ? 0 : 0);
    const hr = r * (brute ? 0.56 : 0.5);
    ctx.save();
    ctx.translate(0, hy);
    ctx.rotate(headTurn + twist * 0.4);
    ctx.scale(grow, grow);
    ctx.translate(0, -hy);
    if (greenskin) {
      for (const side of [-1, 1])
        inkPoly(
          ctx,
          [
            [side * hr * 0.7, hy - hr * 0.2],
            [side * hr * 1.9, hy - hr * 0.1],
            [side * hr * 0.7, hy + hr * 0.5],
          ],
          skin,
          1
        );
    }
    ctx.beginPath();
    ctx.arc(0, hy, hr, 0, Math.PI * 2);
    inkFill(ctx, skin, 1.4);
    drawHeadgear(ctx, kit.h, type, hy, hr, style, pal, enemy);

    // Face: skull sockets for the dead, tusks for brutes, burning eyes for every enemy
    if (undead && kit.h !== 'hood') {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(-hr * 0.36, hy - hr * 0.3, hr * 0.26, 0, Math.PI * 2);
      ctx.arc(hr * 0.36, hy - hr * 0.3, hr * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-hr * 0.08, hy - hr * 0.75, hr * 0.16, hr * 0.22);
    }
    if (brute && enemy) {
      ctx.fillStyle = BONE;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * hr * 0.3, hy - hr * 0.8);
        ctx.lineTo(side * hr * 0.5, hy - hr * 1.45);
        ctx.lineTo(side * hr * 0.62, hy - hr * 0.75);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (enemy) {
      ctx.fillStyle = dying && fi >= 2 ? INK : fam === 'undead' || wraith ? '#a8f0a8' : '#ff3a1c';
      ctx.beginPath();
      ctx.arc(-hr * 0.36, hy - hr * 0.3, hr * 0.14, 0, Math.PI * 2);
      ctx.arc(hr * 0.36, hy - hr * 0.3, hr * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    if (rout && !enemy) {
      // Sweat thrown off as he looks back.
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 1;
      for (const [x, y] of [
        [-1.3, -0.9],
        [1.3, -0.7],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x * hr, hy + y * hr);
        ctx.lineTo(x * hr * 1.35, hy + y * hr * 1.4);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Archers hold the bow out over the body, so it is drawn last.
    if (attacking && fightKind === 'bow')
      drawAttackFlourish(ctx, 'bow', swingFrame, r, style, enemy, skin);
    drawHurtFlecks(ctx, r, hurt);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHurtFlecks(ctx, r, hurt) {
    if (!hurt) return;
    // A short fleck of blood thrown off the front, where the blow came in.
    ctx.strokeStyle = BLOOD;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.85);
    ctx.lineTo(r * 0.45, -r * 1.35);
    ctx.stroke();
    ctx.fillStyle = BLOOD;
    for (const [x, y, w] of [
      [0.62, -1.55, 1.5],
      [0.2, -1.5, 1.1],
      [-0.3, -1.2, 1.3],
      [0.85, -1.15, 0.9],
    ]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, w, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Deaths ───────────────────────────────────────────────────────────────
  // Eight frames per cause: 0-1 struck and still standing, 2-4 going down, 5-7 down
  // with the pool spreading. Frame 7 is the corpse that stays on the field. Drawn
  // without ground shadow or team mark, facing -y, so the corpse layer can turn it.
  const DEATH_CAUSES = ['cut', 'shot', 'burn', 'crush', 'hex', 'blast'];
  const DEATH_FRAMES = 8;
  const HEX_VIOLET = '#8460a8';

  function bloodPool(ctx, r, k, ox = 0, oy = 0) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#6e0a12';
    for (const [x, y, rx, ry] of [
      [0, 0.1, 1.25, 0.95],
      [0.7, 0.55, 0.75, 0.6],
      [-0.8, -0.3, 0.6, 0.5],
      [-0.35, 0.95, 0.55, 0.4],
      [1.35, 0.15, 0.3, 0.22],
    ]) {
      ctx.beginPath();
      ctx.ellipse((ox + x * k) * r, (oy + y * k) * r, rx * r * k, ry * r * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function scorchMark(ctx, r, k, color = '#0e0b0c') {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rad = r * k * (i % 2 ? 1.0 : 1.55 + ((i * 7) % 5) * 0.06);
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.85);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Tint everything drawn so far (char, hex-wither), leaving empty canvas alone. */
  function tintDrawn(ctx, color, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  function stuckArrow(ctx, x, y, ang, len) {
    const tx = x + Math.cos(ang) * len;
    const ty = y + Math.sin(ang) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    inkStroke(ctx, '#5a4a38', 1.1, 1.5);
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 1.1;
    for (const d of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.cos(ang + Math.PI + d) * 3.2, ty + Math.sin(ang + Math.PI + d) * 3.2);
      ctx.stroke();
    }
  }

  function flameLick(ctx, x, y, w, h, hot) {
    inkPoly(
      ctx,
      [
        [x - w, y],
        [x - w * 0.45, y - h * 0.55],
        [x - w * 0.1, y - h * 0.3],
        [x + w * 0.15, y - h],
        [x + w * 0.5, y - h * 0.4],
        [x + w, y],
      ],
      hot ? '#ffd040' : '#e0701c',
      1
    );
  }

  function hexSigil(ctx, x, y, w) {
    inkPoly(
      ctx,
      [
        [x, y - w],
        [x + w * 0.8, y],
        [x, y + w],
        [x - w * 0.8, y],
      ],
      HEX_VIOLET,
      1.1
    );
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - w * 0.55);
    ctx.lineTo(x, y + w * 0.55);
    ctx.moveTo(x - w * 0.4, y);
    ctx.lineTo(x + w * 0.4, y);
    ctx.stroke();
  }

  /** What the killing blow looks like on a body that is still up (frames 0-1). */
  function drawDeathStrike(ctx, cause, r, f) {
    ctx.lineCap = 'round';
    if (cause === 'cut') {
      ctx.beginPath();
      ctx.moveTo(-r * 1.5, -r * 1.3);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.6, r * 1.5, r * 1.0);
      inkStroke(ctx, f === 0 ? BONE : BLOOD, f === 0 ? 2.6 : 2, 2.2);
      ctx.fillStyle = BLOOD;
      for (const [x, y, w] of [
        [1.2, -0.2, 2.2],
        [1.6, 0.3, 1.5],
        [0.9, -0.9, 1.6],
        [1.75, -0.5, 1.1],
        [1.3, 0.9, 1.3],
      ]) {
        ctx.beginPath();
        ctx.arc(x * r * (0.8 + f * 0.25), y * r, w, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cause === 'shot') {
      stuckArrow(ctx, r * 0.2, -r * 0.3, -Math.PI * 0.42, r * 1.25);
      if (f >= 1) stuckArrow(ctx, -r * 0.35, -r * 0.1, -Math.PI * 0.6, r * 1.15);
      ctx.fillStyle = BLOOD;
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.3, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (cause === 'burn') {
      for (const [x, y, w, h] of [
        [-0.9, 0.3, 0.4, 1.3],
        [0.85, 0.2, 0.42, 1.5],
        [0, 0.75, 0.5, 1.1],
        [-0.3, -0.5, 0.36, 1.2],
        [0.45, -0.6, 0.3, 0.9],
      ])
        flameLick(ctx, x * r, y * r, w * r, h * r * (f ? 1.15 : 0.9), false);
      flameLick(ctx, -r * 0.1, r * 0.4, r * 0.28, r * 0.9, true);
      flameLick(ctx, r * 0.6, 0, r * 0.2, r * 0.7, true);
    } else if (cause === 'crush') {
      ctx.strokeStyle = INK;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        ctx.lineWidth = i % 2 ? 2.4 : 1.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * (1.5 + f * 0.2), Math.sin(a) * r * (1.4 + f * 0.2));
        ctx.lineTo(Math.cos(a) * r * (2.0 + f * 0.3), Math.sin(a) * r * (1.85 + f * 0.3));
        ctx.stroke();
      }
    } else if (cause === 'hex') {
      hexSigil(ctx, 0, -r * 1.75, r * (0.42 + f * 0.1));
      ctx.strokeStyle = HEX_VIOLET;
      ctx.lineWidth = 1.3;
      for (const a of [0.5, 1.2, 1.94, 2.64]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.5, -r * 1.75 + Math.sin(a) * r * 0.6);
        ctx.lineTo(Math.cos(a) * r * 1.15, -r * 1.75 + Math.sin(a) * r * (1.3 + f * 0.3));
        ctx.stroke();
      }
    } else {
      // blast
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rad = r * (i % 2 ? 0.9 : 1.9 + (i % 3) * 0.2) * (0.75 + f * 0.25);
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      inkFill(ctx, f === 0 ? BONE : '#e0701c', 1.6);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = f === 0 ? '#ffd040' : BONE;
      ctx.fill();
    }
  }

  // Where the limbs lie, in figure radii, head toward -y. `back`: fell backward, so the
  // whole body is turned head-to-tail. Each arm is [elbow, hand], each leg [knee, foot].
  const FALLEN_POSE = {
    cut: {
      back: 1,
      rot: 0.12,
      arms: [
        [-1.3, -0.55, -1.8, -0.85],
        [1.25, 0.0, 1.6, 0.4],
      ],
      legs: [
        [-0.5, 1.2, -0.8, 2.0],
        [0.55, 1.2, 0.5, 2.1],
      ],
      head: [0.15, -1.2],
    },
    shot: {
      back: 0,
      rot: 0.3,
      arms: [
        [-0.9, -0.9, -0.45, -1.65],
        [1.15, 0.1, 0.55, 0.35],
      ],
      legs: [
        [-0.85, 0.95, -0.5, 1.85],
        [0.15, 1.3, 0.9, 1.7],
      ],
      head: [-0.2, -1.2],
    },
    burn: {
      back: 1,
      rot: -0.25,
      scale: 0.9,
      arms: [
        [-1.2, -0.3, -0.7, -1.05],
        [1.2, -0.4, 0.65, -1.15],
      ],
      legs: [
        [-0.95, 0.85, -0.4, 1.45],
        [0.9, 0.8, 0.45, 1.4],
      ],
      head: [0.1, -1.1],
    },
    crush: {
      back: 1,
      rot: 0,
      wide: 1.22,
      arms: [
        [-1.3, -0.75, -1.85, -1.1],
        [1.3, -0.7, 1.85, -1.0],
      ],
      legs: [
        [-0.8, 1.15, -1.25, 1.95],
        [0.8, 1.15, 1.3, 1.9],
      ],
      head: [-0.25, -1.12],
    },
    hex: {
      back: 0,
      rot: -0.4,
      thin: 0.72,
      arms: [
        [-1.0, -0.6, -0.2, -1.0],
        [0.95, -0.5, 0.25, -0.95],
      ],
      legs: [
        [-0.7, 1.0, 0.3, 1.55],
        [-0.1, 1.25, 0.75, 1.5],
      ],
      head: [0.1, -1.15],
    },
  };

  /** A body on the ground. `down` runs 0 (just folding) to 1 (flat). */
  function drawFallenBody(ctx, type, team, cause, down, f) {
    const style = resolveUnitStyle(type, team, 'footman');
    const kit = KIT[type] || (type.startsWith('roster_') ? KIT.roster_ultimis : DEFAULT_KIT);
    const r = style.size * 1.3;
    const enemy = team === 'enemy';
    const fam = familyOf(type, team);
    const undead = fam === 'undead' || fam === 'wraith';
    const skin = enemy ? FAMILY_SKIN[fam] || '#b0a498' : '#d9b08c';
    const brute =
      !!kit.brute ||
      /^(orc|orc_shieldbearer|troll|war_chief|berserker|dreadborn_champion)$/.test(type);
    const pal = {
      blade: enemy ? '#8f8a86' : BONE,
      haft: enemy ? '#3a302a' : '#5a4a38',
      trim: style.accent,
      glow: style.mark,
      accent: style.accent,
    };
    const poolK = [0, 0, 0.15, 0.35, 0.55, 0.75, 0.9, 1][f];
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (cause === 'blast') {
      // Thrown apart. The pieces fly out over frames 2-4 and lie where they land.
      const fly = [0, 0, 0.4, 0.75, 0.95, 1, 1, 1][f];
      const piece = (x, y, rot, draw) => {
        ctx.save();
        ctx.translate(x * r * fly, y * r * fly);
        ctx.rotate(rot * fly);
        draw();
        ctx.restore();
      };
      piece(1.25, 1.05, 2.4, () => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r * 0.9);
        inkStroke(ctx, shadeHex(style.body, -0.18), r * 0.26, 1.6);
        inkDot(ctx, 0, -r * 0.95, r * 0.2, skin, 1);
      });
      piece(-1.4, 0.95, -0.9, () => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, r * 0.85);
        inkStroke(ctx, '#2a2622', r * 0.3, 1.6);
        ctx.beginPath();
        ctx.ellipse(0, r * 1.0, r * 0.2, r * 0.32, 0, 0, Math.PI * 2);
        inkFill(ctx, '#1c1a18', 1);
      });
      piece(-1.15, -0.95, 1.3, () => inkDot(ctx, 0, 0, r * 0.34, style.accent, 1.2));
      if (kit.w !== 'none')
        piece(0.2, -1.75, 1.9, () =>
          drawInkWeapon(ctx, kit.w, r * 0.8, pal, 0, false, UNIT_CANVAS_UNITS / 2 - 4 - r * 2.1)
        );
      piece(-0.15, 0.2, 0.6, () => {
        // What is left of the trunk, torn open at one end.
        inkPoly(
          ctx,
          [
            [-r * 0.7, -r * 0.35],
            [r * 0.2, -r * 0.55],
            [r * 0.75, -r * 0.1],
            [r * 0.45, r * 0.1],
            [r * 0.7, r * 0.4],
            [r * 0.1, r * 0.3],
            [-r * 0.2, r * 0.55],
            [-r * 0.75, r * 0.25],
          ],
          undead ? '#3a3640' : kit.bare ? skin : style.body,
          1.5
        );
        ctx.fillStyle = BLOOD;
        ctx.beginPath();
        ctx.ellipse(r * 0.5, r * 0.15, r * 0.24, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      piece(1.35, -0.95, 2.2, () => {
        inkDot(ctx, 0, 0, r * (brute ? 0.56 : 0.5), skin, 1.4);
        drawHeadgear(ctx, kit.h, type, 0, r * (brute ? 0.56 : 0.5), style, pal, enemy);
      });
      ctx.fillStyle = BLOOD;
      for (const [x, y, w] of [
        [0.6, 0.9, 1.6],
        [-0.7, -0.4, 1.9],
        [0.9, -0.3, 1.3],
        [-0.4, 1.3, 1.2],
        [1.8, 0.2, 1.1],
        [-1.75, 0.1, 1.4],
      ]) {
        ctx.beginPath();
        ctx.arc(x * r * fly, y * r * fly, w, 0, Math.PI * 2);
        ctx.fill();
      }
      if (f <= 3) drawDeathStrike(ctx, 'blast', r * (f === 2 ? 0.8 : 0.5), 1);
      tintDrawn(ctx, '#120e0c', 0.3 * fly);
      scorchMark(ctx, r, 0.6 + fly * 0.55);
      return;
    }

    const pose = FALLEN_POSE[cause] || FALLEN_POSE.cut;
    const thin = pose.thin || 1;
    ctx.save();
    if (pose.back) ctx.rotate(Math.PI);
    ctx.translate(0, -Math.min(r * 0.35, 3.5) * down);
    ctx.rotate(pose.rot * down);
    // Seen from above a falling body is foreshortened until it is flat.
    const ks = (pose.scale || 1) * (0.55 + 0.45 * down);
    ctx.scale(pose.scale || 1, ks);
    const P = (x, y) => [x * r * (0.6 + 0.4 * down), y * r];

    if (fam === 'rat') {
      ctx.rotate(0.5);
      drawRat(ctx, r, style, 0.6, false);
      ctx.restore();
    } else {
      // Dropped weapon and shield, lying where they fell.
      if (kit.w !== 'none' && kit.w !== 'fists' && kit.w !== 'orb') {
        ctx.save();
        ctx.translate(r * 1.45, -r * 1.0);
        ctx.rotate(Math.PI - 0.35);
        drawInkWeapon(ctx, kit.w, r * 0.9, pal, 0, false, UNIT_CANVAS_UNITS / 2 - 4 - r * 1.2);
        ctx.restore();
      }
      if (SHIELD_TYPES.has(type) || kit.shield) {
        inkDot(
          ctx,
          -r * 1.45,
          r * 0.75,
          r * 0.52,
          enemy ? '#1c1a1e' : shadeHex(style.body, 0.18),
          1.3
        );
        inkDot(ctx, -r * 1.45, r * 0.75, r * 0.17, enemy ? BLOOD : style.accent, 0.9);
      }
      if (MOUNTED_TYPES.has(type)) {
        // The mount, down on its side beside the rider.
        const hide = type === 'cavalry' ? '#3a2e28' : type === 'warg_rider' ? '#34343c' : '#1c0c12';
        ctx.save();
        ctx.translate(-r * 1.0, r * 0.5);
        ctx.rotate(-0.5);
        for (const y of [-0.8, -0.3, 0.5, 0.95]) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.3, y * r);
          ctx.lineTo(-r * 1.05, y * r + r * 0.25);
          inkStroke(ctx, hide, r * 0.16, 1.5);
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.62, r * 1.3, 0, 0, Math.PI * 2);
        inkFill(ctx, hide);
        ctx.beginPath();
        ctx.ellipse(r * 0.25, -r * 1.45, r * 0.3, r * 0.48, 0.5, 0, Math.PI * 2);
        inkFill(ctx, shadeHex(hide, 0.14));
        ctx.restore();
      }
      if (fam === 'flyer') {
        for (const side of [-1, 1])
          inkPoly(
            ctx,
            [
              [side * r * 0.5, -r * 0.5],
              [side * r * 2.0, -r * (side < 0 ? 1.2 : 0.2)],
              [side * r * 1.7, r * 0.3],
              [side * r * 1.95, r * 0.9],
              [side * r * 0.6, r * 0.5],
            ],
            shadeHex(style.body, -0.25)
          );
      }
      const sleeve = kit.bare ? skin : shadeHex(style.body, -0.18);
      const limb = (x0, y0, mid, color, w) => {
        const [mx, my] = P(mid[0], mid[1]);
        const [ex, ey] = P(mid[2], mid[3]);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        inkStroke(ctx, color, w * thin, 1.7);
        return [ex, ey];
      };
      if (fam === 'wraith') {
        // Nothing inside the rags: they settle in a heap.
        inkPoly(
          ctx,
          [
            [-r * 0.9, -r * 0.6],
            [r * 0.8, -r * 0.7],
            [r * 1.3, r * 0.3],
            [r * 0.7, r * 0.2],
            [r * 0.9, r * 1.2],
            [r * 0.2, r * 0.8],
            [-r * 0.3, r * 1.5],
            [-r * 0.6, r * 0.7],
            [-r * 1.3, r * 0.9],
          ],
          '#26232a',
          1.5
        );
      } else {
        for (const [sd, leg] of [
          [-1, pose.legs[0]],
          [1, pose.legs[1]],
        ]) {
          const [fx, fy] = limb(sd * r * 0.3, r * 0.55, leg, '#2a2622', r * 0.32);
          ctx.beginPath();
          ctx.ellipse(fx, fy, r * 0.2, r * 0.3, sd * 0.5, 0, Math.PI * 2);
          inkFill(ctx, enemy ? '#1c1a18' : '#2a2622', 1);
        }
      }
      const hands = [];
      for (const [sd, arm] of [
        [-1, pose.arms[0]],
        [1, pose.arms[1]],
      ])
        hands.push(limb(sd * r * 0.7, -r * 0.45, arm, sleeve, r * 0.27));
      // Trunk
      const tw = r * (brute ? 0.92 : 0.78) * (pose.wide || 1) * thin;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.05, tw, r * 0.98, 0, 0, Math.PI * 2);
      inkFill(ctx, kit.bare ? skin : undead ? '#3a3640' : style.body, 1.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-tw * 0.85, r * 0.5);
      ctx.lineTo(tw * 0.85, r * 0.5);
      ctx.stroke();
      if (!kit.bare)
        for (const sd of [-1, 1])
          inkDot(
            ctx,
            sd * tw * 0.92,
            -r * 0.5,
            r * 0.33,
            enemy ? shadeHex(style.accent, -0.12) : style.accent,
            1.3
          );
      for (const [hx, hy] of hands)
        inkDot(ctx, hx, hy, r * 0.2, kit.w === 'fists' ? BONE : skin, 1);
      // Head, lolling to one side
      const hr = r * (brute ? 0.56 : 0.5);
      const [hx, hy] = P(pose.head[0], pose.head[1]);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(pose.head[0] * 1.6);
      if (fam === 'goblin' || fam === 'orc')
        for (const side of [-1, 1])
          inkPoly(
            ctx,
            [
              [side * hr * 0.7, -hr * 0.2],
              [side * hr * 1.9, -hr * 0.1],
              [side * hr * 0.7, hr * 0.5],
            ],
            skin,
            1
          );
      inkDot(ctx, 0, 0, hr, skin, 1.4);
      drawHeadgear(ctx, kit.h, type, 0, hr, style, pal, enemy);
      ctx.restore();

      // The wound itself
      if (cause === 'cut') {
        ctx.beginPath();
        ctx.moveTo(-tw * 0.75, -r * 0.5);
        ctx.lineTo(tw * 0.8, r * 0.5);
        inkStroke(ctx, BLOOD, 2.2, 1.8);
      } else if (cause === 'shot') {
        stuckArrow(ctx, -r * 0.2, -r * 0.2, -Math.PI * 0.3, r * 1.0);
        stuckArrow(ctx, r * 0.25, r * 0.35, -Math.PI * 0.42, r * 0.95);
        if (down >= 1) stuckArrow(ctx, -r * 0.1, r * 0.6, -Math.PI * 0.2, r * 0.8);
      } else if (cause === 'hex') {
        hexSigil(ctx, 0, 0, r * 0.4);
      }
      ctx.restore();
    }

    if (cause === 'burn') {
      tintDrawn(ctx, '#120e0c', Math.min(0.86, 0.35 + down * 0.55));
      // Cracks still glowing in the char, and the last of the fire.
      ctx.strokeStyle = '#e0701c';
      ctx.lineWidth = 1;
      for (const [x0, y0, x1, y1] of [
        [-0.3, 0.5, 0.1, 0.1],
        [0.1, 0.1, 0.35, 0.3],
        [0.05, -0.4, -0.25, -0.1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x0 * r, y0 * r);
        ctx.lineTo(x1 * r, y1 * r);
        ctx.stroke();
      }
      if (f <= 5) {
        const h = [0, 0, 1.3, 1.1, 0.8, 0.5][f];
        flameLick(ctx, -r * 0.5, r * 0.2, r * 0.4, r * h, false);
        flameLick(ctx, r * 0.45, -r * 0.2, r * 0.36, r * h * 0.9, false);
        flameLick(ctx, 0, r * 0.1, r * 0.22, r * h * 0.6, true);
      } else {
        ctx.fillStyle = '#e0701c';
        for (const [x, y] of [
          [-0.6, -0.9],
          [0.5, -1.3],
          [0.1, -0.7],
        ])
          ctx.fillRect(x * r, y * r - (f - 6) * 2, 1.6, 1.6);
      }
      scorchMark(ctx, r, 0.55 + down * 0.5);
    } else if (cause === 'hex') {
      tintDrawn(ctx, '#3c2a54', 0.2 + down * 0.42);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      for (const a of [0.4, 1.5, 2.6, 3.7, 4.9]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        ctx.lineTo(Math.cos(a + 0.3) * r * 0.7, Math.sin(a + 0.3) * r * 0.75);
        ctx.lineTo(Math.cos(a) * r * 1.0 * down, Math.sin(a) * r * 1.1 * down);
        ctx.stroke();
      }
      scorchMark(ctx, r, 0.4 + down * 0.3, '#2a1c3a');
    } else if (cause === 'crush') {
      // Driven into the ground: a broad splash and a cracked ring.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      for (const a of [0.3, 1.4, 2.5, 3.6, 4.6, 5.6]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.5);
        ctx.lineTo(Math.cos(a + 0.12) * r * 2.25, Math.sin(a + 0.12) * r * 2.0);
        ctx.stroke();
      }
      ctx.restore();
      scorchMark(ctx, r, 0.5 + poolK * 0.75, '#6e0a12');
    } else {
      bloodPool(ctx, r, poolK * (cause === 'shot' ? 0.7 : 1), cause === 'cut' ? 0.3 : 0, 0);
    }
  }

  function drawDeathFigure(ctx, type, team, cause, f) {
    const style = resolveUnitStyle(type, team, 'footman');
    const r = style.size * 1.3;
    if (f <= 1) {
      // Still up, reeling from the blow.
      ctx.save();
      ctx.translate(0, r * 0.12 * (f + 1));
      ctx.rotate(cause === 'shot' || cause === 'hex' ? -0.12 * (f + 1) : 0.14 * (f + 1));
      if (cause === 'crush' && r < 13) ctx.scale(1.12 + f * 0.1, 1.06 + f * 0.06);
      if (cause === 'blast') drawDeathStrike(ctx, cause, r, f);
      drawInkFigure(ctx, type, -90, team, f, 'die');
      ctx.restore();
      if (cause === 'burn') tintDrawn(ctx, '#120e0c', 0.2 + f * 0.2);
      if (cause === 'hex') tintDrawn(ctx, '#3c2a54', 0.15 + f * 0.15);
      if (cause !== 'blast') drawDeathStrike(ctx, cause, r, f);
      return;
    }
    drawFallenBody(ctx, type, team, cause, [0, 0, 0.5, 0.8, 0.95, 1, 1, 1][f], f);
  }

  // ── Ink grading for structures ───────────────────────────────────────────
  // Buildings, hazards and props are drawn by long hand-written routines. Rather than
  // repaint each one, they draw through a thin wrapper that mutes every color toward
  // ash and blood and adds a black outline to each solid shape.
  const gradeCache = new Map();
  function gradeColor(c) {
    const hit = gradeCache.get(c);
    if (hit) return hit;
    let r;
    let g;
    let b;
    let a = 1;
    let m = /^#([0-9a-f]{3,8})$/i.exec(c);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('');
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
      if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
    } else if ((m = /^rgba?\(([^)]+)\)$/i.exec(c))) {
      const parts = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      [r, g, b] = parts;
      if (parts.length > 3) a = parts[3];
    }
    let out;
    if (![r, g, b].every(Number.isFinite)) out = { css: c, opaque: false };
    else {
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const red = r > g * 1.45 && r > b * 1.45;
      const keep = red ? 0.95 : 0.62;
      const dark = red ? 0.84 : 0.8;
      const mix = (v) => Math.round(Math.max(0, Math.min(255, (lum + (v - lum) * keep) * dark)));
      const rr = red ? Math.min(255, mix(r) + 14) : mix(r) + 4;
      out = { css: `rgba(${rr},${mix(g)},${mix(b)},${a})`, opaque: a >= 0.9 };
    }
    if (gradeCache.size > 2000) gradeCache.clear();
    gradeCache.set(c, out);
    return out;
  }

  let inkTarget = null;
  let inkProxy = null;
  function inkCtx(ctx) {
    if (typeof Proxy === 'undefined' || !ctx) return ctx;
    if (inkTarget === ctx) return inkProxy;
    const bound = new Map();
    let solid = false;
    const outline = (draw) => {
      const lw = ctx.lineWidth;
      const ss = ctx.strokeStyle;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = INK;
      draw();
      ctx.lineWidth = lw;
      ctx.strokeStyle = ss;
    };
    const special = {
      fill: (...args) => {
        ctx.fill(...args);
        if (solid) outline(() => ctx.stroke());
      },
      fillRect: (x, y, w, h) => {
        ctx.fillRect(x, y, w, h);
        if (solid && Math.abs(w) >= 6 && Math.abs(h) >= 6)
          outline(() => ctx.strokeRect(x, y, w, h));
      },
    };
    inkTarget = ctx;
    inkProxy = new Proxy(ctx, {
      get(t, k) {
        if (special[k]) return special[k];
        const v = t[k];
        if (typeof v !== 'function') return v;
        let fn = bound.get(k);
        if (!fn) {
          fn = v.bind(t);
          bound.set(k, fn);
        }
        return fn;
      },
      set(t, k, v) {
        if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') {
          const graded = gradeColor(v);
          if (k === 'fillStyle') solid = graded.opaque;
          t[k] = graded.css;
        } else {
          if (k === 'fillStyle') solid = false;
          t[k] = v;
        }
        return true;
      },
    });
    return inkProxy;
  }

  const BOSS_BUILD = {
    boss_thokk: [1.14, 0.96],
    boss_morwen: [0.84, 1.08],
    boss_rotfather: [1.13, 0.97],
    boss_vexis: [0.84, 1.06],
    boss_karg: [1.05, 1],
    boss_malachar: [0.96, 1.04],
  };
  /** Horns in the crown: most warlords wear five; some wear their own headpiece instead. */
  const BOSS_CROWN = {
    boss_thokk: 0,
    boss_morwen: 1,
    boss_vexis: 0,
    boss_sylvara: 0,
    boss_volk: 3,
  };

  /** How far each monster shape steps back (negative) or drives forward on each attack frame. */
  const MONSTER_ATTACK_SHIFT = {
    behemoth: [0, 0, 3, 2],
    iron_colossus: [-1, -2, 3, 1],
    void_stalker: [-2, -3, 2, 1],
    elder_wyrm: [-2, -3, -3, -2],
    abomination: [-2, -3, 2, 1],
  };

  /**
   * Bosses and giant monsters in the inked horror-comic style: a black mass,
   * bone detail, blood-red eyes. One silhouette per shape; bosses wear a crown of horns.
   */
  function drawInkMonster(ctx, type, team, frame, animState) {
    const boss = type.startsWith('boss_');
    const shape = boss
      ? BOSS_ARCHETYPE[type] || 'behemoth'
      : type === 'cinderbound_juggernaut'
        ? 'iron_colossus'
        : type;
    const style = resolveUnitStyle(type, team, shape in UNIT_STYLE ? shape : 'behemoth');
    // Capped so the tallest marks (banner, standard, horn crown, halo), which reach
    // about 1.5r from the centre, stay inside the 72-unit sprite canvas.
    const r = Math.min(21, style.size * 1.2);
    const dieCause = animState.startsWith('die_') ? animState.slice(4) : '';
    const dying = !!dieCause;
    const dieF = dying ? Math.max(0, Math.min(DEATH_FRAMES - 1, Math.floor(frame))) : -1;
    // Dead from the moment it starts to fall: the eyes go out.
    const dead = dieF >= 3;
    const walk = animState === 'walk';
    // Four-frame gait: s swings +1, 0, -1, 0; each shape uses it its own way.
    const cyc = Math.max(0, Math.floor(frame)) % 4;
    const s = walk ? [1, 0, -1, 0][cyc] : 0;
    const step = walk && cyc % 2 === 0;
    const bob = !walk
      ? 0
      : shape === 'void_stalker'
        ? 0
        : shape === 'iron_colossus'
          ? step
            ? 1.6
            : 0
          : shape === 'elder_wyrm'
            ? s * 0.8
            : step
              ? 0
              : -1.4;
    const atk = animState === 'attack';
    const hurt = animState === 'hurt' || (dying && dieF <= 2);
    // Attack frames: 0-1 wind up (a beat of warning), 2 lands the blow, 3 settles.
    const f = atk ? Math.max(0, Math.min(3, Math.floor(frame))) : 0;
    const windup = atk && f <= 1;
    // Monsters face down the canvas, so +y is forward.
    const shift = atk
      ? (MONSTER_ATTACK_SHIFT[shape] || MONSTER_ATTACK_SHIFT.abomination)[f]
      : hurt
        ? -2.5
        : 0;
    // Lift the hide toward bone so the black outline and features read against it.
    const lift = (hex, amt) => {
      const n = parseInt(String(hex).replace('#', ''), 16);
      if (!Number.isFinite(n)) return hex;
      const mix = (c, to) => Math.round(c + (to - c) * amt);
      return `rgb(${mix((n >> 16) & 255, 228)},${mix((n >> 8) & 255, 220)},${mix(n & 255, 196)})`;
    };
    const hide = lift(style.body, 0.28);
    const trim = lift(style.accent, 0.34);

    if (!dying) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(1.5, 4, r * 1.25, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(0, bob + shift);
    if (dying) {
      // Reels (0-2), goes over (3-4), lies slumped and spread (5-7).
      const k = [0, 0, 0.1, 0.4, 0.75, 1, 1, 1][dieF];
      ctx.translate(dieF <= 2 ? [-1.6, 1.8, -1][dieF] : 0, r * 0.08 * k);
      ctx.rotate(dieF <= 2 ? [-0.05, 0.07, -0.03][dieF] : 0.3 * k);
      ctx.scale(1 + 0.07 * k, 1 - 0.2 * k);
    } else if (walk) {
      // Gait by shape. The behemoth rolls its shoulders over planted fists; the
      // colossus rocks stiffly from foot to foot; the abomination heaves itself along.
      if (shape === 'behemoth') ctx.rotate(s * 0.07);
      else if (shape === 'iron_colossus') ctx.translate(s * r * 0.06, 0);
      else if (shape === 'void_stalker') ctx.translate(s * r * 0.08, 0);
      else if (shape === 'abomination') {
        ctx.rotate(s * 0.05);
        ctx.scale(1 + s * 0.05, 1 - s * 0.05);
      }
    }
    if (atk && shape === 'behemoth') {
      // Rearing: seen from above the bulk swells as it rises, then drops back.
      const k = [1.05, 1.1, 1, 1][f];
      ctx.translate(0, -0.6 * r);
      ctx.scale(k, k);
      ctx.translate(0, 0.6 * r);
    } else if (
      atk &&
      shape !== 'iron_colossus' &&
      shape !== 'void_stalker' &&
      shape !== 'elder_wyrm'
    ) {
      // The abomination gathers itself, then bulges forward behind its maw.
      ctx.scale([1.04, 1.07, 0.98, 1][f], [0.95, 0.92, 1.06, 1.02][f]);
    }
    // Warlords that share a body differ in build: Thokk is a slab, Morwen a tall wisp,
    // the Rotfather bloated, Vexis a blade of a thing.
    const build = BOSS_BUILD[type];
    if (build) ctx.scale(build[0], build[1]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    const inkLine = (pts, color, lw) => {
      for (const [c, w] of [
        [INK, lw + 2.2],
        [color, lw],
      ]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * r, pts[0][1] * r);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * r, pts[i][1] * r);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
    };
    const blob = (pts, fill) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * r, pts[0][1] * r);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * r, pts[i][1] * r);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.stroke();
    };
    const eye = (x, y, w = 0.12) => {
      if (dead) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(x * r, y * r, w * r, w * r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      // Eyes flare on the wind-up: the tell before the blow.
      const ew = w * (windup ? 1.45 : 1);
      ctx.fillStyle = windup ? '#ff3a1c' : BLOOD;
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, ew * r, ew * r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = windup ? '#ffd040' : '#ff5040';
      ctx.fillRect(x * r - 0.6, y * r - 0.6, 1.2, 1.2);
    };

    if (shape === 'behemoth') {
      if (walk) {
        // Knuckle-walk: the fists plant ahead in turn and the bulk is hauled over them.
        for (const sd of [-1, 1]) {
          const reach = 0.42 + sd * s * 0.4;
          inkLine(
            [
              [sd * 0.85, 0.0],
              [sd * 1.02, reach],
            ],
            hide,
            0.2 * r
          );
          ctx.beginPath();
          ctx.arc(sd * 1.02 * r, reach * r, 0.22 * r, 0, Math.PI * 2);
          ctx.fillStyle = trim;
          ctx.fill();
          ctx.stroke();
          if (sd * s > 0) {
            // Ground cracks under the fist that has just come down.
            ctx.lineWidth = 1.2;
            for (const a of [0.2, 0.9, 1.6]) {
              ctx.beginPath();
              ctx.moveTo(
                (sd * 1.02 + Math.cos(a) * sd * 0.26) * r,
                (reach + Math.sin(a) * 0.26) * r
              );
              ctx.lineTo(
                (sd * 1.02 + Math.cos(a) * sd * 0.42) * r,
                (reach + Math.sin(a) * 0.42) * r
              );
              ctx.stroke();
            }
            ctx.lineWidth = 2.6;
          }
        }
      }
      // Horned bulk: hunched shoulders, tusks, a skull plate.
      blob(
        [
          [-1.05, 0.1],
          [-0.95, -0.55],
          [-0.45, -0.9],
          [0.45, -0.9],
          [0.95, -0.55],
          [1.05, 0.1],
          [0.7, 0.75],
          [0, 0.95],
          [-0.7, 0.75],
        ],
        hide
      );
      for (const sd of [-1, 1]) {
        blob(
          [
            [sd * 0.55, 0.25],
            [sd * 1.25, 0.75],
            [sd * 1.05, 0.15],
          ],
          BONE
        );
        blob(
          [
            [sd * 0.3, 0.75],
            [sd * 0.42, 1.2],
            [sd * 0.12, 0.85],
          ],
          BONE
        );
      }
      blob(
        [
          [-0.42, 0.25],
          [0, 0.05],
          [0.42, 0.25],
          [0.3, 0.8],
          [0, 0.95],
          [-0.3, 0.8],
        ],
        BONE
      );
      eye(-0.2, 0.42);
      eye(0.2, 0.42);
      ctx.fillStyle = INK;
      ctx.fillRect(-0.05 * r, 0.6 * r, 0.1 * r, 0.22 * r);
      if (atk) {
        // Overhead slam: both fists go up and out, then come down together in front.
        const [fx, fy, fs] = [
          [1.0, 0.3, 0.25],
          [0.74, -0.38, 0.34],
          [0.5, 1.1, 0.23],
          [0.58, 1.0, 0.2],
        ][f];
        if (f >= 2) {
          // Shockwave and thrown dust where the fists land.
          const grow = f === 2 ? 1 : 1.12;
          ctx.globalAlpha *= f === 2 ? 1 : 0.5;
          for (const [c, w] of [
            [INK, 4.6],
            [BONE, 2.2],
          ]) {
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.ellipse(
              0,
              0.8 * r,
              1.22 * r * grow,
              0.52 * r * grow,
              0,
              Math.PI * 0.06,
              Math.PI * 0.94
            );
            ctx.stroke();
          }
          if (f === 2) {
            ctx.strokeStyle = BONE;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 7; i++) {
              const a = Math.PI * (0.1 + i * 0.1333);
              ctx.beginPath();
              ctx.moveTo(Math.cos(a) * 1.3 * r, (0.8 + Math.sin(a) * 0.56) * r);
              ctx.lineTo(Math.cos(a) * 1.5 * r, (0.8 + Math.sin(a) * 0.64) * r);
              ctx.stroke();
            }
          }
          ctx.globalAlpha /= f === 2 ? 1 : 0.5;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.6;
        }
        for (const sd of [-1, 1]) {
          inkLine(
            [
              [sd * 0.9, 0.05],
              [sd * fx, fy],
            ],
            hide,
            0.2 * r
          );
          ctx.beginPath();
          ctx.arc(sd * fx * r, fy * r, fs * r, 0, Math.PI * 2);
          ctx.fillStyle = trim;
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = BONE;
          for (const k of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.arc((sd * fx + k * fs * 0.5) * r, (fy + fs * 0.45) * r, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else if (shape === 'iron_colossus') {
      if (walk) {
        // Stiff stomp: square feet show ahead of the slab in turn, with a jolt line each.
        for (const sd of [-1, 1]) {
          const fy = 0.82 + sd * s * 0.2;
          blob(
            [
              [sd * 0.2, fy],
              [sd * 0.66, fy],
              [sd * 0.66, fy + 0.3],
              [sd * 0.2, fy + 0.3],
            ],
            INK
          );
          if (sd * s > 0) {
            ctx.strokeStyle = BONE;
            ctx.lineWidth = 1.4;
            for (const x of [0.12, 0.74]) {
              ctx.beginPath();
              ctx.moveTo(sd * x * r, (fy + 0.36) * r);
              ctx.lineTo(sd * (x + (x < 0.4 ? -0.1 : 0.1)) * r, (fy + 0.52) * r);
              ctx.stroke();
            }
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.6;
          }
        }
      }
      // Riveted slab: square plates, a slit visor, furnace glow.
      blob(
        [
          [-0.95, -0.8],
          [0.95, -0.8],
          [1.1, 0.3],
          [0.7, 0.9],
          [-0.7, 0.9],
          [-1.1, 0.3],
        ],
        hide
      );
      blob(
        [
          [-1.3, -0.5 - s * 0.14],
          [-0.9, -0.7 - s * 0.14],
          [-0.85, 0.35 - s * 0.14],
          [-1.25, 0.25 - s * 0.14],
        ],
        trim
      );
      // Piston punch: the right plate arm draws back, then drives out on its rod.
      // On the march the two arm plates pump against each other.
      const arm = atk ? [-0.2, -0.36, 0.72, 0.34][f] : s * 0.14;
      if (atk && arm > 0) {
        blob(
          [
            [0.98, -0.55],
            [1.2, -0.55],
            [1.2, -0.62 + arm],
            [0.98, -0.62 + arm],
          ],
          BONE
        );
      }
      blob(
        [
          [1.3, -0.5 + arm],
          [0.9, -0.7 + arm],
          [0.85, 0.35 + arm],
          [1.25, 0.25 + arm],
        ],
        trim
      );
      if (atk) {
        // A knuckle plate caps the punching arm.
        blob(
          [
            [0.8, 0.3 + arm],
            [1.33, 0.18 + arm],
            [1.33, 0.5 + arm],
            [0.84, 0.58 + arm],
          ],
          INK
        );
        ctx.fillStyle = BONE;
        for (const x of [0.92, 1.07, 1.22]) {
          ctx.beginPath();
          ctx.arc(x * r, (0.44 + arm - (x - 0.92) * 0.25) * r, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        if (f === 2) {
          ctx.strokeStyle = BONE;
          ctx.lineWidth = 1.6;
          for (const a of [0.08, 0.3, 0.7, 0.92]) {
            const ca = Math.cos(Math.PI * a);
            const sa = Math.sin(Math.PI * a);
            ctx.beginPath();
            ctx.moveTo((1.07 + ca * 0.1) * r, (1.33 + sa * 0.05) * r);
            ctx.lineTo((1.07 + ca * 0.3) * r, (1.33 + sa * 0.16) * r);
            ctx.stroke();
          }
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.6;
        }
      }
      blob(
        [
          [-0.5, 0.1],
          [0.5, 0.1],
          [0.42, 0.75],
          [-0.42, 0.75],
        ],
        INK
      );
      // The furnace slit burns hotter as the punch builds.
      const heat = atk ? [0.45, 0.85, 1, 0.5][f] : 0;
      if (heat > 0) {
        ctx.fillStyle = `rgba(255,120,40,${0.4 * heat})`;
        ctx.beginPath();
        ctx.ellipse(0, 0.38 * r, 0.62 * r, (0.2 + heat * 0.16) * r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = heat > 0.7 ? '#ffd860' : heat > 0 ? '#ff8a30' : '#ff5a20';
      ctx.fillRect(-0.36 * r, (0.3 - heat * 0.05) * r, 0.72 * r, (0.1 + heat * 0.14) * r);
      ctx.fillStyle = BONE;
      for (const [x, y] of [
        [-0.7, -0.55],
        [0.7, -0.55],
        [-0.75, 0],
        [0.75, 0],
        [0, -0.6],
      ]) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = BLOOD;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-0.3 * r, -0.75 * r);
      ctx.lineTo(-0.1 * r, -0.2 * r);
      ctx.lineTo(-0.35 * r, 0.05 * r);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
    } else if (shape === 'void_stalker') {
      // Lean shadow: hooded wedge, two long blades.
      // Scissor slash: the blades open wide and back, then snap across each other.
      // Gliding, the blades trail and sway and rags of shadow stream out behind.
      const ang = atk ? [0.12, -0.3, 1.78, 1.95][f] : 0.68 + (walk ? -0.3 + s * 0.12 : 0);
      if (walk) {
        for (const [x, len] of [
          [-0.42, 0.75],
          [0, 1.0],
          [0.42, 0.7],
        ]) {
          blob(
            [
              [x - 0.16, -0.75],
              [x + 0.16, -0.75],
              [x + s * 0.22 + (cyc % 2 ? 0.1 : -0.06), -0.85 - len],
            ],
            INK
          );
        }
      }
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      // Held wide the blades are foreshortened so the tips stay on the canvas.
      const bl = atk && f <= 1 ? 1.02 : 1.2;
      for (const sd of [-1, 1]) {
        blob(
          [
            [0, -0.17],
            [bl, -0.07],
            [bl + 0.06, 0.07],
            [0, 0.17],
          ].map(([x, y]) => [sd * (0.4 + x * ca - y * sa), 0.25 + x * sa + y * ca]),
          BONE
        );
      }
      if (atk && f >= 2) {
        // Two crossing cuts hang in the air ahead of it.
        ctx.globalAlpha *= f === 2 ? 1 : 0.45;
        for (const sd of [-1, 1]) {
          for (const [c, w] of [
            [INK, 4.4],
            ['#ff5040', 2],
          ]) {
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(sd * 1.3 * r, 0.45 * r);
            ctx.quadraticCurveTo(sd * 0.75 * r, 1.4 * r, -sd * 0.55 * r, 1.42 * r);
            ctx.stroke();
          }
        }
        ctx.globalAlpha /= f === 2 ? 1 : 0.45;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.6;
      }
      blob(
        [
          [0, -1.1],
          [0.6, -0.5],
          [0.7, 0.3],
          [0.3, 0.9],
          [0, 1.05],
          [-0.3, 0.9],
          [-0.7, 0.3],
          [-0.6, -0.5],
        ],
        INK
      );
      blob(
        [
          [-0.34, 0.2],
          [0, 0.05],
          [0.34, 0.2],
          [0.2, 0.75],
          [0, 0.85],
          [-0.2, 0.75],
        ],
        hide
      );
      eye(-0.15, 0.42, 0.1);
      eye(0.15, 0.42, 0.1);
      ctx.strokeStyle = BLOOD;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -1.0 * r);
      ctx.lineTo(0, -0.3 * r);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
    } else if (shape === 'elder_wyrm') {
      // Winged serpent seen from above: torn wings, a horned head, a spined tail.
      const flap = atk ? [0.1, 0.22, -0.1, -0.04][f] : walk ? [0.2, 0.02, -0.18, 0.02][cyc] : 0;
      // The neck coils back on the wind-up, then snaps out behind the flame.
      const neck = atk ? [-0.18, -0.34, 0.05, 0.02][f] : 0;
      for (const sd of [-1, 1]) {
        blob(
          [
            [sd * 0.25, -0.2],
            [sd * 1.45, -0.75 - flap],
            [sd * 1.3, -0.25],
            [sd * 1.5, 0.1 + flap],
            [sd * 1.05, 0.05],
            [sd * 1.0, 0.45],
            [sd * 0.6, 0.2],
            [sd * 0.3, 0.35],
          ],
          hide
        );
      }
      blob(
        [
          [-0.3, -1.2],
          [0.3, -1.2],
          [0.4, 0.2],
          [0, 0.45],
          [-0.4, 0.2],
        ],
        trim
      );
      if (atk && f >= 2) {
        // A cone of fire, kept short enough to stay on the sprite canvas.
        const y0 = 1.0 + neck;
        const y1 = Math.min(y0 + 0.85, (33 - shift) / r);
        const len = y1 - y0;
        const w = f === 2 ? 1.0 : 1.2;
        const flame = (k, kl, fill) =>
          blob(
            [
              [-0.12, y0],
              [-w * k * 0.6, y0 + len * kl * 0.45],
              [-w * k, y0 + len * kl * 0.86],
              [-w * k * 0.58, y0 + len * kl * 0.76],
              [-w * k * 0.3, y0 + len * kl],
              [0, y0 + len * kl * 0.8],
              [w * k * 0.3, y0 + len * kl],
              [w * k * 0.58, y0 + len * kl * 0.76],
              [w * k, y0 + len * kl * 0.86],
              [w * k * 0.6, y0 + len * kl * 0.45],
              [0.12, y0],
            ],
            fill
          );
        ctx.globalAlpha *= f === 2 ? 1 : 0.7;
        flame(1, 1, f === 2 ? '#ff6a1c' : BLOOD);
        ctx.lineWidth = 1;
        flame(0.55, 0.8, f === 2 ? '#ffd040' : '#ff7a20');
        ctx.lineWidth = 2.6;
        ctx.globalAlpha /= f === 2 ? 1 : 0.7;
      }
      ctx.save();
      ctx.translate(0, neck * r);
      blob(
        [
          [-0.35, 0.2],
          [0, 0.05],
          [0.35, 0.2],
          [0.26, 0.85],
          [0, 1.1],
          [-0.26, 0.85],
        ],
        hide
      );
      for (const sd of [-1, 1])
        blob(
          [
            [sd * 0.25, 0.25],
            [sd * 0.6, -0.05],
            [sd * 0.38, 0.4],
          ],
          BONE
        );
      eye(-0.16, 0.55, 0.1);
      eye(0.16, 0.55, 0.1);
      if (atk) {
        // Fire gathering in the throat, brightest just before it is loosed.
        const glow = [0.1, 0.17, 0.14, 0.08][f];
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(0, 0.95 * r, glow * r + 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = f === 1 ? '#ffd040' : '#ff7a20';
        ctx.beginPath();
        ctx.arc(0, 0.95 * r, glow * r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = BONE;
      for (let i = 0; i < 4; i++) {
        // The spine snakes from side to side in flight, most at the tail.
        const sx = walk ? [1, 0.3, -1, -0.3][(cyc + i) % 4] * (0.14 - i * 0.03) * r : 0;
        ctx.beginPath();
        ctx.moveTo(sx - 0.08 * r, (-1.05 + i * 0.28) * r);
        ctx.lineTo(sx, (-1.2 + i * 0.28) * r);
        ctx.lineTo(sx + 0.08 * r, (-1.05 + i * 0.28) * r);
        ctx.fill();
      }
    } else {
      if (walk) {
        // It drags itself: stub limbs reach and pull in turn, and it leaves a smear.
        ctx.fillStyle = 'rgba(110,10,18,0.55)';
        ctx.beginPath();
        ctx.ellipse(-0.1 * r, -1.05 * r, 0.5 * r, 0.22 * r, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const sd of [-1, 1]) {
          const reach = 0.55 + sd * s * 0.4;
          inkLine(
            [
              [sd * 0.8, 0.1],
              [sd * 1.12, reach],
            ],
            hide,
            0.17 * r
          );
          for (const k of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.moveTo((sd * 1.12 + k * 0.08) * r, reach * r);
            ctx.lineTo((sd * 1.12 + k * 0.14) * r, (reach + 0.2) * r);
            ctx.strokeStyle = BONE;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.6;
        }
      }
      // Abomination: a stitched, swollen mass with too many eyes and exposed ribs.
      blob(
        [
          [-0.9, -0.35],
          [-0.55, -0.9],
          [0.1, -1.0],
          [0.75, -0.7],
          [1.05, -0.05],
          [0.85, 0.65],
          [0.2, 1.0],
          [-0.55, 0.85],
          [-1.05, 0.3],
        ],
        hide
      );
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0.25 * r, (-0.45 + i * 0.22) * r, 0.42 * r, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const y = (-0.6 + i * 0.3) * r;
        ctx.beginPath();
        ctx.moveTo(-0.62 * r, y);
        ctx.lineTo(-0.38 * r, y + 0.08 * r);
        ctx.stroke();
      }
      ctx.lineWidth = 2.6;
      eye(-0.45, 0.35, 0.14);
      eye(0.1, 0.55, 0.1);
      eye(0.5, 0.2, 0.08);
      if (!atk) {
        blob(
          [
            [-0.2, 0.7],
            [0.35, 0.72],
            [0.25, 0.95],
            [-0.1, 0.95],
          ],
          INK
        );
        ctx.fillStyle = BONE;
        for (let i = 0; i < 4; i++)
          ctx.fillRect((-0.14 + i * 0.12) * r, 0.72 * r, 0.06 * r, 0.1 * r);
      } else {
        // Lunging maw: the mouth gapes wider each frame until the bite lands.
        const g = [0.3, 0.5, 1, 0.6][f];
        const mx = 0.07;
        const hw = 0.28 + g * 0.3;
        const top = 0.7 - g * 0.24;
        const bot = 0.95 + g * 0.17;
        blob(
          [
            [mx - hw, top + 0.04],
            [mx, top - 0.03],
            [mx + hw, top + 0.06],
            [mx + hw * 0.92, bot - 0.1],
            [mx + hw * 0.4, bot],
            [mx - hw * 0.4, bot],
            [mx - hw * 0.92, bot - 0.12],
          ],
          INK
        );
        ctx.fillStyle = BLOOD;
        ctx.beginPath();
        ctx.ellipse(
          mx * r,
          ((top + bot) / 2 + 0.02) * r,
          hw * 0.55 * r,
          (bot - top) * 0.26 * r,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        // Fangs, upper row pointing forward and lower row pointing back.
        const n = 5;
        const th = 0.07 + g * 0.13;
        ctx.fillStyle = BONE;
        for (let i = 0; i < n; i++) {
          const x = mx + (i / (n - 1) - 0.5) * hw * 1.5;
          const tw = (hw * 0.75) / n;
          ctx.beginPath();
          ctx.moveTo((x - tw) * r, (top + 0.04) * r);
          ctx.lineTo(x * r, (top + 0.04 + th) * r);
          ctx.lineTo((x + tw) * r, (top + 0.04) * r);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo((x * 0.8 - tw) * r, (bot - 0.05) * r);
          ctx.lineTo(x * 0.8 * r, (bot - 0.05 - th * 0.8) * r);
          ctx.lineTo((x * 0.8 + tw) * r, (bot - 0.05) * r);
          ctx.closePath();
          ctx.fill();
        }
        if (f === 2) {
          // Spittle thrown off the snap.
          ctx.strokeStyle = BONE;
          ctx.lineWidth = 1.4;
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo((mx + sd * (hw + 0.06)) * r, (bot - 0.05) * r);
            ctx.lineTo((mx + sd * (hw + 0.24)) * r, (bot + 0.06) * r);
            ctx.stroke();
          }
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.6;
        }
      }
    }

    if (boss) {
      // Each warlord carries a mark of their own on top of the shared body.
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      if (type === 'boss_gorath') {
        // War banner on a pole at his back, and a broken tusk.
        ctx.beginPath();
        ctx.moveTo(-0.75 * r, -0.2 * r);
        ctx.lineTo(-0.75 * r, -1.48 * r);
        ctx.stroke();
        blob(
          [
            [-0.75, -1.44],
            [-0.05, -1.3],
            [-0.3, -1.12],
            [-0.05, -0.93],
            [-0.75, -0.98],
          ],
          BLOOD
        );
        blob(
          [
            [0.55, 0.25],
            [0.95, 0.5],
            [0.8, 0.2],
          ],
          INK
        );
        // A great maul carried over the right shoulder.
        inkLine(
          [
            [0.8, 0.55],
            [1.22, -0.72],
          ],
          '#5a4a38',
          0.11 * r
        );
        blob(
          [
            [0.92, -0.98],
            [1.5, -0.8],
            [1.4, -0.42],
            [0.82, -0.6],
          ],
          '#57534e'
        );
        ctx.fillStyle = BONE;
        for (const [x, y] of [
          [1.02, -0.8],
          [1.3, -0.7],
        ]) {
          ctx.beginPath();
          ctx.arc(x * r, y * r, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'boss_thokk') {
        // Boulder fists, and a ridge of standing stones down the back in place of horns.
        for (const sd of [-1, 1]) {
          blob(
            [
              [sd * 0.98, 0.2],
              [sd * 1.3, 0.12],
              [sd * 1.42, 0.5],
              [sd * 1.2, 0.78],
              [sd * 0.95, 0.6],
            ],
            '#8a8478'
          );
        }
        for (const [x, h] of [
          [-0.55, 0.3],
          [-0.2, 0.52],
          [0.15, 0.4],
          [0.5, 0.26],
        ])
          blob(
            [
              [x - 0.14, -0.86],
              [x - 0.04, -0.9 - h],
              [x + 0.12, -0.9 - h * 0.8],
              [x + 0.16, -0.86],
            ],
            '#8a8478'
          );
        // Slabs of mountain stone across the shoulders.
        for (const [x, y, w] of [
          [-0.75, -0.55, 0.5],
          [0.25, -0.6, 0.55],
          [-0.2, -0.82, 0.4],
        ]) {
          blob(
            [
              [x, y],
              [x + w, y - 0.08],
              [x + w - 0.06, y + 0.3],
              [x + 0.05, y + 0.34],
            ],
            '#8a8478'
          );
        }
      } else if (type === 'boss_malachar') {
        // A third eye, and a tattered cloak trailing behind.
        blob(
          [
            [-0.95, -0.5],
            [-1.25, -1.3],
            [-0.6, -1.05],
            [0, -1.45],
            [0.6, -1.05],
            [1.25, -1.3],
            [0.95, -0.5],
          ],
          INK
        );
        eye(0, 0.22, 0.13);
        // Antlers, branching wide of the skull.
        for (const sd of [-1, 1]) {
          inkLine(
            [
              [sd * 0.35, 0.12],
              [sd * 0.85, -0.12],
              [sd * 1.28, 0.1],
            ],
            BONE,
            0.07 * r
          );
          inkLine(
            [
              [sd * 0.85, -0.12],
              [sd * 1.1, -0.5],
            ],
            BONE,
            0.06 * r
          );
          inkLine(
            [
              [sd * 0.62, 0],
              [sd * 0.7, -0.42],
            ],
            BONE,
            0.05 * r
          );
        }
        ctx.strokeStyle = BLOOD;
        ctx.lineWidth = 1.2;
        for (const x of [-0.8, -0.3, 0.3, 0.8]) {
          ctx.beginPath();
          ctx.moveTo(x * r, -0.7 * r);
          ctx.lineTo(x * r * 1.15, -1.2 * r);
          ctx.stroke();
        }
      } else if (type === 'boss_morwen') {
        // A black veil with a long ragged train, and a bone staff.
        blob(
          [
            [-0.55, -0.6],
            [0.6, -0.7],
            [0.85, -1.5],
            [0.4, -1.2],
            [0.1, -1.62],
            [-0.25, -1.22],
            [-0.7, -1.5],
          ],
          INK
        );
        blob(
          [
            [-0.6, -0.5],
            [0.3, -0.95],
            [0.85, -0.3],
            [0.5, 0.15],
            [-0.2, 0.2],
            [-0.75, 0.0],
          ],
          INK
        );
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(1.2 * r, 0.9 * r);
        ctx.lineTo(1.2 * r, -1.1 * r);
        ctx.stroke();
        ctx.fillStyle = BLOOD;
        ctx.beginPath();
        ctx.arc(1.2 * r, -1.2 * r, 0.16 * r, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'boss_rotfather') {
        // A split gut dragging behind, boils, and a cloud of flies.
        blob(
          [
            [-0.5, -0.8],
            [0.45, -0.85],
            [0.6, -1.25],
            [0.1, -1.48],
            [-0.45, -1.3],
          ],
          '#7a6a48'
        );
        ctx.fillStyle = BLOOD;
        ctx.beginPath();
        ctx.ellipse(0.05 * r, -1.15 * r, 0.26 * r, 0.14 * r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a9a3a';
        for (const [x, y, w] of [
          [-0.6, -0.4, 0.16],
          [0.55, -0.35, 0.13],
          [0.7, 0.35, 0.11],
          [-0.1, -0.7, 0.14],
          [-0.75, 0.4, 0.1],
        ]) {
          ctx.beginPath();
          ctx.arc(x * r, y * r, w * r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = INK;
        for (let i = 0; i < 9; i++) {
          const a = i * 0.7 + frame * 0.25;
          ctx.fillRect(Math.cos(a) * r * 1.45, Math.sin(a * 1.3) * r * 1.3, 1.6, 1.6);
        }
      } else if (type === 'boss_grimm') {
        // A reaper's scythe across the back, and cinder flames licking off the shoulders.
        inkLine(
          [
            [-1.25, 0.85],
            [1.05, -1.0],
          ],
          '#5a4a38',
          0.09 * r
        );
        ctx.beginPath();
        ctx.moveTo(1.05 * r, -1.0 * r);
        ctx.quadraticCurveTo(1.75 * r, -0.75 * r, 1.6 * r, 0.25 * r);
        ctx.quadraticCurveTo(1.45 * r, -0.5 * r, 0.95 * r, -0.8 * r);
        ctx.closePath();
        ctx.fillStyle = BONE;
        ctx.fill();
        ctx.stroke();
        for (const sd of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const x = sd * (0.35 + i * 0.22);
            const h = 0.5 + ((i + Math.floor(frame)) % 3) * 0.14;
            blob(
              [
                [x - 0.1, -0.45],
                [x, -0.45 - h],
                [x + 0.1, -0.45],
              ],
              i % 2 ? '#ff7a20' : BLOOD
            );
          }
        }
      } else if (type === 'boss_vexis') {
        // Four jointed limbs arched out of the back, twin hooked daggers, slit eyes.
        for (const sd of [-1, 1]) {
          for (const [ky, ty] of [
            [-0.75, -0.25],
            [-0.3, 0.55],
          ]) {
            inkLine(
              [
                [sd * 0.5, ky + 0.25],
                [sd * 1.25, ky],
                [sd * 1.55, ty],
              ],
              '#2c2830',
              0.06 * r
            );
            blob(
              [
                [sd * 1.47, ty - 0.05],
                [sd * 1.63, ty - 0.05],
                [sd * 1.58, ty + 0.26],
              ],
              BONE
            );
          }
        }
        for (const sd of [-1, 1]) {
          blob(
            [
              [sd * 1.15, 0.2],
              [sd * 1.75, 0.05],
              [sd * 1.7, 0.4],
              [sd * 1.35, 0.5],
            ],
            BLOOD
          );
        }
        ctx.fillStyle = '#ffd040';
        ctx.fillRect(-0.24 * r, 0.4 * r, 0.16 * r, 0.04 * r);
        ctx.fillRect(0.08 * r, 0.4 * r, 0.16 * r, 0.04 * r);
      } else if (type === 'boss_karg') {
        // Forge stacks on the back, smoking.
        for (const x of [-0.55, 0.3]) {
          blob(
            [
              [x, -0.75],
              [x + 0.28, -0.75],
              [x + 0.24, -1.2],
              [x + 0.04, -1.2],
            ],
            INK
          );
          ctx.fillStyle = 'rgba(120,112,108,0.7)';
          ctx.beginPath();
          ctx.arc((x + 0.14) * r, (-1.28 - (frame % 3) * 0.04) * r, 0.15 * r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ff5a20';
        ctx.fillRect(-0.2 * r, 0.52 * r, 0.4 * r, 0.14 * r);
        // The left arm ends in a forge hammer.
        blob(
          [
            [-1.6, 0.3],
            [-0.95, 0.3],
            [-0.95, 0.95],
            [-1.6, 0.95],
          ],
          INK
        );
        blob(
          [
            [-1.52, 0.95],
            [-1.03, 0.95],
            [-1.03, 1.1],
            [-1.52, 1.1],
          ],
          '#ffa040'
        );
      } else if (type === 'boss_volk') {
        // A marshal's standard and spiked pauldrons.
        ctx.beginPath();
        ctx.moveTo(0.85 * r, -0.2 * r);
        ctx.lineTo(0.85 * r, -1.48 * r);
        ctx.stroke();
        blob(
          [
            [0.85, -1.44],
            [1.45, -1.34],
            [1.45, -0.92],
            [0.85, -1.02],
          ],
          INK
        );
        blob(
          [
            [1.0, -1.28],
            [1.32, -1.22],
            [1.32, -1.04],
            [1.0, -1.1],
          ],
          BLOOD
        );
        for (const sd of [-1, 1])
          blob(
            [
              [sd * 1.05, -0.6],
              [sd * 1.55, -0.95],
              [sd * 1.2, -0.35],
            ],
            BONE
          );
        // A tower shield on the left arm, and a blood plume down the helm.
        blob(
          [
            [-1.5, 0.05],
            [-0.82, 0.05],
            [-0.82, 0.95],
            [-1.16, 1.12],
            [-1.5, 0.95],
          ],
          trim
        );
        blob(
          [
            [-1.32, 0.3],
            [-1.16, 0.5],
            [-1.0, 0.3],
            [-1.0, 0.55],
            [-1.16, 0.75],
            [-1.32, 0.55],
          ],
          BLOOD
        );
        blob(
          [
            [-0.1, -0.85],
            [0.1, -0.85],
            [0.07, 0.0],
            [-0.07, 0.0],
          ],
          BLOOD
        );
      } else if (type === 'boss_sylvara') {
        // Blood-red wing membranes and a crest of spines.
        for (const sd of [-1, 1]) {
          blob(
            [
              [sd * 0.5, -0.15],
              [sd * 1.25, -0.5],
              [sd * 1.15, 0.0],
              [sd * 0.75, 0.1],
            ],
            BLOOD
          );
        }
        for (const x of [-0.2, 0, 0.2])
          blob(
            [
              [x - 0.06, 0.15],
              [x, -0.25],
              [x + 0.06, 0.15],
            ],
            BONE
          );
        // A forked tail, and swept bone frills beside the jaw.
        for (const sd of [-1, 1]) {
          blob(
            [
              [sd * 0.05, -1.15],
              [sd * 0.28, -1.2],
              [sd * 0.5, -1.72],
              [sd * 0.12, -1.42],
            ],
            trim
          );
          blob(
            [
              [sd * 0.3, 0.6],
              [sd * 0.92, 0.42],
              [sd * 0.7, 0.72],
              [sd * 0.98, 0.9],
              [sd * 0.34, 0.86],
            ],
            BONE
          );
        }
      }
      ctx.strokeStyle = INK;
      // Crown of horns and a blood halo mark every named warlord.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      const crownN = BOSS_CROWN[type] ?? 5;
      for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
        if (crownN === 0 || (crownN === 1 && x !== 0) || (crownN === 3 && Math.abs(x) === 0.25))
          continue;
        const h = x === 0 ? 0.55 : 0.36;
        blob(
          [
            [x - 0.1, -0.88],
            [x, -0.88 - h],
            [x + 0.1, -0.88],
          ],
          BONE
        );
      }
      if (!dying) {
        ctx.strokeStyle = BLOOD;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha /= 0.85;
      }
    }
    if (dying) {
      // The hide splits: jagged cracks spread from the wound; on a warlord they glow.
      const n = Math.min(7, 2 + dieF);
      for (let i = 0; i < n; i++) {
        const a = i * 2.4 + 0.5;
        const len = 0.45 + ((i * 37) % 10) * 0.045 + Math.min(dieF, 4) * 0.07;
        const pts = [
          [Math.cos(a) * 0.12, Math.sin(a) * 0.12 + 0.1],
          [Math.cos(a + 0.35) * len * 0.5, Math.sin(a + 0.35) * len * 0.5 + 0.1],
          [Math.cos(a - 0.1) * len * 0.78, Math.sin(a - 0.1) * len * 0.78 + 0.1],
          [Math.cos(a + 0.15) * len, Math.sin(a + 0.15) * len + 0.1],
        ];
        if (boss && dieF <= 4) inkLine(pts, '#ff5a30', 1.8 + (dieF % 2));
        else inkLine(pts, BLOOD, 1.1);
      }
    }
    if (hurt) {
      // Flinch: a spray of blood off the face.
      ctx.fillStyle = BLOOD;
      for (const [x, y, w] of [
        [-0.5, 1.15, 1.8],
        [-0.15, 1.32, 1.4],
        [0.3, 1.25, 2],
        [0.62, 1.05, 1.3],
        [0.05, 1.12, 1.1],
      ]) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, w, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (dying) {
      const k = [0, 0, 0.1, 0.4, 0.75, 1, 1, 1][dieF];
      // The carcass darkens as it settles; fire chars it and a hex withers it.
      if (dieCause === 'burn') tintDrawn(ctx, '#120e0c', 0.3 + k * 0.5);
      else if (dieCause === 'hex') tintDrawn(ctx, '#3c2a54', 0.2 + k * 0.4);
      else tintDrawn(ctx, '#0a0608', k * 0.4);
      ctx.lineCap = 'round';
      if (dieCause === 'shot') {
        stuckArrow(ctx, -r * 0.3, -r * 0.2, -Math.PI * 0.35, r * 0.6);
        stuckArrow(ctx, r * 0.35, r * 0.1, -Math.PI * 0.5, r * 0.55);
        stuckArrow(ctx, 0, r * 0.45, -Math.PI * 0.62, r * 0.5);
      } else if (dieCause === 'cut') {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.45);
        ctx.lineTo(r * 0.65, r * 0.4);
        inkStroke(ctx, BLOOD, 2.6, 2);
      } else if (dieCause === 'burn' && dieF <= 5) {
        const h = [1.0, 1.25, 1.3, 1.1, 0.8, 0.5][dieF];
        flameLick(ctx, -r * 0.55, r * 0.1, r * 0.3, r * h * 0.8, false);
        flameLick(ctx, r * 0.5, -r * 0.2, r * 0.28, r * h * 0.7, false);
        flameLick(ctx, 0, r * 0.3, r * 0.2, r * h * 0.5, true);
      } else if (dieCause === 'hex') {
        hexSigil(ctx, 0, 0, r * 0.3);
      } else if (dieCause === 'blast' && dieF <= 2) {
        drawDeathStrike(ctx, 'blast', r * 0.55, dieF ? 1 : 0);
      }
      if (dieCause === 'burn' || dieCause === 'blast') scorchMark(ctx, r * 0.72, 0.5 + k * 0.5);
      else if (dieCause === 'hex') scorchMark(ctx, r * 0.7, 0.4 + k * 0.5, '#2a1c3a');
      bloodPool(ctx, r * 0.78, [0, 0.1, 0.25, 0.45, 0.65, 0.82, 0.93, 1][dieF], 0, 0.1);
    }
  }

  function drawUnitTopDown(ctx, type, rotation, team, frame = 0, animState = 'idle', lod = 0) {
    // Defense-in-depth: every branch below calls type.startsWith(...) unguarded. A unit
    // whose spriteType desyncs from its type (stale pooled field, bad save data, etc.)
    // reaches here as undefined and throws, which aborts the ENTIRE world-layer draw for
    // that frame (game.js wraps it in one big try/catch around all world rendering) —
    // not just that one unit. Fall back to 'footman' so a single bad unit can never blank
    // the whole battlefield.
    if (typeof type !== 'string') type = 'footman';
    if (typeof animState !== 'string') animState = 'idle';
    // Only the far-off tier is a plain disc. Every nearer tier is the real figure: a
    // sprite is drawn once and cached, so detail costs nothing per frame; the tiers
    // save memory by sharing coarser rotations and fewer frames instead.
    if (lod >= 3) {
      const style = resolveUnitStyle(type, team, 'footman');
      drawMinimalMarker(ctx, style, team, style.size * 0.82);
      return;
    }
    const dieCause = animState.startsWith('die_') ? animState.slice(4) : '';
    if (type === 'siege_tower') {
      drawSiegeTowerUnit(inkCtx(ctx), resolveUnitStyle(type, 'enemy'), team, frame, animState, lod);
      if (dieCause) {
        const f = Math.max(0, Math.min(DEATH_FRAMES - 1, Math.floor(frame)));
        tintDrawn(ctx, '#120e0c', 0.15 + f * 0.09);
        scorchMark(ctx, UNIT_STYLE.siege_tower.size, 0.5 + f * 0.1);
      }
      return;
    }
    if (MONSTER_SPRITES.includes(type) || type.startsWith('boss_')) {
      drawMonsterUnit(ctx, type, team, frame, animState, lod);
      return;
    }
    if (dieCause) {
      const f = Math.max(0, Math.min(DEATH_FRAMES - 1, Math.floor(frame)));
      drawDeathFigure(ctx, type, team, DEATH_CAUSES.includes(dieCause) ? dieCause : 'cut', f);
      return;
    }
    drawInkFigure(ctx, type, rotation, team, frame, animState);
  }

  /** Coarsest rotation step each LOD tier may use, whatever the quality setting. */
  const LOD_ROTATION_STEP = [15, 15, 30, 45];

  function getUnitCanvas(type, rotation, team, frame = 0, scale = 2, animState = 'idle', lod = 0) {
    const lodLevel = Math.max(0, Math.min(3, lod | 0));
    if (typeof type !== 'string') type = 'footman';
    if (typeof animState !== 'string') animState = 'idle';
    // Facing is quantised to 15 degrees at the finest. One-degree steps (the "high" tier
    // asked for them) made nearly every turning unit a cache miss: 360 rotations for
    // each type, team, state and frame, against a cache of a few hundred canvases.
    const gfxRot =
      typeof GfxQuality !== 'undefined'
        ? GfxQuality.quantizeRotation(rotation)
        : Math.round(rotation);
    const step = LOD_ROTATION_STEP[lodLevel];
    let rot = (((Math.round(gfxRot / step) * step) % 360) + 360) % 360;
    // Monsters, the siege tower and corpses are drawn in one facing only.
    if (
      animState.startsWith('die_') ||
      type === 'siege_tower' ||
      MONSTER_SPRITES.includes(type) ||
      type.startsWith('boss_')
    )
      rot = 270;
    const qScale =
      typeof GfxQuality !== 'undefined'
        ? GfxQuality.quantizeScale(scale)
        : Math.round(scale * 4) / 4;
    // A flinch is a single pose, so every frame shares one cache entry.
    const cacheFrame =
      animState === 'hurt'
        ? 0
        : typeof SpriteLod !== 'undefined'
          ? SpriteLod.cacheFrameForLod(lodLevel, frame, animState)
          : frame;
    const cacheAnim =
      typeof SpriteLod !== 'undefined' ? SpriteLod.cacheAnimForLod(lodLevel, animState) : animState;
    const key = `${type}_${rot}_${team}_${cacheFrame | 0}_${qScale}_${cacheAnim}_l${lodLevel}`;
    const hit = cache.get(key);
    if (hit) {
      // Refresh recency only now and then: a delete and re-insert on every draw of
      // every unit was the hottest line in the sprite path.
      if (++cacheTouch % 8 === 0) {
        cache.delete(key);
        cache.set(key, hit);
      }
      return hit;
    }

    // Rendered at 2x so outlines stay crisp when zoomed. The crowd tiers render
    // smaller (1.5x, then 1x), which is where most of the cache's memory goes.
    const px = lodLevel >= 2 ? 1 : lodLevel === 1 ? 1.5 : 2;
    const size = UNIT_CANVAS_UNITS * px;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.scale(px, px);
    drawUnitTopDown(ctx, type, rot, team, cacheFrame, cacheAnim, lodLevel);
    ctx.globalAlpha = 1;
    cache.set(key, c);
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    return c;
  }

  // ── Animation clock ──────────────────────────────────────────────────────
  // Which state and frame a unit shows this tick. The game keeps only idle, walk and
  // attack; everything else (rout, celebrate, healer and builder at work, the idle
  // variations and each faction's stride) is derived here from what the unit is doing.
  const animOut = { state: 'idle', frame: 0 };
  let cheerFrom = -1;
  let cheerUntil = -1;
  // Idle scripts: eight beats each. 0 rest, 1 breath, 2/3 weight shift, 4/5 a look round.
  const IDLE_SCRIPTS = [
    [0, 1, 0, 1, 0, 4, 0, 1],
    [0, 1, 2, 2, 0, 1, 0, 5],
    [0, 0, 1, 3, 3, 0, 1, 0],
    [1, 0, 5, 0, 1, 0, 4, 4],
    [0, 1, 0, 0, 3, 1, 0, 2],
  ];
  const IDLE_BEAT = 26;

  function animSeed(u) {
    let h = u._animSeed;
    if (h === undefined) {
      const id = String(u.id ?? '');
      h = 7;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      h = ((h ^ (h >>> 11)) >>> 0) % 9973;
      u._animSeed = h;
    }
    return h;
  }

  /** The wave is won: soldiers standing idle cheer for a few seconds. */
  function celebrate(tick, ticks = 170) {
    cheerFrom = tick;
    cheerUntil = tick + ticks;
  }

  function animFor(u, tick = 0) {
    const type = u.spriteType || u.type;
    const seed = animSeed(u);
    let state = u.animState || 'idle';
    let frame = 0;
    if (u.fleeing && u.hp > 0) {
      state = 'rout';
      frame = Math.floor((tick + seed) / 3) % 4;
    } else if ((u.hitFlash || 0) > 0 && state !== 'attack') {
      state = 'hurt';
    } else if (type === 'builder' && state === 'attack') {
      // A builder "attacks" his work for as long as he is on the job.
      if (u.building || u.repairTarget) {
        state = 'build';
        frame = Math.floor((tick + seed) / 6) % 4;
      } else state = 'idle';
    } else if (u.combatType === 'healer' && u.healTargetId != null && state !== 'walk') {
      state = 'heal';
      frame = Math.floor((tick + seed) / 9) % 4;
    } else if (state === 'attack') {
      // An attack plays its four frames across the swing, not on the walk clock.
      frame = Math.max(0, Math.min(3, 3 - Math.floor((u.attackAnimTimer || 0) / 4)));
    } else if (state === 'walk') {
      frame = Math.floor((tick + seed * 3) / gaitOf(type, u.team).period) % 4;
    }
    if (state === 'idle') {
      const since = tick - cheerFrom - (seed % 28);
      if (
        u.team === 'player' &&
        tick < cheerUntil &&
        since >= 0 &&
        !u.demoralized &&
        !u.retreatingToMed &&
        !u.pinned
      ) {
        state = 'celebrate';
        // Veterans have seen it before: blade up, a nod, no more.
        frame =
          (u.vetTier || 0) > 0 || u.isGeneral
            ? 4 + (Math.floor(since / 20) % 2)
            : Math.floor(since / 7) % 4;
      } else if (!u.demoralized) {
        const script = IDLE_SCRIPTS[seed % IDLE_SCRIPTS.length];
        frame = script[Math.floor((tick + seed * 5) / IDLE_BEAT) % script.length];
      }
    }
    animOut.state = state;
    animOut.frame = frame;
    return animOut;
  }

  function drawIcon(ctx, type, w = 32, h = 32) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h * 0.56);
    ctx.scale(0.9, 0.9);
    drawUnitTopDown(ctx, type, -90, 'player', 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAbilityIcon(ctx, type) {
    ctx.clearRect(0, 0, 32, 32);
    const cx = 16,
      cy = 16;
    if (type === 'fireball' || type === 'meteor') {
      ctx.fillStyle = type === 'meteor' ? '#6a5040' : '#ff6020';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = type === 'meteor' ? '#ff8040' : '#ffe080';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      if (type === 'meteor') {
        ctx.strokeStyle = '#ff6020';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy - 2);
        ctx.lineTo(cx + 14, cy - 10);
        ctx.stroke();
      }
    } else if (type === 'lightning' || type === 'frost_nova') {
      if (type === 'frost_nova') {
        ctx.strokeStyle = '#a0d8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = type === 'frost_nova' ? '#d0f0ff' : '#ffe040';
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy - 10);
      ctx.lineTo(cx - 2, cy);
      ctx.lineTo(cx + 2, cy);
      ctx.lineTo(cx - 4, cy + 10);
      ctx.lineTo(cx + 4, cy - 2);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'heal' || type === 'heal_rain') {
      ctx.fillStyle = '#40e0a0';
      for (let i = -8; i <= 8; i += 4) {
        ctx.fillRect(cx + i, cy - 8, 2, 6);
        ctx.fillRect(cx + i + 1, cy + 2, 2, 6);
      }
      ctx.fillRect(cx - 6, cy - 1, 12, 2);
      ctx.fillRect(cx - 1, cy - 6, 2, 12);
    } else if (type === 'reinforce') {
      ctx.fillStyle = '#6070a0';
      ctx.fillRect(cx - 10, cy - 4, 8, 8);
      ctx.fillRect(cx + 2, cy - 4, 8, 8);
      ctx.fillStyle = '#e0c060';
      ctx.fillRect(cx - 4, cy + 4, 8, 4);
    } else if (type === 'rally') {
      ctx.fillStyle = '#c04040';
      ctx.fillRect(cx - 1, cy - 10, 2, 14);
      ctx.fillStyle = '#f0c040';
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 8);
      ctx.lineTo(cx + 10, cy - 4);
      ctx.lineTo(cx + 1, cy);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'scout_flare') {
      ctx.fillStyle = '#ff4040';
      ctx.beginPath();
      ctx.arc(cx - 4, cy + 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 4);
      ctx.quadraticCurveTo(cx, cy - 6, cx + 6, cy - 10);
      ctx.stroke();
    } else if (type === 'fortify') {
      ctx.strokeStyle = '#80a0c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx - 8, cy + 6);
      ctx.lineTo(cx + 8, cy + 6);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,160,220,0.35)';
      ctx.fill();
      ctx.strokeStyle = '#a0c0e0';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (type === 'dispel') {
      // Arcane purge — violet ring washing out blight.
      ctx.strokeStyle = '#c090ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#e8d0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0.2, Math.PI * 1.6);
      ctx.stroke();
      ctx.fillStyle = '#a070ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,160,255,0.45)';
      ctx.fillRect(cx - 7, cy + 5, 14, 2);
    }
  }

  function getBattlefieldCanvas(w, h, baseW = 400, baseH = 600) {
    const safeW = Math.max(1, Math.floor(Number(w)) || 0);
    const safeH = Math.max(1, Math.floor(Number(h)) || 0);
    const key = `${safeW}x${safeH}_${baseW}x${baseH}`;
    if (battlefieldCache && battlefieldCacheKey === key) return battlefieldCache;
    const c = document.createElement('canvas');
    c.width = safeW;
    c.height = safeH;
    drawBattlefield(c.getContext('2d'), safeW, safeH, baseW, baseH);
    battlefieldCache = c;
    battlefieldCacheKey = key;
    return c;
  }

  function invalidateBattlefieldCache() {
    battlefieldCache = null;
    battlefieldCacheKey = '';
  }

  function prewarmCache() {
    const types = [
      'footman',
      'archer',
      'mage',
      'cavalry',
      'healer',
      'knight',
      'sapper',
      'general',
      'scout',
      'bard',
      'ballista',
      'pikeman',
      'builder',
      'courier',
      'doomslayer_hero',
      'orc',
      'goblin',
      'dark_knight',
      'orc_archer',
      'troll',
      'berserker',
      'siege_tower',
      'abomination',
      'behemoth',
      'war_chief',
      'roster_ultimis',
      'roster_halo',
      'roster_jojo',
      'roster_dragonball',
      'roster_wwe',
    ];
    // Each side is warmed only in the facing it starts in: soldiers look north,
    // the enemy comes south.
    for (const t of types) {
      const team = t in KIT && familyOf(t, 'enemy') === 'human' ? 'player' : 'enemy';
      for (const s of ['idle', 'walk'])
        getUnitCanvas(t, team === 'player' ? 270 : 90, team, 0, 1, s);
    }
  }

  function drawBattlefield(ctx, w, h, baseW = 400, baseH = 600) {
    // Base gradient — wider luminance range than before so the field reads as lit
    // ground rather than a flat color fill.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a1210');
    grad.addColorStop(0.4, '#34281f');
    grad.addColorStop(0.7, '#43342a');
    grad.addColorStop(1, '#1c1412');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Large-scale patchy clumps (mown/wild grass variation) — coarse, cheap, drawn
    // once and cached onto the battlefield canvas, so a bigger loop here costs
    // nothing per frame.
    for (let y = 0; y < h; y += 34) {
      for (let x = 0; x < w; x += 34) {
        const hash = (x * 131 + y * 617 + w * 7) % 100;
        if (hash < 62) continue;
        const cw = 20 + (hash % 14);
        const ch = 14 + (hash % 10);
        ctx.fillStyle = hash > 86 ? 'rgba(150,120,84,0.10)' : 'rgba(6,3,4,0.24)';
        ctx.beginPath();
        ctx.ellipse(x + (hash % 9) - 4, y + (hash % 7) - 3, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fine speckle (individual grass blades/dirt flecks).
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const hash = (x * 73 + y * 997 + w * 3) % 100;
        if (hash < 48) continue;
        ctx.fillStyle = hash > 82 ? 'rgba(8,5,6,0.55)' : 'rgba(134,112,74,0.26)';
        ctx.fillRect(x + (hash % 4), y + (hash % 3), 2, hash > 70 ? 3 : 2);
      }
    }

    // Old blood, cracks and scattered bones — sparse, deterministic, drawn once into the cache.
    for (let y = 20; y < h; y += 58) {
      for (let x = 14; x < w; x += 58) {
        const hash = (x * 211 + y * 389 + w * 11) % 100;
        const px = x + (hash % 23);
        const py = y + ((hash * 7) % 19);
        if (hash < 9) {
          ctx.fillStyle = 'rgba(120,10,16,0.34)';
          ctx.beginPath();
          ctx.ellipse(px, py, 9 + (hash % 6), 5 + (hash % 4), hash, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(70,4,10,0.4)';
          ctx.beginPath();
          ctx.ellipse(px + 2, py + 1, 4, 2.5, hash, 0, Math.PI * 2);
          ctx.fill();
        } else if (hash < 17) {
          ctx.strokeStyle = 'rgba(228,220,196,0.5)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(px - 4, py - 2);
          ctx.lineTo(px + 4, py + 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(228,220,196,0.55)';
          ctx.fillRect(px - 5.5, py - 3.5, 3, 3);
          ctx.fillRect(px + 3, py + 0.5, 3, 3);
        } else if (hash < 21) {
          ctx.fillStyle = 'rgba(228,220,196,0.6)';
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(8,5,6,0.9)';
          ctx.fillRect(px - 2, py - 1, 1.4, 1.6);
          ctx.fillRect(px + 0.6, py - 1, 1.4, 1.6);
        } else if (hash < 34) {
          ctx.strokeStyle = 'rgba(0,0,0,0.42)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px - 8, py);
          ctx.lineTo(px - 2, py + 3);
          ctx.lineTo(px + 3, py - 2);
          ctx.lineTo(px + 9, py + 2);
          ctx.stroke();
        }
      }
    }

    // Soft vignette — darkens the far corners so the eye settles on the lane
    // center where the action happens, without fighting the lane/tier overlays below.
    const vign = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.max(w, h) * 0.28,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72
    );
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, w, h);

    const tier = Math.max(Math.floor((w - baseW) / 90), Math.floor((h - baseH) / 110));
    if (tier > 0) {
      ctx.fillStyle = 'rgba(150,40,30,0.08)';
      if (h > baseH) ctx.fillRect(0, baseH - 8, w, h - baseH + 8);
      if (w > baseW) {
        const side = (w - baseW) / 2;
        ctx.fillRect(0, 0, side, h);
        ctx.fillRect(w - side, 0, side, h);
      }
      ctx.strokeStyle = 'rgba(200,40,36,0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      if (h > baseH) {
        ctx.beginPath();
        ctx.moveTo(12, baseH);
        ctx.lineTo(w - 12, baseH);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(228,220,196,0.75)';
      ctx.font = '10px Cinzel';
      ctx.textAlign = 'center';
      if (h > baseH) ctx.fillText('— NEW LANDS —', w / 2, baseH + 16);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(90,8,12,0.3)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#c8b8a0';
    ctx.font = '10px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText('— FROM THE NORTH —', w / 2, 17);
  }

  function drawAttackSideMarkers(ctx, w, h, sides, wave, opts = {}) {
    if (typeof VisualPolish !== 'undefined') {
      VisualPolish.drawMultiFrontIndicators(ctx, w, h, sides, wave || 0, opts);
      return;
    }
    if (!sides || sides.length <= 1) return;
    ctx.font = '9px Cinzel';
    ctx.fillStyle = 'rgba(255,120,80,0.85)';
    if (sides.includes('east')) {
      ctx.textAlign = 'right';
      ctx.fillText('EAST', w - 8, h * 0.45);
    }
    if (sides.includes('west')) {
      ctx.textAlign = 'left';
      ctx.fillText('WEST', 8, h * 0.45);
    }
    if (sides.includes('south')) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,90,70,0.9)';
      ctx.fillText('— SOUTH FLANK —', w / 2, h - 36);
    }
  }

  function drawTree(ctx, x, y, size) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + size * 0.42, size * 0.55, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    // twisted trunk and bare limbs
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.45);
    ctx.quadraticCurveTo(x - size * 0.12, y + size * 0.1, x + size * 0.04, y - size * 0.2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    for (const [dx, dy] of [
      [-0.5, -0.42],
      [0.48, -0.5],
      [-0.2, -0.66],
      [0.22, -0.7],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + size * 0.02, y - size * 0.1);
      ctx.quadraticCurveTo(x + dx * size * 0.4, y - size * 0.3, x + dx * size, y + dy * size);
      ctx.stroke();
    }
    // sparse dead canopy
    const blobs = [
      [-0.28, -0.4, 0.26],
      [0.26, -0.46, 0.24],
      [0, -0.6, 0.28],
    ];
    for (const [dx, dy, rr] of blobs) {
      ctx.beginPath();
      ctx.arc(x + dx * size, y + dy * size, rr * size, 0, Math.PI * 2);
      ctx.fillStyle = '#141c14';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,140,110,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y - size * 0.6, size * 0.26, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function teamStroke(team) {
    if (team === 'player') return '#4080ff';
    if (team === 'neutral') return '#c0a040';
    return '#ff2020';
  }

  function teamStrokeAlt(team) {
    if (team === 'player') return '#7fa6cf';
    if (team === 'neutral') return '#c79a2e';
    return '#c8202a';
  }

  function drawNeutralDenRaw(ctx, x, y, size = 18) {
    const pulse = 0.85 + Math.sin(Date.now() * 0.003 + x) * 0.1;
    ctx.fillStyle = `rgba(60, 44, 28, ${0.75 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, size * 0.9, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(90, 68, 40, ${0.85 * pulse})`;
    ctx.beginPath();
    ctx.arc(x - size * 0.25, y - 2, size * 0.35, 0, Math.PI * 2);
    ctx.arc(x + size * 0.2, y - 4, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 160, 80, ${0.45 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y + 5, size, size * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRock(ctx, x, y, size) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + size * 0.3, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // jagged slab
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, y + size * 0.22);
    ctx.lineTo(x - size * 0.36, y - size * 0.2);
    ctx.lineTo(x - size * 0.08, y - size * 0.4);
    ctx.lineTo(x + size * 0.26, y - size * 0.3);
    ctx.lineTo(x + size * 0.5, y + size * 0.02);
    ctx.lineTo(x + size * 0.38, y + size * 0.28);
    ctx.closePath();
    ctx.fillStyle = '#3a363c';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3, y - size * 0.14);
    ctx.lineTo(x - size * 0.06, y - size * 0.32);
    ctx.lineTo(x + size * 0.18, y - size * 0.22);
    ctx.lineTo(x - size * 0.04, y - size * 0.06);
    ctx.closePath();
    ctx.fillStyle = '#6a6470';
    ctx.fill();
  }

  function drawWallCoverArrow(ctx, x, y, facing, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    switch (facing) {
      case 'north':
        ctx.moveTo(x, y - 18);
        ctx.lineTo(x - 5, y - 11);
        ctx.lineTo(x + 5, y - 11);
        break;
      case 'south':
        ctx.moveTo(x, y + 12);
        ctx.lineTo(x - 5, y + 5);
        ctx.lineTo(x + 5, y + 5);
        break;
      case 'east':
        ctx.moveTo(x + 18, y);
        ctx.lineTo(x + 11, y - 5);
        ctx.lineTo(x + 11, y + 5);
        break;
      case 'west':
        ctx.moveTo(x - 18, y);
        ctx.lineTo(x - 11, y - 5);
        ctx.lineTo(x - 11, y + 5);
        break;
      default:
        ctx.moveTo(x, y - 18);
        ctx.lineTo(x - 5, y - 11);
        ctx.lineTo(x + 5, y - 11);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawWallSegment(ctx, x, y, facing, opts = {}) {
    const vertical = facing === 'east' || facing === 'west';
    const stone = opts.stoneFill || '#6a6a68';
    const cap = opts.capFill || '#8a8a88';
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.translate(x, y);
    if (vertical) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = stone;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-24 + i * 10, -14, 8, 22);
    }
    ctx.fillStyle = cap;
    ctx.fillRect(-26, 6, 52, 6);
    if (opts.siegeTowerId) {
      ctx.strokeStyle = '#c06030';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(-20, -18);
      ctx.lineTo(20, -18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8a5030';
      ctx.fillRect(-10, -30, 20, 12);
    }
    ctx.restore();
    drawWallCoverArrow(ctx, x, y, facing, opts.coverFill || 'rgba(200,200,180,0.5)');
    const slots = opts.wallSlots;
    if (slots?.length) {
      for (const slot of slots) {
        ctx.fillStyle = slot.unitId ? '#80a0c0' : 'rgba(200,200,220,0.25)';
        ctx.beginPath();
        ctx.arc(slot.slotX, slot.slotY, slot.unitId ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Semi-transparent wall preview while placing — shows facing, cover side, and garrison slots. */
  function drawWallPlacementGhost(ctx, x, y, facing, opts = {}) {
    const valid = opts.valid !== false;
    const radius =
      opts.radius ?? (typeof BuildDefs !== 'undefined' ? BuildDefs.wall?.radius : 20) ?? 20;
    const slots =
      typeof getWallSlotPositions === 'function'
        ? getWallSlotPositions(facing || 'north', x, y)
        : [];

    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = valid ? 'rgba(120,220,150,0.72)' : 'rgba(255,90,90,0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    drawWallSegment(ctx, x, y, facing || 'north', {
      alpha: valid ? 0.48 : 0.42,
      stoneFill: valid ? 'rgba(106,106,104,0.72)' : 'rgba(150,90,90,0.65)',
      capFill: valid ? 'rgba(138,138,136,0.78)' : 'rgba(170,110,110,0.7)',
      coverFill: valid ? 'rgba(160,240,180,0.82)' : 'rgba(255,150,150,0.75)',
      wallSlots: slots,
    });

    for (const slot of slots) {
      ctx.strokeStyle = valid ? 'rgba(180,220,255,0.65)' : 'rgba(255,180,180,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(slot.slotX, slot.slotY, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = valid ? 'rgba(210,255,220,0.95)' : 'rgba(255,200,200,0.95)';
    ctx.font = '8px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(`COVER ${(facing || 'north').toUpperCase()}`, x, y - 30);
    ctx.restore();
  }

  const PERK_MACHINE_COLORS = {
    jugger_nog: { body: '#a03030', glow: '#ff6060', label: 'JUG' },
    quick_revive: { body: '#3080a0', glow: '#60c0e8', label: 'REV' },
    speed_cola: { body: '#308040', glow: '#60e080', label: 'SPD' },
    stamin_up: { body: '#a0a030', glow: '#ffe060', label: 'STM' },
    deadshot_daiquiri: { body: '#6030a0', glow: '#a060e0', label: 'DSH' },
    elemental_pop: { body: '#8040a0', glow: '#ff80e0', label: 'POP' },
    phd_flopper: { body: '#3040a0', glow: '#6080ff', label: 'PHD' },
    melee_macchiato: { body: '#6a4030', glow: '#c08060', label: 'MAC' },
    vulture_aid: { body: '#506030', glow: '#a0c040', label: 'VUL' },
    tombstone: { body: '#484848', glow: '#909090', label: 'TMB' },
    double_tap: { body: '#a05020', glow: '#ff8040', label: '2X' },
    mule_kick: { body: '#806040', glow: '#c0a060', label: 'MUL' },
    sleight: { body: '#302040', glow: '#8060a0', label: 'SLG' },
  };

  function drawPerkMachine(ctx, b) {
    const perkId = b.perkId || (b.type?.startsWith('perk_') ? b.type.replace('perk_', '') : '');
    const pal = PERK_MACHINE_COLORS[perkId] || { body: '#504060', glow: '#a080c0', label: 'PERK' };
    const pulse = 0.65 + Math.sin(Date.now() * 0.004 + b.x) * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x - 14, b.y + 2, 28, 6);
    ctx.fillStyle = pal.body;
    ctx.fillRect(b.x - 12, b.y - 18, 24, 24);
    ctx.fillStyle = `rgba(255,255,255,${0.12 * pulse})`;
    ctx.fillRect(b.x - 10, b.y - 16, 20, 8);
    ctx.fillStyle = pal.glow;
    ctx.fillRect(b.x - 8, b.y - 4, 16, 8);
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - 12, b.y - 18, 24, 24);
    ctx.fillStyle = '#f0f0f0';
    ctx.font = '7px Cinzel';
    ctx.textAlign = 'center';
    ctx.fillText(pal.label, b.x, b.y - 6);
    ctx.fillStyle = pal.glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 22, 3 + pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBuildingRaw(ctx, b) {
    const prog = b.complete
      ? 1
      : b.waveBuildRequired
        ? (b.waveBuildProgress || 0) / b.waveBuildRequired
        : b.buildProgress / Math.max(1, b.buildTime || 1);
    const alpha = 0.4 + prog * 0.6;
    const enemyOwned = b.owner === 'enemy';
    ctx.globalAlpha = alpha;

    if (b.type === 'outpost') {
      ctx.fillStyle = '#5a5048';
      ctx.fillRect(b.x - 16, b.y - 10, 32, 20);
      ctx.fillStyle = '#7080a0';
      ctx.fillRect(b.x - 12, b.y - 22, 24, 14);
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(b.x - 4, b.y - 8, 8, 14);
      ctx.fillStyle = 'rgba(80,200,120,0.5)';
      ctx.fillRect(b.x - 8, b.y - 28, 16, 8);
      if (b.garrisonUnitId) {
        ctx.fillStyle = '#80e0a0';
        ctx.beginPath();
        ctx.arc(b.x, b.y - 24, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.type === 'wall') {
      drawWallSegment(ctx, b.x, b.y, b.facing || 'north', {
        alpha: alpha,
        wallSlots: b.wallSlots,
        siegeTowerId: b.siegeTowerId,
      });
    } else if (b.type === 'medical_tent') {
      ctx.fillStyle = '#e8e8e0';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 20);
      ctx.lineTo(b.x - 18, b.y + 4);
      ctx.lineTo(b.x + 18, b.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#a0a098';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#c04040';
      ctx.fillRect(b.x - 5, b.y - 10, 10, 3);
      ctx.fillRect(b.x - 1, b.y - 14, 3, 10);
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(b.x - 3, b.y + 2, 6, 8);
    } else if (b.type?.startsWith('academy_')) {
      const unit = b.academyUnit || b.type.replace('academy_', '');
      const hue =
        {
          footman: '#7080a0',
          archer: '#60a060',
          mage: '#8060c0',
          cavalry: '#a08050',
          knight: '#9090b0',
          sapper: '#a07040',
          healer: '#60c080',
          builder: '#c0a060',
          courier: '#e0c080',
          general: '#c0a040',
        }[unit] || '#908070';
      ctx.fillStyle = '#4a4038';
      ctx.fillRect(b.x - 20, b.y - 2, 40, 20);
      ctx.fillStyle = hue;
      ctx.fillRect(b.x - 16, b.y - 16, 32, 16);
      ctx.fillStyle = '#f0e8c0';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('ACAD', b.x, b.y - 6);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(b.x - 10, b.y - 22, 20, 6);
    } else if (b.type === 'mess_hall') {
      ctx.fillStyle = '#5a4838';
      ctx.fillRect(b.x - 18, b.y - 4, 36, 18);
      ctx.fillStyle = '#6a5848';
      ctx.fillRect(b.x - 16, b.y - 14, 32, 12);
      ctx.fillStyle = '#8a7058';
      for (let i = 0; i < 3; i++) ctx.fillRect(b.x - 12 + i * 10, b.y - 2, 8, 6);
      ctx.fillStyle = '#c0a040';
      ctx.fillRect(b.x - 8, b.y - 22, 16, 8);
    } else if (b.type === 'research_lab' || b.isResearchLab) {
      ctx.fillStyle = '#3a4a5a';
      ctx.fillRect(b.x - 16, b.y - 2, 32, 16);
      ctx.fillStyle = '#506878';
      ctx.fillRect(b.x - 14, b.y - 16, 28, 16);
      ctx.fillStyle = '#80c0e8';
      ctx.fillRect(b.x - 10, b.y - 12, 20, 10);
      ctx.fillStyle = '#a0e0ff';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 7, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c0e8ff';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('LAB', b.x, b.y + 10);
    } else if (b.type === 'castle_keep') {
      ctx.fillStyle = '#4a4048';
      ctx.fillRect(b.x - 18, b.y - 6, 36, 22);
      ctx.fillStyle = '#6a5a68';
      ctx.fillRect(b.x - 14, b.y - 22, 28, 18);
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(b.x - 5, b.y - 2, 10, 14);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 32);
      ctx.lineTo(b.x - 8, b.y - 20);
      ctx.lineTo(b.x + 8, b.y - 20);
      ctx.fill();
      ctx.fillStyle = '#c04040';
      ctx.fillRect(b.x - 10, b.y - 26, 20, 6);
      if (b.generalUnitId) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(b.slotX ?? b.x, b.slotY ?? b.y - 30, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.type === 'castle') {
      ctx.fillStyle = '#5a5a60';
      ctx.fillRect(b.x - 28, b.y - 8, 56, 28);
      ctx.fillStyle = '#7a7a82';
      for (let i = 0; i < 6; i++) ctx.fillRect(b.x - 24 + i * 9, b.y - 28, 7, 22);
      ctx.fillStyle = '#3a2818';
      ctx.fillRect(b.x - 8, b.y, 16, 18);
      ctx.fillStyle = '#c0a040';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 38);
      ctx.lineTo(b.x - 6, b.y - 28);
      ctx.lineTo(b.x + 6, b.y - 28);
      ctx.fill();
    } else if (b.isHamlet || b.type === 'enemy_hamlet') {
      const wood = enemyOwned ? '#4a3028' : '#5a4838';
      const roof = enemyOwned ? '#6a3030' : '#8a6040';
      const thatch = enemyOwned ? '#5a5040' : '#a08050';
      const tier = b.settlementTier || (b.type === 'enemy_hamlet' ? 1 : 1);
      const cols = Math.min(6, 3 + tier);
      const rows = Math.min(5, 2 + tier);
      const cellW = 18 + Math.floor(tier * 0.5);
      const cellH = 12 + Math.floor(tier * 0.4);
      const spanW = cols * (cellW + 4);
      const spanH = rows * (cellH + 2);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = b.x - spanW / 2 + col * (cellW + 4);
          const py = b.y - 6 + row * (cellH + 2);
          ctx.fillStyle = wood;
          ctx.fillRect(px, py, cellW, cellH);
          ctx.fillStyle = roof;
          ctx.fillRect(px + 2, py - 8, cellW - 4, 8);
        }
      }
      ctx.fillStyle = thatch;
      ctx.fillRect(b.x - spanW / 2 - 6, b.y - spanH / 2 - 14, spanW + 12, 10);
      const labels = {
        hamlet: 'HAMLET',
        village: 'VILLAGE',
        town: 'TOWN',
        city: 'CITY',
        metropolis: 'METRO',
      };
      const label = enemyOwned ? 'FOE' : labels[b.type] || 'SETTLE';
      ctx.fillStyle = enemyOwned ? '#c04040' : '#f0c040';
      ctx.font = tier >= 4 ? '8px Cinzel' : '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(label, b.x, b.y - spanH / 2 - 18);
      ctx.strokeStyle = enemyOwned ? 'rgba(200,60,60,0.5)' : 'rgba(240,192,64,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (b.fortressTier > 0 && !enemyOwned) {
        ctx.fillStyle = '#c0a040';
        ctx.font = '6px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText(`FORT T${b.fortressTier}`, b.x, b.y - (b.radius || 55) - 6);
      }
    } else if (b.isCrossoverBarracks) {
      const hqPal =
        {
          ultimis: '#c06030',
          primis: '#d07040',
          halo: '#408040',
          gears: '#506080',
          lotr: '#406050',
          baki: '#c04040',
          jojo: '#8040a0',
          fotns: '#4080c0',
          dragonball: '#e06040',
          imperium: '#4060a0',
          crystal: '#5080c0',
          warp: '#802040',
        }[b.crossoverFaction] || '#60a0c0';
      const r = b.radius || 48;
      ctx.fillStyle = '#2a2830';
      ctx.fillRect(b.x - r * 0.85, b.y - 6, r * 1.7, r * 0.65);
      ctx.fillStyle = hqPal;
      ctx.fillRect(b.x - r * 0.75, b.y - r * 0.55, r * 1.5, r * 0.45);
      ctx.strokeStyle = '#c0a040';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - r * 0.8, b.y - r * 0.58, r * 1.6, r * 0.72);
      ctx.fillStyle = '#f0e8c0';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('LEGION', b.x, b.y - r * 0.2);
      ctx.fillStyle = hqPal;
      ctx.font = '6px Cinzel';
      // Show the faction's in-game name, never its internal id.
      const factionLabel =
        (typeof CrossoverFactions !== 'undefined' &&
          CrossoverFactions[b.crossoverFaction]?.label) ||
        'HQ';
      ctx.fillText(factionLabel.toUpperCase(), b.x, b.y + 4);
    } else if (b.type === 'wwe_academy') {
      ctx.fillStyle = '#202028';
      ctx.fillRect(b.x - 48, b.y - 8, 96, 36);
      ctx.fillStyle = '#c04040';
      ctx.fillRect(b.x - 44, b.y - 28, 88, 22);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 46, b.y - 30, 92, 58);
      ctx.fillStyle = '#ffd700';
      ctx.font = '8px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('GC', b.x, b.y - 12);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(b.x - 30, b.y + 4, 60, 8);
    } else if (b.type === 'watchtower') {
      ctx.fillStyle = '#5a5048';
      ctx.fillRect(b.x - 8, b.y - 4, 16, 24);
      ctx.fillStyle = '#7080a0';
      ctx.fillRect(b.x - 12, b.y - 28, 24, 10);
      ctx.fillStyle = '#4a3020';
      for (let i = 0; i < 3; i++) ctx.fillRect(b.x - 10 + i * 8, b.y - 38, 4, 10);
      ctx.strokeStyle = 'rgba(100,180,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.visionRadius || 200, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (b.type === 'spike_trap') {
      ctx.fillStyle = '#3a3028';
      ctx.fillRect(b.x - 14, b.y - 4, 28, 8);
      ctx.fillStyle = '#808090';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(b.x - 10 + i * 5, b.y - 4);
        ctx.lineTo(b.x - 8 + i * 5, b.y - 14);
        ctx.lineTo(b.x - 6 + i * 5, b.y - 4);
        ctx.fill();
      }
    } else if (b.type === 'quarry' || b.type === 'enemy_quarry') {
      ctx.fillStyle = enemyOwned ? '#4a4a48' : '#6a6a68';
      ctx.fillRect(b.x - 18, b.y - 6, 36, 20);
      ctx.fillStyle = enemyOwned ? '#6a6a68' : '#8a8a88';
      for (let i = 0; i < 4; i++) ctx.fillRect(b.x - 14 + i * 9, b.y - 14, 7, 10);
      ctx.fillStyle = enemyOwned ? '#e06060' : '#c0a060';
      ctx.font = '6px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(enemyOwned ? 'FOE TP' : 'TP+', b.x, b.y - 2);
    } else if (b.type === 'trade_outpost' || b.type === 'enemy_trade_outpost') {
      ctx.fillStyle = enemyOwned ? '#4a3830' : '#5a4838';
      ctx.fillRect(b.x - 16, b.y - 2, 32, 16);
      ctx.fillStyle = enemyOwned ? '#8a4040' : '#c0a060';
      ctx.fillRect(b.x - 12, b.y - 14, 24, 12);
      ctx.fillStyle = enemyOwned ? '#e06060' : '#ffd700';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(enemyOwned ? 'FOE TRADE' : 'TRADE', b.x, b.y - 6);
    } else if (b.type === 'fortress_upgrade') {
      ctx.fillStyle = '#6a5a48';
      ctx.fillRect(b.x - 12, b.y - 8, 24, 16);
      ctx.fillStyle = '#c0a040';
      ctx.font = '6px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('FORT', b.x, b.y);
    } else if (b.isPerkMachine || b.type?.startsWith('perk_')) {
      drawPerkMachine(ctx, b);
    } else if (b.type === 'enemy_shadow_academy') {
      ctx.fillStyle = '#2a2038';
      ctx.fillRect(b.x - 32, b.y - 4, 64, 30);
      ctx.fillStyle = '#6040a0';
      ctx.fillRect(b.x - 28, b.y - 24, 56, 22);
      ctx.strokeStyle = '#9070d0';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 30, b.y - 26, 60, 50);
      ctx.fillStyle = '#c0a0f0';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('SHADOW', b.x, b.y - 10);
      ctx.fillStyle = '#7040b0';
      ctx.beginPath();
      ctx.arc(b.x, b.y + 8, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.type === 'enemy_war_academy') {
      ctx.fillStyle = '#3a2828';
      ctx.fillRect(b.x - 36, b.y - 4, 72, 32);
      ctx.fillStyle = '#8a4040';
      ctx.fillRect(b.x - 32, b.y - 26, 64, 24);
      ctx.strokeStyle = '#e05050';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 34, b.y - 28, 68, 54);
      ctx.fillStyle = '#ffd040';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('WAR', b.x, b.y - 10);
      ctx.fillStyle = '#c04040';
      for (let i = 0; i < 3; i++) ctx.fillRect(b.x - 20 + i * 14, b.y + 4, 8, 14);
    } else if (b.type === 'merchant_guild' || b.type === 'enemy_merchant_guild') {
      const stone = enemyOwned ? '#4a4048' : '#6a5a50';
      const trim = enemyOwned ? '#8a4040' : '#c0a060';
      ctx.fillStyle = stone;
      ctx.fillRect(b.x - 38, b.y - 4, 76, 28);
      ctx.fillStyle = trim;
      ctx.fillRect(b.x - 34, b.y - 22, 68, 20);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = enemyOwned ? '#3a2828' : '#4a3828';
        ctx.fillRect(b.x - 28 + i * 22, b.y + 2, 14, 18);
      }
      ctx.fillStyle = enemyOwned ? '#e06060' : '#ffd700';
      ctx.font = '7px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('GUILD', b.x, b.y - 10);
      if (!enemyOwned) {
        ctx.strokeStyle = 'rgba(200,180,80,0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, (b.hamletAuraRadius || 130) * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (!b.complete) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = enemyOwned ? '#ff6060' : '#f0c040';
      const barW = b.isHamlet || b.isMerchantGuild ? 72 : 36;
      ctx.fillRect(b.x - barW / 2, b.y + (b.radius || 18) * 0.55, barW * prog, 3);
      if (b.waveBuildRequired) {
        ctx.fillStyle = '#e8d5b0';
        ctx.font = '6px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText(
          `WAVE ${b.waveBuildProgress || 0}/${b.waveBuildRequired}`,
          b.x,
          b.y + (b.radius || 18) * 0.55 + 12
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDestructibleRaw(ctx, d) {
    const alpha = d.revealed || d.hp < d.maxHp ? 1 : 0.85;
    ctx.globalAlpha = alpha;
    if (d.type === 'supply_crate') {
      ctx.fillStyle = '#6a5030';
      ctx.fillRect(d.x - 12, d.y - 8, 24, 16);
      ctx.fillStyle = '#8a7040';
      ctx.fillRect(d.x - 10, d.y - 10, 20, 4);
      ctx.fillStyle = '#ffd700';
      ctx.font = '6px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('TP', d.x, d.y + 2);
    } else if (d.type === 'oil_barrel') {
      ctx.fillStyle = '#4a3020';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 10, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c04020';
      ctx.fillRect(d.x - 8, d.y - 14, 16, 4);
      ctx.fillStyle = '#ff6020';
      ctx.font = '6px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('!', d.x, d.y + 3);
    }
    if (d.hp < d.maxHp) {
      ctx.fillStyle = '#f0c040';
      ctx.fillRect(d.x - 10, d.y + 10, 20 * (d.hp / d.maxHp), 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawBarricadeRaw(ctx, x, y) {
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(x - 18, y - 6, 36, 12);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(x - 16 + i * 8, y - 14, 4, 16);
    }
  }

  function drawHazardRaw(ctx, h) {
    const pulse = 0.55 + Math.sin(Date.now() * 0.004 + h.x) * 0.15;
    const drawAs = h.drawType || h.type;
    if (drawAs === 'plague' || h.type === 'goblin_plague' || h.type === 'swamp') {
      ctx.fillStyle = `rgba(48, 110, 52, ${0.24 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(90, 180, 70, ${0.4 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (Date.now() * 0.002 + i * 1.4) % (Math.PI * 2);
        ctx.fillStyle = `rgba(120, 220, 80, ${0.2 * pulse})`;
        ctx.beginPath();
        ctx.arc(
          h.x + Math.cos(a) * h.radius * 0.45,
          h.y + Math.sin(a) * h.radius * 0.3,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    } else if (drawAs === 'fire' || h.type === 'orc_fire_pit' || h.type === 'fire') {
      ctx.fillStyle = `rgba(200, 60, 20, ${0.22 * pulse})`;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 120, 40, ${0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 180, 60, ${0.35 * pulse})`;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (drawAs === 'void' || h.type === 'void_corruption') {
      const rot = Date.now() * 0.0015;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(rot);
      ctx.fillStyle = `rgba(72, 28, 120, ${0.28 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, h.radius, h.radius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(160, 80, 255, ${0.42 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(200, 120, 255, ${0.22 * pulse})`;
      for (let i = 0; i < 3; i++) {
        const r = h.radius * (0.35 + i * 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (drawAs === 'miasma' || h.type === 'undead_miasma') {
      ctx.fillStyle = `rgba(40, 70, 90, ${0.26 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(100, 140, 160, ${0.45 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = `rgba(180, 200, 220, ${0.18 * pulse})`;
      for (let i = 0; i < 5; i++) {
        const a = (Date.now() * 0.0018 + i * 1.1) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(
          h.x + Math.cos(a) * h.radius * 0.4,
          h.y + Math.sin(a) * h.radius * 0.28,
          2.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    } else if (drawAs === 'rift' || h.type === 'mirror_rift_zone') {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(Date.now() * 0.002);
      ctx.strokeStyle = `rgba(120, 170, 210, ${0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, h.radius, h.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(80, 120, 180, ${0.2 * pulse})`;
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMoveMarker(ctx, x, y) {
    ctx.strokeStyle = 'rgba(240,220,80,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
  }

  function drawSelectionRing(ctx, x, y, r) {
    ctx.strokeStyle = '#f0e040';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHealthBar(ctx, x, y, w, ratio, isEnemy) {
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(x - w / 2, y, w, 4);
    ctx.fillStyle = isEnemy ? '#c04040' : '#40c040';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 4);
  }

  function drawMoraleBar(ctx, x, y, w, ratio) {
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(x - w / 2, y, w, 3);
    ctx.fillStyle = ratio > 0.5 ? '#c0a040' : '#c06020';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 3);
  }

  function drawVetStars(ctx, x, y, unit) {
    const bronze = unit.vetBronze || 0;
    const silver = unit.vetSilver || 0;
    const gold = unit.vetGold || 0;
    const total = bronze + silver + gold;
    if (total <= 0 && !unit.vetTier) return;

    const colors =
      typeof VET_STAR_COLORS !== 'undefined'
        ? VET_STAR_COLORS
        : {
            bronze: '#b87333',
            silver: '#c8c8d8',
            gold: '#ffd700',
          };

    if (unit.isGeneral && (unit.generalStars || 0) > 0) {
      ctx.fillStyle = colors.gold;
      ctx.font = 'bold 6px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(`CMD★${unit.generalStars}`, x, y - 36);
    } else if (unit.vetTier > 0) {
      ctx.fillStyle = colors.gold;
      ctx.font = 'bold 6px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(`V${unit.vetTier}`, x, y - 36);
    }

    const isSpec = typeof isSpecialistUnit === 'function' && isSpecialistUnit(unit);
    const starChar = isSpec ? '◆' : '★';

    const glyphs = [];
    for (let i = 0; i < bronze; i++) glyphs.push({ ch: starChar, color: colors.bronze });
    for (let i = 0; i < silver; i++) glyphs.push({ ch: starChar, color: colors.silver });
    for (let i = 0; i < gold; i++) glyphs.push({ ch: starChar, color: colors.gold });
    if (gold >= 3 && !unit.isGeneral) {
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.35 + Math.sin(Date.now() * 0.006) * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y - 22, 10 + gold, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!glyphs.length) return;

    ctx.font = '8px Cinzel';
    ctx.textAlign = 'center';
    const startX = x - ((glyphs.length - 1) * 7) / 2;
    glyphs.forEach((g, i) => {
      ctx.fillStyle = '#1a1010';
      ctx.fillText(g.ch, startX + i * 7 + 0.5, y - 27.5);
      ctx.fillStyle = g.color;
      ctx.fillText(g.ch, startX + i * 7, y - 28);
    });
  }

  function drawProjectile(ctx, p) {
    const { type, x, y, angle } = p;
    ctx.save();
    ctx.translate(x, y);
    if (angle != null) ctx.rotate(angle);

    if (type === 'arrow') {
      ctx.fillStyle = '#8a6030';
      ctx.fillRect(-8, -1, 14, 2);
      ctx.fillStyle = '#c0a060';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a08050';
      ctx.fillRect(-8, -2, 3, 4);
    } else if (type === 'fireball') {
      ctx.fillStyle = 'rgba(255,80,20,0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6020';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe080';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'bolt') {
      ctx.fillStyle = 'rgba(128,64,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a060ff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTitleArt(ctx, w, h) {
    if (typeof VisualPolish !== 'undefined') {
      VisualPolish.drawTitleArt(ctx, w, h);
      return;
    }
    drawBattlefield(ctx, w, h);
    drawTree(ctx, 80, 60, 30);
    drawTree(ctx, 350, 80, 25);
    drawRock(ctx, 200, 100, 20);
    const types = ['footman', 'archer', 'mage', 'cavalry'];
    types.forEach((t, i) => {
      const img = getUnitCanvas(t, -90, 'player', 0, 1);
      ctx.drawImage(img, 60 + i * 40, h - 70, 32, 32);
    });
    ['orc', 'goblin', 'dark_knight'].forEach((t, i) => {
      const img = getUnitCanvas(t, 90, 'enemy', 0, 1);
      ctx.drawImage(img, 280 + i * 40, 40, 32, 32);
    });
  }

  return {
    getUnitCanvas,
    UNIT_DRAW_SIZE,
    getBattlefieldCanvas,
    invalidateBattlefieldCache,
    prewarmCache,
    drawIcon,
    drawAbilityIcon,
    drawBattlefield,
    drawAttackSideMarkers,
    drawTree,
    drawNeutralDen: (ctx, ...rest) => drawNeutralDenRaw(inkCtx(ctx), ...rest),
    drawRock,
    drawBarricade: (ctx, ...rest) => drawBarricadeRaw(inkCtx(ctx), ...rest),
    drawDestructible: (ctx, ...rest) => drawDestructibleRaw(inkCtx(ctx), ...rest),
    drawHazard: (ctx, ...rest) => drawHazardRaw(inkCtx(ctx), ...rest),
    drawBuilding: (ctx, ...rest) => drawBuildingRaw(inkCtx(ctx), ...rest),
    drawWallPlacementGhost,
    drawMoveMarker,
    drawSelectionRing,
    drawHealthBar,
    drawMoraleBar,
    drawVetStars,
    drawProjectile,
    drawTitleArt,
    UNIT_STYLE,
    registerUnitStyle(type, style) {
      if (!type || !style) return;
      UNIT_STYLE[type] = style;
      // An explicit registration (a mod) is a deliberate look: it wins over the ink palette.
      INK_PALETTE[type] = { ...style };
    },
    animFor,
    celebrate,
    gaitOf,
    DEATH_CAUSES,
    DEATH_FRAMES,
    UNIT_CANVAS_UNITS,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SpriteGen = SpriteGen;
