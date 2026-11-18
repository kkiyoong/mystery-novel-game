const SVG_NS = 'http://www.w3.org/2000/svg';

// 육각형 격자 6방향 이웃 오프셋 (우, 우상, 좌상, 좌, 좌하, 우하)
const HEX_DIRS = [
  { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
  { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 }
];

// 주요 단서 기본 배치용 간격 넓은 육각 좌표 (서로 겹치지 않는 벌집 간격)
const ANCHOR_SLOTS = [
  { q: 0, r: 0 }, { q: 3, r: -1 }, { q: -3, r: 1 },
  { q: 1, r: 2 }, { q: -1, r: -2 }, { q: 4, r: -3 },
  { q: -4, r: 3 }, { q: -2, r: 3 }, { q: 2, r: -3 }
];

function wrapLabel(value, maxChars = 6, maxLines = 2) {
  const remaining = Array.from(String(value || '').trim());
  const lines = [];
  while (remaining.length && lines.length < maxLines) {
    if (remaining.length <= maxChars) {
      lines.push(remaining.join(''));
      remaining.length = 0;
      break;
    }
    const candidate = remaining.slice(0, maxChars);
    const spaceIndex = candidate.lastIndexOf(' ');
    const splitAt = spaceIndex >= Math.ceil(maxChars / 2) ? spaceIndex : maxChars;
    lines.push(remaining.splice(0, splitAt).join('').trimEnd());
    while (remaining[0] === ' ') remaining.shift();
  }
  if (remaining.length && lines.length) {
    const lastLine = Array.from(lines[lines.length - 1]);
    lastLine.splice(maxChars - 1);
    lines[lines.length - 1] = `${lastLine.join('').trimEnd()}…`;
  }
  return lines;
}

function appendSvgText(parent, className, x, y, lines, lineHeight) {
  if (!lines.length) return;
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('class', className);
  text.setAttribute('x', x);
  text.setAttribute('y', y);
  text.setAttribute('text-anchor', 'middle');
  lines.forEach((line, index) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('dy', index === 0 ? '0' : String(lineHeight));
    tspan.textContent = line;
    text.appendChild(tspan);
  });
  parent.appendChild(text);
}

export class MemoBoard {
  constructor({ svgEl, layerEl, onSelectClue, onUnlockHypothesis, recipes = {} }) {
    this.svg = svgEl;
    this.layer = layerEl;
    this.onSelectClue = onSelectClue;
    this.onUnlockHypothesis = onUnlockHypothesis;

    this.R = 42;       // 주 단서 육각형 반지름
    this.SUB_R = 39;   // 하위 키워드 육각형 반지름
    this.GRID_R = 42;

    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    this.expandedId = null;
    this.pinnedId = null; // 클릭으로 고정해 둔 단서 ID
    this.selectedId = null;
    this.dragNode = null;
    this.dragMoved = false;
    this.dragPointerId = null;
    this.boardPan = false;
    this.panStart = { x: 0, y: 0 };
    this.clues = [];
    this.hypotheses = [];
    this.readNewIds = new Set();
    this.positions = new Map();
    this.recipes = recipes;

    this._bindEvents();
    this.render();
  }

  // 육각 격자 (q, r) -> 화면 픽셀 (x, y)
  axialToPixel(q, r) {
    return {
      x: this.GRID_R * 1.5 * q,
      y: this.GRID_R * Math.sqrt(3) * (r + q / 2)
    };
  }

  // 화면 픽셀 (x, y) -> 가장 가까운 육각 격자 (q, r) 스냅
  pixelToAxial(x, y) {
    const q = ((2 / 3) * x) / this.GRID_R;
    const r = (-x / 3 + Math.sqrt(3) * y / 3) / this.GRID_R;
    return this._axialRound(q, r);
  }

  _axialRound(q, r) {
    const x = q, z = r, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
  }

