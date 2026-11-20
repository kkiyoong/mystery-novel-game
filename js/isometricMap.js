const SVG_NS = 'http://www.w3.org/2000/svg';
const R_SPACE = 49;
const R_DRAW = 48;
const ISO_Y = 0.56;
const DEPTH = 15;
const MAP_OFFSET_Y = 35;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const MAP_TILES = [
  {
    "key": "dormitory",
    "name": "기숙사",
    "q": -1,
    "r": 0,
    "building": "dormitory",
    "description": "아카데미 구성원들이 생활하는 기숙사입니다.",
    "visualOnly": true
  },
  {
    "key": "archive-tower",
    "name": "도서관",
    "q": 0,
    "r": -1,
    "building": "tower",
    "description": "아카데미의 오래된 기록을 보관하는 탑입니다.",
    "locationId": "loc_library",
    "alwaysVisible": true
  },
  {
    "key": "academic-wing",
    "name": "연구관",
    "q": 1,
    "r": -1,
    "building": "annex",
    "description": "아카데미의 연구와 강의가 이루어지는 건물입니다.",
    "visualOnly": true
  },
  {
    "key": "garden",
    "locationId": "loc_garden",
    "name": "정원",
    "q": -1,
    "r": -1,
    "building": "garden",
    "alwaysVisible": true
  },
  {
    "key": "main-building",
    "locationId": "loc_main",
    "name": "본관",
    "q": 0,
    "r": 0,
    "building": "main",
    "alwaysVisible": true
  },
  {
    "key": "annex",
    "locationId": "loc_lab",
    "name": "별관",
    "q": 1,
    "r": 0,
    "building": "annex"
  },
  {
    "key": "clocktower",
    "locationId": "loc_clocktower",
    "name": "시계탑 테라스",
    "q": 2,
    "r": -1,
    "building": "tower"
  },
  {
    "key": "nebula-hall",
    "locationId": "loc_nebula",
    "name": "네블라 홀",
    "q": 2,
    "r": 0,
    "building": "dome",
    "description": "아카데미 외곽에 자리한 돔형 강당입니다."
  },
  {
    "key": "north-expansion",
    "name": "새 장소",
    "q": 1,
    "r": -2,
    "description": "아카데미 북쪽에 남아 있는 빈 터입니다.",
    "locationId": "loc_custom_1795174793503",
    "building": "annex"
  },
  {
    "key": "west-expansion",
    "name": "서쪽 빈 터",
    "q": -2,
    "r": 0,
    "description": "아카데미 서쪽의 빈 부지입니다."
  },
  {
    "key": "southwest-expansion",
    "name": "남서쪽 빈 터",
    "q": -2,
    "r": 1,
    "description": "아카데미 남서쪽의 빈 부지입니다."
  },
  {
    "key": "southwest-courtyard",
    "name": "남쪽 안뜰",
    "q": -1,
    "r": 1,
    "description": "아직 건물이 들어서지 않은 남쪽 안뜰입니다."
  },
  {
    "key": "south-courtyard",
    "name": "중앙 남쪽 터",
    "q": 0,
    "r": 1,
    "description": "중앙 건물 남쪽에 남아 있는 빈 터입니다."
  },
  {
    "key": "southeast-courtyard",
    "name": "남동쪽 빈 터",
    "q": 1,
    "r": 1,
    "description": "아카데미 남동쪽의 빈 부지입니다."
  }
];

function isoXY(q, r) {
  return {
    x: R_SPACE * Math.sqrt(3) * (q + r / 2),
    y: R_SPACE * 1.5 * r * ISO_Y
  };
}

function hexVerts(cx, cy, radius) {
  const vertices = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30);
    vertices.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle) * ISO_Y
    });
  }
  return vertices;
}

