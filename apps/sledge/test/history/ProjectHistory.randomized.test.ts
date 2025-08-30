import { beforeEach, describe, expect, it } from 'vitest';
import { getEntry, removeEntry } from '~/controllers/canvas/image_pool/ImagePoolController';
import { currentColor, selectPalette, setColor } from '~/controllers/color/ColorController';
import { ProjectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { CanvasSizeHistoryAction } from '~/controllers/history/actions/CanvasSizeHistoryAction';
import { ColorHistoryAction } from '~/controllers/history/actions/ColorHistoryAction';
import { ImagePoolHistoryAction } from '~/controllers/history/actions/ImagePoolHistoryAction';
import { ImagePoolEntryPropsHistoryAction } from '~/controllers/history/actions/ImagePoolEntryPropsHistoryAction';
import { LayerListHistoryAction } from '~/controllers/history/actions/LayerListHistoryAction';
import { LayerPropsHistoryAction } from '~/controllers/history/actions/LayerPropsHistoryAction';
import { LayerBufferHistoryAction, packRGBA } from '~/controllers/history/actions/LayerBufferHistoryAction';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';
import { PaletteType } from '~/models/color/PaletteType';
import { canvasStore, layerListStore, setCanvasStore, setLayerListStore } from '~/stores/ProjectStores';
import { BlendMode, Layer, LayerType } from '~/models/layer/Layer';
import { getBufferOf } from '~/controllers/layer/LayerAgentManager';
import { resetLayerImage } from '~/controllers/layer/LayerController';

// Tiny seeded RNG (LCG) for reproducibility
function makeRng(seed = 123456789) {
  let s = seed >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 0xffffffff;
}

describe('Project-level history randomized (lightweight scaffold)', () => {
  beforeEach(() => {
    // Normalize color and image pool before each test
    selectPalette(PaletteType.primary);
    setColor(PaletteType.primary, '#000000');
    // Keep canvas small to make layer buffers tiny
    setCanvasStore('canvas', { width: 16, height: 16 });
    // Seed 3 layers with agents (small buffers)
    const l = (id: string, name = id): Layer => ({
      id,
      name,
      type: LayerType.Dot,
      typeDescription: 'dot',
      enabled: true,
      opacity: 1,
      mode: BlendMode.normal,
      dotMagnification: 1,
    });
    setLayerListStore('layers', [l('L1'), l('L2'), l('L3')]);
    setLayerListStore('activeLayerId', 'L1');
    // Ensure agents exist for each layer id
    layerListStore.layers.forEach((layer) => resetLayerImage(layer.id, layer.dotMagnification));
    // Drop a few known test IDs if present
    ['rnd-a', 'rnd-b', 'rnd-c'].forEach((id) => {
      if (getEntry(id)) removeEntry(id);
    });
  });

  it('randomized sequence → undo-all → redo-all is consistent and idempotent', () => {
    const rng = makeRng(42);
    const LOG_RND = process.env.VITEST_LOG_RND === '1';
    const hc = new ProjectHistoryController();

  const initial = snapshotState();

    // Predefined candidate entries for pool operations
    const entries: Record<string, ImagePoolEntry> = {
      'rnd-a': {
        id: 'rnd-a',
        originalPath: 'C:/dummyA.png',
        resourcePath: 'C:/dummyA.png',
        fileName: 'dummyA.png',
        x: 0,
        y: 0,
        scale: 1,
        width: 8,
        height: 8,
        opacity: 1,
        visible: true,
      },
      'rnd-b': {
        id: 'rnd-b',
        originalPath: 'C:/dummyB.png',
        resourcePath: 'C:/dummyB.png',
        fileName: 'dummyB.png',
        x: 1,
        y: 1,
        scale: 1,
        width: 12,
        height: 12,
        opacity: 1,
        visible: true,
      },
      'rnd-c': {
        id: 'rnd-c',
        originalPath: 'C:/dummyC.png',
        resourcePath: 'C:/dummyC.png',
        fileName: 'dummyC.png',
        x: 2,
        y: 2,
        scale: 1,
        width: 16,
        height: 16,
        opacity: 1,
        visible: true,
      },
    };

    // Build a short random sequence of actions
    const steps: Array<() => void> = [];
    const stepDescs: string[] = [];
    const N = 40; // still short/light, but a bit richer coverage
    for (let i = 0; i < N; i++) {
      const pick = Math.floor(rng() * 7); // 7 kinds
      if (pick === 0) {
        // Color toggle among a tiny palette
        const targets = ['#000000', '#ff0000', '#00ff00', '#0000ff'] as const;
        const next = targets[Math.floor(rng() * targets.length)];
        const prev = currentColor();
        const a = new ColorHistoryAction(
          PaletteType.primary,
          // ColorHistoryAction expects RGBA tuples; we store via hex on controller
          hexToRgbaTuple(prev),
          hexToRgbaTuple(next),
          { from: 'rnd' }
        );
        steps.push(() => {
          a.redo();
          hc.addAction(a);
        });
        stepDescs.push(`Color ${prev} -> ${next}`);
      } else if (pick === 1) {
        // Small canvas tweak within reasonable bounds
        const cur = { ...canvasStore.canvas };
        const dw = Math.floor(rng() * 5) - 2; // -2..+2
        const dh = Math.floor(rng() * 5) - 2; // -2..+2
        const next = {
          width: Math.max(1, cur.width + dw),
          height: Math.max(1, cur.height + dh),
        };
        const a = new CanvasSizeHistoryAction(cur, next, { from: 'rnd' });
        steps.push(() => {
          a.redo();
          hc.addAction(a);
        });
        stepDescs.push(`Canvas ${cur.width}x${cur.height} -> ${next.width}x${next.height}`);
      } else if (pick === 2) {
        // ImagePool add/remove on one of the fixed ids
        const keys = Object.keys(entries);
        const id = keys[Math.floor(rng() * keys.length)];
        const exists = !!getEntry(id);
        const kind = exists ? 'remove' : 'add';
        const a = new ImagePoolHistoryAction(kind as 'add' | 'remove', entries[id], { from: 'rnd' });
        steps.push(() => {
          a.redo();
          hc.addAction(a);
        });
        stepDescs.push(`ImagePool ${kind} ${id}`);
      } else if (pick === 3) {
        // ImagePool entry props: nudge position/opacity/visibility if exists; otherwise add first
        const keys = Object.keys(entries);
        const id = keys[Math.floor(rng() * keys.length)];
        const cur = getEntry(id);
        if (!cur) {
          const add = new ImagePoolHistoryAction('add', entries[id], { from: 'rnd:ensure-entry' });
          steps.push(() => {
            add.redo();
            hc.addAction(add);
          });
          stepDescs.push(`ImagePool add ${id} (prep for props)`);
        } else {
          const dx = Math.floor(rng() * 5) - 2;
          const dy = Math.floor(rng() * 5) - 2;
          const dop = (Math.floor(rng() * 3) - 1) * 0.1; // -0.1, 0, +0.1
          const { id: _omit, ...oldNoId } = cur as any;
          const oldProps = oldNoId as Omit<ImagePoolEntry, 'id'>;
          const { id: _omit2, ...baseNoId } = cur as any;
          const newProps: Omit<ImagePoolEntry, 'id'> = {
            ...baseNoId,
            x: cur.x + dx,
            y: cur.y + dy,
            opacity: Math.max(0, Math.min(1, cur.opacity + dop)),
            visible: rng() < 0.3 ? !cur.visible : cur.visible,
          };
          const a = new ImagePoolEntryPropsHistoryAction(id, oldProps, newProps, { from: 'rnd' });
          steps.push(() => {
            a.redo();
            hc.addAction(a);
          });
          stepDescs.push(`ImagePool props ${id} move(${dx},${dy})`);
        }
      } else if (pick === 4) {
        // Layer list: add/delete/reorder
        const actionKind = Math.floor(rng() * 3); // 0:add 1:delete 2:reorder
        if (actionKind === 0) {
          // add at random index with small blank buffer
          const idx = Math.floor(rng() * (layerListStore.layers.length + 1));
          const id = `LR-${Math.floor(rng() * 100000)}`;
          const snapshot: Layer & { buffer?: Uint8ClampedArray } = {
            id,
            name: id,
            type: LayerType.Dot,
            typeDescription: 'dot',
            enabled: true,
            opacity: 1,
            mode: BlendMode.normal,
            dotMagnification: 1,
            buffer: new Uint8ClampedArray(canvasStore.canvas.width * canvasStore.canvas.height * 4),
          } as any;
          const a = new LayerListHistoryAction('add', idx, snapshot, undefined, undefined, { from: 'rnd' });
          steps.push(() => {
            a.redo();
            hc.addAction(a);
          });
          stepDescs.push(`Layer add ${id} @${idx}`);
        } else if (actionKind === 1) {
          if (layerListStore.layers.length > 1) {
            const idx = Math.floor(rng() * layerListStore.layers.length);
            const layer = layerListStore.layers[idx];
            const snapshot: Layer & { buffer?: Uint8ClampedArray } = { ...layer, buffer: new Uint8ClampedArray(getBufferOf(layer.id)!) } as any;
            const a = new LayerListHistoryAction('delete', idx, snapshot, undefined, undefined, { from: 'rnd' });
            steps.push(() => {
              a.redo();
              hc.addAction(a);
            });
            stepDescs.push(`Layer delete ${layer.id} @${idx}`);
          }
        } else {
          if (layerListStore.layers.length > 1) {
            const before = layerListStore.layers.map((x) => x.id);
            // simple swap of two indices
            const i1 = Math.floor(rng() * before.length);
            let i2 = Math.floor(rng() * before.length);
            if (i2 === i1) i2 = (i2 + 1) % before.length;
            const after = [...before];
            [after[i1], after[i2]] = [after[i2], after[i1]];
            const a = new LayerListHistoryAction('reorder', -1, undefined, before, after, { from: 'rnd' });
            steps.push(() => {
              a.redo();
              hc.addAction(a);
            });
            stepDescs.push(`Layer reorder swap(${i1},${i2})`);
          }
        }
      } else if (pick === 5) {
        // Layer props tweak (opacity/mode/enabled)
        if (layerListStore.layers.length > 0) {
          const layer = layerListStore.layers[Math.floor(rng() * layerListStore.layers.length)];
          const oldProps: Omit<Layer, 'id'> = { ...layer } as any;
          delete (oldProps as any).id;
          const modes = [BlendMode.normal, BlendMode.multiply, BlendMode.screen] as const;
          const nextMode = modes[Math.floor(rng() * modes.length)];
          const nextOpacity = Math.max(0, Math.min(1, layer.opacity + (Math.floor(rng() * 3) - 1) * 0.2));
          const nextEnabled = rng() < 0.3 ? !layer.enabled : layer.enabled;
          const newProps: Omit<Layer, 'id'> = {
            name: layer.name,
            type: layer.type,
            typeDescription: layer.typeDescription,
            enabled: nextEnabled,
            opacity: nextOpacity,
            mode: nextMode,
            dotMagnification: layer.dotMagnification,
          };
          const a = new LayerPropsHistoryAction(layer.id, oldProps, newProps, { from: 'rnd' });
          steps.push(() => {
            a.redo();
            hc.addAction(a);
          });
          stepDescs.push(`Layer props ${layer.id} opacity->${nextOpacity.toFixed(1)} mode->${nextMode}`);
        }
      } else if (pick === 6) {
        // Layer buffer tiny pixel patch on a random layer
        if (layerListStore.layers.length > 0) {
          const layer = layerListStore.layers[Math.floor(rng() * layerListStore.layers.length)];
          const buf = getBufferOf(layer.id);
          if (buf) {
            // pick up to 3 pixels in top-left tile
            const count = 1 + Math.floor(rng() * 3);
            const idxs = new Uint16Array(Array.from({ length: count }, (_, k) => k));
            const before = new Uint32Array(count);
            const after = new Uint32Array(count);
            const w = canvasStore.canvas.width;
            for (let k = 0; k < count; k++) {
              const dx = idxs[k] % 32; // assume small within bounds
              const dy = (idxs[k] / 32) | 0;
              const x = dx;
              const y = dy;
              const ptr = (y * w + x) * 4;
              const r = buf[ptr] ?? 0;
              const g = buf[ptr + 1] ?? 0;
              const b = buf[ptr + 2] ?? 0;
              const a8 = buf[ptr + 3] ?? 0;
              before[k] = packRGBA([r, g, b, a8]);
              // new color: cycle channels a bit
              after[k] = packRGBA([b, r, (g + 64) & 0xff, 255]);
            }
            const patch = { layerId: layer.id, pixels: [{ type: 'pixels' as const, tile: { row: 0, column: 0 }, idx: idxs, before, after }] };
            const a = new LayerBufferHistoryAction(layer.id, patch, { from: 'rnd' });
            steps.push(() => {
              a.redo();
              hc.addAction(a);
            });
            stepDescs.push(`Layer buffer pixels ${layer.id} n=${count}`);
          }
        }
      }
    }

    // Execute sequence
    steps.forEach((fn) => fn());

    if (LOG_RND) {
      // Print executed step list for debugging/repro
      const header = `\n[rnd] seed=42 steps=${N}`;
      const body = stepDescs.map((d, i) => `${i + 1}. ${d}`).join('\n');
      // eslint-disable-next-line no-console
      console.log(`${header}\n${body}`);
    }

  const final = snapshotState();

    // Undo all → initial snapshot
    while (hc.canUndo()) hc.undo();
  expect(currentColor()).toBe(initial.color);
  expect(canvasStore.canvas.width).toBe(initial.canvas.width);
  expect(canvasStore.canvas.height).toBe(initial.canvas.height);
  expect(simplifyPoolState()).toEqual(initial.pool);
  expect(simplifyLayers()).toEqual(initial.layers);

    // Redo all → final snapshot
    while (hc.canRedo()) hc.redo();
  expect(currentColor()).toBe(final.color);
  expect(canvasStore.canvas.width).toBe(final.canvas.width);
  expect(canvasStore.canvas.height).toBe(final.canvas.height);
  expect(simplifyPoolState()).toEqual(final.pool);
  expect(simplifyLayers()).toEqual(final.layers);

    // Idempotency check: repeat once more
    while (hc.canUndo()) hc.undo();
    while (hc.canRedo()) hc.redo();
  expect(currentColor()).toBe(final.color);
  expect(canvasStore.canvas.width).toBe(final.canvas.width);
  expect(canvasStore.canvas.height).toBe(final.canvas.height);
  expect(simplifyPoolState()).toEqual(final.pool);
  expect(simplifyLayers()).toEqual(final.layers);
  });
});

// Local tiny helper to convert '#rrggbb' to [r,g,b,a]
function hexToRgbaTuple(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b, 255];
}

// Helpers to snapshot/compare only what we care about in random checks
function simplifyPoolState() {
  const ids = ['rnd-a', 'rnd-b', 'rnd-c'];
  return ids.map((id) => {
    const e = getEntry(id);
    return e
      ? { id, exists: true, x: e.x, y: e.y, opacity: e.opacity, visible: e.visible, scale: e.scale }
      : { id, exists: false };
  });
}

function simplifyLayers() {
  return layerListStore.layers.map((l) => ({ id: l.id, name: l.name, enabled: l.enabled, opacity: l.opacity, mode: l.mode, dotMagnification: l.dotMagnification }));
}

function snapshotState() {
  return {
    color: currentColor(),
    canvas: { ...canvasStore.canvas },
    pool: simplifyPoolState(),
    layers: simplifyLayers(),
  };
}
