import { FileLocation } from '@sledge/core';
import { changeCanvasSize } from '~/controllers/canvas/CanvasController';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { addLayer } from '~/controllers/layer/LayerListController';
import { BlendMode, LayerType } from '~/models/layer/Layer';
import { setFileStore } from '~/stores/EditorStores';
import { loadImageData, loadLocalImage } from '~/utils/DataUtils';
import { join } from '~/utils/FileUtils';

export async function importImageFromPath(location: FileLocation): Promise<boolean> {
  if (!location || !location.path || !location.name) {
    console.log('Invalid file location');
    return false;
  }
  const path = join(location.path, location.name);
  const bitmap = await loadLocalImage(path);
  const imageData = await loadImageData(bitmap);

  setFileStore('openAs', 'image');
  const fileNameWithoutExt = location.name.split('.').slice(0, -1).join('.');
  setFileStore('location', 'path', location.path);
  setFileStore('location', 'name', fileNameWithoutExt);
  const fileExtension = location.name.split('.').slice(-1).join('.');
  setFileStore('extension', fileExtension);

  changeCanvasSize({
    width: imageData.width,
    height: imageData.height,
  });

  const initLayer = addLayer(
    {
      enabled: true,
      name: location.name,
      mode: BlendMode.normal,
      type: LayerType.Dot,
      dotMagnification: 1,
      opacity: 1,
    },
    {
      noDiff: true,
    }
  );

  const agent = getAgentOf(initLayer.id);
  agent?.setBuffer(Uint8ClampedArray.from(imageData.data), false, true);

  return true;
}

export function importImageFromWindow(): boolean {
  // @ts-ignore
  const imageData = window.__IMAGE__;

  if (!imageData || !imageData.buffer || !imageData.width || !imageData.height || !imageData.fileName) {
    console.log('No image data found');
    return false;
  }

  const fileName = imageData.fileName;
  const fileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
  setFileStore('location', 'name', fileNameWithoutExt);
  const fileExtension = fileName.split('.').slice(-1).join('.');
  setFileStore('extension', fileExtension);

  changeCanvasSize({
    width: imageData.width,
    height: imageData.height,
  });

  const initLayer = addLayer(
    {
      enabled: true,
      name: fileName,
      mode: BlendMode.normal,
      type: LayerType.Dot,
      dotMagnification: 1,
      opacity: 1,
    },
    {
      noDiff: true,
    }
  );

  const agent = getAgentOf(initLayer.id);
  agent?.setBuffer(new Uint8ClampedArray(imageData.buffer), false, true);

  return true;
}
