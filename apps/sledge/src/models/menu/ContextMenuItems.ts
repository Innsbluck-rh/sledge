import { MenuListOption } from '@sledge/ui';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { saveProject } from '~/io/project/out/save';
import { openDevTools } from '~/utils/WindowUtils';

export const ContextMenuItems: { [key: string]: MenuListOption } = {
  DevRefresh: {
    label: '[dev] Refresh',
    icon: '/icons/misc/refresh.png',
    onSelect: () => {
      location.reload();
    },
  },
  DevOpenDevTools: {
    label: '[dev] Open DevTools',
    icon: '/icons/misc/devtools.png',
    onSelect: async () => {
      await openDevTools(getCurrentWebview().label);
    },
  },
  Undo: {
    label: 'Undo',
    icon: '/icons/misc/undo.png',
    onSelect: () => {
      projectHistoryController.undo();
    },
  },
  Redo: {
    label: 'Redo',
    icon: '/icons/misc/redo.png',
    onSelect: () => {
      projectHistoryController.redo();
    },
  },
  Save: {
    label: 'Save Project',
    icon: '/icons/misc/save.png',
    onSelect: () => {
      saveProject();
    },
  },
  // BaseXxx = only label and icon. Use like: {...BaseXxx, onSelect: () => {} }
  // Registration for label+icon combinations only.
  BaseRemove: {
    label: 'Remove',
    icon: '/icons/misc/remove.png',
  },
  BaseDuplicate: {
    label: 'Duplicate',
    icon: '/icons/misc/duplicate.png',
  },
  BaseClear: {
    label: 'Clear',
    icon: '/icons/misc/clear.png',
  },
  BaseMergeDown: {
    label: 'Merge Down',
    icon: '/icons/misc/merge_down.png',
  },
  BaseImageShow: {
    label: 'Show',
    icon: '/icons/misc/show_image.png',
  },
  BaseImageHide: {
    label: 'Hide',
    icon: '/icons/misc/hide_image.png',
  },
  BaseTransfer: {
    label: 'Transfer to layer',
    icon: '/icons/misc/transfer.png',
  },
  BaseTransferRemove: {
    label: 'Transfer and Remove',
    icon: '/icons/misc/transfer_and_remove.png',
  },
};
