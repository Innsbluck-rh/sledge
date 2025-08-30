import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { getLayerIndex } from '~/controllers/layer/LayerListController';
import { WebGLRenderer } from '~/controllers/webgl/WebGLRenderer';
import { BlendMode, Layer } from '~/models/layer/Layer';
import { canvasStore, setLayerListStore } from '~/stores/ProjectStores';

export interface LayerMergeParams {
  originLayer: Layer;
  targetLayer: Layer;
}

let mergeCanvas: HTMLCanvasElement | null = null;
let mergeRenderer: WebGLRenderer | null = null;

function ensureMergeRenderer(originLayer: Layer, targetLayer: Layer): WebGLRenderer {
  const { width, height } = canvasStore.canvas;
  if (!mergeCanvas) mergeCanvas = document.createElement('canvas');
  mergeCanvas.width = width;
  mergeCanvas.height = height;
  mergeCanvas.style.width = `${width}px`;
  mergeCanvas.style.height = `${height}px`;
  if (!mergeRenderer) {
    mergeRenderer = new WebGLRenderer(mergeCanvas, width, height, [originLayer, targetLayer]);
  } else {
    mergeRenderer.setLayers([originLayer, targetLayer]);
    mergeRenderer.resize(width, height);
  }
  mergeRenderer.setIncludeBaseLayer(false);
  return mergeRenderer;
}

export async function mergeLayer({ originLayer, targetLayer }: LayerMergeParams): Promise<void> {
  // ターゲットのエージェント（描画先）
  const targetAgent = getAgentOf(targetLayer.id);
  if (!targetAgent) return;

  // インデックスの確認
  const tIdx = getLayerIndex(targetLayer.id);
  const oIdx = getLayerIndex(originLayer.id);
  if (tIdx < 0 || oIdx < 0) return;

  // WebGL で2パス描画
  const renderer = ensureMergeRenderer(originLayer, targetLayer);
  const out = renderer.readPixelsFlipped();

  // diff 用コピー（before は target の現在バッファ）
  const before = new Uint8ClampedArray(targetAgent.getBuffer());

  // バッファ更新 + 履歴登録（ImageTransferApplier と同じ流儀）
  targetAgent.setBuffer(out, true, true);
  const dm = targetAgent.getDiffManager();
  dm.setWhole(before, out);
  dm.flush();
  targetAgent.registerToHistory();
  targetAgent.forceUpdate();

  // target を normal / 100% に正規化
  if (tIdx >= 0) {
    setLayerListStore('layers', tIdx, 'mode', BlendMode.normal);
    setLayerListStore('layers', tIdx, 'opacity', 1.0);
  }
}