function ptsStr(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function sideFacesSVG(vertices) {
  return [
    {
      className: 'side-left',
      points: ptsStr([
        vertices[2],
        vertices[3],
        { x: vertices[3].x, y: vertices[3].y + DEPTH },
        { x: vertices[2].x, y: vertices[2].y + DEPTH }
      ])
    },
    {
      className: 'side-mid',
      points: ptsStr([
        vertices[1],
        vertices[2],
        { x: vertices[2].x, y: vertices[2].y + DEPTH },
        { x: vertices[1].x, y: vertices[1].y + DEPTH }
      ])
    },
    {
      className: 'side-right',
      points: ptsStr([
        vertices[0],
        vertices[1],
        { x: vertices[1].x, y: vertices[1].y + DEPTH },
        { x: vertices[0].x, y: vertices[0].y + DEPTH }
      ])
    }
  ];
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function appendShape(parent, name, attributes) {
  const shape = svgElement(name, attributes);
  parent.appendChild(shape);
  return shape;
}

function drawRaisedTile(parent, isCurrent) {
  const vertices = hexVerts(0, 0, R_DRAW);
  const sideFills = isCurrent
    ? { 'side-left': '#B9B9B9', 'side-mid': '#A8A8A8', 'side-right': '#969696' }
    : { 'side-left': '#E5E5E5', 'side-mid': '#D0D0D0', 'side-right': '#BDBDBD' };

  sideFacesSVG(vertices).forEach(({ className, points }) => {
    appendShape(parent, 'polygon', {
      class: `iso-tile-side ${className}`,
      points,
      fill: sideFills[className],
      stroke: '#111111',
      'stroke-width': '1.4',
      'stroke-linejoin': 'round'
    });
  });

  appendShape(parent, 'polygon', {
    class: 'iso-tile-top',
    points: ptsStr(vertices),
    fill: isCurrent ? '#E0E0E0' : '#FFFFFF',
    stroke: '#111111',
    'stroke-width': '1.6',
    'stroke-linejoin': 'round'
  });

  [0, 1, 2, 3].forEach((index) => {
    const vertex = vertices[index];
    appendShape(parent, 'line', {
      class: 'iso-tile-edge',
      x1: vertex.x,
      y1: vertex.y,
      x2: vertex.x,
      y2: vertex.y + DEPTH,
      stroke: '#111111',
      'stroke-width': '1.4'
    });
  });
}

function drawLockedSlot(parent) {
  appendShape(parent, 'polygon', {
    class: 'iso-locked-slot',
    points: ptsStr(hexVerts(0, DEPTH, R_DRAW)),
    fill: '#F2F2F2',
    stroke: '#AAAAAA',
    'stroke-width': '1.5',
    'stroke-dasharray': '4 3',
    'stroke-linejoin': 'round'
  });
}

function drawBuilding(parent, type) {
  const group = svgElement('g', {
    class: `iso-building iso-building-${type}`,
    transform: 'scale(0.55)',
    fill: '#FAFAFA',
    stroke: '#111111',
    'stroke-width': '1.8',
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round'
  });
  parent.appendChild(group);

  if (type === 'main') {
    appendShape(group, 'polygon', { points: '-43,-53 0,-81 43,-53', fill: '#FFFFFF' });
    appendShape(group, 'rect', { x: -34, y: -53, width: 68, height: 55, fill: '#FFFFFF' });
    appendShape(group, 'line', { x1: -41, y1: -52, x2: 41, y2: -52 });
    appendShape(group, 'rect', { x: -8, y: -27, width: 16, height: 29, fill: '#E8E8E8' });
    [-23, 23].forEach((x) => {
      appendShape(group, 'rect', { x: x - 5, y: -42, width: 10, height: 12, fill: '#FFFFFF' });
      appendShape(group, 'line', { x1: x, y1: -42, x2: x, y2: -30 });
      appendShape(group, 'line', { x1: x - 5, y1: -36, x2: x + 5, y2: -36 });
    });
    appendShape(group, 'line', { x1: -34, y1: 2, x2: 34, y2: 2 });
  } else if (type === 'annex') {
    appendShape(group, 'polygon', { points: '-36,-43 0,-66 36,-43', fill: '#FFFFFF' });
    appendShape(group, 'rect', { x: -28, y: -43, width: 56, height: 45, fill: '#FFFFFF' });
    appendShape(group, 'rect', { x: -7, y: -24, width: 14, height: 26, fill: '#E8E8E8' });
    [-18, 18].forEach((x) => {
      appendShape(group, 'rect', { x: x - 4, y: -34, width: 8, height: 10, fill: '#FFFFFF' });
      appendShape(group, 'line', { x1: x, y1: -34, x2: x, y2: -24 });
    });
    appendShape(group, 'line', { x1: -30, y1: 2, x2: 30, y2: 2 });
  } else if (type === 'dormitory') {
    appendShape(group, 'polygon', { points: '-35,-42 0,-64 35,-42', fill: '#FFFFFF' });
    appendShape(group, 'rect', { x: -29, y: -42, width: 58, height: 44, fill: '#FFFFFF' });
    appendShape(group, 'rect', { x: -6, y: -22, width: 12, height: 24, fill: '#E8E8E8' });
    [-18, 18].forEach((x) => {
      appendShape(group, 'rect', { x: x - 4, y: -33, width: 8, height: 9, fill: '#FFFFFF' });
      appendShape(group, 'line', { x1: x, y1: -33, x2: x, y2: -24 });
    });
    appendShape(group, 'line', { x1: -30, y1: 2, x2: 30, y2: 2 });
  } else if (type === 'garden') {
    appendShape(group, 'path', {
      d: 'M-39,2 L-39,-25 Q0,-75 39,-25 L39,2 Z',
      fill: '#FFFFFF'
    });
    appendShape(group, 'path', { d: 'M-28,2 L-28,-25 Q0,-61 28,-25 L28,2', fill: 'none' });
    appendShape(group, 'line', { x1: 0, y1: -52, x2: 0, y2: 2 });
    appendShape(group, 'line', { x1: -27, y1: -24, x2: 27, y2: -24 });
    appendShape(group, 'path', { d: 'M-20,-3 Q-15,-22 -8,-29 M20,-3 Q15,-22 8,-29', fill: 'none' });
    appendShape(group, 'path', { d: 'M-19,-16 Q-10,-21 -11,-28 M19,-15 Q10,-21 11,-28', fill: 'none' });
    appendShape(group, 'line', { x1: -39, y1: 2, x2: 39, y2: 2 });
  } else if (type === 'tower') {
    appendShape(group, 'polygon', { points: '-26,-38 0,-62 26,-38', fill: '#FFFFFF' });
    appendShape(group, 'rect', { x: -20, y: -38, width: 40, height: 40, fill: '#FFFFFF' });
    appendShape(group, 'circle', { cx: 0, cy: -25, r: 8, fill: '#FFFFFF' });
    appendShape(group, 'line', { x1: 0, y1: -25, x2: 0, y2: -31 });
    appendShape(group, 'line', { x1: 0, y1: -25, x2: 5, y2: -22 });
    appendShape(group, 'line', { x1: -22, y1: 2, x2: 22, y2: 2 });
  } else if (type === 'dome') {
    appendShape(group, 'path', {
      d: 'M-39,2 L-39,-27 C-39,-49 -20,-65 0,-65 C20,-65 39,-49 39,-27 L39,2 Z',
      fill: '#FFFFFF'
    });
    appendShape(group, 'path', { d: 'M-27,2 L-27,-27 C-27,-43 -14,-54 0,-54 C14,-54 27,-43 27,-27 L27,2', fill: 'none' });
    appendShape(group, 'line', { x1: 0, y1: -65, x2: 0, y2: 2 });
    appendShape(group, 'line', { x1: -39, y1: -27, x2: 39, y2: -27 });
    appendShape(group, 'line', { x1: -39, y1: 2, x2: 39, y2: 2 });
  }
}

export class IsometricMap {
  constructor({ layerEl, isLocationUnlocked, onTravelToLocation, onCannotTravel, onSetCurrentTile }) {
    this.layer = layerEl;
    this.isLocationUnlocked = isLocationUnlocked;
    this.onTravelToLocation = onTravelToLocation;
    this.onCannotTravel = onCannotTravel;
    this.onSetCurrentTile = onSetCurrentTile;
    this.selectedKey = null;
    this.tilesByKey = new Map();

    const descBox = document.getElementById('academy-map-description');
    if (descBox && !descBox.dataset.boundClick) {
      descBox.dataset.boundClick = 'true';
      descBox.addEventListener('click', (e) => {
        if (e.target.closest('.academy-map-action-btn')) return;
        const selectedTile = this.tilesByKey.get(this.selectedKey);
        if (selectedTile?.canTravel && !selectedTile.isCurrent) {
          this.onTravelToLocation(selectedTile.location);
        } else if (selectedTile) {
          this.onCannotTravel?.(selectedTile);
        }
      });
      descBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const selectedTile = this.tilesByKey.get(this.selectedKey);
          if (selectedTile?.canTravel && !selectedTile.isCurrent) {
            this.onTravelToLocation(selectedTile.location);
          } else if (selectedTile) {
            this.onCannotTravel?.(selectedTile);
          }
        }
      });
    }
  }

  render(locations, currentLocationId, currentMapTileKey = null) {
    const locationById = new Map(locations.map((location) => [location.id, location]));
    const validCurrentTileKey = MAP_TILES.some((tile) => tile.key === currentMapTileKey)
      ? currentMapTileKey
      : null;
    const tiles = MAP_TILES.map((tile) => {
      const location = tile.locationId ? locationById.get(tile.locationId) : null;
      const locationUnlocked = Boolean(location && this.isLocationUnlocked(location));
      const isBuilt = Boolean(tile.visualOnly || tile.alwaysVisible || locationUnlocked);
      const isEmpty = !isBuilt;
      const isCurrent = validCurrentTileKey
        ? tile.key === validCurrentTileKey
        : Boolean(location && location.id === currentLocationId);
      const position = isoXY(tile.q, tile.r);

      return {
        ...tile,
        location,
        isBuilt,
        isEmpty,
        canTravel: locationUnlocked,
        isCurrent,
        name: isEmpty ? '?' : (location?.name || tile.name),
        displayName: isEmpty ? '?' : (location?.name || tile.name),
        description: isEmpty ? '미해금 지역' : (location ? location.description : tile.description),
        building: location?.building || tile.building,
        image: location?.image || tile.image,
        centerX: position.x,
        centerY: position.y + MAP_OFFSET_Y
      };
    }).sort((a, b) => a.centerY - b.centerY);

    this.selectedKey = tiles.find((tile) => tile.isCurrent)?.key || tiles[0]?.key || null;
    this.tilesByKey = new Map(tiles.map((tile) => [tile.key, tile]));
    this.layer.replaceChildren();

    tiles.filter((tile) => tile.isEmpty).forEach((tile) => this.renderTile(tile));
    tiles.filter((tile) => !tile.isEmpty).forEach((tile) => this.renderTile(tile));

    this.showDescription(tiles.find((tile) => tile.isCurrent) || tiles[0]);
  }

  renderTile(tile) {
    const tileGroup = svgElement('g', {
      class: `iso-tile${tile.isEmpty ? ' is-empty' : ' is-built'}${tile.isCurrent ? ' is-current' : ''}`,
      transform: `translate(${tile.centerX} ${tile.centerY})`,
      role: 'button',
      tabindex: '0',
      'data-tile-key': tile.key,
      'aria-label': `${tile.displayName}. ${tile.description}`
    });
    const tileArt = svgElement('g', { class: 'iso-tile-art' });

    if (!tile.isEmpty) {
      drawRaisedTile(tileArt, tile.isCurrent);
      if (tile.image) {
        appendShape(tileArt, 'image', {
          class: 'iso-building-image',
          href: tile.image,
          x: -40,
          y: -76,
          width: 80,
          height: 80,
          preserveAspectRatio: 'xMidYMax meet'
        });
      } else if (tile.building) {
        drawBuilding(tileArt, tile.building);
      }
    } else {
      drawLockedSlot(tileArt);
    }

    tileGroup.appendChild(tileArt);
    this.layer.appendChild(tileGroup);

    tileGroup.addEventListener('pointerenter', () => {
      this.setActiveTile(tile);
    });
    tileGroup.addEventListener('pointerleave', () => {
      this.restoreSelectedTile();
    });
    tileGroup.addEventListener('focus', () => {
      this.setActiveTile(tile);
    });
    tileGroup.addEventListener('blur', () => {
      this.restoreSelectedTile();
    });
    tileGroup.addEventListener('click', () => {
      if (this.selectedKey === tile.key) {
        if (tile.canTravel && !tile.isCurrent) {
          this.onTravelToLocation(tile.location);
        } else {
          this.onCannotTravel?.(tile);
        }
      } else {
        this.selectedKey = tile.key;
        this.setActiveTile(tile);
      }
    });
    tileGroup.addEventListener('dblclick', (event) => {
      event.preventDefault();
      if (tile.canTravel && !tile.isCurrent) {
        this.onTravelToLocation(tile.location);
      } else {
        this.onCannotTravel?.(tile);
      }
    });
    tileGroup.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.selectedKey = tile.key;
        this.setActiveTile(tile);
        if (event.key === 'Enter') {
          if (tile.canTravel && !tile.isCurrent) {
            this.onTravelToLocation(tile.location);
          } else {
            this.onCannotTravel?.(tile);
          }
        }
      }
    });
  }

  setCurrentTile(tile) {
    this.selectedKey = tile.key;
    this.onSetCurrentTile(tile.key);
  }

  setActiveTile(tile) {
    this.layer.querySelectorAll('.iso-tile').forEach((element) => {
      const isActive = !tile.isEmpty && element.dataset.tileKey === tile.key;
      element.classList.toggle('is-lifted', isActive);
    });
    this.showDescription(tile);
  }

  restoreSelectedTile() {
    const selected = this.layer.querySelectorAll('.iso-tile');
    selected.forEach((element) => {
      element.classList.remove('is-lifted');
    });
    const selectedTile = this.tilesByKey.get(this.selectedKey);
    const selectedElement = Array.from(selected).find(
      (element) => element.dataset.tileKey === this.selectedKey
    );
    if (selectedElement && selectedTile && !selectedTile.isEmpty) {
      selectedElement.classList.add('is-lifted');
    }
    this.showDescriptionForSelected();
  }

  showDescriptionForSelected() {
    const tile = this.tilesByKey.get(this.selectedKey);
    if (tile) this.showDescription(tile);
  }

  showDescription(tile) {
    if (tile) {
      this.updateDescription(tile);
    }
  }

  updateDescription(tile) {
    const titleEl = document.getElementById('academy-map-location-title');
    const descriptionEl = document.getElementById('academy-map-location-description');
    const descBox = document.getElementById('academy-map-description');

    if (titleEl) titleEl.textContent = tile.displayName || '';
    if (descriptionEl) descriptionEl.textContent = tile.description || '';

    if (descBox) {
      const actionWrap = descBox.querySelector('.academy-map-action-wrap');
      if (tile.canTravel && !tile.isCurrent) {
        descBox.classList.add('can-travel');
        descBox.classList.remove('is-locked', 'is-current');

        if (actionWrap) {
          actionWrap.innerHTML = `
            <button type="button" class="academy-map-action-btn is-primary" data-map-action="travel" title="${escapeHtml(tile.displayName || '장소')}(으)로 이동">
              <span>이동하기</span>
              <span class="academy-map-arrow" aria-hidden="true">→</span>
            </button>
          `;

          const travelBtn = actionWrap.querySelector('.academy-map-action-btn');
          if (travelBtn) {
            travelBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.onTravelToLocation(tile.location);
            });
          }
        }
      } else if (tile.isCurrent) {
        descBox.classList.add('is-current');
        descBox.classList.remove('can-travel', 'is-locked');
        if (actionWrap) {
          actionWrap.innerHTML = `<span class="academy-map-status-chip is-current">📍 현재 위치</span>`;
        }
      } else if (tile.isEmpty) {
        descBox.classList.add('is-locked');
        descBox.classList.remove('can-travel', 'is-current');
        if (actionWrap) {
          actionWrap.innerHTML = `<span class="academy-map-status-chip is-locked">🔒 미해금</span>`;
        }
      } else {
        descBox.classList.remove('can-travel', 'is-locked', 'is-current');
        if (actionWrap) {
          actionWrap.innerHTML = '';
        }
      }
    }
  }
}
