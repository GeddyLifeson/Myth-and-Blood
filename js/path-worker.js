/**
 * Web Worker — grid pathfinding and weighted spawn-queue fill off the main thread.
 */
/* eslint-disable no-restricted-globals */
importScripts('pathfinding-core.js', 'wave-composition-core.js');

const walkGrids = {};

self.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      PathfindingCore.init(msg.worldW, msg.worldH);
      self.postMessage({ type: 'ready' });
      break;

    case 'setGrids': {
      for (const profile of Object.keys(msg.grids || {})) {
        walkGrids[profile] = new Uint8Array(msg.grids[profile]);
      }
      self.postMessage({ type: 'gridsAck', gen: msg.gen || 0 });
      break;
    }

    case 'findPath': {
      const grid = walkGrids[msg.profile];
      const path = grid
        ? PathfindingCore.findPathOnGrid(
            grid,
            msg.sx,
            msg.sy,
            msg.ex,
            msg.ey,
            msg.maxNodes
          )
        : [];
      self.postMessage({
        type: 'path',
        id: msg.id,
        unitId: msg.unitId,
        path,
        gen: msg.gen,
      });
      break;
    }

    case 'buildSpawnQueue': {
      const queue = WaveCompositionCore.buildWeightedSpawnQueue({
        count: msg.count,
        pool: msg.pool,
        weights: msg.weights,
        elites: msg.elites,
        noElites: msg.noElites,
        seed: msg.seed,
      });
      self.postMessage({ type: 'spawnQueue', id: msg.id, queue, wave: msg.wave });
      break;
    }

    default:
      break;
  }
};