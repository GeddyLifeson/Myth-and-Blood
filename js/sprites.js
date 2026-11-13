/**
 * Procedural top-down sprites for Myth and Blood.
 * MnB2-style: rotatable unit markers on a flat battlefield.
 */
const SpriteGen = (() => {
  const CACHE_MAX = 768;
  /** Logical size of a cached unit sprite; the game draws it at UNIT_DRAW_SIZE world units. */
  const UNIT_CANVAS_UNITS = 72;
  const UNIT_DRAW_SIZE = 62;
  const cache = new Map();
  let battlefieldCache = null;
  let battlefieldCacheKey = '';

  const UNIT_STYLE = {
    footman: { body: '#5070a8', accent: '#c0c8e0', mark: '#8090c0', size: 9 },
    archer: { body: '#408050', accent: '#80c080', mark: '#8a6030', size: 8 },
    mage: { body: '#5030a0', accent: '#a080ff', mark: '#ffe040', size: 8 },
    cavalry: { body: '#a08040', accent: '#e0c060', mark: '#6a4020', size: 11 },
    healer: { body: '#3d8a62', accent: '#d8f8e8', mark: '#40c080', size: 8 },
    orc: { body: '#3a6830', accent: '#5a9850', mark: '#c04040', size: 10 },
    goblin: { body: '#506830', accent: '#709040', mark: '#802020', size: 7 },
    dark_knight: { body: '#2a1838', accent: '#6040a0', mark: '#c080ff', size: 11 },
    orc_archer: { body: '#3a5830', accent: '#5a8040', mark: '#8a5020', size: 8 },
    builder: { body: '#8a6030', accent: '#c0a060', mark: '#604020', size: 9 },
    courier: { body: '#a07040', accent: '#e0c080', mark: '#f0e040', size: 8 },
    sapper: { body: '#506070', accent: '#8090a0', mark: '#ff6020', size: 8 },
    knight: { body: '#7080a8', accent: '#c0d0e8', mark: '#e0c040', size: 10 },
    general: { body: '#4a3050', accent: '#c0a040', mark: '#ffd700', size: 11 },
    scout: { body: '#607848', accent: '#a0c080', mark: '#405830', size: 8 },
    bard: { body: '#704878', accent: '#c090d0', mark: '#ffd700', size: 8 },
    ballista: { body: '#585858', accent: '#909090', mark: '#c06030', size: 10 },
    pikeman: { body: '#486878', accent: '#80a0b0', mark: '#c0c0c0', size: 9 },
    troll: { body: '#4a5838', accent: '#6a7850', mark: '#3a2818', size: 12 },
    berserker: { body: '#6a3030', accent: '#a05050', mark: '#802020', size: 11 },
    assassin: { body: '#383848', accent: '#606078', mark: '#c04060', size: 8 },
    necromancer: { body: '#302848', accent: '#6040a0', mark: '#80ff80', size: 9 },
    shaman: { body: '#485838', accent: '#70a060', mark: '#e0c040', size: 8 },
    warg_rider: { body: '#5a4830', accent: '#8a6840', mark: '#4a3020', size: 10 },
    harpy: { body: '#506070', accent: '#90b0c0', mark: '#c0a040', size: 8 },
    sky_drake: { body: '#405878', accent: '#70a0d0', mark: '#e0e0ff', size: 11 },
    abomination: { body: '#5a2848', accent: '#904070', mark: '#ff4060', size: 16 },
    behemoth: { body: '#3a4828', accent: '#5a6838', mark: '#ff6020', size: 18 },
    iron_colossus: { body: '#484858', accent: '#787890', mark: '#ff8040', size: 19 },
    void_stalker: { body: '#181828', accent: '#303048', mark: '#ff2040', size: 14 },
    elder_wyrm: { body: '#283850', accent: '#5080b0', mark: '#ff6040', size: 17 },
    boss_gorath: { body: '#4a3020', accent: '#8a5030', mark: '#ff4020', size: 19 },
    boss_morwen: { body: '#383050', accent: '#7060a0', mark: '#c0f0ff', size: 17 },
    boss_thokk: { body: '#354028', accent: '#5a6840', mark: '#c06020', size: 20 },
    boss_grimm: { body: '#302028', accent: '#604040', mark: '#ff6020', size: 18 },
    boss_vexis: { body: '#101020', accent: '#282840', mark: '#ff1030', size: 16 },
    boss_karg: { body: '#404050', accent: '#707888', mark: '#ffa040', size: 21 },
    boss_sylvara: { body: '#203040', accent: '#4080a8', mark: '#ff8040', size: 19 },
    boss_rotfather: { body: '#4a2038', accent: '#803060', mark: '#ff3060', size: 18 },
    boss_volk: { body: '#382828', accent: '#684040', mark: '#ffd040', size: 20 },
    boss_malachar: { body: '#281830', accent: '#503070', mark: '#ff2080', size: 22 },
    doomslayer_hero: { body: '#3a2818', accent: '#6080a0', mark: '#40c0ff', size: 11 },
    dark_mage: { body: '#281838', accent: '#6040a0', mark: '#ff4080', size: 8 },
    goblin_sapper: { body: '#506830', accent: '#ff6020', mark: '#802020', size: 7 },
    goblin_engineer: { body: '#4a6030', accent: '#90b040', mark: '#c0a040', size: 7 },
    goblin_burrower: { body: '#485828', accent: '#708838', mark: '#604020', size: 7 },
    bone_summoner: { body: '#383028', accent: '#a0a090', mark: '#80ff80', size: 9 },
    plague_rat: { body: '#4a4838', accent: '#706858', mark: '#80c040', size: 6 },
    orc_shieldbearer: { body: '#3a4a2a', accent: '#8a8478', mark: '#c8202a', size: 11 },
    goblin_firebrand: { body: '#586a2c', accent: '#ff7a20', mark: '#ffd040', size: 7 },
    wailing_wraith: { body: '#2a2a3a', accent: '#b8c0d8', mark: '#80e0ff', size: 9 },
    hellbound_legionnaire: { body: '#3a2838', accent: '#7040a0', mark: '#ff4060', size: 9 },
    nightmare_strider: { body: '#302838', accent: '#604878', mark: '#c080ff', size: 10 },
    dreadborn_champion: { body: '#281828', accent: '#503050', mark: '#ff2040', size: 12 },
    warp_prophet: { body: '#203048', accent: '#4080c0', mark: '#80e0ff', size: 9 },
    grim_revenant: { body: '#283030', accent: '#507878', mark: '#a0ffff', size: 9 },
    umbral_stalker: { body: '#181820', accent: '#303040', mark: '#8040c0', size: 8 },
    hellmortar_pack: { body: '#403028', accent: '#806040', mark: '#ff6020', size: 10 },
    siege_tower: { body: '#483828', accent: '#806040', mark: '#c06030', size: 14 },
    war_chief: { body: '#2a1838', accent: '#c0a040', mark: '#ff4020', size: 12 },
    cinderbound_juggernaut: { body: '#4a3020', accent: '#ff8040', mark: '#ff4020', size: 17 },
    roster_ultimis: { body: '#704028', accent: '#c06030', mark: '#e0c040', size: 10 },
    roster_primis: { body: '#805030', accent: '#d07040', mark: '#ffd700', size: 10 },
    roster_halo: { body: '#406848', accent: '#60a060', mark: '#4080ff', size: 10 },
    roster_gears: { body: '#506080', accent: '#8098b8', mark: '#c0a040', size: 10 },
    roster_lotr: { body: '#405848', accent: '#70a080', mark: '#c0a040', size: 10 },
    roster_baki: { body: '#603030', accent: '#a05050', mark: '#e0c0a0', size: 10 },
    roster_jojo: { body: '#503070', accent: '#9060b0', mark: '#ffd700', size: 10 },
    roster_fotns: { body: '#384868', accent: '#6090c0', mark: '#e0e0ff', size: 10 },
    roster_dragonball: { body: '#e06040', accent: '#ffd080', mark: '#4080ff', size: 10 },
    roster_imperium: { body: '#384858', accent: '#6080b0', mark: '#c04040', size: 10 },
    roster_crystal: { body: '#5080c0', accent: '#a0d0f0', mark: '#c04060', size: 10 },
    roster_warp: { body: '#402030', accent: '#8040a0', mark: '#ff4020', size: 10 },
    roster_tes: { body: '#304860', accent: '#6080b0', mark: '#a06040', size: 10 },
    roster_wwe: { body: '#302030', accent: '#c04040', mark: '#ffd700', size: 10 },
  };

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
    const base = UNIT_STYLE[type] || UNIT_STYLE[fallback];
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

  /**
   * Per-type weapon/prop silhouette (bow, spear, staff, lute, mount tack, ...).
   * Caller must already be translated to the unit's local origin and rotated to
   * face `rotation` — this only draws in that local, unrotated space. Originally
   * only the full-LOD (LOD 0) humanoid path had per-type shapes; the far more
   * commonly seen medium tier (LOD 1) drew one generic rectangle for every class,
   * which is why "archer" and "footman" were hard to tell apart at a glance.
   */
  function drawWeaponSilhouette(ctx, type, style, r, animState, pulse) {
    ctx.fillStyle = style.mark;
    if (type === 'doomslayer_hero') {
      ctx.fillStyle = '#6080a0';
      ctx.fillRect(-5, -r - 10, 4, 12);
      ctx.fillRect(1, -r - 10, 4, 12);
      ctx.fillStyle = '#40c0ff';
      ctx.fillRect(-4, -r - 12, 2, 4);
      ctx.fillRect(2, -r - 12, 2, 4);
    } else if (
      type === 'archer' ||
      type === 'orc_archer' ||
      type === 'hellbound_legionnaire' ||
      type === 'grim_revenant'
    ) {
      ctx.fillRect(-1, -r - 14, 2, 14);
      ctx.fillStyle = '#c0a060';
      ctx.beginPath();
      ctx.moveTo(0, -r - 16);
      ctx.lineTo(-3, -r - 10);
      ctx.lineTo(3, -r - 10);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'scout') {
      ctx.fillStyle = '#405830';
      ctx.fillRect(-1, -r - 12, 2, 12);
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.moveTo(0, -r - 14);
      ctx.lineTo(-3, -r - 8);
      ctx.lineTo(3, -r - 8);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'bard') {
      ctx.fillStyle = '#c090d0';
      ctx.beginPath();
      ctx.arc(0, -r - 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.mark;
      ctx.fillRect(-1, -r - 14, 2, 6);
    } else if (type === 'ballista' || type === 'hellmortar_pack') {
      ctx.fillStyle = '#505050';
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = style.mark;
      ctx.fillRect(-2, -r - 8, 4, 8);
    } else if (type === 'pikeman') {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(-1, -r - 16, 2, 18);
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.moveTo(0, -r - 18);
      ctx.lineTo(-2, -r - 12);
      ctx.lineTo(2, -r - 12);
      ctx.closePath();
      ctx.fill();
    } else if (type.startsWith('roster_')) {
      ctx.fillStyle = style.mark;
      ctx.fillRect(-2, -r - (animState === 'attack' ? 11 : 9), 4, animState === 'attack' ? 11 : 9);
      ctx.fillStyle = style.accent;
      ctx.fillRect(-5, -r - 4, 10, 3);
    } else if (
      type === 'mage' ||
      type === 'dark_mage' ||
      type === 'bone_summoner' ||
      type === 'warp_prophet' ||
      type === 'necromancer'
    ) {
      ctx.fillStyle = pulse ? '#ffe080' : '#e0c040';
      ctx.fillRect(-1, -r - 12, 2, 12);
      ctx.beginPath();
      ctx.arc(0, -r - 14, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'cavalry' || type === 'warg_rider' || type === 'nightmare_strider') {
      ctx.fillStyle = '#6a4020';
      ctx.fillRect(-7, -2, 14, 5);
      ctx.fillStyle = style.mark;
      ctx.fillRect(-2, -r - 10, 4, 10);
    } else if (type === 'healer' || type === 'shaman') {
      ctx.fillStyle = '#c8a060';
      ctx.fillRect(-1, -r - 18, 2, 20);
      ctx.fillStyle = '#80e8c0';
      ctx.beginPath();
      ctx.arc(0, -r - 18, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-2, -r - (animState === 'attack' ? 12 : 8), 4, animState === 'attack' ? 12 : 8);
      if (animState === 'attack') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, -r - 14, 2, 4);
      }
    }
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

  const RANGED_TYPES = new Set([
    'archer',
    'orc_archer',
    'hellbound_legionnaire',
    'grim_revenant',
    'ballista',
    'hellmortar_pack',
  ]);
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

  function drawLowMarker(ctx, style, team, rotation, r, animState = 'idle', type = '') {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 0.9, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bodyGradient(ctx, 0, 0, r, style.body);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = teamStrokeAlt(team);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.rotate(((rotation + 90) * Math.PI) / 180);
    ctx.fillStyle = style.mark;
    // Too small at this LOD for full weapon art, but a distinct marker shape per
    // broad role (ranged/caster/mounted vs. default melee) still reads at a glance —
    // the same idea minimap icons in RTS games use.
    if (CASTER_TYPES.has(type)) {
      ctx.beginPath();
      ctx.arc(0, -r - 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (RANGED_TYPES.has(type)) {
      ctx.beginPath();
      ctx.moveTo(0, -r - 3);
      ctx.lineTo(-2.5, -r);
      ctx.lineTo(0, -r + 3);
      ctx.lineTo(2.5, -r);
      ctx.closePath();
      ctx.fill();
    } else if (MOUNTED_TYPES.has(type)) {
      ctx.beginPath();
      ctx.moveTo(0, -r - 2);
      ctx.lineTo(-4, -r + 4);
      ctx.lineTo(4, -r + 4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -r - 2);
      ctx.lineTo(-3, -r + 4);
      ctx.lineTo(3, -r + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (animState === 'death') ctx.globalAlpha = 0.55;
  }

  function drawMediumUnit(ctx, type, rotation, team, frame, animState) {
    if (MONSTER_SPRITES.includes(type) || type.startsWith('boss_')) {
      const style = resolveUnitStyle(type, team, 'behemoth');
      const r = style.size * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 1.08, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 3, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bodyGradient(ctx, 0, 0, r, style.body);
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = teamStrokeAlt(team);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.arc(-3, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, -2, 2, 0, Math.PI * 2);
      ctx.fill();
      if (animState === 'death') ctx.globalAlpha = 0.55;
      return;
    }
    const style = resolveUnitStyle(type, team, 'footman');
    const r = style.size;
    const walkBob = animState === 'walk' ? Math.sin(frame * 1.5) * 1.2 : 0;
    const pulse = frame % 2 === 0 ? 0 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 3, r * 1.1, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bodyGradient(ctx, 0, walkBob * 0.4, r, style.body);
    ctx.beginPath();
    ctx.arc(0, walkBob * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = teamStrokeAlt(team);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, walkBob * 0.4, r + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.rotate(((rotation + 90) * Math.PI) / 180);
    // Same per-class silhouette as the full-detail tier (bow, spear, staff, ...) —
    // this is the tier actually on screen whenever the field is busy, so this is
    // where class readability matters most.
    drawWeaponSilhouette(ctx, type, style, r, animState, pulse);
    ctx.restore();
    ctx.fillStyle = team === 'player' ? '#d4a878' : '#8060a0';
    ctx.beginPath();
    ctx.arc(0, walkBob * 0.4 - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (animState === 'death') ctx.globalAlpha = 0.55;
  }

  function drawMonsterUnit(ctx, type, team, frame, animState, lod = 0) {
    if (lod >= 3) {
      const style = resolveUnitStyle(type, team, 'behemoth');
      drawMinimalMarker(ctx, style, team, style.size * 0.82);
      return;
    }
    if (lod >= 2) {
      const style = resolveUnitStyle(type, team, 'behemoth');
      drawLowMarker(ctx, style, team, 90, style.size * 0.88, animState, type);
      return;
    }
    drawInkMonster(ctx, type, team, frame, animState);
  }

  function drawSiegeTowerUnit(ctx, style, team, frame, animState, lod = 0) {
    if (lod >= 3) {
      drawMinimalMarker(ctx, style, team, style.size * 0.75);
      return;
    }
    if (lod >= 2) {
      drawLowMarker(ctx, style, team, 90, style.size * 0.85, animState, 'siege_tower');
      return;
    }
    if (lod >= 1) {
      const r = style.size;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 4, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.body;
      ctx.fillRect(-r * 0.7, -r * 0.5, r * 1.4, r * 1.05);
      ctx.strokeStyle = teamStrokeAlt(team);
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.7, -r * 0.5, r * 1.4, r * 1.05);
      return;
    }
    const r = style.size;
    const walkBob = animState === 'walk' ? Math.sin(frame * 0.8) * 1.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 4, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.strokeStyle = teamStrokeAlt(team);
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
  const HOODED_TYPES = new Set(['archer', 'orc_archer', 'scout', 'assassin', 'umbral_stalker']);
  const HELM_TYPES = new Set(['footman', 'pikeman', 'sapper', 'ballista', 'cavalry']);
  const SHIELD_TYPES = new Set([
    'footman',
    'knight',
    'pikeman',
    'dark_knight',
    'general',
    'orc_shieldbearer',
  ]);
  const HORNED_TYPES = new Set(['dark_knight', 'war_chief', 'berserker', 'shaman', 'warg_rider']);
  const CLOAK_TYPES = new Set(['general', 'knight', 'dark_knight', 'scout', 'assassin', 'bard']);

  function inkFill(ctx, fill, lw = 1.3) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  function drawInkFigure(ctx, type, rotation, team, frame, animState) {
    const style = resolveUnitStyle(type, team, 'footman');
    const r = style.size * 1.3;
    const enemy = team === 'enemy';
    const walk = animState === 'walk';
    const bob = walk ? Math.sin(frame * 1.5) * 1.2 : 0;
    const lunge = animState === 'attack' ? 4 : 0;
    const undead = enemy && UNDEAD_RE.test(type);
    const caster = CASTER_TYPES.has(type) || type === 'healer' || type === 'shaman';
    const mounted = MOUNTED_TYPES.has(type);
    const greenskin =
      type === 'orc' ||
      type === 'goblin' ||
      type === 'orc_archer' ||
      type === 'orc_shieldbearer' ||
      type === 'troll' ||
      type === 'war_chief' ||
      type.startsWith('goblin_');
    const brute =
      type === 'orc' ||
      type === 'orc_shieldbearer' ||
      type === 'troll' ||
      type === 'war_chief' ||
      type === 'berserker';

    // Ground shadow and team ring stay unrotated so facing never hides them.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(1.5, 3, r * 1.2, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    if (animState === 'death') {
      ctx.fillStyle = 'rgba(140,10,16,0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 3, r * 1.5, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
    }
    ctx.strokeStyle = teamStrokeAlt(team);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 1.5, r * 1.22, r * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (animState === 'attack') {
      ctx.fillStyle = enemy ? 'rgba(255,60,40,0.28)' : 'rgba(255,220,120,0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.rotate(((rotation + 90) * Math.PI) / 180);
    ctx.translate(0, bob - lunge * 0.5);
    ctx.lineJoin = 'round';

    // Mount under the rider
    if (mounted) {
      const hide = type === 'cavalry' ? '#4a2c18' : type === 'warg_rider' ? '#34343c' : '#1c0c12';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, r * 0.62, r * 1.4, 0, 0, Math.PI * 2);
      inkFill(ctx, hide);
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.25, r * 0.32, r * 0.5, 0, 0, Math.PI * 2);
      inkFill(ctx, shadeHex(hide, 0.12));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, r * 1.6);
      ctx.quadraticCurveTo(r * 0.5, r * 2, r * 0.2, r * 2.2);
      ctx.stroke();
    }

    // Cloak or robe trailing behind, with a ragged hem
    if (caster || CLOAK_TYPES.has(type) || undead) {
      const cloth =
        type === 'general' || type === 'dark_knight'
          ? BLOOD
          : undead
            ? '#2a2630'
            : shadeHex(style.body, -0.3);
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.1);
      ctx.lineTo(r * 0.9, -r * 0.1);
      ctx.lineTo(r * 0.75, r * 1.1);
      ctx.lineTo(r * 0.4, r * 0.85);
      ctx.lineTo(r * 0.1, r * 1.3);
      ctx.lineTo(-r * 0.25, r * 0.9);
      ctx.lineTo(-r * 0.6, r * 1.2);
      ctx.closePath();
      inkFill(ctx, cloth);
    }

    // Legs
    if (walk && !mounted) {
      const step = Math.sin(frame * 1.5) * r * 0.35;
      ctx.fillStyle = INK;
      ctx.fillRect(-r * 0.5, r * 0.3 + step, r * 0.34, r * 0.6);
      ctx.fillRect(r * 0.16, r * 0.3 - step, r * 0.34, r * 0.6);
    }

    // Weapon, drawn with a hard ink shadow so it reads against any ground
    ctx.save();
    ctx.shadowColor = INK;
    ctx.shadowOffsetX = 1.2;
    ctx.shadowOffsetY = 1.2;
    ctx.shadowBlur = 0;
    ctx.translate(mounted ? 0 : r * 0.55, 0);
    ctx.scale(1.25, 1.25);
    drawWeaponSilhouette(ctx, type, style, r * 0.42, animState, frame % 2);
    ctx.restore();

    // Shoulders
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (brute ? 1.22 : 1.05), r * (brute ? 0.78 : 0.66), 0, 0, Math.PI * 2);
    inkFill(ctx, bodyGradient(ctx, 0, 0, r, undead ? '#3a3640' : style.body), 1.5);

    // Pauldrons; enemies get bone spikes
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.9, -r * 0.02, r * 0.36, 0, Math.PI * 2);
      inkFill(ctx, enemy ? shadeHex(style.accent, -0.25) : style.accent);
      if (enemy && !greenskin) {
        ctx.beginPath();
        ctx.moveTo(side * r * 1.1, -r * 0.25);
        ctx.lineTo(side * r * 1.75, -r * 0.1);
        ctx.lineTo(side * r * 1.1, r * 0.2);
        ctx.closePath();
        inkFill(ctx, BONE, 1);
      }
    }

    // Shield on the off hand
    if (SHIELD_TYPES.has(type)) {
      const sx = -r * 0.95;
      const sy = -r * 0.6;
      ctx.beginPath();
      if (type === 'footman' || type === 'pikeman') {
        ctx.arc(sx, sy, r * 0.55, 0, Math.PI * 2);
      } else {
        ctx.moveTo(sx - r * 0.45, sy - r * 0.5);
        ctx.lineTo(sx + r * 0.45, sy - r * 0.5);
        ctx.lineTo(sx + r * 0.4, sy + r * 0.2);
        ctx.lineTo(sx, sy + r * 0.75);
        ctx.lineTo(sx - r * 0.4, sy + r * 0.2);
        ctx.closePath();
      }
      inkFill(ctx, type === 'dark_knight' ? '#16101c' : shadeHex(style.body, 0.15));
      ctx.fillStyle = type === 'dark_knight' || type === 'general' ? BLOOD : style.mark;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head
    const hy = -r * 0.12;
    const hr = r * (brute ? 0.56 : 0.5);
    const skin = undead ? BONE : enemy ? (greenskin ? '#6f9a3c' : '#8a3a4c') : '#d9b08c';
    if (greenskin) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * hr * 0.7, hy - hr * 0.2);
        ctx.lineTo(side * hr * 1.9, hy - hr * 0.1);
        ctx.lineTo(side * hr * 0.7, hy + hr * 0.5);
        ctx.closePath();
        inkFill(ctx, skin, 1);
      }
    }
    if (HORNED_TYPES.has(type) || (enemy && type.includes('demon'))) {
      ctx.strokeStyle = INK;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * hr * 0.6, hy);
        ctx.quadraticCurveTo(side * hr * 2.1, hy - hr * 0.2, side * hr * 1.5, hy - hr * 2);
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = BONE;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(0, hy, hr, 0, Math.PI * 2);
    inkFill(ctx, skin, 1.4);

    // Headgear by class
    if (caster) {
      // pointed hat or hood sweeping back
      ctx.beginPath();
      ctx.moveTo(-hr * 1.05, hy - hr * 0.1);
      ctx.lineTo(hr * 1.05, hy - hr * 0.1);
      ctx.lineTo(hr * 0.25, hy + hr * 2.6);
      ctx.closePath();
      const hat =
        type === 'healer' ? '#e8f0e8' : type === 'shaman' ? '#3a5a30' : shadeHex(style.body, -0.15);
      inkFill(ctx, hat);
      ctx.fillStyle = type === 'healer' ? '#28a070' : style.mark;
      ctx.fillRect(-hr * 0.8, hy + hr * 0.25, hr * 1.6, hr * 0.3);
      if (type === 'healer') {
        ctx.fillRect(-hr * 0.15, hy + hr * 0.7, hr * 0.3, hr * 1.1);
        ctx.fillRect(-hr * 0.5, hy + hr * 1.05, hr, hr * 0.3);
      }
    } else if (HOODED_TYPES.has(type)) {
      ctx.beginPath();
      ctx.arc(0, hy + hr * 0.15, hr * 1.12, -Math.PI * 0.1, Math.PI * 1.1);
      ctx.closePath();
      inkFill(ctx, shadeHex(style.body, -0.35));
    } else if (type === 'knight' || type === 'dark_knight') {
      ctx.beginPath();
      ctx.arc(0, hy, hr * 1.08, 0, Math.PI * 2);
      inkFill(ctx, type === 'dark_knight' ? '#1a1420' : '#aab4c8');
      ctx.fillStyle = INK;
      ctx.fillRect(-hr * 0.7, hy - hr * 0.55, hr * 1.4, hr * 0.22);
      ctx.beginPath();
      ctx.ellipse(0, hy + hr * 1.3, hr * 0.32, hr * 1.1, 0, 0, Math.PI * 2);
      inkFill(ctx, BLOOD, 1);
    } else if (HELM_TYPES.has(type) && !enemy) {
      ctx.beginPath();
      ctx.arc(0, hy, hr * 1.05, -Math.PI * 0.05, Math.PI * 1.05);
      ctx.closePath();
      inkFill(ctx, '#9aa4b8');
    } else if (type === 'builder' || type === 'courier' || type === 'bard') {
      ctx.beginPath();
      ctx.arc(0, hy, hr * 1.05, -Math.PI * 0.05, Math.PI * 1.05);
      ctx.closePath();
      inkFill(ctx, type === 'builder' ? '#d8b030' : type === 'bard' ? '#7a3a8a' : '#8a5a2a');
      if (type !== 'builder') {
        ctx.strokeStyle = type === 'bard' ? '#ffd700' : BONE;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(hr * 0.5, hy);
        ctx.quadraticCurveTo(hr * 1.8, hy + hr * 0.6, hr * 1.2, hy + hr * 2);
        ctx.stroke();
      }
    }
    if (type === 'general' || type === 'war_chief') {
      // crown of spikes
      ctx.fillStyle = type === 'general' ? '#ffd24a' : BONE;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        const a = -Math.PI / 2 + i * 0.45;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.16) * hr, hy + Math.sin(a - 0.16) * hr);
        ctx.lineTo(Math.cos(a) * hr * 1.7, hy + Math.sin(a) * hr * 1.7);
        ctx.lineTo(Math.cos(a + 0.16) * hr, hy + Math.sin(a + 0.16) * hr);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Face: skull sockets for the dead, tusks for brutes, burning eyes for every enemy
    if (undead) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(-hr * 0.36, hy - hr * 0.3, hr * 0.26, 0, Math.PI * 2);
      ctx.arc(hr * 0.36, hy - hr * 0.3, hr * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-hr * 0.08, hy - hr * 0.75, hr * 0.16, hr * 0.22);
    }
    if (brute) {
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
      ctx.fillStyle = '#ff3a1c';
      ctx.beginPath();
      ctx.arc(-hr * 0.36, hy - hr * 0.3, hr * 0.13, 0, Math.PI * 2);
      ctx.arc(hr * 0.36, hy - hr * 0.3, hr * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    if (type === 'harpy' || type === 'sky_drake') {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.6, -r * 0.2);
        ctx.lineTo(side * r * 2.1, -r * 0.9);
        ctx.lineTo(side * r * 1.7, r * 0.1);
        ctx.lineTo(side * r * 2, r * 0.6);
        ctx.lineTo(side * r * 0.8, r * 0.4);
        ctx.closePath();
        inkFill(ctx, shadeHex(style.body, -0.2));
      }
    }
    ctx.restore();
    if (animState !== 'death') ctx.globalAlpha = 1;
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
    const r = Math.min(24, style.size * 1.2);
    const bob = animState === 'walk' ? Math.sin(frame * 1.2) * 1.8 : 0;
    const lunge = animState === 'attack' ? 3 : 0;
    // Lift the hide toward bone so the black outline and features read against it.
    const lift = (hex, amt) => {
      const n = parseInt(String(hex).replace('#', ''), 16);
      if (!Number.isFinite(n)) return hex;
      const mix = (c, to) => Math.round(c + (to - c) * amt);
      return `rgb(${mix((n >> 16) & 255, 228)},${mix((n >> 8) & 255, 220)},${mix(n & 255, 196)})`;
    };
    const hide = lift(style.body, 0.28);
    const trim = lift(style.accent, 0.34);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(1.5, 4, r * 1.25, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (animState === 'death') {
      ctx.fillStyle = 'rgba(140,10,16,0.65)';
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 1.6, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
    }

    ctx.save();
    ctx.translate(0, bob + lunge);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
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
      ctx.fillStyle = BLOOD;
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, w * r, w * r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5040';
      ctx.fillRect(x * r - 0.6, y * r - 0.6, 1.2, 1.2);
    };

    if (shape === 'behemoth') {
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
    } else if (shape === 'iron_colossus') {
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
          [-1.3, -0.5],
          [-0.9, -0.7],
          [-0.85, 0.35],
          [-1.25, 0.25],
        ],
        trim
      );
      blob(
        [
          [1.3, -0.5],
          [0.9, -0.7],
          [0.85, 0.35],
          [1.25, 0.25],
        ],
        trim
      );
      blob(
        [
          [-0.5, 0.1],
          [0.5, 0.1],
          [0.42, 0.75],
          [-0.42, 0.75],
        ],
        INK
      );
      ctx.fillStyle = '#ff5a20';
      ctx.fillRect(-0.36 * r, 0.3 * r, 0.72 * r, 0.1 * r);
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
      for (const sd of [-1, 1]) {
        blob(
          [
            [sd * 0.45, 0.1],
            [sd * 1.45, 0.95],
            [sd * 1.2, 1.05],
            [sd * 0.3, 0.4],
          ],
          BONE
        );
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
      const flap = Math.sin(frame * 0.9) * 0.12;
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
      ctx.fillStyle = BONE;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.08 * r, (-1.05 + i * 0.28) * r);
        ctx.lineTo(0, (-1.2 + i * 0.28) * r);
        ctx.lineTo(0.08 * r, (-1.05 + i * 0.28) * r);
        ctx.fill();
      }
    } else {
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
      for (let i = 0; i < 4; i++) ctx.fillRect((-0.14 + i * 0.12) * r, 0.72 * r, 0.06 * r, 0.1 * r);
    }

    if (boss) {
      // Each warlord carries a mark of their own on top of the shared body.
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      if (type === 'boss_gorath') {
        // War banner on a pole at his back, and a broken tusk.
        ctx.beginPath();
        ctx.moveTo(-0.75 * r, -0.2 * r);
        ctx.lineTo(-0.75 * r, -1.55 * r);
        ctx.stroke();
        blob(
          [
            [-0.75, -1.5],
            [-0.05, -1.35],
            [-0.3, -1.15],
            [-0.05, -0.95],
            [-0.75, -1.0],
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
      } else if (type === 'boss_thokk') {
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
            [-1.25, -1.35],
            [-0.6, -1.05],
            [0, -1.5],
            [0.6, -1.05],
            [1.25, -1.35],
            [0.95, -0.5],
          ],
          INK
        );
        eye(0, 0.22, 0.13);
        ctx.strokeStyle = BLOOD;
        ctx.lineWidth = 1.2;
        for (const x of [-0.8, -0.3, 0.3, 0.8]) {
          ctx.beginPath();
          ctx.moveTo(x * r, -0.7 * r);
          ctx.lineTo(x * r * 1.15, -1.2 * r);
          ctx.stroke();
        }
      } else if (type === 'boss_morwen') {
        // A black veil and a bone staff.
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
        // Boils, and a cloud of flies.
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
        // Cinder flames licking off the shoulders.
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
        // Twin hooked daggers held wide, and slit eyes.
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
              [x + 0.24, -1.3],
              [x + 0.04, -1.3],
            ],
            INK
          );
          ctx.fillStyle = 'rgba(120,112,108,0.7)';
          ctx.beginPath();
          ctx.arc((x + 0.14) * r, (-1.5 - (frame % 3) * 0.06) * r, 0.2 * r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ff5a20';
        ctx.fillRect(-0.2 * r, 0.52 * r, 0.4 * r, 0.14 * r);
      } else if (type === 'boss_volk') {
        // A marshal's standard and spiked pauldrons.
        ctx.beginPath();
        ctx.moveTo(0.85 * r, -0.2 * r);
        ctx.lineTo(0.85 * r, -1.6 * r);
        ctx.stroke();
        blob(
          [
            [0.85, -1.55],
            [1.5, -1.45],
            [1.5, -1.0],
            [0.85, -1.1],
          ],
          INK
        );
        blob(
          [
            [1.0, -1.38],
            [1.35, -1.32],
            [1.35, -1.12],
            [1.0, -1.18],
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
      }
      ctx.strokeStyle = INK;
      // Crown of horns and a blood halo mark every named warlord.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
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
      ctx.strokeStyle = BLOOD;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.38, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawUnitTopDown(ctx, type, rotation, team, frame = 0, animState = 'idle', lod = 0) {
    // Defense-in-depth: every branch below calls type.startsWith(...) unguarded. A unit
    // whose spriteType desyncs from its type (stale pooled field, bad save data, etc.)
    // reaches here as undefined and throws, which aborts the ENTIRE world-layer draw for
    // that frame (game.js wraps it in one big try/catch around all world rendering) —
    // not just that one unit. Fall back to 'footman' so a single bad unit can never blank
    // the whole battlefield.
    if (typeof type !== 'string') type = 'footman';
    if (lod >= 3) {
      const style = resolveUnitStyle(type, team, 'footman');
      drawMinimalMarker(ctx, style, team, style.size * 0.82);
      return;
    }
    if (lod >= 2) {
      const style = resolveUnitStyle(type, team, 'footman');
      drawLowMarker(ctx, style, team, rotation, style.size, animState, type);
      return;
    }
    if (type === 'siege_tower') {
      drawSiegeTowerUnit(inkCtx(ctx), UNIT_STYLE.siege_tower, team, frame, animState, lod);
      return;
    }
    if (MONSTER_SPRITES.includes(type) || type.startsWith('boss_')) {
      drawMonsterUnit(ctx, type, team, frame, animState, lod);
      return;
    }
    drawInkFigure(ctx, type, rotation, team, frame, animState);
  }

  function getUnitCanvas(type, rotation, team, frame = 0, scale = 2, animState = 'idle', lod = 0) {
    const lodLevel = Math.max(0, Math.min(3, lod | 0));
    const rot =
      typeof GfxQuality !== 'undefined'
        ? GfxQuality.quantizeRotation(rotation)
        : Math.round(rotation);
    const qScale =
      typeof GfxQuality !== 'undefined'
        ? GfxQuality.quantizeScale(scale)
        : Math.round(scale * 4) / 4;
    const cacheFrame =
      typeof SpriteLod !== 'undefined'
        ? SpriteLod.cacheFrameForLod(lodLevel, frame, animState)
        : lodLevel >= 2 && animState !== 'attack' && animState !== 'hurt' && animState !== 'death'
          ? 0
          : frame;
    const cacheAnim =
      typeof SpriteLod !== 'undefined'
        ? SpriteLod.cacheAnimForLod(lodLevel, animState)
        : lodLevel >= 2
          ? 'idle'
          : animState;
    const key = `${type}_${rot}_${team}_${cacheFrame}_${qScale}_${cacheAnim}_l${lodLevel}`;
    if (cache.has(key)) {
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }

    // 72 logical units square, rendered at 2x so outlines stay crisp when zoomed.
    const size = UNIT_CANVAS_UNITS * 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.scale(2, 2);
    drawUnitTopDown(ctx, type, rot, team, cacheFrame, cacheAnim, lodLevel);
    ctx.globalAlpha = 1;
    cache.set(key, c);
    if (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    return c;
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
    const rots = [0, 90, 180, 270];
    for (const t of types) {
      for (const r of rots) {
        for (const s of ['idle', 'walk', 'attack']) {
          getUnitCanvas(t, r, 'player', 0, 1, s);
          getUnitCanvas(t, r, 'enemy', 0, 1, s);
        }
      }
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
    if (team === 'player') return '#4080ff';
    if (team === 'neutral') return '#d0b050';
    return '#e04040';
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
    },
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SpriteGen = SpriteGen;
