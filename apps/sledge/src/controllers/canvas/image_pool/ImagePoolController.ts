import { transferToLayer } from '~/appliers/ImageTransferApplier';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { ImagePoolEntryPropsHistoryAction } from '~/controllers/history/actions/ImagePoolEntryPropsHistoryAction';
import { ImagePoolHistoryAction } from '~/controllers/history/actions/ImagePoolHistoryAction';
import { activeLayer } from '~/controllers/layer/LayerListController';
import { ImagePoolEntry } from '~/models/canvas/image_pool/ImagePool';
import { canvasStore, setImagePoolStore } from '~/stores/ProjectStores';
import { loadLocalImage } from '~/utils/DataUtils';
import { eventBus } from '~/utils/EventBus';
import { getFileUniqueId } from '~/utils/FileUtils';

// Plain Map でエントリーを管理
const pool = new Map<string, ImagePoolEntry>();

export const setImagePool = (entries: Map<string, ImagePoolEntry>) => {
  pool.clear();
  entries.forEach((entry) => {
    pool.set(entry.id, entry);
  });
};

export const getEntries = (): ImagePoolEntry[] => Array.from(pool.values());
export const getEntry = (id: string): ImagePoolEntry | undefined => pool.get(id);

// Insert entry with a given id (used for undo/redo to keep id stable)
export function insertEntry(entry: ImagePoolEntry) {
  let old = undefined;
  if (pool.has(entry.id)) {
    old = pool.get(entry.id);
  }
  pool.set(entry.id, entry);
  if (old && JSON.stringify(old) !== JSON.stringify(entry)) {
    projectHistoryController.addAction(new ImagePoolEntryPropsHistoryAction(entry.id, old, entry, { from: 'ImagePoolController.removeEntry' }));
  }
  eventBus.emit('imagePool:entriesChanged', { newEntries: getEntries() });
}

export function setEntry(id: string, entry: ImagePoolEntry) {
  pool.set(id, entry);
  eventBus.emit('imagePool:entryPropChanged', { id });
}

export function updateEntryPartial(id: string, patch: Partial<ImagePoolEntry>) {
  const old = pool.get(id);
  if (!old) return;
  const updated = { ...old, ...patch } as ImagePoolEntry;
  pool.set(id, updated);
  eventBus.emit('imagePool:entryPropChanged', { id });
}

export function removeEntry(id: string) {
  const entry = getEntry(id);
  if (!entry) {
    console.warn(`ImagePoolController.removeEntry: Entry not found for id ${id}`);
    return;
  }
  projectHistoryController.addAction(new ImagePoolHistoryAction('remove', entry, { from: 'ImagePoolController.removeEntry' }));

  if (pool.delete(id)) {
    selectEntry(undefined);
    eventBus.emit('imagePool:entriesChanged', { newEntries: getEntries() });
  }
}

export function replaceAllEntries(entries: ImagePoolEntry[]) {
  pool.clear();
  for (const e of entries) pool.set(e.id, e);
  eventBus.emit('imagePool:entriesChanged', { newEntries: getEntries() });
}

export async function addToImagePool(imagePaths: string | string[]) {
  if (Array.isArray(imagePaths)) {
    const ids: string[] = await Promise.all(imagePaths.map((p) => createEntry(p)));
    if (ids.length > 0) {
      ids.forEach((id) => {
        const entry = pool.get(id)!;
        projectHistoryController.addAction(new ImagePoolHistoryAction('add', entry, { from: 'ImagePoolController.addToImagePool' }));
      });
    }
  } else {
    const id = await createEntry(imagePaths);
    if (id) {
      const entry = pool.get(id)!;
      projectHistoryController.addAction(new ImagePoolHistoryAction('add', entry, { from: 'ImagePoolController.addToImagePool' }));
    }
  }

  eventBus.emit('imagePool:entriesChanged', { newEntries: getEntries() });
}

export async function relinkEntry(id: string, newPath: string) {
  const filename = newPath.split(/[\\/]/).pop() ?? newPath;
  updateEntryPartial(id, { originalPath: newPath, resourcePath: newPath, fileName: filename });
}

export async function transferToCurrentLayer(id: string, removeAfter: boolean) {
  const active = activeLayer(); // いま選択中のレイヤー
  if (!active) return;

  try {
    const current = getEntry(id);
    if (!current) return;
    await transferToLayer({
      entry: current,
      targetLayerId: active.id,
    });
    if (removeAfter) removeEntry(current.id); // ImagePool から削除
  } catch (e) {
    console.error(e);
    // TODO: ユーザ通知
  }
}

async function createEntry(originalPath: string) {
  const id = await getFileUniqueId(originalPath);

  // 画像サイズの取得（コピーせず読み込み）
  const bitmap = await loadLocalImage(originalPath);
  const width = bitmap.width;
  const height = bitmap.height;

  const entry: ImagePoolEntry = {
    id,
    originalPath,
    // 段階的移行のため resourcePath は originalPath をミラー
    resourcePath: originalPath,
    fileName: originalPath.split(/[\\/]/).pop() ?? originalPath,
    x: 0,
    y: 0,
    scale: Math.min(canvasStore.canvas.width / width, canvasStore.canvas.height / height),
    width,
    height,
    opacity: 1,
    visible: true,
  };
  pool.set(id, entry);
  return id;
}

export function selectEntry(id?: string) {
  setImagePoolStore('selectedEntryId', id);
}

export function showEntry(id: string) {
  const entry = pool.get(id);
  if (entry && !entry.visible) {
    entry.visible = true;
    projectHistoryController.addAction(
      new ImagePoolEntryPropsHistoryAction(
        id,
        {
          ...entry,
          visible: false,
        },
        {
          ...entry,
          visible: true,
        },
        { from: 'ImagePoolController.removeEntry' }
      )
    );
    eventBus.emit('imagePool:entryPropChanged', { id });
  }
}

export function hideEntry(id: string) {
  const entry = pool.get(id);
  if (entry && entry.visible) {
    entry.visible = false;
    projectHistoryController.addAction(
      new ImagePoolEntryPropsHistoryAction(
        id,
        {
          ...entry,
          visible: true,
        },
        {
          ...entry,
          visible: false,
        },
        { from: 'ImagePoolController.removeEntry' }
      )
    );
    eventBus.emit('imagePool:entryPropChanged', { id });
  }
}
