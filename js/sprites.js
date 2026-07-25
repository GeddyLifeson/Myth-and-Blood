/**
 * Procedural top-down sprites for Myth and Blood.
 * MnB2-style: rotatable unit markers on a flat battlefield.
 */
const SpriteGen = (() => {
  const CACHE_MAX = 768;
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

  function drawMinimalMarker(ctx, style, team, r) {
    ctx.fillStyle = style.body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = teamStrokeAlt(team);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawLowMarker(ctx, style, team, rotation, r, animState = 'idle') {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 0.9, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.body;
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
    ctx.beginPath();
    ctx.moveTo(0, -r - 2);
    ctx.lineTo(-3, -r + 4);
    ctx.lineTo(3, -r + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (animState === 'death') ctx.globalAlpha = 0.55;
  }

  function drawMediumUnit(ctx, type, rotation, team, frame, animState) {
    if (MONSTER_SPRITES.includes(type) || type.startsWith('boss_')) {
      const style = resolveUnitStyle(type, team, 'behemoth');
      const r = style.size * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 3, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.body;
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
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.body;
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
    ctx.fillStyle = style.mark;
    ctx.fillRect(-2, -r - 8, 4, 8);
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
      drawLowMarker(ctx, style, team, 90, style.size * 0.88, animState);
      return;
    }
    if (lod >= 1) {
      drawMediumUnit(ctx, type, 90, team, frame, animState);
      return;
    }
    const shape = type.startsWith('boss_')
      ? BOSS_ARCHETYPE[type] || 'behemoth'
      : type === 'cinderbound_juggernaut'
        ? 'iron_colossus'
        : type;
    const style = resolveUnitStyle(type, team, shape in UNIT_STYLE ? shape : 'behemoth');
    const r = style.size;
    const walkBob = animState === 'walk' ? Math.sin(frame * 1.2) * 2.5 : 0;
    const pulse = Math.sin(frame * 0.25) * 0.5 + 0.5;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 3, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    if (shape === 'behemoth') {
      ctx.fillStyle = style.body;
      ctx.beginPath();
      ctx.ellipse(0, walkBob, r * 1.1, r * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.9, -r * 0.3 + walkBob);
        ctx.lineTo(side * r * 1.2, -r * 0.8 + walkBob);
        ctx.lineTo(side * r * 0.5, -r * 0.5 + walkBob);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.arc(-5, -2 + walkBob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, -2 + walkBob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1810';
      ctx.beginPath();
      ctx.arc(-r * 0.85, r * 0.4 + walkBob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.85, r * 0.4 + walkBob, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'iron_colossus') {
      ctx.fillStyle = style.body;
      ctx.fillRect(-r * 0.85, -r * 0.9 + walkBob, r * 1.7, r * 1.8);
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.85, -r * 0.9 + walkBob, r * 1.7, r * 1.8);
      ctx.fillStyle = style.mark;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 8, -r * 0.5 + walkBob, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(i * 8, r * 0.3 + walkBob, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,120,40,${0.5 + pulse * 0.4})`;
      ctx.fillRect(-6, -2 + walkBob, 12, 10);
    } else if (shape === 'elder_wyrm') {
      ctx.fillStyle = style.body;
      ctx.beginPath();
      ctx.ellipse(0, walkBob * 0.5, r * 0.75, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.accent;
      ctx.beginPath();
      ctx.moveTo(-r * 1.3, walkBob);
      ctx.quadraticCurveTo(-r * 0.4, -r * 1.1 + walkBob, 0, -r * 0.3 + walkBob);
      ctx.quadraticCurveTo(r * 0.4, -r * 1.1 + walkBob, r * 1.3, walkBob);
      ctx.fill();
      ctx.fillStyle = style.body;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55 + walkBob, r * 0.35, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      if (animState === 'attack') {
        ctx.fillStyle = 'rgba(255,100,30,0.65)';
        ctx.beginPath();
        ctx.moveTo(-5, -r * 0.7 + walkBob);
        ctx.lineTo(0, -r * 1.5 + walkBob);
        ctx.lineTo(5, -r * 0.7 + walkBob);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ff4040';
      ctx.beginPath();
      ctx.arc(-3, -r * 0.55 + walkBob, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, -r * 0.55 + walkBob, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'abomination') {
      const wobble = Math.sin(frame * 0.8) * 2;
      ctx.fillStyle = style.body;
      ctx.beginPath();
      ctx.ellipse(-4 + wobble * 0.3, walkBob, r * 0.85, r * 0.7, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6 - wobble * 0.2, walkBob + 2, r * 0.7, r * 0.65, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.mark;
      for (const [ex, ey] of [
        [-6, -2],
        [0, -4],
        [7, -1],
        [-3, 4],
        [5, 5],
      ]) {
        ctx.beginPath();
        ctx.arc(ex + wobble * 0.2, ey + walkBob, 2 + pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + frame * 0.15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.5, Math.sin(ang) * r * 0.5 + walkBob);
        ctx.lineTo(Math.cos(ang) * r * 0.95, Math.sin(ang) * r * 0.95 + walkBob);
        ctx.stroke();
      }
    } else if (shape === 'void_stalker') {
      ctx.fillStyle = style.body;
      ctx.beginPath();
      ctx.ellipse(0, walkBob, r * 0.55, r * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101018';
      ctx.beginPath();
      ctx.arc(0, -r * 0.55 + walkBob, r * 0.5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.arc(-4, -r * 0.45 + walkBob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -r * 0.45 + walkBob, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.2 + walkBob);
      ctx.lineTo(-r * 1.1, r * 0.7 + walkBob);
      ctx.moveTo(r * 0.6, r * 0.2 + walkBob);
      ctx.lineTo(r * 1.1, r * 0.7 + walkBob);
      ctx.stroke();
    }

    if (type.startsWith('boss_')) {
      ctx.strokeStyle = `rgba(255,215,0,${0.45 + pulse * 0.35})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, walkBob * 0.5, r + 8, r * 0.9 + 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,215,0,${0.75 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(-9, -r * 0.82 + walkBob);
      ctx.lineTo(-5, -r * 1.2 + walkBob);
      ctx.lineTo(0, -r * 0.98 + walkBob);
      ctx.lineTo(5, -r * 1.2 + walkBob);
      ctx.lineTo(9, -r * 0.82 + walkBob);
      ctx.closePath();
      ctx.fill();
      if (type === 'boss_grimm' || type === 'boss_malachar') {
        ctx.fillStyle = `rgba(255,80,20,${0.35 + pulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(0, walkBob, r + 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = teamStroke(team);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, walkBob * 0.5, r + 4, r * 0.85 + 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (animState === 'attack') {
      ctx.fillStyle = 'rgba(255,40,40,0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (animState === 'death') {
      ctx.fillStyle = 'rgba(80,20,20,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 5, r * 1.2, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
    } else {
      ctx.globalAlpha = 1;
    }
  }

  function drawSiegeTowerUnit(ctx, style, team, frame, animState, lod = 0) {
    if (lod >= 3) {
      drawMinimalMarker(ctx, style, team, style.size * 0.75);
      return;
    }
    if (lod >= 2) {
      drawLowMarker(ctx, style, team, 90, style.size * 0.85, animState);
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
    ctx.fillStyle = style.body;
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

  function drawUnitTopDown(ctx, type, rotation, team, frame = 0, animState = 'idle', lod = 0) {
    if (lod >= 3) {
      const style = resolveUnitStyle(type, team, 'footman');
      drawMinimalMarker(ctx, style, team, style.size * 0.82);
      return;
    }
    if (lod >= 2) {
      const style = resolveUnitStyle(type, team, 'footman');
      drawLowMarker(ctx, style, team, rotation, style.size, animState);
      return;
    }
    if (lod >= 1) {
      drawMediumUnit(ctx, type, rotation, team, frame, animState);
      return;
    }
    if (type === 'siege_tower') {
      drawSiegeTowerUnit(ctx, UNIT_STYLE.siege_tower, team, frame, animState, lod);
      return;
    }
    if (MONSTER_SPRITES.includes(type) || type.startsWith('boss_')) {
      drawMonsterUnit(ctx, type, team, frame, animState, lod);
      return;
    }
    const style = resolveUnitStyle(type, team, 'footman');
    const r = style.size;
    const pulse = frame % 2 === 0 ? 0 : 1;
    const walkBob = animState === 'walk' ? Math.sin(frame * 1.5) * 2 : 0;
    const attackLunge = animState === 'attack' ? 6 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1, 2 + walkBob * 0.3, r + 1, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Walk legs (top-down stride)
    if (animState === 'walk') {
      ctx.fillStyle = '#2a2018';
      const legOff = Math.sin(frame * 1.5) * 4;
      ctx.fillRect(-4, 4 + legOff, 3, 5);
      ctx.fillRect(1, 4 - legOff, 3, 5);
    }

    // Body
    ctx.fillStyle = style.body;
    ctx.beginPath();
    ctx.arc(0, walkBob * 0.5, r, 0, Math.PI * 2);
    ctx.fill();

    // Team ring
    ctx.strokeStyle = teamStrokeAlt(team);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, walkBob * 0.5, r + 2, 0, Math.PI * 2);
    ctx.stroke();

    // Attack glow
    if (animState === 'attack') {
      ctx.fillStyle =
        team === 'player'
          ? 'rgba(255,220,100,0.35)'
          : team === 'neutral'
            ? 'rgba(200,160,64,0.35)'
            : 'rgba(255,80,60,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Direction + weapon
    ctx.save();
    ctx.rotate(((rotation + 90) * Math.PI) / 180);
    ctx.translate(0, -attackLunge);

    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.moveTo(0, -r - 4);
    ctx.lineTo(-4, -r + 2);
    ctx.lineTo(4, -r + 2);
    ctx.closePath();
    ctx.fill();

    // Weapon
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
    ctx.restore();

    if (type === 'healer' || type === 'shaman') {
      const bob = walkBob * 0.5;
      ctx.fillStyle = '#f0fff8';
      ctx.fillRect(-1, -2 + bob, 2, 8);
      ctx.fillRect(-4, 1 + bob, 8, 2);
      ctx.fillStyle = '#28c080';
      ctx.fillRect(0, -3 + bob, 2, 10);
      ctx.fillRect(-5, 0 + bob, 10, 2);
    }
    if (type === 'harpy' || type === 'sky_drake') {
      ctx.fillStyle = style.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 4, -2 + walkBob * 0.5);
        ctx.lineTo(side * 12, -6 + walkBob * 0.5);
        ctx.lineTo(side * 6, 2 + walkBob * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (type === 'war_chief' || type === 'general') {
      ctx.fillStyle = style.mark;
      ctx.beginPath();
      ctx.moveTo(0, -r - 6 + walkBob * 0.5);
      ctx.lineTo(-4, -r - 2 + walkBob * 0.5);
      ctx.lineTo(4, -r - 2 + walkBob * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // Head
    const goblinLike =
      type === 'orc' ||
      type === 'goblin' ||
      type === 'orc_archer' ||
      type.startsWith('goblin_') ||
      type === 'plague_rat' ||
      type === 'umbral_stalker' ||
      type === 'assassin';
    ctx.fillStyle =
      team === 'player'
        ? type === 'doomslayer_hero'
          ? '#c0a080'
          : '#d4a878'
        : goblinLike
          ? '#5a9040'
          : '#8060a0';
    ctx.beginPath();
    ctx.arc(0, walkBob * 0.5 - 1, 3, 0, Math.PI * 2);
    ctx.fill();

    if (animState === 'death') {
      ctx.fillStyle = 'rgba(120,20,20,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 4, r + 2, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55;
    } else {
      ctx.globalAlpha = 1;
    }
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

    const size = 48 * qScale;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.imageSmoothingEnabled = false;
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
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3a5028');
    grad.addColorStop(0.4, '#4a6838');
    grad.addColorStop(0.7, '#5a7848');
    grad.addColorStop(1, '#3a5028');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const hash = (x * 73 + y * 997 + w * 3) % 100;
        if (hash < 48) continue;
        ctx.fillStyle = hash > 82 ? 'rgba(48,82,38,0.42)' : 'rgba(62,98,48,0.28)';
        ctx.fillRect(x + (hash % 4), y + (hash % 3), 2, hash > 70 ? 3 : 2);
      }
    }

    const tier = Math.max(Math.floor((w - baseW) / 90), Math.floor((h - baseH) / 110));
    if (tier > 0) {
      ctx.fillStyle = 'rgba(140,200,90,0.12)';
      if (h > baseH) ctx.fillRect(0, baseH - 8, w, h - baseH + 8);
      if (w > baseW) {
        const side = (w - baseW) / 2;
        ctx.fillRect(0, 0, side, h);
        ctx.fillRect(w - side, 0, side, h);
      }
      ctx.strokeStyle = 'rgba(240,200,80,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      if (h > baseH) {
        ctx.beginPath();
        ctx.moveTo(12, baseH);
        ctx.lineTo(w - 12, baseH);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,210,100,0.75)';
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

    ctx.fillStyle = 'rgba(60,40,30,0.22)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#8a7060';
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
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + size * 0.4, size * 0.5, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(x - 2, y, 4, size * 0.5);
    ctx.fillStyle = '#2a5820';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.15, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a7030';
    ctx.beginPath();
    ctx.arc(x - size * 0.15, y - size * 0.05, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.15, y - size * 0.05, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
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

  function drawNeutralDen(ctx, x, y, size = 18) {
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
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + size * 0.3, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a5a58';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.5, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a7a78';
    ctx.beginPath();
    ctx.ellipse(x - size * 0.1, y - size * 0.05, size * 0.25, size * 0.15, 0, 0, Math.PI * 2);
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

  function drawBuilding(ctx, b) {
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
      ctx.fillText('CROSSOVER', b.x, b.y - r * 0.2);
      ctx.fillStyle = hqPal;
      ctx.font = '6px Cinzel';
      ctx.fillText((b.crossoverFaction || 'HQ').toUpperCase(), b.x, b.y + 4);
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

  function drawDestructible(ctx, d) {
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

  function drawBarricade(ctx, x, y) {
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(x - 18, y - 6, 36, 12);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(x - 16 + i * 8, y - 14, 4, 16);
    }
  }

  function drawHazard(ctx, h) {
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

  function drawPathLine(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = 'rgba(240,220,80,0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
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
    getBattlefieldCanvas,
    invalidateBattlefieldCache,
    prewarmCache,
    drawIcon,
    drawAbilityIcon,
    drawBattlefield,
    drawAttackSideMarkers,
    drawTree,
    drawNeutralDen,
    drawRock,
    drawBarricade,
    drawDestructible,
    drawHazard,
    drawBuilding,
    drawWallPlacementGhost,
    drawMoveMarker,
    drawSelectionRing,
    drawHealthBar,
    drawMoraleBar,
    drawVetStars,
    drawProjectile,
    drawPathLine,
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
