import { Vec2 } from '@sledge/core';
import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { activeLayer } from '~/controllers/layer/LayerListController';
import { selectionManager } from '~/controllers/selection/SelectionManager';
import { getPresetOf } from '~/controllers/tool/ToolController';
import { ToolArgs, ToolBehavior, ToolResult } from '~/tools/ToolBehavior';
import { TOOL_CATEGORIES, ToolCategoryId } from '~/tools/Tools';
import { colorMatch, RGBAColor } from '~/utils/ColorUtils';
import { drawCompletionLine, getDrawnPixelMask } from './PenDraw';

export class PenTool implements ToolBehavior {
  onlyOnCanvas = false; // 端の補完を確保するため画面外を許可

  startTime: number | undefined = undefined;
  isShift: boolean = false;
  isCtrl: boolean = false;
  private lastPreviewDiff: Array<{ position: Vec2; before: RGBAColor; after: RGBAColor }> = [];

  startPosition: Vec2 | undefined = undefined;
  startPointerPosition: Vec2 | undefined = undefined;

  // 形状マスクのキャッシュ（shape+size 単位）
  private static penMaskCache: Map<string, { mask: Uint8Array; width: number; height: number; offsetX: number; offsetY: number }> = new Map();

  private cacheKey(size: number, shape: 'square' | 'circle') {
    return `${shape}:${size}`;
  }

  private ensureMask(size: number, shape: 'square' | 'circle') {
    const key = this.cacheKey(size, shape);
    let entry = PenTool.penMaskCache.get(key);
    if (!entry) {
      entry = getDrawnPixelMask(size, shape);
      PenTool.penMaskCache.set(key, entry);
    }
    return entry;
  }

  private getCenter(p: Vec2, rawP: Vec2 | undefined, size: number, dotMagnification: number) {
    let cx: number, cy: number;
    if (size % 2 === 0 && rawP) {
      cx = Math.round(rawP.x / dotMagnification);
      cy = Math.round(rawP.y / dotMagnification);
    } else {
      cx = p.x;
      cy = p.y;
    }
    return { cx, cy };
  }

  private stamp(
    agent: LayerImageAgent,
    centerX: number,
    centerY: number,
    mask: { mask: Uint8Array; width: number; height: number; offsetX: number; offsetY: number },
    color: RGBAColor,
    shouldCheckSelectionLimit: boolean,
    commit: boolean,
    previewCollector?: Array<{ position: Vec2; before: RGBAColor; after: RGBAColor }>
  ) {
    const pbm = agent.getPixelBufferManager();
    const dm = agent.getDiffManager();

    const { mask: bits, width, height, offsetX, offsetY } = mask;
    for (let iy = 0; iy < height; iy++) {
      for (let ix = 0; ix < width; ix++) {
        if (bits[iy * width + ix] !== 1) continue;
        const px = centerX + offsetX + ix;
        const py = centerY + offsetY + iy;
        if (shouldCheckSelectionLimit && !selectionManager.isDrawingAllowed({ x: px, y: py }, false)) {
          continue;
        }
        if (!colorMatch(pbm.getPixel({ x: px, y: py }), color)) {
          const changed = agent.setPixel({ x: px, y: py }, color, true);
          if (changed) {
            if (commit) {
              dm.addPixel({ x: px, y: py }, changed.before, changed.after);
            } else if (previewCollector) {
              previewCollector.push({ position: { x: px, y: py }, before: changed.before, after: changed.after });
            } else {
              dm.addPixel({ x: px, y: py }, changed.before, changed.after);
            }
          }
        }
      }
    }
  }
  onStart(agent: LayerImageAgent, args: ToolArgs) {
    // 前回の状態が残っている場合はクリーンアップ
    if (this.lastPreviewDiff.length > 0) {
      console.warn('PenTool: Cleaning up previous preview state');
      this.undoLastLineDiff(agent);
    }

    this.startTime = Date.now();
    this.isShift = args.event?.shiftKey ?? false;
    this.isCtrl = args.event?.ctrlKey ?? false;
    this.startPosition = args.position;
    if (args.event)
      this.startPointerPosition = {
        x: args.event.clientX,
        y: args.event.clientY,
      };

    this.lastPreviewDiff = [];

    // 必要なら形状マスクを準備
    const preset = args.presetName ? (getPresetOf(this.categoryId, args.presetName) as any) : undefined;
    const size = preset?.size ?? 1;
    const shape = (preset?.shape ?? 'square') as 'square' | 'circle';
    this.ensureMask(size, shape);

    if (!this.isShift) {
      return this.draw(agent, args, args.color);
    } else {
      return this.drawLine(false, agent, args, args.color);
    }
  }

  onMove(agent: LayerImageAgent, args: ToolArgs) {
    if (!this.isShift) {
      return this.draw(agent, args, args.color);
    } else {
      return this.drawLine(false, agent, args, args.color);
    }
  }

  protected categoryId: ToolCategoryId = TOOL_CATEGORIES.PEN;

  private SNAP_ANGLE = Math.PI / 12;

