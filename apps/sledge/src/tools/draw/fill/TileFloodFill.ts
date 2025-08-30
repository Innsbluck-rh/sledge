import { Vec2 } from '@sledge/core';
import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { TileIndex } from '~/controllers/layer/image/managers/Tile';
import { colorMatch } from '~/utils/ColorUtils';
import { Fill, FillProps } from './FillTool';

export interface MaskFillProps {
  agent: LayerImageAgent;
  color: [number, number, number, number];
  position: Vec2;
  selectionMask: Uint8Array;
  limitMode: 'inside' | 'outside';
}

export class TileFloodFill implements Fill {
  fill({ agent, color, position }: FillProps) {
    const pbm = agent.getPixelBufferManager();
    const tm = agent.getTileManager();
    const dm = agent.getDiffManager();

    const targetColor = pbm.getPixel(position);
    if (colorMatch(targetColor, color)) return false;

    const tileRowCount = tm.getTileRowCount();
    const tileColumnCount = tm.getTileColumnCount();
    const flatten = (ti: TileIndex) => ti.row * tileColumnCount + ti.column;
    const tileUniformMatches = (ti: TileIndex) => {
      const tile = tm.getTile(ti);
      return tile.isUniform && tile.uniformColor && colorMatch(tile.uniformColor, targetColor);
    };

    const visitedTiles = new Uint8Array(tileRowCount * tileColumnCount);
    const tilesFilled: TileIndex[] = [];
    const tileQueue: TileIndex[] = [tm.getTileIndex(position)];

  const pxDiffs: Array<{ position: Vec2; before: [number, number, number, number]; after: [number, number, number, number] }> = [];
    const visitedPx = new Uint8Array(agent.getWidth() * agent.getHeight());

    // First tile flood pass
    let tileFillCount = 0;
    while (tileQueue.length > 0) {
      const ti = tileQueue.pop()!;
      if (!tm.isTileInBounds(ti)) continue;
      const i = flatten(ti);
      if (visitedTiles[i]) continue;
      visitedTiles[i] = 1;
      if (!tileUniformMatches(ti)) continue;

      tilesFilled.push(ti);
      tileFillCount++;
      tileQueue.push({ row: ti.row - 1, column: ti.column });
      tileQueue.push({ row: ti.row + 1, column: ti.column });
      tileQueue.push({ row: ti.row, column: ti.column - 1 });
      tileQueue.push({ row: ti.row, column: ti.column + 1 });
    }
    for (const ti of tilesFilled) {
      const offset = tm.getTile(ti).getOffset();
      for (let dy = 0; dy < tm.TILE_SIZE; dy++) {
        for (let dx = 0; dx < tm.TILE_SIZE; dx++) {
          const x = offset.x + dx;
          const y = offset.y + dy;
          const i = y * agent.getWidth() + x;
          visitedPx[i] = 1;
        }
      }
    }
    console.log(`initial tile fill finished: ${tileFillCount} tiles`);

    const edgePixels = tilesFilled.length > 0 ? this.collectEdgePixels(agent, tilesFilled) : [position];

    const pixelQueue: Vec2[] = edgePixels;
    const pixelsFilled: Vec2[] = [];
    const pxIndex = (p: Vec2) => p.y * agent.getWidth() + p.x;

    let pixelFillCount = 0;
    while (pixelQueue.length > 0) {
      const p = pixelQueue.pop()!;
      if (!pbm.isInBounds(p)) continue;

      const idx = pxIndex(p);
      if (visitedPx[idx]) continue;
      visitedPx[idx] = 1;

      const tileIndex = tm.getTileIndex(p);
      const tileIdxFlat = flatten(tileIndex);
      const tilesFilledInReEntry: TileIndex[] = [];
      if (!visitedTiles[tileIdxFlat] && tileUniformMatches(tileIndex)) {
        const reentryQueue: TileIndex[] = [tileIndex];
        let reentryCount = 0;
        while (reentryQueue.length > 0) {
          const ti = reentryQueue.pop()!;
          if (!tm.isTileInBounds(ti)) continue;
          const i = flatten(ti);
          if (visitedTiles[i]) continue;
          visitedTiles[i] = 1;
          if (!tileUniformMatches(ti)) continue;
          tilesFilled.push(ti);
          tilesFilledInReEntry.push(ti);
          reentryCount++;
          reentryQueue.push({ row: ti.row - 1, column: ti.column });
          reentryQueue.push({ row: ti.row + 1, column: ti.column });
          reentryQueue.push({ row: ti.row, column: ti.column - 1 });
          reentryQueue.push({ row: ti.row, column: ti.column + 1 });
        }
        const newEdges = this.collectEdgePixels(agent, tilesFilledInReEntry);
        for (const edge of newEdges) {
          pixelQueue.push(edge);
        }
        for (const ti of tilesFilled) {
          const offset = tm.getTile(ti).getOffset();
          for (let dy = 0; dy < tm.TILE_SIZE; dy++) {
            for (let dx = 0; dx < tm.TILE_SIZE; dx++) {
              const x = offset.x + dx;
              const y = offset.y + dy;
              const i = y * agent.getWidth() + x;
              visitedPx[i] = 1;
            }
          }
        }
        console.log(`tile reentry fill: ${reentryCount} tiles`);
        continue;
      }

      if (!colorMatch(pbm.getPixel(p), targetColor)) continue;
      pixelsFilled.push(p);
      pixelFillCount++;
      pixelQueue.push({ x: p.x + 1, y: p.y });
      pixelQueue.push({ x: p.x - 1, y: p.y });
      pixelQueue.push({ x: p.x, y: p.y + 1 });
      pixelQueue.push({ x: p.x, y: p.y - 1 });
    }
    console.log(`pixel fill finished: ${pixelFillCount} pixels`);

    for (const ti of tilesFilled) tm.fillWholeTile(ti, color, true);
    for (const p of pixelsFilled) {
      const changed = agent.setPixel(p, color, false);
      if (changed) dm.addPixel(p, changed.before, changed.after);
    }
  }

