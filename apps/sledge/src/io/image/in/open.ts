import { changeCanvasSize } from '~/controllers/canvas/CanvasController';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { addLayer } from '~/controllers/layer/LayerListController';
import { BlendMode, LayerType } from '~/models/layer/Layer';
import { loadImageData, loadLocalImage } from '~/utils/DataUtils';
import { join } from '~/utils/FileUtils';

export const initProjectWithNewImage = async (filePath: string, fileName: string) => {
  const imagePath = join(filePath, fileName);
  const imageBitmap = await loadLocalImage(imagePath);
  changeCanvasSize({
    width: imageBitmap.width,
    height: imageBitmap.height,
  });

  const imageData = await loadImageData(imageBitmap); // ここで画像のバッファを読み込み
  imageBitmap.close();

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
  agent?.setBuffer(Uint8ClampedArray.from(imageData.data), false, true);
};
