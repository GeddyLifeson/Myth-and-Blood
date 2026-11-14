/**
 * One drawing per building type, registered with BuildingArt.
 *
 * Each drawer works in local units with the building's centre at (0, 0) and y running
 * toward the viewer. The view is the field's own: from above and a little to the south,
 * so a roof is seen from above and the south wall stands below it. Families share a kit
 * (js/building-art.js) and differ by silhouette, so a type can be told without a label.
 *
 * `fx(kind, x, y, extra)` records a part that moves (banner, smoke, torch, glow, the
 * ballista engine, mill sails); those are drawn live over the cached drawing.
 */
(() => {
  if (typeof BuildingArt === 'undefined') return;
  const K = BuildingArt.kit;
  const { INK, BONE, BLOOD, C, TAU } = K;
  const {
    poly,
    rect,
    line,
    stroke,
    ell,
    hatch,
    block,
    door,
    keepBlock,
    drum,
    cone,
    gableEW,
    gableNS,
    hip,
    tent,
    hideTent,
    palisade,
    palisadeRing,
    fence,
    barrel,
    crate,
    sack,
    logPile,
    stoneBlocks,
    hay,
    well,
    cart,
    dummy,
    target,
    skull,
    totem,
    pole,
    beam,
    ringWall,
    torchPost,
    emblem,
    sign,
    mulberry,
  } = K;

  /** Wraps a drawer designed at nominal radius n so it scales to the real radius. */
  function at(n, fn) {
    return (g, r, o, fx) => {
      const s = r / n;
      const A = (k, x, y, e) => {
        const ex = e ? Object.assign({}, e) : {};
        if (ex.len) ex.len *= s;
        if (ex.h) ex.h *= s;
        if (ex.r) ex.r *= s;
        ex.s = (ex.s || 1) * s;
        fx(k, x * s, y * s, ex);
      };
      g.save();
      g.scale(s, s);
      const info = fn(g, o, A) || null;
      g.restore();
      if (info && info.shadow) info.shadow = info.shadow.map((v) => v * s);
      return info;
    };
  }

  /** Pole with a waving cloth in the owner's colour. */
  function flag(g, A, o, x, y, hgt, e = {}) {
    pole(g, x, y, hgt);
    A(
      'banner',
      x + 0.5,
      y - hgt + 0.8,
      Object.assign(
        { len: 7, h: 4.6, col: o.enemy ? BLOOD : C.blue, mark: o.enemy ? INK : BONE },
        e
      )
    );
  }

  function torch(g, A, x, y, hgt = 7, e) {
    torchPost(g, x, y, hgt);
    A('torch', x, y - hgt - 1.2, e);
  }

  function horns(g, x, y, s = 1) {
    stroke(g, [x - 1.5 * s, y, x - 4 * s, y - 1 * s, x - 5 * s, y - 4.4 * s], 2.2 * s);
    stroke(g, [x - 1.5 * s, y, x - 4 * s, y - 1 * s, x - 5 * s, y - 4.4 * s], 1 * s, BONE);
    stroke(g, [x + 1.5 * s, y, x + 4 * s, y - 1 * s, x + 5 * s, y - 4.4 * s], 2.2 * s);
    stroke(g, [x + 1.5 * s, y, x + 4 * s, y - 1 * s, x + 5 * s, y - 4.4 * s], 1 * s, BONE);
  }

  function grassTufts(g, pts) {
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      stroke(g, [x - 1.4, y - 2.2, x, y, x + 0.2, y - 3, x, y, x + 1.6, y - 2], 0.6);
    }
  }

  /** Upper half of a dome over an elliptical rim. */
  function dome(g, cx, cy, rx, ry, rise, fill) {
    g.beginPath();
    g.ellipse(cx, cy, rx, rise, 0, Math.PI, 0, false);
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    K.ink(g);
    hatch(
      g,
      [
        cx + rx * 0.3,
        cy - rise,
        cx + rx,
        cy - rise * 0.5,
        cx + rx,
        cy + ry,
        cx + rx * 0.45,
        cy + ry,
      ],
      2.2,
      0.6,
      0.55
    );
    g.beginPath();
    for (const k of [-0.5, 0, 0.5]) {
      g.moveTo(cx, cy - rise);
      g.quadraticCurveTo(cx + k * rx * 1.5, cy - rise * 0.4, cx + k * rx, cy + ry * 0.86);
    }
    g.globalAlpha *= 0.45;
    g.lineWidth = 0.6;
    g.strokeStyle = INK;
    g.stroke();
    g.globalAlpha /= 0.45;
  }

  function cauldron(g, A, x, y, s = 1) {
    line(g, x - 3.4 * s, y, x, y - 7 * s, 0.9);
    line(g, x + 3.4 * s, y, x, y - 7 * s, 0.9);
    ell(g, x, y - 1.6 * s, 2.8 * s, 2.2 * s, C.ironD, 0.9);
    ell(g, x, y - 2.8 * s, 2.4 * s, 1 * s, C.dark, 0.6);
    A('torch', x, y + 0.6 * s, { s: 0.4 });
  }

  function campfire(g, A, x, y, s = 1) {
    ell(g, x, y, 4 * s, 2.2 * s, C.dark, 0.9);
    beam(g, x - 3 * s, y + 0.6 * s, x + 2.4 * s, y - 1 * s, 0.9, C.woodD);
    beam(g, x - 2.4 * s, y - 1 * s, x + 3 * s, y + 0.6 * s, 0.9, C.woodD);
    A('torch', x, y, { s: 0.75 * s, r: 52 });
  }

  // ============================================================ walls and gates
  BuildingArt.register(
    'wall',
    at(28, (g, o) => {
      const f = o.facing;
      if (f === 'east' || f === 'west') {
        const side = f === 'east' ? 'e' : 'w';
        keepBlock(g, -6.5, -27, 13, 7, 14, { noShade: true });
        block(g, -5, -24, 10, 46, 10, { slits: 0 });
        rect(g, f === 'east' ? -3.4 : -1.4, -33, 4.8, 44, C.stoneD, 0.7);
        K.crenel(g, -5, -24, 10, 46, 10, { sides: side, m: 3.4 });
        // timber walk on the inner side
        const ix = f === 'east' ? -6.6 : 5;
        rect(g, ix, -30, 1.6, 40, C.woodL, 0.7);
        keepBlock(g, -6.5, 17, 13, 7, 14, { slits: 1 });
        return { shadow: [2, 6, 9, 27] };
      }
      const south = f === 'south';
      block(g, -24, -5, 48, 10, 10, { slits: south ? 5 : 0 });
      rect(g, -22, south ? -14 : -11.6, 44, 5, C.stoneD, 0.7);
      K.crenel(g, -24, -5, 48, 10, 10, { sides: south ? 's' : 'n', m: 3.4 });
      if (!south) {
        // inner side faces the viewer: a timber stair and braces
        beam(g, -12, 5, -4, -4.6, 1.4);
        for (let i = 0; i < 4; i++) line(g, -11 + i * 2, 4 - i * 2.4, -9 + i * 2, 4 - i * 2.4, 0.9);
        beam(g, 6, 5, 6, -4, 1);
        beam(g, 14, 5, 14, -4, 1);
        beam(g, 4, -1.4, 16, -1.4, 0.9);
      }
      keepBlock(g, -28, -6, 8, 12, 14, { slits: south ? 1 : 0 });
      keepBlock(g, 20, -6, 8, 12, 14, { slits: south ? 1 : 0 });
      return { shadow: [0, 6, 28, 5] };
    })
  );

  BuildingArt.register(
    'fortress_upgrade',
    at(14, (g, o, A) => {
      poly(g, [0, -8, 13, 1, 0, 9, -13, 1], C.stoneD);
      hatch(g, [0, -8, 13, 1, 0, 9], 2.2, 0.7, 0.5);
      keepBlock(g, -6, -5, 12, 8, 9, { slits: 2 });
      flag(g, A, o, 0, -10, 8, { len: 5, h: 3.4 });
    })
  );

  BuildingArt.register(
    'castle',
    at(42, (g, o, A) => {
      rect(g, -30, -18, 60, 34, C.dirt, 0);
      hatch(g, [-30, -18, 30, -18, 30, 16, -30, 16], 3.2, 0.9, 0.3);
      keepBlock(g, -30, -21, 60, 6, 12, { sides: 'n' });
      drum(g, -31, -17, 7, 18, { slit: 1 });
      drum(g, 31, -17, 7, 18, { slit: 1 });
      keepBlock(g, -34, -17, 6, 30, 12, { sides: 'w' });
      keepBlock(g, 28, -17, 6, 30, 12, { sides: 'e' });
      gableEW(g, -13, -13, 26, 11, 9, 6, {
        wall: C.stone,
        tex: 'stone',
        roof: C.tile,
        roofD: C.tileD,
        rtex: 'shingle',
        door: 3.4,
        slits: 4,
      });
      well(g, -20, 4, 0.8);
      crate(g, 19, 3);
      barrel(g, 22.5, 6);
      keepBlock(g, -30, 9, 60, 6, 12, { sides: 's', slits: 8 });
      keepBlock(g, -9, 7, 18, 10, 19, { door: 7, slits: 2 });
      // portcullis
      for (let i = -2; i <= 2; i++) line(g, i * 1.4, 7.4, i * 1.4, 16.6, 0.6, C.iron);
      line(g, -3.4, 11, 3.4, 11, 0.6, C.iron);
      line(g, -3.4, 14, 3.4, 14, 0.6, C.iron);
      drum(g, -31, 14, 7.6, 19, { slit: 1 });
      drum(g, 31, 14, 7.6, 19, { slit: 1 });
      flag(g, A, o, 0, -7, 11, { len: 9, h: 6 });
      flag(g, A, o, -31, -35, 8, { len: 6, h: 4 });
      flag(g, A, o, 31, -35, 8, { len: 6, h: 4 });
      torch(g, A, -13, 18, 7);
      torch(g, A, 13, 18, 7);
      return { shadow: [0, 12, 41, 14] };
    })
  );

  BuildingArt.register(
    'castle_keep',
    at(22, (g, o, A) => {
      drum(g, -12, -4, 4.2, 30, { slit: 1 });
      drum(g, 12, -4, 4.2, 30, { slit: 1 });
      keepBlock(g, -12, -6, 24, 14, 26, { slits: 3, door: 5 });
      rect(g, -12, -15.4, 24, 2.6, BLOOD, 0.7);
      rect(g, -1.1, -9, 2.2, 5, INK, 0);
      rect(g, -7.6, -9, 1.6, 4, INK, 0);
      rect(g, 6, -9, 1.6, 4, INK, 0);
      drum(g, -12, 8, 4.4, 31, { slit: 1 });
      drum(g, 12, 8, 4.4, 31, { slit: 1 });
      flag(g, A, o, 0, -27, 11, { len: 9, h: 6, tail: 1 });
      torch(g, A, -6, 9, 6, { s: 0.5 });
      torch(g, A, 6, 9, 6, { s: 0.5 });
      return { shadow: [0, 7, 19, 8] };
    })
  );

  BuildingArt.register(
    'outpost',
    at(22, (g, o, A) => {
      ell(g, 0, 3, 17.5, 9.6, C.dirt, 0);
      palisadeRing(g, 0, 3, 18.5, 10.4, 'back', { h: 8.4 });
      // lookout on four posts
      beam(g, -6, 3, -6, -12, 1.2);
      beam(g, 6, 3, 6, -12, 1.2);
      beam(g, -6, 2, 6, -8, 0.7);
      beam(g, 6, 2, -6, -8, 0.7);
      block(g, -8, -5, 16, 9, 13, { wall: C.woodD, top: C.woodL, tex: 'plankH', noShade: true });
      rect(g, -8, -17.6, 16, 1.4, C.wood, 0.7);
      line(g, -7.4, -9, -7.4, -17, 1);
      line(g, 7.4, -9, 7.4, -17, 1);
      hip(g, -8.5, -5.5, 17, 10, 19, 5, { noWall: true });
      palisadeRing(g, 0, 3, 18.5, 10.4, 'front', { h: 8.4, gate: 0.36 });
      beam(g, -5.6, 13.4, -5.6, 4, 1.6, C.woodD);
      beam(g, 5.6, 13.4, 5.6, 4, 1.6, C.woodD);
      flag(g, A, o, 0, -25, 8);
      A('torch', -5.6, 3.4, { s: 0.5 });
      A('torch', 5.6, 3.4, { s: 0.5 });
      return { shadow: [0, 6, 20, 9] };
    })
  );

  BuildingArt.register(
    'spike_trap',
    at(14, (g, o) => {
      const pit = [-12, -5, 12, -5, 13.4, 6.4, -13.4, 6.4];
      poly(g, pit, C.dirtD);
      hatch(g, pit, 2, 0.8, 0.7);
      beam(g, -12, -5, 12, -5, 1.3, C.woodD);
      beam(g, -13.4, 6.4, 13.4, 6.4, 1.3, C.woodD);
      beam(g, -12, -5, -13.4, 6.4, 1.1, C.woodD);
      beam(g, 12, -5, 13.4, 6.4, 1.1, C.woodD);
      const hgt = o.sprung ? 4.4 : 9;
      if (o.sprung) {
        g.globalAlpha = 0.8;
        ell(g, 1, 2.4, 7, 2.6, BLOOD, 0);
        g.globalAlpha = 1;
      }
      for (const [row, off] of [
        [-1.6, 0],
        [4.4, 2.3],
      ]) {
        for (let x = -9 + off; x <= 9.4; x += 4.6) {
          poly(g, [x - 1.5, row, x, row - hgt, x + 1.5, row], o.sprung ? '#c9a7a0' : BONE, 0.9);
          if (o.sprung)
            poly(g, [x - 0.7, row - hgt * 0.5, x, row - hgt, x + 0.7, row - hgt * 0.5], BLOOD, 0);
        }
      }
      return { shadow: false };
    })
  );

  // ===================================================================== towers
  BuildingArt.register(
    'watchtower',
    at(18, (g, o, A) => {
      beam(g, -5.4, 0, -4.4, -22, 1.2, C.woodD);
      beam(g, 5.4, 0, 4.4, -22, 1.2, C.woodD);
      beam(g, -8.4, 8, -6, -19, 1.5);
      beam(g, 8.4, 8, 6, -19, 1.5);
      beam(g, -8, 4, 6.6, -6, 0.8);
      beam(g, 8, 4, -6.6, -6, 0.8);
      beam(g, -7, -6, 6.2, -16, 0.8);
      beam(g, 7, -6, -6.2, -16, 0.8);
      // ladder
      line(g, -1.6, 8.6, -1, -19, 0.9);
      line(g, 1.6, 8.6, 1, -19, 0.9);
      for (let y = 6; y > -18; y -= 3) line(g, -1.5, y, 1.5, y, 0.7);
      block(g, -8.5, -24, 17, 8, 3.4, {
        wall: C.woodD,
        top: C.woodL,
        tex: 'plankH',
        noShade: true,
      });
      line(g, -8, -19.4, -8, -27, 1.1);
      line(g, 8, -19.4, 8, -27, 1.1);
      line(g, -7.4, -27, -7.4, -33, 0.9);
      line(g, 7.4, -27, 7.4, -33, 0.9);
      rect(g, -8.5, -23.4, 17, 1.4, C.wood, 0.7);
      hip(g, -9, -24, 18, 8, 11.4, 6, {
        noWall: true,
        roof: C.slate,
        roofD: C.slateD,
        rtex: 'slate',
      });
      flag(g, A, o, 0, -37, 7, { len: 6, h: 3.6 });
      A('torch', 5.4, -24, { s: 0.5, r: 64 });
      return { shadow: [0, 6, 12, 5] };
    })
  );

  // =================================================================== economy
  function quarry(g, o, A) {
    const st = o.enemy ? [C.ewall, C.ewallD, C.dark] : [C.stone, C.stoneD, C.stoneDD];
    const rim = [-19, -6, -8, -12, 8, -11, 19, -5, 20, 5, 9, 11, -10, 10, -20, 4];
    const scale = (k, dy) => rim.map((v, i) => (i % 2 ? v * k + dy : v * k));
    poly(g, rim, st[0]);
    K.tex(g, rim, 'stone', 3);
    poly(g, scale(0.72, 1), st[1]);
    const deep = scale(0.44, 2);
    poly(g, deep, st[2]);
    hatch(g, deep, 1.8, 0.8, 0.8);
    stroke(g, [-14, -2, -11, 1, -12, 5], 0.7);
    stroke(g, [12, -4, 14, 0, 12, 4], 0.7);
    if (o.enemy) {
      skull(g, -2, 3, 0.9);
      skull(g, 4, 5, 0.7);
      totem(g, 15, 11, 11);
      totem(g, -17, 9, 9);
    } else {
      stoneBlocks(g, 14, 11, 1.1);
      cart(g, -1, 14, 0.75);
    }
    beam(g, -15, 7, -11, -19, 1.4);
    beam(g, -7, 8, -11, -19, 1.4);
    beam(g, -11, -19, 3, -14, 1.1);
    line(g, 3, -14, 3, -4, 0.6);
    rect(g, 0.8, -4, 4.4, 3.2, o.enemy ? BONE : C.stoneL, 0.9);
    A('light', 0, 0, { r: 34 });
    return { shadow: [0, 2, 21, 9] };
  }
  BuildingArt.register('quarry', at(22, quarry));
  BuildingArt.register('enemy_quarry', at(22, quarry));

  function stall(g, o, A) {
    const a = o.enemy ? C.hide : BONE;
    const b = o.enemy ? BLOOD : C.blue;
    rect(g, -13, -4, 26, 7, C.woodDD, 0.9);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      poly(
        g,
        [-13 + 26 * t0, -18, -13 + 26 * t1, -18, -15 + 30 * t1, -6, -15 + 30 * t0, -6],
        i % 2 ? b : a,
        0.6
      );
    }
    poly(g, [-13, -18, 13, -18, 15, -6, -15, -6], null, 1.3);
    for (let i = 0; i < 8; i++) {
      const x = -15 + i * 3.75;
      poly(g, [x, -6, x + 3.75, -6, x + 1.9, -3.6], i % 2 ? a : b, 0.7);
    }
    hatch(g, [6, -18, 13, -18, 15, -6, 8, -6], 2.2, 0.7, 0.5);
    line(g, -14.4, -6, -14.4, 5, 1.3);
    line(g, 14.4, -6, 14.4, 5, 1.3);
    rect(g, -13, 0.6, 26, 4.4, C.wood, 1);
    rect(g, -13, -1.6, 26, 2.4, C.woodL, 0.9);
    if (o.enemy) {
      skull(g, -8, -1.4, 0.7);
      skull(g, -3, -1.4, 0.7);
      skull(g, 2, -1.4, 0.7);
      // cage
      rect(g, 8, 7, 9, 7, C.dark, 1);
      for (let i = 1; i < 5; i++) line(g, 8 + i * 1.8, 7, 8 + i * 1.8, 14, 0.7, C.iron);
      totem(g, -15, 13, 12);
    } else {
      ell(g, -8, -1, 1.5, 1, C.tile, 0.6);
      ell(g, -4, -1, 1.5, 1, C.gold, 0.6);
      ell(g, 0, -1, 1.5, 1, C.green, 0.6);
      ell(g, 4, -1, 1.5, 1, C.tile, 0.6);
      crate(g, 14, 12, 1.1);
      barrel(g, 8.6, 11.6);
      sack(g, -15, 10);
      cart(g, -5, 14.6, 0.8);
      sign(g, 15.4, 6, 'scales', { h: 12 });
    }
    A('light', 0, 2, { r: 34 });
    return { shadow: [0, 7, 18, 7] };
  }
  BuildingArt.register('trade_outpost', at(20, stall));
  BuildingArt.register('enemy_trade_outpost', at(20, stall));

  BuildingArt.register(
    'mess_hall',
    at(20, (g, o, A) => {
      gableEW(g, -17, -8, 27, 13, 8, 5, { door: 3.6, slits: 5, doorX: -4 });
      block(g, 9, -9, 6, 5, 19, { wall: C.stone });
      A('smoke', 12, -28, { s: 1.1 });
      rect(g, -16, 9.6, 11, 2.6, C.woodL, 0.9);
      line(g, -16, 13.4, -5, 13.4, 1.2);
      line(g, -16, 8.4, -5, 8.4, 1.2);
      barrel(g, 1, 11.4);
      barrel(g, 5, 13, 0.9);
      cauldron(g, A, 13, 12);
      A('light', -4, 4, { r: 40 });
      return { shadow: [0, 5, 19, 8] };
    })
  );

  BuildingArt.register(
    'research_lab',
    at(22, (g, o, A) => {
      gableEW(g, -20, -4, 14, 10, 8, 4, {
        wall: C.stone,
        tex: 'stone',
        roof: C.slate,
        roofD: C.slateD,
        rtex: 'slate',
        slits: 2,
      });
      drum(g, 5, 3, 12, 13, { crenel: false, door: 4, open: true });
      dome(g, 5, -10, 12, 7.2, 13, C.blue);
      poly(g, [3.4, -22.6, 6.8, -22.6, 10.4, -4.4, 4.6, -3.2], C.dark, 0.9);
      line(g, 6.4, -12, 15.4, -27, 3.4);
      line(g, 6.4, -12, 15.4, -27, 1.8, C.gold);
      ell(g, 15.6, -27.4, 1.5, 1.5, C.dark, 0.7);
      // armillary on the annex
      ell(g, -13, -13, 3, 3, null, 0.9);
      ell(g, -13, -13, 3, 1.1, null, 0.7);
      line(g, -13, -9.8, -13, -8, 1);
      A('glow', -13, -13, { r: 1.5, col: '#9fc4d8' });
      A('light', 3, 4, { r: 38 });
      return { shadow: [0, 6, 20, 8] };
    })
  );

  BuildingArt.register(
    'merchant_guild',
    at(48, (g, o, A) => {
      gableEW(g, -32, -16, 64, 20, 13, 8, {
        wall: C.stone,
        tex: 'stone',
        roof: C.tile,
        roofD: C.tileD,
        rtex: 'shingle',
        slits: 9,
      });
      // cross gable with the great door
      gableNS(g, -10, -12, 20, 20, 15, 9, {
        wall: C.stoneL,
        tex: 'stone',
        roof: C.tile,
        roofD: C.tileD,
        rtex: 'shingle',
        door: 7,
      });
      ell(g, 0, -11, 4.4, 4.4, C.dark, 1);
      emblem(g, 'scales', 0, -11, 0.72, C.gold);
      // cupola
      drum(g, 0, -27, 4.4, 5, { crenel: false, tex: null });
      cone(g, 0, -32, 5.6, 8, { roof: C.gold });
      flag(g, A, o, 0, -40, 8, { col: o.enemy ? BLOOD : C.gold, mark: INK });
      // market in front
      for (const sx of [-30, 22]) {
        for (let i = 0; i < 4; i++) {
          poly(
            g,
            [sx + i * 3, 10, sx + i * 3 + 3, 10, sx + i * 3 + 3.6, 17, sx + i * 3 - 0.6, 17],
            i % 2 ? C.blue : BONE,
            0.6
          );
        }
        poly(g, [sx, 10, sx + 12, 10, sx + 13.2, 17, sx - 1.2, 17], null, 1.2);
        rect(g, sx, 19, 12, 3, C.wood, 0.9);
        line(g, sx - 0.6, 17, sx - 0.6, 23, 1.1);
        line(g, sx + 12.6, 17, sx + 12.6, 23, 1.1);
      }
      crate(g, -13, 22, 1.2);
      crate(g, -18.4, 24, 1);
      barrel(g, 13, 22, 1.1);
      sack(g, 18, 24, 1.1);
      cart(g, 2, 27, 1.1);
      torch(g, A, -13, 11, 8);
      torch(g, A, 13, 11, 8);
      return { shadow: [0, 14, 42, 14] };
    })
  );

  // ================================================================== medical
  BuildingArt.register(
    'medical_tent',
    at(18, (g, o, A) => {
      tent(g, -1, 1, 26, 16, 13);
      emblem(g, 'cross', -7.4, -5, 1, BLOOD);
      emblem(g, 'cross', 6.4, -5.4, 0.8, '#7c1418');
      // cot
      rect(g, 6, 11.4, 10, 3, C.canvas, 0.9);
      rect(g, 6, 11.4, 2.6, 3, C.canvasD, 0.7);
      line(g, 6.6, 14.4, 6.6, 15.8, 0.9);
      line(g, 15.4, 14.4, 15.4, 15.8, 0.9);
      pole(g, -15, 10, 15);
      A('banner', -14.5, -4.2, { len: 6.4, h: 5, col: BONE, mark: BLOOD });
      torch(g, A, 14, 6, 6, { s: 0.5 });
      return { shadow: [0, 6, 17, 7] };
    })
  );

  // ================================================================ academies
  const slate = { wall: C.stone, tex: 'stone', roof: C.slate, roofD: C.slateD, rtex: 'slate' };

  BuildingArt.register(
    'academy_footman',
    at(24, (g, o, A) => {
      gableEW(g, -18, -10, 36, 13, 9, 5, Object.assign({ door: 4.4, slits: 4 }, slate));
      emblem(g, 'shield', -11, -1.6, 0.62, C.blue);
      emblem(g, 'shield', 11, -1.6, 0.62, C.blue);
      g.save();
      g.translate(0, -10.6);
      g.rotate(0.6);
      emblem(g, 'sword', 0, 0, 1.15, BONE);
      g.rotate(-1.2);
      emblem(g, 'sword', 0, 0, 1.15, BONE);
      g.restore();
      dummy(g, -13, 14, 1.1);
      dummy(g, -5, 15.4, 1.1);
      // weapon rack
      beam(g, 5, 9.6, 17, 9.6, 1);
      line(g, 5, 13.6, 5, 8.4, 1.2);
      line(g, 17, 13.6, 17, 8.4, 1.2);
      for (let i = 0; i < 4; i++) emblem(g, 'sword', 7.4 + i * 2.5, 9.6, 0.56, C.stoneL);
      flag(g, A, o, -18, -17, 9);
      torch(g, A, 20, 6, 7);
      return { shadow: [0, 7, 22, 9] };
    })
  );

  BuildingArt.register(
    'academy_archer',
    at(24, (g, o, A) => {
      hip(g, -21, -10, 17, 11, 8, 5, {
        wall: C.wood,
        roof: C.green,
        roofD: C.greenD,
        rtex: 'shingle',
        door: 3.4,
      });
      emblem(g, 'bow', -12.4, -12.4, 0.95, BONE);
      hay(g, 4, -6.4, 1.3);
      hay(g, 13.6, -6, 1.3);
      target(g, 3, -1, 1.35);
      target(g, 12.6, 1.4, 1.35);
      target(g, 20, 5.4, 1.1);
      line(g, 2.2, -8.4, 5.4, -10.6, 0.8);
      line(g, 13.6, -6, 16.4, -8.4, 0.8);
      // shooting line with a quiver barrel
      fence(g, -21, 14.4, 0, 14.4, 3);
      barrel(g, -8, 12.6, 1);
      for (const dx of [-1, 0, 1]) line(g, -8 + dx, 9, -8 + dx * 1.8, 5, 0.6, BONE);
      flag(g, A, o, -21, -15, 9, { col: o.enemy ? BLOOD : C.green });
      torch(g, A, 4, 13, 6, { s: 0.5 });
      return { shadow: [0, 7, 22, 9] };
    })
  );

  BuildingArt.register(
    'academy_mage',
    at(24, (g, o, A) => {
      ell(g, -11, 11, 9, 4.4, 'rgba(100,78,126,0.45)', 0.8);
      ell(g, -11, 11, 6, 2.8, null, 0.6);
      drum(g, 12, 6, 5.4, 14, { crenel: false, slit: 1, open: true });
      cone(g, 12, -8, 6.8, 11, { roof: C.purpleD });
      drum(g, -1, 5, 9, 25, { crenel: false, door: 3.8, open: true });
      rect(g, -5.4, -12, 1.6, 4.4, C.flame, 0.6);
      rect(g, 1, -6, 1.6, 4.4, C.flame, 0.6);
      cone(g, -1, -20, 11.4, 18, { roof: C.purple });
      emblem(g, 'star', -1, -40.4, 0.72, C.gold);
      A('glow', -15, -14, { r: 3, col: '#b9a2e8', bob: 1.6 });
      A('glow', -11, 9, { r: 1.4, col: '#b9a2e8' });
      A('light', 0, 4, { r: 34 });
      return { shadow: [0, 7, 17, 8] };
    })
  );

  BuildingArt.register(
    'academy_cavalry',
    at(24, (g, o, A) => {
      gableEW(g, -21, -11, 36, 12, 8, 5, { slits: 0 });
      for (let i = 0; i < 4; i++) {
        const cx = -15.6 + i * 8.4;
        door(g, cx, 1, 5.6, 6.6);
        line(g, cx - 2.8, -1.6, cx + 2.8, -1.6, 1, C.woodL);
      }
      emblem(g, 'horseshoe', -3, -11.6, 1.4, BONE);
      fence(g, -21, 4, -21, 15);
      fence(g, 17, 4, 17, 15);
      // a horse in the paddock
      ell(g, 4, 9.6, 5.2, 2.7, C.woodD, 1);
      poly(g, [8, 8, 11.4, 5, 12.6, 7, 10, 9.6], C.woodD, 1);
      line(g, 0, 9, -2.4, 11.6, 1.1);
      line(g, 1.4, 11.4, 1.4, 13.6, 0.9);
      line(g, 6.6, 11.4, 6.6, 13.6, 0.9);
      hay(g, -14, 12.4, 1.1);
      rect(g, -8, 11, 6, 2.2, C.woodDD, 0.8);
      fence(g, -21, 15, 17, 15);
      flag(g, A, o, 15, -18, 9);
      torch(g, A, 20, 4, 7);
      return { shadow: [0, 8, 22, 9] };
    })
  );

  BuildingArt.register(
    'academy_knight',
    at(24, (g, o, A) => {
      drum(g, -14.4, 4, 5.6, 18, { crenel: false, slit: 1, open: true });
      cone(g, -14.4, -14, 7, 11, { roof: C.blueD });
      drum(g, 14.4, 4, 5.6, 18, { crenel: false, slit: 1, open: true });
      cone(g, 14.4, -14, 7, 11, { roof: C.blueD });
      gableNS(g, -9.4, -10, 18.8, 17, 14, 8, Object.assign({ door: 4.6 }, slate));
      emblem(g, 'shield', 0, -8.4, 0.9, BONE);
      // tilt rail and lances
      fence(g, -20, 14.6, 20, 14.6, 2.6);
      for (let i = 0; i < 3; i++) {
        beam(g, 14 + i * 2.4, 13, 17 + i * 2.4, -4, 0.7, BONE);
      }
      pole(g, -14.4, -25, 5);
      A('banner', -13.9, -29.4, { len: 5.4, h: 3.4, col: o.enemy ? BLOOD : C.blue, tail: 1 });
      pole(g, 14.4, -25, 5);
      A('banner', 14.9, -29.4, { len: 5.4, h: 3.4, col: o.enemy ? BLOOD : C.blue, tail: 1 });
      torch(g, A, -5.6, 9, 5, { s: 0.45 });
      torch(g, A, 5.6, 9, 5, { s: 0.45 });
      return { shadow: [0, 7, 22, 8] };
    })
  );

  BuildingArt.register(
    'academy_sapper',
    at(24, (g, o, A) => {
      g.beginPath();
      g.ellipse(-3, 1, 18.4, 15, 0, Math.PI, 0, false);
      g.ellipse(-3, 1, 18.4, 9.4, 0, 0, Math.PI, false);
      g.closePath();
      g.fillStyle = C.green;
      g.fill();
      K.ink(g);
      hatch(g, [4, -14, 16, -8, 16, 10, 6, 10], 2.2, 0.7, 0.55);
      grassTufts(g, [-15, -3, -9, -9, -1, -11, 7, -8, 11, -2, -17, 3]);
      rect(g, -9, -1.6, 12, 11.6, C.dark, 0);
      beam(g, -9, 10, -9, -2, 1.7);
      beam(g, 3, 10, 3, -2, 1.7);
      beam(g, -10.6, -2.4, 4.6, -2.4, 1.9);
      line(g, -6, 10, -8.4, 17, 0.9);
      line(g, 0, 10, 1.8, 17, 0.9);
      for (let i = 0; i < 3; i++)
        line(g, -6.6 - i * 0.6, 11.4 + i * 2.2, 0.6 + i * 0.5, 11.4 + i * 2.2, 0.8);
      barrel(g, 11.4, 12, 1.25, C.woodD);
      barrel(g, 16.4, 10, 1.25, C.woodD);
      barrel(g, 14, 6.6, 1.25, C.woodD);
      line(g, 10, 8.6, 12.8, 11, 0.9, BLOOD);
      line(g, 12.8, 8.6, 10, 11, 0.9, BLOOD);
      stroke(g, [16.4, 5.6, 19, 3, 20.4, 5, 21.6, 2.4], 0.7);
      sign(g, -21, 12, 'bomb', { h: 12 });
      pole(g, -3, -13, 8);
      A('banner', -2.5, -20.4, { len: 5, h: 3.4, col: BLOOD, tail: 1 });
      A('light', -3, 6, { r: 28 });
      return { shadow: [0, 7, 21, 8] };
    })
  );

  BuildingArt.register(
    'academy_healer',
    at(22, (g, o, A) => {
      gableEW(g, -16, -9, 26, 12, 9, 5, {
        wall: C.stoneL,
        tex: 'stone',
        roof: C.canvas,
        roofD: C.canvasD,
        rtex: null,
        door: 3.6,
        slits: 3,
      });
      emblem(g, 'cross', -3, -10.4, 1.25, BLOOD);
      // herb beds
      for (let i = 0; i < 2; i++) {
        rect(g, -18 + i * 9, 8, 7.6, 6, C.dirt, 0.8);
        for (let k = 0; k < 3; k++) {
          for (let j = 0; j < 3; j++)
            ell(g, -16.6 + i * 9 + k * 2.4, 9.4 + j * 1.8, 0.8, 0.7, C.green, 0.4);
        }
      }
      well(g, 14, 11, 0.9);
      pole(g, 12.4, -4, 14);
      A('banner', 12.9, -17.2, { len: 6, h: 4.6, col: BONE, mark: BLOOD });
      torch(g, A, 4, 13, 6, { s: 0.5 });
      return { shadow: [0, 7, 20, 8] };
    })
  );

  BuildingArt.register(
    'academy_builder',
    at(22, (g, o, A) => {
      rect(g, -18, -6, 24, 10, C.woodDD, 0.9);
      rect(g, -14, 0.6, 10, 2.4, C.wood, 0.8);
      const roof = [-18, -18, 6, -18, 8.4, -5.6, -20.4, -5.6];
      poly(g, roof, C.woodL);
      K.tex(g, roof, 'plankH', 4);
      hatch(g, [0, -18, 6, -18, 8.4, -5.6, 2, -5.6], 2.2, 0.7, 0.5);
      emblem(g, 'hammer', -6, -11.6, 1.35, C.dark);
      line(g, -19.6, -5.6, -19.6, 5, 1.4);
      line(g, 7.6, -5.6, 7.6, 5, 1.4);
      // half-built frame
      for (const [x1, y1, x2, y2] of [
        [-17, 15, -17, 7],
        [-8, 15, -8, 7],
        [-17, 7, -8, 7],
        [-17, 7, -12.5, 3.4],
        [-8, 7, -12.5, 3.4],
        [-17, 11, -8, 11],
      ]) {
        beam(g, x1, y1, x2, y2, 0.9);
      }
      // crane
      beam(g, 15, 12, 15, -24, 1.7);
      beam(g, 15, -23, 0.6, -16.4, 1.2);
      beam(g, 15, -15, 9, -20.4, 0.8);
      line(g, 1, -16.4, 1, -8.4, 0.6);
      rect(g, -3, -8.4, 8, 1.8, C.woodL, 0.8);
      logPile(g, -1, 14.6, 1.1);
      stoneBlocks(g, 10.4, 15, 0.9);
      flag(g, A, o, 15, -24, 5, { len: 5, h: 3.2 });
      A('light', -4, 4, { r: 34 });
      return { shadow: [0, 8, 20, 8] };
    })
  );

  BuildingArt.register(
    'academy_courier',
    at(22, (g, o, A) => {
      gableNS(g, -18, -5, 15, 13, 9, 6, {
        roof: C.tile,
        roofD: C.tileD,
        rtex: 'shingle',
        door: 3.4,
        eye: 1.2,
      });
      drum(g, 6, 5, 6.4, 23, { crenel: false, wall: C.stoneL, open: true, tex: null });
      for (let row = 0; row < 4; row++) {
        for (let i = -1; i <= 1; i++) {
          ell(g, 6 + i * 3.4 + (row % 2) * 0.8, -13 + row * 4.4, 0.9, 1.1, C.dark, 0);
        }
        line(g, 1, -11 + row * 4.4, 11.4, -11 + row * 4.4, 0.5);
      }
      cone(g, 6, -18, 8, 9, { roof: C.tile });
      // birds
      poly(g, [10, -25.6, 12.4, -27, 13.6, -25.4, 11.6, -24.6], C.stoneL, 0.7);
      poly(g, [0.4, -19.4, 2.6, -20.8, 3.6, -19.4, 1.6, -18.6], C.stoneL, 0.7);
      pole(g, 17.6, 12, 30);
      A('banner', 18.1, -17.2, { len: 9, h: 3.6, col: C.gold, tail: 1 });
      sign(g, -6, 13.4, 'scroll', { h: 11 });
      line(g, -19, 13, -11, 13, 1.2);
      line(g, -19, 13, -19, 10.4, 1.2);
      line(g, -11, 13, -11, 10.4, 1.2);
      A('light', 0, 4, { r: 32 });
      return { shadow: [0, 7, 20, 8] };
    })
  );

  BuildingArt.register(
    'academy_scout',
    at(22, (g, o, A) => {
      tent(g, -7, 2, 21, 16, 11, { cloth: C.green, clothD: C.greenD });
      emblem(g, 'eye', -12.6, -5, 0.8, BONE);
      horns(g, -7, -1.6, 0.9);
      // lookout mast with a crow's nest
      beam(g, 13, 11, 13, -33, 1.6);
      line(g, 13, -22, 6, 9, 0.6);
      line(g, 13, -22, 19, 10, 0.6);
      rect(g, 8.6, -27, 8.8, 4.4, C.wood, 1);
      K.tex(g, [8.6, -27, 17.4, -27, 17.4, -22.6, 8.6, -22.6], 'wood', 3);
      ell(g, 13, -27, 4.4, 1.6, C.woodL, 0.8);
      A('banner', 13.5, -32.4, { len: 9, h: 3, col: o.enemy ? BLOOD : C.green, tail: 1 });
      campfire(g, A, 2, 14, 0.9);
      // spears and a drying rack
      beam(g, -19, 13, -17, 1, 0.7, BONE);
      beam(g, -21, 12, -20.4, 2, 0.7, BONE);
      return { shadow: [0, 7, 20, 8] };
    })
  );

  BuildingArt.register(
    'academy_bard',
    at(22, (g, o, A) => {
      drum(g, -4, 5, 12.6, 9, { crenel: false, wall: C.canvas, tex: null, open: true, door: 4.4 });
      cone(g, -4, -4, 14, 15, { roof: C.purple, stripes: BONE, squash: 0.56 });
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.06 + (i / 8) * 0.88);
        const x = -4 + Math.cos(a) * 14;
        const y = -4 + Math.sin(a) * 7.84;
        poly(g, [x - 1.6, y, x + 1.6, y, x, y + 2.6], i % 2 ? C.purple : BONE, 0.6);
      }
      // stage
      block(g, 7, 9, 13, 6, 3, { wall: C.wood, top: C.woodL, tex: 'plankH' });
      emblem(g, 'lute', 13.4, 5, 1.05, C.gold);
      // bunting from the peak to a pole
      pole(g, 20, 4, 15);
      line(g, -4, -19, 20, -10.6, 0.6);
      for (let i = 1; i < 7; i++) {
        const x = -4 + i * 3.4;
        const y = -19 + i * 1.2;
        poly(g, [x - 1.1, y, x + 1.1, y + 0.4, x, y + 2.8], [BLOOD, BONE, C.gold][i % 3], 0.5);
      }
      pole(g, -4, -19, 5);
      A('banner', -3.5, -23.4, { len: 5.4, h: 3.2, col: C.gold, tail: 1 });
      torch(g, A, -16, 12, 6, { s: 0.5 });
      return { shadow: [0, 7, 20, 8] };
    })
  );

  BuildingArt.register(
    'academy_ballista',
    at(24, (g, o, A) => {
      hip(g, -22, -14, 12, 8, 7, 4, Object.assign({}, slate, { wall: C.wood, tex: 'wood' }));
      drum(g, 0, 6, 16.4, 4.4, { crenel: false, squash: 0.58, top: C.stoneL });
      ell(g, 0, 1.6, 11.6, 6.6, null, 0.7);
      // bolt rack
      beam(g, 14, -6, 22, -6, 1);
      line(g, 14, -1, 14, -8, 1.2);
      line(g, 22, -1, 22, -8, 1.2);
      for (let i = 0; i < 4; i++) {
        beam(g, 15.4 + i * 1.8, -2, 16.6 + i * 1.8, -14, 0.6, BONE);
        poly(g, [15.8 + i * 1.8, -13.4, 16.8 + i * 1.8, -16.4, 17.6 + i * 1.8, -13.2], C.iron, 0.5);
      }
      // winch and spare bolts
      ell(g, -15, 12.4, 2.4, 2.4, C.woodD, 0.9);
      line(g, -15, 12.4, -11.6, 9.6, 0.9);
      A('ballista', 0, 0.6, { s: 1.35 });
      flag(g, A, o, -16, -21, 8);
      torch(g, A, 19, 11, 6, { s: 0.5 });
      return { shadow: [0, 8, 21, 8] };
    })
  );

  BuildingArt.register(
    'academy_pikeman',
    at(22, (g, o, A) => {
      hip(g, -20, -13, 14, 9, 8, 4.4, {
        wall: C.stone,
        tex: 'stone',
        roof: C.blue,
        roofD: C.blueD,
        rtex: 'slate',
        door: 3,
      });
      // two racks of pikes: the comb of points is the silhouette
      for (const [bx, by, n] of [
        [-3, 1, 7],
        [3, 9, 7],
      ]) {
        beam(g, bx - 1, by - 3.4, bx + n * 2.5, by - 3.4, 1);
        line(g, bx - 1, by, bx - 1, by - 4.4, 1.3);
        line(g, bx + n * 2.5, by, bx + n * 2.5, by - 4.4, 1.3);
        for (let i = 0; i < n; i++) {
          const x = bx + 0.6 + i * 2.5;
          beam(g, x, by, x + 1.6, by - 25, 0.6, C.woodL);
          poly(g, [x + 0.8, by - 24.6, x + 1.8, by - 28.6, x + 2.6, by - 24.4], BONE, 0.6);
        }
      }
      fence(g, -20, 14.6, 0, 14.6, 2.6);
      flag(g, A, o, -13, -22, 8);
      torch(g, A, -19, 6, 6, { s: 0.5 });
      return { shadow: [0, 7, 21, 8] };
    })
  );

  BuildingArt.register(
    'academy_general',
    at(26, (g, o, A) => {
      tent(g, -17.4, 3, 12, 10, 8, { ropes: false });
      tent(g, 17.4, 3, 12, 10, 8, { ropes: false });
      poly(g, [-3.4, 9, 3.4, 9, 5.6, 19, -5.6, 19], BLOOD, 0.9);
      drum(g, 0, 6, 12.6, 8, { crenel: false, wall: C.canvas, tex: null, open: true, door: 5.4 });
      cone(g, 0, -2, 14.6, 19, { roof: BLOOD, stripes: C.gold, squash: 0.56 });
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.06 + (i / 8) * 0.88);
        const x = Math.cos(a) * 14.6;
        const y = -2 + Math.sin(a) * 8.2;
        poly(g, [x - 1.7, y, x + 1.7, y, x, y + 2.8], i % 2 ? BLOOD : C.gold, 0.6);
      }
      emblem(g, 'crown', 0, -23.6, 1, C.gold);
      // war table
      rect(g, 8.4, 14, 9, 4, C.wood, 0.9);
      rect(g, 9.4, 13, 7, 3.4, BONE, 0.7);
      line(g, 11, 14, 14.6, 15.4, 0.6, BLOOD);
      flag(g, A, o, -23, 13, 26, { len: 8, h: 6, tail: 1 });
      flag(g, A, o, 23, 13, 26, { len: -8, h: 6, tail: 1 });
      torch(g, A, -9, 15, 7);
      return { shadow: [0, 8, 24, 9] };
    })
  );

  // ============================================================== settlements
  const HOUSE_STYLES = {
    thatch: [
      { wall: C.canvasD, tex: null, roof: C.thatch, roofD: C.thatchD, rtex: 'thatch' },
      { wall: C.wood, tex: 'wood', roof: C.thatch, roofD: C.thatchD, rtex: 'thatch' },
    ],
    mixed: [
      { wall: C.canvasD, tex: null, roof: C.thatch, roofD: C.thatchD, rtex: 'thatch' },
      { wall: C.stoneL, tex: 'stone', roof: C.tile, roofD: C.tileD, rtex: 'shingle' },
      { wall: C.wood, tex: 'wood', roof: C.thatch, roofD: C.thatchD, rtex: 'thatch' },
    ],
    town: [
      { wall: C.stoneL, tex: 'stone', roof: C.tile, roofD: C.tileD, rtex: 'shingle' },
      { wall: C.canvasD, tex: null, roof: C.slate, roofD: C.slateD, rtex: 'slate' },
      { wall: C.stone, tex: 'stone', roof: C.tile, roofD: C.tileD, rtex: 'shingle' },
      { wall: C.canvasD, tex: null, roof: C.tile, roofD: C.tileD, rtex: 'shingle' },
    ],
  };

  /**
   * Scatters small houses inside an ellipse, skipping `holes` ([x, y, rx, ry]), sorted so
   * nearer houses overlap farther ones. Returns the placed houses.
   */
  function houses(g, rnd, spec) {
    const { cx = 0, cy = 0, rx, ry, sx, sy, style, holes = [] } = spec;
    const list = [];
    let row = 0;
    for (let y = -ry; y <= ry; y += sy, row++) {
      for (let x = -rx + (row % 2) * sx * 0.5; x <= rx; x += sx) {
        const px = x + (rnd() - 0.5) * sx * 0.3;
        const py = y + (rnd() - 0.5) * sy * 0.3;
        const k = (px * px) / (rx * rx) + (py * py) / (ry * ry);
        if (k > 0.86) continue;
        let skip = false;
        for (const h of holes) {
          const hx = (px - h[0]) / h[2];
          const hy = (py - h[1]) / h[3];
          if (hx * hx + hy * hy < 1) skip = true;
        }
        if (skip) continue;
        list.push({
          x: cx + px,
          y: cy + py,
          ns: rnd() < 0.45,
          w: 8.4 + rnd() * 3,
          d: 5.6 + rnd() * 2,
          pick: rnd(),
        });
      }
    }
    list.sort((a, b) => a.y - b.y);
    const pal = HOUSE_STYLES[style];
    for (const h of list) {
      const st = pal[Math.floor(h.pick * pal.length)];
      const o = Object.assign({ ov: 1.2, door: 1.8 }, st);
      if (h.ns) gableNS(g, h.x - h.d * 0.75, h.y - h.w * 0.36, h.d * 1.5, h.w * 0.72, 5.4, 4, o);
      else gableEW(g, h.x - h.w / 2, h.y - h.d / 2, h.w, h.d, 5.4, 3.6, o);
    }
    return list;
  }

  function fieldStrip(g, pts, col) {
    poly(g, pts, col, 0.9);
    hatch(g, pts, 2.4, 0.2, 0.6, 0.6);
  }

  function chapel(g, x, y, s = 1) {
    gableNS(
      g,
      x - 5 * s,
      y - 6 * s,
      10 * s,
      13 * s,
      8 * s,
      6 * s,
      Object.assign({ door: 2.6 * s, eye: 1.2 * s }, slate)
    );
    block(g, x - 2.4 * s, y - 9 * s, 4.8 * s, 4 * s, 15 * s, { tex: 'stone' });
    hip(
      g,
      x - 2.6 * s,
      y - 9 * s,
      5.2 * s,
      4 * s,
      15 * s,
      7 * s,
      Object.assign({ noWall: true, ov: 1 }, slate)
    );
    emblem(g, 'cross', x, y - 30.4 * s, 0.5 * s, BONE);
  }

  function windmill(g, A, x, y) {
    poly(g, [x - 5, y, x - 3.4, y - 17, x + 3.4, y - 17, x + 5, y], C.stoneL);
    K.tex(g, [x - 5, y, x - 3.4, y - 17, x + 3.4, y - 17, x + 5, y], 'stone', 6);
    hatch(g, [x + 1, y - 17, x + 3.4, y - 17, x + 5, y, x + 1.6, y], 2, 0.6, 0.55);
    door(g, x, y, 2.6, 4);
    cone(g, x, y - 17, 4.6, 6, { roof: C.woodD });
    A('sails', x, y - 17.4, { s: 1.15 });
  }

  function settlementFlag(g, A, o, x, y, hgt) {
    flag(g, A, o, x, y, hgt, { len: 9, h: 6, tail: 1 });
  }

  BuildingArt.register('hamlet', (g, r, o, fx) => {
    const rnd = mulberry(11);
    const A = (k, x, y, e) => fx(k, x, y, e);
    ell(g, 0, 4, 47, 27, 'rgba(69,54,44,0.55)', 0);
    fieldStrip(g, [22, 12, 46, 6, 48, 16, 28, 25], C.greenD);
    fieldStrip(g, [-48, 8, -28, 14, -32, 25, -47, 18], C.thatchD);
    stroke(g, [-4, 30, -2, 18, 2, 8, 0, 0], 3.4, 'rgba(120,98,70,0.6)');
    fence(g, -40, -12, -18, -22);
    fence(g, 18, -22, 40, -12);
    const list = houses(g, rnd, {
      rx: 40,
      ry: 19,
      sx: 21,
      sy: 14,
      style: 'thatch',
      holes: [[0, 4, 9, 7]],
    });
    well(g, 0, 6, 1.1);
    hay(g, -12, 20, 1.2);
    hay(g, -17, 22, 1);
    fence(g, -30, 27, -8, 30);
    fence(g, 8, 30, 30, 27);
    settlementFlag(g, A, o, 9, 6, 16);
    if (list[1]) A('smoke', list[1].x + 2, list[1].y - 12, { s: 1 });
    A('light', 0, 0, { r: 60 });
    return { shadow: [0, 8, 46, 22] };
  });

  BuildingArt.register('village', (g, r, o, fx) => {
    const rnd = mulberry(23);
    const A = (k, x, y, e) => fx(k, x, y, e);
    ell(g, 0, 4, 55, 31, 'rgba(69,54,44,0.55)', 0);
    fieldStrip(g, [30, 16, 54, 8, 55, 18, 36, 29], C.greenD);
    fieldStrip(g, [-55, 6, -36, 15, -38, 28, -54, 18], C.thatchD);
    stroke(g, [-3, 34, -1, 20, 2, 8, 0, -2], 3.8, 'rgba(120,98,70,0.6)');
    chapel(g, 0, -17, 1);
    const list = houses(g, rnd, {
      rx: 47,
      ry: 23,
      sx: 16.5,
      sy: 12,
      style: 'mixed',
      holes: [
        [0, 5, 9, 7],
        [0, -20, 9, 8],
        [41, -8, 9, 10],
      ],
    });
    windmill(g, A, 41, -2);
    well(g, 0, 7, 1.1);
    fence(g, -40, 26, -8, 33);
    fence(g, 8, 33, 40, 26);
    settlementFlag(g, A, o, 10, 8, 17);
    if (list[2]) A('smoke', list[2].x + 2, list[2].y - 12, { s: 1 });
    if (list[6]) A('smoke', list[6].x - 2, list[6].y - 12, { s: 0.9 });
    A('light', 0, 0, { r: 68 });
    return { shadow: [0, 8, 54, 26] };
  });

  BuildingArt.register('town', (g, r, o, fx) => {
    const rnd = mulberry(37);
    const A = (k, x, y, e) => fx(k, x, y, e);
    ell(g, 0, 4, 62, 36, 'rgba(69,54,44,0.6)', 0);
    palisadeRing(g, 0, 3, 62, 35, 'back', { h: 7 });
    chapel(g, 0, -20, 1.35);
    const list = houses(g, rnd, {
      rx: 54,
      ry: 28,
      sx: 14.5,
      sy: 10.6,
      style: 'town',
      holes: [
        [0, 6, 12, 7],
        [0, -24, 11, 10],
      ],
    });
    // market square
    ell(g, 0, 7, 10, 5.4, 'rgba(160,140,104,0.55)', 0.7);
    well(g, 0, 8, 1);
    ringWall(g, 0, 3, 62, 35, Math.PI * 0.08, Math.PI * 0.42, 6);
    ringWall(g, 0, 3, 62, 35, Math.PI * 0.58, Math.PI * 0.92, 6);
    for (const a of [0.42, 0.58]) {
      const x = Math.cos(Math.PI * a) * 62;
      const y = 3 + Math.sin(Math.PI * a) * 35;
      drum(g, x, y + 1, 4.4, 11, { slit: 1 });
    }
    settlementFlag(g, A, o, 11, 9, 18);
    for (const i of [1, 5, 9]) if (list[i]) A('smoke', list[i].x + 2, list[i].y - 12, { s: 1 });
    A('torch', -9.6, 38, { s: 0.6, r: 46 });
    A('torch', 9.6, 38, { s: 0.6, r: 46 });
    A('light', 0, 0, { r: 76 });
    return { shadow: [0, 9, 62, 31] };
  });

  function ringTowers(g, cx, cy, rx, ry, angles, hgt, roof) {
    for (const a of angles) {
      const x = cx + Math.cos(Math.PI * a) * rx;
      const y = cy + Math.sin(Math.PI * a) * ry;
      drum(g, x, y + 1, 4.6, hgt, { slit: 1, crenel: !roof, open: !!roof });
      if (roof) cone(g, x, y + 1 - hgt, 5.6, 8, { roof });
    }
  }

  BuildingArt.register('city', (g, r, o, fx) => {
    const rnd = mulberry(53);
    const A = (k, x, y, e) => fx(k, x, y, e);
    ell(g, 0, 3, 70, 40, 'rgba(69,54,44,0.7)', 0);
    ringWall(g, 0, 3, 70, 40, Math.PI, TAU, 8);
    ringTowers(g, 0, 3, 70, 40, [1.18, 1.5, 1.82], 15, C.slate);
    // cathedral: nave with twin towers
    gableNS(g, -7, -30, 14, 20, 12, 8, Object.assign({ door: 4, eye: 2 }, slate));
    for (const sx of [-9.4, 9.4]) {
      drum(g, sx, -9, 3.6, 20, { crenel: false, open: true, slit: 1 });
      cone(g, sx, -29, 4.4, 12, { roof: C.slateD });
    }
    const list = houses(g, rnd, {
      rx: 62,
      ry: 32,
      sx: 13,
      sy: 9.6,
      style: 'town',
      holes: [
        [0, 5, 12, 7],
        [0, -24, 15, 13],
      ],
    });
    ell(g, 0, 6, 10, 5.4, 'rgba(160,140,104,0.55)', 0.7);
    well(g, 0, 7, 1);
    ringWall(g, 0, 3, 70, 40, 0, Math.PI * 0.45, 8);
    ringWall(g, 0, 3, 70, 40, Math.PI * 0.55, Math.PI, 8);
    ringTowers(g, 0, 3, 70, 40, [0.02, 0.24, 0.76, 0.98], 15, C.slate);
    // gatehouse
    keepBlock(g, -9, 37, 18, 8, 16, { door: 7, slits: 2 });
    settlementFlag(g, A, o, 0, 23, 12);
    for (const i of [2, 7, 12, 16])
      if (list[i]) A('smoke', list[i].x + 2, list[i].y - 12, { s: 1 });
    A('torch', -12, 44, { s: 0.6, r: 50 });
    A('torch', 12, 44, { s: 0.6, r: 50 });
    A('light', -30, 0, { r: 56 });
    A('light', 30, 0, { r: 56 });
    return { shadow: [0, 9, 72, 38] };
  });

  BuildingArt.register('metropolis', (g, r, o, fx) => {
    const rnd = mulberry(71);
    const A = (k, x, y, e) => fx(k, x, y, e);
    ell(g, 0, 3, 80, 47, 'rgba(69,54,44,0.75)', 0);
    ringWall(g, 0, 3, 80, 47, Math.PI, TAU, 9);
    ringTowers(g, 0, 3, 80, 47, [1.1, 1.3, 1.5, 1.7, 1.9], 17, C.tile);
    // citadel on its mound
    ell(g, 0, -15, 27, 14, C.dirt, 1);
    hatch(g, [-27, -15, 27, -15, 27, -1, -27, -1], 2.6, 0.8, 0.4);
    ringWall(g, 0, -17, 23, 11, Math.PI, TAU, 7);
    drum(g, -13, -20, 4, 24, { slit: 1 });
    drum(g, 13, -20, 4, 24, { slit: 1 });
    keepBlock(g, -11, -26, 22, 12, 27, { slits: 3, door: 4 });
    rect(g, -11, -35.6, 22, 2.4, BLOOD, 0.7);
    ringWall(g, 0, -17, 23, 11, 0, Math.PI, 7);
    // cathedral west, domed hall east
    gableNS(g, -45, -22, 13, 18, 12, 8, Object.assign({ door: 3.6, eye: 1.8 }, slate));
    drum(g, -38.5, -20, 3.4, 22, { crenel: false, open: true });
    cone(g, -38.5, -42, 4.2, 13, { roof: C.slateD });
    drum(g, 40, -8, 9, 9, { crenel: false, open: true, door: 3.4 });
    dome(g, 40, -17, 9, 5.4, 10, C.gold);
    const list = houses(g, rnd, {
      rx: 72,
      ry: 39,
      sx: 12.4,
      sy: 9.2,
      style: 'town',
      holes: [
        [0, -16, 30, 20],
        [-40, -12, 10, 10],
        [40, -8, 11, 9],
        [0, 14, 11, 6],
      ],
    });
    ell(g, 0, 14, 10, 5, 'rgba(160,140,104,0.55)', 0.7);
    well(g, 0, 15, 1);
    ringWall(g, 0, 3, 80, 47, 0, Math.PI * 0.455, 9);
    ringWall(g, 0, 3, 80, 47, Math.PI * 0.545, Math.PI, 9);
    ringTowers(g, 0, 3, 80, 47, [0.02, 0.17, 0.33, 0.67, 0.83, 0.98], 17, C.tile);
    keepBlock(g, -11, 43, 22, 9, 19, { door: 8, slits: 2 });
    drum(g, -13, 52, 4.6, 21, { slit: 1 });
    drum(g, 13, 52, 4.6, 21, { slit: 1 });
    flag(g, A, o, 0, -53, 13, { len: 11, h: 7, tail: 1 });
    settlementFlag(g, A, o, 0, 28, 12);
    for (const i of [3, 8, 14, 20, 26])
      if (list[i]) A('smoke', list[i].x + 2, list[i].y - 12, { s: 1 });
    A('torch', -18, 55, { s: 0.6, r: 54 });
    A('torch', 18, 55, { s: 0.6, r: 54 });
    A('light', -40, 0, { r: 62 });
    A('light', 40, 0, { r: 62 });
    A('light', 0, -20, { r: 62 });
    return { shadow: [0, 10, 82, 45] };
  });

  // ============================================================ enemy holdings
  function bloodFlag(g, A, x, y, hgt, e) {
    pole(g, x, y, hgt);
    A(
      'banner',
      x + 0.5,
      y - hgt + 0.8,
      Object.assign({ len: 7, h: 5, col: BLOOD, mark: INK, tail: 1 }, e)
    );
  }

  BuildingArt.register('enemy_hamlet', (g, r, o, fx) => {
    const A = (k, x, y, e) => fx(k, x, y, e);
    ell(g, 0, 4, 47, 27, 'rgba(30,20,22,0.6)', 0);
    palisadeRing(g, 0, 4, 47, 27, 'back', { h: 9, fill: C.hideD, fill2: C.woodDD, gap2: 4.2 });
    const tents = [
      [-27, -6, 9, 13],
      [-9, -13, 10, 15],
      [13, -12, 9, 13],
      [30, -3, 9.4, 14],
      [-22, 14, 9, 13],
      [22, 15, 10, 14],
    ];
    tents.sort((a, b) => a[1] - b[1]);
    for (const [x, y, rr, rise] of tents.filter((t) => t[1] < 4)) {
      hideTent(g, x, y, rr, rise, {
        roof: x % 2 ? C.hide : C.hideD,
        stripes: 'rgba(160,16,24,0.5)',
      });
    }
    // bonfire
    ell(g, 0, 6, 7, 3.6, C.dark, 1);
    beam(g, -5, 7, 4, 3.6, 1.2, C.woodD);
    beam(g, 5, 7, -4, 3.6, 1.2, C.woodD);
    A('torch', 0, 6, { s: 1.5, r: 70 });
    totem(g, -12, 9, 13);
    totem(g, 12, 9, 13);
    skull(g, -3, 13, 0.8);
    skull(g, 4, 14, 0.7);
    for (const [x, y, rr, rise] of tents.filter((t) => t[1] >= 4)) {
      hideTent(g, x, y, rr, rise, { roof: C.hide, stripes: 'rgba(160,16,24,0.5)' });
    }
    palisadeRing(g, 0, 4, 47, 27, 'front', {
      h: 9,
      fill: C.hideD,
      fill2: C.woodDD,
      gap2: 4.2,
      gate: 0.3,
    });
    bloodFlag(g, A, -42, 6, 22, { len: 9, h: 6 });
    bloodFlag(g, A, 42, 6, 22, { len: -9, h: 6 });
    return { shadow: [0, 9, 49, 25] };
  });

  BuildingArt.register(
    'enemy_merchant_guild',
    at(48, (g, o, A) => {
      gableNS(g, -16, -12, 32, 28, 13, 12, {
        wall: C.ewall,
        tex: 'wood',
        roof: C.hideD,
        roofD: C.eroof,
        rtex: 'thatch',
        door: 7,
        ov: 2.6,
      });
      for (let i = 0; i < 4; i++) {
        beam(g, -18.6, -22 + i * 7, -22, -26 + i * 7, 1, BONE);
        beam(g, 18.6, -22 + i * 7, 22, -26 + i * 7, 1, BONE);
      }
      // crossed horn beams over the gable
      beam(g, -11, 4, 6, -16, 1.6, BONE);
      beam(g, 11, 4, -6, -16, 1.6, BONE);
      skull(g, 0, 0, 1.7);
      horns(g, 0, -2, 1.5);
      // plunder
      crate(g, -27, 16, 1.3);
      crate(g, -33, 19, 1.1);
      sack(g, -22, 21, 1.3);
      ell(g, 26, 19, 7, 3.4, C.gold, 0.9);
      ell(g, 26, 17, 4.4, 2.4, C.gold, 0.8);
      barrel(g, 34, 18, 1.2, C.woodDD);
      // cage
      rect(g, 22, -8, 13, 10, C.dark, 1.1);
      for (let i = 1; i < 6; i++) line(g, 22 + i * 2.2, -8, 22 + i * 2.2, 2, 0.8, C.iron);
      totem(g, -36, 4, 15);
      bloodFlag(g, A, -22, 2, 24, { len: 9, h: 6 });
      bloodFlag(g, A, 40, 8, 20, { len: -8, h: 6 });
      A('torch', -8, 20, { s: 0.8, r: 44 });
      A('torch', 8, 20, { s: 0.8, r: 44 });
      ell(g, -8, 21, 2.4, 1.2, C.ironD, 0.8);
      ell(g, 8, 21, 2.4, 1.2, C.ironD, 0.8);
      return { shadow: [0, 12, 42, 14] };
    })
  );

  BuildingArt.register(
    'enemy_shadow_academy',
    at(38, (g, o, A) => {
      ell(g, 0, 8, 30, 15, 'rgba(64,49,83,0.55)', 1);
      ell(g, 0, 8, 22, 11, null, 0.7);
      const shard = (x, y, w, h, lean) => {
        const p = [
          x - w / 2,
          y,
          x + lean * 0.4,
          y - h * 0.7,
          x + lean,
          y - h,
          x + w / 2 + lean * 0.3,
          y - h * 0.5,
          x + w / 2,
          y,
        ];
        poly(g, p, C.ewallD);
        hatch(
          g,
          [x, y, x + lean, y - h, x + w / 2 + lean * 0.3, y - h * 0.5, x + w / 2, y],
          1.8,
          0.6,
          0.7
        );
      };
      shard(-24, 2, 6, 17, 4);
      shard(24, 2, 6, 17, -4);
      shard(-12, -3, 5, 13, 2);
      shard(12, -3, 5, 13, -2);
      // twisted spire: three leaning tiers
      drum(g, 0, 8, 11, 12, {
        wall: C.ewall,
        top: C.ewallD,
        crenel: false,
        tex: 'stone',
        door: 4.4,
      });
      drum(g, 1.4, -5, 8, 12, {
        wall: C.ewall,
        top: C.ewallD,
        crenel: false,
        tex: 'stone',
        slit: 1,
      });
      drum(g, -0.6, -17, 5.6, 11, {
        wall: C.ewall,
        top: C.ewallD,
        crenel: false,
        tex: 'stone',
        open: true,
      });
      poly(g, [-6.4, -28, 2.4, -53, 5.4, -28], C.eroof);
      hatch(g, [0, -28, 2.4, -53, 5.4, -28], 1.8, 0.4, 0.7);
      for (const dx of [-7.4, 6.4])
        poly(g, [dx - 1.6, -27, dx + (dx < 0 ? -2 : 2), -37, dx + 1.6, -27], C.eroof, 1);
      emblem(g, 'eye', 0, -22, 1, '#b48ae0');
      A('glow', 0, -22, { r: 3.4, col: '#a66ad8' });
      shard(-17, 15, 6, 15, 3);
      shard(17, 15, 6, 15, -3);
      skull(g, -6, 19, 0.8);
      skull(g, 7, 20, 0.7);
      return { shadow: [0, 10, 32, 13] };
    })
  );

  BuildingArt.register(
    'enemy_war_academy',
    at(42, (g, o, A) => {
      ell(g, 0, 4, 35, 20, '#5a4a3a', 0);
      g.globalAlpha = 0.6;
      ell(g, -8, 2, 9, 4, BLOOD, 0);
      ell(g, 12, 9, 6, 2.6, BLOOD, 0);
      g.globalAlpha = 1;
      palisadeRing(g, 0, 4, 36, 21, 'back', { h: 11, fill: C.hideD, fill2: C.woodDD, gap2: 3.2 });
      // war drum and weapon rack
      drum(g, -16, 2, 5.4, 6, { wall: C.hideD, top: C.canvasD, crenel: false, tex: null });
      beam(g, 8, -4, 22, -4, 1.1);
      line(g, 8, 1, 8, -6, 1.3);
      line(g, 22, 1, 22, -6, 1.3);
      for (let i = 0; i < 5; i++) {
        beam(g, 10 + i * 2.6, 0, 11 + i * 2.6, -15, 0.7, C.woodD);
        poly(g, [10 + i * 2.6, -14, 11 + i * 2.6, -19, 12.4 + i * 2.6, -14], C.iron, 0.6);
      }
      dummy(g, 0, 8, 1.3);
      palisadeRing(g, 0, 4, 36, 21, 'front', {
        h: 11,
        fill: C.hideD,
        fill2: C.woodDD,
        gap2: 3.2,
        gate: 0.34,
      });
      // tusk gate with a great skull
      for (const sx of [-1, 1]) {
        const tusk = [sx * 9, 28, sx * 10, 18, sx * 13, 9, sx * 19, 2];
        stroke(g, tusk, 4.6);
        stroke(g, tusk, 2.8, BONE);
      }
      beam(g, -11, 12, 11, 12, 1.6, C.woodD);
      skull(g, 0, 14.4, 1.7);
      horns(g, 0, 12, 1.5);
      bloodFlag(g, A, -34, 6, 26, { len: 9, h: 6 });
      bloodFlag(g, A, 34, 6, 26, { len: -9, h: 6 });
      bloodFlag(g, A, 0, -17, 16, { len: 9, h: 6 });
      A('torch', -15, 27, { s: 0.9, r: 46 });
      A('torch', 15, 27, { s: 0.9, r: 46 });
      ell(g, -15, 28, 2.6, 1.3, C.ironD, 0.8);
      ell(g, 15, 28, 2.6, 1.3, C.ironD, 0.8);
      return { shadow: [0, 9, 39, 20] };
    })
  );

  // ===================================================================== special
  BuildingArt.register(
    'wwe_academy',
    at(62, (g, o, A) => {
      const sq = 31 / 54;
      drum(g, 0, 6, 54, 16, { squash: sq, crenel: false, open: true });
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * (0.1 + (i / 12) * 0.8);
        const x = Math.cos(a) * 53;
        const y = 6 + Math.sin(a) * 30.4;
        if (i === 6) continue;
        door(g, x, y, 4.4, 8);
      }
      door(g, 0, 36.4, 9, 13);
      ell(g, 0, -10, 54, 31, C.stoneL);
      ell(g, 0, -9.4, 47, 26.6, C.stone, 1);
      ell(g, 0, -8.6, 40, 22.4, C.stoneD, 1);
      ell(g, 0, -7.6, 33, 18.4, C.stone, 1);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.26;
        line(
          g,
          Math.cos(a) * 33,
          -7.6 + Math.sin(a) * 18.4,
          Math.cos(a) * 53,
          -10 + Math.sin(a) * 30.4,
          0.7
        );
      }
      ell(g, 0, -6, 26, 14, '#b8a676');
      hatch(g, [4, -20, 26, -20, 26, 8, 10, 8], 2.6, 0.7, 0.35);
      g.globalAlpha = 0.7;
      ell(g, -7, -4, 6, 2.4, BLOOD, 0);
      ell(g, 9, -9, 3.4, 1.4, BLOOD, 0);
      g.globalAlpha = 1;
      emblem(g, 'sword', -2, -8, 1.1, C.stoneL);
      for (const a of [1.12, 1.38, 1.62, 1.88]) {
        const x = Math.cos(Math.PI * a) * 52;
        const y = -10 + Math.sin(Math.PI * a) * 30;
        pole(g, x, y, 12);
        A('banner', x + 0.5, y - 11.2, {
          len: 8,
          h: 5.4,
          col: a > 1.3 && a < 1.7 ? C.gold : BLOOD,
          tail: 1,
        });
      }
      A('torch', -9, 26, { s: 0.8, r: 50 });
      A('torch', 9, 26, { s: 0.8, r: 50 });
      A('light', 0, -6, { r: 60 });
      return { shadow: [0, 10, 58, 30] };
    })
  );

  /** Void Residue Barracks: a bunker with vats of glowing residue and a ring pad. */
  BuildingArt.register(
    'element_barracks',
    at(52, (g, o, A) => {
      ell(g, -8, 24, 16, 8, C.slateD);
      ell(g, -8, 24, 11, 5.4, null, 0.8);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        line(
          g,
          -8 + Math.cos(a) * 11,
          24 + Math.sin(a) * 5.4,
          -8 + Math.cos(a) * 15,
          24 + Math.sin(a) * 7.4,
          0.8
        );
      }
      block(g, -40, -16, 42, 20, 13, { wall: C.stoneD, top: C.slate, slits: 5, door: 6 });
      for (let i = 0; i < 3; i++) rect(g, -34 + i * 12, -24, 6, 4, C.slateD, 0.9);
      // pipes to the vats
      for (const [x1, y1, x2, y2] of [
        [2, -4, 16, -8],
        [2, 0, 28, 8],
      ]) {
        line(g, x1, y1, x2, y2, 4, INK);
        line(g, x1, y1, x2, y2, 2.2, C.iron);
      }
      drum(g, 23, -4, 10, 15, { crenel: false, wall: C.iron, tex: null, top: '#3e5a3c' });
      drum(g, 35, 12, 8, 11, { crenel: false, wall: C.iron, tex: null, top: '#3e5a3c' });
      line(g, 13, -10, 33, -10, 0.8);
      line(g, 27, 6, 43, 6, 0.8);
      A('glow', 23, -19, { r: 4.4, col: '#8fd08a' });
      A('glow', 35, 1, { r: 3.4, col: '#8fd08a' });
      A('glow', -8, 22, { r: 2.6, col: '#8fd08a', bob: 2 });
      crate(g, -34, 12, 1.4);
      crate(g, -27, 14, 1.2);
      flag(g, A, o, -40, -29, 12, { len: 9, h: 6 });
      torch(g, A, -26, 5, 8);
      return { shadow: [0, 10, 48, 18] };
    })
  );

  /** First Circle Shrine: nine standing stones round an altar. */
  BuildingArt.register(
    'primis_shrine',
    at(50, (g, o, A) => {
      ell(g, 0, 6, 42, 23, C.dirt, 1);
      K.hatchEll(g, 0, 6, 42, 23, 3.2, 0.9, 0.3);
      ell(g, 0, 6, 31, 17, null, 0.9);
      ell(g, 0, 6, 29, 15.8, null, 0.5);
      const stones = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.35;
        stones.push([Math.cos(a) * 37, 6 + Math.sin(a) * 20, 13 + ((i * 7) % 5)]);
      }
      stones.sort((p, q) => p[1] - q[1]);
      const stone = ([x, y, h]) => {
        const p = [x - 3.4, y, x - 2.6, y - h + 2, x + 0.6, y - h, x + 3, y - h + 3, x + 3.4, y];
        poly(g, p, C.stone);
        hatch(g, [x + 0.4, y, x + 0.6, y - h, x + 3, y - h + 3, x + 3.4, y], 1.8, 0.6, 0.6);
        stroke(g, [x - 1, y - h * 0.6, x + 0.4, y - h * 0.45, x - 0.6, y - h * 0.3], 0.6);
      };
      const back = stones.filter((s) => s[1] < 6);
      back.forEach(stone);
      // lintel across the two rearmost stones
      if (back.length >= 2) {
        const [a, b] = back[0][0] < back[1][0] ? [back[0], back[1]] : [back[1], back[0]];
        poly(
          g,
          [
            a[0] - 4,
            a[1] - a[2] - 1,
            b[0] + 4,
            b[1] - b[2] - 1,
            b[0] + 4,
            b[1] - b[2] + 3,
            a[0] - 4,
            a[1] - a[2] + 3,
          ],
          C.stoneL
        );
      }
      block(g, -8, 1, 16, 9, 6, { wall: C.stoneD, top: C.stoneL });
      ell(g, 0, -1, 4, 2, C.dark, 0.9);
      stroke(g, [0, 10, -3, 14, 3, 18, 0, 22], 1.1, BLOOD);
      A('torch', 0, -1, { s: 1, r: 60 });
      stones.filter((s) => s[1] >= 6).forEach(stone);
      return { shadow: [0, 9, 44, 21] };
    })
  );

  /** Orbital Vanguard Academy: a landing pad with a drop capsule and a signal mast. */
  BuildingArt.register(
    'spartan_academy',
    at(54, (g, o, A) => {
      block(g, -46, -20, 30, 16, 12, { wall: C.stone, top: C.slateD, slits: 4, door: 5 });
      rect(g, -42, -29, 10, 5, C.slate, 0.9);
      beam(g, -24, -24, -24, -62, 1.6, C.iron);
      line(g, -24, -56, -38, -26, 0.6);
      line(g, -24, -56, -14, -24, 0.6);
      ell(g, -19, -52, 6, 6, C.stoneL, 1.1);
      ell(g, -19, -52, 2, 2, C.dark, 0);
      line(g, -19, -52, -24, -48, 1);
      A('glow', -24, -63, { r: 1.6, col: '#e06a5a' });
      const hex = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        hex.push(12 + Math.cos(a) * 31, 12 + Math.sin(a) * 17);
      }
      poly(g, hex, C.slate);
      hatch(g, hex, 3.4, 0.9, 0.3);
      const inner = hex.map((v, i) => (i % 2 ? 12 + (v - 12) * 0.74 : 12 + (v - 12) * 0.74));
      poly(g, inner, null, 0.9);
      for (let i = 0; i < 6; i++)
        rect(g, hex[i * 2] - 1.4, hex[i * 2 + 1] - 1.4, 2.8, 2.8, BONE, 0.7);
      // capsule
      for (const sx of [-1, 1])
        poly(g, [12 + sx * 6, 8, 12 + sx * 12, 16, 12 + sx * 5, 13], C.iron, 1);
      g.beginPath();
      g.moveTo(5, 13);
      g.lineTo(5, -6);
      g.quadraticCurveTo(12, -22, 19, -6);
      g.lineTo(19, 13);
      g.quadraticCurveTo(12, 17, 5, 13);
      g.closePath();
      g.fillStyle = C.stoneL;
      g.fill();
      K.ink(g);
      hatch(g, [13, -18, 19, -6, 19, 14, 14, 15], 2.2, 0.6, 0.55);
      rect(g, 8.4, -4, 7.2, 6, C.dark, 0.9);
      line(g, 5, 6, 19, 6, 0.8);
      line(g, 5, -8, 19, -8, 0.8);
      crate(g, -36, 8, 1.4);
      crate(g, -28, 11, 1.2);
      flag(g, A, o, -44, -32, 11, { len: 9, h: 6 });
      A('light', 12, 12, { r: 56 });
      A('glow', 12, 0, { r: 1.6, col: '#9fc4d8' });
      return { shadow: [0, 12, 50, 19] };
    })
  );

  /** Iron Trench Academy: a bunker under a great cog, with a zigzag trench before it. */
  BuildingArt.register(
    'cog_academy',
    at(52, (g, o, A) => {
      block(g, -26, -20, 52, 17, 12, { wall: C.stoneD, top: C.slate, door: 6, slits: 0 });
      rect(g, -21, -11, 14, 2.2, C.dark, 0.7);
      rect(g, 7, -11, 14, 2.2, C.dark, 0.7);
      emblem(g, 'gear', 0, -24, 2.4, C.stoneL);
      block(g, 18, -22, 5, 5, 22, { wall: C.iron, tex: null, top: C.ironD });
      A('smoke', 20.5, -44, { s: 1.4, dark: 1 });
      const topEdge = [-46, 12, -28, 5, -10, 13, 8, 6, 26, 13, 46, 8];
      const trench = topEdge.slice();
      for (let i = topEdge.length - 2; i >= 0; i -= 2) trench.push(topEdge[i], topEdge[i + 1] + 8);
      poly(g, trench, C.dirtD);
      hatch(g, trench, 2, 0.8, 0.7);
      // sandbags along the lip
      for (let i = 0; i < topEdge.length - 2; i += 2) {
        const [x1, y1, x2, y2] = [topEdge[i], topEdge[i + 1], topEdge[i + 2], topEdge[i + 3]];
        for (let k = 0; k <= 4; k++) {
          const t = k / 4.6;
          ell(g, x1 + (x2 - x1) * t + 2, y1 + (y2 - y1) * t - 1, 2.6, 1.5, C.canvasD, 0.8);
        }
        for (let k = 0; k < 4; k++) {
          const t = (k + 0.5) / 4.6;
          ell(g, x1 + (x2 - x1) * t + 2, y1 + (y2 - y1) * t - 3.2, 2.6, 1.5, C.canvas, 0.8);
        }
      }
      // wire on posts
      for (let x = -44; x <= 44; x += 11) {
        line(g, x, 30, x, 24, 1.2);
        if (x < 44) stroke(g, [x, 25, x + 3.6, 28, x + 7.4, 24.6, x + 11, 25], 0.6);
      }
      flag(g, A, o, -26, -32, 11, { len: 9, h: 6 });
      torch(g, A, -9, 0, 6);
      torch(g, A, 9, 0, 6);
      return { shadow: [0, 12, 48, 18] };
    })
  );

  /** Ninefold March Camp: nine pale tents round a fire, under green pennons. */
  BuildingArt.register(
    'rivendell_camp',
    at(52, (g, o, A) => {
      ell(g, 0, 6, 44, 24, 'rgba(66,78,50,0.6)', 0);
      const tents = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU - Math.PI / 2 + 0.35;
        if (Math.abs(a - Math.PI / 2) < 0.3) continue;
        tents.push([Math.cos(a) * 34, 6 + Math.sin(a) * 18]);
      }
      tents.push([-13, 25], [13, 25]);
      tents.sort((p, q) => p[1] - q[1]);
      const one = ([x, y]) => {
        tent(g, x, y, 12, 9, 9, { ropes: false });
        line(g, x, y - 13.5, x, y - 18, 0.8);
        poly(g, [x, y - 18, x + 4, y - 16.6, x, y - 15.4], C.green, 0.6);
      };
      tents.filter((t) => t[1] < 8).forEach(one);
      campfire(g, A, 0, 8, 1.5);
      // seats round the fire
      for (const a of [0.3, 1.3, 2.4, 3.6, 4.8]) {
        beam(
          g,
          Math.cos(a) * 9 - 1.6,
          8 + Math.sin(a) * 5,
          Math.cos(a) * 9 + 1.6,
          8 + Math.sin(a) * 5,
          1,
          C.woodD
        );
      }
      tents.filter((t) => t[1] >= 8).forEach(one);
      // arched trellis gate
      for (const sx of [-6, 6]) beam(g, sx, 34, sx, 22, 1.3);
      g.beginPath();
      g.arc(0, 22, 6, Math.PI, 0);
      g.lineWidth = 2.8;
      g.strokeStyle = INK;
      g.stroke();
      g.lineWidth = 1.4;
      g.strokeStyle = C.woodL;
      g.stroke();
      for (const a of [3.4, 3.9, 4.4, 4.9, 5.4, 5.9])
        ell(g, Math.cos(a) * 6, 22 + Math.sin(a) * 6, 1.1, 0.9, C.green, 0.5);
      for (const sx of [-1, 1]) {
        pole(g, sx * 40, 12, 28);
        A('banner', sx * 40 + 0.5, -15.2, {
          len: sx * -9,
          h: 5,
          col: C.green,
          mark: BONE,
          tail: 1,
        });
      }
      return { shadow: [0, 10, 46, 22] };
    })
  );

  /** Iron Pit Dojo: a dark hall behind a roped fighting pit. */
  BuildingArt.register(
    'hanma_dojo',
    at(50, (g, o, A) => {
      hip(g, -27, -26, 54, 16, 12, 7, {
        wall: C.woodD,
        tex: 'wood',
        roof: C.slateD,
        roofD: C.dark,
        rtex: 'slate',
        ridge: 30,
        door: 6,
        ov: 3.4,
      });
      for (const sx of [-1, 1]) stroke(g, [sx * 30.4, -18.6, sx * 34, -22, sx * 34.6, -25], 1.6);
      emblem(g, 'fist', 0, -28, 1.7, BONE);
      const oct = [];
      const inner = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        oct.push(Math.cos(a) * 30, 16 + Math.sin(a) * 15);
        inner.push(Math.cos(a) * 24, 17.4 + Math.sin(a) * 11.6);
      }
      poly(g, oct, C.stone);
      K.tex(g, oct, 'stone', 5);
      poly(g, inner, '#8a7858');
      hatch(g, inner, 2.6, 0.8, 0.45);
      g.globalAlpha = 0.7;
      ell(g, -6, 18, 7, 3, BLOOD, 0);
      ell(g, 8, 22, 3.4, 1.6, BLOOD, 0);
      g.globalAlpha = 1;
      const order = [];
      for (let i = 0; i < 8; i++) order.push([oct[i * 2], oct[i * 2 + 1]]);
      order.sort((p, q) => p[1] - q[1]);
      for (const [x, y] of order) line(g, x, y, x, y - 7, 1.7);
      const rope = [];
      for (let i = 0; i <= 8; i++) rope.push(oct[(i % 8) * 2], oct[(i % 8) * 2 + 1] - 5.6);
      stroke(g, rope, 1.9);
      stroke(g, rope, 0.9, BLOOD);
      dummy(g, -40, 6, 1.4);
      dummy(g, 40, 6, 1.4);
      ell(g, -38, 20, 2.6, 2.6, C.ironD, 0.9);
      ell(g, 38, 20, 2.6, 2.6, C.ironD, 0.9);
      torch(g, A, -22, -1, 7);
      torch(g, A, 22, -1, 7);
      return { shadow: [0, 12, 46, 20] };
    })
  );

  /** Bound Spirit Shrine: a blood-red gate before a small shrine, with spirit lights. */
  BuildingArt.register(
    'stand_arrow_shrine',
    at(54, (g, o, A) => {
      hip(g, -16, -30, 32, 15, 11, 8, {
        wall: C.wood,
        roof: C.slate,
        roofD: C.slateD,
        rtex: 'slate',
        ridge: 14,
        ov: 3.4,
        door: 5.4,
      });
      for (const sx of [-1, 1]) stroke(g, [sx * 19.4, -24, sx * 22.6, -27, sx * 23, -30], 1.5);
      // steps
      for (let i = 0; i < 4; i++)
        rect(g, -8 - i * 1.6, -2 + i * 5, 16 + i * 3.2, 5, i % 2 ? C.stone : C.stoneL, 0.9);
      // lanterns
      for (const sx of [-1, 1]) {
        block(g, sx * 26 - 2, 8, 4, 3, 8, { tex: null });
        rect(g, sx * 26 - 3, -4.6, 6, 4.4, C.stoneL, 0.9);
        poly(g, [sx * 26 - 4.4, -4.4, sx * 26, -8.4, sx * 26 + 4.4, -4.4], C.stoneD, 0.9);
        A('glow', sx * 26, -2.4, { r: 1.8, col: '#e8c46a' });
        A('light', sx * 26, 4, { r: 40 });
      }
      // relic arrow on a plinth
      block(g, 33, 20, 9, 6, 5, { tex: null });
      beam(g, 37.5, 16, 37.5, -6, 1, C.gold);
      poly(g, [35, -5, 37.5, -11, 40, -5], C.gold, 0.9);
      // the gate
      for (const sx of [-1, 1]) {
        line(g, sx * 15, 30, sx * 13.6, 2, 4.6);
        line(g, sx * 15, 30, sx * 13.6, 2, 2.8, BLOOD);
      }
      rect(g, -16, 6.4, 32, 3, BLOOD, 1.1);
      poly(g, [-20, 2, 20, 2, 23, -3.4, -23, -3.4], BLOOD);
      poly(g, [-23, -3.4, 23, -3.4, 24.6, -6, -24.6, -6], C.dark, 1);
      line(g, -13, 12, 13, 12, 0.7);
      for (let i = -2; i <= 2; i++) rect(g, i * 5 - 0.9, 12, 1.8, 3.4, BONE, 0.5);
      A('glow', -34, -12, { r: 3.2, col: '#9fd0d8', bob: 2.4 });
      A('glow', 30, -22, { r: 2.6, col: '#9fd0d8', bob: 2 });
      return { shadow: [0, 14, 44, 17] };
    })
  );

  /** North Star Ascetic Dojo: a three-tiered tower under one great star. */
  BuildingArt.register(
    'north_star_dojo',
    at(51, (g, o, A) => {
      const roof = { roof: C.blueD, roofD: C.slateD, rtex: 'slate' };
      const eaves = (w, y) => {
        for (const sx of [-1, 1])
          stroke(g, [sx * w, y, sx * (w + 3), y - 2.6, sx * (w + 3.4), y - 5], 1.5);
      };
      hip(
        g,
        -20,
        -8,
        40,
        18,
        10,
        4,
        Object.assign({ wall: C.wood, door: 6, ov: 5, ridge: 22 }, roof)
      );
      eaves(25, 5.6);
      hip(
        g,
        -14,
        -6,
        28,
        13,
        21,
        4,
        Object.assign({ wall: C.wood, wallH: 8, ov: 4.4, ridge: 14 }, roof)
      );
      eaves(18.4, -9);
      hip(g, -8.4, -4, 16.8, 9, 31, 7, Object.assign({ wall: C.wood, wallH: 7, ov: 3.6 }, roof));
      eaves(12, -21.4);
      line(g, 0, -37.4, 0, -45, 1.4);
      emblem(g, 'star', 0, -48, 1.25, C.gold);
      A('glow', 0, -48, { r: 1.4, col: '#e8d9a0' });
      // training yard: posts and split stones
      for (const x of [-40, -33, -26]) {
        beam(g, x, 20, x, 8, 2.4, C.woodL);
        line(g, x - 1.6, 12, x + 1.6, 12, 0.7);
      }
      stoneBlocks(g, 32, 20, 1.5);
      stroke(g, [28, 14, 31, 17, 30, 20], 0.8);
      poly(g, [38, 22, 41, 14, 45, 21], C.stone);
      flag(g, A, o, 42, 8, 20, { len: -9, h: 6, tail: 1 });
      torch(g, A, -10, 13, 7);
      torch(g, A, 10, 13, 7);
      return { shadow: [0, 11, 44, 16] };
    })
  );

  /** Skyburst Foundry: a ribbed dome with a glowing forge mouth and two stacks. */
  BuildingArt.register(
    'capsule_corp',
    at(54, (g, o, A) => {
      block(g, 22, -12, 8, 7, 34, { wall: C.tile });
      block(g, 34, -2, 7, 6, 25, { wall: C.tile });
      A('smoke', 26, -47, { s: 1.7, dark: 1 });
      A('smoke', 37.5, -28, { s: 1.3, dark: 1 });
      drum(g, -8, 10, 26, 9, { crenel: false, open: true });
      dome(g, -8, 1, 26, 15.6, 27, C.stoneL);
      ell(g, -8, -24, 3.4, 1.6, C.dark, 0.9);
      A('glow', -8, -25, { r: 2.6, col: '#f0a04a' });
      emblem(g, 'star', -8, -7, 2, C.gold);
      door(g, -8, 25.4, 9, 12, C.ember);
      door(g, -8, 25.4, 5, 8, C.flame);
      A('light', -8, 22, { r: 60 });
      // anvil, ingots, slag
      poly(g, [-36, 20, -34, 15, -40, 15, -41, 13, -27, 13, -28, 15, -31, 15, -30, 20], C.ironD);
      for (let i = 0; i < 3; i++) rect(g, 10 + i * 4.4, 22 - (i % 2) * 2, 4, 2, C.gold, 0.7);
      ell(g, 34, 20, 9, 4, C.dark, 0.9);
      hatch(g, [25, 16, 43, 16, 43, 24, 25, 24], 1.8, 0.7, 0.6);
      flag(g, A, o, -40, 8, 22, { len: 9, h: 6, tail: 1 });
      return { shadow: [0, 13, 46, 18] };
    })
  );

  /** Crimson Legion Chapel: a cross-shaped church under a blood-red roof and a spire. */
  BuildingArt.register(
    'astartes_chapel',
    at(54, (g, o, A) => {
      const red = {
        wall: C.stone,
        tex: 'stone',
        roof: '#7c1a1e',
        roofD: '#4e1013',
        rtex: 'shingle',
      };
      gableEW(g, -32, -20, 64, 15, 15, 8, Object.assign({ slits: 8 }, red));
      gableNS(g, -12, -18, 24, 40, 19, 11, Object.assign({ door: 7, ov: 2.4 }, red));
      ell(g, 0, -7, 4.6, 4.6, C.dark, 1.1);
      ell(g, 0, -7, 4.6, 4.6, null, 0.6);
      emblem(g, 'cross', 0, -7, 0.72, BONE);
      for (const sx of [-17, 13]) block(g, sx, 15, 4, 7, 14, { tex: 'stone' });
      skull(g, 0, 7.4, 1.2);
      drum(g, 0, -32, 5.4, 6, { crenel: false, open: true, tex: null });
      cone(g, 0, -38, 6.4, 24, { roof: C.slateD });
      emblem(g, 'cross', 0, -65, 0.8, C.gold);
      for (const sx of [-1, 1]) {
        pole(g, sx * 38, 14, 26);
        A('banner', sx * 38 + 0.5, -11.2, { len: sx * -9, h: 7, col: BLOOD, mark: BONE, tail: 1 });
      }
      torch(g, A, -9, 26, 8);
      torch(g, A, 9, 26, 8);
      return { shadow: [0, 12, 44, 17] };
    })
  );

  /** Crystal Sanctum: pale shards rising from a stepped dais. */
  BuildingArt.register(
    'crystal_sanctum',
    at(54, (g, o, A) => {
      ell(g, 0, 12, 42, 22, C.stoneD);
      ell(g, 0, 9, 33, 17, C.stone);
      ell(g, 0, 6.4, 23, 12, C.stoneL);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        line(
          g,
          Math.cos(a) * 33,
          9 + Math.sin(a) * 17,
          Math.cos(a) * 42,
          12 + Math.sin(a) * 22,
          0.7
        );
      }
      const shard = (x, y, w, h, lean) => {
        const p = [
          x - w / 2,
          y,
          x - w / 2 + lean * 0.3,
          y - h * 0.74,
          x + lean,
          y - h,
          x + w / 2 + lean * 0.5,
          y - h * 0.7,
          x + w / 2,
          y,
        ];
        poly(g, p, '#a9c4cf');
        poly(
          g,
          [x - w / 2, y, x - w / 2 + lean * 0.3, y - h * 0.74, x + lean, y - h, x + lean * 0.2, y],
          '#dbe8e8',
          0.7
        );
        hatch(
          g,
          [
            x + lean * 0.2 + w * 0.2,
            y,
            x + lean,
            y - h,
            x + w / 2 + lean * 0.5,
            y - h * 0.7,
            x + w / 2,
            y,
          ],
          1.8,
          0.4,
          0.5
        );
      };
      shard(-24, 10, 8, 20, -6);
      shard(25, 11, 8, 22, 6);
      shard(-12, 6, 10, 34, -4);
      shard(13, 7, 10, 38, 5);
      shard(0, 6, 13, 54, 1.4);
      shard(4, 14, 7, 14, 2);
      shard(-8, 13, 5, 9, -2);
      A('glow', 0, -30, { r: 5, col: '#bfe0ea' });
      A('glow', -30, -14, { r: 2, col: '#bfe0ea', bob: 3 });
      A('glow', 32, -18, { r: 2, col: '#bfe0ea', bob: 3 });
      for (const sx of [-1, 1]) {
        block(g, sx * 36 - 2.4, 20, 4.8, 4, 9, { tex: null });
        A('torch', sx * 36, 12, { s: 0.7, r: 44 });
      }
      return { shadow: [0, 13, 44, 20] };
    })
  );

  /** Rift Cult Shrine: crooked obelisks chained to a tear in the air. */
  BuildingArt.register(
    'warp_shrine',
    at(54, (g, o, A) => {
      ell(g, 0, 10, 42, 22, C.dirtD, 1);
      K.hatchEll(g, 0, 10, 42, 22, 2.4, -0.8, 0.5);
      ell(g, 0, 10, 26, 13, null, 0.9);
      const stones = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.5;
        stones.push([Math.cos(a) * 35, 10 + Math.sin(a) * 18, 22 + ((i * 5) % 7)]);
      }
      stones.sort((p, q) => p[1] - q[1]);
      const ob = ([x, y, h]) => {
        const lean = -Math.sign(x) * h * 0.24;
        const p = [
          x - 3.6,
          y,
          x - 2.4 + lean,
          y - h + 3,
          x + lean,
          y - h,
          x + 2.4 + lean,
          y - h + 3,
          x + 3.6,
          y,
        ];
        poly(g, p, C.ewall);
        hatch(
          g,
          [x + 0.4, y, x + lean, y - h, x + 2.4 + lean, y - h + 3, x + 3.6, y],
          1.8,
          0.5,
          0.7
        );
        stroke(
          g,
          [
            x + lean * 0.3,
            y - h * 0.3,
            x + lean * 0.6 - 1,
            y - h * 0.5,
            x + lean * 0.7 + 1,
            y - h * 0.66,
          ],
          0.8,
          '#a66ad8'
        );
        g.setLineDash([1.6, 1.4]);
        line(g, x + lean, y - h + 1, -1 + Math.sign(x) * 2, -16, 0.8);
        g.setLineDash([]);
      };
      stones.filter((s) => s[1] < 10).forEach(ob);
      const rift = [
        -3, -44, 2, -33, -2, -25, 4, -14, -1, -4, 3, 6, 0, 13, -4, 5, -7, -5, -3, -15, -8, -26, -4,
        -34,
      ];
      poly(g, rift, '#2a1036', 1.7);
      poly(
        g,
        rift.map((v, i) => (i % 2 ? -15 + (v + 15) * 0.8 : -1.4 + (v + 1.4) * 0.45)),
        '#8b4fc0',
        0
      );
      A('glow', -1, -16, { r: 6, col: '#a66ad8' });
      block(g, -5, 16, 10, 6, 5, { wall: C.ewall, top: C.ewallD, tex: null });
      ell(g, 0, 13.6, 3.4, 1.6, BLOOD, 0.8);
      stones.filter((s) => s[1] >= 10).forEach(ob);
      skull(g, -14, 24, 0.9);
      skull(g, 13, 26, 0.8);
      skull(g, 22, 20, 0.7);
      return { shadow: [0, 13, 44, 20] };
    })
  );

  /** Wyrmcaller Moot Hall: a longhouse with crossed wyrm-head beams and a great skull. */
  BuildingArt.register(
    'dragon_moot',
    at(54, (g, o, A) => {
      gableNS(g, -18, -24, 36, 46, 13, 13, {
        wall: C.wood,
        tex: 'wood',
        roof: C.woodL,
        roofD: C.woodD,
        rtex: 'shingle',
        door: 8,
        ov: 3,
      });
      // shields along the west eave
      for (let i = 0; i < 6; i++) {
        ell(g, -21.4, -30 + i * 6.6, 2.6, 2.6, [BLOOD, C.blue, BONE][i % 3], 0.9);
        ell(g, -21.4, -30 + i * 6.6, 0.8, 0.8, C.iron, 0);
      }
      A('smoke', 0, -40, { s: 1.4 });
      // crossed beams ending in wyrm heads
      for (const sx of [-1, 1]) {
        beam(g, sx * 15, 10, sx * -9, -20, 1.8, C.woodD);
        poly(
          g,
          [sx * -9, -22, sx * -15, -27, sx * -14, -22.4, sx * -17, -20.4, sx * -10, -18.6],
          C.woodD
        );
        ell(g, sx * -12.4, -23.4, 0.7, 0.7, BONE, 0);
      }
      // wyrm skull over the door
      poly(g, [-7, 1, -4, -5, 4, -5, 7, 1, 3.4, 6, 0, 10, -3.4, 6], BONE);
      rect(g, -4.2, -2.4, 2.4, 2.2, INK, 0);
      rect(g, 1.8, -2.4, 2.4, 2.2, INK, 0);
      line(g, -1, 5, -1, 7.4, 0.7);
      line(g, 1, 5, 1, 7.4, 0.7);
      horns(g, 0, -4.4, 1.8);
      // rune stones and mead
      for (const sx of [-1, 1]) {
        poly(
          g,
          [
            sx * 30 - 3.4,
            26,
            sx * 30 - 2.4,
            12,
            sx * 30 + 1,
            10,
            sx * 30 + 3.4,
            14,
            sx * 30 + 3.4,
            26,
          ],
          C.stone
        );
        stroke(g, [sx * 30 - 1, 22, sx * 30 + 1, 19, sx * 30 - 1, 16], 0.7, BLOOD);
      }
      barrel(g, 24, 28, 1.4);
      barrel(g, 19, 30, 1.2);
      flag(g, A, o, -34, 14, 26, { len: 9, h: 7, tail: 1 });
      torch(g, A, -11, 26, 8);
      torch(g, A, 11, 26, 8);
      return { shadow: [0, 14, 42, 16] };
    })
  );

  // =============================================================== perk stands
  function plinth(g) {
    ell(g, 0, 6, 12, 5.4, C.stoneD);
    ell(g, 0, 4.4, 9.6, 4.2, C.stone);
  }

  const PERKS = {
    // Ironbrew Stand: a keg on a cradle, tapped
    jugger_nog(g, A) {
      beam(g, -7, 5, -4, -2, 1.3);
      beam(g, 7, 5, 4, -2, 1.3);
      ell(g, 0, -7, 8, 8, C.wood, 1.4);
      ell(g, 0, -7, 5.6, 5.6, C.woodL, 0.8);
      ell(g, 0, -7, 8, 8, null, 1.4);
      line(g, -8, -7, 8, -7, 0.6);
      rect(g, -1, -2, 2, 3.4, C.ironD, 0.7);
      emblem(g, 'fist', 0, -8, 0.7, BLOOD);
      rect(g, 6, 2, 3.6, 4, C.stoneL, 0.8);
      A('glow', 0, -17, { r: 1.4, col: '#e06a5a' });
    },
    // Field Revival: a brazier between two bone wings
    quick_revive(g, A) {
      block(g, -3, 1, 6, 4, 8, { tex: null });
      ell(g, 0, -8, 4.6, 2, C.ironD, 0.9);
      for (const sx of [-1, 1]) {
        poly(
          g,
          [
            sx * 3,
            -6,
            sx * 12,
            -17,
            sx * 10.4,
            -10,
            sx * 12.4,
            -8,
            sx * 8,
            -5,
            sx * 9,
            -2,
            sx * 4,
            -3,
          ],
          BONE
        );
        stroke(g, [sx * 4, -5, sx * 10, -14], 0.6);
        stroke(g, [sx * 5, -4, sx * 10, -8], 0.6);
      }
      A('torch', 0, -8, { s: 0.9, r: 40 });
    },
    // Swiftstep Tonic: a winged boot on a post
    speed_cola(g, A) {
      beam(g, 0, 4, 0, -9, 1.6);
      emblem(g, 'boot', 1, -14, 1.7, C.green);
      A('glow', -8, -18, { r: 1.3, col: '#9fd08a' });
    },
    // Endurance Draft: a pump and trough
    stamin_up(g, A) {
      rect(g, -9, 0, 12, 4.4, C.wood, 1);
      rect(g, -8, 0.8, 10, 2, '#5d7f8c', 0.6);
      beam(g, 6, 5, 6, -12, 2);
      stroke(g, [6, -9, 1, -9, 1, -5], 1.6);
      stroke(g, [6, -12, 12, -16, 13, -11], 1.2);
      ell(g, 6, -12.6, 1.6, 1.6, C.gold, 0.8);
      A('glow', 6, -16, { r: 1.2, col: '#e8d074' });
    },
    // Deadeye Elixir: a butt with an arrow in the gold
    deadshot_daiquiri(g, A) {
      target(g, 0, 4, 1.8);
      line(g, 0, -5.6, 8, -13, 1);
      line(g, 6.4, -12.6, 8.6, -11.4, 1.2, BONE);
      line(g, 7.4, -13.6, 9.6, -12.4, 1.2, BONE);
      rect(g, -9.6, 1, 3, 4.4, C.purple, 0.8);
      rect(g, -8.8, -0.8, 1.4, 2, C.purple, 0.7);
      A('glow', 0, -5.6, { r: 1, col: '#e8c46a' });
    },
    // Element Ward: a rune stone with four marks
    elemental_pop(g, A) {
      g.beginPath();
      g.moveTo(-6, 4);
      g.lineTo(-6, -10);
      g.quadraticCurveTo(0, -20, 6, -10);
      g.lineTo(6, 4);
      g.closePath();
      g.fillStyle = C.stone;
      g.fill();
      K.ink(g);
      hatch(g, [1, -17, 6, -10, 6, 4, 2, 4], 1.8, 0.5, 0.55);
      emblem(g, 'drop', -2.6, -9.6, 0.5, '#6f9fb8');
      ell(g, 2.6, -9.6, 1.6, 1.6, C.ember, 0.6);
      ell(g, -2.6, -3.4, 1.6, 1.6, C.green, 0.6);
      emblem(g, 'star', 2.6, -3.4, 0.4, BONE);
      A('glow', 0, -19, { r: 1.5, col: '#d8a0e0' });
    },
    // Impact Ward: a tower shield planted in cracked ground
    phd_flopper(g, A) {
      for (const k of [1.25, 1.7]) {
        g.setLineDash([2.4, 2]);
        ell(g, 0, 5, 9 * k, 4 * k, null, 0.8);
        g.setLineDash([]);
      }
      poly(g, [-6.4, -16, 6.4, -16, 6.4, -2, 0, 5, -6.4, -2], C.iron, 1.4);
      hatch(g, [1, -16, 6.4, -16, 6.4, -2, 1, 4], 1.8, 0.5, 0.6);
      ell(g, 0, -8, 2.4, 2.4, C.stoneL, 0.9);
      line(g, 0, -16, 0, 4, 0.7);
      A('glow', 0, -8, { r: 1.1, col: '#8fa8e0' });
    },
    // Brawler's Brew: a striking post under a fist
    melee_macchiato(g, A) {
      beam(g, 0, 5, 0, -8, 2.6, C.woodL);
      for (let y = -5; y < 4; y += 2.4) line(g, -1.8, y, 1.8, y + 0.8, 0.7);
      line(g, -6, -4, 6, -4, 2.4);
      line(g, -6, -4, 6, -4, 1.2, C.woodL);
      emblem(g, 'fist', 0, -14, 1.6, C.hide);
      A('glow', 7, -14, { r: 1.2, col: '#d8a06a' });
    },
    // Scavenger's Tonic: a carrion bird on a dead bough
    vulture_aid(g, A) {
      stroke(g, [-3, 5, -2, -6, -6, -13], 2.6);
      stroke(g, [-2, -6, 5, -11, 9, -10], 2);
      stroke(g, [-3, 5, -2, -6, -6, -13], 1.2, C.woodD);
      stroke(g, [-2, -6, 5, -11, 9, -10], 0.9, C.woodD);
      poly(g, [2, -11, 2.6, -18, 6, -20.4, 9, -17, 8.4, -11], C.dark);
      ell(g, 7.6, -20.6, 1.9, 1.7, BONE, 0.8);
      poly(g, [9, -20.6, 11.6, -19.4, 9, -19], C.gold, 0.6);
      sack(g, -8, 4, 1.1);
      A('glow', -6, -15, { r: 1.2, col: '#c8d07a' });
    },
    // Last Stand Monument: a headstone with a sword driven in before it
    tombstone(g, A) {
      g.beginPath();
      g.moveTo(-7, 3);
      g.lineTo(-7, -9);
      g.quadraticCurveTo(0, -19, 7, -9);
      g.lineTo(7, 3);
      g.closePath();
      g.fillStyle = C.stoneD;
      g.fill();
      K.ink(g, 1.4);
      hatch(g, [1, -17, 7, -9, 7, 3, 2, 3], 1.8, 0.5, 0.6);
      emblem(g, 'cross', 0, -8, 0.7, BONE);
      g.save();
      g.translate(4, 6);
      g.rotate(Math.PI);
      emblem(g, 'sword', 0, 0, 1.1, C.stoneL);
      g.restore();
      skull(g, -6, 6, 0.9);
      A('glow', 0, -19, { r: 1.2, col: '#c8c8c8' });
    },
    // Twinshot Brew: two bows racked back to back over a small cask
    double_tap(g, A) {
      rect(g, -4, -1, 8, 6, C.wood, 1.1);
      line(g, -4, 1.4, 4, 1.4, 0.6);
      line(g, -4, 3.2, 4, 3.2, 0.6);
      line(g, 0, -1, 0, -16, 1.6);
      emblem(g, 'bow', -4.6, -10, 1.25, C.woodL);
      g.save();
      g.translate(4.6, -10);
      g.scale(-1, 1);
      emblem(g, 'bow', 0, 0, 1.25, C.woodL);
      g.restore();
      A('glow', 0, -18.5, { r: 1.3, col: '#e0b050' });
    },
    // Packmule Tonic: a pack saddle on a trestle, hung with a horseshoe
    mule_kick(g, A) {
      beam(g, -7, 5, -4, -6, 1.3);
      beam(g, 7, 5, 4, -6, 1.3);
      beam(g, -8, -6, 8, -6, 1.6);
      poly(g, [-9, -6, -7, -12, -2, -13, 0, -10, 2, -13, 7, -12, 9, -6], C.hide, 1.2);
      hatch(g, [0, -10, 2, -13, 7, -12, 9, -6, 0, -6], 1.7, 0.6, 0.65);
      rect(g, -10.5, -5, 4, 5, C.canvasD, 0.9);
      rect(g, 6.5, -5, 4, 5, C.canvasD, 0.9);
      emblem(g, 'horseshoe', 0, -1.5, 1, C.stoneL);
      A('glow', 0, -17, { r: 1.3, col: '#7fc070' });
    },
    // Quickhands Tonic: a whetstone wheel with a blade laid to it
    sleight(g, A) {
      beam(g, -6, 5, -3, -5, 1.3);
      beam(g, 6, 5, 3, -5, 1.3);
      ell(g, 0, -6, 6.4, 6.4, C.stone, 1.3);
      ell(g, 0, -6, 4.2, 4.2, C.stoneL, 0.7);
      ell(g, 0, -6, 1.1, 1.1, C.ironD, 0.6);
      hatch(g, [0, -12.4, 6.4, -12.4, 6.4, 0.4, 0, 0.4], 1.6, 0.6, 0.6);
      line(g, 6.4, -6, 10, -6, 1.2);
      line(g, 10, -6, 10, -3, 1.2);
      g.save();
      g.translate(-7, -13);
      g.rotate(-0.9);
      emblem(g, 'sword', 0, 0, 1.2, BONE);
      g.restore();
      A('glow', 3, -16.5, { r: 1.3, col: '#70b0e0' });
    },
  };

  /** A plinth that has been broken: a wedge out of the rim and a crack across the top. */
  function brokenPlinth(g) {
    ell(g, 0, 6, 12, 5.4, C.stoneDD);
    ell(g, 0, 4.4, 9.6, 4.2, C.stoneD);
    poly(g, [5, 9.4, 7.4, 5.4, 11.4, 6.4, 10, 10.4], C.dirtD, 0.9);
    stroke(g, [-8, 3, -3, 5, -1, 3.4, 4, 5.6], 0.9);
    ell(g, 13, 9.4, 1.8, 1.2, C.stoneD, 0.7);
    ell(g, -12.4, 8.6, 1.4, 1, C.stone, 0.7);
  }

  function spill(g, x, y, rx, ry, col) {
    g.globalAlpha = 0.85;
    poly(
      g,
      [x - rx, y, x - rx * 0.5, y - ry, x + rx * 0.4, y - ry * 0.8, x + rx, y - ry * 0.1, x + rx * 0.6, y + ry, x - rx * 0.3, y + ry * 0.8],
      col,
      0.7
    );
    g.globalAlpha = 1;
  }

  /** What each stand looks like once it is wrecked: the same object, broken its own way. */
  const PERK_RUINS = {
    // the keg stove in, staves splayed, its brew run out red
    jugger_nog(g) {
      spill(g, 2, 7, 11, 3.4, BLOOD);
      beam(g, -7, 5, -5, -1, 1.3);
      for (const [a, len] of [[-2.5, 9], [-2.0, 11], [-1.5, 10], [-1.0, 11], [-0.5, 8]]) {
        beam(g, 0, 2, Math.cos(a) * len, 2 + Math.sin(a) * len, 1.5, C.wood);
      }
      g.beginPath();
      g.ellipse(4, 4, 6.4, 2.6, 0.2, 0, TAU);
      g.lineWidth = 1.6;
      g.strokeStyle = INK;
      g.stroke();
      g.lineWidth = 0.7;
      g.strokeStyle = C.iron;
      g.stroke();
      rect(g, -11, 4, 3.6, 3, C.stoneL, 0.8);
    },
    // the brazier tipped over, one wing snapped off and lying in the ash
    quick_revive(g, A) {
      block(g, -3, 1, 6, 4, 4, { tex: null });
      spill(g, 6, 6, 6, 2.4, '#141012');
      g.save();
      g.translate(5, 3);
      g.rotate(1.2);
      ell(g, 0, -4, 4.6, 2, C.ironD, 0.9);
      g.restore();
      poly(g, [-3, -3, -12, -13, -10.4, -7, -12.4, -5, -8, -2, -9, 1, -4, 0], BONE);
      stroke(g, [-4, -2, -10, -10], 0.6);
      g.save();
      g.translate(9, 9);
      g.rotate(1.9);
      poly(g, [0, 0, 8, -9, 7, -3, 9, -1, 5, 2], '#b8ae91');
      g.restore();
      A('smoke', 6, 2, { s: 0.7, dark: 1 });
    },
    // the post snapped, the winged boot fallen at its foot
    speed_cola(g) {
      beam(g, 0, 4, 0.6, -3, 1.6);
      poly(g, [-1.4, -3, -0.2, -6, 0.6, -3.6, 1.8, -5.4, 2, -2.6], C.woodL, 0.8);
      beam(g, 3, 6, 11, 2, 1.6);
      g.save();
      g.translate(-7, 5);
      g.rotate(-1.3);
      emblem(g, 'boot', 0, 0, 1.6, C.greenD);
      g.restore();
      stroke(g, [-11, 2, -13, -1, -10, -1.4], 0.7, BONE);
    },
    // the pump bent double, the trough split and drained
    stamin_up(g) {
      spill(g, -4, 7, 9, 2.6, '#3d5560');
      poly(g, [-10, 0, -3.4, 0, -4.4, 4.4, -10, 4.4], C.wood, 1);
      poly(g, [-1.6, 1, 3, 2.4, 3, 5.6, -2.4, 5], C.wood, 1);
      beam(g, 6, 5, 6, -5, 2);
      stroke(g, [6, -5, 9, -9, 13, -6, 14, 2], 2.4);
      stroke(g, [6, -5, 9, -9, 13, -6, 14, 2], 1.1, C.ironD);
      ell(g, 14, 3.4, 1.6, 1.6, C.gold, 0.8);
    },
    // the butt knocked flat, shot full of arrows
    deadshot_daiquiri(g) {
      ell(g, 0, 3, 9.4, 4.2, C.thatchD, 1.2);
      ell(g, 0, 3, 6.4, 2.8, BONE, 0.7);
      ell(g, 0, 3, 3.4, 1.5, BLOOD, 0.6);
      for (const [x, y, dx] of [[-5, 2, -2], [2, 1, 1.4], [5, 4.4, 2.4], [-1, 4.6, -0.6]]) {
        line(g, x, y, x + dx, y - 8, 0.9);
        line(g, x + dx - 1.1, y - 7.6, x + dx + 1.1, y - 8.6, 1.1, BONE);
      }
      beam(g, -11, 6, -7, -4, 1.3);
      rect(g, 9, 3, 3, 3.4, C.purpleD, 0.8);
    },
    // the rune stone split down the middle, the halves fallen apart
    elemental_pop(g) {
      g.save();
      g.translate(-3.4, 4);
      g.rotate(-0.42);
      poly(g, [-3, 0, -3, -13, -0.4, -17, 1.6, -12, 0, -8, 1.4, -4, 0, 0], C.stone, 1.3);
      ell(g, -1, -9.6, 1.3, 1.3, '#6f9fb8', 0.6);
      g.restore();
      g.save();
      g.translate(4, 4);
      g.rotate(0.6);
      poly(g, [0, 0, 1.4, -4, 0, -8, 1.6, -12, 3.4, -15, 5.4, -10, 5.4, 0], C.stoneD, 1.3);
      hatch(g, [1.6, -12, 3.4, -15, 5.4, -10, 5.4, 0, 2, 0], 1.6, 0.5, 0.7);
      g.restore();
      ell(g, 0, 5, 1.6, 1.1, C.stoneL, 0.7);
      stroke(g, [-1, 3, 0.4, 0, -0.6, -3], 0.8, '#d8a0e0');
    },
    // the tower shield split and thrown on its face in the cratered ground
    phd_flopper(g) {
      spill(g, 0, 6, 12, 4, C.dirtD);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        line(g, Math.cos(a) * 5, 6 + Math.sin(a) * 2, Math.cos(a) * 12, 6 + Math.sin(a) * 4.4, 0.8);
      }
      g.save();
      g.translate(-3, 4);
      g.rotate(-1.25);
      poly(g, [-6.4, -9, -0.6, -9, 0.8, -3, -1, 2, -6.4, 4], C.iron, 1.3);
      g.restore();
      g.save();
      g.translate(5, 5);
      g.rotate(-0.9);
      poly(g, [0.6, -9, 6.4, -9, 6.4, 4, 0, 9, -1, 2, 0.8, -3], C.ironD, 1.3);
      g.restore();
      ell(g, 1, 0.6, 2.2, 1.6, C.stoneL, 0.8);
    },
    // the striking post snapped at the waist, the fist on the ground
    melee_macchiato(g) {
      beam(g, 0, 5, 0, -1.6, 2.6, C.woodL);
      poly(g, [-1.8, -1.6, -0.8, -4.4, 0.2, -2.4, 1.4, -5, 1.8, -1.6], C.woodL, 0.8);
      g.save();
      g.translate(4, 6);
      g.rotate(1.35);
      beam(g, 0, 0, 0, -9, 2.4, C.woodL);
      line(g, -5, -6, 5, -6, 2.4);
      line(g, -5, -6, 5, -6, 1.2, C.woodL);
      g.restore();
      g.save();
      g.translate(-8, 6);
      g.rotate(-1.9);
      emblem(g, 'fist', 0, 0, 1.4, C.hideD);
      g.restore();
    },
    // the bough down, the bird gone, feathers and a torn sack
    vulture_aid(g) {
      stroke(g, [-3, 5, -2.4, -2], 2.6);
      stroke(g, [-3, 5, -2.4, -2], 1.2, C.woodD);
      poly(g, [-3.8, -2, -2.8, -5, -2, -2.8, -1, -4.4, -1, -2], C.woodD, 0.7);
      stroke(g, [1, 7, 7, 4, 12, 6], 2.2);
      stroke(g, [1, 7, 7, 4, 12, 6], 1, C.woodD);
      for (const [x, y, a] of [[-9, 4, 0.4], [5, 0, -0.8], [9, 9, 0.2], [-6, 9, 1.2]]) {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        poly(g, [0, 0, 1.2, -3.6, 0, -5.4, -1.2, -3.6], C.dark, 0.6);
        g.restore();
      }
      poly(g, [-12, 6, -10, 2.6, -6.4, 3.4, -7, 6.4], C.canvasD, 0.9);
      spill(g, -5, 7.4, 3.4, 1.2, C.thatch);
    },
    // the headstone broken across and fallen, the sword snapped
    tombstone(g) {
      poly(g, [-7, 3, -7, -3, -3, -4.6, 0, -2.4, 4, -4.4, 7, -3, 7, 3], C.stoneD, 1.4);
      hatch(g, [1, -3, 7, -3, 7, 3, 2, 3], 1.8, 0.5, 0.6);
      g.save();
      g.translate(9, 7);
      g.rotate(1.2);
      g.beginPath();
      g.moveTo(-6, 2);
      g.lineTo(-6, -3);
      g.quadraticCurveTo(0, -12, 6, -3);
      g.lineTo(6, 2);
      g.lineTo(2, 0);
      g.lineTo(-2, 2.4);
      g.closePath();
      g.fillStyle = C.stoneDD;
      g.fill();
      K.ink(g, 1.3);
      g.restore();
      line(g, -10, 8, -10, 3, 1.6);
      line(g, -10, 8, -10, 3, 0.8, C.stoneL);
      line(g, -12, 5.4, -8, 5.4, 1.2);
      line(g, -6, 9, -2, 8, 1.6);
      line(g, -6, 9, -2, 8, 0.8, C.stoneL);
      skull(g, 1, 8, 0.9);
    },
    // both bows broken, strings hanging, the cask smashed
    double_tap(g) {
      poly(g, [-4, 5, -4, 1, -1.6, -0.6, 0, 1.6, 2, 0, 4, 1.6, 4, 5], C.wood, 1.1);
      line(g, 0, 1.6, 0, -7, 1.6);
      poly(g, [-1, -7, 0, -9.6, 1, -7], C.woodD, 0.6);
      stroke(g, [-10, 6, -8, 0, -5, -3], 2);
      stroke(g, [-10, 6, -8, 0, -5, -3], 1, C.woodL);
      stroke(g, [-5, -3, -6.4, 2, -9, 4], 0.5, BONE);
      stroke(g, [6, 7, 10, 3, 12, -2], 2);
      stroke(g, [6, 7, 10, 3, 12, -2], 1, C.woodL);
      stroke(g, [12, -2, 9.4, 1, 10, 5], 0.5, BONE);
      beam(g, 3, 8, 8, 9.4, 1.1, C.woodD);
    },
    // the trestle legs kicked out, the pack saddle in the dirt
    mule_kick(g) {
      beam(g, -11, 8, -3, 3, 1.3);
      beam(g, 12, 7, 4, 4, 1.3);
      beam(g, -9, 5, 9, 2, 1.6);
      g.save();
      g.translate(0, 3);
      g.rotate(0.22);
      poly(g, [-9, 2, -7, -4, -2, -5, 0, -2, 2, -5, 7, -4, 9, 2], C.hideD, 1.2);
      hatch(g, [0, -2, 2, -5, 7, -4, 9, 2, 0, 2], 1.7, 0.6, 0.65);
      g.restore();
      poly(g, [-13, 5, -10, 3, -8, 6.4, -11.4, 8], C.canvasD, 0.9);
      g.save();
      g.translate(9, 9);
      g.rotate(0.8);
      emblem(g, 'horseshoe', 0, 0, 0.9, C.stoneL);
      g.restore();
    },
    // the whetstone cracked in two and off its cradle
    sleight(g) {
      beam(g, -6, 5, -3, -3, 1.3);
      beam(g, 6, 5, 4, 0, 1.3);
      g.save();
      g.translate(-4, 3);
      g.rotate(-0.5);
      g.beginPath();
      g.arc(0, 0, 6.4, Math.PI * 0.55, Math.PI * 1.6);
      g.closePath();
      g.fillStyle = C.stone;
      g.fill();
      K.ink(g, 1.3);
      g.restore();
      g.save();
      g.translate(6, 7);
      g.rotate(0.5);
      g.beginPath();
      g.arc(0, 0, 6.4, -Math.PI * 0.45, Math.PI * 0.6);
      g.closePath();
      g.fillStyle = C.stoneD;
      g.fill();
      K.ink(g, 1.3);
      g.restore();
      line(g, -10, 9, -3, 7.6, 1.6);
      line(g, -10, 9, -3, 7.6, 0.8, BONE);
    },
  };

  function perkDrawer(id) {
    return at(16, (g, o, A) => {
      if (o.state === 'ruin') {
        brokenPlinth(g);
        const rf = PERK_RUINS[id];
        if (rf) rf(g, A);
        else {
          g.save();
          g.translate(3, 6);
          g.rotate(1.3);
          rect(g, -3, -8, 6, 11, C.purpleD, 1.2);
          g.restore();
        }
        return { shadow: [0, 6, 13, 5], ownRuin: true };
      }
      plinth(g);
      const fn = PERKS[id];
      if (fn) fn(g, A);
      else {
        rect(g, -3, -8, 6, 11, C.purple, 1.2);
        rect(g, -1.4, -12, 2.8, 4, C.purple, 1);
        A('glow', 0, -14, { r: 1.4, col: '#b9a2e8' });
      }
      A('light', 0, 0, { r: 26 });
      return { shadow: [0, 6, 13, 5] };
    });
  }
  for (const id of Object.keys(PERKS)) BuildingArt.register('perk_' + id, perkDrawer(id));

  // ================================================================== fallbacks
  const genericHall = at(24, (g, o, A) => {
    gableEW(g, -18, -9, 36, 13, 9, 5, Object.assign({ door: 4.4, slits: 4 }, slate));
    emblem(g, 'star', 0, -10.4, 1, BONE);
    flag(g, A, o, -18, -16, 9);
    torch(g, A, 20, 6, 7);
    return { shadow: [0, 7, 22, 9] };
  });
  BuildingArt.register('_generic', genericHall);
  const genericPerk = perkDrawer('');

  BuildingArt.setFallback((b) => {
    if (b.isPerkMachine || (b.type || '').startsWith('perk_')) return genericPerk;
    if (b.isHamlet) return BuildingArt.kit.lookup(b.owner === 'enemy' ? 'enemy_hamlet' : 'hamlet');
    if (b.isMerchantGuild) return BuildingArt.kit.lookup('merchant_guild');
    if (b.isResearchLab) return BuildingArt.kit.lookup('research_lab');
    return genericHall;
  });
})();
