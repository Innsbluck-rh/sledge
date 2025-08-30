import { apply_mask_offset, combine_masks_subtract, filter_by_selection_mask } from '@sledge/wasm';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { activeLayer } from '~/controllers/layer/LayerListController';
import { getCurrentSelection, selectionManager } from '~/controllers/selection/SelectionManager';
import { getToolCategory } from '~/controllers/tool/ToolController';
import { MoveTool } from '~/tools/move/MoveTool';
import { eventBus } from '~/utils/EventBus';

export function commitMove() {
  const moveTool = getToolCategory('move').behavior as MoveTool;
  moveTool.commit();
}

export function cancelMove() {
  const isLayerMove = selectionManager.getState() === 'move_layer';
  const moveTool = getToolCategory('move').behavior as MoveTool;
  moveTool.cancel();

  // レイヤーの場合移動キャンセルで選択解除まで行う
  if (isLayerMove) {
    selectionManager.clear();
  }
}

export function cancelSelection() {
  if (selectionManager.isMoveState()) {
    cancelMove();
  }
  selectionManager.clear();
}

export function deletePixelInSelection(layerId?: string): boolean {
  const selection = getCurrentSelection();
  const agent = getAgentOf(layerId ?? activeLayer().id);
  if (!agent) return false;

  const bufferManager = agent.getPixelBufferManager();
  const width = agent.getWidth();
  const height = agent.getHeight();

  // 元バッファを保持
  const before = bufferManager.buffer.slice();

  // moveOffset を考慮した選択マスクを用意
  const baseMask = selection.getMask();
  const { x: offX, y: offY } = selectionManager.getMoveOffset();
  const mask = offX === 0 && offY === 0 ? baseMask : new Uint8Array(apply_mask_offset(baseMask, width, height, offX, offY));

  // マスク内を透明化（"outside" はマスク=1の箇所を透明化する挙動）
  const after = new Uint8ClampedArray(filter_by_selection_mask(new Uint8Array(before), mask, 'outside', width, height));

  // 差分を履歴登録（whole）
  const dm = agent.getDiffManager();
  dm.setWhole(before, after.slice());

  // バッファを反映
  bufferManager.buffer.set(after);

  agent.registerToHistory({ tool: 'clear' });
  // タイルを更新対象に
  agent.getTileManager().setAllDirty();
  agent.forceUpdate();

  return true;
}

export function invertSelection() {
  // 1) 移動中なら見た目どおりに反映してから反転
  selectionManager.commitOffset();

  // 2) プレビュー中の内容は混ぜない（明示的に確定していないため）
  if (selectionManager.getPreviewMask()) {
    selectionManager.cancelPreview();
  }

  const selection = getCurrentSelection();
  const mask = selection.getMask();
  if (!mask || mask.length === 0) return;

  // 3) すべて 1 のマスクから現在のマスクを減算して反転を得る
  //    out = 1 & ~mask == ~mask
  let ones: Uint8Array | null = new Uint8Array(mask.length).fill(1);
  const inverted = new Uint8Array(combine_masks_subtract(ones, mask));

  ones = null;
  selection.setMask(inverted);

  // 4) 状態更新とイベント発火
  selectionManager.setState(selectionManager.isSelected() ? 'selected' : 'idle');
  eventBus.emit('selection:areaChanged', { commit: true });
}
