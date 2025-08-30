import { describe, expect, it } from 'vitest';
import { getEntry, insertEntry, removeEntry } from '~/controllers/canvas/image_pool/ImagePoolController';
import { ImagePoolHistoryAction } from '~/controllers/history/actions/ImagePoolHistoryAction';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';

describe('ImagePoolHistoryAction', () => {
  it('undo/redo add/remove keeps id with insertEntry()', async () => {
    const entry: ImagePoolEntry = {
      id: 'fixed-id',
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
    insertEntry(entry);
    const removeAction = new ImagePoolHistoryAction('remove', entry, { from: 'test' });
    removeAction.redo();
    expect(getEntry('fixed-id')).toBeUndefined();
    removeAction.undo();
    expect(getEntry('fixed-id')).toBeDefined();

    const addAction = new ImagePoolHistoryAction('add', entry, { from: 'test' });
    addAction.undo();
    expect(getEntry('fixed-id')).toBeUndefined();
    addAction.redo();
    expect(getEntry('fixed-id')).toBeDefined();

    // cleanup
    removeEntry('fixed-id');
  });
});
