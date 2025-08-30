import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayerPropsHistoryAction } from '~/controllers/history/actions/LayerPropsHistoryAction';
import { BlendMode, Layer, LayerType } from '~/models/layer/Layer';
import { setLayerListStore } from '~/stores/ProjectStores';
import { eventBus } from '~/utils/EventBus';

describe('LayerPropsHistoryAction', () => {
  const layerId = 'layer-1';
  const base: Layer = {
    id: layerId,
    name: 'L1',
    type: LayerType.Dot,
    typeDescription: 'dot layer.',
    enabled: true,
    opacity: 1,
    mode: BlendMode.normal,
    dotMagnification: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on eventBus.emit
    vi.spyOn(eventBus, 'emit');
    // Seed store with a single layer
    setLayerListStore('layers', [base]);
    setLayerListStore('activeLayerId', layerId);
  });

  it('redo applies new props, undo restores old props, and emits update', () => {
    const oldProps: Omit<Layer, 'id'> = { ...base, id: undefined as any } as any;
    const newProps: Omit<Layer, 'id'> = {
      name: 'L1-renamed',
      type: LayerType.Dot,
      typeDescription: 'dot layer.',
      enabled: false,
      opacity: 0.5,
      mode: BlendMode.multiply,
      dotMagnification: 2,
    };

    const action = new LayerPropsHistoryAction(layerId, oldProps, newProps, 'test');

    action.redo();
    // name & flags updated
    expect((global as any).layerListStore?.layers?.[0]?.name ?? undefined).toBeUndefined();
    // We cannot read store directly via global; instead check via setLayerListStore closure effect
    // So, re-read by mutating & capturing current value via setter
    // Helper to read current layer snapshot using the setter
    let afterRedo: Layer | undefined;
    setLayerListStore((s: any) => {
      afterRedo = s.layers[0];
      return s;
    });
    expect(afterRedo).toBeDefined();
    expect(afterRedo!.name).toBe('L1-renamed');
    expect(afterRedo!.enabled).toBe(false);
    expect(afterRedo!.opacity).toBe(0.5);
    expect(afterRedo!.mode).toBe(BlendMode.multiply);
    expect(afterRedo!.dotMagnification).toBe(2);

    // event emitted
    expect(eventBus.emit).toHaveBeenCalledWith('webgl:requestUpdate', { context: 'test', onlyDirty: false });

    action.undo();
    let afterUndo: Layer | undefined;
    setLayerListStore((s: any) => {
      afterUndo = s.layers[0];
      return s;
    });
    expect(afterUndo!.name).toBe('L1');
    expect(afterUndo!.enabled).toBe(true);
    expect(afterUndo!.opacity).toBe(1);
    expect(afterUndo!.mode).toBe(BlendMode.normal);
    expect(afterUndo!.dotMagnification).toBe(1);
    expect(eventBus.emit).toHaveBeenCalledWith('webgl:requestUpdate', { context: 'test', onlyDirty: false });
  });
});
