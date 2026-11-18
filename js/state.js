/**
 * Centralized Game State Manager with localStorage Persistence
 */

const STORAGE_KEY = 'mystery_novel_game_state_v1';

const DEFAULT_STATE = {
  currentNodeId: 'ep1_pocket_intro',
  currentEpisodeId: 'ep1',
  mode: 'story', // 'story' | 'investigation'
  currentLocationId: 'loc_library',
  currentMapTileKey: null,
  hasPocket: false,
  hasOpenedPocket: false,
  player: {
    name: '아렌',
    title: '견습 수사관',
    stats: {
      perception: 4, // 관찰력
      magic: 3,      // 마력
      persuasion: 4, // 화술
      stamina: 85    // 체력
    },
    traits: [
      { name: '예리한 직감', desc: '사소한 불일치와 미세한 흔적을 감지하는 관찰 감각' },
      { name: '규율단 수사관', desc: '총장실 직속 공식 조사 및 심문 권한' }
    ]
  },
  inventory: [
    {
      id: 'item_inquisitor_badge',
      name: '수사관 배지',
      icon: '🛡️',
      quantity: 1,
      type: 'key',
      desc: '아카데미 총장실 직속 규율단원임을 증명하는 은제 배지.'
    }
  ],
  unlockedCodex: {
    ep_01: { unlocked: true, isNew: false, unlockedAt: Date.now() },
    char_aren: { unlocked: true, isNew: false, unlockedAt: Date.now() },
    item_inquisitor_badge: { unlocked: true, isNew: false, unlockedAt: Date.now() },
    magic_resonance: { unlocked: true, isNew: false, unlockedAt: Date.now() }
  },
  discoveredLocations: ['loc_library'],
  flags: {},
  collectedHotspots: [],
  readerSettings: {
    fontFamily: 'serif',
    fontSize: 17,
    lineHeight: 1.85,
    letterSpacing: 0,
    theme: 'sepia'
  },
  history: ['ep1_pocket_intro']
};

class GameState {
  constructor() {
    this.listeners = new Map();
    this.data = this.load();
  }

  // --- Persistence ---

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasPocket = Object.prototype.hasOwnProperty.call(parsed, 'hasPocket')
          ? Boolean(parsed.hasPocket)
          : Boolean(parsed.currentNodeId && parsed.currentNodeId !== 'ep1_pocket_intro');
        return {
          ...DEFAULT_STATE,
          ...parsed,
          hasPocket,
          hasOpenedPocket: Object.prototype.hasOwnProperty.call(parsed, 'hasOpenedPocket')
            ? Boolean(parsed.hasOpenedPocket)
            : hasPocket,
          player: {
            ...DEFAULT_STATE.player,
            ...(parsed.player || {}),
            stats: {
              ...DEFAULT_STATE.player.stats,
              ...((parsed.player && parsed.player.stats) || {})
            }
          },
          readerSettings: {
            ...DEFAULT_STATE.readerSettings,
            ...(parsed.readerSettings || {})
          },
          unlockedCodex: {
            ...DEFAULT_STATE.unlockedCodex,
            ...(parsed.unlockedCodex || {})
          }
        };
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

  setCurrentNode(nodeId) {
    this.data.currentNodeId = nodeId;
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
    this.data.mode = mode;
    if (locationId) {
      this.data.currentLocationId = locationId;
      this.data.currentMapTileKey = null;
    }
    this.save();
    this.emit('modeChanged', { mode, locationId: this.data.currentLocationId });
    this.emit('change', this.data);
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

  unlockCodex(codexId) {
    if (!this.data.unlockedCodex[codexId]) {
      this.data.unlockedCodex[codexId] = {
        unlocked: true,
        isNew: true,
        unlockedAt: Date.now()
      };
      this.save();
      this.emit('codexUnlocked', codexId);
      this.emit('change', this.data);
      return true;
    }
    return false;
  }

  markCodexRead(codexId) {
    if (this.data.unlockedCodex[codexId] && this.data.unlockedCodex[codexId].isNew) {
      this.data.unlockedCodex[codexId].isNew = false;
      this.save();
      this.emit('codexRead', codexId);
      this.emit('change', this.data);
    }
  }

  getUnreadCodexCount() {
    return Object.values(this.data.unlockedCodex).filter(c => c.unlocked && c.isNew).length;
  }

  // --- Flags & Stats ---

  getFlag(flagName) {
    return this.data.flags[flagName];
  }

  setFlag(flagName, value = true) {
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
    return this.data.player;
  }

  modifyStat(statName, delta) {
    if (this.data.player.stats[statName] !== undefined) {
      const prev = this.data.player.stats[statName];
      this.data.player.stats[statName] = Math.max(0, prev + delta);
      this.save();
      this.emit('statChanged', { statName, prev, current: this.data.player.stats[statName], delta });
      this.emit('change', this.data);
      return this.data.player.stats[statName];
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