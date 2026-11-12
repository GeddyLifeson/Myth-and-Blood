'use strict';
/// <reference path="./types.d.ts" />
/**
 * Config-driven game data — units, buildings, enemies, strikes, synergies.
 * Source: src/game-data.ts — compile with npm run build:ts
 */
class GameDataSystem {
  constructor() {
    this.units = {};
    this.buildings = {};
    this.enemies = {};
    this.abilities = {};
    this.spyActions = {};
    this.fxLife = {};
    this.synergies = [];
    this._ready = false;
    this._baseUrl = 'data/';
  }
  get isReady() {
    return this._ready;
  }
  _normalizePack(pack) {
    const strikes = pack.strikes ?? {};
    return {
      units: pack.units ?? {},
      buildings: pack.buildings ?? {},
      enemies: pack.enemies ?? {},
      abilities: strikes.abilities ?? pack.abilities ?? {},
      spyActions: strikes.spyActions ?? pack.spyActions ?? {},
      fxLife: strikes.fxLife ?? pack.fxLife ?? {},
      synergies: pack.synergies ?? [],
    };
  }
  _applyPack(pack) {
    const p = this._normalizePack(pack);
    this.units = p.units;
    this.buildings = p.buildings;
    this.enemies = p.enemies;
    this.abilities = p.abilities;
    this.spyActions = p.spyActions;
    this.fxLife = p.fxLife;
    this.synergies = p.synergies;
    this.publishGlobals();
    this._ready = true;
    return this;
  }
  publishGlobals() {
    const g = globalThis;
    g.UnitDefs = this.units;
    g.BuildDefs = this.buildings;
    g.EnemyDefs = this.enemies;
    g.Abilities = this.abilities;
    g.SpyActions = this.spyActions;
    return this;
  }
  refreshDependents() {
    // ContentExpansion mutates BuildDefs/UnitDefs after first load; re-apply so async
    // loadAll/reload from data/*.json does not wipe watchtower/traps/economy sites.
    const ce = globalThis.ContentExpansion;
    if (ce?.registerDefs) ce.registerDefs();
    const fd = globalThis.FactionDepth;
    if (fd?.refreshGameData) fd.refreshGameData(this.synergies);
    if (fd?.patchBuildDefs) fd.patchBuildDefs();
    const sfx = globalThis.StrikeFX;
    if (sfx?.setFxLife) sfx.setFxLife(this.fxLife);
    return this;
  }
  loadSync() {
    if (typeof GameDataBundle === 'undefined') {
      throw new Error('GameDataBundle missing — run scripts/extract-game-data.mjs');
    }
    return this._applyPack(GameDataBundle);
  }
  async _decompressResponse(res, format) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream unavailable');
    }
    const stream = res.body.pipeThrough(new DecompressionStream(format));
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }
  async _fetchJson(path) {
    if (typeof DecompressionStream !== 'undefined') {
      for (const [suffix, format] of [
        ['.br', 'br'],
        ['.gz', 'gzip'],
      ]) {
        try {
          const res = await fetch(`${path}${suffix}`);
          if (!res.ok) continue;
          return await this._decompressResponse(res, format);
        } catch {
          /* try next encoding */
        }
      }
    }
    const res = await fetch(path);
    if (!res.ok) throw new Error(`GameData fetch failed: ${path} (${res.status})`);
    return res.json();
  }
  async loadAll(baseUrl = 'data/') {
    this._baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    if (typeof fetch !== 'function') {
      if (!this._ready) this.loadSync();
      return this;
    }
    try {
      const base = this._baseUrl;
      const [units, buildings, enemies, strikes, synergies] = await Promise.all([
        this._fetchJson(`${base}units.json`),
        this._fetchJson(`${base}buildings.json`),
        this._fetchJson(`${base}enemies.json`),
        this._fetchJson(`${base}strikes.json`),
        this._fetchJson(`${base}synergies.json`),
      ]);
      this._applyPack({
        units: units,
        buildings: buildings,
        enemies: enemies,
        strikes: strikes,
        synergies: synergies,
      });
      this.refreshDependents();
    } catch (err) {
      if (!this._ready) this.loadSync();
      else console.warn('[GameData] loadAll failed, keeping current pack:', err);
    }
    return this;
  }
  reload(pack) {
    if (pack) {
      this._applyPack(pack);
    } else if (typeof GameDataBundle !== 'undefined') {
      this._applyPack(GameDataBundle);
    }
    this.refreshDependents();
    return this;
  }
}
const GameData = new GameDataSystem();
GameData.loadSync();
// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.GameData = GameData;
