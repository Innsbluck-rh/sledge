import { Size2D } from '@sledge/core';
import { message } from '@tauri-apps/plugin-dialog';
import { webGLRenderer } from '~/components/canvas/stacks/WebGLCanvas';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { CanvasSizeHistoryAction } from '~/controllers/history/actions/CanvasSizeHistoryAction';
import { Consts } from '~/models/Consts';
import { interactStore, setInteractStore } from '~/stores/EditorStores';
import { canvasStore } from '~/stores/ProjectStores';
import { eventBus } from '~/utils/EventBus';

export function isValidCanvasSize(size: Size2D): boolean {
  if (size.width < Consts.minCanvasWidth || Consts.maxCanvasWidth < size.width) return false;
  if (size.height < Consts.minCanvasHeight || Consts.maxCanvasHeight < size.height) return false;

  const maxTextureSize = webGLRenderer?.getMaxTextureSize();
  if (maxTextureSize) {
    // WebGL制限の計算: 描画バッファは最大テクスチャサイズの1/8に制限される
    // 理論上限: sqrt(maxTextureSize² / 8) ≈ 5792 pixels per side (for 16384 max texture size)
    // 実際の制限: 理論上限 - 安全マージン ≈ 5759 pixels per side
    const theoreticalMaxSideLength = Math.sqrt((maxTextureSize * maxTextureSize) / 8);
    const safeSideLength = theoreticalMaxSideLength - Consts.webGLTextureSizeLimitMargin;
    const bufferSizeLimit = safeSideLength * safeSideLength * 4; // width * height * 4 bytes (RGBA)

    console.log(`WebGL limit analysis:`);
    console.log(`  MAX_TEXTURE_SIZE: ${maxTextureSize}`);
    console.log(`  Theoretical max side: ${theoreticalMaxSideLength.toFixed(2)} pixels`);
    console.log(`  Safe side length: ${safeSideLength.toFixed(2)} pixels`);
    console.log(`  Buffer size limit: ${(bufferSizeLimit / 1024 / 1024).toFixed(2)} MB`);

    const requestedBufferSize = size.width * size.height * 4; // RGBA bytes

    if (requestedBufferSize > bufferSizeLimit) {
      const maxSidePixels = Math.floor(safeSideLength);
      message(
        `Canvas size exceeds WebGL limitations.

Requested: ${size.width}×${size.height} (${(requestedBufferSize / 1024 / 1024).toFixed(2)} MB)
Maximum: ${maxSidePixels}×${maxSidePixels} (${(bufferSizeLimit / 1024 / 1024).toFixed(2)} MB)

This limitation is caused by WebGL drawing buffer memory constraints:
• Drawing buffer limited to 1/8 of MAX_TEXTURE_SIZE²
• Your GPU's MAX_TEXTURE_SIZE: ${maxTextureSize}

For larger canvases, consider using multiple smaller images or wait for tiled rendering support.`,
        {
          kind: 'warning',
          title: 'Canvas Size Limitation',
        }
      );
      return false;
    }
  }

  return true;
}

export async function changeCanvasSize(newSize: Size2D): Promise<boolean> {
  if (!isValidCanvasSize(newSize)) return false;

  const current = canvasStore.canvas;
  if (current.width === newSize.width && current.height === newSize.height) return false;

  // Use history action so that undo/redo works and buffers are snapshotted/restored
  const act = new CanvasSizeHistoryAction({ ...current }, { ...newSize }, { from: 'CanvasController.changeCanvasSize' });
  // Apply immediately (user intent)
  act.redo();
  // Then push onto history stack
  projectHistoryController.addAction(act);
  return true;
}

const referenceLengthRatio = 0.75;
const referenceLength = () => {
  const sectionBetweenArea = document.getElementById('sections-between-area')!;
  const areaBound = sectionBetweenArea.getBoundingClientRect();

  if (areaBound.width < areaBound.height) {
    return areaBound.width * referenceLengthRatio;
  } else {
    return areaBound.height * referenceLengthRatio;
  }
};

export const getReferencedZoom = (length?: number) => {
  if (length === undefined) {
    const width = canvasStore.canvas.width;
    const height = canvasStore.canvas.height;
    length = width > height ? width : height;
  }

  return referenceLength() / length;
};

export const adjustZoomToFit = (width?: number, height?: number) => {
  if (width === undefined) width = canvasStore.canvas.width;
  if (height === undefined) height = canvasStore.canvas.height;
  if (!width || !height) return;

  const isWide = width > height;
  const longerLength = isWide ? width : height;

  const referencedZoom = getReferencedZoom(longerLength);
  if (!referencedZoom) return;

  setZoom(referencedZoom);
  centeringCanvas();
};

export const centeringCanvas = () => {
  const canvasSize = canvasStore.canvas;
  // const canvasArea = interactStore.canvasAreaSize;
  const sectionBetweenArea = document.getElementById('sections-between-area');
  if (!sectionBetweenArea) return;
  const areaBound = sectionBetweenArea.getBoundingClientRect();
  const zoom = interactStore.zoom;

  const sideSectionControlLeftEl = document.getElementById('side-section-control-leftSide');
  const bottomBarEl = document.getElementById('bottom-bar');
  setOffset({
    x: sideSectionControlLeftEl ? -sideSectionControlLeftEl.scrollWidth : 0,
    y: bottomBarEl ? bottomBarEl.scrollHeight : 0,
  });
  setInteractStore('offsetOrigin', {
    x: areaBound.x + areaBound.width / 2 - (canvasSize.width * zoom) / 2,
    y: areaBound.height / 2 - (canvasSize.height * zoom) / 2,
  });
  setRotation(0);

  eventBus.emit('canvas:onAdjusted', {});
};

export const setZoom = (zoom: number): boolean => {
  zoom = Math.round(zoom * Math.pow(10, Consts.zoomPrecisionSignificantDigits)) / Math.pow(10, Consts.zoomPrecisionSignificantDigits);
  if (zoom > 0 && zoom !== interactStore.zoom) {
    setInteractStore('zoom', zoom);
    return true;
  }
  return false;
};

export const setOffset = (offset: { x: number; y: number }) => {
  if (offset.x !== interactStore.offset.x || offset.y !== interactStore.offset.y) {
    setInteractStore('offset', offset);
  }
};

export const setRotation = (rotation: number) => {
  if (rotation !== interactStore.rotation) setInteractStore('rotation', Math.round(rotation % 360));
};
