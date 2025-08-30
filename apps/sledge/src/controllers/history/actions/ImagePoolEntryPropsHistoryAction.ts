import { setEntry } from '~/controllers/canvas/image_pool/ImagePoolController';
import { BaseHistoryAction } from '~/controllers/history/actions/BaseHistoryAction';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';

// history action for changes in image pool entry property
export class ImagePoolEntryPropsHistoryAction extends BaseHistoryAction {
  readonly type = 'image_pool_entry_props' as const;

  constructor(
    public readonly entryId: string,
    public readonly oldEntryProps: Omit<ImagePoolEntry, 'id'>,
    public readonly newEntryProps: Omit<ImagePoolEntry, 'id'>,
    context?: any
  ) {
    super(context);
  }

  undo(): void {
    // setEntry emits 'imagePool:entryPropChanged' event itself!
    setEntry(this.entryId, { id: this.entryId, ...this.oldEntryProps });
  }

  redo(): void {
    setEntry(this.entryId, { id: this.entryId, ...this.newEntryProps });
  }
}
