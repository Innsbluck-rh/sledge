import { flexCol, flexRow } from '@sledge/core';
import { vars, ZFB03, ZFB09 } from '@sledge/theme';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Component, Show } from 'solid-js';
import { fileStore } from '~/stores/EditorStores';
import { join } from '~/utils/FileUtils';

const ProjectLocation: Component = () => {
  const isNewProject = () => !fileStore.location.name || !fileStore.location.path;

  console.log('ProjectLocation', fileStore.location);

  return (
    <div class={flexCol} style={{ gap: '4px', overflow: 'hidden' }}>
      <Show when={!isNewProject()} fallback={<p style={{ 'font-family': ZFB09, margin: '4px 0', opacity: 0.3 }}>[ unsaved project ]</p>}>
        <div class={flexRow}>
          <p style={{ 'font-family': ZFB03, width: '40px', 'font-size': '8px' }}>path</p>
          <p style={{ 'white-space': 'wrap' }}>{fileStore.location.path || '<unknown>'}</p>
        </div>
        <div class={flexRow}>
          <p style={{ 'font-family': ZFB03, width: '40px', 'font-size': '8px' }}>file</p>
          <p>{fileStore.location.name || '<unknown>'}</p>
        </div>
        <div class={flexRow} style={{ 'margin-top': '6px', 'justify-content': 'start' }}>
          <a
            href='#'
            onClick={(e) => {
              const loc = fileStore.location;
              if (!loc || !loc.path || !loc.name) return;
              revealItemInDir(join(loc.path, loc.name));
            }}
            style={{ color: vars.color.muted, 'padding-bottom': '2px' }}
          >
            Open in Explorer
          </a>
        </div>
      </Show>
    </div>
  );
};

export default ProjectLocation;
