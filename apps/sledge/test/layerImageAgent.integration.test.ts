import { describe, expect, it } from 'vitest';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { layerAgentManager } from '~/controllers/layer/LayerAgentManager';
import type { RGBAColor } from '~/utils/ColorUtils';

function makeBuffer(w: number, h: number, color: RGBAColor = [0, 0, 0, 0]) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    buf[p] = color[0];
    buf[p + 1] = color[1];
    buf[p + 2] = color[2];
    buf[p + 3] = color[3];
  }
  return buf;
}

describe('LayerImageAgent integration (tile diff + undo/redo)', () => {
  const W = 40,
    H = 36; // 2x2 tiles (32px tile)

  it('fillWholeTile via TileManager adds diff; undo/redo restores buffer', () => {
    const initial: RGBAColor = [1, 2, 3, 4];
    const fill: RGBAColor = [9, 8, 7, 6];
    const buf = makeBuffer(W, H, initial);

    const agent = layerAgentManager.registerAgent('L1', buf, W, H);

    // act: fill one tile via tm (this only collects diff in DiffManager)
    const idx = { row: 0, column: 0 };
    agent.getTileManager().fillWholeTile(idx, fill, true);
    // register to history
    agent.registerToHistory();

    // buffer should already be modified by fill
    const p0 = 0;
    expect([buf[p0], buf[p0 + 1], buf[p0 + 2], buf[p0 + 3]]).toEqual(fill);
    expect(projectHistoryController.canUndo()).toBe(true);

    // undo should revert tile back to initial color
    projectHistoryController.undo();
    expect([buf[p0], buf[p0 + 1], buf[p0 + 2], buf[p0 + 3]]).toEqual(initial);
    expect(projectHistoryController.canRedo()).toBe(true);

    // redo should apply fill again
    projectHistoryController.redo();
    expect([buf[p0], buf[p0 + 1], buf[p0 + 2], buf[p0 + 3]]).toEqual(fill);
  });
});
