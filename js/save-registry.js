/**
 * Save registry and save format.
 *
 * SaveRegistry — how a module puts its own run state into a save
 * ---------------------------------------------------------------
 * A module that keeps state for the current run registers one section. It does not need
 * to touch js/game.js: Game.exportGameState() calls every section's save(), and
 * Game.importGameState() calls every section's load().
 *
 *   if (typeof SaveRegistry !== 'undefined') {
 *     SaveRegistry.register('WarCamps', {
 *       version: 1,                       // optional, default 1; bump when the shape changes
 *       save() { return { camps, nextId }; },
 *       load(data, ctx) {                 // data is null when the save has no such section
 *         resetRun();                     // ALWAYS start from a clean run
 *         if (!data) return;
 *         camps = data.camps || [];
 *         nextId = data.nextId || 1;
 *       },
 *       migrate(data, fromVersion) {      // optional; old section data -> current shape
 *         return data;
 *       },
 *     });
 *   }
 *
 * Rules:
 *   - `name` is the key in the save file. Never rename it; old saves look it up by name.
 *   - save() returns plain data. Set and Map are allowed anywhere inside it (they are packed
 *     to JSON and handed back to load() as Set and Map). No functions, DOM nodes or live
 *     unit/building objects: store ids and look them up again in load().
 *   - load() runs after units, buildings and terrain are back, so ids resolve. It is called
 *     for EVERY load, with `null` when the save predates the module; reset to a fresh run
 *     then. `ctx` is the game's siege context (wave, isNight, creative, ...) and may be null.
 *   - A load() or migrate() that throws fails the whole load; the game then puts back the
 *     state it had before, so throw rather than half-apply bad data.
 *   - Not for settings (key bindings, volume): those belong to the browser, not to a run.
 *   - Sections load in registration order (script order). Use `after: ['Other']` if a
 *     section needs another one loaded first.
 *
 * Renamed ids: SaveRegistry.alias('unit', 'old_id', 'new_id') (kinds: unit, building,
 * faction, edict, research). Aliases are applied to every save while it is migrated, so a
 * rename does not drop saved soldiers. Other stores (achievements, meta progress) can call
 * SaveRegistry.resolveId(kind, id) on their own data.
 *
 * SaveFormat — the file itself
 * ----------------------------
 * A save is one JSON object: { version, checksum, savedAt, ...core run state,
 * modules: { <name>: { v, data } } }. SaveFormat.VERSION is the current version.
 *   1  original
 *   2  + nextWavePlan, cheatsUsed
 *   3  + checksum, terrain, rng, sim tick, generic unit/building fields, `modules` sections
 *      (siegeLoop / economyRules / research / progressionRestarts moved into `modules`)
 * Loading: prepare() checks the version (a newer one is refused), the checksum, then runs
 * the migration chain 1 -> 2 -> ... -> VERSION one step at a time, then validates the shape.
 * To change the format: bump VERSION and add MIGRATIONS[<old version>].
 * Text form (export, share codes): encode()/decode(), "MBSAVE1." + base64url(JSON). There is
 * no compressor in the repo that works without a promise, so the text is not compressed.
 *
 * Loaded before every module that registers (first script after html-util.js).
 */
