/**
 * Main Application Controller
 */

import { state } from './state.js';
import { GameEngine } from './engine.js';
import { RotaryWheel } from './wheel.js';
import { HexBoard } from './hexBoard.js';
import { MemoBoard } from './memoBoard.js';
import { IsometricMap } from './isometricMap.js';
import { CODEX_CATEGORIES, CODEX_DATA, CLUE_RECIPES } from './data/codexData.js';
import { MAP_LOCATIONS } from './data/mapData.js';
import { AuthorEditor, applySavedAuthorData } from './authorEditor.js?v=6';

const AUTHOR_DATA_LOAD_RESULT = applySavedAuthorData();
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);

class App {
  constructor() {
    this.engine = new GameEngine();
    this.wheel = null;
    this.isometricMap = null;
    this.memoBoard = null;
    this.hexBoards = {};

    this.activeCodexCategory = 'all';
    this.activeCodexSearch = '';
    this.selectedCodexId = null;
    this.selectedMemoIndexCategory = null;
    this.selectedMemoDetailId = null;
    this.activeInventoryCategory = '전체';
    this.selectedInventoryItemId = null;
    this.isReaderSettingsOpen = false;
    this.isControlsHidden = false;
    this.authorEditor = null;

    this.init();
  }

  init() {
    this.wheel = new RotaryWheel({
      onSelectPanel: (panelId) => this.openPocketModal(panelId),
      playAudio: (type) => this.engine.playAudio(type)
    });

    this.applyReaderSettings(state.getReaderSettings());
    this.initTopViewerBar();
    this.initAuthorEditor();
    this.initPocketModals();
    this.initHexBoards();
    this.initDistractionFreeToggle();

    state.on('change', () => {
      this.refreshCurrentPanel();
      this.syncPocketAvailability();
      this.wheel.updateNotificationBadge();
    });

    this.syncPocketAvailability();

    if (state.getMode() === 'investigation') {
      this.engine.startInvestigation(state.getCurrentLocationId());
    } else {
      this.engine.renderStoryNode(state.getCurrentNodeId());
    }

  }

  initAuthorEditor() {
    this.authorEditor = new AuthorEditor({
      loadError: AUTHOR_DATA_LOAD_RESULT.error,
      onDataChanged: () => {
        this.refreshCurrentPanel();
        if (state.getMode() === 'investigation') {
          this.engine.startInvestigation(state.getCurrentLocationId());
        } else {
          this.engine.renderStoryNode(state.getCurrentNodeId());
        }
      },
      onTestStory: (nodeId) => {
        this.closePocketModal();
        state.setMode('story');
        state.setCurrentNode(nodeId);
        this.engine.renderStoryNode(nodeId);
      }
    });
  }

  applyReaderSettings(settings) {
    const root = document.documentElement;

    if (settings.fontFamily === 'serif') {
      root.style.setProperty('--novel-font-family', "'Noto Serif KR', serif");
    } else if (settings.fontFamily === 'sans') {
      root.style.setProperty('--novel-font-family', "'Pretendard', 'Noto Sans KR', system-ui, sans-serif");
    } else if (settings.fontFamily === 'mono') {
      root.style.setProperty('--novel-font-family', "'D2Coding', 'Courier New', monospace");
    }

    root.style.setProperty('--novel-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--novel-line-height', `${settings.lineHeight}`);
    root.style.setProperty('--novel-letter-spacing', `${settings.letterSpacing}px`);

    document.body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    document.body.classList.add(`theme-${settings.theme}`);

    this.syncSettingsUI(settings);
  }

  syncPocketAvailability() {
    const hasPocket = state.hasPocket();
    const showTutorial = hasPocket && !state.hasOpenedPocket();
    const hideHandle = !hasPocket || (this.isControlsHidden && state.getMode() === 'story');
    const handle = document.getElementById('pocket-handle');
    const quickPocketButton = document.getElementById('btn-quick-pocket');
    const tutorial = document.getElementById('pocket-tutorial');

    if (handle) {
      handle.classList.toggle('is-hidden', hideHandle);
      handle.classList.toggle('is-tutorial', showTutorial);
      handle.disabled = !hasPocket;
      handle.tabIndex = hasPocket ? 0 : -1;
      handle.setAttribute('aria-hidden', String(!hasPocket));
    }

    if (quickPocketButton) {
      quickPocketButton.classList.toggle('is-hidden', !hasPocket);
      quickPocketButton.disabled = !hasPocket;
      quickPocketButton.setAttribute('aria-hidden', String(!hasPocket));
    }

    if (tutorial) {
      tutorial.classList.toggle('is-visible', showTutorial);
      tutorial.setAttribute('aria-hidden', String(!showTutorial));
    }
  }

