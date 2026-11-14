/**
 * Multi-slot save/load with checksum validation and error recovery.
 */
const SaveManager = (() => {
  // Shared helper — see js/html-util.js (loaded first).
  const escapeHtml = HtmlUtil.escapeHtml;
  const STORAGE_KEY = 'myth-and-blood-saves-v1';
  const SLOT_COUNT = 3;
  const LEGACY_QUICK_KEY = 'myth-and-blood-quicksave';

  const AUTOSAVE_KEEP = 3;
  const MSG_FULL =
    'Storage is full, so the game could not be saved. Delete a save or export one and try again.';

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  /** Tell the player something from the data layer (no DOM here). */
  function notify(text) {
    try {
      if (typeof Game !== 'undefined' && Game.showMessage) Game.showMessage(text, 360);
    } catch (_) {
      /* a message must never break a save */
    }
  }

  function loadStore() {
    let store = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store = JSON.parse(raw);
    } catch (_) {
      store = null;
    }
    if (!store || typeof store !== 'object') store = { slots: [], version: 1 };
    if (!Array.isArray(store.slots)) store.slots = [];
    if (!Array.isArray(store.autosaves)) store.autosaves = [];
    return store;
  }

  /**
   * Write the store. When the browser refuses for lack of room, the oldest autosave is
   * dropped and the write tried again, until it fits or there is no autosave left to drop.
   * Returns { ok, dropped } or { ok: false, error }.
   */
  function writeStoreSafe(store) {
    let dropped = 0;
    for (;;) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        if (dropped) {
          notify(
            dropped === 1
              ? 'Storage is full: the oldest autosave was removed to make room.'
              : `Storage is full: the ${dropped} oldest autosaves were removed to make room.`
          );
        }
        return { ok: true, dropped };
      } catch (e) {
        if (Array.isArray(store.autosaves) && store.autosaves.length) {
          store.autosaves.pop();
          dropped++;
          continue;
        }
        console.warn('SaveManager: write failed', e);
        notify(MSG_FULL);
        return { ok: false, error: MSG_FULL, dropped };
      }
    }
  }

  function writeStore(store) {
    return writeStoreSafe(store).ok;
  }

  function migrateLegacyQuickSave(store) {
    try {
      // Run once: the quick-save key is still live, so re-reading it would refill an
      // emptied slot every time the pause menu renders.
      if (store.legacyMigrated) return;
      store.legacyMigrated = true;
      const raw = localStorage.getItem(LEGACY_QUICK_KEY);
      if (!raw || store.slots.some((s) => s)) {
        writeStore(store);
        return;
      }
      const snap = JSON.parse(raw);
      store.slots[0] = wrapSnapshot(snap, 'Quick Save (migrated)');
      writeStore(store);
    } catch (_) {
      /* ignore */
    }
  }

  function wrapSnapshot(snap, label, thumbnail) {
    const body = JSON.stringify(snap);
    return {
      label: label || `Wave ${snap.wave ?? '?'}`,
      savedAt: Date.now(),
      wave: snap.wave ?? 0,
      difficulty: snap.difficultyId ?? 'normal',
      timeOfDay: snap.timeOfDay || null,
      version: snap.version ?? null,
      thumbnail: thumbnail || snap.thumbnail || null,
      checksum: hash(body),
      data: snap,
    };
  }

  /**
   * Is this stored entry loadable? Checks the wrapper checksum, then everything
   * SaveFormat.prepare checks (version, the save's own checksum, migration, shape).
   * Returns { ok: true, snap } with the migrated save, or { ok: false, error }.
   */
  function validateSlot(slot) {
    if (!slot?.data) return { ok: false, error: 'This slot is empty.' };
    let body;
    try {
      body = JSON.stringify(slot.data);
    } catch (_) {
      return { ok: false, error: SaveFormat.MSG.checksum };
    }
    if (slot.checksum && slot.checksum !== hash(body)) {
      return { ok: false, error: SaveFormat.MSG.checksum };
    }
    const prep = SaveFormat.prepare(slot.data);
    if (!prep.ok) return { ok: false, error: prep.error, newer: !!prep.newer };
    return { ok: true, snap: prep.snap, fromVersion: prep.fromVersion };
  }

  function describe(s, i) {
    return s
      ? {
          index: i,
          label: s.label,
          wave: s.wave,
          difficulty: s.difficulty,
          timeOfDay: s.timeOfDay || s.data?.timeOfDay || null,
          version: s.data?.version ?? null,
          savedAt: s.savedAt,
          thumbnail: s.thumbnail || null,
        }
      : { index: i, empty: true };
  }

  function listSlots() {
    const store = loadStore();
    migrateLegacyQuickSave(store);
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    return store.slots.slice(0, SLOT_COUNT).map(describe);
  }

  /** Autosaves, newest first (at most three). */
  function listAutosaves() {
    return loadStore().autosaves.slice(0, AUTOSAVE_KEEP).map(describe);
  }

  /** The reason this run may not be saved, or null. */
  function saveBlockReason() {
    if (typeof Game === 'undefined' || !Game.exportGameState) return 'Saving is not available.';
    return Game.getSaveBlockReason ? Game.getSaveBlockReason() : null;
  }

  function saveToSlot(index, label) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: 'There is no such save slot.' };
    const blocked = saveBlockReason();
    if (blocked) return { ok: false, error: blocked };
    let snap = null;
    try {
      snap = Game.exportGameState();
    } catch (e) {
      return { ok: false, error: `The game could not be saved (${e.message}).` };
    }
    if (!snap) return { ok: false, error: 'The game could not be saved right now.' };
    let thumbnail = snap.thumbnail || null;
    if (!thumbnail && typeof SaveThumbnail !== 'undefined') {
      thumbnail = SaveThumbnail.capture();
      if (thumbnail) snap.thumbnail = thumbnail;
    }
    const store = loadStore();
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    store.slots[idx] = wrapSnapshot(snap, label || `Wave ${snap.wave}`, thumbnail);
    const w = writeStoreSafe(store);
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true, slot: idx };
  }

  /**
   * Autosave: called by the game at each nightfall. Autosaves have their own three places
   * (newest first) and never touch the player's slots. Quiet when the run may not be saved.
   */
  function autosave() {
    if (saveBlockReason()) return { ok: false, skipped: true };
    let snap = null;
    try {
      snap = Game.exportGameState();
    } catch (e) {
      console.warn('SaveManager: autosave failed', e);
      return { ok: false, error: `Autosave failed (${e.message}).` };
    }
    if (!snap) return { ok: false, skipped: true };
    const store = loadStore();
    store.autosaves.unshift(wrapSnapshot(snap, `Autosave, night of wave ${snap.wave}`));
    store.autosaves.length = Math.min(store.autosaves.length, AUTOSAVE_KEEP);
    const w = writeStoreSafe(store);
    if (!w.ok) return { ok: false, error: w.error };
    return { ok: true, kept: store.autosaves.length, dropped: w.dropped };
  }

  function loadEntry(entry) {
    const v = validateSlot(entry);
    if (!v.ok) return v;
    try {
      // The stored save goes in as it is; the game checks and migrates it again itself.
      if (!Game.importGameState?.(entry.data)) {
        const why = Game.getLastLoadReport?.().error;
        return { ok: false, error: why || 'This save could not be loaded.' };
      }
      const report = Game.getLastLoadReport?.();
      return { ok: true, warnings: report?.warnings || [] };
    } catch (e) {
      return { ok: false, error: `This save could not be loaded (${e.message}).` };
    }
  }

  function loadFromSlot(index) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: 'There is no such save slot.' };
    return loadEntry(loadStore().slots[idx]);
  }

  function loadAutosave(index) {
    const idx = index | 0;
    if (idx < 0 || idx >= AUTOSAVE_KEEP) return { ok: false, error: 'There is no such autosave.' };
    return loadEntry(loadStore().autosaves[idx]);
  }

  function deleteSlot(index) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return false;
    const store = loadStore();
    if (!store.slots?.[idx]) return false;
    store.slots[idx] = null;
    writeStore(store);
    return true;
  }

  function deleteAutosave(index) {
    const idx = index | 0;
    const store = loadStore();
    if (idx < 0 || idx >= store.autosaves.length) return false;
    store.autosaves.splice(idx, 1);
    writeStore(store);
    return true;
  }

  function entryToString(entry) {
    const v = validateSlot(entry);
    if (!v.ok) return { ok: false, error: v.error };
    // The preview picture is not part of the text: it would double its length.
    const data = { ...entry.data };
    delete data.thumbnail;
    return { ok: true, text: SaveFormat.encode(data), wave: entry.wave, label: entry.label };
  }

  /** A slot as one line of text to copy: { ok, text } or { ok: false, error }. */
  function exportSlot(index) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: 'There is no such save slot.' };
    return entryToString(loadStore().slots[idx]);
  }

  function exportAutosave(index) {
    return entryToString(loadStore().autosaves[index | 0]);
  }

  /**
   * Read a save from text (what exportSlot gave). The text is checked in full first.
   *   opts.slot  slot to write it to; default: the first empty slot
   *   opts.load  true: also load it into the game now
   * Returns { ok, slot, wave, difficulty, label } or { ok: false, error }.
   */
  function importString(text, opts = {}) {
    const dec = SaveFormat.decode(text);
    if (!dec.ok) return { ok: false, error: dec.error, newer: !!dec.newer };
    const snap = SaveFormat.seal(dec.snap);
    const store = loadStore();
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    let idx = Number.isInteger(opts.slot) ? opts.slot : store.slots.findIndex((x) => !x);
    if (idx < 0 || idx >= SLOT_COUNT) {
      return {
        ok: false,
        error: Number.isInteger(opts.slot)
          ? 'There is no such save slot.'
          : 'Every save slot is in use. Pick a slot to replace.',
        full: !Number.isInteger(opts.slot),
      };
    }
    const label = opts.label || `Imported, wave ${snap.wave}`;
    store.slots[idx] = wrapSnapshot(snap, label);
    const w = writeStoreSafe(store);
    if (!w.ok) return { ok: false, error: w.error };
    const out = { ok: true, slot: idx, wave: snap.wave, difficulty: snap.difficultyId, label };
    if (opts.load) {
      const r = loadFromSlot(idx);
      if (!r.ok) return { ...r, slot: idx };
      out.loaded = true;
    }
    return out;
  }

  function renderPauseSlots() {
    const host = document.getElementById('save-slots');
    if (!host) return;
    const slots = listSlots();
    host.innerHTML = slots
      .map((s) => {
        if (s.empty) {
          return `<div class="save-slot empty" data-slot="${s.index}"><span>Slot ${s.index + 1}</span><span>Empty</span>
        <div class="save-slot-btns">
          <button class="save-slot-btn" data-action="save" data-slot="${s.index}">Save</button>
        </div>
      </div>`;
        }
        const when =
          typeof SaveThumbnail !== 'undefined'
            ? SaveThumbnail.formatSavedAt(s.savedAt)
            : new Date(s.savedAt).toLocaleString();
        const thumb = s.thumbnail
          ? `<img class="save-slot-thumb" src="${escapeHtml(s.thumbnail)}" alt="Slot ${s.index + 1} preview" />`
          : `<div class="save-slot-thumb empty">—</div>`;
        return `<div class="save-slot" data-slot="${s.index}">
        ${thumb}
        <div class="save-slot-info"><strong>Slot ${s.index + 1}</strong> — ${escapeHtml(s.label)}<br>
        <span class="save-slot-meta">W${escapeHtml(s.wave)} · ${escapeHtml(s.difficulty)} · ${escapeHtml(when)}</span></div>
        <div class="save-slot-btns">
          <button class="save-slot-btn" data-action="load" data-slot="${s.index}">Load</button>
          <button class="save-slot-btn" data-action="save" data-slot="${s.index}">Save</button>
          <button class="save-slot-btn danger" data-action="delete" data-slot="${s.index}">Del</button>
        </div>
      </div>`;
      })
      .join('');

    host.querySelectorAll('.save-slot-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.slot, 10);
        const action = btn.dataset.action;
        AudioEngine?.SFX?.click?.();
        if (action === 'save') {
          const r = saveToSlot(idx);
          if (r.ok) {
            if (typeof UX !== 'undefined') UX.onMessage(`Saved to slot ${idx + 1}.`, 'system');
            renderPauseSlots();
          } else if (typeof UX !== 'undefined') UX.onMessage(r.error, 'system');
        } else if (action === 'load') {
          const r = loadFromSlot(idx);
          if (r.ok) {
            if (typeof UX !== 'undefined') UX.closePauseMenu(false);
            UI.updateHUD(true);
          } else if (typeof UX !== 'undefined') UX.onMessage(r.error, 'system');
        } else if (action === 'delete') {
          deleteSlot(idx);
          renderPauseSlots();
        }
      });
    });
  }

  function init() {
    migrateLegacyQuickSave(loadStore());
  }

  return {
    init,
    renderPauseSlots,
    listSlots,
    saveToSlot,
    loadFromSlot,
    deleteSlot,
    validateSlot,
    listAutosaves,
    autosave,
    loadAutosave,
    deleteAutosave,
    exportSlot,
    exportAutosave,
    importString,
    SLOT_COUNT,
    AUTOSAVE_KEEP,
  };
})();

/**
 * The save data layer on its own, for the save screen: no DOM in any of these. Every call
 * returns { ok: true, ... } or { ok: false, error } with `error` in words for the player
 * (listSlots/listAutosaves return arrays; deleteSlot/deleteAutosave return true or false).
 */
const SaveData = {
  SLOT_COUNT: SaveManager.SLOT_COUNT,
  AUTOSAVE_KEEP: SaveManager.AUTOSAVE_KEEP,
  listSlots: SaveManager.listSlots,
  saveToSlot: SaveManager.saveToSlot,
  loadFromSlot: SaveManager.loadFromSlot,
  deleteSlot: SaveManager.deleteSlot,
  validateSlot: SaveManager.validateSlot,
  listAutosaves: SaveManager.listAutosaves,
  autosave: SaveManager.autosave,
  loadAutosave: SaveManager.loadAutosave,
  deleteAutosave: SaveManager.deleteAutosave,
  exportSlot: SaveManager.exportSlot,
  exportAutosave: SaveManager.exportAutosave,
  importString: SaveManager.importString,
};
globalThis.SaveData = SaveData;

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SaveManager = SaveManager;
