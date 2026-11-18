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
import { AuthorEditor, applySavedAuthorData } from './authorEditor.js';

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
        muteBtn.textContent = this.engine.soundEnabled ? '🔊 효과음' : '🔇 음소거';
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
          if (node.entry) {
            this.selectedCodexId = node.entry.id;
            this.selectCodexEntry(node.entry);
          } else if (node.isCategoryIndex) {
            this.selectMemoCategoryIndex(node);
          } else if (node.isHypothesis) {
            this.selectMemoHypothesis(node);
          }
        },
        onUnlockHypothesis: (node) => {
          this.engine.showToast(`${node.label}을 세웠습니다.`, 'success', '💡');
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
          isNew: Boolean(state.getUnlockedCodex()[relatedEntry.id]?.isNew)
        }));
      return {
        ...entry,
        entry,
        label: unlocked ? (entry.keywords?.[0] || entry.title) : '미발견',
        sub: categoryLabel('clue'),
        subItems: [...(entry.subItems || []), ...subItems],
        locked: !unlocked,
        isNew: Boolean(codexState && codexState.isNew),
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
      return {
        id: `memo_index_${categoryIdLabel}`,
        category: categoryId,
        label,
        sub: '',
        desc: `발견한 ${label} 기록 ${entries.length}개`,
        isCategoryIndex: true,
        locked: false,
        isNew: entries.some((entry) => Boolean(state.getUnlockedCodex()[entry.id]?.isNew)),
        accessibleLabel: `${label} 기록 목록`,
        subItems: entries.map((entry) => ({
          id: `${categoryIdLabel}_entry_${entry.id}`,
          label: entry.title,
          sub: label,
          desc: entry.summary,
          entry,
          isNew: Boolean(state.getUnlockedCodex()[entry.id]?.isNew)
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

  selectCodexEntry(entry) {
    this.selectedCodexId = entry.id;
    this.selectedMemoDetailId = entry.id;
    this.selectedMemoIndexCategory = entry.category === 'clue' ? null : entry.category;
    const isUnlocked = state.isCodexUnlocked(entry.id) || Boolean(entry.unlockedByDefault);

    if (state.isCodexUnlocked(entry.id)) {
      state.markCodexRead(entry.id);
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

    detailContainer.innerHTML = `
      <div class="codex-detail-content">
        <header class="detail-header">
          <span class="detail-category-badge">${categoryLabel}</span>
          <div class="detail-title-row">
            <span class="detail-icon">${escapeHtml(entry.icon)}</span>
            <h3 class="detail-title">${escapeHtml(entry.title)}</h3>
          </div>
        </header>
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
    const board = this.hexBoards.inventory;
    const emptyMessage = document.getElementById('inventory-hex-empty');
    const detailBox = document.getElementById('inventory-detail-box');
    if (!board) return;

    const items = state.getInventory();
    const categoryLabels = {
      key: '장비',
      artifact: '유물',
      clue: '단서',
      clue_item: '단서',
      tool: '도구',
      material: '재료',
      item: '기타'
    };
    const categorizedItems = items.map((item) => {
      const category = item.category || item.type || 'item';
      const filterCategory = category === 'artifact' ? 'key'
        : category === 'clue' ? 'clue_item'
          : ['tool', 'material'].includes(category) ? 'item'
            : category;
      const typeLabel = categoryLabels[category] || '기타';
      const quantity = item.quantity ?? 1;
      return {
        ...item,
        category: filterCategory,
        label: item.name,
        typeLabel,
        quantityLabel: `${quantity}개`,
        accessibleLabel: `${item.name}, 종류 ${typeLabel}, 보관 수량 ${quantity}개`
      };
    });
    const nodes = board.prepareInventoryNodes(categorizedItems, this.activeInventoryCategory);
    if (emptyMessage) emptyMessage.classList.toggle('hidden', nodes.length > 0);
    board.render(nodes, this.selectedInventoryItemId);

    const selectedItem = nodes.find(item => item.id === this.selectedInventoryItemId) || nodes[0];
    if (selectedItem) {
      this.selectInventoryItem(selectedItem);
    } else if (detailBox) {
      this.selectedInventoryItemId = null;
      detailBox.innerHTML = `<div class="inv-empty-msg">이 분류에 보관 중인 소지품이 없습니다.</div>`;
    }
  }

  selectInventoryItem(item) {
    this.selectedInventoryItemId = item.id;
    document.querySelectorAll('#inventory-hex-layer .hex-node').forEach((node) => {
      node.classList.toggle('is-selected', node.dataset.id === item.id);
    });
    const detailBox = document.getElementById('inventory-detail-box');
    if (!detailBox) return;

    detailBox.innerHTML = `
      <div class="inv-inspect-card">
      <div class="inspect-icon-large">${escapeHtml(item.icon)}</div>
        <div class="inspect-text-group">
          <div class="inspect-header-line">
          <h4 class="inspect-name">${escapeHtml(item.name)}</h4>
          <span class="inspect-type-tag">보관 수량: ${escapeHtml(item.quantity)}개</span>
          </div>
        <p class="inspect-desc">${escapeHtml(item.desc)}</p>
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