  syncSettingsUI(settings) {
    document.querySelectorAll('.font-family-btn').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.font === settings.fontFamily);
    });

    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.theme === settings.theme);
    });

    const sizeSlider = document.getElementById('setting-font-size');
    const sizeVal = document.getElementById('setting-font-size-val');
    if (sizeSlider) sizeSlider.value = settings.fontSize;
    if (sizeVal) sizeVal.textContent = `${settings.fontSize}px`;

    const lhSlider = document.getElementById('setting-line-height');
    const lhVal = document.getElementById('setting-line-height-val');
    if (lhSlider) lhSlider.value = settings.lineHeight;
    if (lhVal) lhVal.textContent = `${settings.lineHeight}`;

    const lsSlider = document.getElementById('setting-letter-spacing');
    const lsVal = document.getElementById('setting-letter-spacing-val');
    if (lsSlider) lsSlider.value = settings.letterSpacing;
    if (lsVal) lsVal.textContent = `${settings.letterSpacing}px`;
  }

  initTopViewerBar() {
    const settingsToggleBtn = document.getElementById('btn-reader-settings-toggle');
    const settingsPopover = document.getElementById('reader-settings-popover');
    const popoverCloseBtn = document.getElementById('btn-close-settings');
    const quickPocketBtn = document.getElementById('btn-quick-pocket');

    if (quickPocketBtn) {
      quickPocketBtn.addEventListener('click', () => {
        if (this.wheel) {
          this.wheel.toggle();
        }
      });
    }

    if (settingsToggleBtn && settingsPopover) {
      settingsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isReaderSettingsOpen = !this.isReaderSettingsOpen;
        settingsPopover.classList.toggle('is-visible', this.isReaderSettingsOpen);
        settingsToggleBtn.setAttribute('aria-expanded', String(this.isReaderSettingsOpen));
        this.engine.playAudio('click');
      });

      if (popoverCloseBtn) {
        popoverCloseBtn.addEventListener('click', () => {
          this.isReaderSettingsOpen = false;
          settingsPopover.classList.remove('is-visible');
        });
      }

      document.addEventListener('click', (e) => {
        if (this.isReaderSettingsOpen && !settingsPopover.contains(e.target) && e.target !== settingsToggleBtn) {
          this.isReaderSettingsOpen = false;
          settingsPopover.classList.remove('is-visible');
        }
      });
    }

    document.querySelectorAll('.font-family-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const font = btn.dataset.font;
        state.updateReaderSettings({ fontFamily: font });
        this.applyReaderSettings(state.getReaderSettings());
        this.engine.playAudio('click');
      });
    });

    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        state.updateReaderSettings({ theme });
        this.applyReaderSettings(state.getReaderSettings());
        this.engine.playAudio('click');
      });
    });

    const sizeSlider = document.getElementById('setting-font-size');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.updateReaderSettings({ fontSize: val });
        this.applyReaderSettings(state.getReaderSettings());
      });
    }

    const lhSlider = document.getElementById('setting-line-height');
    if (lhSlider) {
      lhSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.updateReaderSettings({ lineHeight: val });
        this.applyReaderSettings(state.getReaderSettings());
      });
    }

    const lsSlider = document.getElementById('setting-letter-spacing');
    if (lsSlider) {
      lsSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.updateReaderSettings({ letterSpacing: val });
        this.applyReaderSettings(state.getReaderSettings());
      });
    }

    const muteBtn = document.getElementById('btn-sound-toggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.engine.soundEnabled = !this.engine.soundEnabled;
        muteBtn.textContent = this.engine.soundEnabled ? '🔊' : '🔇';
        muteBtn.title = this.engine.soundEnabled ? '효과음 켜기/끄기' : '효과음 꺼짐 (음소거)';
        muteBtn.classList.toggle('is-muted', !this.engine.soundEnabled);
      });
    }
  }

  initDistractionFreeToggle() {
    const novelBody = document.getElementById('story-content');
    const topBar = document.getElementById('top-viewer-bar');
    const pocketHandle = document.getElementById('pocket-handle');

    if (novelBody) {
      novelBody.addEventListener('click', (e) => {
        if (
          e.target.classList.contains('novel-p') ||
          e.target.classList.contains('novel-paragraphs') ||
          e.target.id === 'story-content'
        ) {
          this.isControlsHidden = !this.isControlsHidden;
          if (topBar) topBar.classList.toggle('is-hidden', this.isControlsHidden);
          if (pocketHandle) {
            pocketHandle.classList.toggle(
              'is-hidden',
              !state.hasPocket() || (this.isControlsHidden && state.getMode() === 'story')
            );
          }
        }
      });
    }
  }

  initPocketModals() {
    const modal = document.getElementById('pocket-drawer-modal');
    const closeBtn = document.getElementById('drawer-close-btn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        if (modal.classList.contains('is-open')) {
          this.closePocketModal();
        } else {
          this.wheel?.close();
        }
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closePocketModal();
        }
      });
    }

    document.querySelectorAll('.drawer-nav-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const panelId = tab.dataset.panel;
        this.switchPocketPanel(panelId);
      });
    });

    document.querySelectorAll('.codex-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.codex-filter-btn').forEach((filterButton) => {
          filterButton.classList.remove('is-active');
          filterButton.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        this.activeCodexCategory = btn.dataset.category;
        this.renderCodexList();
        this.memoBoard?.centerClues();
      });
    });

    document.querySelectorAll('.inventory-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.inventory-filter-btn').forEach(filter => filter.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.activeInventoryCategory = btn.dataset.category;
        this.renderInventory();
      });
    });

    const searchInput = document.getElementById('codex-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.activeCodexSearch = e.target.value.trim().toLowerCase();
        this.renderCodexList();
      });
    }

    const resetBtn = document.getElementById('btn-reset-game');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('현재 진행 상황, 인벤토리, 발견한 단서를 모두 초기화하고 처음부터 다시 시작하시겠습니까?')) {
          state.reset();
          this.closePocketModal();
          this.engine.showToast('게임이 초기화되었습니다.', 'info', '🔄');
          this.engine.renderStoryNode('ep1_pocket_intro');
        }
      });
    }
  }

  initHexBoards() {
    const mapSvg = document.getElementById('academy-map-svg');
    const mapLayer = document.getElementById('academy-map-layer');
    if (mapSvg && mapLayer) {
      this.isometricMap = new IsometricMap({
        layerEl: mapLayer,
        isLocationUnlocked: (loc) => this.isLocationUnlocked(loc),
        onTravelToLocation: (loc) => this.travelToLocation(loc),
        onSetCurrentTile: (tileKey) => state.setCurrentMapTileKey(tileKey)
      });
    }

    const inventorySvg = document.getElementById('inventory-hex-svg');
    const inventoryLayer = document.getElementById('inventory-hex-layer');
    if (inventorySvg && inventoryLayer) {
      this.hexBoards.inventory = new HexBoard({
        svgEl: inventorySvg,
        layerEl: inventoryLayer,
        onSelectNode: (node) => this.selectInventoryItem(node)
      });
      this.hexBoards.inventory.mode = 'inv';
    }

    const memoSvg = document.getElementById('memo-hex-svg');
    const memoLayer = document.getElementById('memo-hex-layer');
    if (memoSvg && memoLayer) {
      this.memoBoard = new MemoBoard({
        svgEl: memoSvg,
        layerEl: memoLayer,
        recipes: CLUE_RECIPES,
        onSelectClue: (node) => {
          if (node.isSubItem) {
            this.selectCodexSubItem(node);
          } else if (node.isMidClue) {
            this.selectCodexMidClue(node);
          } else if (node.entry) {
            this.selectedCodexId = node.entry.id;
            this.selectCodexEntry(node.entry);
          } else if (node.isCategoryIndex) {
            this.selectMemoCategoryIndex(node);
          } else if (node.isHypothesis) {
            this.selectMemoHypothesis(node);
          }

          if (this.memoBoard) {
            this.memoBoard.readNewIds.add(node.id);
            if (node.entry?.id) this.memoBoard.readNewIds.add(node.entry.id);
            if (node.parentEntry?.id) this.memoBoard.readNewIds.add(node.parentEntry.id);
            if (node.isCategoryIndex && node.subItems) {
              node.subItems.forEach((si) => {
                this.memoBoard.readNewIds.add(si.id);
                if (si.entry?.id) this.memoBoard.readNewIds.add(si.entry.id);
              });
            }
          }

          if (node.entry?.id) state.markCodexRead(node.entry.id);
          if (node.id) {
            state.markCodexRead(node.id);
            state.markTileRecordRead(node.id);
            if (node.label) state.markAllTileRecordsReadForTile(node.label);
          }
          if (node.parentEntry?.id) state.markCodexRead(node.parentEntry.id);
          if (node.isCategoryIndex && node.subItems) {
            node.subItems.forEach((si) => {
              if (si.entry?.id) state.markCodexRead(si.entry.id);
            });
          }
        },
        onUnlockHypothesis: (node) => {
          this.engine.playAudio('codexUnlock');
          this.engine.showToast(`${node.label}을 세웠습니다.`, 'success', '💡');
        },
        onPuzzleSolved: (subNode, matchedClues) => {
          this.engine.playAudio('codexUnlock');
          const names = matchedClues.map(c => `[${c.label}]`).join(' + ');
          this.engine.showToast(`🎉 [추론 완성] ${names} 조건을 만족하는 '${subNode.label}'을 찾아냈습니다!`, 'success', '✨');
        }
      });
      this.hexBoards.memo = this.memoBoard;
    }

    document.querySelectorAll('.hex-board-controls button').forEach((button) => {
      button.addEventListener('click', () => {
        const board = this.hexBoards[button.dataset.hexBoard];
        if (!board) return;

        if (button.dataset.hexAction === 'zoom-in') {
          board.zoomBy(0.1);
        } else if (button.dataset.hexAction === 'zoom-out') {
          board.zoomBy(-0.1);
        } else if (button.dataset.hexAction === 'reset') {
          board.resetView();
        }
      });
    });

    document.getElementById('btn-memo-arrange')?.addEventListener('click', () => {
      this.memoBoard?.arrangeClues();
    });
  }

  openPocketModal(panelId = 'codex') {
    const modal = document.getElementById('pocket-drawer-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    setTimeout(() => {
      if (!modal.classList.contains('hidden')) {
        modal.classList.add('is-open');
      }
    }, 20);

    this.switchPocketPanel(panelId);
    this.engine.playAudio('drawerOpen');
  }

  closePocketModal() {
    const modal = document.getElementById('pocket-drawer-modal');
    if (!modal) return;

    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 280);

    this.engine.playAudio('drawerClose');
  }

  switchPocketPanel(panelId) {
    this.currentActivePanel = panelId;
    this.wheel?.setActivePanel(panelId);
    const modal = document.getElementById('pocket-drawer-modal');
    if (modal) {
      modal.classList.add('is-fullscreen');
      modal.classList.remove('is-popup');
    }

    document.querySelectorAll('.drawer-nav-tab').forEach((tab) => {
      const isActive = tab.dataset.panel === panelId;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    document.querySelectorAll('.drawer-panel-view').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== `panel-${panelId}`);
    });

    if (panelId === 'codex') {
      this.renderCodexList();
    } else if (panelId === 'map') {
      this.renderMapLocations();
    } else if (panelId === 'inventory') {
      this.renderInventory();
    } else if (panelId === 'stats') {
      this.renderStats();
    }
  }

  refreshCurrentPanel() {
    if (this.currentActivePanel) {
      this.switchPocketPanel(this.currentActivePanel);
    }
  }

  renderCodexList() {
    const emptyMessage = document.getElementById('memo-hex-empty');
    const board = this.memoBoard;
    if (!board) return;

    const memoCategories = new Set(
      CODEX_CATEGORIES
        .map((category) => category.id)
        .filter((categoryId) => categoryId !== 'item' && categoryId !== 'episode')
    );
    const filtered = CODEX_DATA.filter((entry) => {
      const matchCat = this.activeCodexCategory === 'all'
        ? memoCategories.has(entry.category)
        : entry.category === this.activeCodexCategory;
      const matchSearch =
        !this.activeCodexSearch ||
        (entry.title || '').toLowerCase().includes(this.activeCodexSearch) ||
        (entry.summary || '').toLowerCase().includes(this.activeCodexSearch) ||
        entry.keywords?.some((keyword) => keyword.toLowerCase().includes(this.activeCodexSearch));
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      board.setClues([], { includeHypotheses: false, selectedId: null });
      document.getElementById('codex-entry-detail')?.replaceChildren();
      if (emptyMessage) emptyMessage.classList.remove('hidden');
      return;
    }

    const categoryLabel = (categoryId) =>
      CODEX_CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
    const isUnlocked = (entry) =>
      state.isCodexUnlocked(entry.id) || Boolean(entry.unlockedByDefault);
    const clueEntries = filtered.filter((entry) => entry.category === 'clue');
    const clueNodes = clueEntries.map((entry) => {
      const unlocked = isUnlocked(entry);
      const codexState = state.getUnlockedCodex()[entry.id];
      const subItems = filtered
        .filter((relatedEntry) =>
          relatedEntry.id !== entry.id &&
          relatedEntry.category === 'clue' &&
          isUnlocked(relatedEntry)
        )
        .map((relatedEntry) => ({
          id: `${entry.id}_related_${relatedEntry.id}`,
          label: relatedEntry.title,
          sub: categoryLabel(relatedEntry.category),
          desc: relatedEntry.summary,
          entry: relatedEntry,
          isNew: Boolean(state.getUnlockedCodex()[relatedEntry.id]?.isNew && !board.readNewIds.has(relatedEntry.id))
        }));
      const unlockedSubClues = (entry.subClues || []).filter((sc) => {
        return sc.unlockedByDefault !== false || state.isClueConditionUnlocked(sc.id);
      }).map((sc) => ({
        ...sc,
        isNew: Boolean(state.getUnlockedCodex()[sc.id]?.isNew && !board.readNewIds.has(sc.id))
      }));

      return {
        ...entry,
        entry,
        role: entry.role || 'keyword',
        label: unlocked ? (entry.keywords?.[0] || entry.title) : '미발견',
        sub: categoryLabel('clue'),
        subClues: unlockedSubClues,
        subItems: entry.subItems?.length ? entry.subItems : subItems,
        locked: !unlocked,
        isNew: Boolean(codexState && codexState.isNew && !board.readNewIds.has(entry.id)),
        accessibleLabel: unlocked ? entry.title : '미발견 기록'
      };
    });
    const indexCategories = [...new Set(
      filtered.map((entry) => entry.category).filter((categoryId) => categoryId !== 'clue')
    )];
    const categoryIndexes = indexCategories.map((categoryId) => {
      const label = categoryLabel(categoryId);
      const entries = filtered.filter((entry) => entry.category === categoryId && isUnlocked(entry));
      const categoryIdLabel = categoryId.replace(/[^a-z0-9_-]/gi, '_');
      const hasAnyNew = entries.some((entry) => Boolean(state.getUnlockedCodex()[entry.id]?.isNew && !board.readNewIds.has(entry.id)));
      return {
        id: `memo_index_${categoryIdLabel}`,
        category: categoryId,
        label,
        sub: '',
        desc: `발견한 ${label} 기록 ${entries.length}개`,
        isCategoryIndex: true,
        locked: false,
        isNew: Boolean(hasAnyNew && !board.readNewIds.has(`memo_index_${categoryIdLabel}`)),
        accessibleLabel: `${label} 기록 목록`,
        subItems: entries.map((entry) => ({
          id: `${categoryIdLabel}_entry_${entry.id}`,
          label: entry.title,
          sub: label,
          desc: entry.summary,
          entry,
          isNew: Boolean(state.getUnlockedCodex()[entry.id]?.isNew && !board.readNewIds.has(entry.id))
        }))
      };
    });
    const boardNodes = [...clueNodes, ...categoryIndexes];
    const visibleBoardNodes = boardNodes.filter((node) => !node.locked);
    if (visibleBoardNodes.length === 0) {
      board.setClues([], { includeHypotheses: false, selectedId: null });
      document.getElementById('codex-entry-detail')?.replaceChildren();
      if (emptyMessage) emptyMessage.classList.remove('hidden');
      return;
    }

    if (emptyMessage) emptyMessage.classList.add('hidden');
    const selectedEntry = filtered.find((entry) => entry.id === this.selectedCodexId && isUnlocked(entry));
    const selectedIndex = visibleBoardNodes.find((node) =>
      node.isCategoryIndex && node.category === this.selectedMemoIndexCategory
    );
    let selectedBoardId = selectedIndex?.id;
    if (!selectedBoardId && selectedEntry) {
      selectedBoardId = selectedEntry.category === 'clue'
        ? selectedEntry.id
        : visibleBoardNodes.find((node) => node.category === selectedEntry.category)?.id;
    }
    selectedBoardId ||= visibleBoardNodes[0]?.id;
    const selectedBoardNode = visibleBoardNodes.find((node) => node.id === selectedBoardId) || visibleBoardNodes[0];

    board.setClues(visibleBoardNodes, {
      includeHypotheses:
        (this.activeCodexCategory === 'all' || this.activeCodexCategory === 'clue') &&
        !this.activeCodexSearch,
      selectedId: selectedBoardNode.id
    });
    const selectedDetail = filtered.find((entry) =>
      entry.id === this.selectedMemoDetailId && isUnlocked(entry)
    );
    if (selectedDetail) {
      this.selectCodexEntry(selectedDetail);
    } else if (selectedBoardNode.isCategoryIndex) {
      this.selectMemoCategoryIndex(selectedBoardNode);
    } else {
      this.selectedCodexId = selectedBoardNode.id;
      this.selectCodexEntry(selectedBoardNode.entry);
    }
  }

  selectMemoCategoryIndex(node) {
    this.selectedCodexId = null;
    this.selectedMemoIndexCategory = node.category;
    this.selectedMemoDetailId = null;
    if (this.memoBoard) {
      this.memoBoard.readNewIds.add(node.id);
      if (node.subItems) {
        node.subItems.forEach((si) => {
          this.memoBoard.readNewIds.add(si.id);
          if (si.entry?.id) this.memoBoard.readNewIds.add(si.entry.id);
        });
      }
      this.memoBoard.render();
    }
    if (node.subItems) {
      node.subItems.forEach((si) => {
        if (si.entry?.id) state.markCodexRead(si.entry.id);
      });
    }
    const detailContainer = document.getElementById('codex-entry-detail');
    if (!detailContainer) return;

    const content = document.createElement('div');
    content.className = 'codex-detail-content';
    const header = document.createElement('header');
    header.className = 'detail-header';

    const badge = document.createElement('span');
    badge.className = 'detail-category-badge';
    badge.textContent = node.label;

    const titleRow = document.createElement('div');
    titleRow.className = 'detail-title-row';
    const icon = document.createElement('span');
    icon.className = 'detail-icon';
    icon.textContent = CODEX_CATEGORIES.find((category) => category.id === node.category)?.icon || '📖';
    const title = document.createElement('h3');
    title.className = 'detail-title';
    title.textContent = `${node.label} 기록`;
    titleRow.append(icon, title);
    header.append(badge, titleRow);

    const description = document.createElement('div');
    description.className = 'detail-description';
    const paragraph = document.createElement('p');
    const count = node.subItems.length;
    paragraph.textContent = count
      ? `발견한 ${node.label} 기록 ${count}개가 하위 타일에 정리되어 있습니다. 타일을 선택해 내용을 확인하세요.`
      : `아직 발견한 ${node.label} 기록이 없습니다. 인물과 현장을 조사하면 이곳에 기록이 추가됩니다.`;
    description.appendChild(paragraph);
    content.append(header, description);
    detailContainer.replaceChildren(content);
  }

  selectMemoHypothesis(node) {
    const detailContainer = document.getElementById('codex-entry-detail');
    if (!detailContainer) return;

    const content = document.createElement('div');
    content.className = 'codex-detail-content';

    const header = document.createElement('header');
    header.className = 'detail-header';

    const badge = document.createElement('span');
    badge.className = 'detail-category-badge';
    badge.textContent = '가설';

    const titleRow = document.createElement('div');
    titleRow.className = 'detail-title-row';

    const icon = document.createElement('span');
    icon.className = 'detail-icon';
    icon.textContent = '💡';

    const title = document.createElement('h3');
    title.className = 'detail-title';
    title.textContent = node.label;

    titleRow.append(icon, title);
    header.append(badge, titleRow);

    const description = document.createElement('div');
    description.className = 'detail-description';
    const paragraph = document.createElement('p');
    paragraph.textContent = node.desc;
    description.appendChild(paragraph);

    content.append(header, description);
    detailContainer.replaceChildren(content);
  }

  selectCodexSubItem(node) {
    this.selectedCodexId = node.id;
    if (node.id) {
      state.markCodexRead(node.id);
      state.markTileRecordRead(node.id);
      if (node.label) state.markAllTileRecordsReadForTile(node.label);
    }
    if (node.entry?.id) state.markCodexRead(node.entry.id);
    if (node.parentEntry?.id) state.markCodexRead(node.parentEntry.id);
    if (this.memoBoard) {
      this.memoBoard.readNewIds.add(node.id);
      if (node.entry?.id) this.memoBoard.readNewIds.add(node.entry.id);
      if (node.parentEntry?.id) this.memoBoard.readNewIds.add(node.parentEntry.id);
      this.memoBoard.render();
    }
    const detailContainer = document.getElementById('codex-entry-detail');
    if (!detailContainer) return;

    const parent = node.parentEntry;
    const parentTitle = parent?.title || parent?.name || '상위 단서';
    const subTitle = node.label || '세부 단서';
    const subDesc = node.desc || node.description || `${parentTitle}에 연결된 세부 단서입니다.`;

    // 정의된 추가 기록 및 상태에서 해금된 추가 기록 수집
    let definedRecords = Array.isArray(node.records) ? [...node.records] : [];
    if (!definedRecords.length) {
      for (const entry of CODEX_DATA) {
        const foundSub = (entry.subItems || []).find((si) => si.id === node.id || si.label === node.label);
        if (foundSub?.records?.length) {
          definedRecords = [...foundSub.records];
          break;
        }
      }
    }

    const unlockedRecords = [];
    definedRecords.forEach((rec) => {
      if (state.isTileRecordUnlocked(rec.id) && rec.text) {
        unlockedRecords.push(rec.text);
      }
    });

    const allStateRecords = state.getUnlockedTileRecords();
    Object.values(allStateRecords).forEach((rec) => {
      if (!rec || !rec.text) return;
      if (rec.tileId === node.id || rec.tileId === node.label || rec.tileId === subTitle) {
        if (!unlockedRecords.includes(rec.text)) {
          unlockedRecords.push(rec.text);
        }
      }
    });

    const recordsHtml = unlockedRecords.length > 0 ? `
      <div class="tile-records-box" style="margin-top:16px; padding:12px 14px; background:rgba(30, 41, 59, 0.75); border:1px solid rgba(96, 165, 250, 0.4); border-radius:8px;">
        <div style="font-size:12.5px; font-weight:700; color:#60A5FA; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>📝</span> 추가 조사 기록 (${unlockedRecords.length})
        </div>
        <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.75; color:var(--text-normal, #e2e8f0);">
          ${unlockedRecords.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    detailContainer.innerHTML = `
      <div class="codex-detail-content">
        <header class="detail-header">
          <span class="detail-category-badge">세부 키워드 · ${escapeHtml(parentTitle)}</span>
          <div class="detail-title-row">
            <span class="detail-icon">🔍</span>
            <h3 class="detail-title">${escapeHtml(subTitle)}</h3>
          </div>
        </header>
        <div class="detail-body">
          <blockquote class="detail-summary">"${escapeHtml(subTitle)}" (상위 항목: ${escapeHtml(parentTitle)})</blockquote>
          <div class="detail-description">
            <p>${escapeHtml(subDesc)}</p>
            ${recordsHtml}
          </div>
        </div>
        <footer class="detail-footer">
          <span class="detail-status-pill">✓ 세부 단서 확인 완료</span>
        </footer>
      </div>
    `;
  }

  selectCodexMidClue(node) {
    this.selectedCodexId = node.id;
    if (node.id) state.markCodexRead(node.id);
    if (node.entry?.id) state.markCodexRead(node.entry.id);
    if (node.parentEntry?.id) state.markCodexRead(node.parentEntry.id);
    if (this.memoBoard) {
      this.memoBoard.readNewIds.add(node.id);
      if (node.entry?.id) this.memoBoard.readNewIds.add(node.entry.id);
      if (node.parentEntry?.id) this.memoBoard.readNewIds.add(node.parentEntry.id);
      this.memoBoard.render();
    }
    const detailContainer = document.getElementById('codex-entry-detail');
    if (!detailContainer) return;

    const parent = node.parentEntry;
    const parentTitle = parent?.title || parent?.name || '상위 주제';
    const clueTitle = node.label || '단서';
    const clueDesc = node.desc || node.conditionDesc || '조건에 맞는 세부 타일을 드래그하여 인접하게 배치해보세요.';
    const validTargets = Array.isArray(node.validTargets) && node.validTargets.length
      ? node.validTargets.join(', ')
      : '모든 타일';
    const invalidTargets = Array.isArray(node.invalidTargets) && node.invalidTargets.length
      ? node.invalidTargets.join(', ')
      : '없음';

    detailContainer.innerHTML = `
      <div class="codex-detail-content">
        <header class="detail-header">
          <span class="detail-category-badge">단서 · ${escapeHtml(parentTitle)}</span>
          <div class="detail-title-row">
            <span class="detail-icon">🔘</span>
            <h3 class="detail-title">${escapeHtml(clueTitle)}</h3>
          </div>
        </header>
        <div class="detail-body">
          <blockquote class="detail-summary">"${escapeHtml(clueTitle)}" (상위 주제: ${escapeHtml(parentTitle)})</blockquote>
          <div class="detail-description">
            <p>${escapeHtml(clueDesc)}</p>
            <div style="margin-top:14px; padding:12px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.08); border-radius:8px; font-size:12.5px; line-height:1.6;">
              <div style="margin-bottom:6px;"><strong style="color:#5dade2;">✔️ 부합 세부 타일 (파랑):</strong> ${escapeHtml(validTargets)}</div>
              <div><strong style="color:#e74c3c;">❌ 모순 세부 타일 (빨강):</strong> ${escapeHtml(invalidTargets)}</div>
            </div>
            <p style="margin-top:12px; font-size:12px; color:var(--text-muted, #aaa);">
              💡 <strong>조합 힌트:</strong> 보드 위에서 세부 타일을 드래그해 이 단서 옆에 붙이면 조건 부합 여부가 색상(파랑/빨강)으로 판정됩니다.
            </p>
          </div>
        </div>
        <footer class="detail-footer">
          <span class="detail-status-pill">🔘 단서 확인 완료</span>
        </footer>
      </div>
    `;
  }

  selectCodexEntry(entry) {
    this.selectedCodexId = entry.id;
    this.selectedMemoDetailId = entry.id;
    this.selectedMemoIndexCategory = entry.category === 'clue' ? null : entry.category;
    const isUnlocked = state.isCodexUnlocked(entry.id) || Boolean(entry.unlockedByDefault);

    if (state.isCodexUnlocked(entry.id)) {
      state.markCodexRead(entry.id);
    }
    if (this.memoBoard) {
      this.memoBoard.readNewIds.add(entry.id);
      this.memoBoard.render();
    }

    const detailContainer = document.getElementById('codex-entry-detail');
    if (!detailContainer) return;

    if (!isUnlocked) {
      detailContainer.innerHTML = `
        <div class="codex-detail-locked">
          <div class="locked-icon">🔒</div>
          <h3>비공개된 기록</h3>
          <p>아카데미를 탐색하고 사건을 조사하여 이 항목의 실마리를 획득하세요.</p>
        </div>
      `;
      return;
    }

    const categoryLabel = CODEX_CATEGORIES.find((category) => category.id === entry.category)?.label || entry.category;

    const iconHtml = (entry.icon && entry.icon.includes('/'))
      ? `<img src="${escapeHtml(entry.icon)}" class="detail-icon-img" alt="">`
      : escapeHtml(entry.icon || '📖');

    const portraitHtml = (entry.image && entry.image.includes('/'))
      ? `<div class="detail-portrait-box"><img src="${escapeHtml(entry.image)}" class="detail-portrait-img" alt="${escapeHtml(entry.title)}"></div>`
      : '';

    detailContainer.innerHTML = `
      <div class="codex-detail-content">
        <header class="detail-header">
          <span class="detail-category-badge">${categoryLabel}</span>
          <div class="detail-title-row">
            <span class="detail-icon">${iconHtml}</span>
            <h3 class="detail-title">${escapeHtml(entry.title)}</h3>
          </div>
        </header>
        ${portraitHtml}
        <div class="detail-body">
          <blockquote class="detail-summary">"${escapeHtml(entry.summary)}"</blockquote>
          <div class="detail-description">
            <p>${escapeHtml(entry.description)}</p>
          </div>
        </div>
        <footer class="detail-footer">
          <span class="detail-status-pill">✓ 수사 수첩 기록 완료</span>
        </footer>
      </div>
    `;
  }

  renderMapLocations() {
    if (!this.isometricMap) return;
    this.isometricMap.render(
      MAP_LOCATIONS,
      state.getCurrentLocationId(),
      state.getCurrentMapTileKey()
    );
  }

  isLocationUnlocked(loc) {
    return Boolean(loc.unlocked || (loc.requiredFlag && state.getFlag(loc.requiredFlag)));
  }

  travelToLocation(loc) {
    this.closePocketModal();
    state.setCurrentLocationId(loc.id);

    if (loc.hasInvestigation) {
      state.setMode('investigation', loc.id);
      this.engine.startInvestigation(loc.id);
      this.engine.showToast(`[${loc.name}] 현장 조사 모드로 진입했습니다.`, 'info', loc.icon);
    } else if (loc.targetStoryNode) {
      state.setMode('story');
      state.setCurrentNode(loc.targetStoryNode);
      this.engine.renderStoryNode(loc.targetStoryNode);
      this.engine.showToast(`[${loc.name}]으로 이동했습니다.`, 'info', loc.icon);
    } else {
      this.engine.showToast(`[${loc.name}]으로 이동했습니다.`, 'info', loc.icon);
    }
  }

  renderInventory() {
    const layer = document.getElementById('honeycomb-slots-layer');
    const capLabel = document.getElementById('inventory-capacity-label');
    const detailBox = document.getElementById('inventory-detail-box');
    if (!layer) return;

    const items = state.getInventory();
    const totalSlots = 7; // 중앙 1 + 주변 6

    if (capLabel) {
      capLabel.textContent = `${items.length} / ${totalSlots}`;
    }

    layer.innerHTML = '';

    // Center (0,0) + 6 interlocking neighbors
    const HONEYCOMB_LAYOUT = [
      { id: 0, x: 0, y: 0, isCenter: true },
      { id: 1, x: -35.5, y: -61.5 },
      { id: 2, x: 35.5, y: -61.5 },
      { id: 3, x: 71, y: 0 },
      { id: 4, x: 35.5, y: 61.5 },
      { id: 5, x: -35.5, y: 61.5 },
      { id: 6, x: -71, y: 0 }
    ];

    const SVG_NS = 'http://www.w3.org/2000/svg';

    HONEYCOMB_LAYOUT.forEach((pos, index) => {
      const item = items[index];
      const g = document.createElementNS(SVG_NS, 'g');
      const classes = ['honeycomb-slot'];
      if (pos.isCenter) classes.push('is-center');

      const points = `${pos.x},${pos.y - 41} ${pos.x + 35.5},${pos.y - 20.5} ${pos.x + 35.5},${pos.y + 20.5} ${pos.x},${pos.y + 41} ${pos.x - 35.5},${pos.y + 20.5} ${pos.x - 35.5},${pos.y - 20.5}`;

      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', points);
      poly.setAttribute('class', 'honeycomb-poly');
      g.appendChild(poly);

      if (item) {
        classes.push('is-filled');
        const isSelected = item.id === this.selectedInventoryItemId || (!this.selectedInventoryItemId && index === 0);
        if (isSelected) {
          classes.push('is-selected');
          this.selectedInventoryItemId = item.id;
        }

        const iconText = document.createElementNS(SVG_NS, 'text');
        iconText.setAttribute('x', pos.x);
        iconText.setAttribute('y', pos.y - 4);
        iconText.setAttribute('class', 'honeycomb-icon');
        iconText.textContent = item.icon || '📦';
        g.appendChild(iconText);

        const nameText = document.createElementNS(SVG_NS, 'text');
        nameText.setAttribute('x', pos.x);
        nameText.setAttribute('y', pos.y + 16);
        nameText.setAttribute('class', 'honeycomb-name');
        nameText.textContent = item.name.length > 5 ? `${item.name.slice(0, 4)}…` : item.name;
        g.appendChild(nameText);

        if (item.quantity && item.quantity > 1) {
          const qtyCircle = document.createElementNS(SVG_NS, 'circle');
          qtyCircle.setAttribute('cx', pos.x + 18);
          qtyCircle.setAttribute('cy', pos.y - 18);
          qtyCircle.setAttribute('r', 7.5);
          qtyCircle.setAttribute('class', 'honeycomb-qty-bg');
          g.appendChild(qtyCircle);

          const qtyText = document.createElementNS(SVG_NS, 'text');
          qtyText.setAttribute('x', pos.x + 18);
          qtyText.setAttribute('y', pos.y - 17.5);
          qtyText.setAttribute('class', 'honeycomb-qty-text');
          qtyText.textContent = String(item.quantity);
          g.appendChild(qtyText);
        }

        g.setAttribute('aria-label', item.name);
        g.addEventListener('click', () => {
          this.selectInventoryItem(item);
          layer.querySelectorAll('.honeycomb-slot').forEach(s => s.classList.remove('is-selected'));
          g.classList.add('is-selected');
        });
      } else {
        classes.push('is-empty');

        const plus = document.createElementNS(SVG_NS, 'text');
        plus.setAttribute('x', pos.x);
        plus.setAttribute('y', pos.y + 1);
        plus.setAttribute('class', 'honeycomb-empty-icon');
        plus.textContent = '+';
        g.appendChild(plus);

        g.setAttribute('aria-label', `빈 슬롯 ${index + 1}`);
        g.addEventListener('click', () => {
          layer.querySelectorAll('.honeycomb-slot').forEach(s => s.classList.remove('is-selected'));
          g.classList.add('is-selected');
          if (detailBox) {
            detailBox.innerHTML = `
              <div class="inv-inspect-card">
                <div class="inspect-icon-large" style="opacity: 0.35;">⬡</div>
                <div class="inspect-text-group">
                  <h4 class="inspect-name" style="color: var(--text-muted); font-size: 15px;">빈 슬롯</h4>
                  <p class="inspect-desc">아이템이 없습니다.</p>
                </div>
              </div>
            `;
          }
        });
      }

      g.setAttribute('class', classes.join(' '));
      layer.appendChild(g);
    });

    const selectedItem = items.find(item => item.id === this.selectedInventoryItemId) || items[0];
    if (selectedItem) {
      this.selectInventoryItem(selectedItem);
    } else if (detailBox && items.length === 0) {
      detailBox.innerHTML = `
        <div class="inv-inspect-card">
          <div class="inspect-icon-large" style="opacity: 0.35;">🎒</div>
          <div class="inspect-text-group">
            <h4 class="inspect-name" style="color: var(--text-muted); font-size: 15px;">소지품 없음</h4>
            <p class="inspect-desc">아이템을 획득하면 보관함에 채워집니다.</p>
          </div>
        </div>
      `;
    }
  }

  selectInventoryItem(item) {
    this.selectedInventoryItemId = item.id;
    document.querySelectorAll('.honeycomb-slot').forEach((slot) => {
      const name = slot.querySelector('.honeycomb-name')?.textContent;
      slot.classList.toggle('is-selected', name === item.name);
    });
    const detailBox = document.getElementById('inventory-detail-box');
    if (!detailBox) return;

    detailBox.innerHTML = `
      <div class="inv-inspect-card">
        <div class="inspect-icon-large">${escapeHtml(item.icon || '📦')}</div>
        <div class="inspect-text-group">
          <div class="inspect-header-line">
            <h4 class="inspect-name">${escapeHtml(item.name)}</h4>
            <span class="inspect-type-tag">수량: ${escapeHtml(item.quantity ?? 1)}개</span>
          </div>
          <p class="inspect-desc">${escapeHtml(item.desc || '설명이 없습니다.')}</p>
        </div>
      </div>
    `;
  }

  renderStats() {
    const player = state.getPlayer();
    const statsContainer = document.getElementById('player-stats-content');
    if (!statsContainer) return;

    const statLabels = [
      { key: 'perception', label: '관찰력', icon: '👁️', max: 10, desc: '사소한 불일치, 비밀 틈새 및 숨은 물건을 발견하는 감각.' },
      { key: 'magic', label: '마력', icon: '✨', max: 10, desc: '고대 룬 문자 해독 및 결계 공명 주문을 다루는 능력.' },
      { key: 'persuasion', label: '화술', icon: '🗣️', max: 10, desc: '상대방의 심리를 꿰뚫고 자백을 유도하는 심문 기술.' },
      { key: 'stamina', label: '체력', icon: '❤️', max: 100, desc: '밤샘 수사와 긴박한 추격전을 버텨내는 기력.' }
    ];

    let html = `
      <div class="profile-card">
        <div class="profile-avatar">🕵️</div>
        <div class="profile-meta">
          <div class="profile-title-badge">${player.title}</div>
          <h3 class="profile-name">${player.name}</h3>
          <p class="profile-org">아르카디아 아카데미 규율단 소속</p>
        </div>
      </div>

      <div class="stats-bars-section">
        <h4 class="section-heading">핵심 수사 능력치</h4>
    `;

    statLabels.forEach((st) => {
      const val = player.stats[st.key] || 0;
      const pct = Math.min(100, Math.round((val / st.max) * 100));

      html += `
        <div class="stat-bar-group">
          <div class="stat-bar-label-row">
            <span class="stat-bar-name">${st.icon} ${st.label}</span>
            <span class="stat-bar-val"><strong>${val}</strong> / ${st.max}</span>
          </div>
          <div class="stat-progress-track">
            <div class="stat-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="stat-bar-desc">${st.desc}</span>
        </div>
      `;
    });

    html += `</div><div class="traits-section"><h4 class="section-heading">보유 특성 & 직함</h4><div class="traits-list">`;

    player.traits.forEach((tr) => {
      html += `
        <div class="trait-pill">
          <strong>${tr.name}</strong>
          <span>${tr.desc}</span>
        </div>
      `;
    });

    html += `</div></div>`;
    statsContainer.innerHTML = html;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new App();
});