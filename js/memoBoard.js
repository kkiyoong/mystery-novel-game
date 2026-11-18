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
  constructor({ svgEl, layerEl, onSelectClue, onUnlockHypothesis, onPuzzleSolved, recipes = {} }) {
    this.svg = svgEl;
    this.layer = layerEl;
    this.onSelectClue = onSelectClue;
    this.onUnlockHypothesis = onUnlockHypothesis;
    this.onPuzzleSolved = onPuzzleSolved;

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
    this.dragStartPoint = null;
    this.dragOffset = null;
    this.dragOrigin = null;
    this.boardPan = false;
    this.panStart = { x: 0, y: 0 };
    this.clues = [];
    this.hypotheses = [];
    this.detachedNodes = new Map();
    this.validationLinks = [];
    this.readNewIds = new Set();
    this.positions = new Map();
    this.recipes = recipes;
    this.focusedKeywordId = null; // 대분류 더블클릭 시 해당 주제만 집중 보기
    this.showFocusBadge = false;  // 집중 보기 알림 배지 (3초간 표시)
    this.focusBadgeTimer = null;

    this._bindEvents();
    this.render();
  }

  _triggerFocusBadge() {
    this.showFocusBadge = true;
    if (this.focusBadgeTimer) {
      clearTimeout(this.focusBadgeTimer);
      this.focusBadgeTimer = null;
    }
    this.focusBadgeTimer = setTimeout(() => {
      this.showFocusBadge = false;
      this.focusBadgeTimer = null;
      this.render();
    }, 3000);
  }

  _clearFocusBadge() {
    this.showFocusBadge = false;
    if (this.focusBadgeTimer) {
      clearTimeout(this.focusBadgeTimer);
      this.focusBadgeTimer = null;
    }
  }

  _hexDistance(a, b, c, d) {
    let q1, r1, q2, r2;
    if (typeof a === 'object' && a !== null) {
      q1 = a.q; r1 = a.r;
      q2 = b?.q; r2 = b?.r;
    } else {
      q1 = a; r1 = b;
      q2 = c; r2 = d;
    }
    if (q1 === undefined || r1 === undefined || q2 === undefined || r2 === undefined) return 999;
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
  }

  _isTargetMatch(targetList, itemLabel, itemId) {
    if (!Array.isArray(targetList) || !targetList.length) return false;
    const cleanLabel = String(itemLabel || '').trim().toLowerCase();
    const cleanId = String(itemId || '').trim().toLowerCase();
    return targetList.some((t) => {
      const cleanT = String(t || '').trim().toLowerCase();
      return cleanT === cleanLabel || cleanT === cleanId;
    });
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
      ) || Array.from(this.detachedNodes.values()).some(
        (node) => node.id !== excludeId && node.q === cell.q && node.r === cell.r
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

        const rawClues = (Array.isArray(clue.subClues) ? clue.subClues : []).filter(
          (sc) => sc.unlockedByDefault !== false || sc.isUnlocked
        );
        const rawSubs = Array.isArray(clue.subItems) ? clue.subItems : (clue.keywords || []);

        const subClues = rawClues.map((sc, idx) => {
          const id = sc.id || `${clue.id}_sc_${idx}`;
          const prev = this.positions.get(id);
          const isDetached = Boolean(prev);
          const scQ = prev ? prev.q : undefined;
          const scR = prev ? prev.r : undefined;
          const node = {
            ...sc,
            id,
            role: 'clue',
            label: sc.label || sc.title || '단서',
            sub: sc.sub || '단서',
            desc: sc.desc || sc.conditionDesc || '수집된 단서입니다.',
            parentEntry: clue.entry || clue,
            q: scQ,
            r: scR,
            isDetached,
            isNew: Boolean(sc.isNew && !this.readNewIds.has(id))
          };
          if (isDetached) this.detachedNodes.set(id, node);
          return node;
        });

        const subItems = rawSubs.map((kw, idx) => {
          const keyword = typeof kw === 'string'
            ? { label: kw, sub: '세부 타일', desc: clue.desc }
            : kw;
          const id = keyword.id || `${clue.id}_kw_${idx}`;
          const prev = this.positions.get(id);
          const isDetached = Boolean(prev);
          const siQ = prev ? prev.q : undefined;
          const siR = prev ? prev.r : undefined;
          const node = {
            ...keyword,
            id,
            role: 'sub',
            label: keyword.label,
            sub: keyword.sub || '세부 타일',
            desc: keyword.desc || keyword.label || clue.desc,
            parentEntry: clue.entry || clue,
            q: siQ,
            r: siR,
            isDetached,
            isNew: Boolean(keyword.isNew && !this.readNewIds.has(id))
          };
          if (isDetached) this.detachedNodes.set(id, node);
          return node;
        });

        return {
          ...clue,
          role: clue.role || 'keyword',
          q,
          r,
          x: pos.x,
          y: pos.y,
          isNew: Boolean(clue.isNew && !this.readNewIds.has(clue.id)),
          subClues,
          subItems
        };
      });

    this.clues = [...unlockedClues, ...(includeHypotheses ? this.hypotheses : [])];
    this.selectedId = selectedId && this.clues.some((c) => c.id === selectedId) ? selectedId : null;
    if (this.focusedKeywordId && this.clues.some((c) => c.id === this.focusedKeywordId)) {
      this.expandedId = this.focusedKeywordId;
      this.pinnedId = this.focusedKeywordId;
    } else {
      if (!this.clues.some((c) => c.id === this.expandedId)) this.expandedId = null;
      if (!this.clues.some((c) => c.id === this.focusedKeywordId)) {
        this.focusedKeywordId = null;
        this._clearFocusBadge();
      }
    }

    this._evaluateAdjacencies();

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
      this.focusedKeywordId = null;
      this._clearFocusBadge();
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
    if (this.focusedKeywordId) {
      this.expandedId = this.focusedKeywordId;
      this.pinnedId = this.focusedKeywordId;
    } else {
      this.expandedId = null;
      this.pinnedId = null;
    }

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
    const activeClues = this.focusedKeywordId
      ? this.clues.filter((c) => c.id === this.focusedKeywordId)
      : this.clues;

    const occupied = new Set(activeClues.map((clue) => `${clue.q},${clue.r}`));
    const visibleCells = new Set();
    activeClues.forEach((clue) => {
      for (let dq = -2; dq <= 2; dq++) {
        for (let dr = -2; dr <= 2; dr++) {
          if (this._hexDistance(dq, dr, 0, 0) > 2) continue;
          visibleCells.add(`${clue.q + dq},${clue.r + dr}`);
        }
      }
    });

    if (this.expandedId) {
      const parent = this.clues.find((clue) => clue.id === this.expandedId);
      const allOrbit = [...(parent?.subClues || []), ...(parent?.subItems || [])];
      allOrbit.slice(0, 6).forEach((_, index) => {
        const dir = HEX_DIRS[index];
        occupied.add(`${parent.q + dir.dq},${parent.r + dir.dr}`);
      });
    }

    if (this.focusedKeywordId) {
      this.detachedNodes.forEach((node) => {
        if (node.q !== undefined && node.r !== undefined) {
          occupied.add(`${node.q},${node.r}`);
        }
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

      // 집중 모드가 아닐 때만 빈 바탕 클릭 시 펼쳐진 세부 항목 접기
      if (!this.focusedKeywordId) {
        this.pinnedId = null;
        this.expandedId = null;
        this.render();
      }

      this.boardPan = true;
      const point = this._screenPoint(event.clientX, event.clientY, this.svg);
      this.panStart = { x: point.x - this.panX, y: point.y - this.panY };
      this.svg.setPointerCapture(event.pointerId);
    });

    this.svg.addEventListener('pointermove', (event) => {
      if (this.dragNode && event.pointerId === this.dragPointerId) {
        const point = this.screenToSVG(event.clientX, event.clientY);
        if (!this.dragMoved) {
          const dist = Math.hypot(point.x - this.dragStartPoint.x, point.y - this.dragStartPoint.y);
          if (dist < 10) {
            return;
          }
          this.dragMoved = true;
          // 세부 타일의 개별 분리는 집중 모드에서만 허용
          if (this.focusedKeywordId && !this.dragNode.isDetached && (this.dragNode.role === 'sub' || this.dragNode.role === 'clue')) {
            this.dragNode.isDetached = true;
            this.detachedNodes.set(this.dragNode.id, this.dragNode);
          }
          if (!this.svg.hasPointerCapture(event.pointerId)) {
            this.svg.setPointerCapture(event.pointerId);
          }
        }
        const newX = point.x + (this.dragOffset?.x || 0);
        const newY = point.y + (this.dragOffset?.y || 0);
        this.dragNode.x = newX;
        this.dragNode.y = newY;
        const currentAxial = this.pixelToAxial(newX, newY);
        this.dragNode.q = currentAxial.q;
        this.dragNode.r = currentAxial.r;
        this._evaluateAdjacencies();
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

        if (this.svg.hasPointerCapture(event.pointerId)) {
          this.svg.releasePointerCapture(event.pointerId);
        }

        if (wasDragged) {
          const target = this.pixelToAxial(dragged.x, dragged.y);
          const parentId = dragged.parentEntry?.id || dragged.parentId || dragged.clueId;
          const parent = this.clues.find((c) => c.id === parentId);

          if (dragged.role === 'keyword') {
            // 주제 타일 드래그: 가장 가까운 빈 육각 슬롯에 스냅
            const free = this._findFreeHexNear(target.q, target.r, dragged.id);
            dragged.q = free.q;
            dragged.r = free.r;
            this.positions.set(dragged.id, { q: dragged.q, r: dragged.r });
            const snappedPos = this.axialToPixel(dragged.q, dragged.r);
            dragged.x = snappedPos.x;
            dragged.y = snappedPos.y;
          } else {
            // 집중 모드 내 세부 타일 드래그:
            // 1. 부모 주제 타일 위로 직접 드롭했을 경우: 다시 궤도로 도킹(접히도록 복귀)
            if (parent && this._hexDistance(target, parent) === 0) {
              this.detachedNodes.delete(dragged.id);
              this.positions.delete(dragged.id);
              dragged.isDetached = false;
              delete dragged.q;
              delete dragged.r;
            } else {
              // 2. 다른 타일에 인접한 칸인지 검사
              const activeBoardTiles = [];
              const activeTopics = this.focusedKeywordId
                ? this.clues.filter((c) => c.id === this.focusedKeywordId && c.id !== dragged.id)
                : this.clues.filter((c) => c.id !== dragged.id);
              activeBoardTiles.push(...activeTopics);

              this.detachedNodes.forEach((node) => {
                if (node.id === dragged.id) return;
                if (node.q === undefined || node.r === undefined) return;
                if (this.focusedKeywordId) {
                  const pId = node.parentEntry?.id || node.parentId || node.clueId;
                  if (pId !== this.focusedKeywordId && !node.id.startsWith(this.focusedKeywordId)) return;
                }
                activeBoardTiles.push(node);
              });

              if (this.expandedId && (!this.focusedKeywordId || this.focusedKeywordId === this.expandedId)) {
                const expParent = this.clues.find((c) => c.id === this.expandedId);
                if (expParent && expParent.id !== dragged.id) {
                  const nonDetachedClues = (expParent.subClues || []).filter((c) => !this.detachedNodes.has(c.id) && c.id !== dragged.id);
                  const nonDetachedItems = (expParent.subItems || []).filter((i) => !this.detachedNodes.has(i.id) && i.id !== dragged.id);
                  [...nonDetachedClues, ...nonDetachedItems].forEach((item) => {
                    if (item.q !== undefined && item.r !== undefined) {
                      activeBoardTiles.push(item);
                    }
                  });
                }
              }

              let snapTarget = null;
              // 2-1. 다른 타일 위에 올려놓은 경우 -> 그 타일의 빈 인접 6방향 중 드롭 위치와 가장 가까운 슬롯으로 스냅
              const dropOnTile = activeBoardTiles.find((t) => this._hexDistance(target, t) === 0);
              if (dropOnTile) {
                const freeNeighbors = [];
                HEX_DIRS.forEach((dir) => {
                  const nq = dropOnTile.q + dir.dq;
                  const nr = dropOnTile.r + dir.dr;
                  const occupied = activeBoardTiles.some((t) => t.q === nq && t.r === nr);
                  if (!occupied) {
                    const npos = this.axialToPixel(nq, nr);
                    const dist = Math.hypot(npos.x - dragged.x, npos.y - dragged.y);
                    freeNeighbors.push({ q: nq, r: nr, dist });
                  }
                });
                if (freeNeighbors.length > 0) {
                  freeNeighbors.sort((a, b) => a.dist - b.dist);
                  snapTarget = { q: freeNeighbors[0].q, r: freeNeighbors[0].r };
                }
              } else {
                // 2-2. 다른 타일과 인접한 빈 칸(거리 1)에 드롭했는지 확인
                const adjacentTile = activeBoardTiles.find((t) => this._hexDistance(target, t) === 1);
                if (adjacentTile) {
                  const occupied = activeBoardTiles.some((t) => t.q === target.q && t.r === target.r);
                  if (!occupied) {
                    snapTarget = target;
                  } else {
                    snapTarget = this._findFreeHexNear(target.q, target.r, dragged.id);
                  }
                }
              }

              if (snapTarget) {
                // 유효한 인접 칸에 스냅 성공
                dragged.q = snapTarget.q;
                dragged.r = snapTarget.r;
                this.positions.set(dragged.id, { q: dragged.q, r: dragged.r });
                const snappedPos = this.axialToPixel(dragged.q, dragged.r);
                dragged.x = snappedPos.x;
                dragged.y = snappedPos.y;

                if (!dragged.isDetached && (dragged.role === 'sub' || dragged.role === 'clue')) {
                  dragged.isDetached = true;
                  this.detachedNodes.set(dragged.id, dragged);
                }
              } else {
                // 유효한 인접 육각 칸이 아님 (허공에 떨어뜨림) -> 원래 자리로 복귀!
                if (this.dragOrigin) {
                  if (!this.dragOrigin.isDetached) {
                    this.detachedNodes.delete(dragged.id);
                    this.positions.delete(dragged.id);
                    dragged.isDetached = false;
                    delete dragged.q;
                    delete dragged.r;
                  } else {
                    dragged.q = this.dragOrigin.q;
                    dragged.r = this.dragOrigin.r;
                    dragged.x = this.dragOrigin.x;
                    dragged.y = this.dragOrigin.y;
                    dragged.isDetached = true;
                    this.positions.set(dragged.id, { q: dragged.q, r: dragged.r });
                    this.detachedNodes.set(dragged.id, dragged);
                  }
                }
              }
            }
          }

          this._evaluateAdjacencies();

          // 조합 레시피 검사
          if (dragged.q !== undefined && dragged.r !== undefined) {
            const partner = this.findCombinePartnerAt(dragged, { q: dragged.q, r: dragged.r });
            if (partner) {
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
        }

        this.dragNode = null;
        this.dragPointerId = null;
        this.dragStartPoint = null;
        this.dragOffset = null;
        this.dragOrigin = null;
        if (wasDragged) {
          setTimeout(() => { this.dragMoved = false; }, 20);
          this.render();
        } else {
          this.dragMoved = false;
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

  _evaluateAdjacencies() {
    this.validationLinks = [];

    // Collect all active nodes
    const allBoardNodes = [...this.clues];
    this.detachedNodes.forEach((node) => {
      if (!allBoardNodes.some((n) => n.id === node.id)) {
        allBoardNodes.push(node);
      }
    });

    if (this.expandedId) {
      const parent = this.clues.find((c) => c.id === this.expandedId);
      if (parent) {
        const nonDetachedClues = (parent.subClues || []).filter(c => !this.detachedNodes.has(c.id));
        const nonDetachedItems = (parent.subItems || []).filter(i => !this.detachedNodes.has(i.id));
        [...nonDetachedClues, ...nonDetachedItems].forEach((item) => {
          if (!allBoardNodes.some((n) => n.id === item.id)) {
            allBoardNodes.push(item);
          }
        });
      }
    }

    const subTiles = allBoardNodes.filter((n) => n.role === 'sub');
    const clueConditions = allBoardNodes.filter((n) => n.role === 'clue');

    subTiles.forEach((sub) => {
      sub.validationState = 'none';
      if (sub.q === undefined || sub.r === undefined) return;

      const adjacentClues = clueConditions.filter((clue) => {
        if (clue.q === undefined || clue.r === undefined) return false;
        return this._hexDistance(sub, clue) === 1;
      });

      if (!adjacentClues.length) return;

      let hasInvalid = false;
      let hasValid = false;
      const matchedClues = [];

      adjacentClues.forEach((clue) => {
        const validList = clue.validTargets || [];
        const invalidList = clue.invalidTargets || [];

        const isMatch = this._isTargetMatch(validList, sub.label, sub.id);
        const isMismatch = this._isTargetMatch(invalidList, sub.label, sub.id);

        if (isMismatch) {
          hasInvalid = true;
          this.validationLinks.push({ from: clue, to: sub, type: 'invalid' });
        } else if (isMatch) {
          hasValid = true;
          matchedClues.push(clue);
          this.validationLinks.push({ from: clue, to: sub, type: 'valid' });
        } else if (validList.length > 0) {
          hasInvalid = true;
          this.validationLinks.push({ from: clue, to: sub, type: 'invalid' });
        }
      });

      if (hasInvalid) {
        sub.validationState = 'invalid';
      } else if (hasValid) {
        sub.validationState = 'valid';
        if (matchedClues.length >= 2 && !sub.solvedReported) {
          sub.solvedReported = true;
          this.onPuzzleSolved?.(sub, matchedClues);
        }
      }
    });
  }

  _drawValidationLinks() {
    if (!this.focusedKeywordId) return;
    this.validationLinks.forEach((link) => {
      if (!link.from || !link.to || link.from.x === undefined || link.to.x === undefined) return;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(link.from.x));
      line.setAttribute('y1', String(link.from.y));
      line.setAttribute('x2', String(link.to.x));
      line.setAttribute('y2', String(link.to.y));
      line.setAttribute('class', `memo-val-line is-${link.type}`);
      this.layer.appendChild(line);
    });
  }

  _updateGuideBar() {
    const guideBar = document.getElementById('memo-deduction-guide-bar') || document.querySelector('.memo-deduction-guide-bar');
    if (!guideBar) return;

    if (this.focusedKeywordId) {
      guideBar.classList.add('is-focus-mode');
      guideBar.classList.remove('is-normal-mode');
      guideBar.innerHTML = `<span>💡 흰색 키워드 타일을 드래그해 진회색 단서 타일에 붙이면 조건 일치 시 <strong style="color:#2980b9;">파란색(참)</strong>, 모순 시 <strong style="color:#c0392b;">빨간색(거짓)</strong>으로 실시간 판정됩니다.</span>`;
    } else {
      guideBar.classList.add('is-normal-mode');
      guideBar.classList.remove('is-focus-mode');
      guideBar.innerHTML = `<span class="guide-text-normal">타일 클릭: 세부 타일 펼치기 / 타일 더블 클릭: 추론 모드 들어가기</span>`;
    }
  }

  render() {
    this.layer.replaceChildren();
    this.setTransform();
    this._updateGuideBar();

    const partnerHighlight = this.dragNode ? this.findCombinePartner(this.dragNode) : null;
    this._drawEmptySlots();
    this._drawValidationLinks();

    if (this.focusedKeywordId) {
      // ===== [집중 모드(Focus Mode)] =====
      // 1. 해당 주제의 떼어내진(Detached) 독립 타일들 그리기 (자유 배치 상태)
      this.detachedNodes.forEach((node) => {
        const parentId = node.parentEntry?.id || node.parentId || node.clueId;
        if (parentId !== this.focusedKeywordId && !node.id.startsWith(this.focusedKeywordId)) return;

        if (node.q !== undefined && node.r !== undefined && this.dragNode?.id !== node.id) {
          const pos = this.axialToPixel(node.q, node.r);
          node.x = pos.x;
          node.y = pos.y;
        }
        this._drawHex(node, false, false);
      });

      // 2. 아직 떼어내지 않은 하위 단서 및 세부 타일을 부모 주변 빈 궤도 슬롯에 배치
      const parent = this.clues.find((c) => c.id === this.focusedKeywordId);
      if (parent) {
        const nonDetachedClues = (parent.subClues || []).filter((c) => !this.detachedNodes.has(c.id));
        const nonDetachedItems = (parent.subItems || []).filter((i) => !this.detachedNodes.has(i.id));
        const allOrbit = [...nonDetachedClues, ...nonDetachedItems];

        // 떼어내진 노드들이 차지하고 있는 슬롯 피하기
        const occupiedSlots = new Set();
        this.detachedNodes.forEach((n) => {
          if (n.q !== undefined && n.r !== undefined) {
            occupiedSlots.add(`${n.q},${n.r}`);
          }
        });

        let dirIdx = 0;
        allOrbit.forEach((item) => {
          if (this.dragNode?.id === item.id) return;
          while (dirIdx < HEX_DIRS.length) {
            const dir = HEX_DIRS[dirIdx++];
            const slotKey = `${parent.q + dir.dq},${parent.r + dir.dr}`;
            if (!occupiedSlots.has(slotKey)) {
              item.q = parent.q + dir.dq;
              item.r = parent.r + dir.dr;
              const dirPx = this.axialToPixel(dir.dq, dir.dr);
              item.x = parent.x + dirPx.x;
              item.y = parent.y + dirPx.y;
              this._drawHex({
                ...item,
                parentEntry: parent.entry || parent
              }, false, false);
              break;
            }
          }
        });
      }

      // 3. 집중 대상인 주제 타일 그리기
      if (parent) {
        const isCombineReady = partnerHighlight?.id === parent.id;
        this._drawHex(parent, true, isCombineReady);
      }

      // 4. 집중 보기 배지는 타일 상단 간격 왜곡 방지를 위해 상단 가이드 바로 대체 (위로 뜨지 않음)

    } else {
      // ===== [일반 모드(전체 탭, 주제 탭 등)] =====
      // 세부 타일들은 주제 타일에 온전히 귀속되어 따라다님.
      // 독립 분리 타일은 표시하지 않으며, 클릭으로 열린(expandedId) 주제의 궤도에만 표시됨 (누르면 나오고, 접으면 들어감).

      // 1. 펼쳐진 주제가 있다면 그 주변 궤도에 세부 타일들 표시 (부모 드래그 시 고정 상대 픽셀 오프셋으로 매끄럽게 추적)
      if (this.expandedId) {
        const parent = this.clues.find((c) => c.id === this.expandedId);
        if (parent) {
          const allSubs = [...(parent.subClues || []), ...(parent.subItems || [])];
          allSubs.slice(0, 6).forEach((item, index) => {
            const dir = HEX_DIRS[index];
            item.q = parent.q + dir.dq;
            item.r = parent.r + dir.dr;
            const dirPx = this.axialToPixel(dir.dq, dir.dr);
            item.x = parent.x + dirPx.x;
            item.y = parent.y + dirPx.y;
            this._drawHex({
              ...item,
              parentEntry: parent.entry || parent
            }, false, false);
          });
        }
      }

      // 2. 모든 활성 주제 타일들 그리기
      this.clues.forEach((clue) => {
        const isCombineReady = partnerHighlight?.id === clue.id;
        this._drawHex(clue, true, isCombineReady);
      });
    }
  }

  _drawFocusBadge(node) {
    // 상단 가이드 바가 집중 모드/추론 모드 설명을 표시하므로 보드 내 팝업은 띄우지 않음
  }

  _drawHex(node, isMain, isCombineReady) {
    const group = document.createElementNS(SVG_NS, 'g');
    const role = node.role || (isMain ? 'keyword' : 'sub');
    const isMid = role === 'clue' || role === 'condition';
    const classes = ['memo-node'];

    if (role === 'keyword' || (isMain && !isMid)) {
      classes.push('is-main');
    } else if (isMid) {
      classes.push('is-mid');
    } else {
      classes.push('is-sub');
    }

    if (node.validationState === 'valid') classes.push('is-valid');
    if (node.validationState === 'invalid') classes.push('is-invalid');
    if (node.id === this.selectedId) classes.push('is-selected');
    if (node.isHypothesis) classes.push('is-hypothesis');
    if (isCombineReady) classes.push('is-combine-ready');
    group.setAttribute('class', classes.join(' '));
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', [node.label, node.sub].filter(Boolean).join(', '));

    const radius = (role === 'keyword' || (isMain && !isMid))
      ? this.R
      : (isMid ? this.SUB_R + 2 : this.SUB_R);

    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('class', 'memo-hex');
    polygon.setAttribute('points', this.hexPoints(node.x, node.y, radius));
    group.appendChild(polygon);

    if (node.isNew) {
      const indicator = document.createElementNS(SVG_NS, 'circle');
      indicator.setAttribute('class', 'memo-new-indicator');
      indicator.setAttribute('cx', (node.x + radius * 0.5).toFixed(1));
      indicator.setAttribute('cy', (node.y - radius * 0.866).toFixed(1));
      indicator.setAttribute('r', '5');
      group.appendChild(indicator);
    }

    const labelLines = wrapLabel(node.label, (role === 'keyword' || (isMain && !isMid)) ? 6 : 5);
    const labelY = labelLines.length > 1 ? node.y - 7 : node.y - 2;
    appendSvgText(group, 'memo-label', node.x, labelY, labelLines, 10);

    const subText = node.sub || (role === 'keyword' || (isMain && !isMid) ? '주제' : (isMid ? '단서' : '세부 타일'));
    const sub = document.createElementNS(SVG_NS, 'text');
    sub.setAttribute('class', 'memo-sub');
    sub.setAttribute('x', node.x);
    sub.setAttribute('y', node.y + 20);
    sub.setAttribute('text-anchor', 'middle');
    sub.textContent = subText;
    group.appendChild(sub);

    // 더블클릭 이벤트: 대분류(주제) 더블클릭 시 해당 주제 및 관련 단서/세부 타일만 집중 보기(Focus Mode) 토글
    group.addEventListener('dblclick', (event) => {
      if (role !== 'keyword' && !isMain) return;
      event.stopPropagation();
      event.preventDefault();

      if (this.focusedKeywordId === node.id) {
        this.focusedKeywordId = null;
        this._clearFocusBadge();
      } else {
        this.focusedKeywordId = node.id;
        this.expandedId = node.id;
        this.pinnedId = node.id;
        this._triggerFocusBadge();
        this._makeRoomForSubclues(node);
        const pos = this.axialToPixel(node.q, node.r);
        this.panX = -pos.x * this.scale;
        this.panY = -pos.y * this.scale;
      }
      this.render();
    });

    group.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      event.stopPropagation();

      let targetNode = node;
      // 일반 모드에서는 세부 타일이 단독으로 움직이지 않고 부모 주제 타일을 따라 움직임
      if (!this.focusedKeywordId && role !== 'keyword' && !isMain) {
        const parentId = node.parentEntry?.id || node.parentId || node.clueId;
        const parent = this.clues.find((c) => c.id === parentId);
        if (parent) {
          targetNode = parent;
        }
      }

      this.dragNode = targetNode;
      this.dragMoved = false;
      this.dragPointerId = event.pointerId;
      const point = this.screenToSVG(event.clientX, event.clientY);
      this.dragStartPoint = { x: point.x, y: point.y };
      this.dragOffset = { x: targetNode.x - point.x, y: targetNode.y - point.y };
      this.dragOrigin = {
        q: targetNode.q,
        r: targetNode.r,
        x: targetNode.x,
        y: targetNode.y,
        isDetached: Boolean(targetNode.isDetached)
      };
    });

    const selectNode = () => {
      if (this.dragMoved) return;
      this.selectedId = node.id;
      if (node.isNew) {
        this.readNewIds.add(node.id);
        node.isNew = false;
        if (node.entry?.id) this.readNewIds.add(node.entry.id);
        if (node.parentEntry?.id) this.readNewIds.add(node.parentEntry.id);
        if (node.id.startsWith('memo_index_')) {
          (node.subItems || []).forEach((si) => {
            if (si.entry?.id) this.readNewIds.add(si.entry.id);
            this.readNewIds.add(si.id);
          });
        }
        const ind = group.querySelector('.memo-new-indicator');
        if (ind) ind.remove();
      }

      // 클릭 시에만 펼침/접힘 토글 (들어갔다 나왔다)
      if (role === 'keyword' && (node.subItems?.length || node.subClues?.length)) {
        if (this.focusedKeywordId === node.id) {
          // 집중 모드로 들어갔을 때는 주제를 탭(클릭)해도 타일이 들어가지 않고 펼쳐진 상태 유지
          this.expandedId = node.id;
          this.pinnedId = node.id;
        } else if (this.expandedId === node.id) {
          // 이미 펼쳐져 있으면 접기
          this.expandedId = null;
          this.pinnedId = null;
        } else {
          // 닫혀 있으면 펼치기
          this.expandedId = node.id;
          this.pinnedId = node.id;
          this._makeRoomForSubclues(node);
        }
      }
      const selectedNode = (role === 'keyword')
        ? (node.entry ? node : { ...node, entry: node })
        : (isMid
            ? { ...node, isMidClue: true, entry: node.entry || node }
            : {
                ...node,
                isSubItem: true,
                parentEntry: node.parentEntry || this.clues.find((c) => c.id === this.expandedId)?.entry
              });
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
