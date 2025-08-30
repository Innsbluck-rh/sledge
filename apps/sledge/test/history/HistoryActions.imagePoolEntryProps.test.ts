import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEntry, insertEntry, removeEntry } from '~/controllers/canvas/image_pool/ImagePoolController';
import { ImagePoolEntryPropsHistoryAction } from '~/controllers/history/actions/ImagePoolEntryPropsHistoryAction';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';

describe('ImagePoolEntryPropsHistoryAction', () => {
  const id = 'ip-1';
  const entry: ImagePoolEntry = {
    id,
    originalPath: 'C:/img.png',
    resourcePath: 'C:/img.png',
    fileName: 'img.png',
    x: 0,
    y: 0,
    scale: 1,
    width: 10,
    height: 10,
    opacity: 1,
    visible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // reset state
    if (getEntry(id)) removeEntry(id);
    insertEntry(entry);
  });

  it('redo applies new props and undo restores old props', () => {
    const oldProps = { ...entry, id: undefined as any } as any;
    const newProps = { ...oldProps, x: 5, y: 7, scale: 2, opacity: 0.6, visible: false };
    const action = new ImagePoolEntryPropsHistoryAction(id, oldProps, newProps, 'test');

    action.redo();
    let e = getEntry(id)!;
    expect(e.x).toBe(5);
    expect(e.y).toBe(7);
    expect(e.scale).toBe(2);
    expect(e.opacity).toBe(0.6);
    expect(e.visible).toBe(false);

    action.undo();
    e = getEntry(id)!;
    expect(e.x).toBe(0);
    expect(e.y).toBe(0);
    expect(e.scale).toBe(1);
    expect(e.opacity).toBe(1);
    expect(e.visible).toBe(true);
  });
});
