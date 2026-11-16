/**
 * The sound mix: every cue the game asks for has a sound, the events that used to share
 * deploy/reinforce/magicCast/waveStart have their own, melee and death sounds follow weapon and
 * family, one-shots pan by field x, long stingers take turns, and rain and thunder follow weather.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { ok, failures } from './lib/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'js', 'audio.js'), 'utf8');

const targets = [];
const param = () => ({
  value: 1,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  setTargetAtTime(v) {
    targets.push(v);
  },
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
});
const node = () => ({
  gain: param(),
  frequency: param(),
  Q: param(),
  pan: param(),
  detune: param(),
  connect() {},
  disconnect() {},
  start() {},
  stop() {},
});
const started = [];
const panners = [];
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
  createStereoPanner() {
    const n = node();
    panners.push(n);
    return n;
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

let timers = [];
let clock = 0;
const box = vm.createContext({
  console,
  Date: { now: () => clock },
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
  setTimeout: (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  },
  clearTimeout() {},
  performance: { now: () => clock },
  location: { protocol: 'http:' },
  document: { addEventListener() {} },
  fetch: (url) =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve({ name: url.split('/').pop().replace('.ogg', '') }),
    }),
  window: { AudioContext: FakeContext },
  SpriteGen: {
    weaponOf: (t) =>
      ({ footman: 'sword', orc: 'axe', troll: 'club', pikeman: 'pike', harpy: 'none' })[t],
    familyOf: (t) =>
      ({ goblin: 'goblin', orc: 'orc', harpy: 'flyer', wailing_wraith: 'wraith' })[t] || 'human',
  },
  GS: { worldW: 1000, cameraWorldX: 500, canvas: { width: 1000 }, baseViewScale: 1, cameraZoom: 1 },
});
box.globalThis = box;
vm.runInContext(code, box);
const eng = box.AudioEngine;
eng.init();
eng.play('click'); // starts loading the recordings
for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));

// Every cue name the game passes in has a sound behind it.
const asked = new Set();
for (const f of readdirSync(join(root, 'js')).filter((x) => x.endsWith('.js'))) {
  const t = readFileSync(join(root, 'js', f), 'utf8');
  for (const m of t.matchAll(/(?:playSfx(?:At)?|AudioEngine\.play(?:At)?)\(\s*'([a-zA-Z]+)'/g)) {
    asked.add(m[1]);
  }
}
const silent = [...asked].filter(
  (n) =>
    typeof eng.SFX[n] !== 'function' &&
    !['ribbonEarned', 'veteranFallen'].includes(n) &&
    !/^faction[A-Z]/.test(n)
);
ok(asked.size > 60, `the game asks for ${asked.size} cues`);
ok(silent.length === 0, `every cue has a synthesized sound (silent: ${silent.join(', ')})`);

// The old shared names now cover few events; each split event has a sound of its own.
const split = [
  'courierSent',
  'expeditionSent',
  'raidSent',
  'academyTrained',
  'relocate',
  'recruitHero',
  'promotion',
  'promotionReady',
  'honorName',
  'eraChange',
  'landGained',
  'doctrine',
  'rallyHorn',
  'generalOrder',
  'spyAction',
  'dispel',
  'boltShot',
  'frost',
  'enemyEra',
  'enemyBuilt',
  'siegeDock',
];
const bodies = new Set(split.map((n) => String(eng.SFX[n])));
ok(bodies.size === split.length, `${split.length} split events each have a different sound`);
const shared = ['deploy', 'reinforce', 'magicCast', 'waveStart'].map((n) => {
  let c = 0;
  for (const f of readdirSync(join(root, 'js')).filter((x) => x.endsWith('.js'))) {
    const t = readFileSync(join(root, 'js', f), 'utf8');
    c += [...t.matchAll(new RegExp(`(?:playSfx|AudioEngine\\.play)\\(\\s*'${n}'`, 'g'))].length;
  }
  return c;
});
ok(
  shared.reduce((a, b) => a + b, 0) <= 8,
  `deploy/reinforce/magicCast/waveStart now cover ${shared.join('+')} calls`
);

ok(eng.weaponClass({ type: 'footman' }) === 'blade', 'a footman swings a blade');
ok(eng.weaponClass({ type: 'orc' }) === 'axe', 'an orc swings an axe');
ok(eng.weaponClass({ type: 'troll' }) === 'blunt', 'a troll swings a club');
ok(eng.weaponClass({ type: 'pikeman' }) === 'pike', 'a pikeman thrusts a pike');
ok(eng.weaponClass({ type: 'harpy', team: 'enemy' }) === 'claw', 'a harpy claws');
ok(eng.voiceFamily({ type: 'goblin', team: 'enemy' }) === 'goblin', 'goblins die as goblins');
ok(
  eng.voiceFamily({ type: 'wailing_wraith', team: 'enemy' }) === 'undead',
  'wraiths die as the dead'
);
ok(eng.voiceFamily({ type: 'harpy', team: 'enemy' }) === 'beast', 'flyers die as beasts');
ok(
  eng.voiceFamily({ type: 'footman', team: 'enemy', isNamedBoss: true }) === 'giant',
  'a warlord dies as a giant'
);
ok(eng.voiceFamily({ type: 'footman', team: 'player' }) === 'human', 'soldiers die as men');

ok(Math.abs(eng.panFor(1000) - 0.7) < 1e-9, 'the right edge of the view pans right');
ok(Math.abs(eng.panFor(0) + 0.7) < 1e-9, 'the left edge pans left');
ok(eng.panFor(500) === 0, 'the middle stays centred');
panners.length = 0;
clock += 1000;
eng.playAt('meleeSwing', 900, { type: 'footman' });
ok(
  panners.length === 1 && Math.abs(panners[0].pan.value - 0.56) < 1e-9,
  'a swing at x=900 goes through a panner at 0.56'
);
eng.playAt('impact', 510, 'light');
ok(panners.length === 1, 'a hit near the middle needs no panner');

// Stingers: a ducked cue waits for an equal one and plays over a lower one.
started.length = 0;
timers = [];
eng.play('enrage');
eng.play('bossRoar');
ok(started.join() === 'enrage,boss_roar', 'a boss roar plays over an enrage');
eng.play('breachHorn');
ok(!started.includes('breach_horn'), 'a breach horn waits for the boss roar');
eng.play('defeat');
ok(started.includes('defeat'), 'defeat plays at once');
timers.forEach((t) => t.fn());
ok(!started.includes('breach_horn'), 'the horn still waits while defeat plays');
box.AudioEngine; // keep ctx in scope
const ctx = eng.init();
ctx.currentTime = 10;
clock += 1000;
timers.splice(0).forEach((t) => t.fn());
ok(started.includes('breach_horn'), 'the queued horn plays when the way is clear');
started.length = 0;
eng.play('breachHorn');
eng.play('lastBreach');
eng.play('bossRoar');
clock += 5000;
ctx.currentTime = 20;
timers.splice(0).forEach((t) => t.fn());
ok(!started.includes('boss_roar'), 'a stinger that waited over 4 s is dropped');

// Recorded cues for the new events.
started.length = 0;
ctx.currentTime = 40;
for (const n of ['bossDeath', 'buildingCollapse', 'promotion', 'recruitHero']) {
  ctx.currentTime += 5;
  eng.play(n);
}
ok(
  ['boss_death', 'building_collapse', 'promotion', 'hero_recruit'].every((f) =>
    started.includes(f)
  ),
  `new events play their recordings (${started.join(', ')})`
);

// Weather.
targets.length = 0;
eng.setAmbience('day');
eng.setWeather({ type: 'storm' });
ok(targets.includes(0.085), 'a storm brings up the rain bed');
eng.setWeather({ type: 'clear' });
ok(targets[targets.length - 1] === 0, 'clear skies stop the rain');
started.length = 0;
timers = [];
ctx.currentTime = 100;
eng.thunderAt(200);
timers.forEach((t) => t.fn());
ok(started.includes('thunder'), 'lightning is followed by thunder');
ok(timers[0].ms >= 250, 'thunder comes a beat after the flash');

process.exit(failures() ? 1 : 0);
