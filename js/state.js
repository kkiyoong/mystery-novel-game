/**
 * Centralized Game State Manager with localStorage Persistence
 */

const STORAGE_KEY = 'mystery_novel_game_state_v1';

const DEFAULT_STATE = {
  currentNodeId: 'ep1_pocket_intro',
  currentEpisodeId: 'ep1',
  mode: 'home', // 'home' | 'story' | 'investigation'
  lastActiveMode: 'story',
  lastActiveNodeId: 'ep1_pocket_intro',
  lastActiveLocationId: 'loc_main',
  currentLocationId: 'loc_main',
  currentMapTileKey: null,
  hasPocket: false,
  hasOpenedPocket: false,
  player: {
    name: '레이든 브루크',
    title: '아카데미 신입생',
    stats: {
      magic: 4,      // 마법
      knowledge: 4,  // 지식
      perception: 4, // 관찰력
      social: 4,     // 사교력
      stamina: 85    // 체력
    },
    traits: [
      { name: '정확한 계량', desc: '빵집 아들의 필수 스킬' },
    ]
  },
  inventory: [
    {
      id: 'item_inquisitor_badge',
      name: '손전등',
      icon: '🔦',
      quantity: 1,
      type: 'key',
      desc: '빛이 나오는 막대.'
    }
  ],
  unlockedCodex: {},
  unlockedTileRecords: {},
  discoveredLocations: ['loc_main'],
  flags: {},
  collectedHotspots: [],
  readerSettings: {
    fontFamily: 'serif',
    fontSize: 17,
    lineHeight: 1.85,
    letterSpacing: 0,
    theme: 'sepia'
  },
  history: ['ep1_pocket_intro'],
  // 회차 진행 정보 (회차 데이터와 분리되어 모든 회차에서 유지됨)
  completedEpisodes: [],
  schemaVersion: 2
};

class GameState {
  constructor() {
    this.listeners = new Map();
    this.data = this.load();
  }

  // --- Persistence ---

  load() {
    try {
      // v2 키 우선 검사, 없으면 v1 키 검사
      const saved = localStorage.getItem('mystery_novel_game_state_v2') || localStorage.getItem(STORAGE_KEY);
      if (saved) {
        let parsed = null;
        try {
          parsed = JSON.parse(saved);
        } catch (parseErr) {
          console.warn('[GameState] JSON 파싱 실패, 기본값으로 초기화합니다.', parseErr);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem('mystery_novel_game_state_v2');
          return JSON.parse(JSON.stringify(DEFAULT_STATE));
        }

        if (!parsed || typeof parsed !== 'object') {
          return JSON.parse(JSON.stringify(DEFAULT_STATE));
        }

        const hasPocket = Object.prototype.hasOwnProperty.call(parsed, 'hasPocket')
          ? Boolean(parsed.hasPocket)
          : Boolean(parsed.currentNodeId && parsed.currentNodeId !== 'ep1_pocket_intro');
        const lastActiveMode = parsed.lastActiveMode || (parsed.mode === 'investigation' ? 'investigation' : 'story');
        const lastActiveNodeId = parsed.lastActiveNodeId || parsed.currentNodeId || DEFAULT_STATE.lastActiveNodeId;
        const lastActiveLocationId = parsed.lastActiveLocationId || parsed.currentLocationId || DEFAULT_STATE.lastActiveLocationId;
        
        const validEpisodeId = typeof parsed.currentEpisodeId === 'string' && parsed.currentEpisodeId.trim()
          ? parsed.currentEpisodeId.trim()
          : DEFAULT_STATE.currentEpisodeId;

        const loadedState = {
          ...DEFAULT_STATE,
          ...parsed,
          mode: 'home',
          lastActiveMode,
          lastActiveNodeId,
          lastActiveLocationId,
          // 구버전 저장 데이터 마이그레이션: 진행 상황은 유지하고 새 필드만 보강
          schemaVersion: 2,
          currentEpisodeId: validEpisodeId,
          completedEpisodes: Array.isArray(parsed.completedEpisodes)
            ? parsed.completedEpisodes.filter((id) => typeof id === 'string')
            : [],
          hasPocket,
          hasOpenedPocket: Object.prototype.hasOwnProperty.call(parsed, 'hasOpenedPocket')
            ? Boolean(parsed.hasOpenedPocket)
            : hasPocket,
          player: {
            ...DEFAULT_STATE.player,
            ...(parsed.player && typeof parsed.player === 'object' ? parsed.player : {}),
            stats: {
              ...DEFAULT_STATE.player.stats,
              ...((parsed.player && typeof parsed.player === 'object' && parsed.player.stats) || {})
            }
          },
          inventory: Array.isArray(parsed.inventory) ? parsed.inventory : DEFAULT_STATE.inventory,
          readerSettings: {
            ...DEFAULT_STATE.readerSettings,
            ...(parsed.readerSettings && typeof parsed.readerSettings === 'object' ? parsed.readerSettings : {})
          },
          unlockedCodex: (() => {
            const raw = {
              ...DEFAULT_STATE.unlockedCodex,
              ...(parsed.unlockedCodex && typeof parsed.unlockedCodex === 'object' ? parsed.unlockedCodex : {})
            };
            delete raw.ep_01;
            delete raw.char_aren;
            delete raw.item_inquisitor_badge;
            delete raw.magic_resonance;
            return raw;
          })(),
          unlockedTileRecords: {
            ...DEFAULT_STATE.unlockedTileRecords,
            ...(parsed.unlockedTileRecords && typeof parsed.unlockedTileRecords === 'object' ? parsed.unlockedTileRecords : {})
          }
        };

        // 도서관을 실제로 방문한 적이 없는 경우 discoveredLocations에서 loc_library 제거 (오표시 보정)
        const hasActuallyVisitedLibrary = (loadedState.history || []).includes('story_1795179565179') ||
          (loadedState.collectedHotspots || []).some(h => String(h).includes('1795178580065'));
        if (!hasActuallyVisitedLibrary && Array.isArray(loadedState.discoveredLocations)) {
          loadedState.discoveredLocations = loadedState.discoveredLocations.filter(id => id !== 'loc_library');
          if (loadedState.currentLocationId === 'loc_library') {
            loadedState.currentLocationId = 'loc_main';
          }
          if (loadedState.lastActiveLocationId === 'loc_library' && loadedState.lastActiveMode !== 'investigation') {
            loadedState.lastActiveLocationId = 'loc_main';
          }
        }
        return loadedState;
      }
    } catch (e) {
      console.warn('Failed to load saved state, using default state:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.emit('save', this.data);
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.save();
    this.emit('reset', this.data);
    this.emit('change', this.data);
  }

  // --- Event Emitter ---

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, payload) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }

