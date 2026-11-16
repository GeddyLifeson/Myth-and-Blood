/**
 * RunPath: the one path the player picks for a run (Martial, Arcane or Mythic).
 *
 * At wave CHOICE_WAVE the PATH chip offers the three paths. The pick lasts the run and
 * grants five steps by wave 40, each a plain health, damage or morale bonus for that
 * path's soldiers. Steps reach soldiers already on the field as well as new recruits
 * (applyUnit tracks the step each unit has received). Finishing the path crystallizes
 * its Crown of Ages seed (js/foundational-medieval-layer.js).
 *
 * This replaced eight layers that stacked hidden bonuses at spawn; EternalPathFramework
 * stays as an alias and the other old globals are no-op shells in their own files.
 */
const RunPath = (() => {
  const CHOICE_WAVE = 5;

  const MARTIAL_TYPES = new Set([
    'footman',
    'archer',
    'pikeman',
    'knight',
    'paladin',
    'general',
    'ballista',
    'scout',
  ]);
  const ARCANE_TYPES = new Set(['mage', 'wizard', 'warlock', 'cleric', 'elemental', 'healer']);
  const TECH_TYPES = new Set(['builder', 'sapper', 'ballista']);

  const PATHS = {
    martial: {
      id: 'martial',
      label: 'Martial',
      color: '#68a878',
      who: 'footmen, pikemen, archers, knights, paladins, generals, scouts and ballistae',
      foundation: 'longbow_legacy',
      steps: [
        { wave: 5, name: 'Drilled', hp: 0.1 },
        { wave: 12, name: 'Volley Drill', dmg: 0.1 },
        { wave: 20, name: 'Shield Wall', hp: 0.1 },
        { wave: 30, name: 'Old Sergeants', dmg: 0.1 },
        { wave: 40, name: 'Iron Ranks', hp: 0.15 },
      ],
    },
    arcane: {
      id: 'arcane',
      label: 'Arcane',
      color: '#9070f0',
      who: 'mages, wizards, warlocks, clerics, elementals and healers',
      foundation: 'arcane_dominion',
      steps: [
        { wave: 5, name: 'Ward Ink', hp: 0.1 },
        { wave: 12, name: 'Sharpened Sigils', dmg: 0.1 },
        { wave: 20, name: 'Blood Script', dmg: 0.1 },
        { wave: 30, name: 'Deep Wards', hp: 0.15 },
        { wave: 40, name: 'Last Rite', dmg: 0.15 },
      ],
    },
    mythic: {
      id: 'mythic',
      label: 'Mythic',
      color: '#e8b050',
      who: 'heroes and champions',
      foundation: 'mythic_alliance',
      steps: [
        { wave: 5, name: 'Named Blood', hp: 0.1 },
        { wave: 12, name: 'Saga', morale: 20 },
        { wave: 20, name: 'Godsworn', dmg: 0.1 },
        { wave: 30, name: 'Legend', hp: 0.15 },
        { wave: 40, name: 'Myth Made Flesh', dmg: 0.15 },
      ],
    },
  };
  const PATH_IDS = Object.keys(PATHS);

  let state = null;
  let lastCtx = {};

  function resetRun() {
    state = { chosen: null, stepsReached: 0, crystallized: false };
  }

  function isHeroType(type) {
    if (!type) return false;
    if (type === 'doomslayer_hero') return true;
    if (typeof isCompanyHeroUnit === 'function' && isCompanyHeroUnit(type)) return true;
    return typeof isChampionUnit === 'function' && isChampionUnit(type);
  }

  /** Family a unit type belongs to; 'tech' only for achievements (not a pickable path). */
  function getPathForUnit(unitType, unit = {}) {
    if (!unitType) return null;
    if (isHeroType(unitType) || unit.honorName) return 'mythic';
    if (MARTIAL_TYPES.has(unitType)) return 'martial';
    if (ARCANE_TYPES.has(unitType)) return 'arcane';
    if (TECH_TYPES.has(unitType)) return 'tech';
    return null;
  }

  function stepText(s) {
    const parts = [];
    if (s.hp) parts.push(`+${Math.round(s.hp * 100)}% health`);
    if (s.dmg) parts.push(`+${Math.round(s.dmg * 100)}% damage`);
    if (s.morale) parts.push(`+${s.morale} morale on joining`);
    return parts.join(', ');
  }

  function reachedCount(pathId, wave) {
    if (!PATHS[pathId]) return 0;
    return PATHS[pathId].steps.filter((s) => (wave | 0) >= s.wave).length;
  }

  function totals(pathId, n) {
    const out = { hp: 0, dmg: 0, morale: 0 };
    for (const s of (PATHS[pathId]?.steps || []).slice(0, n)) {
      out.hp += s.hp || 0;
      out.dmg += s.dmg || 0;
      out.morale += s.morale || 0;
    }
    return out;
  }

  function currentWave() {
    return globalThis.GameState?.wave | 0;
  }

  /** Bring one soldier up to the steps reached so far. Safe to call any number of times. */
  function applyUnit(u) {
    if (!state?.chosen || !u || u.team !== 'player' || u.hp <= 0) return false;
    if (getPathForUnit(u.type, u) !== state.chosen) return false;
    const have = u.runPathStep | 0;
    const want = state.stepsReached;
    if (have >= want) return false;
    const before = totals(state.chosen, have);
    const after = totals(state.chosen, want);
    const hpRatio = (1 + after.hp) / (1 + before.hp);
    const dmgRatio = (1 + after.dmg) / (1 + before.dmg);
    if (hpRatio !== 1 && u.maxHp) {
      const frac = u.hp / u.maxHp;
      u.maxHp = Math.round(u.maxHp * hpRatio);
      u.hp = Math.max(1, Math.round(u.maxHp * frac));
    }
    if (dmgRatio !== 1 && u.damage) u.damage = Math.round(u.damage * dmgRatio);
    const moraleGain = after.morale - before.morale;
    if (moraleGain > 0 && Number.isFinite(u.morale)) {
      u.morale = Math.min(u.maxMorale ?? 100, u.morale + moraleGain);
    }
    u.runPathStep = want;
    return true;
  }

  function applyAll(units) {
    for (const u of units || globalThis.GameState?.units || []) applyUnit(u);
  }

  function syncSteps(wave, ctx = {}) {
    if (!state.chosen) return;
    const path = PATHS[state.chosen];
    const n = reachedCount(state.chosen, wave);
    if (n <= state.stepsReached) return;
    const fresh = path.steps.slice(state.stepsReached, n);
    state.stepsReached = n;
    applyAll(ctx.units);
    for (const s of fresh) {
      ctx.showMessage?.(
        `${path.label} path: ${s.name}. ${path.label} soldiers ${stepText(s)}.`,
        260
      );
    }
    if (n === path.steps.length && !state.crystallized) {
      state.crystallized = true;
      globalThis.FoundationalMedievalLayer?.markCrystallized?.(path.foundation);
      ctx.showMessage?.(
        `The ${path.label} path is complete. Its seed takes root in the Crown of Ages.`,
        320
      );
    }
  }

  function canChoose(wave = currentWave()) {
    return (
      !!state && !state.chosen && (wave | 0) >= CHOICE_WAVE && !globalThis.GameState?.creativeMode
    );
  }

  function choose(pathId, ctx = {}) {
    const wave = ctx.wave ?? currentWave();
    if (!PATHS[pathId]) return { ok: false, msg: 'No such path.' };
    if (state.chosen)
      return { ok: false, msg: `The ${PATHS[state.chosen].label} path is already chosen.` };
    if (!canChoose(wave)) return { ok: false, msg: `Paths open at wave ${CHOICE_WAVE}.` };
    state.chosen = pathId;
    state.stepsReached = 0;
    syncSteps(wave, { ...lastCtx, ...ctx });
    closeCard();
    return { ok: true };
  }

  function onWaveStart(wave, ctx = {}) {
    if (!state || ctx.creative) return;
    lastCtx = { showMessage: ctx.showMessage, addHighlight: ctx.addHighlight };
    if (canChoose(wave) && (wave | 0) === CHOICE_WAVE) {
      ctx.showMessage?.('Choose your path: click PATH at the top.', 300);
      openCard();
    }
    syncSteps(wave, ctx);
  }

  function getHud(wave = currentWave()) {
    if (!state) return null;
    if (!state.chosen) {
      const open = canChoose(wave);
      return {
        text: open ? 'Choose' : `Wave ${CHOICE_WAVE}`,
        locked: !open,
        pending: open,
        color: null,
        title: open
          ? 'Click to pick Martial, Arcane or Mythic. The pick lasts the run.'
          : `Locked until wave ${CHOICE_WAVE}: then you pick Martial, Arcane or Mythic for the run.`,
      };
    }
    const path = PATHS[state.chosen];
    const n = state.stepsReached;
    const t = totals(state.chosen, n);
    const lines = [`${path.label} path: helps ${path.who}.`];
    path.steps.forEach((s, i) => {
      const mark = i < n ? 'Has' : `Wave ${s.wave}`;
      lines.push(`${mark}: ${s.name}, ${stepText(s)}`);
    });
    lines.push(`Now: ${stepText(t) || 'nothing yet'}.`);
    return {
      text: `${path.label} ${n}/${path.steps.length}`,
      locked: false,
      pending: false,
      color: path.color,
      title: lines.join('\n'),
    };
  }

  function formatHudLine(ctx = {}) {
    return getHud(ctx.wave ?? currentWave())?.text || '';
  }

  function formatIntelNote(ctx = {}) {
    const wave = ctx.wave ?? currentWave();
    if (!state) return '';
    if (!state.chosen) return canChoose(wave) ? 'Path: not chosen yet' : '';
    const next = PATHS[state.chosen].steps[state.stepsReached];
    return next ? `Path: ${next.name} at wave ${next.wave}` : '';
  }

  function getStateSnapshot(ctx = {}) {
    if (!state) return null;
    const hud = getHud(ctx.wave ?? currentWave());
    return {
      chosen: state.chosen,
      stepsReached: state.stepsReached,
      dominantPathId: state.chosen,
      dominantLabel: state.chosen ? PATHS[state.chosen].label : null,
      dominantColor: state.chosen ? PATHS[state.chosen].color : null,
      hudLine: hud?.text || '',
      hud,
    };
  }

  // Choice card: built in code so the module needs no markup in index.html.
  let card = null;
  function closeCard() {
    card?.remove();
    card = null;
  }

  function openCard() {
    if (typeof document === 'undefined' || !document.createElement || card) return;
    if (!canChoose()) return;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    card = document.createElement('div');
    card.id = 'run-path-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Choose your path');
    card.innerHTML = `
      <style>
        #run-path-card{position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:900;
          width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;
          background:#0b0809;color:#ece4d0;border:2px solid #c8202a;padding:12px 14px;
          font:13px/1.35 Georgia,serif;box-shadow:0 0 0 1px #000,0 8px 24px #000}
        #run-path-card h2{margin:0 0 4px;font-size:16px;letter-spacing:.06em;color:#c8202a}
        #run-path-card .rp-cols{display:flex;gap:10px;flex-wrap:wrap}
        #run-path-card .rp-col{flex:1 1 200px;border:1px solid #4a3a30;padding:8px}
        #run-path-card .rp-col h3{margin:0 0 2px;font-size:15px}
        #run-path-card ol{margin:6px 0;padding-left:18px;color:#b0a492}
        #run-path-card button{font:inherit;background:#1a1012;color:#ece4d0;border:1px solid #c8202a;
          padding:6px 10px;cursor:pointer;min-height:36px;width:100%}
        #run-path-card button:hover,#run-path-card button:focus-visible{background:#c8202a;color:#0b0809}
        #run-path-card .rp-later{width:auto;margin-top:8px;border-color:#4a3a30}
      </style>
      <h2>CHOOSE YOUR PATH</h2>
      <div>One path for the whole run. Steps arrive by wave 40 and reach soldiers already in the field.</div>
      <div class="rp-cols">${PATH_IDS.map((id) => {
        const p = PATHS[id];
        return `<div class="rp-col" style="border-top:3px solid ${p.color}">
          <h3 style="color:${p.color}">${esc(p.label)}</h3><div>Helps ${esc(p.who)}.</div>
          <ol>${p.steps.map((s) => `<li>Wave ${s.wave}: ${esc(s.name)}, ${esc(stepText(s))}</li>`).join('')}</ol>
          <button type="button" data-path="${id}">Take the ${esc(p.label)} path</button></div>`;
      }).join('')}</div>
      <button type="button" class="rp-later" data-path="">Decide later</button>`;
    card.addEventListener('click', (ev) => {
      const btn = ev.target.closest?.('button[data-path]');
      if (!btn) return;
      if (btn.dataset.path) choose(btn.dataset.path);
      else closeCard();
    });
    document.body.appendChild(card);
  }

  function bindChip() {
    const chip = document.getElementById('epf-hud');
    if (!chip || chip.dataset.runPathBound) return;
    chip.dataset.runPathBound = '1';
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', () => (card ? closeCard() : openCard()));
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindChip);
    else bindChip();
  }

  resetRun();

  // Run state in saves: see js/save-registry.js. Version 1 was the old investment tally.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('EternalPathFramework', {
      version: 2,
      save: () => ({ state }),
      load(data) {
        resetRun();
        if (data?.state && PATHS[data.state.chosen]) {
          state.chosen = data.state.chosen;
          state.stepsReached = Math.max(0, Math.min(5, data.state.stepsReached | 0));
          state.crystallized = !!data.state.crystallized;
        }
      },
      // Old runs never chose a path: they get the choice at their next wave start.
      migrate: () => ({ state: { chosen: null, stepsReached: 0, crystallized: false } }),
    });
  }

  return {
    CHOICE_WAVE,
    PATHS,
    PATH_IDS,
    resetRun,
    getPathForUnit,
    canChoose,
    choose,
    applyUnit,
    onWaveStart,
    getHud,
    getStateSnapshot,
    formatHudLine,
    formatIntelNote,
    openCard,
    closeCard,
  };
})();

// The old name; callers (achievements, morale, waves, HUD) still use it.
const EternalPathFramework = RunPath;

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.RunPath = RunPath;
globalThis.EternalPathFramework = EternalPathFramework;
