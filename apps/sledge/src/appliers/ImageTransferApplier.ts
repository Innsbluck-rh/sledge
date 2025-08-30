import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { findLayerById } from '~/controllers/layer/LayerListController';
import { loadLocalImage } from '~/utils/DataUtils';

export interface ImageTransferParams {
  entry: {
    x: number;
    y: number;
    scale: number;
    resourcePath: string; // file path (already used by ImagePool)
  };
  targetLayerId: string;
}

export async function transferToLayer({ entry, targetLayerId }: ImageTransferParams): Promise<void> {
  const bitmap = await loadLocalImage(entry.resourcePath);
  const w = Math.max(1, Math.round(bitmap.width * (entry.scale || 1)));
  const h = Math.max(1, Math.round(bitmap.height * (entry.scale || 1)));

  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, w, h);

  bitmap.close();

  const { data: srcBuf } = ctx.getImageData(0, 0, w, h);

  /* 2) レイヤーピクセルバッファへ行コピー */
  const layer = findLayerById(targetLayerId);
  const agent = getAgentOf(targetLayerId) as LayerImageAgent;
  if (!agent) throw new Error('Layer not found');
  const originalBuffer = new Uint8ClampedArray(agent.getBuffer()); // Uint8ClampedArray
  const dstBuf = agent.getBuffer(); // Uint8ClampedArray

  const layerW = agent.getWidth();
  const layerH = agent.getHeight();
  const dot = layer?.dotMagnification || 1;

  let dstX = Math.floor(entry.x / dot);
  let dstY = Math.floor(entry.y / dot);

  let srcX = 0;
  let srcY = 0;

  if (dstX < 0) {
    srcX = -dstX; // 左にはみ出した分をソース側でスキップ
    dstX = 0;
  }
  if (dstY < 0) {
    srcY = -dstY; // 上にはみ出した分
    dstY = 0;
  }

  const copyW = Math.max(0, Math.min(w - srcX, layerW - dstX));
  const copyH = Math.max(0, Math.min(h - srcY, layerH - dstY));
  if (copyW === 0 || copyH === 0) return; // 完全にはみ出し

  // const rowBytes = copyW * 4;
  // for (let y = 0; y < copyH; ++y) {
  //   const srcOff = ((srcY + y) * w + srcX) * 4;
  //   const dstOff = ((dstY + y) * layerW + dstX) * 4;
  //   dstBuf.set(srcBuf.subarray(srcOff, srcOff + rowBytes), dstOff);
  // }

  for (let y = 0; y < copyH; ++y) {
    const srcBase = ((srcY + y) * w + srcX) * 4;
    let dstOff = ((dstY + y) * layerW + dstX) * 4;
    for (let x = 0; x < copyW; ++x) {
      const r = srcBuf[srcBase + x * 4 + 0];
      const g = srcBuf[srcBase + x * 4 + 1];
      const b = srcBuf[srcBase + x * 4 + 2];
      const a = srcBuf[srcBase + x * 4 + 3]; // 0-255

      if (a === 0) {
        dstOff += 4;
        continue;
      } // 完全透明はスキップ
      if (a === 255) {
        // 不透明はそのままコピー
        dstBuf[dstOff++] = r;
        dstBuf[dstOff++] = g;
        dstBuf[dstOff++] = b;
        dstBuf[dstOff++] = 255;
        continue;
      }
      const inv = 255 - a;
      dstBuf[dstOff] = ((r * a + dstBuf[dstOff] * inv + 127) * 257) >> 16;
      dstBuf[dstOff + 1] = ((g * a + dstBuf[dstOff + 1] * inv + 127) * 257) >> 16;
      dstBuf[dstOff + 2] = ((b * a + dstBuf[dstOff + 2] * inv + 127) * 257) >> 16;
      dstBuf[dstOff + 3] = Math.min(255, a + (((dstBuf[dstOff + 3] * inv + 127) * 257) >> 16));
      dstOff += 4;
    }
  }

  agent.setBuffer(dstBuf, false, true);

  const dm = agent.getDiffManager();
  dm.setWhole(originalBuffer, dstBuf);
  dm.flush();
  agent.registerToHistory({ tool: 'image' });
}
