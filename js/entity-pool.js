/**
 * Object pool for units and buildings — reuse instances instead of alloc/GC churn.
 */
const EntityPool = (() => {
  const MAX_UNIT_POOL = 384;
  const MAX_BUILDING_POOL = 96;

  const unitPool = [];
  const buildingPool = [];

  let unitsReleased = 0;
  let unitsAcquired = 0;
  let buildingsReleased = 0;
  let buildingsAcquired = 0;

  // Reset by assignment, never `delete`: deleting properties pushes the object
  // into V8 dictionary mode, which is exactly the slow path this pool exists to
  // avoid. Nothing in the codebase probes pooled objects with `in` /
  // hasOwnProperty / Object.keys-length, so an undefined-valued key reads the
  // same as an absent one (and JSON.stringify still omits it).
  function wipe(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) obj[keys[i]] = undefined;
  }

  function acquireUnit() {
    unitsAcquired++;
    const u = unitPool.pop();
    if (u) {
      u._pooled = false;
      return u;
    }
    return {};
  }

  function releaseUnit(u) {
    if (!u || u._pooled) return;
    wipe(u);
    unitsReleased++;
    if (unitPool.length < MAX_UNIT_POOL) {
      u._pooled = true;
      unitPool.push(u);
    }
  }

  function acquireBuilding() {
    buildingsAcquired++;
    const b = buildingPool.pop();
    if (b) {
      b._pooled = false;
      return b;
    }
    return {};
  }

  function releaseBuilding(b) {
    if (!b || b._pooled) return;
    wipe(b);
    buildingsReleased++;
    if (buildingPool.length < MAX_BUILDING_POOL) {
      b._pooled = true;
      buildingPool.push(b);
    }
  }

  /** In-place filter; returns the same array reference. */
  function purgeInPlace(list, keepFn) {
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (keepFn(item)) list[w++] = item;
    }
    list.length = w;
    return list;
  }

  /** In-place removal of dead units; returns the same array reference. */
  function purgeDeadFromList(list) {
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      // Treat NaN/undefined hp as dead so corrupted units cannot linger forever.
      if (u && u.hp > 0) {
        list[w++] = u;
      } else {
        releaseUnit(u);
      }
    }
    list.length = w;
    return list;
  }

  function releaseAllFrom(list, releaseFn) {
    for (let i = 0; i < list.length; i++) releaseFn(list[i]);
    list.length = 0;
  }

  function reset() {
    unitPool.length = 0;
    buildingPool.length = 0;
  }

  function getStats() {
    return {
      unitPool: unitPool.length,
      buildingPool: buildingPool.length,
      unitsAcquired,
      unitsReleased,
      buildingsAcquired,
      buildingsReleased,
    };
  }

  return {
    acquireUnit,
    releaseUnit,
    acquireBuilding,
    releaseBuilding,
    purgeDeadFromList,
    purgeInPlace,
    releaseAllFrom,
    reset,
    getStats,
    MAX_UNIT_POOL,
    MAX_BUILDING_POOL,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.EntityPool = EntityPool;
