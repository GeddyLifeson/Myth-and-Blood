/**
 * Save slots with checksum validation, and the Save / Load screen (open()): slot details,
 * confirmations before overwrite, load and delete, and export / import as text.
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

  // ---- the Save / Load screen ---------------------------------------------------------------
  // Autosave rows show only where the autosave functions exist.
  const hasAutosaves = () => typeof listAutosaves === 'function';
  const pretty = (id) =>
    String(id ?? '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  let screenOpen = false;
  let returnToPause = false;
  /** { mode: 'export'|'import', kind: 'slot'|'auto', index, text? } */
  let textBox = null;
  let statusNote = { text: '', kind: '' };

  function say(text, kind = '') {
    statusNote = { text, kind };
  }

  function ask(message, opts) {
    return typeof InPageDialog !== 'undefined'
      ? InPageDialog.confirm(message, opts)
      : Promise.resolve(true);
  }

  function titleOf(kind, index) {
    return kind === 'auto' ? `Autosave ${index + 1}` : `Slot ${index + 1}`;
  }

  function whenOf(s) {
    return typeof SaveThumbnail !== 'undefined'
      ? SaveThumbnail.formatSavedAt(s.savedAt)
      : new Date(s.savedAt).toLocaleString();
  }

  function cardHtml(s, kind) {
    const auto = kind === 'auto';
    const title = titleOf(kind, s.index);
    const blocked = saveBlockReason();
    const btn = (action, text, extra = '', disabledWhy = '') =>
      `<button type="button" class="save-btn${extra}" data-save-act="${action}" data-kind="${kind}" data-slot="${s.index}"${
        disabledWhy ? ` disabled title="${escapeHtml(disabledWhy)}"` : ''
      }>${text}</button>`;
    const facts = (rows) =>
      '<dl class="save-card-facts">' +
      rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('') +
      '</dl>';
    if (s.empty) {
      return (
        `<div class="save-card empty">` +
        '<div class="save-card-thumb none"><span>Empty</span></div>' +
        `<div class="save-card-title">${title}</div>` +
        facts([
          ['Wave', '-'],
          ['Difficulty', '-'],
          ['Saved', '-'],
        ]) +
        '<div class="save-card-btns">' +
        btn('save', 'Save here', ' primary', blocked) +
        btn('import', 'Import') +
        '</div></div>'
      );
    }
    const thumb = s.thumbnail
      ? `<div class="save-card-thumb"><img src="${escapeHtml(s.thumbnail)}" alt="${title}: the field when it was saved" /></div>`
      : '<div class="save-card-thumb none"><span>No picture</span></div>';
    const rows = [
      ['Wave', s.wave],
      ['Difficulty', pretty(s.difficulty)],
    ];
    if (s.timeOfDay) rows.push(['Time', pretty(s.timeOfDay)]);
    rows.push(['Saved', whenOf(s)]);
    return (
      `<div class="save-card">` +
      thumb +
      `<div class="save-card-title">${title}<span class="save-card-label">${escapeHtml(s.label || '')}</span></div>` +
      facts(rows) +
      '<div class="save-card-btns">' +
      btn('load', 'Load', ' primary') +
      (auto ? '' : btn('save', 'Overwrite', '', blocked)) +
      btn('export', 'Export') +
      (auto ? '' : btn('import', 'Import')) +
      btn('delete', 'Delete', ' danger') +
      '</div></div>'
    );
  }

  function textBoxHtml() {
    if (!textBox) return '';
    const title = titleOf(textBox.kind, textBox.index);
    if (textBox.mode === 'export') {
      return (
        '<div class="save-text">' +
        `<div class="save-text-head">${title} as text. Copy all of it and keep it somewhere safe; paste it into Import to bring the save back.</div>` +
        `<textarea id="save-text-area" class="save-text-area" readonly spellcheck="false" aria-label="${title} as text">${escapeHtml(textBox.text || '')}</textarea>` +
        '<div class="save-text-btns">' +
        '<button type="button" class="save-btn primary" data-save-act="copy">Copy</button>' +
        '<button type="button" class="save-btn" data-save-act="text-close">Done</button>' +
        '</div></div>'
      );
    }
    return (
      '<div class="save-text">' +
      `<div class="save-text-head">Paste a save exported from this game, then import it into ${title}.</div>` +
      `<textarea id="save-text-area" class="save-text-area" spellcheck="false" placeholder="${SaveFormat.TEXT_PREFIX}..." aria-label="Save text to import"></textarea>` +
      '<div class="save-text-btns">' +
      `<button type="button" class="save-btn primary" data-save-act="import-go">Import into ${title}</button>` +
      '<button type="button" class="save-btn" data-save-act="text-close">Cancel</button>' +
      '</div></div>'
    );
  }

  function ensureScreen() {
    let root = document.getElementById('save-screen');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'save-screen';
    root.className = 'screen save-screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Save and load');
    (document.getElementById('settings-screen')?.parentNode || document.body).appendChild(root);
    root.addEventListener('click', onScreenClick);
    return root;
  }

  function renderScreen() {
    const root = ensureScreen();
    const blocked = saveBlockReason();
    const autos = hasAutosaves() ? listAutosaves() : [];
    const keep = textBox?.mode === 'import' ? root.querySelector('#save-text-area')?.value : null;
    root.innerHTML =
      '<div class="save-panel">' +
      '<h2 class="save-title">SAVE AND LOAD</h2>' +
      `<p class="save-sub">${blocked ? escapeHtml(blocked) : 'Three slots are yours. Export a save to keep it as text.'}</p>` +
      `<div class="save-cards">${listSlots()
        .map((s) => cardHtml(s, 'slot'))
        .join('')}${autos.map((s) => cardHtml(s, 'auto')).join('')}</div>` +
      `<div class="save-status ${escapeHtml(statusNote.kind)}" role="status" aria-live="polite">${escapeHtml(statusNote.text)}</div>` +
      textBoxHtml() +
      '<div class="save-actions"><button type="button" class="save-btn close" data-save-act="close">Close</button></div>' +
      '</div>';
    const area = root.querySelector('#save-text-area');
    if (area && keep != null) area.value = keep;
  }

  async function onScreenClick(e) {
    const el = e.target.closest('[data-save-act]');
    if (!el) return;
    const act = el.dataset.saveAct;
    const kind = el.dataset.kind || 'slot';
    const index = parseInt(el.dataset.slot, 10);
    const title = titleOf(kind, index);
    const auto = kind === 'auto';
    AudioEngine?.SFX?.click?.();
    if (act === 'close') return close();
    if (act === 'text-close') {
      textBox = null;
    } else if (act === 'save') {
      if (!listSlots()[index]?.empty) {
        const yes = await ask(`Overwrite ${title}? The save in it now is lost.`, {
          title: `Overwrite ${title}`,
          okLabel: 'Overwrite',
          danger: true,
        });
        if (!yes) return;
      }
      const r = saveToSlot(index);
      say(r.ok ? `Saved to ${title}.` : r.error, r.ok ? 'ok' : 'bad');
    } else if (act === 'load') {
      if (typeof Game !== 'undefined' && Game.isPlaying?.()) {
        const yes = await ask(`Load ${title}? The battle you are in now ends unsaved.`, {
          title: `Load ${title}`,
          okLabel: 'Load',
        });
        if (!yes) return;
      }
      const r = auto ? loadAutosave(index) : loadFromSlot(index);
      if (r.ok) {
        say('');
        close({ loaded: true });
        return;
      }
      say(r.error, 'bad');
    } else if (act === 'delete') {
      const yes = await ask(`Delete ${title}? This cannot be undone.`, {
        title: `Delete ${title}`,
        okLabel: 'Delete',
        danger: true,
      });
      if (!yes) return;
      if (auto) deleteAutosave(index);
      else deleteSlot(index);
      if (textBox?.kind === kind && textBox.index === index) textBox = null;
      say(`${title} deleted.`, 'ok');
    } else if (act === 'export') {
      const r = auto ? exportAutosave(index) : exportSlot(index);
      textBox = r.ok ? { mode: 'export', kind, index, text: r.text } : null;
      say(r.ok ? '' : r.error, r.ok ? '' : 'bad');
    } else if (act === 'import') {
      textBox = { mode: 'import', kind: 'slot', index };
      say('');
    } else if (act === 'copy') {
      const area = document.getElementById('save-text-area');
      area?.focus();
      area?.select();
      let copied;
      try {
        await navigator.clipboard.writeText(area?.value || '');
        copied = true;
      } catch (_) {
        copied = false;
      }
      say(copied ? 'Copied.' : 'Select the text and copy it by hand (Ctrl+C).', copied ? 'ok' : '');
      const note = document.querySelector('#save-screen .save-status');
      if (note) {
        note.textContent = statusNote.text;
        note.className = `save-status ${statusNote.kind}`;
      }
      return;
    } else if (act === 'import-go') {
      const target = textBox?.index;
      const text = document.getElementById('save-text-area')?.value || '';
      if (!text.trim()) {
        say('Paste the save text first.', 'bad');
        renderScreen();
        return;
      }
      if (!listSlots()[target]?.empty) {
        const yes = await ask(
          `Import over ${titleOf('slot', target)}? The save in it now is lost.`,
          { title: `Overwrite ${titleOf('slot', target)}`, okLabel: 'Import', danger: true }
        );
        if (!yes) return;
      }
      const r = importString(text, { slot: target });
      if (r.ok) textBox = null;
      say(r.ok ? `Imported into ${titleOf('slot', target)}.` : r.error, r.ok ? 'ok' : 'bad');
    }
    renderScreen();
    const area = document.getElementById('save-text-area');
    if (area && (act === 'export' || act === 'import')) {
      area.focus();
      if (act === 'export') area.select();
    }
    renderPauseSlots();
  }

  /** Open the Save / Load screen. From the pause menu it returns there on close. */
  function open(opts = {}) {
    returnToPause = !!opts.fromPause;
    if (returnToPause && typeof UX !== 'undefined') UX.suppressPauseForOverlay?.();
    screenOpen = true;
    textBox = null;
    say('');
    renderScreen();
    const root = ensureScreen();
    root.classList.add('active');
    root.querySelector('.save-btn:not([disabled])')?.focus();
  }

  function close(opts = {}) {
    if (!screenOpen) return;
    screenOpen = false;
    document.getElementById('save-screen')?.classList.remove('active');
    const playing = typeof Game !== 'undefined' && Game.isPlaying?.();
    if (opts.loaded) {
      if (typeof UX !== 'undefined') UX.closePauseMenu?.(false);
      if (typeof UI !== 'undefined') UI.updateHUD?.(true);
    } else if (returnToPause && playing && Game.getState().paused) {
      if (typeof UX !== 'undefined') UX.openPauseMenu?.();
    }
    returnToPause = false;
  }

  function isOpen() {
    return screenOpen;
  }

  /** The pause menu's save area: one line per slot and the button that opens the screen. */
  function renderPauseSlots() {
    const host = document.getElementById('save-slots');
    if (!host) return;
    const line = (s) => {
      const name = titleOf('slot', s.index);
      if (s.empty)
        return `<div class="save-line empty"><strong>${name}</strong><span>Empty</span></div>`;
      return `<div class="save-line"><strong>${name}</strong><span>Wave ${escapeHtml(s.wave)} · ${escapeHtml(pretty(s.difficulty))} · ${escapeHtml(whenOf(s))}</span></div>`;
    };
    host.innerHTML =
      `<div class="save-lines">${listSlots().map(line).join('')}</div>` +
      '<button type="button" class="save-btn primary save-open-btn" data-save-open>SAVE / LOAD</button>';
    host.querySelector('[data-save-open]').addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      open({ fromPause: true });
    });
  }

  function init() {
    migrateLegacyQuickSave(loadStore());
  }

  return {
    init,
    open,
    close,
    isOpen,
    renderPauseSlots,
    listSlots,
    saveToSlot,
    loadFromSlot,
    deleteSlot,
    validateSlot,
    saveBlockReason,
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
  saveBlockReason: SaveManager.saveBlockReason,
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
