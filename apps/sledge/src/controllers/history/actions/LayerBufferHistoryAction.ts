import { BaseHistoryAction } from '~/controllers/history/actions/BaseHistoryAction';
import { TileIndex } from '~/controllers/layer/image/managers/Tile';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { selectionManager } from '~/controllers/selection/SelectionManager';
import { cancelMove } from '~/controllers/selection/SelectionOperator';
import { RGBAColor } from '~/utils/ColorUtils';


// Packed color helpers (AABBGGRR or similar). We'll use little-endian RR GG BB AA for clarity in JS.
export type PackedRGBA = number; // 0xAARRGGBB
export const packRGBA = (c: RGBAColor): PackedRGBA => (c[3] << 24) | (c[0] << 16) | (c[1] << 8) | c[2];
export const unpackRGBA = (p: PackedRGBA): RGBAColor => [(p >> 16) & 0xff, (p >> 8) & 0xff, p & 0xff, (p >>> 24) & 0xff];

// Tile-bucketed SoA patch representation
export type PixelListPatch = {
  type: 'pixels';
  tile: TileIndex;
  idx: Uint16Array; // tile-local indices
  before: Uint32Array; // packed RGBA
  after: Uint32Array; // packed RGBA
};

export type TileFillPatch = {
  type: 'tileFill';
  tile: TileIndex;
  before?: PackedRGBA;
  after: PackedRGBA;
};

export type WholePatch = {
  type: 'whole';
  before: Uint8ClampedArray;
  after: Uint8ClampedArray;
};

export type LayerBufferPatch = {
  layerId: string;
  pixels?: PixelListPatch[];
  tiles?: TileFillPatch[];
  whole?: WholePatch;
};

// history action for layer buffer changes
export class LayerBufferHistoryAction extends BaseHistoryAction {
  readonly type = 'layer_buffer' as const;

  constructor(
    public readonly layerId: string,
    public readonly patch: LayerBufferPatch,
    context?: any
  ) {
    super(context, `Layer ${layerId}: buffer`);
  }

  undo(): void {
    const layerId = this.layerId;
    const agent = getAgentOf(layerId);
    if (!agent) {
      console.log(`no agent found for  ${layerId}.`);
      return;
    }

    // If the selection is in move state, cancel the move
    if (selectionManager.isMoveState()) {
      cancelMove();
      return;
    }

    console.log(`undo layer ${layerId}.`);
    agent.undoPatch(this.patch);
  }

  redo(): void {
    const layerId = this.layerId;
    const agent = getAgentOf(layerId);
    if (!agent) {
      console.log(`no agent found for  ${layerId}.`);
      return;
    }

    // If the selection is in move state, cancel the move
    if (selectionManager.isMoveState()) {
      cancelMove();
      return;
    }

    console.log(`redo layer ${layerId}.`);
    agent.redoPatch(this.patch);
  }
}
