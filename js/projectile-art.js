/**
 * Projectiles in the ink style: what each missile looks like in flight and what it does
 * when it lands.
 *
 * The engine only knows two projectile types ("arrow" and "bolt"); the look comes from who
 * fired it. Each kind has its own silhouette, trail, flight (flat, lobbed, spinning) with a
 * shadow on the ground under the arc, and its own impact: an arrow sticks and quivers, a
 * crossbow bolt splinters, a firebomb bursts and scorches, a stone throws earth.
 *
 * Purely visual. Nothing here touches the simulation.
 */
const ProjectileArt = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD_HI = '#c8141c';
  const WOOD = '#b08a52';
  const EMBER = '#e0762a';
  const VIOLET = '#8a5cc0';
  const HEX = '#8fb83a';
  const GREEN = '#7fd49a';
  const GOLD = '#d9a93a';

  /**
   * Flight of each kind. `lift` is the height of the arc as a share of the distance (capped
   * by `max`), `spin` turns it end over end, `stick` leaves it standing where it lands.
   */
  const KIND = {
    arrow: { lift: 0.1, max: 16, stick: 'arrow' },
    arrow_foe: { lift: 0.1, max: 16, stick: 'arrow_foe' },
    xbow: { lift: 0.03, max: 5 },
    ballista: { lift: 0.05, max: 10, stick: 'ballista' },
    stone: { lift: 0.3, max: 46, spin: 0.25 },
    firebomb: { lift: 0.34, max: 52, spin: 0.3 },
    firebolt: { lift: 0.02, max: 4 },
    axe: { lift: 0.16, max: 22, spin: 0.55, stick: 'axe' },
    javelin: { lift: 0.14, max: 24, stick: 'javelin' },
    magic: { lift: 0, max: 0 },
    hex: { lift: 0, max: 0 },
    soul: { lift: 0, max: 0 },
    song: { lift: 0.06, max: 8 },
    heal: { lift: 0.12, max: 14 },
  };

  /** Who fires what. Anything not listed falls back on its engine type and its team. */
  const BY_SOURCE = {
    crossbowman: 'xbow',
    ballista: 'ballista',
    siege_tower: 'stone',
    hellmortar_pack: 'firebomb',
    goblin_firebrand: 'firebomb',
    sky_drake: 'firebolt',
    elder_wyrm: 'firebolt',
    boss_sylvara: 'firebolt',
    hellbound_legionnaire: 'firebolt',
    dark_mage: 'hex',
    shaman: 'hex',
    warp_prophet: 'hex',
    necromancer: 'soul',
    bone_summoner: 'soul',
    boss_morwen: 'soul',
    grim_revenant: 'javelin',
    bard: 'song',
    macho_man: 'axe',
    seth_rollins: 'axe',
  };

  function kindOf(p) {
    if (p.kind && KIND[p.kind]) return p.kind;
    const src = p.sourceType || '';
    let k = BY_SOURCE[src];
    if (!k) {
      if (/crossbow|arbalest/.test(src)) k = 'xbow';
      else if (/axe|berserk/.test(src)) k = 'axe';
      else if (/javelin|spear|skirmish|pike/.test(src)) k = 'javelin';
      else if (/fire|bomb|pyro|flame|mortar/.test(src)) k = 'firebomb';
      else if (/heal|cleric|priest|medic/.test(src)) k = 'heal';
      else if (p.type === 'arrow') k = p.team === 'enemy' ? 'arrow_foe' : 'arrow';
      else k = p.team === 'enemy' ? 'hex' : 'magic';
    }
    p.kind = k;
    return k;
  }

  // ---------------------------------------------------------------- flight
  /** 0..1 along the flight; the first sighting of a projectile fixes its full distance. */
  function progress(p) {
    const left = Math.hypot(p.tx - p.x, p.ty - p.y);
    if (!(p.d0 > 0)) p.d0 = Math.max(left, 1);
    return Math.max(0, Math.min(1, 1 - left / p.d0));
  }

  function liftOf(p, k, t) {
    if (!k.lift) return 0;
    return Math.sin(t * Math.PI) * Math.min(k.max, p.d0 * k.lift);
  }

  function inkLine(ctx, x0, y0, x1, y1, color, w) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 1.8;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  /** Speed lines behind a missile flying along +x. */
  function speedLines(ctx, from, len, n) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const oy = (i - (n - 1) / 2) * 2.4;
      ctx.moveTo(from - i * 2, oy);
      ctx.lineTo(from - len - i * 3, oy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function fletch(ctx, x, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 4, -2.6);
    ctx.lineTo(x - 2, 0);
    ctx.lineTo(x - 4, 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function head(ctx, x, len, half, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x + len, 0);
    ctx.lineTo(x, -half);
    ctx.lineTo(x, half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Each shape is drawn flying along +x, centred on (0,0). `t` is the engine tick.
  const SHAPES = {
    arrow(ctx) {
      speedLines(ctx, -9, 7, 2);
      inkLine(ctx, -8, 0, 5, 0, WOOD, 1.2);
      head(ctx, 4, 5, 2.2, BONE);
      fletch(ctx, -6, BONE);
    },
    arrow_foe(ctx) {
      speedLines(ctx, -9, 7, 2);
      inkLine(ctx, -8, 0, 5, 0, '#3a3034', 1.2);
      head(ctx, 4, 5, 2.4, '#3a3034');
      fletch(ctx, -6, BLOOD_HI);
    },
    xbow(ctx) {
      // Short and heavy, flat and fast: a long streak behind it.
      speedLines(ctx, -6, 14, 3);
      inkLine(ctx, -5, 0, 3, 0, '#6a4a34', 2);
      head(ctx, 2, 5, 2.8, BONE);
      ctx.fillStyle = BLOOD_HI;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.fillRect(-7, -2, 3, 4);
      ctx.strokeRect(-7, -2, 3, 4);
    },
    ballista(ctx) {
      speedLines(ctx, -15, 20, 4);
      inkLine(ctx, -14, 0, 9, 0, WOOD, 2.4);
      head(ctx, 8, 9, 4, BONE);
      fletch(ctx, -10, BLOOD_HI);
      fletch(ctx, -13, BONE);
    },
    javelin(ctx) {
      speedLines(ctx, -12, 8, 2);
      inkLine(ctx, -11, 0, 8, 0, WOOD, 1.5);
      head(ctx, 7, 7, 2.4, BONE);
      inkLine(ctx, -3, 0, 0, 0, BLOOD_HI, 2.2);
    },
    axe(ctx) {
      // Haft and a crescent blade; the caller spins it.
      inkLine(ctx, -7, 0, 6, 0, WOOD, 1.8);
      ctx.beginPath();
      ctx.moveTo(2, -1);
      ctx.lineTo(8, -7);
      ctx.lineTo(10, -1);
      ctx.lineTo(7, 1);
      ctx.closePath();
      ctx.fillStyle = BONE;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    },
    stone(ctx) {
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(-2, -6);
      ctx.lineTo(4, -5);
      ctx.lineTo(7, 0);
      ctx.lineTo(3, 6);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fillStyle = '#7a7268';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = '#b8ae96';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(1, -4);
      ctx.stroke();
    },
    firebomb(ctx, t) {
      // A clay pot with a burning rag in its neck.
      ctx.beginPath();
      ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
      ctx.fillStyle = '#6a3a2a';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(3.5, -1.6, 3, 3.2);
      const f = 3 + Math.sin(t * 0.9) * 1.2;
      ctx.beginPath();
      ctx.moveTo(6, -2);
      ctx.lineTo(8 + f, 0);
      ctx.lineTo(6, 2);
      ctx.closePath();
      ctx.fillStyle = EMBER;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    },
    firebolt(ctx, t) {
      // A teardrop of flame, ink outside, blood, then ember.
      const f = 1 + Math.sin(t * 0.8) * 0.12;
      for (let pass = 0; pass < 3; pass++) {
        const k = pass === 0 ? 1 : pass === 1 ? 0.72 : 0.42;
        ctx.beginPath();
        ctx.moveTo(6 * k, 0);
        ctx.lineTo(0, -4.4 * k);
        ctx.lineTo(-13 * k * f, 0);
        ctx.lineTo(0, 4.4 * k);
        ctx.closePath();
        ctx.fillStyle = pass === 0 ? INK : pass === 1 ? BLOOD_HI : EMBER;
        ctx.fill();
      }
    },
    magic(ctx, t) {
      // A bone-white four-point star with a violet heart, and three fading echoes.
      for (let i = 3; i >= 1; i--) {
        const s = 1 - i * 0.22;
        ctx.globalAlpha = 0.5 - i * 0.12;
        ctx.fillStyle = VIOLET;
        ctx.beginPath();
        ctx.moveTo(-i * 5 + 3 * s, 0);
        ctx.lineTo(-i * 5, -2.6 * s);
        ctx.lineTo(-i * 5 - 3 * s, 0);
        ctx.lineTo(-i * 5, 2.6 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const w = 2 + Math.sin(t * 0.7) * 0.5;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(w, -w);
      ctx.lineTo(0, -5.5);
      ctx.lineTo(-w, -w);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-w, w);
      ctx.lineTo(0, 5.5);
      ctx.lineTo(w, w);
      ctx.closePath();
      ctx.fillStyle = BONE;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = VIOLET;
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
    },
    hex(ctx, t) {
      // A sick green skull trailing a wavering tail.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      for (let i = 1; i <= 4; i++) ctx.lineTo(-4 - i * 3.4, Math.sin(t * 0.6 + i * 1.3) * 2.6);
      ctx.stroke();
      ctx.strokeStyle = HEX;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
      ctx.fillStyle = HEX;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(0.6, -2.4, 1.8, 1.8);
      ctx.fillRect(0.6, 0.6, 1.8, 1.8);
    },
    soul(ctx, t) {
      // A bone skull dragging blood.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      for (let i = 1; i <= 3; i++) ctx.lineTo(-4 - i * 4, Math.sin(t * 0.5 + i * 1.7) * 2);
      ctx.stroke();
      ctx.strokeStyle = BLOOD_HI;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = BONE;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(0.4, -2.4, 2, 1.9);
      ctx.fillRect(0.4, 0.5, 2, 1.9);
    },
    song(ctx) {
      // A bard's note: a struck quaver in gold.
      inkLine(ctx, 1, 2, 1, -6, GOLD, 1.2);
      inkLine(ctx, 1, -6, 5, -4, GOLD, 1.2);
      ctx.beginPath();
      ctx.arc(-1, 2, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    },
    heal(ctx) {
      // A bone cross inside a thin green ring.
      ctx.beginPath();
      ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      inkLine(ctx, 0, -3.2, 0, 3.2, BONE, 1.6);
      inkLine(ctx, -3.2, 0, 3.2, 0, BONE, 1.6);
    },
  };
  // These keep their own up: the caller does not turn them to face the flight.
  const UPRIGHT = { song: 1, heal: 1, stone: 0, firebomb: 0 };

  function drawShape(ctx, kind, x, y, angle, tick, spinPhase) {
    const k = KIND[kind];
    ctx.save();
    ctx.translate(x, y);
    if (k.spin) ctx.rotate(spinPhase * k.spin);
    else if (!UPRIGHT[kind]) ctx.rotate(angle || 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    SHAPES[kind](ctx, tick);
    ctx.restore();
  }

  /** One projectile in flight, with its shadow on the ground under the arc. */
  function drawProjectile(ctx, p, tick = 0) {
    const kind = kindOf(p);
    const k = KIND[kind];
    const t = progress(p);
    const lift = liftOf(p, k, t);
    if (lift > 1.5) {
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = INK;
      ctx.beginPath();
      const r = kind === 'ballista' ? 6 : kind === 'stone' ? 5 : 3.4;
      ctx.ellipse(p.x, p.y + 2, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawShape(ctx, kind, p.x, p.y - lift, p.angle || 0, tick, tick + (p.d0 || 0));
  }

  /** Particles a missile sheds each tick. Only fire and sorcery shed any. */
  function trail(p, tick) {
    const kind = kindOf(p);
    const P = typeof Particles !== 'undefined' ? Particles : null;
    if (!P) return true;
    if (kind === 'firebomb' || kind === 'firebolt') {
      const k = KIND[kind];
      const y = p.y - liftOf(p, k, progress(p));
      if (tick % 2 === 0) P.embers(p.x, y, 1, 0.8);
      if (tick % 3 === 0) P.smoke(p.x, y, 1, 2.2);
    } else if (kind === 'hex' && tick % 4 === 0) {
      P.trail(p.x, p.y, HEX);
    } else if (kind === 'soul' && tick % 4 === 0) {
      P.trail(p.x, p.y, BLOOD_HI);
    }
    return true;
  }

  // ---------------------------------------------------------------- impacts
  // Missiles left standing: in a unit (they ride with it) or planted in the ground.
  const STUCK_MAX = 48;
  const PLANT_MAX = 40;
  const stuck = [];
  const planted = [];
  // Cosmetic motes (a healer's blessing crossing to the wounded): no engine projectile.
  const motes = [];
  let missTick = 0;
  let clock = 0;

  function stick(kind, unit, ang) {
    if (stuck.length >= STUCK_MAX) stuck.shift();
    // Lodged a little off-centre, on the side it came from.
    const off = 3 + Math.random() * 3;
    stuck.push({
      kind,
      unit,
      ox: -Math.cos(ang) * off + (Math.random() - 0.5) * 3,
      oy: -Math.sin(ang) * off + (Math.random() - 0.5) * 3,
      ang,
      age: 0,
      life: kind === 'ballista' ? 110 : 70,
    });
  }

  function plant(kind, x, y, ang) {
    if (planted.length >= PLANT_MAX) planted.shift();
    planted.push({ kind, x, y, ang, age: 0, life: 300 });
  }

  /**
   * A projectile has reached the end of its flight. `p.landed` is set by the engine when it
   * struck `target`; otherwise it missed and comes down just past where it was aimed.
   */
  function impact(p, target) {
    const kind = kindOf(p);
    const k = KIND[kind];
    const ang = p.angle || 0;
    const P = typeof Particles !== 'undefined' ? Particles : null;
    const hit = !!p.landed && !!target;
    const x = hit ? target.x : p.tx + Math.cos(ang) * 9;
    const y = hit ? target.y : p.ty + Math.sin(ang) * 9;

    if (kind === 'firebomb') {
      P?.strikeFire?.(x, y, 0.5);
    } else if (kind === 'firebolt') {
      P?.embers?.(x, y, 6, 3);
      P?.smoke?.(x, y, 2, 3);
      P?.groundMark?.(x, y + 2, 4, 1, 600);
    } else if (kind === 'stone') {
      P?.dust?.(x, y);
      P?.splinter?.(x, y, ang, 5, '#7a7268');
      P?.ring?.(x, y, '#8a7a60', 4, 10, 14);
      if (!hit) P?.groundMark?.(x, y + 1, 4, 1, 500);
    } else if (kind === 'xbow') {
      // The bolt breaks on what it hits.
      P?.splinter?.(x, y, ang, hit ? 5 : 3, '#6a4a34');
      if (!hit) P?.dust?.(x, y);
    } else if (kind === 'magic' || kind === 'hex' || kind === 'soul') {
      const c = kind === 'magic' ? VIOLET : kind === 'hex' ? HEX : BLOOD_HI;
      P?.ring?.(x, y, c, 3, 10, 12);
      for (let i = 0; i < 4; i++)
        P?.shard?.(x, y, ang + Math.PI + (i - 1.5) * 0.7, 2.4, i % 2 ? BONE : c, 5);
      if (!hit) P?.groundMark?.(x, y + 1, 3, 1, 420);
    } else if (kind === 'song' || kind === 'heal') {
      P?.ring?.(x, y, kind === 'heal' ? GREEN : GOLD, 3, 12, 10);
    } else if (k.stick) {
      // Arrows, javelins, axes and ballista bolts stay where they land, and quiver.
      if (hit && target.hp > 0) stick(k.stick, target, ang);
      else plant(k.stick, x, y, ang);
      if (kind === 'ballista') {
        P?.splinter?.(x, y, ang, 4, WOOD);
        P?.dust?.(x, y);
      } else if (!hit) {
        P?.impactDust?.(x, y, 0.6);
      }
    }

    // A clean miss is said once in a while, not for every arrow of a volley.
    if (!hit && target && target.hp > 0 && clock - missTick > 20) {
      missTick = clock;
      globalThis.FloatingText?.miss?.(target.x, target.y);
    }
  }

  /** A cosmetic missile from one point to another (a healer's blessing, a hex). */
  function mote(kind, x0, y0, x1, y1) {
    if (!KIND[kind]) return;
    if (motes.length >= 24) motes.shift();
    const d = Math.hypot(x1 - x0, y1 - y0);
    motes.push({ kind, x0, y0, x1, y1, d, age: 0, life: Math.max(8, Math.min(26, d / 5)) });
  }

  function update() {
    clock++;
    let w = 0;
    for (let i = 0; i < stuck.length; i++) {
      const s = stuck[i];
      s.age++;
      const u = s.unit;
      if (!u || !(u.hp > 0)) {
        // The bearer fell: what was in him is left lying where he dropped.
        if (u && s.age < s.life) plant(s.kind, u.x + s.ox, u.y + s.oy + 5, s.ang);
        continue;
      }
      if (s.age < s.life) stuck[w++] = s;
    }
    stuck.length = w;
    w = 0;
    for (let i = 0; i < planted.length; i++) {
      const s = planted[i];
      if (++s.age < s.life) planted[w++] = s;
    }
    planted.length = w;
    w = 0;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      if (++m.age < m.life) motes[w++] = m;
      else if (typeof Particles !== 'undefined')
        Particles.ring?.(m.x1, m.y1, m.kind === 'heal' ? GREEN : HEX, 3, 10, 10);
    }
    motes.length = w;
  }

  /** A shaft standing where it struck: only the back half shows, and it shivers at first. */
  function drawStanding(ctx, kind, x, y, ang, age, life) {
    const quiver = age < 16 ? Math.sin(age * 1.5) * 0.3 * (1 - age / 16) : 0;
    const fade = life - age < 40 ? (life - age) / 40 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + quiver);
    ctx.globalAlpha = fade;
    ctx.lineCap = 'round';
    if (kind === 'axe') {
      inkLine(ctx, -9, 0, 0, 0, WOOD, 1.8);
      ctx.beginPath();
      ctx.moveTo(-2, -1);
      ctx.lineTo(1, -5);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fillStyle = BONE;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      const len = kind === 'ballista' ? 15 : kind === 'javelin' ? 12 : 8;
      const foe = kind === 'arrow_foe';
      inkLine(ctx, -len, 0, 0, 0, foe ? '#3a3034' : WOOD, kind === 'ballista' ? 2.2 : 1.2);
      if (kind === 'javelin') inkLine(ctx, -len * 0.55, 0, -len * 0.3, 0, BLOOD_HI, 2);
      else fletch(ctx, -len + 3, foe || kind === 'ballista' ? BLOOD_HI : BONE);
    }
    ctx.restore();
  }

  /** Planted misses, under the units. Called from the ground pass. */
  function drawGround(ctx, bounds) {
    for (const s of planted) {
      if (
        bounds &&
        (s.x < bounds.left || s.x > bounds.right || s.y < bounds.top || s.y > bounds.bottom)
      )
        continue;
      // A crack of ink where it went in.
      ctx.fillStyle = INK;
      ctx.globalAlpha = Math.min(0.6, (s.life - s.age) / 60);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 1, 3, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Leaning the way it flew, tilted up out of the dirt.
      const lean = Math.cos(s.ang) >= 0 ? -1.05 : -2.1;
      drawStanding(ctx, s.kind, s.x, s.y, lean, s.age, s.life);
    }
  }

  /** Missiles lodged in units, and cosmetic motes: over the units. */
  function drawOver(ctx, bounds, tick = 0) {
    for (const s of stuck) {
      const u = s.unit;
      const x = u.x + s.ox;
      const y = u.y + s.oy;
      if (bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom))
        continue;
      drawStanding(ctx, s.kind, x, y, s.ang, s.age, s.life);
    }
    for (const m of motes) {
      const t = m.age / m.life;
      const k = KIND[m.kind];
      const x = m.x0 + (m.x1 - m.x0) * t;
      const y = m.y0 + (m.y1 - m.y0) * t - Math.sin(t * Math.PI) * Math.min(k.max, m.d * k.lift);
      drawShape(ctx, m.kind, x, y, Math.atan2(m.y1 - m.y0, m.x1 - m.x0), tick, tick);
    }
  }

  function clear() {
    stuck.length = 0;
    planted.length = 0;
    motes.length = 0;
  }

  return {
    KIND,
    kindOf,
    drawProjectile,
    drawShape,
    trail,
    impact,
    mote,
    update,
    drawGround,
    drawOver,
    clear,
    counts: () => ({ stuck: stuck.length, planted: planted.length, motes: motes.length }),
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.ProjectileArt = ProjectileArt;
