import { insertEntry, removeEntry } from '~/controllers/canvas/image_pool/ImagePoolController';
import { BaseHistoryAction } from '~/controllers/history/actions/BaseHistoryAction';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';

// history action for changes in image pool
export class ImagePoolHistoryAction extends BaseHistoryAction {
  readonly type = 'image_pool' as const;

  constructor(
    public readonly kind: 'add' | 'remove',
    public readonly targetEntry: ImagePoolEntry, // snapshot including id
    context?: any
  ) {
    super(context);
  }

  // removeEntry and addToImagePool emits 'imagePool:entryChanged' event itself!

  undo(): void {
    switch (this.kind) {
      case 'add':
        // Remove the added entry
        removeEntry(this.targetEntry.id);
        break;
      case 'remove':
        // Re-add the removed entry with the same id
        insertEntry(this.targetEntry);
        break;
    }
  }

  redo(): void {
    switch (this.kind) {
      case 'add':
        // Redo add should add the same snapshot
        insertEntry(this.targetEntry);
        break;
      case 'remove':
        // Remove the added entry
        removeEntry(this.targetEntry.id);
        break;
    }
  }
}