  _findFreeHexNear(targetQ, targetR, excludeId, blocked = new Set()) {
    const queue = [{ q: targetQ, r: targetR }];
    const visited = new Set();

    while (queue.length) {
      const cell = queue.shift();
      const key = `${cell.q},${cell.r}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const occupied = this.clues.some(
        (clue) => clue.id !== excludeId && clue.q === cell.q && clue.r === cell.r
      );
      if (!occupied && !blocked.has(key)) return cell;

      HEX_DIRS.forEach((dir) => {
        queue.push({ q: cell.q + dir.dq, r: cell.r + dir.dr });
      });
    }

    return { q: targetQ, r: targetR };
  }

  setClues(clues, { includeHypotheses = false, selectedId = null } = {}) {
    const unlockedClues = clues
      .filter((clue) => !clue.locked)
      .map((clue, index) => {
        const slot = ANCHOR_SLOTS[index] || { q: (index % 3) * 3 - 3, r: Math.floor(index / 3) * 2 };
        const previous = this.positions.get(clue.id);
        const q = Number.isFinite(clue.q) ? clue.q : (previous?.q ?? slot.q);
        const r = Number.isFinite(clue.r) ? clue.r : (previous?.r ?? slot.r);
        const pos = this.axialToPixel(q, r);
        this.positions.set(clue.id, { q, r });
        const rawSubs = Array.isArray(clue.subItems) ? clue.subItems : (clue.keywords || []);
        return {
          ...clue,
          q,
          r,
          x: pos.x,
          y: pos.y,
          isNew: Boolean(clue.isNew && !this.readNewIds.has(clue.id)),
          subItems: rawSubs.map((kw, idx) => {
            const keyword = typeof kw === 'string'
              ? { label: kw, sub: '키워드', desc: clue.desc }
              : kw;
            const id = keyword.id || `${clue.id}_kw_${idx}`;
            return {
              ...keyword,
              id,
              label: keyword.label,
              sub: keyword.sub || '키워드',
              desc: keyword.desc || clue.desc,
              isNew: Boolean(keyword.isNew && !this.readNewIds.has(id))
            };
          })
        };
      });

    this.clues = [...unlockedClues, ...(includeHypotheses ? this.hypotheses : [])];
    this.selectedId = selectedId && this.clues.some((c) => c.id === selectedId) ? selectedId : null;
    if (!this.clues.some((c) => c.id === this.expandedId)) this.expandedId = null;

    if (this._hasOverlap()) {
      this.arrangeClues({ collapse: false });
    } else {
      this.render();
    }
  }

  _hasOverlap() {
    const occupied = new Set();
    for (let i = 0; i < this.clues.length; i++) {
      const key = `${this.clues[i].q},${this.clues[i].r}`;
      if (occupied.has(key)) return true;
      occupied.add(key);
    }
    return false;
  }

  // 정렬: 세부 항목을 모두 접고, 주 단서를 육각 격자 간격에 맞춰 재배열
  arrangeClues({ collapse = true } = {}) {
    if (collapse) {
      this.expandedId = null;
      this.pinnedId = null;
      this.selectedId = null;
    }

    const startQ = -Math.floor((this.clues.length - 1) / 2);
    this.clues.forEach((clue, idx) => {
      clue.q = startQ + idx;
      clue.r = 0;
      this.positions.set(clue.id, { q: clue.q, r: clue.r });
      const pos = this.axialToPixel(clue.q, clue.r);
      clue.x = pos.x;
      clue.y = pos.y;
    });

    const center = this.clues.length
      ? this.axialToPixel((startQ + startQ + this.clues.length - 1) / 2, 0)
      : { x: 0, y: 0 };
    this.panX = -center.x;
    this.panY = -center.y;
    this.scale = 1;
    this.render();
  }

  centerClues() {
    this.expandedId = null;
    this.pinnedId = null;

    if (!this.clues.length) {
      this.panX = 0;
      this.panY = 0;
      this.scale = 1;
      this.render();
      return;
    }

    const minX = Math.min(...this.clues.map((clue) => clue.x - this.R));
    const maxX = Math.max(...this.clues.map((clue) => clue.x + this.R));
    const minY = Math.min(...this.clues.map((clue) => clue.y - this.R));
    const maxY = Math.max(...this.clues.map((clue) => clue.y + this.R));
    const viewBox = this.svg.viewBox.baseVal;
    const width = viewBox.width;
    const height = viewBox.height;
    const padding = 12;
    const fitScale = Math.min(
      1,
      (width - padding * 2) / (maxX - minX),
      (height - padding * 2) / (maxY - minY)
    );
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    this.scale = fitScale;
    this.panX = viewBox.x + width / 2 - contentCenterX * this.scale;
    this.panY = viewBox.y + height / 2 - contentCenterY * this.scale;
    this.render();
  }

  _screenPoint(clientX, clientY, element) {
    const point = this.svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = element.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: clientX, y: clientY };
  }

  screenToSVG(clientX, clientY) {
    return this._screenPoint(clientX, clientY, this.layer);
  }

  setTransform() {
    this.layer.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.scale})`);
  }

