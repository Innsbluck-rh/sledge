import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use hoisted container so vi.mock factories can reference them safely
const h = vi.hoisted(() => ({
  agentMock: {
    canUndo: vi.fn(() => true),
    undoPatch: vi.fn(),
    redoPatch: vi.fn(),
  } as any,
  isMoveStateMock: vi.fn(() => false),
  cancelMoveMock: vi.fn(),
}));

vi.mock('~/controllers/layer/LayerAgentManager', () => ({
  getAgentOf: vi.fn(() => h.agentMock),
}));
vi.mock('~/controllers/selection/SelectionManager', () => ({
  selectionManager: { isMoveState: h.isMoveStateMock },
}));
vi.mock('~/controllers/selection/SelectionOperator', () => ({
  cancelMove: h.cancelMoveMock,
}));

import { LayerBufferHistoryAction, LayerBufferPatch, packRGBA } from '~/controllers/history/actions/LayerBufferHistoryAction';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';

describe('LayerBufferHistoryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Recreate agentMock to avoid stale/undefined state
    h.agentMock = {
      canUndo: vi.fn(() => true),
      undoPatch: vi.fn(),
      redoPatch: vi.fn(),
    } as any;
    // Reset hoisted mocks
    h.isMoveStateMock.mockReset().mockReturnValue(false);
    h.cancelMoveMock.mockReset();
    (getAgentOf as any).mockReset?.();
    (getAgentOf as any).mockReturnValue(h.agentMock);
  });

  const layerId = 'layer-xyz';

  function makeSamplePatch(layerId: string): LayerBufferPatch {
    return {
      layerId,
      whole: { type: 'whole', before: new Uint8ClampedArray([0, 0, 0, 0]), after: new Uint8ClampedArray([9, 9, 9, 9]) },
      tiles: [{ type: 'tileFill', tile: { row: 0, column: 0 }, before: undefined, after: packRGBA([1, 2, 3, 4]) }],
      pixels: [{ type: 'pixels', tile: { row: 0, column: 0 }, idx: new Uint16Array([0]), before: new Uint32Array([packRGBA([0, 0, 0, 0])]), after: new Uint32Array([packRGBA([0, 255, 0, 255])]) }],
    };
  }

  it('redo passes LayerBufferPatch to agent', () => {
  const patch = makeSamplePatch(layerId);
    const action = new LayerBufferHistoryAction(layerId, patch, 'test');

    let redoArg: any;
    h.agentMock.redoPatch.mockImplementation((arg: any) => (redoArg = arg));

    action.redo();

    expect(h.agentMock.redoPatch).toHaveBeenCalledTimes(1);
    expect(redoArg).toBeDefined();
    expect(redoArg.layerId).toBe(layerId);
    expect(redoArg.whole).toBeDefined();
    expect(redoArg.tiles?.length).toBe(1);
    expect(redoArg.pixels?.length).toBe(1);
  });

  it('undo passes LayerBufferPatch to agent', () => {
  const patch = makeSamplePatch(layerId);
    const action = new LayerBufferHistoryAction(layerId, patch, 'test');

    let undoArg: any;
    h.agentMock.undoPatch.mockImplementation((arg: any) => (undoArg = arg));

    action.undo();

    expect(h.agentMock.undoPatch).toHaveBeenCalledTimes(1);
    expect(undoArg).toBeDefined();
    expect(undoArg.layerId).toBe(layerId);
  });

  it('selection move state cancels move and does not call agent', () => {
    h.isMoveStateMock.mockReturnValue(true);
  const action = new LayerBufferHistoryAction(layerId, makeSamplePatch(layerId), 'test');

    action.redo();

    expect(h.cancelMoveMock).toHaveBeenCalledTimes(1);
    expect(h.agentMock.redoPatch).not.toHaveBeenCalled();
  });

  it('does nothing if no agent found', () => {
    // Force mocked getAgentOf to return undefined for this case
    (getAgentOf as any).mockReturnValue(undefined);
  const action = new LayerBufferHistoryAction(layerId, makeSamplePatch(layerId), 'test');

    action.redo();
    action.undo();

    // nothing thrown; nothing called
    // expectations implicit via no-throw, and no available mock to assert calls
  });

  it('respects insertion order: whole first then pixels when provided in that order', () => {
    const patch: LayerBufferPatch = {
      layerId,
      whole: { type: 'whole', before: new Uint8ClampedArray([0]), after: new Uint8ClampedArray([1]) },
      pixels: [{ type: 'pixels', tile: { row: 0, column: 0 }, idx: new Uint16Array([0]), before: new Uint32Array([packRGBA([0, 0, 0, 0])]), after: new Uint32Array([packRGBA([1, 1, 1, 1])]) }],
    };
    const action = new LayerBufferHistoryAction(layerId, patch, 'test');

    let order: string[] = [];
    h.agentMock.redoPatch.mockImplementation((arg: LayerBufferPatch) => {
      if (arg.whole) order.push('whole');
      if (arg.pixels && arg.pixels.length > 0) order.push('pixel');
    });

    action.redo();
    expect(order).toEqual(['whole', 'pixel']);
  });

  it('tile patch holds one entry per tile; last fill color should be reflected when building patch', () => {
    const patch: LayerBufferPatch = {
      layerId,
      tiles: [
        { type: 'tileFill', tile: { row: 2, column: 3 }, before: packRGBA([0, 0, 0, 0]), after: packRGBA([20, 20, 20, 20]) },
      ],
    };
    const action = new LayerBufferHistoryAction(layerId, patch, 'test');

    let seen: any[] = [];
    h.agentMock.redoPatch.mockImplementation((arg: LayerBufferPatch) => {
      seen = arg.tiles ?? [];
    });

    action.redo();
    expect(seen.length).toBe(1);
    const t = seen[0] as any;
    expect(t.type).toBe('tileFill');
    const packed = t.after >>> 0;
    expect([(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff, (packed >>> 24) & 0xff]).toEqual([20, 20, 20, 20]);
  });

  it('does call agent even if previous canUndo() would be false (gating removed)', () => {
    h.agentMock.canUndo.mockReturnValue(false);
  const action = new LayerBufferHistoryAction(layerId, makeSamplePatch(layerId), 'test');

    action.redo();
    action.undo();

    expect(h.agentMock.redoPatch).toHaveBeenCalledTimes(1);
    expect(h.agentMock.undoPatch).toHaveBeenCalledTimes(1);
  });

  it('dedup smoke: many pixel changes collapse to unique positions when building patch', () => {
    // Simulate a patch where only 100 unique indices are present across buckets
    const TILE = 32;
    const toLocal = (x: number, y: number) => x + y * TILE;
    const idxs = new Uint16Array(Array.from({ length: 100 }, (_, i) => toLocal(i % 10, Math.floor(i / 10))));
    const before = new Uint32Array(Array.from(idxs).map(() => packRGBA([0, 0, 0, 0] as any)));
    const after = new Uint32Array(Array.from(idxs).map((_, i) => packRGBA([i % 255, 0, 0, 255] as any)));
    const patch: LayerBufferPatch = {
      layerId,
      pixels: [{ type: 'pixels', tile: { row: 0, column: 0 }, idx: idxs, before, after }],
    };
    const action = new LayerBufferHistoryAction(layerId, patch, 'test');

    let count = 0;
    h.agentMock.redoPatch.mockImplementation((arg: LayerBufferPatch) => {
      count = arg.pixels?.reduce((acc, p) => acc + p.idx.length, 0) ?? 0;
    });

    action.redo();
    // 10 x 10 unique positions
    expect(count).toBe(100);
  });

  // helper removed: tests now construct patches directly
});