  private snapToAngle(current: Vec2, start: Vec2): Vec2 {
    const dx = current.x - start.x;
    const dy = current.y - start.y;
  const angle = Math.atan2(dy, dx);

    // 45度単位でスナップ
    const snapAngle = Math.round(angle / this.SNAP_ANGLE) * this.SNAP_ANGLE;
    const distance = Math.hypot(dx, dy);

    // console.log(`current=(${current.x}, ${current.y}), start=(${start.x}, ${start.y})`);
    // console.log(`position snapped to (${start.x + Math.cos(snapAngle) * distance}, ${start.y + Math.sin(snapAngle) * distance})`);

    return {
      x: Math.round(start.x + Math.cos(snapAngle) * distance),
      y: Math.round(start.y + Math.sin(snapAngle) * distance),
    };
  }

  draw(agent: LayerImageAgent, { position, lastPosition, presetName, event, rawPosition }: ToolArgs, color: RGBAColor): ToolResult {
    if (!presetName) return { shouldUpdate: false, shouldRegisterToHistory: false };

    const preset = getPresetOf(this.categoryId, presetName) as any;
    const size = preset?.size ?? 1;
    const shape = (preset?.shape ?? 'square') as 'square' | 'circle'; // デフォルトは正方形

    const layer = activeLayer();
    const dotMagnification = layer?.dotMagnification ?? 1;

    const shouldCheckSelectionLimit = selectionManager.isSelected() && selectionManager.getSelectionLimitMode() !== 'none';
  const mask = this.ensureMask(size, shape);

    // 現在位置にスタンプ
  const { cx, cy } = this.getCenter(position, rawPosition, size, dotMagnification);
    this.stamp(agent, cx, cy, mask, color, shouldCheckSelectionLimit, true);

    if (lastPosition !== undefined) {
      drawCompletionLine(position, lastPosition, (x: number, y: number) => {
        // 偶数サイズは syntheticRaw を用いて中心を決定
  const syntheticRaw = { x: x * dotMagnification, y: y * dotMagnification } as Vec2;
  const c = this.getCenter({ x, y }, syntheticRaw, size, dotMagnification);
  this.stamp(agent, c.cx, c.cy, mask, color, shouldCheckSelectionLimit, true);
      });
    }

    return {
      shouldUpdate: true,
      shouldRegisterToHistory: false,
    };
  }

  private undoLastLineDiff(agent: LayerImageAgent) {
    const dm = agent.getDiffManager();
    // 前回のプレビューが残っていた場合はundo
    if (this.lastPreviewDiff.length === 0) return;
    try {
      for (const diff of this.lastPreviewDiff) {
        // apply 'before' color; skipExistingDiffCheck=true to ensure applying
        agent.setPixel(diff.position, diff.before, true);
      }
    } catch (error) {
      console.error('Failed to undo line preview:', error);
    } finally {
      this.lastPreviewDiff = [];
    }
  }

  // 始点からの直線を描画
  drawLine(commit: boolean, agent: LayerImageAgent, { position, presetName, event, rawPosition }: ToolArgs, color: RGBAColor): ToolResult {
    if (!presetName || !this.startPosition) return { shouldUpdate: false, shouldRegisterToHistory: false };

    this.undoLastLineDiff(agent);

    // ctrl+shiftの場合は角度固定
    const targetPosition = this.isCtrl && this.startPosition ? this.snapToAngle(position, this.startPosition) : position;

    const preset = getPresetOf(this.categoryId, presetName) as any;
    const size = preset?.size ?? 1;
    const shape = (preset?.shape ?? 'square') as 'square' | 'circle'; // デフォルトは正方形

    const layer = activeLayer();
    const dotMagnification = layer?.dotMagnification ?? 1;

    const shouldCheckSelectionLimit = selectionManager.isSelected() && selectionManager.getSelectionLimitMode() !== 'none';
  const mask = this.ensureMask(size, shape);

    drawCompletionLine(targetPosition, this.startPosition, (x: number, y: number) => {
      // 直線補完の各点に対応する rawPosition を合成し中心決定
  const syntheticRaw = { x: x * dotMagnification, y: y * dotMagnification } as Vec2;
  const c = this.getCenter({ x, y }, syntheticRaw, size, dotMagnification);
  this.stamp(agent, c.cx, c.cy, mask, color, shouldCheckSelectionLimit, commit, commit ? undefined : this.lastPreviewDiff);
    });

    return {
      shouldUpdate: true,
      shouldRegisterToHistory: false,
    };
  }

  onEnd(agent: LayerImageAgent, args: ToolArgs) {
    if (this.isShift) {
      // 直線を確定
      this.drawLine(true, agent, args, args.color);
    }

    // 描画完了時にバッチを強制処理
  agent.getDiffManager().flush();
  const totalPx = agent.getDiffManager().getPendingPixelCount();
    const resultText =
      totalPx > 0
        ? `${this.categoryId} stroke done. (${this.startTime ? `${Date.now() - this.startTime}ms /` : ''} ${totalPx}px updated)`
        : undefined;

    this.isShift = false;
    this.isCtrl = false;
    this.startPosition = undefined;
    this.lastPreviewDiff = [];

    return {
      result: resultText,
      shouldUpdate: true,
      shouldRegisterToHistory: true,
    };
  }

  onCancel(agent: LayerImageAgent, args: ToolArgs) {
    if (this.isShift) {
      this.undoLastLineDiff(agent);
    }

    this.isShift = false;
    this.isCtrl = false;
    this.startPosition = undefined;
    // this.originalBuffer = undefined;
    this.startTime = undefined;

    this.lastPreviewDiff = [];

    return {
      shouldUpdate: false,
      shouldRegisterToHistory: false,
    };
  }
}
