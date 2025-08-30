import { flexRow } from '@sledge/core';
import { vars, ZFB03, ZFB08 } from '@sledge/theme';
import { Checkbox, Dropdown, DropdownOption, Slider } from '@sledge/ui';
import { open as openFile } from '@tauri-apps/plugin-dialog';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Component, createEffect, createSignal, onMount, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { saveGlobalSettings } from '~/io/config/save';
import { CanvasExportOptions, defaultExportDir, ExportableFileTypes, exportImage } from '~/io/image/out/export';
import { fileStore, setFileStore } from '~/stores/EditorStores';
import { lastSettingsStore, setLastSettingsStore } from '~/stores/GlobalStores';
import { canvasStore } from '~/stores/ProjectStores';
import {
  exportDialogContent,
  exportDialogCustomScaleInput,
  exportDialogField,
  exportDialogFieldDisabled,
  exportDialogFieldHeader,
  exportDialogFileName,
  exportDialogRoot,
} from '~/styles/dialogs/export_dialog.css';
import { join } from '~/utils/FileUtils';
import { Dialog, DialogExternalProps } from './Dialog';

const fileTypeOptions: DropdownOption<ExportableFileTypes>[] = [
  { label: 'png', value: 'png' },
  { label: 'jpeg', value: 'jpg' },
  { label: 'svg', value: 'svg' },
];
const scaleOptions: DropdownOption<number>[] = [
  { label: 'x1', value: 1 },
  { label: 'x2', value: 2 },
  { label: 'x4', value: 4 },
  { label: 'x10', value: 10 },
  { label: 'CUSTOM', value: 0 },
];

export interface ExportSettings {
  dirPath?: string;
  fileName?: string;
  exportOptions: CanvasExportOptions;
  showDirAfterSave: boolean;
}

export interface ExportImageProps extends DialogExternalProps {
  onExport?: (payload: ExportSettings) => void;
}