const SaveRegistry = (() => {
  /** @type {Map<string, {save: Function, load: Function, migrate: Function|null, version: number, after: string[]}>} */
  const sections = new Map();
  const aliases = {};

  function register(name, def) {
    if (typeof name !== 'string' || !name) throw new Error('SaveRegistry.register: name required');
    if (!def || typeof def.save !== 'function' || typeof def.load !== 'function') {
      throw new Error(`SaveRegistry.register(${name}): save() and load() are required`);
    }
    sections.set(name, {
      save: def.save,
      load: def.load,
      migrate: typeof def.migrate === 'function' ? def.migrate : null,
      version: Number.isInteger(def.version) && def.version > 0 ? def.version : 1,
      after: Array.isArray(def.after) ? def.after.slice() : [],
    });
    return true;
  }

  function unregister(name) {
    return sections.delete(name);
  }

  function has(name) {
    return sections.has(name);
  }

  function names() {
    return [...sections.keys()];
  }

  /** Deep copy to plain JSON data; Set and Map become tagged arrays. */
  function pack(v, depth = 0) {
    if (depth > 40) throw new Error('save data nested too deep (a cycle?)');
    if (v === null || v === undefined) return null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? v : null;
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'function' || t === 'symbol' || t === 'bigint') return null;
    if (v instanceof Set || Object.prototype.toString.call(v) === '[object Set]') {
      return { $set: [...v].map((x) => pack(x, depth + 1)) };
    }
    if (v instanceof Map || Object.prototype.toString.call(v) === '[object Map]') {
      return { $map: [...v].map(([k, x]) => [pack(k, depth + 1), pack(x, depth + 1)]) };
    }
    if (Array.isArray(v)) return v.map((x) => pack(x, depth + 1));
    const out = {};
    for (const k of Object.keys(v)) {
      const x = v[k];
      if (x === undefined || typeof x === 'function') continue;
      out[k] = pack(x, depth + 1);
    }
    return out;
  }

  /** Inverse of pack(): tagged arrays become Set and Map again. Always a fresh copy. */
  function unpack(v) {
    if (v === null || v === undefined || typeof v !== 'object') return v ?? null;
    if (Array.isArray(v)) return v.map(unpack);
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '$set' && Array.isArray(v.$set)) {
      return new Set(v.$set.map(unpack));
    }
    if (keys.length === 1 && keys[0] === '$map' && Array.isArray(v.$map)) {
      return new Map(v.$map.map((e) => [unpack(e[0]), unpack(e[1])]));
    }
    const out = {};
    for (const k of keys) out[k] = unpack(v[k]);
    return out;
  }

  function ordered() {
    const out = [];
    const done = new Set();
    const visit = (name, trail) => {
      if (done.has(name) || !sections.has(name) || trail.includes(name)) return;
      for (const dep of sections.get(name).after) visit(dep, [...trail, name]);
      done.add(name);
      out.push(name);
    };
    for (const name of sections.keys()) visit(name, []);
    return out;
  }

  /** Every section's data: { name: { v, data } }. A section that throws fails the save. */
  function saveAll() {
    const out = {};
    for (const name of ordered()) {
      const sec = sections.get(name);
      let data;
      try {
        data = pack(sec.save());
      } catch (e) {
        throw new Error(`Could not save ${name}: ${e && e.message ? e.message : e}`);
      }
      out[name] = { v: sec.version, data };
    }
    return out;
  }

  /**
   * Hand every registered section its data (null when the save has none). Returns
   * { ok, errors, unknown }: `unknown` lists sections in the save that no loaded module
   * claims (a mod that is switched off, a module that was removed).
   */
  function loadAll(saved, ctx) {
    const src = saved && typeof saved === 'object' ? saved : {};
    const errors = [];
    for (const name of ordered()) {
      const sec = sections.get(name);
      const entry = src[name];
      try {
        let data = null;
        if (entry && typeof entry === 'object' && 'data' in entry) {
          const from = Number.isInteger(entry.v) ? entry.v : 1;
          if (from > sec.version) {
            throw new Error('saved by a newer version of the game');
          }
          data = unpack(entry.data);
          if (from < sec.version && sec.migrate) data = sec.migrate(data, from);
        }
        sec.load(data, ctx || null);
      } catch (e) {
        errors.push({ name, message: e && e.message ? e.message : String(e) });
      }
    }
    const unknown = Object.keys(src).filter((n) => !sections.has(n));
    return { ok: errors.length === 0, errors, unknown };
  }

  let clock = null;

  /** The game installs its tick counter here; see tick(). */
  function setClock(fn) {
    clock = typeof fn === 'function' ? fn : null;
  }

  /**
   * The game's current sim tick (0 without a game). The counter is NOT restored by a load,
   * so a section that keeps tick stamps saves them as `stamp - SaveRegistry.tick()` and
   * adds SaveRegistry.tick() back in load().
   */
  function tick() {
    try {
      const t = clock ? clock() : 0;
      return Number.isFinite(t) ? t : 0;
    } catch (_) {
      return 0;
    }
  }

  function alias(kind, oldId, newId) {
    if (!kind || !oldId || !newId || oldId === newId) return false;
    (aliases[kind] ||= {})[oldId] = newId;
    return true;
  }

  /** The current id for a possibly renamed one (follows chains, guards against loops). */
  function resolveId(kind, id) {
    const table = aliases[kind];
    if (!table || typeof id !== 'string') return id;
    let cur = id;
    for (let i = 0; i < 8 && Object.prototype.hasOwnProperty.call(table, cur); i++) {
      cur = table[cur];
    }
    return cur;
  }

  function hasAliases(kind) {
    return !!aliases[kind] && Object.keys(aliases[kind]).length > 0;
  }

  return {
    register,
    unregister,
    has,
    names,
    pack,
    unpack,
    saveAll,
    loadAll,
    setClock,
    tick,
    alias,
    resolveId,
    hasAliases,
  };
})();

