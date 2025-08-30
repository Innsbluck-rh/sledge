import { Size2D, Vec2 } from '@sledge/core';
import { colorMatch, RGBAColor } from '~/utils/ColorUtils';
import Tile, { TileIndex } from './Tile';

export default class TileManager {
  readonly TILE_SIZE = 32;

  public tiles: Tile[][] = [];

  constructor(
    public width: number,
    public height: number,
    private getPixel: (position: Vec2) => RGBAColor,
    private setData: (i: number, v: number) => void,
    private addTileDiff: (index: TileIndex, uniformColor: RGBAColor | undefined, fillColor: RGBAColor) => void
  ) {
    this.initTile();
  }

  setSize(size: Size2D) {
    this.width = size.width;
    this.height = size.height;
    this.initTile();
  }

  getTile(index: TileIndex) {
    return this.tiles[index.row][index.column];
  }

  initTile() {
    this.tiles = [];
    const tileRowCount = Math.ceil(this.height / this.TILE_SIZE);
    const tileColumnCount = Math.ceil(this.width / this.TILE_SIZE);
    for (let row = 0; row < tileRowCount; row++) {
      this.tiles[row] = [];
      for (let column = 0; column < tileColumnCount; column++) {
        this.tiles[row][column] = new Tile(row, column, this.TILE_SIZE);
      }
    }

    this.scanAllTilesUniformity();
  }

  scanAllTilesUniformity() {
    const w = this.width;
    const h = this.height;

    for (const row of this.tiles) {
      for (const tile of row) {
        const { x: ox, y: oy } = tile.getOffset();

        const base = this.getPixel({ x: ox, y: oy });

        let uniform = true;
        for (let dy = 0; dy < this.TILE_SIZE && uniform; dy++) {
          const py = oy + dy;
          if (py >= h) break;
          for (let dx = 0; dx < this.TILE_SIZE; dx++) {
            const px = ox + dx;
            if (px >= w) break;
            if (!colorMatch(this.getPixel({ x: px, y: py }), base)) {
              uniform = false;
              break;
            }
          }
        }
        tile.isUniform = uniform;
        tile.uniformColor = uniform ? base : undefined;
      }
    }
  }

  public getTileIndex(layerPosition: Vec2): TileIndex {
    const row = Math.floor(layerPosition.y / this.TILE_SIZE);
    const column = Math.floor(layerPosition.x / this.TILE_SIZE);
    return { row, column };
  }

  public setAllDirty() {
    this.tiles = this.tiles.map((tR) => {
      tR = tR.map((t) => {
        t.isDirty = true;
        return t;
      });
      return tR;
    });
  }

  public resetDirtyStates() {
    this.tiles = this.tiles.map((tR) => {
      tR = tR.map((t) => {
        t.isDirty = false;
        return t;
      });
      return tR;
    });
  }

  public getDirtyTiles(): Tile[] {
    return this.tiles.flatMap((tR) => tR.filter((t) => t.isDirty));
  }

  fillWholeTile(index: TileIndex, color: RGBAColor, collectDiff = true) {
    const tile = this.getTile(index);
    if (tile.isUniform && tile.uniformColor && colorMatch(tile.uniformColor, color)) return;

    const [r, g, b, a] = color;
    const { x: ox, y: oy } = tile.getOffset();
    const { TILE_SIZE } = this;

    for (let dy = 0; dy < TILE_SIZE; dy++) {
      const y = oy + dy;
      if (y >= this.height) break;
      let i = (y * this.width + ox) * 4; // 行頭インデックス
      for (let dx = 0; dx < TILE_SIZE; dx++) {
        const x = ox + dx;
        if (x >= this.width) break;

        this.setData(i, r);
        this.setData(i + 1, g);
        this.setData(i + 2, b);
        this.setData(i + 3, a);
        i += 4;
      }
    }

    if (collectDiff) this.addTileDiff(index, tile.uniformColor, color);

    // Update tile state
    tile.isDirty = true;
    tile.isUniform = true;
    tile.uniformColor = color;
  }

  public getTileRowCount() {
    return this.tiles.length;
  }

  public getTileColumnCount() {
    return this.tiles[0].length;
  }

  public isTileInBounds(index: TileIndex) {
    return index.row >= 0 && index.row < this.getTileRowCount() && index.column >= 0 && index.column < this.getTileColumnCount();
  }
}
