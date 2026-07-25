/**
 * Mod loader — JSON packs + optional scripts for custom units and buildings.
 * Drop folders under mods/ and list them in mods/manifest.json.
 */
const ModAPI = (() => {
  const hooks = { onLoad: [], onGameStart: [] };

  function onLoad(fn) {
    if (typeof fn === 'function') hooks.onLoad.push(fn);
  }

  function onGameStart(fn) {
    if (typeof fn === 'function') hooks.onGameStart.push(fn);
  }

  function registerUnitStyle(type, style) {
    if (typeof SpriteGen !== 'undefined' && SpriteGen.registerUnitStyle) {
      SpriteGen.registerUnitStyle(type, style);
    } else if (typeof SpriteGen !== 'undefined' && SpriteGen.UNIT_STYLE) {
      SpriteGen.UNIT_STYLE[type] = style;
    }
  }

  function getUnitDefs() {
    return typeof UnitDefs !== 'undefined' ? UnitDefs : {};
  }

  function getBuildDefs() {
    return typeof BuildDefs !== 'undefined' ? BuildDefs : {};
  }

  function _run(hookName, modId, ctx) {
    for (const fn of hooks[hookName]) {
      try {
        fn({ modId, api: ModAPI, ctx });
      } catch (err) {
        console.warn(`[ModAPI] ${hookName} hook failed (${modId}):`, err);
      }
    }
  }

  return {
    onLoad,
    onGameStart,
    registerUnitStyle,
    getUnitDefs,
    getBuildDefs,
    _run,
    _reset() {
      hooks.onLoad.length = 0;
      hooks.onGameStart.length = 0;
    },
  };
})();

