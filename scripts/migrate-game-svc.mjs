/**
 * Replace typeof Service !== 'undefined' and Service.foo with svc('Service') in game.js
 */
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'js', 'game.js');

const SERVICES = [
  'Spatial',
  'FactionDepth',
  'ColonyValue',
  'Settings',
  'GfxQuality',
  'LivingPlanet',
  'GameDepth',
  'ContentExpansion',
  'NeutralWildlife',
  'Pathfinding',
  'AdvancedDifficulty',
  'GameEvents',
  'DynamicMapEvents',
  'CrownLegacies',
  'GameModes',
  'EnemyFactions',
  'Research',
  'PlanetWarfare',
  'Achievements',
  'CreativeTools',
  'Perks',
  'Legacy',
  'VisualPolish',
  'MultiFrontSiege',
  'PlanetConquest',
  'Chronicles',
  'AsymmetricWarfare',
  'SettlementRaids',
  'FactionReputation',
  'PlayerCounterEvolution',
  'MonsterBosses',
  'FactionIntel',
  'FactionHazards',
  'MetaProgress',
  'Cheats',
  'SaveManager',
  'UI',
  'UX',
  'StrikeFX',
  'FloatingText',
  'SpriteGen',
  'Particles',
  'Effects',
  'AudioEngine',
  'Encyclopedia',
  'WWE',
  'Crossover',
  'Perf',
  'Tooltips',
];

let s = fs.readFileSync(GAME, 'utf8');

for (const name of SERVICES) {
  s = s.replaceAll(`typeof ${name} !== 'undefined'`, `svc('${name}')`);
  s = s.replaceAll(`typeof ${name} === 'undefined'`, `!svc('${name}')`);
  const re = new RegExp(`(?<![\\w.'"])${name}\\.`, 'g');
  s = s.replace(re, `svc('${name}').`);
}

fs.writeFileSync(GAME, s);
console.log('Migrated game.js to svc() calls');
