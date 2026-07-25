/**
 * Combat damage previews for HUD tooltips — mirrors calcDamage / strike falloff without RNG.
 */
const DamagePreview = (() => {
  const BASE_RAND = 10;
  const REF_GRUNT = { early: 'goblin', mid: 'orc', midWave: 15 };

  function ctxFromState(gs) {
    if (!gs) return { wave: 1, difficultyId: 'normal' };
    return {
      wave: Math.max(1, gs.wave ?? 1),
      difficultyId: gs.difficulty ?? 'normal',
      lastStandActive: !!gs.lastStandActive,
      generalStationed: !!gs.generalStationed,
      generalAura: gs.generalAura || null,
      creativeMode: !!gs.creativeMode,
      loadout: gs.loadout ?? 'balanced',
      waveModifiers: gs.waveModifiers || {},
    };
  }

  function getDiffMods(ctx) {
    const diff = typeof getDifficultyDef === 'function' ? getDifficultyDef(ctx.difficultyId) : {};
    const adv =
      typeof AdvancedDifficulty !== 'undefined' ? AdvancedDifficulty.getCombinedMods() : null;
    return {
      allyDmgMult: (diff.allyDmgMult || 1) * (adv?.allyDmgMult || 1),
      enemyHpMult: (diff.enemyHpMult || 1) * (adv?.enemyHpMult || 1),
      waveDmgScaleMult: diff.waveDmgScaleMult || 1,
      waveHpScaleMult: diff.waveHpScaleMult || 1,
      enemyDmgMult: diff.enemyDmgMult || 1,
      eliteChanceMult: diff.eliteChanceMult || 1,
    };
  }

  function applyLoadoutPreview(unit, ctx) {
    if (!unit || unit.team !== 'player') return;
    if (typeof isKingdomLoadoutsUnlocked === 'function' && !isKingdomLoadoutsUnlocked(ctx.wave))
      return;
    const lo = ctx.loadout || 'balanced';
    if (lo === 'arrows' && (unit.type === 'archer' || unit.type === 'mage')) {
      unit.damage = Math.floor(unit.damage * 1.12);
    }
  }

  function buildAttacker(type, ctx) {
    if (typeof createUnit !== 'function') return null;
    const u = createUnit(type, 0, 0, 'player');
    if (!u || !(u.damage > 0)) return null;

    const diff = getDiffMods(ctx);
    if (diff.allyDmgMult !== 1) u.damage = Math.floor(u.damage * diff.allyDmgMult);

    if (typeof getKingdomStageBuffs === 'function') {
      const kb = getKingdomStageBuffs(ctx.wave);
      if (kb.armyDmgMult > 1) u.damage = Math.floor(u.damage * kb.armyDmgMult);
    }

    applyLoadoutPreview(u, ctx);

    if (typeof CrownLegacies !== 'undefined' && !ctx.creativeMode && CrownLegacies.applyUnitBonuses) {
      CrownLegacies.applyUnitBonuses(u);
    }

    if (typeof GameDepth !== 'undefined' && GameDepth.isIpOperative?.(u)) {
      u.baseMaxHp = null;
      u.baseDamage = null;
      GameDepth.applyIpWaveScaling(u, ctx.wave);
    }

    return u;
  }

  function referenceEnemyType(wave) {
    return wave >= REF_GRUNT.midWave ? REF_GRUNT.mid : REF_GRUNT.early;
  }

  function buildReferenceEnemy(ctx) {
    if (typeof createUnit !== 'function' || typeof GameDepth === 'undefined') return null;
    const type = referenceEnemyType(ctx.wave);
    const enemy = createUnit(type, 0, 0, 'enemy');
    if (!enemy) return null;

    const diff = getDiffMods(ctx);
    GameDepth.applyEnemySpawnScaling(enemy, ctx.wave, {
      cfg: { hpScale: 1, dmgScale: 1 },
      diff: {
        enemyHpMult: diff.enemyHpMult,
        enemyDmgMult: diff.enemyDmgMult,
        waveDmgScaleMult: diff.waveDmgScaleMult,
        waveHpScaleMult: diff.waveHpScaleMult,
        eliteChanceMult: diff.eliteChanceMult,
      },
      waveModifiers: ctx.waveModifiers,
    });

    return { unit: enemy, type, label: EnemyDefs[type]?.name || type };
  }

  function calcDamageAt(attacker, target, ctx, randRoll) {
    let dmg = attacker.damage + randRoll;
    dmg += Math.floor((attacker.experience || 0) / 3) * 2;
    dmg += (attacker.vetTier || 0) * 5;

    if (attacker.team === 'player' && !attacker.isGeneral && ctx.generalStationed && ctx.generalAura) {
      const aura = ctx.generalAura;
      const typeMult =
        attacker.combatType === 'ranged' || attacker.projectile ? aura.rangedDmg : aura.meleeDmg;
      dmg = Math.round(dmg * (1 + (typeMult || 0)));
    }

    if (ctx.lastStandActive && attacker.team === 'player') {
      dmg = Math.round(dmg * (GameDepth?.lastStandDamageMult?.(true) || 1.28));
    }

    // Anti-air / anti-cav / ballista flyer bonuses live only in ContentExpansion.modifyCalcDamage
    // (applying them here double-counted vs real combat).
    if (typeof ContentExpansion !== 'undefined' && ContentExpansion.modifyCalcDamage) {
      dmg = ContentExpansion.modifyCalcDamage(attacker, target, dmg);
    }
    if (typeof StrategyCounterplay !== 'undefined' && StrategyCounterplay.modifyDamage) {
      dmg = StrategyCounterplay.modifyDamage(attacker, target, dmg);
    }
    if (
      typeof FactionDepth !== 'undefined' &&
      FactionDepth.modifyDamage &&
      (attacker.isCrossover || attacker.isWwe)
    ) {
      dmg = FactionDepth.modifyDamage(attacker, target, dmg);
    }

    if (attacker.team === 'player' && typeof CrownLegacies !== 'undefined' && !ctx.creativeMode) {
      dmg = Math.round(dmg * (CrownLegacies.getCombinedEffects().playerDmgMult || 1));
    }
    if (attacker.team === 'player' && GameDepth?.isVanillaAlly?.(attacker)) {
      dmg = Math.round(dmg * GameDepth.getVanillaObsoleteMult(attacker, ctx.wave));
    }

    return Math.max(1, Math.round(dmg));
  }

  function damageRange(attacker, target, ctx) {
    const min = calcDamageAt(attacker, target, ctx, 0);
    const max = calcDamageAt(attacker, target, ctx, BASE_RAND - 1);
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  function hitsToKill(minDmg, maxDmg, hp) {
    const lo = Math.max(1, Math.ceil(hp / maxDmg));
    const hi = Math.max(1, Math.ceil(hp / minDmg));
    if (lo === hi) return `${lo} hit${lo === 1 ? '' : 's'}`;
    return `${lo}–${hi} hits`;
  }

  function strikeDamageAtCenter(rawDmg, distRatio) {
    return Math.max(1, Math.round(rawDmg * (1 - distRatio * 0.5)));
  }

  function applyEnemyMitigation(amount, target) {
    let mitigation = 1;
    if (typeof isEliteEnemy === 'function' && isEliteEnemy(target)) mitigation -= 0.08;
    return Math.max(1, Math.round(amount * Math.max(0.12, mitigation)));
  }

  function modifierNote(ctx) {
    const parts = [];
    if (ctx.generalStationed) parts.push('General aura');
    if (ctx.lastStandActive) parts.push('Last Stand');
    if (ctx.loadout && ctx.loadout !== 'balanced') parts.push('Loadout');
    return parts.length ? parts.join(' · ') : null;
  }

  function previewUnitVsEnemy(unitType, ctx) {
    const attacker = buildAttacker(unitType, ctx);
    const ref = buildReferenceEnemy(ctx);
    if (!attacker || !ref) return null;

    const { min, max } = damageRange(attacker, ref.unit, ctx);
    const mods = modifierNote(ctx);
    return {
      enemyLabel: ref.label,
      wave: ctx.wave,
      enemyHp: ref.unit.maxHp,
      dmgMin: min,
      dmgMax: max,
      hits: hitsToKill(min, max, ref.unit.maxHp),
      modifiers: mods,
    };
  }

  function previewAbility(abilityId, ctx, ab) {
    const raw = ab || (typeof Abilities !== 'undefined' ? Abilities[abilityId] : null);
    const ability = typeof scaleAbilityDef === 'function' ? scaleAbilityDef(raw) : raw;
    if (!ability?.damage) return null;

    const ref = buildReferenceEnemy(ctx);
    if (!ref) return null;

    const center = applyEnemyMitigation(strikeDamageAtCenter(ability.damage, 0), ref.unit);
    const edge = applyEnemyMitigation(
      strikeDamageAtCenter(ability.damage, 1),
      ref.unit
    );
    const centerKill = center >= ref.unit.hp;
    const edgeKill = edge >= ref.unit.hp;

    return {
      abilityId,
      radius: ability.radius,
      rawDamage: ability.damage,
      center,
      edge,
      enemyLabel: ref.label,
      enemyHp: ref.unit.hp,
      wave: ctx.wave,
      centerKill,
      edgeKill,
    };
  }

  function formatDeployTip(unitType, gs) {
    if (!gs) return '';
    const def = typeof getPlayerUnitDef === 'function' ? getPlayerUnitDef(unitType) : UnitDefs?.[unitType];
    if (!def || !(def.damage > 0)) return '';

    const ctx = ctxFromState(gs);
    const preview = previewUnitVsEnemy(unitType, ctx);
    if (!preview) return '';

    let line =
      `vs ${preview.enemyLabel} W${preview.wave}: ${preview.dmgMin}–${preview.dmgMax} dmg · ${preview.hits} to kill`;
    if (preview.modifiers) line += ` (${preview.modifiers})`;
    line += ' · open field';
    return line;
  }

  function formatAbilityTip(abilityId, gs) {
    if (!gs) return '';
    const ctx = ctxFromState(gs);
    const preview = previewAbility(abilityId, ctx);
    if (!preview) return '';

    const verdict = (dmg, kill) =>
      kill ? 'kill' : dmg >= preview.enemyHp * 0.45 ? 'heavy wound' : 'chip';

    let line = `Strike ${preview.rawDamage} dmg (r${preview.radius}): center ${preview.center}`;
    if (preview.radius > 0) line += ` · edge ${preview.edge}`;
    line += ` vs ${preview.enemyLabel} (${preview.enemyHp} HP W${preview.wave})`;
    line += ` — ${verdict(preview.center, preview.centerKill)} at center`;
    if (preview.radius > 0 && preview.edge !== preview.center) {
      line += `, ${verdict(preview.edge, preview.edgeKill)} at edge`;
    }
    return line;
  }

  return {
    ctxFromState,
    referenceEnemyType,
    buildAttacker,
    buildReferenceEnemy,
    damageRange,
    previewUnitVsEnemy,
    previewAbility,
    formatDeployTip,
    formatAbilityTip,
  };
})();