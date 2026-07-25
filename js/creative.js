/**
 * Creative Mode — sandbox / practice lab (BTD6-style).
 */
const CreativeMode = (() => {
  const DEFAULT_OPTS = {
    freeResources: true,
    noGameOver: true,
    noAutoCycle: true,
    instantBuild: true,
    unlockAll: true,
    academyDeploy: true,
    enableAchievements: false,
    useCampaignRules: false,
    startTp: 9999,
    startWave: 0,
  };

  let panelOpen = true;

  function enemySpawnOptions() {
    return Object.entries(EnemyDefs)
      .map(([id, d]) => `<option value="${id}">${d.name}</option>`)
      .join('');
  }

  function allySpawnOptions() {
    const ids = Object.keys(UnitDefs || {});
    const crossover = typeof CrossoverDefs !== 'undefined' ? Object.keys(CrossoverDefs) : [];
    const wwe = typeof WweDefs !== 'undefined' ? Object.keys(WweDefs) : [];
    const all = [...new Set([...ids, ...crossover, ...wwe, 'doomslayer_hero'])];
    return all
      .map((id) => {
        const d = getPlayerUnitDef?.(id) || CrossoverDefs?.[id] || WweDefs?.[id] || EnemyDefs[id];
        return `<option value="${id}">${d?.name || id}</option>`;
      })
      .join('');
  }

  function playerBuildingOptions() {
    return Object.entries(BuildDefs)
      .filter(([, d]) => d.owner !== 'enemy' && !d.isEnemySettlement)
      .map(([id, d]) => `<option value="${id}">${d.name}</option>`)
      .join('');
  }

  function enemyBuildingOptions() {
    return Object.entries(BuildDefs)
      .filter(([id]) => id.startsWith('enemy_'))
      .map(([id, d]) => `<option value="${id}">${d.name}</option>`)
      .join('');
  }

  function renderSelectedUnit(gs) {
    const el = document.getElementById('creative-unit-info');
    if (!el) return;
    if (!gs?.selectedUnitId) {
      el.textContent = 'Click a unit on the map to select it.';
      return;
    }
    const u = Game.getUnitById?.(gs.selectedUnitId);
    if (!u || u.hp <= 0) {
      el.textContent = 'Selected unit is gone — click another.';
      return;
    }
    const name = typeof unitDisplayName === 'function' ? unitDisplayName(u) : u.type;
    const stars = `★${u.vetBronze || 0} ◆${u.vetSilver || 0} ♛${u.vetGold || 0}`;
    el.innerHTML = `<strong>${name}</strong> (${u.team})<br>HP ${Math.ceil(u.hp)}/${u.maxHp} · DMG ${u.damage} · ACC ${u.accuracy}<br>${stars} · Morale ${Math.ceil(u.morale)}`;
    Game.creativeFillStatEditorFromSelection?.();
  }

  function renderSandboxStats(gs) {
    const el = document.getElementById('creative-sandbox-stats');
    if (!el) return;
    const s =
      gs?.sandboxStats ||
      (typeof CreativeTools !== 'undefined' ? CreativeTools.getSandboxStats() : null);
    if (!s) {
      el.textContent = '';
      return;
    }
    el.textContent = `Sandbox: ${s.sessions} sessions · ${s.spawns} spawns · ${s.wavesLaunched} custom waves · achievements ${gs?.creativeSettings?.enableAchievements ? 'ON' : 'OFF'}`;
  }

  function renderWavePreview(gs) {
    const el = document.getElementById('creative-wave-preview');
    if (!el) return;
    const cw = gs?.creativeCustomWave;
    el.textContent = cw
      ? `Queued: ${cw.count || cw.queue?.length || 0} @ ${cw.interval}ms — ${(cw.text || '').slice(0, 60)}`
      : 'No custom wave queued.';
  }

  function renderReplayStatus(gs) {
    const el = document.getElementById('creative-replay-status');
    if (!el) return;
    const r = gs?.replayInfo;
    if (!r) {
      el.textContent = '';
      return;
    }
    const stress = r.stress?.active
      ? ` · Horde ${r.stress.type} (${gs.enemyCount || 0}/${r.stress.max})`
      : '';
    el.textContent = `${r.recording ? '● REC' : r.replayPlaying ? '▶ REPLAY' : '○'} ${r.frameCount} frames @ ${r.frameIndex}${stress}`;
  }

  function renderPresetButtons() {
    const row = document.getElementById('creative-preset-row');
    if (!row || typeof CreativeTools === 'undefined') return;
    row.innerHTML = CreativeTools.getUnitPresets()
      .map(
        (p) =>
          `<button type="button" class="creative-btn creative-preset-btn" data-preset="${p.id}">${p.label}</button>`
      )
      .join('');
    row.querySelectorAll('.creative-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = Game.getUnitById?.(Game.getState()?.selectedUnitId);
        if (!u) {
          Game.showMessage?.('Select a unit first.');
          return;
        }
        CreativeTools.applyUnitPreset(btn.dataset.preset, u);
        UI.updateHUD(true);
      });
    });
  }

  function syncToggles(gs) {
    const s = gs?.creativeSettings || DEFAULT_OPTS;
    document.getElementById('creative-free-tp')?.toggleAttribute('checked', !!s.freeResources);
    document.getElementById('creative-no-death')?.toggleAttribute('checked', !!s.noGameOver);
    document.getElementById('creative-manual-waves')?.toggleAttribute('checked', !!s.noAutoCycle);
    document.getElementById('creative-instant-build')?.toggleAttribute('checked', !!s.instantBuild);
    document.getElementById('creative-unlock-all')?.toggleAttribute('checked', !!s.unlockAll);
    document.getElementById('creative-academy-off')?.toggleAttribute('checked', !!s.academyDeploy);
    document
      .getElementById('creative-campaign-rules')
      ?.toggleAttribute('checked', !!s.useCampaignRules);
    document
      .getElementById('creative-enable-ach')
      ?.toggleAttribute('checked', !!s.enableAchievements);
    const waveInput = document.getElementById('creative-wave-input');
    if (waveInput && document.activeElement !== waveInput) waveInput.value = String(gs?.wave ?? 0);
    renderSelectedUnit(gs);
    renderSandboxStats(gs);
    renderWavePreview(gs);
    renderReplayStatus(gs);
  }

  function showInGame(show) {
    const panel = document.getElementById('creative-panel');
    const toggle = document.getElementById('creative-panel-toggle');
    const hint = document.getElementById('hint-bar');
    if (panel) panel.style.display = show && panelOpen ? '' : 'none';
    if (toggle) toggle.style.display = show ? '' : 'none';
    if (hint && show) {
      hint.textContent =
        'CREATIVE LAB — P panel · Level Editor · spawn tools · wave composer · scenarios';
    } else if (hint && !show) {
      hint.textContent =
        'Day = assault · Night = prep (+35% build) · Drag map · Scroll zoom · Wave 100: Academy · Wave 200: Enemy settlements';
    }
  }

  function togglePanel() {
    if (!Game.isCreativeMode?.()) return;
    panelOpen = !panelOpen;
    const panel = document.getElementById('creative-panel');
    if (panel) panel.style.display = panelOpen ? '' : 'none';
    AudioEngine?.SFX?.click?.();
  }

  function bindToggle(id, key) {
    document.getElementById(id)?.addEventListener('change', (e) => {
      if (key === 'useCampaignRules') {
        Game.applyCampaignRulesPreset?.(e.target.checked);
      } else {
        Game.setCreativeSetting?.(key, e.target.checked);
      }
      UI.updateHUD(true);
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => Game.showMessage?.('Copied to clipboard.', 140));
    } else {
      const ta = document.getElementById('creative-import-area');
      if (ta) {
        ta.value = text;
        ta.select();
      }
      Game.showMessage?.('JSON placed in import box.', 140);
    }
  }

  function populateSelects() {
    const enemySel = document.getElementById('creative-enemy-select');
    if (enemySel) enemySel.innerHTML = enemySpawnOptions();
    const ebSel = document.getElementById('creative-enemy-build-select');
    if (ebSel) ebSel.innerHTML = enemyBuildingOptions();
    const allySel = document.getElementById('creative-ally-select');
    if (allySel) allySel.innerHTML = allySpawnOptions();
    const abSel = document.getElementById('creative-ally-build-select');
    if (abSel) abSel.innerHTML = playerBuildingOptions();
    const stressSel = document.getElementById('creative-stress-type');
    if (stressSel) stressSel.innerHTML = enemySpawnOptions();
    const tplSel = document.getElementById('creative-template-select');
    if (tplSel && typeof CreativeTools !== 'undefined') {
      tplSel.innerHTML = CreativeTools.getTemplates()
        .map((t) => `<option value="${t.id}">${t.name}</option>`)
        .join('');
    }
    renderPresetButtons();
  }

  function init() {
    if (typeof LevelEditor !== 'undefined') LevelEditor.init();
    populateSelects();

    document.getElementById('creative-start-btn')?.addEventListener('click', () => {
      AudioEngine.resume().then((ok) => {
        if (ok) AudioEngine.SFX.unlockChime();
        AudioEngine.SFX.click();
        UI.hideMenusForPlay?.();
        Game.setDifficulty(UI.getSelectedDifficulty?.() || 'normal');
        Game.startCreative();
        Achievements?.tryUnlock('creative_sandbox');
        showInGame(true);
        syncToggles(Game.getState());
        UI.updateHUD(true);
      });
    });

    document.getElementById('creative-panel-toggle')?.addEventListener('click', togglePanel);
    document.getElementById('creative-close-panel')?.addEventListener('click', togglePanel);

    bindToggle('creative-free-tp', 'freeResources');
    bindToggle('creative-no-death', 'noGameOver');
    bindToggle('creative-manual-waves', 'noAutoCycle');
    bindToggle('creative-instant-build', 'instantBuild');
    bindToggle('creative-unlock-all', 'unlockAll');
    bindToggle('creative-academy-off', 'academyDeploy');
    bindToggle('creative-campaign-rules', 'useCampaignRules');
    bindToggle('creative-enable-ach', 'enableAchievements');

    document.getElementById('creative-wave-apply')?.addEventListener('click', () => {
      const n = parseInt(document.getElementById('creative-wave-input')?.value, 10) || 0;
      Game.creativeSetWave(n);
      UI.updateHUD(true);
    });

    document.getElementById('creative-add-tp')?.addEventListener('click', () => {
      Game.creativeAddTp(500);
      UI.updateHUD(true);
    });

    document.getElementById('creative-force-night')?.addEventListener('click', () => {
      Game.creativeForceNight();
      UI.updateHUD(true);
    });
    document.getElementById('creative-force-day')?.addEventListener('click', () => {
      Game.creativeForceDay();
      UI.updateHUD(true);
    });
    document.getElementById('creative-start-wave')?.addEventListener('click', () => {
      Game.creativeStartWave();
      UI.updateHUD(true);
    });
    document.getElementById('creative-clear-wave')?.addEventListener('click', () => {
      Game.creativeClearWaveSpawns();
      UI.updateHUD(true);
    });

    document.getElementById('creative-clear-enemies')?.addEventListener('click', () => {
      Game.creativeClearEnemies();
      UI.updateHUD(true);
    });
    document.getElementById('creative-clear-enemy-buildings')?.addEventListener('click', () => {
      Game.creativeClearEnemyBuildings();
      UI.updateHUD(true);
    });
    document.getElementById('creative-heal-all')?.addEventListener('click', () => {
      Game.creativeHealAll();
      UI.updateHUD(true);
    });
    document.getElementById('creative-max-morale')?.addEventListener('click', () => {
      Game.creativeMaxMorale();
      UI.updateHUD(true);
    });

    document.getElementById('creative-arm-enemy')?.addEventListener('click', () => {
      const type = document.getElementById('creative-enemy-select')?.value || 'goblin';
      Game.creativeSetTool('spawn_enemy', type);
      UI.updateHUD(true);
    });
    document.getElementById('creative-arm-enemy-building')?.addEventListener('click', () => {
      const type = document.getElementById('creative-enemy-build-select')?.value || 'enemy_hamlet';
      Game.creativeSetTool('spawn_enemy_building', type);
      UI.updateHUD(true);
    });
    document.getElementById('creative-arm-ally')?.addEventListener('click', () => {
      const type = document.getElementById('creative-ally-select')?.value || 'footman';
      Game.creativeSetTool('spawn_player', type);
      UI.updateHUD(true);
    });
    document.getElementById('creative-arm-ally-build')?.addEventListener('click', () => {
      const type = document.getElementById('creative-ally-build-select')?.value || 'wall';
      Game.creativeSetTool('spawn_player_building', type);
      UI.updateHUD(true);
    });
    document.getElementById('creative-arm-squad')?.addEventListener('click', () => {
      const type = document.getElementById('creative-squad-select')?.value || 'line';
      Game.creativeSetTool('spawn_squad', type);
      UI.updateHUD(true);
    });
    document.getElementById('creative-disarm-tool')?.addEventListener('click', () => {
      Game.creativeSetTool(null);
      UI.updateHUD(true);
    });

    document.getElementById('creative-rank-up')?.addEventListener('click', () => {
      Game.creativeRankUpSelected();
      UI.updateHUD(true);
    });
    document.getElementById('creative-max-stars')?.addEventListener('click', () => {
      Game.creativeMaxStarsSelected();
      UI.updateHUD(true);
    });
    document.getElementById('creative-heal-unit')?.addEventListener('click', () => {
      Game.creativeHealSelected();
      UI.updateHUD(true);
    });
    document.getElementById('creative-kill-unit')?.addEventListener('click', () => {
      Game.creativeKillSelected();
      UI.updateHUD(true);
    });
    document.getElementById('creative-promote-gen')?.addEventListener('click', () => {
      Game.creativePromoteSelectedGeneral();
      UI.updateHUD(true);
    });

    document.getElementById('creative-apply-stats')?.addEventListener('click', () => {
      Game.creativeApplyStatEditor();
      UI.updateHUD(true);
    });
    document.getElementById('creative-reset-stats')?.addEventListener('click', () => {
      Game.creativeResetUnitToDef();
      UI.updateHUD(true);
    });

    document.getElementById('creative-apply-template')?.addEventListener('click', () => {
      const id = document.getElementById('creative-template-select')?.value;
      if (id && typeof CreativeTools !== 'undefined') CreativeTools.applyTemplate(id);
      UI.updateHUD(true);
    });

    document.getElementById('creative-parse-wave')?.addEventListener('click', () => {
      const text = document.getElementById('creative-wave-composer')?.value || '';
      const interval = parseInt(document.getElementById('creative-wave-interval')?.value, 10) || 50;
      Game.setCustomWave?.({ text, interval });
      UI.updateHUD(true);
    });
    document.getElementById('creative-launch-wave')?.addEventListener('click', () => {
      Game.creativeLaunchCustomWave?.();
      UI.updateHUD(true);
    });

    document.getElementById('creative-stress-start')?.addEventListener('click', () => {
      const type = document.getElementById('creative-stress-type')?.value || 'goblin';
      const every = parseInt(document.getElementById('creative-stress-rate')?.value, 10) || 30;
      const max = parseInt(document.getElementById('creative-stress-max')?.value, 10) || 150;
      CreativeTools?.setStress({ active: true, type, every, max });
      Game.showMessage?.(`Stress horde: ${type} every ${every} ticks (max ${max})`, 220);
      UI.updateHUD(true);
    });
    document.getElementById('creative-stress-stop')?.addEventListener('click', () => {
      CreativeTools?.setStress({ active: false });
      UI.updateHUD(true);
    });
    document.getElementById('creative-perf-hint')?.addEventListener('click', () => {
      Perf?.toggleOverlay?.();
    });

    document.getElementById('creative-record-start')?.addEventListener('click', () => {
      const n = CreativeTools?.startRecording() || 0;
      Game.showMessage?.(`Recording started (${n} frames).`, 160);
      UI.updateHUD(true);
    });
    document.getElementById('creative-record-stop')?.addEventListener('click', () => {
      const n = CreativeTools?.stopRecording() || 0;
      Game.showMessage?.(`Recording stopped — ${n} frames.`, 180);
      UI.updateHUD(true);
    });
    document.getElementById('creative-replay-step')?.addEventListener('click', () => {
      CreativeTools?.playReplay(1);
      UI.updateHUD(true);
    });
    document.getElementById('creative-replay-back')?.addEventListener('click', () => {
      CreativeTools?.rewindReplay();
      UI.updateHUD(true);
    });

    document.getElementById('creative-export-scenario')?.addEventListener('click', () => {
      const name = prompt('Scenario name:', 'My Scenario') || 'Scenario';
      const json = CreativeTools?.serializeScenario(name);
      if (json) copyToClipboard(json);
    });
    document.getElementById('creative-export-replay')?.addEventListener('click', () => {
      const json = CreativeTools?.exportReplay();
      if (json) copyToClipboard(json);
    });
    document.getElementById('creative-import-scenario')?.addEventListener('click', () => {
      const raw = document.getElementById('creative-import-area')?.value?.trim();
      if (!raw) {
        Game.showMessage?.('Paste JSON in the import box.');
        return;
      }
      if (raw.includes('"type":"replay"') || raw.includes('"frames"')) {
        const n = CreativeTools?.importReplay(raw);
        Game.showMessage?.(n ? `Replay loaded: ${n} frames.` : 'Replay import failed.');
      } else {
        const res = CreativeTools?.deserializeScenario(raw);
        Game.showMessage?.(res?.ok ? `Imported: ${res.name}` : res?.msg || 'Import failed.');
      }
      UI.updateHUD(true);
    });

    document.getElementById('creative-regen-map')?.addEventListener('click', () => {
      Game.creativeRegenerateMap?.();
      UI.updateHUD(true);
    });
    document.getElementById('creative-reload-panel')?.addEventListener('click', () => {
      populateSelects();
      syncToggles(Game.getState());
      Game.showMessage?.('Creative panel refreshed.', 120);
    });
  }

  function onHudUpdate(gs) {
    if (!gs?.creativeMode) {
      showInGame(false);
      return;
    }
    const toolEl = document.getElementById('creative-tool-status');
    if (toolEl) {
      const armed = !!gs.creativeTool;
      toolEl.classList.toggle('armed', armed);
      if (!gs.creativeTool) {
        toolEl.textContent = 'Click tool: none (select unit / build normally)';
      } else if (gs.creativeTool === 'spawn_enemy') {
        toolEl.textContent = `⚔ Armed: spawn ${EnemyDefs[gs.creativeSpawnType]?.name || gs.creativeSpawnType} — click map`;
      } else if (gs.creativeTool === 'spawn_enemy_building') {
        toolEl.textContent = `🏚 Armed: place ${BuildDefs[gs.creativeSpawnType]?.name || gs.creativeSpawnType} — click map`;
      } else if (gs.creativeTool === 'spawn_player') {
        toolEl.textContent = `🛡 Armed: deploy ${getPlayerUnitDef?.(gs.creativeSpawnType)?.name || gs.creativeSpawnType} — click map`;
      } else if (gs.creativeTool === 'spawn_player_building') {
        toolEl.textContent = `🏰 Armed: place ${BuildDefs[gs.creativeSpawnType]?.name || gs.creativeSpawnType} — click map`;
      } else if (gs.creativeTool === 'spawn_squad') {
        toolEl.textContent = `👥 Armed: squad "${gs.creativeSpawnType}" — click map`;
      }
    }
    document
      .getElementById('creative-arm-enemy')
      ?.classList.toggle('armed-tool', gs.creativeTool === 'spawn_enemy');
    document
      .getElementById('creative-arm-enemy-building')
      ?.classList.toggle('armed-tool', gs.creativeTool === 'spawn_enemy_building');
    document
      .getElementById('creative-arm-ally')
      ?.classList.toggle('armed-tool', gs.creativeTool === 'spawn_player');
    document
      .getElementById('creative-arm-ally-build')
      ?.classList.toggle('armed-tool', gs.creativeTool === 'spawn_player_building');
    document
      .getElementById('creative-arm-squad')
      ?.classList.toggle('armed-tool', gs.creativeTool === 'spawn_squad');
    const masteryHint = document.getElementById('creative-mastery-hint');
    if (masteryHint) {
      const skins = gs.creativeFactionSkins?.length || 0;
      const titles = Object.keys(gs.factionMasteryTitles || {}).length;
      masteryHint.textContent =
        skins || titles
          ? `Faction mastery: ${titles} title(s) · ${skins} Creative skin(s) earned`
          : 'Earn faction mastery (tier 3 titles, tier 4 Creative skins) in campaign runs';
    }
    if (typeof LevelEditor !== 'undefined') LevelEditor.onHudUpdate(gs);
    syncToggles(gs);
  }

  return { init, togglePanel, onHudUpdate, showInGame };
})();
