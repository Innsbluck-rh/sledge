import { vars } from '@sledge/theme';
import { Accessor, onCleanup } from 'solid-js';

type Id = string;

interface UseLongPressReorderOptions<T> {
  getItems: Accessor<T[]>;
  getId: (item: T) => Id;
  containerRef: () => HTMLElement | undefined;
  longPressMs?: number; // default 350ms
  onDrop: (fromIndex: number, toIndex: number, id: Id) => void;
}

interface LongPressReorderApi {
  registerItem: (el: HTMLElement | null, id: Id) => void;
  onPointerDown: (e: PointerEvent, id: Id) => void;
}

// Utility: clamp value into [min, max]
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Copy bitmap contents from canvases in srcRoot to canvases in dstRoot without encoding.
function copyCanvases(srcRoot: HTMLElement, dstRoot: HTMLElement) {
  const src = Array.from(srcRoot.querySelectorAll('canvas')) as HTMLCanvasElement[];
  const dst = Array.from(dstRoot.querySelectorAll('canvas')) as HTMLCanvasElement[];
  const n = Math.min(src.length, dst.length);
  for (let i = 0; i < n; i++) {
    const s = src[i];
    const d = dst[i];
    const w = s.width | 0;
    const h = s.height | 0;
    if (!w || !h) continue;
    try {
      // Ensure destination bitmap matches source size, then blit.
      if (d.width !== w) d.width = w;
      if (d.height !== h) d.height = h;
      const ctx = d.getContext('2d');
      if (ctx) ctx.drawImage(s, 0, 0, w, h);
    } catch (_e) {
      // ignore draw failures (e.g., security restrictions)
    }
  }
}

