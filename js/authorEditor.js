import { state } from './state.js?v=20261121_1900';
import { STORY_EPISODES, STORY_NODES } from './data/storyData.js?v=20261121_1900';
import { INVESTIGATION_SCENES, MAP_LOCATIONS } from './data/mapData.js?v=20261121_1900';
import {
  CODEX_CATEGORIES,
  CODEX_DATA,
  CLUE_RECIPES,
  INVENTORY_ITEMS
} from './data/codexData.js?v=20261121_1900';
import { MAP_TILES } from './isometricMap.js?v=20261121_1900';
import { EPISODE_DATA } from './data/mapData.js?v=20261121_1900';
import {
  syncLiveToEpisode,
  loadEpisodeToLive,
  createEpisodeData,
  importFromEpisode,
  getLiveEpisodeId,
  initEpisodeStore
} from './data/episodeStore.js?v=20261121_1900';

export const CODE_BUILD_ID = '20261121_1440';
const STORAGE_KEY = 'mystery_novel_author_data_v1';
const STAT_FIELDS = [
  { id: 'magic', label: '마법' },
  { id: 'knowledge', label: '지식' },
  { id: 'perception', label: '관찰력' },
  { id: 'social', label: '사교력' },
  { id: 'stamina', label: '체력' }
];
const MEMO_CATEGORIES = [
  { id: 'clue', label: '단서' },
  { id: 'character', label: '인물' },
  { id: 'magic', label: '마법' },
  { id: 'incident', label: '사건' },
  { id: 'item', label: '아이템' },
  { id: 'episode', label: '에피소드' }
];
const ITEM_CATEGORIES = [
  { id: 'artifact', label: '유물', type: 'key' },
  { id: 'clue', label: '단서', type: 'clue_item' },
  { id: 'tool', label: '도구', type: 'key' },
  { id: 'material', label: '재료', type: 'item' }
];
const BUILDING_TYPES = [
  { id: '', label: '건물 없음' },
  { id: 'main', label: '본관' },
  { id: 'annex', label: '별관' },
  { id: 'dormitory', label: '기숙사' },
  { id: 'garden', label: '정원' },
  { id: 'tower', label: '탑' },
  { id: 'dome', label: '돔' }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const nebulaHallDefaults = {
  tile: clone(MAP_TILES.find((tile) => tile.key === 'nebula-hall')),
  location: clone(MAP_LOCATIONS.find((location) => location.id === 'loc_nebula')),
  scene: clone(INVESTIGATION_SCENES.loc_nebula)
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[char]);
const field = (label, name, value, type = 'text', options = {}) => {
  const required = options.required ? ' required' : '';
  const attributes = options.attributes || '';
  if (type === 'textarea') {
    return `<label class="author-field">${escapeHtml(label)}<textarea data-author-field="${name}"${required} ${attributes}>${escapeHtml(value)}</textarea></label>`;
  }
  if (type === 'checkbox') {
    return `<label class="author-checkbox"><input type="checkbox" data-author-field="${name}" ${value ? 'checked' : ''}> ${escapeHtml(label)}</label>`;
  }
  return `<label class="author-field">${escapeHtml(label)}<input type="${type}" data-author-field="${name}" value="${escapeHtml(value)}"${required} ${attributes}></label>`;
};
const selectField = (label, name, value, options, attributes = '') => `
  <label class="author-field">${escapeHtml(label)}
    <select data-author-field="${name}" ${attributes}>
      ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
    </select>
  </label>`;
const actionButton = (label, action, className = '') => `
  <button type="button" class="author-action ${className}" data-author-action="${action}">${escapeHtml(label)}</button>`;

function dataSnapshot() {
  ensureMainBuildingData();
  syncLiveToEpisode();
  return {
    liveEpisodeId: getLiveEpisodeId(),
    episodeData: clone(EPISODE_DATA),
    version: 1,
    buildId: CODE_BUILD_ID,
    savedAt: new Date().toISOString(),
    storyEpisodes: clone(STORY_EPISODES),
    storyNodes: clone(STORY_NODES),
    mapLocations: clone(MAP_LOCATIONS),
    investigationScenes: clone(INVESTIGATION_SCENES),
    mapTiles: clone(MAP_TILES),
    codexCategories: clone(CODEX_CATEGORIES),
    codexData: clone(CODEX_DATA),
    clueRecipes: clone(CLUE_RECIPES),
    inventoryItems: clone(INVENTORY_ITEMS)
  };
}

function validateData(data) {
  if (!isRecord(data) || data.version !== 1) {
    throw new Error('지원하지 않는 JSON 형식입니다.');
  }
  const requiredArrays = ['mapLocations', 'mapTiles', 'codexCategories', 'codexData', 'inventoryItems'];
  const requiredObjects = ['storyEpisodes', 'storyNodes', 'investigationScenes', 'clueRecipes'];
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) throw new Error(`${key} 항목이 배열 형식이 아닙니다.`);
  }
  for (const key of requiredObjects) {
    if (!isRecord(data[key])) throw new Error(`${key} 항목이 객체 형식이 아닙니다.`);
  }
  if (data.mapLocations.some((item) => !item.id || !item.name) ||
      data.mapTiles.some((item) => !item.key || !Number.isFinite(Number(item.q)) || !Number.isFinite(Number(item.r))) ||
      data.codexData.some((item) => !item.id || !item.category || !item.title) ||
      data.inventoryItems.some((item) => !item.id || !item.name)) {
    throw new Error('장소, 지도 칸, 메모 또는 소지품에 필수 정보가 빠져 있습니다.');
  }
}

function replaceObject(target, source) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, source);
}

function replaceArray(target, source) {
  target.splice(0, target.length, ...source);
}

function ensureNebulaHallData() {
  // 작가의 장소 및 지도 타일 편집 내용을 덮어쓰지 않음
}

function ensureMainBuildingData() {
  // 대분류 타일(CODEX_DATA 최상위 항목)의 role이 'clue'(중분류 전용)로 잘못 저장된 경우만 'keyword'로 보정
  CODEX_DATA.forEach((entry) => {
    if (entry && entry.role === 'clue') {
      entry.role = 'keyword';
    }
  });
  // 레거시 persuasion 스탯 키를 social로 통합하여 사교력 중복 표시 방지
  Object.values(STORY_NODES).forEach((node) => {
    (node?.choices || []).forEach((ch) => {
      const rs = ch?.effects?.rewardStat;
      if (rs && rs.persuasion !== undefined) {
        if (rs.social === undefined) {
          rs.social = rs.persuasion;
        }
        delete rs.persuasion;
      }
    });
  });

  // 레거시 삭제된 도서관 핫스팟 제거 (기초 식물 도감 hotspot_1795178580065 외 과거 삭제된 핫스팟이 로컬스토리지에서 복원되는 현상 방지)
  const legacyLibraryHotspotIds = new Set([
    'hotspot_floor_crack',
    'hotspot_desk_drawer',
    'hotspot_broken_window',
    'hotspot_window_clue',
    'hotspot_bookshelf_gap',
    'hotspot_librarian'
  ]);
  if (INVESTIGATION_SCENES?.loc_library?.hotspots) {
    INVESTIGATION_SCENES.loc_library.hotspots = INVESTIGATION_SCENES.loc_library.hotspots.filter(
      hs => !legacyLibraryHotspotIds.has(hs.id)
    );
  }

  // MAP_LOCATIONS 에서 loc_library 가 isCurrent 로 남아있는 경우 보정
  if (Array.isArray(MAP_LOCATIONS)) {
    const libLoc = MAP_LOCATIONS.find(l => l.id === 'loc_library');
    if (libLoc && libLoc.isCurrent) {
      delete libLoc.isCurrent;
    }
  }
}

function syncAllItemsFromData(storyNodes, investigationScenes, inventoryItems) {
  if (!storyNodes || !inventoryItems) return;

  const processItemTagLine = (p, sourceType, sourceId, sourceTitle) => {
    const match = String(p).trim().match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
    if (!match) return;
    const parts = match[1].split('|').map((s) => s.trim());
    const rawIdOrName = parts[0] || '미확인 물품';
    const itemName = parts[0] || '소지품';
    const itemDesc = parts[1] || (sourceType === 'story' ? '본문에서 획득하는 소지품입니다.' : '현장 조사에서 획득하는 소지품입니다.');
    const itemIcon = parts[2] || '🎁';
    const itemId = rawIdOrName.startsWith('item_') ? rawIdOrName : `item_${rawIdOrName.replace(/\s+/g, '_')}`;

    let existing = inventoryItems.find((i) => i.id === itemId || i.id === rawIdOrName || i.name === itemName || i.name === rawIdOrName);
    if (!existing) {
      existing = {
        id: itemId,
        name: itemName,
        icon: itemIcon,
        category: 'clue',
        type: 'clue_item',
        desc: itemDesc,
        quantity: 1,
        source: sourceType,
        ...(sourceType === 'story'
          ? { sourceNodeId: sourceId, sourceNodeTitle: sourceTitle }
          : { sourceSceneId: sourceId, sourceSceneTitle: sourceTitle })
      };
      inventoryItems.push(existing);
    } else {
      existing.source = sourceType;
      if (sourceType === 'story') {
        existing.sourceNodeId = sourceId;
        existing.sourceNodeTitle = sourceTitle;
      } else {
        existing.sourceSceneId = sourceId;
        existing.sourceSceneTitle = sourceTitle;
      }
      if (!existing.desc || existing.desc === '소지품 설명을 입력하세요.') {
        existing.desc = itemDesc;
      }
      if (!existing.icon || existing.icon === '📦') {
        existing.icon = itemIcon;
      }
    }
  };

  // 1. Scan storyNodes for [아이템: ...] tags
  Object.entries(storyNodes).forEach(([nodeId, node]) => {
    (node.paragraphs || []).forEach((p) => {
      processItemTagLine(p, 'story', nodeId, node.title || nodeId);
    });
  });

  // 2. Scan investigationScenes for hotspot items AND inline [아이템: ...] tags
  if (investigationScenes) {
    Object.entries(investigationScenes).forEach(([sceneId, scene]) => {
      const sTitle = scene.title || sceneId;
      (scene.hotspots || []).forEach((hs) => {
        const itemObj = hs.item || hs.grantsItem;
        const itemId = hs.itemId || hs.grantsItemId || itemObj?.id;
        if (itemId) {
          let existing = inventoryItems.find((i) => i.id === itemId || (itemObj && i.name === itemObj.name));
          if (!existing && itemObj) {
            existing = {
              id: itemObj.id || itemId,
              name: itemObj.name || hs.title || itemId,
              icon: itemObj.icon || hs.icon || '🔍',
              category: hs.type === 'interactive' ? 'clue' : 'tool',
              type: itemObj.type || (hs.type === 'interactive' ? 'clue_item' : 'key'),
              desc: itemObj.desc || hs.inspectText || hs.unlockedText || '현장 조사에서 획득하는 소지품입니다.',
              quantity: itemObj.quantity || 1,
              source: 'scene',
              sourceSceneId: sceneId,
              sourceSceneTitle: sTitle
            };
            inventoryItems.push(existing);
          } else if (existing) {
            if (!existing.source || existing.source === 'inventory') {
              existing.source = 'scene';
            }
            existing.sourceSceneId ||= sceneId;
            existing.sourceSceneTitle ||= sTitle;
          }
        }

        // Scan inline text fields inside hotspots for [아이템: ...] tags
        const textsToScan = [hs.inspectText, hs.monologue];
        if (hs.dialogueTree) {
          Object.values(hs.dialogueTree).forEach((dNode) => {
            if (dNode?.text) textsToScan.push(dNode.text);
          });
        }
        if (Array.isArray(hs.pages)) {
          hs.pages.forEach((pg) => {
            if (pg?.content) textsToScan.push(pg.content);
          });
        }
        textsToScan.filter(Boolean).forEach((rawBlock) => {
          String(rawBlock).split(/\r?\n/).forEach((line) => {
            processItemTagLine(line, 'scene', sceneId, sTitle);
          });
        });
      });
    });
  }

  // 3. Mark remaining items with default inventory source
  inventoryItems.forEach((it) => {
    if (!it.source) it.source = 'inventory';
  });
}

function applyData(data) {
  validateData(data);
  replaceObject(STORY_EPISODES, data.storyEpisodes);
  replaceObject(STORY_NODES, data.storyNodes);
  replaceArray(MAP_LOCATIONS, data.mapLocations);
  replaceObject(INVESTIGATION_SCENES, data.investigationScenes);
  replaceArray(MAP_TILES, data.mapTiles);
  replaceArray(CODEX_CATEGORIES, data.codexCategories);
  replaceArray(CODEX_DATA, data.codexData);
  replaceObject(CLUE_RECIPES, data.clueRecipes);
  replaceArray(INVENTORY_ITEMS, data.inventoryItems);
  replaceObject(EPISODE_DATA, isRecord(data.episodeData) ? clone(data.episodeData) : {});
  syncAllItemsFromData(STORY_NODES, INVESTIGATION_SCENES, INVENTORY_ITEMS);
  ensureMainBuildingData();
}

export function applySavedAuthorData() {
  try {
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    if (!savedRaw) {
      ensureMainBuildingData();
      return { error: null };
    }
    const parsed = JSON.parse(savedRaw);
    // If the saved draft has no build ID or is from an older build than deployed code,
    // do not let the obsolete local snapshot overwrite the latest published codebase!
    if (!parsed.buildId || parsed.buildId < CODE_BUILD_ID) {
      console.warn(`[AuthorEditor] 로컬 저장 데이터(${parsed.buildId || 'legacy'})가 최신 배포 버전(${CODE_BUILD_ID})보다 이전입니다. 최신 코드 데이터를 우선 적용합니다.`);
      try {
        localStorage.setItem(`${STORAGE_KEY}_backup_${parsed.buildId || 'legacy'}`, savedRaw);
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      ensureMainBuildingData();
      return { error: null, upgraded: true };
    }
    applyData(parsed);
    return { error: null };
  } catch (error) {
    console.error('저장된 편집 데이터를 불러오지 못했습니다.', error);
    return { error: error.message || '저장된 편집 데이터를 읽지 못했습니다.' };
  }
}

// IndexedDB helper for FileSystemDirectoryHandle persistence
function openHandleDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MysteryNovelAuthorDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('handles');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeDirectoryHandle(handle) {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'projectDir');
    return new Promise((resolve) => tx.oncomplete = resolve);
  } catch (e) {
    console.warn('Failed to store directory handle', e);
  }
}

async function loadDirectoryHandle() {
  try {
    const db = await openHandleDB();
    const tx = db.transaction('handles', 'readonly');
    const handle = await new Promise((resolve) => {
      const req = tx.objectStore('handles').get('projectDir');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    return handle;
  } catch {
    return null;
  }
}

async function verifyPermission(fileHandle, readWrite = true) {
  if (!fileHandle) return false;
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  try {
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function writeToDirectoryHandle(dirHandle, data) {
  let jsDir;
  try {
    jsDir = await dirHandle.getDirectoryHandle('js');
  } catch {
    throw new Error('선택한 폴더 안에 "js" 폴더가 없습니다. "mystery-novel-game" 최상위 폴더를 선택해주세요.');
  }

  const dataDir = await jsDir.getDirectoryHandle('data', { create: true });

  // 1. storyData.js
  if (data.storyEpisodes && data.storyNodes) {
    const storyHandle = await dataDir.getFileHandle('storyData.js', { create: true });
    const writable = await storyHandle.createWritable();
    const content = `/**\n * Branching Story Data for the Playable Korean Scenario\n * Updated via Author Editor\n */\n\nexport const STORY_EPISODES = ${JSON.stringify(data.storyEpisodes, null, 2)};\n\nexport const STORY_NODES = ${JSON.stringify(data.storyNodes, null, 2)};\n`;
    await writable.write(content);
    await writable.close();
  }

  // 2. mapData.js
  if (data.mapLocations && data.investigationScenes) {
    const mapHandle = await dataDir.getFileHandle('mapData.js', { create: true });
    const writable = await mapHandle.createWritable();
    const content = `/**\n * Map and Investigation Scene Data\n * Updated via Author Editor\n */\n\nexport const MAP_LOCATIONS = ${JSON.stringify(data.mapLocations, null, 2)};\n\nexport const INVESTIGATION_SCENES = ${JSON.stringify(data.investigationScenes, null, 2)};\n\nexport const EPISODE_DATA = ${JSON.stringify(data.episodeData || {}, null, 2)};\n`;
    await writable.write(content);
    await writable.close();
  }

  // 3. codexData.js
  if (data.codexCategories) {
    const codexHandle = await dataDir.getFileHandle('codexData.js', { create: true });
    const writable = await codexHandle.createWritable();
    const content = `/**\n * Codex / Encyclopedia Data\n * Updated via Author Editor\n */\n\nexport const CODEX_CATEGORIES = ${JSON.stringify(data.codexCategories, null, 2)};\n\nexport const CODEX_DATA = ${JSON.stringify(data.codexData, null, 2)};\n\nexport const CLUE_RECIPES = ${JSON.stringify(data.clueRecipes, null, 2)};\n\nexport const INVENTORY_ITEMS = ${JSON.stringify(data.inventoryItems, null, 2)};\n`;
    await writable.write(content);
    await writable.close();
  }

  // 4. isometricMap.js
  if (data.mapTiles) {
    try {
      const isoHandle = await jsDir.getFileHandle('isometricMap.js', { create: false });
      const isoFile = await isoHandle.getFile();
      const isoText = await isoFile.text();
      const newTiles = `export const MAP_TILES = ${JSON.stringify(data.mapTiles, null, 2)};`;
      const newText = isoText.replace(/export const MAP_TILES\s*=\s*\[[\s\S]*?\];/, newTiles);
      if (newText !== isoText) {
        const writable = await isoHandle.createWritable();
        await writable.write(newText);
        await writable.close();
      }
    } catch (e) {
      console.warn('isometricMap.js update skipped:', e);
    }
  }
}

export class AuthorEditor {
  constructor({ onDataChanged, onTestStory, onClose, loadError = null }) {
    this.onDataChanged = onDataChanged;
    this.onClose = onClose;
    this.onTestStory = onTestStory;
    this.activeTab = 'story';
    this.selectedStoryNodeId = Object.keys(STORY_NODES)[0] || '';
    this.selectedCharacterId = CODEX_DATA.find((item) => item.category === 'character')?.id || '';
    this.selectedLocationId = MAP_LOCATIONS[0]?.id || '';
    this.selectedMemoId = CODEX_DATA.find((item) => item.category !== 'character')?.id || CODEX_DATA[0]?.id || '';
    this.selectedItemId = INVENTORY_ITEMS[0]?.id || '';
    this.selectedInvestigationSceneId = Object.keys(INVESTIGATION_SCENES)[0] || 'loc_library';
    this.selectedHotspotIndex = 0;
    this.memoViewMode = 'all'; // 'all' (한눈에 보기), 'single' (단일 상세 폼), 'recipes' (레시피)
    this.tileSearchQuery = '';
    this.tileFilterRole = 'all'; // 'all', 'topic', 'clue', 'subitem'
    this.storyViewMode = 'form'; // 'form' (기본 편집 모드) | 'graph' (연결 맵/노드 뷰)
    this.graphPan = { x: 50, y: 50 };
    this.graphZoom = 1;
    this.graphDraggingNode = null;
    this.graphPanning = null;
    this.graphConnectingWire = null;
    this.graphQuickEditNodeId = null;
    this.panel = document.getElementById('author-editor');
    this.content = document.getElementById('author-editor-content');
    this.status = document.getElementById('author-editor-status');
    this.fileInput = document.getElementById('author-import-file');
    this.toggleButton = document.getElementById('btn-author-mode');

    this.dirHandle = null;
    this.serverSyncAvailable = false;
    this.serverSaveUrl = null;
    this.syncDebounceTimer = null;
    this.persistTimer = null;
    this.storyPreviewTimer = null;
    this.lastFocusedTextarea = null;

    try {
      sessionStorage.removeItem('author_mode_unlocked');
    } catch (e) {}
    this.initPortalPasswordModal();
    this.toggleButton?.addEventListener('click', () => this.openPortalPasswordModal());
    document.getElementById('btn-home-author')?.addEventListener('click', () => this.openPortalPasswordModal());
    document.getElementById('btn-author-editor-close')?.addEventListener('click', () => this.close());
    this.panel?.addEventListener('focusin', (event) => {
      const ta = event.target?.closest?.('textarea[data-author-field]');
      if (ta) this.lastFocusedTextarea = ta;
    });
    this.panel?.addEventListener('click', (event) => {
      if (event.target === this.panel) this.close();
      this.handleClick(event);
    });
    this.panel?.addEventListener('input', (event) => this.handleField(event));
    this.panel?.addEventListener('change', (event) => this.handleField(event));
    this.fileInput?.addEventListener('change', (event) => this.importFile(event));
    this.initGraphListeners();

    if (loadError) this.setStatus(`저장된 편집 데이터를 불러오지 못했습니다: ${loadError}`, true);
    this.render();
    this.initSync();
  }

  initPortalPasswordModal() {
    this.portalModal = document.getElementById('portal-password-modal');
    this.portalForm = document.getElementById('portal-pw-form');
    this.portalInput = document.getElementById('portal-pw-input');
    this.portalError = document.getElementById('portal-pw-error');
    this.portalCancelBtn = document.getElementById('btn-portal-pw-cancel');

    if (!this.portalModal) return;

    this.portalCancelBtn?.addEventListener('click', () => {
      this.closePortalPasswordModal();
    });

    this.portalModal.querySelector('.portal-pw-backdrop')?.addEventListener('click', () => {
      this.closePortalPasswordModal();
    });

    this.portalForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = this.portalInput?.value?.trim();
      if (val === '4949') {
        this.closePortalPasswordModal();
        this.open();
      } else {
        if (this.portalError) {
          this.portalError.classList.remove('hidden');
          this.portalInput?.classList.add('is-invalid');
          this.portalInput?.select();
        }
      }
    });

    this.portalInput?.addEventListener('input', () => {
      if (this.portalError) {
        this.portalError.classList.add('hidden');
        this.portalInput?.classList.remove('is-invalid');
      }
    });

    // ESC key closes portal modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.portalModal && !this.portalModal.classList.contains('hidden')) {
        this.closePortalPasswordModal();
      }
    });
  }

  openPortalPasswordModal() {
    if (!this.portalModal) {
      this.open();
      return;
    }
    this.portalModal.classList.remove('hidden');
    if (this.portalInput) {
      this.portalInput.value = '';
      this.portalInput.classList.remove('is-invalid');
    }
    if (this.portalError) {
      this.portalError.classList.add('hidden');
    }
    setTimeout(() => {
      this.portalInput?.focus();
    }, 60);
  }

  closePortalPasswordModal() {
    if (!this.portalModal) return;
    this.portalModal.classList.add('hidden');
    if (this.portalInput) {
      this.portalInput.value = '';
      this.portalInput.classList.remove('is-invalid');
    }
    if (this.portalError) {
      this.portalError.classList.add('hidden');
    }
  }

  syncAllItems() {
    syncAllItemsFromData(STORY_NODES, INVESTIGATION_SCENES, INVENTORY_ITEMS);
  }

  syncItemToStoryAndScenes(item, oldName, oldDesc, oldIcon) {
    if (!item) return;
    let modified = false;

    // 1. Sync across all STORY_NODES
    Object.values(STORY_NODES).forEach((node) => {
      if (!Array.isArray(node.paragraphs)) return;
      node.paragraphs = node.paragraphs.map((p) => {
        const match = String(p).trim().match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
        if (match) {
          const parts = match[1].split('|').map((s) => s.trim());
          const target = parts[0];
          if (target === item.id || target === item.name || target === oldName) {
            modified = true;
            return `[아이템: ${item.name} | ${item.desc || ''} | ${item.icon || '🎁'}]`;
          }
        }
        return p;
      });
    });

    // 2. Sync across all INVESTIGATION_SCENES
    Object.values(INVESTIGATION_SCENES).forEach((scene) => {
      (scene.hotspots || []).forEach((hs) => {
        if (hs.itemId === item.id || hs.grantsItemId === item.id || hs.item?.id === item.id || hs.grantsItem?.id === item.id) {
          if (hs.item) {
            hs.item.name = item.name;
            hs.item.desc = item.desc;
            hs.item.icon = item.icon;
            modified = true;
          }
          if (hs.grantsItem) {
            hs.grantsItem.name = item.name;
            hs.grantsItem.desc = item.desc;
            hs.grantsItem.icon = item.icon;
            modified = true;
          }
        }
      });
    });

    if (modified) {
      this.persist();
      this.saveToDisk();
    }
  }

  open() {
    document.body.classList.add('author-mode');
    this.syncAllItems();
    this.panel?.classList.remove('hidden');
    this.toggleButton?.setAttribute('aria-expanded', 'true');
    this.render();
    this.initSync();
  }

  close() {
    this.flushPersist();
    document.body.classList.remove('author-mode');
    this.panel?.classList.add('hidden');
    this.toggleButton?.setAttribute('aria-expanded', 'false');
    // 편집기에서 보던 회차와 게임 진행 회차가 다를 수 있으므로 게임 회차 데이터로 복원
    this.onClose?.();
  }

  setStatus(message, isError = false) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('is-error', isError);
  }

  schedulePersist(delay = 400) {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persist();
      this.persistTimer = null;
    }, delay);
  }

  flushPersist() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persist();
  }

  scheduleStoryPreview(delay = 300) {
    if (this.storyPreviewTimer) clearTimeout(this.storyPreviewTimer);
    this.storyPreviewTimer = setTimeout(() => {
      this.updateStoryPreview();
      this.storyPreviewTimer = null;
    }, delay);
  }

  filterCharacterRoster(query) {
    const q = String(query || '').trim().toLowerCase();
    const cards = this.panel?.querySelectorAll('.author-char-card');
    cards?.forEach((card) => {
      const title = (card.dataset.charTitle || '').toLowerCase();
      const summary = (card.dataset.charSummary || '').toLowerCase();
      const match = !q || title.includes(q) || summary.includes(q);
      card.style.display = match ? 'flex' : 'none';
    });
  }

  updateCharacterLivePreview(char) {
    const nameEl = document.getElementById('author-char-preview-name');
    const summaryEl = document.getElementById('author-char-preview-summary');
    const avatarEl = document.getElementById('author-char-preview-avatar');
    if (nameEl) nameEl.textContent = char.title || '새 인물';
    if (summaryEl) summaryEl.textContent = char.summary || '역할/소개 미정';
    if (avatarEl) {
      const src = (char.icon && char.icon.includes('/')) ? char.icon : (char.image && char.image.includes('/') ? char.image : null);
      if (src) {
        avatarEl.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(char.title)}" style="width:100%; height:100%; object-fit:contain;">`;
      } else {
        avatarEl.textContent = char.icon || '👤';
      }
    }
    // Also update the card in the roster live
    const activeCard = this.panel?.querySelector(`.author-char-card[data-author-action="select-character:${char.id}"]`);
    if (activeCard) {
      activeCard.dataset.charTitle = char.title || '';
      activeCard.dataset.charSummary = char.summary || '';
      const cardName = activeCard.querySelector('.char-card-name');
      const cardRole = activeCard.querySelector('.char-card-role');
      const cardAvatar = activeCard.querySelector('.char-card-avatar');
      if (cardName) cardName.textContent = char.title || '새 인물';
      if (cardRole) cardRole.textContent = char.summary || '역할/소개 미정';
      if (cardAvatar) {
        const src = (char.icon && char.icon.includes('/')) ? char.icon : (char.image && char.image.includes('/') ? char.image : null);
        if (src) {
          cardAvatar.innerHTML = `<img src="${escapeHtml(src)}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
          cardAvatar.innerHTML = `<span style="font-size:24px;">${escapeHtml(char.icon || '👤')}</span>`;
        }
      }
    }
  }

  filterItemRoster(query) {
    const q = String(query || '').trim().toLowerCase();
    const cards = this.panel?.querySelectorAll('.author-item-card');
    cards?.forEach((card) => {
      const title = (card.dataset.itemTitle || '').toLowerCase();
      const desc = (card.dataset.itemDesc || '').toLowerCase();
      const source = (card.dataset.itemSource || '').toLowerCase();
      const match = !q || title.includes(q) || desc.includes(q) || source.includes(q);
      card.style.display = match ? 'flex' : 'none';
    });
  }

  updateItemLivePreview(item) {
    if (!item) return;
    const nameEl = document.getElementById('author-item-preview-name');
    const descEl = document.getElementById('author-item-preview-desc');
    const iconEl = document.getElementById('author-item-preview-icon');
    const catEl = document.getElementById('author-item-preview-category');

    if (nameEl) nameEl.textContent = item.name || '새 소지품';
    if (descEl) descEl.textContent = item.desc || '소지품 설명';
    if (iconEl) {
      if (item.icon && item.icon.includes('/')) {
        iconEl.innerHTML = `<img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name || '')}" style="width:100%; height:100%; object-fit:contain;">`;
      } else {
        iconEl.textContent = item.icon || '📦';
      }
    }
    if (catEl) {
      const catLabel = ITEM_CATEGORIES.find((c) => c.id === item.category)?.label || item.category || '기타';
      catEl.textContent = catLabel;
    }

    // Also update the card in the roster live
    const activeCard = this.panel?.querySelector(`.author-item-card[data-author-action="select-item:${CSS.escape(item.id)}"]`);
    if (activeCard) {
      activeCard.dataset.itemTitle = item.name || '';
      activeCard.dataset.itemDesc = item.desc || '';
      const cardName = activeCard.querySelector('.item-card-name');
      const cardDesc = activeCard.querySelector('.item-card-desc');
      const cardIcon = activeCard.querySelector('.item-card-icon');
      if (cardName) cardName.textContent = item.name || '새 소지품';
      if (cardDesc) cardDesc.textContent = item.desc || '설명 없음';
      if (cardIcon) {
        if (item.icon && item.icon.includes('/')) {
          cardIcon.innerHTML = `<img src="${escapeHtml(item.icon)}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
          cardIcon.innerHTML = `<span style="font-size:24px;">${escapeHtml(item.icon || '📦')}</span>`;
        }
      }
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataSnapshot()));
      this.onDataChanged?.();
      this.setStatus('내용이 수정되었습니다. 실제 파일에 자동 저장 중...');
      this.scheduleAutoDiskSave();
    } catch (error) {
      console.error('편집 데이터를 저장하지 못했습니다.', error);
      this.setStatus(`임시 저장 오류: ${error.message || '브라우저 저장 공간을 확인해 주세요.'}`, true);
    }
  }

  scheduleAutoDiskSave(delay = 600) {
    if (this.autoDiskSaveTimer) clearTimeout(this.autoDiskSaveTimer);
    this.autoDiskSaveTimer = setTimeout(() => {
      this.autoDiskSaveTimer = null;
      this.saveToDisk(false);
    }, delay);
  }

  async getServerSaveUrl() {
    // 1. Try same origin first
    try {
      const res = await fetch('/api/save');
      if (res.ok) return '/api/save';
    } catch {}

    // 2. Try localhost:8080 dev-server (supports CORS from VS Code Live Server / Live Preview!)
    try {
      const res = await fetch('http://localhost:8080/api/save');
      if (res.ok) return 'http://localhost:8080/api/save';
    } catch {}

    return null;
  }

  async initSync() {
    // 1. Check if dev-server save API is available (same-origin or port 8080)
    const saveUrl = await this.getServerSaveUrl();
    if (saveUrl) {
      this.serverSaveUrl = saveUrl;
      this.serverSyncAvailable = true;
      this.updateSyncUI('server', saveUrl.includes('8080') ? '포트 8080 연동' : '');
      return;
    }
    this.serverSyncAvailable = false;
    this.serverSaveUrl = null;

    // 2. Check stored directory handle
    try {
      const storedHandle = await loadDirectoryHandle();
      if (storedHandle) {
        const hasPerm = await verifyPermission(storedHandle, true);
        if (hasPerm) {
          this.dirHandle = storedHandle;
          this.updateSyncUI('folder', storedHandle.name);
          return;
        }
      }
    } catch (e) {
      console.warn('initSync error', e);
    }

    this.updateSyncUI('local');
  }

  updateSyncUI(mode, folderName = '') {
    const badge = document.getElementById('author-sync-status-badge');
    const desc = document.getElementById('author-sync-desc');
    if (!badge || !desc) return;

    if (mode === 'server') {
      badge.className = 'author-sync-badge sync-active';
      badge.textContent = '🟢 개발 서버 연동 준비 완료';
      desc.textContent = '수정 후 [💾 코드 파일에 저장]을 누르면 실제 파일(storyData.js 등)에 저장됩니다.';
    } else if (mode === 'folder') {
      badge.className = 'author-sync-badge sync-active';
      badge.textContent = `🟢 폴더 연동됨 (${folderName || '프로젝트'})`;
      desc.textContent = '수정 후 [💾 코드 파일에 저장]을 누르면 실제 파일에 덮어쓰기 저장됩니다.';
    } else {
      badge.className = 'author-sync-badge sync-local';
      badge.textContent = '🟡 브라우저 임시 저장';
      desc.textContent = '실제 VS Code 파일에 바로 저장하려면 [프로젝트 폴더 연결]을 클릭하세요.';
    }
  }

  async connectProjectFolder() {
    if (!window.showDirectoryPicker) {
      alert('현재 브라우저에서는 파일 시스템 직접 연결(File System Access API)을 지원하지 않습니다.\n크롬(Chrome) 또는 엣지(Edge) 브라우저를 사용하시거나,\n터미널에서 "python3 dev-server.py"를 실행해주세요!');
      return;
    }

    try {
      this.setStatus('프로젝트 폴더를 선택해주세요...');
      const handle = await window.showDirectoryPicker({
        id: 'mystery-novel-game-folder',
        mode: 'readwrite',
        startIn: 'desktop'
      });

      // Verify it has 'js' folder
      let jsDir;
      try {
        jsDir = await handle.getDirectoryHandle('js');
      } catch {
        throw new Error('선택한 폴더 안에 "js" 폴더가 없습니다. "mystery-novel-game" 최상위 폴더를 선택해주세요.');
      }

      this.dirHandle = handle;
      await storeDirectoryHandle(handle);
      this.updateSyncUI('folder', handle.name);

      await this.saveToDisk(true);
      this.setStatus(`🎉 "${handle.name}" 폴더가 연결되었습니다! 이제 편집할 때마다 실제 파일에 바로 저장됩니다.`);
    } catch (error) {
      if (error.name === 'AbortError') {
        this.setStatus('폴더 선택이 취소되었습니다.');
        return;
      }
      console.error('폴더 연결 실패:', error);
      this.setStatus(`폴더 연결 실패: ${error.message}`, true);
    }
  }

  async saveToDisk(manual = false, customMsg = '') {
    const snapshot = dataSnapshot();

    // 1. Try server API if available (same-origin or port 8080)
    const saveUrl = this.serverSaveUrl || await this.getServerSaveUrl();
    if (saveUrl) {
      try {
        const res = await fetch(saveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot)
        });
        if (res.ok) {
          this.serverSyncAvailable = true;
          this.serverSaveUrl = saveUrl;
          this.updateSyncUI('server', saveUrl.includes('8080') ? '포트 8080 연동' : '');
          const timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false });
          this.setStatus(customMsg ? `${customMsg} (${timeStr} 파일 저장됨)` : `✅ 실제 코드 파일(storyData.js 등)에 실시간 저장되었습니다! (${timeStr})`);
          return true;
        }
      } catch (err) {
        console.warn('Server save failed, falling back to local folder...', err);
      }
    }

    // 2. Try File System Access API
    if (this.dirHandle) {
      try {
        const hasPerm = await verifyPermission(this.dirHandle, true);
        if (hasPerm) {
          await writeToDirectoryHandle(this.dirHandle, snapshot);
          this.updateSyncUI('folder', this.dirHandle.name);
          const timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false });
          this.setStatus(customMsg ? `${customMsg} (${timeStr} 파일 저장됨)` : `✅ 실제 코드 파일(storyData.js 등)에 실시간 저장되었습니다! (${timeStr})`);
          return true;
        }
      } catch (err) {
        console.error('디렉터리 파일 쓰기 실패:', err);
        if (manual) this.setStatus(`실제 파일 저장 실패: ${err.message}`, true);
      }
    }

    // 3. Neither connected
    if (manual) {
      const shouldConnect = confirm('실제 코드 파일(VS Code)에 바로 저장하려면 먼저 프로젝트 폴더(mystery-novel-game)를 연결해야 합니다.\n지금 폴더를 선택하시겠습니까?');
      if (shouldConnect) {
        await this.connectProjectFolder();
      }
    } else {
      this.setStatus('브라우저 임시 저장됨 (실제 코드에 반영하려면 상단 [폴더 연결]을 눌러주세요)');
    }
    return false;
  }

  render() {
    if (!this.content) return;
    const renderers = {
      story: () => this.renderStory(),
      character: () => this.renderCharacter(),
      investigation: () => this.renderInvestigation(),
      map: () => this.renderMap(),
      memo: () => this.renderMemo(),
      inventory: () => this.renderInventory()
    };
    this.content.innerHTML = this.renderEpisodeBar() + renderers[this.activeTab]();
    this.panel?.querySelectorAll('[data-author-tab]').forEach((tab) => {
      const active = tab.dataset.authorTab === this.activeTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
  }

  renderEpisodeBar() {
    const ids = Object.keys(STORY_EPISODES);
    const current = getLiveEpisodeId() || ids[0];
    const currentIndex = ids.indexOf(current);
    const label = (id, index) => `제${index + 1}화. ${STORY_EPISODES[id].title || id}`;
    const options = ids.map((id, index) => `<option value="${escapeHtml(id)}" ${id === current ? 'selected' : ''}>${escapeHtml(label(id, index))}</option>`).join('');
    
    // 가져올 원본 회차 목록 (기본값: 바로 직전 회차)
    const sources = ids.filter((id) => id !== current);
    const defaultSource = currentIndex > 0 ? ids[currentIndex - 1] : (sources[0] || '');
    const sourceOptions = sources.map((id) => {
      const idx = ids.indexOf(id);
      return `<option value="${escapeHtml(id)}" ${id === defaultSource ? 'selected' : ''}>${escapeHtml(label(id, idx))}</option>`;
    }).join('');

    const importSection = sources.length ? `
      <div class="author-episode-import-box">
        <label class="author-import-label">
          <span>📋 복사할 원본 회차:</span>
          <select data-import-source aria-label="가져올 원본 회차 선택">${sourceOptions}</select>
        </label>
        ${actionButton('📥 이전 회차 타일·배치 가져오기', 'import-from-episode', 'is-primary')}
        <span class="author-episode-hint">선택한 회차의 지도 타일, 구역 상태, 조사 장면, 인물 배치를 깊은 복사(Deep Copy)로 가져옵니다. 원본 회차는 안전하게 유지됩니다.</span>
      </div>` : '';

    return `
      <div class="author-episode-bar">
        <div class="author-episode-nav-row">
          <label class="author-episode-label">📚 현재 편집 회차:
            <select data-author-field="editorEpisodeSelect" aria-label="편집할 회차 선택">${options}</select>
          </label>
          <div class="author-episode-order-buttons">
            ${actionButton('위로 이동(▲)', 'move-episode-up')}
            ${actionButton('아래로 이동(▼)', 'move-episode-down')}
            ${actionButton('+ 새 회차 추가', 'add-episode', 'is-primary')}
            ${ids.length > 1 ? actionButton('회차 삭제(🗑️)', 'delete-episode', 'is-danger') : ''}
          </div>
        </div>
        <div class="author-episode-desc-row">
          <span class="author-episode-hint">선택한 회차의 본문 · 선택지 · 지도 · 조사 지점 · 인물 설정만 독립적으로 수정됩니다. 새 회차 추가 시 직전 회차의 타일과 배치를 깊은 복사하여 시작합니다.</span>
        </div>
        ${importSection}
      </div>`;
  }

  moveEpisode(delta) {
    const ids = Object.keys(STORY_EPISODES);
    const id = getLiveEpisodeId() || ids[0];
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) {
      this.setStatus('더 이상 순서를 변경할 수 없습니다.', true);
      return;
    }
    // 회차 순서 교환
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const reordered = {};
    ids.forEach((key) => { reordered[key] = STORY_EPISODES[key]; });
    replaceObject(STORY_EPISODES, reordered);
    this.persist();
    this.render();
    this.setStatus(`회차 순서가 변경되었습니다: [${STORY_EPISODES[id]?.title || id}] → ${to + 1}번째`);
    this.saveToDisk();
  }

  deleteEpisode() {
    const ids = Object.keys(STORY_EPISODES);
    if (ids.length <= 1) {
      this.setStatus('마지막 남은 회차는 삭제할 수 없습니다.', true);
      return;
    }
    const currentId = getLiveEpisodeId() || ids[0];
    const episodeTitle = STORY_EPISODES[currentId]?.title || currentId;

    if (!confirm(`정말로 [${episodeTitle}] 회차를 삭제하시겠습니까?\n이 회차에 속한 모든 장면과 설정 데이터가 함께 삭제됩니다.`)) {
      return;
    }

    // 1. 해당 회차 메타 삭제
    delete STORY_EPISODES[currentId];

    // 2. 해당 회차에 속한 스토리 노드 삭제
    Object.keys(STORY_NODES).forEach((nodeId) => {
      if (STORY_NODES[nodeId].episodeId === currentId) {
        delete STORY_NODES[nodeId];
      }
    });

    // 3. 회차별 보관 슬롯 삭제
    delete EPISODE_DATA[currentId];

    // 4. 남아있는 첫 번째 회차로 전환
    const remaining = Object.keys(STORY_EPISODES);
    const nextEpId = remaining[0];
    this.switchEpisode(nextEpId);

    // 5. 저장 및 UI 갱신
    this.persist();
    this.render();
    this.setStatus(`[${episodeTitle}] 회차가 삭제되었습니다. [${STORY_EPISODES[nextEpId]?.title || nextEpId}] 회차로 전환되었습니다.`);
    this.saveToDisk();
  }

  importEpisodeParts() {
    const sourceSelect = this.panel?.querySelector('[data-import-source]');
    const sourceId = sourceSelect?.value;
    if (!sourceId) {
      this.setStatus('가져올 원본 회차를 선택해 주세요.', true);
      return;
    }
    const currentId = getLiveEpisodeId();
    if (sourceId === currentId) {
      this.setStatus('현재 편집 중인 회차와 동일한 회차입니다.', true);
      return;
    }
    const sourceTitle = STORY_EPISODES[sourceId]?.title || sourceId;
    const currentTitle = STORY_EPISODES[currentId]?.title || currentId;
    
    if (!confirm(`[${sourceTitle}]의 지도 타일, 구역 상태, 조사 장면, 인물 배치 데이터를 [${currentTitle}]로 복사해옵니다.\n\n(모든 데이터는 독립된 Deep Copy로 복제되므로 이후 수정해도 [${sourceTitle}] 원본은 절대 변경되지 않습니다)\n\n계속하시겠습니까?`)) {
      return;
    }

    const result = importFromEpisode(sourceId);
    this.selectedCharacterId = CODEX_DATA.find((item) => item.category === 'character')?.id || '';
    this.selectedLocationId = MAP_LOCATIONS[0]?.id || '';
    this.selectedInvestigationSceneId = Object.keys(INVESTIGATION_SCENES)[0] || '';
    this.selectedHotspotIndex = 0;
    this.persist();
    this.render();
    this.setStatus(`[${sourceTitle}]의 타일 및 배치 데이터를 성공적으로 가져왔습니다 (타일 ${result.tiles}개, 장소 ${result.locations}개, 조사장면 ${result.scenes}개, 인물 ${result.characters}명).`);
    this.saveToDisk();
  }

  switchEpisode(episodeId) {
    if (!STORY_EPISODES[episodeId]) return;
    syncLiveToEpisode();
    loadEpisodeToLive(episodeId);
    const episode = STORY_EPISODES[episodeId];
    const nodes = Object.values(STORY_NODES).filter((node) => node.episodeId === episodeId);
    this.selectedStoryNodeId = (nodes.find((node) => node.id === episode.startNode) || nodes[0])?.id || this.selectedStoryNodeId;
    this.selectedCharacterId = CODEX_DATA.find((item) => item.category === 'character')?.id || '';
    this.selectedLocationId = MAP_LOCATIONS[0]?.id || '';
    this.selectedInvestigationSceneId = Object.keys(INVESTIGATION_SCENES)[0] || '';
    this.selectedHotspotIndex = 0;
    this.render();
    this.setStatus(`[${episode.title || episodeId}] 편집 중 — 이 회차의 데이터만 수정됩니다.`);
    this.schedulePersist();
  }

  addEpisode() {
    syncLiveToEpisode();
    const ids = Object.keys(STORY_EPISODES);
    const previousEpisodeId = ids[ids.length - 1];
    let n = ids.length + 1;
    let id = `ep${n}`;
    while (STORY_EPISODES[id]) {
      n += 1;
      id = `ep${n}`;
    }
    const nodeId = `${id}_start_${Date.now()}`;
    STORY_EPISODES[id] = {
      id,
      title: `제${n}화. 새 회차`,
      chapter: '제1장',
      startNode: nodeId,
      hubNode: nodeId
    };
    STORY_NODES[nodeId] = {
      id: nodeId,
      episodeId: id,
      title: '새 회차 시작',
      chapter: '제1장',
      locationName: '장소 이름',
      summary: '이 회차의 첫 장면 요약을 입력하세요.',
      paragraphs: ['새 회차의 본문을 입력하세요.'],
      choices: []
    };
    // 마지막(직전) 회차의 타일 · 장소 · 조사 · 인물을 복사하여 독립된 새 객체로 생성
    createEpisodeData(id, previousEpisodeId);
    this.switchEpisode(id);
    this.persist();
    this.render();
    this.saveToDisk();
  }

  handleClick(event) {
    const tab = event.target.closest('[data-author-tab]');
    if (tab) {
      this.activeTab = tab.dataset.authorTab;
      this.render();
      return;
    }

    const storyNodeButton = event.target.closest('[data-story-node]');
    if (storyNodeButton) {
      this.selectedStoryNodeId = storyNodeButton.dataset.storyNode;
      this.render();
      return;
    }

    const stage = event.target.closest('.author-investigation-stage');
    if (stage && !event.target.closest('.author-stage-pin')) {
      const sceneId = this.selectedInvestigationSceneId || this.selectedLocationId;
      const scene = INVESTIGATION_SCENES[sceneId];
      const activeHotspot = scene?.hotspots?.[this.selectedHotspotIndex];
      if (activeHotspot) {
        const rect = stage.getBoundingClientRect();
        const x = Math.max(5, Math.min(95, Math.round(((event.clientX - rect.left) / rect.width) * 100)));
        const y = Math.max(5, Math.min(95, Math.round(((event.clientY - rect.top) / rect.height) * 100)));
        activeHotspot.coords = { x, y };
        this.persist();
        this.render();
        this.setStatus(`[${activeHotspot.title}] 위치를 (${x}%, ${y}%)로 변경했습니다.`);
        return;
      }
    }

    const button = event.target.closest('[data-author-action]');
    if (!button) return;
    const action = button.dataset.authorAction;
    if (action === 'close') this.close();
    else if (action === 'open-toc') {
      window.gameApp?.openStoryToc?.();
    }
    else if (action === 'connect-folder') this.connectProjectFolder();
    else if (action === 'save-disk') this.saveToDisk(true);
    else if (action === 'reset-cache') {
      if (confirm('브라우저에 임시 저장된 편집 데이터를 초기화하고 최신 코드 파일 데이터로 새로고침하시겠습니까?')) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    }
    else if (action === 'export') this.exportData();
    else if (action === 'import') this.fileInput?.click();
    else if (action === 'add-episode') this.addEpisode();
    else if (action === 'delete-episode') this.deleteEpisode();
    else if (action === 'move-episode-up') this.moveEpisode(-1);
    else if (action === 'move-episode-down') this.moveEpisode(1);
    else if (action === 'import-from-episode') this.importEpisodeParts();
    else if (action === 'add-story-node') this.addStoryNode();
    else if (action === 'delete-story-node') this.deleteStoryNode();
    else if (action === 'test-story-node') {
      const nodeId = this.selectedStoryNodeId;
      this.close();
      this.onTestStory?.(nodeId);
    }
    else if (action === 'add-choice') this.addChoice();
    else if (action === 'add-imported-choice') this.addImportedChoice();
    else if (action.startsWith('delete-choice:')) this.deleteChoice(Number(action.split(':')[1]));
    else if (action.startsWith('set-story-view-mode:')) {
      this.storyViewMode = action.split(':')[1];
      this.render();
    }
    else if (action === 'auto-layout-story-graph') {
      this.autoLayoutNodes(true);
    }
    else if (action === 'zoom-in-graph') {
      this.graphZoom = Math.min(2.0, Number((this.graphZoom * 1.15).toFixed(2)));
      this.updateGraphTransform();
    }
    else if (action === 'zoom-out-graph') {
      this.graphZoom = Math.max(0.35, Number((this.graphZoom / 1.15).toFixed(2)));
      this.updateGraphTransform();
    }
    else if (action === 'zoom-reset-graph') {
      this.graphZoom = 1.0;
      this.graphPan = { x: 50, y: 50 };
      this.updateGraphTransform();
    }
    else if (action.startsWith('select-graph-node:')) {
      const nid = action.split(':')[1];
      this.selectedStoryNodeId = nid;
      this.graphQuickEditNodeId = nid;
      this.render();
    }
    else if (action === 'close-quick-edit') {
      this.graphQuickEditNodeId = null;
      this.render();
    }
    else if (action.startsWith('open-full-editor:')) {
      const nid = action.split(':')[1];
      this.selectedStoryNodeId = nid;
      this.storyViewMode = 'form';
      this.render();
    }
    else if (action.startsWith('add-choice-to-node:')) {
      const nid = action.split(':')[1];
      const targetNode = STORY_NODES[nid];
      if (targetNode) {
        if (!targetNode.choices) targetNode.choices = [];
        targetNode.choices.push({
          text: '새로운 선택지',
          nextNode: '',
          hideIfChosen: false
        });
        this.persist();
        this.render();
      }
    }
    else if (action.startsWith('delete-quick-choice:')) {
      const parts = action.split(':');
      const nid = parts[1];
      const cIdx = Number(parts[2]);
      const targetNode = STORY_NODES[nid];
      if (targetNode && targetNode.choices && targetNode.choices[cIdx]) {
        targetNode.choices.splice(cIdx, 1);
        this.persist();
        this.render();
      }
    }
    else if (action.startsWith('click-graph-link:')) {
      this.handleGraphLinkClick(action);
    }
    else if (action === 'add-location') this.addLocation();
    else if (action.startsWith('select-hotspot:')) {
      this.selectedHotspotIndex = Number(action.split(':')[1]);
      this.render();
    }
    else if (action === 'add-hotspot' || action === 'add-hotspot:inspect') this.addHotspot('inspect');
    else if (action === 'add-hotspot:character') {
      const select = this.content?.querySelector('[data-author-field="existingCharacterSelect"]');
      const selectedCharId = select?.value || '';
      this.addHotspot('character', selectedCharId);
    }
    else if (action.startsWith('add-hotspot:character:')) {
      const selectedCharId = action.split(':')[2] || '';
      this.addHotspot('character', selectedCharId);
    }
    else if (action === 'add-hotspot:book') this.addHotspot('book');
    else if (action === 'add-hotspot:item') this.addHotspot('item');
    else if (action.startsWith('delete-hotspot:')) {
      const parts = action.split(':');
      if (parts.length >= 3) this.deleteHotspot(Number(parts[2]), parts[1]);
      else this.deleteHotspot(Number(parts[1]));
    }
    else if (action.startsWith('add-dialogue-option:')) {
      const parts = action.split(':');
      if (parts.length >= 3) this.addDialogueOption(Number(parts[2]), parts[1]);
      else this.addDialogueOption(Number(parts[1]));
    }
    else if (action.startsWith('delete-dialogue-option:')) {
      const parts = action.split(':');
      if (parts.length >= 4) {
        this.deleteDialogueOption(Number(parts[2]), parts[3], parts[1]);
      } else {
        this.deleteDialogueOption(Number(parts[1]), parts[2]);
      }
    }
    else if (action.startsWith('add-book-page:')) this.addBookPage(Number(action.split(':')[1]));
    else if (action.startsWith('delete-book-page:')) {
      const parts = action.split(':');
      this.deleteBookPage(Number(parts[1]), Number(parts[2]));
    }
    else if (action.startsWith('insert-book-tag:')) {
      const parts = action.split(':');
      this.insertBookTag(Number(parts[1]), Number(parts[2]), parts[3]);
    }
    else if (action === 'add-investigation-scene') this.addInvestigationScene();
    else if (action === 'delete-investigation-scene') this.deleteInvestigationScene();
    else if (action.startsWith('set-memo-view-mode:')) {
      this.memoViewMode = action.split(':')[1];
      this.render();
    }
    else if (action === 'clear-tile-search') {
      this.tileSearchQuery = '';
      this.render();
    }
    else if (action === 'add-memo-topic') {
      this.addMemoTopic();
    }
    else if (action.startsWith('add-subclue-to-parent:')) {
      this.addSubClueToParent(action.slice('add-subclue-to-parent:'.length));
    }
    else if (action.startsWith('add-subitem-to-parent:')) {
      this.addSubItemToParent(action.slice('add-subitem-to-parent:'.length));
    }
    else if (action.startsWith('delete-memo-tile:')) {
      this.deleteMemoTile(action.slice('delete-memo-tile:'.length));
    }
    else if (action.startsWith('delete-subclue-direct:')) {
      const parts = action.split(':');
      this.deleteSubClueDirect(parts[1], Number(parts[2]));
    }
    else if (action.startsWith('delete-subitem-direct:')) {
      const parts = action.split(':');
      this.deleteSubItemDirect(parts[1], Number(parts[2]));
    }
    else if (action.startsWith('promote-subitem:')) {
      const parts = action.split(':');
      this.promoteSubItem(parts[1], Number(parts[2]));
    }
    else if (action.startsWith('select-memo-to-edit:')) {
      const topicId = action.slice('select-memo-to-edit:'.length);
      this.selectedMemoId = topicId;
      this.memoViewMode = 'single';
      this.render();
    }
    else if (action === 'add-memo') this.addMemo();
    else if (action === 'delete-memo') this.deleteMemo();
    else if (action === 'add-recipe') this.addRecipe();
    else if (action.startsWith('delete-recipe:')) this.deleteRecipe(decodeURIComponent(action.slice('delete-recipe:'.length)));
    else if (action === 'add-subitem') this.addSubItem();
    else if (action.startsWith('delete-subitem:')) this.deleteSubItem(Number(action.split(':')[1]));
    else if (action.startsWith('add-subitem-record:')) {
      const parts = action.split(':');
      this.addSubItemRecord(Number(parts[1]), parts[2]);
    }
    else if (action.startsWith('delete-subitem-record:')) {
      const parts = action.split(':');
      this.deleteSubItemRecord(Number(parts[1]), Number(parts[2]), parts[3]);
    }
    else if (action === 'add-subclue') this.addSubClue();
    else if (action.startsWith('delete-subclue:')) this.deleteSubClue(Number(action.split(':')[1]));
    else if (action === 'add-character') this.addCharacter();
    else if (action === 'delete-character') this.deleteCharacter();
    else if (action.startsWith('delete-character-id:')) {
      const charId = action.split(':')[1];
      this.deleteCharacter(charId);
    }
    else if (action.startsWith('select-character:')) {
      const charId = action.split(':')[1];
      this.selectedCharacterId = charId;
      this.render();
    }
    else if (action.startsWith('copy-character-tag:')) {
      const charId = action.split(':')[1];
      const char = CODEX_DATA.find((c) => c.category === 'character' && c.id === charId);
      if (char) {
        const tag = `[인물: ${char.title} | ${char.summary || '인물 소개'} | ${char.icon || '👤'}]`;
        navigator.clipboard?.writeText(tag);
        this.setStatus(`[${char.title}] 태그가 클립보드에 복사되었습니다.`);
      }
    }
    else if (action.startsWith('insert-char-into-story:')) {
      const charId = action.split(':')[1];
      const char = CODEX_DATA.find((c) => c.category === 'character' && c.id === charId);
      if (char) {
        this.insertCharacterTag(char);
        this.setStatus(`[${char.title}] 인물이 현재 장면 본문에 추가되었습니다.`);
      }
    }
    else if (action === 'goto-character-tab') {
      this.activeTab = 'character';
      this.render();
    }
    else if (action === 'add-selected-character-to-story') {
      const select = this.content?.querySelector('[data-author-action="quick-character-select"]');
      const charId = select ? select.value : '';
      const char = (charId && CODEX_DATA.find((c) => c.category === 'character' && c.id === charId)) ||
                   CODEX_DATA.find((c) => c.category === 'character' && c.id === this.selectedCharacterId) ||
                   CODEX_DATA.find((c) => c.category === 'character');
      if (char) {
        this.insertCharacterTag(char);
      } else {
        alert('추가할 인물을 선택해주세요.');
      }
    }
    else if (action.startsWith('remove-character-from-story:')) {
      const lineIdx = Number(action.split(':')[1]);
      this.removeStoryParagraph(lineIdx);
    }
    else if (action.startsWith('select-item:')) {
      const itemId = action.split(':')[1];
      this.selectedItemId = itemId;
      this.activeTab = 'inventory';
      this.render();
    }
    else if (action.startsWith('copy-item-tag:')) {
      const itemId = action.split(':')[1];
      const it = INVENTORY_ITEMS.find((i) => i.id === itemId);
      if (it) {
        const tag = `[아이템: ${it.name} | ${it.desc || '소지품 획득'} | ${it.icon || '📦'}]`;
        navigator.clipboard?.writeText(tag);
        this.setStatus(`[${it.name}] 태그가 클립보드에 복사되었습니다.`);
      }
    }
    else if (action.startsWith('insert-item-into-story:')) {
      const itemId = action.split(':')[1];
      const it = INVENTORY_ITEMS.find((i) => i.id === itemId);
      if (it) {
        this.insertItemTag(it);
      }
    }
    else if (action.startsWith('delete-item-id:')) {
      const itemId = action.split(':')[1];
      this.deleteItem(itemId);
    }
    else if (action.startsWith('goto-story-node:')) {
      const nodeId = action.split(':')[1];
      if (STORY_NODES[nodeId]) {
        this.selectedStoryNodeId = nodeId;
        this.activeTab = 'story';
        this.render();
      }
    }
    else if (action.startsWith('goto-scene:')) {
      const sceneId = action.split(':')[1];
      if (INVESTIGATION_SCENES[sceneId] || MAP_LOCATIONS.some((loc) => loc.id === sceneId)) {
        this.selectedLocationId = sceneId;
        this.activeTab = 'map';
        this.render();
      }
    }
    else if (action === 'goto-inventory-tab') {
      this.activeTab = 'inventory';
      this.render();
    }
    else if (action === 'add-selected-item-to-story') {
      const select = this.content?.querySelector('[data-author-action="quick-item-select"]');
      const itemId = select ? select.value : '';
      const it = INVENTORY_ITEMS.find((i) => i.id === itemId);
      if (it) {
        this.insertItemTag(it);
      } else {
        alert('추가할 소지품을 목록에서 선택해주세요.');
      }
    }
    else if (action.startsWith('remove-item-from-story:')) {
      const lineIdx = Number(action.split(':')[1]);
      this.removeStoryParagraph(lineIdx);
    }
    else if (action === 'add-item') this.addItem();
    else if (action === 'delete-item') this.deleteItem();
    else if (action.startsWith('insert-tag:')) this.insertStoryTag(action.split(':')[1], button);
    else if (action.startsWith('insert-style:')) this.insertStoryStyle(action.split(':')[1], button);
  }

  resolveTargetTextarea(triggerBtn = null) {
    if (triggerBtn) {
      const toolbarWrap = triggerBtn.closest('[data-toolbar-target]');
      if (toolbarWrap) {
        const targetField = toolbarWrap.dataset.toolbarTarget;
        const targetIndex = toolbarWrap.dataset.toolbarHotspotIndex;
        if (targetField) {
          let selector = `textarea[data-author-field="${CSS.escape(targetField)}"]`;
          if (targetIndex !== undefined && targetIndex !== '') {
            selector += `[data-hotspot-index="${CSS.escape(targetIndex)}"]`;
          }
          const found = this.content?.querySelector(selector) ||
                        this.content?.querySelector(`textarea[data-author-field="${CSS.escape(targetField)}"]`);
          if (found) return found;
        }
      }
      const parentBox = triggerBtn.closest('.author-universal-text-editor, .author-story-body-editor');
      const siblingTa = parentBox?.querySelector('textarea[data-author-field]');
      if (siblingTa) return siblingTa;
    }
    if (this.lastFocusedTextarea && this.content?.contains(this.lastFocusedTextarea)) {
      return this.lastFocusedTextarea;
    }
    return this.content?.querySelector('textarea[data-author-field="storyParagraphs"]') ||
           this.content?.querySelector('textarea[data-author-field]');
  }

  renderUniversalTextToolbar(targetFieldName, { hotspotIndex = '', compact = false } = {}) {
    const editorEpisodeId = getLiveEpisodeId();
    const episodeNodes = Object.values(STORY_NODES).filter((entry) => !editorEpisodeId || entry.episodeId === editorEpisodeId);
    const clueTopics = CODEX_DATA.filter((item) => item.category === 'clue' || item.subItems || item.subClues);
    const activeTopicTitle = this.selectedSubItemTopic || clueTopics[0]?.title || '';
    const activeTopic = clueTopics.find((t) => t.title === activeTopicTitle) || clueTopics[0];
    const allTileRecords = this.getAllTileRecords();
    this.cachedStoryRecords = allTileRecords;
    const allCharacters = CODEX_DATA.filter((item) => item.category === 'character');
    const allSubClues = [];
    clueTopics.forEach((topic) => {
      (topic.subClues || []).forEach((sc) => {
        allSubClues.push({
          topicTitle: topic.title,
          label: sc.label || sc.title || '단서 조건',
          desc: sc.desc || sc.description || ''
        });
      });
    });

    const hsAttr = hotspotIndex !== '' && hotspotIndex !== undefined && hotspotIndex !== null
      ? ` data-toolbar-hotspot-index="${escapeHtml(hotspotIndex)}"`
      : '';

    return `
      <div class="author-universal-toolbar-wrap" data-toolbar-target="${escapeHtml(targetFieldName)}"${hsAttr} style="margin-bottom: 6px; display: flex; flex-direction: column; gap: 5px;">
        <div class="author-tag-helper-bar" style="padding: ${compact ? '6px 8px' : '8px 10px'}; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="author-tag-helper-title" style="color: #111827; font-size: 11.5px; font-weight: 800;">🎮 게임 요소 삽입:</span>

          <!-- 단서(대분류) 발견 -->
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #cbd5e1; flex-wrap: wrap;">
            <select class="author-select" data-author-field="toolbarTopicSelect" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 125px;">
              <option value="__new__">+ 새 단서(대분류) 작성</option>
              ${clueTopics.map((t) => `<option value="${escapeHtml(t.title)}">${escapeHtml(t.icon || '🔍')} ${escapeHtml(t.title)}</option>`).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:topic" style="color: #111827; font-weight: 700; background: #fef3c7; border: 1.5px solid #f59e0b; font-size: 11px; padding: 2px 7px;">+ 🔍 단서 발견</button>
          </div>

          <!-- 단서 조건(중분류) -->
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #cbd5e1; flex-wrap: wrap;">
            <select class="author-select" data-author-field="toolbarClueSelect" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 145px;">
              <option value="__new__">+ 새 단서 조건 작성</option>
              ${allSubClues.map((sc, scIdx) => `<option value="${scIdx}">[${escapeHtml(sc.topicTitle)}] ${escapeHtml(sc.label)}</option>`).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:clue" style="color: #111827; font-weight: 700; background: #f1f5f9; border: 1.5px solid #94a3b8; font-size: 11px; padding: 2px 7px;">+ 🔘 단서 조건</button>
          </div>

          <!-- 세부 타일(소분류) 해금 -->
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #cbd5e1; flex-wrap: wrap;">
            <span style="font-size: 11px; color: #111827; font-weight: 700;">대분류:</span>
            <select class="author-select" data-author-field="subitemTopic" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 115px;">
              ${clueTopics.map((t) => `<option value="${escapeHtml(t.title)}" ${t.title === activeTopicTitle ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}
            </select>
            <span style="font-size: 11px; color: #111827; font-weight: 700;">세부타일:</span>
            <select class="author-select" data-author-field="subitemTarget" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 135px;">
              <option value="__new__">+ 새 세부타일 직접 작성</option>
              ${(activeTopic?.subItems || []).map((s, idx) => `
                <option value="${idx}" ${idx === this.selectedSubItemIndex ? 'selected' : ''}>${escapeHtml(s.label || s.title || `세부타일 #${idx + 1}`)}</option>
              `).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:subitem" style="color: #111827; border: 1.5px solid #cbd5e1; font-weight: 700; background: #f1f5f9; font-size: 11px; padding: 2px 7px;">+ ⬜ 세부 타일 해금</button>
          </div>

          <!-- 세부설명(기록) 추가 -->
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #cbd5e1; flex-wrap: wrap;">
            <span style="font-size: 11px; color: #111827; font-weight: 700;">세부설명:</span>
            <select class="author-select" data-author-field="storyRecordSelect" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 185px;">
              <option value="__new__">+ 새 세부설명(기록) 직접 작성</option>
              ${allTileRecords.map((r, rIdx) => `
                <option value="${rIdx}">[${escapeHtml(r.tileLabel)}] ${escapeHtml(r.text.slice(0, 20))}${r.text.length > 20 ? '...' : ''}</option>
              `).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:record" style="color: #1e40af; border: 1.5px solid #93c5fd; font-weight: 700; background: #eff6ff; font-size: 11px; padding: 2px 7px;">+ 📝 세부 설명 추가</button>
          </div>

          <!-- 아이템 획득 및 사용 -->
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #cbd5e1; flex-wrap: wrap;">
            <select class="author-select" data-author-field="toolbarItemSelect" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 140px;">
              <option value="__new__">+ 새 아이템 직접 작성</option>
              ${INVENTORY_ITEMS.map((it) => `<option value="${escapeHtml(it.id)}">${escapeHtml((it.icon && !it.icon.includes('/')) ? it.icon : '🎁')} ${escapeHtml(it.name)}</option>`).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:item" style="color: #92400e; font-weight: 700; background: #fffbeb; border: 1.5px solid #fcd34d; font-size: 11px; padding: 2px 7px;">+ 🎁 아이템 획득</button>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:use-item" style="color: #065f46; font-weight: 700; background: #ecfdf5; border: 1.5px solid #6ee7b7; font-size: 11px; padding: 2px 7px;">+ 🎒 아이템 사용</button>
          </div>

          <!-- 인물 등록 -->
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #cbd5e1; flex-wrap: wrap;">
            <select class="author-select" data-author-field="toolbarCharacterSelect" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 11px; max-width: 130px;">
              <option value="__new__">+ 새 인물 직접 작성</option>
              ${allCharacters.map((c) => `<option value="${escapeHtml(c.id)}">👤 ${escapeHtml(c.title)}</option>`).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:character" style="color: #111827; font-weight: 700; background: #f8fafc; border: 1.5px solid #cbd5e1; font-size: 11px; padding: 2px 7px;">+ 👤 인물 등록</button>
          </div>

          <button type="button" class="author-tag-btn" data-author-action="insert-tag:stat" style="color: #111827; font-weight: 700; background: #ffffff; border: 1.5px solid #cbd5e1; font-size: 11px; padding: 3px 7px;">+ ⚡ 능력치 변동</button>
          <button type="button" class="author-tag-btn" data-author-action="insert-tag:explanation" style="color: #111827; font-weight: 700; background: #ffffff; border: 1.5px solid #cbd5e1; font-size: 11px; padding: 3px 7px;">+ 💡 설명창 박스</button>
          <button type="button" class="author-tag-btn" data-author-action="insert-style:condition" style="color: #111827; font-weight: 700; background: #ffffff; border: 1.5px solid #cbd5e1; font-size: 11px; padding: 3px 7px;">+ 🔀 조건 분기</button>
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #fffbeb; padding: 2px 6px; border-radius: 6px; border: 1.5px solid #fcd34d; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: 800; color: #92400e;">✍️ 퀴즈란:</span>
            <span style="font-size: 10.5px; font-weight: 700; color: #166534;">✨정답:</span>
            <select class="author-select" data-author-field="toolbarQuizSuccessScene" style="background: #ffffff; color: #111827; border: 1px solid #86efac; border-radius: 4px; padding: 2px 4px; font-size: 11px; max-width: 130px;">
              <option value="">-- 정답 시 이동 --</option>
              ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}">[본문] ${escapeHtml(n.title || n.id)}</option>`).join('')}
            </select>
            <span style="font-size: 10.5px; font-weight: 700; color: #991b1b;">❌오답:</span>
            <select class="author-select" data-author-field="toolbarQuizFailScene" style="background: #ffffff; color: #111827; border: 1px solid #fca5a5; border-radius: 4px; padding: 2px 4px; font-size: 11px; max-width: 130px;">
              <option value="">-- 오답 시 이동(선택) --</option>
              ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}">[본문] ${escapeHtml(n.title || n.id)}</option>`).join('')}
            </select>
            <button type="button" class="author-tag-btn" data-author-action="insert-tag:quiz" style="color: #92400e; font-weight: 700; background: #fde68a; border: 1.5px solid #d97706; font-size: 11px; padding: 2px 7px;">+ 퀴즈 정답란</button>
          </div>
          <button type="button" class="author-tag-btn" data-author-action="insert-tag:briefing" style="color: #1e40af; font-weight: 800; background: #eff6ff; border: 1.5px solid #93c5fd; font-size: 11px; padding: 3px 7px;">+ 🧭 탐사 브리핑 카드</button>
        </div>

        <div class="author-tag-helper-bar author-style-helper-bar" style="padding: ${compact ? '4px 8px' : '6px 10px'}; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="author-tag-helper-title" style="color: #111827; font-size: 11.5px; font-weight: 800;">🎨 텍스트 연출 및 서식:</span>
          <button type="button" class="author-tag-btn author-style-btn" data-author-action="insert-style:bold" title="굵은 글씨 (드래그 영역 감싸기 지원)" style="color: #111827; font-weight: 700; font-size: 11px; padding: 2px 7px;"><b>B</b> 볼드 (**)</button>
          <button type="button" class="author-tag-btn author-style-btn" data-author-action="insert-style:italic" title="기울임 글씨 (드래그 영역 감싸기 지원)" style="color: #111827; font-weight: 700; font-size: 11px; padding: 2px 7px;"><i>I</i> 기울기 (*)</button>
          <button type="button" class="author-tag-btn author-style-btn" data-author-action="insert-style:center" title="가운데 정렬 (드래그 영역 감싸기 지원)" style="color: #111827; font-weight: 700; font-size: 11px; padding: 2px 7px;">↔️ 가운데 정렬</button>
          <button type="button" class="author-tag-btn author-style-btn" data-author-action="insert-style:typewriter" title="사용자가 도달 시 타이핑 연출" style="color: #111827; font-weight: 700; font-size: 11px; padding: 2px 7px;">⌨️ 타이핑 효과</button>
          <button type="button" class="author-tag-btn author-style-btn" data-author-action="insert-style:glow" title="오파츠/마력 빛무리 글씨 (드래그 영역 감싸기 지원)" style="color: #111827; font-weight: 700; font-size: 11px; padding: 2px 7px;">✨ 빛무리 효과</button>
          <button type="button" class="author-tag-btn author-style-btn" data-author-action="insert-style:condition" title="플레이어 상호작용/타일기록 수에 따른 분기 문단" style="color: #111827; font-weight: 700; font-size: 11px; padding: 2px 7px;">🔀 조건 분기 [조건: ...]</button>
        </div>
      </div>
    `;
  }

  renderRichTextareaField(label, fieldName, value, { rows = 3, placeholder = '', attributes = '', hotspotIndex = '', compact = true, lightTheme = false } = {}) {
    const hsAttr = hotspotIndex !== '' && hotspotIndex !== undefined && hotspotIndex !== null
      ? ` data-hotspot-index="${escapeHtml(hotspotIndex)}"`
      : '';
    const extraAttrs = attributes ? ` ${attributes}` : '';
    const labelColor = lightTheme ? '#111827' : '#e2e8f0';
    const taStyle = lightTheme
      ? 'color: #111827; background: #ffffff; border: 1.5px solid #cbd5e1; width: 100%; border-radius: 8px; padding: 10px;'
      : 'width: 100%; border-radius: 8px; padding: 10px;';
    const previewHtml = this.renderInlineWidgetsForText(value, fieldName);

    return `
      <div class="author-universal-text-editor" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
        <div style="font-size: 12px; font-weight: 700; color: ${labelColor}; margin-bottom: 2px;">${escapeHtml(label)}</div>
        ${this.renderUniversalTextToolbar(fieldName, { hotspotIndex, compact })}
        <textarea data-author-field="${escapeHtml(fieldName)}" rows="${rows}" placeholder="${escapeHtml(placeholder)}"${hsAttr}${extraAttrs} style="${taStyle}">${escapeHtml(value ?? '')}</textarea>
        <div class="author-inline-widget-preview" data-inline-preview-for="${escapeHtml(fieldName)}"${hsAttr}>
          ${previewHtml}
        </div>
      </div>
    `;
  }

  renderInlineWidgetsForText(rawText, contextId = 'inline') {
    const lines = String(rawText || '').split(/\r?\n/);
    const isDialogueField = String(contextId || '').startsWith('dialogueAnswerText:') || contextId === 'hotspot:dialogueText';
    if (isDialogueField) {
      const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
      if (nonEmpty.length === 0) return '';
      const isQuoteLine = (str) => /^[“"‘'「『]/.test(str) || /[”"’'」』]$/.test(str);
      const hasAnyQuotes = nonEmpty.some((l) => isQuoteLine(l));
      let nextSpeaker = 'npc';
      const rowsHtml = nonEmpty.map((trimmed, idx) => {
        const playerPrefix = trimmed.match(/^(?:\[(?:레이든|주인공|나)\]|(?:레이든|주인공|나)\s*[:：])\s*(.+)$/);
        if (playerPrefix) {
          nextSpeaker = 'npc';
          return `<div style="align-self:flex-end; max-width:85%; background:rgba(212,168,83,0.22); border:1px solid rgba(212,168,83,0.6); color:#fef3c7; padding:6px 11px; border-radius:12px 3px 12px 12px; font-size:12px;"><strong style="color:#fcd34d; display:block; font-size:10.5px;">🕵️ 레이든 (나)</strong>${escapeHtml(playerPrefix[1].trim())}</div>`;
        }
        const npcPrefix = trimmed.match(/^(?:\[(?:상대|인물|NPC)\]|(?:상대|인물|NPC)\s*[:：])\s*(.+)$/i);
        if (npcPrefix) {
          nextSpeaker = 'player';
          return `<div style="align-self:flex-start; max-width:85%; background:#1e293b; border:1px solid rgba(148,163,184,0.4); color:#f8fafc; padding:6px 11px; border-radius:3px 12px 12px 12px; font-size:12px;"><strong style="color:#93c5fd; display:block; font-size:10.5px;">👤 상대 인물</strong>${escapeHtml(npcPrefix[1].trim())}</div>`;
        }
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          nextSpeaker = 'npc';
          return `<div style="align-self:center; width:96%;">${this.renderWidgetPreview(trimmed, contextId, idx)}</div>`;
        }
        if (isQuoteLine(trimmed) || (!hasAnyQuotes && nonEmpty.length <= 2)) {
          const sp = nextSpeaker;
          nextSpeaker = sp === 'npc' ? 'player' : 'npc';
          if (sp === 'npc') {
            return `<div style="align-self:flex-start; max-width:85%; background:#1e293b; border:1px solid rgba(148,163,184,0.4); color:#f8fafc; padding:6px 11px; border-radius:3px 12px 12px 12px; font-size:12px;"><strong style="color:#93c5fd; display:block; font-size:10.5px;">👤 상대 인물</strong>${escapeHtml(trimmed)}</div>`;
          }
          return `<div style="align-self:flex-end; max-width:85%; background:rgba(212,168,83,0.22); border:1px solid rgba(212,168,83,0.6); color:#fef3c7; padding:6px 11px; border-radius:12px 3px 12px 12px; font-size:12px;"><strong style="color:#fcd34d; display:block; font-size:10.5px;">🕵️ 레이든 (나)</strong>${escapeHtml(trimmed)}</div>`;
        }
        nextSpeaker = 'npc';
        return `<div style="align-self:center; width:92%; background:rgba(30,41,59,0.7); border-left:3px solid #94a3b8; color:#cbd5e1; padding:5px 10px; border-radius:6px; font-size:11.5px;">💭 ${escapeHtml(trimmed)}</div>`;
      }).join('');

      return `
        <div style="margin-top: 6px; padding: 10px 12px; background: rgba(8, 13, 24, 0.85); border: 1px dashed rgba(96, 165, 250, 0.45); border-radius: 10px; display: flex; flex-direction: column; gap: 7px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
            <span style="font-size: 11px; font-weight: 800; color: #60a5fa;">💬 메신저 대화 미리보기 (상대 ↔ 주인공 자동 교차)</span>
            <span style="font-size: 10.5px; color: #94a3b8;">따옴표(“…”) 줄은 상대·주인공이 번갈아 말하며, <code>나: 대사</code> / <code>상대: 대사</code>로 직접 지정도 가능</span>
          </div>
          ${rowsHtml}
        </div>
      `;
    }

    const widgets = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        widgets.push({ line: idx, text: trimmed });
      }
    });
    if (widgets.length === 0) return '';
    return `
      <div style="margin-top: 6px; padding: 8px 10px; background: rgba(15, 23, 42, 0.45); border: 1px dashed rgba(212, 175, 55, 0.4); border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
        <div style="font-size: 11px; font-weight: 700; color: #f59e0b;">👁️ 삽입된 게임 요소 미리보기 (${widgets.length}개)</div>
        ${widgets.map((w) => this.renderWidgetPreview(w.text, contextId, w.line)).join('')}
      </div>
    `;
  }

  insertItemTag(item, targetNodeId = this.selectedStoryNodeId) {
    const node = STORY_NODES[targetNodeId];
    if (!node) return;
    const icon = item.icon || '🎁';
    const desc = item.desc || '소지품 설명';
    const tag = `[아이템: ${item.name} | ${desc} | ${icon}]`;

    const textarea = this.content?.querySelector('[data-author-field="storyParagraphs"]');
    if (textarea && this.activeTab === 'story') {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const val = textarea.value;
      const snippet = `\n${tag}\n`;
      textarea.value = val.substring(0, start) + snippet + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
      textarea.focus();
      this.handleField({ target: textarea, type: 'input' });
      this.updateStoryPreview();
    } else {
      if (!Array.isArray(node.paragraphs)) node.paragraphs = [];
      node.paragraphs.push(tag);
      this.persist();
      this.saveToDisk();
    }
    this.setStatus(`[${item.name}] 소지품 태그를 [${node.title || targetNodeId}] 본문에 추가했습니다.`);
  }

  updateInlineWidgetPreview(textarea) {
    if (!textarea) return;
    const editorWrap = textarea.closest('.author-universal-text-editor');
    const previewBox = editorWrap?.querySelector('.author-inline-widget-preview');
    if (previewBox) {
      previewBox.innerHTML = this.renderInlineWidgetsForText(textarea.value, textarea.dataset.authorField || 'inline');
    }
  }

  insertStoryStyle(styleType, triggerBtn = null) {
    const textarea = this.resolveTargetTextarea(triggerBtn);
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const val = textarea.value;
    const selectedText = val.substring(start, end);

    let before = '';
    let after = '';
    let defaultText = '';

    switch (styleType) {
      case 'bold':
        before = '**';
        after = '**';
        defaultText = '굵은 텍스트';
        break;
      case 'italic':
        before = '*';
        after = '*';
        defaultText = '기울임 텍스트';
        break;
      case 'center':
        before = '\n[가운데: ';
        after = ']\n';
        defaultText = '가운데 정렬할 문장';
        break;
      case 'typewriter':
        before = '\n[타이핑: ';
        after = ']\n';
        defaultText = '사용자가 이 위치에 도달하면 타이핑하듯 나타날 문장';
        break;
      case 'glow':
        before = '[빛: ';
        after = ']';
        defaultText = '신비롭게 빛나는 글씨';
        break;
      case 'condition':
        before = '\n[조건: 타일기록 >= 1 | ';
        after = ']\n';
        defaultText = '타일기록이나 상호작용 조건을 만족할 때만 독자에게 보일 문장';
        break;
      default:
        return;
    }

    const insertedText = selectedText.length > 0 ? (before + selectedText + after) : (before + defaultText + after);
    textarea.value = val.substring(0, start) + insertedText + val.substring(end);

    if (selectedText.length > 0) {
      textarea.selectionStart = start;
      textarea.selectionEnd = start + insertedText.length;
    } else {
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + defaultText.length;
    }
    textarea.focus();

    this.handleField({ target: textarea, type: 'input' });
    this.updateInlineWidgetPreview(textarea);
    if (textarea.dataset.authorField === 'storyParagraphs') {
      this.updateStoryPreview();
    }
    this.setStatus(`텍스트 서식 [${styleType}] 효과가 텍스트에 삽입되었습니다.`);
  }

  insertStoryTag(type, triggerBtn = null) {
    const textarea = this.resolveTargetTextarea(triggerBtn);
    if (!textarea) return;
    const toolbarWrap = triggerBtn?.closest('[data-toolbar-target]') || this.content;

    let snippet = '';
    if (type === 'item') {
      const itemSelect = toolbarWrap?.querySelector('[data-author-field="toolbarItemSelect"]');
      const itemId = itemSelect?.value;
      const existingItem = itemId && itemId !== '__new__'
        ? INVENTORY_ITEMS.find((i) => i.id === itemId)
        : null;
      if (existingItem) {
        snippet = `\n[아이템: ${existingItem.name} | ${existingItem.desc || '소지품 설명'} | ${existingItem.icon || '🎁'}]\n`;
      } else {
        snippet = '\n[아이템: 낡은 가죽 주머니 | 아카데미 지급용 기본 수납 주머니입니다. | 🎒]\n';
      }
    } else if (type === 'use-item') {
      const itemSelect = toolbarWrap?.querySelector('[data-author-field="toolbarItemSelect"]');
      const itemId = itemSelect?.value;
      const existingItem = itemId && itemId !== '__new__'
        ? INVENTORY_ITEMS.find((i) => i.id === itemId)
        : null;
      if (existingItem) {
        snippet = `\n[아이템사용: ${existingItem.name} | ${existingItem.name}을(를) 사용하여 상호작용했습니다. | ${existingItem.icon || '🗝️'}]\n`;
      } else {
        snippet = '\n[아이템사용: 오래된 황동 열쇠 | 황동 자물쇠에 열쇠를 꽂고 돌리자 철컥 소리와 함께 서랍이 열렸습니다. | 🗝️]\n';
      }
    } else if (type === 'stat') {
      snippet = '\n[스탯: 마법 +1 | 신비한 마법 기운이 몸에 깃듭니다.]\n';
    } else if (type === 'explanation') {
      snippet = '\n[설명창: 오파츠 상점의 기원 | 고대 마도 문명이 남긴 유물들이 시공간을 넘어 모여드는 차원 틈새의 비밀 상점입니다. | 💡]\n';
    } else if (type === 'character') {
      const select = toolbarWrap?.querySelector('[data-author-field="toolbarCharacterSelect"]') ||
                     this.content?.querySelector('[data-author-action="quick-character-select"]');
      const charId = select?.value;
      if (charId === '__new__') {
        snippet = `\n[인물: 새로운 등장인물 | 이 인물에 대한 소개 설명을 입력하세요. | 👤]\n`;
      } else {
        const char = (charId && CODEX_DATA.find((c) => c.category === 'character' && c.id === charId)) ||
                     CODEX_DATA.find((c) => c.category === 'character' && c.id === this.selectedCharacterId) ||
                     CODEX_DATA.find((c) => c.category === 'character');
        const name = char ? char.title : '사서 엘레나';
        const desc = char ? (char.summary || char.description) : '중앙 서고의 관리를 담당하는 젊은 사서.';
        const icon = char ? (char.icon || 'images/elena_avatar.png') : 'images/elena_avatar.png';
        snippet = `\n[인물: ${name} | ${desc} | ${icon}]\n`;
      }
    } else if (type === 'topic') {
      const topicSelect = toolbarWrap?.querySelector('[data-author-field="toolbarTopicSelect"]');
      const topicTitle = topicSelect?.value;
      const existingTopic = topicTitle && topicTitle !== '__new__'
        ? CODEX_DATA.find((c) => c.title === topicTitle)
        : null;
      if (existingTopic) {
        snippet = `\n[주제: ${existingTopic.title} | ${existingTopic.summary || existingTopic.description || '단서 설명'} | ${existingTopic.icon || '🔍'}]\n`;
      } else {
        snippet = '\n[주제: 약초 퀴즈 | 안개 숲에서 올바른 약초를 가려내야 한다. | 🌿]\n';
      }
    } else if (type === 'subitem') {
      const topicSelect = toolbarWrap?.querySelector('[data-author-field="subitemTopic"]') ||
                          this.content?.querySelector('[data-author-field="subitemTopic"]');
      const targetSelect = toolbarWrap?.querySelector('[data-author-field="subitemTarget"]') ||
                           this.content?.querySelector('[data-author-field="subitemTarget"]');
      const topicName = topicSelect?.value || this.selectedSubItemTopic || (CODEX_DATA.find((c) => c.category === 'clue')?.title) || '새 단서 주제';
      const topic = CODEX_DATA.find((c) => c.title === topicName);
      const targetVal = targetSelect?.value;
      if (targetVal !== undefined && targetVal !== '__new__' && topic?.subItems?.[Number(targetVal)]) {
        const sub = topic.subItems[Number(targetVal)];
        const subName = sub.label || sub.title || '세부 타일';
        const subDesc = sub.desc || sub.description || '이 세부 타일에 대한 설명입니다.';
        snippet = `\n[세부타일: ${topicName} | ${subName} | ${subDesc}]\n`;
      } else {
        snippet = `\n[세부타일: ${topicName} | 새로운 세부 타일 | 이 세부 타일에 대한 설명입니다.]\n`;
      }
    } else if (type === 'clue') {
      const clueSelect = toolbarWrap?.querySelector('[data-author-field="toolbarClueSelect"]');
      const clueVal = clueSelect?.value;
      const allSubClues = [];
      CODEX_DATA.filter((item) => item.category === 'clue' || item.subItems || item.subClues).forEach((topic) => {
        (topic.subClues || []).forEach((sc) => {
          allSubClues.push({
            topicTitle: topic.title,
            label: sc.label || sc.title || '단서 조건',
            desc: sc.desc || sc.description || '조건 설명'
          });
        });
      });
      if (clueVal !== undefined && clueVal !== '__new__' && allSubClues[Number(clueVal)]) {
        const sc = allSubClues[Number(clueVal)];
        snippet = `\n[단서: ${sc.label} | ${sc.topicTitle} | ${sc.desc}]\n`;
      } else {
        const topicSelect = toolbarWrap?.querySelector('[data-author-field="subitemTopic"]');
        const topicName = topicSelect?.value || '약초 퀴즈';
        snippet = `\n[단서: 독초 X | ${topicName} | 독성이 없는 식물이어야 한다는 사실을 알아냈다.]\n`;
      }
    } else if (type === 'record') {
      const recordSelect = toolbarWrap?.querySelector('[data-author-field="storyRecordSelect"]') ||
                           this.content?.querySelector('[data-author-field="storyRecordSelect"]');
      const idx = recordSelect?.value;
      const allRecords = this.cachedStoryRecords || this.getAllTileRecords();
      if (idx !== undefined && idx !== '__new__' && allRecords?.[Number(idx)]) {
        const r = allRecords[Number(idx)];
        snippet = `\n[기록: ${r.tileLabel} | ${r.recordId} | ${r.text}]\n`;
      } else {
        const topicSelect = toolbarWrap?.querySelector('[data-author-field="subitemTopic"]');
        const targetSelect = toolbarWrap?.querySelector('[data-author-field="subitemTarget"]');
        const topicName = topicSelect?.value || this.selectedSubItemTopic;
        const topic = CODEX_DATA.find((c) => c.title === topicName);
        const targetVal = targetSelect?.value;
        const selectedSub = (targetVal !== undefined && targetVal !== '__new__' && topic?.subItems?.[Number(targetVal)])
          ? topic.subItems[Number(targetVal)]
          : (topic?.subItems?.[0]);
        const targetTileLabel = selectedSub?.label || '달빛 이끼';
        const autoRecId = `rec_${Date.now().toString().slice(-5)}`;
        snippet = `\n[기록: ${targetTileLabel} | ${autoRecId} | 새로 밝혀낸 세부 설명(기록) 내용을 여기에 작성하세요.]\n`;
      }
    } else if (type === 'quiz') {
      const bar = textarea.closest('.author-story-workspace, .author-card, .author-panel-body, .author-universal-toolbar-wrap') || document;
      const successSelect = bar.querySelector('[data-author-field="toolbarQuizSuccessScene"]') || document.querySelector('[data-author-field="toolbarQuizSuccessScene"]');
      const failSelect = bar.querySelector('[data-author-field="toolbarQuizFailScene"]') || document.querySelector('[data-author-field="toolbarQuizFailScene"]');
      const successScene = successSelect?.value || '';
      const failScene = failSelect?.value || '';

      const topicSelect = bar.querySelector('[data-author-field="toolbarTopicSelect"]') || document.querySelector('[data-author-field="toolbarTopicSelect"]');
      const topicVal = topicSelect?.value;
      const topic = (topicVal && topicVal !== '__new__') ? topicVal : '약초 퀴즈';
      const answers = topic === '약초 퀴즈' ? '달빛 이끼, 달빛이끼' : '정답단어1, 정답단어2';
      const successMsg = '✨ 정답입니다! 화분의 줄기가 눈부시게 빛나며 마침내 꽃을 피웁니다.';
      const nextNode = successScene || 'story_1795161633215';

      snippet = `\n[정답입력: ${topic} | ${answers} | ${successMsg} | ${nextNode} | ${successScene} | ${failScene}]\n`;
    } else if (type === 'briefing') {
      snippet = '\n[브리핑카드: story_1795161633215 | 약초 퀴즈]\n';
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + snippet + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
    textarea.focus();

    this.handleField({ target: textarea, type: 'input' });
    this.updateInlineWidgetPreview(textarea);
    if (textarea.dataset.authorField === 'storyParagraphs') {
      this.updateStoryPreview();
    }
    this.setStatus(`[${type}] 게임 요소 태그가 텍스트에 삽입되었습니다.`);
  }

  insertCharacterTag(char, targetNodeId = this.selectedStoryNodeId) {
    const node = STORY_NODES[targetNodeId];
    if (!node) return;
    const icon = char.icon || '👤';
    const desc = char.summary || char.description || '인물 소개';
    const tag = `[인물: ${char.title} | ${desc} | ${icon}]`;

    const textarea = this.content?.querySelector('[data-author-field="storyParagraphs"]');
    if (textarea && this.activeTab === 'story') {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const val = textarea.value;
      const snippet = `\n${tag}\n`;
      textarea.value = val.substring(0, start) + snippet + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
      textarea.focus();
      this.handleField({ target: textarea, type: 'input' });
      this.updateStoryPreview();
    } else {
      if (!Array.isArray(node.paragraphs)) node.paragraphs = [];
      node.paragraphs.push(tag);
      this.persist();
      this.saveToDisk();
    }
    this.setStatus(`[${char.title}] 인물을 [${node.title || targetNodeId}] 본문에 추가했습니다.`);
  }

  removeStoryParagraph(lineIdx) {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node || !node.paragraphs) return;
    if (lineIdx >= 0 && lineIdx < node.paragraphs.length) {
      node.paragraphs.splice(lineIdx, 1);
      const textarea = this.content?.querySelector('[data-author-field="storyParagraphs"]');
      if (textarea) textarea.value = node.paragraphs.join('\n');
      this.persist();
      this.updateStoryPreview();
      this.setStatus('태그가 본문에서 제거되었습니다.');
    }
  }

  renderWidgetPreview(tagText, nodeId, lineIdx) {
    const trimmed = String(tagText || '').trim();
    const charMatch = trimmed.match(/^\[(?:인물|캐릭터|CHARACTER|PERSON)\s*:\s*(.+?)\]$/i);
    if (charMatch) {
      const parts = charMatch[1].split('|').map((s) => s.trim());
      const charName = parts[0] || '인물';
      const charDesc = parts[1] || '인물 소개';
      const charIcon = parts[2] || '👤';
      return `
        <div class="story-game-widget widget-character" style="margin: 4px 0; border: 1.5px solid #3b82f6; border-radius: 10px; padding: 10px 14px; background: rgba(59, 130, 246, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(59,130,246,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#3b82f6;">👤 인물 등록 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">✨ 새 인물 등록 알림</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="width:40px; height:40px; border-radius:50%; border:2px solid #3b82f6; overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
              ${charIcon.includes('/') ? `<img src="${escapeHtml(charIcon)}" style="width:100%; height:100%; object-fit:contain;">` : escapeHtml(charIcon)}
            </div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(charName)}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(charDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }
    const itemMatch = trimmed.match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
    if (itemMatch) {
      const parts = itemMatch[1].split('|').map((s) => s.trim());
      return `
        <div class="story-game-widget widget-item" style="margin: 4px 0; border: 1.5px solid #d4af37; border-radius: 10px; padding: 10px 14px; background: rgba(212, 175, 55, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#d4af37;">🎁 아이템 획득 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">소지품 추가</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">${escapeHtml(parts[2] || '🎁')}</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(parts[0] || '아이템')}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(parts[1] || '설명')}</p>
            </div>
          </div>
        </div>
      `;
    }
    const itemUseMatch = trimmed.match(/^\[(?:아이템사용|아이템소모|아이템삭제|소지품사용|소지품소모|USE_ITEM|CONSUME_ITEM|REMOVE_ITEM)\s*:\s*(.+?)\]$/i);
    if (itemUseMatch) {
      const parts = itemUseMatch[1].split('|').map((s) => s.trim());
      return `
        <div class="story-game-widget widget-item widget-item-use" style="margin: 4px 0; border: 1.5px solid #10b981; border-radius: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(16,185,129,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#10b981;">🎒 아이템 사용 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:#10b981;">소지품 -1</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">${escapeHtml(parts[2] || '🎒')}</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(parts[0] || '소지품')} <span style="color:#ef4444; font-size:12px; font-weight:700;">-1</span></strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(parts[1] || '사용 설명')}</p>
            </div>
          </div>
        </div>
      `;
    }
    const statMatch = trimmed.match(/^\[(?:스탯|STAT)\s*:\s*(.+?)\]$/i);
    if (statMatch) {
      const parts = statMatch[1].split('|').map((s) => s.trim());
      return `
        <div class="story-game-widget widget-stat" style="margin: 4px 0; border: 1.5px solid #2980b9; border-radius: 10px; padding: 10px 14px; background: rgba(41, 128, 185, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(41,128,185,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#2980b9;">⚡ 능력치 변동 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">스탯 반영</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">📈</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(parts[0] || '능력치')}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(parts[1] || '')}</p>
            </div>
          </div>
        </div>
      `;
    }

    const explanationMatch = trimmed.match(/^\[(?:설명창|팝업|모달|설명|POPUP|MODAL|EXPLANATION)\s*:\s*(.+?)\]$/i);
    if (explanationMatch) {
      const parts = explanationMatch[1].split('|').map((s) => s.trim());
      const eTitle = parts[0] || '상세 설명';
      const eContent = parts[1] || '설명창 내용';
      const eIcon = parts[2] || '💡';
      return `
        <div class="story-game-widget widget-explanation" style="margin: 4px 0; border: 1.5px solid #d97706; border-radius: 10px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(217,119,6,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#d97706;">💡 설명창 박스 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:#d97706;">본문 인라인 박스</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">${escapeHtml(eIcon)}</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(eTitle)}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(eContent)}</p>
            </div>
          </div>
        </div>
      `;
    }

    const topicMatch = trimmed.match(/^\[(?:주제|TOPIC)\s*:\s*(.+?)\]$/i);
    if (topicMatch) {
      const parts = topicMatch[1].split('|').map((s) => s.trim());
      let tTitle = parts[0] || '단서';
      let tDesc = parts[1] || '';
      let tIcon = parts[2] || '🌿';
      if (parts.length >= 4) {
        tTitle = parts[1];
        tDesc = parts[2];
        tIcon = parts[3];
      }
      return `
        <div class="story-game-widget widget-topic" style="margin: 4px 0; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(245,158,11,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#f59e0b;">${escapeHtml(tIcon)} ${escapeHtml(tTitle)} (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">✨ 새 단서 발견 알림</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">${escapeHtml(tIcon)}</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(tTitle)}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(tDesc)}</p>
            </div>
          </div>
        </div>
      `;
    }

    const clueMatch = trimmed.match(/^\[(?:단서|CLUE|조건|단서조건)\s*:\s*(.+?)\]$/i);
    if (clueMatch) {
      const parts = clueMatch[1].split('|').map((s) => s.trim());
      return `
        <div class="story-game-widget widget-clue" style="margin: 4px 0; border: 1.5px solid #d4af37; border-radius: 10px; padding: 10px 14px; background: rgba(212, 175, 55, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#d4af37;">🔘 단서 조건 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">메모보드/단서 등록</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">🔘</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(parts[0] || '단서')}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(parts[2] || parts[1] || '')}</p>
            </div>
          </div>
        </div>
      `;
    }

    const subItemMatch = trimmed.match(/^\[(?:세부타일|소분류|소분류타일|세부키워드|세부단서|SUBITEM|SUB_ITEM|DETAIL_TILE)\s*:\s*(.+?)\]$/i);
    if (subItemMatch) {
      const parts = subItemMatch[1].split('|').map((s) => s.trim());
      let pTitle = parts[0] || '대분류';
      let sTitle = parts[1] || '세부 타일';
      let sDesc = parts[2] || '';
      const entry1 = CODEX_DATA.find((c) => c.id === parts[1] || c.title === parts[1]);
      if (entry1) {
        pTitle = parts[1];
        sTitle = parts[0];
      }
      return `
        <div class="story-game-widget widget-subitem" style="margin: 4px 0; border: 1.5px solid #94a3b8; border-radius: 10px; padding: 10px 14px; background: rgba(148, 163, 184, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(148,163,184,0.25); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#475569; background:#f1f5f9; padding:2px 8px; border-radius:4px; border:1px solid #cbd5e1;">⬜ 세부 타일 (소분류) (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">✨ 새 세부 타일 발견 알림</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="width:40px; height:40px; border-radius:8px; border:2px solid #cbd5e1; background:#ffffff; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; box-shadow:0 1px 4px rgba(0,0,0,0.1);">⬜</div>
            <div class="widget-details">
              <div class="widget-name" style="display:flex; align-items:baseline; gap:8px;">
                <strong style="font-size:14px; color:var(--text-main);">${escapeHtml(sTitle)}</strong>
                <span style="font-size:12px; font-weight:500; color:#94a3b8;">${escapeHtml(pTitle)}</span>
              </div>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(sDesc || '세부 정보')}</p>
            </div>
          </div>
        </div>
      `;
    }

    const recordMatch = trimmed.match(/^\[(?:추가기록|세부기록|기록추가|새기록|기록|정보|RECORD|INFO)\s*:\s*(.+?)\]$/i);
    if (recordMatch) {
      const parts = recordMatch[1].split('|').map((s) => s.trim());
      return `
        <div class="story-game-widget widget-record" style="margin: 4px 0; border: 1.5px solid #60a5fa; border-radius: 10px; padding: 10px 14px; background: rgba(96, 165, 250, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(96,165,250,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#2563eb;">📝 추가기록 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">세부 타일에 기록 추가</span>
          </div>
          <div class="widget-body" style="display:flex; align-items:center; gap:12px;">
            <div class="widget-icon" style="font-size:24px;">📝</div>
            <div class="widget-details">
              <strong class="widget-name" style="font-size:14px; color:var(--text-main);">${escapeHtml(parts[0] || '기록 대상')}</strong>
              <p class="widget-desc" style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">${escapeHtml(parts[2] || parts[1] || '')}</p>
            </div>
          </div>
        </div>
      `;
    }

    const glowMatch = trimmed.match(/^\[(?:빛|글로우|빛무리|오파츠|GLOW)\s*:\s*(.+?)\]$/i);
    if (glowMatch) {
      return `
        <div class="story-game-widget widget-glow" style="margin: 4px 0; border: 1.5px solid #d4af37; border-radius: 10px; padding: 10px 14px; background: rgba(212, 175, 55, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#d4af37;">✨ 빛무리 연출 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">신비로운 빛무리 효과</span>
          </div>
          <div class="widget-body" style="padding: 4px 0;">
            <span class="novel-glow-text novel-glow-gold" style="font-size: 15px;">${escapeHtml(glowMatch[1])}</span>
          </div>
        </div>
      `;
    }

    const twMatch = trimmed.match(/^\[(?:타이핑|타자기|TYPEWRITER)\s*:\s*(.+?)\]$/i);
    if (twMatch) {
      return `
        <div class="story-game-widget widget-typewriter" style="margin: 4px 0; border: 1.5px solid #10b981; border-radius: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(16,185,129,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#10b981;">⌨️ 타이핑 효과 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">독자 도달 시 한 글자씩 타이핑</span>
          </div>
          <div class="widget-body" style="padding: 4px 0; font-size: 13.5px; color: var(--text-main);">
            “${escapeHtml(twMatch[1])}” <span class="novel-typewriter-cursor">|</span>
          </div>
        </div>
      `;
    }

    const centerMatch = trimmed.match(/^\[(?:가운데|중앙|CENTER)\s*:\s*(.+?)\]$/i);
    if (centerMatch) {
      return `
        <div class="story-game-widget widget-center" style="margin: 4px 0; border: 1.5px solid #8b5cf6; border-radius: 10px; padding: 10px 14px; background: rgba(139, 92, 246, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(139,92,246,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#8b5cf6;">↔️ 가운데 정렬 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">중앙 배치</span>
          </div>
          <div class="widget-body" style="padding: 4px 0; text-align: center; font-size: 13.5px; color: var(--text-main);">
            ${escapeHtml(centerMatch[1])}
          </div>
        </div>
      `;
    }

    const condMatch = trimmed.match(/^\[(?:조건|상황|분기|IF)\s*:\s*([^\|\]]+?)\s*\|\s*([\s\S]+?)\]$/i);
    if (condMatch) {
      return `
        <div class="story-game-widget widget-condition" style="margin: 4px 0; border: 1.5px solid #06b6d4; border-radius: 10px; padding: 10px 14px; background: rgba(6, 182, 212, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(6,182,212,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:11px; font-weight:700; color:#06b6d4;">🔀 상황별 조건 분기 문단 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">조건: <code style="color:#0891b2; font-weight:700;">${escapeHtml(condMatch[1].trim())}</code></span>
          </div>
          <div class="widget-body" style="padding: 4px 0; font-size: 13px; color: var(--text-main);">
            ${escapeHtml(condMatch[2].trim())}
          </div>
        </div>
      `;
    }

    const quizMatch = trimmed.match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:\s*(.+?)\]$/i);
    if (quizMatch) {
      const parts = quizMatch[1].split('|').map((s) => s.trim());
      const topicName = parts[0] || '약초 퀴즈';
      const ansList = parts[1] || '달빛 이끼, 달빛이끼';
      const successMsg = parts[2] || '✨ 정답입니다! 수수께끼를 훌륭하게 해결했습니다.';
      let nextNode = parts[3] || '';
      let successSceneId = '';
      let failSceneId = '';

      if (parts.length >= 6) {
        nextNode = parts[3] || '';
        successSceneId = parts[4] || nextNode;
        failSceneId = parts[5] || '';
      } else if (parts.length === 5) {
        successSceneId = parts[3] || '';
        failSceneId = parts[4] || '';
        nextNode = successSceneId;
      } else {
        successSceneId = parts[3] || '';
        nextNode = successSceneId;
      }

      const parentNode = STORY_NODES[nodeId] || {};
      if (!successSceneId) successSceneId = parentNode.successSceneId || nextNode || '';
      if (!failSceneId) failSceneId = parentNode.failSceneId || '';

      const editorEpisodeId = getLiveEpisodeId();
      const episodeNodes = Object.values(STORY_NODES).filter((entry) => !editorEpisodeId || entry.episodeId === editorEpisodeId);

      return `
        <div class="story-quiz-widget" style="margin: 8px 0; border: 1.5px solid #d4af37; border-radius: 10px; padding: 12px 14px; background: rgba(212, 175, 55, 0.08);">
          <div class="quiz-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:6px; margin-bottom:10px;">
            <span class="quiz-badge-wrap" style="font-size:12.5px; font-weight:800; color:#b45309; display:flex; align-items:center; gap:6px;">
              <span>✍️ 퀴즈 정답 입력창:</span>
              <span style="color:#1e293b;">${escapeHtml(topicName)}</span>
              <span style="font-size:11px; color:#64748b; font-weight:normal;">(본문 줄 ${lineIdx + 1})</span>
            </span>
            <span class="quiz-status-pill" style="font-size:11px; color:var(--text-muted);">
              인정 정답: <code style="color:#b45309; font-weight:700;">${escapeHtml(ansList)}</code>
            </span>
          </div>

          <!-- 정답/오답 연결 장면 선택 드롭다운 영역 -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #166534; margin-bottom: 4px;">✨ 정답 시 이동 장면 (successSceneId)</label>
              <select class="author-select" data-author-field="change-quiz-branch:${escapeHtml(nodeId)}:${lineIdx}:success" style="width: 100%; font-size: 12px; padding: 5px 8px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 4px;">
                <option value="">-- 정답 시 이동 장면 선택 --</option>
                ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${successSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)} (${escapeHtml(n.id)})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #991b1b; margin-bottom: 4px;">❌ 오답 시 이동 장면 (failSceneId)</label>
              <select class="author-select" data-author-field="change-quiz-branch:${escapeHtml(nodeId)}:${lineIdx}:fail" style="width: 100%; font-size: 12px; padding: 5px 8px; background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 4px;">
                <option value="">-- 오답 시 이동 안 함 (현재 장면 유지 및 재입력) --</option>
                ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${failSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)} (${escapeHtml(n.id)})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="quiz-body" style="font-size:12px; color:var(--text-main);">
            <p style="margin:0 0 6px 0; color:#475569;">
              독자가 위 정답을 맞추면 
              <b style="color:#166534;">${successSceneId ? `[${escapeHtml(STORY_NODES[successSceneId]?.title || successSceneId)}]` : '성공 메시지 표시'}</b>(으)로, 
              틀리면 
              <b style="color:#991b1b;">${failSceneId ? `[${escapeHtml(STORY_NODES[failSceneId]?.title || failSceneId)}]` : '오답 경고 후 재입력'}</b>(으)로 진행됩니다.
            </p>
            <div style="display:flex; gap:6px;">
              <input type="text" disabled placeholder="독자가 정답을 입력할 필드 (예: ${escapeHtml(ansList.split(',')[0] || '')})" style="flex:1; padding:5px 8px; border-radius:4px; border:1px solid var(--border-subtle); background:var(--bg-card); font-size:11.5px;">
              <button type="button" disabled style="padding:4px 10px; border-radius:4px; background:#d4af37; border:none; color:#111; font-weight:700; font-size:11.5px;">확인</button>
            </div>
          </div>
        </div>
      `;
    }

    const briefingMatch = trimmed.match(/^\[(?:브리핑카드|브리핑 카드|탐사브리핑|탐사 브리핑|탐사허브|BRIEFING)(?:\s*:\s*(.*?))?\]$/i);
    if (briefingMatch) {
      const rawArgs = (briefingMatch[1] || '').trim();
      const parts = rawArgs ? rawArgs.split('|').map((s) => s.trim()) : [];
      const conclusionNodeId = parts[0] || 'story_1795161633215';
      const deductionTopic = parts[1] || '약초 퀴즈';
      const targetNodeTitle = STORY_NODES[conclusionNodeId]?.title || conclusionNodeId;
      return `
        <div class="story-game-widget widget-briefing" style="margin: 4px 0; border: 1.5px solid #3b82f6; border-radius: 10px; padding: 12px 14px; background: rgba(59, 130, 246, 0.08);">
          <div class="widget-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(59,130,246,0.2); padding-bottom:6px; margin-bottom:8px;">
            <span class="widget-badge" style="font-size:12px; font-weight:800; color:#2563eb;">🧭 아카데미 탐사 상황 브리핑 카드 (줄 ${lineIdx + 1})</span>
            <span class="widget-status" style="font-size:11px; color:var(--text-muted);">선택지 없이도 장소 이동 · 추론 모드 · 정답 맞추기 가능</span>
          </div>
          <div class="widget-body" style="font-size:12px; color:var(--text-main);">
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
              <span style="padding:4px 10px; border-radius:999px; background:var(--bg-card); border:1px solid var(--border-subtle); font-weight:600;">🔭 네블라 홀 →</span>
              <span style="padding:4px 10px; border-radius:999px; background:var(--bg-card); border:1px solid var(--border-subtle); font-weight:600;">📚 도서관 →</span>
              <span style="padding:4px 10px; border-radius:999px; background:var(--bg-card); border:1px solid var(--border-subtle); font-weight:600;">🧪 연구동 →</span>
              <span style="padding:4px 10px; border-radius:999px; background:var(--bg-card); border:1px solid var(--border-subtle); font-weight:600;">🌿 비밀 안개 정원 →</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              <span style="padding:4px 10px; border-radius:6px; background:#eff6ff; color:#1d4ed8; font-weight:700;">🧩 추론 모드 (${escapeHtml(deductionTopic)})</span>
              <span style="padding:4px 10px; border-radius:6px; background:#f8fafc; color:#334155; border:1px solid #cbd5e1; font-weight:700;">🗺️ 지도 펼치기</span>
              <span style="padding:4px 10px; border-radius:6px; background:#fef3c7; color:#92400e; border:1px solid #f59e0b; font-weight:700;">✨ 알아냈다! 정답을 맞추러 가자 → ${escapeHtml(targetNodeTitle)}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div style="padding:6px 12px; background:var(--bg-surface); border-radius:6px; font-size:12px; color:var(--text-muted); font-family:monospace;">
        ${escapeHtml(trimmed)}
      </div>
    `;
  }

  updateStoryPreview() {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node) return;

    // 1. Update detected characters
    const detectedCharacters = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const match = String(p).trim().match(/^\[(?:인물|캐릭터|CHARACTER|PERSON)\s*:\s*(.+?)\]$/i);
      if (match) {
        const parts = match[1].split('|').map((s) => s.trim());
        const nameOrId = parts[0] || '미지의 인물';
        const desc = parts[1] || '';
        const icon = parts[2] || '👤';
        const existing = CODEX_DATA.find((c) => c.category === 'character' && (c.id === nameOrId || c.title === nameOrId || (c.keywords && c.keywords.includes(nameOrId))));
        detectedCharacters.push({
          lineIndex: idx,
          id: existing ? existing.id : nameOrId,
          title: existing ? existing.title : nameOrId,
          desc: desc || (existing ? (existing.summary || existing.description) : ''),
          icon: icon || (existing ? existing.icon : '👤'),
          image: existing?.image || '',
          raw: p
        });
      }
    });

    const charListContainer = this.content?.querySelector('.author-detected-characters-container');
    const charCountBadge = this.content?.querySelector('.author-scene-char-count');
    if (charCountBadge) {
      charCountBadge.textContent = `${detectedCharacters.length}명`;
    }
    if (charListContainer) {
      charListContainer.innerHTML = detectedCharacters.length > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
          ${detectedCharacters.map((char) => `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 10px;">
              <div style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: #fff; border: 1.5px solid #60a5fa; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">
                ${(char.icon && char.icon.includes('/')) || (char.image && char.image.includes('/'))
                  ? `<img src="${escapeHtml(char.icon && char.icon.includes('/') ? char.icon : char.image)}" alt="" style="width: 100%; height: 100%; object-fit: contain;">`
                  : escapeHtml(char.icon || '👤')}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(char.title)}</strong>
                  <span style="font-size: 10px; padding: 1px 5px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-radius: 4px; font-weight: 600;">등장 중</span>
                </div>
                <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(char.desc || '소개 없음')}</p>
              </div>
              <button type="button" class="author-action is-danger" data-author-action="remove-character-from-story:${char.lineIndex}" title="본문에서 이 인물 태그 삭제" style="padding: 4px 8px; font-size: 11px;">삭제</button>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px dashed var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
          현재 이 장면에 등록된 인물이 없습니다. 위 [인물 선택하여 본문에 추가...]에서 인물을 골라 추가해 보세요.
        </div>
      `;
    }

    // 1.5. Update detected items
    const detectedItems = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const match = String(p).trim().match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
      if (match) {
        const parts = match[1].split('|').map((s) => s.trim());
        const rawIdOrName = parts[0] || '미확인 물품';
        const existing = INVENTORY_ITEMS.find((i) => i.id === rawIdOrName || i.name === rawIdOrName);
        detectedItems.push({
          lineIndex: idx,
          id: existing ? existing.id : rawIdOrName,
          name: existing ? existing.name : rawIdOrName,
          desc: parts[1] || (existing ? existing.desc : '본문에서 획득하는 소지품'),
          icon: parts[2] || (existing ? existing.icon : '🎁')
        });
      }
    });

    const itemListContainer = this.content?.querySelector('.author-detected-items-container');
    const itemCountBadge = this.content?.querySelector('.author-scene-item-count');
    if (itemCountBadge) {
      itemCountBadge.textContent = `${detectedItems.length}개`;
    }
    if (itemListContainer) {
      itemListContainer.innerHTML = detectedItems.length > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
          ${detectedItems.map((it) => `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px;">
              <div style="width: 38px; height: 38px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.2); border: 1.5px solid #d4af37; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">
                ${(it.icon && it.icon.includes('/'))
                  ? `<img src="${escapeHtml(it.icon)}" alt="" style="width: 100%; height: 100%; object-fit: contain;">`
                  : escapeHtml(it.icon || '🎁')}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(it.name)}</strong>
                  <span style="font-size: 10px; padding: 1px 5px; background: rgba(212, 175, 55, 0.15); color: #d4af37; border-radius: 4px; font-weight: 600;">획득 중</span>
                </div>
                <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(it.desc || '설명 없음')}</p>
              </div>
              <button type="button" class="author-action is-danger" data-author-action="remove-item-from-story:${it.lineIndex}" title="본문에서 이 아이템 태그 삭제" style="padding: 4px 8px; font-size: 11px;">삭제</button>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px dashed var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
          현재 이 장면에 획득 등록된 소지품이 없습니다. 위 [+ 소지품 선택하여 본문에 추가...]에서 아이템을 골라 추가해 보세요.
        </div>
      `;
    }

    // 2. Update live preview widgets
    const previewWidgets = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const trimmed = String(p).trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        previewWidgets.push({ line: idx, text: trimmed });
      }
    });

    const previewListContainer = this.content?.querySelector('.author-preview-widgets-container');
    const previewCountBadge = this.content?.querySelector('.author-preview-widget-count');
    if (previewCountBadge) {
      previewCountBadge.textContent = `${previewWidgets.length}개`;
    }
    if (previewListContainer) {
      previewListContainer.innerHTML = previewWidgets.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${previewWidgets.map((w) => this.renderWidgetPreview(w.text, node.id, w.line)).join('')}
        </div>
      ` : `
        <div style="padding: 10px; background: var(--bg-surface); border-radius: 8px; text-align: center; font-size: 12px; color: var(--text-muted);">
          본문에 삽입된 게임 위젯([인물], [아이템], [스탯] 등)이 없습니다.
        </div>
      `;
    }
  }

  updateQuizBranch(nodeId, lineIdx, branchType, sceneId) {
    const node = STORY_NODES[nodeId];
    if (!node || !node.paragraphs) return;

    let targetIdx = lineIdx;
    let line = node.paragraphs[targetIdx];
    if (!line || !line.match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:/i)) {
      targetIdx = node.paragraphs.findIndex(p => p.match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:/i));
      if (targetIdx === -1) return;
      line = node.paragraphs[targetIdx];
    }

    const match = line.match(/^\[((?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ))\s*:\s*(.+?)\]$/i);
    if (!match) return;

    const tagPrefix = match[1];
    const parts = match[2].split('|').map(s => s.trim());
    const topicName = parts[0] || '약초 퀴즈';
    const ansList = parts[1] || '';
    const successMsg = parts[2] || '✨ 정답입니다! 수수께끼를 훌륭하게 해결했습니다.';
    let nextNode = parts[3] || '';
    let successScene = '';
    let failScene = '';

    if (parts.length >= 6) {
      nextNode = parts[3] || '';
      successScene = parts[4] || nextNode;
      failScene = parts[5] || '';
    } else if (parts.length === 5) {
      successScene = parts[3] || '';
      failScene = parts[4] || '';
      nextNode = successScene;
    } else {
      successScene = parts[3] || '';
      nextNode = successScene;
    }

    if (!successScene) successScene = node.successSceneId || nextNode || '';
    if (!failScene) failScene = node.failSceneId || '';

    if (branchType === 'success') {
      successScene = sceneId || '';
      nextNode = successScene || nextNode;
      if (successScene) node.successSceneId = successScene;
      else delete node.successSceneId;
    } else if (branchType === 'fail') {
      failScene = sceneId || '';
      if (failScene) node.failSceneId = failScene;
      else delete node.failSceneId;
    }

    node.paragraphs[targetIdx] = `[${tagPrefix}: ${topicName} | ${ansList} | ${successMsg} | ${successScene || nextNode} | ${successScene} | ${failScene}]`;

    const textarea = this.content?.querySelector(`[data-author-field="storyParagraphs"]`);
    if (textarea) {
      textarea.value = node.paragraphs.join('\n');
    }

    const succSelects = this.content?.querySelectorAll(`select[data-author-field="storySuccessSceneId"]`);
    succSelects?.forEach(s => {
      const nid = s.dataset.quickEditNodeId || this.selectedStoryNodeId;
      if (nid === nodeId) s.value = successScene;
    });
    const failSelects = this.content?.querySelectorAll(`select[data-author-field="storyFailSceneId"]`);
    failSelects?.forEach(s => {
      const nid = s.dataset.quickEditNodeId || this.selectedStoryNodeId;
      if (nid === nodeId) s.value = failScene;
    });

    this.schedulePersist();
    this.updateStoryPreview();

    if (this.storyViewMode === 'graph') {
      this.updateGraphSvgLines();
    }
  }

  syncQuizTagsWithNodeBranches(node) {
    if (!node || !node.paragraphs) return;
    let changed = false;
    node.paragraphs = node.paragraphs.map(p => {
      const m = p.match(/^\[((?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ))\s*:\s*(.+?)\]$/i);
      if (!m) return p;
      const tagPrefix = m[1];
      const parts = m[2].split('|').map(s => s.trim());
      const topicName = parts[0] || '약초 퀴즈';
      const ansList = parts[1] || '';
      const successMsg = parts[2] || '✨ 정답입니다! 수수께끼를 훌륭하게 해결했습니다.';
      const nextNode = parts[3] || node.successSceneId || '';
      const succ = node.successSceneId || nextNode;
      const fail = node.failSceneId || '';
      changed = true;
      return `[${tagPrefix}: ${topicName} | ${ansList} | ${successMsg} | ${succ || nextNode} | ${succ} | ${fail}]`;
    });
    if (changed) {
      const textarea = this.content?.querySelector(`[data-author-field="storyParagraphs"]`);
      if (textarea) {
        textarea.value = node.paragraphs.join('\n');
      }
      this.schedulePersist();
      this.updateStoryPreview();
      if (this.storyViewMode === 'graph') {
        this.updateGraphSvgLines();
      }
    }
  }

  getActiveSceneId(explicitSceneId = null) {
    if (explicitSceneId && INVESTIGATION_SCENES[explicitSceneId]) {
      return explicitSceneId;
    }
    if (this.activeTab === 'map') {
      return this.selectedLocationId || this.selectedInvestigationSceneId || Object.keys(INVESTIGATION_SCENES)[0] || '';
    }
    return this.selectedInvestigationSceneId || this.selectedLocationId || Object.keys(INVESTIGATION_SCENES)[0] || '';
  }

  handleField(event) {
    const control = event.target.closest('[data-author-field], [data-author-action^="move-"], [data-author-book-topic]');
    if (!control) return;
    const name = control.dataset.authorField || control.dataset.authorAction;
    const value = control.type === 'checkbox' ? control.checked : control.value;

    if (name?.startsWith('change-quiz-branch:')) {
      const parts = name.split(':');
      const nodeId = parts[1];
      const lineIdx = Number(parts[2]);
      const branchType = parts[3];
      this.updateQuizBranch(nodeId, lineIdx, branchType, value);
      return;
    }

    if (control.dataset.authorBookTopic || control.matches('.author-book-topic-select')) {
      const key = control.dataset.authorBookTopic;
      const targetSelect = this.content?.querySelector(`[data-author-book-subitem="${key}"]`);
      if (targetSelect) {
        const topic = CODEX_DATA.find((c) => c.title === value && (c.category === 'clue' || c.subItems || c.subClues));
        const subs = topic?.subItems || [];
        targetSelect.innerHTML = `<option value="__new__">+ 새 세부타일 직접 작성</option>` +
          subs.map((s, idx) => `<option value="${idx}">${escapeHtml(s.label || s.title || `세부타일 #${idx + 1}`)}</option>`).join('');
      }
      return;
    }

    if (name === 'editorEpisodeSelect') {
      this.switchEpisode(value);
      return;
    }

    if (name === 'characterSearch') {
      this.filterCharacterRoster(value);
      return;
    }

    if (name === 'itemSearch') {
      this.filterItemRoster(value);
      return;
    }

    if (name === 'storyNodeSelect') {
      this.selectedStoryNodeId = value;
      this.render();
      return;
    }
    if (name === 'characterSelect') {
      this.selectedCharacterId = value;
      this.render();
      return;
    }
    if (name === 'locationSelect') {
      this.selectedLocationId = value;
      this.selectedHotspotIndex = 0;
      this.render();
      return;
    }
    if (name === 'investigationSceneSelect') {
      this.selectedInvestigationSceneId = value;
      this.selectedHotspotIndex = 0;
      this.render();
      return;
    }
    if (name === 'memoSelect') {
      this.selectedMemoId = value;
      this.render();
      return;
    }
    if (name === 'itemSelect') {
      this.selectedItemId = value;
      this.render();
      return;
    }
    if (name === 'emptyTileSelect') {
      this.emptyTileKey = value;
      return;
    }

    const isTextTyping = event.type === 'input' && (control.tagName === 'INPUT' || control.tagName === 'TEXTAREA') && control.type !== 'checkbox' && control.type !== 'radio';

    const shouldRender = this.updateField(control, value, isTextTyping);

    if (isTextTyping) {
      this.schedulePersist();
    } else {
      this.flushPersist();
      const refreshStoryIndex = event.type === 'change' &&
        ['episodeTitle', 'storyNodeTitle', 'storyChapter', 'storyLocationName'].includes(name);
      if (shouldRender || refreshStoryIndex) this.render();
    }
  }

  updateField(control, value, isTextTyping = false) {
    const name = control.dataset.authorField;
    const targetNodeId = control.dataset.quickEditNodeId || this.selectedStoryNodeId;
    if (name === 'storyCompletesEpisode') {
      const target = STORY_NODES[targetNodeId];
      if (target) target.completesEpisode = Boolean(value);
      return false;
    }
    if (name === 'storyReturnToHub') {
      const target = STORY_NODES[targetNodeId];
      if (target) target.returnToHub = Boolean(value);
      return false;
    }
    if (name === 'storySuccessSceneId') {
      const target = STORY_NODES[targetNodeId];
      if (target) {
        if (value) target.successSceneId = value;
        else delete target.successSceneId;
        this.syncQuizTagsWithNodeBranches(target);
      }
      return false;
    }
    if (name === 'storyFailSceneId') {
      const target = STORY_NODES[targetNodeId];
      if (target) {
        if (value) target.failSceneId = value;
        else delete target.failSceneId;
        this.syncQuizTagsWithNodeBranches(target);
      }
      return false;
    }
    if (name === 'episodeTitle' || name === 'storyNodeTitle' || name === 'storyChapter' ||
        name === 'storyLocationName' || name === 'storySummary' || name === 'storyParagraphs' || name === 'storyIsHubNode') {
      const node = STORY_NODES[targetNodeId];
      if (!node) return false;
      if (name === 'episodeTitle') {
        const episode = STORY_EPISODES[node.episodeId];
        if (episode) episode.title = value;
      } else if (name === 'storyNodeTitle') node.title = value;
      else if (name === 'storyChapter') node.chapter = value;
      else if (name === 'storyLocationName') node.locationName = value;
      else if (name === 'storySummary') node.summary = value;
      else if (name === 'storyIsHubNode') {
        node.isHubNode = Boolean(value);
        const ep = STORY_EPISODES[node.episodeId];
        if (ep && Boolean(value)) {
          ep.hubNode = node.id;
        }
      }
      else {
        node.paragraphs = value.split(/\r?\n/).filter((paragraph) => paragraph.length > 0);
        if (isTextTyping) {
          this.scheduleStoryPreview();
        } else {
          this.updateStoryPreview();
        }
      }
      return false;
    }
    if (name === 'choiceSuccessSceneId') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        if (value) choice.successSceneId = value;
        else delete choice.successSceneId;
      }
      return false;
    }
    if (name === 'choiceFailSceneId') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        if (value) choice.failSceneId = value;
        else delete choice.failSceneId;
      }
      return false;
    }
    if (name === 'choiceHideIfChosen') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        choice.hideIfChosen = Boolean(value);
      }
      return false;
    }
    if (name === 'choiceReturnToHub') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        choice.returnToHub = Boolean(value);
      }
      return false;
    }
    if (name === 'choiceRequiresFlags') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        const raw = String(value || '').trim();
        if (raw) {
          choice.requiresFlags = raw.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          delete choice.requiresFlags;
        }
      }
      return false;
    }
    if (name === 'choiceLockBehavior') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        choice.lockBehavior = value;
      }
      return false;
    }
    if (name === 'choiceSetFlags') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        const raw = String(value || '').trim();
        if (raw) {
          choice.setFlags = raw.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          delete choice.setFlags;
        }
      }
      return false;
    }
    if (name === 'choiceIsConclusion') {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (choice) {
        choice.isConclusionChoice = Boolean(value);
      }
      return false;
    }
    if (name === 'choiceText' || name === 'choiceDesc' || name === 'choiceTarget' || name.startsWith('choiceStat:')) {
      const node = STORY_NODES[targetNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (!choice) return false;
      if (name === 'choiceText') choice.text = value;
      else if (name === 'choiceDesc') {
        if (value && value.trim()) choice.desc = value.trim();
        else delete choice.desc;
      }
      else if (name === 'choiceTarget') {
        const [targetType, targetId] = value.split(':');
        if (targetType === 'scene') {
          choice.isInvestigationTrigger = true;
          choice.locationId = targetId;
          delete choice.isOpenMapTrigger;
          delete choice.mapLocationId;
        } else if (targetType === 'action' && targetId === 'open_map') {
          choice.isOpenMapTrigger = true;
          choice.nextNode = 'action:open_map';
          delete choice.isInvestigationTrigger;
          delete choice.locationId;
          delete choice.mapLocationId;
        } else if (targetType === 'map_loc') {
          choice.isOpenMapTrigger = true;
          choice.mapLocationId = targetId;
          choice.nextNode = `map_loc:${targetId}`;
          delete choice.isInvestigationTrigger;
          delete choice.locationId;
        } else {
          delete choice.isInvestigationTrigger;
          delete choice.locationId;
          delete choice.isOpenMapTrigger;
          delete choice.mapLocationId;
          choice.nextNode = targetId;
        }
      } else {
        const stat = name.split(':')[1];
        const amount = Number(value);
        choice.effects ||= {};
        choice.effects.rewardStat ||= {};
        if (stat === 'social') delete choice.effects.rewardStat.persuasion;
        if (amount) choice.effects.rewardStat[stat] = amount;
        else delete choice.effects.rewardStat[stat];
        if (Object.keys(choice.effects.rewardStat).length === 0) delete choice.effects.rewardStat;
        if (Object.keys(choice.effects).length === 0) delete choice.effects;
      }
      return name === 'choiceTarget';
    }
    if (name === 'subitemTopic') {
      this.selectedSubItemTopic = value;
      this.selectedSubItemIndex = 0;
      const scopeWrap = control.closest('[data-toolbar-target]') || this.content;
      const targetSelect = scopeWrap?.querySelector('[data-author-field="subitemTarget"]') ||
                           this.content?.querySelector('[data-author-field="subitemTarget"]');
      if (targetSelect) {
        const topic = CODEX_DATA.find((c) => c.title === value && (c.category === 'clue' || c.subItems || c.subClues));
        const subs = topic?.subItems || [];
        targetSelect.innerHTML = `<option value="__new__">+ 새 세부타일 직접 작성</option>` +
          subs.map((s, idx) => `<option value="${idx}">${escapeHtml(s.label || s.title || `세부타일 #${idx + 1}`)}</option>`).join('');
      }
      return false;
    }
    if (name === 'subitemTarget') {
      this.selectedSubItemIndex = value === '__new__' ? '__new__' : Number(value);
      return false;
    }
    if (name === 'toolbarTopicSelect' || name === 'toolbarClueSelect' || name === 'toolbarItemSelect' || name === 'toolbarCharacterSelect' || name === 'storyRecordSelect') {
      return false;
    }
    if (name === 'tileSearchQuery') {
      this.tileSearchQuery = value;
      this.render();
      return false;
    }
    if (name === 'tileFilterRole') {
      this.tileFilterRole = value;
      this.render();
      return false;
    }
    if (name === 'moveSubClueParent' || control.dataset.authorAction === 'move-subclue-parent') {
      this.moveSubClueParent(control.dataset.parentId, Number(control.dataset.index), value);
      return false;
    }
    if (name === 'moveSubItemParent' || control.dataset.authorAction === 'move-subitem-parent') {
      this.moveSubItemParent(control.dataset.parentId, Number(control.dataset.index), value);
      return false;
    }
    if (name === 'locationName' || name === 'locationSubtitle' || name === 'locationDescription' ||
        name === 'locationIcon' || name === 'locationUnlocked' || name === 'locationHasInvestigation' ||
        name === 'locationStoryTarget' || name === 'locationTravelMode' || name === 'locationDestinationType') {
      const location = MAP_LOCATIONS.find((entry) => entry.id === this.selectedLocationId);
      if (!location) return false;
      if (name === 'locationName') location.name = value;
      else if (name === 'locationSubtitle') location.subtitle = value;
      else if (name === 'locationDescription') location.description = value;
      else if (name === 'locationIcon') location.icon = value;
      else if (name === 'locationUnlocked') location.unlocked = value;
      else if (name === 'locationDestinationType') {
        location.destinationType = value;
        location.travelMode = value;
        if (value === 'investigation') {
          location.hasInvestigation = true;
          if (!INVESTIGATION_SCENES[location.id]) {
            INVESTIGATION_SCENES[location.id] = this.createScene(location);
          }
        } else if (value === 'story') {
          if (!location.targetStoryNode) {
            location.targetStoryNode = Object.keys(STORY_NODES)[0] || '';
          }
        }
        return true;
      }
      else if (name === 'locationTravelMode') {
        location.travelMode = value;
        location.destinationType = value;
      }
      else if (name === 'locationHasInvestigation') {
        location.hasInvestigation = value;
        if (value && !INVESTIGATION_SCENES[location.id]) {
          INVESTIGATION_SCENES[location.id] = this.createScene(location);
        }
      } else if (name === 'locationStoryTarget') {
        if (value) {
          location.targetStoryNode = value;
          location.destinationType = 'story';
          location.travelMode = 'story';
        } else {
          delete location.targetStoryNode;
        }
      }
      return name === 'locationHasInvestigation' || name === 'locationTravelMode' || name === 'locationStoryTarget' || name === 'locationDestinationType';
    }
    if (name === 'tileQ' || name === 'tileR' || name === 'tileBuilding' || name === 'tileImage') {
      const tile = MAP_TILES.find((entry) => entry.locationId === this.selectedLocationId);
      if (!tile) return false;
      if (name === 'tileQ' || name === 'tileR') {
        const coordinate = Number.parseInt(value, 10);
        if (!Number.isNaN(coordinate)) tile[name === 'tileQ' ? 'q' : 'r'] = coordinate;
      } else if (name === 'tileBuilding') tile.building = value;
      else if (value) tile.image = value;
      else delete tile.image;
      return false;
    }
    if (name.startsWith('investigationScene')) {
      const sceneId = this.getActiveSceneId();
      const scene = INVESTIGATION_SCENES[sceneId];
      if (!scene) return false;
      if (name === 'investigationSceneTitle') scene.title = value;
      else if (name === 'investigationSceneSubtitle') scene.subtitle = value;
      else if (name === 'investigationSceneBgImage') scene.bgImage = value;
      else if (name === 'investigationSceneExitStoryNode') scene.exitStoryNode = value;
      return !isTextTyping && name === 'investigationSceneTitle';
    }
    if (name.startsWith('scene:')) {
      const sceneId = this.getActiveSceneId();
      const scene = INVESTIGATION_SCENES[sceneId];
      if (!scene) return false;
      const key = name.split(':')[1];
      scene[key] = value;
      return false;
    }
    if (name.startsWith('dialogueOptionText:')) {
      const parts = name.split(':');
      let sceneId, hotspotIndex, nodeKey;
      if (parts.length >= 4) {
        sceneId = parts[1];
        hotspotIndex = Number(parts[2]);
        nodeKey = parts[3];
      } else {
        sceneId = this.getActiveSceneId();
        hotspotIndex = Number(parts[1]);
        nodeKey = parts[2];
      }
      const scene = INVESTIGATION_SCENES[sceneId];
      const hotspot = scene?.hotspots?.[hotspotIndex];
      const opt = hotspot?.dialogueTree?.start?.options?.find((o) => o.nextNode === nodeKey)
                  || hotspot?.dialogueTree?.start?.options?.[Number(nodeKey)];
      if (opt) opt.text = value;
      return false;
    }
    if (name.startsWith('dialogueAnswerText:')) {
      const parts = name.split(':');
      let sceneId, hotspotIndex, nodeKey;
      if (parts.length >= 4) {
        sceneId = parts[1];
        hotspotIndex = Number(parts[2]);
        nodeKey = parts[3];
      } else {
        sceneId = this.getActiveSceneId();
        hotspotIndex = Number(parts[1]);
        nodeKey = parts[2];
      }
      const scene = INVESTIGATION_SCENES[sceneId];
      const hotspot = scene?.hotspots?.[hotspotIndex];
      const answerNode = hotspot?.dialogueTree?.[nodeKey]
                         || (hotspot?.dialogueTree?.start?.options?.[Number(nodeKey)]?.nextNode
                             && hotspot.dialogueTree[hotspot.dialogueTree.start.options[Number(nodeKey)].nextNode]);
      if (answerNode) {
        answerNode.text = value;
      }
      this.updateInlineWidgetPreview(control);
      return false;
    }
    if (name.startsWith('dialogueReqStatKey:')) {
      const parts = name.split(':');
      let sceneId, hotspotIndex, nodeKey;
      if (parts.length >= 4) {
        sceneId = parts[1];
        hotspotIndex = Number(parts[2]);
        nodeKey = parts[3];
      } else {
        sceneId = this.getActiveSceneId();
        hotspotIndex = Number(parts[1]);
        nodeKey = parts[2];
      }
      const scene = INVESTIGATION_SCENES[sceneId];
      const hotspot = scene?.hotspots?.[hotspotIndex];
      const opt = hotspot?.dialogueTree?.start?.options?.find((o) => o.nextNode === nodeKey)
                  || hotspot?.dialogueTree?.start?.options?.[Number(nodeKey)];
      if (opt) {
        if (!value) {
          if (opt.condition?.stat) {
            delete opt.condition.stat;
            if (Object.keys(opt.condition).length === 0) delete opt.condition;
          }
        } else {
          opt.condition = opt.condition || {};
          const prevVal = opt.condition.stat ? Object.values(opt.condition.stat)[0] : 5;
          opt.condition.stat = { [value]: Number(prevVal) || 5 };
        }
      }
      return !isTextTyping;
    }
    if (name.startsWith('dialogueReqStatVal:')) {
      const parts = name.split(':');
      let sceneId, hotspotIndex, nodeKey;
      if (parts.length >= 4) {
        sceneId = parts[1];
        hotspotIndex = Number(parts[2]);
        nodeKey = parts[3];
      } else {
        sceneId = this.getActiveSceneId();
        hotspotIndex = Number(parts[1]);
        nodeKey = parts[2];
      }
      const scene = INVESTIGATION_SCENES[sceneId];
      const hotspot = scene?.hotspots?.[hotspotIndex];
      const opt = hotspot?.dialogueTree?.start?.options?.find((o) => o.nextNode === nodeKey)
                  || hotspot?.dialogueTree?.start?.options?.[Number(nodeKey)];
      if (opt) {
        opt.condition = opt.condition || {};
        const currentStatKey = opt.condition.stat ? Object.keys(opt.condition.stat)[0] : 'perception';
        const num = Math.max(1, Number(value) || 1);
        opt.condition.stat = { [currentStatKey]: num };
      }
      return false;
    }
    if (name.startsWith('bookPageIndexTitle:')) {
      const parts = name.split(':');
      const hsIdx = Number(parts[1]);
      const pgIdx = Number(parts[2]);
      const sceneId = this.getActiveSceneId();
      const scene = INVESTIGATION_SCENES[sceneId];
      if (scene?.hotspots?.[hsIdx]?.pages?.[pgIdx]) {
        scene.hotspots[hsIdx].pages[pgIdx].indexTitle = value;
      }
      return false;
    }
    if (name.startsWith('bookPageTitle:')) {
      const parts = name.split(':');
      const hsIdx = Number(parts[1]);
      const pgIdx = Number(parts[2]);
      const sceneId = this.getActiveSceneId();
      const scene = INVESTIGATION_SCENES[sceneId];
      if (scene?.hotspots?.[hsIdx]?.pages?.[pgIdx]) {
        scene.hotspots[hsIdx].pages[pgIdx].pageTitle = value;
      }
      return false;
    }
    if (name.startsWith('bookPageContent:')) {
      const parts = name.split(':');
      const hsIdx = Number(parts[1]);
      const pgIdx = Number(parts[2]);
      const sceneId = this.getActiveSceneId();
      const scene = INVESTIGATION_SCENES[sceneId];
      if (scene?.hotspots?.[hsIdx]?.pages?.[pgIdx]) {
        scene.hotspots[hsIdx].pages[pgIdx].content = value;
      }
      this.updateInlineWidgetPreview(control);
      return false;
    }
    if (name.startsWith('hotspot:')) {
      const sceneId = this.getActiveSceneId();
      const scene = INVESTIGATION_SCENES[sceneId];
      const hotspot = scene?.hotspots?.[Number(control.dataset.hotspotIndex)];
      if (!hotspot) return false;
      const key = name.split(':')[1];
      if (key === 'memoId') {
        hotspot.memoId = value;
      } else if (key === 'itemId' || key === 'grantsItemId') {
        if (value) hotspot[key] = value;
        else delete hotspot[key];
      } else if (key === 'grantsRecordId') {
        if (value) hotspot.grantsRecordId = value;
        else delete hotspot.grantsRecordId;
      } else if (key === 'grantsSubItemId' || key === 'unlockSubItemId') {
        if (value) hotspot.grantsSubItemId = value;
        else delete hotspot.grantsSubItemId;
      } else if (key === 'requiresItem') {
        if (value) hotspot.requiresItem = value;
        else delete hotspot.requiresItem;
      } else if (key === 'x' || key === 'y') {
        const coordinate = Number(value);
        if (Number.isFinite(coordinate)) hotspot.coords[key] = coordinate;
      } else if (key === 'type') {
        hotspot.type = value;
        if (value === 'character' && !hotspot.dialogueTree) {
          const now = Date.now();
          const qKey = `q_${now}`;
          hotspot.dialogueTree = {
            start: {
              speaker: hotspot.characterName || hotspot.title || '인물',
              text: '“무슨 용무인가요?”',
              options: [
                { text: '어젯밤 일에 대해 묻는다.', nextNode: qKey },
                { text: '대화를 마친다.', nextNode: 'exit' }
              ]
            },
            [qKey]: {
              speaker: hotspot.characterName || hotspot.title || '인물',
              text: '“글쎄요, 저도 잘 모르는 일입니다만…….”',
              options: [
                { text: '다른 질문을 한다.', nextNode: 'start' },
                { text: '대화를 마친다.', nextNode: 'exit' }
              ]
            }
          };
        } else if (value === 'book' && (!hotspot.pages || hotspot.pages.length === 0)) {
          hotspot.icon = '📖';
          hotspot.pages = [
            {
              indexTitle: '1장: 개요',
              pageTitle: '제1장. 기록의 시작',
              content: '책의 첫 번째 쪽 내용입니다.'
            }
          ];
        }
      } else if (key === 'applyExistingCharacter') {
        const char = CODEX_DATA.find((c) => c.category === 'character' && c.id === value);
        if (char) {
          hotspot.characterId = char.id;
          hotspot.characterName = char.title;
          hotspot.characterRole = char.role || char.summary || '등장인물';
          hotspot.image = char.image || char.avatar || '';
          hotspot.icon = char.icon || '👤';
          hotspot.title = char.title;
          hotspot.memoId = char.id;
          if (hotspot.dialogueTree) {
            Object.values(hotspot.dialogueTree).forEach((node) => {
              if (node && node.speaker) node.speaker = char.title;
            });
          }
          if (!hotspot.monologue || hotspot.monologue.includes('레이든의 생각') || hotspot.monologue.includes('독백을 입력하세요')) {
            hotspot.monologue = `(${char.title}다. 중요한 단서에 대해 물어보자.)`;
          }
          this.setStatus(`[${char.title}] 인물 정보를 대화 지점에 적용했습니다.`);
          return true;
        }
      } else if (key === 'dialogueText') {
        hotspot.dialogueTree ||= { start: { speaker: hotspot.characterName || hotspot.title || '인물', options: [] } };
        hotspot.dialogueTree.start ||= { speaker: hotspot.characterName || hotspot.title || '인물', options: [] };
        hotspot.dialogueTree.start.text = value;
        this.updateInlineWidgetPreview(control);
      } else if (key === 'characterName') {
        hotspot.characterName = value;
        if (hotspot.dialogueTree?.start) hotspot.dialogueTree.start.speaker = value;
      } else {
        hotspot[key] = value;
        if (key === 'inspectText' || key === 'monologue' || key === 'lockedText') {
          this.updateInlineWidgetPreview(control);
        }
      }
      return key === 'type' || key === 'applyExistingCharacter';
    }
    if (name.startsWith('tileSubClue:') || name.startsWith('subClue:')) {
      const parentId = control.dataset.parentId || this.selectedMemoId;
      const entry = CODEX_DATA.find((item) => item.id === parentId);
      const subClueIndex = Number(control.dataset.index ?? control.dataset.subclueIndex);
      const subClue = entry?.subClues?.[subClueIndex];
      if (!subClue) return false;
      const key = name.split(':')[1];
      if (key === 'validTargets' || key === 'invalidTargets') {
        subClue[key] = value.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (key === 'unlockedByDefault') {
        subClue.unlockedByDefault = value;
      } else {
        subClue[key] = value;
      }
      return !isTextTyping && (key === 'label' || key === 'unlockedByDefault');
    }
    if (name.startsWith('tileSubItem:') || name.startsWith('subItem:')) {
      const parentId = control.dataset.parentId || this.selectedMemoId;
      const entry = CODEX_DATA.find((item) => item.id === parentId);
      const subItemIndex = Number(control.dataset.index ?? control.dataset.subitemIndex);
      const sub = entry?.subItems?.[subItemIndex];
      if (!sub) return false;
      const key = name.split(':')[1];
      if (key === 'unlockedByDefault') {
        sub.unlockedByDefault = Boolean(value);
      } else {
        sub[key] = value;
      }
      return !isTextTyping && (key === 'label');
    }
    if (name.startsWith('subItemRecord:')) {
      const parentId = control.dataset.parentId || this.selectedMemoId;
      const entry = CODEX_DATA.find((item) => item.id === parentId);
      const sub = entry?.subItems?.[Number(control.dataset.subitemIndex)];
      const record = sub?.records?.[Number(control.dataset.recordIndex)];
      if (!record) return false;
      const key = name.split(':')[1];
      if (key === 'unlockedByDefault') {
        record.unlockedByDefault = Boolean(value);
      } else {
        record[key] = value;
      }
      return false;
    }
    if (name.startsWith('character:')) {
      const char = CODEX_DATA.find((item) => item.id === this.selectedCharacterId && item.category === 'character');
      if (!char) return false;
      const key = name.split(':')[1];
      if (key === 'unlockedByDefault') {
        char.unlockedByDefault = Boolean(value);
      } else {
        char[key] = value;
      }
      this.updateCharacterLivePreview(char);
      return !isTextTyping && (key === 'title' || key === 'icon' || key === 'image');
    }
    if (name.startsWith('memoTile:') || name.startsWith('memo:')) {
      const memoId = control.dataset.memoId || this.selectedMemoId;
      const entry = CODEX_DATA.find((item) => item.id === memoId);
      if (!entry) return false;
      const key = name.split(':')[1];
      if (key === 'keywords') entry.keywords = value.split(/\r?\n/).filter(Boolean);
      else if (key === 'subItems') {
        entry.subItems = value.split(/\r?\n/).filter(Boolean).map((line, index) => {
          const parts = line.split('|').map((s) => s.trim());
          const label = parts[0] || `세부 키워드 ${index + 1}`;
          const desc = parts.slice(1).join('|').trim();
          const existing = entry.subItems?.find((s) => s.label === label) || entry.subItems?.[index];
          return {
            ...(existing || {}),
            id: existing?.id || `${entry.id}_keyword_${index + 1}`,
            label,
            sub: existing?.sub || '키워드',
            desc: desc || existing?.desc || label,
            unlockedByDefault: existing?.unlockedByDefault ?? true
          };
        });
        return true;
      } else if (key === 'unlockedByDefault') entry.unlockedByDefault = Boolean(value);
      else if (key === 'answers') {
        entry.answers = value.split(',').map((s) => s.trim()).filter(Boolean);
        return false;
      } else {
        entry[key] = value;
        if (key === 'category') this.ensureMemoCategory(value);
      }
      return key === 'category';
    }
    if (name.startsWith('recipe:')) {
      const recipeKey = control.dataset.recipeKey;
      const recipe = CLUE_RECIPES[recipeKey];
      if (!recipe) return false;
      const key = name.split(':')[1];
      if (key === 'first' || key === 'second') {
        const first = this.panel.querySelector(`[data-recipe-key="${CSS.escape(recipeKey)}"][data-author-field="recipe:first"]`)?.value;
        const second = this.panel.querySelector(`[data-recipe-key="${CSS.escape(recipeKey)}"][data-author-field="recipe:second"]`)?.value;
        if (first && second && first !== second) {
          const newKey = [first, second].sort().join('+');
          if (newKey !== recipeKey) {
            delete CLUE_RECIPES[recipeKey];
            CLUE_RECIPES[newKey] = recipe;
            return true;
          }
        }
      } else recipe[key === 'description' ? 'desc' : key] = value;
      return false;
    }
    if (name.startsWith('item:')) {
      const item = INVENTORY_ITEMS.find((entry) => entry.id === this.selectedItemId);
      if (!item) return false;
      const key = name.split(':')[1];
      const oldName = item.name;
      const oldDesc = item.desc;
      const oldIcon = item.icon;
      if (key === 'category') {
        item.category = value;
        item.type = ITEM_CATEGORIES.find((category) => category.id === value)?.type || 'item';
      } else {
        item[key] = value;
      }
      this.syncItemToStoryAndScenes(item, oldName, oldDesc, oldIcon);
      this.updateItemLivePreview(item);
      return !isTextTyping && (key === 'name' || key === 'icon' || key === 'category');
    }
    return false;
  }

  getAllTileRecords() {
    const list = [];
    CODEX_DATA.forEach((entry) => {
      (entry.subItems || []).forEach((sub) => {
        (sub.records || []).forEach((rec) => {
          list.push({
            tileLabel: sub.label || sub.id,
            tileId: sub.id,
            recordId: rec.id || `rec_${sub.id}_${rec.title || '1'}`,
            text: rec.text || '(내용 없음)',
            source: rec.source || '',
            targetClueId: rec.targetClueId || '',
            determination: rec.determination || 'valid',
            unlockedByDefault: Boolean(rec.unlockedByDefault),
            parentId: entry.id,
            parentTitle: entry.title
          });
        });
      });
    });
    return list;
  }

  getAllSubItems() {
    const list = [];
    CODEX_DATA.forEach((entry) => {
      (entry.subItems || []).forEach((sub, sIdx) => {
        const id = sub.id || `${entry.id}_sub_${sIdx}`;
        sub.id ||= id;
        list.push({
          parentId: entry.id,
          parentTitle: entry.title,
          id: sub.id,
          label: sub.label || sub.title || '세부 타일',
          desc: sub.desc || sub.description || '',
          sub
        });
      });
    });
    return list;
  }

  renderStory() {
    const editorEpisodeId = getLiveEpisodeId();
    const episodeNodes = Object.values(STORY_NODES).filter((entry) => !editorEpisodeId || entry.episodeId === editorEpisodeId);
    let node = STORY_NODES[this.selectedStoryNodeId];
    if (!node || (editorEpisodeId && node.episodeId !== editorEpisodeId)) {
      node = episodeNodes[0] || STORY_NODES[Object.keys(STORY_NODES)[0]];
    }
    if (!node) return '<p>편집할 이야기가 없습니다.</p>';
    this.selectedStoryNodeId = node.id;

    const viewModeSwitcher = `
      <div class="author-story-view-modes-bar">
        <div class="author-tabs" style="margin-bottom: 0;">
          <button type="button" class="author-tab${this.storyViewMode === 'form' ? ' is-active' : ''}" data-author-action="set-story-view-mode:form">
            <span>📝 기본 편집 모드</span>
          </button>
          <button type="button" class="author-tab${this.storyViewMode === 'graph' ? ' is-active' : ''}" data-author-action="set-story-view-mode:graph">
            <span>🗺️ 연결 맵 (노드 뷰)</span>
          </button>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
          ${this.storyViewMode === 'graph'
            ? '<span>💡 카드를 드래그해 배치하고, 우측 원형 포트(➔/✨/❌)를 드래그해 다른 카드에 연결하세요. 선이나 배지를 클릭하면 분기 대상을 변경/해제할 수 있습니다.</span>'
            : '<span>💡 장면의 본문과 선택지, 정답/오답 이동 분기를 상세하게 편집합니다.</span>'}
        </div>
      </div>
    `;

    if (this.storyViewMode === 'graph') {
      return viewModeSwitcher + this.renderStoryGraph(node, episodeNodes, editorEpisodeId);
    }
    const episode = STORY_EPISODES[node.episodeId] || {};
    const episodeGroups = new Map();
    episodeNodes.forEach((entry) => {
      const episodeId = entry.episodeId || 'unassigned';
      const chapter = entry.chapter || '장 구분 없음';
      if (!episodeGroups.has(episodeId)) episodeGroups.set(episodeId, new Map());
      const chapterGroups = episodeGroups.get(episodeId);
      if (!chapterGroups.has(chapter)) chapterGroups.set(chapter, []);
      chapterGroups.get(chapter).push(entry);
    });
    const tableOfContents = Array.from(episodeGroups, ([episodeId, chapterGroups]) => {
      const episodeTitle = STORY_EPISODES[episodeId]?.title || episodeId;
      const chapters = Array.from(chapterGroups, ([chapter, entries]) => `
        <section class="author-story-toc-chapter">
          <div class="author-toc-chapter-title-row">
            <span class="author-toc-tier-chip tier-ch">중분류 · 에피소드</span>
            <h4>${escapeHtml(chapter)}</h4>
          </div>
          ${entries.map((entry) => {
            const choices = entry.choices || [];
            const isSelected = entry.id === node.id;
            const choiceSummary = choices.length ? choices.map(c => (c.isOpenMapTrigger ? `🗺️ ${c.text}` : `➔ ${c.text}`)).join(' | ') : '선택지 없음';
            return `
              <button type="button" class="author-story-toc-item${isSelected ? ' is-active' : ''}"
                data-story-node="${escapeHtml(entry.id)}" ${isSelected ? 'aria-current="page"' : ''}>
                <div class="author-story-toc-item-header">
                  <span class="author-toc-tier-chip tier-sc">소분류</span>
                  <span class="author-story-toc-item-title">${escapeHtml(entry.title || entry.id)}</span>
                </div>
                <div class="author-story-toc-location">📍 ${escapeHtml(entry.locationName || '현위치 미지정')}</div>
                <span class="author-story-toc-item-meta">
                  <span class="author-story-toc-choices-preview">${escapeHtml(choiceSummary)}</span>
                </span>
              </button>`;
          }).join('')}
        </section>`).join('');
      return `
        <section class="author-story-toc-episode">
          <div class="author-toc-volume-title-row">
            <span class="author-toc-tier-chip tier-vol">대분류 · 회차</span>
            <h3>${escapeHtml(episodeTitle)}</h3>
          </div>
          ${chapters}
        </section>`;
    }).join('');
    const nodeOptions = Object.values(STORY_NODES).map((entry) => ({
      value: entry.id,
      label: `[본문] ${entry.title || entry.id} (${entry.id})`
    }));
    const sceneOptions = Object.values(INVESTIGATION_SCENES).map((scene) => ({
      value: scene.id,
      label: `[조사] 현장 수색: ${scene.title || scene.id}`
    }));
    const mapOptions = [
      { value: 'action:open_map', label: '🗺️ [지도] 노바리스 아카데미 지도 열기 (전체)' },
      ...MAP_LOCATIONS.map((loc) => ({
        value: `map_loc:${loc.id}`,
        label: `🗺️ [지도] ${loc.name} (${loc.id}) 위치로 지도 열기`
      }))
    ];
    const selectedNode = [
      ...mapOptions,
      ...nodeOptions.map((option) => ({ ...option, value: `node:${option.value}` })),
      ...sceneOptions.map((option) => ({ ...option, value: `scene:${option.value}` }))
    ];
    const choices = (node.choices || []).map((choice, index) => {
      let target = `node:${choice.nextNode || ''}`;
      if (choice.isInvestigationTrigger) {
        target = `scene:${choice.locationId || ''}`;
      } else if (choice.isOpenMapTrigger || choice.action === 'open_map' || choice.nextNode === 'action:open_map') {
        if (choice.mapLocationId) {
          target = `map_loc:${choice.mapLocationId}`;
        } else if (choice.nextNode?.startsWith('map_loc:')) {
          target = choice.nextNode;
        } else {
          target = 'action:open_map';
        }
      } else if (choice.nextNode?.startsWith('map_loc:')) {
        target = choice.nextNode;
      }
      const stats = choice.effects?.rewardStat || {};
      return `
        <article class="author-card author-choice-card">
          <div class="author-card-heading"><strong style="color: #111827;">선택지 ${index + 1}</strong>${actionButton('삭제', `delete-choice:${index}`, 'is-danger')}</div>
          ${field('선택지 문장', 'choiceText', choice.text, 'textarea', { attributes: `data-choice-index="${index}" rows="2"` })}
          ${field('선택지 부가 설명 (호버 툴팁 / 힌트)', 'choiceDesc', choice.desc || '', 'text', { attributes: `data-choice-index="${index}" placeholder="마우스 호버 시 뜰 힌트나 설명 (비워두면 툴팁 없음)"` })}
          ${selectField('이동할 곳', 'choiceTarget', target, selectedNode, `data-choice-index="${index}"`)}
          <span style="display:block; font-size:11px; color:#64748b; margin-top:-6px; margin-bottom:10px;">💡 바로 조사로 가지 않고 장소 도착 본문(상황/독백)을 먼저 거치게 하려면, 이동할 곳을 [본문] 장면으로 지정한 후 해당 장면에서 [조사] 선택지를 만들어 연결하세요.</span>
          <div style="display: flex; flex-direction: column; gap: 6px; margin: 8px 0;">
            <label style="display: flex; align-items: center; gap: 7px; font-size: 12px; color: #111827; font-weight: 700; cursor: pointer; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1;">
              <input type="checkbox" data-author-field="choiceHideIfChosen" data-choice-index="${index}" ${choice.hideIfChosen !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
              <span>선택 후 다시 올 때 숨기기 (유저가 이미 선택한 경우 안 보임)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 7px; font-size: 12px; color: #065f46; font-weight: 700; cursor: pointer; background: #ecfdf5; padding: 6px 10px; border-radius: 6px; border: 1.5px solid #a7f3d0;">
              <input type="checkbox" data-author-field="choiceReturnToHub" data-choice-index="${index}" ${choice.returnToHub ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
              <span>🔄 선택 후 탐사 허브로 복귀 (returnToHub)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 7px; margin-bottom: 2px; font-size: 12px; color: #b45309; font-weight: 700; cursor: pointer; background: #fffbeb; padding: 6px 10px; border-radius: 6px; border: 1.5px solid #fde68a;">
              <input type="checkbox" data-author-field="choiceIsConclusion" data-choice-index="${index}" ${choice.isConclusionChoice ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
              <span>💡 최종 추리/정답 제출 선택지로 지정 (추론 성공 시 황금빛 아우라로 강조)</span>
            </label>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1.5px solid #e2e8f0;">
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">해금 조건 플래그 (requiresFlags, 쉼표 구분)</label>
              <input type="text" data-author-field="choiceRequiresFlags" data-choice-index="${index}" value="${escapeHtml(Array.isArray(choice.requiresFlags) ? choice.requiresFlags.join(', ') : (choice.requiresFlags || ''))}" placeholder="예: flag_secret_found, flag_talked" style="width: 100%; padding: 6px 8px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px;" />
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">조건 미달 시 동작 (lockBehavior)</label>
              <select data-author-field="choiceLockBehavior" data-choice-index="${index}" class="author-select" style="width: 100%; font-size: 12px; padding: 5px 8px;">
                <option value="hide" ${choice.lockBehavior === 'hide' || choice.lockBehavior === 'hidden' ? 'selected' : ''}>숨김 (조건 충족 전까지 아예 안 보임)</option>
                <option value="lock" ${choice.lockBehavior === 'lock' || !choice.lockBehavior ? 'selected' : ''}>잠금 (비활성화 상태로 보임)</option>
              </select>
            </div>
            <div style="grid-column: span 2;">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px;">선택 시 획득할 플래그 (setFlags, 쉼표 구분)</label>
              <input type="text" data-author-field="choiceSetFlags" data-choice-index="${index}" value="${escapeHtml(Array.isArray(choice.setFlags) ? choice.setFlags.join(', ') : (choice.setFlags || ''))}" placeholder="예: flag_explored_lab, clue_unlocked" style="width: 100%; padding: 6px 8px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px;" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1.5px solid #bbf7d0;">
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #166534; margin-bottom: 4px;">✨ 정답 시 이동 장면 (choice.successSceneId)</label>
              <select data-author-field="choiceSuccessSceneId" data-choice-index="${index}" class="author-select" style="width: 100%; font-size: 11.5px; padding: 4px 6px; background: #ffffff;">
                <option value="">-- 기본 대상 사용 (위 [이동할 곳] 참조) --</option>
                ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${choice.successSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)} (${escapeHtml(n.id)})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #991b1b; margin-bottom: 4px;">❌ 오답 시 이동 장면 (choice.failSceneId)</label>
              <select data-author-field="choiceFailSceneId" data-choice-index="${index}" class="author-select" style="width: 100%; font-size: 11.5px; padding: 4px 6px; background: #ffffff;">
                <option value="">-- 오답 분기 없음 --</option>
                ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${choice.failSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)} (${escapeHtml(n.id)})</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="author-stat-grid">
            ${STAT_FIELDS.map((stat) => {
              const statVal = stat.id === 'social' ? (stats.social ?? stats.persuasion ?? 0) : (stats[stat.id] || 0);
              return field(`${stat.label} 변화`, `choiceStat:${stat.id}`, statVal, 'number', {
                attributes: `data-choice-index="${index}" step="1"`
              });
            }).join('')}
          </div>
        </article>`;
    }).join('');

    const otherChoices = [];
    const seenChoiceKeys = new Set();
    Object.entries(STORY_NODES).forEach(([nid, sNode]) => {
      if (nid === node.id) return;
      (sNode.choices || []).forEach((ch) => {
        const textTrimmed = (ch.text || '').trim();
        if (!textTrimmed) return;
        const key = `${textTrimmed}:::${ch.nextNode || ''}:::${ch.locationId || ''}:::${ch.mapLocationId || ''}`;
        if (!seenChoiceKeys.has(key)) {
          seenChoiceKeys.add(key);
          otherChoices.push({
            sourceNodeId: nid,
            sourceNodeTitle: sNode.title || nid,
            text: ch.text,
            desc: ch.desc || '',
            nextNode: ch.nextNode || '',
            locationId: ch.locationId || '',
            isInvestigationTrigger: ch.isInvestigationTrigger || false,
            isOpenMapTrigger: ch.isOpenMapTrigger || false,
            mapLocationId: ch.mapLocationId || '',
            effects: ch.effects ? JSON.parse(JSON.stringify(ch.effects)) : undefined,
            hideIfChosen: ch.hideIfChosen !== false
          });
        }
      });
    });
    this.cachedOtherChoices = otherChoices;

    const allTileRecords = this.getAllTileRecords();
    this.cachedStoryRecords = allTileRecords;

    const allCharacters = CODEX_DATA.filter((item) => item.category === 'character');
    const clueTopics = CODEX_DATA.filter((item) => item.category === 'clue' || item.subItems || item.subClues);
    const detectedCharacters = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const match = String(p).trim().match(/^\[(?:인물|캐릭터|CHARACTER|PERSON)\s*:\s*(.+?)\]$/i);
      if (match) {
        const parts = match[1].split('|').map((s) => s.trim());
        const nameOrId = parts[0] || '미지의 인물';
        const desc = parts[1] || '';
        const icon = parts[2] || '👤';
        const existing = CODEX_DATA.find((c) => c.category === 'character' && (c.id === nameOrId || c.title === nameOrId || (c.keywords && c.keywords.includes(nameOrId))));
        detectedCharacters.push({
          lineIndex: idx,
          id: existing ? existing.id : nameOrId,
          title: existing ? existing.title : nameOrId,
          desc: desc || (existing ? (existing.summary || existing.description) : ''),
          icon: icon || (existing ? existing.icon : '👤'),
          image: existing?.image || '',
          raw: p
        });
      }
    });

    const detectedItems = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const match = String(p).trim().match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
      if (match) {
        const parts = match[1].split('|').map((s) => s.trim());
        const rawIdOrName = parts[0] || '미확인 물품';
        const existing = INVENTORY_ITEMS.find((i) => i.id === rawIdOrName || i.name === rawIdOrName);
        detectedItems.push({
          lineIndex: idx,
          id: existing ? existing.id : rawIdOrName,
          name: existing ? existing.name : rawIdOrName,
          desc: parts[1] || (existing ? existing.desc : '본문에서 획득하는 소지품'),
          icon: parts[2] || (existing ? existing.icon : '🎁')
        });
      }
    });

    const previewWidgets = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const trimmed = String(p).trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        previewWidgets.push({ line: idx, text: trimmed });
      }
    });

    const formHtml = `
      <div class="author-story-editor">
        <aside class="author-story-toc" aria-label="목차">
          <div class="author-story-toc-header">
            <h3>목차</h3>
            ${actionButton('+ 새 장면', 'add-story-node')}
          </div>
          <nav class="author-story-toc-list">${tableOfContents}</nav>
        </aside>
        <section class="author-story-workspace">
          <div class="author-story-workspace-header">
            <div>
              <h3>장면 편집</h3>
              <p>본문과 분기 선택은 수정 즉시 저장됩니다.</p>
            </div>
            <div class="author-button-row">
              ${actionButton('💾 저장', 'save-disk', 'is-primary')}
              ${actionButton('테스트', 'test-story-node')}
              ${actionButton('장면 삭제', 'delete-story-node', 'is-danger')}
            </div>
          </div>
          <div class="author-grid author-story-meta">
            ${field('회차 제목', 'episodeTitle', episode.title || '')}
            ${field('장면 제목', 'storyNodeTitle', node.title || '')}
            ${field('장·절 제목', 'storyChapter', node.chapter || '')}
            ${field('현위치 장소명 (홈/탐사 허브 요약용)', 'storyLocationName', node.locationName || '', 'text', { attributes: 'list="author-story-location-datalist" placeholder="예: 시계탑 도서관, 온실"' })}
            ${field('이 장면에 도달하면 회차 완료 처리', 'storyCompletesEpisode', Boolean(node.completesEpisode), 'checkbox')}
          </div>
          <datalist id="author-story-location-datalist">
            ${(typeof MAP_LOCATIONS !== 'undefined' ? MAP_LOCATIONS : []).map((l) => `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)} (${escapeHtml(l.id)})</option>`).join('')}
            ${Object.values(typeof INVESTIGATION_SCENES !== 'undefined' ? INVESTIGATION_SCENES : {}).map((s) => `<option value="${escapeHtml(s.title)}">${escapeHtml(s.title)} (${escapeHtml(s.id)})</option>`).join('')}
          </datalist>
          <div style="display: flex; gap: 10px; margin-top: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #4338ca; font-weight: 700; cursor: pointer; background: #eef2ff; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #c7d2fe; flex: 1; min-width: 260px;">
              <input type="checkbox" data-author-field="storyIsHubNode" ${node.isHubNode ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
              <span>🧭 에피소드 탐사 허브(HQ 거점) 장면으로 지정 (지도 복귀 시 이동 & 탐사 현황 브리핑 카드 표시)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #065f46; font-weight: 700; cursor: pointer; background: #ecfdf5; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #a7f3d0; flex: 1; min-width: 260px;">
              <input type="checkbox" data-author-field="storyReturnToHub" ${node.returnToHub ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
              <span>🔄 이 지점 종료 후 탐사 허브로 복귀 (returnToHub)</span>
            </label>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; margin-bottom: 12px; background: #f0fdf4; padding: 10px 12px; border-radius: 8px; border: 1.5px solid #bbf7d0;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #166534; margin-bottom: 4px;">✨ 장면 기본 정답 이동 (successSceneId)</label>
              <select data-author-field="storySuccessSceneId" class="author-select" style="width: 100%; font-size: 12px; padding: 6px 8px; background: #ffffff;">
                <option value="">-- 정답 분기 없음 (기본 선택지 이동) --</option>
                ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${node.successSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)} (${escapeHtml(n.id)})</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #991b1b; margin-bottom: 4px;">❌ 장면 기본 오답 이동 (failSceneId)</label>
              <select data-author-field="storyFailSceneId" class="author-select" style="width: 100%; font-size: 12px; padding: 6px 8px; background: #ffffff;">
                <option value="">-- 오답 분기 없음 --</option>
                ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${node.failSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)} (${escapeHtml(n.id)})</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="author-story-summary-section" style="margin-top: 10px; margin-bottom: 14px;">
            ${field('최근 사건 요약 (홈 화면 [최근 진행 위치] 카드 표시용)', 'storySummary', node.summary || '', 'textarea', { attributes: 'rows="2" placeholder="이 장면에 도달했을 때 홈 화면의 [최근 사건 요약]에 표시될 줄거리를 입력하세요."' })}
          </div>

          <div class="author-scene-characters-section" style="margin-top: 14px; margin-bottom: 14px; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div>
                <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <span>🎭 이 장면에 등장/등록된 인물</span>
                  <span class="author-scene-char-count" style="font-size: 11px; padding: 2px 7px; background: rgba(96, 165, 250, 0.15); color: #60a5fa; border-radius: 999px; font-weight: 600;">${detectedCharacters.length}명</span>
                </h4>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">본문 텍스트 내의 [인물: ...] 태그를 실시간 감지하여 도감 및 게임창과 연동합니다.</p>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <select class="author-select" data-author-action="quick-character-select" style="min-width: 170px; font-size: 12px; padding: 5px 8px;">
                  <option value="">+ 인물 선택하여 본문에 추가...</option>
                  ${allCharacters.map((c) => `
                    <option value="${escapeHtml(c.id)}">${(c.icon && c.icon.includes('/') ? '🖼️' : c.icon) || '👤'} ${escapeHtml(c.title)} (${escapeHtml(c.summary || '인물')})</option>
                  `).join('')}
                </select>
                <button type="button" class="author-action is-primary" data-author-action="add-selected-character-to-story" style="font-size: 12px; padding: 5px 12px;">+ 본문에 추가</button>
                <button type="button" class="author-action" data-author-action="goto-character-tab" style="font-size: 12px; padding: 5px 10px;">⚙️ 인물 관리</button>
              </div>
            </div>

            <div class="author-detected-characters-container">
              ${detectedCharacters.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
                  ${detectedCharacters.map((char) => `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 10px;">
                      <div style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: #fff; border: 1.5px solid #60a5fa; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">
                        ${(char.icon && char.icon.includes('/')) || (char.image && char.image.includes('/'))
                          ? `<img src="${escapeHtml(char.icon && char.icon.includes('/') ? char.icon : char.image)}" alt="" style="width: 100%; height: 100%; object-fit: contain;">`
                          : escapeHtml(char.icon || '👤')}
                      </div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong style="font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(char.title)}</strong>
                          <span style="font-size: 10px; padding: 1px 5px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-radius: 4px; font-weight: 600;">등장 중</span>
                        </div>
                        <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(char.desc || '소개 없음')}</p>
                      </div>
                      <button type="button" class="author-action is-danger" data-author-action="remove-character-from-story:${char.lineIndex}" title="본문에서 이 인물 태그 삭제" style="padding: 4px 8px; font-size: 11px;">삭제</button>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px dashed var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                  현재 이 장면에 등록된 인물이 없습니다. 위 [인물 선택하여 본문에 추가...]에서 인물을 골라 추가해 보세요.
                </div>
              `}
            </div>
          </div>

          <div class="author-scene-items-section" style="margin-top: 14px; margin-bottom: 14px; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div>
                <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <span>🎁 이 장면에 획득/등장하는 소지품</span>
                  <span class="author-scene-item-count" style="font-size: 11px; padding: 2px 7px; background: rgba(212, 175, 55, 0.15); color: #d4af37; border-radius: 999px; font-weight: 600;">${detectedItems.length}개</span>
                </h4>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">본문 텍스트 내의 [아이템: ...] 태그를 실시간 감지하여 소지품 도감 및 인벤토리와 연동합니다.</p>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <select class="author-select" data-author-action="quick-item-select" style="min-width: 170px; font-size: 12px; padding: 5px 8px;">
                  <option value="">+ 기존 소지품 선택하여 본문에 추가...</option>
                  ${INVENTORY_ITEMS.map((it) => `
                    <option value="${escapeHtml(it.id)}">${(it.icon && it.icon.includes('/') ? '🖼️' : it.icon) || '📦'} ${escapeHtml(it.name)} (${escapeHtml(it.desc || '소지품')})</option>
                  `).join('')}
                </select>
                <button type="button" class="author-action is-primary" data-author-action="add-selected-item-to-story" style="font-size: 12px; padding: 5px 12px;">+ 본문에 추가</button>
                <button type="button" class="author-action" data-author-action="goto-inventory-tab" style="font-size: 12px; padding: 5px 10px;">🎒 소지품 관리</button>
              </div>
            </div>

            <div class="author-detected-items-container">
              ${detectedItems.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
                  ${detectedItems.map((it) => `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px;">
                      <div style="width: 38px; height: 38px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.2); border: 1.5px solid #d4af37; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px;">
                        ${(it.icon && it.icon.includes('/'))
                          ? `<img src="${escapeHtml(it.icon)}" alt="" style="width: 100%; height: 100%; object-fit: contain;">`
                          : escapeHtml(it.icon || '🎁')}
                      </div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong style="font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(it.name)}</strong>
                          <span style="font-size: 10px; padding: 1px 5px; background: rgba(212, 175, 55, 0.15); color: #d4af37; border-radius: 4px; font-weight: 600;">획득 중</span>
                        </div>
                        <p style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(it.desc || '설명 없음')}</p>
                      </div>
                      <div style="display: flex; gap: 4px;">
                        <button type="button" class="author-action" data-author-action="select-item:${escapeHtml(it.id)}" title="소지품 탭에서 편집" style="padding: 4px 6px; font-size: 11px;">수정</button>
                        <button type="button" class="author-action is-danger" data-author-action="remove-item-from-story:${it.lineIndex}" title="본문에서 이 아이템 태그 삭제" style="padding: 4px 6px; font-size: 11px;">삭제</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px dashed var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                  현재 이 장면에 등록된 소지품이 없습니다. 상단 태그 도구 [+ 🎁 아이템 획득] 또는 위 드롭다운에서 선택하여 추가할 수 있습니다.
                </div>
              `}
            </div>
          </div>

          <div class="author-story-body-editor">
            ${this.renderUniversalTextToolbar('storyParagraphs', { compact: false })}
            ${field('본문 문단 (한 줄에 한 문단)', 'storyParagraphs', (node.paragraphs || []).join('\n'), 'textarea', {
              attributes: 'rows="14"'
            })}
          </div>

          <div class="author-widget-preview-box" style="margin-top: 14px; margin-bottom: 20px; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px;">
            <div style="margin-bottom: 8px;">
              <strong style="font-size: 13px; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                <span>👁️ 본문 게임 위젯 실시간 미리보기</span>
                <span class="author-preview-widget-count" style="font-size: 11px; padding: 2px 7px; background: rgba(212, 175, 55, 0.15); color: #d4af37; border-radius: 999px; font-weight: 600;">${previewWidgets.length}개</span>
              </strong>
              <p style="font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0 0;">본문 텍스트에 삽입된 게임 위젯([인물], [아이템], [스탯] 등)이 게임 진행 시 독자에게 어떻게 표시되는지 실시간으로 미리 확인합니다.</p>
            </div>
            <div class="author-preview-widgets-container">
              ${previewWidgets.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${previewWidgets.map((w) => this.renderWidgetPreview(w.text, node.id, w.line)).join('')}
                </div>
              ` : `
                <div style="padding: 10px; background: var(--bg-surface); border-radius: 8px; text-align: center; font-size: 12px; color: var(--text-muted);">
                  본문에 삽입된 게임 위젯([인물], [아이템], [스탯] 등)이 없습니다.
                </div>
              `}
            </div>
          </div>

          <div class="author-section-heading" style="flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;">
            <div><h4 style="margin: 0; color: #111827; font-size: 15px; font-weight: 700;">선택지</h4><p style="margin: 2px 0 0; color: #64748b; font-size: 12px;">대상은 다른 이야기 장면 또는 조사 장면으로 지정할 수 있습니다.</p></div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${otherChoices.length > 0 ? `
                <div style="display: inline-flex; align-items: center; gap: 6px; background: #ffffff; padding: 4px 8px; border-radius: 6px; border: 1.5px solid #cbd5e1;">
                  <span style="font-size: 11.5px; color: #111827; font-weight: 700;">기존 선택지에서 선택:</span>
                  <select class="author-select" data-author-field="importedChoiceSelect" style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px; font-size: 11.5px; max-width: 240px;">
                    ${otherChoices.map((c, i) => `
                      <option value="${i}">[${escapeHtml(c.sourceNodeTitle)}] ${escapeHtml(c.text)}</option>
                    `).join('')}
                  </select>
                  <button type="button" class="author-action" data-author-action="add-imported-choice" style="padding: 4px 8px; font-size: 11.5px; color: #111827; font-weight: 700; background: #f1f5f9; border: 1.5px solid #cbd5e1;">+ 가져와 추가</button>
                </div>
              ` : ''}
              ${actionButton('+ 새 선택지 추가', 'add-choice', 'is-primary')}
            </div>
          </div>
          <div class="author-card-list">${choices || '<p class="author-empty">등록된 선택지가 없습니다.</p>'}</div>
        </section>
      </div>`;
    return viewModeSwitcher + formHtml;
  }

  handleGraphLinkClick(action) {
    const parts = action.split(':');
    const fromId = parts[1];
    const toId = parts[2];
    const type = parts[3]; // 'normal' | 'success' | 'fail'
    const choiceIdx = parts[4] !== undefined && parts[4] !== '' ? Number(parts[4]) : -1;
    const fromNode = STORY_NODES[fromId];
    if (!fromNode) return;
    const toNode = STORY_NODES[toId];
    const toTitle = toNode ? (toNode.title || toId) : toId;
    const fromTitle = fromNode.title || fromId;
    const typeLabel = type === 'success' ? '정답 분기 (successSceneId)' : (type === 'fail' ? '오답 분기 (failSceneId)' : '선택지 연결');

    const confirmed = confirm(`[${fromTitle}] ➔ [${toTitle}]\n(${typeLabel})\n\n연결을 해제하시겠습니까? (확인: 해제, 취소: 유지)`);
    if (confirmed) {
      if (type === 'success') {
        delete fromNode.successSceneId;
        if (choiceIdx >= 0 && fromNode.choices?.[choiceIdx]) delete fromNode.choices[choiceIdx].successSceneId;
      } else if (type === 'fail') {
        delete fromNode.failSceneId;
        if (choiceIdx >= 0 && fromNode.choices?.[choiceIdx]) delete fromNode.choices[choiceIdx].failSceneId;
      } else {
        if (choiceIdx >= 0 && fromNode.choices?.[choiceIdx]) {
          fromNode.choices[choiceIdx].nextNode = '';
        }
      }
      this.persist();
      this.render();
      this.setStatus(`[${fromTitle}] ➔ [${toTitle}] (${typeLabel}) 연결을 해제했습니다.`);
    }
  }

  renderStoryGraph(currentNode, episodeNodes, editorEpisodeId) {
    let needsLayout = false;
    episodeNodes.forEach((n) => {
      if (typeof n.editorX !== 'number' || typeof n.editorY !== 'number') {
        needsLayout = true;
      }
    });
    if (needsLayout) {
      this.autoLayoutNodes(false);
    }

    const nodeMap = new Map(episodeNodes.map(n => [n.id, n]));
    const links = [];

    episodeNodes.forEach(srcNode => {
      if (srcNode.successSceneId && nodeMap.has(srcNode.successSceneId)) {
        links.push({
          fromId: srcNode.id,
          toId: srcNode.successSceneId,
          type: 'success',
          label: '정답 이동',
          choiceIndex: -1,
          portYOffset: 70
        });
      }
      if (srcNode.failSceneId && nodeMap.has(srcNode.failSceneId)) {
        links.push({
          fromId: srcNode.id,
          toId: srcNode.failSceneId,
          type: 'fail',
          label: '오답 이동',
          choiceIndex: -1,
          portYOffset: 100
        });
      }
      (srcNode.paragraphs || []).forEach(p => {
        const m = String(p).trim().match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:\s*(.+?)\]$/i);
        if (m) {
          const parts = m[1].split('|').map(s => s.trim());
          let qSucc = '';
          let qFail = '';
          if (parts.length >= 6) {
            qSucc = parts[4] || parts[3] || '';
            qFail = parts[5] || '';
          } else if (parts.length === 5) {
            qSucc = parts[3] || '';
            qFail = parts[4] || '';
          } else {
            qSucc = parts[3] || '';
          }
          if (qSucc && nodeMap.has(qSucc) && !links.some(l => l.fromId === srcNode.id && l.toId === qSucc && l.type === 'success')) {
            links.push({
              fromId: srcNode.id,
              toId: qSucc,
              type: 'success',
              label: '퀴즈 정답',
              choiceIndex: -1,
              portYOffset: 70
            });
          }
          if (qFail && nodeMap.has(qFail) && !links.some(l => l.fromId === srcNode.id && l.toId === qFail && l.type === 'fail')) {
            links.push({
              fromId: srcNode.id,
              toId: qFail,
              type: 'fail',
              label: '퀴즈 오답',
              choiceIndex: -1,
              portYOffset: 100
            });
          }
        }
      });
      (srcNode.choices || []).forEach((ch, chIdx) => {
        let tid = (ch.nextNode || '').replace(/^node:/, '');
        if (nodeMap.has(tid)) {
          links.push({
            fromId: srcNode.id,
            toId: tid,
            type: 'normal',
            label: ch.text || '이동',
            choiceIndex: chIdx,
            portYOffset: 35 + chIdx * 16
          });
        }
        if (ch.successSceneId && nodeMap.has(ch.successSceneId)) {
          links.push({
            fromId: srcNode.id,
            toId: ch.successSceneId,
            type: 'success',
            label: `[정답] ${ch.text || ''}`,
            choiceIndex: chIdx,
            portYOffset: 70
          });
        }
        if (ch.failSceneId && nodeMap.has(ch.failSceneId)) {
          links.push({
            fromId: srcNode.id,
            toId: ch.failSceneId,
            type: 'fail',
            label: `[오답] ${ch.text || ''}`,
            choiceIndex: chIdx,
            portYOffset: 100
          });
        }
      });
    });

    const svgLinksLayer = links.map(link => {
      const src = nodeMap.get(link.fromId);
      const dst = nodeMap.get(link.toId);
      if (!src || !dst) return '';
      const x1 = (src.editorX || 0) + 250;
      const y1 = (src.editorY || 0) + Math.min(130, Math.max(30, link.portYOffset || 50));
      const x2 = dst.editorX || 0;
      const y2 = (dst.editorY || 0) + 65;

      const dx = Math.max(45, Math.abs(x2 - x1) * 0.45);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      const mx = Math.round((x1 + x2) / 2);
      const my = Math.round((y1 + y2) / 2);

      let badgeHtml = '';
      if (link.type === 'success') {
        badgeHtml = `
          <g class="author-graph-badge badge-success" data-author-action="click-graph-link:${link.fromId}:${link.toId}:success:${link.choiceIndex}" transform="translate(${mx}, ${my})">
            <rect x="-26" y="-11" width="52" height="22" rx="6" fill="#10b981" />
            <text x="0" y="4" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">[정답]</text>
          </g>`;
      } else if (link.type === 'fail') {
        badgeHtml = `
          <g class="author-graph-badge badge-fail" data-author-action="click-graph-link:${link.fromId}:${link.toId}:fail:${link.choiceIndex}" transform="translate(${mx}, ${my})">
            <rect x="-26" y="-11" width="52" height="22" rx="6" fill="#ef4444" />
            <text x="0" y="4" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">[오답]</text>
          </g>`;
      } else {
        const shortLabel = escapeHtml(link.label.length > 12 ? link.label.slice(0, 11) + '…' : link.label);
        badgeHtml = `
          <g class="author-graph-badge badge-normal" data-author-action="click-graph-link:${link.fromId}:${link.toId}:normal:${link.choiceIndex}" transform="translate(${mx}, ${my})">
            <rect x="-35" y="-10" width="70" height="20" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
            <text x="0" y="4" text-anchor="middle" fill="#475569" font-size="10.5" font-weight="600">${shortLabel}</text>
          </g>`;
      }

      return `
        <g class="author-graph-link-group" data-from="${link.fromId}" data-to="${link.toId}">
          <path d="${d}" class="author-graph-link link-${link.type}" marker-end="url(#arrow-${link.type})" data-author-action="click-graph-link:${link.fromId}:${link.toId}:${link.type}:${link.choiceIndex}" />
          ${badgeHtml}
        </g>`;
    }).join('');

    const cardsHtml = episodeNodes.map(node => {
      const isSelected = node.id === this.selectedStoryNodeId;
      const isQuickEdit = node.id === this.graphQuickEditNodeId;
      const snippet = (node.paragraphs?.[0] || node.summary || '본문 없음').replace(/\[.*?\]/g, '').trim().slice(0, 48);
      const choiceCount = node.choices?.length || 0;
      const hasBranches = node.successSceneId || node.failSceneId;

      return `
        <div class="author-graph-card${isSelected ? ' is-selected' : ''}${isQuickEdit ? ' is-quick-editing' : ''}"
             data-graph-node-id="${escapeHtml(node.id)}"
             style="transform: translate(${node.editorX || 50}px, ${node.editorY || 50}px);">
          <div class="author-graph-port port-in" data-port-type="in" data-node-id="${escapeHtml(node.id)}" title="진입 지점 (In-Port)"></div>
          
          <div class="author-graph-card-header" data-node-drag-handle="${escapeHtml(node.id)}">
            <div class="author-graph-card-title-row">
              <span class="author-graph-card-icon">${node.isHubNode ? '🧭' : (node.completesEpisode ? '🏁' : '📄')}</span>
              <strong class="author-graph-card-title" title="${escapeHtml(node.title || node.id)}">${escapeHtml(node.title || node.id)}</strong>
            </div>
            <div class="author-graph-card-actions">
              <button type="button" class="author-graph-btn-edit" data-author-action="select-graph-node:${escapeHtml(node.id)}" title="빠른 편집 열기">✏️</button>
              <button type="button" class="author-graph-btn-full" data-author-action="open-full-editor:${escapeHtml(node.id)}" title="상세 편집 모드로 열기">🔍</button>
            </div>
          </div>

          <div class="author-graph-card-body" data-author-action="select-graph-node:${escapeHtml(node.id)}">
            <div class="author-graph-card-meta">
              <span>📍 ${escapeHtml(node.locationName || '현위치 미지정')}</span>
              ${node.chapter ? `<span>· ${escapeHtml(node.chapter)}</span>` : ''}
            </div>
            <p class="author-graph-card-snippet">${escapeHtml(snippet || '내용 없음')}</p>
            ${hasBranches ? `
              <div class="author-graph-card-branches">
                ${node.successSceneId ? `<span class="branch-tag success" title="정답: ${escapeHtml(node.successSceneId)}">✨ 정답</span>` : ''}
                ${node.failSceneId ? `<span class="branch-tag fail" title="오답: ${escapeHtml(node.failSceneId)}">❌ 오답</span>` : ''}
              </div>
            ` : ''}
          </div>

          <div class="author-graph-card-footer">
            <div class="author-graph-card-choice-summary">
              <span>선택지 ${choiceCount}개</span>
              <button type="button" class="author-graph-btn-add-choice" data-author-action="add-choice-to-node:${escapeHtml(node.id)}" title="새 선택지 추가">+ 선택지</button>
            </div>
          </div>

          <div class="author-graph-ports-out-wrap">
            <div class="author-graph-port port-out port-normal" data-port-type="normal" data-node-id="${escapeHtml(node.id)}" title="일반 분기 연결 (드래그하여 다른 장면에 놓기)">➔</div>
            <div class="author-graph-port port-out port-success" data-port-type="success" data-node-id="${escapeHtml(node.id)}" title="✨ 정답 이동 연결 (successSceneId)">✨</div>
            <div class="author-graph-port port-out port-fail" data-port-type="fail" data-node-id="${escapeHtml(node.id)}" title="❌ 오답 이동 연결 (failSceneId)">❌</div>
          </div>
        </div>`;
    }).join('');

    const quickEditNode = this.graphQuickEditNodeId ? STORY_NODES[this.graphQuickEditNodeId] : null;
    const quickPanelHtml = quickEditNode ? `
      <aside class="author-graph-quick-panel">
        ${this.renderGraphQuickEditPanel(quickEditNode, episodeNodes)}
      </aside>
    ` : '';

    return `
      <div class="author-node-graph-wrapper">
        <div class="author-node-graph-toolbar">
          <div class="author-button-row">
            <button type="button" class="author-action is-primary" data-author-action="auto-layout-story-graph" title="장면 카드를 순서대로 자동 정렬">🪄 자동 정렬 (Auto Layout)</button>
            <button type="button" class="author-action" data-author-action="add-story-node">+ 새 장면 추가</button>
            <button type="button" class="author-action" data-author-action="zoom-in-graph" title="확대">🔍+</button>
            <button type="button" class="author-action" data-author-action="zoom-out-graph" title="축소">🔍-</button>
            <button type="button" class="author-action" data-author-action="zoom-reset-graph" title="원래 크기">1:1</button>
            <span class="author-graph-zoom-label">${Math.round(this.graphZoom * 100)}%</span>
          </div>
          <div class="author-node-graph-legend">
            <span class="legend-item"><span class="legend-dot normal"></span>일반 선택지 연결</span>
            <span class="legend-item"><span class="legend-dot success"></span>[정답] 분기 (successSceneId)</span>
            <span class="legend-item"><span class="legend-dot fail"></span>[오답] 분기 (failSceneId)</span>
          </div>
        </div>

        <div class="author-node-graph-viewport" id="author-node-graph-viewport">
          <div class="author-graph-canvas-container" id="author-graph-canvas-container"
               style="transform: translate(${this.graphPan.x}px, ${this.graphPan.y}px) scale(${this.graphZoom});">
            <svg class="author-node-graph-svg" id="author-node-graph-svg">
              <defs>
                <marker id="arrow-normal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-success" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker id="arrow-fail" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                </marker>
                <marker id="arrow-wire" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
              </defs>
              <g class="author-graph-links-layer" id="author-graph-links-layer">
                ${svgLinksLayer}
              </g>
              <path id="graph-connecting-wire-path" class="author-graph-connecting-wire" d="" style="display: none;" marker-end="url(#arrow-wire)" />
            </svg>
            <div class="author-graph-cards-layer">
              ${cardsHtml}
            </div>
          </div>
        </div>

        ${quickPanelHtml}
      </div>`;
  }

  renderGraphQuickEditPanel(node, episodeNodes) {
    if (!node) return '<p>선택된 장면이 없습니다.</p>';

    const hasQuizWidget = (node.paragraphs || []).some(p => String(p).trim().match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:/i));

    const choicesHtml = (node.choices || []).map((ch, idx) => `
      <div class="author-quick-choice-item" style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 12px; color: #1e293b;">선택지 ${idx + 1}</strong>
          <button type="button" class="author-action is-danger" data-author-action="delete-quick-choice:${escapeHtml(node.id)}:${idx}" style="padding: 2px 6px; font-size: 11px;">삭제</button>
        </div>
        <div style="margin-bottom: 6px;">
          <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px;">선택지 문장</label>
          <input type="text" data-author-field="choiceText" data-choice-index="${idx}" data-quick-edit-node-id="${escapeHtml(node.id)}" value="${escapeHtml(ch.text || '')}" style="width: 100%; font-size: 12px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px;" />
        </div>
        <div style="margin-bottom: 6px;">
          <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 2px;">기본 이동 대상</label>
          <select data-author-field="choiceTarget" data-choice-index="${idx}" data-quick-edit-node-id="${escapeHtml(node.id)}" class="author-select" style="width: 100%; font-size: 11.5px; padding: 4px 6px;">
            <option value="">선택 안 함</option>
            ${episodeNodes.map(n => `<option value="node:${escapeHtml(n.id)}" ${(ch.nextNode || '').replace(/^node:/, '') === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)}</option>`).join('')}
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div>
            <label style="display: block; font-size: 10.5px; font-weight: 700; color: #166534; margin-bottom: 2px;">✨ 정답 시 이동</label>
            <select data-author-field="choiceSuccessSceneId" data-choice-index="${idx}" data-quick-edit-node-id="${escapeHtml(node.id)}" class="author-select" style="width: 100%; font-size: 11px; padding: 4px 6px;">
              <option value="">-- 미지정 --</option>
              ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${ch.successSceneId === n.id ? 'selected' : ''}>${escapeHtml(n.title || n.id)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 10.5px; font-weight: 700; color: #991b1b; margin-bottom: 2px;">❌ 오답 시 이동</label>
            <select data-author-field="choiceFailSceneId" data-choice-index="${idx}" data-quick-edit-node-id="${escapeHtml(node.id)}" class="author-select" style="width: 100%; font-size: 11px; padding: 4px 6px;">
              <option value="">-- 미지정 --</option>
              ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${ch.failSceneId === n.id ? 'selected' : ''}>${escapeHtml(n.title || n.id)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `).join('');

    return `
      <div class="author-quick-panel-header">
        <div>
          <span style="font-size: 11px; color: #6366f1; font-weight: 700;">빠른 편집</span>
          <h4 style="margin: 2px 0 0; font-size: 15px; color: #1e293b;">${escapeHtml(node.title || node.id)}</h4>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="author-action is-primary" data-author-action="open-full-editor:${escapeHtml(node.id)}" style="padding: 4px 8px; font-size: 11.5px;">전체 편집</button>
          <button type="button" class="author-action" data-author-action="close-quick-edit" style="padding: 4px 8px; font-size: 11.5px;">✕</button>
        </div>
      </div>

      <div class="author-quick-panel-body" style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 4px;">장면 제목</label>
          <input type="text" data-author-field="storyNodeTitle" data-quick-edit-node-id="${escapeHtml(node.id)}" value="${escapeHtml(node.title || '')}" style="width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 4px;">장·절</label>
            <input type="text" data-author-field="storyChapter" data-quick-edit-node-id="${escapeHtml(node.id)}" value="${escapeHtml(node.chapter || '')}" style="width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 4px;">장소명</label>
            <input type="text" data-author-field="storyLocationName" data-quick-edit-node-id="${escapeHtml(node.id)}" value="${escapeHtml(node.locationName || '')}" style="width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
        </div>

        ${hasQuizWidget ? `
          <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: #92400e; display: flex; align-items: center; gap: 6px;">
            <span>✍️ <b>본문 퀴즈 위젯 연동:</b> 아래의 정답/오답 시 이동 장면을 지정하면 퀴즈 입력 판정 시 해당 장면으로 자동 이동합니다.</span>
          </div>
        ` : ''}

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 10px;">
          <label style="display: block; font-size: 11px; font-weight: 700; color: #166534; margin-bottom: 3px;">✨ 정답 시 이동 장면 (successSceneId)</label>
          <select data-author-field="storySuccessSceneId" data-quick-edit-node-id="${escapeHtml(node.id)}" class="author-select" style="width: 100%; font-size: 11.5px; padding: 4px 6px;">
            <option value="">-- 정답 분기 없음 --</option>
            ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${node.successSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)}</option>`).join('')}
          </select>
        </div>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px;">
          <label style="display: block; font-size: 11px; font-weight: 700; color: #991b1b; margin-bottom: 3px;">❌ 오답 시 이동 장면 (failSceneId)</label>
          <select data-author-field="storyFailSceneId" data-quick-edit-node-id="${escapeHtml(node.id)}" class="author-select" style="width: 100%; font-size: 11.5px; padding: 4px 6px;">
            <option value="">-- 오답 분기 없음 --</option>
            ${episodeNodes.map(n => `<option value="${escapeHtml(n.id)}" ${node.failSceneId === n.id ? 'selected' : ''}>[본문] ${escapeHtml(n.title || n.id)}</option>`).join('')}
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: #334155; margin-bottom: 4px;">본문 문단</label>
          <textarea data-author-field="storyParagraphs" data-quick-edit-node-id="${escapeHtml(node.id)}" rows="7" style="width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; line-height: 1.5;">${escapeHtml((node.paragraphs || []).join('\n'))}</textarea>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: #334155;">선택지 목록</span>
            <button type="button" class="author-action is-primary" data-author-action="add-choice-to-node:${escapeHtml(node.id)}" style="padding: 3px 8px; font-size: 11px;">+ 선택지 추가</button>
          </div>
          <div class="author-quick-choices-list">
            ${choicesHtml || '<p style="font-size: 11.5px; color: #94a3b8; text-align: center; margin: 10px 0;">등록된 선택지가 없습니다.</p>'}
          </div>
        </div>
      </div>
    `;
  }

  autoLayoutNodes(save = true) {
    const editorEpisodeId = getLiveEpisodeId();
    const episodeNodes = Object.values(STORY_NODES).filter((entry) => !editorEpisodeId || entry.episodeId === editorEpisodeId);
    if (!episodeNodes.length) return;

    const nodeMap = new Map(episodeNodes.map(n => [n.id, n]));
    const incomingCount = new Map(episodeNodes.map(n => [n.id, 0]));
    const outgoingMap = new Map(episodeNodes.map(n => [n.id, new Set()]));

    episodeNodes.forEach(node => {
      const targets = new Set();
      (node.choices || []).forEach(ch => {
        let tid = (ch.nextNode || '').replace(/^node:/, '');
        if (nodeMap.has(tid)) targets.add(tid);
        if (ch.successSceneId && nodeMap.has(ch.successSceneId)) targets.add(ch.successSceneId);
        if (ch.failSceneId && nodeMap.has(ch.failSceneId)) targets.add(ch.failSceneId);
      });
      if (node.successSceneId && nodeMap.has(node.successSceneId)) targets.add(node.successSceneId);
      if (node.failSceneId && nodeMap.has(node.failSceneId)) targets.add(node.failSceneId);

      outgoingMap.set(node.id, targets);
      targets.forEach(tid => {
        incomingCount.set(tid, (incomingCount.get(tid) || 0) + 1);
      });
    });

    let roots = episodeNodes.filter(n => (incomingCount.get(n.id) || 0) === 0);
    if (roots.length === 0) roots = [episodeNodes[0]];

    const levels = new Map();
    const queue = [];
    roots.forEach(r => {
      levels.set(r.id, 0);
      queue.push(r.id);
    });

    while (queue.length > 0) {
      const curId = queue.shift();
      const curLevel = levels.get(curId);
      const out = outgoingMap.get(curId) || new Set();
      out.forEach(tid => {
        if (!levels.has(tid)) {
          levels.set(tid, curLevel + 1);
          queue.push(tid);
        }
      });
    }

    let maxLevel = 0;
    levels.forEach(lvl => { if (lvl > maxLevel) maxLevel = lvl; });
    episodeNodes.forEach(n => {
      if (!levels.has(n.id)) {
        levels.set(n.id, maxLevel + 1);
      }
    });

    const columns = new Map();
    levels.forEach((col, nid) => {
      if (!columns.has(col)) columns.set(col, []);
      columns.get(col).push(nid);
    });

    const sortedCols = Array.from(columns.keys()).sort((a, b) => a - b);
    sortedCols.forEach((colIdx, colVisualIdx) => {
      const colNodes = columns.get(colIdx);
      colNodes.forEach((nid, rowIdx) => {
        const n = nodeMap.get(nid);
        if (n) {
          n.editorX = 50 + colVisualIdx * 340;
          n.editorY = 50 + rowIdx * 190;
        }
      });
    });

    if (save) {
      this.persist();
      this.render();
      this.setStatus('장면 카드 위치를 자동 정렬했습니다.');
    }
  }

  initGraphListeners() {
    if (this._graphListenersInited) return;
    this._graphListenersInited = true;

    window.addEventListener('pointerdown', (event) => {
      if (!this.panel?.classList.contains('is-visible') || this.storyViewMode !== 'graph') return;
      
      const portOut = event.target.closest('.author-graph-port.port-out');
      if (portOut) {
        event.stopPropagation();
        event.preventDefault();
        const viewport = document.getElementById('author-node-graph-viewport');
        const vRect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0 };
        const pRect = portOut.getBoundingClientRect();
        const sX = (pRect.left + pRect.width / 2 - vRect.left - this.graphPan.x) / this.graphZoom;
        const sY = (pRect.top + pRect.height / 2 - vRect.top - this.graphPan.y) / this.graphZoom;

        this.graphConnectingWire = {
          fromNodeId: portOut.dataset.nodeId,
          portType: portOut.dataset.portType,
          startX: sX,
          startY: sY
        };
        try { portOut.setPointerCapture(event.pointerId); } catch (e) {}
        return;
      }

      const dragHandle = event.target.closest('[data-node-drag-handle]');
      if (dragHandle) {
        const nodeId = dragHandle.dataset.nodeDragHandle;
        const node = STORY_NODES[nodeId];
        if (node) {
          event.stopPropagation();
          event.preventDefault();
          this.graphDraggingNode = {
            nodeId,
            startX: event.clientX,
            startY: event.clientY,
            initX: node.editorX || 50,
            initY: node.editorY || 50
          };
          try { dragHandle.setPointerCapture(event.pointerId); } catch (e) {}
          return;
        }
      }

      const viewport = event.target.closest('#author-node-graph-viewport');
      if (viewport && !event.target.closest('.author-graph-card') && !event.target.closest('.author-graph-quick-panel') && !event.target.closest('.author-node-graph-toolbar')) {
        this.graphPanning = {
          startX: event.clientX,
          startY: event.clientY,
          initPanX: this.graphPan.x,
          initPanY: this.graphPan.y
        };
      }
    });

    window.addEventListener('pointermove', (event) => {
      if (!this.panel?.classList.contains('is-visible') || this.storyViewMode !== 'graph') return;

      if (this.graphConnectingWire) {
        const viewport = document.getElementById('author-node-graph-viewport');
        const vRect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0 };
        const curX = (event.clientX - vRect.left - this.graphPan.x) / this.graphZoom;
        const curY = (event.clientY - vRect.top - this.graphPan.y) / this.graphZoom;
        this.renderGraphConnectingWire(curX, curY);
        return;
      }

      if (this.graphDraggingNode) {
        const { nodeId, startX, startY, initX, initY } = this.graphDraggingNode;
        const node = STORY_NODES[nodeId];
        if (node) {
          const dx = (event.clientX - startX) / this.graphZoom;
          const dy = (event.clientY - startY) / this.graphZoom;
          node.editorX = Math.round(initX + dx);
          node.editorY = Math.round(initY + dy);
          const cardElem = document.querySelector(`.author-graph-card[data-graph-node-id="${nodeId}"]`);
          if (cardElem) {
            cardElem.style.transform = `translate(${node.editorX}px, ${node.editorY}px)`;
          }
          this.updateGraphSvgLines();
        }
        return;
      }

      if (this.graphPanning) {
        const dx = event.clientX - this.graphPanning.startX;
        const dy = event.clientY - this.graphPanning.startY;
        this.graphPan.x = Math.round(this.graphPanning.initPanX + dx);
        this.graphPan.y = Math.round(this.graphPanning.initPanY + dy);
        this.updateGraphTransform();
      }
    });

    window.addEventListener('pointerup', (event) => {
      if (this.graphConnectingWire) {
        const { fromNodeId, portType } = this.graphConnectingWire;
        this.graphConnectingWire = null;
        this.clearGraphConnectingWire();

        const elemUnder = document.elementFromPoint(event.clientX, event.clientY);
        const targetCard = elemUnder?.closest('.author-graph-card');
        const targetNodeId = targetCard?.dataset?.graphNodeId;

        if (targetNodeId && targetNodeId !== fromNodeId) {
          const fromNode = STORY_NODES[fromNodeId];
          const targetNode = STORY_NODES[targetNodeId];
          if (fromNode && targetNode) {
            if (portType === 'success') {
              fromNode.successSceneId = targetNodeId;
              this.setStatus(`[${fromNode.title || fromNode.id}]의 정답 시 이동 장면을 [${targetNode.title || targetNodeId}]로 설정했습니다.`);
            } else if (portType === 'fail') {
              fromNode.failSceneId = targetNodeId;
              this.setStatus(`[${fromNode.title || fromNode.id}]의 오답 시 이동 장면을 [${targetNode.title || targetNodeId}]로 설정했습니다.`);
            } else {
              if (!fromNode.choices) fromNode.choices = [];
              fromNode.choices.push({
                text: `${targetNode.title || targetNodeId}(으)로 이동`,
                nextNode: targetNodeId,
                hideIfChosen: false
              });
              this.setStatus(`[${fromNode.title || fromNode.id}]에서 [${targetNode.title || targetNodeId}]로의 선택지를 연결했습니다.`);
            }
            this.persist();
            this.render();
          }
        }
        return;
      }

      if (this.graphDraggingNode) {
        this.graphDraggingNode = null;
        this.persist();
        return;
      }

      if (this.graphPanning) {
        this.graphPanning = null;
      }
    });

    window.addEventListener('wheel', (event) => {
      if (!this.panel?.classList.contains('is-visible') || this.storyViewMode !== 'graph') return;
      const viewport = event.target.closest('#author-node-graph-viewport');
      if (!viewport) return;
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(2.0, Math.max(0.35, Number((this.graphZoom * zoomFactor).toFixed(2))));
      this.graphZoom = newZoom;
      this.updateGraphTransform();
    }, { passive: false });
  }

  updateGraphTransform() {
    const container = document.getElementById('author-graph-canvas-container');
    if (container) {
      container.style.transform = `translate(${this.graphPan.x}px, ${this.graphPan.y}px) scale(${this.graphZoom})`;
    }
    const label = document.querySelector('.author-graph-zoom-label');
    if (label) {
      label.textContent = `${Math.round(this.graphZoom * 100)}%`;
    }
  }

  renderGraphConnectingWire(curX, curY) {
    const wirePath = document.getElementById('graph-connecting-wire-path');
    if (!wirePath || !this.graphConnectingWire) return;
    const { startX, startY } = this.graphConnectingWire;
    const dx = Math.max(40, Math.abs(curX - startX) * 0.4);
    const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${curX - dx} ${curY}, ${curX} ${curY}`;
    wirePath.setAttribute('d', d);
    wirePath.style.display = 'block';
  }

  clearGraphConnectingWire() {
    const wirePath = document.getElementById('graph-connecting-wire-path');
    if (wirePath) {
      wirePath.setAttribute('d', '');
      wirePath.style.display = 'none';
    }
  }

  updateGraphSvgLines() {
    const layer = document.getElementById('author-graph-links-layer');
    if (!layer) return;
    const editorEpisodeId = getLiveEpisodeId();
    const episodeNodes = Object.values(STORY_NODES).filter((entry) => !editorEpisodeId || entry.episodeId === editorEpisodeId);
    const nodeMap = new Map(episodeNodes.map(n => [n.id, n]));

    const links = [];
    episodeNodes.forEach(srcNode => {
      if (srcNode.successSceneId && nodeMap.has(srcNode.successSceneId)) {
        links.push({
          fromId: srcNode.id,
          toId: srcNode.successSceneId,
          type: 'success',
          label: '정답 이동',
          choiceIndex: -1,
          portYOffset: 70
        });
      }
      if (srcNode.failSceneId && nodeMap.has(srcNode.failSceneId)) {
        links.push({
          fromId: srcNode.id,
          toId: srcNode.failSceneId,
          type: 'fail',
          label: '오답 이동',
          choiceIndex: -1,
          portYOffset: 100
        });
      }
      (srcNode.paragraphs || []).forEach(p => {
        const m = String(p).trim().match(/^\[(?:정답입력|퀴즈입력|퀴즈|정답판정|QUIZ)\s*:\s*(.+?)\]$/i);
        if (m) {
          const parts = m[1].split('|').map(s => s.trim());
          let qSucc = '';
          let qFail = '';
          if (parts.length >= 6) {
            qSucc = parts[4] || parts[3] || '';
            qFail = parts[5] || '';
          } else if (parts.length === 5) {
            qSucc = parts[3] || '';
            qFail = parts[4] || '';
          } else {
            qSucc = parts[3] || '';
          }
          if (qSucc && nodeMap.has(qSucc) && !links.some(l => l.fromId === srcNode.id && l.toId === qSucc && l.type === 'success')) {
            links.push({
              fromId: srcNode.id,
              toId: qSucc,
              type: 'success',
              label: '퀴즈 정답',
              choiceIndex: -1,
              portYOffset: 70
            });
          }
          if (qFail && nodeMap.has(qFail) && !links.some(l => l.fromId === srcNode.id && l.toId === qFail && l.type === 'fail')) {
            links.push({
              fromId: srcNode.id,
              toId: qFail,
              type: 'fail',
              label: '퀴즈 오답',
              choiceIndex: -1,
              portYOffset: 100
            });
          }
        }
      });
      (srcNode.choices || []).forEach((ch, chIdx) => {
        let tid = (ch.nextNode || '').replace(/^node:/, '');
        if (nodeMap.has(tid)) {
          links.push({
            fromId: srcNode.id,
            toId: tid,
            type: 'normal',
            label: ch.text || '이동',
            choiceIndex: chIdx,
            portYOffset: 35 + chIdx * 16
          });
        }
        if (ch.successSceneId && nodeMap.has(ch.successSceneId)) {
          links.push({
            fromId: srcNode.id,
            toId: ch.successSceneId,
            type: 'success',
            label: `[정답] ${ch.text || ''}`,
            choiceIndex: chIdx,
            portYOffset: 70
          });
        }
        if (ch.failSceneId && nodeMap.has(ch.failSceneId)) {
          links.push({
            fromId: srcNode.id,
            toId: ch.failSceneId,
            type: 'fail',
            label: `[오답] ${ch.text || ''}`,
            choiceIndex: chIdx,
            portYOffset: 100
          });
        }
      });
    });

    layer.innerHTML = links.map(link => {
      const src = nodeMap.get(link.fromId);
      const dst = nodeMap.get(link.toId);
      if (!src || !dst) return '';
      const x1 = (src.editorX || 0) + 250;
      const y1 = (src.editorY || 0) + Math.min(130, Math.max(30, link.portYOffset || 50));
      const x2 = dst.editorX || 0;
      const y2 = (dst.editorY || 0) + 65;

      const dx = Math.max(45, Math.abs(x2 - x1) * 0.45);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      const mx = Math.round((x1 + x2) / 2);
      const my = Math.round((y1 + y2) / 2);

      let badgeHtml = '';
      if (link.type === 'success') {
        badgeHtml = `
          <g class="author-graph-badge badge-success" data-author-action="click-graph-link:${link.fromId}:${link.toId}:success:${link.choiceIndex}" transform="translate(${mx}, ${my})">
            <rect x="-26" y="-11" width="52" height="22" rx="6" fill="#10b981" />
            <text x="0" y="4" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">[정답]</text>
          </g>`;
      } else if (link.type === 'fail') {
        badgeHtml = `
          <g class="author-graph-badge badge-fail" data-author-action="click-graph-link:${link.fromId}:${link.toId}:fail:${link.choiceIndex}" transform="translate(${mx}, ${my})">
            <rect x="-26" y="-11" width="52" height="22" rx="6" fill="#ef4444" />
            <text x="0" y="4" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">[오답]</text>
          </g>`;
      } else {
        const shortLabel = escapeHtml(link.label.length > 12 ? link.label.slice(0, 11) + '…' : link.label);
        badgeHtml = `
          <g class="author-graph-badge badge-normal" data-author-action="click-graph-link:${link.fromId}:${link.toId}:normal:${link.choiceIndex}" transform="translate(${mx}, ${my})">
            <rect x="-35" y="-10" width="70" height="20" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
            <text x="0" y="4" text-anchor="middle" fill="#475569" font-size="10.5" font-weight="600">${shortLabel}</text>
          </g>`;
      }

      return `
        <g class="author-graph-link-group" data-from="${link.fromId}" data-to="${link.toId}">
          <path d="${d}" class="author-graph-link link-${link.type}" marker-end="url(#arrow-${link.type})" data-author-action="click-graph-link:${link.fromId}:${link.toId}:${link.type}:${link.choiceIndex}" />
          ${badgeHtml}
        </g>`;
    }).join('');
  }

  renderInvestigation() {
    const sceneIds = Object.keys(INVESTIGATION_SCENES);
    if (sceneIds.length === 0) {
      return `
        <div class="author-panel-body">
          <p class="author-empty">등록된 조사 장면이 없습니다.</p>
          <div style="margin-top: 12px;">${actionButton('+ 새 조사 장면 추가', 'add-investigation-scene', 'is-primary')}</div>
        </div>`;
    }

    if (!this.selectedInvestigationSceneId || !INVESTIGATION_SCENES[this.selectedInvestigationSceneId]) {
      this.selectedInvestigationSceneId = sceneIds[0];
    }
    const sceneId = this.selectedInvestigationSceneId;
    const scene = INVESTIGATION_SCENES[sceneId] || {};
    scene.hotspots ||= [];

    if (this.selectedHotspotIndex >= scene.hotspots.length) {
      this.selectedHotspotIndex = Math.max(0, scene.hotspots.length - 1);
    }
    const activeHotspot = scene.hotspots[this.selectedHotspotIndex] || null;

    const sceneOptions = sceneIds.map((id) => ({
      value: id,
      label: `${INVESTIGATION_SCENES[id]?.title || id} (${INVESTIGATION_SCENES[id]?.hotspots?.length || 0}개 지점)`
    }));

    const storyNodeOptions = [
      { value: '', label: '선택 안 함 (자유 탐색 유지)' },
      ...Object.keys(STORY_NODES).map((id) => ({
        value: id,
        label: `${STORY_NODES[id].title} (${id})`
      }))
    ];

    const bgImageSrc = scene.bgImage || (scene.layout === 'clocktower' ? 'assets/images/scenes/clocktower_bg.jpg' : (scene.layout === 'garden' ? 'assets/images/scenes/garden_bg.jpg' : 'assets/images/scenes/library_bg.jpg'));

    const memoOptions = [{ value: '', label: '도감/단서 연결 안 함' }, ...CODEX_DATA.map((entry) => ({
      value: entry.id, label: `${entry.title} · ${this.memoCategoryLabel(entry.category)}`
    }))];

    const itemOptions = [{ value: '', label: '소지품 없음' }, ...INVENTORY_ITEMS.map((item) => ({
      value: item.id, label: item.name
    }))];

    const allTileRecords = this.getAllTileRecords();
    this.cachedStoryRecords = allTileRecords;

    const recordOptions = [
      { value: '', label: '해금할 세부설명 없음' },
      ...allTileRecords.map((r) => ({
        value: r.recordId,
        label: `[${r.tileLabel}] ${r.text.slice(0, 24)} (${r.recordId})`
      }))
    ];

    const allSubItems = this.getAllSubItems();
    const subItemOptions = [
      { value: '', label: '해금할 세부 타일 없음' },
      ...allSubItems.map((s) => ({
        value: s.id,
        label: `[${s.parentTitle}] ${s.label} (${s.id})`
      }))
    ];

    const allCharacters = CODEX_DATA.filter((item) => item.category === 'character');

    const hotspotTypes = [
      { value: 'character', label: '👤 인물 대화 (탐문/질문트리)' },
      { value: 'book', label: '📖 책/일지 (한 쪽씩 열람·인덱스 목차)' },
      { value: 'inspect', label: '🔍 사물/단서 조사 (관찰/독백)' },
      { value: 'item', label: '🎁 소지품 획득 (아이템 상자/습득)' },
      { value: 'interactive', label: '⚙️ 특수 상호작용 (잠금해제 등)' }
    ];

    // Stage Pins HTML
    const stagePins = scene.hotspots.map((hs, index) => {
      const isSelected = index === this.selectedHotspotIndex;
      const type = hs.type || 'inspect';
      let icon = hs.icon || (type === 'character' ? '👤' : (type === 'book' ? '📖' : (type === 'item' ? '🎁' : '🔍')));
      let badgeLabel = hs.title || `지점 ${index + 1}`;
      let pinColor = '#3b82f6';
      if (type === 'character') pinColor = '#8b5cf6';
      else if (type === 'book') pinColor = '#d97706';
      else if (type === 'item') pinColor = '#10b981';
      else if (type === 'inspect') pinColor = '#f59e0b';

      const x = hs.coords?.x ?? 50;
      const y = hs.coords?.y ?? 50;

      return `
        <button type="button"
                class="author-stage-pin ${isSelected ? 'is-selected' : ''}"
                data-author-action="select-hotspot:${index}"
                style="position: absolute; left: ${x}%; top: ${y}%; transform: translate(-50%, -50%); z-index: ${isSelected ? 20 : 5}; background: ${isSelected ? '#1e293b' : 'rgba(15, 23, 42, 0.85)'}; border: 2px solid ${isSelected ? '#fde047' : pinColor}; color: ${isSelected ? '#fde047' : '#f8fafc'}; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.7); backdrop-filter: blur(4px);">
          <span style="font-size: 14px;">${icon}</span>
          <span>${escapeHtml(badgeLabel)}</span>
          ${isSelected ? '<span style="font-size: 10px; background: #fde047; color: #0f172a; padding: 1px 6px; border-radius: 4px; font-weight: 800;">선택됨</span>' : ''}
        </button>
      `;
    }).join('');

    // Hotspot Chips HTML
    const hotspotChips = scene.hotspots.map((hs, index) => {
      const isSelected = index === this.selectedHotspotIndex;
      const type = hs.type || 'inspect';
      let typeBadge = type === 'character' ? '👤 인물' : (type === 'book' ? '📖 책/일지' : (type === 'item' ? '🎁 소지품' : '🔍 조사'));
      let typeBg = type === 'character' ? 'rgba(139, 92, 246, 0.2)' : (type === 'book' ? 'rgba(217, 119, 6, 0.2)' : (type === 'item' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'));
      let typeBorder = type === 'character' ? 'rgba(139, 92, 246, 0.4)' : (type === 'book' ? 'rgba(217, 119, 6, 0.4)' : (type === 'item' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'));
      let typeColor = type === 'character' ? '#c4b5fd' : (type === 'book' ? '#fbbf24' : (type === 'item' ? '#6ee7b7' : '#fcd34d'));

      return `
        <button type="button"
                data-author-action="select-hotspot:${index}"
                class="author-card"
                style="padding: 10px 14px; text-align: left; cursor: pointer; background: ${isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)'}; border: 2px solid ${isSelected ? 'var(--brand-accent)' : 'var(--border-subtle)'}; border-radius: 10px; display: flex; flex-direction: column; gap: 4px; transition: all 0.15s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${typeBg}; border: 1px solid ${typeBorder}; color: ${typeColor}; font-weight: 700;">${typeBadge}</span>
            <span style="font-size: 11px; color: var(--text-muted);">좌표 (${hs.coords?.x ?? 50}%, ${hs.coords?.y ?? 50}%)</span>
          </div>
          <strong style="font-size: 14px; color: ${isSelected ? '#fff' : 'var(--text-main)'}; margin-top: 2px;">
            ${hs.icon || '📍'} ${escapeHtml(hs.title || `지점 ${index + 1}`)}
          </strong>
          <span style="font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(type === 'character' ? (hs.dialogueTree?.start?.text || hs.monologue || '대화 설정됨') : (type === 'book' ? `${hs.pages?.length || 0}쪽 분량의 책` : (hs.inspectText || hs.monologue || '설명 없음')))}
          </span>
        </button>
      `;
    }).join('');

    return `
      <div class="author-panel-body" style="display: flex; flex-direction: column; gap: 20px;">
        <!-- 상단: 장면 선택 및 관리 헤더 -->
        <section class="author-section" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 260px;">
              <span style="font-size: 20px;">🔍</span>
              <div style="flex: 1;">
                <label style="font-size: 12px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">조사 장면 선택</label>
                <select data-author-field="investigationSceneSelect" style="width: 100%; padding: 8px 12px; background: var(--bg-input); color: #fff; border: 1px solid var(--border-subtle); border-radius: 8px; font-size: 14px; font-weight: 700;">
                  ${sceneOptions.map((opt) => `<option value="${escapeHtml(opt.value)}" ${opt.value === sceneId ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              ${actionButton('+ 새 조사 장면 추가', 'add-investigation-scene', 'is-primary')}
              ${actionButton('현재 장면 삭제', 'delete-investigation-scene', 'is-danger')}
            </div>
          </div>

          <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
            ${field('장면 제목', 'investigationSceneTitle', scene.title || '', 'text', { placeholder: '예: 중앙 서고 도서관' })}
            ${field('상단 안내 문구', 'investigationSceneSubtitle', scene.subtitle || '', 'text', { placeholder: '예: 서고 안의 단서를 조사하고 사서와 대화하세요.' })}
            ${field('배경 이미지 경로', 'investigationSceneBgImage', scene.bgImage || '', 'text', { placeholder: 'assets/images/scenes/library_bg.jpg' })}
            ${selectField('조사 완료 후 복귀할 본문 이야기 장면', 'investigationSceneExitStoryNode', scene.exitStoryNode || '', storyNodeOptions)}
          </div>
        </section>

        <!-- 중단: 16:9 현장 화면 무대 (Stage) 시각화 -->
        <section class="author-section" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h4 style="margin: 0; font-size: 15px; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>🎯 현장 조사 무대 시각화</span>
                <span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">(16:9 실제 게임 화면)</span>
              </h4>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">
                화면 속 지점 핀을 누르면 해당 지점이 선택되며, <strong>무대 배경의 빈 곳을 클릭하면 현재 선택된 핀의 좌표가 그 위치로 즉시 이동</strong>합니다.
              </p>
            </div>
            ${activeHotspot ? `
              <div style="padding: 4px 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 6px; font-size: 12px; color: #fde047; font-weight: 700;">
                선택된 핀: ${activeHotspot.icon || '📍'} ${escapeHtml(activeHotspot.title || '지점')} (${activeHotspot.coords?.x ?? 50}%, ${activeHotspot.coords?.y ?? 50}%)
              </div>
            ` : ''}
          </div>

          <div class="author-investigation-stage" style="background: #0b0f19 url('${escapeHtml(bgImageSrc)}') center/cover no-repeat;">
            <div style="position: absolute; inset: 0; background: rgba(15, 23, 42, 0.4); pointer-events: none;"></div>
            ${stagePins}
            <div style="position: absolute; bottom: 10px; left: 14px; right: 14px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(6px); padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); font-size: 11.5px; color: #cbd5e1;">
              <span>🖱️ <strong>좌표 이동 방법</strong>: 무대 위 원하는 위치를 클릭하면 [${escapeHtml(activeHotspot?.title || '선택된 지점')}] 핀이 클릭한 위치로 즉시 이동합니다.</span>
              <span style="color: #60a5fa; font-weight: 700;">총 ${scene.hotspots.length}개 지점 배치됨</span>
            </div>
          </div>
        </section>

        <!-- 지점 추가 및 빠른 선택 바 -->
        <section class="author-section" style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
            <div>
              <h4 style="margin: 0; font-size: 15px; color: #fff;">📍 조사 지점 목록 (${scene.hotspots.length}개)</h4>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">원하는 상호작용 유형의 지점을 추가하거나 아래 카드에서 선택해 세부 내용을 편집하세요.</p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <!-- 기존 인물 선택 및 인물 대화 추가 콤보 -->
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(139, 92, 246, 0.16); border: 1.5px solid #8b5cf6; padding: 4px 8px; border-radius: 8px;">
                <span style="font-size: 13px;">👤</span>
                <select data-author-field="existingCharacterSelect" style="padding: 4px 8px; font-size: 12px; font-weight: 700; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 6px; max-width: 190px;" title="대화할 인물 선택">
                  <option value="">+ 새 인물 직접 생성</option>
                  ${allCharacters.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)} (${escapeHtml(c.role || c.summary || '인물')})</option>`).join('')}
                </select>
                ${actionButton('+ 👤 인물 대화 추가', 'add-hotspot:character', 'is-primary')}
              </div>
              ${actionButton('+ 📖 책/일지 추가', 'add-hotspot:book', 'is-primary')}
              ${actionButton('+ 🔍 사물/단서 조사 추가', 'add-hotspot:inspect', 'is-primary')}
              ${actionButton('+ 🎁 소지품 획득 추가', 'add-hotspot:item', 'is-primary')}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; margin-bottom: 16px;">
            ${hotspotChips || '<p class="author-empty" style="grid-column: 1 / -1;">등록된 조사 지점이 없습니다. 상단 추가 버튼으로 지점을 만들어보세요.</p>'}
          </div>

          <!-- 선택된 지점 상세 인스펙터 -->
          ${activeHotspot ? `
            <div style="background: rgba(15, 23, 42, 0.65); border: 1.5px solid var(--brand-accent); border-radius: 10px; padding: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 20px;">${activeHotspot.icon || '📍'}</span>
                  <div>
                    <strong style="font-size: 16px; color: #fff;">[${escapeHtml(activeHotspot.title || '지점')}] 세부 상호작용 및 내용 편집</strong>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                      종류: <span style="color: #60a5fa; font-weight: 700;">${activeHotspot.type === 'character' ? '인물 대화' : (activeHotspot.type === 'book' ? '책/일지' : (activeHotspot.type === 'item' ? '소지품 획득' : '사물/단서 조사'))}</span> · 좌표: (${activeHotspot.coords?.x ?? 50}%, ${activeHotspot.coords?.y ?? 50}%)
                    </div>
                  </div>
                </div>
                ${actionButton('이 지점 삭제', `delete-hotspot:${this.selectedHotspotIndex}`, 'is-danger')}
              </div>

              <!-- 공통 메타 정보 -->
              <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px;">
                ${field('지점 표시 이름', 'hotspot:title', activeHotspot.title || '', 'text', { attributes: `data-hotspot-index="${this.selectedHotspotIndex}"` })}
                ${selectField('상호작용 종류', 'hotspot:type', activeHotspot.type || 'inspect', hotspotTypes, `data-hotspot-index="${this.selectedHotspotIndex}"`)}
                ${field('아이콘 (이모지)', 'hotspot:icon', activeHotspot.icon || '🔍', 'text', { attributes: `data-hotspot-index="${this.selectedHotspotIndex}"` })}
                ${field('가로 위치 X (%)', 'hotspot:x', activeHotspot.coords?.x ?? 50, 'number', { attributes: `data-hotspot-index="${this.selectedHotspotIndex}" min="0" max="100"` })}
                ${field('세로 위치 Y (%)', 'hotspot:y', activeHotspot.coords?.y ?? 50, 'number', { attributes: `data-hotspot-index="${this.selectedHotspotIndex}" min="0" max="100"` })}
                ${selectField('연결할 단서 도감 (조사 시 자동 해금)', 'hotspot:memoId', activeHotspot.memoId ?? activeHotspot.codexId ?? '', memoOptions, `data-hotspot-index="${this.selectedHotspotIndex}"`)}
              </div>

              <!-- 상호작용 및 대화 본문 비주얼 에디터 -->
              ${this.renderHotspotInteractiveContent(activeHotspot, this.selectedHotspotIndex, itemOptions, recordOptions, subItemOptions, allCharacters)}
            </div>
          ` : ''}
        </section>
      </div>
    `;
  }

  renderHotspotInteractiveContent(hotspot, index, itemOptions, recordOptions = [], subItemOptions = [], allCharacters = []) {
    const type = hotspot.type || 'inspect';
    if (!allCharacters || allCharacters.length === 0) {
      allCharacters = CODEX_DATA.filter((item) => item.category === 'character');
    }

    if (type === 'character') {
      const charName = hotspot.characterName || hotspot.title || '';
      const charRole = hotspot.characterRole || '';
      const charImage = hotspot.image || '';
      const monologue = hotspot.monologue || '';
      const firstGreeting = hotspot.dialogueTree?.start?.text || '';
      const options = (hotspot.dialogueTree?.start?.options || []).filter((opt) => opt.nextNode !== 'exit');

      return `
        <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 10px;">
          <!-- 세부 타일 및 세부설명 노브 해금 설정 -->
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 14px;">
            <div style="font-weight: 700; color: #c4b5fd; font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <span>⬜ 대화 시 해금할 세부 타일 및 세부설명 노브</span>
            </div>
            <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
              ${selectField('⬜ 대화 시 즉시 해금할 세부 타일 (소분류)', 'hotspot:grantsSubItemId', hotspot.grantsSubItemId || '', subItemOptions, `data-hotspot-index="${index}"`)}
              ${selectField('📝 대화 시 즉시 해금할 세부설명 노브 (선택)', 'hotspot:grantsRecordId', hotspot.grantsRecordId || '', recordOptions, `data-hotspot-index="${index}"`)}
            </div>
          </div>

          <!-- 인물 프로필 정보 -->
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
              <div style="font-weight: 700; color: #c4b5fd; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span>👤 인물 프로필 설정</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: #e2e8f0; font-weight: 700;">기존 인물 불러오기:</span>
                <select data-author-field="hotspot:applyExistingCharacter" data-hotspot-index="${index}" style="padding: 4px 8px; font-size: 12px; background: #0f172a; color: #f8fafc; border: 1.5px solid #8b5cf6; border-radius: 6px; font-weight: 700;" title="기존 인물 선택 시 프로필 자동 적용">
                  <option value="">-- 기존 인물 선택 시 프로필 자동 적용 --</option>
                  ${allCharacters.map((c) => `
                    <option value="${escapeHtml(c.id)}" ${hotspot.characterId === c.id || hotspot.characterName === c.title ? 'selected' : ''}>
                      ${escapeHtml(c.title)} (${escapeHtml(c.role || c.summary || '인물')})
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
            <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
              ${field('인물 이름', 'hotspot:characterName', charName, 'text', { attributes: `data-hotspot-index="${index}" placeholder="예: 사서 엘레나"` })}
              ${field('인물 직책 / 신분', 'hotspot:characterRole', charRole, 'text', { attributes: `data-hotspot-index="${index}" placeholder="예: 중앙 서고 관리 사서"` })}
              ${field('인물 초상화 이미지 URL (선택)', 'hotspot:image', charImage, 'url', { attributes: `data-hotspot-index="${index}" placeholder="images/elena.png"` })}
            </div>
            <label style="display: flex; align-items: center; gap: 7px; margin-top: 10px; font-size: 12px; color: #e2e8f0; font-weight: 700; cursor: pointer; background: rgba(15, 23, 42, 0.6); padding: 7px 10px; border-radius: 6px; border: 1.5px solid rgba(96, 165, 250, 0.35);">
              <input type="checkbox" data-author-field="hotspot:hideAfterDialogue" data-hotspot-index="${index}" ${hotspot.hideAfterDialogue !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
              <span>🚶 대화 종료 후 장소에서 사라지기 (기본값: 체크됨 — 대화를 마치면 인물이 자리를 떠나며 다시 클릭되지 않음)</span>
            </label>
          </div>

          <!-- 독백 및 첫마디 대사 -->
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 14px;">
            <div style="font-weight: 700; color: #93c5fd; font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <span>💬 대화 시작 시 반응 및 첫마디 (본문과 동일하게 단서·세부설명·아이템·텍스트 연출 모두 삽입 가능)</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${this.renderRichTextareaField('💭 주인공 레이든의 반응 / 속마음 독백', 'hotspot:monologue', monologue, {
                hotspotIndex: index,
                rows: 3,
                placeholder: '(서고 관리인 엘레나다. 어젯밤 결계 침입 사건에 대해 물어보자.) - 비워두면 독백창이 뜨지 않습니다.'
              })}
              ${this.renderRichTextareaField('💬 인물의 첫마디 대사 (인사말 / 시작 대사)', 'hotspot:dialogueText', firstGreeting, {
                hotspotIndex: index,
                rows: 3,
                placeholder: '“도서관에 오신 것을 환영합니다. 무슨 책을 찾고 계신가요?”'
              })}
            </div>
          </div>

          <!-- 대화 및 질문 분기 시각화 트리 -->
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <strong style="color: #fde047; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                  <span>❓ 질문 및 답변 분기 목록 (${options.length}개)</span>
                </strong>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">
                  플레이어가 인물에게 물어볼 질문(선택지)과 그에 대한 인물의 답변을 추가하고, 스탯 제한(요구치) 및 답변마다 단서·세부설명·아이템 등을 자유롭게 넣으세요.
                </p>
              </div>
              ${actionButton('+ ❓ 새 질문 추가', `add-dialogue-option:${this.getActiveSceneId()}:${index}`, 'is-primary')}
            </div>

            ${options.length === 0 ? `
              <div style="text-align: center; padding: 20px; background: rgba(15, 23, 42, 0.5); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.15); color: var(--text-muted); font-size: 12.5px;">
                등록된 질문 선택지가 없습니다.<br>
                우측 상단 <strong>[+ ❓ 새 질문 추가]</strong> 버튼을 눌러 플레이어가 물어볼 수 있는 질문과 답변을 만들어보세요.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${options.map((opt, optIdx) => {
                  const sceneId = this.getActiveSceneId();
                  const nodeKey = opt.nextNode;
                  const answerNode = hotspot.dialogueTree?.[nodeKey] || {};
                  const statCond = opt.condition?.stat || {};
                  const statKey = Object.keys(statCond)[0] || '';
                  const statVal = statKey ? (statCond[statKey] ?? 5) : 5;
                  return `
                    <div style="padding: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 12px; font-weight: 800; color: #fde047; display: inline-flex; align-items: center; gap: 4px;">
                          <span>질문 ${optIdx + 1}</span>
                          <span style="color: var(--text-muted); font-weight: normal; font-size: 11px;">(노드 키: ${escapeHtml(nodeKey)})</span>
                        </span>
                        ${actionButton('이 질문 삭제', `delete-dialogue-option:${sceneId}:${index}:${nodeKey}`, 'is-danger')}
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label class="author-field" style="margin: 0;">
                          <span style="font-size: 11.5px; font-weight: 600; color: #e2e8f0;">선택지 문장 (플레이어가 고를 질문)</span>
                          <input type="text" data-author-field="dialogueOptionText:${sceneId}:${index}:${nodeKey}" value="${escapeHtml(opt.text || '')}" placeholder="예: 어젯밤 침입 사건에 대해 묻는다.">
                        </label>

                        <!-- 스탯 조건 설정 -->
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(165, 180, 252, 0.25); border-radius: 6px; padding: 8px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
                          <div style="font-size: 12px; font-weight: 700; color: #a5b4fc; display: flex; align-items: center; gap: 4px;">
                            <span>🔒 질문 요구 스탯:</span>
                          </div>
                          <select data-author-field="dialogueReqStatKey:${sceneId}:${index}:${nodeKey}" style="padding: 4px 8px; font-size: 12px; background: #0f172a; color: #f8fafc; border: 1.5px solid rgba(165, 180, 252, 0.35); border-radius: 5px; font-weight: 600;">
                            <option value="" ${!statKey ? 'selected' : ''}>(제한 없음 - 누구나 질문 가능)</option>
                            <option value="perception" ${statKey === 'perception' ? 'selected' : ''}>👁️ 관찰력 (Perception)</option>
                            <option value="knowledge" ${statKey === 'knowledge' ? 'selected' : ''}>📚 지식 (Knowledge)</option>
                            <option value="social" ${statKey === 'social' ? 'selected' : ''}>💬 사교력 (Social)</option>
                            <option value="magic" ${statKey === 'magic' ? 'selected' : ''}>✨ 마법 (Magic)</option>
                            <option value="stamina" ${statKey === 'stamina' ? 'selected' : ''}>⚡ 체력 (Stamina)</option>
                          </select>
                          <div style="display: flex; align-items: center; gap: 6px; ${statKey ? '' : 'opacity: 0.4; pointer-events: none;'}">
                            <span style="font-size: 12px; color: #e2e8f0; font-weight: 600;">요구 수치:</span>
                            <input type="number" data-author-field="dialogueReqStatVal:${sceneId}:${index}:${nodeKey}" value="${statVal}" min="1" max="100" style="width: 65px; padding: 4px 6px; font-size: 12px; background: #0f172a; color: #f8fafc; border: 1.5px solid rgba(165, 180, 252, 0.35); border-radius: 5px; text-align: center; font-weight: 700;">
                            <span style="font-size: 12px; color: #94a3b8;">이상 필요</span>
                          </div>
                          ${statKey ? `<span style="font-size: 11px; color: #fbbf24; margin-left: auto;">💡 플레이어의 스탯이 ${statVal} 미만이면 잠금(🔒) 상태로 표시됩니다.</span>` : ''}
                        </div>

                        ${this.renderRichTextareaField('💬 인물의 답변 대사 (선택 시 인물이 대답할 말 · 단서/세부설명/아이템 태그 지원)', `dialogueAnswerText:${sceneId}:${index}:${nodeKey}`, answerNode.text || '', {
                          rows: 3,
                          placeholder: '예: “자정에 서고 안쪽에서 결계 경보가 울렸어요……”'
                        })}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}

            <div style="margin-top: 10px; font-size: 11.5px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
              <span>💡</span>
              <span>‘대화를 마친다’ 종료 버튼은 인게임 대화창에서 자동으로 하단에 항상 함께 표시됩니다.</span>
            </div>
          </div>
        </div>
      `;
    }

    if (type === 'book') {
      hotspot.pages ||= [
        {
          indexTitle: '1장: 개요',
          pageTitle: '제1장. 기록의 시작',
          content: '책의 첫 번째 쪽 내용입니다. 자유롭게 문단을 작성하거나 아래 태그 도구를 눌러 단서, 아이템, 추가기록을 본문에 삽입할 수 있습니다.'
        }
      ];
      const monologue = hotspot.monologue || '';
      return `
        <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 10px;">
          <!-- 독백 및 해금 설정 -->
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(217, 119, 6, 0.35); border-radius: 8px; padding: 14px;">
            <div style="font-weight: 700; color: #fde047; font-size: 13px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>💭 책을 펼쳤을 때 레이든의 독백 / 속마음 및 해금 설정</span>
            </div>
            <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 10px;">
              ${selectField('⬜ 책 열람 시 즉시 해금할 세부 타일 (소분류)', 'hotspot:grantsSubItemId', hotspot.grantsSubItemId || '', subItemOptions, `data-hotspot-index="${index}"`)}
              ${selectField('📝 책 열람 시 즉시 해금할 세부설명 노브 (선택)', 'hotspot:grantsRecordId', hotspot.grantsRecordId || '', recordOptions, `data-hotspot-index="${index}"`)}
            </div>
            ${this.renderRichTextareaField('💭 주인공 레이든의 독백', 'hotspot:monologue', monologue, {
              hotspotIndex: index,
              rows: 3,
              placeholder: '(서고에 꽂혀 있던 마도서다. 중요한 내용이 적혀 있는지 살펴보자.) - 비워두면 독백창이 뜨지 않습니다.'
            })}
          </div>

          <!-- 책 페이지 & 색인 목차 편집기 -->
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <strong style="color: #fde047; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                  <span>📖 책 페이지(쪽) 및 인덱스 목차 관리 (${hotspot.pages.length}쪽)</span>
                </strong>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">
                  독자가 책을 열람할 때 한 쪽씩 보게 되며, 옆면의 인덱스 책갈피 탭을 누르면 해당 쪽으로 즉시 이동합니다.
                </p>
              </div>
              ${actionButton('+ 📄 새 페이지(쪽) 추가', `add-book-page:${index}`, 'is-primary')}
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px;">
              ${hotspot.pages.map((page, pIdx) => {
                return `
                <div style="padding: 16px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                    <span style="font-size: 13px; font-weight: 800; color: #111827; display: inline-flex; align-items: center; gap: 6px;">
                      <span>📄 제 ${pIdx + 1} 쪽</span>
                      <span style="color: #64748b; font-size: 11.5px; font-weight: normal;">(인덱스 라벨: ${escapeHtml(page.indexTitle || `${pIdx + 1}쪽`)})</span>
                    </span>
                    ${actionButton('이 페이지 삭제', `delete-book-page:${index}:${pIdx}`, 'is-danger')}
                  </div>

                  <div class="author-grid" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <label class="author-field" style="margin: 0;">
                      <span style="font-size: 11.5px; font-weight: 700; color: #111827;">🔖 인덱스 탭 이름 (책 옆면 책갈피에 뜰 문구)</span>
                      <input type="text" data-author-field="bookPageIndexTitle:${index}:${pIdx}" value="${escapeHtml(page.indexTitle || '')}" placeholder="예: 1장: 결계 개론" style="color: #111827; background: #ffffff; border: 1.5px solid #cbd5e1;">
                    </label>
                    <label class="author-field" style="margin: 0;">
                      <span style="font-size: 11.5px; font-weight: 700; color: #111827;">📑 페이지 소제목 (본문 상단 제목)</span>
                      <input type="text" data-author-field="bookPageTitle:${index}:${pIdx}" value="${escapeHtml(page.pageTitle || '')}" placeholder="예: 제1장. 아카데미 결계의 기본 구조" style="color: #111827; background: #ffffff; border: 1.5px solid #cbd5e1;">
                    </label>
                  </div>

                  ${this.renderRichTextareaField('📖 페이지 본문 내용 (줄바꿈 문단 · 단서 발견 / 세부 설명 추가 / 아이템 획득 등 모든 본문 기능 지원)', `bookPageContent:${index}:${pIdx}`, page.content || '', {
                    rows: 6,
                    lightTheme: true,
                    placeholder: '책의 본문 내용을 입력하세요. 상단 태그 버튼을 누르면 단서, 세부설명, 아이템 등 모든 게임 요소가 삽입됩니다.'
                  })}
                </div>
              `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (type === 'item' || type === 'interactive') {
      const currentItemId = hotspot.itemId || hotspot.grantsItemId || '';
      return `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px;">
            <div style="font-weight: 700; color: #6ee7b7; font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <span>🎁 소지품 획득 및 조사 설정 (본문과 동일하게 단서·세부설명·아이템·텍스트 연출 모두 삽입 가능)</span>
            </div>
            <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 10px;">
              ${selectField('획득할 소지품 아이템', 'hotspot:grantsItemId', currentItemId, itemOptions, `data-hotspot-index="${index}"`)}
              ${selectField('잠금 해제에 필요한 아이템 (선택)', 'hotspot:requiresItem', hotspot.requiresItem || '', itemOptions, `data-hotspot-index="${index}"`)}
              ${selectField('⬜ 조사 시 즉시 해금할 세부 타일 (소분류)', 'hotspot:grantsSubItemId', hotspot.grantsSubItemId || '', subItemOptions, `data-hotspot-index="${index}"`)}
              ${selectField('📝 조사 시 즉시 해금할 세부설명 노브 (선택)', 'hotspot:grantsRecordId', hotspot.grantsRecordId || '', recordOptions, `data-hotspot-index="${index}"`)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${this.renderRichTextareaField('👁️ 조사 / 발견 상황 설명문', 'hotspot:inspectText', hotspot.inspectText || '', {
                hotspotIndex: index,
                rows: 3,
                placeholder: '육중한 마호가니 책상 위에는 오래된 황동 열쇠가 놓여 있다.'
              })}
              ${this.renderRichTextareaField('💭 주인공 레이든의 반응 / 속마음 독백', 'hotspot:monologue', hotspot.monologue || '', {
                hotspotIndex: index,
                rows: 3,
                placeholder: '(서고 서랍을 열 수 있을 것 같은 열쇠다.)'
              })}
              ${hotspot.requiresItem ? field('🔒 잠겨있을 때 출력 문구', 'hotspot:lockedText', hotspot.lockedText || '', 'text', { attributes: `data-hotspot-index="${index}" placeholder="단단히 잠겨 있다. 특수한 열쇠가 필요해 보인다."` }) : ''}
            </div>
          </div>
        </div>
      `;
    }

    // Default: 'inspect' (사물/단서 조사)
    return `
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px;">
          <div style="font-weight: 700; color: #fde047; font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>🔍 사물 및 단서 조사 내용 설정 (본문과 동일하게 단서·세부설명·아이템·텍스트 연출 모두 삽입 가능)</span>
          </div>
          <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 10px;">
            ${selectField('⬜ 조사 시 즉시 해금할 세부 타일 (소분류)', 'hotspot:grantsSubItemId', hotspot.grantsSubItemId || '', subItemOptions, `data-hotspot-index="${index}"`)}
            ${selectField('📝 조사 시 즉시 해금할 세부설명 노브 (선택)', 'hotspot:grantsRecordId', hotspot.grantsRecordId || '', recordOptions, `data-hotspot-index="${index}"`)}
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${this.renderRichTextareaField('👁️ 객관적인 조사 결과 / 단서 관찰문', 'hotspot:inspectText', hotspot.inspectText || '', {
              hotspotIndex: index,
              rows: 4,
              placeholder: '서가 틈새에 푸른빛 룬 문자가 은은히 감도는 양피지 파편이 끼워져 있다.'
            })}
            ${this.renderRichTextareaField('💭 주인공 레이든의 추리 생각 / 독백 (속마음)', 'hotspot:monologue', hotspot.monologue || '', {
              hotspotIndex: index,
              rows: 3,
              placeholder: '(이 고대 문양…… 마법 결계의 해제식과 관련이 있어 보인다.) - 비워두면 독백창이 뜨지 않습니다.'
            })}
          </div>
        </div>
      </div>
    `;
  }

  availableEmptyTiles() {
    return MAP_TILES.filter((tile) => !tile.locationId && !tile.visualOnly && !tile.alwaysVisible);
  }

  renderMap() {
    const location = MAP_LOCATIONS.find((entry) => entry.id === this.selectedLocationId) || MAP_LOCATIONS[0];
    if (!location) return '<p>편집할 장소가 없습니다.</p>';
    this.selectedLocationId = location.id;
    if (INVESTIGATION_SCENES[location.id]) {
      this.selectedInvestigationSceneId = location.id;
    }
    const tile = MAP_TILES.find((entry) => entry.locationId === location.id);
    const scene = INVESTIGATION_SCENES[location.id];
    const slotOptions = this.availableEmptyTiles().map((entry) => ({
      value: entry.key, label: `(${entry.q}, ${entry.r})`
    }));
    const buildingOptions = BUILDING_TYPES.map((entry) => ({ value: entry.id, label: entry.label }));
    const memoOptions = [{ value: '', label: '연결하지 않음' }, ...CODEX_DATA.map((entry) => ({
      value: entry.id, label: `${entry.title} · ${this.memoCategoryLabel(entry.category)}`
    }))];
    const itemOptions = [{ value: '', label: '아이템 없음' }, ...INVENTORY_ITEMS.map((item) => ({
      value: item.id, label: item.name
    }))];
    const allSubItems = this.getAllSubItems();
    const subItemOptions = [
      { value: '', label: '해금할 세부 타일 없음' },
      ...allSubItems.map((s) => ({
        value: s.id,
        label: `[${s.parentTitle}] ${s.label} (${s.id})`
      }))
    ];
    const hotspotTypes = [
      { value: 'character', label: '인물' },
      { value: 'book', label: '책/일지' },
      { value: 'item', label: '아이템' },
      { value: 'inspect', label: '조사 지점' },
      { value: 'interactive', label: '상호작용' }
    ];
    const hotspotList = (scene?.hotspots || []).map((hotspot, index) => {
      const type = hotspot.type || 'inspect';
      const itemId = hotspot.itemId || hotspot.grantsItemId || hotspot.item?.id || hotspot.grantsItem?.id || '';
      return `
        <article class="author-card author-hotspot-card">
          <div class="author-card-heading"><strong>${escapeHtml(hotspot.title || `조사 지점 ${index + 1}`)}</strong>${actionButton('삭제', `delete-hotspot:${index}`, 'is-danger')}</div>
          <div class="author-grid">
            ${field('표시 이름', `hotspot:title`, hotspot.title || '', 'text', { attributes: `data-hotspot-index="${index}"` })}
            ${selectField('종류', `hotspot:type`, type, hotspotTypes, `data-hotspot-index="${index}"`)}
            ${field('가로 위치 (%)', `hotspot:x`, hotspot.coords?.x ?? 50, 'number', { attributes: `data-hotspot-index="${index}" min="0" max="100"` })}
            ${field('세로 위치 (%)', `hotspot:y`, hotspot.coords?.y ?? 50, 'number', { attributes: `data-hotspot-index="${index}" min="0" max="100"` })}
            ${field('아이콘', `hotspot:icon`, hotspot.icon || '🔍', 'text', { attributes: `data-hotspot-index="${index}"` })}
            ${selectField('연결할 메모 타일', `hotspot:memoId`, hotspot.memoId ?? hotspot.codexId ?? hotspot.unlockedCodexId ?? (type === 'character' ? hotspot.characterId : '') ?? '', memoOptions, `data-hotspot-index="${index}"`)}
            ${selectField('해금할 세부 타일 (소분류)', `hotspot:grantsSubItemId`, hotspot.grantsSubItemId || '', subItemOptions, `data-hotspot-index="${index}"`)}
            ${(type === 'item' || type === 'interactive') ? selectField(type === 'item' ? '획득할 소지품' : '보상 소지품', `hotspot:${type === 'item' ? 'itemId' : 'grantsItemId'}`, itemId, itemOptions, `data-hotspot-index="${index}"`) : ''}
            ${type === 'character' ? field('인물 이름', `hotspot:characterName`, hotspot.characterName || hotspot.title || '', 'text', { attributes: `data-hotspot-index="${index}"` }) : ''}
            ${type === 'character' ? field('인물 역할', `hotspot:characterRole`, hotspot.characterRole || '', 'text', { attributes: `data-hotspot-index="${index}"` }) : ''}
            ${type === 'character' ? field('인물 그림 URL (선택)', `hotspot:image`, hotspot.image || '', 'url', { attributes: `data-hotspot-index="${index}" placeholder="https://..."` }) : ''}
            ${type === 'character' ? `
              <div style="grid-column: 1 / -1;">
                <label style="display: flex; align-items: center; gap: 7px; font-size: 12px; color: #e2e8f0; font-weight: 700; cursor: pointer; background: rgba(15, 23, 42, 0.6); padding: 6px 10px; border-radius: 6px; border: 1.5px solid rgba(96, 165, 250, 0.35);">
                  <input type="checkbox" data-author-field="hotspot:hideAfterDialogue" data-hotspot-index="${index}" ${hotspot.hideAfterDialogue !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                  <span>🚶 대화 종료 후 장소에서 사라지기 (자리를 떠남)</span>
                </label>
              </div>
            ` : ''}
          </div>
          ${this.renderRichTextareaField(
            type === 'character' ? '💬 인물 첫마디 (기본 대사)' : '👁️ 조사 결과 설명 (사물/단서 설명)',
            `hotspot:${type === 'character' ? 'dialogueText' : 'inspectText'}`,
            type === 'character' ? (hotspot.dialogueTree?.start?.text || '') : (hotspot.inspectText || ''),
            {
              hotspotIndex: index,
              rows: 3,
              placeholder: type === 'character' ? '인물과 대화 시작 시 첫마디로 나오는 대사입니다.' : '사물이나 단서를 조사했을 때 나오는 객관적인 상황 설명입니다.'
            }
          )}
          ${this.renderRichTextareaField(
            '💭 주인공 레이든의 독백 / 반응 (속마음)',
            'hotspot:monologue',
            hotspot.monologue || '',
            {
              hotspotIndex: index,
              rows: 2,
              placeholder: '사물이나 인물을 마주했을 때 주인공 레이든의 머릿속에 떠오르는 생각/독백 (비워두면 표시 안 됨)'
            }
          )}
          ${type === 'character' ? `
            <div class="author-dialogue-tree-box" style="margin-top: 10px; padding: 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(96, 165, 250, 0.3); border-radius: 8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                <strong style="color: #60a5fa; font-size: 13px;">💬 인물과의 질문 / 탐문 선택지 목록</strong>
                ${actionButton('+ 질문 추가', `add-dialogue-option:${location.id}:${index}`, 'is-primary')}
              </div>
              ${((hotspot.dialogueTree?.start?.options || []).filter((o) => o.nextNode !== 'exit').length === 0) ? `
                <p class="author-empty" style="font-size: 12px; margin: 4px 0 8px 0;">등록된 질문이 없습니다. [+ 질문 추가] 버튼으로 플레이어가 물어볼 수 있는 질문과 인물의 답변을 만드세요.</p>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${(hotspot.dialogueTree?.start?.options || []).filter((o) => o.nextNode !== 'exit').map((opt, optIdx) => {
                    const nodeKey = opt.nextNode;
                    const answerNode = hotspot.dialogueTree?.[nodeKey] || {};
                    const statCond = opt.condition?.stat || {};
                    const statKey = Object.keys(statCond)[0] || '';
                    const statVal = statKey ? (statCond[statKey] ?? 5) : 5;
                    return `
                      <div style="padding: 10px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                          <span style="font-size: 12px; font-weight: 700; color: #fde047;">❓ 질문 ${optIdx + 1}</span>
                          ${actionButton('질문 삭제', `delete-dialogue-option:${location.id}:${index}:${nodeKey}`, 'is-danger')}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                          <label class="author-field" style="margin-bottom: 6px;">
                            <span style="font-size: 11px; font-weight: 600; color: #e2e8f0;">질문 문장 (플레이어 선택지)</span>
                            <input type="text" data-author-field="dialogueOptionText:${location.id}:${index}:${nodeKey}" value="${escapeHtml(opt.text || '')}" placeholder="예: 어젯밤 상황에 대해 묻는다.">
                          </label>

                          <!-- 스탯 조건 설정 -->
                          <div style="background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(165, 180, 252, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
                            <span style="font-size: 11.5px; font-weight: 700; color: #a5b4fc;">🔒 요구 스탯:</span>
                            <select data-author-field="dialogueReqStatKey:${location.id}:${index}:${nodeKey}" style="padding: 3px 6px; font-size: 11.5px; background: #0f172a; color: #f8fafc; border: 1px solid rgba(165, 180, 252, 0.35); border-radius: 4px; font-weight: 600;">
                              <option value="" ${!statKey ? 'selected' : ''}>(제한 없음)</option>
                              <option value="perception" ${statKey === 'perception' ? 'selected' : ''}>👁️ 관찰력</option>
                              <option value="knowledge" ${statKey === 'knowledge' ? 'selected' : ''}>📚 지식</option>
                              <option value="social" ${statKey === 'social' ? 'selected' : ''}>💬 사교력</option>
                              <option value="magic" ${statKey === 'magic' ? 'selected' : ''}>✨ 마법</option>
                              <option value="stamina" ${statKey === 'stamina' ? 'selected' : ''}>⚡ 체력</option>
                            </select>
                            <div style="display: flex; align-items: center; gap: 4px; ${statKey ? '' : 'opacity: 0.4; pointer-events: none;'}">
                              <span style="font-size: 11px; color: #e2e8f0;">수치:</span>
                              <input type="number" data-author-field="dialogueReqStatVal:${location.id}:${index}:${nodeKey}" value="${statVal}" min="1" max="100" style="width: 55px; padding: 3px 4px; font-size: 11.5px; background: #0f172a; color: #f8fafc; border: 1px solid rgba(165, 180, 252, 0.35); border-radius: 4px; text-align: center; font-weight: 700;">
                              <span style="font-size: 11px; color: #94a3b8;">이상 필요</span>
                            </div>
                          </div>

                          ${this.renderRichTextareaField(
                            '💬 인물의 답변 대사',
                            `dialogueAnswerText:${location.id}:${index}:${nodeKey}`,
                            answerNode.text || '',
                            {
                              rows: 3,
                              placeholder: '예: 자정에 갑자기 결계 경보가 울렸어요...'
                            }
                          )}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
              <div style="margin-top: 8px; font-size: 11px; color: #94a3b8;">
                💡 '대화를 마친다 (닫기)' 선택지는 게임 실행 시 자동으로 하단에 함께 제공됩니다.
              </div>
            </div>
          ` : ''}
        </article>`;
    }).join('');
    const sceneMarkup = location.hasInvestigation ? `
      <div class="author-section-heading" style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-subtle, #cbd5e1);">
        <div><h4>🔍 현장 조사 장면 편집</h4><p>조사 모드에서 표시할 배경과 상호작용 지점들을 편집합니다.</p></div>
      </div>
      ${scene ? `
        <div class="author-grid">
          ${field('장면 제목', 'scene:title', scene.title || '')}
          ${field('안내 문구', 'scene:subtitle', scene.subtitle || '')}
          ${field('배경 이미지 경로 (비워두면 선화 스케치)', 'scene:bgImage', scene.bgImage || '', 'text', { placeholder: 'assets/images/scenes/library_bg.jpg' })}
          ${selectField('배경 기본 스케치', 'scene:layout', scene.layout || 'library', [
            { value: 'library', label: '도서관' },
            { value: 'clocktower', label: '시계탑' },
            { value: 'garden', label: '정원' },
            { value: 'laboratory', label: '연구실' }
          ])}
          ${selectField('조사 나가기 후 열릴 이야기 장면', 'scene:exitStoryNode', scene.exitStoryNode || '', [
            { value: '', label: '기본 진행 장면' },
            ...Object.values(STORY_NODES).map((entry) => ({ value: entry.id, label: entry.title || entry.id }))
          ])}
        </div>
        <div class="author-section-heading"><div><h4>인물 · 아이템 · 조사 지점</h4><p>인물이나 아이템을 누르면 연결한 메모 타일이 자동으로 해금됩니다.</p></div>${actionButton('조사 지점 추가', 'add-hotspot')}</div>
        <div class="author-card-list">${hotspotList || '<p class="author-empty">등록된 조사 지점이 없습니다.</p>'}</div>
      ` : '<p class="author-empty">조사 장면을 불러오지 못했습니다.</p>'}
    ` : '';
    return `
      <div class="author-section-heading">
        <div><h3>지도 타일 및 장소 관리</h3><p>지도 클릭 시 이동할 본문 이야기 장면과 현장 조사 장면을 설정하세요.</p></div>
        ${actionButton('새 장소 추가', 'add-location')}
      </div>
      <div class="author-grid">
        ${selectField('편집할 장소', 'locationSelect', location.id, MAP_LOCATIONS.map((entry) => ({
          value: entry.id, label: `${entry.name} (${entry.id})`
        })))}
        ${selectField('새 장소에 사용할 빈 칸', 'emptyTileSelect', this.emptyTileKey || slotOptions[0]?.value || '', slotOptions.length ? slotOptions : [{ value: '', label: '사용 가능한 빈 칸이 없습니다' }])}
        ${field('장소 이름', 'locationName', location.name || '')}
        ${field('짧은 소개', 'locationSubtitle', location.subtitle || '')}
        ${field('장소 설명', 'locationDescription', location.description || '', 'textarea', { attributes: 'rows="3"' })}
        ${field('아이콘', 'locationIcon', location.icon || '📍')}
        ${field('시작부터 해금', 'locationUnlocked', location.unlocked, 'checkbox')}

        <div style="background: rgba(30, 41, 59, 0.75); border: 1.5px solid #3b82f6; border-radius: 10px; padding: 14px; grid-column: 1 / -1; margin: 4px 0;">
          <div style="font-weight: 700; color: #93c5fd; font-size: 13.5px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>🎯 지도 클릭 시 연결될 장면 (플레이어에게는 '이동하기'로만 표시됨)</span>
          </div>
          <div class="author-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
            ${selectField('연결할 장면 종류', 'locationDestinationType', (location.destinationType === 'story' || (!location.destinationType && location.targetStoryNode && (!location.hasInvestigation || location.travelMode === 'story'))) ? 'story' : 'investigation', [
              { value: 'investigation', label: '🔍 현장 조사 장면으로 이동 (자유 조사·탐색)' },
              { value: 'story', label: '📖 본문 이야기 장면으로 이동 (스토리 노드)' }
            ])}
            ${(location.destinationType === 'story' || (!location.destinationType && location.targetStoryNode && (!location.hasInvestigation || location.travelMode === 'story')))
              ? selectField('연결할 본문 이야기 장면', 'locationStoryTarget', location.targetStoryNode || '', [
                  { value: '', label: '이야기 장면 선택...' },
                  ...Object.values(STORY_NODES).map((entry) => ({ value: entry.id, label: `[본문] ${entry.title || entry.id} (${entry.id})` }))
                ])
              : `<div style="display: flex; align-items: center; padding: 8px 12px; background: rgba(15, 23, 42, 0.6); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.15); font-size: 12px; color: #cbd5e1;">
                  <span>🔍 이 장소의 <strong>현장 조사 장면</strong>으로 연결됩니다. (하단에서 배경 및 지점 편집 가능)</span>
                </div>`
            }
          </div>
        </div>

        ${tile ? field('가로 좌표 (q)', 'tileQ', tile.q, 'number', { attributes: 'step="1"' }) : ''}
        ${tile ? field('세로 좌표 (r)', 'tileR', tile.r, 'number', { attributes: 'step="1"' }) : ''}
        ${tile ? selectField('건물 그림', 'tileBuilding', tile.building || '', buildingOptions) : ''}
        ${tile ? field('건물 이미지 URL (선택)', 'tileImage', tile.image || location.image || '', 'url', { attributes: 'placeholder="https://..."' }) : ''}
      </div>
      ${sceneMarkup}`;
  }

  renderCharacter() {
    const characters = CODEX_DATA.filter((item) => item.category === 'character');
    let char = characters.find((item) => item.id === this.selectedCharacterId) || characters[0];
    if (!char) {
      return `
        <div class="author-section-heading">
          <div>
            <h3>등장인물 관리</h3>
            <p>등록된 인물이 없습니다. 새 인물을 추가해 보세요.</p>
          </div>
          <div class="author-button-row">
            ${actionButton('💾 저장', 'save-disk', 'is-primary')}
            ${actionButton('+ 새 인물 추가', 'add-character', 'is-primary')}
          </div>
        </div>
      `;
    }
    this.selectedCharacterId = char.id;

    const currentStoryNode = STORY_NODES[this.selectedStoryNodeId];
    const currentSceneTitle = currentStoryNode?.title || '현재 장면';

    return `
      <div class="author-section-heading">
        <div>
          <h3>등장인물 목록 및 프로필 관리</h3>
          <p>등록된 인물 목록을 한눈에 보고 선택하여 프로필, 도감 설명, 아바타 이미지를 손쉽게 수정합니다.</p>
        </div>
        <div class="author-button-row">
          ${actionButton('💾 저장', 'save-disk', 'is-primary')}
          ${actionButton('+ 새 인물 추가', 'add-character')}
        </div>
      </div>

      <!-- Character Roster / List Section -->
      <div class="author-character-roster-container">
        <div class="author-roster-header">
          <div class="author-roster-title-group">
            <h4>👥 등장인물 목록 <span style="font-size:12px; font-weight:600; padding:2px 8px; background:rgba(212, 175, 55, 0.15); color:var(--accent-gold); border-radius:999px;">${characters.length}명</span></h4>
            <span class="author-roster-subtitle">인물 카드를 클릭하면 아래에서 프로필을 즉시 수정할 수 있습니다.</span>
          </div>
          <div class="author-roster-actions">
            <input type="text" class="author-char-search" data-author-field="characterSearch" placeholder="🔍 인물 이름 / 역할 검색..." autocomplete="off">
            ${actionButton('+ 새 인물 추가', 'add-character', 'is-primary')}
          </div>
        </div>

        <div class="author-character-cards-grid" id="author-character-cards-grid">
          ${characters.map((c) => {
            const isSelected = c.id === char.id;
            const avatarSrc = (c.icon && c.icon.includes('/')) ? c.icon : (c.image && c.image.includes('/') ? c.image : null);
            return `
              <div class="author-char-card ${isSelected ? 'is-selected' : ''}" 
                   data-author-action="select-character:${escapeHtml(c.id)}"
                   data-char-title="${escapeHtml(c.title || '')}"
                   data-char-summary="${escapeHtml(c.summary || '')}"
                   role="button" 
                   tabindex="0"
                   title="${escapeHtml(c.title)} 선택하여 수정">
                <div class="char-card-avatar">
                  ${avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(c.title)}">` : `<span style="font-size:24px;">${escapeHtml(c.icon || '👤')}</span>`}
                </div>
                <div class="char-card-info" style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <strong class="char-card-name">${escapeHtml(c.title)}</strong>
                    ${isSelected ? `<span class="char-card-badge" style="font-size:10.5px; padding:1px 6px; background:#f59e0b; color:#fff; border-radius:999px; font-weight:700;">편집 중</span>` : ''}
                  </div>
                  <p class="char-card-role">${escapeHtml(c.summary || '역할/소개 미정')}</p>
                </div>
                <div class="char-card-actions" style="display:flex; align-items:center; gap:4px;" onclick="event.stopPropagation();">
                  <button type="button" class="author-action is-subtle" data-author-action="insert-char-into-story:${escapeHtml(c.id)}" title="현재 장면에 [인물: ${escapeHtml(c.title)}] 태그 삽입" style="font-size:11px; padding:3px 7px;">+ 장면삽입</button>
                  ${characters.length > 1 ? `<button type="button" class="author-action is-danger" data-author-action="delete-character-id:${escapeHtml(c.id)}" title="이 인물 삭제" style="font-size:11px; padding:3px 6px;">🗑️</button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Selected Character Detail Editor Section -->
      <div class="author-character-detail-section" style="padding:18px 20px; background:var(--bg-card); border-radius:14px; border:1.5px solid rgba(245, 158, 11, 0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:12px; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">✏️</span>
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--text-main);">[${escapeHtml(char.title)}] 인물 프로필 상세 편집</h3>
              <span style="font-size:12px; color:var(--text-muted);">식별자 ID: <code>${escapeHtml(char.id)}</code></span>
            </div>
          </div>
          <div class="author-button-row">
            ${actionButton('💾 저장', 'save-disk', 'is-primary')}
            ${actionButton('📋 본문 태그 복사', `copy-character-tag:${char.id}`)}
            ${actionButton(`+ "${currentSceneTitle}" 본문에 삽입`, `insert-char-into-story:${char.id}`, 'is-primary')}
            ${characters.length > 1 ? actionButton('이 인물 삭제', `delete-character-id:${char.id}`, 'is-danger') : ''}
          </div>
        </div>

        <!-- Real-time Live Character Avatar / Illustration Preview -->
        <div id="author-character-live-preview" style="display:flex; align-items:center; gap:16px; margin-bottom:18px; padding:12px 16px; background:var(--bg-surface); border-radius:10px; border:1px solid var(--border-subtle);">
          <div id="author-char-preview-avatar" style="width:56px; height:56px; border-radius:50%; overflow:hidden; border:2px solid var(--accent-gold); background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:26px;">
            ${((char.icon && char.icon.includes('/')) || (char.image && char.image.includes('/'))) ? `<img src="${escapeHtml(char.icon && char.icon.includes('/') ? char.icon : char.image)}" alt="${escapeHtml(char.title)}" style="width:100%; height:100%; object-fit:contain;">` : escapeHtml(char.icon || '👤')}
          </div>
          <div style="flex:1; min-width:0;">
            <strong id="author-char-preview-name" style="font-size:16px; color:var(--text-main); display:block;">${escapeHtml(char.title)}</strong>
            <span id="author-char-preview-summary" style="font-size:12.5px; color:var(--text-muted);">${escapeHtml(char.summary || '역할/소개 미정')}</span>
          </div>
          ${char.image ? `
            <div style="height:60px; max-width:80px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.04); border-radius:6px; border:1px solid var(--border-subtle); padding:2px;">
              <img src="${escapeHtml(char.image)}" alt="전신 일러스트" style="max-height:100%; max-width:100%; object-fit:contain;">
            </div>
          ` : ''}
        </div>

        <div class="author-grid">
          ${field('인물 이름', 'character:title', char.title || '')}
          ${field('역할 / 직책 / 한 줄 요약', 'character:summary', char.summary || '', 'text', { attributes: 'placeholder="예: 공간 마법학 교수, 룸메이트"' })}
          ${field('아이콘 / 아바타 (이모지 또는 이미지 경로)', 'character:icon', char.icon || '👤', 'text', { attributes: 'placeholder="예: 👤 또는 images/elena_avatar.png"' })}
          ${field('전신 일러스트 이미지 경로 (선택)', 'character:image', char.image || '', 'text', { attributes: 'placeholder="예: images/elena.png"' })}
          ${field('상세 소개 (성격, 배경 설정, 외모)', 'character:description', char.description || '', 'textarea', { attributes: 'rows="4" placeholder="인물의 성격과 과거 행적, 특징 등을 자세히 적어주세요."' })}
          ${field('관련 에피소드 ID', 'character:relatedEpisode', char.relatedEpisode || 'ep1')}
          ${field('현재 위치 (이 회차 기준)', 'character:currentLocation', char.currentLocation || '', 'text', { attributes: 'placeholder="예: 도서관, 정원, 시계탑 테라스"' })}
          ${field('처음부터 도감에 공개', 'character:unlockedByDefault', Boolean(char.unlockedByDefault), 'checkbox')}
        </div>

        <div class="author-helper-box" style="margin-top:16px; padding:12px 16px; background:var(--bg-surface); border-radius:10px; border:1px solid var(--border-subtle);">
          <strong style="color:var(--text-main); font-size:13px;">💡 본문 태그 연동 안내</strong>
          <p style="font-size:12px; color:var(--text-muted); margin:4px 0 8px;">본문에서 이 인물을 등장시키고 도감에 등록하려면 상단 <strong>[+ 본문에 삽입]</strong>을 누르거나 아래 태그를 본문에 복사해 넣으세요:</p>
          <code style="display:block; padding:8px 12px; background:var(--bg-card); border-radius:6px; font-size:12px; color:#60a5fa; user-select:all;">[인물: ${escapeHtml(char.title)} | ${escapeHtml(char.summary || '인물 소개')} | ${escapeHtml(char.icon || '👤')}]</code>
        </div>
      </div>
    `;
  }

  addCharacter() {
    const id = `char_${Date.now()}`;
    const newChar = {
      id,
      category: 'character',
      title: '새 인물',
      icon: '👤',
      summary: '새로운 등장인물입니다.',
      description: '인물의 상세한 배경 설정과 성격을 적어주세요.',
      relatedEpisode: 'ep1',
      unlockedByDefault: false,
      keywords: ['새 인물']
    };
    CODEX_DATA.push(newChar);
    this.selectedCharacterId = id;
    this.render();
    this.persist();
    this.setStatus('새 인물이 추가되었습니다. 아래 폼에서 인물 정보를 입력해 주세요.');
    this.saveToDisk();
  }

  deleteCharacter(charId = null) {
    const targetId = charId || this.selectedCharacterId;
    const characters = CODEX_DATA.filter((item) => item.category === 'character');
    if (characters.length <= 1) {
      alert('최소 하나의 인물은 유지해야 합니다.');
      return;
    }
    const idx = CODEX_DATA.findIndex((item) => item.id === targetId && item.category === 'character');
    if (idx !== -1) {
      const deletedName = CODEX_DATA[idx].title || targetId;
      if (!confirm(`[${deletedName}] 인물을 정말로 삭제하시겠습니까?`)) return;
      CODEX_DATA.splice(idx, 1);
      const remaining = CODEX_DATA.filter((item) => item.category === 'character');
      if (this.selectedCharacterId === targetId) {
        this.selectedCharacterId = remaining[0]?.id || '';
      }
      this.persist();
      this.render();
      this.setStatus(`[${deletedName}] 인물이 삭제되었습니다.`);
      this.saveToDisk(false, `[${deletedName}] 인물 삭제됨`);
    }
  }

  renderMemo() {
    this.memoViewMode ||= 'all';
    this.tileSearchQuery ||= '';
    this.tileFilterRole ||= 'all';

    const allTopics = CODEX_DATA.filter((item) => item.category !== 'character');
    const totalTopics = allTopics.length;
    let totalSubClues = 0;
    let totalSubItems = 0;
    allTopics.forEach((t) => {
      totalSubClues += (t.subClues || []).length;
      totalSubItems += (t.subItems || []).length;
    });

    const categoryOptions = [...MEMO_CATEGORIES];
    CODEX_CATEGORIES.forEach((category) => {
      if (!categoryOptions.some((option) => option.id === category.id)) {
        categoryOptions.push({ id: category.id, label: category.label });
      }
    });

    return `
      <div class="author-section-heading" style="margin-bottom: 12px;">
        <div>
          <h3 style="display:flex; align-items:center; gap:8px;">
            <span>🗂️ 타일 통합 관리자</span>
            <span style="font-size:12px; font-weight:700; padding:3px 10px; border-radius:999px; background:rgba(212,175,55,0.15); color:#d4af37; border:1px solid rgba(212,175,55,0.3);">
              대분류 ${totalTopics} · 단서 ${totalSubClues} · 세부타일 ${totalSubItems} (총 ${totalTopics + totalSubClues + totalSubItems}개)
            </span>
          </h3>
          <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted);">
            모든 대분류(주제), 중분류(단서), 소분류(세부타일)를 한눈에 확인하고 삭제, 내용 수정, 소속 대분류 이동, 역할 승격을 관리합니다.
          </p>
        </div>
        <div class="author-button-row">
          ${actionButton('💾 파일에 저장', 'save-disk', 'is-primary')}
          ${actionButton('+ ⬛ 새 대분류(주제) 추가', 'add-memo-topic')}
        </div>
      </div>

      <!-- 상단 뷰 모드 탭 & 검색/필터 바 -->
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:10px; margin-bottom:16px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="author-tab-btn" data-author-action="set-memo-view-mode:all" style="padding:6px 14px; font-size:12px; border-radius:6px; cursor:pointer; font-weight:700; ${this.memoViewMode === 'all' ? 'background:#d4af37; color:#111; border:none; box-shadow:0 2px 6px rgba(212,175,55,0.3);' : 'background:transparent; color:var(--text-main); border:1px solid var(--border-subtle);'}">
            📋 전체 타일 한눈에 보기
          </button>
          <button type="button" class="author-tab-btn" data-author-action="set-memo-view-mode:single" style="padding:6px 14px; font-size:12px; border-radius:6px; cursor:pointer; font-weight:700; ${this.memoViewMode === 'single' ? 'background:#d4af37; color:#111; border:none; box-shadow:0 2px 6px rgba(212,175,55,0.3);' : 'background:transparent; color:var(--text-main); border:1px solid var(--border-subtle);'}">
            📝 개별 타일 상세 폼
          </button>
          <button type="button" class="author-tab-btn" data-author-action="set-memo-view-mode:recipes" style="padding:6px 14px; font-size:12px; border-radius:6px; cursor:pointer; font-weight:700; ${this.memoViewMode === 'recipes' ? 'background:#d4af37; color:#111; border:none; box-shadow:0 2px 6px rgba(212,175,55,0.3);' : 'background:transparent; color:var(--text-main); border:1px solid var(--border-subtle);'}">
            🧪 가설 조합 레시피
          </button>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:440px; justify-content:flex-end;">
          <div style="position:relative; flex:1;">
            <input type="text" data-author-field="tileSearchQuery" value="${escapeHtml(this.tileSearchQuery)}" placeholder="🔍 타일명, 설명, 키워드 실시간 검색..." style="width:100%; padding:5px 24px 5px 10px; font-size:12px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-main);" />
            ${this.tileSearchQuery ? `<button type="button" data-author-action="clear-tile-search" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px;" title="검색어 지우기">✕</button>` : ''}
          </div>
          <select data-author-field="tileFilterRole" style="padding:5px 8px; font-size:11.5px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:6px; color:var(--text-main);">
            <option value="all" ${this.tileFilterRole === 'all' ? 'selected' : ''}>전체 타일</option>
            <option value="topic" ${this.tileFilterRole === 'topic' ? 'selected' : ''}>⬛ 대분류만</option>
            <option value="clue" ${this.tileFilterRole === 'clue' ? 'selected' : ''}>🔘 단서만</option>
            <option value="subitem" ${this.tileFilterRole === 'subitem' ? 'selected' : ''}>⬜ 세부타일만</option>
          </select>
        </div>
      </div>

      ${this.memoViewMode === 'all'
        ? this.renderAllTilesOverview(allTopics, categoryOptions)
        : this.memoViewMode === 'recipes'
        ? this.renderRecipesView()
        : this.renderSingleMemoForm(allTopics, categoryOptions)
      }
    `;
  }

  renderAllTilesOverview(allTopics, categoryOptions) {
    const q = (this.tileSearchQuery || '').trim().toLowerCase();
    const roleFilter = this.tileFilterRole || 'all';

    const filteredTopics = allTopics.filter((topic) => {
      if (!q && roleFilter === 'all') return true;

      const topicMatch = !q || (
        (topic.title && topic.title.toLowerCase().includes(q)) ||
        (topic.summary && topic.summary.toLowerCase().includes(q)) ||
        (topic.description && topic.description.toLowerCase().includes(q)) ||
        (topic.keywords && topic.keywords.some((k) => k.toLowerCase().includes(q)))
      );

      const clueMatch = (topic.subClues || []).some((sc) =>
        !q || (sc.label && sc.label.toLowerCase().includes(q)) || (sc.desc && sc.desc.toLowerCase().includes(q))
      );

      const subMatch = (topic.subItems || []).some((sub) =>
        !q || (sub.label && sub.label.toLowerCase().includes(q)) || (sub.desc && sub.desc.toLowerCase().includes(q))
      );

      if (roleFilter === 'topic') return topicMatch;
      if (roleFilter === 'clue') return clueMatch;
      if (roleFilter === 'subitem') return subMatch;

      return topicMatch || clueMatch || subMatch;
    });

    if (!filteredTopics.length) {
      return `
        <div style="padding: 32px 20px; text-align: center; background: var(--bg-surface); border-radius: 10px; border: 1px dashed var(--border-subtle); color: var(--text-muted);">
          <span style="font-size: 24px; display: block; margin-bottom: 8px;">🔍</span>
          <p style="font-size: 13px; margin: 0;">검색 및 필터 조건에 부합하는 타일이 없습니다.</p>
          ${q ? `<button type="button" class="author-action" data-author-action="clear-tile-search" style="margin-top: 10px; font-size: 11.5px;">검색어 초기화</button>` : ''}
        </div>
      `;
    }

    return `
      <div class="author-all-tiles-container" style="display: flex; flex-direction: column; gap: 16px;">
        ${filteredTopics.map((topic) => {
          const subClues = topic.subClues || [];
          const subItems = topic.subItems || [];
          const showClues = roleFilter === 'all' || roleFilter === 'clue';
          const showSubItems = roleFilter === 'all' || roleFilter === 'subitem';

          return `
            <article class="author-tile-topic-card" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
              
              <!-- 대분류 상단 헤더 -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 260px;">
                  <span style="font-size: 20px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 6px; border: 1.5px solid #cbd5e1;">${escapeHtml(topic.icon || '🔍')}</span>
                  <input type="text" data-author-field="memoTile:title" data-memo-id="${topic.id}" value="${escapeHtml(topic.title || '')}" placeholder="대분류 제목" style="font-size: 15px; font-weight: 700; color: #111827; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; flex: 1;" title="대분류 제목 실시간 수정" />
                  <span style="font-size: 11px; padding: 3px 8px; background: #f1f5f9; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 700; white-space: nowrap;">⬛ 대분류 (주제)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #111827; background: #f8fafc; padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer;">
                    <input type="checkbox" data-author-field="memoTile:unlockedByDefault" data-memo-id="${topic.id}" ${topic.unlockedByDefault ? 'checked' : ''} style="cursor: pointer;" />
                    <span>시작부터 공개</span>
                  </label>
                  <button type="button" class="author-action" data-author-action="add-subclue-to-parent:${topic.id}" style="padding: 4px 8px; font-size: 11.5px; color: #111827; font-weight: 700; background: #ffffff; border: 1px solid #cbd5e1;">+ 🔘 단서 추가</button>
                  <button type="button" class="author-action" data-author-action="add-subitem-to-parent:${topic.id}" style="padding: 4px 8px; font-size: 11.5px; color: #111827; font-weight: 700; background: #ffffff; border: 1px solid #cbd5e1;">+ ⬜ 세부타일 추가</button>
                  <button type="button" class="author-action is-subtle" data-author-action="select-memo-to-edit:${topic.id}" title="기존 단일 편집 폼으로 이동" style="padding: 4px 8px; font-size: 11.5px; color: #111827; font-weight: 700; background: #ffffff; border: 1px solid #cbd5e1;">상세 폼</button>
                  <button type="button" class="author-action is-danger" data-author-action="delete-memo-tile:${topic.id}" title="대분류 및 하위 타일 삭제" style="padding: 4px 8px; font-size: 11.5px;">🗑️ 대분류 삭제</button>
                </div>
              </div>

              <!-- 대분류 내용 및 카테고리 -->
              <div style="display: grid; grid-template-columns: 1fr 180px 80px; gap: 10px; margin-bottom: 12px; align-items: start;">
                <div>
                  <span style="font-size: 11px; color: #111827; font-weight: 700; display: block; margin-bottom: 3px;">대분류 설명/요약</span>
                  <textarea data-author-field="memoTile:summary" data-memo-id="${topic.id}" rows="2" placeholder="이 주제에 대한 요약 설명입니다." style="width: 100%; font-size: 12px; background: #ffffff; color: #111827; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 5px 8px; resize: vertical;">${escapeHtml(topic.summary || topic.description || '')}</textarea>
                </div>
                <div>
                  <span style="font-size: 11px; color: #111827; font-weight: 700; display: block; margin-bottom: 3px;">분류 카테고리</span>
                  <select data-author-field="memoTile:category" data-memo-id="${topic.id}" class="author-select" style="width: 100%; font-size: 11.5px; background: #ffffff; color: #111827; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 5px 6px;">
                    ${categoryOptions.map((cat) => `<option value="${cat.id}" ${topic.category === cat.id ? 'selected' : ''}>${cat.label}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <span style="font-size: 11px; color: #111827; font-weight: 700; display: block; margin-bottom: 3px;">아이콘</span>
                  <input type="text" data-author-field="memoTile:icon" data-memo-id="${topic.id}" value="${escapeHtml(topic.icon || '🔍')}" placeholder="이모지" style="width: 100%; font-size: 14px; text-align: center; background: #ffffff; color: #111827; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 4px 0;" />
                </div>
              </div>

              <!-- 하위 중분류 단서 조건 목록 -->
              ${showClues ? `
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 12px; font-weight: 700; color: #111827;">🔘 중분류 단서 조건 (${subClues.length}개)</span>
                    <button type="button" class="author-action" data-author-action="add-subclue-to-parent:${topic.id}" style="font-size: 11px; padding: 2px 7px; color: #111827; font-weight: 700; background: #ffffff; border: 1px solid #cbd5e1;">+ 추가</button>
                  </div>
                  ${subClues.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                      ${subClues.map((sc, cIdx) => `
                        <div style="display: grid; grid-template-columns: 140px 1fr auto 180px auto; gap: 8px; align-items: center; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                          <input type="text" data-author-field="tileSubClue:label" data-parent-id="${topic.id}" data-index="${cIdx}" value="${escapeHtml(sc.label || '')}" placeholder="단서명" style="font-size: 12px; font-weight: 700; color: #111827; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px;" title="단서 이름 수정" />
                          <input type="text" data-author-field="tileSubClue:desc" data-parent-id="${topic.id}" data-index="${cIdx}" value="${escapeHtml(sc.desc || sc.conditionDesc || '')}" placeholder="단서 설명" style="font-size: 11.5px; color: #111827; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px;" title="단서 설명 수정" />
                          <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #111827; white-space: nowrap; cursor: pointer;">
                            <input type="checkbox" data-author-field="tileSubClue:unlockedByDefault" data-parent-id="${topic.id}" data-index="${cIdx}" ${sc.unlockedByDefault !== false ? 'checked' : ''} style="cursor: pointer;" />
                            <span>기본 공개</span>
                          </label>
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 10.5px; color: #111827; font-weight: 600; white-space: nowrap;">대분류 이동:</span>
                            <select data-author-field="moveSubClueParent" data-author-action="move-subclue-parent" data-parent-id="${topic.id}" data-index="${cIdx}" style="font-size: 11px; background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 4px; max-width: 110px;">
                              ${allTopics.map((t) => `<option value="${t.id}" ${t.id === topic.id ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}
                            </select>
                          </div>
                          <button type="button" class="author-action is-danger" data-author-action="delete-subclue-direct:${topic.id}:${cIdx}" title="이 단서 삭제" style="padding: 2px 7px; font-size: 11px;">✕</button>
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <p style="font-size: 11.5px; color: #64748b; margin: 2px 0;">등록된 단서(중분류)가 없습니다.</p>
                  `}
                </div>
              ` : ''}

              <!-- 하위 소분류 세부 타일 목록 -->
              ${showSubItems ? `
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 12px; font-weight: 700; color: #111827;">⬜ 소분류 세부 타일 (${subItems.length}개)</span>
                    <button type="button" class="author-action" data-author-action="add-subitem-to-parent:${topic.id}" style="font-size: 11px; padding: 2px 7px; color: #111827; font-weight: 700; background: #ffffff; border: 1px solid #cbd5e1;">+ 추가</button>
                  </div>
                  ${subItems.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                      ${subItems.map((sub, sIdx) => `
                        <div style="display: grid; grid-template-columns: 140px 1fr auto 180px auto auto; gap: 8px; align-items: center; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; color: #111827; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 13px;">⬜</span>
                            <input type="text" data-author-field="tileSubItem:label" data-parent-id="${topic.id}" data-index="${sIdx}" value="${escapeHtml(sub.label || '')}" placeholder="세부타일명" style="font-size: 12px; font-weight: 700; color: #111827; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px; width: 100%;" title="세부 타일 이름 수정" />
                          </div>
                          <input type="text" data-author-field="tileSubItem:desc" data-parent-id="${topic.id}" data-index="${sIdx}" value="${escapeHtml(sub.desc || '')}" placeholder="세부 타일 설명" style="font-size: 11.5px; color: #111827; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 6px;" title="세부 타일 설명 수정" />
                          <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #111827; white-space: nowrap; cursor: pointer;">
                            <input type="checkbox" data-author-field="tileSubItem:unlockedByDefault" data-parent-id="${topic.id}" data-index="${sIdx}" ${sub.unlockedByDefault !== false ? 'checked' : ''} style="cursor: pointer;" />
                            <span>기본 공개</span>
                          </label>
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 10.5px; color: #111827; font-weight: 600; white-space: nowrap;">대분류 이동:</span>
                            <select data-author-field="moveSubItemParent" data-author-action="move-subitem-parent" data-parent-id="${topic.id}" data-index="${sIdx}" style="font-size: 11px; background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 4px; max-width: 110px;">
                              ${allTopics.map((t) => `<option value="${t.id}" ${t.id === topic.id ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}
                            </select>
                          </div>
                          <button type="button" class="author-action" data-author-action="promote-subitem:${topic.id}:${sIdx}" title="이 세부 타일을 독립된 대분류 주제 타일로 승격합니다" style="padding: 2px 7px; font-size: 11px; color: #111827; font-weight: 700; border: 1px solid #94a3b8; background: #f1f5f9; white-space: nowrap;">
                            ⬛ 대분류로 승격
                          </button>
                          <button type="button" class="author-action is-danger" data-author-action="delete-subitem-direct:${topic.id}:${sIdx}" title="이 세부타일 삭제" style="padding: 2px 7px; font-size: 11px;">✕</button>
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <p style="font-size: 11.5px; color: #64748b; margin: 2px 0;">등록된 세부 타일(소분류)이 없습니다.</p>
                  `}
                </div>
              ` : ''}

            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  renderSingleMemoForm(allTopics, categoryOptions) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId) || allTopics[0] || CODEX_DATA[0];
    if (!entry) return '<p>편집할 메모 타일이 없습니다.</p>';
    this.selectedMemoId = entry.id;

    return `
      <div class="author-grid" style="margin-bottom: 20px;">
        ${selectField('편집할 메모 대분류 선택', 'memoSelect', entry.id, allTopics.map((item) => ({
          value: item.id, label: `${item.title} · ${this.memoCategoryLabel(item.category)}`
        })))}
        ${selectField('타일 위계 / 역할', 'memo:role', entry.role || 'keyword', [
          { value: 'keyword', label: '⬛ 주제 (대분류 - 검정색 육각 타일)' },
          { value: 'clue', label: '🔘 단서 (중분류 - 진회색 육각 타일)' }
        ])}
        ${selectField('분류', 'memo:category', entry.category, categoryOptions.map((item) => ({ value: item.id, label: item.label })))}
        ${field('제목', 'memo:title', entry.title || '')}
        ${field('아이콘', 'memo:icon', entry.icon || '🔍')}
        ${field('요약', 'memo:summary', entry.summary || '', 'textarea', { attributes: 'rows="2"' })}
        ${field('상세 설명', 'memo:description', entry.description || '', 'textarea', { attributes: 'rows="4"' })}
        ${field('키워드 (한 줄에 하나씩)', 'memo:keywords', (entry.keywords || []).join('\n'), 'textarea', { attributes: 'rows="2"' })}
        ${field('주제 타일 정답 (정답으로 판정할 텍스트, 쉼표 구분)', 'memo:answers', Array.isArray(entry.answers) ? entry.answers.join(', ') : (entry.answers || ''), 'text', { placeholder: '예: 달빛 이끼, 달빛이끼' })}
        ${field('빠른 세부 타일 입력 (한 줄에 하나씩: 이름 | 설명)', 'memo:subItems', (entry.subItems || []).map((item) => item.desc && item.desc !== item.label ? `${item.label} | ${item.desc}` : (item.label || item.title || '')).join('\n'), 'textarea', { attributes: 'rows="3" placeholder="예: 상태창 | 눈앞에 반투명하게 떠오르는 신비한 푸른 창\n손전등 | 어둠을 밝혀주는 휴대용 조명"' })}
        ${field('기본 공개', 'memo:unlockedByDefault', Boolean(entry.unlockedByDefault), 'checkbox')}
      </div>

      <div class="author-section-heading">
        <div>
          <h4>🔘 단서 목록 (중분류 진회색 타일, ${(entry.subClues || []).length}개)</h4>
          <p>이 주제에서 뻗어나오는 단서입니다. 세부 타일이 인접할 때 부합(파랑)/모순(빨강)을 판정합니다.</p>
        </div>
        ${actionButton('+ 단서 추가', 'add-subclue')}
      </div>
      <div class="author-card-list">
        ${this.renderSubClues(entry)}
      </div>

      <div class="author-section-heading">
        <div>
          <h4>⬜ 세부 타일 목록 (${(entry.subItems || []).length}개)</h4>
          <p>각 세부 타일의 이름과 클릭 시 표시될 상세 설명을 편집합니다. 보드 위에서 떼어내어 다른 타일에 붙일 수 있습니다.</p>
        </div>
        ${actionButton('+ 세부 타일 추가', 'add-subitem')}
      </div>
      <div class="author-card-list">
        ${this.renderSubItems(entry)}
      </div>
    `;
  }

  renderRecipesView() {
    return `
      <div class="author-section-heading">
        <div>
          <h4>🧪 단서 조합 레시피</h4>
          <p>서로 인접하게 놓았을 때 생성될 가설을 설정합니다.</p>
        </div>
        ${actionButton('+ 레시피 추가', 'add-recipe')}
      </div>
      <div class="author-card-list">${this.renderRecipes()}</div>
    `;
  }

  renderSubClues(entry) {
    const clues = entry.subClues || [];
    if (!clues.length) {
      return '<p class="author-empty">등록된 단서(중분류)가 없습니다. [+ 단서 추가]를 눌러 진회색 단서 타일을 추가해보세요.</p>';
    }
    return clues.map((sc, index) => {
      const validStr = Array.isArray(sc.validTargets) ? sc.validTargets.join(', ') : (sc.validTargets || '');
      const invalidStr = Array.isArray(sc.invalidTargets) ? sc.invalidTargets.join(', ') : (sc.invalidTargets || '');
      return `
        <article class="author-card author-subclue-card" style="border-left: 3px solid #D4AF37;">
          <div class="author-card-heading">
            <strong>🔘 단서 ${index + 1} (${escapeHtml(sc.label || '이름 없음')})</strong>
            ${actionButton('삭제', `delete-subclue:${index}`, 'is-danger')}
          </div>
          <div class="author-grid">
            ${field('단서 이름 (진회색 육각 표기)', 'subClue:label', sc.label || '', 'text', { attributes: `data-subclue-index="${index}" placeholder="예: 독초 X, 식용 가능"` })}
            ${field('분류 태그', 'subClue:sub', sc.sub || '단서', 'text', { attributes: `data-subclue-index="${index}" placeholder="단서"` })}
            <div style="grid-column: 1 / -1;">
              ${field('단서 설명 (클릭 시 수사 수첩에 표시)', 'subClue:desc', sc.desc || sc.conditionDesc || '', 'textarea', { attributes: `data-subclue-index="${index}" rows="2" placeholder="플레이어가 이 단서 타일을 클릭했을 때 표시될 안내 문구"` })}
            </div>
            ${field('부합 세부 타일 (파란색 판정, 쉼표 구분)', 'subClue:validTargets', validStr, 'text', { attributes: `data-subclue-index="${index}" placeholder="예: 달빛 이끼, 은방울풀"` })}
            ${field('모순 세부 타일 (빨간색 판정, 쉼표 구분)', 'subClue:invalidTargets', invalidStr, 'text', { attributes: `data-subclue-index="${index}" placeholder="예: 붉은 독버섯"` })}
            ${field('시작부터 공개 (기본 해금 - 체크 해제 시 본문에서 단서 발견 창이 떠야 공개됨)', 'subClue:unlockedByDefault', sc.unlockedByDefault !== false, 'checkbox', { attributes: `data-subclue-index="${index}"` })}
          </div>
        </article>
      `;
    }).join('');
  }

  renderSubItems(entry) {
    const items = entry.subItems || [];
    if (!items.length) {
      return '<p class="author-empty">등록된 세부 타일이 없습니다. [+ 세부 타일 추가]를 눌러 세부 타일을 추가해보세요.</p>';
    }

    // Collect all subClues across CODEX_DATA for targetClueId options
    const allSubClues = [];
    CODEX_DATA.forEach((e) => {
      (e.subClues || []).forEach((sc) => {
        allSubClues.push({
          id: sc.id,
          label: sc.label || sc.id,
          parentTitle: e.title
        });
      });
    });

    // Collect all discovery sources
    const allSources = [
      { value: '', label: '선택 안 함 (자유 탐색/수동 태그)' }
    ];
    Object.entries(STORY_NODES).forEach(([nId, node]) => {
      allSources.push({
        value: `story:${nId}`,
        label: `📖 본문: ${node.title || nId}`
      });
    });
    Object.entries(INVESTIGATION_SCENES).forEach(([sId, scene]) => {
      allSources.push({
        value: `scene:${sId}`,
        label: `🔍 조사: ${scene.title || sId}`
      });
      (scene.hotspots || []).forEach((hs, hsIdx) => {
        if (hs.type === 'book' || (hs.pages && hs.pages.length > 0)) {
          allSources.push({
            value: `book:${sId}:${hsIdx}`,
            label: `📖 책(${scene.title || sId}): ${hs.title || `지점 ${hsIdx + 1}`}`
          });
        }
      });
    });

    return items.map((sub, index) => {
      const records = sub.records || [];
      const recordsHtml = records.length ? records.map((rec, rIdx) => `
        <div class="author-record-knob-card" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); color: #111827;">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 800; color: #1d4ed8; background: #dbeafe; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
              📝 세부 설명 #${rIdx + 1}
            </span>
            <input type="text"
                   class="author-input"
                   data-author-field="subItemRecord:id"
                   data-parent-id="${entry.id}"
                   data-subitem-index="${index}"
                   data-record-index="${rIdx}"
                   value="${escapeHtml(rec.id || '')}"
                   placeholder="조건/기록 ID (예: moss_taste_test)"
                   style="width: 170px; font-family: monospace; font-size: 11.5px; background: #ffffff; color: #111827; border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 4px 6px;" />
            <input type="text"
                   class="author-input"
                   data-author-field="subItemRecord:text"
                   data-parent-id="${entry.id}"
                   data-subitem-index="${index}"
                   data-record-index="${rIdx}"
                   value="${escapeHtml(rec.text || '')}"
                   placeholder="발견 시 수첩/세부타일에 덧붙여질 기록 내용 (예: 맛을 보니 달콤하고 독성이 전혀 없다)"
                   style="flex: 1; font-size: 12px; background: #ffffff; color: #111827; border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 4px 8px;" />
            ${actionButton('✕ 삭제', `delete-subitem-record:${index}:${rIdx}:${entry.id}`, 'is-danger is-small')}
          </div>
          <!-- 노브 설정 바 -->
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px;">
            <!-- 노브 1: 발견 장소 -->
            <label style="display: inline-flex; align-items: center; gap: 4px; margin: 0; font-size: 11.5px; font-weight: 700; color: #111827;">
              <span>📍 발견 장소(노브):</span>
              <select data-author-field="subItemRecord:source"
                      data-parent-id="${entry.id}"
                      data-subitem-index="${index}"
                      data-record-index="${rIdx}"
                      style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 11px; max-width: 180px;">
                ${allSources.map(s => `<option value="${escapeHtml(s.value)}" ${rec.source === s.value ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
              </select>
            </label>
            <!-- 노브 2: 판정할 단서 조건 -->
            <label style="display: inline-flex; align-items: center; gap: 4px; margin: 0; font-size: 11.5px; font-weight: 700; color: #111827;">
              <span>🎯 판정할 단서 조건:</span>
              <select data-author-field="subItemRecord:targetClueId"
                      data-parent-id="${entry.id}"
                      data-subitem-index="${index}"
                      data-record-index="${rIdx}"
                      style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 11px; max-width: 190px;">
                <option value="">단서 판정 안 함 (단순 정보 기록)</option>
                ${allSubClues.map(c => `<option value="${escapeHtml(c.id)}" ${rec.targetClueId === c.id ? 'selected' : ''}>${escapeHtml(c.parentTitle)} &gt; ${escapeHtml(c.label)}</option>`).join('')}
              </select>
            </label>
            <!-- 노브 3: 부합 여부 -->
            <label style="display: inline-flex; align-items: center; gap: 4px; margin: 0; font-size: 11.5px; font-weight: 700; color: #111827;">
              <span>⚖️ 부합 판정:</span>
              <select data-author-field="subItemRecord:determination"
                      data-parent-id="${entry.id}"
                      data-subitem-index="${index}"
                      data-record-index="${rIdx}"
                      style="background: #ffffff; color: #111827; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-size: 11px;">
                <option value="valid" ${rec.determination !== 'invalid' && rec.determination !== 'none' ? 'selected' : ''}>🔵 참 (조건 부합)</option>
                <option value="invalid" ${rec.determination === 'invalid' ? 'selected' : ''}>🔴 거짓 (조건 모순)</option>
                <option value="none" ${rec.determination === 'none' ? 'selected' : ''}>⚪ 단순 참고 (판정 영향 없음)</option>
              </select>
            </label>
            <!-- 노브 4: 기본 해금 체크박스 -->
            <label style="display: inline-flex; align-items: center; gap: 4px; margin: 0; font-size: 11.5px; font-weight: 700; color: #111827; cursor: pointer;">
              <input type="checkbox"
                     data-author-field="subItemRecord:unlockedByDefault"
                     data-parent-id="${entry.id}"
                     data-subitem-index="${index}"
                     data-record-index="${rIdx}"
                     ${rec.unlockedByDefault ? 'checked' : ''} />
              <span>시작 시 이미 알고 있음(기본 해금)</span>
            </label>
          </div>
        </div>
      `).join('') : '<p style="font-size: 11.5px; color: var(--text-muted); margin: 4px 0 0 0;">등록된 추가 기록(세부 설명)이 없습니다. [+ 새 기록 칸 추가]를 눌러 조건과 노브를 설정해보세요.</p>';

      return `
        <article class="author-card author-subitem-card">
          <div class="author-card-heading">
            <strong>세부 타일 ${index + 1} (${escapeHtml(sub.label || '이름 없음')})</strong>
            ${actionButton('삭제', `delete-subitem:${index}`, 'is-danger')}
          </div>
          <div class="author-grid">
            ${field('타일 이름 (육각형 표기)', `subItem:label`, sub.label || '', 'text', { attributes: `data-subitem-index="${index}" placeholder="예: 상태창"` })}
            ${field('분류 태그', `subItem:sub`, sub.sub || '키워드', 'text', { attributes: `data-subitem-index="${index}" placeholder="키워드"` })}
            ${field('시작부터 공개 (기본 해금 - 체크 해제 시 본문/조사에서 해금해야 보임)', `subItem:unlockedByDefault`, sub.unlockedByDefault !== false, 'checkbox', { attributes: `data-subitem-index="${index}"` })}
            <div style="grid-column: 1 / -1;">
              ${field('기본 설명 (타일 획득 시 바로 표시)', `subItem:desc`, sub.desc || '', 'textarea', { attributes: `data-subitem-index="${index}" rows="2" placeholder="플레이어가 이 타일을 처음 획득했을 때 표시될 기본 설명입니다."` })}
            </div>
            <div style="grid-column: 1 / -1; margin-top: 6px; padding: 10px; background: rgba(0,0,0,0.18); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.15);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 12.5px; color: #60A5FA;">📝 새 정보 발견 시 덧붙여질 기록 (${records.length}개)</strong>
                ${actionButton('+ 새 기록 칸 추가', `add-subitem-record:${index}:${entry.id}`, 'is-small')}
              </div>
              <div class="author-subitem-records-list">
                ${recordsHtml}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  renderRecipes() {
    const entries = Object.values(CLUE_RECIPES).map((recipe) => ({ recipe, key: Object.keys(CLUE_RECIPES).find((key) => CLUE_RECIPES[key] === recipe) }));
    if (!entries.length) return '<p class="author-empty">등록된 조합 레시피가 없습니다.</p>';
    const memoOptions = CODEX_DATA.map((entry) => ({ value: entry.id, label: entry.title }));
    return entries.map(({ recipe, key }) => {
      const ingredients = key.split('+');
      return `
        <article class="author-card author-recipe-card">
          <div class="author-card-heading"><strong>조합 레시피</strong>${actionButton('삭제', `delete-recipe:${encodeURIComponent(key)}`, 'is-danger')}</div>
          <div class="author-grid">
            ${selectField('첫 번째 메모', 'recipe:first', ingredients[0] || '', memoOptions, `data-recipe-key="${escapeHtml(key)}"`)}
            ${selectField('두 번째 메모', 'recipe:second', ingredients[1] || '', memoOptions, `data-recipe-key="${escapeHtml(key)}"`)}
            ${field('생성할 가설 제목', 'recipe:label', recipe.label || '', 'text', { attributes: `data-recipe-key="${escapeHtml(key)}"` })}
            ${field('설명', 'recipe:description', recipe.desc || '', 'textarea', { attributes: `data-recipe-key="${escapeHtml(key)}" rows="2"` })}
          </div>
        </article>`;
    }).join('');
  }

  renderInventory() {
    this.syncAllItems();
    if (!INVENTORY_ITEMS.length) {
      return `
        <div class="author-section-heading">
          <div><h3>소지품</h3><p>아이템 정보를 등록하면 본문 이야기 및 지도 조사 지점의 보상으로 연결할 수 있습니다.</p></div>
          <div class="author-button-row">${actionButton('+ 새 소지품 추가', 'add-item', 'is-primary')}</div>
        </div>
        <p class="author-empty">등록된 소지품이 없습니다. [+ 새 소지품 추가]를 눌러 첫 소지품을 만들어보세요.</p>
      `;
    }

    const item = INVENTORY_ITEMS.find((entry) => entry.id === this.selectedItemId) || INVENTORY_ITEMS[0];
    this.selectedItemId = item.id;
    const currentScene = STORY_NODES[this.selectedStoryNodeId];
    const currentSceneTitle = currentScene ? (currentScene.title || currentScene.id) : '현재 장면';

    // Source description & badge
    let sourceBadge = '';
    let sourceActionBtn = '';
    if (item.source === 'story' && item.sourceNodeId) {
      sourceBadge = `<span class="item-card-source-badge is-story" style="font-size:11px; padding:2px 8px; background:rgba(59, 130, 246, 0.15); color:#60a5fa; border:1px solid rgba(59, 130, 246, 0.3); border-radius:4px; font-weight:600;">📖 본문 획득 (${escapeHtml(item.sourceNodeTitle || item.sourceNodeId)})</span>`;
      sourceActionBtn = actionButton(`📖 본문 [${escapeHtml(item.sourceNodeTitle || item.sourceNodeId)}] 장면으로 이동`, `goto-story-node:${item.sourceNodeId}`);
    } else if (item.source === 'scene' && item.sourceSceneId) {
      sourceBadge = `<span class="item-card-source-badge is-scene" style="font-size:11px; padding:2px 8px; background:rgba(16, 185, 129, 0.15); color:#10b981; border:1px solid rgba(16, 185, 129, 0.3); border-radius:4px; font-weight:600;">🔍 현장 조사 (${escapeHtml(item.sourceSceneTitle || item.sourceSceneId)})</span>`;
      sourceActionBtn = actionButton(`🔍 조사 [${escapeHtml(item.sourceSceneTitle || item.sourceSceneId)}] 장소로 이동`, `goto-scene:${item.sourceSceneId}`);
    } else {
      sourceBadge = `<span class="item-card-source-badge is-inventory" style="font-size:11px; padding:2px 8px; background:rgba(212, 175, 55, 0.15); color:#d4af37; border:1px solid rgba(212, 175, 55, 0.3); border-radius:4px; font-weight:600;">📦 소지품 보관함</span>`;
    }

    const categoryLabel = ITEM_CATEGORIES.find((c) => c.id === item.category)?.label || item.category || '기타';

    return `
      <div class="author-section-heading">
        <div>
          <h3>소지품 및 아이템 목록 관리</h3>
          <p>본문 이야기([아이템: ...])와 현장 조사에서 획득하는 모든 소지품을 한눈에 확인하고, 이름·설명·아이콘을 통합 편집할 수 있습니다. (수정 시 본문 및 현장 조사 지점에도 실시간 자동 동기화됩니다.)</p>
        </div>
        <div class="author-button-row">
          ${actionButton('💾 저장', 'save-disk', 'is-primary')}
          ${actionButton('+ 새 소지품 추가', 'add-item')}
        </div>
      </div>

      <!-- Item Roster / List Section -->
      <div class="author-item-roster-container">
        <div class="author-roster-header">
          <div class="author-roster-title-group">
            <h4>🎁 전체 소지품 목록 <span style="font-size:12px; font-weight:600; padding:2px 8px; background:rgba(212, 175, 55, 0.15); color:var(--accent-gold); border-radius:999px;">${INVENTORY_ITEMS.length}개</span></h4>
            <span class="author-roster-subtitle">소지품 카드를 클릭하면 아래에서 상세 정보를 즉시 수정할 수 있습니다.</span>
          </div>
          <div class="author-roster-actions">
            <input type="text" class="author-item-search" data-author-field="itemSearch" placeholder="🔍 소지품 이름 / 출처 / 설명 검색..." autocomplete="off">
            ${actionButton('+ 새 소지품 추가', 'add-item', 'is-primary')}
          </div>
        </div>

        <div class="author-item-cards-grid" id="author-item-cards-grid">
          ${INVENTORY_ITEMS.map((it) => {
            const isSelected = it.id === item.id;
            const isImg = it.icon && it.icon.includes('/');
            let cardSourceBadge = '';
            if (it.source === 'story') {
              cardSourceBadge = `<span style="font-size:10px; padding:1px 6px; background:rgba(59, 130, 246, 0.15); color:#60a5fa; border-radius:4px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;">📖 ${escapeHtml(it.sourceNodeTitle || '본문')}</span>`;
            } else if (it.source === 'scene') {
              cardSourceBadge = `<span style="font-size:10px; padding:1px 6px; background:rgba(16, 185, 129, 0.15); color:#10b981; border-radius:4px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;">🔍 ${escapeHtml(it.sourceSceneTitle || '조사')}</span>`;
            } else {
              cardSourceBadge = `<span style="font-size:10px; padding:1px 6px; background:rgba(212, 175, 55, 0.15); color:#d4af37; border-radius:4px; font-weight:600; white-space:nowrap;">📦 보관함</span>`;
            }
            return `
              <div class="author-item-card ${isSelected ? 'is-selected' : ''}"
                   data-author-action="select-item:${escapeHtml(it.id)}"
                   data-item-title="${escapeHtml(it.name || '')}"
                   data-item-desc="${escapeHtml(it.desc || '')}"
                   data-item-source="${escapeHtml(it.source || '')} ${escapeHtml(it.sourceNodeTitle || '')} ${escapeHtml(it.sourceSceneTitle || '')}"
                   role="button"
                   tabindex="0"
                   title="${escapeHtml(it.name)} 선택하여 수정">
                <div class="item-card-icon">
                  ${isImg ? `<img src="${escapeHtml(it.icon)}" alt="${escapeHtml(it.name)}">` : `<span style="font-size:24px;">${escapeHtml(it.icon || '📦')}</span>`}
                </div>
                <div class="item-card-info" style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <strong class="item-card-name">${escapeHtml(it.name)}</strong>
                    ${isSelected ? `<span class="item-card-badge" style="font-size:10px; padding:1px 5px; background:#d4af37; color:#1a1a1a; border-radius:999px; font-weight:700;">편집 중</span>` : ''}
                    ${cardSourceBadge}
                  </div>
                  <p class="item-card-desc">${escapeHtml(it.desc || '설명 없음')}</p>
                </div>
                <div class="item-card-actions" style="display:flex; align-items:center; gap:4px;" onclick="event.stopPropagation();">
                  <button type="button" class="author-action is-subtle" data-author-action="insert-item-into-story:${escapeHtml(it.id)}" title="현재 장면에 [아이템: ${escapeHtml(it.name)}] 태그 삽입" style="font-size:11px; padding:3px 7px;">+ 본문삽입</button>
                  ${INVENTORY_ITEMS.length > 1 ? `<button type="button" class="author-action is-danger" data-author-action="delete-item-id:${escapeHtml(it.id)}" title="이 소지품 삭제" style="font-size:11px; padding:3px 6px;">🗑️</button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Selected Item Detail Editor Section -->
      <div class="author-item-detail-section" style="padding:18px 20px; background:var(--bg-card); border-radius:14px; border:1.5px solid rgba(212, 175, 55, 0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle); padding-bottom:12px; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">✏️</span>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--text-main);">[${escapeHtml(item.name)}] 소지품 상세 편집</h3>
                ${sourceBadge}
              </div>
              <span style="font-size:12px; color:var(--text-muted);">식별자 ID: <code>${escapeHtml(item.id)}</code> · 분류: <b>${escapeHtml(categoryLabel)}</b></span>
            </div>
          </div>
          <div class="author-button-row">
            ${actionButton('💾 저장', 'save-disk', 'is-primary')}
            ${sourceActionBtn}
            ${actionButton('📋 본문 태그 복사', `copy-item-tag:${item.id}`)}
            ${actionButton(`+ "${currentSceneTitle}" 본문에 삽입`, `insert-item-into-story:${item.id}`, 'is-primary')}
            ${INVENTORY_ITEMS.length > 1 ? actionButton('이 소지품 삭제', `delete-item-id:${item.id}`, 'is-danger') : ''}
          </div>
        </div>

        <!-- Real-time Live Item Preview -->
        <div id="author-item-live-preview" style="display:flex; align-items:center; gap:16px; margin-bottom:18px; padding:12px 16px; background:var(--bg-surface); border-radius:10px; border:1px solid var(--border-subtle);">
          <div id="author-item-preview-icon" style="width:52px; height:52px; border-radius:10px; overflow:hidden; border:2px solid var(--accent-gold); background:rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:26px;">
            ${(item.icon && item.icon.includes('/')) ? `<img src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:contain;">` : escapeHtml(item.icon || '📦')}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <strong id="author-item-preview-name" style="font-size:15px; color:var(--text-main);">${escapeHtml(item.name)}</strong>
              <span id="author-item-preview-category" style="font-size:11px; padding:1px 6px; background:rgba(212, 175, 55, 0.15); color:#d4af37; border-radius:4px; font-weight:600;">${escapeHtml(categoryLabel)}</span>
            </div>
            <p id="author-item-preview-desc" style="font-size:12.5px; color:var(--text-muted); margin:3px 0 0 0; line-height:1.4;">${escapeHtml(item.desc || '소지품 설명')}</p>
          </div>
          <div style="font-size:11px; color:#10b981; background:rgba(16, 185, 129, 0.08); padding:8px 12px; border-radius:8px; border:1px solid rgba(16, 185, 129, 0.25); max-width:240px; line-height:1.4;">
            💡 <b>양방향 자동 동기화</b><br>
            이름이나 설명을 수정하면 본문 [아이템: ...] 태그 및 현장 조사의 보상 데이터에도 실시간 반영됩니다.
          </div>
        </div>

        <div class="author-grid">
          ${field('이름', 'item:name', item.name || '')}
          ${field('아이콘 (이모지 또는 이미지 파일 경로)', 'item:icon', item.icon || '📦')}
          ${selectField('분류', 'item:category', item.category || 'artifact', ITEM_CATEGORIES.map((entry) => ({ value: entry.id, label: entry.label })))}
          ${field('상세 설명', 'item:desc', item.desc || '', 'textarea', { attributes: 'rows="4"' })}
        </div>
      </div>`;
  }

  memoCategoryLabel(id) {
    return CODEX_CATEGORIES.find((category) => category.id === id)?.label ||
      MEMO_CATEGORIES.find((category) => category.id === id)?.label || id || '미분류';
  }

  ensureMemoCategory(id) {
    if (!id || CODEX_CATEGORIES.some((category) => category.id === id)) return;
    const label = MEMO_CATEGORIES.find((category) => category.id === id)?.label || id;
    CODEX_CATEGORIES.push({ id, label, icon: '🔍' });
  }

  createScene(location) {
    return {
      id: location.id,
      title: location.name,
      subtitle: location.subtitle || '조사 지점을 눌러 단서를 찾아보세요.',
      layout: 'library',
      exitStoryNode: 'ep1_return_from_investigation',
      hotspots: []
    };
  }

  addStoryNode() {
    const id = `story_${Date.now()}`;
    const episodeId = getLiveEpisodeId() || Object.keys(STORY_EPISODES)[0] || 'ep1';
    const firstTarget = Object.keys(STORY_NODES).find((nodeId) => nodeId !== this.selectedStoryNodeId) || '';
    STORY_NODES[id] = {
      id,
      episodeId,
      title: '새 장면',
      chapter: STORY_EPISODES[episodeId]?.chapter || '새 장',
      locationName: '장소 이름',
      summary: '이 장면의 최근 사건 요약을 입력하세요.',
      paragraphs: ['새 본문을 입력하세요.'],
      choices: firstTarget ? [{ text: '다음 장면으로 이동한다.', nextNode: firstTarget }] : []
    };
    this.selectedStoryNodeId = id;
    this.persist();
    this.render();
    this.saveToDisk();
  }

  deleteStoryNode() {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node || Object.keys(STORY_NODES).length <= 1) {
      this.setStatus('마지막 장면은 삭제할 수 없습니다.', true);
      return;
    }
    if (Object.values(STORY_EPISODES).some((episode) => episode.startNode === node.id)) {
      this.setStatus('회차 시작 장면은 삭제할 수 없습니다.', true);
      return;
    }
    const references = Object.values(STORY_NODES).some((entry) =>
      entry.id !== node.id && (entry.choices || []).some((choice) =>
        choice.nextNode === node.id || choice.locationId === node.id
      )
    ) || MAP_LOCATIONS.some((location) => location.targetStoryNode === node.id) ||
      Object.values(INVESTIGATION_SCENES).some((scene) => scene.exitStoryNode === node.id);
    if (references) {
      this.setStatus('다른 선택지에서 이동 대상으로 사용 중인 장면은 먼저 연결을 바꿔 주세요.', true);
      return;
    }
    delete STORY_NODES[node.id];
    this.selectedStoryNodeId = Object.keys(STORY_NODES)[0];
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addChoice() {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node) return;
    node.choices ||= [];
    node.choices.push({ text: '새 선택지', nextNode: Object.keys(STORY_NODES).find((id) => id !== node.id) || node.id, hideIfChosen: true });
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addImportedChoice() {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node) return;
    const select = this.content?.querySelector('[data-author-field="importedChoiceSelect"]');
    const idx = Number(select?.value || 0);
    const imported = this.cachedOtherChoices?.[idx];
    if (!imported) {
      this.setStatus('가져올 기존 선택지를 찾을 수 없습니다.');
      return;
    }
    node.choices ||= [];
    const newChoice = {
      text: imported.text,
      desc: imported.desc || '',
      hideIfChosen: imported.hideIfChosen !== false
    };
    if (imported.isInvestigationTrigger) {
      newChoice.isInvestigationTrigger = true;
      newChoice.locationId = imported.locationId;
    } else if (imported.isOpenMapTrigger) {
      newChoice.isOpenMapTrigger = true;
      newChoice.nextNode = imported.nextNode || 'action:open_map';
      if (imported.mapLocationId) newChoice.mapLocationId = imported.mapLocationId;
    } else {
      newChoice.nextNode = imported.nextNode || Object.keys(STORY_NODES).find((id) => id !== node.id) || node.id;
    }
    if (imported.effects) {
      newChoice.effects = JSON.parse(JSON.stringify(imported.effects));
    }
    node.choices.push(newChoice);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`다른 장면([${imported.sourceNodeTitle}])의 선택지 [${imported.text}]를 가져왔습니다.`);
  }

  deleteChoice(index) {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node?.choices?.[index]) return;
    node.choices.splice(index, 1);
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addLocation() {
    const availableTiles = this.availableEmptyTiles();
    const slot = availableTiles.find((tile) => tile.key === this.emptyTileKey) || availableTiles[0];
    const id = `loc_custom_${Date.now()}`;
    const location = {
      id,
      name: '새 장소',
      subtitle: '새로운 조사 장소',
      icon: '📍',
      coords: { x: 50, y: 50 },
      unlocked: true,
      hasInvestigation: true,
      description: '장소 설명을 입력하세요.'
    };
    if (slot) {
      slot.locationId = id;
      slot.name = location.name;
      slot.building = 'annex';
    } else {
      const occupied = new Set(MAP_TILES.map((tile) => `${tile.q},${tile.r}`));
      let q = 0;
      let r = 0;
      while (occupied.has(`${q},${r}`)) q += 1;
      MAP_TILES.push({
        key: `custom_tile_${Date.now()}`,
        locationId: id,
        name: location.name,
        q,
        r,
        building: 'annex'
      });
    }
    MAP_LOCATIONS.push(location);
    INVESTIGATION_SCENES[id] = this.createScene(location);
    this.selectedLocationId = id;
    this.selectedHotspotIndex = 0;
    this.emptyTileKey = this.availableEmptyTiles()[0]?.key || '';
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addInvestigationScene() {
    const id = `loc_scene_${Date.now()}`;
    INVESTIGATION_SCENES[id] = {
      id,
      title: '새 조사 장면',
      subtitle: '조사 지점을 눌러 단서를 찾아보세요.',
      layout: 'library',
      exitStoryNode: 'ep1_return_from_investigation',
      hotspots: [
        {
          id: `hotspot_${Date.now()}`,
          title: '첫 번째 조사 지점',
          type: 'inspect',
          coords: { x: 50, y: 50 },
          icon: '🔍',
          inspectText: '조사 결과를 입력하세요.',
          monologue: '(레이든의 독백을 입력하세요.)'
        }
      ]
    };
    this.selectedInvestigationSceneId = id;
    this.selectedHotspotIndex = 0;
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus('새 조사 장면이 추가되었습니다.');
  }

  deleteInvestigationScene() {
    const sceneId = this.selectedInvestigationSceneId;
    if (Object.keys(INVESTIGATION_SCENES).length <= 1) {
      this.setStatus('마지막 남은 조사 장면은 삭제할 수 없습니다.', true);
      return;
    }
    const title = INVESTIGATION_SCENES[sceneId]?.title || sceneId;
    if (confirm(`조사 장면 [${title}]을(를) 정말 삭제하시겠습니까?`)) {
      delete INVESTIGATION_SCENES[sceneId];
      this.selectedInvestigationSceneId = Object.keys(INVESTIGATION_SCENES)[0];
      this.selectedHotspotIndex = 0;
      this.persist();
      this.render();
      this.saveToDisk();
      this.setStatus(`[${title}] 조사 장면을 삭제했습니다.`);
    }
  }

  addHotspot(type = 'inspect', characterId = '') {
    const sceneId = this.getActiveSceneId();
    const scene = INVESTIGATION_SCENES[sceneId];
    if (!scene) return;
    scene.hotspots ||= [];
    const index = scene.hotspots.length + 1;
    const now = Date.now();

    let newHs = {
      id: `hotspot_${now}`,
      title: type === 'character' ? `새 인물 ${index}` : (type === 'book' ? `새 책/일지 ${index}` : (type === 'item' ? `새 소지품 ${index}` : `새 조사 지점 ${index}`)),
      type,
      coords: { x: Math.min(85, 20 + (index * 15) % 65), y: Math.min(80, 30 + (index * 12) % 50) },
      icon: type === 'character' ? '👤' : (type === 'book' ? '📖' : (type === 'item' ? '📦' : '🔍')),
      monologue: type === 'character' ? '(레이든의 생각이나 독백을 입력하세요.)' : (type === 'book' ? '(책장을 넘겨 내용을 확인해보자.)' : '')
    };

    let existingChar = null;
    if (type === 'character') {
      existingChar = characterId ? CODEX_DATA.find((c) => c.category === 'character' && c.id === characterId) : null;
      if (existingChar) {
        newHs.characterId = existingChar.id;
        newHs.characterName = existingChar.title;
        newHs.characterRole = existingChar.role || existingChar.summary || '등장인물';
        newHs.title = existingChar.title;
        newHs.icon = existingChar.icon || '👤';
        newHs.image = existingChar.image || existingChar.avatar || '';
        newHs.memoId = existingChar.id;
        newHs.monologue = `(${existingChar.title}다. 중요한 정보에 대해 물어보자.)`;
      } else {
        newHs.characterName = `새 인물 ${index}`;
        newHs.characterRole = '학생 / 사서 / 연구원';
      }
      const qKey = `q_${now}`;
      const speakerName = newHs.characterName;
      newHs.dialogueTree = {
        start: {
          speaker: speakerName,
          text: existingChar ? `“무슨 용무인가요, 레이든?”` : '“무슨 용무인가요?”',
          options: [
            { text: '어젯밤 일에 대해 묻는다.', nextNode: qKey },
            { text: '대화를 마친다.', nextNode: 'exit' }
          ]
        },
        [qKey]: {
          speaker: speakerName,
          text: '“글쎄요, 저도 잘 모르는 일입니다만…….”',
          options: [
            { text: '다른 질문을 한다.', nextNode: 'start' },
            { text: '대화를 마친다.', nextNode: 'exit' }
          ]
        }
      };
    } else if (type === 'book') {
      newHs.pages = [
        {
          indexTitle: '1장: 개요',
          pageTitle: '제1장. 기록의 시작',
          content: '책의 첫 번째 쪽 내용입니다. 자유롭게 문단을 작성하거나 아래 태그 도구를 눌러 단서, 아이템, 추가기록을 본문에 삽입할 수 있습니다.'
        },
        {
          indexTitle: '2장: 세부 단서',
          pageTitle: '제2장. 숨겨진 단서',
          content: '책의 두 번째 쪽 내용입니다.\n\n[단서: 고대 마법 기록 | 책갈피 사이에 적힌 수수께끼의 룬 문자 기록입니다. | 📜]'
        }
      ];
    } else if (type === 'item') {
      newHs.itemId = INVENTORY_ITEMS[0]?.id || '';
      newHs.inspectText = '단단한 자물쇠로 잠겨 있다.';
      newHs.unlockedText = '소지품을 획득했다!';
    } else {
      newHs.inspectText = '사물이나 단서에 대한 관찰 설명을 입력하세요.';
    }

    scene.hotspots.push(newHs);
    this.selectedHotspotIndex = scene.hotspots.length - 1;
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(existingChar ? `[${existingChar.title}] 인물과의 대화 지점이 추가되었습니다.` : `[${newHs.title}] 지점이 추가되었습니다.`);
  }

  deleteHotspot(index, explicitSceneId = null) {
    const sceneId = this.getActiveSceneId(explicitSceneId);
    const scene = INVESTIGATION_SCENES[sceneId];
    if (!scene?.hotspots?.[index]) return;
    const title = scene.hotspots[index]?.title || `지점 ${index + 1}`;
    scene.hotspots.splice(index, 1);
    this.selectedHotspotIndex = Math.max(0, index - 1);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${title}] 지점을 삭제했습니다.`);
  }

  addDialogueOption(hotspotIndex, explicitSceneId = null) {
    const sceneId = this.getActiveSceneId(explicitSceneId);
    const scene = INVESTIGATION_SCENES[sceneId];
    const hotspot = scene?.hotspots?.[hotspotIndex];
    if (!hotspot) return;
    hotspot.dialogueTree ||= {};
    hotspot.dialogueTree.start ||= {
      speaker: hotspot.characterName || hotspot.title || '인물',
      text: '“무슨 용무인가요?”',
      options: []
    };
    hotspot.dialogueTree.start.options ||= [];

    let exitOpt = hotspot.dialogueTree.start.options.find((o) => o.nextNode === 'exit');
    if (!exitOpt) {
      exitOpt = { text: '대화를 마친다.', nextNode: 'exit' };
    }
    hotspot.dialogueTree.start.options = hotspot.dialogueTree.start.options.filter((o) => o.nextNode !== 'exit');

    const nextNodeKey = `q_${Date.now()}`;
    const questionCount = hotspot.dialogueTree.start.options.length + 1;
    const newOpt = {
      text: `새로운 질문 ${questionCount}`,
      nextNode: nextNodeKey
    };
    hotspot.dialogueTree.start.options.push(newOpt);
    hotspot.dialogueTree.start.options.push(exitOpt);

    hotspot.dialogueTree[nextNodeKey] = {
      speaker: hotspot.characterName || hotspot.title || '인물',
      text: '답변 내용을 입력하세요.',
      options: [
        { text: '다른 질문을 한다.', nextNode: 'start' },
        { text: '대화를 마친다.', nextNode: 'exit' }
      ]
    };

    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${hotspot.characterName || hotspot.title || '인물'}] 새 질문과 답변이 추가되었습니다.`);
  }

  deleteDialogueOption(hotspotIndex, nodeKeyOrIdx, explicitSceneId = null) {
    const sceneId = this.getActiveSceneId(explicitSceneId);
    const scene = INVESTIGATION_SCENES[sceneId];
    const hotspot = scene?.hotspots?.[hotspotIndex];
    if (!hotspot || !hotspot.dialogueTree?.start?.options) return;

    let targetKey = null;
    let idx = -1;

    if (typeof nodeKeyOrIdx === 'string' && isNaN(Number(nodeKeyOrIdx))) {
      idx = hotspot.dialogueTree.start.options.findIndex((o) => o.nextNode === nodeKeyOrIdx);
      targetKey = nodeKeyOrIdx;
    } else {
      const numIdx = Number(nodeKeyOrIdx);
      const opt = hotspot.dialogueTree.start.options[numIdx];
      if (opt) {
        idx = numIdx;
        targetKey = opt.nextNode;
      }
    }

    if (idx !== -1) {
      hotspot.dialogueTree.start.options.splice(idx, 1);
    }
    if (targetKey && targetKey !== 'exit' && targetKey !== 'start') {
      delete hotspot.dialogueTree[targetKey];
    }
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus('질문을 삭제했습니다.');
  }

  addBookPage(hotspotIndex, explicitSceneId = null) {
    const sceneId = this.getActiveSceneId(explicitSceneId);
    const scene = INVESTIGATION_SCENES[sceneId];
    const hotspot = scene?.hotspots?.[hotspotIndex];
    if (!hotspot) return;
    hotspot.pages ||= [];
    const pageNum = hotspot.pages.length + 1;
    hotspot.pages.push({
      indexTitle: `${pageNum}장: 새 장`,
      pageTitle: `제${pageNum}장. 새로운 기록`,
      content: '새로운 페이지 내용을 입력하세요. 상단 태그 버튼을 통해 단서, 아이템, 추가기록을 본문에 삽입할 수 있습니다.'
    });
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${hotspot.title}]에 새 페이지(${pageNum}쪽)가 추가되었습니다.`);
  }

  deleteBookPage(hotspotIndex, pageIndex, explicitSceneId = null) {
    const sceneId = this.getActiveSceneId(explicitSceneId);
    const scene = INVESTIGATION_SCENES[sceneId];
    const hotspot = scene?.hotspots?.[hotspotIndex];
    if (!hotspot?.pages?.[pageIndex]) return;
    if (hotspot.pages.length <= 1) {
      this.setStatus('책에는 최소 1쪽 이상의 페이지가 있어야 합니다.', true);
      return;
    }
    hotspot.pages.splice(pageIndex, 1);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus('페이지를 삭제했습니다.');
  }

  insertBookTag(hotspotIndex, pageIndex, tagType) {
    const sceneId = this.selectedInvestigationSceneId || this.selectedLocationId;
    const scene = INVESTIGATION_SCENES[sceneId];
    const hotspot = scene?.hotspots?.[hotspotIndex];
    const page = hotspot?.pages?.[pageIndex];
    if (!page) return;

    let snippet = '';
    if (tagType === 'subitem') {
      const topicSelect = this.content?.querySelector(`[data-author-book-topic="${hotspotIndex}:${pageIndex}"]`);
      const targetSelect = this.content?.querySelector(`[data-author-book-subitem="${hotspotIndex}:${pageIndex}"]`);
      const topicName = topicSelect?.value || (CODEX_DATA.find((c) => c.category === 'clue')?.title) || '새 단서 주제';
      const topic = CODEX_DATA.find((c) => c.title === topicName);
      const targetVal = targetSelect?.value;
      if (targetVal !== undefined && targetVal !== '__new__' && topic?.subItems?.[Number(targetVal)]) {
        const sub = topic.subItems[Number(targetVal)];
        const subName = sub.label || sub.title || '세부 타일';
        const subDesc = sub.desc || sub.description || '책을 읽고 발견한 중요한 세부 사실입니다.';
        snippet = `\n[세부타일: ${topicName} | ${subName} | ${subDesc}]\n`;
      } else {
        snippet = `\n[세부타일: ${topicName} | 발견된 세부 타일 | 책을 읽고 발견한 중요한 세부 사실입니다.]\n`;
      }
    } else if (tagType === 'clue') {
      snippet = '\n[단서: 고대 마법의 흔적 | 책갈피 사이에 적힌 비밀 룬 문자 해설입니다. | 📜]\n';
    } else if (tagType === 'item') {
      snippet = '\n[아이템: 찢어진 마법서 쪽지 | 마법서에서 떨어져 나온 중요한 공식 쪽지 | 📄]\n';
    } else if (tagType === 'record') {
      const recordSelect = this.content?.querySelector(`[data-author-book-record="${hotspotIndex}:${pageIndex}"]`);
      const idx = recordSelect?.value;
      const allRecords = this.getAllTileRecords();
      if (idx !== undefined && idx !== '' && allRecords[Number(idx)]) {
        const r = allRecords[Number(idx)];
        snippet = `\n[기록: ${r.tileLabel} | ${r.recordId} | ${r.text}]\n`;
      } else {
        snippet = '\n[기록: 달빛 이끼 | moss_taste_test | 직접 씹어보니 혀가 마비되지 않고 상쾌한 단맛이 난다. 독초가 아님을 확인했다.]\n';
      }
    } else if (tagType === 'char') {
      snippet = '\n[인물: 저자 미상 | 이 고대 연구서를 집필한 학자 | 👤]\n';
    } else if (tagType === 'stat') {
      snippet = '\n[스탯: 지식 +1 | 심오한 고대 지식을 터득했습니다.]\n';
    } else if (tagType === 'exp') {
      snippet = '\n[설명창: 고대 결계술의 원리 | 4대 원소 마력을 회전시켜 공간을 격리하는 방어술입니다. | 💡]\n';
    }

    const textarea = this.content?.querySelector(`[data-author-field="bookPageContent:${hotspotIndex}:${pageIndex}"]`);
    if (textarea) {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = textarea.value.substring(0, start) + snippet + textarea.value.substring(end);
      page.content = textarea.value;
      textarea.focus();
    } else {
      page.content = (page.content || '') + snippet;
    }
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${tagType}] 태그가 페이지에 삽입되었습니다.`);
  }

  addMemo() {
    const id = `memo_${Date.now()}`;
    const entry = {
      id,
      category: 'clue',
      title: '새 단서',
      icon: '🔍',
      summary: '단서 요약을 입력하세요.',
      description: '상세 설명을 입력하세요.',
      keywords: [],
      subItems: [],
      unlockedByDefault: true
    };
    CODEX_DATA.push(entry);
    this.selectedMemoId = id;
    this.persist();
    this.render();
    this.saveToDisk();
  }

  deleteMemo() {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry) return;
    const hasRecipe = Object.keys(CLUE_RECIPES).some((key) => key.split('+').includes(entry.id));
    const hasHotspotLink = Object.values(INVESTIGATION_SCENES).some((scene) =>
      (scene.hotspots || []).some((hotspot) =>
        [hotspot.memoId, hotspot.codexId, hotspot.unlockedCodexId].includes(entry.id)
      )
    );
    if (hasRecipe || hasHotspotLink) {
      this.setStatus(
        hasRecipe
          ? '조합 레시피에 포함된 메모입니다. 레시피를 먼저 삭제해 주세요.'
          : '조사 지점에 연결된 메모입니다. 연결을 먼저 해제해 주세요.',
        true
      );
      return;
    }
    CODEX_DATA.splice(CODEX_DATA.indexOf(entry), 1);
    this.selectedMemoId = CODEX_DATA[0]?.id || '';
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addSubItem() {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry) return;
    entry.subItems ||= [];
    const count = entry.subItems.length + 1;
    entry.subItems.push({
      id: `${entry.id}_keyword_${Date.now()}`,
      label: `새 세부 타일 ${count}`,
      sub: '키워드',
      desc: '세부 타일에 대한 상세 설명을 입력하세요.'
    });
    this.persist();
    this.render();
    this.saveToDisk();
  }

  deleteSubItem(index) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry?.subItems?.[index]) return;
    entry.subItems.splice(index, 1);
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addSubItemRecord(subitemIndex, parentId) {
    const pId = parentId || this.selectedMemoId;
    const entry = CODEX_DATA.find((item) => item.id === pId);
    const sub = entry?.subItems?.[subitemIndex];
    if (!sub) return;
    sub.records ||= [];
    const count = sub.records.length + 1;
    sub.records.push({
      id: `${sub.id || 'tile'}_rec_${count}`,
      text: '',
      source: '',
      targetClueId: '',
      determination: 'valid',
      unlockedByDefault: false
    });
    this.persist();
    this.render();
    this.saveToDisk();
  }

  deleteSubItemRecord(subitemIndex, recordIndex, parentId) {
    const pId = parentId || this.selectedMemoId;
    const entry = CODEX_DATA.find((item) => item.id === pId);
    const sub = entry?.subItems?.[subitemIndex];
    if (!sub?.records?.[recordIndex]) return;
    sub.records.splice(recordIndex, 1);
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addSubClue() {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry) return;
    entry.subClues ||= [];
    entry.subClues.push({
      id: `${entry.id}_sc_${Date.now()}`,
      label: '새 단서',
      sub: '단서',
      desc: '조건에 맞는 세부 타일을 드래그하여 인접하게 배치해보세요.',
      validTargets: [],
      invalidTargets: [],
      unlockedByDefault: false
    });
    this.persist();
    this.render();
    this.saveToDisk();
  }

  deleteSubClue(index) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry?.subClues?.[index]) return;
    entry.subClues.splice(index, 1);
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addMemoTopic() {
    const id = `clue_topic_${Date.now()}`;
    const entry = {
      id,
      category: 'clue',
      role: 'keyword',
      title: '새 대분류 주제',
      icon: '🔍',
      summary: '새로운 대분류 주제 요약입니다.',
      description: '상세 설명을 입력하세요.',
      keywords: [],
      subItems: [],
      subClues: [],
      unlockedByDefault: true
    };
    CODEX_DATA.push(entry);
    this.selectedMemoId = id;
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus('새 대분류(주제) 타일이 추가되었습니다.');
  }

  addSubClueToParent(parentId) {
    const parent = CODEX_DATA.find((item) => item.id === parentId);
    if (!parent) return;
    parent.subClues ||= [];
    const count = parent.subClues.length + 1;
    parent.subClues.push({
      id: `${parentId}_sc_${Date.now()}`,
      label: `새 단서 ${count}`,
      sub: '단서',
      desc: '새로운 단서 조건에 대한 설명입니다.',
      validTargets: [],
      invalidTargets: [],
      unlockedByDefault: true
    });
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${parent.title}]에 새 단서(중분류)가 추가되었습니다.`);
  }

  addSubItemToParent(parentId) {
    const parent = CODEX_DATA.find((item) => item.id === parentId);
    if (!parent) return;
    parent.subItems ||= [];
    const count = parent.subItems.length + 1;
    parent.subItems.push({
      id: `${parentId}_sub_${Date.now()}`,
      label: `새 세부 타일 ${count}`,
      sub: '세부 타일',
      desc: '새로운 세부 타일에 대한 설명입니다.',
      records: [
        { id: `rec_${Date.now()}`, title: '발견', text: '기록 내용' }
      ],
      unlockedByDefault: true
    });
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${parent.title}]에 새 세부 타일(소분류)이 추가되었습니다.`);
  }

  deleteMemoTile(topicId) {
    const entry = CODEX_DATA.find((item) => item.id === topicId);
    if (!entry) return;
    if (!confirm(`[${entry.title}] 대분류를 정말로 삭제하시겠습니까?\n포함된 모든 단서와 세부 타일도 함께 삭제됩니다.`)) return;

    CODEX_DATA.splice(CODEX_DATA.indexOf(entry), 1);
    if (this.selectedMemoId === topicId) {
      this.selectedMemoId = CODEX_DATA[0]?.id || '';
    }
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${entry.title}] 대분류 타일이 삭제되었습니다.`);
  }

  deleteSubClueDirect(parentId, index) {
    const parent = CODEX_DATA.find((item) => item.id === parentId);
    const item = parent?.subClues?.[index];
    if (!item) return;
    if (!confirm(`[${item.label || '단서'}] 단서를 삭제하시겠습니까?`)) return;

    parent.subClues.splice(index, 1);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${item.label || '단서'}]가 삭제되었습니다.`);
  }

  deleteSubItemDirect(parentId, index) {
    const parent = CODEX_DATA.find((item) => item.id === parentId);
    const item = parent?.subItems?.[index];
    if (!item) return;
    if (!confirm(`[${item.label || '세부 타일'}] 세부 타일을 삭제하시겠습니까?`)) return;

    parent.subItems.splice(index, 1);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${item.label || '세부 타일'}]이(가) 삭제되었습니다.`);
  }

  moveSubClueParent(sourceParentId, subClueIndex, targetParentId) {
    if (!sourceParentId || !targetParentId || sourceParentId === targetParentId) return;
    const source = CODEX_DATA.find((item) => item.id === sourceParentId);
    const target = CODEX_DATA.find((item) => item.id === targetParentId);
    if (!source?.subClues?.[subClueIndex] || !target) return;

    const [sc] = source.subClues.splice(subClueIndex, 1);
    target.subClues ||= [];
    target.subClues.push(sc);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${sc.label || '단서'}]을(를) [${target.title}] 대분류로 이동했습니다.`);
  }

  moveSubItemParent(sourceParentId, subItemIndex, targetParentId) {
    if (!sourceParentId || !targetParentId || sourceParentId === targetParentId) return;
    const source = CODEX_DATA.find((item) => item.id === sourceParentId);
    const target = CODEX_DATA.find((item) => item.id === targetParentId);
    if (!source?.subItems?.[subItemIndex] || !target) return;

    const [sub] = source.subItems.splice(subItemIndex, 1);
    target.subItems ||= [];
    target.subItems.push(sub);
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${sub.label || '세부 타일'}]을(를) [${target.title}] 대분류로 이동했습니다.`);
  }

  promoteSubItem(parentId, subItemIndex) {
    const parent = CODEX_DATA.find((item) => item.id === parentId);
    if (!parent?.subItems?.[subItemIndex]) return;

    const [sub] = parent.subItems.splice(subItemIndex, 1);
    const newTopicId = sub.id?.startsWith('clue_') ? sub.id : `clue_${sub.id || Date.now()}`;
    const newTopic = {
      id: newTopicId,
      category: 'clue',
      role: 'keyword',
      title: sub.label || '새 대분류',
      icon: '🏷️',
      summary: sub.desc || `${sub.label}에 대한 조사 내용입니다.`,
      description: sub.desc || `${sub.label}에 대한 상세한 조사 내용입니다.`,
      keywords: [sub.label],
      subItems: [],
      subClues: [],
      unlockedByDefault: true
    };
    CODEX_DATA.push(newTopic);
    this.selectedMemoId = newTopicId;
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus(`[${sub.label}]이(가) 독립된 대분류 주제 타일로 승격되었습니다.`);
  }

  addRecipe() {
    if (CODEX_DATA.length < 2) {
      this.setStatus('레시피를 만들려면 메모 타일이 두 개 이상 필요합니다.', true);
      return;
    }
    const ingredients = CODEX_DATA.slice(0, 2).map((entry) => entry.id).sort();
    const key = ingredients.join('+');
    if (CLUE_RECIPES[key]) {
      this.setStatus('선택한 두 메모의 조합 레시피가 이미 있습니다.', true);
      return;
    }
    CLUE_RECIPES[key] = {
      id: `hyp_${Date.now()}`,
      label: '새 가설',
      sub: '가설',
      desc: '조합으로 도출되는 가설을 입력하세요.'
    };
    this.persist();
    this.render();
    this.saveToDisk();
  }

  deleteRecipe(key) {
    if (!Object.hasOwn(CLUE_RECIPES, key)) return;
    delete CLUE_RECIPES[key];
    this.persist();
    this.render();
    this.saveToDisk();
  }

  addItem() {
    const id = `item_custom_${Date.now()}`;
    const newItem = {
      id,
      name: '새 소지품',
      icon: '📦',
      category: 'artifact',
      type: 'key',
      desc: '소지품 설명을 입력하세요.',
      source: 'inventory'
    };
    INVENTORY_ITEMS.push(newItem);
    this.selectedItemId = id;
    this.persist();
    this.render();
    this.saveToDisk();
    this.setStatus('새 소지품이 추가되었습니다. 상세 정보를 입력해 주세요.');
  }

  deleteItem(targetId = this.selectedItemId) {
    const item = INVENTORY_ITEMS.find((entry) => entry.id === targetId);
    if (!item) return;
    const targetItemId = item.id;

    let removedHotspotsCount = 0;
    let modifiedHotspotsCount = 0;

    Object.values(INVESTIGATION_SCENES).forEach((scene) => {
      if (!Array.isArray(scene.hotspots)) return;
      const initialCount = scene.hotspots.length;
      scene.hotspots = scene.hotspots.filter((hotspot) => {
        const isItemMatch = [hotspot.itemId, hotspot.grantsItemId, hotspot.item?.id, hotspot.grantsItem?.id].includes(targetItemId);

        if (isItemMatch) {
          // If it is a character with dialogue, keep character and remove item grant
          if (hotspot.type === 'character' || hotspot.dialogueTree) {
            delete hotspot.itemId;
            delete hotspot.grantsItemId;
            delete hotspot.item;
            delete hotspot.grantsItem;
            modifiedHotspotsCount++;
            return true;
          }
          // Otherwise (e.g. item hotspot, chest/item container), delete from investigation scene!
          return false;
        }

        // If required this item, remove requirement so it's not permanently locked
        if (hotspot.requiresItem === targetItemId) {
          delete hotspot.requiresItem;
          modifiedHotspotsCount++;
        }

        return true;
      });
      removedHotspotsCount += (initialCount - scene.hotspots.length);
    });

    // Clean up [아이템: ...] tags in STORY_NODES
    let removedStoryTagsCount = 0;
    Object.values(STORY_NODES).forEach((node) => {
      if (!Array.isArray(node.paragraphs)) return;
      const prevLen = node.paragraphs.length;
      node.paragraphs = node.paragraphs.filter((p) => {
        const match = String(p).trim().match(/^\[(?:아이템|ITEM)\s*:\s*(.+?)\]$/i);
        if (match) {
          const parts = match[1].split('|').map((s) => s.trim());
          const target = parts[0];
          if (target === targetItemId || target === item.name) {
            return false;
          }
        }
        return true;
      });
      removedStoryTagsCount += (prevLen - node.paragraphs.length);
    });

    INVENTORY_ITEMS.splice(INVENTORY_ITEMS.indexOf(item), 1);
    this.selectedItemId = INVENTORY_ITEMS[0]?.id || '';

    // Remove from CODEX_DATA if present as item
    const codexIdx = CODEX_DATA.findIndex((entry) => entry.id === targetItemId && entry.category === 'item');
    if (codexIdx !== -1) {
      CODEX_DATA.splice(codexIdx, 1);
    }

    // Remove from player's active inventory
    state?.removeItem?.(targetItemId);

    const feedbackMsg = `소지품 [${item.name || targetItemId}]을(를) 삭제했습니다.` +
      (removedStoryTagsCount > 0 ? ` (본문 태그 ${removedStoryTagsCount}개 정리)` : '') +
      (removedHotspotsCount > 0 ? ` (조사 지점 ${removedHotspotsCount}개 정리)` : '');

    this.persist();
    this.render();
    this.setStatus(feedbackMsg);
    this.saveToDisk(false, feedbackMsg);
  }

  exportData() {
    try {
      const blob = new Blob([JSON.stringify(dataSnapshot(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'academy-novel-data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.setStatus('JSON 파일을 내보냈습니다. 프로젝트에 반영하려면 파일을 보관하거나 다시 불러오세요.');
    } catch (error) {
      console.error('편집 데이터를 내보내지 못했습니다.', error);
      this.setStatus(`내보내지 못했습니다: ${error.message || '브라우저에서 파일을 만들지 못했습니다.'}`, true);
    }
  }

  async importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      applyData(parsed);
      loadEpisodeToLive(getLiveEpisodeId() || Object.keys(STORY_EPISODES)[0]);
      this.selectedStoryNodeId = Object.keys(STORY_NODES)[0] || '';
      this.selectedLocationId = MAP_LOCATIONS[0]?.id || '';
      this.selectedMemoId = CODEX_DATA[0]?.id || '';
      this.selectedItemId = INVENTORY_ITEMS[0]?.id || '';
      this.persist();
      this.setStatus('JSON 데이터를 불러와 적용했습니다.');
      this.render();
    } catch (error) {
      console.error('JSON 데이터를 불러오지 못했습니다.', error);
      this.setStatus(`불러오지 못했습니다: ${error.message || '파일 형식을 확인해 주세요.'}`, true);
    } finally {
      event.target.value = '';
    }
  }
}
