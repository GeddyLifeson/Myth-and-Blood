/**
 * UI controller — panels, HUD, specialists.
 */
const UI = (() => {
  const OVERLAY_SCREEN_IDS = [
    'menu-screen',
    'pause-screen',
    'gameover-screen',
    'settings-screen',
    'achievements-screen',
    'advanced-diff-screen',
    'cheats-screen',
    'encyclopedia-screen',
    'crossover-screen',
    'wwe-screen',
  ];

  function setPlayingUi(active) {
    document.body.classList.toggle('game-playing', active);
    document.body.classList.toggle('menu-dismissed', active);
  }

  function setLaunchOverlayVisible(visible) {
    const el = document.getElementById('launch-overlay');
    if (!el) return;
    el.hidden = !visible;
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function dismissMenuScreen() {
    const menu = document.getElementById('menu-screen');
    if (!menu) return;
    menu.classList.remove('active');
    menu.classList.add('menu-dismissed');
    menu.hidden = true;
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden', 'true');
    menu.setAttribute('inert', '');
  }

  function restoreMenuScreen() {
    const menu = document.getElementById('menu-screen');
    if (!menu) return;
    menu.classList.remove('menu-dismissed');
    menu.hidden = false;
    menu.style.display = '';
    menu.removeAttribute('aria-hidden');
    menu.removeAttribute('inert');
    menu.classList.add('active');
  }

  /** Keep the main menu hidden whenever a run is active (self-heals partial boot failures). */
  function ensureMenuDismissedForPlay() {
    if (!Game.isPlaying?.()) return;
    setPlayingUi(true);
    dismissMenuScreen();
    // Do not strip pause/settings/encyclopedia — those are opened intentionally during play.
  }

  function hideMenusForPlay(opts = {}) {
    const showLaunch = opts.showLaunch !== false;
    // Hide menu before closing overlays — Settings/Encyclopedia close must not block dismissal.
    setPlayingUi(true);
    dismissMenuScreen();
    for (const id of OVERLAY_SCREEN_IDS) {
      document.getElementById(id)?.classList.remove('active');
    }
    document.getElementById('howto-panel')?.classList.add('hidden');
    try {
      if (typeof Settings !== 'undefined' && Settings.isOpen?.()) Settings.close?.();
      if (typeof Encyclopedia !== 'undefined' && Encyclopedia.isOpen?.()) Encyclopedia.close?.();
      if (typeof FactionIntel !== 'undefined' && FactionIntel.isPanelOpen?.()) {
        FactionIntel.closePanel?.();
      }
    } catch (err) {
      console.warn('hideMenusForPlay: overlay close failed', err);
    }
    if (showLaunch) setLaunchOverlayVisible(true);
    // Force style/layout commit before long synchronous Game.start (Planet Conquest boot).
    void document.body.offsetHeight;
    document.getElementById('menu-screen')?.getBoundingClientRect();
  }

  /** rAF alone can run before paint; yield once more so the menu actually disappears. */
  function deferAfterPaint(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(fn, 0));
    } else {
      setTimeout(fn, 0);
    }
  }

  function showMainMenu() {
    setLaunchOverlayVisible(false);
    for (const id of OVERLAY_SCREEN_IDS) {
      document.getElementById(id)?.classList.remove('active');
    }
    setPlayingUi(false);
    restoreMenuScreen();
  }

  let gameOverShown = false;
  let defenseStartInFlight = false;
  let selectedDifficulty = 'normal';
  const hudEls = {};
  const hudBtns = {
    deploy: [],
    ability: [],
    build: [],
    spy: [],
    courier: [],
    loadout: [],
    formation: [],
  };

  function updateDifficultyUI(id) {
    selectedDifficulty = id;
    const def = getDifficultyDef(id);
    document.querySelectorAll('.diff-btn').forEach((btn) => {
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

  /**
   * Side-panel section nav (UI v2).
   * All sections stay visible and scrollable — tabs jump to a section (nothing is hidden).
   */
  function initSidePanelTabs() {
    document.querySelectorAll('.side-panel').forEach((panel) => {
      const tabs = panel.querySelectorAll('.side-tab[data-side-tab]');
      const panes = panel.querySelectorAll('.side-tab-pane[data-side-pane]');
      const scroller = panel.querySelector('.side-panel-scroll');
      if (!tabs.length || !panes.length) return;

      // Always show every section — the hide-by-tab model buried Build/Spells/Academies.
      panes.forEach((pane) => {
        pane.removeAttribute('hidden');
        pane.classList.add('active');
      });

      function setActiveTab(id) {
        tabs.forEach((tab) => {
          const on = tab.dataset.sideTab === id;
          tab.classList.toggle('active', on);
          tab.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }

      function scrollToPane(id) {
        const pane = panel.querySelector(`.side-tab-pane[data-side-pane="${id}"]`);
        if (!pane || !scroller) return;
        setActiveTab(id);
        const top = pane.offsetTop - scroller.offsetTop - 4;
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }

      tabs.forEach((tab) => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = tab.dataset.sideTab;
          if (!id) return;
          scrollToPane(id);
          if (typeof AudioEngine !== 'undefined') AudioEngine.SFX?.click?.();
        });
      });

      // Highlight the nav chip for whichever section is most visible while scrolling.
      if (scroller && typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver(
          (entries) => {
            let best = null;
            let bestRatio = 0;
            for (const ent of entries) {
              if (ent.isIntersecting && ent.intersectionRatio > bestRatio) {
                bestRatio = ent.intersectionRatio;
                best = ent.target;
              }
            }
            if (best?.dataset?.sidePane) setActiveTab(best.dataset.sidePane);
          },
          { root: scroller, threshold: [0.15, 0.35, 0.55] }
        );
        panes.forEach((pane) => io.observe(pane));
      }

      panel._scrollToSidePane = scrollToPane;
    });
  }

  /**
   * When a deploy/build/ability is selected, scroll its section into view.
   */
  function revealPanelControl(el) {
    if (!el) return;
    const pane = el.closest?.('.side-tab-pane');
    const panel = el.closest?.('.side-panel');
    if (!pane || !panel) return;
    const id = pane.dataset.sidePane;
    if (!id) return;
    if (typeof panel._scrollToSidePane === 'function') panel._scrollToSidePane(id);
    else {
      pane.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function init() {
    document.body.classList.add('ui-v2');
    // Ensure no pane stays HTML-hidden before wiring nav (legacy tab markup).
    document.querySelectorAll('.side-tab-pane[hidden]').forEach((p) => p.removeAttribute('hidden'));
    initSidePanelTabs();
    MetaProgress.load();
    if (typeof Achievements !== 'undefined') Achievements.init();
    if (typeof Encyclopedia !== 'undefined') Encyclopedia.init();
    if (typeof Cheats !== 'undefined') Cheats.init();
    if (typeof AdvancedDifficulty !== 'undefined') AdvancedDifficulty.init();
    if (typeof Research !== 'undefined') Research.init();
    if (typeof GameModes !== 'undefined') GameModes.init();
    if (typeof Onboarding !== 'undefined') Onboarding.init();
    if (typeof WweAcademy !== 'undefined') WweAcademy.init();
    if (typeof CrossoverHub !== 'undefined') CrossoverHub.init();
    if (typeof CreativeMode !== 'undefined') CreativeMode.init();
    if (typeof Tooltips !== 'undefined') Tooltips.init();
    if (typeof FactionIntel !== 'undefined') FactionIntel.init();
    // Grand Strategy / Intergalactic removed — pure wave defense.

    const titleCanvas = document.getElementById('title-art');
    function paintTitleArt() {
      if (!titleCanvas) return;
      const menu = document.getElementById('menu-screen');
      if (menu?.classList.contains('active')) {
        if (typeof VisualPolish !== 'undefined') VisualPolish.update();
        const tctx = titleCanvas.getContext('2d');
        if (typeof VisualPolish !== 'undefined')
          VisualPolish.drawTitleArt(tctx, titleCanvas.width, titleCanvas.height);
        else SpriteGen.drawTitleArt(tctx, titleCanvas.width, titleCanvas.height);
      }
      requestAnimationFrame(paintTitleArt);
    }
    paintTitleArt();

    function syncMenuMusic() {
      if (typeof AudioEngine === 'undefined') return;
      const menuActive = document.getElementById('menu-screen')?.classList.contains('active');
      const playing = Game.isPlaying?.();
      if (menuActive && !playing) {
        AudioEngine.resume().then((ok) => {
          if (ok && !AudioEngine.isMuted?.()) AudioEngine.startMenuMusic?.();
        });
      } else if (playing) {
        /* battle music handled by Game.start */
      }
    }
    syncMenuMusic();
    // First gesture unlocks Web Audio (browsers block autoplay) and starts menu theme.
    document.addEventListener('pointerdown', () => syncMenuMusic(), { once: false, passive: true });
    document.addEventListener('keydown', () => syncMenuMusic(), { once: false });

    document.getElementById('menu-quit-btn')?.addEventListener('click', () => {
      AudioEngine?.SFX?.click?.();
      if (window.electronAPI?.quitApp) window.electronAPI.quitApp();
      else window.close();
    });

    refreshPanelIcons();
    cacheHudDom();

    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        AudioEngine.SFX.click();
        updateDifficultyUI(btn.dataset.diff);
      });
      btn.addEventListener(
        'pointerenter',
        () => {
          if (!AudioEngine.isMuted?.()) AudioEngine.SFX.uiHover?.();
        },
        { passive: true }
      );
    });
    // Soft hover tick on main HUD action buttons (throttled by engine volume / mute).
    document
      .querySelectorAll('.deploy-btn, .build-btn, .ability-btn, .menu-btn, .start-btn')
      .forEach((btn) => {
        let last = 0;
        btn.addEventListener(
          'pointerenter',
          () => {
            const now = performance.now();
            if (now - last < 80) return;
            last = now;
            if (!AudioEngine.isMuted?.()) AudioEngine.SFX.uiHover?.();
          },
          { passive: true }
        );
      });
    updateDifficultyUI(selectedDifficulty);
    refreshCrownLegaciesPanel();
    refreshEternalLegacyPanel();

    document.getElementById('eternal-legacy-tree')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.eternal-legacy-node-btn');
      if (!btn || typeof EternalLegacyTree === 'undefined') return;
      const result = EternalLegacyTree.investNode(btn.dataset.node);
      if (result.ok) AudioEngine.SFX.click?.();
      refreshEternalLegacyPanel();
      refreshCrownLegaciesPanel();
    });

    document.getElementById('crown-legacies-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.crown-legacy-btn');
      if (!btn || btn.classList.contains('locked') || typeof CrownLegacies === 'undefined') return;
      const result = CrownLegacies.toggleLegacy(btn.dataset.legacy);
      if (!result.ok && result.reason === 'full') {
        AudioEngine.SFX.click?.();
      }
      refreshCrownLegaciesPanel();
    });

    document.getElementById('crown-heirs-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.crown-heir-btn');
      if (!btn || typeof CrownLegacies === 'undefined') return;
      CrownLegacies.toggleHeir(btn.dataset.heir);
      refreshCrownLegaciesPanel();
    });

    function beginDefense() {
      if (defenseStartInFlight) return;
      defenseStartInFlight = true;
      gameOverShown = false;
      if (typeof Onboarding !== 'undefined') Onboarding.prepareCampaignStart();
      Game.setDifficulty(selectedDifficulty);
      hideMenusForPlay({ showLaunch: true });
      AudioEngine.SFX.uiConfirm?.();
      AudioEngine.stopMusic();
      deferAfterPaint(() => {
        try {
          Game.start();
        } catch (err) {
          console.error('Game.start failed', err);
          setLaunchOverlayVisible(false);
          if (Game.isPlaying?.()) {
            ensureMenuDismissedForPlay();
            Game.showMessage?.(
              `Run started with errors — ${err?.message || 'unknown error'}. Press F10 to report if gameplay is wrong.`,
              480
            );
          } else {
            showMainMenu();
            Game.showMessage?.(
              `Could not start — ${err?.message || 'unknown error'}. Check the console for details.`,
              420
            );
            AudioEngine.resume().then((ok) => {
              if (ok && !AudioEngine.isMuted?.()) AudioEngine.startMenuMusic?.();
            });
          }
          defenseStartInFlight = false;
          return;
        }
        setLaunchOverlayVisible(false);
        ensureMenuDismissedForPlay();
        updateHUD(true);
        Game.draw?.();
        AudioEngine.SFX.click();
        AudioEngine.resume().then((ok) => {
          if (ok) {
            AudioEngine.SFX.unlockChime?.();
            if (!AudioEngine.isMuted?.()) AudioEngine.startMusic();
          }
        });
        defenseStartInFlight = false;
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
          else syncMenuMusic();
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
      const goScreen = document.getElementById('gameover-screen');
      goScreen?.classList.remove('active', 'gameover-victory', 'gameover-defeat', 'gameover-economy', 'gameover-conquest');
      document.getElementById('gameover-confetti')?.replaceChildren();
      hideMenusForPlay();
      const mode = typeof GameModes !== 'undefined' ? GameModes.getMenu() : null;
      if (mode?.challengeType) {
        /* beginSession applies challenge difficulty */
      } else {
        Game.setDifficulty(selectedDifficulty);
      }
      deferAfterPaint(() => {
        try {
          Game.start();
        } catch (err) {
          console.error('Game.start failed on restart', err);
          showMainMenu();
          return;
        }
        setLaunchOverlayVisible(false);
        updateHUD(true);
        Game.draw?.();
      });
    });

    document.getElementById('left-panel')?.addEventListener('click', (e) => {
      const deploy = e.target.closest('.deploy-btn');
      if (deploy?.dataset.unit) {
        Game.selectDeploy(deploy.dataset.unit);
        updateHUD(true);
        return;
      }
      const build = e.target.closest('.build-btn');
      if (build?.dataset.build) {
        Game.selectBuild(build.dataset.build);
        updateHUD(true);
      }
    });

    document.querySelectorAll('.ability-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.selectAbility(btn.dataset.ability);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.spy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.executeSpyAction(btn.dataset.spy);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.courier-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.sendCourierMessage(btn.dataset.courier);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.loadout-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.setLoadout?.(btn.dataset.loadout);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.doctrine-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.executeDoctrine?.(btn.dataset.doctrine);
        updateHUD(true);
      });
    });

    document.querySelectorAll('.counter-doctrine-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Game.executeCounterDoctrine?.(btn.dataset.counterDoctrine);
        updateHUD(true);
      });
    });

    document.getElementById('expedition-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.expedition-btn');
      if (
        !btn ||
        btn.classList.contains('disabled') ||
        btn.classList.contains('expedition-dispatched')
      )
        return;
      Game.dispatchExpedition?.(btn.dataset.faction);
      updateHUD(true);
    });

    document.getElementById('planet-event-choices')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.planet-event-btn');
      if (!btn || btn.classList.contains('planet-event-chosen')) return;
      const choiceId = btn.dataset.mapChoice;
      if (!choiceId) return;
      // Always attempt respond — Game shows why it failed (day / TP / none pending).
      // Soft-lock styles must not swallow clicks with a silent return.
      const ok = Game.respondMapEvent?.(choiceId);
      if (ok) AudioEngine.SFX?.click?.();
      updateHUD(true);
    });

    document.getElementById('raid-mission-list')?.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.raid-mission-btn');
      if (!btn || btn.classList.contains('disabled') || btn.classList.contains('raid-dispatched'))
        return;
      Game.dispatchRaidStrike?.(btn.dataset.raid);
      updateHUD(true);
    });

    document.getElementById('hunt-toggle').addEventListener('click', () => {
      Game.toggleGlobalHunt();
      updateHUD();
    });

    document.getElementById('clear-selection-btn')?.addEventListener('click', () => {
      Game.clearSelection();
      AudioEngine.SFX.click();
      updateHUD(true);
    });

    document.querySelectorAll('.formation-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fid = btn.dataset.formation;
        if (!fid || !Game.setSelectionFormation?.(fid, { announce: true })) return;
        AudioEngine.SFX.click();
        const gs = Game.getState();
        const n = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
        if (n >= 2) Game.reformSelectionFormation?.(fid);
        updateHUD(true);
      });
    });
    document.getElementById('formation-reform-btn')?.addEventListener('click', () => {
      Game.reformSelectionFormation?.();
      AudioEngine.SFX.click();
      updateHUD(true);
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

  function refreshPanelIcons() {
    if (typeof SpriteGen === 'undefined') return;
    document.querySelectorAll('.btn-icon').forEach((icon) => {
      const ictx = icon.getContext('2d');
      if (!ictx) return;
      const w = icon.width || 28;
      const h = icon.height || 28;
      const sprite = icon.dataset.sprite;
      const ability = icon.dataset.abilityIcon;
      if (ability && SpriteGen.drawAbilityIcon) SpriteGen.drawAbilityIcon(ictx, ability);
      else if (sprite && SpriteGen.UNIT_STYLE[sprite]) SpriteGen.drawIcon(ictx, sprite, w, h);
    });
  }

  function refreshCrownLegaciesPanel() {
    const section = document.getElementById('crown-legacies-section');
    const summary = document.getElementById('crown-legacies-summary');
    const list = document.getElementById('crown-legacies-list');
    const heirsBlock = document.getElementById('crown-heirs-block');
    const heirsList = document.getElementById('crown-heirs-list');
    if (!section || !summary || !list || typeof CrownLegacies === 'undefined') return;

    const snap = CrownLegacies.getMenuSnapshot();
    summary.textContent = snap.summary;

    list.innerHTML = snap.passives
      .map((p) => {
        let cls = 'crown-legacy-btn';
        if (!p.unlocked) cls += ' locked';
        else if (p.active) cls += ' active';
        else cls += ' unlocked';
        const status = !p.unlocked ? 'LOCKED' : p.active ? 'EQUIPPED' : 'EQUIP';
        const hint = p.unlocked ? p.desc : p.hint;
        return (
          `<button type="button" class="${cls}" data-legacy="${p.id}"${p.unlocked ? '' : ' disabled'}` +
          ` title="${hint}">` +
          `<span>${p.name}${p.isNew ? ' ★' : ''}</span><span class="crown-legacy-status">${status}</span>` +
          `<span class="crown-legacy-hint">${hint}</span></button>`
        );
      })
      .join('');

    if (heirsBlock && heirsList) {
      const showHeirs = snap.heirs.length > 0;
      heirsBlock.style.display = showHeirs ? '' : 'none';
      if (showHeirs) {
        heirsList.innerHTML = snap.heirs
          .map((h) => {
            const cls = `crown-heir-btn${h.active ? ' active' : ''}`;
            const status = h.active ? 'HEIR' : 'SELECT';
            const typeLabel =
              typeof formatUnitTypeName === 'function' ? formatUnitTypeName(h.type) : h.type;
            return (
              `<button type="button" class="${cls}" data-heir="${h.key}" title="${h.name} — ${typeLabel}">` +
              `<span>${h.name}</span><span class="crown-heir-status">${status}</span>` +
              `<span class="crown-heir-wave">${typeLabel} · crowned W${h.wave}</span></button>`
            );
          })
          .join('');
      }
    }

    CrownLegacies.markUnlocksSeen();
  }

  function refreshEternalLegacyPanel() {
    const section = document.getElementById('eternal-legacy-section');
    const summary = document.getElementById('eternal-legacy-summary');
    const branchesEl = document.getElementById('eternal-legacy-branches');
    const treeEl = document.getElementById('eternal-legacy-tree');
    if (!section || !summary || !treeEl || typeof EternalLegacyTree === 'undefined') return;

    const snap = EternalLegacyTree.getMenuSnapshot();
    const foundationNote =
      snap.foundationPaths?.length > 0
        ? ` · ${snap.foundationPaths.map((p) => p.label).join(', ')} crystallized`
        : '';
    summary.textContent = `${snap.summary}${foundationNote} · ${snap.available}/${snap.shards} Echo Shards`;

    if (branchesEl) {
      const foundationChips =
        snap.foundationPaths?.length > 0
          ? snap.foundationPaths
              .map(
                (p) =>
                  `<span class="eternal-branch-chip foundation-chip" style="border-color:${p.color}" title="Crystallized at wave 150">` +
                  `${p.label} ×${p.count}</span>`
              )
              .join('')
          : '';
      branchesEl.innerHTML =
        foundationChips +
        snap.branches
        .filter((b) => b.id !== 'crown_trunk' || b.investedCount > 0)
        .map(
          (b) =>
            `<span class="eternal-branch-chip" style="border-color:${b.color}" title="${b.desc}">` +
            `${b.label} ${b.investedCount}/${b.nodeCount}</span>`
        )
        .join('');
    }

    treeEl.innerHTML = snap.nodes
      .map((n) => {
        let cls = 'eternal-legacy-node-btn';
        if (n.invested) cls += ' invested';
        else if (!n.unlocked) cls += ' locked';
        else if (n.canInvest) cls += ' ready';
        else if (n.unlocked) cls += ' unlocked';
        const status = n.invested
          ? 'INVESTED'
          : !n.unlocked
            ? 'LOCKED'
            : n.canInvest
              ? `INVEST ${n.cost}◆`
              : n.prereqOk
                ? 'NEED ◆'
                : 'PREREQ';
        const hint = n.unlocked ? n.desc : n.hint;
        const foundationTag = n.foundationLabel ? ` · ${n.foundationLabel}` : '';
        const ascend =
          n.ascends?.length && n.invested
            ? ` · ascends ${n.ascends.slice(0, 2).join(', ')}`
            : n.ascends?.length
              ? ` · ${n.ascends.slice(0, 2).join(', ')}`
              : '';
        return (
          `<button type="button" class="${cls}" data-node="${n.id}"` +
          ` style="border-left-color:${n.branchColor}"` +
          ` title="${hint}"${n.canInvest ? '' : ' disabled'}>` +
          `<span class="eternal-node-tier">T${n.tier}</span>` +
          `<span class="eternal-node-name">${n.name}${n.isNewUnlock || n.isNewInvest ? ' ★' : ''}</span>` +
          `<span class="eternal-node-status">${status}</span>` +
          `<span class="eternal-node-hint">${hint}${foundationTag}${ascend}</span></button>`
        );
      })
      .join('');

    EternalLegacyTree.markUnlocksSeen();
  }

  function refreshRaidPanel(gs) {
    const section = document.getElementById('raid-section');
    const summary = document.getElementById('raid-summary-text');
    const list = document.getElementById('raid-mission-list');
    const raids = gs.settlementRaids;
    if (!section || !summary || !list) return;
    const show = !!(raids?.active || (gs.wave || 0) >= 140);
    section.style.display = show ? '' : 'none';
    if (!show) return;
    summary.textContent = raids?.summary || `Unlocks wave ${raids?.waveMin || 150}`;
    const missions = raids?.missions || [];
    if (!missions.length) {
      list.innerHTML =
        '<p class="panel-hint">No enemy holds spotted — factions build in the north after wave 150.</p>';
      return;
    }
    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    const minForce = raids?.minStrikeForce || 2;
    list.innerHTML = missions
      .map((m) => {
        const status = m.dispatched ? 'EN ROUTE' : `+${m.rewardTp} TP`;
        const cls = m.dispatched
          ? 'raid-dispatched disabled'
          : selCount < minForce
            ? 'disabled'
            : '';
        const sci = m.rewardScience ? ` · +${m.rewardScience} SP` : '';
        return (
          `<button type="button" class="raid-mission-btn ${cls}" data-raid="${m.id}" title="Dispatch strike force to raze ${m.label}${sci}">` +
          `<span>${m.label}</span><span class="raid-reward">${status}</span></button>`
        );
      })
      .join('');
  }

  function refreshMapEventPanel(gs) {
    const section = document.getElementById('planet-event-section');
    const summary = document.getElementById('planet-event-summary');
    const list = document.getElementById('planet-event-choices');
    const me = gs.mapEvents;
    if (!section || !summary || !list) return;
    const wave = gs.wave || 0;
    const waveMin = me?.waveMin || 12;
    const show = !!(me?.active || me?.pending || me?.awaitingChoice || wave >= waveMin - 1);
    section.style.display = show ? '' : 'none';
    if (!show) return;

    const nightOk = gs.timeOfDay === 'night';
    const canRespond = !!(me?.canRespond || (me?.pending && me?.awaitingChoice && nightOk));
    const freeTp = gs.creativeMode && gs.creativeSettings?.freeResources;

    if (me?.pending && me?.event?.prep) {
      summary.textContent = `${me.event.name} — ${me.event.prep}${
        nightOk ? '' : ' (night prep only)'
      }`;
    } else if (me?.activeSummary) {
      summary.textContent = me.activeSummary;
    } else {
      summary.textContent = `Planet events unlock wave ${waveMin} (respond at night)`;
    }

    const choices = me?.event?.choices || [];
    const chosen = me?.event?.choice;

    if (!choices.length) {
      list.innerHTML = chosen
        ? '<p class="panel-hint">Response locked — effects apply at dawn.</p>'
        : '<p class="panel-hint">No planet event pending — check again after a wave clears at night.</p>';
      return;
    }

    const colorStyle = me.event?.color ? ` style="border-left-color:${me.event.color}"` : '';
    list.innerHTML = choices
      .map((ch) => {
        const isChosen = chosen === ch.id;
        const needTp = !freeTp && (ch.cost || 0) > 0 && (gs.tactical || 0) < (ch.cost || 0);
        let cls = '';
        let lockHint = '';
        if (isChosen) {
          cls = 'planet-event-chosen';
        } else if (!nightOk) {
          cls = 'planet-event-softlock';
          lockHint = ' Night prep only — wait for night.';
        } else if (!canRespond) {
          cls = 'planet-event-softlock';
          lockHint = ' Already answered or no pending event.';
        } else if (needTp) {
          cls = 'planet-event-softlock';
          lockHint = ` Need ${ch.cost} TP (have ${Math.floor(gs.tactical || 0)}).`;
        }
        const costLabel = ch.cost > 0 ? `${ch.cost} TP` : 'FREE';
        return (
          `<button type="button" class="planet-event-btn ${cls}" data-map-choice="${ch.id}"${colorStyle}` +
          ` title="${(ch.hint || ch.label || '') + lockHint}">` +
          `<span>${ch.label}</span><span class="planet-event-cost">${isChosen ? 'CHOSEN' : costLabel}</span>` +
          `<span class="planet-event-hint">${ch.hint || ''}${lockHint}</span></button>`
        );
      })
      .join('');
  }

  function refreshCounterPanel(gs) {
    const ce = gs.counterEvolution;
    const doctrineSection = document.getElementById('counter-doctrine-section');
    const expeditionSection = document.getElementById('counter-expedition-section');
    const summary = document.getElementById('counter-summary-text');
    const list = document.getElementById('expedition-list');
    const wave = gs.wave || 0;
    const kingdomStage = gs.kingdomStage || 1;
    const counterDoctrines =
      typeof PlayerCounterEvolution !== 'undefined' ? PlayerCounterEvolution.COUNTER_DOCTRINES : {};

    if (doctrineSection) {
      const showDoctrine = !!(ce?.active || wave >= (ce?.waveMin || 15) - 2);
      doctrineSection.style.display = showDoctrine ? '' : 'none';
      if (showDoctrine) {
        document.querySelectorAll('.counter-doctrine-btn').forEach((btn) => {
          const id = btn.dataset.counterDoctrine;
          const def = counterDoctrines[id];
          const cost = def?.cost ?? 99;
          const stageReq = parseInt(btn.dataset.kingdomStage || def?.kingdomStage || '0', 10);
          const waveReq = def?.waveMin || 0;
          const stageLocked = stageReq > 0 && kingdomStage < stageReq;
          const waveLocked = waveReq > 0 && wave < waveReq;
          const locked = stageLocked || waveLocked;
          const costEl = btn.querySelector('.cost');
          if (costEl) costEl.textContent = String(cost);
          btn.classList.toggle(
            'disabled',
            gs.tactical < cost || gs.counterDoctrineUsedThisWave || locked
          );
          btn.classList.toggle('kingdom-locked', locked);
          btn.title = locked
            ? `${def?.name || id} — wave ${waveReq}+, stage ${stageReq}+`
            : def?.desc || '';
        });
      }
    }

    if (!expeditionSection || !summary || !list) return;
    const showExpedition = !!(
      ce?.expeditionUnlocked ||
      ce?.active ||
      wave >= (ce?.expeditionWaveMin || 25) - 2
    );
    expeditionSection.style.display = showExpedition ? '' : 'none';
    if (!showExpedition) return;

    const inFlight = ce?.activeExpeditions || [];
    const inFlightNote = inFlight.length
      ? ` · ${inFlight.map((e) => `${e.factionName} W${e.returnWave}`).join(', ')} en route`
      : '';
    summary.textContent =
      (ce?.summary || `Unlocks wave ${ce?.expeditionWaveMin || 25}`) + inFlightNote;

    const targets = ce?.targets || [];
    if (!targets.length) {
      list.innerHTML =
        '<p class="panel-hint">No host factions active yet — expeditions target evolving enemy realms.</p>';
      return;
    }

    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    const minForce = ce?.minExpeditionForce || 1;
    const maxForce =
      typeof PlayerCounterEvolution !== 'undefined'
        ? PlayerCounterEvolution.MAX_EXPEDITION_FORCE
        : 4;
    const nightOk = gs.timeOfDay === 'night';
    const expeditionUsed = !!gs.expeditionUsedThisWave;
    const forceOk = selCount >= minForce && selCount <= maxForce;

    list.innerHTML = targets
      .map((t) => {
        const enRoute = inFlight.some((e) => e.factionId === t.factionId);
        const stageLabel =
          t.effectiveStage < t.stage ? `S${t.stage}→S${t.effectiveStage}` : `S${t.stage}`;
        const status = enRoute ? 'EN ROUTE' : t.debuffed ? 'WEAKENED' : 'STRIKE';
        let cls = '';
        if (enRoute) cls = 'expedition-dispatched disabled';
        else if (expeditionUsed || !nightOk || !forceOk) cls = 'disabled';
        const colorStyle = t.color ? ` style="border-left-color:${t.color}"` : '';
        const lootHint =
          typeof PlayerCounterEvolution !== 'undefined' &&
          PlayerCounterEvolution.computeExpeditionLoot &&
          !enRoute
            ? (() => {
                const preview = PlayerCounterEvolution.computeExpeditionLoot(
                  { targetStage: t.stage, unitIds: Array(selCount || minForce).fill('x') },
                  Math.max(minForce, selCount || minForce),
                  (wave || 0) + 1
                );
                return ` · ~${preview.tp} TP / ${preview.science} SP loot`;
              })()
            : '';
        return (
          `<button type="button" class="expedition-btn ${cls}" data-faction="${t.factionId}"${colorStyle}` +
          ` title="Dispatch ${minForce}–${maxForce} hunters against ${t.name} (${stageLabel})${lootHint}">` +
          `<span>${t.name}</span><span class="expedition-stage">${stageLabel}</span>` +
          `<span class="expedition-status">${status}</span></button>`
        );
      })
      .join('');
  }

  function updateSpeedControl(speed) {
    const n =
      typeof PacingTools !== 'undefined' ? PacingTools.normalizeSpeed(speed) : parseFloat(speed) || 1;
    const speedBtn = document.getElementById('speed-toggle');
    if (speedBtn) {
      speedBtn.textContent = `SPEED: ${n}×`;
      speedBtn.classList.toggle('speed-active', n > 1);
    }
    document.querySelectorAll('.settings-speed-control .speed-btn').forEach((btn) => {
      const btnSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', btnSpeed === n);
    });
  }

  function updateButtonStates(gs) {
    const freeTp = gs.creativeMode && gs.creativeSettings?.freeResources;
    hudBtns.deploy.forEach((btn) => {
      const type = btn.dataset.unit;
      // Recover expansion defs (ballista/bard/…) if a data race wiped UnitDefs.
      if (
        !getPlayerUnitDef?.(type) &&
        !UnitDefs?.[type] &&
        typeof ContentExpansion !== 'undefined' &&
        ContentExpansion.registerDefs
      ) {
        ContentExpansion.registerDefs();
      }
      const def = getPlayerUnitDef(type) || UnitDefs[type];
      const costEl = btn.querySelector?.('.cost') || btn._costEl;
      const cost = Number.isFinite(def?.cost)
        ? def.cost
        : Number.isFinite(parseInt(costEl?.textContent, 10))
          ? parseInt(costEl.textContent, 10)
          : 99;
      if (costEl && Number.isFinite(def?.cost) && costEl.textContent !== String(def.cost)) {
        costEl.textContent = String(def.cost);
      }
      const oneOnly = type === 'general' && gs.hasGeneral;
      const doomOnly =
        type === 'doomslayer_hero' && (!gs.doomslayerUnlocked || (!freeTp && gs.tactical < cost));
      const researchBlocked =
        !gs.creativeMode &&
        typeof Research !== 'undefined' &&
        !Research.isDeployUnlocked(type, {
          creativeUnlockAll: gs.creativeMode && gs.creativeSettings?.unlockAll,
          doomMetaUnlocked: gs.doomslayerUnlocked,
        });
      const special = type === 'doomslayer_hero';
      const creativeDeployOff =
        gs.creativeMode && gs.creativeSettings && !gs.creativeSettings.academyDeploy;
      const deployBlocked = !special && creativeDeployOff;
      btn.classList.toggle('selected', type === gs.selectedDeploy);
      btn.classList.toggle(
        'disabled',
        deployBlocked || researchBlocked || (!freeTp && gs.tactical < cost) || oneOnly || doomOnly
      );
      btn.classList.toggle('research-locked', researchBlocked && !deployBlocked);
      if (researchBlocked) {
        const hint =
          type === 'ballista'
            ? 'Research: Iron Weapons → Siege Engineering'
            : type === 'bard'
              ? 'Research: Morale Arts'
              : type === 'scout' || type === 'pikeman'
                ? 'Research: Iron Weapons → Advanced Infantry'
                : type === 'sapper' || type === 'knight'
                  ? 'Research: Iron Weapons'
                  : type === 'general'
                    ? 'Research: Iron Weapons → Command Theory'
                    : 'Research required at the Research Lab';
        btn.title = `${def?.name || type} — ${hint}`;
      } else if (def?.name) {
        btn.title = `${def.name} — ${cost} TP · click then place on map (Shift-click keeps deploy selected)`;
      }
    });

    const doomBtn = hudEls['doomslayer-deploy'];
    if (doomBtn) doomBtn.style.display = gs.doomslayerUnlocked ? '' : 'none';

    const wweBtn = hudEls['wwe-academy-open'];
    if (wweBtn) {
      wweBtn.style.display = '';
      wweBtn.classList.toggle('disabled', !gs.wweUnlocked);
      wweBtn.title = gs.wweUnlocked
        ? 'Grand Coliseum — arena champions'
        : 'Grand Coliseum — unlock via research or Iron Creed';
      wweBtn.textContent = gs.wweUnlocked ? 'GRAND COLISEUM' : 'GRAND COLISEUM 🔒';
    }
    const crossBtn = hudEls['crossover-hub-open'];
    if (crossBtn) {
      // Always show the Legion Archive entry; dim when locked so players know where it is.
      crossBtn.style.display = '';
      crossBtn.classList.toggle('disabled', !gs.crossoverUnlocked);
      crossBtn.title = gs.crossoverUnlocked
        ? 'Legion Archive — faction barracks & operatives'
        : 'Legion Archive — unlock a crossover faction (meta or research) to open';
      crossBtn.textContent = gs.crossoverUnlocked ? 'LEGION ARCHIVE' : 'LEGION ARCHIVE 🔒';
    }
    const perkSection = hudEls['perk-build-section'];
    if (perkSection) perkSection.style.display = gs.perksUnlocked ? '' : 'none';
    hudBtns.ability.forEach((btn) => {
      const id = btn.dataset.ability;
      const base = Abilities[id]?.cost ?? 99;
      const cost = freeTp
        ? 0
        : typeof ContentExpansion !== 'undefined' && ContentExpansion.getAbilityCost
          ? ContentExpansion.getAbilityCost(id, base, gs.wave)
          : base;
      const costEl = btn._costEl;
      if (costEl && costEl.textContent !== String(cost)) costEl.textContent = String(cost);
      btn.classList.toggle('selected', id === gs.selectedAbility);
      const needsMage = id === 'dispel' || Abilities[id]?.requiresMage;
      const mageOk = !needsMage || (gs.mageCount || 0) > 0;
      btn.classList.toggle('disabled', (!freeTp && gs.tactical < cost) || !mageOk);
      if (needsMage && !mageOk) {
        btn.title = 'Requires a living Mage on the field';
      } else if (needsMage) {
        btn.title = 'Arcane Dispel — purge void/burn/plague zones (mage cast range)';
      }
    });
    hudBtns.build.forEach((btn) => {
      const buildType = btn.dataset.build;
      const def = BuildDefs[buildType];
      const costEl = btn._costEl;
      // Prefer live def; if BuildDefs was wiped mid-boot, keep HTML label — never fake 99 TP.
      const labelCost = parseInt(costEl?.textContent, 10);
      const cost = Number.isFinite(def?.cost)
        ? def.cost
        : Number.isFinite(labelCost)
          ? labelCost
          : 0;
      if (costEl && Number.isFinite(def?.cost) && costEl.textContent !== String(def.cost)) {
        costEl.textContent = String(def.cost);
      }
      const isAcademyBuild =
        BuildDefs[buildType]?.isAcademy &&
        !BuildDefs[buildType]?.isCrossoverBarracks &&
        !BuildDefs[buildType]?.isWweAcademy;
      // Prefer live mentor check when Game API is available (avoids stale buildableAcademies).
      let academyBlocked = false;
      if (!gs.creativeMode && isAcademyBuild) {
        if (typeof Game !== 'undefined' && Game.getAcademyBuildStatus) {
          const st = Game.getAcademyBuildStatus(buildType);
          academyBlocked = !st?.mentorOk;
        } else if (gs.buildableAcademies) {
          academyBlocked = !gs.buildableAcademies.includes(buildType);
        }
      }
      const builderBlocked =
        !gs.creativeSettings?.instantBuild &&
        def?.requiresBuilders &&
        (gs.liveBuilders ?? 0) < def.requiresBuilders;
      const researchBlocked =
        !gs.creativeMode &&
        typeof Research !== 'undefined' &&
        !Research.isBuildUnlocked(buildType, {
          creativeUnlockAll: gs.creativeMode && gs.creativeSettings?.unlockAll,
          perksMetaUnlocked: gs.perksUnlocked,
        });
      btn.classList.toggle('selected', buildType === gs.selectedBuild);
      btn.classList.toggle(
        'disabled',
        (!freeTp && gs.tactical < cost) || academyBlocked || builderBlocked || researchBlocked
      );
      btn.classList.toggle(
        'research-locked',
        researchBlocked && !academyBlocked && !builderBlocked
      );
      btn.classList.toggle('mentor-ready', isAcademyBuild && !academyBlocked && researchBlocked);
    });
    hudBtns.spy.forEach((btn) => {
      const def = SpyActions[btn.dataset.spy];
      const cost = def?.cost ?? 99;
      const stageReq = parseInt(btn.dataset.kingdomStage || def?.kingdomStage || '0', 10);
      const waveMin = parseInt(btn.dataset.waveMin || def?.waveMin || '0', 10);
      const stageLocked = stageReq > 0 && (gs.kingdomStage || 1) < stageReq;
      const waveLocked = waveMin > 0 && (gs.wave || 0) < waveMin;
      btn.classList.toggle(
        'disabled',
        gs.tactical < cost || gs.spyUsedThisWave || stageLocked || waveLocked
      );
      btn.classList.toggle('kingdom-locked', stageLocked || waveLocked);
      if (waveLocked) {
        btn.title = `Unlocks at wave ${waveMin}`;
      } else if (stageLocked && typeof KINGDOM_EVOLUTION_STAGES !== 'undefined') {
        btn.title = `Unlocks in ${KINGDOM_EVOLUTION_STAGES[stageReq]?.name || 'later stage'}`;
      } else {
        btn.title = def?.desc || '';
      }
    });
    hudBtns.courier.forEach((btn) => {
      const def = CourierMessages[btn.dataset.courier];
      const cost = def?.cost ?? 99;
      const stageReq = parseInt(btn.dataset.kingdomStage || def?.kingdomStage || '0', 10);
      const stageLocked = stageReq > 0 && (gs.kingdomStage || 1) < stageReq;
      btn.classList.toggle('selected', btn.dataset.courier === gs.selectedCourierMsg);
      const courierCap =
        (gs.courierMessagesUsedThisWave || 0) >=
        Math.max(1, gs.courierMessagesPerWave || 1);
      btn.classList.toggle(
        'disabled',
        gs.tactical < cost ||
          !gs.hasCourier ||
          gs.courierCooldown > 0 ||
          courierCap ||
          stageLocked
      );
      btn.classList.toggle('kingdom-locked', stageLocked);
      if (stageLocked && typeof KINGDOM_EVOLUTION_STAGES !== 'undefined') {
        btn.title = `Unlocks in ${KINGDOM_EVOLUTION_STAGES[stageReq]?.name || 'later stage'}`;
      } else {
        btn.title = def?.desc || '';
      }
    });

    const loadoutSection = hudEls['loadout-section'];
    if (loadoutSection) {
      const showLoadouts = gs.kingdomLoadoutsUnlocked || gs.wave >= 100;
      loadoutSection.style.display = showLoadouts ? '' : 'none';
      hudBtns.loadout.forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.loadout === gs.loadout);
        const tip =
          typeof ContentExpansion !== 'undefined' && ContentExpansion.formatLoadoutTip
            ? ContentExpansion.formatLoadoutTip(btn.dataset.loadout)
            : null;
        if (tip) btn.title = `${tip.body}\n${tip.footer}`;
      });
    }

    const huntBtn = hudEls['hunt-toggle'];
    if (huntBtn) huntBtn.textContent = `HUNT: ${gs.globalHunt ? 'ON' : 'OFF'}`;

    const formSection = hudEls['formation-section'];
    const selCount = gs.selectedUnitIds?.length || (gs.selectedUnitId ? 1 : 0);
    if (formSection) {
      formSection.style.display = selCount >= 2 ? '' : 'none';
      hudBtns.formation.forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.formation === gs.selectionFormation);
      });
    }

    const researchBtn = hudEls['research-open'];
    if (researchBtn) researchBtn.style.display = '';
    // SP label + open-panel tree handled in updateHudMeters / renderPanel sig path.
    if (
      typeof Research !== 'undefined' &&
      (Research.isPanelOpen?.() ||
        document.getElementById('research-panel')?.classList.contains('open'))
    ) {
      // Prefer live buildings so isResearchLab / complete flags are accurate.
      const blds =
        typeof Game.getBuildingsForResearch === 'function'
          ? Game.getBuildingsForResearch()
          : Game.getBuildingsSnapshot?.() || [];
      Research.renderPanel(gs.wave, blds);
    }

    const repairBtn = hudEls['builder-repair-toggle'];
    if (repairBtn) repairBtn.textContent = `REPAIR: ${gs.builderAutoRepair ? 'ON' : 'OFF'}`;

    updateSpeedControl(gs.gameSpeed ?? 1);

    const demolishBtn = hudEls['demolish-btn'];
    if (demolishBtn) demolishBtn.classList.toggle('selected', gs.selectedDemolish);
    const moveBtn = hudEls['move-building-btn'];
    if (moveBtn) {
      moveBtn.classList.toggle('selected', gs.selectedMoveBuilding);
      moveBtn.classList.toggle('pending', !!gs.moveBuildingTarget);
    }
    const rotateBtn = hudEls['rotate-wall-btn'];
    if (rotateBtn) rotateBtn.classList.toggle('selected', gs.selectedRotateWall);

    // Keep the active side-panel tab open when a tool is selected (UI v2 tabs).
    if (gs.selectedDeploy) {
      revealPanelControl(document.querySelector(`.deploy-btn[data-unit="${gs.selectedDeploy}"]`));
    } else if (gs.selectedBuild) {
      revealPanelControl(document.querySelector(`.build-btn[data-build="${gs.selectedBuild}"]`));
    } else if (gs.selectedAbility) {
      revealPanelControl(
        document.querySelector(`.ability-btn[data-ability="${gs.selectedAbility}"]`)
      );
    } else if (gs.selectedCourierMsg) {
      revealPanelControl(
        document.querySelector(`.courier-btn[data-courier="${gs.selectedCourierMsg}"]`)
      );
    } else if (gs.selectedDemolish || gs.selectedMoveBuilding || gs.selectedRotateWall) {
      revealPanelControl(demolishBtn || moveBtn || rotateBtn);
    }

    const threatEl = hudEls['threat-text'];
    if (threatEl) {
      const sides = gs.attackSides || ['north'];
      const unlocked = gs.unlockedAttackSides || sides;
      const threatKey = `${sides.join(',')}|${unlocked.join(',')}|${gs.generalThreat}|${gs.bossActive}|${gs.lastStandActive}|${gs.multiFrontSiege?.summary || ''}`;
      if (threatKey !== lastThreatKey) {
        lastThreatKey = threatKey;
        const glyphs = { north: '▲', east: '▶', west: '◀', south: '▼' };
        const labels = { north: 'N', east: 'E', west: 'W', south: 'S' };
        const activeSet = new Set(sides);
        let flankHtml = '';
        if (unlocked.length <= 1) {
          flankHtml = '<span class="flank-dir flank-active">▲N</span>';
        } else {
          for (const s of ['north', 'east', 'west', 'south']) {
            if (!unlocked.includes(s)) continue;
            const on = activeSet.has(s);
            flankHtml += `<span class="flank-dir${on ? ' flank-active' : ' flank-quiet'}" title="${on ? 'Assaulting' : 'Quiet this wave'}">${glyphs[s]}${labels[s]}</span>`;
          }
        }
        const threat = gs.generalThreat > 0 ? ` · GEN×${gs.generalThreat}` : '';
        const boss = gs.bossActive ? ' · BOSS' : '';
        const stand = gs.lastStandActive ? ' · STAND' : '';
        threatEl.innerHTML = `${flankHtml}${threat}${boss}${stand}`;
      }
      const multi = sides.length > 1;
      threatEl.className =
        'stat-value threat-value threat-compass' +
        (multi || gs.generalThreat >= 2 || gs.bossActive ? ' threat-high' : '');
      const mf = gs.multiFrontSiege;
      threatEl.title = mf?.summary
        ? `${mf.summary}\nActive flanks: ${sides.join(', ')}`
        : multi
          ? `Active flanks: ${sides.join(', ')}`
          : unlocked.length > 1
            ? `Unlocked flanks: ${unlocked.join(', ')}`
            : 'North only';
      if (mf?.assignments?.length >= 2) {
        threatEl.classList.add('threat-multifront');
      }
    }

    const stageEl = document.getElementById('kingdom-stage-text');
    const evo = gs.kingdomEvolution;
    if (stageEl && evo) {
      stageEl.textContent = evo.shortName || '—';
      stageEl.style.color = evo.color || '';
      const prog = evo.progress != null ? ` · ${Math.round(evo.progress * 100)}%` : '';
      stageEl.title = `${evo.name} (waves ${evo.waveMin}–${evo.waveMax ?? '∞'})${prog}\n${evo.tagline || ''}`;
    } else if (stageEl) {
      stageEl.textContent = '—';
      stageEl.title = 'Kingdom evolution stage';
    }

    const evoMeter = gs.kingdomEvolutionMeter;
    const evoFill = document.getElementById('kingdom-evolution-fill');
    const evoPct = document.getElementById('kingdom-evolution-pct');
    const bannerCanvas = document.getElementById('kingdom-banner-canvas');
    if (evoMeter && evoFill) {
      const pct = evoMeter.stageProgress ?? Math.round((evoMeter.fill || 0) * 100);
      evoFill.style.width = `${Math.max(4, pct)}%`;
      evoFill.style.background = evo?.color
        ? `linear-gradient(90deg, ${evo.color}66, ${evo.color})`
        : '';
      if (evoPct) evoPct.textContent = `${pct}%`;
      const bd = evoMeter.breakdown || {};
      const evoBar = evoFill.parentElement;
      if (evoBar) {
        evoBar.title = `Evolution meter — Colony ${bd.colonyPct ?? 0}% · Buildings ${bd.buildingPct ?? 0}% (${bd.buildingCount ?? 0}) · Veterans ${bd.veteranPct ?? 0}% (${bd.veteranUnits ?? 0} named) · Research ${bd.researchPct ?? 0}% (${bd.researchCompleted ?? 0}/${bd.researchTotal ?? 0})`;
      }
    } else if (evoPct) {
      evoPct.textContent = '—';
    }
    if (bannerCanvas && typeof VisualPolish !== 'undefined' && VisualPolish.drawKingdomBanner) {
      const ctx = bannerCanvas.getContext('2d');
      const stage = evoMeter?.bannerStage || evo?.stage || 1;
      const fill = evoMeter?.fill ?? 0.2;
      const bannerOpts =
        typeof Cosmetics !== 'undefined' ? Cosmetics.getBannerOpts() : null;
      VisualPolish.drawKingdomBanner(
        ctx,
        bannerCanvas.width,
        bannerCanvas.height,
        stage,
        fill,
        bannerOpts?.primary || evo?.color,
        bannerOpts
      );
      const tierNames = ['Small Pennant', 'Kingdom Crest', 'Empire Banner', 'Hell-Forged Banner'];
      bannerCanvas.title = `${tierNames[stage - 1] || 'Banner'} — stage ${stage} · ${evoMeter?.stageProgress ?? 0}% growth`;
    }

    refreshRaidPanel(gs);
    refreshCounterPanel(gs);
    refreshMapEventPanel(gs);
    if (typeof FactionIntel !== 'undefined') FactionIntel.renderPanel(gs);

    const layerHud = document.getElementById('layer-modes-hud');
    const layerStack = document.getElementById('layer-modes-stack');
    const eraBar = document.getElementById('era-journey-bar');
    const eraNow = document.getElementById('era-journey-now');
    const layerModes = gs.layerModes;
    if (layerHud && layerStack) {
      layerHud.style.display = layerModes ? '' : 'none';
      if (layerModes) {
        layerStack.innerHTML =
          typeof LayerDesign !== 'undefined'
            ? LayerDesign.renderStackMarkup(layerModes)
            : layerModes.stackNote || '—';
        layerStack.title =
          layerModes.eraNote ||
          layerModes.stackNote ||
          layerModes.principles?.summary ||
          '';
        layerHud.classList.toggle(
          'layer-modes-focused',
          layerModes.focusedLayer !== 'tactical'
        );
      }
    }
    if (eraBar && typeof LayerDesign !== 'undefined' && layerModes) {
      eraBar.innerHTML = LayerDesign.renderEraBarMarkup(layerModes);
      eraBar.style.display = '';
    }
    if (eraNow && layerModes?.currentEra) {
      const e = layerModes.currentEra;
      eraNow.textContent = `Stage ${e.stage}: ${e.label}`;
      eraNow.style.color = e.color || '';
      eraNow.title = e.primaryVerb || '';
      eraNow.style.display = '';
    }
    if (typeof LayerDesign !== 'undefined') {
      LayerDesign.renderStackPanel('grand-strategy-layer-modes', {
        wave: gs.wave,
        phase: gs.timeOfDay,
        grandStrategy: gs.grandStrategy,
        intergalactic: gs.intergalactic,
        planetConquest: gs.planetConquest,
      });
      LayerDesign.renderStackPanel('intergalactic-layer-modes', {
        wave: gs.wave,
        phase: gs.timeOfDay,
        grandStrategy: gs.grandStrategy,
        intergalactic: gs.intergalactic,
        planetConquest: gs.planetConquest,
      });
      LayerDesign.bindChipClicks?.();
    }

    const hmHud = document.getElementById('hybrid-moments-hud');
    const hmText = document.getElementById('hybrid-moments-text');
    const hmSnap = gs.hybridMoments;
    if (hmHud && hmText) {
      const line =
        typeof HybridMoments !== 'undefined'
          ? HybridMoments.formatHudLine({ wave: gs.wave })
          : hmSnap?.hudLine || '';
      const show = !!line || !!hmSnap?.pending || !!hmSnap?.battleActive;
      hmHud.style.display = show ? '' : 'none';
      if (show) {
        hmText.textContent =
          line ||
          (hmSnap?.battleActive
            ? `ZOOM ${hmSnap.active?.shortLabel || 'BATTLE'}`
            : hmSnap?.pending
              ? `${hmSnap.pending} offer(s)`
              : '—');
        hmHud.classList.toggle('hybrid-moments-active', !!hmSnap?.battleActive);
        hmHud.title = hmSnap?.battleActive
          ? `Fighting hybrid moment — ${hmSnap.active?.label || 'tactical battle'}`
          : hmSnap?.nextOffer
            ? `Zoom in: ${hmSnap.nextOffer.label}`
            : 'Major macro events can zoom in to tactical real-time battles';
      }
    }

    const fmHud = document.getElementById('foundational-medieval-hud');
    const fmText = document.getElementById('foundational-medieval-text');
    const fmSnap = gs.foundationalMedieval;
    if (fmHud && fmText) {
      const line =
        typeof FoundationalMedievalLayer !== 'undefined'
          ? FoundationalMedievalLayer.formatHudLine({ wave: gs.wave })
          : fmSnap?.hudLine || '';
      const show = !!line || !!fmSnap?.inFoundationalEra;
      fmHud.style.display = show ? '' : 'none';
      if (show) {
        fmText.textContent = line || '—';
        if (fmSnap?.leadingColor) {
          fmHud.style.borderColor = fmSnap.leadingColor;
        }
        fmHud.title = fmSnap?.leadingLabel
          ? `Foundational DNA — ${fmSnap.leadingLabel} (waves 1–150)`
          : 'Lay your empire cultural DNA through archers, academies, or evolved heroes';
      }
    }

    const ascHud = document.getElementById('ascension-hud');
    const ascText = document.getElementById('ascension-text');
    const ascSnap = gs.ascension;
    if (ascHud && ascText) {
      const line =
        typeof AscensionSystem !== 'undefined'
          ? AscensionSystem.formatHudLine({ wave: gs.wave })
          : ascSnap?.hudLine || '';
      const show = !!line || (ascSnap?.legacyPoints || 0) > 0 || (ascSnap?.ascendedUnits || 0) > 0;
      ascHud.style.display = show ? '' : 'none';
      if (show) {
        ascText.textContent =
          line || (ascSnap?.legacyPoints ? `${ascSnap.legacyPoints} Legacy` : '—');
        ascHud.title =
          ascSnap?.eraLabel
            ? `Ascension — ${ascSnap.legacyPoints} Legacy Points (${ascSnap.eraLabel})`
            : 'Ascend max veterans at Kingdom (150) and Galactic (400) era gates';
      }
    }

    const thematicSynHud = document.getElementById('thematic-synergy-hud');
    const thematicSynText = document.getElementById('thematic-synergy-text');
    const thematicSynSnap = gs.thematicSynergy;
    if (thematicSynHud && thematicSynText) {
      const line =
        typeof ThematicEraSynergies !== 'undefined'
          ? ThematicEraSynergies.formatHudLine({ wave: gs.wave })
          : thematicSynSnap?.hudLine || '';
      const show = !!thematicSynSnap?.active || !!line;
      thematicSynHud.style.display = show ? '' : 'none';
      if (show) {
        thematicSynText.textContent = line || thematicSynSnap?.pathLabel || '—';
        if (thematicSynSnap?.pathColor) thematicSynHud.style.borderColor = thematicSynSnap.pathColor;
        thematicSynHud.title = thematicSynSnap?.pathDesc
          ? `${thematicSynSnap.pathLabel} — ${thematicSynSnap.pathDesc}`
          : 'Cross-era synergy from your medieval foundation path';
      }
    }

    const epfHud = document.getElementById('epf-hud');
    const epfText = document.getElementById('epf-text');
    const epfSnap = gs.eternalPaths;
    if (epfHud && epfText) {
      const line =
        typeof EternalPathFramework !== 'undefined'
          ? EternalPathFramework.formatHudLine({ wave: gs.wave })
          : epfSnap?.hudLine || '';
      const show = !!line || !!epfSnap?.dominantPathId || (gs.wave || 0) >= 1;
      epfHud.style.display = show ? '' : 'none';
      if (show) {
        epfText.textContent = line || 'Path ?';
        if (epfSnap?.dominantColor) epfHud.style.borderColor = epfSnap.dominantColor;
        epfHud.title = epfSnap?.dominantLabel
          ? `${epfSnap.dominantLabel} — investment strengthens every era`
          : 'Four Eternal Paths evolve Medieval → Kingdom → Intergalactic';
      }
    }

    const crownHud = document.getElementById('crown-thread-hud');
    const crownText = document.getElementById('crown-thread-text');
    const crownSnap = gs.narrativeThread;
    if (crownHud && crownText) {
      const line =
        typeof NarrativeThread !== 'undefined'
          ? NarrativeThread.formatHudLine({ wave: gs.wave })
          : crownSnap?.hudLine || '';
      const show = !!line || (crownSnap?.legendCount || 0) > 0 || (gs.wave || 0) >= 1;
      crownHud.style.display = show ? '' : 'none';
      if (show) {
        crownText.textContent = line || 'Ancient Crown';
        crownHud.title = crownSnap?.crownEpithet
          ? `${crownSnap.crownEpithet} — ${crownSnap.legendCount || 0} legend(s) grant real power`
          : 'The Ancient Crown endures — heroes become mythic figures';
      }
    }

    const techHud = document.getElementById('tech-branch-hud');
    const techText = document.getElementById('tech-branch-text');
    const techSnap = gs.techTreeBranches;
    if (techHud && techText) {
      const line =
        typeof TechTreeBranches !== 'undefined'
          ? TechTreeBranches.formatHudLine({ wave: gs.wave })
          : techSnap?.hudLine || '';
      const show = !!line || !!techSnap?.rootLocked || (gs.wave || 0) >= 35;
      techHud.style.display = show ? '' : 'none';
      if (show) {
        techText.textContent = line || techSnap?.rootLabel || 'Root ?';
        if (techSnap?.rootColor) techHud.style.borderColor = techSnap.rootColor;
        techHud.title = techSnap?.techTreeLabel
          ? `${techSnap.rootLabel} — ${techSnap.techTreeLabel}`
          : 'Martial / Arcane / Mythic / Tech root locks wave 50';
      }
    }

    const mbHud = document.getElementById('gs-mid-branch-hud');
    const mbText = document.getElementById('gs-mid-branch-text');
    const mbSnap = gs.grandStrategyMidBranches;
    if (mbHud && mbText) {
      const line =
        typeof GrandStrategyMidBranches !== 'undefined'
          ? GrandStrategyMidBranches.formatHudLine({ wave: gs.wave })
          : mbSnap?.hudLine || '';
      const show = !!line || mbSnap?.tracking || mbSnap?.resolved || (gs.wave || 0) >= 150;
      mbHud.style.display = show ? '' : 'none';
      if (show) {
        mbText.textContent = line || 'Branches ?';
        mbHud.title = mbSnap?.resolved
          ? 'Mid branches resolved — territorial, governance, and doctrine shape tactical waves'
          : 'Mid branches form from empire actions between waves 150–175';
      }
    }

    const lbHud = document.getElementById('ig-late-branch-hud');
    const lbText = document.getElementById('ig-late-branch-text');
    const lbSnap = gs.intergalacticLateBranches;
    if (lbHud && lbText) {
      const line =
        typeof IntergalacticLateBranches !== 'undefined'
          ? IntergalacticLateBranches.formatHudLine({ wave: gs.wave })
          : lbSnap?.hudLine || '';
      const show = !!line || lbSnap?.tracking || lbSnap?.resolved || (gs.wave || 0) >= 400;
      lbHud.style.display = show ? '' : 'none';
      if (show) {
        lbText.textContent = line || 'Ascend ?';
        if (lbSnap?.ascensionColor) lbHud.style.borderColor = lbSnap.ascensionColor;
        lbHud.title = lbSnap?.resolved
          ? `${lbSnap.ascensionLabel || 'Ascension'} — ${lbSnap.epithet || 'final form'}`
          : 'Late branches form from galactic actions and earlier legacies through wave 425';
      }
    }

    const pfHud = document.getElementById('power-fantasy-hud');
    const pfText = document.getElementById('power-fantasy-text');
    const pfSnap = gs.powerFantasy;
    if (pfHud && pfText) {
      const line =
        typeof HybridPowerFantasy !== 'undefined'
          ? HybridPowerFantasy.formatHudLine({ wave: gs.wave })
          : pfSnap?.hudLine || '';
      const show = !!pfSnap?.active || !!pfSnap?.pending || !!line;
      pfHud.style.display = show ? '' : 'none';
      if (show) {
        pfText.textContent = line || pfSnap?.fantasyLabel || '—';
        if (pfSnap?.fantasyColor) pfHud.style.borderColor = pfSnap.fantasyColor;
        pfHud.title = pfSnap?.fantasyDesc
          ? `${pfSnap.fantasyLabel} — ${pfSnap.fantasyDesc}`
          : 'Pure medieval DNA unlocks apex power fantasy at wave 500';
      }
    }

    const elHud = document.getElementById('eternal-legacy-hud');
    const elText = document.getElementById('eternal-legacy-text');
    const elSnap = gs.eternalLegacy;
    if (elHud && elText) {
      const line =
        typeof EternalLegacyTree !== 'undefined'
          ? EternalLegacyTree.formatHudLine({ wave: gs.wave })
          : elSnap?.hudLine || '';
      const show = !!line || (elSnap?.investedCount || 0) > 0;
      elHud.style.display = show ? '' : 'none';
      if (show) {
        elText.textContent =
          line || (elSnap?.investedCount ? `Crown ${elSnap.investedCount}` : '—');
        elHud.title =
          elSnap?.investedCount > 0
            ? `Echoes of the Past — ${elSnap.investedCount} node(s) invested`
            : 'Invest Echo Shards in Crown of Ages on the main menu';
      }
    }

    const ptHud = document.getElementById('pacing-tools-hud');
    const ptText = document.getElementById('pacing-tools-text');
    const ptSnap = gs.pacingTools;
    if (ptHud && ptText) {
      const line =
        typeof PacingTools !== 'undefined'
          ? PacingTools.formatHudLine({ gameSpeed: gs.gameSpeed, paused: gs.paused })
          : ptSnap?.hudLine || '';
      const q = ptSnap?.queueDepth || 0;
      const show =
        gs.paused || q > 0 || (gs.gameSpeed ?? 1) >= 8 || !!ptSnap?.strongPauseReason;
      ptHud.style.display = show ? '' : 'none';
      if (show) {
        ptText.textContent = line;
        ptHud.classList.toggle('pacing-tools-paused', !!gs.paused);
        ptHud.title = ptSnap?.strongPauseReason
          ? `Strong pause — ${ptSnap.strongPauseReason}${q ? ` · ${q} queued` : ''}`
          : q > 0
            ? `${q} notification(s) queued — will drain on resume`
            : `Simulation running at ${gs.gameSpeed ?? 1}×`;
      }
    }

    const prHud = document.getElementById('progression-restart-hud');
    const prText = document.getElementById('progression-restart-text');
    const prSnap = gs.progressionRestart;
    if (prHud && prText) {
      const line =
        typeof ProgressionRestarts !== 'undefined'
          ? ProgressionRestarts.formatHudLine({ wave: gs.wave })
          : prSnap?.hudLine || '';
      const show = !!line || !!prSnap?.nextGate;
      prHud.style.display = show ? '' : 'none';
      if (show) {
        prText.textContent =
          line ||
          (prSnap?.nextGate ? `Next w${prSnap.nextGate.wave}: ${prSnap.nextGate.shortName}` : '—');
        prHud.title = prSnap?.lastRestart
          ? `Escalation restart — ${prSnap.lastRestart.name}. Legacies, research, and TP imported.`
          : prSnap?.nextGate
            ? `Wave ${prSnap.nextGate.wave} resets the tactical map but imports legacies and tech.`
            : 'Major escalation restarts import legacies, tech, and bonuses';
      }
    }

    const gsHud = document.getElementById('grand-strategy-hud');
    const gsText = document.getElementById('grand-strategy-text');
    const gsBtn = document.getElementById('grand-strategy-btn');
    const gsSnap = gs.grandStrategy;
    const gsUnlocked =
      !!gsSnap?.active ||
      (typeof GrandStrategy !== 'undefined' && GrandStrategy.isUnlocked?.(gs.wave));
    if (gsHud && gsText) {
      const show = gsUnlocked;
      gsHud.style.display = show ? '' : 'none';
      if (show) {
        const orders = gsSnap.orders || 0;
        const builds = gsSnap.domainProjects || 0;
        const events = gsSnap.activeEvents || 0;
        const plots = gsSnap.activeIntrigues || 0;
        const dynastyEvts = gsSnap.activeDynastyEvents || 0;
        const spies = gsSnap.espionage || 0;
        const autoWins = gsSnap.mobilization?.autoResolvedTotal || 0;
        const tact = gsSnap.tactical;
        const tactNote =
          tact?.wavesLeft > 0 && tact?.note ? ` · ${tact.note.slice(0, 18)}` : '';
        const alertNote =
          (events > 0 ? ` · ${events} evt!` : '') +
          (plots > 0 ? ` · ${plots} plot` : '') +
          (dynastyEvts > 0 ? ` · ${dynastyEvts} dyn` : '') +
          (spies > 0 ? ` · ${spies} spy` : '');
        const mobNote =
          gsSnap.mobilization?.enabled && autoWins > 0 ? ` · ${autoWins} auto` : '';
        const eco = gsSnap.economy;
        const dyn = gsSnap.dynasty;
        const edicts = gsSnap.edicts;
        const ecoNote =
          eco?.supplyCrisisWaves > 0 || eco?.rebellionWaves > 0
            ? ' · CRISIS'
            : eco?.rebellionRisk >= 55
              ? ' · unrest'
              : '';
        const dynNote =
          dyn?.regencyWaves > 0 || dyn?.successionCrisisWaves > 0
            ? ' · DYN'
            : dyn?.dynastyPrestige < 35
              ? ' · line weak'
              : '';
        const edictNote =
          edicts?.remaining > 0 && typeof GrandStrategy !== 'undefined' && GrandStrategy.isPanelOpen()
            ? ' · EDICT'
            : edicts?.edictsThisWave > 0
              ? ` · ${edicts.edictsThisWave} ed`
              : '';
        const kingdom = gsSnap.kingdomEvolution;
        const pathNote = kingdom?.resolved ? ` · ${kingdom.pathLabel} T${kingdom.tier}` : '';
        gsText.textContent = `${gsSnap.season || '—'} · ${orders} ord · ${builds} bld${pathNote}${mobNote}${ecoNote}${dynNote}${edictNote}${alertNote}${tactNote}`;
        const mob = gsSnap.mobilization;
        gsText.title = `Grand Strategy — Treasury ${Math.floor(gsSnap.treasury || 0)} · House ${dyn?.houseName || '—'} · Prestige ${dyn?.dynastyPrestige ?? 0} · Template ${mob?.templateLabel || '—'}${kingdom?.resolved ? ` · ${kingdom.pathLabel}` : ''} · Shift+G`;
        gsText.className =
          'stat-value grand-strategy-value' + (orders > 0 ? ' grand-strategy-active' : '');
      }
    }
    if (gsBtn) {
      // Soft-lock: always visible; dimmed when locked. Do NOT use disabled=
      // (disabled buttons swallow clicks and feel "broken").
      gsBtn.style.display = '';
      gsBtn.disabled = false;
      gsBtn.setAttribute('aria-disabled', gsUnlocked ? 'false' : 'true');
      gsBtn.classList.toggle('layer-btn-locked', !gsUnlocked);
      gsBtn.title = gsUnlocked
        ? 'Grand Strategy — kingdom map (Shift+G)'
        : 'Grand Strategy unlocks at wave 150 (Shift+G) — click for details';
      gsBtn.classList.toggle(
        'grand-strategy-open',
        gsUnlocked && typeof GrandStrategy !== 'undefined' && GrandStrategy.isPanelOpen()
      );
    }
    if (typeof GrandStrategy !== 'undefined') GrandStrategy.renderPanel(gs);

    const igHud = document.getElementById('intergalactic-hud');
    const igText = document.getElementById('intergalactic-text');
    const igBtn = document.getElementById('intergalactic-btn');
    const igSnap = gs.intergalactic;
    const igUnlocked =
      !!igSnap?.active ||
      (typeof IntergalacticLayer !== 'undefined' && IntergalacticLayer.isUnlocked?.(gs.wave));
    if (igHud && igText) {
      const show = igUnlocked;
      igHud.style.display = show ? '' : 'none';
      if (show) {
        const zoom = igSnap.zoomedPlanet?.label || 'Aurion Prime';
        const siegeNote = igSnap.homeworldSiege ? ' · SIEGE' : '';
        const ordNote = igSnap.orders > 0 ? ` · ${igSnap.orders} fleet` : '';
        const bldNote = igSnap.planetProjects > 0 ? ` · ${igSnap.planetProjects} bld` : '';
        const crisisNote = igSnap.activeCrises > 0 ? ` · ${igSnap.activeCrises} crisis` : '';
        const empire = igSnap.empire;
        const domNote = empire?.dominantFaction ? ` · ${empire.dominantFaction.label.split(' ').pop()}` : '';
        const unrestNote = empire?.highUnrest ? ` · ${empire.highUnrest} unrest` : '';
        const warfare = igSnap.warfare;
        const warOffer = warfare?.wars?.filter((w) => w.battleOffered).length || 0;
        const warActive = warfare?.wars?.filter((w) => w.battleActive).length || 0;
        const warNote = warOffer ? ` · ${warOffer} war!` : warActive ? ` · ${warActive} battle` : '';
        const exp = igSnap.exploration;
        const anomNote = exp?.activeAnomalies ? ` · ${exp.activeAnomalies} anom` : '';
        const precNote = exp?.precursorClues > 0 ? ` · P${exp.precursorClues}` : '';
        const politics = igSnap.politics;
        const fedNote = politics?.federationLabel ? ` · ${politics.federationLabel.split(' ')[0]}` : '';
        const tradeNote = politics?.activeDeals ? ` · ${politics.activeDeals} trade` : '';
        const spyNote = politics?.spyExposure >= 40 ? ' · exposed' : politics?.activeSpy ? ` · ${politics.activeSpy} spy` : '';
        const endgame = igSnap.endgame;
        const gcNote = endgame?.galacticCrisis
          ? ` · ${endgame.galacticCrisis.label.split(' ').pop()} ${endgame.galacticCrisis.severity}%`
          : endgame?.empireCollapsed
            ? ' · COLLAPSED'
            : '';
        const echoes = igSnap.narrativeEchoes;
        const echoNote = echoes?.active?.length ? ` · ${echoes.active.length} echo` : '';
        const cosmic = igSnap.cosmicEvolution;
        const cosmicNote = cosmic?.resolved ? ` · ${cosmic.pathLabel} T${cosmic.tier}` : '';
        const sep = igSnap.separation;
        const invNote = sep?.invasionActive
          ? ` · INVASION`
          : sep?.invasionOffers
            ? ` · ${sep.invasionOffers} inv!`
            : '';
        igText.textContent = `${igSnap.time || '—'} · ${zoom}${cosmicNote}${siegeNote}${ordNote}${bldNote}${crisisNote}${domNote}${unrestNote}${warNote}${anomNote}${precNote}${fedNote}${tradeNote}${spyNote}${gcNote}${echoNote}${invNote}`;
        const dev = igSnap.selectedDevelopment;
        const devNote = dev
          ? ` · ${dev.districtsUsed}/${dev.districtSlots} dist · Happy ${Math.round(dev.pops?.happiness || 0)}`
          : '';
        const ethicsNote = empire?.ethics?.length
          ? ` · ${empire.ethics.map((e) => e.label).join(', ')}`
          : '';
        igText.title = `Galaxy — Alloys ${Math.floor(igSnap.alloys || 0)} · Energy ${Math.floor(igSnap.energy || 0)} · Autonomy ${empire?.avgAutonomy || 0}%${cosmic?.resolved ? ` · ${cosmic.pathLabel}` : ''}${devNote}${ethicsNote} · Shift+U`;
        igText.className =
          'stat-value intergalactic-value' +
          (igSnap.defenseInstances > 0 ||
          igSnap.homeworldSiege ||
          igSnap.activeCrises > 0 ||
          empire?.highUnrest > 0 ||
          warOffer > 0 ||
          warActive > 0 ||
          (exp?.activeAnomalies > 0) ||
          endgame?.galacticCrisis ||
          endgame?.empireCollapsed ||
          echoes?.active?.length > 0 ||
          sep?.invasionActive ||
          sep?.invasionOffers > 0
            ? ' intergalactic-active'
            : '');
      }
    }
    if (igBtn) {
      // Soft-lock: always clickable so locked state can explain unlock wave.
      igBtn.style.display = '';
      igBtn.disabled = false;
      igBtn.setAttribute('aria-disabled', igUnlocked ? 'false' : 'true');
      igBtn.classList.toggle('layer-btn-locked', !igUnlocked);
      igBtn.title = igUnlocked
        ? 'Intergalactic — galaxy map (Shift+U)'
        : 'Intergalactic unlocks at wave 400 (Shift+U) — click for details';
      igBtn.classList.toggle(
        'intergalactic-open',
        igUnlocked && typeof IntergalacticLayer !== 'undefined' && IntergalacticLayer.isPanelOpen()
      );
    }
    if (typeof IntergalacticLayer !== 'undefined') IntergalacticLayer.renderPanel(gs);

    document.querySelectorAll('.doctrine-btn').forEach((btn) => {
      const id = btn.dataset.doctrine;
      const def = gs.kingdomDoctrines?.[id];
      const cost = def?.cost ?? 99;
      const stageReq = parseInt(btn.dataset.kingdomStage || def?.kingdomStage || '0', 10);
      const stageLocked = stageReq > 0 && (gs.kingdomStage || 1) < stageReq;
      const costEl = btn.querySelector('.cost');
      if (costEl) costEl.textContent = String(cost);
      btn.classList.toggle(
        'disabled',
        gs.tactical < cost || gs.doctrineUsedThisWave || stageLocked
      );
      btn.classList.toggle('kingdom-locked', stageLocked);
      btn.title =
        stageLocked && typeof KINGDOM_EVOLUTION_STAGES !== 'undefined'
          ? `Unlocks in ${KINGDOM_EVOLUTION_STAGES[stageReq]?.name || 'later stage'} — ${def?.desc || ''}`
          : def?.desc || '';
    });

    const strengthWrap = document.getElementById('strength-meter-wrap');
    const strengthStage = document.getElementById('strength-stage-text');
    const strengthFill = document.getElementById('strength-fill');
    const strengthBaseline = document.getElementById('strength-baseline-mark');
    const strengthRatio = document.getElementById('strength-ratio-text');
    const strengthHud = document.getElementById('strength-hud');
    const cv = gs.colonyValue || 0;
    const ratio = gs.colonyThreatRatio || 1;
    const tier = gs.colonyThreatTier || '—';
    const tierColor = gs.colonyThreatColor || '#88cc88';
    const nextP = gs.colonyNextPressure;
    const barPct = Math.max(0, Math.min(100, ((ratio - 0.5) / 1.75) * 100));
    const baselinePct = ((1 - 0.5) / 1.75) * 100;
    const tierSlug = String(tier)
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    const colonySnap =
      cv > 0
        ? {
            total: cv,
            baseline: gs.colonyBaseline || 0,
            threatRatio: ratio,
            tier: { label: tier, color: tierColor },
            breakdown: gs.colonyBreakdown || {},
          }
        : null;
    const threatTooltip =
      typeof ColonyValue !== 'undefined' && ColonyValue.formatThreatTooltip
        ? ColonyValue.formatThreatTooltip(colonySnap, nextP, gs.wave || 0)
        : gs.colonyThreatTooltip || 'Kingdom strength vs next wave baseline — hover for details.';
    if (strengthFill) {
      strengthFill.style.width = cv > 0 ? `${barPct}%` : '0%';
      strengthFill.style.background = `linear-gradient(90deg, ${tierColor}77, ${tierColor})`;
    }
    if (strengthBaseline) strengthBaseline.style.left = `${baselinePct}%`;
    if (strengthStage) {
      const stageShort =
        typeof ColonyValue !== 'undefined' && ColonyValue.getThreatStageIndex
          ? ColonyValue.THREAT_TIERS[ColonyValue.getThreatStageIndex(ratio)]?.short
          : null;
      strengthStage.textContent = cv > 0 ? stageShort || tier.slice(0, 4) : '—';
      strengthStage.style.color = tierColor;
      strengthStage.style.borderColor = `${tierColor}88`;
      strengthStage.title = cv > 0 ? `${tier} — Kingdom strength stage` : '';
    }
    if (strengthRatio) {
      strengthRatio.textContent = cv > 0 ? `${ratio.toFixed(2)}×` : '—';
      strengthRatio.style.color = tierColor;
    }
    if (strengthWrap) {
      strengthWrap.title = threatTooltip;
      strengthWrap.className = 'strength-meter-wrap' + (cv > 0 ? ` strength-tier-${tierSlug}` : '');
    }
    if (strengthHud) {
      strengthHud.className =
        'stat-group strength-hud' +
        (cv > 0 && ratio >= 1.3 ? ' strength-elevated' : '') +
        (cv > 0 && ratio >= 1.7 ? ' strength-critical' : '');
    }

    const hostEl = document.getElementById('host-faction-text');
    if (hostEl) {
      const ef = gs.enemyFactions;
      const asymHost = gs.asymmetricWarfare;
      if (asymHost || ef?.activeSummary) {
        const summary = asymHost?.hostSummary || ef.activeSummary;
        hostEl.textContent = summary.slice(0, 44) + (summary.length > 44 ? '…' : '');
        const tips = (ef?.activeFactions || [])
          .map((f) => {
            const raid = f.counterRaids ? ' · counter-raids active' : '';
            return `${f.name} Stage ${f.stage} — ${f.tierLabel} (${f.buildingCount} sites${raid})\n${f.tagline}`;
          })
          .join('\n\n');
        const raidNote = ef?.counterRaidFactions?.length
          ? `\n\nCounter-raids: ${ef.counterRaidFactions.join(', ')}`
          : '';
        const ce = gs.counterEvolution;
        const debuffNote = ce?.debuffedFactions
          ? `\n\nCounter-offensive: ${ce.debuffedFactions} faction${ce.debuffedFactions > 1 ? 's' : ''} weakened` +
            ((ce.targets || [])
              .filter((t) => t.debuffed)
              .map((t) => ` · ${t.name} S${t.effectiveStage}`)
              .join('') || '')
          : '';
        const rep = gs.factionReputation;
        const repNote = rep?.factions?.length
          ? `\n\nReputation: ${rep.factions
              .map(
                (f) =>
                  `${f.name} ${f.stanceLabel} (${f.hostility}${f.evolutionOffset ? ` · evo ${f.evolutionOffset > 0 ? '+' : ''}${f.evolutionOffset}` : ''}${f.economicFocus ? ' · eco' : ''})`
              )
              .join(' · ')}`
          : '';
        const hostRole = asymHost
          ? `\n\n${asymHost.hostRole.name} Lv${asymHost.hostThreatLevel} — ${asymHost.hostLevelLabel}\n${asymHost.hostRole.macro}`
          : '';
        hostEl.title =
          (tips || 'Evolving host — levels up and threatens the map') +
          raidNote +
          debuffNote +
          repNote +
          hostRole;
        hostEl.style.color =
          asymHost?.balance === 'host_advantage'
            ? '#ff6060'
            : ef?.activeFactions?.[0]?.color || asymHost?.hostLevelLabel
              ? '#e07050'
              : '';
        hostEl.className =
          'stat-value host-value host-clickable' +
          (ef?.counterRaidFactions?.length || asymHost?.balance === 'host_advantage'
            ? ' host-raiding'
            : '') +
          ((ef?.hostKingdomTotal || 0) >= 40 ? ' host-high' : '');
        hostEl.title = (hostEl.title || '') + '\n\nClick HOST or 🗺 to open Threat Map.';
      } else {
        hostEl.textContent = '—';
        hostEl.title = 'Evolving host — auto-escalates; you build and command to push back';
        hostEl.style.color = '';
        hostEl.className = 'stat-value host-value';
      }
    }

    const conquestHud = document.getElementById('conquest-hud');
    const conquestEl = document.getElementById('conquest-text');
    const pc = gs.planetConquest;
    if (conquestHud && conquestEl) {
      const show = !!pc?.active;
      conquestHud.style.display = show ? '' : 'none';
      if (show) {
        const label = pc.summary || '—';
        conquestEl.textContent = label.slice(0, 22) + (label.length > 22 ? '…' : '');
        const sectorTips = (pc.sectors || [])
          .map(
            (s) =>
              `${s.fullName || s.name}: ${s.eliminated ? 'ELIMINATED' : `${s.playerControl}% conquered`}`
          )
          .join('\n');
        const goalLine = pc.trueVictoryLabel || 'TRUE WIN: Defeat Worldheart Tyrant';
        const bossNote = pc.planetBossActive
          ? `\n\n${goalLine}\nWorldheart Tyrant ${pc.planetBossHpPct ?? '?'}%${pc.planetBossShielded ? ' — warded (field 3+ unit types)' : ''}`
          : `\n\n${goalLine}\nEliminations: ${pc.eliminations || 0} · ${pc.remaining || 0} realms remain · Boss at ${pc.bossEliminationsMin || 2}+ fallen`;
        conquestEl.title = (sectorTips || 'Planet conquest sectors') + bossNote;
        conquestEl.className =
          'stat-value conquest-value' +
          (pc.victoryReady ? ' conquest-victory' : pc.planetBossActive ? ' conquest-boss' : '');
        conquestEl.style.color = pc.planetBossActive ? '#ff4080' : pc.victoryReady ? '#80ffa0' : '';
      }
    }

    const controlHud = document.getElementById('control-hud');
    const controlEl = document.getElementById('control-text');
    const pw = gs.planetWarfare;
    if (controlHud && controlEl) {
      const show = pw?.active;
      controlHud.style.display = show ? '' : 'none';
      if (show) {
        const pct = pw.hostileControlPct ?? 0;
        controlEl.textContent = `${pct}% ${pw.tier || ''}`;
        controlEl.title =
          pw.controlNote ||
          `Hostile map control — vision ×${(pw.visionMult ?? 1).toFixed(2)}, spawn pace ×${(pw.spawnIntervalMult ?? 1).toFixed(2)}`;
        const tierClass =
          pct >= 72
            ? 'control-critical'
            : pct >= 52
              ? 'control-contested'
              : pct >= 32
                ? 'control-pressured'
                : '';
        controlEl.className = `stat-value control-value${tierClass ? ` ${tierClass}` : ''}`;
        controlEl.style.color = pw.tierColor || '';
      }
    }

    const realmHud = document.getElementById('realm-hud');
    const realmEl = document.getElementById('realm-biome-text');
    const lp = gs.livingPlanet;
    if (realmHud && realmEl) {
      const show = !!(lp?.active && (lp.unlocked?.length > 1 || (gs.territoryTier ?? 0) >= 2));
      realmHud.style.display = show ? '' : 'none';
      if (show) {
        realmEl.textContent =
          (lp.summary || 'Plains').slice(0, 28) + ((lp.summary || '').length > 28 ? '…' : '');
        const tips = (lp.biomes || []).map((b) => `${b.name}: ${b.desc}`).join('\n');
        realmEl.title = tips || 'Living planet biomes unlock as territory expands.';
        const hasHell = lp.unlocked?.includes('hellscape');
        const hasMount = lp.unlocked?.includes('mountains');
        realmEl.className =
          'stat-value realm-value' +
          (hasHell ? ' realm-hellscape' : hasMount ? ' realm-mountains' : ' realm-forest');
        realmEl.style.color = hasHell ? '#e05070' : hasMount ? '#a0a090' : '#70a878';
      }
    }

    const planetHud = document.getElementById('planet-event-hud');
    const planetEl = document.getElementById('planet-event-text');
    const me = gs.mapEvents;
    if (planetHud && planetEl) {
      const show = !!(me?.active || me?.pending || (gs.wave || 0) >= (me?.waveMin || 12));
      planetHud.style.display = show ? '' : 'none';
      if (show) {
        const label =
          me?.activeSummary ||
          (me?.pending && me?.event?.name ? `${me.event.name} — respond` : null) ||
          me?.event?.name ||
          'Planet';
        planetEl.textContent = (label || '—').slice(0, 28) + ((label || '').length > 28 ? '…' : '');
        planetEl.title =
          me?.event?.prep ||
          me?.activeSummary ||
          'Dynamic map events — volcanic eruptions, awakening ruins, ley storms';
        planetEl.className =
          'stat-value planet-event-value' + (me?.pending ? ' planet-event-active' : '');
        planetEl.style.color = me?.event?.color || '';
      }
    }

    const intelEl = document.getElementById('wave-intel-text');
    if (intelEl) {
      const mf = gs.multiFrontSiege;
      const mfNote = mf?.intel ? mf.intel : '';
      const bossPack = gs.monsterBosses?.currentPack?.packSummary;
      const hazNote = gs.factionHazards?.summary;
      const wildNote = gs.neutralWildlife?.summary;
      const pactNote = gs.neutralRelations?.summary;
      const biomeNote = gs.biomeSpawn?.summary;
      const mapNote =
        me?.activeSummary || (me?.pending && me?.event?.name ? `${me.event.name} pending` : '');
      const repNote = gs.factionReputation?.summary;
      const conquestNote = gs.planetConquest?.active ? gs.planetConquest.summary : '';
      // Prefer short structured brief over nextWaveIntel (which piles meta notes).
      const briefParts = [];
      if (gs.namedBoss) briefParts.push(String(gs.namedBoss));
      else if (bossPack) briefParts.push(String(bossPack).slice(0, 28));
      if (mfNote) briefParts.push(String(mfNote).slice(0, 28));
      else if (conquestNote) briefParts.push(String(conquestNote).slice(0, 28));
      else if (mapNote) briefParts.push(String(mapNote).slice(0, 28));
      else if (repNote) briefParts.push(String(repNote).slice(0, 28));
      else if (pactNote || biomeNote || hazNote || wildNote) {
        briefParts.push(String(pactNote || biomeNote || hazNote || wildNote).slice(0, 28));
      }
      if (!briefParts.length && gs.nextWaveIntel) {
        // Fallback: first clause only (before meta · soup)
        briefParts.push(String(gs.nextWaveIntel).split(' · ')[0].slice(0, 40));
      }
      const intel = briefParts.filter(Boolean).join(' · ');
      intelEl.textContent = intel ? intel.slice(0, 48) + (intel.length > 48 ? '…' : '') : '—';
      intelEl.title = intel || '';
      if (mf?.mode) {
        intelEl.className =
          'stat-value intel-value' +
          (mf.mode === 'competing' ? ' intel-competing' : ' intel-coordinated');
      } else {
        intelEl.className = 'stat-value intel-value';
      }
    }

    const synHud = document.getElementById('syn-hud');
    const synEl = document.getElementById('syn-text');
    const syns = gs.factionSynergies || [];
    const skillNote = gs.operativeSkills?.summary;
    const hasCrossoverField = (gs.wweOnField || 0) + (gs.crossoverOnField || 0) > 0;
    if (synHud && synEl) {
      const show =
        hasCrossoverField && (syns.length > 0 || gs.seasonalEvent || skillNote || gs.operativeSkills?.active);
      synHud.style.display = show ? '' : 'none';
      if (show) {
        const parts = [];
        if (syns.length) parts.push(syns.slice(0, 2).join(' · '));
        if (skillNote) parts.push(`⚔ ${skillNote}`);
        if (gs.seasonalEvent) parts.push(`★ ${gs.seasonalEvent}`);
        synEl.textContent =
          parts.join(' | ').slice(0, 42) + (parts.join(' | ').length > 42 ? '…' : '');
        const skillTips = (gs.operativeSkills?.factions || [])
          .filter((f) => f.purchased?.length)
          .map(
            (f) =>
              `${f.label}: ${f.purchased.length} node(s) · ${f.availablePoints} SP available`
          )
          .join('\n');
        synEl.title = [
          syns.length ? `Active synergies: ${syns.join(', ')}` : '',
          skillTips || (skillNote ? `Operative skills: ${skillNote}` : ''),
          gs.seasonalEvent ? `Seasonal: ${gs.seasonalEvent}` : '',
        ]
          .filter(Boolean)
          .join('\n');
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
  let lastHudRevision = -1;
  let lastThreatKey = '';
  let lastMessageText = '';
  let lastCmdKey = '';
  let lastWaveFillKey = '';
  let lastAsymKey = '';

  let lastResearchBtnKey = '';

  function updateHudMeters(gs) {
    const waveFill = hudEls['wave-fill'];
    if (waveFill) {
      const prog =
        gs.timeOfDay === 'night'
          ? Math.round((gs.nightProgress ?? 0) * 100)
          : Math.round((gs.waveProgress ?? 0) * 100);
      const waveFillKey = `${gs.timeOfDay}:${prog}`;
      if (waveFillKey !== lastWaveFillKey) {
        lastWaveFillKey = waveFillKey;
        waveFill.style.width = `${prog}%`;
        waveFill.classList.toggle('night-fill', gs.timeOfDay === 'night');
      }
    }
    // SP / research progress: update the RESEARCH button without full deploy-bar rebuild.
    const researchBtn = hudEls['research-open'];
    if (researchBtn) {
      const active = gs.researchActive;
      const killSci = gs.scienceKillStatus;
      const spLabel = (gs.sciencePoints ?? 0).toFixed(1);
      const researchKey = [
        active?.pct ?? '',
        spLabel,
        killSci?.labs ?? 0,
        killSci?.earned ?? 0,
        killSci?.cap ?? 0,
        gs.researchCompleted ?? 0,
      ].join('|');
      if (researchKey !== lastResearchBtnKey) {
        lastResearchBtnKey = researchKey;
        researchBtn.textContent = active
          ? `RESEARCH ${active.pct}%`
          : killSci?.labs > 0
            ? `RESEARCH ${spLabel} SP (${killSci.earned}/${killSci.cap})`
            : `RESEARCH (${spLabel} SP)`;
      }
    }
    const asym = gs.asymmetricWarfare;
    const asymPlayerFill = hudEls['asym-player-fill'];
    const asymHostFill = hudEls['asym-host-fill'];
    const asymBalance = hudEls['asym-balance-text'];
    if (asym && asymPlayerFill && asymHostFill) {
      const asymKey = [
        asym.playerBarPct,
        asym.hostBarPct,
        asym.balance,
        asym.commanderAuthority,
        asym.hostThreatLevel,
        asym.playerRole?.name,
        asym.hostRole?.name,
        asym.hostLevelTagline,
      ].join('|');
      if (asymKey !== lastAsymKey) {
        lastAsymKey = asymKey;
        asymPlayerFill.style.width = `${asym.playerBarPct}%`;
        asymHostFill.style.width = `${asym.hostBarPct}%`;
        if (asymBalance) {
          const balanceLabel =
            asym.balance === 'host_advantage'
              ? 'Host pressing'
              : asym.balance === 'player_advantage'
                ? 'You hold macro'
                : 'Contested';
          asymBalance.textContent = `${balanceLabel} · Cmd ${asym.commanderAuthority} vs Lv${asym.hostThreatLevel}`;
          asymBalance.title = `${asym.playerRole.name} vs ${asym.hostRole.name}\n${asym.hostLevelTagline || ''}`;
        }
      }
    }
  }

  function cacheHudDom() {
    const ids = [
      'tp-fill',
      'tp-text',
      'tp-round-text',
      'army-text',
      'wave-text',
      'wave-fill',
      'cycle-text',
      'begin-day-btn',
      'cmd-text',
      'asym-player-fill',
      'asym-host-fill',
      'asym-balance-text',
      'diff-text',
      'advanced-diff-pct',
      'message-box',
      'threat-text',
      'doomslayer-deploy',
      'wwe-academy-open',
      'crossover-hub-open',
      'perk-build-section',
      'loadout-section',
      'hunt-toggle',
      'formation-section',
      'research-open',
      'builder-repair-toggle',
      'demolish-btn',
      'move-building-btn',
      'rotate-wall-btn',
    ];
    for (const id of ids) {
      hudEls[id] = document.getElementById(id);
    }
    const bindCost = (selector) => {
      const nodes = [...document.querySelectorAll(selector)];
      for (const btn of nodes) {
        btn._costEl = btn.querySelector('.cost');
      }
      return nodes;
    };
    hudBtns.deploy = bindCost('.deploy-btn');
    hudBtns.ability = bindCost('.ability-btn');
    hudBtns.build = bindCost('.build-btn');
    hudBtns.spy = [...document.querySelectorAll('.spy-btn')];
    hudBtns.courier = [...document.querySelectorAll('.courier-btn')];
    const loadoutSection = hudEls['loadout-section'];
    hudBtns.loadout = loadoutSection
      ? [...loadoutSection.querySelectorAll('.loadout-btn')]
      : [];
    const formSection = hudEls['formation-section'];
    hudBtns.formation = formSection
      ? [...formSection.querySelectorAll('.formation-btn')]
      : [];
  }

  function hudKey(gs) {
    return [
      gs.state,
      gs.tactical,
      gs.wave,
      gs.army,
      gs.unitProducers,
      gs.selectedDeploy,
      gs.selectedAbility,
      gs.selectedBuild,
      gs.selectedDemolish,
      gs.selectedMoveBuilding,
      gs.selectedRotateWall,
      gs.pendingWallFacing,
      gs.moveBuildingTarget,
      gs.paused,
      gs.globalHunt,
      gs.courierUsedThisWave,
      gs.spyUsedThisWave,
      gs.doctrineUsedThisWave,
      gs.counterDoctrineUsedThisWave,
      gs.expeditionUsedThisWave,
      gs.kingdomEvolutionMeter?.stageProgress,
      gs.kingdomEvolutionMeter?.bannerStage,
      gs.waveProgress,
      gs.messages.length,
      gs.achievements?.unlocked,
      gs.difficulty,
      gs.rallyActive,
      gs.generalBuff,
      gs.hasGeneral,
      gs.generalStationed,
      gs.territoryTier,
      gs.academyEra,
      gs.canDeploy,
      gs.rtsEra,
      gs.settlementTpBonus,
      gs.liveBuilders,
      gs.difficultyPercent,
      gs.wweUnlocked,
      gs.doomslayerUnlocked,
      gs.hamletCount,
      gs.guildCount,
      gs.timeOfDay,
      gs.nightProgress,
      gs.nightSecondsLeft,
      // sciencePoints / researchActive.pct / kill SP meters update via updateHudMeters
      // so combat kills don't rebuild every deploy/build button every frame.
      gs.researchLabs,
      gs.researchCompleted,
      gs.selectedUnitsDigest ?? '',
      gs.generalThreat,
      gs.lastStandActive,
      gs.nextWaveIntel,
      gs.bossActive,
      gs.colonyValue,
      gs.colonyBaseline,
      gs.colonyThreatRatio,
      gs.colonyThreatTier,
      gs.colonyThreatColor,
      gs.colonyNextPressure?.countMult,
      gs.colonyNextPressure?.eliteSlots,
      gs.hybridAcademy,
      gs.builderAutoRepair,
      gs.settlementTpRaw,
      gs.creativeMode,
      gs.creativeTool,
      gs.creativeSpawnType,
      gs.selectedUnitId,
      gs.selectedUnitIds?.length,
      gs.selectionFormation,
      gs.creativeSettingsSig ?? JSON.stringify(gs.creativeSettings),
      (gs.factionSynergies || []).join(','),
      gs.seasonalEvent,
      gs.enemyCount,
      gs.replayInfo?.recording,
      gs.replayInfo?.frameCount,
      gs.creativeCustomWave?.count,
      gs.sandboxStats?.spawns,
      gs.asymmetricWarfare?.commanderAuthority,
      gs.asymmetricWarfare?.hostThreatLevel,
      gs.asymmetricWarfare?.balance,
      gs.asymmetricWarfare?.playerMacro,
      gs.asymmetricWarfare?.playerMicro,
      gs.enemyFactions?.activeSummary,
      gs.planetWarfare?.hostileControlPct,
      gs.planetConquest?.summary,
      gs.planetConquest?.eliminations,
      gs.planetConquest?.remaining,
      gs.planetConquest?.planetBossActive,
      gs.planetConquest?.planetBossHpPct,
      gs.planetConquest?.victoryReady,
      (gs.buildableAcademies || []).join(','),
      gs.settlementRaids?.summary,
      gs.settlementRaids?.pendingCount,
      gs.settlementRaids?.inFlightCount,
      (gs.settlementRaids?.missions || []).map((m) => `${m.id}:${m.dispatched}`).join(','),
      gs.multiFrontSiege?.mode,
      gs.multiFrontSiege?.intel,
      (gs.multiFrontSiege?.assignments || [])
        .map((a) => `${a.factionId}:${a.doctrine}:${a.frontLabel}`)
        .join(','),
      gs.monsterBosses?.currentPack?.evolution,
      gs.monsterBosses?.currentPack?.packSummary,
      gs.livingPlanet?.summary,
      (gs.livingPlanet?.unlocked || []).join(','),
      gs.factionHazards?.summary,
      gs.factionHazards?.count,
      gs.factionHazards?.voidSpreading,
      gs.neutralWildlife?.summary,
      gs.neutralWildlife?.count,
      gs.neutralWildlife?.event?.id,
      gs.neutralRelations?.summary,
      gs.neutralRelations?.reputation,
      gs.neutralRelations?.stance,
      gs.biomeSpawn?.summary,
      gs.biomeSpawn?.biome,
      gs.operativeSkills?.summary,
      (gs.operativeSkills?.factions || []).map((f) => `${f.factionId}:${f.purchased?.length}`).join(','),
      gs.mapEvents?.activeSummary,
      gs.mapEvents?.pending,
      gs.mapEvents?.event?.id,
      gs.mapEvents?.event?.choice,
      gs.factionReputation?.summary,
      (gs.factionReputation?.factions || [])
        .map((f) => `${f.factionId}:${f.hostility}:${f.stance}`)
        .join(','),
      gs.counterEvolution?.summary,
      gs.counterEvolution?.debuffedFactions,
      (gs.counterEvolution?.targets || [])
        .map((t) => `${t.factionId}:${t.effectiveStage}:${t.debuffed}`)
        .join(','),
      (gs.counterEvolution?.activeExpeditions || [])
        .map((e) => `${e.factionId}:${e.returnWave}`)
        .join(','),
    ].join('|');
  }

  /**
   * Compact night-prep chips: threat tier, host size, flanks, special flags.
   * Avoids dumping nextWaveIntel system-note soup onto the player.
   */
  function buildNightPrepChips(gs) {
    const chips = [];
    const tier = gs.colonyThreatTier;
    if (tier && tier !== '—') {
      chips.push({ label: tier, kind: 'threat' });
    }
    const pressure = gs.colonyNextPressure || gs.colonyThreatMods;
    const countMult = pressure?.countMult || 1;
    const sizePct = Math.round((countMult - 1) * 100);
    if (sizePct > 6) chips.push({ label: 'Larger host', kind: 'warn' });
    else if (sizePct < -6) chips.push({ label: 'Lighter host', kind: 'ok' });
    else chips.push({ label: 'Matched host', kind: 'neutral' });

    const sides = gs.attackSides || ['north'];
    if (sides.length > 1) {
      chips.push({
        label: `${sides.map((s) => String(s).slice(0, 1).toUpperCase()).join('/')} flanks`,
        kind: 'warn',
      });
    } else if (sides[0]) {
      const s = String(sides[0]);
      chips.push({
        label: `${s.charAt(0).toUpperCase()}${s.slice(1)} approach`,
        kind: 'neutral',
      });
    }

    if (gs.namedBoss) chips.push({ label: `Boss: ${String(gs.namedBoss).slice(0, 18)}`, kind: 'boss' });
    else if (gs.bossActive) chips.push({ label: 'Boss wave', kind: 'boss' });
    if (gs.multiFrontSiege?.mode === 'competing') chips.push({ label: 'Multi-front', kind: 'warn' });
    else if (gs.multiFrontSiege?.mode === 'coordinated') chips.push({ label: 'Coordinated', kind: 'warn' });
    if (gs.mapEvents?.pending && gs.mapEvents?.event?.name) {
      chips.push({ label: String(gs.mapEvents.event.name).slice(0, 16), kind: 'event' });
    }

    return chips.slice(0, 4);
  }

  function updateHUD(force = false) {
    if (Game.isPlaying?.()) ensureMenuDismissedForPlay();
    const hudRev = typeof Game.getHudRevision === 'function' ? Game.getHudRevision() : -1;
    if (!force && hudRev >= 0 && hudRev === lastHudRevision) {
      const gs = Game.getState();
      updateHudMeters(gs);
      if (gs.creativeMode && typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
      if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
      if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic(gs);
      return;
    }
    const gs = Game.getState();
    const key = hudKey(gs);
    if (!force && key === lastHudKey) {
      lastHudRevision = hudRev;
      updateHudMeters(gs);
      if (gs.creativeMode && typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
      if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
      if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic(gs);
      return;
    }
    lastHudKey = key;
    lastHudRevision = hudRev;

    const tpPool = Math.max(24, (gs.tpPerRound ?? TP_PER_ROUND) * 3);
    if (hudEls['tp-fill'])
      hudEls['tp-fill'].style.width = `${Math.min(100, (gs.tactical / tpPool) * 100)}%`;
    if (hudEls['tp-text']) hudEls['tp-text'].textContent = Math.floor(gs.tactical);
    const armyEl = hudEls['army-text'];
    if (armyEl) armyEl.textContent = String(gs.army ?? 0);
    const eco = gs.settlementTpBonus ?? 0;
    const tpRoundEl = hudEls['tp-round-text'];
    if (tpRoundEl) {
      tpRoundEl.textContent =
        eco > 0
          ? `+${gs.tpPerRound ?? TP_PER_ROUND} (${eco}▲)`
          : `+${gs.tpPerRound ?? TP_PER_ROUND}`;
    }

    const waveText = hudEls['wave-text'];
    const waveFill = hudEls['wave-fill'];
    const armyText = hudEls['army-text'];
    if (waveText) {
      const land =
        (gs.territoryTier ?? 0) > 0
          ? ` · Land ${['', 'I', 'II', 'III', 'IV', 'V', 'VI'][gs.territoryTier] || gs.territoryTier}`
          : '';
      waveText.textContent = gs.infiniteWaves
        ? `${gs.wave}${land}`
        : `${gs.wave} / ${gs.totalWaves}${land}`;
    }
    updateHudMeters(gs);
    if (armyText) armyText.textContent = String(gs.army ?? 0);

    const cycleText = hudEls['cycle-text'];
    const beginDayBtn = hudEls['begin-day-btn'];
    if (cycleText) {
      if (gs.timeOfDay === 'night') {
        const sec = gs.nightSecondsLeft ?? 0;
        const m = Math.floor(sec / 60);
        const s = String(sec % 60).padStart(2, '0');
        cycleText.textContent = `NIGHT ${m}:${s}`;
        cycleText.className = 'stat-value cycle-night' + (sec <= 15 ? ' cycle-urgent' : '');
        cycleText.title =
          'Night prep — no enemy spawns, +35% build speed. Press D to begin day early.';
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
        beginDayBtn.classList.toggle('begin-day-urgent', sec <= 15);
        beginDayBtn.classList.toggle('begin-day-ready', sec > 15);
        // Night prep progress (how much of the night remains)
        let bar = beginDayBtn.querySelector('.night-prep-bar');
        if (!bar) {
          bar = document.createElement('span');
          bar.className = 'night-prep-bar';
          bar.setAttribute('aria-hidden', 'true');
          beginDayBtn.appendChild(bar);
        }
        const maxSec = Math.max(
          1,
          gs.nightPrepSeconds ||
            Math.ceil((gs.nightPrepTicks || 3600) / 60) ||
            60
        );
        const pct = Math.max(0, Math.min(100, (sec / maxSec) * 100));
        bar.style.width = `${pct}%`;
      } else {
        beginDayBtn.classList.remove('begin-day-urgent', 'begin-day-ready');
      }
    }

    // Kill streak chip
    const streakHud = document.getElementById('streak-hud');
    const streakText = document.getElementById('streak-text');
    const streak = gs.feedback?.killStreak || 0;
    if (streakHud && streakText) {
      if (streak >= 2 && gs.timeOfDay !== 'night') {
        streakHud.style.display = '';
        streakText.textContent = String(streak);
        streakHud.classList.toggle('streak-hot', streak >= 5);
        streakHud.classList.toggle('streak-god', streak >= 12);
      } else {
        streakHud.style.display = 'none';
      }
    }

    // Night prep card — short scannable brief (no intel wall-of-text)
    const nightCard = document.getElementById('night-prep-card');
    if (nightCard) {
      if (gs.state === 'playing' && gs.timeOfDay === 'night' && !gs.paused) {
        nightCard.hidden = false;
        const timer = document.getElementById('night-prep-card-timer');
        const chipsEl = document.getElementById('night-prep-card-chips');
        const tipEl = document.getElementById('night-prep-card-tip');
        const sec = gs.nightSecondsLeft ?? 0;
        if (timer) {
          const m = Math.floor(sec / 60);
          const s = String(sec % 60).padStart(2, '0');
          timer.textContent = `${m}:${s}`;
          timer.classList.toggle('urgent', sec <= 15);
        }
        if (chipsEl) {
          const chips = buildNightPrepChips(gs);
          chipsEl.innerHTML = chips
            .map((c) => {
              const label = String(c.label || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              const kind = c.kind ? ` night-chip-${c.kind}` : '';
              return `<span class="night-prep-chip${kind}">${label}</span>`;
            })
            .join('');
        }
        if (tipEl) {
          const tip = (gs.feedback?.nightTips || []).find((t) => t?.text && t.id !== 'intel');
          tipEl.textContent = tip?.text
            ? `${tip.icon || '•'} ${tip.text}`
            : '• Reposition · spend TP · D when ready';
        }
        nightCard.classList.toggle('night-prep-urgent', sec <= 15);
      } else {
        nightCard.hidden = true;
      }
    }

    const cmdText = hudEls['cmd-text'];
    const asym = gs.asymmetricWarfare;
    if (cmdText) {
      const cmdKey = asym
        ? `${asym.playerMacro}|${asym.playerMicro}|${asym.balance}|${asym.playerRole?.name}`
        : `${gs.generalBuff}|${gs.hasGeneral}|${gs.generalStationed}`;
      if (cmdKey !== lastCmdKey) {
        lastCmdKey = cmdKey;
        if (asym) {
          cmdText.textContent = `${asym.playerMacro} · ${asym.playerMicro}`;
          cmdText.className =
            'stat-value cmd-value' +
            (asym.balance === 'player_advantage'
              ? ' cmd-active'
              : asym.balance === 'host_advantage'
                ? ' cmd-pressured'
                : '');
          cmdText.title = `${asym.playerRole.name} — Macro: ${asym.playerRole.macro}\nMicro: ${asym.playerRole.micro}`;
        } else if (gs.generalBuff > 0) {
          cmdText.textContent = `${gs.generalBuff}%`;
          cmdText.className = 'stat-value cmd-value cmd-active';
          cmdText.title = '';
        } else if (gs.hasGeneral) {
          cmdText.textContent = gs.generalStationed ? '—' : '→ KEEP';
          cmdText.className = 'stat-value cmd-value cmd-march';
          cmdText.title = '';
        } else {
          cmdText.textContent = '—';
          cmdText.className = 'stat-value cmd-value';
          cmdText.title = '';
        }
      }
    }

    const diffText = hudEls['diff-text'];
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
    const advPct = hudEls['advanced-diff-pct'];
    if (advPct) advPct.textContent = `Effective: ${gs.difficultyPercent ?? 100}%`;

    if (typeof Achievements !== 'undefined') Achievements.updateTopBar();

    updateButtonStates(gs);

    const msgBox = hudEls['message-box'];
    if (msgBox) {
      const msgText = gs.messages.length > 0 ? gs.messages[gs.messages.length - 1].text : '';
      if (msgText !== lastMessageText) {
        lastMessageText = msgText;
        if (msgText) {
          msgBox.textContent = msgText;
          msgBox.classList.add('show');
        } else {
          msgBox.classList.remove('show');
        }
      }
    }

    if ((gs.state === 'victory' || gs.state === 'defeat') && !gameOverShown) {
      gameOverShown = true;
      if (typeof UX !== 'undefined' && UX.renderVictoryScreen) UX.renderVictoryScreen(gs);
      else {
        const title = document.getElementById('result-title');
        title.textContent = gs.state === 'victory' ? 'VICTORY!' : 'DEFEAT';
        title.className = gs.state;
      }
      if (typeof CrownLegacies !== 'undefined') refreshCrownLegaciesPanel();
      if (typeof EternalLegacyTree !== 'undefined') refreshEternalLegacyPanel();
    }

    if (typeof CreativeMode !== 'undefined') CreativeMode.onHudUpdate(gs);
    if (typeof UX !== 'undefined') UX.onGameUpdate(gs);
    if (typeof Tooltips !== 'undefined') Tooltips.refreshDynamic(gs);
  }

  return {
    init,
    updateHUD,
    updateSpeedControl,
    refreshPanelIcons,
    hideMenusForPlay,
    ensureMenuDismissedForPlay,
    showMainMenu,
    getSelectedDifficulty: () => selectedDifficulty,
    setSelectedDifficulty: updateDifficultyUI,
  };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.UI = UI;
