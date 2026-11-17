/**
 * Company training: a small tree of nodes for the champions and for each free company,
 * bought with skill points earned during a run. Purchases and points both last one run.
 * The two second-tier nodes of a tree are an either/or pick; the capstone needs either.
 * Tree keys and node ids are save-file ids.
 */
const CompanyTraining = (() => {
  // Old builds kept purchases here forever while points reset; cleared on every run start.
  const LEGACY_STORAGE_KEY = 'myth-and-blood-operative-skills-v1';

  /** Names come from the cast data (js/free-companies.js) so the trees can never drift from it. */
  function treeLabel(fid) {
    return typeof HeroCast !== 'undefined' ? HeroCast.factionLabel(fid) : 'Free company';
  }
  function treeShort(fid) {
    return typeof HeroCast !== 'undefined' ? HeroCast.factionShort(fid) : 'Company';
  }

  const FACTION_TREES = {
    champions: {
      get label() {
        return treeLabel('champions');
      },
      nodes: {
        play_to_the_crowd: {
          id: 'play_to_the_crowd',
          name: 'Play to the Crowd',
          cost: 1,
          desc: '+3 max morale',
          bonus: { maxMorale: 3 },
        },
        second_wind: {
          id: 'second_wind',
          name: 'Second Wind',
          cost: 2,
          requires: ['play_to_the_crowd'],
          desc: '+8% melee damage',
          bonus: { meleeDmg: 0.08 },
        },
        finishing_blow: {
          id: 'finishing_blow',
          name: 'Finishing Blow',
          cost: 2,
          requires: ['play_to_the_crowd'],
          desc: '+10% ability damage',
          bonus: { abilityDmg: 0.1 },
        },
        fight_in_pairs: {
          id: 'fight_in_pairs',
          name: 'Fight in Pairs',
          cost: 3,
          requires: ['second_wind', 'finishing_blow'],
          desc: '+2 morale regen, +5 accuracy',
          bonus: { moraleRegen: 2, acc: 5 },
        },
      },
    },
    powderhorn: {
      get label() {
        return treeLabel('powderhorn');
      },
      nodes: {
        fuse_drill: {
          id: 'fuse_drill',
          name: 'Fuse Drill',
          cost: 1,
          desc: '+6 accuracy',
          bonus: { acc: 6 },
        },
        barrel_banded: {
          id: 'barrel_banded',
          name: 'Barrel-Banded',
          cost: 2,
          requires: ['fuse_drill'],
          desc: '+12% max HP',
          bonus: { hpMult: 0.12 },
        },
        forked_storm: {
          id: 'forked_storm',
          name: 'Forked Storm',
          cost: 2,
          requires: ['fuse_drill'],
          desc: '+10% ability damage',
          bonus: { abilityDmg: 0.1 },
        },
        master_of_the_horn: {
          id: 'master_of_the_horn',
          name: 'Master of the Horn',
          cost: 3,
          requires: ['barrel_banded', 'forked_storm'],
          desc: '+8% melee, +4 morale',
          bonus: { meleeDmg: 0.08, maxMorale: 4 },
        },
      },
    },
    pale_vigil: {
      get label() {
        return treeLabel('pale_vigil');
      },
      nodes: {
        barrow_ward: {
          id: 'barrow_ward',
          name: 'Barrow Ward',
          cost: 1,
          desc: '+10% damage reduction aura',
          bonus: { damageTakenMult: 0.9 },
        },
        sealed_door: {
          id: 'sealed_door',
          name: 'Sealed Door',
          cost: 2,
          requires: ['barrow_ward'],
          desc: '+15 max HP',
          bonus: { flatHp: 15 },
        },
        candle_and_lancet: {
          id: 'candle_and_lancet',
          name: 'Candle and Lancet',
          cost: 2,
          requires: ['barrow_ward'],
          desc: '+12% ability damage',
          bonus: { abilityDmg: 0.12 },
        },
        last_door: {
          id: 'last_door',
          name: 'Last Door',
          cost: 3,
          requires: ['sealed_door', 'candle_and_lancet'],
          desc: '+7 accuracy, +3 morale',
          bonus: { acc: 7, maxMorale: 3 },
        },
      },
    },
    greywatch: {
      get label() {
        return treeLabel('greywatch');
      },
      nodes: {
        citadel_drill: {
          id: 'citadel_drill',
          name: 'Citadel Drill',
          cost: 1,
          desc: '+5 accuracy',
          bonus: { acc: 5 },
        },
        volley_line: {
          id: 'volley_line',
          name: 'Volley Line',
          cost: 2,
          requires: ['citadel_drill'],
          desc: '+8% ranged damage',
          bonus: { rangedDmg: 0.08 },
        },
        wall_clearing: {
          id: 'wall_clearing',
          name: 'Wall-Clearing',
          cost: 2,
          requires: ['citadel_drill'],
          desc: '+10% melee damage',
          bonus: { meleeDmg: 0.1 },
        },
        warden_captain: {
          id: 'warden_captain',
          name: 'Warden-Captain',
          cost: 3,
          requires: ['volley_line', 'wall_clearing'],
          desc: '+12 max HP, +2 morale',
          bonus: { flatHp: 12, maxMorale: 2 },
        },
      },
    },
    sawtooth: {
      get label() {
        return treeLabel('sawtooth');
      },
      nodes: {
        crossbow_drill: {
          id: 'crossbow_drill',
          name: 'Crossbow Drill',
          cost: 1,
          desc: '+6 accuracy',
          bonus: { acc: 6 },
        },
        saw_edge: {
          id: 'saw_edge',
          name: 'Saw-Edge',
          cost: 2,
          requires: ['crossbow_drill'],
          desc: '+10% melee damage',
          bonus: { meleeDmg: 0.1 },
        },
        engine_breaking: {
          id: 'engine_breaking',
          name: 'Engine-Breaking',
          cost: 2,
          requires: ['crossbow_drill'],
          desc: '+8% siege damage',
          bonus: { siegeDmg: 0.08 },
        },
        last_in_the_ditch: {
          id: 'last_in_the_ditch',
          name: 'Last in the Ditch',
          cost: 3,
          requires: ['saw_edge', 'engine_breaking'],
          desc: '+10 max HP, +4 morale',
          bonus: { flatHp: 10, maxMorale: 4 },
        },
      },
    },
    thornroad: {
      get label() {
        return treeLabel('thornroad');
      },
      nodes: {
        road_sworn: {
          id: 'road_sworn',
          name: 'Road-Sworn',
          cost: 1,
          desc: '+3 max morale',
          bonus: { maxMorale: 3 },
        },
        fowlers_eye: {
          id: 'fowlers_eye',
          name: 'Fowler’s Eye',
          cost: 2,
          requires: ['road_sworn'],
          desc: '+8 accuracy',
          bonus: { acc: 8 },
        },
        quarry_axe: {
          id: 'quarry_axe',
          name: 'Quarry Axe',
          cost: 2,
          requires: ['road_sworn'],
          desc: '+9% melee damage',
          bonus: { meleeDmg: 0.09 },
        },
        shrines_avenged: {
          id: 'shrines_avenged',
          name: 'Shrines Avenged',
          cost: 3,
          requires: ['fowlers_eye', 'quarry_axe'],
          desc: '+10% ability damage',
          bonus: { abilityDmg: 0.1 },
        },
      },
    },
    knucklebone: {
      get label() {
        return treeLabel('knucklebone');
      },
      nodes: {
        blooded: {
          id: 'blooded',
          name: 'Blooded',
          cost: 1,
          desc: '+8% melee damage',
          bonus: { meleeDmg: 0.08 },
        },
        anvil_flesh: {
          id: 'anvil_flesh',
          name: 'Anvil Flesh',
          cost: 2,
          requires: ['blooded'],
          desc: '+14 max HP',
          bonus: { flatHp: 14 },
        },
        one_blow_taught: {
          id: 'one_blow_taught',
          name: 'One Blow Taught',
          cost: 2,
          requires: ['blooded'],
          desc: '+6 accuracy',
          bonus: { acc: 6 },
        },
        knucklebones_won: {
          id: 'knucklebones_won',
          name: 'Knucklebones Won',
          cost: 3,
          requires: ['anvil_flesh', 'one_blow_taught'],
          desc: '+12% melee, +3 morale',
          bonus: { meleeDmg: 0.12, maxMorale: 3 },
        },
      },
    },
    marrow_choir: {
      get label() {
        return treeLabel('marrow_choir');
      },
      nodes: {
        first_verse: {
          id: 'first_verse',
          name: 'First Verse',
          cost: 1,
          desc: '+8% ability damage',
          bonus: { abilityDmg: 0.08 },
        },
        dawn_office: {
          id: 'dawn_office',
          name: 'Dawn Office',
          cost: 2,
          requires: ['first_verse'],
          desc: '+5 accuracy',
          bonus: { acc: 5 },
        },
        whistling_stones: {
          id: 'whistling_stones',
          name: 'Whistling Stones',
          cost: 2,
          requires: ['first_verse'],
          desc: '+7% ranged damage',
          bonus: { rangedDmg: 0.07 },
        },
        full_choir: {
          id: 'full_choir',
          name: 'Full Choir',
          cost: 3,
          requires: ['dawn_office', 'whistling_stones'],
          desc: '+10% ability, +2 morale',
          bonus: { abilityDmg: 0.1, maxMorale: 2 },
        },
      },
    },
  };

  /** Companies without a tree of their own share this one. */
  const DRILL_YARD_NODES = {
    drilled: {
      id: 'drilled',
      name: 'Drilled',
      cost: 1,
      desc: '+5 accuracy',
      bonus: { acc: 5 },
    },
    shield_wall: {
      id: 'shield_wall',
      name: 'Shield Wall',
      cost: 2,
      requires: ['drilled'],
      desc: '+15 max HP',
      bonus: { flatHp: 15 },
    },
    blood_price: {
      id: 'blood_price',
      name: 'Blood Price',
      cost: 2,
      requires: ['drilled'],
      desc: '+10% melee damage',
      bonus: { meleeDmg: 0.1 },
    },
    old_hands: {
      id: 'old_hands',
      name: 'Old Hands',
      cost: 3,
      requires: ['shield_wall', 'blood_price'],
      desc: '+8% ability, +3 morale',
      bonus: { abilityDmg: 0.08, maxMorale: 3 },
    },
  };
  const drillYards = {};

  let purchased = {};
  let runPoints = {};
  let lastWaveGrant = {};

  function resetRun() {
    purchased = {};
    runPoints = {};
    lastWaveGrant = {};
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {
      /* storage blocked: nothing was kept there either */
    }
  }

  function treeIds() {
    const companies = typeof FreeCompanies !== 'undefined' ? Object.keys(FreeCompanies) : [];
    return [...new Set([...Object.keys(FACTION_TREES), ...companies])];
  }

  function getFactionForUnit(unit) {
    if (!unit) return null;
    if (unit.isWwe) return 'champions';
    if (unit.isDoomslayer) return 'doom';
    if (typeof getHeroDef === 'function') {
      return getHeroDef(unit.type)?.faction || null;
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
    if (FACTION_TREES[faction]) return FACTION_TREES[faction];
    if (typeof FreeCompanies === 'undefined' || !FreeCompanies[faction]) return null;
    drillYards[faction] ||= { label: treeLabel(faction), nodes: DRILL_YARD_NODES };
    return drillYards[faction];
  }

  /** The other node that shares this node's parent: owning one closes the other. */
  function rivalOf(tree, node) {
    const parent = (node.requires || []).join(',');
    if (!parent || node.requires.length > 1) return null;
    return (
      Object.values(tree.nodes).find(
        (n) => n.id !== node.id && (n.requires || []).join(',') === parent
      ) || null
    );
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
    const owned = getPurchasedNodes(faction);
    const reqs = node.requires || [];
    if (reqs.length && !reqs.some((r) => owned.includes(r))) {
      const names = reqs.map((r) => tree.nodes[r]?.name || 'an earlier node').join(' or ');
      return { ok: false, reason: `Requires ${names}` };
    }
    const rival = rivalOf(tree, node);
    if (rival && owned.includes(rival.id)) {
      return { ok: false, reason: `Took ${rival.name} instead` };
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
    return { ok: true, nodeId, faction };
  }

  function grantSkillPoint(faction, amount = 1) {
    if (!faction || !amount) return 0;
    runPoints[faction] = (runPoints[faction] || 0) + amount;
    return runPoints[faction];
  }

  function onRecruit(unit) {
    const faction = getFactionForUnit(unit);
    if (!faction || !getTree(faction)) return null;
    const pts = grantSkillPoint(faction, 1);
    return { faction, points: pts };
  }

  function onWaveStart(wave, units) {
    const granted = [];
    for (const faction of treeIds()) {
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
    for (const fid of treeIds()) {
      const tree = getTree(fid);
      const nodes = getPurchasedNodes(fid);
      const onField = (units || []).filter(
        (u) => u.team === 'player' && u.hp > 0 && getFactionForUnit(u) === fid
      ).length;
      if (!nodes.length && !onField && !runPoints[fid]) continue;
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
      .map((f) => `${treeShort(f.factionId)} ${f.purchased.length}★`)
      .join(' · ');
    return {
      active: factions.some((f) => f.purchased.length || f.onField),
      factions,
      summary: summary || null,
      treeCount: treeIds().length,
    };
  }

  /**
   * Skill-tree shop, drawn into every `.hero-skills-panel` host (the Free Companies and
   * Champions' Hall screens). A tree appears once its company has heroes, points or nodes.
   */
  function renderPanel() {
    const hosts = document.querySelectorAll('.hero-skills-panel');
    if (!hosts.length) return;
    const gs = typeof Game !== 'undefined' ? Game.getState?.() : null;
    const snap = getSnapshot(gs?.wave || 0, gs?.units || []);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const html = snap.factions.length
      ? snap.factions
          .map(
            (f) => `
        <div class="skill-tree">
          <div class="skill-tree-head">
            <span class="skill-tree-name">${esc(f.label)}</span>
            <span class="skill-tree-points">${f.availablePoints} of ${f.totalBudget} point(s) free</span>
          </div>
          <div class="skill-tree-nodes">
            ${f.nodes
              .map((n) => {
                const state = n.owned ? 'owned' : n.canBuy ? 'buyable' : 'locked';
                const why = n.owned
                  ? 'Owned'
                  : n.canBuy
                    ? `Buy for ${n.cost}`
                    : canPurchase(f.factionId, n.id).reason;
                return `<button type="button" class="skill-node skill-node-${state}"
                  data-skill-faction="${esc(f.factionId)}" data-skill-node="${esc(n.id)}"
                  ${n.owned || !n.canBuy ? 'disabled' : ''} title="${esc(why)}">
                  <span class="skill-node-name">${esc(n.name)}</span>
                  <span class="skill-node-desc">${esc(n.desc)}</span>
                  <span class="skill-node-cost">${n.owned ? '✓ owned' : n.canBuy ? `${n.cost} pt` : `${n.cost} pt · ${esc(why)}`}</span>
                </button>`;
              })
              .join('')}
          </div>
        </div>`
          )
          .join('')
      : '<p class="panel-hint">Hire a hero to open that company’s training. Points come from hires, waves survived and company mastery.</p>';
    hosts.forEach((host) => {
      host.innerHTML = `<div class="skill-tree-title">COMPANY TRAINING</div><p class="panel-hint">Training lasts this run. The two middle nodes of a tree are either/or.</p>${html}`;
      if (host.dataset.skillBound) return;
      host.dataset.skillBound = '1';
      host.addEventListener('click', (e) => {
        const btn = e.target.closest?.('[data-skill-node]');
        if (!btn || btn.disabled) return;
        const res = purchaseNode(btn.dataset.skillFaction, btn.dataset.skillNode);
        if (res.ok && typeof AudioEngine !== 'undefined') AudioEngine.SFX?.click?.();
        renderPanel();
      });
    });
  }

  // Run state in saves: see js/save-registry.js.
  if (typeof SaveRegistry !== 'undefined') {
    SaveRegistry.register('OperativeSkillTrees', {
      version: 2,
      save: () => ({ runPoints, lastWaveGrant, purchased }),
      // v1 saved points only; its purchases lived in localStorage and are not carried over.
      migrate: (data) => ({ ...data, purchased: {} }),
      load(data) {
        resetRun();
        if (!data) return;
        if (data.purchased && typeof data.purchased === 'object') purchased = data.purchased;
        if (data.runPoints && typeof data.runPoints === 'object') runPoints = data.runPoints;
        if (data.lastWaveGrant && typeof data.lastWaveGrant === 'object')
          lastWaveGrant = data.lastWaveGrant;
      },
    });
  }

  return {
    FACTION_TREES,
    renderPanel,
    resetRun,
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
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.CompanyTraining = CompanyTraining;
