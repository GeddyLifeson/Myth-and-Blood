/**
 * Procedural sound synthesis for Myth and Blood.
 * All audio generated via Web Audio API — no external sound files.
 */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicPlaying = false;
  let musicContext = 'none';
  let musicTimer = null;
  let unlockPromise = null;
  let unlocked = false;
  let muted = false;
  let masterVol = 0.75;
  let musicVol = 0.28;
  let sfxVol = 0.55;

  function init() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = masterVol;
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = musicVol;
      musicGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = sfxVol;
      sfxGain.connect(masterGain);
    } catch (e) {
      console.warn('AudioEngine: Web Audio unavailable', e);
      ctx = null;
    }
    return ctx;
  }

  function resume() {
    init();
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'running') {
      unlocked = true;
      return Promise.resolve(true);
    }
    if (!unlockPromise) {
      unlockPromise = ctx
        .resume()
        .then(() => {
          unlocked = true;
          unlockPromise = null;
          return true;
        })
        .catch((err) => {
          console.warn('AudioEngine: resume failed', err);
          unlockPromise = null;
          return false;
        });
    }
    return unlockPromise;
  }

  function whenReady(fn) {
    if (!ctx || muted) return;
    if (ctx.state === 'running') {
      fn();
      return;
    }
    resume().then((ok) => {
      if (ok && !muted) fn();
    });
  }

  function bindUnlock() {
    init();
    // A resume() requested before the first click or key press can stay pending for good in
    // Chromium browsers, so every gesture asks the context directly instead of reusing that call.
    const unlock = () => {
      if (!ctx || ctx.state === 'running') return;
      unlockPromise = null;
      ctx
        .resume()
        .then(() => {
          unlocked = true;
          loadSamples();
          if (musicPlaying && !muted) {
            syncRecordedMusic();
            if (!musicTimer) tickMusic();
          }
        })
        .catch(() => {
          /* the next gesture tries again */
        });
    };
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchend', 'keydown']) {
      document.addEventListener(type, unlock, { passive: true, capture: true });
    }
  }

  /** Run a delayed SFX callback only if still unmuted and context is live. */
  function later(ms, fn) {
    setTimeout(() => {
      if (muted || !ctx) return;
      whenReady(fn);
    }, ms);
  }

  /**
   * Safe SFX dispatch — never throws if a cue is missing or audio is locked.
   * @param {string} name
   * @param {...any} args
   */
  // ------------------------------------------------------------ recorded cues
  // Orchestral cues recorded in MuseScore Studio with Muse Sounds (see tools/sfx).
  // Each one replaces the synthesized sound of the same name once it has loaded;
  // until then, or if a file cannot be fetched, the synthesized version plays.
  const SAMPLE_FILES = {
    breachHorn: 'breach_horn',
    musterDrums: 'muster_drums',
    bossRoar: 'boss_roar',
    warCry: 'war_cry',
    holdLine: 'hold_line',
    spoilsClaim: 'spoils_claim',
    waveClear: 'wave_clear',
    defeat: 'defeat',
    wraithWail: 'wraith_wail',
    enrage: 'enrage',
    crateOpen: 'crate_open',
    nightDrone: 'night_drone',
    victory: 'victory_fanfare',
    ribbonEarned: 'ribbon_earned',
    veteranFallen: 'veteran_fallen',
    nightFall: 'nightfall',
    runnerShriek: 'runner_alarm',
    hordeWarn: 'horde_warning',
    musicMenu: 'music_menu',
    musicSiege: 'music_siege',
    musicBoss: 'music_boss',
  };
  /** Recorded cues with no synthesized sound of their own borrow one until they load. */
  const SAMPLE_FALLBACK = { ribbonEarned: 'honorChime', veteranFallen: 'moraleBreak' };
  const SAMPLE_GAIN = { wraithWail: 0.5, crateOpen: 0.7, spoilsClaim: 0.8, nightDrone: 0.35 };
  // A cue that can fire many times in a row plays recorded once, then synthesized until this many ms pass.
  const SAMPLE_COOLDOWN = { runnerShriek: 7000, hordeWarn: 9000, veteranFallen: 5000 };
  const sampleLastPlayed = {};
  const samples = {};
  let samplesRequested = false;

  /** fetch() refuses file:// pages (the desktop build, or index.html opened directly); XHR does not. */
  function fetchBytes(url) {
    const viaXhr = () =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () =>
          xhr.response && xhr.response.byteLength
            ? resolve(xhr.response)
            : reject(new Error('empty'));
        xhr.onerror = () => reject(new Error('xhr'));
        xhr.send();
      });
    if (typeof location !== 'undefined' && location.protocol === 'file:') return viaXhr();
    return fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .catch(viaXhr);
  }

  function loadSamples() {
    if (samplesRequested || !ctx || typeof fetch !== 'function') return;
    samplesRequested = true;
    for (const [name, file] of Object.entries(SAMPLE_FILES)) {
      fetchBytes(`assets/sfx/${file}.ogg`)
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          samples[name] = buffer;
          if (name.startsWith('music')) syncRecordedMusic();
        })
        .catch(() => {
          /* keep the synthesized fallback */
        });
    }
  }

  /** Plays a recorded cue if it has loaded. Returns the source node, or null. */
  function playSample(name, { loop = false, dest = null } = {}) {
    const buffer = samples[name];
    if (!buffer || !ctx || muted || ctx.state !== 'running') return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    const gain = ctx.createGain();
    gain.gain.value = SAMPLE_GAIN[name] ?? 1;
    source.connect(gain);
    gain.connect(dest || sfxGain);
    source.start();
    return source;
  }

  function play(name, ...args) {
    try {
      loadSamples();
      if (SAMPLE_FILES[name] && !name.startsWith('music')) {
        const wait = SAMPLE_COOLDOWN[name] || 0;
        const now = Date.now();
        if (!wait || now - (sampleLastPlayed[name] || 0) >= wait) {
          if (playSample(name)) {
            sampleLastPlayed[name] = now;
            return;
          }
        }
      }
      const fn = SFX[name] || SFX[SAMPLE_FALLBACK[name]];
      if (typeof fn === 'function') fn(...args);
    } catch (e) {
      console.warn('AudioEngine.play failed', name, e);
    }
  }

  // ----------------------------------------------------------- recorded music
  // Three looping pieces (menu, siege, boss). Once a piece has loaded it takes over from the
  // synthesized sequencer for its scene; the two cross-fade when the scene changes.
  let recorded = null; // { name, source, gain }

  function wantedMusic() {
    if (!musicPlaying || muted) return null;
    if (musicContext === 'menu') return 'musicMenu';
    return mixState.boss && samples.musicBoss ? 'musicBoss' : 'musicSiege';
  }

  function fadeOutRecorded(seconds = 1.2) {
    if (!recorded || !ctx) return;
    const old = recorded;
    recorded = null;
    try {
      const t = ctx.currentTime;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + seconds);
      old.source.stop(t + seconds + 0.05);
    } catch (e) {
      /* already stopped */
    }
  }

  /** Starts, swaps or stops the recorded loop to match the current scene. */
  function syncRecordedMusic() {
    if (!ctx) return;
    const want = wantedMusic();
    if (!want || !samples[want]) {
      if (recorded && recorded.name !== want) fadeOutRecorded();
      return;
    }
    if (recorded && recorded.name === want) return;
    if (ctx.state !== 'running') return;
    fadeOutRecorded(1.6);
    const source = ctx.createBufferSource();
    source.buffer = samples[want];
    source.loop = true;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(RECORDED_MUSIC_GAIN, t + 1.6);
    source.connect(gain);
    gain.connect(musicGain);
    source.start();
    recorded = { name: want, source, gain };
  }
  const RECORDED_MUSIC_GAIN = 1.6;

  function setMasterVolume(value) {
    masterVol = Math.max(0, Math.min(1, Number(value) || 0));
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(muted ? 0 : masterVol, ctx.currentTime);
    }
  }

  function setMusicVolume(value) {
    musicVol = Math.max(0, Math.min(1, Number(value) || 0));
    if (musicGain && ctx) musicGain.gain.setValueAtTime(musicVol, ctx.currentTime);
  }

  function setSfxVolume(value) {
    sfxVol = Math.max(0, Math.min(1, Number(value) || 0));
    if (sfxGain && ctx) sfxGain.gain.setValueAtTime(sfxVol, ctx.currentTime);
  }

  function setMuted(value) {
    muted = !!value;
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(muted ? 0 : masterVol, ctx.currentTime);
    }
    if (muted) {
      stopMusic();
      stopAmbience();
    } else {
      // Allow music to be re-started by UI after unmute (do not auto-resume wrong theme).
      musicPlaying = false;
      musicContext = 'none';
    }
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }
  function isUnlocked() {
    return unlocked && ctx?.state === 'running';
  }

  function playTone(freq, duration, type = 'square', volume = 0.3, detune = 0) {
    whenReady(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    });
  }

  function playNoise(duration, volume = 0.2, filterFreq = 1000) {
    whenReady(() => {
      const t = ctx.currentTime;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      source.start(t);
      source.stop(t + duration + 0.05);
    });
  }

  function sweep(startFreq, endFreq, duration, type = 'sawtooth', volume = 0.2) {
    whenReady(() => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, startFreq), t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    });
  }

  // Throttle rapid-fire hits so armies don't turn into static
  let lastHitAt = 0;
  let lastCritAt = 0;
  let lastShriekAt = 0;
  let hitVariant = 0;

  function canPlayHit(minGapMs = 28) {
    const now = performance.now?.() || Date.now();
    if (now - lastHitAt < minGapMs) return false;
    lastHitAt = now;
    return true;
  }

  const SFX = {
    swordHit() {
      if (!canPlayHit(22)) return;
      hitVariant = (hitVariant + 1) % 3;
      const base = 170 + hitVariant * 28 + Math.random() * 20;
      playNoise(0.06 + Math.random() * 0.03, 0.32 + Math.random() * 0.1, 2800 + hitVariant * 400);
      playTone(base, 0.08, 'square', 0.24);
      playTone(base * 0.72, 0.12, 'sawtooth', 0.16);
    },
    /** Layered impact for real damage events — light / medium / heavy / crit. */
    impact(tier = 'medium') {
      const t = String(tier || 'medium');
      if (t === 'crit') {
        SFX.critHit();
        return;
      }
      if (t === 'kill') {
        SFX.killHit();
        return;
      }
      if (!canPlayHit(t === 'heavy' ? 32 : 20)) return;
      if (t === 'light') {
        playNoise(0.04, 0.18, 4200);
        playTone(260 + Math.random() * 40, 0.06, 'square', 0.14);
      } else if (t === 'heavy') {
        playNoise(0.1, 0.42, 1800);
        playTone(120, 0.12, 'square', 0.3);
        playTone(80, 0.18, 'sawtooth', 0.22);
        sweep(180, 60, 0.12, 'sawtooth', 0.12);
      } else {
        playNoise(0.07, 0.34, 2600);
        playTone(190 + Math.random() * 30, 0.09, 'square', 0.22);
        playTone(140, 0.12, 'sawtooth', 0.14);
      }
    },
    critHit() {
      const now = performance.now?.() || Date.now();
      if (now - lastCritAt < 80) return;
      lastCritAt = now;
      lastHitAt = now;
      playNoise(0.12, 0.48, 3500);
      playTone(320, 0.08, 'square', 0.32);
      playTone(180, 0.14, 'sawtooth', 0.28);
      sweep(600, 140, 0.16, 'square', 0.22);
      later(30, () => playTone(90, 0.12, 'sine', 0.18));
    },
    killHit() {
      if (!canPlayHit(40)) return;
      playNoise(0.14, 0.4, 1200);
      sweep(280, 70, 0.22, 'sawtooth', 0.28);
      playTone(110, 0.16, 'square', 0.26);
    },
    arrowShoot() {
      sweep(800, 200, 0.15, 'sine', 0.28);
      playNoise(0.05, 0.14, 5000);
    },
    magicCast() {
      sweep(400, 1200, 0.3, 'sine', 0.32);
      playTone(800, 0.2, 'triangle', 0.2);
      playTone(1200, 0.3, 'sine', 0.14);
    },
    fireball() {
      playNoise(0.4, 0.45, 800);
      sweep(200, 80, 0.5, 'sawtooth', 0.35);
      playTone(100, 0.5, 'square', 0.25);
    },
    lightning() {
      playNoise(0.3, 0.55, 8000);
      sweep(2000, 100, 0.2, 'square', 0.4);
      playTone(60, 0.4, 'sawtooth', 0.35);
    },
    heal() {
      sweep(600, 900, 0.4, 'sine', 0.28);
      playTone(900, 0.3, 'triangle', 0.2);
      playTone(1200, 0.5, 'sine', 0.14);
    },
    deploy() {
      playTone(440, 0.1, 'square', 0.28);
      playTone(660, 0.15, 'square', 0.22);
    },
    /** Death by size and cause: small, big, burn, blast, cleave. */
    deathVar(kind = 'small') {
      if (!canPlayHit(35)) return;
      if (kind === 'big') {
        sweep(220, 38, 0.8, 'sawtooth', 0.34);
        playNoise(0.5, 0.3, 320);
        playTone(52, 0.6, 'sine', 0.2);
      } else if (kind === 'burn') {
        playNoise(0.45, 0.22, 2600);
        sweep(520, 140, 0.4, 'triangle', 0.16);
      } else if (kind === 'blast') {
        playNoise(0.3, 0.34, 700);
        sweep(160, 40, 0.3, 'square', 0.26);
      } else if (kind === 'cleave') {
        playNoise(0.07, 0.3, 4200);
        sweep(300, 60, 0.28, 'sawtooth', 0.26);
        playNoise(0.2, 0.18, 380);
      } else {
        const base = 340 + Math.random() * 120;
        sweep(base, 70, 0.3, 'sawtooth', 0.24);
        playNoise(0.15, 0.2, 480);
      }
    },
    /** An enemy is through the line. A low two-note horn over a drum. */
    breachHorn() {
      sweep(116, 110, 0.55, 'sawtooth', 0.3);
      playTone(55, 0.9, 'sine', 0.3);
      later(420, () => {
        sweep(92, 82, 0.8, 'sawtooth', 0.32);
        playNoise(0.25, 0.3, 300);
      });
    },
    warCry() {
      playNoise(0.5, 0.26, 900);
      sweep(170, 330, 0.28, 'sawtooth', 0.26);
      later(140, () => sweep(210, 380, 0.34, 'sawtooth', 0.22));
      later(300, () => playNoise(0.3, 0.2, 1400));
    },
    holdLine() {
      for (let i = 0; i < 3; i++) {
        later(i * 150, () => {
          playTone(86, 0.14, 'square', 0.34);
          playNoise(0.08, 0.28, 500);
        });
      }
      later(470, () => playTone(1150, 0.07, 'triangle', 0.18));
    },
    crateOpen() {
      playNoise(0.07, 0.3, 3200);
      playTone(210, 0.07, 'square', 0.2);
      later(90, () => playTone(330, 0.12, 'triangle', 0.2));
    },
    ambush() {
      sweep(640, 190, 0.26, 'square', 0.24);
      playNoise(0.2, 0.26, 1800);
      later(160, () => sweep(520, 160, 0.22, 'square', 0.2));
    },
    spoilsClaim() {
      [392, 523, 659, 784].forEach((f, i) =>
        later(i * 70, () => playTone(f, 0.22, 'triangle', 0.2))
      );
    },
    bossRoar() {
      sweep(96, 42, 1.1, 'sawtooth', 0.36);
      playNoise(1.0, 0.3, 420);
      playTone(58, 1.0, 'sine', 0.24);
      later(260, () => sweep(140, 60, 0.7, 'square', 0.16));
    },
    enrage() {
      sweep(64, 210, 0.5, 'sawtooth', 0.32);
      playNoise(0.5, 0.28, 800);
      later(380, () => sweep(210, 90, 0.4, 'sawtooth', 0.26));
    },
    runnerShriek() {
      const now = performance.now?.() || Date.now();
      if (now - lastShriekAt < 900) return;
      lastShriekAt = now;
      sweep(880, 1500, 0.1, 'square', 0.1);
      later(90, () => sweep(1500, 700, 0.16, 'square', 0.09));
    },
    wraithWail() {
      sweep(520, 250, 1.3, 'sine', 0.13);
      sweep(534, 262, 1.3, 'sine', 0.1);
      playNoise(0.9, 0.06, 2400);
    },
    firebomb() {
      playNoise(0.3, 0.3, 1300);
      sweep(320, 70, 0.3, 'sawtooth', 0.24);
    },
    shieldBlock() {
      if (!canPlayHit(60)) return;
      playTone(1180, 0.05, 'triangle', 0.16);
      playNoise(0.03, 0.2, 5200);
    },
    arrowThunk() {
      if (!canPlayHit(40)) return;
      playNoise(0.03, 0.22, 2200);
      playTone(140, 0.06, 'square', 0.14);
    },
    hexCast() {
      sweep(820, 280, 0.24, 'sine', 0.14);
      sweep(410, 140, 0.24, 'triangle', 0.08);
    },
    /** War drums as a squad forms up on its side of the field. */
    musterDrums() {
      [0, 180, 360, 450].forEach((ms, i) =>
        later(ms, () => {
          playTone(i === 3 ? 74 : 62, 0.2, 'sine', 0.3);
          playNoise(0.06, 0.16, 260);
        })
      );
    },
    crowCaw() {
      sweep(760, 520, 0.12, 'sawtooth', 0.045);
      playNoise(0.1, 0.03, 2600);
      later(170, () => sweep(720, 480, 0.14, 'sawtooth', 0.04));
    },
    death() {
      if (!canPlayHit(35)) return;
      sweep(380, 70, 0.35, 'sawtooth', 0.28);
      playNoise(0.18, 0.22, 480);
      playTone(95, 0.2, 'sine', 0.12);
    },
    gateHit() {
      playTone(80, 0.3, 'square', 0.45);
      playNoise(0.2, 0.35, 400);
    },
    waveStart() {
      playTone(220, 0.2, 'square', 0.32);
      playTone(330, 0.2, 'square', 0.28);
      playTone(440, 0.3, 'square', 0.32);
      playTone(550, 0.4, 'square', 0.28);
      later(80, () => playNoise(0.12, 0.2, 200));
      later(100, () => playTone(110, 0.18, 'sine', 0.16));
    },
    waveClear() {
      [392, 494, 587, 784].forEach((n, i) => {
        later(i * 70, () => playTone(n, 0.22, 'triangle', 0.2));
      });
      later(40, () => playNoise(0.08, 0.1, 600));
    },
    perfectClear() {
      [523, 659, 784, 1047, 1319].forEach((n, i) => {
        later(i * 85, () => playTone(n, 0.28, i % 2 ? 'sine' : 'triangle', 0.22));
      });
      later(200, () => {
        playNoise(0.1, 0.12, 800);
        playTone(1047, 0.35, 'sine', 0.14);
      });
    },
    multiKill(streak = 3) {
      const s = Math.max(2, Math.min(20, streak | 0));
      const base = 330 + s * 18;
      playTone(base, 0.1, 'square', 0.22);
      later(50, () => playTone(base * 1.25, 0.14, 'triangle', 0.2));
      if (s >= 5) later(110, () => playTone(base * 1.5, 0.18, 'sine', 0.16));
      if (s >= 8) later(140, () => sweep(base * 1.2, base * 2, 0.2, 'sawtooth', 0.12));
    },
    nightFall() {
      sweep(280, 140, 0.45, 'sine', 0.12);
      playTone(165, 0.35, 'triangle', 0.1);
      later(60, () => playNoise(0.2, 0.06, 400));
    },
    uiHover() {
      playTone(720 + Math.random() * 40, 0.03, 'sine', 0.06);
    },
    uiConfirm() {
      playTone(520, 0.06, 'triangle', 0.12);
      later(40, () => playTone(680, 0.08, 'sine', 0.1));
    },
    buildPlace() {
      playNoise(0.1, 0.18, 900);
      playTone(180, 0.12, 'square', 0.16);
      later(40, () => playTone(240, 0.08, 'triangle', 0.1));
    },
    /** Structure finished construction. */
    buildComplete() {
      playTone(300, 0.08, 'square', 0.16);
      later(50, () => playTone(450, 0.12, 'triangle', 0.14));
      later(110, () => playTone(600, 0.14, 'sine', 0.12));
    },
    deployConfirm() {
      playTone(440, 0.07, 'square', 0.16);
      playTone(660, 0.1, 'triangle', 0.12);
    },
    victory(themeId) {
      let notes = [523, 659, 784, 1047];
      if (
        themeId &&
        typeof Cosmetics !== 'undefined' &&
        Cosmetics.VICTORY_THEMES?.[themeId]?.notes
      ) {
        notes = Cosmetics.VICTORY_THEMES[themeId].notes;
      }
      notes.forEach((n, i) => {
        later(i * 200, () => playTone(n, 0.4, 'square', 0.32));
      });
    },
    defeat() {
      const notes = [392, 349, 330, 262];
      notes.forEach((n, i) => {
        later(i * 300, () => playTone(n, 0.5, 'sawtooth', 0.28));
      });
    },
    click() {
      // Slight pitch variance so UI feels less mechanical
      playTone(760 + Math.random() * 80, 0.045, 'square', 0.18);
    },
    horseCharge() {
      playNoise(0.28, 0.22, 600);
      sweep(100, 220, 0.32, 'sawtooth', 0.24);
      later(40, () => playTone(90, 0.12, 'sine', 0.12));
    },
    /** Missed melee swing / air whoosh. */
    whoosh() {
      if (!canPlayHit(18)) return;
      sweep(420, 120, 0.1, 'sine', 0.12);
      playNoise(0.05, 0.08, 3200);
    },
    reinforce() {
      playTone(330, 0.15, 'square', 0.28);
      playTone(440, 0.15, 'square', 0.28);
      playTone(550, 0.2, 'square', 0.32);
      playTone(660, 0.3, 'square', 0.28);
    },
    moraleBreak() {
      sweep(300, 100, 0.5, 'sawtooth', 0.25);
    },
    unlockChime() {
      playTone(523, 0.12, 'triangle', 0.2);
      later(80, () => playTone(659, 0.18, 'triangle', 0.18));
    },
    factionPulse(faction) {
      const palettes = {
        wwe: [330, 440, 550],
        doom: [80, 120, 90],
        ultimis: [220, 330, 180],
        primis: [280, 420, 200],
        halo: [180, 360, 520],
        gears: [200, 280, 340],
        lotr: [260, 390, 520],
        baki: [300, 200, 150],
        jojo: [440, 660, 880],
        fotns: [400, 600, 300],
        dragonball: [350, 520, 780],
        imperium: [160, 240, 320],
        crystal: [440, 554, 659],
        warp: [90, 140, 220],
        tes: [180, 270, 360],
      };
      const notes = palettes[faction] || [440, 550, 660];
      notes.forEach((n, i) => later(i * 55, () => playTone(n, 0.1 + i * 0.02, 'triangle', 0.22)));
    },
    factionFinisher() {
      sweep(600, 200, 0.25, 'sawtooth', 0.35);
      playTone(120, 0.2, 'square', 0.28);
    },
    vetUpgrade() {
      playTone(523, 0.12, 'triangle', 0.22);
      later(60, () => playTone(659, 0.14, 'triangle', 0.2));
      later(120, () => playTone(784, 0.18, 'sine', 0.18));
    },
    honorChime() {
      [523, 659, 784, 988].forEach((n, i) => later(i * 90, () => playTone(n, 0.22, 'sine', 0.16)));
    },
    bossWarn() {
      playTone(110, 0.35, 'sawtooth', 0.3);
      later(180, () => playTone(87, 0.4, 'square', 0.25));
    },
    siegeRumble() {
      playNoise(0.25, 0.18, 200);
      playTone(55, 0.3, 'sawtooth', 0.2);
    },
    hordeWarn(intensity = 0.5) {
      const i = Math.max(0.28, Math.min(1, intensity));
      const vol = 0.2 + i * 0.2;
      playTone(147, 0.14, 'square', vol);
      later(90, () => playTone(110, 0.22, 'sawtooth', vol * 0.92));
      later(210, () => {
        playNoise(0.22, vol * 0.75, 240);
        playTone(82, 0.28, 'square', vol * 0.82);
      });
      if (i >= 0.55) later(360, () => playTone(98, 0.2, 'sawtooth', vol * 0.65));
      if (i >= 0.75) later(520, () => playTone(73, 0.32, 'sawtooth', vol * 0.55));
    },
    hordeStomp(intensity = 0.5) {
      if (!ctx || muted) return;
      const i = Math.max(0.28, Math.min(1, intensity));
      const vol = 0.05 + i * 0.07;
      playNoise(0.07, vol, 190);
      playTone(68 + i * 24, 0.09, 'sine', vol * 1.1);
    },
  };

  const MENU_THEME = {
    melody: [262, 294, 330, 392, 440, 392, 330, 294],
    bass: [131, 147, 165, 196, 165, 147, 131, 123],
    tempo: 680,
    wave: 'sine',
    pad: 220,
  };

  const ERA_THEMES = {
    early: {
      melody: [262, 294, 330, 349, 392, 349, 330, 294],
      bass: [131, 131, 165, 165, 196, 196, 165, 131],
      tempo: 500,
      wave: 'triangle',
      pad: 196,
    },
    mid: {
      melody: [294, 330, 392, 440, 392, 330, 294, 262],
      bass: [147, 165, 196, 220, 196, 165, 147, 131],
      tempo: 460,
      wave: 'triangle',
      pad: 220,
    },
    siege: {
      melody: [220, 262, 294, 330, 294, 262, 220, 196],
      bass: [110, 110, 131, 147, 131, 110, 98, 87],
      tempo: 420,
      wave: 'sawtooth',
      pad: 174,
    },
    academy: {
      melody: [330, 392, 440, 523, 440, 392, 330, 294],
      bass: [165, 196, 220, 262, 220, 196, 165, 147],
      tempo: 480,
      wave: 'sine',
      pad: 262,
    },
    rts: {
      melody: [196, 220, 262, 294, 262, 220, 196, 175],
      bass: [98, 110, 131, 147, 131, 110, 98, 87],
      tempo: 400,
      wave: 'square',
      pad: 131,
    },
    hellscape: {
      melody: [175, 196, 220, 233, 220, 196, 175, 165],
      bass: [87, 98, 110, 117, 110, 98, 87, 82],
      tempo: 380,
      wave: 'sawtooth',
      pad: 98,
    },
  };

  let mixState = {
    intensity: 0,
    era: 'early',
    phase: 'day',
    wave: 0,
    boss: false,
    horde: false,
    hordeIntensity: 0,
  };

  function updateMix(state = {}) {
    mixState = { ...mixState, ...state };
    if (!ctx || muted) return;
    const night = mixState.phase === 'night';
    const i = mixState.intensity;
    // Scale mix targets by user volume settings (was overwriting master/music/sfx every tick).
    const targetMaster = (night ? 0.62 : 0.75) * masterVol;
    const targetMusic = ((night ? 0.18 : 0.24) + i * 0.14) * musicVol;
    const targetSfx = Math.min(0.72, 0.48 + i * 0.12) * sfxVol;
    const t = ctx.currentTime;
    masterGain.gain.setTargetAtTime(targetMaster, t, 0.4);
    musicGain.gain.setTargetAtTime(targetMusic, t, 0.35);
    sfxGain.gain.setTargetAtTime(targetSfx, t, 0.25);
    syncRecordedMusic();
  }

  function playBattlePercussion() {
    if (recorded) return;
    if (!ctx || muted || mixState.intensity < 0.35) return;
    const t = ctx.currentTime;
    const vol = 0.06 + mixState.intensity * 0.1;
    playNoise(0.08, vol, 180);
    const kick = ctx.createOscillator();
    const kg = ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(90, t);
    kick.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    kg.gain.setValueAtTime(vol * 1.2, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    kick.connect(kg);
    kg.connect(musicGain);
    kick.start(t);
    kick.stop(t + 0.16);
  }

  function playMusicStep(step) {
    if (!ctx || !musicPlaying || muted) return;
    // The recorded loop for this scene is playing: the sequencer stays silent but keeps ticking,
    // so it can pick up again if the recording ever stops.
    syncRecordedMusic();
    if (recorded) return;
    const theme =
      musicContext === 'menu' ? MENU_THEME : ERA_THEMES[mixState.era] || ERA_THEMES.early;
    const melody = theme.melody;
    const bass = theme.bass;
    const t = ctx.currentTime;
    const idx = step % melody.length;
    const melVol =
      musicContext === 'menu'
        ? 0.13
        : mixState.phase === 'night'
          ? 0.1
          : 0.14 + mixState.intensity * 0.07;

    const melOsc = ctx.createOscillator();
    const melGain = ctx.createGain();
    melOsc.type = theme.wave;
    melOsc.frequency.value = melody[idx];
    melGain.gain.setValueAtTime(melVol, t);
    melGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    melOsc.connect(melGain);
    melGain.connect(musicGain);
    melOsc.start(t);
    melOsc.stop(t + 0.45);

    // Harmony third — thicker, more emotional score without extra assets
    if (step % 2 === 0 || musicContext === 'menu') {
      const harm = ctx.createOscillator();
      const harmG = ctx.createGain();
      harm.type = theme.wave === 'sawtooth' ? 'triangle' : 'sine';
      harm.frequency.value = melody[idx] * 1.25;
      harmG.gain.setValueAtTime(melVol * 0.38, t);
      harmG.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      harm.connect(harmG);
      harmG.connect(musicGain);
      harm.start(t);
      harm.stop(t + 0.4);
    }

    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = bass[idx];
    bassGain.gain.setValueAtTime(0.16 + mixState.intensity * 0.09, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    bassOsc.connect(bassGain);
    bassGain.connect(musicGain);
    bassOsc.start(t);
    bassOsc.stop(t + 0.5);

    if (theme.pad && step % 4 === 0) {
      const pad = ctx.createOscillator();
      const padG = ctx.createGain();
      pad.type = 'sine';
      pad.frequency.value = theme.pad;
      padG.gain.setValueAtTime(0.045 + mixState.intensity * 0.02, t);
      padG.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
      pad.connect(padG);
      padG.connect(musicGain);
      pad.start(t);
      pad.stop(t + 1.0);

      // Soft fifth under pad for epic weight
      const pad5 = ctx.createOscillator();
      const pad5G = ctx.createGain();
      pad5.type = 'sine';
      pad5.frequency.value = theme.pad * 1.5;
      pad5G.gain.setValueAtTime(0.02, t);
      pad5G.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      pad5.connect(pad5G);
      pad5G.connect(musicGain);
      pad5.start(t);
      pad5.stop(t + 0.95);
    }

    if (musicContext !== 'menu') {
      if (mixState.intensity > 0.35 && step % 2 === 0) playBattlePercussion();
      if (mixState.intensity > 0.65 && step % 4 === 1) {
        // Snare-ish high click for intense battles
        playNoise(0.03, 0.04 + mixState.intensity * 0.04, 2400);
      }
      if (mixState.boss && step % 8 === 0) playNoise(0.04, 0.05, 300);
      if (
        mixState.horde &&
        mixState.phase === 'day' &&
        step % (mixState.hordeIntensity >= 0.65 ? 3 : 5) === 0
      ) {
        SFX.hordeStomp(mixState.hordeIntensity);
      }
      const noiseVol =
        0.04 + mixState.intensity * 0.04 + (mixState.horde ? mixState.hordeIntensity * 0.03 : 0);
      playNoise(0.04, noiseVol, 400);
    } else if (step % 8 === 0) {
      // Soft menu drum heartbeat
      playNoise(0.05, 0.035, 160);
    }
  }

  let musicStep = 0;

  function tickMusic() {
    if (!musicPlaying) return;
    whenReady(() => {
      if (!musicPlaying) return;
      playMusicStep(musicStep++);
      const theme = ERA_THEMES[mixState.era] || ERA_THEMES.early;
      if (musicTimer) clearTimeout(musicTimer);
      musicTimer = setTimeout(tickMusic, theme.tempo);
    });
  }

  function beginMusic(context) {
    if (muted) return;
    if (musicPlaying && musicContext === context) return;
    musicPlaying = true;
    musicContext = context;
    musicStep = 0;
    resume().then((ok) => {
      if (!ok || muted) {
        musicPlaying = false;
        musicContext = 'none';
        return;
      }
      loadSamples();
      syncRecordedMusic();
      tickMusic();
    });
  }

  // ---------------------------------------------------------------- ambience
  // A bed of wind under the battle: brighter with crows by day, lower with a drone at night.
  let ambMode = 'off';
  let ambGain = null;
  let ambFilter = null;
  let ambSource = null;
  let ambDrone = null;
  let ambDroneGain = null;
  let ambTimer = null;
  let ambNightLoop = null;

  function stopAmbience() {
    ambMode = 'off';
    try {
      ambNightLoop?.stop();
    } catch (_) {
      /* already stopped */
    }
    ambNightLoop = null;
    if (ambTimer) {
      clearTimeout(ambTimer);
      ambTimer = null;
    }
    try {
      ambSource?.stop();
      ambDrone?.stop();
    } catch (_) {
      /* already stopped */
    }
    ambSource = null;
    ambDrone = null;
  }

  function ambienceGust() {
    if (ambMode === 'off' || !ctx || !ambGain) return;
    const t = ctx.currentTime;
    const night = ambMode === 'night';
    const level = (night ? 0.028 : 0.04) * (0.6 + Math.random() * 0.8);
    ambGain.gain.setTargetAtTime(muted ? 0 : level, t, 1.6);
    ambFilter.frequency.setTargetAtTime((night ? 260 : 520) + Math.random() * 380, t, 2.2);
    if (!night && !muted && Math.random() < 0.3) SFX.crowCaw();
    ambTimer = setTimeout(ambienceGust, 3500 + Math.random() * 5000);
  }

  /** mode: 'day', 'night' or 'off'. */
  function setAmbience(mode) {
    if (mode === ambMode) return;
    if (mode === 'off' || !mode) {
      stopAmbience();
      return;
    }
    const wasOff = ambMode === 'off';
    ambMode = mode;
    whenReady(() => {
      if (ambMode === 'off') return;
      if (wasOff || !ambSource) {
        const len = ctx.sampleRate * 3;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          // Brown-ish noise: smoother than white, closer to wind.
          last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985;
          data[i] = last * 3;
        }
        ambSource = ctx.createBufferSource();
        ambSource.buffer = buffer;
        ambSource.loop = true;
        ambFilter = ctx.createBiquadFilter();
        ambFilter.type = 'lowpass';
        ambFilter.frequency.value = 500;
        ambGain = ctx.createGain();
        ambGain.gain.value = 0;
        ambSource.connect(ambFilter);
        ambFilter.connect(ambGain);
        ambGain.connect(masterGain);
        ambSource.start();
        ambDrone = ctx.createOscillator();
        ambDrone.type = 'sine';
        ambDrone.frequency.value = 55;
        ambDroneGain = ctx.createGain();
        ambDroneGain.gain.value = 0;
        ambDrone.connect(ambDroneGain);
        ambDroneGain.connect(masterGain);
        ambDrone.start();
      }
      // At night the recorded string drone plays if it has loaded; the sine drone is the fallback.
      loadSamples();
      if (ambNightLoop) {
        try {
          ambNightLoop.stop();
        } catch (_) {
          /* already stopped */
        }
        ambNightLoop = null;
      }
      if (ambMode === 'night') {
        ambNightLoop = playSample('nightDrone', { loop: true, dest: masterGain });
      }
      ambDroneGain.gain.setTargetAtTime(
        ambMode === 'night' && !muted && !ambNightLoop ? 0.035 : 0,
        ctx.currentTime,
        2
      );
      if (ambTimer) clearTimeout(ambTimer);
      ambienceGust();
    });
  }

  function startMusic() {
    beginMusic('game');
  }

  function startMenuMusic() {
    beginMusic('menu');
  }

  function stopMusic() {
    musicPlaying = false;
    musicContext = 'none';
    fadeOutRecorded(0.8);
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = null;
    }
  }

  return {
    init,
    resume,
    bindUnlock,
    whenReady,
    play,
    SFX,
    startMusic,
    startMenuMusic,
    stopMusic,
    setAmbience,
    /** Names of the recorded cues that have loaded; the rest are playing synthesized. */
    getLoadedCues: () => Object.keys(samples),
    /** Which recorded loop is playing ('musicMenu' | 'musicSiege' | 'musicBoss'), or null. */
    getRecordedMusic: () => (recorded ? recorded.name : null),
    updateMix,
    toggleMute,
    setMuted,
    isMuted,
    isUnlocked,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
  };
})();

// Global convenience — used by Game when services lag on first frame.
if (typeof globalThis !== 'undefined') globalThis.AudioEngine = AudioEngine;
