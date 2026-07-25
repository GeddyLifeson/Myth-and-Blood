/**
 * Quick-save and slot thumbnails — canvas capture with minimap fallback.
 */
const SaveThumbnail = (() => {
  const MAX_W = 240;
  const MINIMAP_H = 136;
  const JPEG_Q = 0.52;

  function captureFromCanvas(sourceCanvas) {
    if (!sourceCanvas?.width || !sourceCanvas?.height) return null;
    const ratio = sourceCanvas.height / sourceCanvas.width;
    const w = Math.min(MAX_W, sourceCanvas.width);
    const h = Math.max(1, Math.round(w * ratio));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(sourceCanvas, 0, 0, w, h);
    try {
      return off.toDataURL('image/jpeg', JPEG_Q);
    } catch (_) {
      return null;
    }
  }

  function drawMinimapFrame(ctx, w, h, data) {
    ctx.fillStyle = 'rgba(12,10,8,0.96)';
    ctx.fillRect(0, 0, w, h);
    const sx = w / data.worldW;
    const sy = h / data.worldH;

    ctx.strokeStyle = 'rgba(90,72,48,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const lp = data.livingPlanet;
    if (lp?.bands?.length) {
      for (const band of lp.bands) {
        if (band.x0 != null) {
          ctx.fillStyle = band.tint || 'rgba(60,80,50,0.25)';
          ctx.fillRect(
            band.x0 * sx,
            band.y0 * sy,
            (band.x1 - band.x0) * sx,
            (band.y1 - band.y0) * sy
          );
        } else if (band.y1 > band.y0) {
          ctx.fillStyle = band.tint || 'rgba(60,80,50,0.25)';
          ctx.fillRect(0, band.y0 * sy, w, (band.y1 - band.y0) * sy);
        }
      }
    }

    const pw = data.planetWarfare;
    if (pw?.active && pw.hostileLineY) {
      const ly = pw.hostileLineY * sy;
      const grad = ctx.createLinearGradient(0, 0, 0, ly + 4);
      grad.addColorStop(0, `rgba(140, 30, 40, ${0.35 + (pw.hostileControl || 0) * 0.3})`);
      grad.addColorStop(1, 'rgba(60, 20, 28, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, ly + 2);
      ctx.strokeStyle = 'rgba(255, 80, 70, 0.65)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w, ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (typeof VisualPolish !== 'undefined') {
      VisualPolish.drawMinimapOverlay(ctx, w, h, data, 'bands');
    }

    for (const b of data.buildings || []) {
      ctx.fillStyle = b.owner === 'enemy' ? '#804040' : b.isSettlement ? '#a08040' : '#506050';
      ctx.fillRect(b.x * sx - 1, b.y * sy - 1, 3, 3);
    }
    for (const u of data.units || []) {
      ctx.fillStyle =
        u.team === 'player' ? '#60a0ff' : u.team === 'neutral' ? '#c0a040' : '#ff5050';
      ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
    }

    if (typeof VisualPolish !== 'undefined') {
      VisualPolish.drawMinimapOverlay(ctx, w, h, data, 'overlay');
    }

    if (data.viewW && data.viewH) {
      ctx.strokeStyle = 'rgba(240,200,100,0.85)';
      ctx.strokeRect(data.viewX * sx, data.viewY * sy, data.viewW * sx, data.viewH * sy);
    }

    ctx.font = 'bold 9px Cinzel, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(240,210,140,0.92)';
    const phase = data.phase === 'night' ? 'Night' : 'Day';
    ctx.fillText(`W${data.wave ?? '?'} · ${phase}`, 6, h - 5);
  }

  function captureFromMinimapData(data) {
    if (!data?.worldW || !data?.worldH) return null;
    const off = document.createElement('canvas');
    off.width = MAX_W;
    off.height = MINIMAP_H;
    const ctx = off.getContext('2d');
    if (!ctx) return null;
    drawMinimapFrame(ctx, MAX_W, MINIMAP_H, data);
    try {
      return off.toDataURL('image/jpeg', JPEG_Q);
    } catch (_) {
      return null;
    }
  }

  function capture(opts = {}) {
    const canvas = opts.canvas || document.getElementById('game-canvas');
    const fromCanvas = captureFromCanvas(canvas);
    if (fromCanvas) return fromCanvas;
    if (opts.minimapData) return captureFromMinimapData(opts.minimapData);
    if (typeof Game !== 'undefined' && Game.getMinimapData) {
      return captureFromMinimapData(Game.getMinimapData());
    }
    return null;
  }

  function formatSavedAt(ts) {
    if (!ts) return 'Unknown time';
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (_) {
      return 'Unknown time';
    }
  }

  function buildMetaLines(meta) {
    if (!meta) return [];
    const lines = [];
    if (meta.wave != null) lines.push(`Wave ${meta.wave}`);
    if (meta.tactical != null) lines.push(`${Math.floor(meta.tactical)} TP`);
    if (meta.army != null) lines.push(`${meta.army} troops`);
    if (meta.timeOfDay) lines.push(meta.timeOfDay === 'night' ? 'Night prep' : 'Day assault');
    if (meta.savedAt) lines.push(formatSavedAt(meta.savedAt));
    return lines;
  }

  function renderQuickSavePanel(host, meta) {
    if (!host) return;
    const thumb = host.querySelector('#pause-quicksave-thumb');
    const placeholder = host.querySelector('#pause-quicksave-placeholder');
    const metaEl = host.querySelector('#pause-quicksave-meta');
    const empty = !meta;

    host.classList.toggle('empty', empty);
    if (thumb) {
      if (meta?.thumbnail) {
        thumb.src = meta.thumbnail;
        thumb.hidden = false;
      } else {
        thumb.removeAttribute('src');
        thumb.hidden = true;
      }
    }
    if (placeholder) {
      placeholder.textContent = empty ? 'No quick save yet' : meta.thumbnail ? '' : 'Saved (no preview)';
      placeholder.hidden = !!(meta?.thumbnail);
    }
    if (metaEl) {
      if (empty) {
        metaEl.textContent = 'Press Quick Save to store a snapshot with battlefield preview.';
      } else {
        const lines = buildMetaLines(meta);
        metaEl.textContent = lines.join(' · ');
      }
    }
  }

  return {
    MAX_W,
    MINIMAP_H,
    capture,
    captureFromCanvas,
    captureFromMinimapData,
    drawMinimapFrame,
    formatSavedAt,
    buildMetaLines,
    renderQuickSavePanel,
  };
})();