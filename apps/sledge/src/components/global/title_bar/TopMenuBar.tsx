import { FileLocation, flexRow, getLatestVersion } from '@sledge/core';
import { getTheme, vars, ZFB09 } from '@sledge/theme';
import { MenuList, MenuListOption } from '@sledge/ui';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-shell';
import { Component, createEffect, createSignal, For, onMount, Show } from 'solid-js';
import ExportDialog from '~/components/global/dialogs/ExportDialog';
import SettingDialog from '~/components/global/dialogs/SettingDialog';
import SaveSection from '~/components/global/title_bar/SaveSection';
import { createNew, openExistingProject, openProject } from '~/io/window';
import { globalConfig } from '~/stores/GlobalStores';
import { menuItem, menuItemBackground, menuItemText, menuListLeft, menuListRight, root } from '~/styles/globals/top_menu_bar.css';
import { addSkippedVersion, isNewVersionAvailable } from '~/utils/VersionUtils';
import { openWindow } from '~/utils/WindowUtils';

interface Item {
  text: string;
  action: () => void;
}

const TopMenuBar: Component = () => {
  const githubPat = import.meta.env.VITE_GITHUB_PAT;
  const releaseApiUrl =
    import.meta.env.VITE_GITHUB_REST_API_URL +
    '/repos/' +
    import.meta.env.VITE_GITHUB_OWNER +
    '/' +
    import.meta.env.VITE_GITHUB_REPO +
    '/releases/latest';

  const [isRecentMenuShown, setIsRecentMenuShown] = createSignal(false);
  const [isOpenMenuShown, setIsOpenMenuShown] = createSignal(false);

  const [isExportShown, setIsExportShown] = createSignal(false);
  const [isSettingShown, setIsSettingShown] = createSignal(false);
  let exportDialog = null;
  let settingDialog = null;

  const [isDecorated, setIsDecorated] = createSignal(true);
  const [latestVersion, setLatestVersion] = createSignal<string | undefined>();
  const [newVersionAvailable, setNewVersionAvailable] = createSignal(false);
  onMount(async () => {
    setIsDecorated(await getCurrentWindow().isDecorated());

    try {
      getLatestVersion(releaseApiUrl, location.origin.includes('localhost') ? undefined : githubPat).then((ver) => {
        setLatestVersion(ver);
      });
      isNewVersionAvailable(true, location.origin.includes('localhost') ? undefined : githubPat).then((isAvailable) => {
        setNewVersionAvailable(isAvailable ?? false);
      });
    } catch (e) {
      console.warn('failed to fetch version data.');
    }
  });

  createEffect(() => {
    if (isExportShown()) {
      exportDialog = <ExportDialog open={isExportShown()} onClose={() => setIsExportShown(false)} />;
    } else {
      exportDialog = null;
    }
  });

  createEffect(() => {
    if (isSettingShown()) {
      settingDialog = <SettingDialog open={isSettingShown()} onClose={() => setIsSettingShown(false)} />;
    } else {
      settingDialog = null;
    }
  });

  const leftItems: Item[] = [
    {
      text: 'START.',
      action: () => {
        openWindow('start');
      },
    },
    {
      text: '> OPEN.',
      action: () => setIsOpenMenuShown(true),
    },
  ];
  const rightItems: Item[] = [
    // {
    //   text: 'EXPORT.',
    //   action: () => {
    //     setIsExportShown(true);
    //   },
    // },
    {
      text: 'SETTINGS.',
      action: () => {
        openWindow('settings');
        // setIsSettingShown(true);
      },
    },
    {
      text: 'ABOUT.',
      action: () => {
        openWindow('about');
        // setIsSettingShown(true);
      },
    },
  ];

  const recentFiles = globalConfig.misc.recentFiles.slice(0, 5);

  const recentFilesMenuOptions = recentFiles.map((file: FileLocation) => ({
    label: file.name || '[error]',
    onSelect: () => {
      openExistingProject(file);
      setIsRecentMenuShown(false);
    },
  }));

  const startMenu: MenuListOption[] = [
    ...recentFilesMenuOptions,

    {
      label: 'close.',
      onSelect: () => {
        setIsRecentMenuShown(false);
        createNew();
      },
    },
  ];

  const openMenu: MenuListOption[] = [
    {
      label: '> create...',
      onSelect: () => {
        setIsOpenMenuShown(false);
        createNew();
      },
    },
    {
      label: '> existing project.',
      onSelect: () => {
        setIsOpenMenuShown(false);
        openProject();
      },
    },
    // {
    //   label: '> from clipboard.',
    //   onSelect: () => {
    //     setIsOpenMenuShown(false);
    //     openProject();
    //   },
    // },
  ];

  return (
    <div class={[getTheme(globalConfig.appearance.theme), root].join(' ')}>
      <div class={menuListLeft}>
        <For each={leftItems}>
          {(item, i) => {
            let containerRef: HTMLDivElement;
            return (
              <div ref={(el) => (containerRef = el)} class={menuItem}>
                <a class={menuItemText} onClick={(e) => item.action()}>
                  {item.text}
                </a>
                <div class={menuItemBackground} />
                <Show when={item.text === 'RECENT.' && isRecentMenuShown()}>
                  <MenuList options={startMenu} onClose={() => setIsRecentMenuShown(false)} />
                </Show>
                <Show when={item.text === '> OPEN.' && isOpenMenuShown()}>
                  <MenuList options={openMenu} onClose={() => setIsOpenMenuShown(false)} />
                </Show>
              </div>
            );
          }}
        </For>
      </div>
      <div class={menuListRight}>
        <Show when={isDecorated()}>
          <div class={flexRow} style={{ height: '100%', 'justify-content': 'center' }}>
            <SaveSection />
            <div style={{ width: '8px' }} />
          </div>
        </Show>
        <For each={rightItems}>
          {(item, i) => {
            return (
              <div class={menuItem}>
                <a class={menuItemText} onClick={(e) => item.action()}>
                  {item.text}
                </a>
                <div class={menuItemBackground} />
              </div>
            );
          }}
        </For>
      </div>
      <Show when={newVersionAvailable()}>
        <div class={menuItem}>
          <a
            class={menuItemText}
            style={{
              'font-family': ZFB09,
              'font-size': '8px',
              opacity: 1,
              'white-space': 'nowrap',
              color: vars.color.active,
            }}
            onClick={(e) => {
              // open(`https://github.com/Innsbluck-rh/sledge/releases/tag/${latestVersion()}`);
              open('https://www.sledge-rules.app');
            }}
          >
            ! update available
          </a>
          <div class={menuItemBackground} />
        </div>
        <div class={menuItem} style={{ 'margin-right': '6px' }}>
          <a
            class={menuItemText}
            style={{
              'font-family': ZFB09,
              'font-size': '8px',
              opacity: 1,
              'white-space': 'nowrap',
              color: vars.color.muted,
            }}
            onClick={(e) => {
              addSkippedVersion(latestVersion()!);
              setNewVersionAvailable(false);
              setLatestVersion(undefined);
            }}
          >
            [skip]
          </a>
          <div class={menuItemBackground} />
        </div>
      </Show>
      <div class={menuItem} style={{ 'margin-right': '8px' }}></div>
      {exportDialog}
    </div>
  );
};

export default TopMenuBar;
