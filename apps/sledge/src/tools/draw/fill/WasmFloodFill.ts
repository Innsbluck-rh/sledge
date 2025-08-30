import { Vec2 } from '@sledge/core';
import { scanline_flood_fill, scanline_flood_fill_with_mask } from '@sledge/wasm';
import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { colorMatch } from '~/utils/ColorUtils';
import { Fill, FillProps } from './FillTool';

export interface WasmMaskFillProps {
  agent: LayerImageAgent;
  color: [number, number, number, number];
  position: Vec2;
  selectionMask: Uint8Array;
  limitMode: 'inside' | 'outside';
  threshold?: number;
}

/**
 * WASM実装のスキャンライン方式FloodFill
 *
 * 特徴：
 * - 確実で高速なスキャンライン方式
 * - タイルベースの複雑さを排除
 * - メモリ効率的
 * - 選択範囲制限サポート
 */
export class WasmFloodFill implements Fill {
  fill({ agent, color, position, threshold }: FillProps) {
    const pbm = agent.getPixelBufferManager();
    const dm = agent.getDiffManager();

    const targetColor = pbm.getPixel(position);
    if (colorMatch(targetColor, color)) return false;

    const width = agent.getWidth();
    const height = agent.getHeight();

    const originalBuffer = new Uint8ClampedArray(agent.getBuffer());
    const startTime = performance.now();

    // WASM FloodFill実行
    const success = scanline_flood_fill(
      new Uint8Array(pbm.buffer.buffer),
      width,
      height,
      position.x,
      position.y,
      color[0],
      color[1],
      color[2],
      color[3],
      threshold ?? 0
    );

    dm.setWhole(originalBuffer, agent.getBuffer());
    const endTime = performance.now();
    console.log(`WASM FloodFill completed in ${(endTime - startTime).toFixed(2)}ms`);

    if (!success) {
      console.log('WASM FloodFill failed or no changes made');
      return false;
    }

    // 結果をメインバッファに反映
    // pbm.buffer.set(workingBuffer);

    return true;
  }

  fillWithMask({ agent, color, position, selectionMask, limitMode, threshold }: WasmMaskFillProps) {
    const pbm = agent.getPixelBufferManager();
    const dm = agent.getDiffManager();

    const targetColor = pbm.getPixel(position);
    if (colorMatch(targetColor, color)) return false;

    const width = agent.getWidth();
    const height = agent.getHeight();

    const originalBuffer = new Uint8ClampedArray(agent.getBuffer());
    const startTime = performance.now();

    // WASM 選択範囲制限付きFloodFill実行
    const success = scanline_flood_fill_with_mask(
      new Uint8Array(pbm.buffer.buffer),
      width,
      height,
      position.x,
      position.y,
      color[0],
      color[1],
      color[2],
      color[3],
      threshold ?? 0,
      selectionMask,
      limitMode
    );

    dm.setWhole(originalBuffer, agent.getBuffer());
    const endTime = performance.now();
    console.log(`WASM FloodFill with mask (${limitMode}) completed in ${(endTime - startTime).toFixed(2)}ms`);

    if (!success) {
      console.log('WASM FloodFill with mask failed or no changes made');
      return false;
    }

    return true;
  }
}