// A small, dependency-free long-press reorder for vertical lists.
export function useLongPressReorder<T>(options: UseLongPressReorderOptions<T>): LongPressReorderApi {
  const LONG_PRESS_MS = options.longPressMs ?? 350;
  const MOVE_CANCEL_PX = 8; // if moved before long-press beyond this, cancel drag

  let pointerId: number | null = null;
  let pressTimer: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastClientX = 0;
  let lastClientY = 0;
  let dragging = false;
  let sourceId: Id | null = null;
  let sourceEl: HTMLElement | null = null;
  let sourceRect: DOMRect | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let ghostEl: HTMLDivElement | null = null;
  let dropLineEl: HTMLDivElement | null = null;
  let pointerInsideContainer = true;
  let cursorStyleEl: HTMLStyleElement | null = null;

  const itemMap = new Map<Id, HTMLElement>();

  const clearTimer = () => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const cleanupDrag = () => {
    clearTimer();
    if (ghostEl && ghostEl.parentElement) ghostEl.parentElement.removeChild(ghostEl);
    ghostEl = null;
    if (dropLineEl && dropLineEl.parentElement) dropLineEl.parentElement.removeChild(dropLineEl);
    dropLineEl = null;
    if (sourceEl) {
      sourceEl.style.opacity = '';
      sourceEl.style.backgroundColor = '';
      sourceEl.style.pointerEvents = '';
      sourceEl = null;
    }
    (document.body as any).style.userSelect = '';
    (document.body as any).style.cursor = '';
    // remove grabbing cursor class/style from container
    const container = options.containerRef?.();
    if (container) container.classList.remove('sledge-dnd-grabbing');
    if (cursorStyleEl && cursorStyleEl.parentElement) cursorStyleEl.parentElement.removeChild(cursorStyleEl);
    cursorStyleEl = null;
    pointerId = null;
    dragging = false;
    sourceId = null;
    sourceRect = null;
    offsetX = offsetY = 0;
    pointerInsideContainer = true;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  };

  const ensureDropLine = (index: number) => {
    if (!dropLineEl) {
      dropLineEl = document.createElement('div');
      dropLineEl.style.position = 'absolute';
      dropLineEl.style.left = '0';
      dropLineEl.style.height = '2px';
      dropLineEl.style.background = vars.color.accent;
      dropLineEl.style.opacity = '0.5';
      dropLineEl.style.borderRadius = '2px';
      dropLineEl.style.pointerEvents = 'none';
      const container = options.containerRef();
      if (container) {
        const cs = window.getComputedStyle(container);
        if (cs.position === 'static') container.style.position = 'relative';
        container.appendChild(dropLineEl);
      }
    }
    if (index !== 0) {
      dropLineEl.style.marginTop = '3px'; // layerList gap = 4px
    } else {
      dropLineEl.style.marginTop = '-1px';
    }
    return dropLineEl!;
  };

  const startDrag = (e: PointerEvent) => {
    const container = options.containerRef();
    if (!container || !sourceId) return;
    const el = itemMap.get(sourceId);
    if (!el) return;
    sourceEl = el;
    sourceRect = el.getBoundingClientRect();
    offsetX = e.clientX - sourceRect.left;
    offsetY = e.clientY - sourceRect.top;

    // create ghost
    ghostEl = document.createElement('div');
    ghostEl.className = 'sledge-dnd-ghost';
    ghostEl.style.position = 'fixed';
    ghostEl.style.left = `${e.clientX - offsetX}px`;
    ghostEl.style.top = `${e.clientY - offsetY}px`;
    ghostEl.style.width = `${sourceRect.width}px`;
    ghostEl.style.height = `${sourceRect.height}px`;
    ghostEl.style.opacity = '0.6';
    ghostEl.style.pointerEvents = 'none';
    ghostEl.style.zIndex = '9999';
    ghostEl.style.boxSizing = 'border-box';
    ghostEl.style.transform = 'translateZ(0)';
    ghostEl.style.background = window.getComputedStyle(el).backgroundColor || 'transparent';
    ghostEl.style.cursor = 'grabbing';
    // clone inner content for visuals
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.pointerEvents = 'none';
    clone.style.margin = '0';
    clone.style.width = '100%';
    clone.style.height = '100%';
    ghostEl.appendChild(clone);
    document.body.appendChild(ghostEl);

    // Populate canvases in the clone from original element (fast GPU blit)
    copyCanvases(el, clone);

    // create tint overlay to fully tint content

    // tint original instead of hiding
    el.style.opacity = '0.5';
    el.style.backgroundColor = vars.color.surface;
    // suppress interactions on original
    el.style.pointerEvents = 'none';
    (document.body as any).style.userSelect = 'none';
    (document.body as any).style.cursor = 'grabbing';
    // Force grabbing cursor within container scope
    if (!cursorStyleEl) {
      cursorStyleEl = document.createElement('style');
      cursorStyleEl.id = 'sledge-dnd-cursor-style';
      cursorStyleEl.textContent = `.sledge-dnd-grabbing, .sledge-dnd-grabbing * { cursor: grabbing !important; }`;
      document.head.appendChild(cursorStyleEl);
    }
    container.classList.add('sledge-dnd-grabbing');
    dragging = true;

    // show initial dropline
    updateDropTarget(e.clientX, e.clientY);
  };

  const findInsertIndex = (clientY: number) => {
    const items = options.getItems();
    const ids = items.map(options.getId);
    const container = options.containerRef();
    if (!container) return 0;

    // Collect rects in DOM order
    const entries: { id: Id; el: HTMLElement; rect: DOMRect }[] = [];
    ids.forEach((id) => {
      const el = itemMap.get(id);
      if (!el) return;
      entries.push({ id, el, rect: el.getBoundingClientRect() });
    });

    // Determine index where to insert
    let index = entries.length; // default after last
    for (let i = 0; i < entries.length; i++) {
      const { rect, id } = entries[i];
      if (id === sourceId) continue; // skip source
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) {
        index = i;
        break;
      }
    }

    // When dragging below own position and own node is hidden, the DOM order remains;
    // The controller's moveLayer can handle fromIndex/toIndex correctly.
    return clamp(index, 0, entries.length);
  };

  const updateDropTarget = (clientX: number, clientY: number) => {
    const container = options.containerRef();
    const items = options.getItems();
    if (!container || !items.length) return;
    const ids = items.map(options.getId);
    const idx = findInsertIndex(clientY);

    const line = ensureDropLine(idx);
    const containerRect = container.getBoundingClientRect();

    // Pointer inside/outside detection
    const insideX = clientX >= containerRect.left && clientX <= containerRect.right;
    const insideY = clientY >= containerRect.top && clientY <= containerRect.bottom;
    pointerInsideContainer = insideX && insideY;

    // Show line only when reordering would occur
    const fromIndex = sourceId ? ids.indexOf(sourceId) : -1;
    if (fromIndex < 0 || !pointerInsideContainer) {
      line.style.display = 'none';
    } else {
      const adjusted = idx > fromIndex ? idx - 1 : idx;
      line.style.display = adjusted === fromIndex ? 'none' : 'block';
    }

    // Calculate y of boundary between items
    let y = containerRect.top; // top by default
    if (idx === 0) {
      y = containerRect.top;
    } else if (idx >= ids.length) {
      const lastEl = itemMap.get(ids[ids.length - 1]);
      if (lastEl) {
        const r = lastEl.getBoundingClientRect();
        y = r.bottom;
      } else {
        y = containerRect.bottom;
      }
    } else {
      const prevEl = itemMap.get(ids[idx - 1]);
      if (prevEl) {
        const r = prevEl.getBoundingClientRect();
        y = r.bottom;
      }
    }

    line.style.top = `${y - containerRect.top - 2}px`; // visually center the line
    line.style.width = '100%';
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    if (!dragging) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
        // cancel long press if moved too much before activation
        clearTimer();
      }
      return;
    }
    // move ghost
    if (ghostEl) {
      ghostEl.style.top = `${e.clientY - offsetY}px`;
      ghostEl.style.left = `${e.clientX - offsetX}px`;
    }
    updateDropTarget(e.clientX, e.clientY);
  };

  const finishDrop = () => {
    if (!sourceId) return;
    const items = options.getItems();
    const ids = items.map(options.getId);
    const fromIndex = ids.indexOf(sourceId);
    if (fromIndex === -1) return;
    if (!pointerInsideContainer) return; // do not reorder when outside container
    const toIndex = findInsertIndex(lastClientY);
    const clampedTo = clamp(toIndex, 0, ids.length);
    options.onDrop(fromIndex, clampedTo, sourceId);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (pointerId !== null && e.pointerId !== pointerId) {
      return;
    }
    if (dragging) finishDrop();
    cleanupDrag();
  };

  const handlePointerCancel = (_e: PointerEvent) => {
    cleanupDrag();
  };

  const onPointerDown = (e: PointerEvent, id: Id) => {
    // ignore non-primary buttons
    if (e.button !== 0) return;
    sourceId = id;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    clearTimer();
    pressTimer = window.setTimeout(() => startDrag(e), LONG_PRESS_MS) as unknown as number;

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  };

  const registerItem = (el: HTMLElement | null, id: Id) => {
    if (!el) {
      itemMap.delete(id);
      return;
    }
    itemMap.set(id, el);
  };

  onCleanup(() => {
    cleanupDrag();
    itemMap.clear();
  });

  return { registerItem, onPointerDown };
}

export default useLongPressReorder;
