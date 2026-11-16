/**
 * The General's order bar. War Cry and Hold the Line are cast in js/siege-loop.js; this
 * module adds Advance, Fall Back and the two stances, draws the General's reach on the
 * field, and takes the bar away when he falls until a veteran footman is promoted.
 * It also draws what the spy network did: the ambush, the scouted head counts and the
 * marked warlord. Loaded after js/game-commands.js, before js/game.js.
 */
const GeneralOrders = (() => {
  const GS = GameState;

  const STANCES = {
    rear: {
      name: 'Command from the rear',
      short: 'Rear',
      radiusMult: 1,
      cooldownMult: 0.6,
      desc: 'orders recharge 40% faster',
    },
    front: {
      name: 'Lead from the front',
      short: 'Front',
      radiusMult: 1.3,
      cooldownMult: 1,
      desc: 'his reach is 30% wider, and the enemy goes for him',
    },
  };

  const MOVE_ORDERS = {
    advance: {
      name: 'Advance',
      cooldown: 20 * 60,
      desc: 'soldiers in his reach step forward one rank',
    },
    fall_back: {
      name: 'Fall Back',
      cooldown: 20 * 60,
      desc: 'soldiers in his reach withdraw to the muster line, healers first',
    },
  };

  /** One rank of the line, in field pixels. */
  const RANK = 44;
  const BASE_RADIUS = 190;
  const MARK_TAKEN_MULT = 1.25;
  const INK = '#120808';
  const BONE = '#e8dcc0';
  const BLOOD = '#a01818';

  let stance = 'rear';
  let ready = { advance: 0, fall_back: 0 };
  let hadGeneral = false;
  let fallen = false;
  let lastGeneral = null;
  /** The wave whose strongest foe gets marked (Mark the Warlord), 0 when none. */
  let warlordWave = 0;
  /** Turncoats: the wave they are bought in, and how many have yet to change sides. */
  let turncoatWave = 0;
  let turncoatsLeft = 0;
  let pulses = [];

  function resetRun() {
    stance = 'rear';
    ready = { advance: 0, fall_back: 0 };
    hadGeneral = false;
    fallen = false;
    lastGeneral = null;
    warlordWave = 0;
    turncoatWave = 0;
    turncoatsLeft = 0;
    pulses = [];
    GS.courierRide = null;
    GS.sortie = null;
  }

  function general() {
    for (const u of GS.units) {
      if (u.team === 'player' && u.hp > 0 && u.isGeneral) return u;
    }
    return null;
  }

  function orderRadius(base = BASE_RADIUS) {
    return Math.round(base * STANCES[stance].radiusMult);
  }

  function cooldownMult() {
    return STANCES[stance].cooldownMult;
  }

  /** Why the bar is greyed out, or '' when the General can give orders. */
  function lostReason() {
    if (general()) return '';
    return fallen
      ? 'The General has fallen. Promote a veteran footman to restore the orders.'
      : 'No General on the field.';
  }

  function say(hooks, text, ticks = 200) {
    hooks?.showMessage?.(text, ticks);
  }

  function float(x, y, text, color) {
    GameCore.svc('FloatingText')?.status?.(x, y, text, color);
  }

  function inReach(u, gen, r) {
    if (u === gen || u.team !== 'player' || u.hp <= 0) return false;
    if (!u.canHunt && u.combatType !== 'healer') return false;
    if (u.garrisoned || u.wallGarrisoned || u.stationedKeep || u.onExpedition) return false;
    return (u.x - gen.x) ** 2 + (u.y - gen.y) ** 2 <= r * r;
  }

  function moveOrder(kind, hooks) {
    const def = MOVE_ORDERS[kind];
    const gen = general();
    if (!gen) {
      say(hooks, lostReason(), 160);
      return false;
    }
    const tick = GS.updateTick;
    if (tick < ready[kind]) {
      say(hooks, `${def.name}: ready in ${Math.ceil((ready[kind] - tick) / 60)}s.`, 120);
      return false;
    }
    const r = orderRadius();
    const line = GS.rallyY;
    let men = GS.units.filter((u) => inReach(u, gen, r));
    if (kind === 'fall_back') men = men.filter((u) => u.y < line - 10);
    if (!men.length) {
      say(
        hooks,
        kind === 'fall_back'
          ? 'Nobody in his reach stands ahead of the muster line.'
          : 'No soldiers in the General’s reach.',
        160
      );
      return false;
    }
    // Healers get their orders first so they are not left behind the line.
    men.sort((a, b) => (b.combatType === 'healer') - (a.combatType === 'healer'));
    const move = GameMovement.orderMove;
    for (let i = 0; i < men.length; i++) {
      const u = men[i];
      const y = kind === 'advance' ? u.y - RANK : line + ((i % 5) - 2) * 6;
      move(u, u.x, y, true, { hold: 'keep' });
    }
    if (kind === 'advance') move(gen, gen.x, gen.y - RANK, true, { hold: 'keep' });
    else if (gen.y < line - 10) move(gen, gen.x, line + 12, true, { hold: 'keep' });
    ready[kind] = tick + Math.round(def.cooldown * cooldownMult());
    float(gen.x, gen.y - 30, def.name.toUpperCase(), BONE);
    pulses.push({ x: gen.x, y: gen.y, max: r, age: 0 });
    hooks?.playSfx?.('holdLine');
    say(
      hooks,
      kind === 'advance'
        ? `Advance: ${men.length} soldiers step forward one rank.`
        : `Fall back: ${men.length} soldiers withdraw to the muster line.`
    );
    return true;
  }

  function setStance(next, hooks) {
    if (!STANCES[next]) return false;
    stance = next;
    const gen = general();
    if (gen) {
      gen.leadsFromFront = stance === 'front';
      float(gen.x, gen.y - 30, STANCES[stance].short.toUpperCase(), BONE);
    }
    say(hooks, `${STANCES[stance].name}: ${STANCES[stance].desc}.`, 180);
    return true;
  }

  function promote(hooks) {
    if (general()) {
      say(hooks, 'The army already has a General.', 140);
      return false;
    }
    if (!fallen) {
      say(hooks, 'Promotion in the field is for a fallen General.', 140);
      return false;
    }
    const vet = findPromotableFootman(GS.units);
    if (!vet) {
      say(hooks, 'No veteran footman to promote: he needs a rank star or a name.', 200);
      return false;
    }
    promoteFootmanToGeneral(vet);
    vet.leadsFromFront = stance === 'front';
    fallen = false;
    float(vet.x, vet.y - 30, 'GENERAL', '#ffd700');
    pulses.push({ x: vet.x, y: vet.y, max: orderRadius(), age: 0 });
    say(hooks, `${vet.honorName || 'A veteran'} takes command. The order bar is back.`, 260);
    return true;
  }

  /** One entry for the bar, hotkeys and Game.executeDoctrine. */
  function issue(id, hooks) {
    if (id === 'war_cry' || id === 'warCry') return !!SiegeLoop.order('warCry');
    if (id === 'hold_line' || id === 'holdLine') return !!SiegeLoop.order('holdLine');
    if (MOVE_ORDERS[id]) return moveOrder(id, hooks);
    if (id === 'stance') return setStance(stance === 'rear' ? 'front' : 'rear', hooks);
    if (id === 'promote') return promote(hooks);
    say(hooks, 'Unknown order.', 120);
    return false;
  }

  function markWarlord(wave) {
    warlordWave = wave;
  }

  /** 3 to 5 of the wave's common soldiers, more as the waves grow. */
  function buyTurncoats(wave) {
    turncoatWave = wave;
    turncoatsLeft = Math.min(5, 3 + Math.floor(wave / 20));
    return turncoatsLeft;
  }

  function isRabble(u) {
    if (u.isNamedBoss || u.isBoss) return false;
    if (typeof isEliteEnemy === 'function' && isEliteEnemy(u)) return false;
    return true;
  }

  /** At the line the bought man walks out of the host and takes up a footman's place. */
  function turnCoat(u, hooks) {
    u.hp = 0;
    u.fledBattle = true;
    u.turnedCoat = true;
    const f = GameArmy.spawnUnit('footman', u.x, u.y, 'player');
    f.targetY = GS.rallyY;
    f.turncoat = true;
    GS.units.push(f);
    float(u.x, u.y - 24, 'TURNCOAT', BONE);
    pulses.push({ x: u.x, y: u.y, max: 40, age: 0 });
    GameCore.svc('Particles')?.dust?.(u.x, u.y);
    turncoatsLeft--;
    if (!turncoatsLeft) say(hooks, 'The last of the bought men has crossed to your side.', 200);
  }

  /** The boss first, then the toughest elite; any foe once the whole host is on the field. */
  function pickWarlord() {
    let best = null;
    let bestScore = -1;
    const queueEmpty = !(GS.spawnQueue && GS.spawnQueue.length);
    for (const u of GS.units) {
      if (u.team !== 'enemy' || u.hp <= 0) continue;
      const boss = typeof isNamedBoss === 'function' && isNamedBoss(u);
      const elite = typeof isEliteEnemy === 'function' && isEliteEnemy(u);
      if (!boss && !elite && !queueEmpty) continue;
      const score = (boss ? 1e6 : elite ? 1e5 : 0) + (u.maxHp || 0);
      if (score > bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  }

  function tick(hooks) {
    const gen = general();
    if (gen) {
      hadGeneral = true;
      fallen = false;
      gen.leadsFromFront = stance === 'front';
      lastGeneral = { x: gen.x, y: gen.y };
    } else if (hadGeneral && !fallen) {
      fallen = true;
      if (lastGeneral) {
        float(lastGeneral.x, lastGeneral.y - 30, 'THE GENERAL FALLS', BLOOD);
        pulses.push({ x: lastGeneral.x, y: lastGeneral.y, max: orderRadius(), age: 0, blood: 1 });
      }
      say(hooks, 'The General has fallen. His orders are lost until a veteran is promoted.', 320);
    }
    if (warlordWave) {
      if (GS.wave > warlordWave) warlordWave = 0;
      else if (GS.wave === warlordWave && GS.timeOfDay !== 'night' && GS.updateTick % 15 === 0) {
        const w = pickWarlord();
        if (w) {
          w.warlordMarked = true;
          warlordWave = 0;
          float(w.x, w.y - 30, 'MARKED', BLOOD);
        }
      }
    }
    if (turncoatWave) {
      if (GS.wave > turncoatWave || !turncoatsLeft) {
        turncoatWave = 0;
        turncoatsLeft = 0;
      } else if (GS.wave === turncoatWave && GS.timeOfDay !== 'night' && GS.updateTick % 10 === 0) {
        for (const u of GS.units) {
          if (!turncoatsLeft) break;
          if (u.team !== 'enemy' || u.hp <= 0 || u.y < GS.rallyY - 50 || !isRabble(u)) continue;
          turnCoat(u, hooks);
        }
      }
    }
    for (const p of pulses) p.age++;
    if (pulses.length) pulses = pulses.filter((p) => p.age < 40);
  }

  // ------------------------------------------------------------------ field drawing
  function label(c, text, x, y, color) {
    c.font = 'bold 12px Georgia, serif';
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  function sectorCentre(sector) {
    const order = (typeof MultiFrontSiege !== 'undefined' && MultiFrontSiege.SECTORS) || [
      'left',
      'centre',
      'right',
    ];
    const i = Math.max(0, order.indexOf(sector));
    return ((i + 0.5) * GS.worldW) / order.length;
  }

  function busiestSector(plan) {
    let best = 'centre';
    let n = -1;
    for (const s of plan?.sectors || []) {
      if ((plan.counts?.[s] ?? 0) > n) {
        n = plan.counts?.[s] ?? 0;
        best = s;
      }
    }
    return best;
  }

  function drawAura(c, gen, px, tickNow) {
    const r = orderRadius();
    const front = stance === 'front';
    c.save();
    c.setLineDash([10 * px, 7 * px]);
    c.lineDashOffset = -tickNow * 0.3 * px;
    c.lineWidth = 2 * px;
    c.strokeStyle = front ? 'rgba(160, 24, 24, 0.55)' : 'rgba(232, 220, 192, 0.45)';
    c.beginPath();
    c.arc(gen.x, gen.y, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawDaggers(c, x, y, px) {
    c.save();
    c.lineCap = 'round';
    for (const [w, col] of [
      [5 * px, INK],
      [2.4 * px, BLOOD],
    ]) {
      c.lineWidth = w;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(x - 9, y - 9);
      c.lineTo(x + 9, y + 9);
      c.moveTo(x + 9, y - 9);
      c.lineTo(x - 9, y + 9);
      c.stroke();
    }
    c.restore();
  }

  /** World-space pass, called from js/game-render.js after the ground. */
  function drawField(c, tickNow, isInView) {
    if (!c) return;
    const px = 1 / Math.max(0.5, GS.viewScale || 1);
    const gen = general();
    if (gen && isInView(gen.x, gen.y, orderRadius() + 10)) drawAura(c, gen, px, tickNow);
    for (const p of pulses) {
      const k = p.age / 40;
      c.strokeStyle = p.blood
        ? `rgba(160, 24, 24, ${1 - k})`
        : `rgba(232, 220, 192, ${0.8 * (1 - k)})`;
      c.lineWidth = 3 * px;
      c.beginPath();
      c.arc(p.x, p.y, p.max * (0.3 + 0.7 * k), 0, Math.PI * 2);
      c.stroke();
    }
    const night = GS.timeOfDay === 'night';
    const plan = GS.nextWavePlan && GS.nextWavePlan.wave === GS.wave + 1 ? GS.nextWavePlan : null;
    if (night && (GS.pendingWaveMods?.softenShare || 0) > 0) {
      const x = sectorCentre(busiestSector(plan));
      drawDaggers(c, x, 74, px);
      label(c, 'AMBUSH', x, 100, BONE);
    }
    if (night && turncoatWave === GS.wave + 1 && turncoatsLeft) {
      label(c, `${turncoatsLeft} TURNCOATS IN THE HOST`, GS.worldW / 2, 150, BONE);
    }
    if (night && plan && GS.scoutedWave === GS.wave + 1) {
      for (const s of plan.sectors || []) {
        label(c, `${plan.counts?.[s] ?? 0} COMING`, sectorCentre(s), 24, BLOOD);
      }
    }
    for (const u of GS.units) {
      if (!u.warlordMarked || u.hp <= 0 || !isInView(u.x, u.y, 40)) continue;
      const r = (u.radius || 12) + 8 + Math.sin(tickNow * 0.12) * 2;
      c.lineWidth = 4 * px;
      c.strokeStyle = INK;
      c.beginPath();
      c.arc(u.x, u.y, r, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2 * px;
      c.strokeStyle = BLOOD;
      c.stroke();
    }
    const so = GS.sortie;
    if (so && so.phase === 'fight') {
      const men = GS.units.filter((u) => so.unitIds.includes(u.id) && u.hp > 0);
      const x = men.length ? men.reduce((a, u) => a + u.x, 0) / men.length : GS.worldW / 2;
      c.lineWidth = 3 * px;
      c.strokeStyle = `rgba(160, 24, 24, ${0.5 + 0.3 * Math.sin(tickNow * 0.2)})`;
      c.beginPath();
      c.arc(x, 46, 54, 0, Math.PI * 2);
      c.stroke();
      label(c, 'SORTIE', x, 118, BLOOD);
    }
    const ride = GS.courierRide;
    if (ride && ride.phase === 'away') {
      const left = Math.max(0, Math.ceil((ride.awayTicks - ride.t) / 60));
      label(c, `COURIER BACK IN ${left}s`, ride.homeX, GS.worldH - 18, BONE);
    }
  }

  // ------------------------------------------------------------------ the bar (DOM)
  const BAR = [
    ['go-advance', 'advance'],
    ['go-fallback', 'fall_back'],
    ['go-stance', 'stance'],
    ['go-promote', 'promote'],
  ];

  function ensureBar() {
    if (typeof document === 'undefined' || !document.getElementById) return null;
    const strip = document.getElementById('siege-strip');
    if (!strip) return null;
    if (!document.getElementById('go-advance')) {
      // Right after Hold the Line: the edicts chip follows it in the strip.
      const edicts = document.getElementById('siege-edicts');
      for (const [id, order] of BAR) {
        const b = document.createElement('button');
        b.id = id;
        b.className = 'siege-order';
        b.dataset.order = order;
        b.addEventListener('click', () => {
          if (typeof Game !== 'undefined') Game.executeDoctrine?.(order);
        });
        strip.insertBefore(b, edicts && edicts.parentNode === strip ? edicts : null);
      }
    }
    return strip;
  }

  /** Called from SiegeLoop's HUD sync; `hidden` is the introduction's gate on orders. */
  function syncBar(ctx, hidden) {
    try {
      if (!ensureBar()) return;
    } catch (_) {
      return;
    }
    const gen = general();
    const lost = lostReason();
    const tickNow = ctx?.tick ?? GS.updateTick;
    for (const [id, order] of BAR) {
      const b = document.getElementById(id);
      if (!b) continue;
      if (order === 'promote') {
        b.hidden = hidden || !fallen || !!gen;
        const vet = findPromotableFootman(GS.units);
        b.disabled = !vet;
        b.textContent = 'Promote a veteran';
        b.title = vet
          ? `${vet.honorName || 'A veteran footman'} takes command.`
          : 'No veteran footman: he needs a rank star or a name.';
        continue;
      }
      b.hidden = hidden;
      if (order === 'stance') {
        const st = STANCES[stance];
        b.disabled = !gen;
        b.textContent = `Stance: ${st.short}`;
        b.title = gen ? `${st.name}: ${st.desc}. Click to switch.` : lost;
        continue;
      }
      const def = MOVE_ORDERS[order];
      const wait = Math.ceil((ready[order] - tickNow) / 60);
      b.disabled = !gen || wait > 0;
      b.textContent = wait > 0 && gen ? `${def.name} ${wait}s` : def.name;
      b.title = gen ? `${def.name}: ${def.desc}.` : lost;
    }
  }

  function getState() {
    return {
      stance,
      ready: { ...ready },
      fallen,
      hadGeneral,
      warlordWave,
      turncoatWave,
      turncoatsLeft,
      radius: orderRadius(),
      cooldownMult: cooldownMult(),
    };
  }

  // Run state in saves: see js/save-registry.js.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('GeneralOrders', {
      save: () => ({
        stance,
        ready: { ...ready },
        hadGeneral,
        fallen,
        warlordWave,
        turncoatWave,
        turncoatsLeft,
        courierRide: GS.courierRide ? { ...GS.courierRide } : null,
        sortie: GS.sortie ? JSON.parse(JSON.stringify(GS.sortie)) : null,
      }),
      load(data) {
        resetRun();
        if (!data) {
          // Saves from before the courier rode: no ride is under way.
          if (GS.courierCooldown > 600) GS.courierCooldown = 0;
          return;
        }
        if (STANCES[data.stance]) stance = data.stance;
        for (const k of Object.keys(ready)) {
          if (Number.isFinite(data.ready?.[k])) ready[k] = data.ready[k];
        }
        hadGeneral = !!data.hadGeneral;
        fallen = !!data.fallen;
        if (Number.isFinite(data.warlordWave)) warlordWave = data.warlordWave;
        if (Number.isFinite(data.turncoatWave)) turncoatWave = data.turncoatWave;
        if (Number.isFinite(data.turncoatsLeft)) turncoatsLeft = data.turncoatsLeft;
        if (data.sortie && Array.isArray(data.sortie.unitIds)) GS.sortie = data.sortie;
        const ride = data.courierRide;
        if (ride && typeof ride === 'object' && CourierMessages[ride.msg]) {
          GS.courierRide = { ...ride };
        } else if (GS.courierCooldown > 600) {
          GS.courierCooldown = 0;
        }
      },
    });
  }

  return {
    STANCES,
    MOVE_ORDERS,
    RANK,
    MARK_TAKEN_MULT,
    resetRun,
    orderRadius,
    cooldownMult,
    lostReason,
    issue,
    setStance,
    promote,
    markWarlord,
    buyTurncoats,
    tick,
    drawField,
    syncBar,
    getState,
  };
})();

globalThis.GeneralOrders = GeneralOrders;
