/**
 * Play by share code: co-op (one kingdom passed back and forth), PvP endless duels, PvE horde.
 *
 * There is NO networking here: no server, no connection between players. A player copies a
 * code and sends it to the other by any means (chat, email); the other pastes it in.
 *
 * Co-op hand-off. A KINGDOM code carries the whole game as a versioned save (the same
 * format as a save slot: SaveFormat in js/save-registry.js, checksum included) plus the
 * room: commander list, a turn counter and who made the code. Whoever takes a hand-off code
 * holds the turn; handing off gives it up. A code older than the game you already have, or
 * the code you made yourself, is refused. A code from a newer version of the game is
 * refused with a message and changes nothing.
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
    if (!store.playerId)
      store.playerId = `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  // Bump when the shape of a code changes; a code with a higher number is refused.
  const CODE_VERSION = 2;
  const MSG_NEWER_CODE =
    'This code was made by a newer version of the game. Update the game to use it; nothing was changed.';

  function toB64(obj) {
    return SaveFormat.toText(obj);
  }

  function fromB64(text) {
    return SaveFormat.fromText(text);
  }

  function randomRoomId(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function getPlayerName() {
    return store.playerName || 'Commander';
  }

  function setPlayerName(name) {
    store.playerName =
      String(name || 'Commander')
        .trim()
        .slice(0, 24) || 'Commander';
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
      turn: 0,
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

  /** The commander after me in the room's order, or null when I am the only one listed. */
  function nextCommanderAfterMe(room) {
    const list = room.commanders || [];
    const mine = list.findIndex((c) => c.id === store.playerId);
    if (list.length < 2) return null;
    return list[(Math.max(0, mine) + 1) % list.length];
  }

  /**
   * End my turn: returns { ok, code, nextCommander }. The code holds the whole game; the
   * turn passes to whoever takes it (the next commander in the list, if the room has one).
   */
  function handoffKingdom(gameSnap) {
    const room = getActiveRoom();
    if (!room || !gameSnap) return { ok: false, error: 'There is no shared game to hand off.' };
    if (!isMyCoopTurn()) {
      return {
        ok: false,
        error: 'It is not your turn to hand off. Wait for a code from your partner.',
      };
    }
    // The save must be a sound one before it leaves this machine.
    const checked = SaveFormat.prepare(gameSnap);
    if (!checked.ok) return { ok: false, error: checked.error };
    const snap = SaveFormat.seal(checked.snap);
    delete snap.thumbnail;

    if (!room.commanders.some((c) => c.id === store.playerId)) {
      room.commanders.push(getLocalCommander());
    }
    const next = nextCommanderAfterMe(room);
    room.state = snap;
    room.wave = snap.wave ?? room.wave;
    room.history.push({
      type: 'handoff',
      commanderId: store.playerId,
      wave: snap.wave,
      at: Date.now(),
    });
    if (room.history.length > 40) room.history = room.history.slice(-40);
    room.turn = (room.turn || 0) + 1;
    room.turnIndex = next ? room.commanders.indexOf(next) : 0;
    // Not mine any more. With nobody else listed yet, it belongs to whoever takes the code.
    room.activeCommanderId = next ? next.id : null;
    room.updatedAt = Date.now();
    save();

    const code = exportKingdomCode(room, snap);
    return { ok: true, code, nextCommander: next ? next.name : 'your partner' };
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
        turn: room.turn || 0,
        activeCommanderId: room.activeCommanderId,
        wave: room.wave,
        status: room.status,
      },
    };
    return `COOP:${toB64(payload)}`;
  }

  function exportKingdomCode(room, state) {
    const payload = {
      v: CODE_VERSION,
      roomId: room.id,
      seed: room.seed,
      difficulty: room.difficulty,
      kingdomName: room.kingdomName,
      turn: room.turn || 0,
      from: getLocalCommander(),
      to: room.activeCommanderId || null,
      turnIndex: room.turnIndex,
      activeCommanderId: room.activeCommanderId,
      commanders: room.commanders,
      state,
    };
    return `KINGDOM:${toB64(payload)}`;
  }

  /** Take a hand-off code. Everything is checked before the room or the game is touched. */
  function importKingdomCode(text) {
    const payload = fromB64(text);
    if (!payload || typeof payload !== 'object' || !payload.state || !payload.roomId) {
      return { ok: false, error: SaveFormat.MSG.text };
    }
    if (Number.isInteger(payload.v) && payload.v > CODE_VERSION) {
      return { ok: false, error: MSG_NEWER_CODE, newer: true };
    }
    const checked = SaveFormat.prepare(payload.state);
    if (!checked.ok) return { ok: false, error: checked.error, newer: !!checked.newer };
    const me = getLocalCommander();
    const fromId = payload.from?.id || null;
    if (fromId && fromId === me.id) {
      return {
        ok: false,
        error: 'This is the code you made. Send it to your partner; it is their turn.',
      };
    }
    const have = store.rooms[payload.roomId];
    const turn = Number.isInteger(payload.turn) ? payload.turn : 0;
    if (have && Number.isInteger(have.turn) && turn <= have.turn && payload.v >= 2) {
      return {
        ok: false,
        error: 'This code is older than the game you already have. Ask for the latest code.',
      };
    }
    // Commander list: theirs, then anyone only I know of, then me.
    const commanders = [];
    const add = (c) => {
      if (c && c.id && !commanders.some((x) => x.id === c.id)) {
        commanders.push({ ...c, name: String(c.name || 'Commander').slice(0, 24) });
      }
    };
    (Array.isArray(payload.commanders) ? payload.commanders : []).forEach(add);
    add(payload.from);
    (have?.commanders || []).forEach(add);
    add(me);
    const state = SaveFormat.seal(checked.snap);
    const room = {
      id: payload.roomId,
      seed: payload.seed,
      difficulty: payload.difficulty || have?.difficulty || 'normal',
      kingdomName: payload.kingdomName || have?.kingdomName || 'Shared Kingdom',
      commanders,
      turn,
      turnIndex: commanders.findIndex((c) => c.id === me.id),
      // Taking the code is taking the turn.
      activeCommanderId: me.id,
      wave: state.wave,
      state,
      history: [...(have?.history || []), { type: 'import', from: fromId, at: Date.now() }].slice(
        -40
      ),
      createdAt: have?.createdAt || Date.now(),
      updatedAt: Date.now(),
      status: 'active',
    };
    store.rooms[room.id] = room;
    store.activeRoomId = room.id;
    save();
    pendingImport = state;
    if (typeof GameModes !== 'undefined') {
      GameModes.setMenuMode('async_coop');
      GameModes.setMenuSeed(room.seed);
    }
    return { ok: true, type: 'kingdom', pending: true, room, from: payload.from?.name || null };
  }

  function importShareCode(code) {
    const raw = String(code || '').trim();
    if (!raw) return { ok: false, error: 'Paste a code first.' };

    if (raw.startsWith('COOP:')) {
      const payload = fromB64(raw.slice(5));
      if (!payload?.room) return { ok: false, error: 'This co-op invite is not complete.' };
      if (Number.isInteger(payload.v) && payload.v > CODE_VERSION) {
        return { ok: false, error: MSG_NEWER_CODE, newer: true };
      }
      const room = joinCoopRoom(payload.room.id, {
        ...payload.room,
        history: [{ type: 'import', at: Date.now() }],
      });
      return { ok: true, type: 'coop', room };
    }

    if (raw.startsWith('KINGDOM:')) return importKingdomCode(raw.slice(8));

    if (raw.startsWith('PVP:')) {
      const id = raw.slice(4).split(':')[0];
      const match = store.pvpMatches[id];
      if (!match)
        return { ok: false, error: 'PvP match not found locally — paste full PVPDATA code' };
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
      if (!payload?.match) return { ok: false, error: 'This PvP code is not complete.' };
      if (Number.isInteger(payload.v) && payload.v > CODE_VERSION) {
        return { ok: false, error: MSG_NEWER_CODE, newer: true };
      }
      store.pvpMatches[payload.match.id] = payload.match;
      store.activePvpId = payload.match.id;
      save();
      if (typeof GameModes !== 'undefined') {
        GameModes.setMenuMode('pvp_endless');
        GameModes.setMenuSeed(payload.match.seed);
      }
      return { ok: true, type: 'pvp', match: payload.match };
    }

    return { ok: false, error: 'This is not a Myth and Blood share code.' };
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
    return `${room.kingdomName} · W${room.wave || 0} · ${mine ? 'Your turn' : `${active?.name || 'Your partner'}'s turn — waiting for their code`}`;
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
      <div class="online-panel-head">PLAY BY SHARE CODE</div>
      <p class="online-panel-intro">Players are not connected to each other. You take turns: copy a code, send it to your friend yourself (chat or email), and they paste it here.</p>
      <label class="settings-row online-name-row">
        <span>Your name</span>
        <input type="text" id="online-player-name" class="panel-search" maxlength="24" value="${escapeHtml(getPlayerName())}" />
      </label>
      <div class="online-actions-row">
        <button type="button" id="online-create-coop" class="menu-btn small-btn">START SHARED KINGDOM</button>
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
          <div class="online-card-meta">${isMyCoopTurn() ? '<strong>Your turn</strong> — play, then use Hand Off in the pause menu to get a code for your partner' : `Waiting for a code from ${escapeHtml(room.commanders.find((c) => c.id === room.activeCommanderId)?.name || 'your partner')}`}</div>
          <button type="button" id="online-copy-coop" class="menu-btn small-btn">COPY CO-OP INVITE</button>
          ${room.state && isMyCoopTurn() ? `<button type="button" id="online-continue-kingdom" class="menu-btn small-btn primary">CONTINUE SHARED KINGDOM</button>` : ''}
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
      Settings?.announce?.('Shared kingdom started');
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
      Game.showMessage?.(
        res.code && navigator.clipboard?.writeText
          ? `Your turn is over. The code is copied: send it to ${res.nextCommander}.`
          : `Your turn is over. Send the code to ${res.nextCommander}.`,
        320
      );
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
    // The run session reports PvP as survival with onlinePvp set, so check both.
    if (session?.onlinePvp || session?.modeId === 'pvp_endless') {
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
    if (session.onlinePvp || session.modeId === 'pvp_endless') {
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
    setPlayerName,
    getActiveRoom,
    getActivePvpMatch,
    createCoopRoom,
    isMyCoopTurn,
    handoffKingdom,
    exportCoopInvite,
    exportPvpData,
    importShareCode,
    consumePendingImport,
    hasPendingImport,
    createPvpMatch,
    submitPvpResult,
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