  zoomBy(delta) {
    this.scale = Math.max(0.6, Math.min(1.9, this.scale + delta));
    this.setTransform();
  }

  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    this.setTransform();
  }

  findCombinePartner(node) {
    return this.clues.find((other) => {
      if (other.id === node.id) return false;
      if (Math.hypot(other.x - node.x, other.y - node.y) > 90) return false;
      const key = [node.id, other.id].sort().join('+');
      return Boolean(this.recipes[key]);
    }) || null;
  }

  findCombinePartnerAt(node, cell) {
    return this.clues.find((other) => {
      if (other.id === node.id) return false;
      const adjacent = HEX_DIRS.some(
        (dir) => other.q === cell.q + dir.dq && other.r === cell.r + dir.dr
      );
      const key = [node.id, other.id].sort().join('+');
      return adjacent && Boolean(this.recipes[key]);
    }) || null;
  }

  _hexDistance(aq, ar, bq, br) {
    return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs((aq + ar) - (bq + br)));
  }

  _makeRoomForSubclues(parent) {
    const subItems = parent.subItems?.slice(0, 6) || [];
    if (!subItems.length) return;

    const reserved = new Set(subItems.map((_, index) => {
      const dir = HEX_DIRS[index];
      return `${parent.q + dir.dq},${parent.r + dir.dr}`;
    }));

    subItems.forEach((_, index) => {
      const dir = HEX_DIRS[index];
      const targetQ = parent.q + dir.dq;
      const targetR = parent.r + dir.dr;
      const occupant = this.clues.find(
        (clue) => clue.id !== parent.id && clue.q === targetQ && clue.r === targetR
      );
      if (!occupant) return;

      for (let distance = 1; distance <= 2; distance++) {
        const candidates = [];
        for (let dq = -distance; dq <= distance; dq++) {
          for (let dr = -distance; dr <= distance; dr++) {
            if (this._hexDistance(dq, dr, 0, 0) !== distance) continue;
            const q = occupant.q + dq;
            const r = occupant.r + dr;
            if (this._hexDistance(q, r, parent.q, parent.r) <= 1) continue;
            const key = `${q},${r}`;
            if (reserved.has(key)) continue;
            if (this.clues.some((clue) => clue.id !== occupant.id && clue.q === q && clue.r === r)) continue;
            candidates.push({ q, r, alignment: dq * dir.dq + dr * dir.dr });
          }
        }
        candidates.sort((a, b) => b.alignment - a.alignment);
        if (candidates.length) {
          occupant.q = candidates[0].q;
          occupant.r = candidates[0].r;
          this.positions.set(occupant.id, { q: occupant.q, r: occupant.r });
          const pos = this.axialToPixel(occupant.q, occupant.r);
          occupant.x = pos.x;
          occupant.y = pos.y;
          return;
        }
      }
    });
  }

  _drawEmptySlots() {
    const occupied = new Set(this.clues.map((clue) => `${clue.q},${clue.r}`));
    const visibleCells = new Set();
    this.clues.forEach((clue) => {
      for (let dq = -2; dq <= 2; dq++) {
        for (let dr = -2; dr <= 2; dr++) {
          if (this._hexDistance(dq, dr, 0, 0) > 2) continue;
          visibleCells.add(`${clue.q + dq},${clue.r + dr}`);
        }
      }
    });

    if (this.expandedId && !this.dragNode) {
      const parent = this.clues.find((clue) => clue.id === this.expandedId);
      parent?.subItems?.slice(0, 6).forEach((_, index) => {
        const dir = HEX_DIRS[index];
        occupied.add(`${parent.q + dir.dq},${parent.r + dir.dr}`);
      });
    }

    visibleCells.forEach((key) => {
      if (occupied.has(key)) return;
      const [q, r] = key.split(',').map(Number);
      const pos = this.axialToPixel(q, r);
      const polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('class', 'memo-empty-slot');
      polygon.setAttribute('points', this.hexPoints(pos.x, pos.y, this.R));
      this.layer.appendChild(polygon);
    });
  }

  _bindEvents() {
    this.svg.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (event.target.closest?.('.memo-node')) return;

      // 빈 바탕 클릭 시 펼쳐진 세부 항목 접기
      this.pinnedId = null;
      this.expandedId = null;
      this.render();

      this.boardPan = true;
      const point = this._screenPoint(event.clientX, event.clientY, this.svg);
      this.panStart = { x: point.x - this.panX, y: point.y - this.panY };
      this.svg.setPointerCapture(event.pointerId);
    });

    this.svg.addEventListener('pointermove', (event) => {
      if (this.dragNode && event.pointerId === this.dragPointerId) {
        const point = this.screenToSVG(event.clientX, event.clientY);
        if (Math.hypot(point.x - this.dragNode.x, point.y - this.dragNode.y) > 4) {
          this.dragMoved = true;
          this.expandedId = null; // 드래그 중에는 깔끔하게 접음
          if (!this.svg.hasPointerCapture(event.pointerId)) {
            this.svg.setPointerCapture(event.pointerId);
          }
        }
        this.dragNode.x = point.x;
        this.dragNode.y = point.y;
        this.render();
        return;
      }

      if (!this.boardPan) return;
      const point = this._screenPoint(event.clientX, event.clientY, this.svg);
      this.panX = Math.max(-280, Math.min(280, point.x - this.panStart.x));
      this.panY = Math.max(-220, Math.min(220, point.y - this.panStart.y));
      this.setTransform();
    });

    const endPointer = (event) => {
      if (this.dragNode && event.pointerId === this.dragPointerId) {
        const dragged = this.dragNode;
        const wasDragged = this.dragMoved;

        if (wasDragged) {
          const target = this.pixelToAxial(dragged.x, dragged.y);
          const free = this._findFreeHexNear(target.q, target.r, dragged.id);
          const partner = this.findCombinePartnerAt(dragged, free);
          dragged.q = free.q;
          dragged.r = free.r;
          this.positions.set(dragged.id, { q: dragged.q, r: dragged.r });
          const snappedPos = this.axialToPixel(dragged.q, dragged.r);
          dragged.x = snappedPos.x;
          dragged.y = snappedPos.y;

          if (partner) {
            // 조합 성공: 인접한 빈 칸에 스냅한 뒤 새 가설 생성
            const key = [dragged.id, partner.id].sort().join('+');
            const result = this.recipes[key];

            if (result && !this.hypotheses.some((c) => c.id === result.id)) {
              const hypHex = this._findFreeHexNear(partner.q, partner.r - 1, null);
              const hypPos = this.axialToPixel(hypHex.q, hypHex.r);
              const hypothesis = {
                ...result,
                q: hypHex.q,
                r: hypHex.r,
                x: hypPos.x,
                y: hypPos.y,
                isHypothesis: true,
                subItems: result.subItems || []
              };
              this.hypotheses.push(hypothesis);
              this.clues.push(hypothesis);
              this.positions.set(hypothesis.id, { q: hypothesis.q, r: hypothesis.r });
              this.selectedId = hypothesis.id;
              this.onSelectClue?.(hypothesis);
              this.onUnlockHypothesis?.(hypothesis);
            }
          }
        }

        this.dragNode = null;
        this.dragPointerId = null;
        if (wasDragged) {
          setTimeout(() => { this.dragMoved = false; }, 20);
          this.render();
        }
      }
      this.boardPan = false;
    };

    this.svg.addEventListener('pointerup', endPointer);
    this.svg.addEventListener('pointercancel', endPointer);
    this.svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 0.1 : -0.1);
    }, { passive: false });
  }

  render() {
    this.layer.replaceChildren();
    this.setTransform();

    const partnerHighlight = this.dragNode ? this.findCombinePartner(this.dragNode) : null;
    this._drawEmptySlots();

    // 1. 펼쳐진 하위 정보를 주 단서 주변 6개 육각 격자 칸에 정확히 배치
    if (this.expandedId && !this.dragNode) {
      const parent = this.clues.find((c) => c.id === this.expandedId);
      if (parent && parent.subItems?.length) {
        parent.subItems.slice(0, 6).forEach((subItem, index) => {
          const dir = HEX_DIRS[index];
          const pos = this.axialToPixel(parent.q + dir.dq, parent.r + dir.dr);
          this._drawHex({
            ...subItem,
            x: pos.x,
            y: pos.y,
            isNew: subItem.isNew && !this.readNewIds.has(subItem.id),
            parentEntry: parent.entry
          }, false, false);
        });
      }
    }

    // 2. 주요 단서 육각형 그리기
    this.clues.forEach((clue) => {
      const isCombineReady = partnerHighlight?.id === clue.id;
      this._drawHex(clue, true, isCombineReady);
    });
  }

  _drawHex(node, isMain, isCombineReady) {
    const group = document.createElementNS(SVG_NS, 'g');
    const classes = ['memo-node', isMain ? 'is-main' : 'is-sub'];
    if (node.id === this.selectedId) classes.push('is-selected');
    if (node.isHypothesis) classes.push('is-hypothesis');
    if (isCombineReady) classes.push('is-combine-ready');
    group.setAttribute('class', classes.join(' '));
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', [node.label, node.sub].filter(Boolean).join(', '));

    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('class', 'memo-hex');
    polygon.setAttribute('points', this.hexPoints(node.x, node.y, isMain ? this.R : this.SUB_R));
    group.appendChild(polygon);

    if (node.isNew) {
      const indicator = document.createElementNS(SVG_NS, 'circle');
      indicator.setAttribute('class', 'memo-new-indicator');
      indicator.setAttribute('cx', node.x + (isMain ? this.R : this.SUB_R) * 0.62);
      indicator.setAttribute('cy', node.y - (isMain ? this.R : this.SUB_R) * 0.58);
      indicator.setAttribute('r', '5');
      group.appendChild(indicator);
    }

    const labelLines = wrapLabel(node.label, isMain ? 6 : 5);
    const labelY = labelLines.length > 1 ? node.y - 7 : node.y - 2;
    appendSvgText(group, 'memo-label', node.x, labelY, labelLines, 10);

    if (node.sub) {
      const sub = document.createElementNS(SVG_NS, 'text');
      sub.setAttribute('class', 'memo-sub');
      sub.setAttribute('x', node.x);
      sub.setAttribute('y', node.y + 20);
      sub.setAttribute('text-anchor', 'middle');
      sub.textContent = node.sub;
      group.appendChild(sub);
    }

    // 커서를 가져다 대면 옆에 하위 정보 펼침 (드래그 중이 아닐 때)
    group.addEventListener('pointerenter', () => {
      if (!isMain || this.dragNode || this.pinnedId) return;
      if (node.subItems?.length && this.expandedId !== node.id) {
        this._makeRoomForSubclues(node);
        this.expandedId = node.id;
        this.render();
      }
    });
    group.addEventListener('pointerleave', (event) => {
      if (this.pinnedId || this.dragNode || !this.expandedId) return;
      if (event.relatedTarget?.closest?.('.memo-node')) return;
      this.expandedId = null;
      this.render();
    });

    group.addEventListener('pointerdown', (event) => {
      if (!isMain || (event.button !== 0 && event.pointerType === 'mouse')) return;
      event.stopPropagation();
      this.dragNode = node;
      this.dragMoved = false;
      this.dragPointerId = event.pointerId;
    });

    const selectNode = () => {
      if (this.dragMoved) return;
      this.selectedId = node.id;
      if (node.isNew) {
        this.readNewIds.add(node.id);
        node.isNew = false;
      }
      if (isMain && node.subItems?.length) {
        this.pinnedId = this.pinnedId === node.id ? null : node.id;
        this.expandedId = this.pinnedId;
        if (this.expandedId) this._makeRoomForSubclues(node);
      }
      const selectedNode = node.entry
        ? node
        : (node.parentEntry ? { ...node, entry: node.parentEntry } : node);
      this.onSelectClue?.(selectedNode);
      this.render();
    };

    group.addEventListener('click', (event) => {
      event.stopPropagation();
      selectNode();
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectNode();
      }
    });

    this.layer.appendChild(group);
  }

  hexPoints(cx, cy, radius) {
    const points = [];
    for (let index = 0; index < 6; index++) {
      const angle = (Math.PI / 180) * (60 * index);
      points.push(
        `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`
      );
    }
    return points.join(' ');
  }
}
