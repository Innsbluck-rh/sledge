import { Point, Size2D, Vec2 } from '@sledge/core';
import { RGBAColor } from '~/utils/ColorUtils';

export default class PixelBufferManager {
  constructor(
    public buffer: Uint8ClampedArray,
    public width: number,
    public height: number
  ) {}

  public getPixel(position: Vec2): RGBAColor {
    const i = (position.y * this.width + position.x) * 4;
    return [this.buffer[i] ?? 0, this.buffer[i + 1] ?? 0, this.buffer[i + 2] ?? 0, this.buffer[i + 3] ?? 0];
  }

  public setRawPixel(position: Vec2, color: RGBAColor): { before: RGBAColor; after: RGBAColor } | undefined {
    if (!this.isInBounds(position)) return undefined;
    const idx = position.y * this.width + position.x;
    const ptr = idx * 4;
    const before: RGBAColor = [this.buffer[ptr], this.buffer[ptr + 1], this.buffer[ptr + 2], this.buffer[ptr + 3]];

    this.buffer[ptr] = color[0];
    this.buffer[ptr + 1] = color[1];
    this.buffer[ptr + 2] = color[2];
    this.buffer[ptr + 3] = color[3];

  return { before, after: color };
  }

  public changeSize(
    newSize: Size2D,
    destOrigin: Point = { x: 0, y: 0 }, // paste origin on the new buffer
    srcOrigin: Point = { x: 0, y: 0 } // crop origin on the source buffer
  ): void {
    const { width: newW, height: newH } = newSize;
    const oldW = this.width,
      oldH = this.height;
    const oldBuf = this.buffer;
    const newBuf = new Uint8ClampedArray(newW * newH * 4);

    // Width/height that can actually be copied from source buffer
    const copyW = Math.min(oldW - srcOrigin.x, newW - destOrigin.x);
    const copyH = Math.min(oldH - srcOrigin.y, newH - destOrigin.y);

    for (let y = 0; y < copyH; y++) {
      // Read offset on the old buffer
      const oldRow = (y + srcOrigin.y) * oldW + srcOrigin.x;
      const oldOffset = oldRow * 4;
      // Write offset on the new buffer
      const newRow = (y + destOrigin.y) * newW + destOrigin.x;
      const newOffset = newRow * 4;
      // Copy one row
      newBuf.set(oldBuf.subarray(oldOffset, oldOffset + copyW * 4), newOffset);
    }

    this.buffer = newBuf;
    this.width = newW;
    this.height = newH;
  }

  public isInBounds(position: Vec2) {
    return position.x >= 0 && position.y >= 0 && position.x < this.width && position.y < this.height;
  }
}
