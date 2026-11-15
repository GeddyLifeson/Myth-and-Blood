/**
 * Persistent unlocks — Champions’ Hall, Hellbane hero, cheat flags.
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

  function unlockChampionsHall() {
    if (data.wweAcademyUnlocked) return false;
    data.wweAcademyUnlocked = true;
    save();
    return true;
  }

  function unlockAbyssWalker() {
    if (data.doomslayerHeroUnlocked) return false;
    data.doomslayerHeroUnlocked = true;
    save();
    return true;
  }

  function unlockPowderhorn() {
    if (data.crossover115Unlocked) return false;
    data.crossover115Unlocked = true;
    save();
    return true;
  }

  function unlockPaleVigil() {
    if (data.crossoverPrimusUnlocked) return false;
    data.crossoverPrimusUnlocked = true;
    save();
    return true;
  }

  function unlockGreywatch() {
    if (data.crossoverHaloUnlocked) return false;
    data.crossoverHaloUnlocked = true;
    save();
    return true;
  }

  function unlockSawtooth() {
    if (data.crossoverGearsUnlocked) return false;
    data.crossoverGearsUnlocked = true;
    save();
    return true;
  }

  function unlockThornroad() {
    if (data.crossoverLotrUnlocked) return false;
    data.crossoverLotrUnlocked = true;
    save();
    return true;
  }

  function unlockKnucklebone() {
    if (data.crossoverBakiUnlocked) return false;
    data.crossoverBakiUnlocked = true;
    save();
    return true;
  }

  function unlockMarrowChoir() {
    if (data.crossoverJojoUnlocked) return false;
    data.crossoverJojoUnlocked = true;
    save();
    return true;
  }

  function unlockQuietHand() {
    if (data.crossoverFotnsUnlocked) return false;
    data.crossoverFotnsUnlocked = true;
    save();
    return true;
  }

  function unlockEmberblood() {
    if (data.crossoverDragonballUnlocked) return false;
    data.crossoverDragonballUnlocked = true;
    save();
    return true;
  }

  function unlockIronPsalm() {
    if (data.crossoverImperiumUnlocked) return false;
    data.crossoverImperiumUnlocked = true;
    save();
    return true;
  }

  function unlockSaltglass() {
    if (data.crossoverCrystalUnlocked) return false;
    data.crossoverCrystalUnlocked = true;
    save();
    return true;
  }

  function unlockOpenWound() {
    if (data.crossoverWarpUnlocked) return false;
    data.crossoverWarpUnlocked = true;
    save();
    return true;
  }

  function unlockWarhost() {
    if (data.crossoverWarhammerUnlocked) return false;
    data.crossoverWarhammerUnlocked = true;
    unlockIronPsalm();
    unlockOpenWound();
    save();
    return true;
  }

  function unlockRimehowl() {
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

  function recordChampionRecruit(id) {
    if (!data.wweRecruited.includes(id)) {
      data.wweRecruited.push(id);
      save();
    }
  }

  function recordHeroRecruit(id) {
    if (!data.crossoverRecruited.includes(id)) {
      data.crossoverRecruited.push(id);
      save();
    }
  }

  function isChampionsUnlocked() {
    return !!data.wweAcademyUnlocked;
  }

  function isAbyssWalkerUnlocked() {
    return !!data.doomslayerHeroUnlocked;
  }

  function isPowderhornUnlocked() {
    return !!data.crossover115Unlocked;
  }
  function isPaleVigilUnlocked() {
    return !!data.crossoverPrimusUnlocked;
  }
  function isGreywatchUnlocked() {
    return !!data.crossoverHaloUnlocked;
  }
  function isSawtoothUnlocked() {
    return !!data.crossoverGearsUnlocked;
  }
  function isThornroadUnlocked() {
    return !!data.crossoverLotrUnlocked;
  }
  function isKnuckleboneUnlocked() {
    return !!data.crossoverBakiUnlocked;
  }
  function isMarrowChoirUnlocked() {
    return !!data.crossoverJojoUnlocked;
  }
  function isQuietHandUnlocked() {
    return !!data.crossoverFotnsUnlocked;
  }
  function isEmberbloodUnlocked() {
    return !!data.crossoverDragonballUnlocked;
  }
  function isIronPsalmUnlocked() {
    return !!data.crossoverImperiumUnlocked;
  }
  function isSaltglassUnlocked() {
    return !!data.crossoverCrystalUnlocked;
  }
  function isOpenWoundUnlocked() {
    return !!data.crossoverWarpUnlocked;
  }

  function isWarhostUnlocked() {
    return !!data.crossoverWarhammerUnlocked;
  }

  function isRimehowlUnlocked() {
    return !!data.crossoverTesUnlocked;
  }

  function isCompanyUnlocked(factionId) {
    const map = {
      powderhorn: isPowderhornUnlocked,
      pale_vigil: isPaleVigilUnlocked,
      greywatch: isGreywatchUnlocked,
      sawtooth: isSawtoothUnlocked,
      thornroad: isThornroadUnlocked,
      knucklebone: isKnuckleboneUnlocked,
      marrow_choir: isMarrowChoirUnlocked,
      quiet_hand: isQuietHandUnlocked,
      emberblood: isEmberbloodUnlocked,
      iron_psalm: isIronPsalmUnlocked,
      saltglass: isSaltglassUnlocked,
      open_wound: isOpenWoundUnlocked,
      warhammer: isWarhostUnlocked,
      rimehowl: isRimehowlUnlocked,
    };
    return map[factionId]?.() ?? false;
  }

  function isAnyCompanyUnlocked() {
    return (
      isPowderhornUnlocked() ||
      isPaleVigilUnlocked() ||
      isGreywatchUnlocked() ||
      isSawtoothUnlocked() ||
      isThornroadUnlocked() ||
      isKnuckleboneUnlocked() ||
      isMarrowChoirUnlocked() ||
      isQuietHandUnlocked() ||
      isEmberbloodUnlocked() ||
      isIronPsalmUnlocked() ||
      isSaltglassUnlocked() ||
      isOpenWoundUnlocked() ||
      isWarhostUnlocked() ||
      isRimehowlUnlocked()
    );
  }

  function getChampionsRecruited() {
    return [...data.wweRecruited];
  }

  function getHeroesRecruited() {
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
    unlockChampionsHall,
    unlockAbyssWalker,
    unlockPowderhorn,
    unlockPaleVigil,
    unlockGreywatch,
    unlockSawtooth,
    unlockThornroad,
    unlockKnucklebone,
    unlockMarrowChoir,
    unlockQuietHand,
    unlockEmberblood,
    unlockIronPsalm,
    unlockSaltglass,
    unlockOpenWound,
    unlockWarhost,
    unlockRimehowl,
    unlockAllCheatContent,
    recordCheat,
    recordChampionRecruit,
    recordHeroRecruit,
    isChampionsUnlocked,
    isAbyssWalkerUnlocked,
    isPowderhornUnlocked,
    isPaleVigilUnlocked,
    isGreywatchUnlocked,
    isSawtoothUnlocked,
    isThornroadUnlocked,
    isKnuckleboneUnlocked,
    isMarrowChoirUnlocked,
    isQuietHandUnlocked,
    isEmberbloodUnlocked,
    isIronPsalmUnlocked,
    isSaltglassUnlocked,
    isOpenWoundUnlocked,
    isWarhostUnlocked,
    isRimehowlUnlocked,
    isCompanyUnlocked,
    isAnyCompanyUnlocked,
    getChampionsRecruited,
    getHeroesRecruited,
    getCheatsUsed,
    reset,
    getFactionMasteryTitles,
    getEarnedCreativeUnlocks,
    hasCreativeSkin,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.MetaProgress = MetaProgress;
