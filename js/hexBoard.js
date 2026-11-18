// Pan/Zoom + Hex Grid Controller for Map, Inventory, and Memo

const SPIRAL_COORDS = [
  { q: 0, r: 0 },
  { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 1, r: 0 },
  { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 },
  { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
  { q: 2, r: -1 }, { q: 2, r: 0 }, { q: 1, r: 1 },
  { q: 0, r: 2 }, { q: -1, r: 2 }, { q: -2, r: 2 },
  { q: -2, r: 1 }, { q: -2, r: 0 }, { q: -1, r: -1 }
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function wrapText(value, maxChars, maxLines = 2) {
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

  if (lines.length === 1) {
    text.textContent = lines[0];
  } else {
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', x);
      tspan.setAttribute('dy', index === 0 ? '0' : String(lineHeight));
      tspan.textContent = line;
      text.appendChild(tspan);
    });
  }

  parent.appendChild(text);
}

export class HexBoard {
  constructor({ svgEl, layerEl, onSelectNode, onTravelToScene }) {
    this.svg = svgEl;
    this.layer = layerEl;
    this.onSelectNode = onSelectNode;
    this.onTravelToScene = onTravelToScene;

    this.R_SPACE = 48;
    this.R_DRAW = 44;

    this.panX = 0;
    this.panY = 0;
    this.scale = 1;
    this.isDragging = false;
    this.moved = false;
    this.pointers = new Map();
    this.lastPinchDist = null;
    this.dragStart = null;

    this.mode = 'map';
    this.memoExpanded = false;
    this.invCategory = '전체';

    this._bindEvents();
  }

