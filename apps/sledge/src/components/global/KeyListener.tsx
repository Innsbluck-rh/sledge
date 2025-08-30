import { Component, onCleanup, onMount } from 'solid-js';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import {
  getActiveToolCategoryId,
  getCurrentPresetConfig,
  getPrevActiveToolCategoryId,
  setActiveToolCategory,
  updateToolPresetConfig,
} from '~/controllers/tool/ToolController';
import { saveProject } from '~/io/project/out/save';
import { fileStore, toolStore } from '~/stores/EditorStores';
import { keyConfigStore } from '~/stores/GlobalStores';
import { openDebugViewer } from '~/utils/DebugViewer';
import { isKeyMatchesToEntry } from '../../controllers/config/KeyConfigController';

const KeyListener: Component = () => {
  // Helper function to check if the active element is an input field
  const isInputFocused = () => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';

    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isContentEditable;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r')) {
      e.preventDefault();
    }

    if (toolStore.activeToolCategory === 'rectSelection' && e.altKey) return;
    if (toolStore.activeToolCategory === 'autoSelection' && e.altKey) return;

    // Check if input is focused early to avoid unnecessary processing
    const inputFocused = isInputFocused();

    if (isKeyMatchesToEntry(e, keyConfigStore['save']) && !e.repeat) {
      e.preventDefault(); // Prevent default save action
      saveProject(fileStore.location.name, fileStore.location.path);
    }

    // デバッグビューア用ショートカット (Ctrl+Shift+D) - always allow this
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      openDebugViewer();
    }

    // Skip other shortcuts if an input field is focused
    if (inputFocused) {
      return;
    }

    if (isKeyMatchesToEntry(e, keyConfigStore['undo'])) {
      projectHistoryController.undo();
    }
    if (isKeyMatchesToEntry(e, keyConfigStore['redo'])) {
      projectHistoryController.redo();
    }

    if (isKeyMatchesToEntry(e, keyConfigStore['sizeIncrease'])) {
      const currentToolId = getActiveToolCategoryId();
      const selectedPreset = toolStore.tools[currentToolId]?.presets?.selected;
      if (selectedPreset !== undefined) {
        const presetConfig = getCurrentPresetConfig(currentToolId);
        const currentSize = presetConfig?.size;
        if (currentSize !== undefined) {
          updateToolPresetConfig(currentToolId, selectedPreset, 'size', currentSize + 1);
        }
      }
    }

    if (isKeyMatchesToEntry(e, keyConfigStore['sizeDecrease'])) {
      const currentToolId = getActiveToolCategoryId();
      const selectedPreset = toolStore.tools[currentToolId]?.presets?.selected;
      if (selectedPreset !== undefined) {
        const presetConfig = getCurrentPresetConfig(currentToolId);
        const currentSize = presetConfig?.size;
        if (currentSize !== undefined && currentSize > 1) {
          updateToolPresetConfig(currentToolId, selectedPreset, 'size', currentSize - 1);
        }
      }
    }

    if (isKeyMatchesToEntry(e, keyConfigStore['pipette'])) setActiveToolCategory('pipette');

    if (!e.repeat) {
      if (isKeyMatchesToEntry(e, keyConfigStore['pen'])) setActiveToolCategory('pen');
      if (isKeyMatchesToEntry(e, keyConfigStore['eraser'])) setActiveToolCategory('eraser');
      if (isKeyMatchesToEntry(e, keyConfigStore['fill'])) setActiveToolCategory('fill');
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // Skip shortcuts if an input field is focused
    if (isInputFocused()) {
      return;
    }

    if (!isKeyMatchesToEntry(e, keyConfigStore['pipette']) && getActiveToolCategoryId() === 'pipette') {
      console.log('Pipette tool deactivated');
      setActiveToolCategory(getPrevActiveToolCategoryId() || 'pen');
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  });
  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  });

  return null;
};

export default KeyListener;
