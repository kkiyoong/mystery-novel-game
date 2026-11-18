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
  replaceObject(STORY_EPISODES, data.storyEpisodes);
  replaceObject(STORY_NODES, data.storyNodes);
  replaceArray(MAP_LOCATIONS, data.mapLocations);
  replaceObject(INVESTIGATION_SCENES, data.investigationScenes);
  replaceArray(MAP_TILES, data.mapTiles);
  replaceArray(CODEX_CATEGORIES, data.codexCategories);
  replaceArray(CODEX_DATA, data.codexData);
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

export class AuthorEditor {
  constructor({ onDataChanged, onTestStory, loadError = null }) {
    this.onDataChanged = onDataChanged;
    this.onTestStory = onTestStory;
    this.activeTab = 'story';
    this.selectedStoryNodeId = Object.keys(STORY_NODES)[0] || '';
    this.selectedLocationId = MAP_LOCATIONS[0]?.id || '';
    this.selectedMemoId = CODEX_DATA[0]?.id || '';
    this.selectedItemId = INVENTORY_ITEMS[0]?.id || '';
    this.selectedHotspotIndex = 0;
    this.panel = document.getElementById('author-editor');
    this.content = document.getElementById('author-editor-content');
    this.status = document.getElementById('author-editor-status');
    this.fileInput = document.getElementById('author-import-file');
    this.toggleButton = document.getElementById('btn-author-mode');

    this.toggleButton?.addEventListener('click', () => this.open());
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
  }

  open() {
    this.panel?.classList.remove('hidden');
    this.toggleButton?.setAttribute('aria-expanded', 'true');
    this.render();
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
      this.setStatus('변경 사항을 이 브라우저에 저장했습니다.');
      this.onDataChanged?.();
    } catch (error) {
      console.error('편집 데이터를 저장하지 못했습니다.', error);
      this.setStatus(`저장하지 못했습니다: ${error.message || '브라우저 저장 공간을 확인해 주세요.'}`, true);
    }
  }

  render() {
    if (!this.content) return;
    const renderers = {
      story: () => this.renderStory(),
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
    else if (action === 'add-item') this.addItem();
    else if (action === 'delete-item') this.deleteItem();
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
      else node.paragraphs = value.split(/\r?\n/).filter((paragraph) => paragraph.length > 0);
      return false;
    }
    if (name === 'choiceText' || name === 'choiceTarget' || name.startsWith('choiceStat:')) {
      const node = STORY_NODES[this.selectedStoryNodeId];
      const choice = node?.choices?.[Number(control.dataset.choiceIndex)];
      if (!choice) return false;
      if (name === 'choiceText') choice.text = value;
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
    if (name.startsWith('memo:')) {
      const entry = CODEX_DATA.find((item) => item.id === this.selectedMemoId);
      if (!entry) return false;
      const key = name.split(':')[1];
      if (key === 'keywords') entry.keywords = value.split(/\r?\n/).filter(Boolean);
      else if (key === 'subItems') {
        entry.subItems = value.split(/\r?\n/).filter(Boolean).map((label, index) => ({
          id: `${entry.id}_keyword_${index + 1}`,
          label,
          sub: '키워드',
          desc: label
        }));
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
          ${selectField('이동할 곳', 'choiceTarget', target, selectedNode, `data-choice-index="${index}"`)}
          <div class="author-stat-grid">
            ${STAT_FIELDS.map((stat) => field(`${stat.label} 변화`, `choiceStat:${stat.id}`, stats[stat.id] || 0, 'number', {
              attributes: `data-choice-index="${index}" step="1"`
            })).join('')}
          </div>
        </article>`;
    }).join('');

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
              ${actionButton('이 장면 바로 테스트', 'test-story-node', 'is-primary')}
              ${actionButton('장면 삭제', 'delete-story-node', 'is-danger')}
            </div>
          </div>
          <div class="author-grid author-story-meta">
            ${field('회차 제목', 'episodeTitle', episode.title || '')}
            ${field('장면 제목', 'storyNodeTitle', node.title || '')}
            ${field('장·절 제목', 'storyChapter', node.chapter || '')}
          </div>
          <div class="author-story-body-editor">
            ${field('본문 문단 (한 줄에 한 문단)', 'storyParagraphs', (node.paragraphs || []).join('\n'), 'textarea', {
              attributes: 'rows="14"'
            })}
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
          ${selectField('배경 스케치', 'scene:layout', scene.layout || 'library', [
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
        <div class="author-button-row">${actionButton('새 메모 추가', 'add-memo')}${actionButton('메모 삭제', 'delete-memo', 'is-danger')}</div>
      </div>
      <div class="author-grid">
        ${selectField('편집할 메모', 'memoSelect', entry.id, CODEX_DATA.map((item) => ({
          value: item.id, label: `${item.title} · ${this.memoCategoryLabel(item.category)}`
        })))}
        ${selectField('분류', 'memo:category', entry.category, categoryOptions.map((item) => ({ value: item.id, label: item.label })))}
        ${field('제목', 'memo:title', entry.title || '')}
        ${field('아이콘', 'memo:icon', entry.icon || '🔍')}
        ${field('요약', 'memo:summary', entry.summary || '', 'textarea', { attributes: 'rows="2"' })}
        ${field('상세 설명', 'memo:description', entry.description || '', 'textarea', { attributes: 'rows="5"' })}
        ${field('키워드 (한 줄에 하나씩)', 'memo:keywords', (entry.keywords || []).join('\n'), 'textarea', { attributes: 'rows="3"' })}
        ${field('흰색 세부 타일 (한 줄에 하나씩)', 'memo:subItems', (entry.subItems || []).map((item) => item.label || item.title || '').join('\n'), 'textarea', { attributes: 'rows="4"' })}
        ${field('기본 공개', 'memo:unlockedByDefault', Boolean(entry.unlockedByDefault), 'checkbox')}
      </div>
      <div class="author-section-heading"><div><h4>단서 조합 레시피</h4><p>서로 인접하게 놓았을 때 생성될 가설을 설정합니다.</p></div>${actionButton('레시피 추가', 'add-recipe')}</div>
      <div class="author-card-list">${this.renderRecipes()}</div>`;
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