const ExportDialog: Component<ExportImageProps> = (props) => {
  const nameWithoutExtension = () => fileStore.location.name?.replace(/\.sledge$/, '');

  const [settings, setSettings] = createStore<ExportSettings>({
    ...lastSettingsStore.exportSettings,
    fileName: nameWithoutExtension() ?? 'new project',
  });
  const [customScale, setCustomScale] = createSignal(1);

  const finalScale = () => (settings.exportOptions.scale !== 0 ? settings.exportOptions.scale : customScale()) ?? 1;

  onMount(async () => {
    if (settings.dirPath === '' || !settings.dirPath) setSettings('dirPath', await defaultExportDir());
  });

  createEffect(async () => {
    const dir = settings.dirPath;
    if (dir && !(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
  });

  const openDirSelectionDialog = async () => {
    const dir = await openFile({
      multiple: false,
      directory: true,
      defaultPath: settings.dirPath,
      canCreateDirectories: true,
    });

    if (dir) setSettings('dirPath', dir);
  };

  const requestExport = async () => {
    if (settings.exportOptions.scale === 0) return;

    props.onExport?.(settings);

    const name = settings.fileName;
    if (name === undefined) return;
    if (settings.dirPath) {
      const location = await exportImage(settings.dirPath, name, settings.exportOptions);
      if (location) {
        // setLastSettingsStore('exportSettings', 'dirPath', location.path);
        if (settings.showDirAfterSave && location.path && location.name) {
          await revealItemInDir(join(location.path, location.name));
        }
      }
    }

    if (fileStore.location.name === 'new project' && settings.fileName !== fileStore.location.name && settings.fileName) {
      setFileStore('location', 'name', settings.fileName);
    }
    setLastSettingsStore('exportSettings', settings);
    await saveGlobalSettings(true);
    props.onClose();
  };

  const close = () => {
    props.onClose();
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title='EXPORT.'
      closeByOutsideClick={false}
      leftButtons={[]}
      rightButtons={[
        {
          text: 'export!',
          accented: true,
          onClick: () => requestExport(),
        },
        {
          text: 'cancel',
          accented: false,
          onClick: () => close(),
        },
      ]}
    >
      <div class={exportDialogRoot}>
        <div class={exportDialogContent}>
          {/* <p class={exportDialogHeader}>EXPORT.</p> */}

          <div class={exportDialogFieldHeader}>
            <p class={exportDialogFieldHeader} style={{ 'flex-grow': 1 }}>
              Output Directory.
            </p>
            <div style={{ 'align-items': 'center', gap: '12px', 'margin-left': '12px' }} class={flexRow}>
              <p style={{ 'font-family': ZFB03, 'font-size': '8px', 'flex-grow': 1, 'text-overflow': 'ellipsis' }}>{settings.dirPath}\</p>
              <button onClick={openDirSelectionDialog}>change</button>
            </div>
            <div class={flexRow} style={{ 'align-items': 'end', 'margin-left': '12px' }}>
              <input
                class={exportDialogFileName}
                value={settings.fileName}
                autocomplete='off'
                onInput={(e) => setSettings('fileName', e.target.value)}
              />
              <p style={{ 'font-size': vars.text.sm, 'margin-bottom': '2px', 'font-family': ZFB08 }}>.{settings.exportOptions.format}</p>
            </div>
          </div>
          <div class={flexRow} style={{ gap: vars.spacing.md }}>
            <div class={exportDialogField}>
              <p class={exportDialogFieldHeader}>Type.</p>
              <div class={flexRow} style={{ 'margin-left': '12px' }}>
                <Dropdown
                  options={fileTypeOptions}
                  value={settings.exportOptions.format}
                  onChange={(e) => setSettings('exportOptions', 'format', e)}
                />
              </div>
            </div>

            <div class={settings.exportOptions.format === 'jpg' ? exportDialogField : exportDialogFieldDisabled} style={{ 'flex-grow': 1 }}>
              <p class={exportDialogFieldHeader} style={{ 'padding-bottom': '4px' }}>
                Quality.
              </p>
              <div class={flexRow} style={{ 'margin-left': '12px' }}>
                <Slider
                  labelMode={'left'}
                  defaultValue={settings.exportOptions.quality}
                  value={settings.exportOptions.quality}
                  allowDirectInput={true}
                  min={0}
                  max={100}
                  onChange={(v) => setSettings('exportOptions', 'quality', v)}
                />
              </div>
            </div>
          </div>

          <div class={exportDialogField}>
            <p class={exportDialogFieldHeader}>Scale.</p>
            <div class={flexRow} style={{ 'align-items': 'center', gap: '12px', 'margin-left': '12px' }}>
              <Dropdown
                options={scaleOptions}
                value={settings.exportOptions.scale ?? 1}
                onChange={(e) => setSettings('exportOptions', 'scale', Number(e))}
              />
              <Show when={settings.exportOptions.scale === 0}>
                <div style={{ 'align-items': 'center' }} class={flexRow}>
                  <p>x</p>
                  <input
                    class={exportDialogCustomScaleInput}
                    type='number'
                    onInput={(e) => setCustomScale(Number(e.target.value))}
                    min={0.1}
                    max={20}
                    maxLength={2}
                  />
                </div>
              </Show>
            </div>
            <p style={{ 'margin-top': '8px' }}>
              estimated size: {canvasStore.canvas.width * finalScale()} x {canvasStore.canvas.height * finalScale()}
            </p>
          </div>
        </div>
        <div class={flexRow} style={{ width: '100%', 'justify-content': 'end', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
          <Checkbox
            checked={settings.showDirAfterSave}
            onChange={(checked) => setSettings('showDirAfterSave', checked)}
            label='open dir after save'
            labelMode='left'
          />
        </div>
      </div>
    </Dialog>
  );
};
export default ExportDialog;
