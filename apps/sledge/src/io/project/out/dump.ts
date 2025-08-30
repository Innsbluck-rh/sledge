import { getEntries } from '~/controllers/canvas/image_pool/ImagePoolController';
import { getBufferOf } from '~/controllers/layer/LayerAgentManager';
import { allLayers } from '~/controllers/layer/LayerListController';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';
import {
  CanvasStore,
  canvasStore,
  imagePoolStore,
  ImagePoolStore,
  LayerListStore,
  layerListStore,
  ProjectStore,
  projectStore,
} from '~/stores/ProjectStores';
import { packr } from '~/utils/msgpackr';

export interface Project {
  canvasStore: CanvasStore;
  projectStore: ProjectStore;
  layerListStore: LayerListStore;
  imagePoolStore: ImagePoolStore;
  layerBuffers: Map<string, Uint8ClampedArray>;
  imagePool: ImagePoolEntry[];
}

export function getLayerBuffers(): Map<string, Uint8ClampedArray> {
  const map = new Map<string, Uint8ClampedArray>();
  allLayers().forEach((layer) => {
    map.set(layer.id, getBufferOf(layer.id)!);
  });
  return map;
}

export const dumpProject = async (): Promise<Uint8Array> => {
  const project: Project = {
    canvasStore: canvasStore,
    projectStore: projectStore,
    layerListStore: layerListStore,
    imagePoolStore: imagePoolStore,
    layerBuffers: getLayerBuffers(),
    imagePool: getEntries(),
  };
  const packed = packr.pack(project);
  return packed instanceof Uint8Array ? packed : Uint8Array.of(packed);
};
