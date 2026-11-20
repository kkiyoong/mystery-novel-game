import { state } from './state.js?v=20261121_0840';
import { CODEX_DATA } from './data/codexData.js?v=20261121_0840';

const SVG_NS = 'http://www.w3.org/2000/svg';

// 육각형 격자 6방향 이웃 오프셋 (우, 우상, 좌상, 좌, 좌하, 우하)
const HEX_DIRS = [
  { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
  { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 }
];

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

/**
 * 특정 육각 중심 (q0, r0)을 기준으로 반경(radius)에 위치한 육각 링 둘레 좌표들을 시계방향으로 생성
 */
export function getHexRingSlotsAround(q0, r0, radius) {
  if (radius <= 0) return [{ q: q0, r: r0 }];
  const results = [];
  for (let i = 0; i < 6; i++) {
    let curQ = q0 + HEX_DIRS[i].dq * radius;
    let curR = r0 + HEX_DIRS[i].dr * radius;
    const walkDir = HEX_DIRS[(i + 2) % 6];
    for (let step = 0; step < radius; step++) {
      results.push({ q: curQ, r: curR });
      curQ += walkDir.dq;
      curR += walkDir.dr;
    }
  }
  return results;
}

/**
 * 특정 육각 중심 (q0, r0) 주위로 반경 1, 2, 3... 순서로 뻗어나가는 벌집형 나선 슬롯 생성
 * 1차 링: 6개 (중심과 맞닿음)
 * 2차 링: 12개 (1차 링과 맞닿음)
 * 3차 링: 18개 (2차 링과 맞닿음)
 */
export function getHexSpiralSlotsAround(q0, r0, count, maxRadius = 6) {
  if (count <= 0) return [];
  const results = [];
  for (let rad = 1; rad <= maxRadius; rad++) {
    const ring = getHexRingSlotsAround(q0, r0, rad);
    results.push(...ring);
    if (results.length >= count) {
      return results.slice(0, count);
    }
  }
  return results;
}

// 주요 단서 기본 배치용 간격 넓은 육각 좌표 (서로 겹치지 않는 벌집 간격)
const ANCHOR_SLOTS = [
  { q: 0, r: 0 }, { q: 3, r: -1 }, { q: -3, r: 1 },
  { q: 1, r: 2 }, { q: -1, r: -2 }, { q: 4, r: -3 },
  { q: -4, r: 3 }, { q: -2, r: 3 }, { q: 2, r: -3 }
];

// 주요 단서 육각형 정렬용 균등 벌집 좌표 슬롯
function getHexSpiralSlots(count) {
  if (count <= 0) return [];
  if (count === 1) return [{ q: 0, r: 0 }];
  if (count === 2) return [{ q: -1, r: 0 }, { q: 1, r: 0 }];
  if (count === 3) return [{ q: 0, r: -1 }, { q: 1, r: 1 }, { q: -1, r: 1 }];

  // 1차 육각 링 (반경 2의 정육각형 6꼭짓점: 서로 및 중심과의 간격이 2로 균등)
  const ring1 = [
    { q: 0, r: 0 },
    { q: 2, r: 0 },
    { q: 0, r: 2 },
    { q: -2, r: 2 },
    { q: -2, r: 0 },
    { q: 0, r: -2 },
    { q: 2, r: -2 }
  ];
  if (count <= 7) return ring1.slice(0, count);

  // 1차 육각 링 중간점 6개
  const ring1Mid = [
    { q: 1, r: 1 },
    { q: -1, r: 2 },
    { q: -2, r: 1 },
    { q: -1, r: -1 },
    { q: 1, r: -2 },
    { q: 2, r: -1 }
  ];
  const combined = [...ring1, ...ring1Mid];
  if (count <= combined.length) return combined.slice(0, count);

  // 2차 육각 링 (반경 4의 정육각형)
  const ring2 = [
    { q: 4, r: 0 }, { q: 0, r: 4 }, { q: -4, r: 4 },
    { q: -4, r: 0 }, { q: 0, r: -4 }, { q: 4, r: -4 },
    { q: 2, r: 2 }, { q: -2, r: 4 }, { q: -4, r: 2 },
    { q: -2, r: -2 }, { q: 2, r: -4 }, { q: 4, r: -2 }
  ];
  return [...combined, ...ring2].slice(0, count);
}

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
    this.arrangeMode = 'linear';
    this.clues = [];
    this.hypotheses = [];
    this.detachedNodes = new Map();
    this.validationLinks = [];
    this.readNewIds = new Set();
    this.positions = new Map();
    this.deductionPositions = new Map();
    this.normalParentBackup = new Map();
    this.recipes = recipes;
    this.focusedKeywordId = null; // 대분류 더블클릭 시 해당 주제만 집중 보기
    this.showFocusBadge = false;  // 집중 보기 알림 배지 (3초간 표시)
    this.focusBadgeTimer = null;
    this.eliminatedTileIds = new Set(); // 후보 탈락 칸에 보관된 타일 ID 목록
    this.solvedPuzzleKeys = new Set();

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

  canEnterDeductionMode(clue) {
    if (!clue || clue.isCategoryIndex) return false;
    const entry = clue.entry || clue;
    const hasSubClues = (Array.isArray(clue.subClues) && clue.subClues.length > 0) ||
                        (Array.isArray(entry.subClues) && entry.subClues.length > 0);
    const hasAnswers = (Array.isArray(clue.answers) && clue.answers.length > 0) ||
                       (Array.isArray(entry.answers) && entry.answers.length > 0);
    const hasConditionRecords = (clue.subItems || entry.subItems || []).some(
      (si) => Array.isArray(si?.records) && si.records.some((r) => Boolean(r?.targetClueId))
    );
    return Boolean(hasSubClues || hasAnswers || hasConditionRecords);
  }

  resetBoardState() {
    this.expandedId = null;
    this.pinnedId = null;
    this.selectedId = null;
    this.focusedKeywordId = null;
    this._clearFocusBadge();
    this.detachedNodes.clear();
    this.positions.clear();
    this.deductionPositions.clear();
    this.normalParentBackup.clear();
    this.eliminatedTileIds.clear();
    this.solvedPuzzleKeys.clear();
    this.readNewIds.clear();
    this.hypotheses = [];
    this.validationLinks = [];
    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    const tray = document.getElementById('memo-eliminated-tray');
    if (tray) tray.classList.add('hidden');
  }

  enterFocusMode(topicId) {
    if (!topicId) return;
    let targetClue = this.clues.find(c => c.id === topicId || c.entry?.id === topicId);
    if (!targetClue) {
      const codexSource = (typeof CODEX_DATA !== 'undefined' ? CODEX_DATA : window.CODEX_DATA) || [];
      const entry = codexSource.find(e => e.id === topicId || e.title === topicId);
      if (entry) {
        state.unlockCodex(entry.id);
        if (window.app?.renderCodexList) window.app.renderCodexList();
        targetClue = this.clues.find(c => c.id === entry.id || c.entry?.id === entry.id);
      }
    }

    if (!targetClue || !this.canEnterDeductionMode(targetClue)) return;

    // 일반 모드에서의 주제 타일 원래 좌표 및 화면 상태를 백업 (추론 모드 종료 시 일반 모드 배치로 깔끔하게 복구하기 위함)
    if (!this.focusedKeywordId && Number.isFinite(targetClue.q) && Number.isFinite(targetClue.r)) {
      this.normalParentBackup.set(targetClue.id, {
        q: targetClue.q,
        r: targetClue.r
      });
    }

    this.focusedKeywordId = targetClue.id;
    this.expandedId = targetClue.id;
    this.pinnedId = targetClue.id;
    this._triggerFocusBadge();

    // 1. Position parent at top center: (0, -2) -> (x: 0, y: -145.5)
    const savedParentDed = this.deductionPositions.get(targetClue.id);
    targetClue.q = savedParentDed?.q ?? 0;
    targetClue.r = savedParentDed?.r ?? -2;
    this.positions.set(targetClue.id, { q: targetClue.q, r: targetClue.r });
    const pPos = this.axialToPixel(targetClue.q, targetClue.r);
    targetClue.x = pPos.x;
    targetClue.y = pPos.y;

    // 2. Position conditions (subClues) in a neat horizontal row at y = -36.4
    const subClues = targetClue.subClues || [];
    const count = subClues.length;
    subClues.forEach((sc, idx) => {
      const savedSc = this.deductionPositions.get(sc.id);
      if (savedSc && Number.isFinite(savedSc.q) && Number.isFinite(savedSc.r)) {
        sc.q = savedSc.q;
        sc.r = savedSc.r;
      } else {
        const targetX = (idx - (count - 1) / 2) * 126;
        const targetY = -36.4;
        const hex = this.pixelToAxial(targetX, targetY);
        sc.q = hex.q;
        sc.r = hex.r;
      }
      sc.isDetached = true;
      this.detachedNodes.set(sc.id, sc);
      this.positions.set(sc.id, { q: sc.q, r: sc.r });
      this.deductionPositions.set(sc.id, { q: sc.q, r: sc.r });
      const pos = this.axialToPixel(sc.q, sc.r);
      sc.x = pos.x;
      sc.y = pos.y;
    });

    // 3. One-hex gap row is at y = 0 (empty honeycomb slots for testing)

    // 4. Candidate detail tiles (subItems) placed directly on the board canvas below gap
    const candidateSlots = [
      { q: -4, r: 3 }, { q: -2, r: 2 }, { q: 0, r: 1 }, { q: 2, r: 0 },
      { q: -3, r: 3 }, { q: -1, r: 2 }, { q: 1, r: 1 }, { q: 3, r: 0 }
    ];
    let slotIdx = 0;
    (targetClue.subItems || []).forEach((item) => {
      if (this.eliminatedTileIds.has(item.id)) {
        this.detachedNodes.delete(item.id);
        delete item.q;
        delete item.r;
        return;
      }
      const savedItem = this.deductionPositions.get(item.id);
      if (savedItem && Number.isFinite(savedItem.q) && Number.isFinite(savedItem.r)) {
        item.q = savedItem.q;
        item.r = savedItem.r;
      } else {
        const slot = candidateSlots[slotIdx++] || this._findFreeHexNear(0, 2, item.id);
        item.q = slot.q;
        item.r = slot.r;
      }
      item.isDetached = true;
      this.detachedNodes.set(item.id, item);
      this.positions.set(item.id, { q: item.q, r: item.r });
      this.deductionPositions.set(item.id, { q: item.q, r: item.r });
      const pos = this.axialToPixel(item.q, item.r);
      item.x = pos.x;
      item.y = pos.y;
    });

    this.panX = 0;
    this.panY = 0;
    this.scale = 0.90;
    this._evaluateAdjacencies();
    this.render();
  }

  exitFocusMode() {
    const prevFocusId = this.focusedKeywordId;
    this.focusedKeywordId = null;
    this._clearFocusBadge();
    const tray = document.getElementById('memo-eliminated-tray');
    if (tray) tray.classList.add('hidden');

    if (prevFocusId) {
      const parent = this.clues.find((c) => c.id === prevFocusId);
      if (parent) {
        // 1. 현재 추론 모드에서의 배치를 deductionPositions에 저장 (다음에 추론 모드로 다시 들어갈 때 유지)
        if (Number.isFinite(parent.q) && Number.isFinite(parent.r)) {
          this.deductionPositions.set(parent.id, { q: parent.q, r: parent.r });
        }
        (parent.subClues || []).forEach((sc) => {
          if (Number.isFinite(sc.q) && Number.isFinite(sc.r)) {
            this.deductionPositions.set(sc.id, { q: sc.q, r: sc.r });
          }
          // 일반 모드에서는 중분류 조건 타일 및 추론 모드 분리 좌표가 남지 않도록 초기화
          sc.isDetached = false;
          delete sc.q;
          delete sc.r;
          this.detachedNodes.delete(sc.id);
          this.positions.delete(sc.id);
        });
        (parent.subItems || []).forEach((item) => {
          if (!this.eliminatedTileIds.has(item.id) && Number.isFinite(item.q) && Number.isFinite(item.r)) {
            this.deductionPositions.set(item.id, { q: item.q, r: item.r });
          }
          // 일반 모드(전체 탭 등)에서 주제 타일을 클릭했을 때 추론 모드 위치가 아닌 주제 타일 바로 주변에 정상적으로 펼쳐지도록 초기화
          item.isDetached = false;
          item.validationState = 'none';
          delete item.q;
          delete item.r;
          this.detachedNodes.delete(item.id);
          this.positions.delete(item.id);
        });

        // 2. 주제 타일의 일반 모드 위치 복구
        const backup = this.normalParentBackup.get(parent.id);
        if (backup && Number.isFinite(backup.q) && Number.isFinite(backup.r)) {
          parent.q = backup.q;
          parent.r = backup.r;
          this.positions.set(parent.id, { q: parent.q, r: parent.r });
          const pos = this.axialToPixel(parent.q, parent.r);
          parent.x = pos.x;
          parent.y = pos.y;
        }
      }
      // 추론 모드에서 나올 때는 접힌 기본 상태로 돌아가서, 유저가 클릭했을 때 깔끔하게 주변에 펼쳐지게 함
      this.expandedId = null;
      this.pinnedId = null;
    }

    this._evaluateAdjacencies();
    if (this._hasOverlap()) {
      this.arrangeClues({ collapse: false });
    } else {
      this.centerClues();
    }
  }

  eliminateTile(node) {
    if (!node || !this.focusedKeywordId) return;
    this.eliminatedTileIds.add(node.id);
    this.detachedNodes.delete(node.id);
    this.positions.delete(node.id);
    this.deductionPositions.delete(node.id);
    delete node.q;
    delete node.r;
    node.isDetached = false;
    this._evaluateAdjacencies();
    this.render();
  }

  restoreTile(tileId) {
    if (!tileId || !this.focusedKeywordId) return;
    this.eliminatedTileIds.delete(tileId);
    const parent = this.clues.find(c => c.id === this.focusedKeywordId);
    if (!parent) return;
    const item = (parent.subItems || []).find(i => i.id === tileId);
    if (!item) return;

    const candidateSlots = [
      { q: -4, r: 3 }, { q: -2, r: 2 }, { q: 0, r: 1 }, { q: 2, r: 0 },
      { q: -3, r: 3 }, { q: -1, r: 2 }, { q: 1, r: 1 }, { q: 3, r: 0 }
    ];
    const occupied = new Set([
      `${parent.q},${parent.r}`,
      ...Array.from(this.detachedNodes.values()).map(n => `${n.q},${n.r}`)
    ]);
    let targetSlot = candidateSlots.find(s => !occupied.has(`${s.q},${s.r}`));
    if (!targetSlot) {
      targetSlot = this._findFreeHexNear(0, 2, item.id);
    }

    item.q = targetSlot.q;
    item.r = targetSlot.r;
    item.isDetached = true;
    this.detachedNodes.set(item.id, item);
    this.positions.set(item.id, { q: item.q, r: item.r });
    this.deductionPositions.set(item.id, { q: item.q, r: item.r });
    const pos = this.axialToPixel(item.q, item.r);
    item.x = pos.x;
    item.y = pos.y;

    this._evaluateAdjacencies();
    this.render();
  }

  _renderEliminatedTray() {
    const tray = document.getElementById('memo-eliminated-tray');
    const chipsContainer = document.getElementById('memo-eliminated-chips');
    if (!tray || !chipsContainer) return;

    if (!this.focusedKeywordId) {
      tray.classList.add('hidden');
      return;
    }

    tray.classList.remove('hidden');
    chipsContainer.innerHTML = '';

    const parent = this.clues.find(c => c.id === this.focusedKeywordId);
    if (!parent) return;

    const eliminatedItems = (parent.subItems || []).filter(item => this.eliminatedTileIds.has(item.id));
    if (eliminatedItems.length === 0) {
      chipsContainer.innerHTML = '<span class="eliminated-empty-msg">탈락시킨 타일이 없습니다. 조건에 맞지 않는 타일은 이 칸으로 옮겨 정리하세요. (타일 더블클릭 또는 아래로 드래그)</span>';
      return;
    }

    eliminatedItems.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'eliminated-chip';
      chip.dataset.itemId = item.id;
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('title', '클릭하면 다시 보드로 복귀합니다');
      chip.innerHTML = `
        <span class="chip-name">❌ ${escapeHtml(item.label)}</span>
        <span class="chip-restore">↩ 복귀</span>
      `;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.restoreTile(item.id);
      });
      chipsContainer.appendChild(chip);
    });
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

  _findFreeHexNear(targetQ, targetR, excludeId, blocked = new Set(), extraTiles = null) {
    const queue = [{ q: targetQ, r: targetR }];
    const visited = new Set();

    const occupiedTiles = [...this.clues, ...Array.from(this.detachedNodes.values())];
    if (Array.isArray(extraTiles)) {
      extraTiles.forEach((t) => {
        if (!occupiedTiles.some((ot) => ot.id === t.id)) occupiedTiles.push(t);
      });
    }

    while (queue.length) {
      const cell = queue.shift();
      const key = `${cell.q},${cell.r}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const occupied = occupiedTiles.some(
        (tile) => tile.id !== excludeId && tile.q === cell.q && tile.r === cell.r
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
          const pos = (isDetached && Number.isFinite(scQ) && Number.isFinite(scR))
            ? this.axialToPixel(scQ, scR)
            : { x: undefined, y: undefined };
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
            x: pos.x,
            y: pos.y,
            isDetached,
            isNew: Boolean(sc.isNew && !this.readNewIds.has(id))
          };
          if (isDetached && Number.isFinite(scQ) && Number.isFinite(scR)) {
            this.detachedNodes.set(id, node);
          } else {
            this.detachedNodes.delete(id);
          }
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
          const pos = (isDetached && Number.isFinite(siQ) && Number.isFinite(siR))
            ? this.axialToPixel(siQ, siR)
            : { x: undefined, y: undefined };
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
            x: pos.x,
            y: pos.y,
            isDetached,
            isNew: Boolean(keyword.isNew && !this.readNewIds.has(id))
          };
          if (isDetached && Number.isFinite(siQ) && Number.isFinite(siR)) {
            this.detachedNodes.set(id, node);
          } else {
            this.detachedNodes.delete(id);
          }
          return node;
        });

        return {
          ...clue,
          role: 'keyword',
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

  // 정렬: 세부 항목을 모두 접고, 주 단서를 직선 또는 육각형 격자 간격에 맞춰 재배열
  arrangeClues({ collapse = true, mode = null } = {}) {
    if (collapse) {
      if (this.focusedKeywordId) {
        this.exitFocusMode();
      }
      this.expandedId = null;
      this.pinnedId = null;
      this.selectedId = null;
      this.focusedKeywordId = null;
      this._clearFocusBadge();
      this.clues.forEach((clue) => {
        (clue.subItems || []).forEach((si) => {
          si.isDetached = false;
          delete si.q;
          delete si.r;
          this.detachedNodes.delete(si.id);
          this.positions.delete(si.id);
        });
        (clue.subClues || []).forEach((sc) => {
          sc.isDetached = false;
          delete sc.q;
          delete sc.r;
          this.detachedNodes.delete(sc.id);
          this.positions.delete(sc.id);
        });
      });
    }

    if (mode) {
      this.arrangeMode = mode;
    } else {
      this.arrangeMode = this.arrangeMode === 'linear' ? 'hex' : 'linear';
    }

    if (this.arrangeMode === 'hex') {
      const slots = getHexSpiralSlots(this.clues.length);
      this.clues.forEach((clue, idx) => {
        const slot = slots[idx] || { q: idx, r: 0 };
        clue.q = slot.q;
        clue.r = slot.r;
        this.positions.set(clue.id, { q: clue.q, r: clue.r });
        const pos = this.axialToPixel(clue.q, clue.r);
        clue.x = pos.x;
        clue.y = pos.y;
      });
      this.panX = 0;
      this.panY = 0;
      this.scale = 1;
    } else {
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
    }

    this.render();
    return { mode: this.arrangeMode };
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
    const allOrbit = parent.subItems || [];
    if (!allOrbit.length) return;

    const reservedSlots = getHexSpiralSlotsAround(parent.q, parent.r, allOrbit.length);
    const reserved = new Set(reservedSlots.map((slot) => `${slot.q},${slot.r}`));

    reservedSlots.forEach((slot) => {
      const occupant = this.clues.find(
        (clue) => clue.id !== parent.id && clue.q === slot.q && clue.r === slot.r
      );
      if (!occupant) return;

      for (let distance = 1; distance <= 4; distance++) {
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
            candidates.push({ q, r, distFromParent: this._hexDistance(q, r, parent.q, parent.r) });
          }
        }
        candidates.sort((a, b) => b.distFromParent - a.distFromParent);
        if (candidates.length) {
          occupant.q = candidates[0].q;
          occupant.r = candidates[0].r;
          this.positions.set(occupant.id, { q: occupant.q, r: occupant.r });
          const pos = this.axialToPixel(occupant.q, occupant.r);
          occupant.x = pos.x;
          occupant.y = pos.y;
          break;
        }
      }
    });
  }

  _drawEmptySlots() {
    const activeClues = this.focusedKeywordId
      ? this.clues.filter((c) => c.id === this.focusedKeywordId)
      : this.clues;

    const occupied = new Set();
    const visibleCells = new Set();

    const addNeighborhood = (q0, r0, radius = 2) => {
      if (!Number.isFinite(q0) || !Number.isFinite(r0)) return;
      for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (this._hexDistance(dq, dr, 0, 0) > radius) continue;
          visibleCells.add(`${q0 + dq},${r0 + dr}`);
        }
      }
    };

    // 기본 보드 중심 주변 격자 확보
    addNeighborhood(0, 0, 3);

    activeClues.forEach((clue) => {
      if (!Number.isFinite(clue.q) || !Number.isFinite(clue.r)) return;
      if (this.dragNode?.id !== clue.id) {
        occupied.add(`${clue.q},${clue.r}`);
      }
      addNeighborhood(clue.q, clue.r, 2);
    });

    if (this.expandedId && !this.focusedKeywordId) {
      const parent = this.clues.find((clue) => clue.id === this.expandedId);
      if (parent) {
        addNeighborhood(parent.q, parent.r, 3);
        const allOrbit = parent.subItems || [];
        const occupiedForSpiral = new Set(
          this.clues.filter((c) => c.id !== parent.id).map((c) => `${c.q},${c.r}`)
        );
        allOrbit.forEach((item) => {
          if (item.isDetached && Number.isFinite(item.q) && Number.isFinite(item.r)) {
            occupiedForSpiral.add(`${item.q},${item.r}`);
            if (this.dragNode?.id !== item.id) {
              occupied.add(`${item.q},${item.r}`);
            }
            addNeighborhood(item.q, item.r, 2);
          }
        });
        const spiralSlots = getHexSpiralSlotsAround(parent.q, parent.r, allOrbit.length + 30);
        let slotIdx = 0;
        allOrbit.forEach((item) => {
          if (item.isDetached && Number.isFinite(item.q) && Number.isFinite(item.r)) return;
          while (slotIdx < spiralSlots.length) {
            const slot = spiralSlots[slotIdx++];
            const slotKey = `${slot.q},${slot.r}`;
            if (!occupiedForSpiral.has(slotKey)) {
              occupiedForSpiral.add(slotKey);
              if (this.dragNode?.id !== item.id) {
                occupied.add(slotKey);
              }
              addNeighborhood(slot.q, slot.r, 2);
              break;
            }
          }
        });
      }
    }

    if (this.focusedKeywordId) {
      this.detachedNodes.forEach((node) => {
        const parentId = node.parentEntry?.id || node.parentId || node.clueId;
        if (parentId !== this.focusedKeywordId && !node.id.startsWith(this.focusedKeywordId)) return;
        if (this.eliminatedTileIds.has(node.id)) return;
        if (Number.isFinite(node.q) && Number.isFinite(node.r)) {
          if (this.dragNode?.id !== node.id) {
            occupied.add(`${node.q},${node.r}`);
          }
          addNeighborhood(node.q, node.r, 2);
        }
      });
    }

    // 드래그 중인 타일이 어느 위치로 이동하든 그 주변으로 벌집 줄이 실시간 확장되도록 반영
    if (this.dragNode && Number.isFinite(this.dragNode.q) && Number.isFinite(this.dragNode.r)) {
      addNeighborhood(this.dragNode.q, this.dragNode.r, 2);
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
    const elimTray = document.getElementById('memo-eliminated-tray');
    if (elimTray) {
      elimTray.addEventListener('dragover', (e) => {
        e.preventDefault();
        elimTray.classList.add('is-drag-over');
        e.dataTransfer.dropEffect = 'move';
      });
      elimTray.addEventListener('dragleave', () => {
        elimTray.classList.remove('is-drag-over');
      });
      elimTray.addEventListener('drop', (e) => {
        e.preventDefault();
        elimTray.classList.remove('is-drag-over');
        const itemId = e.dataTransfer.getData('text/plain');
        if (itemId) {
          const parent = this.clues.find(c => c.id === this.focusedKeywordId);
          const item = (parent?.subItems || []).find(i => i.id === itemId);
          if (item) this.eliminateTile(item);
        }
      });
    }

    this.svg.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (event.target.closest?.('.memo-node')) return;

      // 집중 모드가 아닐 때만 빈 바탕 클릭 시 펼쳐진 세부 항목 접기
      if (!this.focusedKeywordId) {
        if (this.expandedId) {
          const prevParent = this.clues.find((c) => c.id === this.expandedId);
          (prevParent?.subItems || []).forEach((si) => {
            si.isDetached = false;
            delete si.q;
            delete si.r;
            this.detachedNodes.delete(si.id);
            this.positions.delete(si.id);
          });
        }
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
          if (!this.dragNode.isDetached && (this.dragNode.role === 'sub' || this.dragNode.role === 'clue')) {
            this.dragNode.isDetached = true;
            this.detachedNodes.set(this.dragNode.id, this.dragNode);
          }
          if (!this.svg.hasPointerCapture(event.pointerId)) {
            this.svg.setPointerCapture(event.pointerId);
          }
        }

        const trayEl = document.getElementById('memo-eliminated-tray');
        if (trayEl && !trayEl.classList.contains('hidden')) {
          const rect = trayEl.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top - 15) {
            trayEl.classList.add('is-drag-over');
          } else {
            trayEl.classList.remove('is-drag-over');
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
      this.panX = Math.max(-1200, Math.min(1200, point.x - this.panStart.x));
      this.panY = Math.max(-1200, Math.min(1200, point.y - this.panStart.y));
      this.setTransform();
    });

    const endPointer = (event) => {
      const trayEl = document.getElementById('memo-eliminated-tray');
      if (trayEl) trayEl.classList.remove('is-drag-over');

      if (this.dragNode && event.pointerId === this.dragPointerId) {
        const dragged = this.dragNode;
        const wasDragged = this.dragMoved;

        if (this.svg.hasPointerCapture(event.pointerId)) {
          this.svg.releasePointerCapture(event.pointerId);
        }

        if (wasDragged) {
          // 1. Check if dropped over 후보 탈락 칸
          let droppedInTray = false;
          if (trayEl && !trayEl.classList.contains('hidden')) {
            const rect = trayEl.getBoundingClientRect();
            if (
              event.clientX >= rect.left &&
              event.clientX <= rect.right &&
              event.clientY >= rect.top - 15 &&
              event.clientY <= rect.bottom + 35
            ) {
              droppedInTray = true;
            }
          }

          if (droppedInTray && dragged.role === 'sub') {
            this.eliminateTile(dragged);
            this.dragNode = null;
            this.dragPointerId = null;
            this.dragStartPoint = null;
            this.dragOffset = null;
            this.dragOrigin = null;
            this.dragMoved = false;
            return;
          }

          const target = this.pixelToAxial(dragged.x, dragged.y);
          const isMainTopic = this.clues.some((c) => c.id === dragged.id) || dragged.role === 'keyword';

          // 현재 보드 위의 다른 모든 활성 타일 수집 (겹침 방지용)
          const activeBoardTiles = [];
          const activeTopics = this.focusedKeywordId
            ? this.clues.filter((c) => c.id === this.focusedKeywordId && c.id !== dragged.id)
            : this.clues.filter((c) => c.id !== dragged.id);
          activeBoardTiles.push(...activeTopics);

          if (this.focusedKeywordId) {
            this.detachedNodes.forEach((node) => {
              if (!node || node.id === dragged.id || this.eliminatedTileIds.has(node.id)) return;
              if (!Number.isFinite(node.q) || !Number.isFinite(node.r)) return;
              const pId = node.parentEntry?.id || node.parentId || node.clueId;
              if (pId !== this.focusedKeywordId && !node.id.startsWith(this.focusedKeywordId)) return;
              activeBoardTiles.push(node);
            });
          } else if (this.expandedId) {
            const expParent = this.clues.find((c) => c.id === this.expandedId);
            if (expParent) {
              (expParent.subItems || []).forEach((item) => {
                if (item && item.id !== dragged.id && Number.isFinite(item.q) && Number.isFinite(item.r)) {
                  activeBoardTiles.push(item);
                }
              });
            }
          }

          // 일반 모드이든 추론 모드이든 상관없이 사용자가 놓은 모든 육각 칸에 자유롭게 스냅 (절대 원래 자리로 강제 복귀하지 않음)
          let snapTarget = target;
          if (activeBoardTiles.some((t) => t && t.q === target.q && t.r === target.r)) {
            snapTarget = this._findFreeHexNear(target.q, target.r, dragged.id, new Set(), activeBoardTiles);
          }

          dragged.q = snapTarget.q;
          dragged.r = snapTarget.r;
          this.positions.set(dragged.id, { q: dragged.q, r: dragged.r });
          if (this.focusedKeywordId) {
            this.deductionPositions.set(dragged.id, { q: dragged.q, r: dragged.r });
          } else if (isMainTopic) {
            this.normalParentBackup.set(dragged.id, { q: dragged.q, r: dragged.r });
          }
          const snappedPos = this.axialToPixel(dragged.q, dragged.r);
          dragged.x = snappedPos.x;
          dragged.y = snappedPos.y;

          if (!isMainTopic) {
            dragged.isDetached = true;
            this.detachedNodes.set(dragged.id, dragged);
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
        // 기본 궤도에 정적으로 머물러 있을 때는 오평가를 방지하고, 타일을 끌어다 붙였을 때(isDetached) 판정 실행
        if (!sub.isDetached && !clue.isDetached) return false;
        return this._hexDistance(sub, clue) === 1;
      });

      if (!adjacentClues.length) return;

      let hasInvalid = false;
      let hasValid = false;
      let hasUnknown = false;
      const matchedClues = [];

      // Find defined records for this subItem tile (prefer CODEX_DATA for dynamic author updates)
      let definedRecords = [];
      const codexSource = (typeof CODEX_DATA !== 'undefined' ? CODEX_DATA : window.CODEX_DATA) || [];
      for (const entry of codexSource) {
        const foundSub = (entry.subItems || []).find((si) => si.id === sub.id || si.label === sub.label);
        if (foundSub?.records?.length) {
          definedRecords = foundSub.records;
          break;
        }
      }
      if (!definedRecords.length && Array.isArray(sub.records)) {
        definedRecords = sub.records;
      }

      const activeState = (typeof state !== 'undefined' ? state : window.state);

      adjacentClues.forEach((clue) => {
        const validList = clue.validTargets || [];
        const invalidList = clue.invalidTargets || [];

        // Check if there is a record specifically gating or determining this clue
        const matchingRecord = definedRecords.find((r) =>
          r.targetClueId && (
            r.targetClueId === clue.id ||
            r.targetClueId === clue.label ||
            r.targetClueId === clue.title ||
            (clue.parentEntry && (clue.parentEntry.id === r.targetClueId || clue.parentEntry.title === r.targetClueId))
          )
        );

        if (matchingRecord) {
          const isUnlocked = Boolean(
            matchingRecord.unlockedByDefault ||
            (activeState && activeState.isTileRecordUnlocked(matchingRecord.id))
          );

          if (isUnlocked) {
            if (matchingRecord.determination === 'invalid') {
              hasInvalid = true;
              this.validationLinks.push({ from: clue, to: sub, type: 'invalid' });
            } else if (matchingRecord.determination === 'none') {
              // Neutral: fall back to static target matching
              const isMatch = this._isTargetMatch(validList, sub.label, sub.id);
              const isMismatch = this._isTargetMatch(invalidList, sub.label, sub.id);
              if (isMismatch) {
                hasInvalid = true;
                this.validationLinks.push({ from: clue, to: sub, type: 'invalid' });
              } else if (isMatch) {
                hasValid = true;
                matchedClues.push(clue);
                this.validationLinks.push({ from: clue, to: sub, type: 'valid' });
              }
            } else {
              hasValid = true;
              matchedClues.push(clue);
              this.validationLinks.push({ from: clue, to: sub, type: 'valid' });
            }
          } else {
            // Record not discovered yet: Gray (Unknown / "잘은 모르겠다")!
            hasUnknown = true;
            this.validationLinks.push({ from: clue, to: sub, type: 'unknown' });
          }
        } else {
          // Fallback to static matching
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
        }
      });

      if (hasInvalid) {
        sub.validationState = 'invalid';
      } else if (hasUnknown) {
        sub.validationState = 'unknown';
      } else if (hasValid) {
        sub.validationState = 'valid';
        const solveKey = `${sub.id || sub.label}:::${matchedClues.map(c => c.id || c.label).sort().join('+')}`;
        if (matchedClues.length >= 2 && !this.solvedPuzzleKeys.has(solveKey)) {
          this.solvedPuzzleKeys.add(solveKey);
          sub.solvedReported = true;
          this.onPuzzleSolved?.(sub, matchedClues);
        }
      }
    });
  }

  _drawValidationLinks() {
    if (!this.focusedKeywordId) return;
    this.validationLinks.forEach((link) => {
      if (!link.from || !link.to) return;
      if (!Number.isFinite(link.from.x) || !Number.isFinite(link.from.y) || !Number.isFinite(link.to.x) || !Number.isFinite(link.to.y)) return;
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
      guideBar.innerHTML = `<span>💡 <b>조건에 맞지 않는 타일은 후보 탈락 칸으로 옮기자.</b> (타일 더블클릭 또는 아래로 드래그 / 부합 시 <strong style="color:#2980b9;">파란색(참)</strong>, 모순 시 <strong style="color:#c0392b;">빨간색(거짓)</strong>) <button type="button" class="memo-exit-focus-btn" style="margin-left:8px; padding:3px 10px; border:1px solid #7f8c8d; border-radius:5px; background:rgba(0,0,0,0.4); color:#ecf0f1; cursor:pointer; font-size:12px;">전체 보기로 돌아가기</button></span>`;
      const exitBtn = guideBar.querySelector('.memo-exit-focus-btn');
      if (exitBtn) {
        exitBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.exitFocusMode();
        });
      }
    } else {
      guideBar.classList.add('is-normal-mode');
      guideBar.classList.remove('is-focus-mode');
      const hasAnyDeductible = this.clues.some((c) => this.canEnterDeductionMode(c));
      guideBar.innerHTML = hasAnyDeductible
        ? `<span class="guide-text-normal">타일 클릭: 세부 타일 펼치기 / 추론 타일 더블 클릭: 추론 모드 들어가기</span>`
        : `<span class="guide-text-normal">타일 클릭: 세부 타일 펼치기 및 상세 보기</span>`;
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
      // ===== [추론 모드: 상단 주제 + 일정한 간격의 단서 가로 배치 + 1칸 띄우고 세부타일 배치 + 하단 후보 탈락 칸] =====
      const parent = this.clues.find((c) => c.id === this.focusedKeywordId);
      if (parent) {
        if (this.dragNode?.id !== parent.id && Number.isFinite(parent.q) && Number.isFinite(parent.r)) {
          const pPos = this.axialToPixel(parent.q, parent.r);
          parent.x = pPos.x;
          parent.y = pPos.y;
        }
        // 1. 단서들 일정한 간격으로 상단 가로 배치 (y = -36.4)
        const subClues = parent.subClues || [];
        const count = subClues.length;
        subClues.forEach((sc, idx) => {
          if (!this.detachedNodes.has(sc.id) || sc.q === undefined) {
            const targetX = (idx - (count - 1) / 2) * 126;
            const targetY = -36.4;
            const hex = this.pixelToAxial(targetX, targetY);
            sc.q = hex.q;
            sc.r = hex.r;
            sc.isDetached = true;
            this.detachedNodes.set(sc.id, sc);
            this.positions.set(sc.id, { q: sc.q, r: sc.r });
          }
          if (this.dragNode?.id !== sc.id) {
            const pos = this.axialToPixel(sc.q, sc.r);
            sc.x = pos.x;
            sc.y = pos.y;
          }
        });

        // 2. 세부 타일들 (탈락되지 않은 타일들: 조건 타일들과 최소 거리 2를 유지하여 오픈 시 자동 판정 방지)
        const candidateSlots = [
          { q: -4, r: 3 }, { q: -2, r: 2 }, { q: 0, r: 1 }, { q: 2, r: 0 },
          { q: -3, r: 3 }, { q: -1, r: 2 }, { q: 1, r: 1 }, { q: 3, r: 0 }
        ];
        let slotIdx = 0;
        (parent.subItems || []).forEach((item) => {
          if (this.eliminatedTileIds.has(item.id)) {
            this.detachedNodes.delete(item.id);
            return;
          }
          if (!this.detachedNodes.has(item.id) || item.q === undefined || item.r === undefined) {
            const slot = candidateSlots[slotIdx++] || this._findFreeHexNear(0, 2, item.id);
            item.q = slot.q;
            item.r = slot.r;
            item.isDetached = true;
            this.detachedNodes.set(item.id, item);
            this.positions.set(item.id, { q: item.q, r: item.r });
          }
          if (this.dragNode?.id !== item.id) {
            const pos = this.axialToPixel(item.q, item.r);
            item.x = pos.x;
            item.y = pos.y;
          }
        });
      }

      // 1. 해당 주제의 독립 타일들 그리기 (단서 조건 및 후보 세부타일들)
      this.detachedNodes.forEach((node) => {
        const parentId = node.parentEntry?.id || node.parentId || node.clueId;
        if (parentId !== this.focusedKeywordId && !node.id.startsWith(this.focusedKeywordId)) return;
        if (this.eliminatedTileIds.has(node.id)) return;
        if (!Number.isFinite(node.q) || !Number.isFinite(node.r)) return;

        if (this.dragNode?.id !== node.id) {
          const pos = this.axialToPixel(node.q, node.r);
          node.x = pos.x;
          node.y = pos.y;
        }
        this._drawHex(node, false, false);
      });

      // 2. 상단 중앙 주제 타일 그리기
      if (parent) {
        const isCombineReady = partnerHighlight?.id === parent.id;
        this._drawHex(parent, true, isCombineReady);
      }

    } else {
      // ===== [일반 모드(전체 탭, 주제 탭 등)] =====
      // 중분류 단서 타일(subClues)과 세부 타일(subItems) 표시
      if (this.expandedId) {
        const parent = this.clues.find((c) => c.id === this.expandedId);
        if (parent) {
          const unlockedClues = (parent.subClues || []).map((sc) => ({
            ...sc,
            role: 'clue',
            isMidClue: true,
            sub: '단서'
          }));
          const unlockedItems = (parent.subItems || []).map((si) => ({
            ...si,
            role: 'sub',
            isSubItem: true,
            sub: '세부 타일'
          }));
          const allSubs = [...unlockedClues, ...unlockedItems];
          const occupiedKeys = new Set(
            this.clues.filter((c) => c.id !== parent.id).map((c) => `${c.q},${c.r}`)
          );
          occupiedKeys.add(`${parent.q},${parent.r}`);

          // 사용자가 직접 드래그해 옮긴 세부 타일은 옮긴 위치 유지
          allSubs.forEach((item) => {
            if (item.isDetached && Number.isFinite(item.q) && Number.isFinite(item.r)) {
              occupiedKeys.add(`${item.q},${item.r}`);
            }
          });

          const spiralSlots = getHexSpiralSlotsAround(parent.q, parent.r, allSubs.length + 30);
          let slotIdx = 0;
          allSubs.forEach((item) => {
            item.parentEntry = parent.entry || parent;
            if (item.isDetached && Number.isFinite(item.q) && Number.isFinite(item.r)) {
              if (this.dragNode?.id !== item.id) {
                const pos = this.axialToPixel(item.q, item.r);
                item.x = pos.x;
                item.y = pos.y;
              }
              this._drawHex(item, false, false);
              return;
            }
            while (slotIdx < spiralSlots.length) {
              const slot = spiralSlots[slotIdx++];
              const slotKey = `${slot.q},${slot.r}`;
              if (!occupiedKeys.has(slotKey)) {
                occupiedKeys.add(slotKey);
                item.q = slot.q;
                item.r = slot.r;
                if (this.dragNode?.id !== item.id) {
                  const dirPx = this.axialToPixel(slot.q - parent.q, slot.r - parent.r);
                  item.x = parent.x + dirPx.x;
                  item.y = parent.y + dirPx.y;
                }
                this._drawHex(item, false, false);
                break;
              }
            }
          });
        }
      }

      // 2. 모든 활성 주제 타일들 그리기
      this.clues.forEach((clue) => {
        if (this.dragNode?.id !== clue.id && Number.isFinite(clue.q) && Number.isFinite(clue.r)) {
          const pos = this.axialToPixel(clue.q, clue.r);
          clue.x = pos.x;
          clue.y = pos.y;
        }
        const isCombineReady = partnerHighlight?.id === clue.id;
        this._drawHex(clue, true, isCombineReady);
      });
    }

    this._renderEliminatedTray();
  }

  _drawFocusBadge(node) {
    // 상단 가이드 바가 집중 모드/추론 모드 설명을 표시하므로 보드 내 팝업은 띄우지 않음
  }

  _drawHex(node, isMain, isCombineReady) {
    if (!node) return;
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      if (Number.isFinite(node.q) && Number.isFinite(node.r)) {
        const p = this.axialToPixel(node.q, node.r);
        node.x = p.x;
        node.y = p.y;
      } else {
        return;
      }
    }

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
    if (node.validationState === 'unknown') classes.push('is-unknown');
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
      group.classList.add('is-new-item');
      const badgeG = document.createElementNS(SVG_NS, 'g');
      badgeG.setAttribute('class', 'memo-new-badge-group');
      // 육각형의 오른쪽 위 모서리 꼭짓점 (300° / -60°)
      const bx = node.x + radius * 0.5;
      const by = node.y - radius * 0.866;

      const bg = document.createElementNS(SVG_NS, 'circle');
      bg.setAttribute('class', 'memo-new-badge-bg');
      bg.setAttribute('cx', bx.toFixed(1));
      bg.setAttribute('cy', by.toFixed(1));
      bg.setAttribute('r', '8');

      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('class', 'memo-new-badge-text');
      txt.setAttribute('x', bx.toFixed(1));
      txt.setAttribute('y', by.toFixed(1));
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.textContent = 'N';

      badgeG.appendChild(bg);
      badgeG.appendChild(txt);
      group.appendChild(badgeG);
    }

    const labelLines = wrapLabel(node.label, (role === 'keyword' || (isMain && !isMid)) ? 6 : 5);
    const labelY = labelLines.length > 1 ? node.y - 7 : node.y - 2;
    appendSvgText(group, 'memo-label', node.x, labelY, labelLines, 10);

    let subText = '';
    if (node.validationState === 'unknown') {
      subText = '잘은 모르겠다';
    } else if (node.validationState === 'valid') {
      subText = '부합';
    } else if (node.validationState === 'invalid') {
      subText = '모순';
    } else if (role === 'keyword' || (isMain && !isMid)) {
      subText = '주제';
    } else if (isMid) {
      subText = '단서';
    } else {
      subText = node.parentEntry?.title || node.parentEntry?.label || (node.sub && node.sub !== '세부 타일' ? node.sub : '정보');
    }

    const sub = document.createElementNS(SVG_NS, 'text');
    sub.setAttribute('class', 'memo-sub');
    sub.setAttribute('x', node.x);
    sub.setAttribute('y', node.y + 20);
    sub.setAttribute('text-anchor', 'middle');
    sub.textContent = subText;
    group.appendChild(sub);

    // 더블클릭 이벤트: 세부 타일은 후보 탈락 칸으로 이동, 대분류(주제)는 추론 대상일 때만 추론 모드(Focus Mode) 토글
    group.addEventListener('dblclick', (event) => {
      if (this.focusedKeywordId && role === 'sub') {
        event.stopPropagation();
        event.preventDefault();
        this.eliminateTile(node);
        return;
      }
      if (role !== 'keyword' && !isMain) return;
      event.stopPropagation();
      event.preventDefault();

      if (this.focusedKeywordId === node.id) {
        this.exitFocusMode();
      } else if (this.canEnterDeductionMode(node)) {
        this.enterFocusMode(node.id);
      }
    });

    group.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      event.stopPropagation();

      const targetNode = node;
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
        group.classList.remove('is-new-item');
        const badgeG = group.querySelector('.memo-new-badge-group');
        if (badgeG) badgeG.remove();
        const ind = group.querySelector('.memo-new-indicator');
        if (ind) ind.remove();
      }

      // 클릭 시에만 펼침/접힘 토글 (일반 모드에서는 subItems만 펼쳐짐)
      if ((role === 'keyword' || isMain) && node.subItems?.length) {
        if (this.focusedKeywordId === node.id) {
          // 집중 모드로 들어갔을 때는 주제를 탭(클릭)해도 타일이 들어가지 않고 펼쳐진 상태 유지
          this.expandedId = node.id;
          this.pinnedId = node.id;
        } else if (this.expandedId === node.id) {
          // 이미 펼쳐져 있으면 접기 (다시 펼칠 때 깔끔하게 주변에 모이도록 분리 상태 초기화)
          (node.subItems || []).forEach((si) => {
            si.isDetached = false;
            delete si.q;
            delete si.r;
            this.detachedNodes.delete(si.id);
            this.positions.delete(si.id);
          });
          this.expandedId = null;
          this.pinnedId = null;
        } else {
          // 닫혀 있으면 펼치기: 이전 일반 모드에서 열려 있던 다른 주제 타일의 분리 상태를 정리하고, 현재 주제 주변으로 깔끔하게 펼침
          if (this.expandedId && this.expandedId !== node.id) {
            const prevParent = this.clues.find((c) => c.id === this.expandedId);
            (prevParent?.subItems || []).forEach((si) => {
              si.isDetached = false;
              delete si.q;
              delete si.r;
              this.detachedNodes.delete(si.id);
              this.positions.delete(si.id);
            });
          }
          (node.subItems || []).forEach((si) => {
            si.isDetached = false;
            delete si.q;
            delete si.r;
            this.detachedNodes.delete(si.id);
            this.positions.delete(si.id);
          });
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
