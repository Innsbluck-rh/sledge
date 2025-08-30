import { flexRow } from '@sledge/core';
import { getTheme, vars } from '@sledge/theme';
import { Icon } from '@sledge/ui';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createEffect, createSignal, onMount, Show } from 'solid-js';
import SaveSection from '~/components/global/title_bar/SaveSection';
import TopMenuBar from '~/components/global/title_bar/TopMenuBar';
import { fileStore } from '~/stores/EditorStores';
import { globalConfig } from '~/stores/GlobalStores';
import { canvasStore, projectStore } from '~/stores/ProjectStores';
import {
  titleBarControlButtonContainer,
  titleBarControlButtonImg,
  titleBarControlCloseButtonContainer,
  titleBarControls,
  titleBarRoot,
  titleBarSaveSection,
  titleBarSize,
  titleBarTitle,
  titleBarTitleContainer,
  titleBarTitleSub,
} from '~/styles/globals/title_bar.css';
import '~/styles/globals/title_bar_region.css';

export default function TitleBar() {
  const [isMaximizable, setIsMaximizable] = createSignal(false);
  const [isMinimizable, setIsMinimizable] = createSignal(false);
  const [isClosable, setIsClosable] = createSignal(false);
  const [isMaximized, setMaximized] = createSignal(false);
  const [isDecorated, setIsDecorated] = createSignal(true);
  const [windowTitle, setWindowTitle] = createSignal('');

  onMount(async () => {
    const window = getCurrentWindow();
    setIsMaximizable(await window.isMaximizable());
    setIsMinimizable(await window.isMinimizable());
    setIsClosable(await window.isClosable());
    setMaximized(await window.isMaximized());
    setIsDecorated(await window.isDecorated());
    setWindowTitle(await window.title());
  });

  getCurrentWindow().onResized(async () => {
    setMaximized(await getCurrentWindow().isMaximized());
  });

  createEffect(() => {
    if (location.pathname.startsWith('/editor')) {
      let title = '';
      let projName = fileStore.location.name ?? 'new project';
      const extension = fileStore.extension !== 'sledge' ? fileStore.extension : '';
      // non-custom titlebar (mac/linux)
      if (isDecorated()) {
        const size = `(${canvasStore.canvas.width} x ${canvasStore.canvas.height})`;
        const projPath = fileStore.location.path;
        if (projPath) {
          title += `${projName}.${extension} ${size} - ${projPath}`;
        } else {
          title += `${projName}.${extension} ${size}`;
        }
      } else {
        const projPath = fileStore.location.path;
        if (projPath) {
          title += `${projName}.${extension} - ${projPath}`;
        } else {
          title += `${projName}.${extension}`;
        }
      }

      getCurrentWindow().setTitle(title);
    }
  });

  const borderWindowLabels: string[] = ['settings'];
  const shouldShowBorder = () => borderWindowLabels.find((l) => l === getCurrentWindow().label);
  const titleLessWindowLabels: string[] = ['about'];
  const shouldShowTitle = () => !titleLessWindowLabels.find((l) => l === getCurrentWindow().label);

  return (
    <header class={getTheme(globalConfig.appearance.theme)}>
      <div
        style={{
          'border-bottom': shouldShowBorder() ? `1px solid ${vars.color.border}` : 'none',
          'pointer-events': 'all',
        }}
      >
        <Show when={!isDecorated()}>
          <nav class={titleBarRoot} data-tauri-drag-region>
            <div class={titleBarTitleContainer}>
              <Show when={shouldShowTitle()}>
                <Show when={location.pathname.startsWith('/editor')} fallback={<p class={titleBarTitle}>{windowTitle()}</p>}>
                  <div
                    class={flexRow}
                    style={{
                      'align-items': 'baseline',
                    }}
                  >
                    <p class={titleBarTitle} style={{ opacity: 0.5 }}>
                      {fileStore.location.path ?? ''}\
                    </p>
                    <p class={titleBarTitle}>
                      {fileStore.location.name ?? 'new project'}
                      {fileStore.extension !== 'sledge' ? `.${fileStore.extension}` : ''}
                    </p>
                    <p class={titleBarTitleSub}>{projectStore.isProjectChangedAfterSave ? ' (unsaved)' : ''}</p>
                  </div>
                  <div
                    style={{ height: '8px', width: '1px', 'background-color': vars.color.border, 'margin-left': '12px', 'margin-right': '12px' }}
                  />
                  <p class={titleBarSize} style={{ opacity: 0.9 }}>
                    {canvasStore.canvas.width} x {canvasStore.canvas.height}
                  </p>
                </Show>
              </Show>
            </div>

            <Show when={location.pathname.startsWith('/editor')}>
              <div class={titleBarSaveSection}>
                <SaveSection />
              </div>

              <div style={{ height: '18px', width: '1px', 'background-color': vars.color.border, 'margin-left': '0px', 'margin-right': '12px' }} />
            </Show>
            <div class={titleBarControls} data-tauri-drag-region-exclude>
              <Show when={isMinimizable()}>
                <div
                  class={titleBarControlButtonContainer}
                  onClick={async (e) => {
                    e.preventDefault();
                    await getCurrentWindow().minimize();
                  }}
                  data-tauri-drag-region-exclude
                >
                  <Icon
                    class={titleBarControlButtonImg}
                    src={'/icons/title_bar/minimize_2.png'}
                    color={vars.color.onBackground}
                    base={12}
                    data-tauri-drag-region-exclude
                  />
                </div>
              </Show>

              <Show when={isMaximizable()}>
                <div
                  class={titleBarControlButtonContainer}
                  onClick={async (e) => {
                    e.preventDefault();
                    await getCurrentWindow().toggleMaximize();
                  }}
                  data-tauri-drag-region-exclude
                >
                  <Icon
                    class={titleBarControlButtonImg}
                    src={isMaximized() ? '/icons/title_bar/quit_maximize_2.png' : '/icons/title_bar/maximize_2.png'}
                    color={vars.color.onBackground}
                    base={12}
                    data-tauri-drag-region-exclude
                  />
                </div>
              </Show>

              <Show when={isClosable()}>
                <div
                  class={titleBarControlCloseButtonContainer}
                  onClick={async (e) => {
                    e.preventDefault();
                    await getCurrentWindow().close();
                  }}
                  data-tauri-drag-region-exclude
                >
                  <Icon
                    class={titleBarControlButtonImg}
                    src={'/icons/title_bar/close_2.png'}
                    color={vars.color.onBackground}
                    base={12}
                    data-tauri-drag-region-exclude
                  />
                </div>
              </Show>
            </div>
          </nav>
        </Show>

        <Show when={location.pathname.startsWith('/editor')}>
          <TopMenuBar />
        </Show>
      </div>
    </header>
  );
}
