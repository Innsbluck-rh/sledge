import { flexCol, flexRow } from '@sledge/core';
import { accentedButton, k12x8, vars } from '@sledge/theme';
import { Checkbox, Dropdown, DropdownOption, Slider } from '@sledge/ui';
import { confirm, open } from '@tauri-apps/plugin-dialog';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Component, createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { saveGlobalSettings } from '~/io/config/save';
import { CanvasExportOptions, defaultExportDir, ExportableFileTypes, exportImage } from '~/io/image/out/export';
import { fileStore, setFileStore } from '~/stores/EditorStores';
import { lastSettingsStore, setLastSettingsStore } from '~/stores/GlobalStores';
import { canvasStore } from '~/stores/ProjectStores';
import { exportDialogCustomScaleInput, exportDialogField, exportDialogFieldDisabled } from '~/styles/dialogs/export_dialog.css';
import { sectionContent, sectionSubCaption, sectionSubContent } from '~/styles/section/section_item.css';
import { join } from '~/utils/FileUtils';

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

const ExportContent: Component = () => {
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
    const dir = await open({
      multiple: false,
      directory: true,
      defaultPath: settings.dirPath,
      canCreateDirectories: true,
    });

    if (dir) setSettings('dirPath', dir);
  };

  const requestExport = async () => {
    if (settings.exportOptions.scale === 0) return;

    const name = settings.fileName;
    if (name === undefined) return;
    if (settings.dirPath) {
      const filePath = join(settings.dirPath, `${name}.${settings.exportOptions.format}`);
      if (await exists(filePath)) {
        const ok = await confirm(`File already exists:\n${filePath}\n\nOverwrite?`, {
          kind: 'info',
          okLabel: 'Overwrite',
          cancelLabel: 'Cancel',
          title: 'Export',
        });
        if (!ok) {
          console.warn('export cancelled.');
          return;
        }
      }

      const location = await exportImage(settings.dirPath, name, settings.exportOptions);
      if (location) {
        // setLastSettingsStore('exportSettings', 'dirPath', location.path);
        if (settings.showDirAfterSave && location.path && location.name) {
          await revealItemInDir(join(location.path, location.name));
        }
      }
    }

    if (fileStore.location.name === 'new project' && settings.fileName !== fileStore.location.name && settings.fileName) {
      const fileNameWithoutExt = settings.fileName.split('.').slice(0, -1).join('.');
      setFileStore('location', 'name', fileNameWithoutExt);
    }
    setLastSettingsStore('exportSettings', settings);
    await saveGlobalSettings(true);
  };

  const exportDirHistoryOptions = createMemo<DropdownOption<string>[]>(() => {
    const options: DropdownOption<string>[] = lastSettingsStore.exportedDirPaths.map((path: string) => {
      return {
        label: path,
        value: path,
      };
    });

    return options.reverse();
  });

  return (
    <div class={sectionContent} style={{ gap: '12px', 'box-sizing': 'border-box' }}>
      <div class={flexCol}>
        <p class={sectionSubCaption} style={{ 'margin-bottom': '8px', width: '100%' }}>
          Recent folders.
        </p>
        <div class={sectionSubContent}>
          <Dropdown
            options={exportDirHistoryOptions() ?? []}
            value={lastSettingsStore.exportedDirPaths.find((p) => p === (settings.dirPath ?? '')) ?? ''}
            onChange={(path) => setSettings('dirPath', path as string)}
            align='right'
            fontFamily={k12x8}
            fullWidth={true}
          />
        </div>
      </div>

      <div class={flexCol}>
        <p class={sectionSubCaption} style={{ 'margin-bottom': '8px' }}>
          Output Directory.
        </p>
        <div class={sectionSubContent}>
          <p
            style={{
              'font-family': k12x8,
              'font-size': '8px',
              'line-height': 1.2,
              'word-wrap': 'break-word',
              'text-wrap': 'balance',
              width: '100%',
              padding: '4px',
            }}
          >
            {settings.dirPath}\
          </p>
          <button style={{ 'white-space': 'nowrap', 'align-self': 'end' }} onClick={openDirSelectionDialog}>
            browse...
          </button>
        </div>
      </div>

      <div class={flexCol}>
        <p class={sectionSubCaption} style={{ 'margin-bottom': '8px' }}>
          File Name.
        </p>
        <div class={sectionSubContent}>
          <input
            style={{ width: 'auto', 'font-size': '16px', 'font-family': k12x8, 'border-bottom-color': vars.color.border }}
            placeholder='file name'
            value={settings.fileName}
            autocomplete='off'
            onInput={(e) => setSettings('fileName', e.target.value)}
          />
        </div>
      </div>

      <div class={flexCol}>
        <p class={sectionSubCaption} style={{ 'margin-bottom': '8px' }}>
          Format.
        </p>
        <div class={sectionSubContent}>
          <Dropdown options={fileTypeOptions} value={settings.exportOptions.format} onChange={(e) => setSettings('exportOptions', 'format', e)} />
        </div>
      </div>

      <div class={settings.exportOptions.format === 'jpg' ? exportDialogField : exportDialogFieldDisabled} style={{ 'flex-grow': 1 }}>
        <p class={sectionSubCaption} style={{ 'margin-bottom': '8px' }}>
          Quality.
        </p>
        <div class={sectionSubContent}>
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

      <div class={flexCol}>
        <p class={sectionSubCaption} style={{ 'margin-bottom': '8px' }}>
          Scale.
        </p>
        <div class={sectionSubContent}>
          <div class={flexRow} style={{ 'align-items': 'center', gap: '12px' }}>
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
        </div>
      </div>

      <div class={flexCol} style={{ 'align-items': 'end', 'justify-content': 'right', gap: '8px', 'margin-top': '8px' }}>
        <p style={{ width: 'fit-content' }}>
          estimated size: {canvasStore.canvas.width * finalScale()} x {canvasStore.canvas.height * finalScale()}
        </p>
        <div class={flexRow} style={{ width: '100%', 'justify-content': 'end', 'align-items': 'center', gap: '8px', 'margin-bottom': '8px' }}>
          <Checkbox
            checked={settings.showDirAfterSave}
            onChange={(checked) => setSettings('showDirAfterSave', checked)}
            label='open dir after save'
            labelMode='left'
          />
        </div>

        <button class={accentedButton} onClick={(e) => requestExport()}>
          Export
        </button>
      </div>
    </div>
  );
};

export default ExportContent;
