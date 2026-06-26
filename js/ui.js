/**
 * UI controller — panels, HUD, specialists.
 */
const UI = (() => {
  let gameOverShown = false;
  let selectedDifficulty = 'normal';

  function updateDifficultyUI(id) {
    selectedDifficulty = id;
    const def = getDifficultyDef(id);
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.diff === id);
    });
    const tagline = document.getElementById('diff-tagline');
    if (tagline && def) tagline.textContent = def.tagline;
    Game.setDifficulty(id);
    if (typeof AdvancedDifficulty !== 'undefined') {
      const pct = AdvancedDifficulty.getDifficultyPercent(id);
      const advPct = document.getElementById('advanced-diff-pct');
      if (advPct) advPct.textContent = `Effective: ${pct}%`;
      if (typeof GameModes !== 'undefined') GameModes.renderScalingPanel(id);
    }
  }

  function init() {
    MetaProgress.load();
    if (typeof Achievements !== 'undefined') Achievements.init();
    if (typeof Encyclopedia !== 'undefined') Encyclopedia.init();
    if (typeof Cheats !== 'undefined') Cheats.init();
    if (typeof AdvancedDifficulty !== 'undefined') AdvancedDifficulty.init();
    if (typeof GameModes !== 'undefined') GameModes.init();
    if (typeof WweAcademy !== 'undefined') WweAcademy.init();
    if (typeof CrossoverHub !== 'undefined') CrossoverHub.init();
    if (typeof CreativeMode !== 'undefined') CreativeMode.init();
    if (typeof Tooltips !== 'undefined') Tooltips.init();

    const titleCanvas = document.getElementById('title-art');
    function paintTitleArt() {
      if (!titleCanvas) return;
      const menu = document.getElementById('menu-screen');
      if (menu?.classList.contains('active')) {
        if (typeof VisualPolish !== 'undefined') VisualPolish.update();
        const tctx = titleCanvas.getContext('2d');
        if (typeof VisualPolish !== 'undefined') VisualPolish.drawTitleArt(tctx, titleCanvas.width, titleCanvas.height);
        else SpriteGen.drawTitleArt(tctx, titleCanvas.width, titleCanvas.height);
      }
      requestAnimationFrame(paintTitleArt);
    }
    paintTitleArt();

    function syncMenuMusic() {
      const menuActive = document.getElementById('menu-screen')?.classList.contains('active');
      const playing = Game.isPlaying?.();
      if (menuActive && !playing) {
        AudioEngine.resume().then((ok) => { if (ok && !AudioEngine.isMuted?.()) AudioEngine.startMenuMusic?.(); });
      } else if (playing) {
        /* battle music handled by Game.start */
      }
    }
    syncMenuMusic();
    document.addEventListener('pointerdown', () => syncMenuMusic(), { once: false, passive: true });
    document.addEventListener('keydown', () => syncMenuMusic(), { once: false });

    document.getElementById('menu-quit-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      if (window.electronAPI?.quitApp) window.electronAPI.quitApp();
      else window.close();
    });

    document.querySelectorAll('.btn-icon').forEach(icon => {
      const ictx = icon.getContext('2d');
      const sprite = icon.dataset.sprite;
      const ability = icon.dataset.abilityIcon;
      if (ability && SpriteGen.drawAbilityIcon) SpriteGen.drawAbilityIcon(ictx, ability);
      else if (sprite && SpriteGen.UNIT_STYLE[sprite]) SpriteGen.drawIcon(ictx, sprite);
    });

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioEngine.SFX.click();
        updateDifficultyUI(btn.dataset.diff);
      });
    });
    updateDifficultyUI(selectedDifficulty);

    function beginDefense() {
      gameOverShown = false;
      Game.setDifficulty(selectedDifficulty);
      document.getElementById('menu-screen').classList.remove('active');
      AudioEngine.stopMusic();
      try {
        Game.start();
      } catch (err) {
        console.error('Game.start failed', err);
        document.getElementById('menu-screen').classList.add('active');
        return;
      }
      updateHUD(true);
      Game.draw?.();
      AudioEngine.SFX.click();
      AudioEngine.resume().then((ok) => {
        if (ok) {
          AudioEngine.SFX.unlockChime?.();
          if (!AudioEngine.isMuted?.()) AudioEngine.startMusic();
        }
      });
    }

    document.getElementById('start-btn').addEventListener('click', beginDefense);

    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioEngine.resume();
        const muted = AudioEngine.toggleMute();
        soundBtn.textContent = muted ? '🔇' : '🔊';
        if (typeof Settings !== 'undefined') Settings.set('muted', muted);
        if (!muted) {
          AudioEngine.SFX.click();
          if (typeof Game !== 'undefined' && Game.isPlaying()) AudioEngine.startMusic();
        }
      });
    }

    document.getElementById('howto-btn').addEventListener('click', () => {
      document.getElementById('howto-panel').classList.toggle('hidden');
    });

    document.getElementById('begin-day-btn')?.addEventListener('click', () => {
      AudioEngine.SFX.click();
      Game.beginDayPhase(true);
      UI.updateHUD(true);
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      gameOverShown = false;
      document.getElementById('gameover-screen').classList.remove('active');
      const mode = typeof GameModes !== 'undefined' ? GameModes.getMenu() : null;
      if (mode?.challengeType) {
        /* beginSession applies challenge difficulty */
      } else {
        Game.setDifficulty(selectedDifficulty);
      }
      Game.start();
    });

    document.querySelectorAll('.deploy-btn').forEach(btn => {
      btn.addEventListener('click', () => { Game.selectDeploy(btn.dataset.unit); updateHUD(); });
    });

    document.querySelectorAll('.ability-btn').forEach(btn => {
      btn.addEventListener('click', () => { Game.selectAbility(btn.dataset.ability); updateHUD(); });
    });

    document.querySelectorAll('.build-btn').forEach(btn => {
      btn.addEventListener('click', () => { Game.selectBuild(btn.dataset.build); updateHUD(); });
    });

    document.querySelectorAll('.spy-btn').forEach(btn => {
      btn.addEventListener('click', () => { Game.executeSpyAction(btn.dataset.spy); updateHUD(); });
    });

    document.querySelectorAll('.courier-btn').forEach(btn => {
      btn.addEventListener('click', () => { Game.sendCourierMessage(btn.dataset.courier); updateHUD(); });
    });

    document.querySelectorAll('.loadout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Game.setLoadout?.(btn.dataset.loadout);
        updateHUD();
      });
    });

    document.getElementById('hunt-toggle').addEventListener('click', () => {
      Game.toggleGlobalHunt();
      updateHUD();
    });

    document.getElementById('builder-repair-toggle')?.addEventListener('click', () => {
      Game.toggleBuilderAutoRepair?.();
      updateHUD();
    });

    document.getElementById('speed-toggle')?.addEventListener('click', () => {
      Game.cycleGameSpeed?.();
      updateHUD();
    });

    document.getElementById('demolish-btn')?.addEventListener('click', () => {
      Game.selectDemolish();
      updateHUD();
    });

    document.getElementById('move-building-btn')?.addEventListener('click', () => {
      Game.selectMoveBuilding();
      updateHUD();
    });

    document.getElementById('rotate-wall-btn')?.addEventListener('click', () => {
      Game.selectRotateWall();
      updateHUD();
    });

    const savedSpeed = typeof Settings !== 'undefined' ? Settings.get('gameSpeed') : 1;
    updateSpeedControl(savedSpeed ?? 1);
  }

  function updateSpeedControl(speed) {
    const n = parseFloat(speed);
    const speedBtn = document.getElementById('speed-toggle');
    if (speedBtn) {
      speedBtn.textContent = `SPEED: ${n}×`;
      speedBtn.classList.toggle('speed-active', n > 1);
    }
    document.querySelectorAll('.settings-speed-control .speed-btn').forEach(btn => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', btnSpeed === n);
    });
  }

  function updateButtonStates(gs) {
    const freeTp = gs.creativeMode && gs.creativeSettings?.freeResources;
    document.querySelectorAll('.deploy-btn').forEach(btn => {
      const type = btn.dataset.unit;
      const def = getPlayerUnitDef(type) || UnitDefs[type];
      const cost = def?.cost ?? 99;
      const oneOnly = type === 'general' && gs.hasGeneral;
      const doomOnly = type === 'doomslayer_hero' &&
        (!gs.doomslayerUnlocked || (!freeTp && gs.tactical < cost));
      const special = type === 'doomslayer_hero';
      const creativeDeployOff = gs.creativeMode && gs.creativeSettings && !gs.creativeSettings.academyDeploy;
      const deployBlocked = !special && creativeDeployOff;
      btn.classList.toggle('selected', type === gs.selectedDeploy);
      btn.classList.toggle('disabled', deployBlocked || (!freeTp && gs.tactical < cost) || oneOnly || doomOnly);
    });

    const doomBtn = document.getElementById('doomslayer-deploy');
    if (doomBtn) doomBtn.style.display = gs.doomslayerUnlocked ? '' : 'none';

    const wweBtn = document.getElementById('wwe-academy-open');
    if (wweBtn) wweBtn.style.display = gs.wweUnlocked ? '' : 'none';
    const crossBtn = document.getElementById('crossover-hub-open');
    if (crossBtn) crossBtn.style.display = gs.crossoverUnlocked ? '' : 'none';
    const perkSection = document.getElementById('perk-build-section');
    if (perkSection) perkSection.style.display = gs.perksUnlocked ? '' : 'none';
    document.querySelectorAll('.ability-btn').forEach(btn => {
      const id = btn.dataset.ability;
      const base = Abilities[id]?.cost ?? 99;
      const cost = freeTp ? 0
        : (typeof ContentExpansion !== 'undefined' && ContentExpansion.getAbilityCost
          ? ContentExpansion.getAbilityCost(id, base, gs.wave)
          : base);
      const costEl = btn.querySelector('.cost');
      if (costEl && costEl.textContent !== String(cost)) costEl.textContent = String(cost);
      btn.classList.toggle('selected', id === gs.selectedAbility);
      btn.classList.toggle('disabled', !freeTp && gs.tactical < cost);
    });
    document.querySelectorAll('.build-btn').forEach(btn => {
      const def = BuildDefs[btn.dataset.build];
      const cost = def?.cost ?? 99;
      const costEl = btn.querySelector('.cost');
      if (costEl && costEl.textContent !== String(cost)) costEl.textContent = String(cost);
      const buildType = btn.dataset.build;
      const isAcademyBuild = BuildDefs[buildType]?.isAcademy && !BuildDefs[buildType]?.isCrossoverBarracks
        && !BuildDefs[buildType]?.isWweAcademy;
      const academyBlocked = !gs.creativeMode && isAcademyBuild &&
        gs.buildableAcademies && !gs.buildableAcademies.includes(buildType);
      const builderBlocked = !gs.creativeSettings?.instantBuild &&
        def?.requiresBuilders && (gs.liveBuilders ?? 0) < def.requiresBuilders;
      btn.classList.toggle('selected', buildType === gs.selectedBuild);
      btn.classList.toggle('disabled', (!freeTp && gs.tactical < cost) || academyBlocked || builderBlocked);
    });
    document.querySelectorAll('.spy-btn').forEach(btn => {
      const cost = SpyActions[btn.dataset.spy]?.cost ?? 99;
      btn.classList.toggle('disabled', gs.tactical < cost || gs.spyUsedThisWave);
    });
    document.querySelectorAll('.courier-btn').forEach(btn => {
      const cost = CourierMessages[btn.dataset.courier]?.cost ?? 99;
      const emergMuster = btn.dataset.courier === 'muster';
      btn.classList.toggle('selected', btn.dataset.courier === gs.selectedCourierMsg);
      btn.classList.toggle('disabled', gs.tactical < cost || !gs.hasCourier || gs.courierCooldown > 0 || gs.courierUsedThisWave);
    });

    const loadoutSection = document.getElementById('loadout-section');
    if (loadoutSection) {
      loadoutSection.style.display = '';
      loadoutSection.querySelectorAll('.loadout-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.loadout === gs.loadout);
      });
    }

    const huntBtn = document.getElementById('hunt-toggle');
    if (huntBtn) huntBtn.textContent = `HUNT: ${gs.globalHunt ? 'ON' : 'OFF'}`;

    const repairBtn = document.getElementById('builder-repair-toggle');
    if (repairBtn) repairBtn.textContent = `REPAIR: ${gs.builderAutoRepair ? 'ON' : 'OFF'}`;

    updateSpeedControl(gs.gameSpeed ?? 1);

    const demolishBtn = document.getElementById('demolish-btn');
    if (demolishBtn) demolishBtn.classList.toggle('selected', gs.selectedDemolish);
    const moveBtn = document.getElementById('move-building-btn');
    if (moveBtn) {
      moveBtn.classList.toggle('selected', gs.selectedMoveBuilding);
      moveBtn.classList.toggle('pending', !!gs.moveBuildingTarget);
    }
    const rotateBtn = document.getElementById('rotate-wall-btn');
    if (rotateBtn) rotateBtn.classList.toggle('selected', gs.selectedRotateWall);

    const threatEl = document.getElementById('threat-text');
    if (threatEl) {
      const sides = gs.attackSides || ['north'];
      const labels = { north: 'N', east: 'E', west: 'W', south: 'S' };
      const flank = sides.length > 1 ? sides.map(s => labels[s] || s).join('+') : 'N';
      const threat = gs.generalThreat > 0 ? ` · GEN×${gs.generalThreat}` : '';
      const boss = gs.bossActive ? ' · BOSS' : '';
      const stand = gs.lastStandActive ? ' · STAND' : '';
      threatEl.textContent = `${flank}${threat}${boss}${stand}`;
      threatEl.className = 'stat-value threat-value' + (gs.generalThreat >= 2 || gs.bossActive ? ' threat-high' : '');
    }

    const colonyEl = document.getElementById('colony-value-text');
    if (colonyEl) {
      const cv = gs.colonyValue || 0;
      const ratio = gs.colonyThreatRatio || 1;
      const tier = gs.colonyThreatTier || '—';
      if (cv > 0) {
        colonyEl.textContent = `${cv} · ${ratio.toFixed(2)}×`;
        const b = gs.colonyBreakdown;
        colonyEl.title = b
          ? `${tier} kingdom — Army ${b.military} · Works ${b.structures} · Treasury ${b.economy}. Threat scales next wave size & composition.`
          : `${tier} kingdom strength`;
        colonyEl.style.color = ratio >= 1.7 ? '#ff6060' : ratio >= 1.3 ? '#e8a040' : ratio >= 0.95 ? '#c8c848' : '#88cc88';
      } else {
        colonyEl.textContent = '—';
        colonyEl.title = 'Kingdom value — grows with army, buildings, and TP reserves';
        colonyEl.style.color = '';
      }
    }

    const intelEl = document.getElementById('wave-intel-text');
    if (intelEl) {
      intelEl.textContent = gs.nextWaveIntel ? gs.nextWaveIntel.slice(0, 48) + (gs.nextWaveIntel.length > 48 ? '…' : '') : '—';
      intelEl.title = gs.nextWaveIntel || '';
    }

    const synHud = document.getElementById('syn-hud');
    const synEl = document.getElementById('syn-text');
    const syns = gs.factionSynergies || [];
    const hasCrossoverField = (gs.wweOnField || 0) + (gs.crossoverOnField || 0) > 0;
    if (synHud && synEl) {
      const show = hasCrossoverField && (syns.length > 0 || gs.seasonalEvent);
      synHud.style.display = show ? '' : 'none';
      if (show) {
        const parts = [];
        if (syns.length) parts.push(syns.slice(0, 2).join(' · '));
        if (gs.seasonalEvent) parts.push(`★ ${gs.seasonalEvent}`);
        synEl.textContent = parts.join(' | ').slice(0, 42) + (parts.join(' | ').length > 42 ? '…' : '');
        synEl.title = [
          syns.length ? `Active synergies: ${syns.join(', ')}` : '',
          gs.seasonalEvent ? `Seasonal: ${gs.seasonalEvent}` : '',
        ].filter(Boolean).join('\n');
        synEl.className = 'stat-value syn-value' + (syns.length >= 2 ? ' syn-active' : '');
      }
    }

    const cmdText = document.getElementById('cmd-text');
    if (cmdText && gs.generalAura?.strength > 0) {
      const a = gs.generalAura;
      cmdText.title = `Aura: morale +${(a.morale * 100).toFixed(0)}% · acc +${Math.round(a.accuracy)} · radius ${Math.round(a.radius)}`;
    }

    const tpRoundEl = document.getElementById('tp-round-text');
    if (tpRoundEl && (gs.settlementTpRaw ?? 0) > (gs.settlementTpCapped ?? 0)) {
      tpRoundEl.title = `Settlement bonus capped: ${gs.settlementTpCapped}/${gs.settlementTpRaw} raw`;
    }
  }

  let lastHudKey = '';

  function hudKey(gs) {
    return [
      gs.state, gs.tactical, gs.wave, gs.misses, gs.army,
      gs.selectedDeploy, gs.selectedAbility, gs.selectedBuild,
      gs.selectedDemolish, gs.selectedMoveBuilding, gs.selectedRotateWall, gs.pendingWallFacing,
      gs.moveBuildingTarget,
      gs.paused, gs.globalHunt, gs.courierUsedThisWave, gs.spyUsedThisWave,
      gs.waveProgress, gs.messages.length, gs.achievements?.unlocked,
      gs.difficulty, gs.rallyActive, gs.generalBuff, gs.hasGeneral, gs.generalStationed,
      gs.territoryTier, gs.academyEra, gs.canDeploy, gs.rtsEra,
      gs.settlementTpBonus, gs.liveBuilders, gs.difficultyPercent,
      gs.wweUnlocked, gs.doomslayerUnlocked, gs.hamletCount, gs.guildCount,
      gs.timeOfDay, gs.nightProgress,
      gs.generalThreat, gs.lastStandActive, gs.nextWaveIntel, gs.bossActive,
      gs.colonyValue, gs.colonyThreatRatio, gs.colonyThreatTier,
      gs.hybridAcademy, gs.builderAutoRepair, gs.settlementTpRaw,
      gs.creativeMode, gs.creativeTool, gs.creativeSpawnType, gs.selectedUnitId, gs.selectedUnitIds?.length,
      JSON.stringify(gs.creativeSettings),
      (gs.factionSynergies || []).join(','), gs.seasonalEvent,
      gs.enemyCount, gs.replayInfo?.recording, gs.replayInfo?.frameCount,
      gs.creativeCustomWave?.count, gs.sandboxStats?.spawns,
    ].join('|');
  }

  function updateHUD(force = false) {
    const gs = Game.getState();
    const key = hudKey(gs);
    if (!force && key === lastHudKey) {
      if (gs.creativeMode && typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
      return;
    }
    lastHudKey = key;

    const tpPool = Math.max(24, (gs.tpPerRound ?? TP_PER_ROUND) * 3);
    document.getElementById('tp-fill').style.width = `${Math.min(100, gs.tactical / tpPool * 100)}%`;
    document.getElementById('tp-text').textContent = Math.floor(gs.tactical);
    document.getElementById('misses-text').textContent = `${gs.misses} / ${gs.missLimit}`;
    const eco = gs.settlementTpBonus ?? 0;
    const tpRoundEl = document.getElementById('tp-round-text');
    if (tpRoundEl) {
      tpRoundEl.textContent = eco > 0
        ? `+${gs.tpPerRound ?? TP_PER_ROUND} (${eco}▲)`
        : `+${gs.tpPerRound ?? TP_PER_ROUND}`;
    }

    const waveText = document.getElementById('wave-text');
    const waveFill = document.getElementById('wave-fill');
    const armyText = document.getElementById('army-text');
    if (waveText) {
      const land = (gs.territoryTier ?? 0) > 0
        ? ` · Land ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][gs.territoryTier] || gs.territoryTier}`
        : '';
      waveText.textContent = gs.infiniteWaves ? `${gs.wave}${land}` : `${gs.wave} / ${gs.totalWaves}${land}`;
    }
    if (waveFill) {
      const prog = gs.timeOfDay === 'night'
        ? Math.round((gs.nightProgress ?? 0) * 100)
        : Math.round((gs.waveProgress ?? 0) * 100);
      waveFill.style.width = `${prog}%`;
      waveFill.classList.toggle('night-fill', gs.timeOfDay === 'night');
    }
    if (armyText) armyText.textContent = String(gs.army ?? 0);

    const cycleText = document.getElementById('cycle-text');
    const beginDayBtn = document.getElementById('begin-day-btn');
    if (cycleText) {
      if (gs.timeOfDay === 'night') {
        cycleText.textContent = 'NIGHT';
        cycleText.className = 'stat-value cycle-night';
      } else {
        const light = gs.dayLight ?? 1;
        cycleText.textContent = light < 0.72 ? 'DUSK' : 'DAY';
        cycleText.className = light < 0.72 ? 'stat-value cycle-dusk' : 'stat-value cycle-day';
      }
    }
    if (beginDayBtn) {
      beginDayBtn.style.display = gs.timeOfDay === 'night' ? '' : 'none';
      if (gs.timeOfDay === 'night') {
        const sec = gs.nightSecondsLeft ?? 0;
        const m = Math.floor(sec / 60);
        const s = String(sec % 60).padStart(2, '0');
        beginDayBtn.textContent = `BEGIN DAY (${m}:${s})`;
        beginDayBtn.title = 'Start the assault now (D)';
      }
    }

    const cmdText = document.getElementById('cmd-text');
    if (cmdText) {
      if (gs.generalBuff > 0) {
        cmdText.textContent = `${gs.generalBuff}%`;
        cmdText.className = 'stat-value cmd-value cmd-active';
      } else if (gs.hasGeneral) {
        cmdText.textContent = gs.generalStationed ? '—' : '→ KEEP';
        cmdText.className = 'stat-value cmd-value cmd-march';
      } else {
        cmdText.textContent = '—';
        cmdText.className = 'stat-value cmd-value';
      }
    }

    const diffText = document.getElementById('diff-text');
    if (diffText) {
      const pct = gs.difficultyPercent ?? 100;
      if (gs.creativeMode) {
        diffText.textContent = `Creative · ${gs.difficultyLabel ?? 'Normal'} ${pct}%`;
        diffText.className = 'stat-value diff-value diff-creative';
      } else {
        diffText.textContent = `${gs.difficultyLabel ?? 'Normal'} ${pct}%`;
        diffText.className = 'stat-value diff-value diff-' + (gs.difficulty ?? 'normal');
      }
    }
    const advPct = document.getElementById('advanced-diff-pct');
    if (advPct) advPct.textContent = `Effective: ${gs.difficultyPercent ?? 100}%`;

    if (typeof Achievements !== 'undefined') Achievements.updateTopBar();

    updateButtonStates(gs);

    const msgBox = document.getElementById('message-box');
    if (gs.messages.length > 0) {
      msgBox.textContent = gs.messages[gs.messages.length - 1].text;
      msgBox.classList.add('show');
    } else {
      msgBox.classList.remove('show');
    }

    if ((gs.state === 'victory' || gs.state === 'defeat') && !gameOverShown) {
      gameOverShown = true;
      const title = document.getElementById('result-title');
      title.textContent = gs.state === 'victory' ? 'VICTORY!' : 'DEFEAT';
      title.className = gs.state;
      const ach = gs.achievements || { unlocked: 0, total: 316 };
      document.getElementById('result-stats').innerHTML =
        `Difficulty: ${gs.difficultyLabel ?? 'Normal'}<br>Waves: ${gs.wave - 1}<br>Kills: ${gs.kills}<br>Breakthroughs: ${gs.misses}<br>Achievements: ${ach.unlocked} / ${ach.total}`;
      if (typeof UX !== 'undefined') UX.renderPostGameHighlights(gs);
      document.getElementById('gameover-screen').classList.add('active');
    }

    if (typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
    if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
    if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic();
  }

  return { init, updateHUD, updateSpeedControl, getSelectedDifficulty: () => selectedDifficulty };
})();