import { beforeEach, describe, expect, it } from 'vitest';
import { getEntry, removeEntry } from '~/controllers/canvas/image_pool/ImagePoolController';
import { currentColor, selectPalette, setColor } from '~/controllers/color/ColorController';
import { ProjectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { CanvasSizeHistoryAction } from '~/controllers/history/actions/CanvasSizeHistoryAction';
import { ColorHistoryAction } from '~/controllers/history/actions/ColorHistoryAction';
import { ImagePoolHistoryAction } from '~/controllers/history/actions/ImagePoolHistoryAction';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';
import { PaletteType } from '~/models/color/PaletteType';
import { canvasStore } from '~/stores/ProjectStores';

describe('Project-level history integration', () => {
  beforeEach(() => {
    // Reset color to a known state
    selectPalette(PaletteType.primary);
    setColor(PaletteType.primary, '#000000');
    // Ensure test image pool id is not present
    if (getEntry('int-fixed')) removeEntry('int-fixed');
  });

  it('sequential actions: apply -> push -> full undo -> full redo', () => {
    const hc = new ProjectHistoryController();
    const LOG_SEQ = process.env.VITEST_LOG_SEQ === '1';
    const logs: string[] = [];

    const initialCanvas = { ...canvasStore.canvas };
    const targetCanvas = { width: initialCanvas.width + 10, height: initialCanvas.height - 20 };
    const entry: ImagePoolEntry = {
      id: 'int-fixed',
      originalPath: 'C:/dummy.png',
      resourcePath: 'C:/dummy.png',
      fileName: 'dummy.png',
      x: 0,
      y: 0,
      scale: 1,
      width: 10,
      height: 10,
      opacity: 1,
      visible: true,
    };

    // 1) Apply effects (redo) then push to history (common UI flow)
    const a1 = new ColorHistoryAction(PaletteType.primary, [0, 0, 0, 255], [255, 0, 0, 255], { from: 'int' });
    a1.redo();
    if (LOG_SEQ) logs.push('Color #000000 -> #ff0000');
    hc.addAction(a1);

    const a2 = new CanvasSizeHistoryAction(initialCanvas, targetCanvas, { from: 'int' });
    a2.redo();
    if (LOG_SEQ) logs.push(`Canvas ${initialCanvas.width}x${initialCanvas.height} -> ${targetCanvas.width}x${targetCanvas.height}`);
    hc.addAction(a2);

    const a3 = new ImagePoolHistoryAction('add', entry, { from: 'int' });
    a3.redo();
    if (LOG_SEQ) logs.push('ImagePool add int-fixed');
    hc.addAction(a3);

    // Verify present state
    expect(currentColor()).toBe('#ff0000');
    expect(canvasStore.canvas.width).toBe(targetCanvas.width);
    expect(canvasStore.canvas.height).toBe(targetCanvas.height);
    expect(getEntry('int-fixed')).toBeDefined();

    // Full undo
    while (hc.canUndo()) hc.undo();
    expect(currentColor()).toBe('#000000');
    expect(canvasStore.canvas.width).toBe(initialCanvas.width);
    expect(canvasStore.canvas.height).toBe(initialCanvas.height);
    expect(getEntry('int-fixed')).toBeUndefined();

    // Full redo
    while (hc.canRedo()) hc.redo();
    expect(currentColor()).toBe('#ff0000');
    expect(canvasStore.canvas.width).toBe(targetCanvas.width);
    expect(canvasStore.canvas.height).toBe(targetCanvas.height);
    expect(getEntry('int-fixed')).toBeDefined();

    if (LOG_SEQ) {
      // eslint-disable-next-line no-console
      console.log('\n[seq] steps=3\n' + logs.map((d, i) => `${i + 1}. ${d}`).join('\n'));
    }
  });

  it('idempotency: extra undo/redo beyond bounds should not change state or throw', () => {
    const hc = new ProjectHistoryController();
    const a1 = new ColorHistoryAction(PaletteType.primary, [0, 0, 0, 255], [255, 0, 0, 255], { from: 'int' });
    a1.redo();
    hc.addAction(a1);

    // At this point color is red
    hc.undo();
    // extra undo (no-op)
    hc.undo();
    expect(currentColor()).toBe('#000000');

    hc.redo();
    // extra redo (no-op)
    hc.redo();
    expect(currentColor()).toBe('#ff0000');
  });
});
