import { getTauriVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { emit, EventCallback, listen } from '@tauri-apps/api/event';

let _isTauri: boolean | null = null;

export async function isTauri(): Promise<boolean> {
  if (_isTauri !== null) return _isTauri;
  try {
    await getTauriVersion();
    _isTauri = true;
  } catch {
    _isTauri = false;
  }
  return _isTauri;
}

export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  if (!(await isTauri())) {
    console.warn(`[safeInvoke] '${cmd}' skipped (not in Tauri environment)`);
    return undefined;
  }

  try {
    const result = await invoke<T>(cmd, args);
    return result;
  } catch (e) {
    console.error(`[safeInvoke] '${cmd}' failed:`, e);
    return undefined;
  }
}

export type TauriWindowEvent =
  // window/editor
  'onProjectLoad' | 'onSetup';

export function emitEvent(event: TauriWindowEvent, msg?: Object) {
  return emit(event, msg);
}

export type TauriGlobalEvent = 'onSettingsSaved';

export async function emitGlobalEvent(event: TauriGlobalEvent, msg?: Object) {
  return await safeInvoke('emit_global_event', { event, msg });
}

export function listenEvent(event: TauriWindowEvent | TauriGlobalEvent, handler: EventCallback<any>) {
  return listen(event, handler);
}