  // --- Story & Navigation ---

  getCurrentNodeId() {
    return this.data.currentNodeId;
  }

  // --- Episodes (회차 진행 상태: 아이템/단서/스탯은 data 하나로 유지되며 회차 변경 시 초기화되지 않음) ---

  getCurrentEpisodeId() {
    return this.data.currentEpisodeId || 'ep1';
  }

  setCurrentEpisodeId(episodeId) {
    if (!episodeId) return;
    this.data.currentEpisodeId = episodeId;
    this.save();
    this.emit('episodeChanged', episodeId);
  }

  getCompletedEpisodes() {
    return this.data.completedEpisodes || [];
  }

  isEpisodeCompleted(episodeId) {
    return this.getCompletedEpisodes().includes(episodeId);
  }

  setEpisodeCompleted(episodeId, completed = true) {
    if (!episodeId) return;
    const list = this.getCompletedEpisodes().filter((id) => id !== episodeId);
    if (completed) list.push(episodeId);
    this.data.completedEpisodes = list;
    this.save();
    this.emit('episodeCompleted', { episodeId, completed });
    this.emit('change', this.data);
  }

  getHistory() {
    return this.data.history || [];
  }

  hasVisitedNode(nodeId) {
    return (this.data.history || []).includes(nodeId);
  }

  isLocationDiscovered(locId) {
    return (this.data.discoveredLocations || []).includes(locId);
  }

  setCurrentNode(nodeId) {
    this.data.currentNodeId = nodeId;
    this.data.lastActiveNodeId = nodeId;
    this.data.lastActiveMode = 'story';
    if (!this.data.history.includes(nodeId)) {
      this.data.history.push(nodeId);
    }
    this.save();
    this.emit('nodeChanged', nodeId);
    this.emit('change', this.data);
  }

  getMode() {
    return this.data.mode;
  }

