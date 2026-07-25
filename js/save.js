/**
 * Multi-slot save/load with checksum validation and error recovery.
 */
const SaveManager = (() => {
  // Shared helper — see js/html-util.js (loaded first).
  const escapeHtml = HtmlUtil.escapeHtml;
  const STORAGE_KEY = 'myth-and-blood-saves-v1';
  const SLOT_COUNT = 3;
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
      const raw = localStorage.getItem(LEGACY_QUICK_KEY);
      if (!raw || store.slots.some((s) => s)) return;
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
    if (!slot.data.version) return { ok: false, error: 'Incompatible save version' };
    return { ok: true };
  }

  function listSlots() {
    const store = loadStore();
    migrateLegacyQuickSave(store);
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    return store.slots.map((s, i) =>
      s
        ? {
            index: i,
            label: s.label,
            wave: s.wave,
            difficulty: s.difficulty,
            savedAt: s.savedAt,
            thumbnail: s.thumbnail || null,
          }
        : { index: i, empty: true }
    );
  }

  function saveToSlot(index, label) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: 'Invalid slot' };
    if (!Game.exportGameState) return { ok: false, error: 'Export unavailable' };
    const snap = Game.exportGameState();
    if (!snap) return { ok: false, error: 'Could not export game state' };
    let thumbnail = snap.thumbnail || null;
    if (!thumbnail && typeof SaveThumbnail !== 'undefined') {
      thumbnail = SaveThumbnail.capture();
      if (thumbnail) snap.thumbnail = thumbnail;
    }
    const store = loadStore();
    while (store.slots.length < SLOT_COUNT) store.slots.push(null);
    store.slots[idx] = wrapSnapshot(snap, label || `Wave ${snap.wave}`, thumbnail);
    if (!writeStore(store)) return { ok: false, error: 'Storage full or blocked' };
    return { ok: true, slot: idx };
  }

  function loadFromSlot(index) {
    const idx = index | 0;
    if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: 'Invalid slot' };
    const store = loadStore();
    const slot = store.slots?.[idx];
    const v = validateSlot(slot);
    if (!v.ok) return v;
    try {
      if (!Game.importGameState?.(slot.data)) {
        return { ok: false, error: 'Import failed — state rejected' };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'Import crashed' };
    }
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

  function renderPauseSlots() {
    const host = document.getElementById('save-slots');
    if (!host) return;
    const slots = listSlots();
    host.innerHTML = slots
      .map((s) => {
        if (s.empty) {
          return `<div class="save-slot empty"><span>Slot ${s.index + 1}</span><span>Empty</span></div>`;
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
    listSlots,
    saveToSlot,
    loadFromSlot,
    deleteSlot,
    renderPauseSlots,
    validateSlot,
    SLOT_COUNT,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.SaveManager = SaveManager;