  fillWithMask({ agent, color, position, selectionMask, limitMode }: MaskFillProps) {
    const pbm = agent.getPixelBufferManager();
    const dm = agent.getDiffManager();
    const width = agent.getWidth();

    const targetColor = pbm.getPixel(position);
    if (colorMatch(targetColor, color)) return false;

    // 選択範囲制限チェック関数
    const isAllowedPosition = (pos: Vec2) => {
      const maskIndex = pos.y * width + pos.x;
      const isInSelection = selectionMask[maskIndex] === 1;

      if (limitMode === 'inside') {
        return isInSelection; // 選択範囲内のみ許可
      } else {
        return !isInSelection; // 選択範囲外のみ許可
      }
    };

    // 開始位置が制限に違反していないかチェック
    if (!isAllowedPosition(position)) {
      return false;
    }

    // シンプルなピクセル単位FloodFill（選択範囲制限付き）
    const pixelQueue: Vec2[] = [position];
    const pixelsFilled: Vec2[] = [];
    const visitedPx = new Uint8Array(width * agent.getHeight());
    const pxIndex = (p: Vec2) => p.y * width + p.x;

    while (pixelQueue.length > 0) {
      const p = pixelQueue.pop()!;
      if (!pbm.isInBounds(p)) continue;

      const idx = pxIndex(p);
      if (visitedPx[idx]) continue;
      visitedPx[idx] = 1;

      // 色のチェック
      if (!colorMatch(pbm.getPixel(p), targetColor)) continue;

      // 選択範囲制限チェック
      if (!isAllowedPosition(p)) continue;

      pixelsFilled.push(p);

      // 隣接ピクセルを追加
      pixelQueue.push({ x: p.x + 1, y: p.y });
      pixelQueue.push({ x: p.x - 1, y: p.y });
      pixelQueue.push({ x: p.x, y: p.y + 1 });
      pixelQueue.push({ x: p.x, y: p.y - 1 });
    }

    // ピクセルを塗りつぶし
    for (const p of pixelsFilled) {
      const changed = agent.setPixel(p, color, false);
      if (changed) dm.addPixel(p, changed.before, changed.after);
    }

    console.log(`boundary-constrained fill finished: ${pixelsFilled.length} pixels`);
  }

  collectEdgePixels(agent: LayerImageAgent, filled: TileIndex[]): Vec2[] {
    const tm = agent.getTileManager();

    const edge: Vec2[] = [];
    const TILE_SIZE = tm.TILE_SIZE;
    const filledSet = new Set(filled.map((t) => `${t.row},${t.column}`));

    for (const ti of filled) {
      const offset = tm.getTile(ti).getOffset();
      const neighbors = [
        { dr: -1, dc: 0, dx: 0, dy: -1, axis: 'x' },
        { dr: 1, dc: 0, dx: 0, dy: TILE_SIZE, axis: 'x' },
        { dr: 0, dc: -1, dx: -1, dy: 0, axis: 'y' },
        { dr: 0, dc: 1, dx: TILE_SIZE, dy: 0, axis: 'y' },
      ];

      for (const { dr, dc, dx, dy, axis } of neighbors) {
        const ni = `${ti.row + dr},${ti.column + dc}`;
        if (filledSet.has(ni)) continue;
        for (let i = 0; i < TILE_SIZE; i++) {
          const x = axis === 'x' ? offset.x + i : offset.x + dx;
          const y = axis === 'y' ? offset.y + i : offset.y + dy;
          edge.push({ x, y });
        }
      }
    }
    return edge;
  }
}
