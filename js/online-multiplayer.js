/**
 * Online Multiplayer — async co-op (shared kingdom), PvP endless duels, PvE horde mode.
 * Client-side rooms + share codes (no dedicated server). Sync via copy/paste handoff blobs.
 */
const OnlineMultiplayer = (() => {
  const STORAGE_KEY = 'myth-and-blood-online-v1';

  let store = {
    playerId: null,
    playerName: 'Commander',
    rooms: {},
    pvpMatches: {},
    activeRoomId: null,
    activePvpId: null,
  };

  let pendingImport = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store = { ...store, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
    if (!store.playerId) store.playerId = `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (!store.rooms) store.rooms = {};
    if (!store.pvpMatches) store.pvpMatches = {};
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (_) {
      /* ignore */
    }
  }

  function toB64(obj) {
    const str = JSON.stringify(obj);
    try {
      return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    } catch (_) {
      return '';
    }
  }

  function fromB64(b64) {
    try {
      const norm = String(b64 || '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const pad = norm + '==='.slice((norm.length + 3) % 4);
      return JSON.parse(decodeURIComponent(escape(atob(pad))));
    } catch (_) {
      return null;
    }
  }

  function randomRoomId(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function getPlayerName() {
    return store.playerName || 'Commander';
  }

  function setPlayerName(name) {
    store.playerName = String(name || 'Commander').trim().slice(0, 24) || 'Commander';
    save();
  }

  function getLocalCommander() {
    return { id: store.playerId, name: getPlayerName() };
  }

  function getActiveRoom() {
    return store.activeRoomId ? store.rooms[store.activeRoomId] || null : null;
  }

  function getActivePvpMatch() {
    return store.activePvpId ? store.pvpMatches[store.activePvpId] || null : null;
  }

  function createCoopRoom(opts = {}) {
    const cmd = getLocalCommander();
    const room = {
      id: randomRoomId('COOP'),
      seed: opts.seed || `coop-${Date.now()}`,
      difficulty: opts.difficulty || 'normal',
      kingdomName: opts.kingdomName || 'Shared Kingdom',
      commanders: [cmd],
      turnIndex: 0,
      activeCommanderId: cmd.id,
      wave: 0,
      state: null,
      history: [{ type: 'create', commanderId: cmd.id, at: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active',
    };
    store.rooms[room.id] = room;
    store.activeRoomId = room.id;
    save();
    return room;
  }

  function joinCoopRoom(roomId, invitePayload) {
    let room = store.rooms[roomId];
    if (!room && invitePayload) room = invitePayload;
    if (!room) return null;
    const cmd = getLocalCommander();
    if (!room.commanders.some((c) => c.id === cmd.id)) {
      room.commanders.push(cmd);
      room.history.push({ type: 'join', commanderId: cmd.id, at: Date.now() });
    }
    store.rooms[room.id] = room;
    store.activeRoomId = room.id;
    room.updatedAt = Date.now();
    save();
    if (typeof GameModes !== 'undefined') {
      GameModes.setMenuMode('async_coop');
      GameModes.setMenuSeed(room.seed);
    }
    return room;
  }

  function isMyCoopTurn() {
    const room = getActiveRoom();
    if (!room) return true;
    return room.activeCommanderId === store.playerId;
  }

  function recordCoopWave(wave) {
    const room = getActiveRoom();
    if (!room) return;
    room.wave = Math.max(room.wave || 0, wave);
    const cmd = room.commanders.find((c) => c.id === store.playerId);
    if (cmd) {
      cmd.wavesPlayed = (cmd.wavesPlayed || 0) + 1;
      cmd.lastActive = Date.now();
    }
    room.updatedAt = Date.now();
    save();
  }

  function handoffKingdom(gameSnap) {
    const room = getActiveRoom();
    if (!room || !gameSnap) return { ok: false, error: 'No active co-op room' };
    if (!isMyCoopTurn()) return { ok: false, error: 'Not your turn to hand off' };

    // Deep clone — exportGameState historically reused arrays by reference.
    let snap;
    try {
      snap =
        typeof structuredClone === 'function'
          ? structuredClone(gameSnap)
          : JSON.parse(JSON.stringify(gameSnap));
    } catch (_) {
      snap = JSON.parse(JSON.stringify(gameSnap));
    }

    room.state = snap;
    room.wave = snap.wave ?? room.wave;
    room.history.push({
      type: 'handoff',
      commanderId: store.playerId,
      wave: snap.wave,
      at: Date.now(),
    });
    room.turnIndex = (room.turnIndex + 1) % Math.max(1, room.commanders.length);
    room.activeCommanderId = room.commanders[room.turnIndex]?.id || store.playerId;
    room.updatedAt = Date.now();
    save();

    const code = exportKingdomCode(room, snap);
    return { ok: true, code, nextCommander: room.commanders[room.turnIndex]?.name || 'Partner' };
  }

  function exportCoopInvite(room) {
    if (!room) return null;
    const payload = {
      v: 1,
      room: {
        id: room.id,
        seed: room.seed,
        difficulty: room.difficulty,
        kingdomName: room.kingdomName,
        commanders: room.commanders,
        turnIndex: room.turnIndex,
        activeCommanderId: room.activeCommanderId,
        wave: room.wave,
        status: room.status,
      },
    };
    return `COOP:${toB64(payload)}`;
  }

  function exportKingdomCode(room, state) {
    const payload = {
      v: 1,
      roomId: room.id,
      seed: room.seed,
      difficulty: room.difficulty,
      turnIndex: room.turnIndex,
      activeCommanderId: room.activeCommanderId,
      commanders: room.commanders,
      state,
    };
    return `KINGDOM:${toB64(payload)}`;
  }

  function importShareCode(code) {
    const raw = String(code || '').trim();
    if (!raw) return { ok: false, error: 'Empty code' };

    if (raw.startsWith('COOP:')) {
      const payload = fromB64(raw.slice(5));
      if (!payload?.room) return { ok: false, error: 'Invalid co-op invite' };
      const room = joinCoopRoom(payload.room.id, { ...payload.room, history: [{ type: 'import', at: Date.now() }] });
      return { ok: true, type: 'coop', room };
    }

    if (raw.startsWith('KINGDOM:')) {
      const payload = fromB64(raw.slice(8));
      if (!payload?.state) return { ok: false, error: 'Invalid kingdom handoff' };
      joinCoopRoom(payload.roomId, {
        id: payload.roomId,
        seed: payload.seed,
        difficulty: payload.difficulty,
        commanders: payload.commanders || [],
        turnIndex: payload.turnIndex ?? 0,
        activeCommanderId: payload.activeCommanderId,
        wave: payload.state.wave,
        state: payload.state,
        history: [{ type: 'import', at: Date.now() }],
        status: 'active',
        updatedAt: Date.now(),
      });
      pendingImport = payload.state;
      if (typeof GameModes !== 'undefined') {
        GameModes.setMenuMode('async_coop');
        GameModes.setMenuSeed(payload.seed);
      }
      return { ok: true, type: 'kingdom', pending: true };
    }

    if (raw.startsWith('PVP:')) {
      const id = raw.slice(4).split(':')[0];
      const match = store.pvpMatches[id];
      if (!match) return { ok: false, error: 'PvP match not found locally — paste full PVPDATA code' };
      store.activePvpId = match.id;
      save();
      if (typeof GameModes !== 'undefined') {
        GameModes.setMenuMode('pvp_endless');
        GameModes.setMenuSeed(match.seed);
      }
      return { ok: true, type: 'pvp', match };
    }

    if (raw.startsWith('PVPDATA:')) {
      const payload = fromB64(raw.slice(8));
      if (!payload?.match) return { ok: false, error: 'Invalid PvP data' };
      store.pvpMatches[payload.match.id] = payload.match;
      store.activePvpId = payload.match.id;
      save();
      if (typeof GameModes !== 'undefined') {
        GameModes.setMenuMode('pvp_endless');
        GameModes.setMenuSeed(payload.match.seed);
      }
      return { ok: true, type: 'pvp', match: payload.match };
    }

    return { ok: false, error: 'Unknown code prefix' };
  }

  function consumePendingImport() {
    const snap = pendingImport;
    pendingImport = null;
    return snap;
  }

  function hasPendingImport() {
    return !!pendingImport;
  }

  function createPvpMatch(opts = {}) {
    const match = {
      id: randomRoomId('PVP'),
      seed: opts.seed || `pvp-${Date.now()}`,
      difficulty: opts.difficulty || 'normal',
      entries: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'open',
      winnerId: null,
    };
    store.pvpMatches[match.id] = match;
    store.activePvpId = match.id;
    save();
    if (typeof GameModes !== 'undefined') {
      GameModes.setMenuMode('pvp_endless');
      GameModes.setMenuSeed(match.seed);
    }
    return match;
  }

  function submitPvpResult(result) {
    const match = getActivePvpMatch();
    if (!match || !result) return null;
    const entry = {
      commanderId: store.playerId,
      name: getPlayerName(),
      wave: result.wave,
      kills: result.kills,
      score: result.score,
      victory: !!result.victory,
      at: Date.now(),
    };
    match.entries = match.entries.filter((e) => e.commanderId !== store.playerId);
    match.entries.push(entry);
    match.updatedAt = Date.now();
    if (match.entries.length >= 2) {
      match.entries.sort((a, b) => b.score - a.score || b.wave - a.wave);
      match.winnerId = match.entries[0].commanderId;
      match.status = 'resolved';
    }
    save();
    return { match, entry, winner: match.entries[0] };
  }

  function exportPvpInvite(match) {
    if (!match) return null;
    return `PVP:${match.id}`;
  }

  function exportPvpData(match) {
    if (!match) return null;
    return `PVPDATA:${toB64({ v: 1, match })}`;
  }

  function getCoopStatusLine() {
    const room = getActiveRoom();
    if (!room) return null;
    const active = room.commanders.find((c) => c.id === room.activeCommanderId);
    const mine = isMyCoopTurn();
    return `${room.kingdomName} · W${room.wave || 0} · ${mine ? 'Your turn' : `${active?.name || 'Partner'}'s turn`}`;
  }

  function getPvpStatusLine() {
    const match = getActivePvpMatch();
    if (!match) return null;
    const mine = match.entries.find((e) => e.commanderId === store.playerId);
    const opp = match.entries.find((e) => e.commanderId !== store.playerId);
    if (match.status === 'resolved' && match.entries.length >= 2) {
      const won = match.winnerId === store.playerId;
      return won ? 'PvP won — highest score' : `PvP lost — ${match.entries[0].name} wins`;
    }
    if (mine && opp) return `PvP tied score check — you W${mine.wave} vs ${opp.name} W${opp.wave}`;
    if (mine) return `PvP submitted W${mine.wave} — awaiting opponent`;
    return `PvP match · seed ${match.seed.slice(0, 12)}…`;
  }

  function renderMenuPanel() {
    const el = document.getElementById('online-multiplayer-panel');
    if (!el) return;

    const room = getActiveRoom();
    const pvp = getActivePvpMatch();
    const menu = typeof GameModes !== 'undefined' ? GameModes.getMenu() : { modeId: 'campaign' };
    const showCoop = menu.modeId === 'async_coop' || room;
    const showPvp = menu.modeId === 'pvp_endless' || pvp;

    el.innerHTML = `
      <div class="online-panel-head">ONLINE MULTIPLAYER</div>
      <p class="online-panel-intro">Async play via share codes — copy handoffs between friends. No server required.</p>
      <label class="settings-row online-name-row">
        <span>Your name</span>
        <input type="text" id="online-player-name" class="panel-search" maxlength="24" value="${escapeHtml(getPlayerName())}" />
      </label>
      <div class="online-actions-row">
        <button type="button" id="online-create-coop" class="menu-btn small-btn">CREATE CO-OP ROOM</button>
        <button type="button" id="online-create-pvp" class="menu-btn small-btn">CREATE PVP MATCH</button>
      </div>
      <div class="online-import-row">
        <input id="online-import-code" class="panel-search" type="text" placeholder="Paste COOP: / KINGDOM: / PVP: / PVPDATA: code…" autocomplete="off" />
        <button type="button" id="online-import-btn" class="menu-btn small-btn">IMPORT</button>
      </div>
      <p id="online-import-status" class="online-status"></p>
      ${
        showCoop && room
          ? `<div class="online-card">
          <div class="online-card-title">Shared Kingdom — ${escapeHtml(room.kingdomName)}</div>
          <div class="online-card-meta">Room ${room.id} · Seed ${escapeHtml(room.seed)} · Wave ${room.wave || 0}</div>
          <div class="online-card-meta">Commanders: ${room.commanders.map((c) => escapeHtml(c.name)).join(' · ')}</div>
          <div class="online-card-meta">${isMyCoopTurn() ? '<strong>Your turn</strong>' : `Waiting — ${escapeHtml(room.commanders.find((c) => c.id === room.activeCommanderId)?.name || 'partner')}'s turn`}</div>
          <button type="button" id="online-copy-coop" class="menu-btn small-btn">COPY CO-OP INVITE</button>
          ${room.state ? `<button type="button" id="online-continue-kingdom" class="menu-btn small-btn primary">CONTINUE SHARED KINGDOM</button>` : ''}
        </div>`
          : ''
      }
      ${
        showPvp && pvp
          ? `<div class="online-card">
          <div class="online-card-title">PvP Endless — ${pvp.id}</div>
          <div class="online-card-meta">Seed ${escapeHtml(pvp.seed)} · ${pvp.entries.length} submission(s)</div>
          ${
            pvp.entries.length
              ? `<ol class="online-pvp-list">${pvp.entries
                  .map((e) => `<li>${escapeHtml(e.name)} — W${e.wave} · score ${e.score}</li>`)
                  .join('')}</ol>`
              : '<p class="online-card-meta">No scores yet — both players run endless with the same seed.</p>'
          }
          ${pvp.status === 'resolved' ? `<div class="online-card-winner">Winner: ${escapeHtml(pvp.entries[0]?.name || '?')}</div>` : ''}
          <button type="button" id="online-copy-pvp" class="menu-btn small-btn">COPY PVP CODE</button>
          <button type="button" id="online-copy-pvpdata" class="menu-btn small-btn">COPY FULL MATCH DATA</button>
        </div>`
          : ''
      }
    `;

    document.getElementById('online-player-name')?.addEventListener('change', (e) => {
      setPlayerName(e.target.value);
    });

    document.getElementById('online-create-coop')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const diff =
        document.querySelector('.diff-btn.selected')?.dataset?.diff ||
        (typeof Game !== 'undefined' ? Game.getDifficulty?.() : 'normal') ||
        'normal';
      createCoopRoom({ difficulty: diff });
      if (typeof GameModes !== 'undefined') GameModes.setMenuMode('async_coop');
      renderMenuPanel();
      Settings?.announce?.('Co-op room created');
    });

    document.getElementById('online-create-pvp')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      const diff = document.querySelector('.diff-btn.selected')?.dataset?.diff || 'normal';
      createPvpMatch({ difficulty: diff });
      renderMenuPanel();
      Settings?.announce?.('PvP match created');
    });

    document.getElementById('online-import-btn')?.addEventListener('click', () => {
      const inp = document.getElementById('online-import-code');
      const status = document.getElementById('online-import-status');
      const res = importShareCode(inp?.value);
      AudioEngine?.SFX?.click?.();
      if (status) {
        status.textContent = res.ok
          ? `Imported ${res.type} — ${res.type === 'kingdom' ? 'click Continue Shared Kingdom or Begin Defense' : 'ready to play'}`
          : res.error || 'Import failed';
      }
      if (res.ok) {
        inp.value = '';
        renderMenuPanel();
        if (typeof GameModes !== 'undefined') GameModes.renderMenuPanel?.();
      }
    });

    document.getElementById('online-copy-coop')?.addEventListener('click', async () => {
      const code = exportCoopInvite(room);
      if (code && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        AudioEngine?.SFX?.click?.();
        document.getElementById('online-import-status').textContent = 'Co-op invite copied!';
      }
    });

    document.getElementById('online-copy-pvp')?.addEventListener('click', async () => {
      const code = exportPvpInvite(pvp);
      if (code && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        AudioEngine?.SFX?.click?.();
        document.getElementById('online-import-status').textContent = 'PvP code copied!';
      }
    });

    document.getElementById('online-copy-pvpdata')?.addEventListener('click', async () => {
      const code = exportPvpData(pvp);
      if (code && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        AudioEngine?.SFX?.click?.();
        document.getElementById('online-import-status').textContent = 'Full PvP match data copied!';
      }
    });

    document.getElementById('online-continue-kingdom')?.addEventListener('click', () => {
      if (!room?.state) return;
      pendingImport = room.state;
      AudioEngine?.SFX?.click?.();
      document.getElementById('start-btn')?.click();
    });
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bindPauseMenu() {
    document.getElementById('pause-coop-handoff')?.addEventListener('click', () => {
      if (!Game.isPlaying?.() || !Game.exportGameState) return;
      const snap = Game.exportGameState();
      const res = handoffKingdom(snap);
      AudioEngine?.SFX?.click?.();
      if (!res.ok) {
        Game.showMessage?.(res.error || 'Handoff failed', 200);
        return;
      }
      if (res.code && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(res.code).catch(() => {});
      }
      Game.showMessage?.(`Kingdom handed to ${res.nextCommander}. Code copied!`, 280);
      Settings?.announce?.(`Handoff to ${res.nextCommander}`);
      if (typeof UX !== 'undefined') UX.updatePauseMenu?.(Game.getState());
    });
  }

  function onWaveComplete(wave) {
    const session = typeof GameModes !== 'undefined' ? GameModes.getSession() : null;
    if (session?.modeId === 'async_coop') recordCoopWave(wave);
  }

  function onRunEnded(wave, kills, victory, score) {
    const session = typeof GameModes !== 'undefined' ? GameModes.getSession() : null;
    if (session?.modeId === 'pvp_endless') {
      return submitPvpResult({ wave, kills, score, victory });
    }
    return null;
  }

  function getSessionOverlay() {
    const session = typeof GameModes !== 'undefined' ? GameModes.getSession() : null;
    if (!session) return null;
    if (session.modeId === 'async_coop') {
      return {
        type: 'coop',
        room: getActiveRoom(),
        myTurn: isMyCoopTurn(),
        statusLine: getCoopStatusLine(),
      };
    }
    if (session.modeId === 'pvp_endless') {
      return {
        type: 'pvp',
        match: getActivePvpMatch(),
        statusLine: getPvpStatusLine(),
      };
    }
    if (session.modeId === 'pve_horde') {
      return { type: 'horde', statusLine: 'PvE Horde — every wave is an assault' };
    }
    return null;
  }

  function init() {
    load();
    bindPauseMenu();
    renderMenuPanel();
  }

  return {
    init,
    load,
    save,
    getPlayerName,
    setPlayerName,
    getActiveRoom,
    getActivePvpMatch,
    createCoopRoom,
    joinCoopRoom,
    isMyCoopTurn,
    handoffKingdom,
    exportCoopInvite,
    exportKingdomCode,
    exportPvpInvite,
    exportPvpData,
    importShareCode,
    consumePendingImport,
    hasPendingImport,
    createPvpMatch,
    submitPvpResult,
    getCoopStatusLine,
    getPvpStatusLine,
    getSessionOverlay,
    renderMenuPanel,
    onWaveComplete,
    onRunEnded,
    isForceHordeMode(session) {
      return session?.modeId === 'pve_horde' || !!session?.forceHorde;
    },
    getHordeCountMult(session) {
      return session?.hordeCountMult || 1;
    },
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.OnlineMultiplayer = OnlineMultiplayer;
