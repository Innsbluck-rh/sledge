import { Size2D, Vec2 } from '@sledge/core';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { LayerBufferHistoryAction, LayerBufferPatch } from '~/controllers/history/actions/LayerBufferHistoryAction';
import { TileIndex } from '~/controllers/layer/image/managers/Tile';
import { setProjectStore } from '~/stores/ProjectStores';
import { colorMatch, RGBAColor } from '~/utils/ColorUtils';
import { eventBus } from '~/utils/EventBus';
import DiffManager from './managers/DiffManager';
import PixelBufferManager from './managers/PixelBufferManager';
import TileManager from './managers/TileManager';

// Agent that manages per-layer image operations: buffer, tiles, diffs, and applying history actions
export default class LayerImageAgent {
  protected pbm: PixelBufferManager;
  protected tm: TileManager;
  protected dm: DiffManager;

  getPixelBufferManager() {
    return this.pbm;
  }
  getTileManager() {
    return this.tm;
  }
  getDiffManager() {
    return this.dm;
  }

  getWidth = (): number => this.pbm.width;
  getHeight = (): number => this.pbm.height;

  constructor(
    public layerId: string,
    buffer: Uint8ClampedArray,
    width: number,
    height: number
  ) {
  this.pbm = new PixelBufferManager(buffer, width, height);
  this.tm = new TileManager(
      width,
      height,
      (position: Vec2) => this.pbm.getPixel(position),
      (i: number, v: number) => (this.pbm.buffer[i] = v),
      (index: TileIndex, uniformColor: RGBAColor | undefined, fillColor: RGBAColor) =>
        this.dm.addTileFill(index, uniformColor, fillColor)
    );
  this.dm = new DiffManager(this.tm);
  }

  getBuffer(): Uint8ClampedArray {
    return this.pbm.buffer;
  }

  getNonClampedBuffer(): Uint8Array {
    return new Uint8Array(this.pbm.buffer.buffer, this.pbm.buffer.byteOffset, this.pbm.buffer.byteLength);
  }

