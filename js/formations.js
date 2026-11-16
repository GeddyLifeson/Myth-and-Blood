/**
 * Unit formation layouts for multi-select move and reform commands.
 */
const Formations = (() => {
  const FORMATIONS = {
    box: {
      id: 'box',
      label: 'Box',
      short: 'Bx',
      desc: 'Compact 3-wide grid. Soldiers in it take 12% less damage.',
      fx: { taken: 0.88 },
      cols: 3,
      spacing: { x: 14, y: 12 },
    },
    line: {
      id: 'line',
      label: 'Line',
      short: 'Ln',
      desc: 'Horizontal firing line. Shooters in it aim 8 points better.',
      fx: { aim: 8 },
      spacing: { x: 20, y: 0 },
    },
    column: {
      id: 'column',
      label: 'Column',
      short: 'Col',
      desc: 'Single-file march column. Soldiers in it chase 30% further from their posts.',
      fx: { leash: 1.3 },
      spacing: { x: 0, y: 18 },
    },
    wedge: {
      id: 'wedge',
      label: 'Wedge',
      short: 'Wg',
      desc: 'Spearhead pointing north. Melee hits 15% harder, and they take 10% more damage.',
      fx: { melee: 1.15, taken: 1.1 },
      spacing: { x: 18, y: 15 },
    },
    spread: {
      id: 'spread',
      label: 'Spread',
      short: 'Sp',
      desc: 'Wide loose formation. Blasts and splash do half damage to them.',
      fx: { splashTaken: 0.5 },
      cols: 4,
      spacing: { x: 28, y: 22 },
    },
  };

  const ORDER = ['line', 'column', 'wedge', 'box', 'spread'];

  function getFormation(id) {
    return FORMATIONS[id] || FORMATIONS.box;
  }

  function getLabel(id) {
    return getFormation(id).label;
  }

  function computeOffsets(count, formationId = 'box') {
    const n = Math.max(0, count | 0);
    if (!n) return [];
    const f = getFormation(formationId);
    const offsets = [];

    if (formationId === 'wedge') {
      let placed = 0;
      let row = 0;
      while (placed < n) {
        const inRow = row + 1;
        const rowY = row * f.spacing.y;
        const rowW = (inRow - 1) * f.spacing.x;
        for (let c = 0; c < inRow && placed < n; c++, placed++) {
          offsets.push({
            x: -rowW / 2 + c * f.spacing.x,
            y: rowY,
          });
        }
        row++;
      }
      return offsets;
    }

    if (formationId === 'line') {
      const totalW = (n - 1) * f.spacing.x;
      for (let i = 0; i < n; i++) {
        offsets.push({ x: -totalW / 2 + i * f.spacing.x, y: 0 });
      }
      return offsets;
    }

    if (formationId === 'column') {
      const totalH = (n - 1) * f.spacing.y;
      for (let i = 0; i < n; i++) {
        offsets.push({ x: 0, y: -totalH / 2 + i * f.spacing.y });
      }
      return offsets;
    }

    const cols = f.cols || 3;
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rowStart = row * cols;
      const rowCount = Math.min(cols, n - rowStart);
      const rowW = (rowCount - 1) * f.spacing.x;
      offsets.push({
        x: -rowW / 2 + col * f.spacing.x,
        y: row * f.spacing.y,
      });
    }
    return offsets;
  }

  function sortUnitsForFormation(units) {
    return [...units].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  }

  function nextFormationId(currentId) {
    const idx = ORDER.indexOf(currentId);
    const next = idx < 0 ? 0 : (idx + 1) % ORDER.length;
    return ORDER[next];
  }

  const NO_FX = {};

  function fxOf(unit) {
    return (unit && unit.formation && FORMATIONS[unit.formation]?.fx) || NO_FX;
  }

  /**
   * Put soldiers under a formation order, or lift it (a lone soldier has no formation).
   * ponytail: the order stays on a survivor after his comrades die; count the members
   * if that ever matters.
   */
  function assign(units, formationId) {
    const id = units.length >= 2 && FORMATIONS[formationId] ? formationId : null;
    for (const u of units) u.formation = u.team === 'player' ? id : null;
  }

  /** Why a formation cannot be ordered right now, or '' if it can. */
  function blockedReason(selectedCount) {
    return selectedCount >= 2 ? '' : 'Select two or more soldiers to order a formation.';
  }

  function dealtMult(unit) {
    const fx = fxOf(unit);
    return fx.melee && unit.combatType !== 'ranged' && !unit.projectile ? fx.melee : 1;
  }

  function takenMult(unit, opts) {
    const fx = fxOf(unit);
    const blast = opts && (opts.splash || opts.explosion);
    return (fx.taken || 1) * (blast && fx.splashTaken ? fx.splashTaken : 1);
  }

  function aimBonus(unit) {
    const fx = fxOf(unit);
    return fx.aim && unit.combatType === 'ranged' ? fx.aim : 0;
  }

  function leashMult(unit) {
    return fxOf(unit).leash || 1;
  }

  return {
    FORMATIONS,
    aimBonus,
    assign,
    blockedReason,
    dealtMult,
    fxOf,
    leashMult,
    takenMult,
    getFormation,
    getLabel,
    computeOffsets,
    sortUnitsForFormation,
    nextFormationId,
  };
})();
