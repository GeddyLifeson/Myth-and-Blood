/**
 * Save slots: three manual slots and one autosave, with checksum validation.
 *
 * The Save / Load screen is built here (open()): each slot shows wave, difficulty, mode,
 * play time, date and a thumbnail. Overwrite and delete ask first (js/dialog.js). A save
 * can be exported as text and imported again; nothing is downloaded.
 * The autosave is written at each nightfall. Runs that forbid quick saves (Ironman, the
 * daily and weekly challenges) and Creative mode are not saved here either.
 */
const SaveManager = (() => {
  // Shared helper — see js/html-util.js (loaded first).
  const escapeHtml = HtmlUtil.escapeHtml;
  const STORAGE_KEY = 'myth-and-blood-saves-v1';
  const SLOT_COUNT = 3;
  /** The index of the autosave wherever a slot index is taken. */
  const AUTO = 'auto';
  const LEGACY_QUICK_KEY = 'myth-and-blood-quicksave';

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {
      /* ignore */
    }
    return { slots: [], version: 1 };
  }

  function writeStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      console.warn('SaveManager: write failed', e);
      return false;
    }
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
      mode: modeLabel(snap.modeSession),
      playMs: Math.round(playMs),
      thumbnail: thumbnail || snap.thumbnail || null,
      checksum: hash(body),
      data: snap,
    };
  }

  function validateSlot(slot) {
    if (!slot?.data) return { ok: false, error: 'Empty slot' };
    const body = JSON.stringify(slot.data);
    if (slot.checksum && slot.checksum !== hash(body)) {
      return { ok: false, error: 'Checksum mismatch — save may be corrupted' };
    }
    const v = slot.data.version;
    const known =
      typeof Game !== 'undefined' && Game.isSupportedSaveVersion
        ? Game.isSupportedSaveVersion(v)
        : v === 1 || v === 2;
    if (!known) {
      const newer = typeof Game !== 'undefined' && Number.isInteger(v) && v > Game.SAVE_VERSION;
      return {
        ok: false,
        error: newer
          ? 'This save was made by a newer version of the game and cannot be loaded here.'
          : 'This save has an unknown format and cannot be loaded.',
      };
    }
    return { ok: true };
  }

  const pretty = (id) =>
    String(id || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  function modeLabel(session) {
    if (!session) return 'Campaign';
    const id = session.displayModeId || session.modeId || 'campaign';
    let label = session.challengeLabel || pretty(id);
    if (session.ironman) label += ' · Ironman';
    return label;
  }

  /** "1 h 04 min", "12 min", "under a minute". */
  function formatPlayTime(ms) {
    const min = Math.floor((ms || 0) / 60000);
    if (min < 1) return 'under a minute';
    const hrs = Math.floor(min / 60);
    return hrs ? `${hrs} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
  }

  function describe(s, index) {
    return {
      index,
      label: s.label,
      wave: s.wave,
      difficulty: s.difficulty,
      mode: s.mode || modeLabel(s.data?.modeSession),
      playMs: s.playMs || 0,
      savedAt: s.savedAt,
      thumbnail: s.thumbnail || null,
    };
  }

  function listSlots() {
    const store = loadStore();
    migrateLegacyQuickSave(store);
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    return store.slots
      .slice(0, SLOT_COUNT)
      .map((s, i) => (s ? describe(s, i) : { index: i, empty: true }));
  }

  /** The autosave, described like a slot (index "auto"), or { empty: true }. */
  function getAutosave() {
    const s = loadStore().auto;
    return s ? describe(s, AUTO) : { index: AUTO, empty: true };
  }

  /** Why this run cannot be saved to a slot, or '' when it can. */
  function whyNoSave() {
    if (typeof Game === 'undefined' || !Game.isPlaying?.()) return 'No battle in progress';
    if (Game.isCreativeMode?.()) return 'Creative mode is not saved';
    if (typeof GameModes !== 'undefined' && GameModes.canQuickSave && !GameModes.canQuickSave()) {
      return 'Ironman and challenge runs cannot be saved';
    }
    return '';
  }

  function snapshotNow() {
    if (!Game.exportGameState) return { error: 'Export unavailable' };
    const snap = Game.exportGameState();
    if (!snap) return { error: 'Could not export game state' };
    let thumbnail = snap.thumbnail || null;
    if (!thumbnail && typeof SaveThumbnail !== 'undefined') {
      thumbnail = SaveThumbnail.capture();
      if (thumbnail) snap.thumbnail = thumbnail;
    }
    return { snap, thumbnail };
  }

  function saveToSlot(index, label) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: 'Invalid slot' };
    const why = whyNoSave();
    if (why) return { ok: false, error: why };
    const { snap, thumbnail, error } = snapshotNow();
    if (error) return { ok: false, error };
    const store = loadStore();
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    store.slots[idx] = wrapSnapshot(snap, label || `Wave ${snap.wave}`, thumbnail);
    if (!writeStore(store)) return { ok: false, error: 'Storage full or blocked' };
    return { ok: true, slot: idx };
  }

  /** Written at nightfall. Quietly skipped when the run may not be saved. */
  function autosave() {
    if (whyNoSave()) return false;
    const { snap, thumbnail, error } = snapshotNow();
    if (error) return false;
    const store = loadStore();
    store.auto = wrapSnapshot(snap, 'Autosave', thumbnail);
    if (writeStore(store)) return true;
    // Out of room: an autosave without its picture is still an autosave.
    delete snap.thumbnail;
    store.auto = wrapSnapshot(snap, 'Autosave', null);
    store.auto.thumbnail = null;
    return writeStore(store);
  }

  function slotAt(store, index) {
    if (index === AUTO) return store.auto || null;
    const idx = index | 0;
    return idx >= 0 && idx < SLOT_COUNT ? store.slots?.[idx] || null : null;
  }

  function loadFromSlot(index) {
    if (index !== AUTO && ((index | 0) < 0 || (index | 0) >= SLOT_COUNT)) {
      return { ok: false, error: 'Invalid slot' };
    }
    if (typeof Game !== 'undefined' && Game.isPlaying?.()) {
      if (typeof GameModes !== 'undefined' && GameModes.canQuickSave && !GameModes.canQuickSave()) {
        return { ok: false, error: 'Ironman and challenge runs cannot load a save' };
      }
    }
    const slot = slotAt(loadStore(), index);
    const v = validateSlot(slot);
    if (!v.ok) return v;
    try {
      if (!Game.importGameState?.(slot.data)) {
        return { ok: false, error: 'Import failed — state rejected' };
      }
      playMs = slot.playMs || 0;
      wasPlaying = true;
      lastPhase = slot.data.timeOfDay || null;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'Import crashed' };
    }
  }

  function deleteSlot(index) {
    const store = loadStore();
    if (index === AUTO) {
      if (!store.auto) return false;
      delete store.auto;
      writeStore(store);
      return true;
    }
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return false;
    if (!store.slots?.[idx]) return false;
    store.slots[idx] = null;
    writeStore(store);
    return true;
  }

  // ---- export / import as text ------------------------------------------------------------
  const TEXT_PREFIX = 'MYTHBLOOD1:';

  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** A slot as one line of text, or null when it is empty. The picture is left out. */
  function exportSlotText(index) {
    const slot = slotAt(loadStore(), index);
    if (!slot?.data) return null;
    const data = { ...slot.data };
    delete data.thumbnail;
    const lean = { ...slot, thumbnail: null, data, checksum: hash(JSON.stringify(data)) };
    return TEXT_PREFIX + toBase64(JSON.stringify(lean));
  }

  /** Check exported text. @returns {{ ok: boolean, error?: string, slot?: any }} */
  function parseSaveText(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    if (!clean) return { ok: false, error: 'Paste the save text first' };
    if (!clean.startsWith(TEXT_PREFIX)) {
      return { ok: false, error: 'That is not a Myth and Blood save' };
    }
    const damaged = { ok: false, error: 'The save text is damaged or cut short' };
    let slot;
    try {
      slot = JSON.parse(fromBase64(clean.slice(TEXT_PREFIX.length)));
    } catch (_) {
      return damaged;
    }
    if (!slot || typeof slot !== 'object' || !slot.data || typeof slot.data !== 'object') {
      return damaged;
    }
    if (!slot.checksum) return damaged;
    const v = validateSlot(slot);
    return v.ok ? { ok: true, slot } : v;
  }

  /** Read exported text into a slot (0-2). The text is checked before anything is written. */
  function importSlotText(index, text) {
    const idx = index | 0;
    if (index === AUTO || idx < 0 || idx >= SLOT_COUNT) {
      return { ok: false, error: 'Pick slot 1, 2 or 3' };
    }
    const parsed = parseSaveText(text);
    if (!parsed.ok) return parsed;
    const slot = parsed.slot;
    const store = loadStore();
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    store.slots[idx] = {
      label: String(slot.label || `Wave ${slot.data.wave ?? '?'}`).slice(0, 60),
      savedAt: Number(slot.savedAt) || Date.now(),
      wave: Number(slot.data.wave) || 0,
      difficulty: String(slot.data.difficultyId || 'normal'),
      mode: modeLabel(slot.data.modeSession),
      playMs: Math.max(0, Number(slot.playMs) || 0),
      thumbnail: null,
      checksum: slot.checksum,
      data: slot.data,
    };
    if (!writeStore(store)) return { ok: false, error: 'Storage full or blocked' };
    return { ok: true, slot: idx };
  }

  // ---- play time and the autosave ---------------------------------------------------------
  let playMs = 0;
  let wasPlaying = false;
  let lastPhase = null;
  let lastTick = 0;

  /** Once a second: count play time, and autosave when night falls. */
  function tick() {
    const now = Date.now();
    const dt = Math.min(2000, Math.max(0, now - (lastTick || now)));
    lastTick = now;
    if (typeof Game === 'undefined' || !Game.isPlaying?.()) {
      wasPlaying = false;
      lastPhase = null;
      return;
    }
    const gs = Game.getState();
    if (!wasPlaying) {
      wasPlaying = true;
      playMs = 0;
      lastPhase = gs.timeOfDay;
      return;
    }
    if (!gs.paused) playMs += dt;
    if (gs.timeOfDay !== lastPhase) {
      const fell = gs.timeOfDay === 'night' && lastPhase === 'day';
      lastPhase = gs.timeOfDay;
      if (fell) autosave();
    }
  }

  // ---- the Save / Load screen ---------------------------------------------------------------
  let screenOpen = false;
  let returnToPause = false;
  /** Which slot the text box belongs to, and what it is for: { mode: 'export'|'import', index }. */
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

  function slotTitle(index) {
    return index === AUTO ? 'Autosave' : `Slot ${index + 1}`;
  }

  function cardHtml(s) {
    const auto = s.index === AUTO;
    const title = slotTitle(s.index);
    const noSave = whyNoSave();
    const btn = (action, text, extra = '', disabled = '') =>
      `<button type="button" class="save-btn${extra}" data-save-act="${action}" data-slot="${s.index}"${
        disabled ? ` disabled title="${escapeHtml(disabled)}"` : ''
      }>${text}</button>`;
    if (s.empty) {
      return (
        `<div class="save-card empty" data-slot="${s.index}">` +
        `<div class="save-card-thumb none"><span>${auto ? 'Written at each nightfall' : 'Empty'}</span></div>` +
        `<div class="save-card-title">${title}</div>` +
        `<dl class="save-card-facts"><dt>Wave</dt><dd>—</dd><dt>Difficulty</dt><dd>—</dd><dt>Mode</dt><dd>—</dd><dt>Played</dt><dd>—</dd><dt>Saved</dt><dd>—</dd></dl>` +
        '<div class="save-card-btns">' +
        (auto ? '' : btn('save', 'Save here', ' primary', noSave) + btn('import', 'Import')) +
        '</div></div>'
      );
    }
    const when =
      typeof SaveThumbnail !== 'undefined'
        ? SaveThumbnail.formatSavedAt(s.savedAt)
        : new Date(s.savedAt).toLocaleString();
    const thumb = s.thumbnail
      ? `<div class="save-card-thumb"><img src="${escapeHtml(s.thumbnail)}" alt="${title}: the field when it was saved" /></div>`
      : '<div class="save-card-thumb none"><span>No picture</span></div>';
    return (
      `<div class="save-card" data-slot="${s.index}">` +
      thumb +
      `<div class="save-card-title">${title}</div>` +
      '<dl class="save-card-facts">' +
      `<dt>Wave</dt><dd>${escapeHtml(s.wave)}</dd>` +
      `<dt>Difficulty</dt><dd>${escapeHtml(pretty(s.difficulty))}</dd>` +
      `<dt>Mode</dt><dd>${escapeHtml(s.mode)}</dd>` +
      `<dt>Played</dt><dd>${escapeHtml(formatPlayTime(s.playMs))}</dd>` +
      `<dt>Saved</dt><dd>${escapeHtml(when)}</dd>` +
      '</dl>' +
      '<div class="save-card-btns">' +
      btn('load', 'Load', ' primary') +
      (auto ? '' : btn('save', 'Overwrite', '', noSave)) +
      btn('export', 'Export') +
      (auto ? '' : btn('import', 'Import')) +
      btn('delete', 'Delete', ' danger') +
      '</div></div>'
    );
  }

  function textBoxHtml() {
    if (!textBox) return '';
    const title = slotTitle(textBox.index);
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
      `<textarea id="save-text-area" class="save-text-area" spellcheck="false" placeholder="MYTHBLOOD1:…" aria-label="Save text to import"></textarea>` +
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
    const cards = [getAutosave(), ...listSlots()].map(cardHtml).join('');
    const why = whyNoSave();
    const keep = textBox?.mode === 'import' ? root.querySelector('#save-text-area')?.value : null;
    root.innerHTML =
      '<div class="save-panel">' +
      '<h2 class="save-title">SAVE AND LOAD</h2>' +
      `<p class="save-sub">${
        why && why !== 'No battle in progress'
          ? `${escapeHtml(why)}.`
          : 'Three slots are yours. The autosave is written each time night falls.'
      }</p>` +
      `<div class="save-cards">${cards}</div>` +
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
    const raw = el.dataset.slot;
    const index = raw === AUTO ? AUTO : parseInt(raw, 10);
    const title = raw != null ? slotTitle(index) : '';
    AudioEngine?.SFX?.click?.();
    if (act === 'close') return close();
    if (act === 'text-close') {
      textBox = null;
    } else if (act === 'save') {
      const taken = !listSlots()[index]?.empty;
      if (taken) {
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
        const yes = await ask(`Load ${title}? The battle you are in now is left as it is.`, {
          title: `Load ${title}`,
          okLabel: 'Load',
        });
        if (!yes) return;
      }
      const r = loadFromSlot(index);
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
      deleteSlot(index);
      if (textBox?.index === index) textBox = null;
      say(`${title} deleted.`, 'ok');
    } else if (act === 'export') {
      const text = exportSlotText(index);
      textBox = text ? { mode: 'export', index, text } : null;
      say(text ? '' : 'Nothing to export.', text ? '' : 'bad');
    } else if (act === 'import') {
      textBox = { mode: 'import', index };
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
        try {
          copied = document.execCommand('copy');
        } catch (_e) {
          copied = false;
        }
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
      // Check the text before asking about the slot it would replace.
      const checked = parseSaveText(text);
      if (!checked.ok) {
        say(checked.error, 'bad');
        renderScreen();
        return;
      }
      if (!listSlots()[target]?.empty) {
        const yes = await ask(`Import over ${slotTitle(target)}? The save in it now is lost.`, {
          title: `Overwrite ${slotTitle(target)}`,
          okLabel: 'Import',
          danger: true,
        });
        if (!yes) return;
      }
      const r = importSlotText(target, text);
      if (r.ok) textBox = null;
      say(r.ok ? `Imported into ${slotTitle(target)}.` : r.error, r.ok ? 'ok' : 'bad');
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
      Game.showMessage?.('Loaded. The battle is paused — Space to go on.', 200);
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
      const name = slotTitle(s.index);
      if (s.empty)
        return `<div class="save-line empty"><strong>${name}</strong><span>Empty</span></div>`;
      const when =
        typeof SaveThumbnail !== 'undefined'
          ? SaveThumbnail.formatSavedAt(s.savedAt)
          : new Date(s.savedAt).toLocaleString();
      return `<div class="save-line"><strong>${name}</strong><span>Wave ${escapeHtml(s.wave)} · ${escapeHtml(pretty(s.difficulty))} · ${escapeHtml(when)}</span></div>`;
    };
    host.innerHTML =
      `<div class="save-lines">${[getAutosave(), ...listSlots()].map(line).join('')}</div>` +
      '<button type="button" class="save-btn primary save-open-btn" data-save-open>SAVE / LOAD</button>';
    host.querySelector('[data-save-open]').addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      open({ fromPause: true });
    });
  }

  function init() {
    migrateLegacyQuickSave(loadStore());
    if (typeof setInterval === 'function') setInterval(tick, 1000);
  }

  return {
    init,
    open,
    close,
    isOpen,
    renderPauseSlots,
    listSlots,
    getAutosave,
    saveToSlot,
    autosave,
    loadFromSlot,
    deleteSlot,
    exportSlotText,
    importSlotText,
    formatPlayTime,
    getPlayMs: () => playMs,
    AUTO,
    validateSlot,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SaveManager = SaveManager;