  setBuffer(rawBuffer: Uint8ClampedArray, silentlySet: boolean = false, updatePreview: boolean = false) {
    setProjectStore('isProjectChangedAfterSave', true);
    this.pbm.buffer = rawBuffer;
    this.tm.setAllDirty();
    if (!silentlySet) {
      eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${this.layerId}) buffer set` });
      if (updatePreview) eventBus.emit('preview:requestUpdate', { layerId: this.layerId });
    }
  }

  forceUpdate() {
    eventBus.emit('webgl:requestUpdate', { onlyDirty: false, context: `Layer(${this.layerId}) force update` });
    eventBus.emit('preview:requestUpdate', { layerId: this.layerId });
  }

  changeBufferSize(newSize: Size2D, emitEvent?: boolean) {
    setProjectStore('isProjectChangedAfterSave', true);
    this.pbm.changeSize(newSize);
    this.tm.setSize(newSize);
    if (emitEvent) {
      this.tm.setAllDirty();
      eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${this.layerId}) buffer size changed` });
      eventBus.emit('preview:requestUpdate', { layerId: this.layerId });
    }
    // this.callOnImageChangeListeners({ newSize, updatePreview: true });
  }

  public registerToHistory(context?: any) {
    // Patchのみで履歴登録
    this.dm.flush();
    const patch = this.dm.buildPatch(this.layerId);
    if (patch) {
      const action = new LayerBufferHistoryAction(this.layerId, patch, { from: 'LayerImageAgent.registerToHistory', ...context });
      projectHistoryController.addAction(action);
    }
    this.dm.reset();
  }



  public setPixel(position: Vec2, color: RGBAColor, skipExistingDiffCheck: boolean): { before: RGBAColor; after: RGBAColor } | undefined {
    setProjectStore('isProjectChangedAfterSave', true);
    if (!this.pbm.isInBounds(position)) return undefined;
    if (!skipExistingDiffCheck && this.dm.isDiffExists(position)) return undefined;
  const result = this.pbm.setRawPixel(position, color);
    if (result !== undefined) {
      const tileIndex = this.tm.getTileIndex(position);
      this.tm.tiles[tileIndex.row][tileIndex.column].isDirty = true;

      const tile = this.tm.getTile(tileIndex);
      if (tile.isUniform && tile.uniformColor !== undefined && !colorMatch(tile.uniformColor, color)) {
        this.tm.tiles[tileIndex.row][tileIndex.column].isUniform = false;
        this.tm.tiles[tileIndex.row][tileIndex.column].uniformColor = undefined;
      }
    }
  return result;
  }

  // Apply new SoA patch format (undo path uses "before", redo uses "after").
  public undoPatch(patch: LayerBufferPatch) {
    setProjectStore('isProjectChangedAfterSave', true);

    // Whole buffer restore first if present
    if (patch.whole) {
      this.setBuffer(patch.whole.before, true, false);
    } else {
      // Tile fills (prefer restoring previous color if available)
      if (patch.tiles) {
        for (const t of patch.tiles) {
          if (t.before !== undefined) {
            const color: RGBAColor = [(t.before >> 16) & 0xff, (t.before >> 8) & 0xff, t.before & 0xff, (t.before >>> 24) & 0xff];
            this.tm.fillWholeTile(t.tile, color, false);
          } else {
            // no-op here; pixel patches (if any) will reconstruct non-uniform content
            const tile = this.tm.getTile(t.tile);
            tile.isDirty = true;
            tile.isUniform = false;
            tile.uniformColor = undefined;
          }
        }
      }

      // Pixel lists (write previous values)
      if (patch.pixels) {
        for (const px of patch.pixels) {
          this.applyPixelList(px, true);
        }
      }
    }

    eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${this.layerId}) undo (patch)` });
    eventBus.emit('preview:requestUpdate', { layerId: this.layerId });
  }

  public redoPatch(patch: LayerBufferPatch) {
    setProjectStore('isProjectChangedAfterSave', true);

    if (patch.whole) {
      this.setBuffer(patch.whole.after, true, false);
    } else {
      // Tile fills first (apply new uniform color)
      if (patch.tiles) {
        for (const t of patch.tiles) {
          const color: RGBAColor = [(t.after >> 16) & 0xff, (t.after >> 8) & 0xff, t.after & 0xff, (t.after >>> 24) & 0xff];
          this.tm.fillWholeTile(t.tile, color, false);
        }
      }

      // Pixel lists (apply new pixel values)
      if (patch.pixels) {
        for (const px of patch.pixels) {
          this.applyPixelList(px, false);
        }
      }
    }

    eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: `Layer(${this.layerId}) redo (patch)` });
    eventBus.emit('preview:requestUpdate', { layerId: this.layerId });
  }

  private applyPixelList(pxPatch: { tile: any; idx: Uint16Array; before: Uint32Array; after: Uint32Array }, useBefore: boolean) {
    const tile = this.tm.getTile(pxPatch.tile);
    const { x: ox, y: oy } = tile.getOffset();
    const tileSize = this.tm.TILE_SIZE;
    const w = this.pbm.width;
    const h = this.pbm.height;
    const buf = this.pbm.buffer;

    // The tile becomes non-uniform when applying arbitrary pixels
    tile.isDirty = true;
    tile.isUniform = false;
    tile.uniformColor = undefined;

    const values = useBefore ? pxPatch.before : pxPatch.after;
    const N = pxPatch.idx.length;
    for (let i = 0; i < N; i++) {
      const local = pxPatch.idx[i];
      const dx = local % tileSize;
      const dy = (local / tileSize) | 0;
      const x = ox + dx;
      const y = oy + dy;
      if (x >= w || y >= h) continue; // guard for boundary tiles
      const ptr = (y * w + x) * 4;

      const packed = values[i] >>> 0; // ensure unsigned
      buf[ptr] = (packed >> 16) & 0xff; // R
      buf[ptr + 1] = (packed >> 8) & 0xff; // G
      buf[ptr + 2] = packed & 0xff; // B
      buf[ptr + 3] = (packed >>> 24) & 0xff; // A
    }
  }
}
