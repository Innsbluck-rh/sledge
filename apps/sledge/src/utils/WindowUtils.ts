import { FileLocation } from '@sledge/core';
import { WebviewOptions } from '@tauri-apps/api/webview';
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow, WindowOptions } from '@tauri-apps/api/window';
import { message } from '@tauri-apps/plugin-dialog';
import { globalConfig } from '~/stores/GlobalStores';
import { PathToFileLocation } from '~/utils/PathUtils';
import { safeInvoke } from './TauriUtils';

export type WindowOptionsProp = Omit<WebviewOptions, 'x' | 'y' | 'width' | 'height'> & WindowOptions;

export type WindowKind = 'start' | 'editor' | 'settings' | 'about';

export function openWindow(kind: WindowKind, options?: { query?: string; openPath?: string; initializationScript?: string }): Promise<void> {
  return safeInvoke('open_window', {
    kind,
    options: {
      query: options?.query,
      open_path: options?.openPath,
      initialization_script: options?.initializationScript,
    },
  });
}

export async function closeWindowsByLabel(label: string) {
  (await getAllWebviewWindows())
    .filter((w) => w.label === label)
    .forEach(async (w) => {
      await w.close();
      await w.destroy();
    });
}

export const getNewProjectSearchParams = (): string => {
  const sp = new URLSearchParams();
  sp.append('new', 'true');
  sp.append('width', globalConfig.default.canvasSize.width.toString());
  sp.append('height', globalConfig.default.canvasSize.height.toString());
  return sp.toString();
};

export function getOpenLocation(): FileLocation | undefined {
  // @ts-ignore
  const openPath = window.__PATH__;
  return PathToFileLocation(openPath);
}

export async function reportCriticalError(e: any) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  const errorStack = e instanceof Error ? e.stack : undefined;

  console.error('Reporting critical error:', {
    message: errorMessage,
    stack: errorStack,
  });

  await message(`Something went wrong.\n\n${errorStack || '<No stack trace available>'}`, {
    kind: 'error',
    title: 'Error',
    okLabel: 'Close',
  });

  // force close window
  await getCurrentWindow().close();
  await getCurrentWindow().destroy();
}

export async function showMainWindow() {
  // ネイティブスプラッシュを閉じてWebViewを表示
  try {
    const windowLabel = getCurrentWindow().label;
    await safeInvoke('show_main_window', { windowLabel });
    console.log('🌐 [PERF] Window transition completed');
  } catch (error) {
    console.error('Failed to transition from native splash:', error);
    // フォールバック
    getCurrentWindow().show();
  }
}
