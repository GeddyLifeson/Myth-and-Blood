/**
 * Recorded music and cues: every mapped file exists, each scene picks its loop (falling back
 * to the siege loop when its own has not loaded), faction themes play once per change of
 * lead, and sound never draws on Math.random.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { ok, failures } from './lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'js', 'audio.js'), 'utf8');

const files = [
  ...code.match(/const SAMPLE_FILES = \{([\s\S]*?)\};/)[1].matchAll(/'([a-z_]+)'/g),
].map((m) => m[1]);
ok(files.length >= 38, `SAMPLE_FILES maps ${files.length} recordings`);
const absent = files.filter((f) => !existsSync(join(root, 'assets', 'sfx', `${f}.ogg`)));
ok(absent.length === 0, `every mapped recording is in assets/sfx (missing: ${absent.join(', ')})`);

function param() {
  return {
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  };
}
const node = () => ({
  gain: param(),
  frequency: param(),
  connect() {},
  start() {},
  stop() {},
});
const started = [];
class FakeContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.destination = {};
  }
  createGain() {
    return node();
  }
  createOscillator() {
    return node();
  }
  createBiquadFilter() {
    return node();
  }
  createBuffer(_c, len) {
    return { getChannelData: () => new Float32Array(len) };
  }
  createBufferSource() {
    const n = node();
    n.start = () => started.push(n.buffer?.name);
    return n;
  }
  decodeAudioData(data) {
    return Promise.resolve({ name: data.name, duration: 4 });
  }
  resume() {
    return Promise.resolve();
  }
}

let missing = new Set();
const sb = {
  console,
  Date,
  Promise,
  Object,
  Set,
  Math: Object.create(Math, {
    random: {
      value: () => {
        throw new Error('sound drew on Math.random');
      },
    },
  }),
  setTimeout: () => 0,
  clearTimeout() {},
  performance: { now: () => 0 },
  location: { protocol: 'http:' },
  document: { addEventListener() {} },
  fetch: (url) => {
    const file = url.split('/').pop().replace('.ogg', '');
    return missing.has(file)
      ? Promise.resolve({ ok: false, status: 404 })
      : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ name: file }) });
  },
  GameFeedback: { breachPressure: () => 0 },
};
sb.window = { AudioContext: FakeContext };
const flush = () => new Promise((r) => setImmediate(r));

async function engine(absentFiles = []) {
  missing = new Set(absentFiles);
  const box = vm.createContext({ ...sb });
  box.globalThis = box;
  vm.runInContext(code, box);
  const eng = box.AudioEngine;
  eng.init();
  eng.startMusic();
  for (let i = 0; i < 4; i++) await flush();
  return eng;
}

const base = { intensity: 0.3, era: 'early', phase: 'day', boss: false, horde: false };
const scene = (eng, state) => {
  eng.updateMix({ ...base, ...state });
  return eng.getRecordedMusic();
};

let eng = await engine();
ok(scene(eng, {}) === 'musicSiege', 'early day plays the siege loop');
ok(scene(eng, { era: 'mid' }) === 'musicSiegeMid', 'waves 15-39 play the mid loop');
ok(scene(eng, { era: 'rts' }) === 'musicSiegeLate', 'late eras play the late loop');
ok(scene(eng, { phase: 'night', era: 'rts' }) === 'musicNight', 'night plays the night loop');
ok(scene(eng, { horde: true }) === 'musicHorde', 'a horde plays the horde loop');
ok(scene(eng, { boss: true, horde: true }) === 'musicBoss', 'a boss outranks a horde');
sb.GameFeedback.breachPressure = () => 0.8;
ok(
  scene(eng, { horde: true }) === 'musicLastStand',
  'three quarters of the breaches play the last stand'
);
ok(scene(eng, { boss: true }) === 'musicBoss', 'a boss outranks the last stand');
sb.GameFeedback.breachPressure = () => 0;

started.length = 0;
ok(eng.factionArrival('orc_warbands') === true, 'a new lead faction plays its theme');
ok(started.includes('faction_orc'), 'the orc theme is the recording that started');
ok(eng.factionArrival('orc_warbands') === false, 'the same lead again stays quiet');
ok(eng.factionArrival('goblin_hordes') === true, 'a change of lead plays again');
ok(eng.factionArrival('no_such_faction') === false, 'an unknown faction plays nothing');

started.length = 0;
eng.play('mineBlast');
eng.play('satchelBlast');
eng.play('fuseHiss');
eng.play('dawnHorn');
eng.play('lastBreach');
ok(
  ['mine_blast', 'satchel_blast', 'fuse_hiss', 'dawn_horn', 'last_breach'].every((f) =>
    started.includes(f)
  ),
  `sapper and banner cues play their recordings (${started.join(', ')})`
);

eng = await engine(['music_siege_mid', 'music_night']);
ok(scene(eng, { era: 'mid' }) === 'musicSiege', 'a missing mid loop falls back to the siege loop');
ok(scene(eng, { phase: 'night' }) === 'musicSiege', 'a missing night loop falls back too');

process.exit(failures() ? 1 : 0);