const ModLoader = (() => {
  const STORAGE_KEY = 'myth-and-blood-mods-v1';
  const MODS_BASE = 'mods/';

  const UNIT_REQUIRED = [
    'name',
    'cost',
    'hp',
    'accuracy',
    'damage',
    'range',
    'meleeRange',
    'speed',
    'type',
    'morale',
    'experience',
  ];

  const BUILDING_REQUIRED = ['name', 'cost', 'hp', 'radius', 'buildTime'];

  const UNIT_TYPES = new Set(['melee', 'ranged', 'healer', 'cavalry', 'builder', 'courier', 'general']);

  let catalog = [];
  let enabled = [];
  let loaded = new Map();
  let lastErrors = [];
  let ready = false;

  function loadEnabledFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        enabled = Array.isArray(data.enabled) ? data.enabled : [];
      }
    } catch (_) {
      enabled = [];
    }
  }

  function saveEnabled() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }));
    } catch (_) {
      /* ignore */
    }
  }

  function getEnabled() {
    return [...enabled];
  }

  function getCatalog() {
    return catalog.map((e) => ({ ...e }));
  }

  function getLoaded() {
    return [...loaded.values()].map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      units: m.unitIds.length,
      buildings: m.buildingIds.length,
      errors: m.errors,
    }));
  }

  function getErrors() {
    return [...lastErrors];
  }

  function isReady() {
    return ready;
  }

  function isModUnit(type) {
    const def = UnitDefs?.[type];
    return !!def?.modId;
  }

  function isModBuilding(type) {
    const def = BuildDefs?.[type];
    return !!def?.modId;
  }

  function validateUnit(id, def, modId) {
    const missing = UNIT_REQUIRED.filter((k) => def[k] == null);
    if (missing.length) throw new Error(`units.${id} missing: ${missing.join(', ')}`);
    if (!UNIT_TYPES.has(def.type))
      throw new Error(`units.${id}.type must be one of: ${[...UNIT_TYPES].join(', ')}`);
    if (typeof def.cost !== 'number' || def.cost < 0)
      throw new Error(`units.${id}.cost must be a non-negative number`);
  }

  function validateBuilding(id, def, modId) {
    const missing = BUILDING_REQUIRED.filter((k) => def[k] == null);
    if (missing.length) throw new Error(`buildings.${id} missing: ${missing.join(', ')}`);
    if (def.blocksMove == null) def.blocksMove = false;
    if (def.blocksLOS == null) def.blocksLOS = false;
    if (def.cover == null) def.cover = 0.3;
  }

  function applySprite(def, type) {
    if (!def?.sprite || typeof def.sprite !== 'object') return;
    ModAPI.registerUnitStyle(type, def.sprite);
  }

  function stripMeta(def) {
    const out = { ...def };
    delete out.sprite;
    delete out.overwrite;
    return out;
  }

  function removeModFromDefs(modId) {
    if (typeof UnitDefs !== 'undefined') {
      for (const id of Object.keys(UnitDefs)) {
        if (UnitDefs[id]?.modId === modId) delete UnitDefs[id];
      }
    }
    if (typeof BuildDefs !== 'undefined') {
      for (const id of Object.keys(BuildDefs)) {
        if (BuildDefs[id]?.modId === modId) delete BuildDefs[id];
      }
    }
  }

  function clearHudForMod(modId) {
    document
      .querySelectorAll(`[data-mod-id="${modId}"]`)
      .forEach((el) => el.remove());
    const deploySec = document.getElementById('mod-deploy-section');
    const buildSec = document.getElementById('mod-build-section');
    if (deploySec && !deploySec.querySelector('.deploy-btn')) {
      deploySec.hidden = true;
      deploySec.replaceChildren();
    }
    if (buildSec && !buildSec.querySelector('.build-btn')) {
      buildSec.hidden = true;
      buildSec.replaceChildren();
    }
  }

  /**
   * Reveal a mod HUD section, add its panel header once, then append one button
   * per id that is not already present. Shared by the deploy and build sections.
   */
  function injectHudSection(sectionId, headerText, ids, modId, cfg) {
    const sec = document.getElementById(sectionId);
    if (!sec) return;
    sec.hidden = false;
    if (!sec.querySelector('.panel-header')) {
      const hdr = document.createElement('div');
      hdr.className = 'panel-header';
      hdr.textContent = headerText;
      sec.appendChild(hdr);
    }
    for (const id of ids) {
      if (sec.querySelector(`[data-${cfg.datasetKey}="${id}"]`)) continue;
      const def = cfg.defs()[id];
      if (!def) continue;
      const btn = document.createElement('button');
      btn.className = cfg.className;
      btn.dataset[cfg.datasetKey] = id;
      btn.dataset.mod = '1';
      btn.dataset.modId = modId;
      btn.innerHTML = cfg.markup(id, def);
      sec.appendChild(btn);
    }
  }

  function injectHudButtons(mod) {
    const { manifest, unitIds, buildingIds } = mod;
    const showDeploy = manifest.hud?.deploy !== false && unitIds.length;
    const showBuild = manifest.hud?.build !== false && buildingIds.length;

    if (showDeploy) {
      injectHudSection('mod-deploy-section', 'MOD TROOPS', unitIds, manifest.id, {
        datasetKey: 'unit',
        className: 'deploy-btn mod-deploy-btn',
        defs: () => UnitDefs,
        markup: (id, def) =>
          `<canvas class="btn-icon" data-sprite="${id}" width="28" height="28"></canvas>` +
          `<span>${def.name}</span><span class="cost">${def.cost}</span>`,
      });
    }

    if (showBuild) {
      injectHudSection('mod-build-section', 'MOD BUILD', buildingIds, manifest.id, {
        datasetKey: 'build',
        className: 'build-btn mod-build-btn',
        defs: () => BuildDefs,
        markup: (id, def) => `<span>${def.name}</span><span class="cost">${def.cost}</span>`,
      });
    }
  }

  function publishGameData() {
    if (typeof GameData !== 'undefined') {
      GameData.units = UnitDefs;
      GameData.buildings = BuildDefs;
      GameData.publishGlobals?.();
      GameData.refreshDependents?.();
    }
    if (typeof GameServices !== 'undefined' && typeof GameData !== 'undefined') {
      GameServices.registerDefs({
        units: GameData.units,
        buildings: GameData.buildings,
        enemies: GameData.enemies,
        abilities: GameData.abilities,
        spyActions: GameData.spyActions,
        fxLife: GameData.fxLife,
        synergies: GameData.synergies,
      });
    }
  }

  function registerUnlocks(manifest) {
    if (typeof Research === 'undefined' || !Research.registerModUnlocks) return;
    Research.registerModUnlocks(
      manifest.id,
      manifest.deploy || [],
      manifest.build || []
    );
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(s);
    });
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} (${res.status})`);
    return res.json();
  }

  /**
   * Validate + merge one collection of mod defs into its global registry.
   * `cfg.kind` keeps the collision message distinguishable per collection, and
   * `cfg.registry` stays a thunk so a missing global still fails per-def
   * (recorded in `errors`) rather than aborting the whole merge.
   */
  function mergeDefCollection(modId, defs, errors, cfg) {
    const ids = [];
    for (const [id, raw] of Object.entries(defs)) {
      try {
        cfg.validate(id, raw, modId);
        const registry = cfg.registry();
        if (registry[id] && !cfg.overwrite && registry[id].modId !== modId) {
          throw new Error(
            `${cfg.kind} id "${id}" already exists — set overwrite on the mod or ${cfg.kind} def`
          );
        }
        cfg.decorate?.(raw, id);
        registry[id] = { ...stripMeta(raw), modId, ...cfg.tag };
        ids.push(id);
      } catch (err) {
        errors.push(`${modId}: ${err.message}`);
      }
    }
    return ids;
  }

  function mergeModPack(modId, manifest, units = {}, buildings = {}, opts = {}) {
    const errors = [];
    const overwrite = !!opts.overwrite || !!manifest.overwrite;

    const unitIds = mergeDefCollection(modId, units, errors, {
      kind: 'unit',
      overwrite,
      registry: () => UnitDefs,
      validate: validateUnit,
      decorate: applySprite,
      tag: { isModUnit: true },
    });

    const buildingIds = mergeDefCollection(modId, buildings, errors, {
      kind: 'building',
      overwrite,
      registry: () => BuildDefs,
      validate: validateBuilding,
      tag: { isModBuilding: true },
    });

    registerUnlocks(manifest);
    loaded.set(modId, {
      id: modId,
      name: manifest.name || modId,
      version: manifest.version || '?',
      manifest,
      unitIds,
      buildingIds,
      errors,
    });

    if (!errors.length) {
      injectHudButtons(loaded.get(modId));
    }

    return { unitIds, buildingIds, errors };
  }

  async function loadModFromPaths(baseUrl, entry) {
    const folder = entry.path || entry.id;
    const root = `${baseUrl}${folder}/`.replace(/\/+/g, '/').replace(':/', '://');
    const manifest = await fetchJson(`${root}mod.json`);
    const modId = manifest.id || entry.id || folder;

    let units = {};
    let buildings = {};
    if (manifest.units) units = await fetchJson(`${root}${manifest.units}`);
    if (manifest.buildings) buildings = await fetchJson(`${root}${manifest.buildings}`);

    const result = mergeModPack(modId, manifest, units, buildings);

    if (manifest.script && !result.errors.length) {
      try {
        await loadScript(`${root}${manifest.script}`);
        ModAPI._run('onLoad', modId, null);
      } catch (err) {
        result.errors.push(`${modId}: script — ${err.message}`);
        loaded.get(modId).errors = result.errors;
      }
    }

    return result;
  }

  /** Test / tooling entry — inject a mod without fetch. */
  function injectMod(manifest, units = {}, buildings = {}) {
    const modId = manifest.id;
    if (!modId) throw new Error('injectMod: manifest.id required');
    return mergeModPack(modId, manifest, units, buildings);
  }

  async function loadCatalog() {
    if (typeof fetch !== 'function') {
      catalog = [];
      return;
    }
    try {
      const data = await fetchJson(`${MODS_BASE}manifest.json`);
      catalog = Array.isArray(data.mods) ? data.mods : Array.isArray(data) ? data : [];
    } catch (err) {
      console.info('[ModLoader] No mods/manifest.json — mod folder empty or unavailable.', err.message);
      catalog = [];
    }
  }

  async function unloadAll() {
    for (const modId of [...loaded.keys()]) {
      removeModFromDefs(modId);
      clearHudForMod(modId);
      loaded.delete(modId);
    }
    const deploySec = document.getElementById('mod-deploy-section');
    const buildSec = document.getElementById('mod-build-section');
    if (deploySec) {
      deploySec.replaceChildren();
      deploySec.hidden = true;
    }
    if (buildSec) {
      buildSec.replaceChildren();
      buildSec.hidden = true;
    }
    if (typeof Research !== 'undefined' && Research.clearModUnlocks) Research.clearModUnlocks();
    ModAPI._reset();
    publishGameData();
  }

  async function applyEnabledMods() {
    lastErrors = [];
    await unloadAll();

    const entries = catalog.filter((e) => enabled.includes(e.id));
    for (const entry of entries) {
      try {
        const result = await loadModFromPaths(MODS_BASE, entry);
        if (result.errors.length) lastErrors.push(...result.errors);
      } catch (err) {
        lastErrors.push(`${entry.id}: ${err.message}`);
      }
    }

    publishGameData();
    ready = true;
    return getLoaded();
  }

  async function init() {
    loadEnabledFromStorage();
    await loadCatalog();
    await applyEnabledMods();
    return getLoaded();
  }

  function setEnabled(modIds) {
    enabled = [...new Set(modIds)];
    saveEnabled();
  }

  async function enableMod(modId) {
    if (!enabled.includes(modId)) enabled.push(modId);
    saveEnabled();
    return applyEnabledMods();
  }

  async function disableMod(modId) {
    enabled = enabled.filter((id) => id !== modId);
    saveEnabled();
    return applyEnabledMods();
  }

  async function reload() {
    await loadCatalog();
    return applyEnabledMods();
  }

  function onGameStart(ctx) {
    for (const mod of loaded.values()) {
      ModAPI._run('onGameStart', mod.id, ctx);
    }
  }

  function renderSettingsList() {
    const list = document.getElementById('mod-settings-list');
    const status = document.getElementById('mod-settings-status');
    if (!list) return;

    if (!catalog.length) {
      list.innerHTML =
        '<p class="mod-settings-empty">No mods in <code>mods/manifest.json</code>. See <code>mods/example-legion/</code> for a sample.</p>';
      if (status) status.textContent = '';
      return;
    }

    list.innerHTML = catalog
      .map((entry) => {
        const on = enabled.includes(entry.id);
        const load = loaded.get(entry.id);
        const err = load?.errors?.length || lastErrors.filter((e) => e.startsWith(entry.id)).length;
        const badge = err ? ' <span class="mod-settings-err">error</span>' : on ? ' <span class="mod-settings-on">loaded</span>' : '';
        return (
          `<label class="settings-row check mod-settings-row">` +
          `<input type="checkbox" class="mod-enable-cb" data-mod-id="${entry.id}" ${on ? 'checked' : ''} />` +
          `<span><strong>${entry.name || entry.id}</strong>${badge}` +
          (entry.description ? `<br><span class="mod-settings-desc">${entry.description}</span>` : '') +
          `</span></label>`
        );
      })
      .join('');

    if (status) {
      const n = loaded.size;
      status.textContent =
        lastErrors.length > 0
          ? `Loaded ${n} mod(s). ${lastErrors.length} error(s) — check console.`
          : n
            ? `Loaded ${n} mod(s). Restart or reload to apply HUD changes mid-run.`
            : 'No mods enabled.';
    }
  }

  function bindSettings() {
    document.getElementById('mod-settings-reload')?.addEventListener('click', async () => {
      AudioEngine?.SFX?.click?.();
      await reload();
      renderSettingsList();
      if (typeof UI !== 'undefined') {
        UI.refreshPanelIcons?.();
        UI.updateHUD?.(true);
      }
      Settings?.announce?.('Mods reloaded');
    });

    document.getElementById('mod-settings-list')?.addEventListener('change', async (e) => {
      const cb = e.target.closest('.mod-enable-cb');
      if (!cb) return;
      const modId = cb.dataset.modId;
      if (cb.checked) await enableMod(modId);
      else await disableMod(modId);
      renderSettingsList();
      if (typeof UI !== 'undefined') {
        UI.refreshPanelIcons?.();
        UI.updateHUD?.(true);
      }
    });
  }

  return {
    init,
    reload,
    injectMod,
    setEnabled,
    getEnabled,
    getCatalog,
    getLoaded,
    getErrors,
    isReady,
    isModUnit,
    isModBuilding,
    onGameStart,
    renderSettingsList,
    bindSettings,
    MODS_BASE,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.ModLoader = ModLoader;
globalThis.ModAPI = ModAPI;
