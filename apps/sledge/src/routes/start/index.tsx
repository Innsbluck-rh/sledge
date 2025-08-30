import { flexCol } from '@sledge/core';
import { getTheme } from '@sledge/theme';
import { createScrollPosition } from '@solid-primitives/scroll';
import { createEffect, createSignal, onMount, Show } from 'solid-js';
import RecentFileList from '~/components/global/RecentFileList';
import ThemeToggle from '~/components/global/ThemeToggle';
import { loadGlobalSettings } from '~/io/config/load';
import { createNew, openExistingProject, openProject } from '~/io/window';
import { globalConfig } from '~/stores/GlobalStores';
import { fadeBottom, fadeTop } from '~/styles/components/scroll_fade.css';
import { openWindow, reportWindowStartError, showMainWindow } from '~/utils/WindowUtils';
import {
  header as menuContainer,
  headerItem as menuItem,
  recentFilesCaption,
  recentFilesContainerScroll,
  rightTopArea,
  startContent,
  startHeader,
  startRoot,
} from './start.css';

export default function Home() {
  let scrollRef: HTMLDivElement | undefined;
  const scroll = createScrollPosition(() => scrollRef);

  const [canScrollTop, setCanScrollTop] = createSignal(false);
  const [canScrollBottom, setCanScrollBottom] = createSignal(false);

  createEffect(() => {
    if (scrollRef) {
      setCanScrollTop(scroll.y > 0);
      console.log(scroll.y, scrollRef.clientHeight, scrollRef.scrollHeight);
      setCanScrollBottom(scroll.y + scrollRef.clientHeight < scrollRef.scrollHeight);
    }
  });

  onMount(async () => {
    try {
      await loadGlobalSettings();
      await showMainWindow();
    } catch (e) {
      await reportWindowStartError(e);
    }
  });

  return (
    <div class={`${startRoot} ${getTheme(globalConfig.appearance.theme)}`}>
      <div class={startContent}>
        <p class={startHeader}>HELLO.</p>

        <div class={menuContainer}>
          <a class={menuItem} onClick={() => createNew()}>
            +&ensp;new.
          </a>
          <a class={menuItem} style={{ 'margin-left': '2px' }} onClick={(e) => openProject()}>
            &gt;&ensp;open.
          </a>
        </div>
        <p class={recentFilesCaption}>recent files.</p>

        <div class={flexCol} style={{ position: 'relative', 'flex-grow': 1 }}>
          <div ref={(el) => (scrollRef = el)} class={recentFilesContainerScroll}>
            <RecentFileList files={globalConfig.misc.recentFiles} onClick={(item) => openExistingProject(item)} />
          </div>

          <Show when={canScrollTop()}>
            <div class={fadeTop} />
          </Show>

          <Show when={canScrollBottom()}>
            <div class={fadeBottom} />
          </Show>
        </div>
      </div>
      <div class={rightTopArea}>
        <ThemeToggle noBackground={false} />
        <a onClick={() => openWindow('about')}>about.</a>
        <a onClick={() => openWindow('settings')}>settings.</a>
      </div>
    </div>
  );
}
