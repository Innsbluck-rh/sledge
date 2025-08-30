import { Vec2 } from '@sledge/core';
import { filter_by_selection_mask } from '@sledge/wasm';
import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { selectionManager } from '~/controllers/selection/SelectionManager';
import { getPresetOf } from '~/controllers/tool/ToolController';
import { WasmFloodFill } from '~/tools/draw/fill/WasmFloodFill';
import { ToolArgs, ToolBehavior } from '~/tools/ToolBehavior';
import { RGBAColor } from '~/utils/ColorUtils';
import { addDebugImage, endDebugSession, startDebugSession, visualizeSelectionMask } from '~/utils/DebugViewer';

export interface FillProps {
  agent: LayerImageAgent;
  color: RGBAColor;
  position: Vec2;
  threshold?: number;
}
export interface Fill {
  fill: (props: FillProps) => void;
}

export class FillTool implements ToolBehavior {
  onlyOnCanvas = true;

  onStart(agent: LayerImageAgent, { position, color, presetName }: ToolArgs) {
    const startTime = Date.now();

    // 描画制限チェック
    if (!selectionManager.isDrawingAllowed(position, true)) {
      return {
        shouldUpdate: false,
        shouldRegisterToHistory: false,
      };
    }
    const preset = presetName ? (getPresetOf('fill', presetName) as any) : undefined;
    const threshold = preset?.threshold ?? 0;

    const limitMode = selectionManager.getSelectionLimitMode();

    if (limitMode === 'none' || !selectionManager.isSelected()) {
      // 制限なしの場合はWASM FloodFill
      const fill = new WasmFloodFill();
      fill.fill({ agent, color, position, threshold });
      agent.getTileManager().setAllDirty();
    } else {
      // 選択範囲制限がある場合
      this.fillWithSelectionConstraint(agent, color, position, threshold);
    }

    const endTime = Date.now();

    return {
      result: `Flood Fill done. (in ${endTime - startTime} ms)`,
      shouldUpdate: true,
      shouldRegisterToHistory: true,
    };
  }

  private fillWithSelectionConstraint(agent: LayerImageAgent, color: RGBAColor, position: Vec2, threshold?: number) {
    const selectionMask = selectionManager.getSelectionMask();
    const limitMode = selectionManager.getSelectionLimitMode();
    const fillMode = selectionManager.getSelectionFillMode();

    // 選択範囲がない、または制限モードがnoneの場合は通常のフラッドフィル
    if (!selectionMask || limitMode === 'none') {
      const fill = new WasmFloodFill();
      fill.fill({ agent, color, position, threshold });
      return;
    }

    if (fillMode === 'global') {
      this.fillWithGlobalReference(agent, color, position, selectionMask.getMask(), limitMode, threshold);
    } else if (fillMode === 'boundary') {
      this.fillWithBoundaryConstraint(agent, color, position, selectionMask.getMask(), limitMode, threshold);
    } else if (fillMode === 'area') {
      this.fillWithAreaMode(agent, color, position, selectionMask.getMask(), limitMode);
    }
  }

  private fillWithGlobalReference(
    agent: LayerImageAgent,
    color: RGBAColor,
    position: Vec2,
    selectionMask: Uint8Array,
    limitMode: 'inside' | 'outside',
    threshold?: number
  ): void {
    const bufferManager = agent.getPixelBufferManager();
    const sourceBuffer = bufferManager.buffer.slice();
    const width = agent.getWidth();
    const height = agent.getHeight();

    // デバッグセッション開始
    const sessionId = startDebugSession(`FloodFill ${limitMode} mode (Global)`);

    // 元画像を記録
    addDebugImage(sourceBuffer, width, height, '1. Original Image', sessionId);

    // 選択マスクを可視化して記録
    if (selectionMask) {
      const maskVisualization = visualizeSelectionMask(selectionMask, width, height);
      addDebugImage(maskVisualization, width, height, '2. Selection Mask', sessionId);
    }

    const fill = new WasmFloodFill();
    fill.fill({ agent, color, position, threshold });

    const currentBuffer = bufferManager.buffer;

    // フラッドフィル結果を記録
    addDebugImage(currentBuffer.slice(), width, height, '3. Flood Fill Result', sessionId);

    // フラッドフィル結果から選択範囲に応じた部分を抽出
    const fillResult = filter_by_selection_mask(new Uint8Array(currentBuffer.buffer), selectionMask, limitMode, width, height);
    addDebugImage(fillResult, width, height, `4. Filtered (${limitMode})`, sessionId);

    // 元画像から逆の範囲を保持
    const preserveMode = limitMode === 'inside' ? 'outside' : 'inside';
    const preservedBuffer = filter_by_selection_mask(new Uint8Array(sourceBuffer), selectionMask, preserveMode, width, height);
    addDebugImage(preservedBuffer, width, height, `5. Preserved (${preserveMode})`, sessionId);

    // 2つのバッファを合成
    const finalBuffer = new Uint8ClampedArray(currentBuffer.length);
    for (let i = 0; i < finalBuffer.length; i += 4) {
      const pixelIndex = i / 4;
      const isInSelection = selectionMask[pixelIndex] === 1;

      if ((limitMode === 'inside' && isInSelection) || (limitMode === 'outside' && !isInSelection)) {
        // 対象範囲：フラッドフィル結果を使用
        finalBuffer[i] = fillResult[i];
        finalBuffer[i + 1] = fillResult[i + 1];
        finalBuffer[i + 2] = fillResult[i + 2];
        finalBuffer[i + 3] = fillResult[i + 3];
      } else {
        // それ以外：元画像を保持
        finalBuffer[i] = preservedBuffer[i];
        finalBuffer[i + 1] = preservedBuffer[i + 1];
        finalBuffer[i + 2] = preservedBuffer[i + 2];
        finalBuffer[i + 3] = preservedBuffer[i + 3];
      }
    }

    // 最終結果を記録
    addDebugImage(finalBuffer, width, height, '6. Final Result', sessionId);

    // バッファ全体の差分を履歴に記録
    const dm = agent.getDiffManager();
    dm.setWhole(sourceBuffer, finalBuffer.slice());

    // 最終結果を設定
    // new Uint8Array(currentBuffer).set(finalBuffer); 前の
    currentBuffer.set(finalBuffer);

    // デバッグセッション終了とビューア表示
    endDebugSession();
    // openDebugViewer();
  }

