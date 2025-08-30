import { FileLocation } from '@sledge/core';
import { addRecentFile } from '~/controllers/config/RecentFileController';
import { openNewFile } from '~/io/open/open';
import { join, PathToFileLocation } from '~/utils/FileUtils';
import { getNewProjectSearchParams, openWindow } from '~/utils/WindowUtils';

export const createNew = () => {
  openWindow('editor', { query: getNewProjectSearchParams() }).then(() => {
    // closeWindowsByLabel('start');
  });
};

export const openExistingProject = (selectedFile: FileLocation) => {
  if (!selectedFile.path || !selectedFile.name) return;
  openWindow('editor', { openPath: join(selectedFile.path, selectedFile.name) }).then(() => {
    // closeWindowsByLabel('start');
  });
};

export const openProject = () => {
  openNewFile().then((file: string | undefined) => {
    console.log(file);
    if (file !== undefined) {
      const loc = PathToFileLocation(file);
      if (!loc) return;
      addRecentFile(loc);
      openExistingProject(loc);
    }
  });
};