  setMode(mode, locationId = null) {
    if (mode !== 'home') {
      this.data.lastActiveMode = mode;
      if (locationId) {
        this.data.lastActiveLocationId = locationId;
      }
    }
    this.data.mode = mode;
    if (locationId) {
      this.data.currentLocationId = locationId;
      this.data.currentMapTileKey = null;
    }
    this.save();
    this.emit('modeChanged', { mode, locationId: this.data.currentLocationId });
    this.emit('change', this.data);
  }

  getLastActiveMode() {
    return this.data.lastActiveMode || 'story';
  }

  getLastActiveNodeId() {
    return this.data.lastActiveNodeId || this.data.currentNodeId || DEFAULT_STATE.lastActiveNodeId;
  }

  getLastActiveLocationId() {
    return this.data.lastActiveLocationId || this.data.currentLocationId || DEFAULT_STATE.lastActiveLocationId;
  }

  setLastActive(mode, id) {
    if (mode === 'investigation') {
      this.data.lastActiveMode = 'investigation';
      if (id) this.data.lastActiveLocationId = id;
    } else {
      this.data.lastActiveMode = 'story';
      if (id) this.data.lastActiveNodeId = id;
    }
    this.save();
  }

  getCurrentLocationId() {
    return this.data.currentLocationId;
  }

  setCurrentLocationId(locId) {
    this.data.currentLocationId = locId;
    this.data.currentMapTileKey = null;
    if (!this.data.discoveredLocations.includes(locId)) {
      this.data.discoveredLocations.push(locId);
    }
    this.save();
    this.emit('locationChanged', locId);
    this.emit('change', this.data);
  }

  getCurrentMapTileKey() {
    return this.data.currentMapTileKey;
  }

  setCurrentMapTileKey(tileKey) {
    this.data.currentMapTileKey = tileKey;
    this.save();
    this.emit('change', this.data);
  }

  // --- Inventory Management ---

  getInventoryCapacity() {
    return this.data.inventoryCapacity || 7;
  }

  setInventoryCapacity(capacity) {
    this.data.inventoryCapacity = capacity;
    this.save();
    this.emit('inventoryChanged', this.data.inventory);
    this.emit('change', this.data);
  }

  getInventory() {
    return this.data.inventory;
  }

  hasItem(itemId) {
    return this.data.inventory.some(item => item.id === itemId && item.quantity > 0);
  }

  getItem(itemId) {
    return this.data.inventory.find(item => item.id === itemId) || null;
  }

  addItem(item) {
    const existing = this.data.inventory.find(i => i.id === item.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
      this.data.inventory.push({
        id: item.id,
        name: item.name,
        icon: item.icon || '📦',
        quantity: item.quantity || 1,
        type: item.type || 'item',
        category: item.category || '',
        desc: item.desc || ''
      });
    }
    this.save();
    this.emit('itemAdded', item);
    this.emit('inventoryChanged', this.data.inventory);
    this.emit('change', this.data);
  }

