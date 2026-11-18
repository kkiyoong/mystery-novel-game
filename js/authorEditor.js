import { STORY_EPISODES, STORY_NODES } from './data/storyData.js';
import { INVESTIGATION_SCENES, MAP_LOCATIONS } from './data/mapData.js';
import {
  CODEX_CATEGORIES,
  CODEX_DATA,
  CLUE_RECIPES,
  INVENTORY_ITEMS
} from './data/codexData.js';
import { MAP_TILES } from './isometricMap.js';

const STORAGE_KEY = 'mystery_novel_author_data_v1';
const STAT_FIELDS = [
  { id: 'perception', label: '관찰력' },
  { id: 'magic', label: '마력' },
  { id: 'persuasion', label: '화술' },
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
  return {
    version: 1,
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
  const tile = MAP_TILES.find((item) => item.key === 'nebula-hall');
  if (tile) {
    tile.locationId ||= nebulaHallDefaults.tile.locationId;
    delete tile.visualOnly;
  } else {
    MAP_TILES.push(clone(nebulaHallDefaults.tile));
  }

  if (!MAP_LOCATIONS.some((location) => location.id === 'loc_nebula')) {
    MAP_LOCATIONS.push(clone(nebulaHallDefaults.location));
  }
  if (!INVESTIGATION_SCENES.loc_nebula) {
    INVESTIGATION_SCENES.loc_nebula = clone(nebulaHallDefaults.scene);
  }
}

function applyData(data) {
  validateData(data);
  if (data.investigationScenes) {
    Object.keys(INVESTIGATION_SCENES).forEach((key) => {
      const defaultScene = INVESTIGATION_SCENES[key];
      const savedScene = data.investigationScenes[key];
      if (defaultScene?.bgImage && savedScene && !savedScene.bgImage) {
        savedScene.bgImage = defaultScene.bgImage;
      }
    });
  }
  replaceObject(STORY_EPISODES, data.storyEpisodes);
  replaceObject(STORY_NODES, data.storyNodes);
  replaceArray(MAP_LOCATIONS, data.mapLocations);
  replaceObject(INVESTIGATION_SCENES, data.investigationScenes);
  replaceArray(MAP_TILES, data.mapTiles);
  replaceArray(CODEX_CATEGORIES, data.codexCategories);
  replaceArray(CODEX_DATA, data.codexData);
  if (!CODEX_DATA.some(c => c.id === 'clue_herb_quiz')) {
    CODEX_DATA.unshift({
      id: 'clue_herb_quiz',
      category: 'clue',
      role: 'keyword',
      title: '약초 퀴즈',
      icon: '🌿',
      summary: '안개 숲에서 발견한 식물 후보들 중 해독제에 쓸 수 있는 약초를 가려내야 한다.',
      description: '도서관의 식물학 서적과 현장 조사를 통해 수집한 조건들을 바탕으로, 올바른 약초를 추론해내자.\n진회색 조건 타일에 세부 식물 타일을 붙여 부합 여부를 검증할 수 있다.',
      keywords: ['약초 퀴즈'],
      relatedEpisode: 'ep1',
      unlockedByDefault: true,
      subClues: [
        {
          id: 'sc_herb_not_poison',
          label: '독초 X',
          sub: '단서',
          desc: '독성이 없는 식물이어야 합니다. 섭취하거나 피부에 닿았을 때 마력 발작을 일으키는 독초는 제외됩니다.',
          validTargets: ['달빛 이끼', '은방울풀'],
          invalidTargets: ['붉은 독버섯'],
          unlockedByDefault: true
        },
        {
          id: 'sc_herb_edible',
          label: '식용 가능',
          sub: '단서',
          desc: '가공 없이 달여 마실 수 있는 식용 약초여야 합니다. 쓴맛이 과하거나 섬유질이 억센 식물은 탈락입니다.',
          validTargets: ['달빛 이끼'],
          invalidTargets: ['은방울풀', '붉은 독버섯'],
          unlockedByDefault: true
        }
      ],
      subItems: [
        {
          id: 'item_moonlight_moss',
          label: '달빛 이끼',
          sub: '후보 식물',
          desc: '밤안개 속에서 은은한 푸른빛을 내는 이끼. 쓴맛이 없고 해독 성분이 풍부해 식용으로 바로 섭취 가능하다.'
        },
        {
          id: 'item_red_mushroom',
          label: '붉은 독버섯',
          sub: '후보 식물',
          desc: '선명한 붉은 갓에 흰 점이 박혀 있는 버섯. 소량만 닿아도 신경 마비를 유발하는 맹독초다.'
        },
        {
          id: 'item_silver_bell',
          label: '은방울풀',
          sub: '후보 식물',
          desc: '종 모양의 은백색 꽃. 독성은 없으나 질긴 섬유질과 강한 알칼로이드 성분 때문에 식용으로는 부적합하다.'
        }
      ]
    });
  }
  replaceObject(CLUE_RECIPES, data.clueRecipes);
  replaceArray(INVENTORY_ITEMS, data.inventoryItems);
  ensureNebulaHallData();
}

export function applySavedAuthorData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { error: null };
    applyData(JSON.parse(saved));
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
    const content = `/**\n * Map and Investigation Scene Data\n * Updated via Author Editor\n */\n\nexport const MAP_LOCATIONS = ${JSON.stringify(data.mapLocations, null, 2)};\n\nexport const INVESTIGATION_SCENES = ${JSON.stringify(data.investigationScenes, null, 2)};\n`;
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
  constructor({ onDataChanged, onTestStory, loadError = null }) {
    this.onDataChanged = onDataChanged;
    this.onTestStory = onTestStory;
    this.activeTab = 'story';
    this.selectedStoryNodeId = Object.keys(STORY_NODES)[0] || '';
    this.selectedCharacterId = CODEX_DATA.find((item) => item.category === 'character')?.id || '';
    this.selectedLocationId = MAP_LOCATIONS[0]?.id || '';
    this.selectedMemoId = CODEX_DATA.find((item) => item.category !== 'character')?.id || CODEX_DATA[0]?.id || '';
    this.selectedItemId = INVENTORY_ITEMS[0]?.id || '';
    this.selectedHotspotIndex = 0;
    this.panel = document.getElementById('author-editor');
    this.content = document.getElementById('author-editor-content');
    this.status = document.getElementById('author-editor-status');
    this.fileInput = document.getElementById('author-import-file');
    this.toggleButton = document.getElementById('btn-author-mode');

    this.dirHandle = null;
    this.serverSyncAvailable = false;
    this.serverSaveUrl = null;
    this.syncDebounceTimer = null;

    this.initPortalPasswordModal();
    this.toggleButton?.addEventListener('click', () => this.openPortalPasswordModal());
    document.getElementById('btn-author-editor-close')?.addEventListener('click', () => this.close());
    this.panel?.addEventListener('click', (event) => {
      if (event.target === this.panel) this.close();
      this.handleClick(event);
    });
    this.panel?.addEventListener('input', (event) => this.handleField(event));
    this.panel?.addEventListener('change', (event) => this.handleField(event));
    this.fileInput?.addEventListener('change', (event) => this.importFile(event));

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
      if (val === '9393') {
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

  open() {
    this.panel?.classList.remove('hidden');
    this.toggleButton?.setAttribute('aria-expanded', 'true');
    this.render();
    this.initSync();
  }

  close() {
    this.panel?.classList.add('hidden');
    this.toggleButton?.setAttribute('aria-expanded', 'false');
  }

  setStatus(message, isError = false) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('is-error', isError);
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataSnapshot()));
      this.onDataChanged?.();
      this.setStatus('내용이 수정되었습니다. 상단의 [💾 코드 파일에 저장]을 누르면 실제 파일에 반영됩니다.');
    } catch (error) {
      console.error('편집 데이터를 저장하지 못했습니다.', error);
      this.setStatus(`임시 저장 오류: ${error.message || '브라우저 저장 공간을 확인해 주세요.'}`, true);
    }
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

  async saveToDisk(manual = false) {
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
          this.setStatus(`✅ 실제 코드 파일(storyData.js 등)에 실시간 저장되었습니다! (${timeStr})`);
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
          this.setStatus(`✅ 실제 코드 파일(storyData.js 등)에 실시간 저장되었습니다! (${timeStr})`);
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
      map: () => this.renderMap(),
      memo: () => this.renderMemo(),
      inventory: () => this.renderInventory()
    };
    this.content.innerHTML = renderers[this.activeTab]();
    this.panel?.querySelectorAll('[data-author-tab]').forEach((tab) => {
      const active = tab.dataset.authorTab === this.activeTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
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

    const button = event.target.closest('[data-author-action]');
    if (!button) return;
    const action = button.dataset.authorAction;
    if (action === 'close') this.close();
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
    else if (action === 'add-story-node') this.addStoryNode();
    else if (action === 'delete-story-node') this.deleteStoryNode();
    else if (action === 'test-story-node') {
      const nodeId = this.selectedStoryNodeId;
      this.close();
      this.onTestStory?.(nodeId);
    }
    else if (action === 'add-choice') this.addChoice();
    else if (action.startsWith('delete-choice:')) this.deleteChoice(Number(action.split(':')[1]));
    else if (action === 'add-location') this.addLocation();
    else if (action === 'add-hotspot') this.addHotspot();
    else if (action.startsWith('delete-hotspot:')) this.deleteHotspot(Number(action.split(':')[1]));
    else if (action === 'add-memo') this.addMemo();
    else if (action === 'delete-memo') this.deleteMemo();
    else if (action === 'add-recipe') this.addRecipe();
    else if (action.startsWith('delete-recipe:')) this.deleteRecipe(decodeURIComponent(action.slice('delete-recipe:'.length)));
    else if (action === 'add-subitem') this.addSubItem();
    else if (action.startsWith('delete-subitem:')) this.deleteSubItem(Number(action.split(':')[1]));
    else if (action.startsWith('add-subitem-record:')) this.addSubItemRecord(Number(action.split(':')[1]));
    else if (action.startsWith('delete-subitem-record:')) {
      const parts = action.split(':');
      this.deleteSubItemRecord(Number(parts[1]), Number(parts[2]));
    }
    else if (action === 'add-subclue') this.addSubClue();
    else if (action.startsWith('delete-subclue:')) this.deleteSubClue(Number(action.split(':')[1]));
    else if (action === 'add-character') this.addCharacter();
    else if (action === 'delete-character') this.deleteCharacter();
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
    else if (action === 'add-item') this.addItem();
    else if (action === 'delete-item') this.deleteItem();
    else if (action.startsWith('insert-tag:')) this.insertStoryTag(action.split(':')[1]);
  }

  insertStoryTag(type) {
    const textarea = this.content?.querySelector('[data-author-field="storyParagraphs"]');
    if (!textarea) return;

    let snippet = '';
    if (type === 'item') {
      snippet = '\n[아이템: 낡은 가죽 주머니 | 아카데미 지급용 기본 수납 주머니입니다. | 🎒]\n';
    } else if (type === 'stat') {
      snippet = '\n[스탯: 마력 +1 | 신비한 기운이 몸에 깃듭니다.]\n';
    } else if (type === 'character') {
      const select = this.content?.querySelector('[data-author-action="quick-character-select"]');
      const charId = select?.value;
      const char = (charId && CODEX_DATA.find((c) => c.category === 'character' && c.id === charId)) ||
                   CODEX_DATA.find((c) => c.category === 'character' && c.id === this.selectedCharacterId) ||
                   CODEX_DATA.find((c) => c.category === 'character');
      const name = char ? char.title : '사서 엘레나';
      const desc = char ? (char.summary || char.description) : '중앙 서고의 관리를 담당하는 젊은 사서.';
      const icon = char ? (char.icon || 'images/elena_avatar.png') : 'images/elena_avatar.png';
      snippet = `\n[인물: ${name} | ${desc} | ${icon}]\n`;
    } else if (type === 'topic') {
      snippet = '\n[주제: 약초 퀴즈 | 안개 숲에서 올바른 약초를 가려내야 한다. | 🌿]\n';
    } else if (type === 'clue') {
      snippet = '\n[단서: 독초 X | 약초 퀴즈 | 독성이 없는 식물이어야 한다는 사실을 알아냈다.]\n';
    } else if (type === 'record') {
      snippet = '\n[기록: 달빛 이끼 | moss_taste_test | 직접 씹어보니 혀가 마비되지 않고 상쾌한 단맛이 난다. 독초가 아님을 확인했다.]\n';
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + snippet + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
    textarea.focus();

    this.handleField({ target: textarea, type: 'input' });
    this.updateStoryPreview();
  }

  insertCharacterTag(char) {
    const textarea = this.content?.querySelector('[data-author-field="storyParagraphs"]');
    if (!textarea) return;
    const icon = char.icon || '👤';
    const desc = char.summary || char.description || '인물 소개';
    const snippet = `\n[인물: ${char.title} | ${desc} | ${icon}]\n`;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + snippet + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
    textarea.focus();

    this.handleField({ target: textarea, type: 'input' });
    this.updateStoryPreview();
    this.setStatus(`[${char.title}] 인물이 본문에 추가되었습니다.`);
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
      this.setStatus('인물 태그가 본문에서 제거되었습니다.');
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

  handleField(event) {
    const control = event.target.closest('[data-author-field]');
    if (!control) return;
    const name = control.dataset.authorField;
    const value = control.type === 'checkbox' ? control.checked : control.value;

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

    const shouldRender = this.updateField(control, value);
    this.persist();
    const refreshStoryIndex = event.type === 'change' &&
      ['episodeTitle', 'storyNodeTitle', 'storyChapter'].includes(name);
    if (shouldRender || refreshStoryIndex) this.render();
  }

  updateField(control, value) {
    const name = control.dataset.authorField;
    if (name === 'episodeTitle' || name === 'storyNodeTitle' || name === 'storyChapter' || name === 'storyParagraphs') {
      const node = STORY_NODES[this.selectedStoryNodeId];
      if (!node) return false;
      if (name === 'episodeTitle') {
        const episode = STORY_EPISODES[node.episodeId];
        if (episode) episode.title = value;
      } else if (name === 'storyNodeTitle') node.title = value;
      else if (name === 'storyChapter') node.chapter = value;
      else {
        node.paragraphs = value.split(/\r?\n/).filter((paragraph) => paragraph.length > 0);
        this.updateStoryPreview();
      }
      return false;
    }
    if (name === 'choiceText' || name === 'choiceDesc' || name === 'choiceTarget' || name.startsWith('choiceStat:')) {
      const node = STORY_NODES[this.selectedStoryNodeId];
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
        } else {
          delete choice.isInvestigationTrigger;
          delete choice.locationId;
          choice.nextNode = targetId;
        }
      } else {
        const stat = name.split(':')[1];
        const amount = Number(value);
        choice.effects ||= {};
        choice.effects.rewardStat ||= {};
        if (amount) choice.effects.rewardStat[stat] = amount;
        else delete choice.effects.rewardStat[stat];
        if (Object.keys(choice.effects.rewardStat).length === 0) delete choice.effects.rewardStat;
        if (Object.keys(choice.effects).length === 0) delete choice.effects;
      }
      return name === 'choiceTarget';
    }
    if (name === 'locationName' || name === 'locationSubtitle' || name === 'locationDescription' ||
        name === 'locationIcon' || name === 'locationUnlocked' || name === 'locationHasInvestigation' ||
        name === 'locationStoryTarget') {
      const location = MAP_LOCATIONS.find((entry) => entry.id === this.selectedLocationId);
      if (!location) return false;
      if (name === 'locationName') location.name = value;
      else if (name === 'locationSubtitle') location.subtitle = value;
      else if (name === 'locationDescription') location.description = value;
      else if (name === 'locationIcon') location.icon = value;
      else if (name === 'locationUnlocked') location.unlocked = value;
      else if (name === 'locationHasInvestigation') {
        location.hasInvestigation = value;
        if (value && !INVESTIGATION_SCENES[location.id]) {
          INVESTIGATION_SCENES[location.id] = this.createScene(location);
        }
      } else if (value) location.targetStoryNode = value;
      else delete location.targetStoryNode;
      return name === 'locationHasInvestigation';
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
    if (name.startsWith('scene:')) {
      const scene = INVESTIGATION_SCENES[this.selectedLocationId];
      if (!scene) return false;
      const key = name.split(':')[1];
      scene[key] = value;
      return false;
    }
    if (name.startsWith('hotspot:')) {
      const scene = INVESTIGATION_SCENES[this.selectedLocationId];
      const hotspot = scene?.hotspots?.[Number(control.dataset.hotspotIndex)];
      if (!hotspot) return false;
      const key = name.split(':')[1];
      if (key === 'memoId') {
        hotspot.memoId = value;
      } else if (key === 'itemId' || key === 'grantsItemId') {
        if (value) hotspot[key] = value;
        else delete hotspot[key];
      } else if (key === 'x' || key === 'y') {
        const coordinate = Number(value);
        if (Number.isFinite(coordinate)) hotspot.coords[key] = coordinate;
      } else if (key === 'type') {
        hotspot.type = value;
        if (value === 'character' && !hotspot.dialogueTree) {
          hotspot.dialogueTree = {
            start: {
              speaker: hotspot.characterName || hotspot.title,
              text: '대화 내용을 입력하세요.',
              options: [{ text: '대화를 마친다.', nextNode: 'exit' }]
            }
          };
        }
      } else if (key === 'dialogueText') {
        hotspot.dialogueTree ||= { start: { speaker: hotspot.characterName || hotspot.title, options: [] } };
        hotspot.dialogueTree.start ||= { speaker: hotspot.characterName || hotspot.title, options: [] };
        hotspot.dialogueTree.start.text = value;
      } else if (key === 'characterName') {
        hotspot.characterName = value;
        if (hotspot.dialogueTree?.start) hotspot.dialogueTree.start.speaker = value;
      } else hotspot[key] = value;
      return key === 'type';
    }
    if (name.startsWith('subClue:')) {
      const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
      const subClue = entry?.subClues?.[Number(control.dataset.subclueIndex)];
      if (!subClue) return false;
      const key = name.split(':')[1];
      if (key === 'validTargets' || key === 'invalidTargets') {
        subClue[key] = value.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (key === 'unlockedByDefault') {
        subClue.unlockedByDefault = value;
      } else {
        subClue[key] = value;
      }
      return key === 'label' || key === 'unlockedByDefault';
    }
    if (name.startsWith('subItem:')) {
      const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
      const sub = entry?.subItems?.[Number(control.dataset.subitemIndex)];
      if (!sub) return false;
      const key = name.split(':')[1];
      sub[key] = value;
      return key === 'label';
    }
    if (name.startsWith('subItemRecord:')) {
      const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
      const sub = entry?.subItems?.[Number(control.dataset.subitemIndex)];
      const record = sub?.records?.[Number(control.dataset.recordIndex)];
      if (!record) return false;
      const key = name.split(':')[1];
      record[key] = value;
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
      return key === 'title' || key === 'icon' || key === 'image';
    }
    if (name.startsWith('memo:')) {
      const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
      if (!entry) return false;
      const key = name.split(':')[1];
      if (key === 'keywords') entry.keywords = value.split(/\r?\n/).filter(Boolean);
      else if (key === 'subItems') {
        entry.subItems = value.split(/\r?\n/).filter(Boolean).map((line, index) => {
          const parts = line.split('|').map((s) => s.trim());
          const label = parts[0] || `세부 키워드 ${index + 1}`;
          const desc = parts.slice(1).join('|').trim();
          const existing = entry.subItems?.[index];
          return {
            id: existing?.id || `${entry.id}_keyword_${index + 1}`,
            label,
            sub: existing?.sub || '키워드',
            desc: desc || existing?.desc || label
          };
        });
        return true;
      } else if (key === 'unlockedByDefault') entry.unlockedByDefault = value;
      else {
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
      if (key === 'category') {
        item.category = value;
        item.type = ITEM_CATEGORIES.find((category) => category.id === value)?.type || 'item';
      } else item[key] = value;
      return false;
    }
    return false;
  }

  renderStory() {
    const node = STORY_NODES[this.selectedStoryNodeId] || STORY_NODES[Object.keys(STORY_NODES)[0]];
    if (!node) return '<p>편집할 이야기가 없습니다.</p>';
    this.selectedStoryNodeId = node.id;
    const episode = STORY_EPISODES[node.episodeId] || {};
    const episodeGroups = new Map();
    Object.values(STORY_NODES).forEach((entry) => {
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
          <h4>${escapeHtml(chapter)}</h4>
          ${entries.map((entry) => {
            const choiceCount = entry.choices?.length || 0;
            const isSelected = entry.id === node.id;
            return `
              <button type="button" class="author-story-toc-item${isSelected ? ' is-active' : ''}"
                data-story-node="${escapeHtml(entry.id)}" ${isSelected ? 'aria-current="page"' : ''}>
                <span class="author-story-toc-item-title">${escapeHtml(entry.title || entry.id)}</span>
                <span class="author-story-toc-item-meta">
                  <span class="author-story-toc-badge">${escapeHtml(entry.chapter || '장 구분 없음')}</span>
                  <span>${choiceCount ? `선택지 ${choiceCount}개` : '선택지 없음'}</span>
                </span>
              </button>`;
          }).join('')}
        </section>`).join('');
      return `
        <section class="author-story-toc-episode">
          <h3>${escapeHtml(episodeTitle)}</h3>
          ${chapters}
        </section>`;
    }).join('');
    const nodeOptions = Object.values(STORY_NODES).map((entry) => ({
      value: entry.id,
      label: `${entry.title || entry.id} (${entry.id})`
    }));
    const sceneOptions = Object.values(INVESTIGATION_SCENES).map((scene) => ({
      value: scene.id,
      label: `조사 장면: ${scene.title || scene.id}`
    }));
    const selectedNode = [
      ...nodeOptions.map((option) => ({ ...option, value: `node:${option.value}` })),
      ...sceneOptions.map((option) => ({ ...option, value: `scene:${option.value}` }))
    ];
    const choices = (node.choices || []).map((choice, index) => {
      const target = choice.isInvestigationTrigger
        ? `scene:${choice.locationId || ''}`
        : `node:${choice.nextNode || ''}`;
      const stats = choice.effects?.rewardStat || {};
      return `
        <article class="author-card author-choice-card">
          <div class="author-card-heading"><strong>선택지 ${index + 1}</strong>${actionButton('삭제', `delete-choice:${index}`, 'is-danger')}</div>
          ${field('선택지 문장', 'choiceText', choice.text, 'textarea', { attributes: `data-choice-index="${index}" rows="2"` })}
          ${field('선택지 부가 설명 (호버 툴팁 / 힌트)', 'choiceDesc', choice.desc || '', 'text', { attributes: `data-choice-index="${index}" placeholder="마우스 호버 시 뜰 힌트나 설명 (비워두면 툴팁 없음)"` })}
          ${selectField('이동할 곳', 'choiceTarget', target, selectedNode, `data-choice-index="${index}"`)}
          <div class="author-stat-grid">
            ${STAT_FIELDS.map((stat) => field(`${stat.label} 변화`, `choiceStat:${stat.id}`, stats[stat.id] || 0, 'number', {
              attributes: `data-choice-index="${index}" step="1"`
            })).join('')}
          </div>
        </article>`;
    }).join('');

    const allCharacters = CODEX_DATA.filter((item) => item.category === 'character');
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

    const previewWidgets = [];
    (node.paragraphs || []).forEach((p, idx) => {
      const trimmed = String(p).trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        previewWidgets.push({ line: idx, text: trimmed });
      }
    });

    return `
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

          <div class="author-story-body-editor">
            <div class="author-tag-helper-bar">
              <span class="author-tag-helper-title">🎮 본문 게임창 삽입:</span>
              <button type="button" class="author-tag-btn" data-author-action="insert-tag:item">+ 🎁 아이템 획득</button>
              <button type="button" class="author-tag-btn" data-author-action="insert-tag:stat">+ ⚡ 능력치 변동</button>
              <button type="button" class="author-tag-btn" data-author-action="insert-tag:character">+ 👤 인물 등록</button>
              <button type="button" class="author-tag-btn" data-author-action="insert-tag:topic">+ 🗂️ 주제 등록 (대분류)</button>
              <button type="button" class="author-tag-btn" data-author-action="insert-tag:clue">+ 🔘 단서 발견 (중분류)</button>
              <button type="button" class="author-tag-btn" data-author-action="insert-tag:record">+ 📝 세부 타일 새 기록 추가</button>
            </div>
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

          <div class="author-section-heading">
            <div><h4>선택지</h4><p>대상은 다른 이야기 장면 또는 조사 장면으로 지정할 수 있습니다.</p></div>
            ${actionButton('선택지 추가', 'add-choice')}
          </div>
          <div class="author-card-list">${choices || '<p class="author-empty">등록된 선택지가 없습니다.</p>'}</div>
        </section>
      </div>`;
  }

  availableEmptyTiles() {
    return MAP_TILES.filter((tile) => !tile.locationId && !tile.visualOnly && !tile.alwaysVisible);
  }

  renderMap() {
    const location = MAP_LOCATIONS.find((entry) => entry.id === this.selectedLocationId) || MAP_LOCATIONS[0];
    if (!location) return '<p>편집할 장소가 없습니다.</p>';
    this.selectedLocationId = location.id;
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
    const hotspotTypes = [
      { value: 'character', label: '인물' },
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
            ${(type === 'item' || type === 'interactive') ? selectField(type === 'item' ? '획득할 소지품' : '보상 소지품', `hotspot:${type === 'item' ? 'itemId' : 'grantsItemId'}`, itemId, itemOptions, `data-hotspot-index="${index}"`) : ''}
            ${type === 'character' ? field('인물 이름', `hotspot:characterName`, hotspot.characterName || hotspot.title || '', 'text', { attributes: `data-hotspot-index="${index}"` }) : ''}
            ${type === 'character' ? field('인물 역할', `hotspot:characterRole`, hotspot.characterRole || '', 'text', { attributes: `data-hotspot-index="${index}"` }) : ''}
            ${type === 'character' ? field('인물 그림 URL (선택)', `hotspot:image`, hotspot.image || '', 'url', { attributes: `data-hotspot-index="${index}" placeholder="https://..."` }) : ''}
          </div>
          ${field(type === 'character' ? '첫 대화' : '조사 결과 설명', `hotspot:${type === 'character' ? 'dialogueText' : 'inspectText'}`, type === 'character' ? (hotspot.dialogueTree?.start?.text || '') : (hotspot.inspectText || ''), 'textarea', { attributes: `data-hotspot-index="${index}" rows="3"` })}
        </article>`;
    }).join('');
    const sceneMarkup = location.hasInvestigation ? `
      <div class="author-section-heading"><div><h4>조사 장면</h4><p>조사 모드에서 표시할 배경과 상호작용 지점을 편집합니다.</p></div></div>
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
          ${selectField('나가기 후 이야기 장면', 'scene:exitStoryNode', scene.exitStoryNode || '', [
            { value: '', label: '기본 진행 장면' },
            ...Object.values(STORY_NODES).map((entry) => ({ value: entry.id, label: entry.title || entry.id }))
          ])}
        </div>
        <div class="author-section-heading"><div><h4>인물 · 아이템 · 조사 지점</h4><p>인물이나 아이템을 누르면 연결한 메모 타일이 자동으로 해금됩니다.</p></div>${actionButton('조사 지점 추가', 'add-hotspot')}</div>
        <div class="author-card-list">${hotspotList || '<p class="author-empty">등록된 조사 지점이 없습니다.</p>'}</div>
      ` : '<p class="author-empty">조사 장면을 불러오지 못했습니다.</p>'}
    ` : `
      <div class="author-grid">
        ${selectField('이동 후 열 이야기 장면', 'locationStoryTarget', location.targetStoryNode || '', [
          { value: '', label: '지정하지 않음' },
          ...Object.values(STORY_NODES).map((entry) => ({ value: entry.id, label: entry.title || entry.id }))
        ])}
      </div>`;
    return `
      <div class="author-section-heading">
        <div><h3>지도 타일</h3><p>빈 육각 칸을 골라 장소를 추가하고 조사 지점을 연결하세요.</p></div>
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
        ${field('조사 장면 사용', 'locationHasInvestigation', Boolean(location.hasInvestigation), 'checkbox')}
        ${tile ? field('가로 좌표 (q)', 'tileQ', tile.q, 'number', { attributes: 'step="1"' }) : ''}
        ${tile ? field('세로 좌표 (r)', 'tileR', tile.r, 'number', { attributes: 'step="1"' }) : ''}
        ${tile ? selectField('건물 그림', 'tileBuilding', tile.building || '', buildingOptions) : ''}
        ${tile ? field('건물 이미지 URL (선택)', 'tileImage', tile.image || location.image || '', 'url', { attributes: 'placeholder="https://..."' }) : ''}
      </div>
      ${sceneMarkup}`;
  }

  renderCharacter() {
    const characters = CODEX_DATA.filter((item) => item.category === 'character');
    const char = characters.find((item) => item.id === this.selectedCharacterId) || characters[0];
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

    return `
      <div class="author-section-heading">
        <div>
          <h3>등장인물 관리</h3>
          <p>이야기에 등장하는 주요 인물들의 프로필과 도감 정보를 편집합니다.</p>
        </div>
        <div class="author-button-row">
          ${actionButton('💾 저장', 'save-disk', 'is-primary')}
          ${actionButton('+ 새 인물 추가', 'add-character')}
          ${actionButton('인물 삭제', 'delete-character', 'is-danger')}
        </div>
      </div>
      <div class="author-character-preview" style="display:flex; align-items:center; gap:16px; margin-bottom:16px; padding:14px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border-subtle);">
        ${(char.icon && char.icon.includes('/')) || (char.image && char.image.includes('/')) ? `
          <div style="width:54px; height:54px; border-radius:50%; overflow:hidden; border:2px solid var(--accent-gold); background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <img src="${escapeHtml(char.icon && char.icon.includes('/') ? char.icon : char.image)}" alt="${escapeHtml(char.title)}" style="width:100%; height:100%; object-fit:contain;">
          </div>
          ${char.image && char.image.includes('/') ? `
            <div style="height:64px; width:36px; background:rgba(0,0,0,0.04); border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-subtle); flex-shrink:0;">
              <img src="${escapeHtml(char.image)}" alt="${escapeHtml(char.title)}" style="max-height:100%; max-width:100%; object-fit:contain;">
            </div>
          ` : ''}
        ` : `
          <div style="width:54px; height:54px; border-radius:50%; border:2px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; font-size:28px; background:var(--bg-surface); flex-shrink:0;">
            ${escapeHtml(char.icon || '👤')}
          </div>
        `}
        <div>
          <strong style="font-size:15px; color:var(--text-main); display:block;">${escapeHtml(char.title)}</strong>
          <span style="font-size:12px; color:var(--text-muted);">${escapeHtml(char.summary || '역할/소개 미정')}</span>
        </div>
      </div>
      <div class="author-grid">
        ${selectField('편집할 인물', 'characterSelect', char.id, characters.map((c) => ({
          value: c.id, label: `${(c.icon && c.icon.includes('/') ? '🖼️' : c.icon) || '👤'} ${c.title} (${c.id})`
        })))}
        ${field('인물 식별자 (ID)', 'character:id', char.id || '', 'text', { attributes: 'readonly' })}
        ${field('이름', 'character:title', char.title || '')}
        ${field('아이콘 / 아바타 (이모지 또는 이미지 경로)', 'character:icon', char.icon || '👤', 'text', { attributes: 'placeholder="예: 👤 또는 images/elena_avatar.png"' })}
        ${field('전신 일러스트 이미지 경로', 'character:image', char.image || '', 'text', { attributes: 'placeholder="예: images/elena.png"' })}
        ${field('역할 / 직책 / 요약', 'character:summary', char.summary || '', 'text', { attributes: 'placeholder="예: 아카데미 수석 모범생, 룸메이트"' })}
        ${field('상세 소개 (성격, 배경 설정, 외모)', 'character:description', char.description || '', 'textarea', { attributes: 'rows="4"' })}
        ${field('관련 에피소드 ID', 'character:relatedEpisode', char.relatedEpisode || 'ep1')}
        ${field('처음부터 도감에 공개', 'character:unlockedByDefault', Boolean(char.unlockedByDefault), 'checkbox')}
      </div>
      <div class="author-helper-box" style="margin-top:16px; padding:12px 16px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border-subtle);">
        <strong style="color:var(--text-main); font-size:13px;">💡 본문 편집기 삽입 안내</strong>
        <p style="font-size:12px; color:var(--text-muted); margin:4px 0 8px;">본문에서 이 인물을 등장시키고 도감에 등록하려면 본문 툴바의 <strong>[+ 👤 인물 등록]</strong> 버튼을 누르거나 아래 태그를 본문에 복사해 넣으세요:</p>
        <code style="display:block; padding:8px 12px; background:var(--bg-surface); border-radius:6px; font-size:12px; color:#60a5fa; user-select:all;">[인물: ${escapeHtml(char.title)} | ${escapeHtml(char.summary || '인물 소개')} | ${escapeHtml(char.icon || '👤')}]</code>
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
    this.setStatus('새 인물이 추가되었습니다.');
  }

  deleteCharacter() {
    const characters = CODEX_DATA.filter((item) => item.category === 'character');
    if (characters.length <= 1) {
      alert('최소 하나의 인물은 유지해야 합니다.');
      return;
    }
    const idx = CODEX_DATA.findIndex((item) => item.id === this.selectedCharacterId && item.category === 'character');
    if (idx !== -1) {
      CODEX_DATA.splice(idx, 1);
      const remaining = CODEX_DATA.filter((item) => item.category === 'character');
      this.selectedCharacterId = remaining[0]?.id || '';
      this.render();
      this.persist();
      this.setStatus('인물이 삭제되었습니다.');
    }
  }

  renderMemo() {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId) || CODEX_DATA[0];
    if (!entry) return '<p>편집할 메모 타일이 없습니다.</p>';
    this.selectedMemoId = entry.id;
    const categoryOptions = [...MEMO_CATEGORIES];
    CODEX_CATEGORIES.forEach((category) => {
      if (!categoryOptions.some((option) => option.id === category.id)) {
        categoryOptions.push({ id: category.id, label: category.label });
      }
    });
    return `
      <div class="author-section-heading">
        <div><h3>메모 타일</h3><p>검은 주 타일과 흰색 세부 키워드를 편집합니다.</p></div>
        <div class="author-button-row">
          ${actionButton('💾 저장', 'save-disk', 'is-primary')}
          ${actionButton('새 메모 추가', 'add-memo')}
          ${actionButton('메모 삭제', 'delete-memo', 'is-danger')}
        </div>
      </div>
      <div class="author-grid">
        ${selectField('편집할 메모', 'memoSelect', entry.id, CODEX_DATA.map((item) => ({
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

      <div class="author-section-heading"><div><h4>단서 조합 레시피</h4><p>서로 인접하게 놓았을 때 생성될 가설을 설정합니다.</p></div>${actionButton('레시피 추가', 'add-recipe')}</div>
      <div class="author-card-list">${this.renderRecipes()}</div>`;
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
    return items.map((sub, index) => {
      const records = sub.records || [];
      const recordsHtml = records.length ? records.map((rec, rIdx) => `
        <div style="display: grid; grid-template-columns: 140px 1fr auto; gap: 8px; align-items: center; margin-bottom: 6px;">
          <input type="text" class="author-input" data-author-field="subItemRecord:id" data-subitem-index="${index}" data-record-index="${rIdx}" value="${escapeHtml(rec.id || '')}" placeholder="조건 ID (예: moss_poison)" style="font-family: monospace; font-size: 11.5px;" />
          <input type="text" class="author-input" data-author-field="subItemRecord:text" data-subitem-index="${index}" data-record-index="${rIdx}" value="${escapeHtml(rec.text || '')}" placeholder="해금 시 수사 수첩 아래에 덧붙여질 기록 내용" />
          ${actionButton('✕', `delete-subitem-record:${index}:${rIdx}`, 'is-danger is-small')}
        </div>
      `).join('') : '<p style="font-size: 11.5px; color: var(--text-muted); margin: 4px 0 0 0;">등록된 추가 기록이 없습니다. [+ 새 기록 칸 추가]를 눌러 조건과 내용을 설정해보세요.</p>';

      return `
        <article class="author-card author-subitem-card">
          <div class="author-card-heading">
            <strong>세부 타일 ${index + 1} (${escapeHtml(sub.label || '이름 없음')})</strong>
            ${actionButton('삭제', `delete-subitem:${index}`, 'is-danger')}
          </div>
          <div class="author-grid">
            ${field('타일 이름 (육각형 표기)', `subItem:label`, sub.label || '', 'text', { attributes: `data-subitem-index="${index}" placeholder="예: 상태창"` })}
            ${field('분류 태그', `subItem:sub`, sub.sub || '키워드', 'text', { attributes: `data-subitem-index="${index}" placeholder="키워드"` })}
            <div style="grid-column: 1 / -1;">
              ${field('기본 설명 (타일 획득 시 바로 표시)', `subItem:desc`, sub.desc || '', 'textarea', { attributes: `data-subitem-index="${index}" rows="2" placeholder="플레이어가 이 타일을 처음 획득했을 때 표시될 기본 설명입니다."` })}
            </div>
            <div style="grid-column: 1 / -1; margin-top: 6px; padding: 10px; background: rgba(0,0,0,0.18); border-radius: 6px; border: 1px dashed rgba(255,255,255,0.15);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 12.5px; color: #60A5FA;">📝 새 정보 발견 시 덧붙여질 기록 (${records.length}개)</strong>
                ${actionButton('+ 새 기록 칸 추가', `add-subitem-record:${index}`, 'is-small')}
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
    const item = INVENTORY_ITEMS.find((entry) => entry.id === this.selectedItemId) || INVENTORY_ITEMS[0];
    if (!item) return '<p>편집할 소지품이 없습니다.</p>';
    this.selectedItemId = item.id;
    return `
      <div class="author-section-heading">
        <div><h3>소지품</h3><p>아이템 정보를 등록하면 지도 조사 지점의 보상으로 연결할 수 있습니다.</p></div>
        <div class="author-button-row">${actionButton('소지품 추가', 'add-item')}${actionButton('소지품 삭제', 'delete-item', 'is-danger')}</div>
      </div>
      <div class="author-grid">
        ${selectField('편집할 소지품', 'itemSelect', item.id, INVENTORY_ITEMS.map((entry) => ({
          value: entry.id, label: entry.name
        })))}
        ${field('이름', 'item:name', item.name || '')}
        ${field('아이콘', 'item:icon', item.icon || '📦')}
        ${selectField('분류', 'item:category', item.category || 'artifact', ITEM_CATEGORIES.map((entry) => ({ value: entry.id, label: entry.label })))}
        ${field('상세 설명', 'item:desc', item.desc || '', 'textarea', { attributes: 'rows="5"' })}
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
    const episodeId = Object.keys(STORY_EPISODES)[0] || 'ep1';
    const firstTarget = Object.keys(STORY_NODES).find((nodeId) => nodeId !== this.selectedStoryNodeId) || '';
    STORY_NODES[id] = {
      id,
      episodeId,
      title: '새 장면',
      chapter: STORY_EPISODES[episodeId]?.chapter || '새 장',
      paragraphs: ['새 본문을 입력하세요.'],
      choices: firstTarget ? [{ text: '다음 장면으로 이동한다.', nextNode: firstTarget }] : []
    };
    this.selectedStoryNodeId = id;
    this.persist();
    this.render();
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
  }

  addChoice() {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node) return;
    node.choices ||= [];
    node.choices.push({ text: '새 선택지', nextNode: Object.keys(STORY_NODES).find((id) => id !== node.id) || node.id });
    this.persist();
    this.render();
  }

  deleteChoice(index) {
    const node = STORY_NODES[this.selectedStoryNodeId];
    if (!node?.choices?.[index]) return;
    node.choices.splice(index, 1);
    this.persist();
    this.render();
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
  }

  addHotspot() {
    const scene = INVESTIGATION_SCENES[this.selectedLocationId];
    if (!scene) return;
    scene.hotspots ||= [];
    const index = scene.hotspots.length + 1;
    scene.hotspots.push({
      id: `hotspot_${Date.now()}`,
      title: `새 조사 지점 ${index}`,
      type: 'inspect',
      coords: { x: 50, y: 50 },
      icon: '🔍',
      inspectText: '조사 결과를 입력하세요.'
    });
    this.selectedHotspotIndex = index - 1;
    this.persist();
    this.render();
  }

  deleteHotspot(index) {
    const scene = INVESTIGATION_SCENES[this.selectedLocationId];
    if (!scene?.hotspots?.[index]) return;
    scene.hotspots.splice(index, 1);
    this.persist();
    this.render();
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
  }

  deleteSubItem(index) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry?.subItems?.[index]) return;
    entry.subItems.splice(index, 1);
    this.persist();
    this.render();
  }

  addSubItemRecord(subitemIndex) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    const sub = entry?.subItems?.[subitemIndex];
    if (!sub) return;
    sub.records ||= [];
    const count = sub.records.length + 1;
    sub.records.push({
      id: `${sub.id || 'tile'}_rec_${count}`,
      text: ''
    });
    this.persist();
    this.render();
  }

  deleteSubItemRecord(subitemIndex, recordIndex) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    const sub = entry?.subItems?.[subitemIndex];
    if (!sub?.records?.[recordIndex]) return;
    sub.records.splice(recordIndex, 1);
    this.persist();
    this.render();
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
  }

  deleteSubClue(index) {
    const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
    if (!entry?.subClues?.[index]) return;
    entry.subClues.splice(index, 1);
    this.persist();
    this.render();
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
  }

  deleteRecipe(key) {
    if (!Object.hasOwn(CLUE_RECIPES, key)) return;
    delete CLUE_RECIPES[key];
    this.persist();
    this.render();
  }

  addItem() {
    const id = `item_custom_${Date.now()}`;
    INVENTORY_ITEMS.push({
      id,
      name: '새 소지품',
      icon: '📦',
      category: 'artifact',
      type: 'key',
      desc: '소지품 설명을 입력하세요.'
    });
    this.selectedItemId = id;
    this.persist();
    this.render();
  }

  deleteItem() {
    const item = INVENTORY_ITEMS.find((entry) => entry.id === this.selectedItemId);
    if (!item) return;
    const isUsed = Object.values(INVESTIGATION_SCENES).some((scene) =>
      (scene.hotspots || []).some((hotspot) =>
        [hotspot.itemId, hotspot.grantsItemId, hotspot.item?.id, hotspot.grantsItem?.id].includes(item.id)
      )
    );
    if (isUsed) {
      this.setStatus('조사 지점 보상으로 사용 중인 소지품은 삭제할 수 없습니다.', true);
      return;
    }
    INVENTORY_ITEMS.splice(INVENTORY_ITEMS.indexOf(item), 1);
    this.selectedItemId = INVENTORY_ITEMS[0]?.id || '';
    this.persist();
    this.render();
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
