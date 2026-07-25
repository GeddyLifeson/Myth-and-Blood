/**
 * Visual polish — atmosphere, territory, fronts, faction accents, accessibility cues, death FX.
 */
const VisualPolish = (() => {
  const BASE_W = 400;
  const BASE_H = 600;

  const FACTION_ACCENT = {
    wwe: { ring: '#ffd700', pattern: 'star' },
    doom: { ring: '#40ff40', pattern: 'pulse' },
    ultimis: { ring: '#c06030', pattern: 'zigzag' },
    primis: { ring: '#d07040', pattern: 'zigzag' },
    halo: { ring: '#80c0ff', pattern: 'shield' },
    gears: { ring: '#c04040', pattern: 'gear' },
    lotr: { ring: '#c0a040', pattern: 'leaf' },
    baki: { ring: '#c04040', pattern: 'fist' },
    jojo: { ring: '#e0c040', pattern: 'ora' },
    fotns: { ring: '#4080c0', pattern: 'fist' },
    dragonball: { ring: '#e06040', pattern: 'ki' },
  };

  let deathCorpses = [];
  let titleTick = 0;
  let weather = { type: 'clear', seed: Math.random() * 1000 };
  let screenShake = { mag: 0, decay: 0.86, trauma: 0 };
  let killPunch = 0;

  function getEraId(wave) {
    if (wave >= 1001) return 'hellscape';
    if (wave >= 200) return 'rts';
    if (wave >= 100) return 'academy';
    if (wave >= 40) return 'siege';
    if (wave >= 15) return 'mid';
    return 'early';
  }

  function getHordeIntensity(hordeWave) {
    if (!hordeWave) return 0;
    return Math.max(0, Math.min(1, hordeWave.intensity ?? 0.5));
  }

  function drawHordeIntensity(ctx, worldW, mapH, hordeWave, tick) {
    if (!hordeWave) return;
    const intensity = getHordeIntensity(hordeWave);
    const pulse = 0.55 + Math.sin(tick * (0.07 + intensity * 0.04)) * 0.28 * intensity;
    const alpha = (0.07 + intensity * 0.15) * pulse;

    const grad = ctx.createLinearGradient(0, 0, 0, mapH * 0.42);
    grad.addColorStop(0, `rgba(255,72,36,${alpha})`);
    grad.addColorStop(0.35, `rgba(200,48,24,${alpha * 0.4})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, worldW, mapH * 0.42);

    ctx.fillStyle = `rgba(100,18,8,${alpha * 0.3})`;
    ctx.fillRect(0, 0, 24, mapH);
    ctx.fillRect(worldW - 24, 0, 24, mapH);

    const barW = 72 + intensity * 48;
    const barH = 4;
    const bx = (worldW - barW) / 2;
    const by = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = intensity >= 0.72 ? '#ff3838' : intensity >= 0.48 ? '#ff7030' : '#ffb050';
    ctx.fillRect(bx, by, barW * intensity * pulse, barH);

    ctx.font = 'bold 8px Cinzel';
    ctx.fillStyle = `rgba(255,176,96,${0.65 + pulse * 0.35})`;
    ctx.textAlign = 'center';
    const tier = intensity >= 0.72 ? 'CRITICAL' : intensity >= 0.48 ? 'HEAVY' : 'SWARM';
    const label = hordeWave.hasSiege ? `HORDE · SIEGE · ${tier}` : `HORDE · ${tier}`;
    ctx.fillText(label, worldW / 2, by + barH + 11);
  }

  function computeBattleIntensity(ctx) {
    let enemies = 0;
    let players = 0;
    let queue = 0;
    let proj = 0;
    if (Array.isArray(ctx)) {
      const units = ctx;
      const spawnQueue = arguments[1];
      const projectiles = arguments[2];
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.hp <= 0) continue;
        if (u.team === 'enemy') enemies++;
        else if (u.team === 'player') players++;
      }
      queue = spawnQueue?.length || 0;
      proj = projectiles?.length || 0;
    } else if (ctx) {
      enemies = ctx.enemyCount ?? 0;
      players = ctx.playerCount ?? 0;
      queue = ctx.spawnQueueLen ?? 0;
      proj = ctx.projectileCount ?? 0;
    }
    const raw = enemies * 0.04 + queue * 0.02 + proj * 0.08 + Math.min(players, 20) * 0.01;
    return Math.max(0, Math.min(1, raw));
  }

  function pickWeather(wave, tick) {
    if (wave >= 1001) return { type: 'ash', intensity: 0.35 };
    if (wave >= 200) return { type: 'mist', intensity: 0.2 };
    if (tick % 2400 < 400) return { type: 'rain', intensity: 0.25 };
    return { type: 'clear', intensity: 0 };
  }

  function addScreenShake(magnitude = 6) {
    if (typeof GameFeedback !== 'undefined' && GameFeedback.allowShake?.() === false) return;
    if (typeof Settings !== 'undefined' && Settings.get('reducedMotion')) return;
    // Trauma model: stacks with soft cap for big moments without endless rumble
    const m = Math.max(0, Number(magnitude) || 0);
    screenShake.trauma = Math.min(1, screenShake.trauma + m / 28);
    screenShake.mag = Math.min(26, screenShake.mag + m);
  }

  /** Short camera punch on elite/boss kills or crits. */
  function addKillPunch(amount = 0.35) {
    if (typeof GameFeedback !== 'undefined' && GameFeedback.allowShake?.() === false) return;
    if (typeof Settings !== 'undefined' && Settings.get('reducedMotion')) return;
    killPunch = Math.min(1, killPunch + Math.max(0, amount));
    addScreenShake(4 + amount * 10);
  }

  function getScreenShakeOffset() {
    // Exponential trauma falloff feels more natural than linear mag
    screenShake.trauma = Math.max(0, screenShake.trauma * 0.9 - 0.008);
    screenShake.mag *= screenShake.decay;
    if (killPunch > 0.01) killPunch *= 0.82;
    else killPunch = 0;

    const traumaShake = screenShake.trauma * screenShake.trauma * 14;
    const mag = Math.max(screenShake.mag * 0.85, traumaShake) + killPunch * 6;
    if (mag < 0.2) return { x: 0, y: 0, zoom: 1 };

    // Slightly biased horizontal shake reads better in top-down combat
    const x = (Math.random() - 0.5) * mag * 2.4;
    const y = (Math.random() - 0.5) * mag * 1.7;
    const zoom = 1 + killPunch * 0.012;
    return { x, y, zoom };
  }

  function registerDeath(unit) {
    if (!unit) return;
    const drawCorpses = typeof GfxQuality === 'undefined' || GfxQuality.get().drawCorpses !== false;
    const isBig =
      unit.isNamedBoss ||
      unit.isPlanetBoss ||
      (typeof isEliteEnemy === 'function' && isEliteEnemy(unit));
    const allowGore =
      typeof GameFeedback === 'undefined' || GameFeedback.allowGore?.() !== false;
    if (drawCorpses && allowGore) {
      const dir = unit.team === 'player' ? -1 : 1;
      deathCorpses.push({
        x: unit.x,
        y: unit.y,
        type: unit.spriteType || unit.type,
        team: unit.team,
        rotation: unit.rotation ?? (unit.team === 'player' ? -90 : 90),
        timer: isBig ? 72 : 52,
        max: isBig ? 72 : 52,
        isElite: isBig,
        tumble: (Math.random() - 0.5) * 1.4,
        knockX: dir * (5 + Math.random() * 8),
        knockY: 2 + Math.random() * 5,
        bloodR: isBig ? 8 : 5,
      });
      if (deathCorpses.length > 48) deathCorpses.shift();
    }
    if (isBig) {
      addKillPunch(unit.isNamedBoss || unit.isPlanetBoss ? 0.55 : 0.38);
      addScreenShake(6);
    } else if (unit.team === 'enemy') {
      addScreenShake(1.2);
    }
    if (
      allowGore &&
      typeof Particles !== 'undefined' &&
      (typeof GfxQuality === 'undefined' || GfxQuality.allowDeathFx())
    ) {
      const mult = GfxQuality?.get?.().deathParticleMult ?? 1;
      if (mult >= 0.65) {
        Particles.deathBurst(unit.x, unit.y, unit.team);
        if (
          unit.team === 'enemy' &&
          ((typeof isEliteEnemy === 'function' && isEliteEnemy(unit)) || unit.isEvilOperative)
        ) {
          Particles.honorBurst(unit.x, unit.y, '#c080ff');
        }
        if (isBig && Particles.critBurst) Particles.critBurst(unit.x, unit.y);
      } else if (mult > 0) {
        Particles.blood(unit.x, unit.y, { mult: isBig ? 1.5 : 1 });
      }
    }
    // Impact FX already fired from takeDamage; only add a kill ring for elites/bosses
    if (isBig && typeof CombatFX !== 'undefined' && CombatFX.hitSpark) {
      CombatFX.hitSpark(unit.x, unit.y, { scale: 1.8, color: '#ffd060' });
    }
  }

  function vetUpgradeFx(unit) {
    if (!unit) return;
    if (typeof Particles !== 'undefined') Particles.vetSpark(unit.x, unit.y);
    if (typeof AudioEngine !== 'undefined') AudioEngine.SFX.vetUpgrade?.();
  }

  function honorFx(unit) {
    if (!unit) return;
    if (typeof Particles !== 'undefined') Particles.honorBurst(unit.x, unit.y, '#ffd700');
    if (typeof AudioEngine !== 'undefined') AudioEngine.SFX.honorChime?.();
  }

  function update() {
    deathCorpses = deathCorpses.filter((c) => {
      c.timer--;
      return c.timer > 0;
    });
    titleTick++;
  }

  function drawDeathCorpses(ctx) {
    for (const c of deathCorpses) {
      const prog = 1 - c.timer / c.max;
      const a = c.timer / c.max;
      const knock = Math.min(1, prog * 6);
      const tumble = prog * Math.PI * 0.55 * (c.tumble || 1);
      const flatten = Math.min(1, Math.max(0, (prog - 0.12) * 2.2));
      const poolR = (c.bloodR || 5) + prog * (c.isElite ? 18 : 12);

      ctx.save();
      ctx.translate(c.x + (c.knockX || 0) * knock, c.y + (c.knockY || 0) * knock);

      ctx.globalAlpha = a * 0.42;
      ctx.fillStyle =
        c.team === 'enemy' ? 'rgba(110,22,22,0.55)' : 'rgba(70,28,48,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 7, poolR, poolR * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(tumble);
      ctx.globalAlpha = a * 0.9;
      ctx.scale(1 - flatten * 0.12, 1 - flatten * 0.58);
      const img = SpriteGen.getUnitCanvas(c.type, c.rotation, c.team, 0, 1, 'death');
      ctx.drawImage(img, -18, -18, 36, 36);

      if (c.isElite && prog < 0.35) {
        ctx.globalAlpha = (1 - prog / 0.35) * 0.35;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 20 + prog * 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function drawConquestSectors(ctx, worldW, mapH, sectors = [], bossActive = false) {
    if (!sectors.length) return;
    ctx.save();
    const northH = mapH * 0.42;
    for (const s of sectors) {
      const w = Math.max(1, (s.x1 || 0) - (s.x0 || 0));
      const playerPct = s.playerControl ?? 100 - (s.enemyControl || 0);
      const alpha = s.eliminated ? 0.08 : 0.1 + (playerPct / 100) * 0.22;
      ctx.fillStyle = s.eliminated
        ? 'rgba(80, 200, 120, 0.14)'
        : `${hexToRgba(s.color || '#80a0c0', alpha)}`;
      ctx.fillRect(s.x0, 0, w, northH);
      if (!s.eliminated) {
        const conqW = w * (playerPct / 100);
        ctx.fillStyle = hexToRgba(s.color || '#80ffa0', 0.2 + playerPct * 0.003);
        ctx.fillRect(s.x0, 0, conqW, northH);
      }
      ctx.strokeStyle = s.eliminated
        ? 'rgba(120, 255, 160, 0.55)'
        : hexToRgba(s.color || '#c08060', 0.45);
      ctx.lineWidth = s.eliminated ? 2 : 1;
      ctx.setLineDash(s.eliminated ? [] : [6, 8]);
      ctx.strokeRect(s.x0 + 1, 2, w - 2, northH - 4);
      ctx.setLineDash([]);
      if (w > 36) {
        ctx.font = '8px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillStyle = s.eliminated ? 'rgba(160, 255, 190, 0.9)' : 'rgba(255, 220, 180, 0.82)';
        const label = s.eliminated ? `${s.name} FALLEN` : `${s.name} ${playerPct}%`;
        ctx.fillText(label, s.x0 + w / 2, 14);
      }
    }
    if (bossActive) {
      ctx.font = '9px Cinzel';
      ctx.fillStyle = 'rgba(255, 40, 120, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('— WORLDHEART TYRANT —', worldW / 2, northH - 8);
    }
    ctx.restore();
  }

  function hexToRgba(hex, alpha = 1) {
    const h = String(hex || '#888').replace('#', '');
    const full =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(128,128,128,${alpha})`;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawHostileTerritory(ctx, worldW, mapH, lineY, control, tierLabel) {
    if (!lineY || lineY <= mapH * 0.1 || control < 0.08) return;
    const depth = Math.max(0, Math.min(1, control));
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, lineY + 40);
    grad.addColorStop(0, `rgba(120, 20, 30, ${0.22 + depth * 0.28})`);
    grad.addColorStop(0.65, `rgba(80, 16, 24, ${0.12 + depth * 0.18})`);
    grad.addColorStop(1, 'rgba(40, 12, 18, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, worldW, lineY + 36);

    ctx.strokeStyle = `rgba(255, 70, 60, ${0.45 + depth * 0.35})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(worldW, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '9px Cinzel';
    ctx.fillStyle = `rgba(255, 120, 100, ${0.75 + depth * 0.2})`;
    ctx.textAlign = 'center';
    const label = tierLabel ? `— HOSTILE TERRITORY · ${tierLabel} —` : '— HOSTILE TERRITORY —';
    ctx.fillText(label, worldW / 2, lineY - 6);

    for (let i = 0; i < 5; i++) {
      const px = (worldW / 6) * (i + 0.5) + Math.sin(Date.now() * 0.001 + i) * 8;
      ctx.fillStyle = `rgba(255, 60, 50, ${0.15 + depth * 0.2})`;
      ctx.beginPath();
      ctx.arc(px, lineY + 10 + (i % 2) * 6, 3 + depth * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBiomeRegions(ctx, worldW, mapH, bands = []) {
    if (!bands.length) return;
    ctx.save();
    for (const band of bands) {
      ctx.fillStyle = band.tint || 'rgba(80,100,70,0.12)';
      if (band.x0 != null) {
        ctx.fillRect(band.x0, band.y0, band.x1 - band.x0, band.y1 - band.y0);
      } else {
        ctx.fillRect(0, band.y0, worldW, band.y1 - band.y0);
      }
      if (band.biome && band.biome !== 'plains' && band.y1 - (band.y0 || 0) > 28) {
        ctx.font = '8px Cinzel';
        ctx.fillStyle = band.color || '#88aa88';
        ctx.globalAlpha = 0.55;
        ctx.textAlign = 'center';
        const labelY =
          band.x0 != null ? (band.y0 + band.y1) / 2 : Math.min(band.y1 - 8, band.y0 + 14);
        const labelX = band.x0 != null ? (band.x0 + band.x1) / 2 : worldW / 2;
        if (band.x0 == null || band.x1 - band.x0 > 36) {
          ctx.fillText(
            band.name?.split(' ')[0]?.toUpperCase() || band.biome.toUpperCase(),
            labelX,
            labelY
          );
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawTerritoryBorders(ctx, worldW, mapH, tier) {
    if (tier <= 0) return;
    const sideW = Math.max(0, (worldW - BASE_W) / 2);
    const deepH = Math.max(0, mapH - BASE_H);

    ctx.save();
    ctx.strokeStyle = 'rgba(240,200,80,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);

    if (deepH > 0) {
      const y = BASE_H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(worldW, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,160,60,0.12)';
      ctx.fillRect(0, y, worldW, 22);
      ctx.font = '9px Cinzel';
      ctx.fillStyle = 'rgba(255,220,140,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(
        `— REALM EXPANSION · LAND ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][tier] || tier} —`,
        worldW / 2,
        y + 14
      );
    }
    if (sideW > 4) {
      ctx.beginPath();
      ctx.moveTo(sideW, 0);
      ctx.lineTo(sideW, mapH);
      ctx.moveTo(worldW - sideW, 0);
      ctx.lineTo(worldW - sideW, mapH);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  const FLANK_META = {
    north: { label: 'NORTH', short: 'N', glyph: '▲', align: 'center' },
    east: { label: 'EAST', short: 'E', glyph: '▶', align: 'right' },
    west: { label: 'WEST', short: 'W', glyph: '◀', align: 'left' },
    south: { label: 'SOUTH', short: 'S', glyph: '▼', align: 'center' },
  };

  function drawChevron(ctx, x, y, dir, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const s = size;
    if (dir === 'north') {
      ctx.moveTo(x, y + s * 0.55);
      ctx.lineTo(x - s * 0.45, y - s * 0.35);
      ctx.lineTo(x + s * 0.45, y - s * 0.35);
    } else if (dir === 'south') {
      ctx.moveTo(x, y - s * 0.55);
      ctx.lineTo(x - s * 0.45, y + s * 0.35);
      ctx.lineTo(x + s * 0.45, y + s * 0.35);
    } else if (dir === 'east') {
      ctx.moveTo(x - s * 0.55, y);
      ctx.lineTo(x + s * 0.35, y - s * 0.45);
      ctx.lineTo(x + s * 0.35, y + s * 0.45);
    } else {
      ctx.moveTo(x + s * 0.55, y);
      ctx.lineTo(x - s * 0.35, y - s * 0.45);
      ctx.lineTo(x - s * 0.35, y + s * 0.45);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlankEdgeBand(ctx, side, worldW, mapH, active, pulse) {
    const depth = active ? 34 : 18;
    const alpha = active ? 0.14 + pulse * 0.12 : 0.05;
    const hot = side === 'south' ? `rgba(255,72,48,${alpha})` : `rgba(255,128,72,${alpha})`;
    let g;
    if (side === 'north') {
      g = ctx.createLinearGradient(0, 0, 0, depth + 20);
      g.addColorStop(0, hot);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, worldW, depth + 20);
    } else if (side === 'south') {
      g = ctx.createLinearGradient(0, mapH - depth - 20, 0, mapH);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, hot);
      ctx.fillStyle = g;
      ctx.fillRect(0, mapH - depth - 20, worldW, depth + 20);
    } else if (side === 'east') {
      g = ctx.createLinearGradient(worldW - depth - 20, 0, worldW, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, hot);
      ctx.fillStyle = g;
      ctx.fillRect(worldW - depth - 20, 0, depth + 20, mapH);
    } else {
      g = ctx.createLinearGradient(0, 0, depth + 20, 0);
      g.addColorStop(0, hot);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, depth + 20, mapH);
    }
  }

  function drawFlankSpawnLine(ctx, side, worldW, mapH, active, pulse) {
    const margin = 18;
    ctx.save();
    ctx.strokeStyle = active ? `rgba(255,110,70,${0.55 + pulse * 0.35})` : 'rgba(140,100,80,0.28)';
    ctx.lineWidth = active ? 2.5 : 1.5;
    ctx.setLineDash(active ? [10, 6] : [4, 8]);
    ctx.beginPath();
    if (side === 'north') {
      ctx.moveTo(margin, 26);
      ctx.lineTo(worldW - margin, 26);
    } else if (side === 'south') {
      ctx.moveTo(margin, mapH - 30);
      ctx.lineTo(worldW - margin, mapH - 30);
    } else if (side === 'east') {
      ctx.moveTo(worldW - 26, margin);
      ctx.lineTo(worldW - 26, mapH - margin);
    } else {
      ctx.moveTo(26, margin);
      ctx.lineTo(26, mapH - margin);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawFlankAdvanceLane(ctx, side, worldW, mapH, tick, active) {
    if (!active) return;
    const laneLen = Math.min(worldW, mapH) * 0.22;
    const count = 5;
    const march = (tick * 0.035) % 1;
    const color = side === 'south' ? '#ff6048' : '#ff9050';
    for (let i = 0; i < count; i++) {
      const t = (i / count + march) % 1;
      const fade = 0.25 + 0.55 * Math.sin(t * Math.PI);
      let x = worldW * 0.5;
      let y = mapH * 0.5;
      if (side === 'north') {
        x = worldW * (0.22 + (i % 3) * 0.28);
        y = 24 + t * laneLen;
      } else if (side === 'south') {
        x = worldW * (0.22 + (i % 3) * 0.28);
        y = mapH - 24 - t * laneLen;
      } else if (side === 'east') {
        x = worldW - 24 - t * laneLen;
        y = mapH * (0.28 + (i % 3) * 0.22);
      } else {
        x = 24 + t * laneLen;
        y = mapH * (0.28 + (i % 3) * 0.22);
      }
      drawChevron(ctx, x, y, side, 7 + (i % 2), color, fade);
    }
  }

  function drawFlankBadge(ctx, side, worldW, mapH, active, pulse) {
    const meta = FLANK_META[side];
    if (!meta) return;
    const pos = {
      north: { x: worldW / 2, y: 13 },
      east: { x: worldW - 14, y: mapH * 0.4 },
      west: { x: 14, y: mapH * 0.4 },
      south: { x: worldW / 2, y: mapH - 46 },
    }[side];
    ctx.save();
    ctx.textAlign = meta.align;
    ctx.font = 'bold 9px Cinzel';
    const tag = active ? `${meta.glyph} ${meta.label}` : `${meta.short} · quiet`;
    const tw = ctx.measureText(tag).width + 10;
    let rx = pos.x;
    if (meta.align === 'center') rx = pos.x - tw / 2;
    else if (meta.align === 'right') rx = pos.x - tw;
    ctx.fillStyle = active ? `rgba(24,10,6,${0.62 + pulse * 0.2})` : 'rgba(16,12,10,0.42)';
    ctx.fillRect(rx, pos.y - 11, tw, 14);
    ctx.fillStyle = active ? '#ffb878' : '#887060';
    ctx.fillText(tag, pos.x, pos.y);
    ctx.restore();
  }

  function drawFlankCompass(ctx, worldW, mapH, activeSides, unlockedSides, pulse) {
    const cx = worldW - 46;
    const cy = mapH - 46;
    const r = 30;
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,12,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,160,100,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const slots = {
      north: { x: cx, y: cy - 16 },
      south: { x: cx, y: cy + 16 },
      east: { x: cx + 16, y: cy + 4 },
      west: { x: cx - 16, y: cy + 4 },
    };
    for (const side of ['north', 'east', 'west', 'south']) {
      if (!unlockedSides.includes(side)) continue;
      const on = activeSides.includes(side);
      const p = slots[side];
      ctx.font = on ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? `rgba(255,140,80,${0.85 + pulse * 0.15})` : 'rgba(120,96,80,0.55)';
      ctx.fillText(FLANK_META[side].glyph, p.x, p.y);
    }
    ctx.font = '7px Cinzel';
    ctx.fillStyle = 'rgba(255,200,140,0.75)';
    ctx.fillText('FLANKS', cx, cy + 5);
    ctx.restore();
  }

  function drawMinimapFlankBands(ctx, w, h, data) {
    const unlocked = data.unlockedAttackSides || ['north'];
    if (unlocked.length <= 1 && (data.attackSides || ['north']).length <= 1) return;

    const activeSet = new Set(data.attackSides || ['north']);
    const night = data.phase === 'night';
    const pulse = 0.55 + Math.sin((data.tick || 0) * 0.07) * 0.25;

    for (const side of unlocked) {
      const active = activeSet.has(side);
      if (!active && night) continue;
      const depth = active ? 11 : 6;
      const alpha = active ? 0.28 + pulse * 0.18 : 0.1;
      const hot =
        side === 'south' ? `rgba(255,72,48,${alpha})` : `rgba(255,128,72,${alpha * 0.95})`;
      let g;
      if (side === 'north') {
        g = ctx.createLinearGradient(0, 0, 0, depth);
        g.addColorStop(0, hot);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, depth);
      } else if (side === 'south') {
        g = ctx.createLinearGradient(0, h - depth, 0, h);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, hot);
        ctx.fillStyle = g;
        ctx.fillRect(0, h - depth, w, depth);
      } else if (side === 'east') {
        g = ctx.createLinearGradient(w - depth, 0, w, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, hot);
        ctx.fillStyle = g;
        ctx.fillRect(w - depth, 0, depth, h);
      } else {
        g = ctx.createLinearGradient(0, 0, depth, 0);
        g.addColorStop(0, hot);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, depth, h);
      }
    }
  }

  function drawMinimapSpawnLines(ctx, w, h, data) {
    const unlocked = data.unlockedAttackSides || ['north'];
    const activeSet = new Set(data.attackSides || ['north']);
    const pulse = 0.55 + Math.sin((data.tick || 0) * 0.07) * 0.25;
    const inset = 3;

    for (const side of unlocked) {
      const active = activeSet.has(side);
      ctx.save();
      ctx.strokeStyle = active
        ? `rgba(255,110,70,${0.75 + pulse * 0.2})`
        : 'rgba(120,96,80,0.35)';
      ctx.lineWidth = active ? 1.5 : 1;
      ctx.setLineDash(active ? [4, 3] : [2, 4]);
      ctx.beginPath();
      if (side === 'north') {
        ctx.moveTo(inset, inset + 1);
        ctx.lineTo(w - inset, inset + 1);
      } else if (side === 'south') {
        ctx.moveTo(inset, h - inset - 1);
        ctx.lineTo(w - inset, h - inset - 1);
      } else if (side === 'east') {
        ctx.moveTo(w - inset - 1, inset);
        ctx.lineTo(w - inset - 1, h - inset);
      } else {
        ctx.moveTo(inset + 1, inset);
        ctx.lineTo(inset + 1, h - inset);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawMinimapFlankChevrons(ctx, w, h, data) {
    const active = data.attackSides || ['north'];
    const pulse = 0.55 + Math.sin((data.tick || 0) * 0.07) * 0.25;
    const lane = Math.min(w, h) * 0.14;
    const march = ((data.tick || 0) * 0.04) % 1;

    for (const side of active) {
      const color = side === 'south' ? '#ff6048' : '#ff9050';
      for (let i = 0; i < 3; i++) {
        const t = (i / 3 + march) % 1;
        const fade = 0.35 + 0.5 * Math.sin(t * Math.PI);
        let x = w * 0.5;
        let y = h * 0.5;
        if (side === 'north') {
          x = w * (0.28 + (i % 2) * 0.44);
          y = 5 + t * lane;
        } else if (side === 'south') {
          x = w * (0.28 + (i % 2) * 0.44);
          y = h - 5 - t * lane;
        } else if (side === 'east') {
          x = w - 5 - t * lane;
          y = h * (0.3 + (i % 2) * 0.4);
        } else {
          x = 5 + t * lane;
          y = h * (0.3 + (i % 2) * 0.4);
        }
        drawChevron(ctx, x, y, side, 4, color, fade * (0.7 + pulse * 0.2));
      }
    }
  }

  function drawMinimapCompass(ctx, w, h, data) {
    const unlocked = data.unlockedAttackSides || ['north'];
    if (unlocked.length <= 1) return;

    const activeSet = new Set(data.attackSides || ['north']);
    const pulse = 0.55 + Math.sin((data.tick || 0) * 0.07) * 0.25;
    const cx = 18;
    const cy = h - 16;
    const r = 13;

    ctx.save();
    ctx.fillStyle = 'rgba(8,6,12,0.72)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,160,100,${0.4 + pulse * 0.2})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const slots = {
      north: { x: cx, y: cy - 7 },
      south: { x: cx, y: cy + 7 },
      east: { x: cx + 7, y: cy + 2 },
      west: { x: cx - 7, y: cy + 2 },
    };
    for (const side of ['north', 'east', 'west', 'south']) {
      if (!unlocked.includes(side)) continue;
      const on = activeSet.has(side);
      const p = slots[side];
      ctx.font = on ? 'bold 8px sans-serif' : '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? `rgba(255,140,80,${0.9 + pulse * 0.1})` : 'rgba(120,96,80,0.55)';
      ctx.fillText(FLANK_META[side].glyph, p.x, p.y);
    }
    ctx.restore();
  }

  function drawMinimapRallyLine(ctx, w, h, data) {
    if (!data.rallyY || !data.worldH) return;
    const sy = h / data.worldH;
    const y = data.rallyY * sy;
    ctx.save();
    ctx.strokeStyle = 'rgba(200,180,100,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMinimapDoctrineTicks(ctx, w, h, data) {
    const assignments = data.multiFront?.assignments;
    if (!assignments?.length) return;
    const activeSet = new Set(data.attackSides || []);

    const doctrineColor = {
      siege_line: '#ff8060',
      economy_raid: '#ff50a0',
      wide_flank: '#ffb040',
      opportunist: '#c0a0ff',
    };

    for (const a of assignments) {
      for (const front of a.fronts || []) {
        if (!activeSet.has(front)) continue;
        const col = doctrineColor[a.doctrine] || '#ff9070';
        ctx.save();
        ctx.fillStyle = col;
        if (front === 'north') {
          ctx.fillRect(w * 0.5 - 2, 1, 4, 3);
        } else if (front === 'south') {
          ctx.fillRect(w * 0.5 - 2, h - 4, 4, 3);
        } else if (front === 'east') {
          ctx.fillRect(w - 4, h * 0.5 - 2, 3, 4);
        } else {
          ctx.fillRect(1, h * 0.5 - 2, 3, 4);
        }
        ctx.restore();
      }
    }
  }

  function getMinimapFlankLabel(data) {
    const sides = data.attackSides || ['north'];
    const unlocked = data.unlockedAttackSides || sides;
    if (unlocked.length <= 1) return null;
    const glyphs = { north: '▲', east: '▶', west: '◀', south: '▼' };
    const activeSet = new Set(sides);
    const parts = [];
    for (const s of ['north', 'east', 'west', 'south']) {
      if (!unlocked.includes(s)) continue;
      parts.push(`${glyphs[s]}${activeSet.has(s) ? '' : '·'}`);
    }
    const multi = sides.length > 1 ? ` ×${sides.length}` : '';
    return `${parts.join(' ')}${multi}`;
  }

  function drawMinimapOverlay(ctx, w, h, data, layer = 'all') {
    if (!data) return null;
    if (layer === 'bands' || layer === 'all') {
      drawMinimapFlankBands(ctx, w, h, data);
      drawMinimapRallyLine(ctx, w, h, data);
    }
    if (layer === 'overlay' || layer === 'all') {
      drawMinimapSpawnLines(ctx, w, h, data);
      if ((data.attackSides || []).length > 0 && data.phase !== 'night') {
        drawMinimapFlankChevrons(ctx, w, h, data);
      }
      drawMinimapDoctrineTicks(ctx, w, h, data);
      drawMinimapCompass(ctx, w, h, data);
      // Danger flash when the line is pressed hard
      const danger =
        typeof GameFeedback !== 'undefined'
          ? GameFeedback.getMinimapDangerPulse?.(data.tick || 0)
          : 0;
      if (danger > 0.08) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,60,40,${0.25 + danger * 0.55})`;
        ctx.lineWidth = 2 + danger * 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = `rgba(180,20,20,${0.06 + danger * 0.12})`;
        ctx.fillRect(0, h * 0.55, w, h * 0.45);
        ctx.restore();
      }
    }
    return getMinimapFlankLabel(data);
  }

  function drawMultiFrontIndicators(ctx, worldW, mapH, sides, wave, opts = {}) {
    if (!sides?.length) return;
    const unlocked = opts.unlockedSides?.length ? opts.unlockedSides : sides;
    if (unlocked.length <= 1 && sides.length <= 1) return;

    const tick = opts.tick ?? 0;
    const night = opts.phase === 'night';
    const pulse = 0.62 + Math.sin(tick * 0.07) * 0.22;
    const activeSet = new Set(sides);

    for (const side of unlocked) {
      const active = activeSet.has(side);
      if (!active && night) continue;
      ctx.save();
      ctx.globalAlpha = night ? (active ? 0.55 : 0.3) : 1;
      drawFlankEdgeBand(ctx, side, worldW, mapH, active, pulse);
      drawFlankSpawnLine(ctx, side, worldW, mapH, active, pulse);
      if (active) drawFlankAdvanceLane(ctx, side, worldW, mapH, tick, true);
      drawFlankBadge(ctx, side, worldW, mapH, active, pulse);
      ctx.restore();
    }

    if (sides.length > 1) {
      drawFlankCompass(ctx, worldW, mapH, sides, unlocked, pulse);
      ctx.font = 'bold 8px Cinzel';
      ctx.fillStyle = `rgba(255,120,88,${0.7 + pulse * 0.3})`;
      ctx.textAlign = 'center';
      const bannerY = sides.length >= 3 ? mapH - 10 : mapH - 22;
      ctx.fillText(
        `MULTI-FRONT · ${sides.length} ASSAULT${sides.length > 1 ? 'S' : ''}`,
        worldW / 2,
        bannerY
      );
    } else if (unlocked.length > 1 && night) {
      ctx.font = '8px Cinzel';
      ctx.fillStyle = 'rgba(160,130,100,0.65)';
      ctx.textAlign = 'center';
      ctx.fillText('Scout: other flanks may wake at dawn', worldW / 2, mapH - 10);
    }
  }

  function drawAccessibilityCue(ctx, u) {
    if (!u || u.hp <= 0) return;
    const y = u.y - 18;
    if (typeof isEliteEnemy === 'function' && isEliteEnemy(u)) {
      ctx.strokeStyle = '#e0c0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(u.x, y - 6);
      ctx.lineTo(u.x + 5, y);
      ctx.lineTo(u.x, y + 6);
      ctx.lineTo(u.x - 5, y);
      ctx.closePath();
      ctx.stroke();
    }
    if (u.demoralized) {
      ctx.strokeStyle = '#a080c0';
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i += 4) {
        ctx.beginPath();
        ctx.moveTo(u.x + i - 2, y + 8);
        ctx.lineTo(u.x + i + 2, y + 12);
        ctx.stroke();
      }
    }
    if (u.fleeing) {
      ctx.fillStyle = '#c06040';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', u.x, y + 10);
    }
    if (u.team === 'player' && u.huntMode) {
      ctx.strokeStyle = '#ff6060';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(u.x + 12, u.y - 14, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff4040';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', u.x + 12, u.y - 11);
    }
    if (u.retreatingToMed) {
      ctx.fillStyle = '#4080c0';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', u.x - 12, u.y - 12);
    }
  }

  function drawFactionAccent(ctx, u) {
    if (!u || u.hp <= 0) return;
    let fid = null;
    if (u.isWwe) fid = 'wwe';
    else if (u.isDoomslayer) fid = 'doom';
    else if (u.isCrossover && typeof getCrossoverDef === 'function') {
      fid = getCrossoverDef(u.type)?.faction;
    }
    const acc = fid && FACTION_ACCENT[fid];
    if (!acc) return;

    const pulse = 0.5 + Math.sin(Date.now() * 0.005 + u.x) * 0.15;
    ctx.strokeStyle = acc.ring;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = u.isCrossover ? 2.5 : 2;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 17, 0, Math.PI * 2);
    ctx.stroke();

    if (acc.pattern === 'star' && fid === 'wwe') {
      ctx.fillStyle = acc.ring;
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', u.x, u.y - 20);
    } else if (acc.pattern === 'shield') {
      ctx.fillStyle = 'rgba(128,192,255,0.35)';
      ctx.fillRect(u.x - 3, u.y - 22, 6, 8);
    } else if (acc.pattern === 'ki') {
      ctx.fillStyle = 'rgba(255,160,60,0.4)';
      ctx.beginPath();
      ctx.arc(u.x, u.y - 20, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawAtmosphere(ctx, worldW, mapH, light, phase, wave, tick, opts = {}) {
    if (opts.simple) {
      if (phase === 'night') {
        ctx.fillStyle = 'rgba(6,10,32,0.62)';
        ctx.fillRect(0, 0, worldW, mapH);
      } else if (light < 0.92) {
        ctx.fillStyle = `rgba(24,14,48,${(1 - light) * 0.42})`;
        ctx.fillRect(0, 0, worldW, mapH);
      }
      return;
    }

    weather = pickWeather(wave, tick);

    if (phase === 'night') {
      const vignette = ctx.createRadialGradient(
        worldW / 2,
        mapH / 2,
        mapH * 0.2,
        worldW / 2,
        mapH / 2,
        mapH * 0.85
      );
      vignette.addColorStop(0, 'rgba(8,12,40,0.35)');
      vignette.addColorStop(1, 'rgba(4,6,24,0.75)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, worldW, mapH);
      ctx.fillStyle = 'rgba(100,140,255,0.06)';
      ctx.fillRect(0, 0, worldW, mapH);
    } else if (light < 0.95) {
      const dusk = 1 - light;
      ctx.fillStyle = `rgba(48,28,72,${dusk * 0.38})`;
      ctx.fillRect(0, 0, worldW, mapH);
      ctx.fillStyle = `rgba(255,140,60,${dusk * 0.08})`;
      ctx.fillRect(0, 0, worldW, mapH * 0.35);
    }

    if (
      opts.weatherParticles !== false &&
      weather.type === 'rain' &&
      typeof Particles !== 'undefined'
    ) {
      if (tick % 3 === 0) Particles.weatherRain(worldW * Math.random(), mapH * Math.random() * 0.6);
    }
    if (weather.type === 'mist') {
      ctx.fillStyle = 'rgba(180,200,220,0.08)';
      ctx.fillRect(0, 0, worldW, mapH);
    }
    if (weather.type === 'ash') {
      ctx.fillStyle = 'rgba(80,40,40,0.12)';
      ctx.fillRect(0, 0, worldW, mapH);
      if (opts.weatherParticles !== false && tick % 5 === 0 && typeof Particles !== 'undefined') {
        Particles.weatherAsh(worldW * Math.random(), mapH * Math.random() * 0.5);
      }
    }
  }

  function drawTitleArt(ctx, w, h) {
    const tick = titleTick;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a2818');
    grad.addColorStop(0.5, '#2a4028');
    grad.addColorStop(1, '#141810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const moonX = w - 60 + Math.sin(tick * 0.02) * 4;
    ctx.fillStyle = 'rgba(220,220,255,0.85)';
    ctx.beginPath();
    ctx.arc(moonX, 36, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2818';
    ctx.beginPath();
    ctx.arc(moonX + 8, 32, 16, 0, Math.PI * 2);
    ctx.fill();

    SpriteGen.drawTree(ctx, 50 + Math.sin(tick * 0.015) * 2, 50, 28);
    SpriteGen.drawTree(ctx, w - 70, 70, 24);
    SpriteGen.drawRock(ctx, w / 2, 90, 18);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h - 55, w, 55);
    ['footman', 'knight', 'archer', 'mage', 'cavalry'].forEach((t, i) => {
      const bob = Math.sin(tick * 0.08 + i) * 2;
      const img = SpriteGen.getUnitCanvas(t, -90, 'player', Math.floor(tick / 8) % 2, 1, 'idle');
      ctx.drawImage(img, 24 + i * 36, h - 58 + bob, 30, 30);
    });
    ['orc', 'goblin', 'dark_knight', 'siege_tower'].forEach((t, i) => {
      const img = SpriteGen.getUnitCanvas(
        t === 'siege_tower' ? 'dark_knight' : t,
        90,
        'enemy',
        0,
        1,
        'walk'
      );
      ctx.drawImage(img, w - 160 + i * 34, 28 + Math.sin(tick * 0.06 + i) * 3, 28, 28);
    });

    ctx.strokeStyle = 'rgba(200,160,80,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.font = '8px Cinzel';
    ctx.fillStyle = 'rgba(200,180,120,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('DEFEND THE REALM', w / 2, h - 8);
  }

  function updateAudioMix(gs) {
    if (!gs || typeof AudioEngine === 'undefined' || !AudioEngine.updateMix) return;
    const hordeIntensity = getHordeIntensity(gs.hordeWave);
    const battle = computeBattleIntensity(gs);
    const intensity = Math.min(1, battle + hordeIntensity * 0.32);
    AudioEngine.updateMix({
      intensity,
      era: getEraId(gs.wave || 0),
      phase: gs.timeOfDay || 'day',
      wave: gs.wave || 0,
      boss: !!gs.bossActive,
      horde: hordeIntensity > 0 && gs.timeOfDay === 'day',
      hordeIntensity,
    });
  }

  function drawBannerEmblem(ctx, cx, cy, size, emblemId) {
    const glyphs = {
      crown: '♛',
      sun: '☀',
      sword: '⚔',
      skull: '☠',
      dragon: '🐉',
      star: '✦',
    };
    const glyph = glyphs[emblemId] || glyphs.crown;
    ctx.save();
    ctx.fillStyle = '#2a1810';
    ctx.font = `bold ${Math.max(7, Math.floor(size))}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, cx, cy);
    ctx.restore();
  }

  function drawKingdomBanner(ctx, w, h, stage, fill, color, cosmeticsOpts) {
    if (!ctx || w < 8 || h < 8) return;
    ctx.clearRect(0, 0, w, h);
    const opts = cosmeticsOpts || null;
    let tier = Math.max(1, Math.min(4, stage | 0));
    if (opts?.pattern && opts.pattern !== 'auto' && typeof Cosmetics !== 'undefined') {
      tier = Cosmetics.resolveBannerStage(stage);
    }
    const pct = Math.max(0.08, Math.min(1, fill || 0));
    const col = opts?.primary || color || '#c0a040';
    const accentCol = opts?.secondary || '#ffd878';
    const emblem = opts?.emblem || 'crown';
    const useCustomEmblem = !!opts;
    const poleX = Math.floor(w * 0.22);
    const baseY = h - 2;

    ctx.save();
    ctx.strokeStyle = '#6a5038';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poleX, baseY);
    ctx.lineTo(poleX, 2);
    ctx.stroke();
    ctx.fillStyle = '#a08050';
    ctx.beginPath();
    ctx.arc(poleX, 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const grow = 0.55 + pct * 0.45;
    const bw = Math.floor((tier === 1 ? w * 0.38 : tier === 2 ? w * 0.42 : w * 0.52) * grow);
    const bh = Math.floor((tier === 1 ? h * 0.42 : tier === 2 ? h * 0.5 : h * 0.58) * grow);
    const bx = poleX + 3;
    const by = baseY - bh;

    if (tier === 1) {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw, by + bh * 0.35);
      ctx.lineTo(bx, by + bh);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#3a2818';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (tier === 2) {
      const cx = bx + bw * 0.45;
      const cy = by + bh * 0.48;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, by + 2);
      ctx.lineTo(bx + bw - 2, by + bh * 0.28);
      ctx.lineTo(cx, by + bh - 2);
      ctx.lineTo(bx + 2, by + bh * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = accentCol;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (useCustomEmblem) drawBannerEmblem(ctx, cx, cy, bh * 0.28, emblem);
      else {
        ctx.fillStyle = '#2a1810';
        ctx.font = `bold ${Math.max(7, Math.floor(bh * 0.28))}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♛', cx, cy);
      }
    } else if (tier === 3) {
      const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      grad.addColorStop(0, col);
      grad.addColorStop(0.5, accentCol);
      grad.addColorStop(1, col);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#4a3020';
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      if (useCustomEmblem) drawBannerEmblem(ctx, bx + bw * 0.5, by + bh * 0.55, bh * 0.22, emblem);
      else {
        ctx.fillStyle = '#3a2010';
        ctx.font = `bold ${Math.max(8, Math.floor(bh * 0.22))}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('EMPIRE', bx + bw * 0.5, by + bh * 0.55);
      }
    } else {
      const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      grad.addColorStop(0, '#ff4040');
      grad.addColorStop(0.45, col);
      grad.addColorStop(1, '#802020');
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);
      ctx.shadowColor = '#ff6060';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#ff9080';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;
      if (useCustomEmblem) drawBannerEmblem(ctx, bx + bw * 0.5, by + bh * 0.52, bh * 0.2, emblem);
      else {
        ctx.fillStyle = '#ffe0c0';
        ctx.font = `bold ${Math.max(7, Math.floor(bh * 0.18))}px Cinzel, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('DOMINION', bx + bw * 0.5, by + bh * 0.52);
      }
    }

    ctx.fillStyle = `rgba(255, 240, 180, ${0.12 + pct * 0.2})`;
    ctx.fillRect(bx, by + bh * (1 - pct), bw, bh * pct);
    ctx.restore();
  }

  function drawMapEventSite(ctx, site, tick = 0, phase = 'day') {
    if (!site) return;
    const x = site.x;
    const y = site.y;
    const r = site.radius || 52;
    const col = site.color || '#e08040';
    const pulse = 0.55 + Math.sin(tick * 0.06) * 0.25;
    const nightDim = phase === 'night' ? 0.75 : 1;

    ctx.save();
    ctx.globalAlpha = 0.22 * pulse * nightDim;
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, col);
    grad.addColorStop(0.55, `${col}88`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.65 * nightDim;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -tick * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.9 * nightDim;
    ctx.fillStyle = '#1a1008';
    ctx.font = 'bold 9px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (site.label || 'EVENT').slice(0, 14);
    const tw = ctx.measureText(label).width + 10;
    ctx.fillRect(x - tw / 2, y - r - 14, tw, 12);
    ctx.fillStyle = col;
    ctx.fillText(label, x, y - r - 8);
    ctx.restore();
  }

  return {
    getEraId,
    computeBattleIntensity,
    drawKingdomBanner,
    registerDeath,
    addScreenShake,
    addKillPunch,
    getScreenShakeOffset,
    vetUpgradeFx,
    honorFx,
    update,
    drawDeathCorpses,
    drawBiomeRegions,
    drawTerritoryBorders,
    drawConquestSectors,
    drawHostileTerritory,
    drawMultiFrontIndicators,
    drawMinimapOverlay,
    getMinimapFlankLabel,
    drawAccessibilityCue,
    drawFactionAccent,
    drawMapEventSite,
    drawAtmosphere,
    drawHordeIntensity,
    getHordeIntensity,
    drawTitleArt,
    updateAudioMix,
    FACTION_ACCENT,
    BASE_W,
    BASE_H,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.VisualPolish = VisualPolish;
