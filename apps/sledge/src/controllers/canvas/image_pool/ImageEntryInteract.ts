import { updateEntryPartial } from '~/controllers/canvas/image_pool/ImagePoolController';
import { ImagePoolEntryPropsHistoryAction } from '~/controllers/history/actions/ImagePoolEntryPropsHistoryAction';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';
import { interactStore } from '~/stores/EditorStores';
import { globalConfig } from '~/stores/GlobalStores';
import { imagePoolStore } from '~/stores/ProjectStores';

type ResizePos = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * ImageEntryInteract
 *
 * 各 ImagePool エントリのポインター操作を担当（現状はログ出力のみ）。
 * コンストラクタに SVG ルート（ハンドル含む）と、最新の Entry を返す getter を渡す。
 */
class ImageEntryInteract {
  private pointerActive = false;
  private mode: 'drag' | 'resize' | undefined;
  private startClientX = 0;
  private startClientY = 0;
  private startX = 0;
  private startY = 0;
  private startScaleX = 1;
  private startScaleY = 1;
  private startRotation = 0; // for future
  // rAF batching
  private rafId: number | null = null;
  private rafScheduled = false;
  private lastTs = 0;
  private pending: { x: number; y: number; scaleX: number; scaleY: number } | undefined;

  private enqueueUpdate(next: { x: number; y: number; scaleX: number; scaleY: number }) {
    this.pending = next; // overwrite with the latest
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      this.rafId = requestAnimationFrame(this.applyPending);
    }
  }

  private applyPending = (ts: number) => {
    const fps = Number(globalConfig.performance.targetFPS || 60);
    const interval = 1000 / (fps > 0 ? fps : 60);
    if (this.lastTs && ts - this.lastTs < interval) {
      // throttle to target FPS
      this.rafId = requestAnimationFrame(this.applyPending);
      return;
    }
    this.lastTs = ts;
    this.rafScheduled = false;
    const payload = this.pending;
    this.pending = undefined;
    if (!payload) return;
    const entry = this.getEntry();
    if (!entry) return;
    const partialData = {
      x: payload.x,
      y: payload.y,
      // legacy representative scale
      scale: (payload.scaleX + payload.scaleY) / 2,
      transform: {
        x: payload.x,
        y: payload.y,
        scaleX: payload.scaleX,
        scaleY: payload.scaleY,
      },
    };
    updateEntryPartial(entry.id, partialData);
  };
  private resizePos: ResizePos | undefined;

  constructor(
    private svgRoot: SVGSVGElement,
    private getEntry: () => ImagePoolEntry | undefined
  ) {}

  private handlePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    const handle = target.closest?.('.resize-handle') as HTMLElement | null;
    const entry = this.getEntry();
    if (!entry) return;

    this.pointerActive = true;
    this.startClientX = e.clientX;
    this.startClientY = e.clientY;
    this.startX = entry.transform?.x ?? entry.x;
    this.startY = entry.transform?.y ?? entry.y;
    this.startScaleX = entry.transform?.scaleX ?? entry.scale;
    this.startScaleY = entry.transform?.scaleY ?? entry.scale;

    if (handle) {
      this.mode = 'resize';
      this.resizePos = handle.getAttribute('data-pos') as ResizePos | undefined;
    } else {
      this.mode = 'drag';
      this.resizePos = undefined;
    }

    this.svgRoot.setPointerCapture(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent) => {
    console.log('move');
    if (!this.pointerActive || !this.mode) return;
    const zoom = interactStore.zoom || 1;
    const dx = (e.clientX - this.startClientX) / zoom;
    const dy = (e.clientY - this.startClientY) / zoom;
    const entry = this.getEntry();
    if (!entry) return;

    if (this.mode === 'drag') {
      const nx = this.startX + dx;
      const ny = this.startY + dy;
      console.debug('[ImagePool] drag delta', { id: entry.id, dx, dy, nx, ny, zoom });
      this.enqueueUpdate({
        x: nx,
        y: ny,
        scaleX: entry.transform?.scaleX ?? entry.scale,
        scaleY: entry.transform?.scaleY ?? entry.scale,
      });
    } else if (this.mode === 'resize') {
      const baseW = entry.base?.width ?? entry.width;
      const baseH = entry.base?.height ?? entry.height;
      let nextScaleX = this.startScaleX;
      let nextScaleY = this.startScaleY;
      switch (this.resizePos) {
        case 'e':
          nextScaleX = (baseW * this.startScaleX + dx) / baseW;
          break;
        case 'w':
          nextScaleX = (baseW * this.startScaleX - dx) / baseW;
          break;
        case 's':
          nextScaleY = (baseH * this.startScaleY + dy) / baseH;
          break;
        case 'n':
          nextScaleY = (baseH * this.startScaleY - dy) / baseH;
          break;
        case 'se':
          nextScaleX = (baseW * this.startScaleX + dx) / baseW;
          nextScaleY = (baseH * this.startScaleY + dy) / baseH;
          break;
        case 'ne':
          nextScaleX = (baseW * this.startScaleX + dx) / baseW;
          nextScaleY = (baseH * this.startScaleY - dy) / baseH;
          break;
        case 'sw':
          nextScaleX = (baseW * this.startScaleX - dx) / baseW;
          nextScaleY = (baseH * this.startScaleY + dy) / baseH;
          break;
        case 'nw':
          nextScaleX = (baseW * this.startScaleX - dx) / baseW;
          nextScaleY = (baseH * this.startScaleY - dy) / baseH;
          break;
      }

      // アスペクト固定: グローバル設定を基本に、Shift キーが押されていれば必ず固定
      const keepAspect = imagePoolStore.preserveAspectRatio || e.shiftKey;
      if (keepAspect) {
        switch (this.resizePos) {
          case 'e':
          case 'w': {
            const s = nextScaleX;
            nextScaleX = s;
            nextScaleY = s;
            break;
          }
          case 'n':
          case 's': {
            const s = nextScaleY;
            nextScaleX = s;
            nextScaleY = s;
            break;
          }
          default: {
            // 角ハンドル: より変化量の大きい軸に合わせる
            const deltaW = baseW * (nextScaleX - this.startScaleX);
            const deltaH = baseH * (nextScaleY - this.startScaleY);
            const s = Math.abs(deltaW) >= Math.abs(deltaH) ? nextScaleX : nextScaleY;
            nextScaleX = s;
            nextScaleY = s;
            break;
          }
        }
      }

      // 追加: 画面上の最小表示ピクセルに基づく動的クランプ
      const minDisplayPx = Number((globalConfig as any).imagePool?.minDisplayPx ?? 8);
      const minScaleX = Math.max(1e-4, minDisplayPx / (baseW * zoom));
      const minScaleY = Math.max(1e-4, minDisplayPx / (baseH * zoom));
      if (keepAspect) {
        const s = Math.max(nextScaleX, nextScaleY, minScaleX, minScaleY);
        nextScaleX = s;
        nextScaleY = s;
      } else {
        nextScaleX = Math.max(minScaleX, nextScaleX);
        nextScaleY = Math.max(minScaleY, nextScaleY);
      }

      // ピボット座標（開始時のボックスから算出）
      const startW = baseW * this.startScaleX;
      const startH = baseH * this.startScaleY;
      const pivot = (() => {
        switch (this.resizePos) {
          case 'se':
          case 'e':
          case 's':
            return { x: this.startX, y: this.startY, type: 'tl' as const };
          case 'nw':
            return { x: this.startX + startW, y: this.startY + startH, type: 'br' as const };
          case 'ne':
          case 'n':
            return { x: this.startX, y: this.startY + startH, type: 'bl' as const };
          case 'sw':
          case 'w':
            return { x: this.startX + startW, y: this.startY, type: 'tr' as const };
          default:
            return { x: this.startX, y: this.startY, type: 'tl' as const };
        }
      })();

      // ピボット固定で新しい位置を求める
      let newX = this.startX;
      let newY = this.startY;
      switch (pivot.type) {
        case 'tl':
          newX = pivot.x;
          newY = pivot.y;
          break;
        case 'tr':
          newX = pivot.x - baseW * nextScaleX;
          newY = pivot.y;
          break;
        case 'bl':
          newX = pivot.x;
          newY = pivot.y - baseH * nextScaleY;
          break;
        case 'br':
          newX = pivot.x - baseW * nextScaleX;
          newY = pivot.y - baseH * nextScaleY;
          break;
      }

      console.debug('[ImagePool] resize delta', {
        id: entry.id,
        dx,
        dy,
        scaleX: nextScaleX,
        scaleY: nextScaleY,
        handle: this.resizePos,
        keepAspect,
        pivot,
        newX,
        newY,
        zoom,
      });

      this.enqueueUpdate({
        x: newX,
        y: newY,
        scaleX: nextScaleX,
        scaleY: nextScaleY,
      });
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    this.mode = undefined;
    this.resizePos = undefined;
    try {
      this.svgRoot.releasePointerCapture(e.pointerId);
    } catch {}
    console.debug('[ImagePool] pointer end');
    // flush pending at pointer end for consistency
    if (this.pending) {
      this.applyPending(performance.now());
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.rafScheduled = false;
    }

    const entry = this.getEntry();
    if (entry) this.commitDiff(e, entry);
  };

  private readonly ignoreCommitProps: (keyof ImagePoolEntry)[] = [];

  private commitDiff(e: PointerEvent, entry: ImagePoolEntry) {
    const startPayload = {
      x: this.startX,
      y: this.startY,
      scaleX: this.startScaleX,
      scaleY: this.startScaleY,
      rotation: this.startRotation,
    };
    const startPartialData = {
      x: startPayload.x,
      y: startPayload.y,
      // legacy representative scale
      scale: (startPayload.scaleX + startPayload.scaleY) / 2,
      transform: {
        x: startPayload.x,
        y: startPayload.y,
        scaleX: startPayload.scaleX,
        scaleY: startPayload.scaleY,
      },
    };
    const startEntry = { ...entry, ...startPartialData } as ImagePoolEntry;

    const payload = {
      x: entry.x,
      y: entry.y,
      scaleX: entry.transform?.scaleX ?? 1,
      scaleY: entry.transform?.scaleY ?? 1,
      rotation: this.startRotation,
    };
    const partialData = {
      x: payload.x,
      y: payload.y,
      // legacy representative scale
      scale: (payload.scaleX + payload.scaleY) / 2,
      transform: {
        x: payload.x,
        y: payload.y,
        scaleX: payload.scaleX,
        scaleY: payload.scaleY,
      },
    };
    const endEntry = { ...entry, ...partialData } as ImagePoolEntry;

    if (JSON.stringify(startPayload) !== JSON.stringify(payload)) {
      projectHistoryController.addAction(
        new ImagePoolEntryPropsHistoryAction(entry.id, startEntry, endEntry, { from: 'ImageEntryInteract.commitDiff' })
      );
    }
  }

  private onWindowPointerUp = (e: PointerEvent) => {
    const entry = this.getEntry();
    if (!entry) return;
    this.commitDiff(e, entry);
  };

  private onWindowPointerCancel = (e: PointerEvent) => {
    const entry = this.getEntry();
    if (!entry) return;
    this.commitDiff(e, entry);
  };

  public setInteractListeners() {
    this.removeInteractListeners();
    this.svgRoot.addEventListener('pointerdown', this.handlePointerDown);
    this.svgRoot.addEventListener('pointermove', this.handlePointerMove);
    this.svgRoot.addEventListener('pointerup', this.handlePointerUp);
  }

  public removeInteractListeners() {
    this.svgRoot.removeEventListener('pointerdown', this.handlePointerDown);
    this.svgRoot.removeEventListener('pointermove', this.handlePointerMove);
    this.svgRoot.removeEventListener('pointerup', this.handlePointerUp);
  }
}

export default ImageEntryInteract;