  private fillWithBoundaryConstraint(
    agent: LayerImageAgent,
    color: RGBAColor,
    position: Vec2,
    selectionMask: Uint8Array,
    limitMode: 'inside' | 'outside',
    threshold?: number
  ): void {
    const bufferManager = agent.getPixelBufferManager();
    const width = agent.getWidth();
    const height = agent.getHeight();

    // デバッグセッション開始
    const sessionId = startDebugSession(`FloodFill ${limitMode} mode (Boundary)`);

    // 元画像を記録
    addDebugImage(bufferManager.buffer.slice(), width, height, '1. Original Image', sessionId);

    // 選択マスクを可視化して記録
    if (selectionMask) {
      const maskVisualization = visualizeSelectionMask(selectionMask, width, height);
      addDebugImage(maskVisualization, width, height, '2. Selection Mask', sessionId);
    }

    const fill = new WasmFloodFill();
    fill.fillWithMask({
      agent,
      color,
      position,
      selectionMask,
      limitMode,
      threshold,
    });

    // 境界制限フラッドフィル結果を記録
    addDebugImage(bufferManager.buffer.slice(), width, height, '3. Boundary-Constrained Result', sessionId);

    // デバッグセッション終了とビューア表示
    endDebugSession();
    // openDebugViewer();
  }

  private fillWithAreaMode(
    agent: LayerImageAgent,
    color: RGBAColor,
    position: Vec2,
    selectionMask: Uint8Array,
    limitMode: 'inside' | 'outside'
  ): void {
    const bufferManager = agent.getPixelBufferManager();
    const width = agent.getWidth();
    const height = agent.getHeight();

    // デバッグセッション開始
    const sessionId = startDebugSession(`FloodFill ${limitMode} mode (Area Fill)`);

    // 元画像を記録
    const sourceBuffer = bufferManager.buffer.slice();
    addDebugImage(sourceBuffer, width, height, '1. Original Image', sessionId);

    // 選択マスクを可視化して記録
    const maskVisualization = visualizeSelectionMask(selectionMask, width, height);
    addDebugImage(maskVisualization, width, height, '2. Selection Mask', sessionId);

    // 選択範囲全体を指定色で塗りつぶし
    const currentBuffer = bufferManager.buffer;
    for (let i = 0; i < selectionMask.length; i++) {
      const isInSelection = selectionMask[i] === 1;
      const shouldFill = (limitMode === 'inside' && isInSelection) || (limitMode === 'outside' && !isInSelection);

      if (shouldFill) {
        const bufferIndex = i * 4;
        currentBuffer[bufferIndex] = color[0]; // R
        currentBuffer[bufferIndex + 1] = color[1]; // G
        currentBuffer[bufferIndex + 2] = color[2]; // B
        currentBuffer[bufferIndex + 3] = color[3]; // A
      }
    }

    // バッファ全体の差分を履歴に記録
    const dm = agent.getDiffManager();
    dm.setWhole(sourceBuffer, currentBuffer.slice());

    // 結果を記録
    addDebugImage(currentBuffer.slice(), width, height, '3. Area Fill Result', sessionId);

    // デバッグセッション終了とビューア表示
    endDebugSession();
    // openDebugViewer();
  }

  onMove(agent: LayerImageAgent, args: ToolArgs) {
    return {
      shouldUpdate: false,
      shouldRegisterToHistory: false,
    };
  }

  onEnd(agent: LayerImageAgent, args: ToolArgs) {
    return {
      shouldUpdate: false,
      shouldRegisterToHistory: false,
    };
  }
}
