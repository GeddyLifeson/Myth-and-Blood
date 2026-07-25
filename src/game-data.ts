/// <reference path="./types.d.ts" />

/**
 * Config-driven game data — units, buildings, enemies, strikes, synergies.
 * Source: src/game-data.ts — compile with npm run build:ts
 */
class GameDataSystem {
  units: Record<string, UnitDef> = {};
  buildings: Record<string, BuildingDef> = {};
  enemies: Record<string, EnemyDef> = {};
  abilities: Record<string, AbilityDef> = {};
  spyActions: Record<string, SpyActionDef> = {};
  fxLife: Record<string, number> = {};
  synergies: SynergyDef[] = [];
  private _ready = false;
  private _baseUrl = 'data/';

  get isReady(): boolean {
    return this._ready;
  }

  private _normalizePack(pack: GameDataPack) {
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

  private _applyPack(pack: GameDataPack): this {
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

  publishGlobals(): this {
    const g = globalThis as Record<string, unknown>;
    g.UnitDefs = this.units;
    g.BuildDefs = this.buildings;
    g.EnemyDefs = this.enemies;
    g.Abilities = this.abilities;
    g.SpyActions = this.spyActions;
    return this;
  }

  refreshDependents(): this {
    // ContentExpansion mutates BuildDefs/UnitDefs after first load; re-apply so async
    // loadAll/reload from data/*.json does not wipe watchtower/traps/economy sites.
    const ce = (globalThis as Record<string, unknown>).ContentExpansion as
      | { registerDefs?: () => void }
      | undefined;
    if (ce?.registerDefs) ce.registerDefs();

    const fd = (globalThis as Record<string, unknown>).FactionDepth as
      | { refreshGameData?: (synergies: SynergyDef[]) => void; patchBuildDefs?: () => void }
      | undefined;
    if (fd?.refreshGameData) fd.refreshGameData(this.synergies);
    if (fd?.patchBuildDefs) fd.patchBuildDefs();

    const sfx = (globalThis as Record<string, unknown>).StrikeFX as
      { setFxLife?: (life: Record<string, number>) => void } | undefined;
    if (sfx?.setFxLife) sfx.setFxLife(this.fxLife);
    return this;
  }

  loadSync(): this {
    if (typeof GameDataBundle === 'undefined') {
      throw new Error('GameDataBundle missing — run scripts/extract-game-data.mjs');
    }
    return this._applyPack(GameDataBundle);
  }

  private async _decompressResponse(res: Response, format: string): Promise<unknown> {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream unavailable');
    }
    const stream = res.body!.pipeThrough(
      new DecompressionStream(format as CompressionFormat)
    );
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  private async _fetchJson(path: string): Promise<unknown> {
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

  async loadAll(baseUrl = 'data/'): Promise<this> {
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
        units: units as Record<string, UnitDef>,
        buildings: buildings as Record<string, BuildingDef>,
        enemies: enemies as Record<string, EnemyDef>,
        strikes: strikes as StrikesPack,
        synergies: synergies as SynergyDef[],
      });
      this.refreshDependents();
    } catch (err) {
      if (!this._ready) this.loadSync();
      else console.warn('[GameData] loadAll failed, keeping current pack:', err);
    }
    return this;
  }

  reload(pack?: GameDataPack): this {
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
(globalThis as Record<string, unknown>).GameData = GameData;
