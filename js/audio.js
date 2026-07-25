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
    const unlock = () => {
      resume();
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
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
  function play(name, ...args) {
    try {
      const fn = SFX[name];
      if (typeof fn === 'function') fn(...args);
    } catch (e) {
      console.warn('AudioEngine.play failed', name, e);
    }
  }

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

  function getVolumes() {
    return { master: masterVol, music: musicVol, sfx: sfxVol, muted };
  }

  function setMuted(value) {
    muted = !!value;
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(muted ? 0 : masterVol, ctx.currentTime);
    }
    if (muted) stopMusic();
    else {
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
  }

  function playBattlePercussion() {
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
      tickMusic();
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
    updateMix,
    toggleMute,
    setMuted,
    isMuted,
    isUnlocked,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    getVolumes,
  };
})();

// Global convenience — used by Game when services lag on first frame.
if (typeof globalThis !== 'undefined') globalThis.AudioEngine = AudioEngine;