  removeItem(itemId, quantity = 1) {
    const idx = this.data.inventory.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      if (this.data.inventory[idx].quantity > quantity) {
        this.data.inventory[idx].quantity -= quantity;
      } else {
        this.data.inventory.splice(idx, 1);
      }
      this.save();
      this.emit('itemRemoved', itemId);
      this.emit('inventoryChanged', this.data.inventory);
      this.emit('change', this.data);
      return true;
    }
    return false;
  }

  // --- Codex Management ---

  getUnlockedCodex() {
    return this.data.unlockedCodex;
  }

  isCodexUnlocked(codexId) {
    return Boolean(this.data.unlockedCodex[codexId] && this.data.unlockedCodex[codexId].unlocked);
  }

  isClueConditionUnlocked(conditionId) {
    if (!conditionId) return false;
    return Boolean(
      this.data.unlockedCodex[conditionId]?.unlocked ||
      this.data.flags?.[`clue_cond_${conditionId}`] ||
      this.data.flags?.[conditionId]
    );
  }

  isTileRecordUnlocked(recordId) {
    if (!recordId) return false;
    return Boolean(
      this.data.unlockedTileRecords?.[recordId]?.unlocked ||
      this.data.flags?.[`tile_rec_${recordId}`] ||
      this.data.flags?.[recordId]
    );
  }

  unlockTileRecord(recordId, { tileId = null, text = null } = {}) {
    if (!recordId) return false;
    this.data.unlockedTileRecords ||= {};
    this.data.flags ||= {};
    this.data.flags[`tile_rec_${recordId}`] = true;

    if (!this.data.unlockedTileRecords[recordId]) {
      this.data.unlockedTileRecords[recordId] = {
        unlocked: true,
        isNew: true,
        tileId,
        text,
        unlockedAt: Date.now()
      };
      this.save();
      this.emit('tileRecordUnlocked', { recordId, tileId, text });
      this.emit('change', this.data);
      return true;
    }
    return false;
  }

  getUnlockedTileRecords() {
    return this.data.unlockedTileRecords || {};
  }

  unlockClueCondition(conditionId) {
    if (!conditionId) return false;
    this.data.flags ||= {};
    this.data.flags[`clue_cond_${conditionId}`] = true;
    this.data.flags[conditionId] = true;
    this.save();
    this.emit('clueConditionUnlocked', conditionId);
    this.emit('change', this.data);
    return true;
  }

  unlockCodex(codexId, meta = {}) {
    if (!codexId) return false;
    this.data.unlockedCodex ||= {};
    const existing = this.data.unlockedCodex[codexId];
    if (!existing) {
      this.data.unlockedCodex[codexId] = {
        unlocked: true,
        isNew: true,
        unlockedAt: Date.now(),
        ...meta
      };
      this.save();
      this.emit('codexUnlocked', codexId);
      this.emit('change', this.data);
      return true;
    } else if (meta && Object.keys(meta).length > 0) {
      Object.assign(existing, meta);
      this.save();
    }
    return false;
  }

  markCodexRead(codexId) {
    if (!codexId) return;
    let changed = false;
    this.data.unlockedCodex ||= {};

    if (this.data.unlockedCodex[codexId]?.isNew) {
      this.data.unlockedCodex[codexId].isNew = false;
      changed = true;
      this.emit('codexRead', codexId);
    }

    // Aliases
    if (codexId === 'clue_herb_quiz' && this.data.unlockedCodex['clue_퀴즈?']?.isNew) {
      this.data.unlockedCodex['clue_퀴즈?'].isNew = false;
      changed = true;
    } else if (codexId === 'clue_퀴즈?' && this.data.unlockedCodex['clue_herb_quiz']?.isNew) {
      this.data.unlockedCodex['clue_herb_quiz'].isNew = false;
      changed = true;
    }

    // Prefix / Suffix match
    Object.entries(this.data.unlockedCodex).forEach(([key, val]) => {
      if (val && val.isNew) {
        if (key.endsWith(`_${codexId}`) || codexId.endsWith(`_${key}`)) {
          val.isNew = false;
          changed = true;
        }
      }
    });

    if (this.data.unlockedTileRecords) {
      Object.entries(this.data.unlockedTileRecords).forEach(([recId, rec]) => {
        if ((recId === codexId || rec.tileId === codexId) && rec.isNew) {
          rec.isNew = false;
          changed = true;
        }
      });
    }

    if (changed) {
      this.save();
      this.emit('change', this.data);
    }
  }

  markAllCodexRead() {
    let changed = false;
    if (this.data.unlockedCodex) {
      Object.values(this.data.unlockedCodex).forEach((c) => {
        if (c && c.isNew) {
          c.isNew = false;
          changed = true;
        }
      });
    }
    if (this.data.unlockedTileRecords) {
      Object.values(this.data.unlockedTileRecords).forEach((r) => {
        if (r && r.isNew) {
          r.isNew = false;
          changed = true;
        }
      });
    }
    if (changed) {
      this.save();
      this.emit('change', this.data);
    }
  }

  markTileRecordRead(recordId) {
    if (!recordId) return;
    if (this.data.unlockedTileRecords?.[recordId]?.isNew) {
      this.data.unlockedTileRecords[recordId].isNew = false;
      this.save();
      this.emit('tileRecordRead', recordId);
      this.emit('change', this.data);
    }
  }

  markAllTileRecordsReadForTile(tileId) {
    if (!tileId) return;
    let changed = false;
    if (this.data.unlockedTileRecords) {
      Object.entries(this.data.unlockedTileRecords).forEach(([recId, rec]) => {
        if ((rec.tileId === tileId || recId === tileId) && rec.isNew) {
          rec.isNew = false;
          changed = true;
        }
      });
    }
    if (changed) {
      this.save();
      this.emit('change', this.data);
    }
  }

  getUnreadCountByCategory(codexList = []) {
    const counts = { all: 0, clue: 0, character: 0, magic: 0, incident: 0 };
    const unlockedCodex = this.data.unlockedCodex || {};

    Object.entries(unlockedCodex).forEach(([id, item]) => {
      if (item && item.unlocked && item.isNew) {
        counts.all++;
        const entry = codexList.find((c) => c.id === id || c.title === id);
        let cat = entry?.category || item.category;
        if (!cat) {
          if (id.startsWith('char_')) cat = 'character';
          else if (id.startsWith('magic_')) cat = 'magic';
          else cat = 'clue';
        }
        if (counts[cat] !== undefined) {
          counts[cat]++;
        } else {
          counts.clue++;
        }
      }
    });

    const unlockedRecords = this.data.unlockedTileRecords || {};
    Object.values(unlockedRecords).forEach((rec) => {
      if (rec && rec.unlocked && rec.isNew) {
        counts.all++;
        counts.clue++;
      }
    });

    return counts;
  }

  getUnreadCodexCount() {
    const unreadCodex = Object.values(this.data.unlockedCodex || {}).filter(c => c.unlocked && c.isNew).length;
    const unreadRecords = Object.values(this.data.unlockedTileRecords || {}).filter(r => r.unlocked && r.isNew).length;
    return unreadCodex + unreadRecords;
  }

  // --- Flags & Stats ---

  getFlag(flagName) {
    return this.data.flags[flagName];
  }

  setFlag(flagName, value = true) {
    if (this.data.flags[flagName] === value) return;
    this.data.flags[flagName] = value;
    this.save();
    this.emit('flagChanged', { flagName, value });
    this.emit('change', this.data);
  }

  hasPocket() {
    return this.data.hasPocket;
  }

  setHasPocket(value = true) {
    const hasPocket = Boolean(value);
    if (this.data.hasPocket === hasPocket) return;
    this.data.hasPocket = hasPocket;
    this.save();
    this.emit('pocketChanged', hasPocket);
    this.emit('change', this.data);
  }

  hasOpenedPocket() {
    return this.data.hasOpenedPocket;
  }

  markPocketOpened() {
    if (!this.data.hasPocket || this.data.hasOpenedPocket) return;
    this.data.hasOpenedPocket = true;
    this.save();
    this.emit('pocketOpened');
    this.emit('change', this.data);
  }

  getPlayer() {
    const p = this.data.player;
    if (p && p.stats) {
      if (p.stats.magic === undefined) p.stats.magic = 4;
      if (p.stats.knowledge === undefined) p.stats.knowledge = 4;
      if (p.stats.perception === undefined) p.stats.perception = 4;
      if (p.stats.social === undefined) p.stats.social = p.stats.persuasion ?? 4;
      if (p.stats.stamina === undefined) p.stats.stamina = 85;
    }
    return p;
  }

  modifyStat(statName, delta) {
    const aliasMap = {
      '마법': 'magic', '마력': 'magic', 'magic': 'magic',
      '지식': 'knowledge', '지력': 'knowledge', 'knowledge': 'knowledge',
      '관찰력': 'perception', '관찰': 'perception', 'perception': 'perception',
      '사교력': 'social', '사교': 'social', '화술': 'social', 'persuasion': 'social', 'social': 'social',
      '체력': 'stamina', 'stamina': 'stamina'
    };
    const key = aliasMap[statName] || statName;
    const player = this.getPlayer();
    if (player && player.stats) {
      if (player.stats[key] === undefined) {
        player.stats[key] = key === 'stamina' ? 85 : 4;
      }
      const prev = player.stats[key];
      player.stats[key] = Math.min(100, Math.max(0, prev + delta));
      this.save();
      this.emit('statChanged', { statName: key, prev, current: player.stats[key], delta });
      this.emit('change', this.data);
      return player.stats[key];
    }
    return null;
  }

  // --- Hotspot Progress ---

  isHotspotCollected(hotspotId) {
    return this.data.collectedHotspots.includes(hotspotId);
  }

  collectHotspot(hotspotId) {
    if (!this.data.collectedHotspots.includes(hotspotId)) {
      this.data.collectedHotspots.push(hotspotId);
      this.save();
      this.emit('hotspotCollected', hotspotId);
      this.emit('change', this.data);
    }
  }

  // --- Reader Preferences ---

  getReaderSettings() {
    return this.data.readerSettings;
  }

  updateReaderSettings(settings) {
    this.data.readerSettings = {
      ...this.data.readerSettings,
      ...settings
    };
    this.save();
    this.emit('readerSettingsChanged', this.data.readerSettings);
    this.emit('change', this.data);
  }
}

export const state = new GameState();