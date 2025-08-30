import { mergeLayer } from '~/appliers/LayerMergeApplier';
import { LayerPropsHistoryAction } from '~/controllers/history/actions/LayerPropsHistoryAction';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { Layer } from '~/models/layer/Layer';
import { interactStore } from '~/stores/EditorStores';
import { canvasStore, layerListStore, setLayerListStore } from '~/stores/ProjectStores';
import { RGBAColor, RGBAToHex } from '~/utils/ColorUtils';
import { eventBus } from '~/utils/EventBus';
import LayerImageAgent from './image/LayerImageAgent';
import { getActiveAgent, getAgentOf, getBufferOf, layerAgentManager } from './LayerAgentManager';
import { addLayer, findLayerById, getLayerIndex } from './LayerListController';

const propNamesToUpdate: (keyof Layer)[] = ['mode', 'opacity', 'enabled', 'type', 'dotMagnification'];

export function setLayerName(layerId: string, newName: string): boolean {
  if (!newName || newName.trim() === '') {
    console.warn('Layer name cannot be empty');
    return false;
  }

  const layer = findLayerById(layerId);
  if (!layer) return false;

  const idx = getLayerIndex(layerId);
  setLayerListStore('layers', idx, 'name', newName);
  eventBus.emit('webgl:requestUpdate', { onlyDirty: false, context: `Layer(${layerId}) name updated` });
  return true;
}

interface SetLayerPropOptions {
  noDiff?: boolean;
}

export function setLayerProp<K extends keyof Layer>(layerId: string, propName: K, newValue: Layer[K], options?: SetLayerPropOptions) {
  if (propName === 'id') {
    return;
  }
  const layer = findLayerById(layerId);
  if (!layer) return;
  const beforeValue = layer[propName];
  const before: Omit<Layer, 'id'> = { ...layer } as any;
  const idx = getLayerIndex(layerId);
  setLayerListStore('layers', idx, propName, newValue);
  const after = { ...findLayerById(layerId)! } as Omit<Layer, 'id'>;
  // Remove id from snapshots
  delete (before as any).id;
  delete (after as any).id;
  if (!options?.noDiff) {
    const act = new LayerPropsHistoryAction(layerId, before, after, {
      from: `LayerController.setLayerProp(${String(propName)}: ${String(beforeValue)} > ${String(newValue)})`,
    });
    projectHistoryController.addAction(act);
  }
  if (propNamesToUpdate.indexOf(propName) !== -1)
    eventBus.emit('webgl:requestUpdate', { onlyDirty: false, context: `Layer(${layerId}) prop updated(${propName})` });
}

export function duplicateLayer(layerId: string) {
  const layer = findLayerById(layerId);
  addLayer(
    {
      ...layer,
    },
    {
      initImage: getBufferOf(layerId),
    }
  );
  eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${layerId}) duplicated` });
}

export function clearLayer(layerId: string) {
  const agent = getAgentOf(layerId);
  if (!agent) return;
  const originalBuffer = agent.getBuffer().buffer;
  // clear current buffer
  let width = canvasStore.canvas.width;
  let height = canvasStore.canvas.height;
  const newBuffer = new Uint8ClampedArray(width * height * 4);

  agent.setBuffer(newBuffer, true, true);

  agent.getDiffManager().setWhole(new Uint8ClampedArray(originalBuffer), new Uint8ClampedArray(newBuffer.buffer));
  agent.registerToHistory({ tool: 'clear' });
  agent.forceUpdate();
}

export function resetLayerImage(layerId: string, dotMagnification: number, initImage?: Uint8ClampedArray): LayerImageAgent {
  let width = Math.round(canvasStore.canvas.width / dotMagnification);
  let height = Math.round(canvasStore.canvas.height / dotMagnification);
  let buffer: Uint8ClampedArray;
  if (initImage) {
    buffer = new Uint8ClampedArray(initImage);
  } else {
    // 透明（RGBA＝0,0,0,0）で初期化された Uint8ClampedArray を生成
    buffer = new Uint8ClampedArray(width * height * 4);
  }

  const agent = getAgentOf(layerId);
  if (agent !== undefined) {
    agent.getTileManager().setAllDirty();
    eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${layerId}) image reset` });
    eventBus.emit('preview:requestUpdate', { layerId: layerId });
    agent.setBuffer(buffer, false, true);
    return agent;
  } else {
    const newAgent = layerAgentManager.registerAgent(layerId, buffer, width, height);
    newAgent.getTileManager().setAllDirty();
    eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${layerId}) image reset` });
    eventBus.emit('preview:requestUpdate', { layerId: layerId });
    return newAgent;
  }
}

export async function mergeToBelowLayer(layerId: string) {
  const originLayerIndex = getLayerIndex(layerId);
  const targetLayerIndex = originLayerIndex + 1;
  if (originLayerIndex >= layerListStore.layers.length) return;

  const originLayer = layerListStore.layers[originLayerIndex];
  const targetLayer = layerListStore.layers[targetLayerIndex];

  // merge
  await mergeLayer({ originLayer, targetLayer });

  setLayerProp(layerId, 'enabled', false, { noDiff: true });
  if (layerListStore.activeLayerId === layerId) {
    setLayerListStore('activeLayerId', targetLayer.id);
  }
  // removeLayer(layerId);
}

export function getCurrentPointingColor(): RGBAColor | undefined {
  const agent = getActiveAgent();
  return agent?.getPixelBufferManager().getPixel({
    x: Math.floor(interactStore.lastMouseOnCanvas.x),
    y: Math.floor(interactStore.lastMouseOnCanvas.y),
  });
}

export function getCurrentPointingColorHex(): string | undefined {
  if (!interactStore.lastMouseOnCanvas) return undefined;
  const agent = getActiveAgent();
  const color = agent?.getPixelBufferManager().getPixel({
    x: Math.floor(interactStore.lastMouseOnCanvas.x),
    y: Math.floor(interactStore.lastMouseOnCanvas.y),
  });
  if (color !== undefined) return `#${RGBAToHex(color, false)}`;

  return undefined;
}

// Project-level history now drives undo/redo; layer-level canUndo/canRedo are deprecated.