  _toSvgPoint(clientX, clientY) {
    const point = this.svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = this.svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: clientX, y: clientY };
  }

  axialToXY(q, r) {
    return {
      x: this.R_SPACE * Math.sqrt(3) * (q + r / 2),
      y: this.R_SPACE * 1.5 * r
    };
  }

  hexPoints(cx, cy, r) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      points.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
    }
    return points.join(' ');
  }

  setView(x, y, scale) {
    this.panX = Math.max(-220, Math.min(220, x));
    this.panY = Math.max(-160, Math.min(160, y));
    this.scale = Math.max(0.6, Math.min(1.9, scale));
    this.layer.setAttribute(
      'transform',
      `translate(${this.panX}, ${this.panY}) scale(${this.scale})`
    );
  }

  zoomBy(delta) {
    this.setView(this.panX, this.panY, this.scale + delta);
  }

  resetView() {
    this.setView(0, 0, 1);
  }

  _bindEvents() {
    this.svg.addEventListener('pointerdown', (event) => {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.isDragging = true;
      this.moved = false;
      const point = this._toSvgPoint(event.clientX, event.clientY);
      this.dragStart = { x: point.x - this.panX, y: point.y - this.panY };
      const captureTarget = event.target.closest?.('.hex-node') || this.svg;
      captureTarget.setPointerCapture(event.pointerId);
    });

    this.svg.addEventListener('pointermove', (event) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointers.size === 2) {
        const [first, second] = Array.from(this.pointers.values());
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (this.lastPinchDist !== null) {
          this.zoomBy((distance - this.lastPinchDist) * 0.005);
        }
        this.lastPinchDist = distance;
        this.moved = true;
        return;
      }

      if (!this.isDragging || !this.dragStart) return;
      const point = this._toSvgPoint(event.clientX, event.clientY);
      const nextX = point.x - this.dragStart.x;
      const nextY = point.y - this.dragStart.y;
      if (Math.hypot(nextX - this.panX, nextY - this.panY) > 4) this.moved = true;
      this.setView(nextX, nextY, this.scale);
    });

    const endPointer = (event) => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.lastPinchDist = null;

      if (this.pointers.size === 1) {
        const remaining = this.pointers.values().next().value;
        const point = this._toSvgPoint(remaining.x, remaining.y);
        this.dragStart = { x: point.x - this.panX, y: point.y - this.panY };
      } else if (this.pointers.size === 0) {
        this.isDragging = false;
        this.dragStart = null;
        setTimeout(() => { this.moved = false; }, 20);
      }
    };

    this.svg.addEventListener('pointerup', endPointer);
    this.svg.addEventListener('pointercancel', endPointer);
    this.svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 0.1 : -0.1);
    }, { passive: false });
  }

  prepareInventoryNodes(items, category = '전체', sortByCategory = true) {
    const filtered = category === '전체' || category === 'all'
      ? [...items]
      : items.filter(item => item.category === category);

    if (sortByCategory) {
      filtered.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'ko'));
    }

    return filtered.map((item, index) => ({
      ...item,
      ...(SPIRAL_COORDS[index] || { q: index, r: 0 })
    }));
  }

  prepareMemoNodes(topic) {
    const centerNode = { ...topic.center, q: 0, r: 0, isCenter: true };
    if (!this.memoExpanded) return [centerNode];

    const ringNodes = topic.ring.slice(0, 6).map((item, index) => ({
      ...item,
      ...SPIRAL_COORDS[index + 1]
    }));
    return [centerNode, ...ringNodes];
  }

  render(nodes, selectedId) {
    this.layer.replaceChildren();
    this.setView(this.panX, this.panY, this.scale);

    nodes.forEach((node) => {
      const { x, y } = this.axialToXY(node.q, node.r);
      const group = document.createElementNS(SVG_NS, 'g');
      const classes = ['hex-node'];
      if (node.isCenter) classes.push('is-center');
      if (node.id === selectedId && !node.isCenter) classes.push('is-selected');
      if (node.locked) classes.push('is-locked');
      group.setAttribute('class', classes.join(' '));
      group.setAttribute('data-id', node.id);
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', node.accessibleLabel || node.label || '');

      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = node.accessibleLabel || node.label || '';
      group.appendChild(title);

      const polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('class', 'hex-poly');
      polygon.setAttribute('points', this.hexPoints(x, y, this.R_DRAW));
      group.appendChild(polygon);

      if (this.mode === 'inv') {
        appendSvgText(
          group,
          'hex-meta hex-type',
          x,
          y - 20,
          [node.typeLabel || node.category || '기타'],
          9
        );

        const labelLines = wrapText(node.label, 7);
        const labelY = labelLines.length > 1 ? y - 7 : y;
        const labelClass = `hex-label is-inventory${labelLines.length > 1 ? ' is-wrapped' : ''}`;
        appendSvgText(group, labelClass, x, labelY, labelLines, 10);
        appendSvgText(group, 'hex-meta hex-quantity', x, y + 21, [node.quantityLabel || ''], 9);
      } else {
        const labelLines = wrapText(node.label, 8);
        const labelY = labelLines.length > 1 ? y - 7 : y - 1;
        appendSvgText(
          group,
          `hex-label${labelLines.length > 1 ? ' is-wrapped' : ''}`,
          x,
          labelY,
          labelLines,
          10
        );

        const sub = document.createElementNS(SVG_NS, 'text');
        sub.setAttribute('class', 'hex-sub');
        sub.setAttribute('x', x);
        sub.setAttribute('y', y + 20);
        sub.setAttribute('text-anchor', 'middle');
        sub.textContent = node.sub || node.category || '';
        group.appendChild(sub);
      }

      if (node.isNew) {
        const newIndicator = document.createElementNS(SVG_NS, 'circle');
        newIndicator.setAttribute('class', 'hex-new-indicator');
        newIndicator.setAttribute('cx', x + 25);
        newIndicator.setAttribute('cy', y - 25);
        newIndicator.setAttribute('r', '4');
        group.appendChild(newIndicator);
      }

      const selectNode = () => {
        if (this.moved) return;
        if (this.mode === 'memo' && node.isCenter) {
          this.memoExpanded = !this.memoExpanded;
        }
        this.onSelectNode?.(node);
        if (this.mode === 'map' && !node.locked) {
          this.onTravelToScene?.(node);
        }
      };

      group.addEventListener('click', selectNode);
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode();
        }
      });

      this.layer.appendChild(group);
    });
  }
}
