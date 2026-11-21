/**
 * Main Application Controller
 */

import { state } from './state.js?v=20261121_1900';
import { GameEngine } from './engine.js?v=20261121_1900';
import { RotaryWheel } from './wheel.js?v=20261121_1900';
import { HexBoard } from './hexBoard.js?v=20261121_1900';
import { MemoBoard } from './memoBoard.js?v=20261121_1900';
import { IsometricMap } from './isometricMap.js?v=20261121_1900';
import { CODEX_CATEGORIES, CODEX_DATA, CLUE_RECIPES } from './data/codexData.js?v=20261121_1900';
import { MAP_LOCATIONS, INVESTIGATION_SCENES } from './data/mapData.js?v=20261121_1900';
import { STORY_EPISODES, STORY_NODES } from './data/storyData.js?v=20261121_1900';
import { AuthorEditor, applySavedAuthorData } from './authorEditor.js?v=20261121_1900';
import { initEpisodeStore, loadEpisodeToLive } from './data/episodeStore.js?v=20261121_1900';

const AUTHOR_DATA_LOAD_RESULT = applySavedAuthorData();
// 저장된 진행 회차에 맞는 지도 / 조사 / 인물 데이터를 불러옵니다.
initEpisodeStore(state.getCurrentEpisodeId());
window.state = state;
window.CODEX_DATA = CODEX_DATA;
window.INVESTIGATION_SCENES = INVESTIGATION_SCENES;
window.MAP_LOCATIONS = MAP_LOCATIONS;
window.STORY_NODES = STORY_NODES;
window.STORY_EPISODES = STORY_EPISODES;
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
    this.tocTab = 'active'; // 'active' (진행 중) | 'completed' (완료됨)

    this.init();
  }

  safeInit(fn, name) {
    try {
      fn();
    } catch (err) {
      console.warn(`[App] ${name} 초기화 중 오류:`, err);
    }
  }

  init() {
    this.safeInit(() => {
      this.wheel = new RotaryWheel({
        onSelectPanel: (panelId) => this.openPocketModal(panelId),
        playAudio: (type) => this.engine.playAudio(type)
      });
    }, 'wheel');

    this.engine.onOpenMap = (targetLocationId = null) => {
      this.openPocketModal('map');
      if (targetLocationId && this.isometricMap) {
        const tile = this.isometricMap.tilesByKey
          ? Array.from(this.isometricMap.tilesByKey.values()).find((t) => t.location?.id === targetLocationId || t.locationId === targetLocationId)
          : null;
        if (tile) {
          this.isometricMap.selectedKey = tile.key;
          this.isometricMap.setActiveTile(tile);
          state.setCurrentMapTileKey(tile.key);
        }
      }
    };

    this.engine.onOpenDeduction = (topicId = null) => {
      this.openDeductionMode(topicId);
    };

    this.safeInit(() => this.applyReaderSettings(state.getReaderSettings()), 'readerSettings');
    this.safeInit(() => this.initTopViewerBar(), 'topViewerBar');
    this.safeInit(() => this.initHomeView(), 'homeView');
    this.safeInit(() => this.initStoryToc(), 'storyToc');
    this.safeInit(() => this.initAuthorEditor(), 'authorEditor');
    this.safeInit(() => this.initPocketModals(), 'pocketModals');
    this.safeInit(() => this.initHexBoards(), 'hexBoards');
    this.safeInit(() => this.initDistractionFreeToggle(), 'distractionFreeToggle');

    state.on('reset', () => {
      this.memoBoard?.resetBoardState?.();
      this.renderCodexList();
      this.updateCategoryUnreadBadges();
      this.wheel?.updateNotificationBadge();
    });

    state.on('change', () => {
      this.refreshCurrentPanel();
      this.syncPocketAvailability();
      this.wheel?.updateNotificationBadge();
      this.updateCategoryUnreadBadges();
    });

    this.syncPocketAvailability();
    this.updateCategoryUnreadBadges();

    try {
      if (state.getMode() === 'home') {
        this.showHomeView();
      } else if (state.getMode() === 'investigation') {
        this.engine.startInvestigation(state.getCurrentLocationId());
      } else {
        this.engine.renderStoryNode(state.getCurrentNodeId());
      }
    } catch (modeErr) {
      console.warn('[App] 초기 화면 렌더링 오류, 홈 화면으로 안전 복구:', modeErr);
      this.showHomeView();
    }
  }

  initAuthorEditor() {
    this.authorEditor = new AuthorEditor({
      loadError: AUTHOR_DATA_LOAD_RESULT.error,
      onDataChanged: () => {
        this.refreshCurrentPanel();
        const isEditorOpen = this.authorEditor && !this.authorEditor.panel?.classList.contains('hidden');
        if (!isEditorOpen) {
          if (state.getMode() === 'investigation') {
            this.engine.startInvestigation(state.getCurrentLocationId());
          } else {
            this.engine.renderStoryNode(state.getCurrentNodeId());
          }
        }
      },
      onClose: () => {
        // 편집기에서 다른 회차를 보고 있었더라도 게임은 진행 중인 회차 데이터로 복원
        loadEpisodeToLive(state.getCurrentEpisodeId());
        this.refreshCurrentPanel();
        if (state.getMode() === 'investigation') {
          this.engine.startInvestigation(state.getCurrentLocationId());
        } else if (state.getMode() === 'story') {
          this.engine.renderStoryNode(state.getCurrentNodeId());
        }
      },
      onTestStory: (nodeId) => {
        this.closePocketModal();
        const homeView = document.getElementById('home-view');
        if (homeView) homeView.classList.add('hidden');
        const storyView = document.getElementById('story-view');
        if (storyView) storyView.classList.remove('hidden');
        const invView = document.getElementById('investigation-view');
        if (invView) invView.classList.add('hidden');
        state.setMode('story');
        state.setCurrentNode(nodeId);
        this.engine.renderStoryNode(nodeId);
        this.syncPocketAvailability();
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
    const isHome = state.getMode() === 'home';
    const showTutorial = hasPocket && !state.hasOpenedPocket() && !isHome;
    const hideHandle = !hasPocket || isHome || (this.isControlsHidden && state.getMode() === 'story');
    const handle = document.getElementById('pocket-handle');
    const quickPocketButton = document.getElementById('btn-quick-pocket');

    if (handle) {
      handle.classList.toggle('is-hidden', hideHandle);
      handle.classList.toggle('is-tutorial', showTutorial);
      handle.disabled = !hasPocket || isHome;
      handle.tabIndex = (hasPocket && !isHome) ? 0 : -1;
      handle.setAttribute('aria-hidden', String(!hasPocket || isHome));
    }

    if (quickPocketButton) {
      quickPocketButton.classList.toggle('is-hidden', !hasPocket || isHome);
      quickPocketButton.disabled = !hasPocket || isHome;
      quickPocketButton.setAttribute('aria-hidden', String(!hasPocket || isHome));
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

    const homeBtn = document.getElementById('btn-home-screen');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        this.showHomeView();
        this.engine.playAudio('click');
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

  // --- Home Screen View & Navigation ---

  initHomeView() {
    const continueBtn = document.getElementById('btn-home-continue');
    const newGameBtn = document.getElementById('btn-home-new-game');
    const settingsBtn = document.getElementById('btn-home-settings');
    const authorBtn = document.getElementById('btn-home-author');

    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.resumeGame();
      });
    }

    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        this.startNewGame();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        const toggle = document.getElementById('btn-reader-settings-toggle');
        if (toggle) toggle.click();
      });
    }

    if (authorBtn) {
      authorBtn.addEventListener('click', () => {
        if (this.authorEditor) {
          this.authorEditor.openPortalPasswordModal();
        } else {
          const portal = document.getElementById('btn-author-mode');
          if (portal) portal.click();
        }
      });
    }
  }

  showHomeView() {
    const homeView = document.getElementById('home-view');
    const storyView = document.getElementById('story-view');
    const investigationView = document.getElementById('investigation-view');
    const epIndicator = document.getElementById('viewer-episode-title');
    const chIndicator = document.getElementById('viewer-chapter-title');

    if (homeView) homeView.classList.remove('hidden');
    if (storyView) storyView.classList.add('hidden');
    if (investigationView) investigationView.classList.add('hidden');

    if (epIndicator) epIndicator.textContent = '아카데미생의 주머니는 이세계 오파츠 상점';
    if (chIndicator) chIndicator.textContent = '홈 메뉴';

    state.setMode('home');
    this.renderHomeProgress();
    this.syncPocketAvailability();
  }

  renderHomeProgress() {
    const history = state.getHistory ? state.getHistory() : (state.data?.history || []);
    const isBeginning = (history.length <= 1) &&
      !state.hasPocket() &&
      Object.keys(state.data?.flags || {}).length === 0 &&
      (state.data?.collectedHotspots || []).length === 0;

    const locEl = document.getElementById('home-progress-location');
    const sumEl = document.getElementById('home-progress-summary');
    const contTitleEl = document.getElementById('home-continue-title');
    const contSubEl = document.getElementById('home-continue-subtext');
    const tagEl = document.getElementById('home-progress-tag');
    const badgeEl = document.getElementById('home-progress-badge');
    const chipEl = document.getElementById('home-progress-chip');
    const summaryLabelEl = document.getElementById('home-progress-summary-label');
    const newGameBtn = document.getElementById('btn-home-new-game');

    if (isBeginning) {
      if (tagEl) tagEl.textContent = '📖 제1화 도입부';
      if (badgeEl) {
        badgeEl.textContent = '시작 대기';
        badgeEl.className = 'progress-badge is-start';
      }
      if (chipEl) chipEl.textContent = '시작 위치';
      if (summaryLabelEl) summaryLabelEl.textContent = '도입부 안내';
      if (locEl) locEl.textContent = '본관 복도 (새로운 룸메이트)';
      if (sumEl) sumEl.textContent = '노바리스 아카데미 입학식이 끝나고 기숙사로 향하는 길, 뜻밖의 룸메이트를 마주하게 됩니다.';
      if (contTitleEl) contTitleEl.textContent = '이야기 시작하기';
      if (contSubEl) contSubEl.textContent = '제1화 도입부부터 읽기';
      if (newGameBtn) {
        newGameBtn.style.display = '';
        const titleSpan = newGameBtn.querySelector('.btn-title');
        const subSpan = newGameBtn.querySelector('.btn-subtext');
        if (titleSpan) titleSpan.textContent = '제1화 새로 시작하기';
        if (subSpan) subSpan.textContent = '처음 도입부부터 플레이';
      }
      return;
    }

    if (newGameBtn) {
      newGameBtn.style.display = '';
      const titleSpan = newGameBtn.querySelector('.btn-title');
      const subSpan = newGameBtn.querySelector('.btn-subtext');
      if (titleSpan) titleSpan.textContent = '제1화부터 새로 시작하기';
      if (subSpan) subSpan.textContent = '처음 도입부부터 다시 시작';
    }
    if (tagEl) tagEl.textContent = `📍 최근 진행 위치 · ${STORY_EPISODES[state.getCurrentEpisodeId()]?.title || ''}`.replace(/ · $/, '');
    if (badgeEl) {
      badgeEl.textContent = '진행 중';
      badgeEl.className = 'progress-badge';
    }
    if (chipEl) chipEl.textContent = '현위치';
    if (summaryLabelEl) summaryLabelEl.textContent = '최근 사건 요약';
    if (contTitleEl) contTitleEl.textContent = '이어하기';

    const lastMode = state.getLastActiveMode();
    const lastNodeId = state.getLastActiveNodeId();
    const lastLocId = state.getLastActiveLocationId();

    if (lastMode === 'investigation') {
      const scene = INVESTIGATION_SCENES[lastLocId] || { title: '현장 조사', subtitle: '단서 조사 및 인물 탐색 진행 중' };
      if (locEl) locEl.textContent = `[현장 조사] ${scene.title}`;
      if (sumEl) sumEl.textContent = scene.subtitle || '현장의 단서를 터치하여 새로운 정보와 인물을 발견하세요.';
      if (contSubEl) contSubEl.textContent = `▶ [조사] ${scene.title} 이어하기`;
    } else {
      const node = STORY_NODES[lastNodeId] || STORY_NODES['ep1_pocket_intro'];
      if (locEl) locEl.textContent = `${node.locationName || '기숙사 앞 복도'} (${node.title})`;
      if (sumEl) sumEl.textContent = node.summary || (node.paragraphs?.[0] || '아카데미의 숨겨진 사건이 전개됩니다.');
      if (contSubEl) contSubEl.textContent = `▶ ${node.title} 이어하기`;
    }
  }

  resumeGame(targetNodeId = null) {
    const homeView = document.getElementById('home-view');
    if (homeView) homeView.classList.add('hidden');
    this.engine.playAudio('click');

    const history = state.getHistory ? state.getHistory() : (state.data?.history || []);
    const isBeginning = (history.length <= 1) &&
      !state.hasPocket() &&
      Object.keys(state.data?.flags || {}).length === 0 &&
      (state.data?.collectedHotspots || []).length === 0;

    if (targetNodeId) {
      state.setMode('story');
      state.setCurrentNode(targetNodeId);
      this.engine.renderStoryNode(targetNodeId);
      this.syncPocketAvailability();
      return;
    }

    if (isBeginning) {
      state.setMode('story');
      state.setCurrentNode('ep1_pocket_intro');
      this.engine.renderStoryNode('ep1_pocket_intro');
      this.syncPocketAvailability();
      return;
    }

    const lastMode = state.getLastActiveMode();
    if (lastMode === 'investigation') {
      const locId = state.getLastActiveLocationId();
      if (INVESTIGATION_SCENES[locId]) {
        state.setMode('investigation', locId);
        this.engine.startInvestigation(locId);
      } else {
        const fallbackNode = STORY_EPISODES[state.getCurrentEpisodeId()]?.startNode || 'ep1_pocket_intro';
        state.setMode('story');
        state.setCurrentNode(fallbackNode);
        this.engine.renderStoryNode(fallbackNode);
      }
    } else {
      const nodeId = state.getLastActiveNodeId();
      const validNode = STORY_NODES[nodeId] ? nodeId : (STORY_EPISODES[state.getCurrentEpisodeId()]?.startNode || 'ep1_pocket_intro');
      state.setMode('story');
      state.setCurrentNode(validNode);
      this.engine.renderStoryNode(validNode);
    }
    this.syncPocketAvailability();
  }

  startNewGame() {
    const history = state.getHistory ? state.getHistory() : (state.data?.history || []);
    const isBeginning = (history.length <= 1) &&
      !state.hasPocket() &&
      Object.keys(state.data?.flags || {}).length === 0 &&
      (state.data?.collectedHotspots || []).length === 0;

    if (!isBeginning) {
      const confirmed = window.confirm('진행 데이터를 처음 상태로 되돌리고 제1화 도입부부터 새로 시작하시겠습니까?\n(작가 편집 모드에서 저장한 장면과 설정은 안전하게 보존됩니다)');
      if (!confirmed) return;
    }

    state.reset();
    loadEpisodeToLive(state.getCurrentEpisodeId());
    this.engine.showToast('새로운 모험이 시작됩니다!', 'success', '✨');
    this.resumeGame('ep1_pocket_intro');
  }

  // --- 3-Tier Table of Contents (TOC) ---

  initStoryToc() {
    const tocModal = document.getElementById('story-toc-modal');
    const closeBtn = document.getElementById('btn-close-story-toc');
    const backdrop = tocModal?.querySelector('.story-toc-backdrop');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeStoryToc());
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeStoryToc());
    }

    document.getElementById('btn-open-toc')?.addEventListener('click', () => this.openStoryToc());
    document.getElementById('btn-home-episodes')?.addEventListener('click', () => this.openStoryToc());

    if (tocModal) {
      tocModal.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-toc-tab]');
        if (tabBtn) {
          this.tocTab = tabBtn.dataset.tocTab === 'completed' ? 'completed' : 'active';
          this.renderStoryToc();
          this.engine.playAudio('click');
          return;
        }
        const completeBtn = e.target.closest('[data-complete-episode]');
        if (completeBtn) {
          const epId = completeBtn.dataset.completeEpisode;
          state.setEpisodeCompleted(epId, true);
          this.engine.showToast(`${STORY_EPISODES[epId]?.title || epId} 완료 처리되었습니다.`, 'success', '🏁');
          this.tocTab = 'completed';
          this.renderStoryToc();
          return;
        }
        const reopenBtn = e.target.closest('[data-reopen-episode]');
        if (reopenBtn) {
          const epId = reopenBtn.dataset.reopenEpisode;
          state.setEpisodeCompleted(epId, false);
          this.tocTab = 'active';
          this.renderStoryToc();
          return;
        }
        const startBtn = e.target.closest('[data-start-episode]');
        if (startBtn) {
          const epId = startBtn.dataset.startEpisode;
          this.closeStoryToc();
          this.startEpisode(epId);
          return;
        }
        const jumpBtn = e.target.closest('[data-jump-node]');
        if (jumpBtn) {
          const nodeId = jumpBtn.dataset.jumpNode;
          if (nodeId) {
            this.closeStoryToc();
            this.resumeGame(nodeId);
          }
        }
      });
    }
  }

  startEpisode(episodeId) {
    const episode = STORY_EPISODES[episodeId];
    if (!episode) return;
    const startNode = episode.startNode && STORY_NODES[episode.startNode]
      ? episode.startNode
      : Object.values(STORY_NODES).find((node) => node.episodeId === episodeId)?.id;
    if (!startNode) {
      this.engine.showToast('이 회차에는 시작 장면이 없습니다.', 'info', '⚠️');
      return;
    }
    // 아이템 · 단서 · 스탯 · 완료 목록은 state 하나로 유지되므로 회차를 바꿔도 초기화되지 않습니다.
    state.setCurrentEpisodeId(episodeId);
    loadEpisodeToLive(episodeId);
    this.resumeGame(startNode);
  }

  openStoryToc() {
    if (!document.body.classList.contains('author-mode')) return; // 독자에게는 비공개
    this.renderStoryToc();
    const modal = document.getElementById('story-toc-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
    this.engine.playAudio('click');
  }

  closeStoryToc() {
    const modal = document.getElementById('story-toc-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  renderStoryToc() {
    const tocBody = document.getElementById('story-toc-body');
    if (!tocBody) return;

    const currentNodeId = state.getCurrentNodeId();
    const history = state.getHistory() || [];

    // Group nodes by episode, then by chapter
    let episodeGroups = new Map();
    Object.values(STORY_NODES).forEach((node) => {
      const epId = node.episodeId || 'ep1';
      if (!episodeGroups.has(epId)) episodeGroups.set(epId, new Map());
      const chapterGroups = episodeGroups.get(epId);
      const ch = node.chapter || '제1장. 한밤중의 비상 소집';
      if (!chapterGroups.has(ch)) chapterGroups.set(ch, []);
      chapterGroups.get(ch).push(node);
    });

    // 회차 순서(편집기에서 지정)대로 정렬
    const episodeOrder = Object.keys(STORY_EPISODES);
    const orderOf = (id) => (episodeOrder.indexOf(id) < 0 ? 9999 : episodeOrder.indexOf(id));
    episodeGroups = new Map(Array.from(episodeGroups.entries()).sort((a, b) => orderOf(a[0]) - orderOf(b[0])));

    const completedEpisodes = state.getCompletedEpisodes();
    const currentEpisodeId = state.getCurrentEpisodeId();
    const activeTab = this.tocTab === 'completed' ? 'completed' : 'active';
    const completedCount = Array.from(episodeGroups.keys()).filter((id) => completedEpisodes.includes(id)).length;
    const activeCount = episodeGroups.size - completedCount;

    let html = `
      <div class="episode-tabs" role="tablist" aria-label="회차 분류">
        <button type="button" class="episode-tab ${activeTab === 'active' ? 'is-active' : ''}" data-toc-tab="active" role="tab" aria-selected="${activeTab === 'active'}">진행 중 <span class="episode-tab-count">${activeCount}</span></button>
        <button type="button" class="episode-tab ${activeTab === 'completed' ? 'is-active' : ''}" data-toc-tab="completed" role="tab" aria-selected="${activeTab === 'completed'}">완료됨 <span class="episode-tab-count">${completedCount}</span></button>
      </div>
    `;
    let renderedEpisodes = 0;

    episodeGroups.forEach((chapterGroups, epId) => {
      const isDone = completedEpisodes.includes(epId);
      if ((activeTab === 'completed') !== isDone) return;
      renderedEpisodes += 1;
      const episode = STORY_EPISODES[epId] || { title: `회차 ${epId}` };
      const episodeActions = isDone
        ? `<button type="button" class="episode-action-btn" data-start-episode="${escapeHtml(epId)}">다시 읽기</button>
           <button type="button" class="episode-action-btn is-subtle" data-reopen-episode="${escapeHtml(epId)}">↩ 진행 중으로 되돌리기</button>`
        : `${epId === currentEpisodeId ? '<span class="episode-current-pill">📍 현재 진행 중</span>' : `<button type="button" class="episode-action-btn" data-start-episode="${escapeHtml(epId)}">▶ 이 회차 시작</button>`}
           <button type="button" class="episode-action-btn is-subtle" data-complete-episode="${escapeHtml(epId)}">🏁 완료 처리</button>`;
      html += `
        <div class="toc-volume-block">
          <div class="toc-volume-header">
            <span class="toc-tier-tag tier-tag-vol">대분류 · 회차${isDone ? ' · 완료' : ''}</span>
            <h3 class="toc-volume-title">${escapeHtml(episode.title)}</h3>
            <div class="episode-actions">${episodeActions}</div>
          </div>
          <div class="toc-volume-content">
      `;

      chapterGroups.forEach((nodes, chapter) => {
        html += `
          <div class="toc-chapter-block">
            <div class="toc-chapter-header">
              <span class="toc-tier-tag tier-tag-ch">중분류 · 에피소드</span>
              <h4 class="toc-chapter-title">${escapeHtml(chapter)}</h4>
            </div>
            <div class="toc-scenes-list">
        `;

        nodes.forEach((node) => {
          const isCurrent = (node.id === currentNodeId && state.getMode() === 'story');
          const isCleared = history.includes(node.id);
          const statusClass = isCurrent ? 'status-current' : (isCleared ? 'status-cleared' : 'status-locked');
          const statusLabel = isCurrent ? '📍 현재 위치' : (isCleared ? '✔️ 도달 완료' : '🔒 미도달');

          const choicesHtml = (node.choices || []).map((c) => {
            const isInvest = c.isInvestigationTrigger;
            return `
              <li class="toc-choice-item">
                <div class="toc-choice-header">
                  <span class="choice-pointer">➔</span>
                  <span class="choice-name">${escapeHtml(c.text)}</span>
                  ${isInvest ? `<span class="choice-invest-tag">🔍 현장 조사 분기</span>` : ''}
                </div>
                ${c.desc ? `<div class="choice-desc-preview">💬 ${escapeHtml(c.desc)}</div>` : ''}
              </li>
            `;
          }).join('');

          html += `
            <div class="toc-scene-card ${statusClass}">
              <div class="toc-scene-head">
                <div class="toc-scene-titles">
                  <span class="toc-tier-tag tier-tag-sc">소분류 · 현위치 사건</span>
                  <div class="toc-scene-name-row">
                    <strong class="toc-scene-name">${escapeHtml(node.title)}</strong>
                    <span class="toc-scene-location">📍 ${escapeHtml(node.locationName || '아카데미 구역')}</span>
                  </div>
                </div>
                <span class="toc-scene-status-badge">${statusLabel}</span>
              </div>

              ${node.summary ? `<p class="toc-scene-summary">${escapeHtml(node.summary)}</p>` : ''}

              <div class="toc-scene-choices-box">
                <span class="choices-box-title">플레이어 선택지 분기:</span>
                <ul class="toc-choices-list">
                  ${choicesHtml || '<li class="toc-choice-empty">선택지 없음</li>'}
                </ul>
              </div>

              <div class="toc-scene-actions">
                <button type="button" class="toc-jump-btn" data-jump-node="${escapeHtml(node.id)}">
                  ${isCurrent ? '▶ 현재 위치 계속 읽기' : '이 장면으로 이동'}
                </button>
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    if (renderedEpisodes === 0) {
      html += `<p class="episode-empty">${activeTab === 'completed' ? '아직 완료한 회차가 없습니다.' : '진행 중인 회차가 없습니다.'}</p>`;
    }

    tocBody.innerHTML = html;
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
        if (this.memoBoard?.focusedKeywordId) {
          this.memoBoard.exitFocusMode();
        }
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
        onTravelToLocation: (loc, mode) => this.travelToLocation(loc, mode),
        onCannotTravel: (tile) => {
          this.engine.playAudio('click');
          if (tile?.isCurrent) {
            this.engine.showToast('이미 현재 위치에 있습니다.', 'info', '📍');
          } else {
            this.engine.showToast('지금은 못 가.', 'warning', '🚫');
          }
        },
        onSetCurrentTile: (tileKey) => state.setCurrentMapTileKey(tileKey)
      });
    }

    const returnStoryBtn = document.getElementById('map-return-story-btn');
    if (returnStoryBtn) {
      returnStoryBtn.addEventListener('click', () => {
        this.closePocketModal();
        const currentEp = (state.getCurrentEpisodeId && state.getCurrentEpisodeId()) || 'ep1';
        const hubNode = STORY_EPISODES[currentEp]?.hubNode ||
          Object.values(STORY_NODES).find((n) => n.isHubNode || (n.chapter && n.chapter.includes('탐사 허브')))?.id ||
          (STORY_NODES['story_1795192473432'] ? 'story_1795192473432' : 'ep1_return_from_investigation');
        const currentLocId = state.getCurrentLocationId();
        const scene = INVESTIGATION_SCENES[currentLocId];
        const targetNode = hubNode || scene?.exitStoryNode || state.getLastActiveNodeId() || 'ep1_return_from_investigation';
        state.setMode('story');
        state.setCurrentNode(targetNode);
        this.engine.renderStoryNode(targetNode);
        this.engine.showToast('어떻게 할까? 장면으로 이동했습니다.', 'info', '💭');
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
          if (state.getFlag('deduction_any_solved')) return;
          this.engine.playAudio('codexUnlock');
          state.setFlag('deduction_any_solved', true);
          const names = matchedClues.map(c => `[${c.label}]`).join(' + ');
          this.engine.showToast(`🎉 [추론 완성] ${names} 조건을 만족하는 '${subNode.label}'을 찾아냈습니다!`, 'success', '✨');
          const cur = state.getCurrentNodeId();
          if (STORY_NODES[cur]) {
            this.engine.renderStoryNode(cur);
          }
        }
      });
      this.hexBoards.memo = this.memoBoard;
      state.on('tileRecordUnlocked', () => {
        if (this.memoBoard) {
          this.memoBoard.render();
        }
      });
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

    const arrangeBtn = document.getElementById('btn-memo-arrange');
    if (arrangeBtn) {
      arrangeBtn.addEventListener('click', () => {
        if (!this.memoBoard) return;
        const result = this.memoBoard.arrangeClues();
        this.engine.playAudio('wheelTick');
        if (result?.mode === 'hex') {
          arrangeBtn.textContent = '육각형 정렬';
          arrangeBtn.title = '육각형 정렬';
          this.engine.showToast('육각형 정렬', 'info', '⬡');
        } else {
          arrangeBtn.textContent = '직선 정렬';
          arrangeBtn.title = '직선 정렬';
          this.engine.showToast('직선 정렬', 'info', '━');
        }
      });
    }

    const markAllReadBtn = document.getElementById('btn-memo-mark-all-read');
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => {
        state.markAllCodexRead();
        if (this.memoBoard) {
          this.memoBoard.readNewIds.clear();
          this.memoBoard.render();
        }
        this.renderCodexList();
        this.updateCategoryUnreadBadges();
        this.wheel?.updateNotificationBadge();
        this.engine.playAudio('codexUnlock');
        this.engine.showToast('새로운 정보를 모두 확인했습니다.', 'success', '✓');
      });
    }
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

  openDeductionMode(topicId = null) {
    const targetTopic = topicId || 'clue_herb_quiz';
    state.unlockCodex(targetTopic);
    this.openPocketModal('codex');

    document.querySelectorAll('.codex-filter-btn').forEach((btn) => {
      const isClue = btn.dataset.category === 'clue';
      btn.classList.toggle('is-active', isClue);
      btn.setAttribute('aria-pressed', String(isClue));
    });
    this.activeCodexCategory = 'clue';
    this.renderCodexList();

    if (this.memoBoard) {
      this.memoBoard.enterFocusMode(targetTopic);
    }
    this.engine.showToast('수첩에서 단서들을 짜맞춰보는 추론 모드입니다.', 'info', '🧩');
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

    const q = (this.activeCodexSearch || '').trim().toLowerCase();
    const stateRecords = state.getUnlockedTileRecords();

    const allEntries = [...CODEX_DATA];
    const existingIds = new Set(CODEX_DATA.map((c) => c.id));
    const unlockedCodex = state.getUnlockedCodex() || {};

    Object.entries(unlockedCodex).forEach(([id, codexItem]) => {
      if (codexItem && codexItem.unlocked && !existingIds.has(id)) {
        // Filter out legacy dummy template IDs or invalid entries
        if (id === 'ep_01' || id === 'char_aren' || id === 'item_inquisitor_badge' || id === 'magic_resonance') return;
        if (id.startsWith('ep_') || id.startsWith('item_')) return;
        // Never convert sub-clues (단서 조건) or sub-items (세부타일) into top-level 대분류 topics!
        if (id.startsWith('sc_') || id.startsWith('sub_') || id.startsWith('clue_cond_') || id.includes('_sc_') || id.includes('_keyword_')) return;
        const isChildItem = CODEX_DATA.some((c) =>
          (c.subClues || []).some((sc) => sc.id === id || sc.label === id) ||
          (c.subItems || []).some((si) => si.id === id || si.label === id)
        );
        if (isChildItem) return;

        let cat = codexItem.category;
        if (!cat) {
          if (id.startsWith('char_')) cat = 'character';
          else if (id.startsWith('magic_')) cat = 'magic';
          else cat = 'clue';
        }
        let title = codexItem.title || codexItem.name || id.replace(/^(clue_|char_|magic_)/, '');
        allEntries.push({
          id,
          category: cat,
          role: cat === 'clue' ? 'keyword' : undefined,
          title,
          icon: codexItem.icon || (cat === 'character' ? '👤' : (cat === 'magic' ? '✨' : '🌿')),
          summary: codexItem.summary || codexItem.desc || `${title}에 대한 수사 기록입니다.`,
          description: codexItem.description || codexItem.desc || `${title}에 관한 상세 정보입니다.`,
          unlockedByDefault: false,
          keywords: [title]
        });
        existingIds.add(id);
      }
    });

    this.updateCategoryUnreadBadges(allEntries);

    const filtered = allEntries.filter((entry) => {
      const matchCat = this.activeCodexCategory === 'all'
        ? memoCategories.has(entry.category)
        : entry.category === this.activeCodexCategory;

      if (!matchCat) return false;
      if (!q) return true;

      // 1. Core fields check (title, summary, description, keywords, answers)
      const matchMain =
        (entry.title || '').toLowerCase().includes(q) ||
        (entry.summary || '').toLowerCase().includes(q) ||
        (entry.description || '').toLowerCase().includes(q) ||
        entry.keywords?.some((keyword) => keyword.toLowerCase().includes(q)) ||
        entry.answers?.some((ans) => (typeof ans === 'string' ? ans : ans.text || '').toLowerCase().includes(q));

      if (matchMain) return true;

      // 2. Detail tiles check (subItems: label, desc, sub, records)
      const matchSubItems = (entry.subItems || []).some((sub) => {
        if (!sub) return false;
        if (typeof sub === 'string') return sub.toLowerCase().includes(q);
        const lMatch = (sub.label || '').toLowerCase().includes(q);
        const dMatch = (sub.desc || sub.description || '').toLowerCase().includes(q);
        const sMatch = (sub.sub || '').toLowerCase().includes(q);
        if (lMatch || dMatch || sMatch) return true;
        if (Array.isArray(sub.records)) {
          return sub.records.some((rec) => (rec?.text || '').toLowerCase().includes(q));
        }
        return false;
      });

      if (matchSubItems) return true;

      // 3. SubClues check (subClues: label, desc, sub, validTargets, invalidTargets)
      const matchSubClues = (entry.subClues || []).some((sc) => {
        if (!sc) return false;
        if ((sc.label || sc.title || '').toLowerCase().includes(q)) return true;
        if ((sc.desc || sc.conditionDesc || '').toLowerCase().includes(q)) return true;
        if ((sc.sub || '').toLowerCase().includes(q)) return true;
        if (Array.isArray(sc.validTargets) && sc.validTargets.some((t) => (t || '').toLowerCase().includes(q))) return true;
        if (Array.isArray(sc.invalidTargets) && sc.invalidTargets.some((t) => (t || '').toLowerCase().includes(q))) return true;
        return false;
      });

      if (matchSubClues) return true;

      // 4. Dynamic unlocked tile records from state check
      const matchDynamicRecords = Object.values(stateRecords).some((rec) => {
        if (!rec || !rec.text || !rec.text.toLowerCase().includes(q)) return false;
        if (rec.tileId === entry.id || rec.tileId === entry.title) return true;
        if (Array.isArray(entry.subItems)) {
          return entry.subItems.some((si) => si && (si.id === rec.tileId || si.label === rec.tileId));
        }
        return false;
      });

      return matchDynamicRecords;
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
    const topicEntries = filtered.filter((entry) => entry.category !== 'character' && entry.category !== 'item' && entry.category !== 'episode');
    const clueNodes = topicEntries.map((entry) => {
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
        return sc.unlockedByDefault !== false || state.isClueConditionUnlocked(sc.id) || state.isClueConditionUnlocked(sc.label);
      }).map((sc) => ({
        ...sc,
        isUnlocked: true,
        parentEntry: entry,
        parentId: entry.id,
        isNew: Boolean(state.getUnlockedCodex()[sc.id]?.isNew && !board.readNewIds.has(sc.id))
      }));

      const unlockedSubItems = (entry.subItems || []).filter((si) => {
        if (!si) return false;
        if (typeof si === 'string') return true;
        return si.unlockedByDefault !== false || state.isSubItemUnlocked(si.id, si.label, entry);
      }).map((si) => ({
        ...(typeof si === 'string' ? { id: `si_${si}`, label: si } : si),
        isUnlocked: true,
        parentEntry: entry,
        parentId: entry.id,
        isNew: Boolean(state.getUnlockedCodex()[si.id]?.isNew && !board.readNewIds.has(si.id))
      }));

      return {
        ...entry,
        entry,
        role: entry.role || 'keyword',
        label: unlocked ? (entry.title || entry.keywords?.[0]) : '미발견',
        sub: categoryLabel(entry.category || 'clue'),
        subClues: unlockedSubClues,
        subItems: Array.isArray(entry.subItems) ? unlockedSubItems : subItems,
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
    const boardNodes = (this.activeCodexCategory === 'character' || this.activeCodexCategory === 'magic')
      ? categoryIndexes
      : clueNodes;
    const visibleBoardNodes = boardNodes.filter((node) => !node.locked);
    if (visibleBoardNodes.length === 0) {
      board.setClues([], { includeHypotheses: false, selectedId: null });
      document.getElementById('codex-entry-detail')?.replaceChildren();
      if (emptyMessage) emptyMessage.classList.remove('hidden');
      return;
    }

    if (emptyMessage) emptyMessage.classList.add('hidden');

    // Find if a specific subItem or subClue matched the search query
    let matchedSubItem = null;
    let matchedSubItemParentNode = null;
    let matchedSubClue = null;
    let matchedSubClueParentNode = null;

    if (q) {
      for (const node of visibleBoardNodes) {
        if (Array.isArray(node.subItems)) {
          const found = node.subItems.find((sub) => {
            if (!sub) return false;
            if (typeof sub === 'string') return sub.toLowerCase().includes(q);
            const lMatch = (sub.label || '').toLowerCase().includes(q);
            const dMatch = (sub.desc || sub.description || '').toLowerCase().includes(q);
            const sMatch = (sub.sub || '').toLowerCase().includes(q);
            const rMatch = Array.isArray(sub.records) && sub.records.some((r) => (r?.text || '').toLowerCase().includes(q));
            return lMatch || dMatch || sMatch || rMatch;
          });
          if (found) {
            matchedSubItem = typeof found === 'string'
              ? { id: `${node.id}_kw_search`, label: found, sub: '세부 타일', desc: node.desc || node.summary }
              : found;
            matchedSubItemParentNode = node;
            break;
          }
        }
        if (!matchedSubItem && Array.isArray(node.subClues)) {
          const found = node.subClues.find((sc) => {
            if (!sc) return false;
            const lMatch = (sc.label || sc.title || '').toLowerCase().includes(q);
            const dMatch = (sc.desc || sc.conditionDesc || '').toLowerCase().includes(q);
            const sMatch = (sc.sub || '').toLowerCase().includes(q);
            return lMatch || dMatch || sMatch;
          });
          if (found) {
            matchedSubClue = found;
            matchedSubClueParentNode = node;
            break;
          }
        }
      }
    }

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
    if (matchedSubItemParentNode) {
      selectedBoardId = matchedSubItemParentNode.id;
    } else if (matchedSubClueParentNode) {
      selectedBoardId = matchedSubClueParentNode.id;
    }
    selectedBoardId ||= visibleBoardNodes[0]?.id;
    const selectedBoardNode = visibleBoardNodes.find((node) => node.id === selectedBoardId) || visibleBoardNodes[0];

    board.setClues(visibleBoardNodes, {
      includeHypotheses:
        (this.activeCodexCategory === 'all' || this.activeCodexCategory === 'clue') &&
        !q,
      selectedId: selectedBoardNode.id
    });

    if (matchedSubItem && matchedSubItemParentNode) {
      board.expandedId = matchedSubItemParentNode.id;
      board.pinnedId = matchedSubItemParentNode.id;
      if (matchedSubItem.id) board.selectedId = matchedSubItem.id;
      board.render();
      this.selectCodexSubItem({
        ...matchedSubItem,
        parentEntry: matchedSubItemParentNode.entry || matchedSubItemParentNode
      });
    } else if (matchedSubClue && matchedSubClueParentNode) {
      board.expandedId = matchedSubClueParentNode.id;
      board.pinnedId = matchedSubClueParentNode.id;
      if (matchedSubClue.id) board.selectedId = matchedSubClue.id;
      board.render();
      this.selectCodexMidClue({
        ...matchedSubClue,
        isMidClue: true,
        parentEntry: matchedSubClueParentNode.entry || matchedSubClueParentNode
      });
    } else {
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
  }

  updateCategoryUnreadBadges(codexList = CODEX_DATA) {
    const counts = state.getUnreadCountByCategory(codexList);
    ['all', 'clue', 'character', 'magic'].forEach((cat) => {
      const badgeEl = document.querySelector(`[data-category-badge="${cat}"]`);
      if (badgeEl) {
        const count = counts[cat] || 0;
        if (count > 0) {
          badgeEl.textContent = count > 9 ? '9+' : String(count);
          badgeEl.classList.remove('hidden');
        } else {
          badgeEl.classList.add('hidden');
        }
      }
    });

    const markAllReadBtn = document.getElementById('btn-memo-mark-all-read');
    if (markAllReadBtn) {
      markAllReadBtn.style.display = counts.all > 0 ? 'inline-flex' : 'none';
    }
  }

  selectMemoCategoryIndex(node) {
    this.selectedCodexId = null;
    this.selectedMemoIndexCategory = node.category;
    this.selectedMemoDetailId = null;
    if (this.memoBoard) {
      this.memoBoard.readNewIds.add(node.id);
      this.memoBoard.render();
    }
    this.updateCategoryUnreadBadges();
    this.wheel?.updateNotificationBadge();

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
    const count = (node.subItems || []).length;
    const paragraph = document.createElement('p');
    paragraph.textContent = count
      ? `발견한 ${node.label} 기록 ${count}개가 등록되어 있습니다. 항목을 선택하여 상세 내용을 확인하세요.`
      : `아직 발견한 ${node.label} 기록이 없습니다. 인물과 현장을 조사하면 이곳에 기록이 추가됩니다.`;
    description.appendChild(paragraph);

    if (count > 0) {
      const grid = document.createElement('div');
      grid.className = 'category-entries-grid';
      node.subItems.forEach((si) => {
        const card = document.createElement('div');
        const isNew = Boolean(si.isNew || state.getUnlockedCodex()[si.entry?.id]?.isNew);
        card.className = `category-entry-card ${isNew ? 'is-new-card' : ''}`;

        const entryIcon = si.entry?.icon || '👤';
        const iconHtml = entryIcon.includes('/')
          ? `<img src="${escapeHtml(entryIcon)}" alt="" style="width:26px; height:26px; object-fit:contain; border-radius:50%;">`
          : `<span style="font-size:20px;">${escapeHtml(entryIcon)}</span>`;

        card.innerHTML = `
          <div class="card-icon" style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--bg-dim); flex-shrink:0;">
            ${iconHtml}
          </div>
          <div class="card-info" style="flex:1; min-width:0;">
            <strong style="display:block; font-size:13px; color:var(--text-main);">${escapeHtml(si.label)}</strong>
            <span style="display:block; font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(si.desc || '')}</span>
          </div>
          ${isNew ? '<span class="entry-card-new-pill">NEW</span>' : ''}
        `;

        card.addEventListener('click', () => {
          if (si.entry) {
            this.selectedCodexId = si.entry.id;
            this.selectCodexEntry(si.entry);
          } else {
            this.selectCodexSubItem(si);
          }
        });
        grid.appendChild(card);
      });
      description.appendChild(grid);
    }

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
    const wasNew = Boolean(node.isNew || state.getUnlockedCodex()[node.entry?.id]?.isNew);
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
    this.updateCategoryUnreadBadges();
    this.wheel?.updateNotificationBadge();
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

    let validationBannerHtml = '';
    if (node.validationState === 'unknown') {
      validationBannerHtml = `
        <div style="margin-top:14px; padding:10px 14px; background:rgba(148, 163, 184, 0.12); border:1.5px dashed #94a3b8; border-radius:8px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">🤔</span>
          <div>
            <strong style="color:#334155; font-size:12.5px; display:block;">단서 조건 미판정 ("잘은 모르겠다")</strong>
            <span style="color:#64748b; font-size:11.5px; line-height:1.4; display:block;">단서 타일에 배치되었으나, 아직 이 조건에 부합하는지 여부를 판단할 세부 설명(관찰 기록)을 발견하지 못했습니다. 본문이나 탐사 현장을 조사하여 관련 기록을 확보해보세요.</span>
          </div>
        </div>
      `;
    } else if (node.validationState === 'valid') {
      validationBannerHtml = `
        <div style="margin-top:14px; padding:10px 14px; background:rgba(41, 128, 185, 0.12); border:1.5px solid #2980b9; border-radius:8px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">🔵</span>
          <div>
            <strong style="color:#2980b9; font-size:12.5px; display:block;">단서 조건 부합 (참)</strong>
            <span style="color:#1b4f72; font-size:11.5px; line-height:1.4; display:block;">발견한 조사 기록을 바탕으로 이 단서의 조건과 일치함을 확인했습니다!</span>
          </div>
        </div>
      `;
    } else if (node.validationState === 'invalid') {
      validationBannerHtml = `
        <div style="margin-top:14px; padding:10px 14px; background:rgba(192, 57, 43, 0.12); border:1.5px solid #c0392b; border-radius:8px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">🔴</span>
          <div>
            <strong style="color:#c0392b; font-size:12.5px; display:block;">단서 조건 모순 (거짓)</strong>
            <span style="color:#78281f; font-size:11.5px; line-height:1.4; display:block;">발견한 조사 기록과 비교했을 때 이 단서의 조건과 맞지 않는 거짓(모순)입니다.</span>
          </div>
        </div>
      `;
    }

    let elimButtonHtml = '';
    if (this.memoBoard?.focusedKeywordId) {
      const isEliminated = this.memoBoard.eliminatedTileIds?.has(node.id);
      if (isEliminated) {
        elimButtonHtml = `<button type="button" id="btn-subitem-restore" class="memo-btn-restore">↩ 보드로 복귀</button>`;
      } else {
        elimButtonHtml = `<button type="button" id="btn-subitem-eliminate" class="memo-btn-eliminate">❌ 후보 탈락 칸으로 이동</button>`;
      }
    }

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
            ${validationBannerHtml}
            ${recordsHtml}
          </div>
        </div>
        <footer class="detail-footer">
          <span class="detail-status-pill">✓ 세부 단서 확인 완료</span>
          ${elimButtonHtml}
        </footer>
      </div>
    `;

    const elimBtn = detailContainer.querySelector('#btn-subitem-eliminate');
    if (elimBtn) {
      elimBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.memoBoard?.eliminateTile(node);
        this.selectCodexSubItem(node);
      });
    }
    const restoreBtn = detailContainer.querySelector('#btn-subitem-restore');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.memoBoard?.restoreTile(node.id);
        this.selectCodexSubItem(node);
      });
    }
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
    const wasNew = Boolean(state.getUnlockedCodex()[entry.id]?.isNew);

    if (state.isCodexUnlocked(entry.id)) {
      state.markCodexRead(entry.id);
    }
    if (this.memoBoard) {
      this.memoBoard.readNewIds.add(entry.id);
      this.memoBoard.render();
    }
    this.updateCategoryUnreadBadges();
    this.wheel?.updateNotificationBadge();

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

    const newPillHtml = wasNew ? `<span class="detail-new-pill">✨ 새로 등록된 정보</span>` : '';

    let subCluesSectionHtml = '';
    if (Array.isArray(entry.subClues) && entry.subClues.length > 0) {
      const itemsHtml = entry.subClues.map((sc) => {
        const isUnlocked = sc.unlockedByDefault !== false || state.isClueConditionUnlocked(sc.id) || state.isClueConditionUnlocked(sc.label);
        if (isUnlocked) {
          return `
            <div style="padding: 8px 10px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 6px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <strong style="color: #b45309; font-size: 13px;">🔘 ${escapeHtml(sc.label || '단서')}</strong>
                <span style="font-size: 11px; font-weight: 700; color: #16a34a;">해금 완료</span>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-main); line-height: 1.4;">${escapeHtml(sc.desc || '')}</p>
            </div>
          `;
        } else {
          return `
            <div style="padding: 8px 10px; background: rgba(0,0,0,0.03); border: 1px dashed rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="color: var(--text-muted); font-size: 13px; font-weight: 600;">🔒 미확인 단서</span>
                <span style="font-size: 11px; color: var(--text-muted);">현장 조사 필요</span>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 11.5px; color: var(--text-muted);">아카데미 현장 조사나 인물 대화를 통해 발견할 수 있습니다.</p>
            </div>
          `;
        }
      }).join('');

      const unlockedCount = entry.subClues.filter((sc) => sc.unlockedByDefault !== false || state.isClueConditionUnlocked(sc.id) || state.isClueConditionUnlocked(sc.label)).length;

      subCluesSectionHtml = `
        <div class="detail-clues-section" style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border-color, #cbd5e1);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h4 style="font-size: 13px; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
              <span>🔘 수집된 단서 조건</span>
              <span style="font-size: 11px; padding: 2px 7px; background: rgba(0,0,0,0.1); border-radius: 4px; font-weight: 700;">${unlockedCount}/${entry.subClues.length}</span>
            </h4>
            <button type="button" class="btn-focus-mode" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; background: var(--accent-gold, #f59e0b); color: #000; border: none; border-radius: 4px; cursor: pointer;">💡 추론 모드</button>
          </div>
          <div class="detail-subclues-list">
            ${itemsHtml}
          </div>
        </div>
      `;
    }

    detailContainer.innerHTML = `
      <div class="codex-detail-content">
        <header class="detail-header">
          <span class="detail-category-badge">${categoryLabel}</span>
          ${newPillHtml}
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
          ${subCluesSectionHtml}
        </div>
        <footer class="detail-footer">
          <span class="detail-status-pill">✓ 수사 수첩 기록 완료</span>
        </footer>
      </div>
    `;

    const focusBtn = detailContainer.querySelector('.btn-focus-mode');
    if (focusBtn && this.memoBoard) {
      focusBtn.addEventListener('click', () => {
        this.memoBoard.enterFocusMode(entry.id);
      });
    }
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

  travelToLocation(loc, preferredMode = null) {
    if (!loc) return;
    this.closePocketModal();
    state.setCurrentLocationId(loc.id);

    const hasStory = Boolean(loc.targetStoryNode);
    const hasInv = Boolean(loc.hasInvestigation);

    // 네블라 홀 본문에서 두 선택지 중 하나라도 고르고 나면 지도로 이동 시 항상 조사 장면으로만 향하도록 분기
    const isNebulaBranched = loc.id === 'loc_nebula' && (
      (this.engine?.isNebulaChoiceCompleted ? this.engine.isNebulaChoiceCompleted() : false) ||
      state.getFlag('nebula_hall_choice_selected') ||
      state.getFlag('chosen_choice_story_1795180010121_0') ||
      state.getFlag('chosen_choice_story_1795180010121_1') ||
      state.getFlag('chosen_text_story_1795180010121_손전등을 꺼낸다.') ||
      state.getFlag('chosen_text_story_1795180010121_일단 앞으로 전진한다.') ||
      state.getFlag('visited_target_story_1795180210502') ||
      (state.hasVisitedNode && (
        state.hasVisitedNode('story_1795180210502') ||
        state.hasVisitedNode('story_1795180361145') ||
        state.hasVisitedNode('story_1795180742741') ||
        state.hasVisitedNode('story_1795185391071')
      ))
    );

    let mode = preferredMode;
    if (isNebulaBranched && hasInv) {
      mode = 'investigation';
    } else if (!mode) {
      if (loc.destinationType === 'story') mode = 'story';
      else if (loc.destinationType === 'investigation') mode = 'investigation';
      else if (loc.travelMode === 'story') mode = 'story';
      else if (loc.travelMode === 'investigation') mode = 'investigation';
      else if (hasStory && !hasInv) mode = 'story';
      else if (hasInv && !hasStory) mode = 'investigation';
      else if (hasStory) mode = 'story';
      else mode = 'investigation';
    }

    if (mode === 'story' && hasStory) {
      state.setMode('story');
      state.setCurrentNode(loc.targetStoryNode);
      this.engine.renderStoryNode(loc.targetStoryNode);
      this.engine.showToast(`[${loc.name}](으)로 이동했습니다.`, 'info', loc.icon || '📍');
    } else if (mode === 'investigation' && hasInv) {
      state.setMode('investigation', loc.id);
      this.engine.startInvestigation(loc.id);
      this.engine.showToast(`[${loc.name}](으)로 이동했습니다.`, 'info', loc.icon || '📍');
    } else if (hasStory) {
      state.setMode('story');
      state.setCurrentNode(loc.targetStoryNode);
      this.engine.renderStoryNode(loc.targetStoryNode);
      this.engine.showToast(`[${loc.name}](으)로 이동했습니다.`, 'info', loc.icon || '📍');
    } else if (hasInv) {
      state.setMode('investigation', loc.id);
      this.engine.startInvestigation(loc.id);
      this.engine.showToast(`[${loc.name}](으)로 이동했습니다.`, 'info', loc.icon || '📍');
    } else {
      this.engine.showToast(`[${loc.name}](으)로 이동했습니다.`, 'info', loc.icon || '📍');
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
      { key: 'magic', label: '마법', icon: '✨', max: 100, desc: '고대 마법 소질과 아티팩트 조작 및 마력 감응 능력.' },
      { key: 'knowledge', label: '지식', icon: '📖', max: 100, desc: '아카데미 교양, 역사, 마도학 및 연금술적 학술 지식.' },
      { key: 'perception', label: '관찰력', icon: '👁️', max: 100, desc: '사소한 불일치, 비밀 틈새 및 숨은 단서를 감지하는 예리함.' },
      { key: 'social', label: '사교력', icon: '🗣️', max: 100, desc: '타인과의 대화, 교섭, 인맥 활용 및 심리 유도 능력.' },
      { key: 'stamina', label: '체력', icon: '⚡', max: 100, desc: '행동과 탐색, 긴박한 상황을 버텨내는 신체적 기력.' }
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
      let val = player.stats?.[st.key];
      if (val === undefined) {
        if (st.key === 'social') val = player.stats?.persuasion ?? 4;
        else if (st.key === 'stamina') val = 85;
        else val = 4;
      }
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

function bootApp() {
  if (window.gameApp) return;
  try {
    window.gameApp = new App();
    window.app = window.gameApp;
    window.engine = window.gameApp.engine;
    window.authorEditor = window.gameApp.authorEditor;
  } catch (err) {
    console.error('[App] 애플리케이션 초기화 실패:', err);
    // 긴급 복구: localStorage 오류일 수 있으므로 안전 조치
    try {
      const home = document.getElementById('home-view');
      if (home) home.classList.remove('hidden');
    } catch (_) {}
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}