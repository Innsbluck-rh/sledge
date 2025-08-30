import { Vec2 } from '@sledge/core';
import { preview_move } from '@sledge/wasm';
import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { selectionManager } from '~/controllers/selection/SelectionManager';
import { ToolArgs, ToolBehavior } from '~/tools/ToolBehavior';
import { TOOL_CATEGORIES } from '~/tools/Tools';
import { eventBus } from '~/utils/EventBus';

export class MoveTool implements ToolBehavior {
  acceptStartOnOutCanvas = true;
  onlyOnCanvas = false;

  private layerId: string | undefined = undefined;
  private originalBuffer: Uint8Array | undefined = undefined;

  private startOffset: Vec2 = { x: 0, y: 0 };
  private startPosition: Vec2 = { x: 0, y: 0 };

  // パフォーマンス最適化のためのプロパティ
  private previewAnimationId: number | null = null;
  private lastPreviewOffset: Vec2 = { x: 0, y: 0 };
  private pendingOffset: Vec2 | null = null;
  private lastPreviewTime: number = 0;
  private readonly PREVIEW_THROTTLE_MS = 16; // 約60FPS

  onStart(agent: LayerImageAgent, args: ToolArgs) {
    const isLayerMove = selectionManager.getState() === 'move_layer' || !selectionManager.isSelected();
    if (isLayerMove) {
      selectionManager.selectAll();
    }
    this.layerId = agent.layerId;

    selectionManager.commit();

    if (!selectionManager.isMoveState()) {
      selectionManager.commitOffset();
      this.startOffset = selectionManager.getMoveOffset();
      this.startPosition = args.position;
      this.originalBuffer = agent.getNonClampedBuffer().slice();
    } else {
      // sequential move
      this.startOffset = selectionManager.getMoveOffset();
      this.startPosition = args.position;
    }

    // プレビュー状態をリセット
    this.lastPreviewOffset = { x: 0, y: 0 };
    this.pendingOffset = null;
    this.lastPreviewTime = 0;
    if (this.previewAnimationId) {
      cancelAnimationFrame(this.previewAnimationId);
      this.previewAnimationId = null;
    }

    selectionManager.setState(isLayerMove ? 'move_layer' : 'move_selection');

    return {
      shouldUpdate: false,
      shouldRegisterToHistory: false,
    };
  }

  onMove(agent: LayerImageAgent, args: ToolArgs) {
    if (!selectionManager.isSelected()) {
      return {
        shouldUpdate: false,
        shouldRegisterToHistory: false,
      };
    }

    const offsetFromStartX = args.position.x - this.startPosition.x;
    const offsetFromStartY = args.position.y - this.startPosition.y;

    if (offsetFromStartX === 0 && offsetFromStartY === 0)
      return {
        shouldUpdate: false,
        shouldRegisterToHistory: false,
      };

    const offset = { x: this.startOffset.x + offsetFromStartX, y: this.startOffset.y + offsetFromStartY };

    // オフセットの更新とイベント発火は即座に行う（UIの反応性を保つ）
    selectionManager.setMoveOffset(offset);
    eventBus.emit('selection:moved', { newOffset: selectionManager.getMoveOffset() });

    // プレビューの更新はスロットリングして行う
    this.schedulePreviewUpdate(agent, offset.x, offset.y);

    return {
      shouldUpdate: false, // プレビュー更新は非同期で行うため、ここではfalse
      shouldRegisterToHistory: false,
    };
  }

  private schedulePreviewUpdate(agent: LayerImageAgent, dx: number, dy: number) {
    this.pendingOffset = { x: dx, y: dy };

    // 既にアニメーションフレームがスケジュールされている場合はスキップ
    if (this.previewAnimationId) {
      return;
    }

    this.previewAnimationId = requestAnimationFrame(() => {
      this.executePreviewUpdate(agent);
      this.previewAnimationId = null;
    });
  }

  private executePreviewUpdate(agent: LayerImageAgent) {
    if (!this.pendingOffset) return;

    const { x: dx, y: dy } = this.pendingOffset;

    // 同じオフセットでの重複計算を避ける
    if (dx === this.lastPreviewOffset.x && dy === this.lastPreviewOffset.y) {
      this.pendingOffset = null;
      return;
    }

    // スロットリング: 最後のプレビューから最小時間が経過していない場合は再スケジュール
    const now = performance.now();
    if (now - this.lastPreviewTime < this.PREVIEW_THROTTLE_MS) {
      this.previewAnimationId = requestAnimationFrame(() => {
        this.executePreviewUpdate(agent);
        this.previewAnimationId = null;
      });
      return;
    }

    try {
      const previewBuffer = preview_move(
        this.originalBuffer!,
        selectionManager.getSelectionMask().getMask(),
        dx,
        dy,
        agent.getWidth(),
        agent.getHeight()
      );
      agent.setBuffer(new Uint8ClampedArray(previewBuffer.buffer), true, false);
      agent.forceUpdate();

      this.lastPreviewOffset = { x: dx, y: dy };
      this.lastPreviewTime = now;
    } catch (error) {
      console.error('Move preview failed:', error);
    }

    this.pendingOffset = null;
  }

  onEnd(agent: LayerImageAgent, args: ToolArgs) {
    // 最後のプレビュー更新を確実に実行
    if (this.previewAnimationId) {
      cancelAnimationFrame(this.previewAnimationId);
      this.previewAnimationId = null;
    }

    // 未処理のオフセットがある場合は最終更新を実行
    if (this.pendingOffset) {
      this.executePreviewUpdate(agent);
    }

    return {
      shouldUpdate: false,
      shouldRegisterToHistory: false,
    };
  }

  commit() {
    if (!this.layerId || !this.originalBuffer) return;

    // プレビュー更新をクリーンアップ
    if (this.previewAnimationId) {
      cancelAnimationFrame(this.previewAnimationId);
      this.previewAnimationId = null;
    }

    const agent = getAgentOf(this.layerId);
    if (!agent) return;

    agent.getDiffManager().setWhole(new Uint8ClampedArray(this.originalBuffer.buffer), new Uint8ClampedArray(agent.getBuffer()));
    this.originalBuffer = undefined;

    agent.registerToHistory({ tool: TOOL_CATEGORIES.MOVE });
    agent.forceUpdate();

    selectionManager.commit();
    selectionManager.commitOffset();
    selectionManager.clear();

    // 状態をリセット
    this.pendingOffset = null;
    this.lastPreviewOffset = { x: 0, y: 0 };
  }

  cancel() {
    if (!this.layerId || !this.originalBuffer) return;

    // プレビュー更新をクリーンアップ
    if (this.previewAnimationId) {
      cancelAnimationFrame(this.previewAnimationId);
      this.previewAnimationId = null;
    }

    const agent = getAgentOf(this.layerId);
    if (!agent) return;

    if (this.originalBuffer) {
      // 元のバッファに戻す
      agent.setBuffer(new Uint8ClampedArray(this.originalBuffer), true, true);
      this.originalBuffer = undefined;
    }
    agent.forceUpdate();

    // 移動オフセットをリセット
    selectionManager.setMoveOffset(this.startOffset);
    eventBus.emit('selection:moved', { newOffset: this.startOffset });
    selectionManager.setState('selected');

    // 状態をリセット
    this.pendingOffset = null;
    this.lastPreviewOffset = { x: 0, y: 0 };
  }
}
