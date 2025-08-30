import { path } from '@tauri-apps/api';
import { appDataDir } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { calcThumbnailSize, ThumbnailGenerator } from '~/controllers/canvas/ThumbnailGenerator';
import { addRecentFile } from '~/controllers/config/RecentFileController';
import { dumpProject } from '~/io/project/out/dump';
import { fileStore, setFileStore } from '~/stores/EditorStores';
import { canvasStore, setProjectStore } from '~/stores/ProjectStores';
import { blobToDataUrl, dataUrlToBytes } from '~/utils/DataUtils';
import { eventBus } from '~/utils/EventBus';
import { getFileUniqueId, join, PathToFileLocation as pathToFileLocation } from '~/utils/FileUtils';

async function folderSelection(name?: string) {
  try {
    await mkdir('sledge', {
      baseDir: BaseDirectory.Home,
      recursive: true,
    });
  } catch (e) {
    console.warn('failed or skipped making new directory:', e);
  }

  const home = await path.homeDir();

  const nameWithoutExtension = fileStore.location.name?.replace(/\.sledge$/, '') ?? 'new project';

  return await save({
    title: 'save sledge project',
    defaultPath: await path.join(home, `sledge/${nameWithoutExtension}.sledge`),
    filters: [{ name: 'sledge project', extensions: ['sledge'] }],
  });
}

async function saveThumbnailData(selectedPath: string) {
  const fileId = await getFileUniqueId(selectedPath);
  const { width, height } = canvasStore.canvas;
  const thumbSize = calcThumbnailSize(width, height);
  const thumbnailBlob = await new ThumbnailGenerator().generateCanvasThumbnailBlob(thumbSize.width, thumbSize.height);
  const thumbnailDataUrl = await blobToDataUrl(thumbnailBlob);
  return await saveThumbnailExternal(fileId, thumbnailDataUrl);
}

export async function saveProject(name?: string, existingPath?: string): Promise<boolean> {
  let selectedPath: string | null;

  if (existingPath && name) {
    selectedPath = join(existingPath, name);
  } else {
    selectedPath = await folderSelection(name);
  }

  if (typeof selectedPath === 'string') {
    try {
      const thumbpath = await saveThumbnailData(selectedPath);
      console.log(thumbpath);

      const data = await dumpProject();
      await writeFile(selectedPath, data);
      console.log('project saved to:', selectedPath);
      addRecentFile(pathToFileLocation(selectedPath));

      setFileStore('openAs', 'project');
      setFileStore('extension', 'sledge');
      const location = pathToFileLocation(selectedPath);
      if (location) {
        setFileStore('location', 'path', location.path);
        const fileNameWithoutExt = fileStore.location.name?.split('.').slice(0, -1).join('.') ?? 'new project';
        setFileStore('location', 'name', fileNameWithoutExt);
        // setLastSettingsStore('exportSettings', 'dirPath', location.path);
      }
      // @ts-ignore
      window.__PATH__ = selectedPath;

      setProjectStore('lastSavedAt', new Date());
      const loc = pathToFileLocation(selectedPath);
      if (loc) eventBus.emit('project:saved', { location: loc });

      setProjectStore('isProjectChangedAfterSave', false);

      return true;
    } catch (error) {
      console.error('Error saving project:', error);
      eventBus.emit('project:saveFailed', { error: error });
      return false;
    }
  }

  eventBus.emit('project:saveCancelled', {});
  return false;
}

export const thumbnailDir = async () => join(await appDataDir(), 'thumbnails');
export const thumbnailPath = async (fileId: string) => join(await appDataDir(), 'thumbnails', fileId);

export async function saveThumbnailExternal(fileId: string, dataUrl: string): Promise<string> {
  const dir = await thumbnailDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  const path = join(dir, `${fileId}.png`);
  const bytes = dataUrlToBytes(dataUrl);
  await writeFile(path, bytes);
  return path;
}
