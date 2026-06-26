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
      unlockPromise = ctx.resume().then(() => {
        unlocked = true;
        unlockPromise = null;
        return true;
      }).catch((err) => {
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
    resume().then((ok) => { if (ok && !muted) fn(); });
  }

  function bindUnlock() {
    const unlock = () => { resume(); };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
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
    else musicPlaying = false;
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() { return muted; }
  function isUnlocked() { return unlocked && ctx?.state === 'running'; }

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

  const SFX = {
    swordHit() {
      playNoise(0.08, 0.4, 3000);
      playTone(200, 0.1, 'square', 0.28);
      playTone(150, 0.15, 'sawtooth', 0.22);
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
      sweep(400, 80, 0.4, 'sawtooth', 0.3);
      playNoise(0.2, 0.25, 500);
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
    },
    victory() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => {
        setTimeout(() => playTone(n, 0.4, 'square', 0.32), i * 200);
      });
    },
    defeat() {
      const notes = [392, 349, 330, 262];
      notes.forEach((n, i) => {
        setTimeout(() => playTone(n, 0.5, 'sawtooth', 0.28), i * 300);
      });
    },
    click() {
      playTone(800, 0.05, 'square', 0.22);
    },
    horseCharge() {
      playNoise(0.3, 0.2, 600);
      sweep(100, 200, 0.3, 'sawtooth', 0.2);
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
      setTimeout(() => playTone(659, 0.18, 'triangle', 0.18), 80);
    },
    factionPulse(faction) {
      const palettes = {
        wwe: [330, 440, 550], doom: [80, 120, 90], ultimis: [220, 330, 180],
        primis: [280, 420, 200], halo: [180, 360, 520], gears: [200, 280, 340],
        lotr: [260, 390, 520], baki: [300, 200, 150], jojo: [440, 660, 880],
        fotns: [400, 600, 300], dragonball: [350, 520, 780],
      };
      const notes = palettes[faction] || [440, 550, 660];
      notes.forEach((n, i) => setTimeout(() => playTone(n, 0.1 + i * 0.02, 'triangle', 0.22), i * 55));
    },
    factionFinisher() {
      sweep(600, 200, 0.25, 'sawtooth', 0.35);
      playTone(120, 0.2, 'square', 0.28);
    },
    vetUpgrade() {
      playTone(523, 0.12, 'triangle', 0.22);
      setTimeout(() => playTone(659, 0.14, 'triangle', 0.2), 60);
      setTimeout(() => playTone(784, 0.18, 'sine', 0.18), 120);
    },
    honorChime() {
      [523, 659, 784, 988].forEach((n, i) => setTimeout(() => playTone(n, 0.22, 'sine', 0.16), i * 90));
    },
    bossWarn() {
      playTone(110, 0.35, 'sawtooth', 0.3);
      setTimeout(() => playTone(87, 0.4, 'square', 0.25), 180);
    },
    siegeRumble() {
      playNoise(0.25, 0.18, 200);
      playTone(55, 0.3, 'sawtooth', 0.2);
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
      tempo: 500, wave: 'triangle', pad: 196,
    },
    mid: {
      melody: [294, 330, 392, 440, 392, 330, 294, 262],
      bass: [147, 165, 196, 220, 196, 165, 147, 131],
      tempo: 460, wave: 'triangle', pad: 220,
    },
    siege: {
      melody: [220, 262, 294, 330, 294, 262, 220, 196],
      bass: [110, 110, 131, 147, 131, 110, 98, 87],
      tempo: 420, wave: 'sawtooth', pad: 174,
    },
    academy: {
      melody: [330, 392, 440, 523, 440, 392, 330, 294],
      bass: [165, 196, 220, 262, 220, 196, 165, 147],
      tempo: 480, wave: 'sine', pad: 262,
    },
    rts: {
      melody: [196, 220, 262, 294, 262, 220, 196, 175],
      bass: [98, 110, 131, 147, 131, 110, 98, 87],
      tempo: 400, wave: 'square', pad: 131,
    },
    hellscape: {
      melody: [175, 196, 220, 233, 220, 196, 175, 165],
      bass: [87, 98, 110, 117, 110, 98, 87, 82],
      tempo: 380, wave: 'sawtooth', pad: 98,
    },
  };

  let mixState = { intensity: 0, era: 'early', phase: 'day', wave: 0, boss: false };

  function updateMix(state = {}) {
    mixState = { ...mixState, ...state };
    if (!ctx || muted) return;
    const night = mixState.phase === 'night';
    const i = mixState.intensity;
    const targetMaster = night ? 0.62 : 0.75;
    const targetMusic = (night ? 0.18 : 0.24) + i * 0.14;
    const targetSfx = 0.48 + i * 0.12;
    const t = ctx.currentTime;
    masterGain.gain.setTargetAtTime(targetMaster, t, 0.4);
    musicGain.gain.setTargetAtTime(targetMusic, t, 0.35);
    sfxGain.gain.setTargetAtTime(Math.min(0.72, targetSfx), t, 0.25);
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
    const theme = musicContext === 'menu'
      ? MENU_THEME
      : (ERA_THEMES[mixState.era] || ERA_THEMES.early);
    const melody = theme.melody;
    const bass = theme.bass;
    const t = ctx.currentTime;
    const idx = step % melody.length;
    const melVol = musicContext === 'menu'
      ? 0.12
      : (mixState.phase === 'night' ? 0.1 : 0.14 + mixState.intensity * 0.06);

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

    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = bass[idx];
    bassGain.gain.setValueAtTime(0.16 + mixState.intensity * 0.08, t);
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
      padG.gain.setValueAtTime(0.04, t);
      padG.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      pad.connect(padG);
      padG.connect(musicGain);
      pad.start(t);
      pad.stop(t + 0.95);
    }

    if (musicContext !== 'menu') {
      if (mixState.intensity > 0.4 && step % 2 === 0) playBattlePercussion();
      if (mixState.boss && step % 8 === 0) playNoise(0.04, 0.05, 300);
      playNoise(0.04, 0.04 + mixState.intensity * 0.04, 400);
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
    init, resume, bindUnlock, whenReady,
    SFX, startMusic, startMenuMusic, stopMusic, updateMix,
    toggleMute, setMuted, isMuted, isUnlocked,
    setMasterVolume, setMusicVolume, setSfxVolume, getVolumes,
  };
})();