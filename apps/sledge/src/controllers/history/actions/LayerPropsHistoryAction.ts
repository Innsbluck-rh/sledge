import { BaseHistoryAction } from '~/controllers/history/actions/BaseHistoryAction';
import { getLayerIndex } from '~/controllers/layer/LayerListController';
import { Layer } from '~/models/layer/Layer';
import { setLayerListStore } from '~/stores/ProjectStores';
import { eventBus } from '~/utils/EventBus';

// history action for changes in layer properties
export class LayerPropsHistoryAction extends BaseHistoryAction {
  readonly type = 'layer_props' as const;

  constructor(
    public readonly layerId: string,
    public readonly oldLayerProps: Omit<Layer, 'id'>,
    public readonly newLayerProps: Omit<Layer, 'id'>,
    context?: any // ex: "By user interact with opacity slider"
  ) {
    super(context);
  }

  undo(): void {
    const idx = getLayerIndex(this.layerId);
    setLayerListStore('layers', idx, { id: this.layerId, ...this.oldLayerProps });
    // no need to emit preview update, because preview only rely on buffer.
    eventBus.emit('webgl:requestUpdate', { context: this.context, onlyDirty: false });
  }

  redo(): void {
    const idx = getLayerIndex(this.layerId);
    setLayerListStore('layers', idx, { id: this.layerId, ...this.newLayerProps });
    // no need to emit preview update, because preview only rely on buffer.
    eventBus.emit('webgl:requestUpdate', { context: this.context, onlyDirty: false });
  }
}
