/**
 * Persistent unlocks — Grand Coliseum, Doomslayer hero, cheat flags.
 */
const MetaProgress = (() => {
  const STORAGE_KEY = 'myth-and-blood-meta-v1';

  let data = {
    wweAcademyUnlocked: false,
    doomslayerHeroUnlocked: false,
    crossover115Unlocked: false,
    crossoverPrimusUnlocked: false,
    crossoverHaloUnlocked: false,
    crossoverGearsUnlocked: false,
    crossoverLotrUnlocked: false,
    crossoverBakiUnlocked: false,
    crossoverJojoUnlocked: false,
    crossoverFotnsUnlocked: false,
    crossoverDragonballUnlocked: false,
    crossoverImperiumUnlocked: false,
    crossoverCrystalUnlocked: false,
    crossoverWarpUnlocked: false,
    crossoverWarhammerUnlocked: false,
    crossoverTesUnlocked: false,
    cheatsUsed: [],
    wweRecruited: [],
    crossoverRecruited: [],
    lifetimeKills: {},
    lifetimeWaves: {},
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch (_) {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  }

  function unlockWweAcademy() {
    if (data.wweAcademyUnlocked) return false;
    data.wweAcademyUnlocked = true;
    save();
    return true;
  }

  function unlockDoomslayerHero() {
    if (data.doomslayerHeroUnlocked) return false;
    data.doomslayerHeroUnlocked = true;
    save();
    return true;
  }

  function unlock115() {
    if (data.crossover115Unlocked) return false;
    data.crossover115Unlocked = true;
    save();
    return true;
  }

  function unlockPrimus() {
    if (data.crossoverPrimusUnlocked) return false;
    data.crossoverPrimusUnlocked = true;
    save();
    return true;
  }

  function unlockHalo() {
    if (data.crossoverHaloUnlocked) return false;
    data.crossoverHaloUnlocked = true;
    save();
    return true;
  }

  function unlockGears() {
    if (data.crossoverGearsUnlocked) return false;
    data.crossoverGearsUnlocked = true;
    save();
    return true;
  }

  function unlockLotr() {
    if (data.crossoverLotrUnlocked) return false;
    data.crossoverLotrUnlocked = true;
    save();
    return true;
  }

  function unlockBaki() {
    if (data.crossoverBakiUnlocked) return false;
    data.crossoverBakiUnlocked = true;
    save();
    return true;
  }

  function unlockJojo() {
    if (data.crossoverJojoUnlocked) return false;
    data.crossoverJojoUnlocked = true;
    save();
    return true;
  }

  function unlockFotns() {
    if (data.crossoverFotnsUnlocked) return false;
    data.crossoverFotnsUnlocked = true;
    save();
    return true;
  }

  function unlockDragonball() {
    if (data.crossoverDragonballUnlocked) return false;
    data.crossoverDragonballUnlocked = true;
    save();
    return true;
  }

  function unlockImperium() {
    if (data.crossoverImperiumUnlocked) return false;
    data.crossoverImperiumUnlocked = true;
    save();
    return true;
  }

  function unlockCrystal() {
    if (data.crossoverCrystalUnlocked) return false;
    data.crossoverCrystalUnlocked = true;
    save();
    return true;
  }

  function unlockWarp() {
    if (data.crossoverWarpUnlocked) return false;
    data.crossoverWarpUnlocked = true;
    save();
    return true;
  }

  function unlockWarhammer() {
    if (data.crossoverWarhammerUnlocked) return false;
    data.crossoverWarhammerUnlocked = true;
    unlockImperium();
    unlockWarp();
    save();
    return true;
  }

  function unlockTes() {
    if (data.crossoverTesUnlocked) return false;
    data.crossoverTesUnlocked = true;
    save();
    return true;
  }

  function unlockAllCheatContent() {
    data.wweAcademyUnlocked = true;
    data.doomslayerHeroUnlocked = true;
    data.crossover115Unlocked = true;
    data.crossoverPrimusUnlocked = true;
    data.crossoverHaloUnlocked = true;
    data.crossoverGearsUnlocked = true;
    data.crossoverLotrUnlocked = true;
    data.crossoverBakiUnlocked = true;
    data.crossoverJojoUnlocked = true;
    data.crossoverFotnsUnlocked = true;
    data.crossoverDragonballUnlocked = true;
    data.crossoverImperiumUnlocked = true;
    data.crossoverCrystalUnlocked = true;
    data.crossoverWarpUnlocked = true;
    data.crossoverWarhammerUnlocked = true;
    data.crossoverTesUnlocked = true;
    save();
    return true;
  }

  function recordCheat(code) {
    if (!data.cheatsUsed.includes(code)) {
      data.cheatsUsed.push(code);
      save();
    }
  }

  function recordWweRecruit(id) {
    if (!data.wweRecruited.includes(id)) {
      data.wweRecruited.push(id);
      save();
    }
  }

  function recordCrossoverRecruit(id) {
    if (!data.crossoverRecruited.includes(id)) {
      data.crossoverRecruited.push(id);
      save();
    }
  }

  function isWweUnlocked() {
    return !!data.wweAcademyUnlocked;
  }

  function isDoomslayerHeroUnlocked() {
    return !!data.doomslayerHeroUnlocked;
  }

  function is115Unlocked() {
    return !!data.crossover115Unlocked;
  }
  function isPrimusUnlocked() {
    return !!data.crossoverPrimusUnlocked;
  }
  function isHaloUnlocked() {
    return !!data.crossoverHaloUnlocked;
  }
  function isGearsUnlocked() {
    return !!data.crossoverGearsUnlocked;
  }
  function isLotrUnlocked() {
    return !!data.crossoverLotrUnlocked;
  }
  function isBakiUnlocked() {
    return !!data.crossoverBakiUnlocked;
  }
  function isJojoUnlocked() {
    return !!data.crossoverJojoUnlocked;
  }
  function isFotnsUnlocked() {
    return !!data.crossoverFotnsUnlocked;
  }
  function isDragonballUnlocked() {
    return !!data.crossoverDragonballUnlocked;
  }
  function isImperiumUnlocked() {
    return !!data.crossoverImperiumUnlocked;
  }
  function isCrystalUnlocked() {
    return !!data.crossoverCrystalUnlocked;
  }
  function isWarpUnlocked() {
    return !!data.crossoverWarpUnlocked;
  }

  function isWarhammerUnlocked() {
    return !!data.crossoverWarhammerUnlocked;
  }

  function isTesUnlocked() {
    return !!data.crossoverTesUnlocked;
  }

  function isCrossoverFactionUnlocked(factionId) {
    const map = {
      ultimis: is115Unlocked,
      primis: isPrimusUnlocked,
      halo: isHaloUnlocked,
      gears: isGearsUnlocked,
      lotr: isLotrUnlocked,
      baki: isBakiUnlocked,
      jojo: isJojoUnlocked,
      fotns: isFotnsUnlocked,
      dragonball: isDragonballUnlocked,
      imperium: isImperiumUnlocked,
      crystal: isCrystalUnlocked,
      warp: isWarpUnlocked,
      warhammer: isWarhammerUnlocked,
      tes: isTesUnlocked,
    };
    return map[factionId]?.() ?? false;
  }

  function isAnyCrossoverUnlocked() {
    return (
      is115Unlocked() ||
      isPrimusUnlocked() ||
      isHaloUnlocked() ||
      isGearsUnlocked() ||
      isLotrUnlocked() ||
      isBakiUnlocked() ||
      isJojoUnlocked() ||
      isFotnsUnlocked() ||
      isDragonballUnlocked() ||
      isImperiumUnlocked() ||
      isCrystalUnlocked() ||
      isWarpUnlocked() ||
      isWarhammerUnlocked() ||
      isTesUnlocked()
    );
  }

  function getWweRecruited() {
    return [...data.wweRecruited];
  }

  function getCrossoverRecruited() {
    return [...(data.crossoverRecruited || [])];
  }

  function getCheatsUsed() {
    return [...data.cheatsUsed];
  }

  function reset() {
    data = {
      wweAcademyUnlocked: false,
      doomslayerHeroUnlocked: false,
      crossover115Unlocked: false,
      crossoverPrimusUnlocked: false,
      crossoverHaloUnlocked: false,
      crossoverGearsUnlocked: false,
      crossoverLotrUnlocked: false,
      crossoverBakiUnlocked: false,
      crossoverJojoUnlocked: false,
      crossoverFotnsUnlocked: false,
      crossoverDragonballUnlocked: false,
    crossoverImperiumUnlocked: false,
    crossoverCrystalUnlocked: false,
    crossoverWarpUnlocked: false,
    crossoverWarhammerUnlocked: false,
    crossoverTesUnlocked: false,
      cheatsUsed: [],
      wweRecruited: [],
      crossoverRecruited: [],
      lifetimeKills: {},
      lifetimeWaves: {},
    };
    save();
  }

  function getFactionMasteryTitles() {
    if (typeof FactionDepth === 'undefined') return {};
    const out = {};
    for (const fid of Object.keys(FactionDepth.PROFILES || {})) {
      const title = FactionDepth.getMasteryTitle(fid);
      if (title) out[fid] = title;
    }
    return out;
  }

  function getEarnedCreativeUnlocks() {
    return typeof FactionDepth !== 'undefined' ? FactionDepth.getCreativeUnlocks() : [];
  }

  function hasCreativeSkin(factionId) {
    return getEarnedCreativeUnlocks().includes(`creative_skin_${factionId}`);
  }

  return {
    load,
    save,
    unlockWweAcademy,
    unlockDoomslayerHero,
    unlock115,
    unlockPrimus,
    unlockHalo,
    unlockGears,
    unlockLotr,
    unlockBaki,
    unlockJojo,
    unlockFotns,
    unlockDragonball,
    unlockImperium,
    unlockCrystal,
    unlockWarp,
    unlockWarhammer,
    unlockTes,
    unlockAllCheatContent,
    recordCheat,
    recordWweRecruit,
    recordCrossoverRecruit,
    isWweUnlocked,
    isDoomslayerHeroUnlocked,
    is115Unlocked,
    isPrimusUnlocked,
    isHaloUnlocked,
    isGearsUnlocked,
    isLotrUnlocked,
    isBakiUnlocked,
    isJojoUnlocked,
    isFotnsUnlocked,
    isDragonballUnlocked,
    isImperiumUnlocked,
    isCrystalUnlocked,
    isWarpUnlocked,
    isWarhammerUnlocked,
    isTesUnlocked,
    isCrossoverFactionUnlocked,
    isAnyCrossoverUnlocked,
    getWweRecruited,
    getCrossoverRecruited,
    getCheatsUsed,
    reset,
    getData: () => ({ ...data }),
    getFactionMasteryTitles,
    getEarnedCreativeUnlocks,
    hasCreativeSkin,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MetaProgress = MetaProgress;
