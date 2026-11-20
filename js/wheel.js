/**
 * Interactive horizontal dock controller for the bottom pocket menu.
 */

import { state } from './state.js?v=20261121_0715';

export const POCKET_ITEMS = [
  { id: 'codex', label: '메모', icon: '📖', subtitle: '단서 및 인물 도감' },
  { id: 'map', label: '지도', icon: '🗺️', subtitle: '아카데미 전도 & 이동' },
  { id: 'inventory', label: '인벤토리', icon: '🎒', subtitle: '아이템' },
  { id: 'stats', label: '스탯', icon: '📊', subtitle: '능력치 & 상태' }
];

export class RotaryWheel {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('pocket-wheel-container');
    this.wheelEl = options.wheelEl || document.getElementById('rotary-wheel');
    this.handleEl = options.handleEl || document.getElementById('pocket-handle');
    this.scrimEl = options.scrimEl || document.getElementById('pocket-scrim');
    this.onSelectPanel = options.onSelectPanel || (() => {});
    this.playAudio = options.playAudio || (() => {});

    this.isOpen = false;
    this.items = POCKET_ITEMS;
    this.activeIndex = 0;

    this.init();
  }

  init() {
    this.renderWheelItems();
    this.bindEvents();
    this.updateActiveItem(true);
    this.updateNotificationBadge();

    state.on('codexUnlocked', () => this.updateNotificationBadge());
    state.on('codexRead', () => this.updateNotificationBadge());
    state.on('itemAdded', () => this.updateNotificationBadge());
  }

  renderWheelItems() {
    if (!this.wheelEl) return;
    this.wheelEl.innerHTML = '';

    this.items.forEach((item, index) => {
      const itemEl = document.createElement('button');
      itemEl.type = 'button';
      itemEl.className = 'wheel-item';
      itemEl.dataset.index = index;
      itemEl.dataset.id = item.id;
      itemEl.setAttribute('aria-label', `${item.label} (${item.subtitle})`);

      itemEl.innerHTML = `
        <div class="wheel-item-inner">
          <span class="wheel-item-icon">${item.icon}</span>
          <span class="wheel-item-label">${item.label}</span>
          <span class="wheel-badge" data-badge-for="${item.id}"></span>
        </div>
      `;

      this.wheelEl.appendChild(itemEl);
    });
  }

  bindEvents() {
    if (this.handleEl) {
      this.handleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    if (this.scrimEl) {
      this.scrimEl.addEventListener('click', () => {
        this.close();
      });
    }

    if (this.wheelEl) {
      this.wheelEl.addEventListener('click', (e) => {
        const itemEl = e.target.closest('.wheel-item');
        if (itemEl && this.wheelEl.contains(itemEl)) {
          this.activeIndex = Number(itemEl.dataset.index);
          this.updateActiveItem();
          this.playAudio('wheelTick');
          this.openActivePanel();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (this.isOpen) {
        if (e.target.closest?.('button, input, textarea, select')) return;

        if (e.key === 'Escape') {
          this.close();
        } else if (e.key === 'ArrowLeft') {
          this.rotateByStep(-1);
        } else if (e.key === 'ArrowRight') {
          this.rotateByStep(1);
        } else if (e.key === 'Enter') {
          this.openActivePanel();
        }
      }
    });

  }

  rotateByStep(direction) {
    this.activeIndex = (this.activeIndex + direction + this.items.length) % this.items.length;
    this.updateActiveItem(true);
  }

  setActivePanel(panelId) {
    const index = this.items.findIndex((item) => item.id === panelId);
    if (index < 0) return;

    this.activeIndex = index;
    this.updateActiveItem();
  }

  updateActiveItem(triggerSound = false) {
    if (!this.wheelEl) return;

    this.wheelEl.querySelectorAll('.wheel-item').forEach((el, index) => {
      const isActive = index === this.activeIndex;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-pressed', String(isActive));
    });

    if (triggerSound) {
      this.playAudio('wheelTick');
    }
  }

  updateNotificationBadge() {
    const unreadCount = state.getUnreadCodexCount();
    const handleBadge = document.getElementById('pocket-badge');
    if (handleBadge) {
      if (unreadCount > 0) {
        handleBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        handleBadge.classList.add('is-visible');
      } else {
        handleBadge.classList.remove('is-visible');
      }
    }

    const codexItemBadge = this.wheelEl?.querySelector('[data-badge-for="codex"]');
    if (codexItemBadge) {
      if (unreadCount > 0) {
        codexItemBadge.textContent = unreadCount;
        codexItemBadge.classList.add('is-visible');
      } else {
        codexItemBadge.classList.remove('is-visible');
      }
    }
  }

  openActivePanel() {
    const activeItem = this.items[this.activeIndex];
    if (activeItem) {
      this.close();
      this.onSelectPanel(activeItem.id);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    if (state.hasPocket()) {
      state.markPocketOpened();
    }
    if (this.container) {
      this.container.classList.add('is-open');
    }
    if (this.handleEl) {
      this.handleEl.classList.add('is-open');
      this.handleEl.setAttribute('aria-expanded', 'true');
    }
    if (this.scrimEl) {
      this.scrimEl.classList.add('is-visible');
    }
    this.updateActiveItem(false);
    this.playAudio('drawerOpen');
  }

  close() {
    this.isOpen = false;
    if (this.container) {
      this.container.classList.remove('is-open');
    }
    if (this.handleEl) {
      this.handleEl.classList.remove('is-open');
      this.handleEl.setAttribute('aria-expanded', 'false');
    }
    if (this.scrimEl) {
      this.scrimEl.classList.remove('is-visible');
    }
    this.playAudio('drawerClose');
  }
}