const SaveFormat = (() => {
  const VERSION = 3;
  const TEXT_PREFIX = 'MBSAVE1.';
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  const MSG = {
    empty: 'There is no save data here.',
    notObject: 'This is not a Myth and Blood save.',
    newer:
      'This save was made by a newer version of the game. Update the game to load it; nothing was changed.',
    version: 'This save has an unknown format and cannot be loaded.',
    checksum: 'This save is damaged (its checksum does not match) and was not loaded.',
    noChecksum: 'This save is damaged (its checksum is missing) and was not loaded.',
    text: 'This code is not complete or has been altered. Copy the whole code and try again.',
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  /**
   * Checksum over the save without its own `checksum` field (and without the thumbnail,
   * which the save screen may add or drop). JSON text is stable across a parse/stringify
   * round trip, so the same number comes out on the loading side.
   */
  function checksum(snap) {
    const copy = { ...snap };
    delete copy.checksum;
    delete copy.thumbnail;
    const body = JSON.stringify(copy);
    return `${hash(body)}-${body.length.toString(36)}`;
  }

  function seal(snap) {
    snap.checksum = checksum(snap);
    return snap;
  }

  function isSupportedVersion(v) {
    return Number.isInteger(v) && v >= 1 && v <= VERSION;
  }

  const fin = (n) => typeof n === 'number' && Number.isFinite(n);

  /** Shape check on a current-version save. Returns the first problem in plain words. */
  function validate(snap) {
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return MSG.notObject;
    if (!Number.isInteger(snap.wave) || snap.wave < 0)
      return 'This save is damaged (no wave number).';
    if (!fin(snap.tactical)) return 'This save is damaged (no tactical points).';
    if (snap.timeOfDay !== 'day' && snap.timeOfDay !== 'night') {
      return 'This save is damaged (no time of day).';
    }
    if (!Array.isArray(snap.units)) return 'This save is damaged (no soldier list).';
    if (!Array.isArray(snap.buildings)) return 'This save is damaged (no building list).';
    for (let i = 0; i < snap.units.length; i++) {
      const u = snap.units[i];
      if (!u || typeof u !== 'object' || typeof u.type !== 'string' || !fin(u.x) || !fin(u.y)) {
        return `This save is damaged (soldier ${i + 1} is unreadable).`;
      }
      if (!fin(u.hp) || (u.team !== 'player' && u.team !== 'enemy' && u.team != null)) {
        return `This save is damaged (soldier ${i + 1} is unreadable).`;
      }
    }
    for (let i = 0; i < snap.buildings.length; i++) {
      const b = snap.buildings[i];
      if (!b || typeof b !== 'object' || typeof b.type !== 'string' || !fin(b.x) || !fin(b.y)) {
        return `This save is damaged (building ${i + 1} is unreadable).`;
      }
    }
    for (const key of ['spawnQueue', 'projectiles', 'fallenPool', 'pendingReinforce']) {
      if (snap[key] != null && !Array.isArray(snap[key])) {
        return `This save is damaged (${key} is unreadable).`;
      }
    }
    if (snap.modules != null && (typeof snap.modules !== 'object' || Array.isArray(snap.modules))) {
      return 'This save is damaged (module data is unreadable).';
    }
    if (snap.terrain != null) {
      const t = snap.terrain;
      if (typeof t !== 'object' || !Array.isArray(t.decorations)) {
        return 'This save is damaged (terrain is unreadable).';
      }
      for (const d of t.decorations) {
        if (!d || typeof d !== 'object' || typeof d.type !== 'string' || !fin(d.x) || !fin(d.y)) {
          return 'This save is damaged (terrain is unreadable).';
        }
      }
    }
    return null;
  }

  function applyAliases(snap) {
    const R = SaveRegistry;
    if (R.hasAliases('unit')) {
      for (const u of snap.units || []) if (u) u.type = R.resolveId('unit', u.type);
      for (const b of snap.buildings || []) {
        if (b && b.academyUnit) b.academyUnit = R.resolveId('unit', b.academyUnit);
      }
      if (Array.isArray(snap.spawnQueue)) {
        snap.spawnQueue = snap.spawnQueue.map((q) =>
          typeof q === 'string'
            ? R.resolveId('unit', q)
            : q && typeof q === 'object' && typeof q.type === 'string'
              ? { ...q, type: R.resolveId('unit', q.type) }
              : q
        );
      }
      for (const f of snap.fallenPool || []) if (f && f.type) f.type = R.resolveId('unit', f.type);
    }
    if (R.hasAliases('building')) {
      for (const b of snap.buildings || []) if (b) b.type = R.resolveId('building', b.type);
    }
    if (R.hasAliases('faction')) {
      for (const b of snap.buildings || []) {
        if (!b) continue;
        if (b.crossoverFaction) b.crossoverFaction = R.resolveId('faction', b.crossoverFaction);
        if (b.enemyFaction) b.enemyFaction = R.resolveId('faction', b.enemyFaction);
      }
      for (const u of snap.units || []) {
        if (u && u.enemyFaction) u.enemyFaction = R.resolveId('faction', u.enemyFaction);
      }
    }
  }

  /** One function per step: MIGRATIONS[n] turns a version n save into version n + 1. */
  const MIGRATIONS = {
    1(s) {
      if (!('nextWavePlan' in s)) s.nextWavePlan = null;
      s.cheatsUsed = !!s.cheatsUsed;
      return s;
    },
    2(s) {
      // Module state moves from loose top-level keys into `modules`.
      const modules = s.modules && typeof s.modules === 'object' ? s.modules : {};
      const move = (key, name) => {
        if (s[key] != null && !modules[name]) modules[name] = { v: 1, data: s[key] };
        delete s[key];
      };
      move('siegeLoop', 'SiegeLoop');
      move('economyRules', 'EconomyRules');
      move('research', 'Research');
      move('progressionRestarts', 'ProgressionRestarts');
      s.modules = modules;
      // Before per-soldier Hold there was one switch; off meant every soldier held.
      if (s.globalHunt === false && Array.isArray(s.units)) {
        for (const u of s.units) if (u && (u.team || 'player') === 'player') u.holding = true;
      }
      s.globalHunt = true;
      if (!Number.isInteger(s.courierMessagesUsedThisWave)) {
        s.courierMessagesUsedThisWave = s.courierUsedThisWave ? 1 : 0;
      }
      if (!Number.isFinite(s.runPlayerDeaths)) s.runPlayerDeaths = s.misses || 0;
      // Older saves did not hold the field: terrain null means "roll it again on load".
      if (!('terrain' in s)) s.terrain = null;
      if (!('rng' in s)) s.rng = null;
      s.legacy = true;
      return s;
    },
  };

  /** Run the chain on a copy. Returns { ok, snap } or { ok: false, error }. */
  function migrate(raw) {
    let s;
    try {
      s = JSON.parse(JSON.stringify(raw));
    } catch (_) {
      return { ok: false, error: MSG.notObject };
    }
    let v = s.version;
    try {
      while (v < VERSION) {
        const step = MIGRATIONS[v];
        if (typeof step !== 'function') return { ok: false, error: MSG.version };
        s = step(s) || s;
        v += 1;
        s.version = v;
      }
      applyAliases(s);
    } catch (e) {
      return { ok: false, error: `This save could not be brought up to date (${e.message}).` };
    }
    return { ok: true, snap: s };
  }

  /**
   * Everything that must be true before a save is allowed near the running game:
   * known version, checksum, migration, shape. Never changes `raw`.
   */
  function prepare(raw) {
    if (raw == null) return { ok: false, error: MSG.empty };
    if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: MSG.notObject };
    const v = raw.version;
    if (Number.isInteger(v) && v > VERSION) return { ok: false, error: MSG.newer, newer: true };
    if (!isSupportedVersion(v)) return { ok: false, error: MSG.version };
    if (raw.checksum != null) {
      if (raw.checksum !== checksum(raw)) return { ok: false, error: MSG.checksum };
    } else if (v >= 3) {
      return { ok: false, error: MSG.noChecksum };
    }
    const m = migrate(raw);
    if (!m.ok) return m;
    const problem = validate(m.snap);
    if (problem) return { ok: false, error: problem };
    return { ok: true, snap: m.snap, fromVersion: v };
  }

  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        out.push(
          0xf0 | (c >> 18),
          0x80 | ((c >> 12) & 63),
          0x80 | ((c >> 6) & 63),
          0x80 | (c & 63)
        );
      }
    }
    return out;
  }

  function utf8String(bytes) {
    const parts = [];
    let chunk = [];
    for (let i = 0; i < bytes.length;) {
      const b = bytes[i++];
      let c;
      if (b < 0x80) c = b;
      else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
      else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else {
        c =
          ((b & 7) << 18) |
          ((bytes[i++] & 63) << 12) |
          ((bytes[i++] & 63) << 6) |
          (bytes[i++] & 63);
      }
      if (c >= 0x10000) {
        c -= 0x10000;
        chunk.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
      } else chunk.push(c);
      if (chunk.length >= 8192) {
        parts.push(String.fromCharCode.apply(null, chunk));
        chunk = [];
      }
    }
    if (chunk.length) parts.push(String.fromCharCode.apply(null, chunk));
    return parts.join('');
  }

  /** Any JSON value to URL-safe base64 text (no padding). */
  function toText(obj) {
    const bytes = utf8Bytes(JSON.stringify(obj));
    const out = [];
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out.push(B64[a >> 2], B64[((a & 3) << 4) | (b >> 4)]);
      if (i + 1 < bytes.length) out.push(B64[((b & 15) << 2) | (c >> 6)]);
      if (i + 2 < bytes.length) out.push(B64[c & 63]);
    }
    return out.join('');
  }

  /** Inverse of toText(); also reads standard base64 (+ / =). Null when unreadable. */
  function fromText(text) {
    try {
      const s = String(text || '')
        .replace(/\s+/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      if (!s || /[^A-Za-z0-9_-]/.test(s) || s.length % 4 === 1) return null;
      const bytes = [];
      for (let i = 0; i < s.length; i += 4) {
        const a = B64.indexOf(s[i]);
        const b = B64.indexOf(s[i + 1]);
        const c = i + 2 < s.length ? B64.indexOf(s[i + 2]) : -1;
        const d = i + 3 < s.length ? B64.indexOf(s[i + 3]) : -1;
        bytes.push((a << 2) | (b >> 4));
        if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
        if (d >= 0) bytes.push(((c & 3) << 6) | d);
      }
      return JSON.parse(utf8String(bytes));
    } catch (_) {
      return null;
    }
  }

  /** A save as one line of text. */
  function encode(snap) {
    if (!snap || typeof snap !== 'object') return '';
    return TEXT_PREFIX + toText(snap);
  }

  /** Text back to a checked, migrated save: { ok, snap } or { ok: false, error }. */
  function decode(text) {
    const raw = String(text || '').trim();
    if (!raw) return { ok: false, error: MSG.empty };
    if (!raw.startsWith(TEXT_PREFIX)) return { ok: false, error: MSG.notObject };
    const obj = fromText(raw.slice(TEXT_PREFIX.length));
    if (!obj) return { ok: false, error: MSG.text };
    return prepare(obj);
  }

  return {
    VERSION,
    TEXT_PREFIX,
    MSG,
    hash,
    checksum,
    seal,
    isSupportedVersion,
    validate,
    migrate,
    prepare,
    toText,
    fromText,
    encode,
    decode,
  };
})();

// Published for scripts and modules that look these up on globalThis.
globalThis.SaveRegistry = SaveRegistry;
globalThis.SaveFormat = SaveFormat;
