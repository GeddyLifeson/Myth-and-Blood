/**
 * Unit formation layouts for multi-select move and reform commands.
 */
const Formations = (() => {
  const FORMATIONS = {
    box: {
      id: 'box',
      label: 'Box',
      short: 'Bx',
      desc: 'Compact 3-wide grid',
      cols: 3,
      spacing: { x: 14, y: 12 },
    },
    line: {
      id: 'line',
      label: 'Line',
      short: 'Ln',
      desc: 'Horizontal firing line',
      spacing: { x: 20, y: 0 },
    },
    column: {
      id: 'column',
      label: 'Column',
      short: 'Col',
      desc: 'Single-file march column',
      spacing: { x: 0, y: 18 },
    },
    wedge: {
      id: 'wedge',
      label: 'Wedge',
      short: 'Wg',
      desc: 'Spearhead pointing north',
      spacing: { x: 18, y: 15 },
    },
    spread: {
      id: 'spread',
      label: 'Spread',
      short: 'Sp',
      desc: 'Wide loose formation',
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

  return {
    FORMATIONS,
    ORDER,
    getFormation,
    getLabel,
    computeOffsets,
    sortUnitsForFormation,
    nextFormationId,
  };
})();