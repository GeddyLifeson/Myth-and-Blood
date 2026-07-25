/**
 * Hero / operative skill trees — per-faction nodes spent with run skill points.
 */
const OperativeSkillTrees = (() => {
  const STORAGE_KEY = 'myth-and-blood-operative-skills-v1';

  const FACTION_TREES = {
    wwe: {
      label: 'Grand Coliseum Champions',
      nodes: {
        showmanship: {
          id: 'showmanship',
          name: 'Showmanship',
          cost: 1,
          desc: '+3 max morale',
          bonus: { maxMorale: 3 },
        },
        hulk_up: {
          id: 'hulk_up',
          name: 'Hulk Up',
          cost: 2,
          requires: ['showmanship'],
          desc: '+8% melee damage',
          bonus: { meleeDmg: 0.08 },
        },
        finisher: {
          id: 'finisher',
          name: 'Finisher Craft',
          cost: 2,
          requires: ['showmanship'],
          desc: '+10% ability damage',
          bonus: { abilityDmg: 0.1 },
        },
        tag_team: {
          id: 'tag_team',
          name: 'Tag Team Aura',
          cost: 3,
          requires: ['hulk_up', 'finisher'],
          desc: '+2 morale regen, +5 accuracy',
          bonus: { moraleRegen: 2, acc: 5 },
        },
      },
    },
    ultimis: {
      label: 'Void Residue Crew',
      nodes: {
        frag_drill: {
          id: 'frag_drill',
          name: 'Frag Drill',
          cost: 1,
          desc: '+6 accuracy',
          bonus: { acc: 6 },
        },
        vodka_tank: {
          id: 'vodka_tank',
          name: 'Vodka Tank',
          cost: 2,
          requires: ['frag_drill'],
          desc: '+12% max HP',
          bonus: { hpMult: 0.12 },
        },
        wunder_chain: {
          id: 'wunder_chain',
          name: 'Wunder Chain',
          cost: 2,
          requires: ['frag_drill'],
          desc: '+10% ability damage',
          bonus: { abilityDmg: 0.1 },
        },
        moon_op: {
          id: 'moon_op',
          name: 'Moon Operator',
          cost: 3,
          requires: ['vodka_tank', 'wunder_chain'],
          desc: '+8% melee, +4 morale',
          bonus: { meleeDmg: 0.08, maxMorale: 4 },
        },
      },
    },
    primis: {
      label: 'First Circle',
      nodes: {
        aether_guard: {
          id: 'aether_guard',
          name: 'Aether Guard',
          cost: 1,
          desc: '+10% damage reduction aura',
          bonus: { damageTakenMult: 0.9 },
        },
        curtain: {
          id: 'curtain',
          name: 'Iron Curtain',
          cost: 2,
          requires: ['aether_guard'],
          desc: '+15 max HP',
          bonus: { flatHp: 15 },
        },
        summoning_key: {
          id: 'summoning_key',
          name: 'Void Key',
          cost: 2,
          requires: ['aether_guard'],
          desc: '+12% ability damage',
          bonus: { abilityDmg: 0.12 },
        },
        cycle_break: {
          id: 'cycle_break',
          name: 'Cycle Breaker',
          cost: 3,
          requires: ['curtain', 'summoning_key'],
          desc: '+7 accuracy, +3 morale',
          bonus: { acc: 7, maxMorale: 3 },
        },
      },
    },
    halo: {
      label: 'Orbital Vanguard',
      nodes: {
        mjolnir: {
          id: 'mjolnir',
          name: 'Vanguard Fit',
          cost: 1,
          desc: '+5 accuracy',
          bonus: { acc: 5 },
        },
        noble_team: {
          id: 'noble_team',
          name: 'Wolf Pack',
          cost: 2,
          requires: ['mjolnir'],
          desc: '+8% ranged damage',
          bonus: { rangedDmg: 0.08 },
        },
        spartan_rage: {
          id: 'spartan_rage',
          name: 'Vanguard Rage',
          cost: 2,
          requires: ['mjolnir'],
          desc: '+10% melee damage',
          bonus: { meleeDmg: 0.1 },
        },
        chief: {
          id: 'chief',
          name: 'Sentinel-7',
          cost: 3,
          requires: ['noble_team', 'spartan_rage'],
          desc: '+12 max HP, +2 morale',
          bonus: { flatHp: 12, maxMorale: 2 },
        },
      },
    },
    gears: {
      label: 'Iron Trench Coalition',
      nodes: {
        lancer_disc: {
          id: 'lancer_disc',
          name: 'Lancer Discipline',
          cost: 1,
          desc: '+6 accuracy',
          bonus: { acc: 6 },
        },
        chainsaw: {
          id: 'chainsaw',
          name: 'Chainsaw Finish',
          cost: 2,
          requires: ['lancer_disc'],
          desc: '+10% melee damage',
          bonus: { meleeDmg: 0.1 },
        },
        carmine_bond: {
          id: 'carmine_bond',
          name: 'Ironhelm Bond',
          cost: 2,
          requires: ['lancer_disc'],
          desc: '+8% siege damage',
          bonus: { siegeDmg: 0.08 },
        },
        last_jacinto: {
          id: 'last_jacinto',
          name: 'Last Bastion',
          cost: 3,
          requires: ['chainsaw', 'carmine_bond'],
          desc: '+10 max HP, +4 morale',
          bonus: { flatHp: 10, maxMorale: 4 },
        },
      },
    },
    lotr: {
      label: 'Ninefold March',
      nodes: {
        fellowship: {
          id: 'fellowship',
          name: 'Fellowship',
          cost: 1,
          desc: '+3 max morale',
          bonus: { maxMorale: 3 },
        },
        ranger_eye: {
          id: 'ranger_eye',
          name: 'Ranger Eye',
          cost: 2,
          requires: ['fellowship'],
          desc: '+8 accuracy',
          bonus: { acc: 8 },
        },
        dwarf_axe: {
          id: 'dwarf_axe',
          name: 'Dwarf Axe',
          cost: 2,
          requires: ['fellowship'],
          desc: '+9% melee damage',
          bonus: { meleeDmg: 0.09 },
        },
        king_returned: {
          id: 'king_returned',
          name: 'King Returned',
          cost: 3,
          requires: ['ranger_eye', 'dwarf_axe'],
          desc: '+10% ability damage',
          bonus: { abilityDmg: 0.1 },
        },
      },
    },
    baki: {
      label: 'Iron Pit Guild',
      nodes: {
        demon_back: {
          id: 'demon_back',
          name: 'Demon Back',
          cost: 1,
          desc: '+8% melee damage',
          bonus: { meleeDmg: 0.08 },
        },
        iron_body: {
          id: 'iron_body',
          name: 'Iron Body',
          cost: 2,
          requires: ['demon_back'],
          desc: '+14 max HP',
          bonus: { flatHp: 14 },
        },
        ogre_slayer: {
          id: 'ogre_slayer',
          name: 'Ogre Slayer',
          cost: 2,
          requires: ['demon_back'],
          desc: '+6 accuracy',
          bonus: { acc: 6 },
        },
        hanma_blood: {
          id: 'hanma_blood',
          name: 'Pit Blood',
          cost: 3,
          requires: ['iron_body', 'ogre_slayer'],
          desc: '+12% melee, +3 morale',
          bonus: { meleeDmg: 0.12, maxMorale: 3 },
        },
      },
    },
    jojo: {
      label: 'Bound Spirit Court',
      nodes: {
        stand_awaken: {
          id: 'stand_awaken',
          name: 'Spirit Awaken',
          cost: 1,
          desc: '+8% ability damage',
          bonus: { abilityDmg: 0.08 },
        },
        hamon: {
          id: 'hamon',
          name: 'Solar Breath',
          cost: 2,
          requires: ['stand_awaken'],
          desc: '+5 accuracy',
          bonus: { acc: 5 },
        },
        spin: {
          id: 'spin',
          name: 'Spin Technique',
          cost: 2,
          requires: ['stand_awaken'],
          desc: '+7% ranged damage',
          bonus: { rangedDmg: 0.07 },
        },
        made_in_heaven: {
          id: 'made_in_heaven',
          name: 'Made in Heaven',
          cost: 3,
          requires: ['hamon', 'spin'],
          desc: '+10% ability, +2 morale',
          bonus: { abilityDmg: 0.1, maxMorale: 2 },
        },
      },
    },
  };

  let purchased = {};
  let runPoints = {};
  let lastWaveGrant = {};

  function resetRun() {
    purchased = {};
    runPoints = {};
    lastWaveGrant = {};
    loadPersistent();
  }

  function loadPersistent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.purchased && typeof data.purchased === 'object') {
        purchased = data.purchased;
      }
    } catch (_) {
      /* ignore */
    }
  }

  function savePersistent() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ purchased }));
    } catch (_) {
      /* ignore */
    }
  }

  function getFactionForUnit(unit) {
    if (!unit) return null;
    if (unit.isWwe) return 'wwe';
    if (unit.isDoomslayer) return 'doom';
    if (typeof getCrossoverDef === 'function') {
      return getCrossoverDef(unit.type)?.faction || null;
    }
    return null;
  }

  function getMasteryTier(faction) {
    if (typeof FactionDepth !== 'undefined' && FactionDepth.getMasteryTier) {
      return FactionDepth.getMasteryTier(faction);
    }
    return 0;
  }

  function getTree(faction) {
    return FACTION_TREES[faction] || null;
  }

  function getPurchasedNodes(faction) {
    return purchased[faction] ? [...purchased[faction]] : [];
  }

  function getAvailablePoints(faction) {
    const earned = runPoints[faction] || 0;
    const spent = getPurchasedNodes(faction).reduce((sum, nid) => {
      const node = getTree(faction)?.nodes?.[nid];
      return sum + (node?.cost || 0);
    }, 0);
    const masteryBonus = getMasteryTier(faction);
    const budget = earned + masteryBonus;
    return Math.max(0, budget - spent);
  }

  function getTotalBudget(faction) {
    return (runPoints[faction] || 0) + getMasteryTier(faction);
  }

  function canPurchase(faction, nodeId) {
    const tree = getTree(faction);
    const node = tree?.nodes?.[nodeId];
    if (!node) return { ok: false, reason: 'Unknown node' };
    if (getPurchasedNodes(faction).includes(nodeId)) return { ok: false, reason: 'Already owned' };
    for (const req of node.requires || []) {
      if (!getPurchasedNodes(faction).includes(req)) {
        return { ok: false, reason: `Requires ${tree.nodes[req]?.name || req}` };
      }
    }
    if (getAvailablePoints(faction) < node.cost) {
      return { ok: false, reason: `Need ${node.cost} skill point(s)` };
    }
    return { ok: true };
  }

  function purchaseNode(faction, nodeId) {
    const check = canPurchase(faction, nodeId);
    if (!check.ok) return check;
    if (!purchased[faction]) purchased[faction] = [];
    purchased[faction].push(nodeId);
    savePersistent();
    return { ok: true, nodeId, faction };
  }

  function grantSkillPoint(faction, amount = 1) {
    if (!faction || !amount) return 0;
    runPoints[faction] = (runPoints[faction] || 0) + amount;
    return runPoints[faction];
  }

  function onRecruit(unit) {
    const faction = getFactionForUnit(unit);
    if (!faction || !FACTION_TREES[faction]) return null;
    const pts = grantSkillPoint(faction, 1);
    return { faction, points: pts };
  }

  function onWaveStart(wave, units) {
    const granted = [];
    for (const faction of Object.keys(FACTION_TREES)) {
      const onField = (units || []).some(
        (u) => u.team === 'player' && u.hp > 0 && getFactionForUnit(u) === faction
      );
      if (!onField) continue;
      if (wave >= 20 && wave % 20 === 0 && lastWaveGrant[faction] !== wave) {
        lastWaveGrant[faction] = wave;
        grantSkillPoint(faction, 1);
        granted.push(faction);
      }
    }
    return granted;
  }

  function aggregateBonuses(faction) {
    const agg = {
      acc: 0,
      maxMorale: 0,
      moraleRegen: 0,
      flatHp: 0,
      meleeDmg: 0,
      rangedDmg: 0,
      abilityDmg: 0,
      siegeDmg: 0,
      hpMult: 0,
      damageTakenMult: 1,
    };
    const tree = getTree(faction);
    if (!tree) return agg;
    for (const nid of getPurchasedNodes(faction)) {
      const b = tree.nodes[nid]?.bonus;
      if (!b) continue;
      if (b.acc) agg.acc += b.acc;
      if (b.maxMorale) agg.maxMorale += b.maxMorale;
      if (b.moraleRegen) agg.moraleRegen += b.moraleRegen;
      if (b.flatHp) agg.flatHp += b.flatHp;
      if (b.meleeDmg) agg.meleeDmg += b.meleeDmg;
      if (b.rangedDmg) agg.rangedDmg += b.rangedDmg;
      if (b.abilityDmg) agg.abilityDmg += b.abilityDmg;
      if (b.siegeDmg) agg.siegeDmg += b.siegeDmg;
      if (b.hpMult) agg.hpMult += b.hpMult;
      if (b.damageTakenMult) agg.damageTakenMult *= b.damageTakenMult;
    }
    return agg;
  }

  function applyToUnit(unit, armyUnits) {
    if (!unit || unit.team !== 'player') return unit;
    if (!unit.isCrossover && !unit.isWwe) return unit;
    const faction = getFactionForUnit(unit);
    if (!faction) return unit;

    const b = aggregateBonuses(faction);
    // Absolute combat fields — re-apply every night must not stack forever.
    unit.skillAcc = b.acc || 0;
    unit.skillMoraleRegen = b.moraleRegen || 0;
    unit.skillMelee = b.meleeDmg || 0;
    unit.skillRanged = b.rangedDmg || 0;
    unit.skillAbility = b.abilityDmg || 0;
    unit.skillSiege = b.siegeDmg || 0;
    unit.skillDamageTakenMult = b.damageTakenMult || 1;

    const nodes = getPurchasedNodes(faction);
    const sig = nodes.join(',');
    // HP/morale bonuses apply once per skill signature (purchase set).
    if (unit._opSkillSig !== sig) {
      if (unit._opSkillHpBonus) {
        unit.maxHp = Math.max(1, (unit.maxHp || 1) - unit._opSkillHpBonus);
        unit.hp = Math.min(unit.hp, unit.maxHp);
      }
      if (unit._opSkillMoraleBonus) {
        unit.maxMorale = Math.max(1, (unit.maxMorale || 1) - unit._opSkillMoraleBonus);
        unit.morale = Math.min(unit.morale, unit.maxMorale);
      }
      let hpBonus = b.flatHp || 0;
      if (b.hpMult) hpBonus += Math.round((unit.maxHp || 100) * b.hpMult);
      unit.maxHp = (unit.maxHp || 100) + hpBonus;
      unit.hp = Math.min(unit.maxHp, (unit.hp || 0) + hpBonus);
      unit._opSkillHpBonus = hpBonus;

      const mBonus = b.maxMorale || 0;
      unit.maxMorale = Math.min(50, (unit.maxMorale || 20) + mBonus);
      unit.morale = Math.min(unit.maxMorale, (unit.morale || 0) + Math.floor(mBonus / 2));
      unit._opSkillMoraleBonus = mBonus;
      unit._opSkillSig = sig;
    }

    if (nodes.length) unit.operativeSkillNodes = nodes.length;
    return unit;
  }

  function modifyDamage(unit, target, dmg) {
    if (!unit || dmg <= 0) return dmg;
    let d = dmg;
    if (unit.skillMelee && !unit.projectile && unit.combatType !== 'ranged') {
      d = Math.round(d * (1 + unit.skillMelee));
    }
    if (unit.skillRanged && (unit.projectile || unit.combatType === 'ranged')) {
      d = Math.round(d * (1 + unit.skillRanged));
    }
    if (unit.skillAbility && unit.abilityId) {
      d = Math.round(d * (1 + unit.skillAbility));
    }
    if (unit.skillSiege && target?.isBuilding) {
      d = Math.round(d * (1 + unit.skillSiege));
    }
    return d;
  }

  function modifyDamageTaken(unit, dmg) {
    if (!unit?.skillDamageTakenMult || dmg <= 0) return dmg;
    return Math.round(dmg * unit.skillDamageTakenMult);
  }

  function getSnapshot(wave, units) {
    const factions = [];
    for (const [fid, tree] of Object.entries(FACTION_TREES)) {
      const nodes = getPurchasedNodes(fid);
      const onField = (units || []).filter(
        (u) => u.team === 'player' && u.hp > 0 && getFactionForUnit(u) === fid
      ).length;
      if (!nodes.length && !onField && !(runPoints[fid] || 0)) continue;
      factions.push({
        factionId: fid,
        label: tree.label,
        purchased: nodes,
        availablePoints: getAvailablePoints(fid),
        totalBudget: getTotalBudget(fid),
        onField,
        nodes: Object.values(tree.nodes).map((n) => ({
          ...n,
          owned: nodes.includes(n.id),
          canBuy: canPurchase(fid, n.id).ok,
        })),
      });
    }
    const summary = factions
      .filter((f) => f.purchased.length)
      .map((f) => `${f.label.split(' ')[0]} ${f.purchased.length}★`)
      .join(' · ');
    return {
      active: factions.some((f) => f.purchased.length || f.onField),
      factions,
      summary: summary || null,
      treeCount: Object.keys(FACTION_TREES).length,
    };
  }

  return {
    FACTION_TREES,
    STORAGE_KEY,
    resetRun,
    getTree,
    getFactionForUnit,
    getPurchasedNodes,
    getAvailablePoints,
    canPurchase,
    purchaseNode,
    grantSkillPoint,
    onRecruit,
    onWaveStart,
    applyToUnit,
    modifyDamage,
    modifyDamageTaken,
    getSnapshot,
    aggregateBonuses,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.OperativeSkillTrees = OperativeSkillTrees;
