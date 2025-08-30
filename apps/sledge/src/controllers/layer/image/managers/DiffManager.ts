import { Vec2 } from '@sledge/core';
import { LayerBufferPatch, packRGBA } from '~/controllers/history/actions/LayerBufferHistoryAction';
import { RGBAColor } from '~/utils/ColorUtils';
import TileManager from './TileManager';
import { TileIndex } from './Tile';

type PixelBucket = {
	tile: TileIndex;
	idx: number[];
	before: number[]; // packed RGBA
	after: number[]; // packed RGBA
	map: Map<number, number>; // localIndex -> position in arrays
};

export default class DiffManager {
	private pixelBuckets = new Map<string, PixelBucket>();
	private tileFills = new Map<string, { tile: TileIndex; before?: number; after: number }>();
	private whole?: { before: Uint8ClampedArray; after: Uint8ClampedArray };

	constructor(private tm: TileManager) {}

	reset() {
		this.pixelBuckets.clear();
		this.tileFills.clear();
		this.whole = undefined;
	}

	flush() {
		// no-op for now; kept for API compatibility
	}

	setWhole(before: Uint8ClampedArray, after: Uint8ClampedArray) {
		this.whole = { before, after };
	}

	addTileFill(index: TileIndex, beforeColor: RGBAColor | undefined, afterColor: RGBAColor) {
		const key = `${index.row},${index.column}`;
		this.tileFills.set(key, {
			tile: index,
			before: beforeColor ? packRGBA(beforeColor) : undefined,
			after: packRGBA(afterColor),
		});
	}

	addPixel(position: Vec2, before: RGBAColor, after: RGBAColor) {
		const tIndex = this.tm.getTileIndex(position);
		const tile = this.tm.getTile(tIndex);
		const { x: ox, y: oy } = tile.getOffset();
		const local = position.x - ox + (position.y - oy) * this.tm.TILE_SIZE;
		const key = `${tIndex.row},${tIndex.column}`;
		let b = this.pixelBuckets.get(key);
		if (!b) {
			b = { tile: tIndex, idx: [], before: [], after: [], map: new Map() };
			this.pixelBuckets.set(key, b);
		}
		const pos = b.map.get(local);
		if (pos !== undefined) {
			// update only the last value; keep first 'before'
			b.after[pos] = packRGBA(after);
		} else {
			const i = b.idx.length;
			b.map.set(local, i);
			b.idx.push(local);
			b.before.push(packRGBA(before));
			b.after.push(packRGBA(after));
		}
	}

	isDiffExists(position: Vec2): boolean {
		const tIndex = this.tm.getTileIndex(position);
		const tile = this.tm.getTile(tIndex);
		const { x: ox, y: oy } = tile.getOffset();
		const local = position.x - ox + (position.y - oy) * this.tm.TILE_SIZE;
		const key = `${tIndex.row},${tIndex.column}`;
		const b = this.pixelBuckets.get(key);
		if (!b) return false;
		return b.map.has(local);
	}

	buildPatch(layerId: string): LayerBufferPatch | undefined {
		if (this.whole) {
			return { layerId, whole: { type: 'whole', before: this.whole.before, after: this.whole.after } };
		}

		const pixels = Array.from(this.pixelBuckets.values()).map((b) => ({
			type: 'pixels' as const,
			tile: b.tile,
			idx: new Uint16Array(b.idx),
			before: new Uint32Array(b.before),
			after: new Uint32Array(b.after),
		}));

		const tiles = Array.from(this.tileFills.values()).map((t) => ({
			type: 'tileFill' as const,
			tile: t.tile,
			before: t.before,
			after: t.after,
		}));

		if (pixels.length === 0 && tiles.length === 0) return undefined;

		return {
			layerId,
			pixels: pixels.length ? pixels : undefined,
			tiles: tiles.length ? tiles : undefined,
		};
	}

	getPendingPixelCount(): number {
		let n = 0;
		for (const b of this.pixelBuckets.values()) n += b.idx.length;
		return n;
	}
}

