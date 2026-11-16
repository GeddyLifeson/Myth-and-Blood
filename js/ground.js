/**
 * Ground — the land the player holds on the one field.
 *
 * The field is three sectors wide (the host's entry sectors) and three bands deep. The bottom
 * band is home ground and is always held. The six plots above it are taken and lost:
 *
 *   - A plot next to held ground is claimed at night by standing three soldiers in it until
 *     the banner is up. By day an army chasing the host would take the whole field without
 *     meaning to. Burning a war camp claims the plot it stood in at once, day or night.
 *   - A held plot is lost when enemies stand in it with no soldier of yours there. That is the
 *     price of ground: every plot needs men in it whenever the host comes through.
 *   - Buildings go on held ground only.
 *   - Each plot is a settlement that grows with the days it has stood: Hamlet, Village, Town,
 *     City, Metropolis. It pays TP at nightfall by its rank, one more on the top band. Losing
 *     the plot loses the settlement. This is the old five-building ladder, opened from wave 1.
 *
 * Hooked from Game: the update loop, nightfall (before the round's TP), a war camp's
 * destruction, building placement, the settlement income sum and the world draw pass.
 */
const Ground = (() => {
  const INK = '#07050a';
  const BONE = '#e4dcc4';
  const BLOOD = '#a01018';

  const SECTORS = ['left', 'centre', 'right'];
  /** Where the bands end, as a share of the field's height from the top. */
  const FRONT_END = 0.3;
  const HOME_START = 0.6;
  const CHECK_EVERY = 10;
  const CLAIM_TICKS = 600;
  const LOSE_TICKS = 360;
  const CLAIM_SOLDIERS = 3;
  /** Days a plot must have stood for each rank; index 0 is a bare claim that pays nothing. */
  const RANK_DAYS = [0, 1, 3, 6, 10, 15];
  const RANK_NAMES = ['Claim', 'Hamlet', 'Village', 'Town', 'City', 'Metropolis'];

  const PLOTS = [];
  for (const band of ['mid', 'front']) {
    for (const sector of SECTORS) {
      PLOTS.push({
        id: `${sector}_${band}`,
        sector,
        band,
        name: `${sector[0].toUpperCase()}${sector.slice(1)} ${band === 'mid' ? 'field' : 'march'}`,
      });
    }
  }
  const PLOT_BY_ID = Object.fromEntries(PLOTS.map((p) => [p.id, p]));

  let state = fresh();

  function fresh() {
    const plots = {};
    for (const p of PLOTS) plots[p.id] = { held: false, meter: 0, days: 0, claimedWave: 0 };
    return { plots };
  }

  function resetRun() {
    state = fresh();
  }

  function bounds(plot, worldW, worldH) {
    const i = SECTORS.indexOf(plot.sector);
    const w = worldW / SECTORS.length;
    const front = plot.band === 'front';
    return {
      x0: i * w,
      x1: (i + 1) * w,
      y0: front ? 0 : worldH * FRONT_END,
      y1: worldH * (front ? FRONT_END : HOME_START),
    };
  }

  /** The plot under a point, or null on home ground. */
  function plotAt(x, y, worldW, worldH) {
    if (y >= worldH * HOME_START) return null;
    const i = Math.max(0, Math.min(SECTORS.length - 1, Math.floor((x / worldW) * SECTORS.length)));
    return PLOT_BY_ID[`${SECTORS[i]}_${y < worldH * FRONT_END ? 'front' : 'mid'}`];
  }

  function isHeld(id) {
    return !!state.plots[id]?.held;
  }

  /** A plot can be claimed on foot only from ground already held. Mid plots touch home. */
  function touchesHeld(plot) {
    if (plot.band === 'mid') return true;
    const i = SECTORS.indexOf(plot.sector);
    return (
      isHeld(`${plot.sector}_mid`) ||
      (i > 0 && isHeld(`${SECTORS[i - 1]}_front`)) ||
      (i < SECTORS.length - 1 && isHeld(`${SECTORS[i + 1]}_front`))
    );
  }

  function rankOf(id) {
    const s = state.plots[id];
    if (!s?.held) return 0;
    let r = 0;
    while (r + 1 < RANK_DAYS.length && s.days >= RANK_DAYS[r + 1]) r++;
    return r;
  }

  function plotIncome(id) {
    const r = rankOf(id);
    return r > 0 ? r + (PLOT_BY_ID[id].band === 'front' ? 1 : 0) : 0;
  }

  /** Raw TP per wave from all held plots; the settlement soft cap is applied by the caller. */
  function income() {
    let n = 0;
    for (const p of PLOTS) n += plotIncome(p.id);
    return n;
  }

  function claim(plot, ctx, how) {
    const s = state.plots[plot.id];
    if (s.held) return false;
    s.held = true;
    s.meter = 1;
    s.days = 0;
    s.claimedWave = ctx?.wave || 0;
    if (ctx) {
      ctx.showMessage(
        `${plot.name} claimed${how ? ` ${how}` : ''}. You can build here. Keep a soldier in it when the host comes through, and it pays from tomorrow night.`,
        300
      );
      ctx.playSfx?.('build');
    }
    return true;
  }

  function lose(plot, ctx) {
    const s = state.plots[plot.id];
    const rank = rankOf(plot.id);
    s.held = false;
    s.meter = 0;
    s.days = 0;
    if (ctx) {
      ctx.showMessage(
        `${plot.name} is lost${rank > 0 ? ` and its ${RANK_NAMES[rank].toLowerCase()} with it` : ''}: the host stood in it and nobody of yours was there.`,
        300
      );
      ctx.shake?.(3);
    }
  }

  function update(ctx) {
    if (!ctx || ctx.creative || ctx.tick % CHECK_EVERY) return;
    const W = ctx.worldW;
    const H = ctx.worldH;
    const mine = {};
    const foes = {};
    for (const u of ctx.units) {
      if (!(u.hp > 0) || u.type === 'builder') continue;
      const p = plotAt(u.x, u.y, W, H);
      if (!p) continue;
      const tally = u.team === 'player' ? mine : u.team === 'enemy' ? foes : null;
      if (tally) tally[p.id] = (tally[p.id] || 0) + 1;
    }
    for (const p of PLOTS) {
      const s = state.plots[p.id];
      const m = mine[p.id] || 0;
      const f = foes[p.id] || 0;
      if (s.held) {
        if (f > 0 && m === 0) {
          s.meter -= CHECK_EVERY / LOSE_TICKS;
          if (s.meter <= 0) lose(p, ctx);
        } else if (s.meter < 1) {
          s.meter = Math.min(1, s.meter + CHECK_EVERY / CLAIM_TICKS);
        }
      } else if (ctx.isNight && m >= CLAIM_SOLDIERS && f === 0 && touchesHeld(p)) {
        s.meter += CHECK_EVERY / CLAIM_TICKS;
        if (s.meter >= 1) claim(p, ctx);
      } else if (s.meter > 0) {
        s.meter = Math.max(0, s.meter - CHECK_EVERY / CLAIM_TICKS);
      }
    }
  }

  /** Nightfall: every plot that stood through the day's fight is a day older. */
  function onNightBegin(ctx) {
    if (!ctx || ctx.creative) return;
    const grown = [];
    for (const p of PLOTS) {
      const s = state.plots[p.id];
      if (!s.held || s.claimedWave >= ctx.wave) continue;
      const before = rankOf(p.id);
      s.days++;
      const after = rankOf(p.id);
      if (after > before)
        grown.push(`${p.name} is now a ${RANK_NAMES[after]} (+${plotIncome(p.id)} TP a wave)`);
    }
    if (grown.length) ctx.showMessage(`${grown.join('. ')}.`, 320);
  }

  /** A burned war camp leaves its plot to whoever burned it. */
  function onCampDestroyed(x, y, ctx) {
    if (!ctx || ctx.creative) return false;
    const p = plotAt(x, y, ctx.worldW, ctx.worldH);
    return !!p && claim(p, ctx, 'from the ashes of the camp');
  }

  /** @returns {{ok: boolean, reason?: string}} */
  function canBuildAt(x, y, worldW, worldH) {
    const p = plotAt(x, y, worldW, worldH);
    if (!p || isHeld(p.id)) return { ok: true };
    const way = touchesHeld(p)
      ? `stand ${CLAIM_SOLDIERS} soldiers in it at night until the banner is up`
      : 'take the ground next to it first, or burn a war camp in it';
    return { ok: false, reason: `${p.name} is not yours yet: ${way}.` };
  }

  /** Old saves and prebuilt bases: ground under a standing building of yours counts as held. */
  function adoptBuildings(ctx) {
    if (!ctx?.buildings) return;
    for (const b of ctx.buildings) {
      if (b.owner !== 'player' || !(b.hp > 0)) continue;
      const p = plotAt(b.x, b.y, ctx.worldW, ctx.worldH);
      if (!p || isHeld(p.id)) continue;
      const s = state.plots[p.id];
      s.held = true;
      s.meter = 1;
      s.claimedWave = ctx.wave || 0;
    }
  }

  function drawBanner(g, x, y, k, rank, tick) {
    const sway = Math.sin(tick / 22 + x) * 1.5 * k;
    g.strokeStyle = INK;
    g.lineWidth = 2 * k;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - 22 * k);
    g.stroke();
    g.fillStyle = rank > 0 ? BLOOD : BONE;
    g.beginPath();
    g.moveTo(x, y - 22 * k);
    g.lineTo(x + 13 * k + sway, y - 18 * k);
    g.lineTo(x, y - 13 * k);
    g.closePath();
    g.fill();
    g.stroke();
  }

  /** Plot edges, banners and meters in world space. `placing` shades ground that cannot be built on. */
  function draw(g, ctx, tick, placing) {
    if (!g || !ctx || ctx.creative) return;
    const W = ctx.worldW;
    const H = ctx.worldH;
    const k = 1 / Math.max(0.5, ctx.viewScale || 1);
    g.save();
    for (const p of PLOTS) {
      const s = state.plots[p.id];
      const b = bounds(p, W, H);
      if (!s.held && placing) {
        g.fillStyle = 'rgba(160, 16, 24, 0.16)';
        g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      }
      if (!s.held && s.meter <= 0) continue;
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      if (s.held) {
        g.strokeStyle = 'rgba(228, 220, 196, 0.35)';
        g.lineWidth = 1.5 * k;
        g.setLineDash([6 * k, 6 * k]);
        g.strokeRect(b.x0 + 2, b.y0 + 2, b.x1 - b.x0 - 4, b.y1 - b.y0 - 4);
        g.setLineDash([]);
        const rank = rankOf(p.id);
        drawBanner(g, cx, cy, k, rank, tick);
        const pay = plotIncome(p.id);
        g.font = `bold ${Math.round(9.5 * k)}px Georgia, serif`;
        g.textAlign = 'center';
        const text = pay > 0 ? `${RANK_NAMES[rank]} +${pay}` : 'Claimed';
        g.lineWidth = 3 * k;
        g.strokeStyle = INK;
        g.strokeText(text, cx, cy + 11 * k);
        g.fillStyle = BONE;
        g.fillText(text, cx, cy + 11 * k);
      }
      if (s.meter > 0 && s.meter < 1) {
        const wide = 44 * k;
        g.fillStyle = INK;
        g.fillRect(cx - wide / 2 - k, cy + 15 * k, wide + 2 * k, 6 * k);
        g.fillStyle = s.held ? BLOOD : BONE;
        g.fillRect(cx - wide / 2, cy + 16 * k, wide * s.meter, 4 * k);
      }
    }
    g.textAlign = 'left';
    g.restore();
  }

  /** For the UI and tests: every plot with its rank and pay. */
  function getSnapshot() {
    return PLOTS.map((p) => ({
      id: p.id,
      name: p.name,
      band: p.band,
      sector: p.sector,
      held: isHeld(p.id),
      meter: state.plots[p.id].meter,
      days: state.plots[p.id].days,
      rank: rankOf(p.id),
      rankName: RANK_NAMES[rankOf(p.id)],
      income: plotIncome(p.id),
    }));
  }

  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('Ground', {
      version: 1,
      save() {
        return { plots: JSON.parse(JSON.stringify(state.plots)) };
      },
      load(data, ctx) {
        resetRun();
        for (const p of PLOTS) {
          const d = data?.plots?.[p.id];
          if (!d) continue;
          state.plots[p.id] = {
            held: !!d.held,
            meter: Math.max(0, Math.min(1, Number(d.meter) || 0)),
            days: Math.max(0, Math.floor(Number(d.days) || 0)),
            claimedWave: Math.max(0, Math.floor(Number(d.claimedWave) || 0)),
          };
        }
        adoptBuildings(ctx);
      },
    });
  }

  return {
    PLOTS,
    RANK_DAYS,
    RANK_NAMES,
    CLAIM_SOLDIERS,
    CLAIM_TICKS,
    LOSE_TICKS,
    resetRun,
    plotAt,
    bounds,
    isHeld,
    rankOf,
    income,
    update,
    onNightBegin,
    onCampDestroyed,
    canBuildAt,
    adoptBuildings,
    draw,
    getSnapshot,
  };
})();
if (typeof globalThis !== 'undefined') globalThis.Ground = Ground;
