import { FileLocation } from '@sledge/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Component, createEffect, For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { thumbnailDir } from '~/io/project/out/save';
import { recentFilesContainerCol } from '~/routes/start/start.css';
import { getFileUniqueId, join } from '~/utils/FileUtils';
import ListFileItem from './file_item/ListFileItem';

const RecentFileList: Component<{ files: FileLocation[]; onClick: (file: FileLocation) => void }> = (props) => {
  const [thumbnails, setThumbnails] = createStore<Record<string, string>>({});

  createEffect(() => {
    props.files.forEach(async (file) => {
      if (!file.path || !file.name) return;
      const path = join(file.path, file.name);
      const fileId = await getFileUniqueId(path);
      const fileName = fileId + '.png';
      const thumbPath = join(await thumbnailDir(), fileName);
      const assetUrl = convertFileSrc(thumbPath);

      setThumbnails(path, assetUrl);
    });
  });

  return (
    <div class={recentFilesContainerCol}>
      <For each={props.files}>
        {(file, i) => {
          if (!file.path || !file.name) return null;
          const path = join(file.path, file.name);
          const thumbnail = () => thumbnails[path];
          return <ListFileItem onClick={props.onClick} thumbnail={thumbnail()} file={file} />;
        }}
      </For>
    </div>
  );
};

export default RecentFileList;
