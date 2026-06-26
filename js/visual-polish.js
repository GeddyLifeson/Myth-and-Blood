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

  function getEraId(wave) {
    if (wave >= 1001) return 'hellscape';
    if (wave >= 200) return 'rts';
    if (wave >= 100) return 'academy';
    if (wave >= 40) return 'siege';
    if (wave >= 15) return 'mid';
    return 'early';
  }

  function computeBattleIntensity(units, spawnQueue, projectiles) {
    const enemies = (units || []).filter(u => u.team === 'enemy' && u.hp > 0).length;
    const players = (units || []).filter(u => u.team === 'player' && u.hp > 0).length;
    const queue = spawnQueue?.length || 0;
    const proj = projectiles?.length || 0;
    const raw = enemies * 0.04 + queue * 0.02 + proj * 0.08 + Math.min(players, 20) * 0.01;
    return Math.max(0, Math.min(1, raw));
  }

  function pickWeather(wave, tick) {
    if (wave >= 1001) return { type: 'ash', intensity: 0.35 };
    if (wave >= 200) return { type: 'mist', intensity: 0.2 };
    if (tick % 2400 < 400) return { type: 'rain', intensity: 0.25 };
    return { type: 'clear', intensity: 0 };
  }

  function registerDeath(unit) {
    if (!unit) return;
    const drawCorpses = typeof GfxQuality === 'undefined' || GfxQuality.get().drawCorpses !== false;
    if (drawCorpses) {
      deathCorpses.push({
        x: unit.x, y: unit.y, type: unit.spriteType || unit.type,
        team: unit.team, rotation: unit.rotation ?? (unit.team === 'player' ? -90 : 90), timer: 28, max: 28,
        isElite: typeof isEliteEnemy === 'function' && isEliteEnemy(unit),
      });
      if (deathCorpses.length > 48) deathCorpses.shift();
    }
    if (typeof Particles !== 'undefined' && (typeof GfxQuality === 'undefined' || GfxQuality.allowDeathFx())) {
      const mult = GfxQuality?.get?.().deathParticleMult ?? 1;
      if (mult >= 0.65) {
        Particles.deathBurst(unit.x, unit.y, unit.team);
        if (unit.team === 'enemy' && (typeof isEliteEnemy === 'function' && isEliteEnemy(unit))) {
          Particles.honorBurst(unit.x, unit.y, '#c080ff');
        }
      } else if (mult > 0) {
        Particles.blood(unit.x, unit.y);
      }
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
    deathCorpses = deathCorpses.filter(c => {
      c.timer--;
      return c.timer > 0;
    });
    titleTick++;
  }

  function drawDeathCorpses(ctx) {
    for (const c of deathCorpses) {
      const a = c.timer / c.max;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = a * 0.85;
      ctx.scale(1, 0.45);
      const img = SpriteGen.getUnitCanvas(c.type, c.rotation, c.team, 0, 1, 'death');
      ctx.drawImage(img, -18, -18, 36, 36);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
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
      ctx.fillText(`— REALM EXPANSION · LAND ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][tier] || tier} —`, worldW / 2, y + 14);
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

  function drawMultiFrontIndicators(ctx, worldW, mapH, sides, wave) {
    if (!sides?.length) return;
    const t = Date.now() * 0.002;
    const pulse = 0.65 + Math.sin(t) * 0.2;

    const markers = {
      north: { x: worldW / 2, y: 14, label: 'NORTH', align: 'center' },
      east: { x: worldW - 12, y: mapH * 0.42, label: 'EAST', align: 'right' },
      west: { x: 12, y: mapH * 0.42, label: 'WEST', align: 'left' },
      south: { x: worldW / 2, y: mapH - 42, label: 'SOUTH', align: 'center' },
    };

    for (const side of sides) {
      const m = markers[side];
      if (!m) continue;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = side === 'south' ? 'rgba(255,90,60,0.2)' : 'rgba(255,140,80,0.15)';
      if (side === 'north') ctx.fillRect(0, 0, worldW, 28);
      else if (side === 'south') ctx.fillRect(0, mapH - 52, worldW, 52);
      else if (side === 'east') ctx.fillRect(worldW - 28, 0, 28, mapH);
      else if (side === 'west') ctx.fillRect(0, 0, 28, mapH);

      ctx.font = 'bold 9px Cinzel';
      ctx.fillStyle = '#ffb080';
      ctx.textAlign = m.align;
      ctx.fillText(`⚔ ${m.label}`, m.x, m.y);
      ctx.strokeStyle = 'rgba(255,120,60,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      if (side === 'north') {
        ctx.beginPath(); ctx.moveTo(20, 24); ctx.lineTo(worldW - 20, 24); ctx.stroke();
      } else if (side === 'south') {
        ctx.beginPath(); ctx.moveTo(20, mapH - 28); ctx.lineTo(worldW - 20, mapH - 28); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (sides.length >= 3) {
      ctx.font = '8px Cinzel';
      ctx.fillStyle = `rgba(255,100,80,${pulse})`;
      ctx.textAlign = 'center';
      ctx.fillText(`MULTI-FRONT · WAVE ${wave}`, worldW / 2, mapH - 8);
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
      const vignette = ctx.createRadialGradient(worldW / 2, mapH / 2, mapH * 0.2, worldW / 2, mapH / 2, mapH * 0.85);
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

    if (opts.weatherParticles !== false && weather.type === 'rain' && typeof Particles !== 'undefined') {
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
      const img = SpriteGen.getUnitCanvas(t === 'siege_tower' ? 'dark_knight' : t, 90, 'enemy', 0, 1, 'walk');
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
    const intensity = computeBattleIntensity(
      gs.units || [],
      gs.spawnQueue,
      gs.projectiles,
    );
    AudioEngine.updateMix({
      intensity,
      era: getEraId(gs.wave || 0),
      phase: gs.timeOfDay || 'day',
      wave: gs.wave || 0,
      boss: !!gs.bossActive,
    });
  }

  return {
    getEraId,
    computeBattleIntensity,
    registerDeath,
    vetUpgradeFx,
    honorFx,
    update,
    drawDeathCorpses,
    drawTerritoryBorders,
    drawMultiFrontIndicators,
    drawAccessibilityCue,
    drawFactionAccent,
    drawAtmosphere,
    drawTitleArt,
    updateAudioMix,
    FACTION_ACCENT,
    BASE_W,
    BASE_H,
  };
})();