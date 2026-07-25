/**
 * Level Editor — design, save, and load custom battlefields in Creative Mode.
 */
const LevelEditor = (() => {
  const VERSION = 1;
  const LIBRARY_KEY = 'myth-and-blood-level-library-v1';
  const MAX_UNDO = 48;

  const TOOLS = [
    { id: 'level_select', label: 'Select', short: 'Sel' },
    { id: 'level_paint_tree', label: 'Tree', short: 'Tree' },
    { id: 'level_paint_rock', label: 'Rock', short: 'Rock' },
    { id: 'level_paint_barricade', label: 'Barricade', short: 'Bar' },
    { id: 'level_erase', label: 'Erase', short: 'Del' },
    { id: 'level_move', label: 'Move', short: 'Mv' },
  ];

  let library = [];
  let undoStack = [];
  let redoStack = [];
  let gridSnap = true;
  let gridSize = 16;
  let movePending = null;
  let activeLevelId = null;

  function loadLibrary() {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (raw) library = JSON.parse(raw) || [];
    } catch (_) {
      library = [];
    }
  }

  function saveLibrary() {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch (_) {
      /* ignore */
    }
  }

  function newId() {
    return `lvl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function snapCoord(n) {
    if (!gridSnap) return n;
    return Math.round(n / gridSize) * gridSize;
  }

  function snapPos(x, y) {
    return { x: snapCoord(x), y: snapCoord(y) };
  }

  function captureState() {
    return Game?.getLevelSnapshot?.({
      id: activeLevelId,
      name: document.getElementById('level-editor-name')?.value?.trim() || 'Untitled Level',
      description: document.getElementById('level-editor-desc')?.value?.trim() || '',
    });
  }

  function pushUndo() {
    const snap = captureState();
    if (!snap) return;
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    renderUndoStatus();
  }

  function applyState(state) {
    if (!state || !Game?.loadCreativeLevel) return false;
    Game.loadCreativeLevel(state);
    if (state.id) activeLevelId = state.id;
    const nameEl = document.getElementById('level-editor-name');
    const descEl = document.getElementById('level-editor-desc');
    if (nameEl && state.name) nameEl.value = state.name;
    if (descEl && state.description != null) descEl.value = state.description;
    if (state.customWave) Game.setCustomWave?.(state.customWave);
    UI?.updateHUD?.(true);
    renderLevelSummary();
    return true;
  }

  function undo() {
    if (!undoStack.length) return false;
    const current = captureState();
    if (current) redoStack.push(current);
    const prev = undoStack.pop();
    applyState(prev);
    renderUndoStatus();
    Game?.showMessage?.('Level editor: undo.', 100);
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    const current = captureState();
    if (current) undoStack.push(current);
    const next = redoStack.pop();
    applyState(next);
    renderUndoStatus();
    Game?.showMessage?.('Level editor: redo.', 100);
    return true;
  }

  function setTool(toolId) {
    if (!Game?.isCreativeMode?.()) return;
    movePending = null;
    if (toolId === 'level_select') {
      Game.creativeSetTool(null);
    } else {
      Game.creativeSetTool(toolId);
    }
    highlightTool(toolId);
    renderToolStatus();
  }

  function highlightTool(toolId = 'level_select') {
    document.querySelectorAll('[data-level-tool]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.levelTool === toolId);
    });
  }

  function clearToolSelection() {
    movePending = null;
    highlightTool('level_select');
    renderToolStatus();
  }

  function findEntityAt(x, y, radius = 30) {
    let best = null;
    let bestDist = radius;
    const decos = Game.getState?.()?.decorations || [];
    for (let i = 0; i < decos.length; i++) {
      const d = decos[i];
      if (d.hp <= 0) continue;
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < bestDist) {
        best = { kind: 'deco', index: i, dist };
        bestDist = dist;
      }
    }
    for (const u of Game.getState?.()?.units || []) {
      if (u.hp <= 0) continue;
      const dist = Math.hypot(u.x - x, u.y - y);
      if (dist < bestDist) {
        best = { kind: 'unit', id: u.id, dist };
        bestDist = dist;
      }
    }
    for (const b of Game.getState?.()?.buildings || []) {
      if (b.hp <= 0) continue;
      const dist = Math.hypot(b.x - x, b.y - y);
      if (dist < bestDist) {
        best = { kind: 'building', id: b.id, dist };
        bestDist = dist;
      }
    }
    return best;
  }

  function onMapClick(x, y) {
    if (!Game?.isCreativeMode?.()) return false;
    const gs = Game.getState();
    const tool = gs?.creativeTool;
    const pos = snapPos(x, y);

    if (tool === 'level_paint_tree' || tool === 'level_paint_rock' || tool === 'level_paint_barricade') {
      pushUndo();
      const type = tool.replace('level_paint_', '');
      Game.creativePlaceDecoration?.(type, pos.x, pos.y);
      return true;
    }
    if (tool === 'level_erase') {
      pushUndo();
      Game.creativeEraseAt?.(pos.x, pos.y);
      UI?.updateHUD?.(true);
      return true;
    }
    if (tool === 'level_move') {
      if (!movePending) {
        const hit = findEntityAt(pos.x, pos.y);
        if (!hit) {
          Game.showMessage?.('Move: click a unit, building, or terrain object.');
          return false;
        }
        movePending = hit;
        if (hit.kind === 'unit') Game.clearSelection?.();
        Game.showMessage?.('Move: click destination.', 140);
        return true;
      }
      pushUndo();
      if (movePending.kind === 'unit') {
        Game.creativeMoveUnitTo?.(movePending.id, pos.x, pos.y);
      } else if (movePending.kind === 'building') {
        Game.creativeMoveBuildingTo?.(movePending.id, pos.x, pos.y);
      } else if (movePending.kind === 'deco') {
        Game.creativeMoveDecorationTo?.(movePending.index, pos.x, pos.y);
      }
      movePending = null;
      UI?.updateHUD?.(true);
      return true;
    }
    return false;
  }

  function getToolOverlayLabel(gs) {
    const tool = gs?.creativeTool;
    if (!tool?.startsWith('level_')) return null;
    const def = TOOLS.find((t) => t.id === tool);
    if (tool === 'level_move' && movePending) return 'MOVE — pick destination';
    return def ? `LEVEL: ${def.label}` : 'LEVEL EDITOR';
  }

  function renderToolStatus() {
    const el = document.getElementById('level-editor-tool-status');
    if (!el) return;
    const gs = Game.getState?.();
    const tool = gs?.creativeTool;
    if (!tool?.startsWith('level_')) {
      el.textContent = 'Pick a level tool, then click the map.';
      return;
    }
    const def = TOOLS.find((t) => t.id === tool);
    el.textContent = movePending
      ? `Tool: ${def?.label || tool} — entity selected, click destination`
      : `Tool: ${def?.label || tool} — click map${gridSnap ? ` (grid ${gridSize})` : ''}`;
  }

  function renderUndoStatus() {
    const el = document.getElementById('level-editor-undo-status');
    if (!el) return;
    el.textContent = `Undo ${undoStack.length} · Redo ${redoStack.length}`;
  }

  function renderLevelSummary() {
    const el = document.getElementById('level-editor-summary');
    if (!el || !Game?.getState) return;
    const gs = Game.getState();
    const decos = gs.decorations?.length || 0;
    const units = gs.units?.filter((u) => u.hp > 0).length || 0;
    const bld = gs.buildings?.filter((b) => b.hp > 0).length || 0;
    el.textContent = `Wave ${gs.wave} · ${gs.worldW}×${gs.worldH} · ${units} units · ${bld} buildings · ${decos} terrain`;
  }

  function refreshLibrarySelect() {
    const sel = document.getElementById('level-editor-library');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML =
      '<option value="">— Saved levels —</option>' +
      library
        .map(
          (l) =>
            `<option value="${l.id}">${l.name || 'Untitled'} (W${l.wave ?? 0} · ${l.modifiedAt?.slice(0, 10) || '—'})</option>`
        )
        .join('');
    if (cur) sel.value = cur;
  }

  function saveToLibrary() {
    const snap = captureState();
    if (!snap) return false;
    snap.modifiedAt = new Date().toISOString();
    if (!snap.createdAt) snap.createdAt = snap.modifiedAt;
    if (!activeLevelId) {
      activeLevelId = newId();
      snap.id = activeLevelId;
      snap.createdAt = snap.modifiedAt;
      library.unshift(snap);
    } else {
      snap.id = activeLevelId;
      const idx = library.findIndex((l) => l.id === activeLevelId);
      if (idx >= 0) library[idx] = snap;
      else library.unshift(snap);
    }
    library = library.slice(0, 40);
    saveLibrary();
    refreshLibrarySelect();
    document.getElementById('level-editor-library').value = activeLevelId;
    Game?.showMessage?.(`Level saved: ${snap.name}`, 200);
    renderLevelSummary();
    return true;
  }

  function loadFromLibrary(id) {
    const level = library.find((l) => l.id === id);
    if (!level) return false;
    pushUndo();
    activeLevelId = level.id;
    applyState(level);
    Game?.showMessage?.(`Loaded level: ${level.name}`, 220);
    return true;
  }

  function deleteFromLibrary(id) {
    if (!id) return false;
    library = library.filter((l) => l.id !== id);
    saveLibrary();
    refreshLibrarySelect();
    if (activeLevelId === id) activeLevelId = null;
    return true;
  }

  function newBlankLevel() {
    pushUndo();
    activeLevelId = null;
    const blank = {
      v: VERSION,
      type: 'level',
      name: 'New Level',
      description: '',
      wave: 0,
      tactical: 9999,
      timeOfDay: 'day',
      settings: {
        freeResources: true,
        noGameOver: true,
        noAutoCycle: true,
        instantBuild: true,
        unlockAll: true,
        academyDeploy: true,
      },
      units: [
        { type: 'footman', team: 'player', x: 0, y: 0, hp: 100, maxHp: 100 },
        { type: 'footman', team: 'player', x: 0, y: 0, hp: 100, maxHp: 100 },
      ],
      buildings: [],
      decorations: [],
      customWave: null,
    };
    const cx = Game.getWorldCenter?.() || { x: 400, y: 300 };
    blank.units = blank.units.map((u, i) => ({
      ...u,
      x: cx.x - 40 + i * 36,
      y: cx.y + 20,
    }));
    applyState(blank);
    document.getElementById('level-editor-name').value = 'New Level';
    document.getElementById('level-editor-desc').value = '';
    Game?.showMessage?.('Blank level ready — paint terrain and place units.', 240);
    return true;
  }

  function exportLevel() {
    const json = JSON.stringify(captureState(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(captureState()?.name || 'level').replace(/\s+/g, '-').toLowerCase()}.mblevel.json`;
    a.click();
    URL.revokeObjectURL(url);
    Game?.showMessage?.('Level exported.', 140);
  }

  function importLevel(raw) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || data.type !== 'level') return { ok: false, msg: 'Not a level file.' };
      if (data.v !== VERSION) return { ok: false, msg: 'Unsupported level version.' };
      pushUndo();
      activeLevelId = data.id || null;
      applyState(data);
      return { ok: true, name: data.name };
    } catch (e) {
      return { ok: false, msg: e.message || 'Parse failed.' };
    }
  }

  function clearLayer(layer) {
    pushUndo();
    if (layer === 'terrain') Game?.creativeClearDecorations?.();
    else if (layer === 'buildings') Game?.creativeClearAllBuildings?.();
    else if (layer === 'units') Game?.creativeClearAllUnits?.();
    else if (layer === 'all') {
      Game?.creativeClearDecorations?.();
      Game?.creativeClearAllBuildings?.();
      Game?.creativeClearAllUnits?.();
      Game?.creativeClearEnemies?.();
    }
    UI?.updateHUD?.(true);
    renderLevelSummary();
    Game?.showMessage?.(`Cleared ${layer}.`, 120);
  }

  function playtest() {
    if (Game?.creativeForceDay) Game.creativeForceDay();
    Game?.showMessage?.('Playtest — use Start Wave or Launch to test your composition.', 260);
    Game?.setPaused?.(false);
  }

  function bind() {
    document.querySelectorAll('[data-level-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        AudioEngine?.SFX?.click?.();
        setTool(btn.dataset.levelTool);
      });
    });
    document.getElementById('level-editor-undo')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      undo();
    });
    document.getElementById('level-editor-redo')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      redo();
    });
    document.getElementById('level-editor-grid')?.addEventListener('change', (e) => {
      gridSnap = e.target.checked;
      renderToolStatus();
    });
    document.getElementById('level-editor-save')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      saveToLibrary();
    });
    document.getElementById('level-editor-load')?.addEventListener('click', () => {
      const id = document.getElementById('level-editor-library')?.value;
      if (!id) {
        Game?.showMessage?.('Pick a saved level first.');
        return;
      }
      AudioEngine?.SFX?.click?.();
      loadFromLibrary(id);
    });
    document.getElementById('level-editor-delete')?.addEventListener('click', () => {
      const id = document.getElementById('level-editor-library')?.value;
      if (!id || !confirm('Delete this saved level?')) return;
      AudioEngine?.SFX?.click?.();
      deleteFromLibrary(id);
      Game?.showMessage?.('Level deleted from library.', 140);
    });
    document.getElementById('level-editor-new')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      newBlankLevel();
    });
    document.getElementById('level-editor-export')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      exportLevel();
    });
    document.getElementById('level-editor-import')?.addEventListener('click', () => {
      const raw = document.getElementById('level-editor-import-area')?.value?.trim();
      if (!raw) {
        Game?.showMessage?.('Paste level JSON in the import box.');
        return;
      }
      AudioEngine?.SFX?.click?.();
      const res = importLevel(raw);
      Game?.showMessage?.(res.ok ? `Imported: ${res.name}` : res.msg || 'Import failed.');
    });
    document.getElementById('level-editor-playtest')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      playtest();
    });
    document.getElementById('level-editor-clear-terrain')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      clearLayer('terrain');
    });
    document.getElementById('level-editor-clear-buildings')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      clearLayer('buildings');
    });
    document.getElementById('level-editor-clear-units')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      clearLayer('units');
    });
    document.getElementById('level-editor-clear-all')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      clearLayer('all');
    });
  }

  function onHudUpdate(gs) {
    if (!gs?.creativeMode) return;
    renderToolStatus();
    renderLevelSummary();
    renderUndoStatus();
  }

  function onSessionStart() {
    undoStack = [];
    redoStack = [];
    movePending = null;
    activeLevelId = null;
    renderUndoStatus();
    renderLevelSummary();
  }

  function init() {
    loadLibrary();
    refreshLibrarySelect();
    bind();
    renderUndoStatus();
  }

  return {
    VERSION,
    TOOLS,
    init,
    onHudUpdate,
    onSessionStart,
    onMapClick,
    getToolOverlayLabel,
    setTool,
    clearToolSelection,
    pushUndo,
    undo,
    redo,
    saveToLibrary,
    loadFromLibrary,
    importLevel,
    exportLevel,
    newBlankLevel,
    snapPos,
    isGridSnap: () => gridSnap,
  };
})();