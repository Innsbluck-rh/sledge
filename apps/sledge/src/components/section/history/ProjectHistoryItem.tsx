import { flexRow } from '@sledge/core';
import { vars } from '@sledge/theme';
import { Icon } from '@sledge/ui';
import { Accessor, Component, createMemo, For, onMount, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import SectionItem from '~/components/section/SectionItem';
import { BaseHistoryAction } from '~/controllers/history/actions/BaseHistoryAction';
import { CanvasSizeHistoryAction } from '~/controllers/history/actions/CanvasSizeHistoryAction';
import { ColorHistoryAction } from '~/controllers/history/actions/ColorHistoryAction';
import { ImagePoolEntryPropsHistoryAction } from '~/controllers/history/actions/ImagePoolEntryPropsHistoryAction';
import { ImagePoolHistoryAction } from '~/controllers/history/actions/ImagePoolHistoryAction';
import { LayerBufferHistoryAction } from '~/controllers/history/actions/LayerBufferHistoryAction';
import { LayerListHistoryAction } from '~/controllers/history/actions/LayerListHistoryAction';
import { LayerPropsHistoryAction } from '~/controllers/history/actions/LayerPropsHistoryAction';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { findLayerById } from '~/controllers/layer/LayerListController';
import { sectionContent, sectionSubCaption, sectionSubContent } from '~/styles/section/section_item.css';
import { toolCategories } from '~/tools/Tools';
import { RGBAToHex } from '~/utils/ColorUtils';

const ProjectHistoryItem: Component = () => {
  const [historyStore, setHistoryStore] = createStore<{
    undoStack: BaseHistoryAction[];
    redoStack: BaseHistoryAction[];
  }>({
    undoStack: projectHistoryController.getUndoStack(),
    redoStack: projectHistoryController.getRedoStack(),
  });

  onMount(() => {
    setHistoryStore((prev) => {
      return {
        undoStack: projectHistoryController.getUndoStack(),
        redoStack: projectHistoryController.getRedoStack(),
      };
    });
    const dispose = projectHistoryController.onChange((state) => {
      setHistoryStore((prev) => {
        return {
          undoStack: [...projectHistoryController.getUndoStack()],
          redoStack: [...projectHistoryController.getRedoStack()],
        };
      });
    });

    return () => dispose();
  });

  return (
    <SectionItem title={`history`}>
      <div class={sectionContent} style={{ gap: '8px', 'margin-bottom': '8px', 'padding-top': '8px' }}>
        <div class={flexRow} style={{ gap: '8px', 'align-items': 'center' }}>
          <p style={{ color: vars.color.active }}>top = recent / bottom = oldest</p>
        </div>

        <p class={sectionSubCaption}>redo stack ({historyStore.redoStack.length})</p>
        <div class={sectionSubContent} style={{ 'flex-direction': 'column-reverse' }}>
          <Show when={historyStore.redoStack.length > 0} fallback={<p style={{ color: vars.color.muted }}>&lt; no redo stack &gt;</p>}>
            <For each={historyStore.redoStack}>
              {(action, i) => {
                const index = createMemo(() => historyStore.redoStack.length - i() - 1);
                return <HistoryRow undo={false} action={action} index={index} />;
              }}
            </For>
          </Show>
        </div>

        <p class={sectionSubCaption}>{`undo stack (${historyStore.undoStack.length})`}</p>
        <div class={sectionSubContent} style={{ 'flex-direction': 'column-reverse' }}>
          <Show when={historyStore.undoStack.length > 0} fallback={<p style={{ color: vars.color.muted }}>&lt; no undo stack &gt;</p>}>
            <For each={historyStore.undoStack}>{(action, i) => <HistoryRow undo={true} action={action} index={i()} />}</For>
          </Show>
        </div>
      </div>
    </SectionItem>
  );
};

function getIconForTool(tool?: string) {
  if (!tool) return '';

  if (tool in toolCategories) {
    const categoryId = tool as keyof typeof toolCategories;
    return toolCategories[categoryId].iconSrc;
  }
  switch (tool) {
    case 'clear':
      return 'icons/misc/clear.png';
    case 'fx':
      return 'icons/misc/fx.png';
  }

  return '';
}

const HistoryRow: Component<{ undo?: boolean; action: BaseHistoryAction; index?: Accessor<number> | number }> = ({ undo = true, action, index }) => {
  const { context } = action;
  let colorIcon:
    | {
        old: string;
        new: string;
      }
    | undefined = undefined;
  let icon = getIconForTool(context.tool);
  let description = '';
  switch (action.type) {
    case 'canvas_size':
      const csaction = action as CanvasSizeHistoryAction;
      const bigger = csaction.newSize.width * csaction.newSize.height >= csaction.oldSize.width * csaction.oldSize.height;
      icon = bigger ? 'icons/misc/canvas_size_bigger.png' : 'icons/misc/canvas_size_smaller.png';
      description = `${csaction.oldSize.width}x${csaction.oldSize.height} -> ${csaction.newSize.width}x${csaction.newSize.height}`;
      break;
    case 'image_pool':
      icon = 'icons/misc/image.png';
      const ipaction = action as ImagePoolHistoryAction;
      description = `${ipaction.kind} -> ${ipaction.targetEntry.fileName}`;
      break;
    case 'image_pool_entry_props':
      icon = 'icons/misc/image.png';
      const ipepaction = action as ImagePoolEntryPropsHistoryAction;
      description = `${ipepaction.newEntryProps.fileName}`;
      break;
    case 'color':
      const claction = action as ColorHistoryAction;
      const oldHex = `#${RGBAToHex(claction.oldColor)}`;
      const newHex = `#${RGBAToHex(claction.newColor)}`;
      description = `${oldHex} -> ${newHex}`;
      colorIcon = {
        old: oldHex,
        new: newHex,
      };
      break;
    case 'layer_list':
      icon = 'icons/misc/layer.png';
      const llaction = action as LayerListHistoryAction;
      description = `${llaction.kind} / ${llaction.layerSnapshot?.name}`;
      break;
    case 'layer_buffer':
      const lbaction = action as LayerBufferHistoryAction;
      if (context.tool === 'fx') {
        description = `${findLayerById(lbaction.layerId)?.name}/${context.fxName || 'unknown effect'}`;
      } else {
        const patch = lbaction.patch;
        const pixels = patch.pixels
          ? `${
              patch.pixels.reduce((prev, pixelList) => {
                prev += pixelList.idx.length;
                return prev;
              }, 0) ?? 0
            } pixels`
          : '';
        const tiles = patch.tiles ? `${patch.tiles.length ?? 0} tiles` : '';
        const whole = patch.whole ? `whole` : '';
        description = `${findLayerById(lbaction.layerId)?.name} / ${[pixels, tiles, whole].join(' ')}`;
      }
      break;
    case 'layer_props':
      icon = 'icons/misc/layer.png';
      const lpaction = action as LayerPropsHistoryAction;
      description = `${findLayerById(lpaction.layerId)?.name} props change`;
      break;
    default:
      description = '<unknown>';
  }

  return (
    <div
      class={flexRow}
      style={{ 'box-sizing': 'border-box', height: 'auto', gap: '8px', 'align-items': 'center', overflow: 'hidden' }}
      title={`${action.label ?? 'no label.'}\n${JSON.stringify(action.context)}`}
    >
      <p style={{ width: '18px' }}>{typeof index === 'function' ? index() : index}</p>
      {/* <div>
        <Icon src={undo ? 'icons/misc/undo.png' : 'icons/misc/redo.png'} color={vars.color.onBackground} base={8} scale={1} />
      </div> */}
      <Show
        when={colorIcon}
        fallback={
          <div>
            <Icon src={icon || ''} color={vars.color.onBackground} base={8} scale={1} />
          </div>
        }
      >
        <div style={{ width: '8px', height: '8px', position: 'relative', overflow: 'hidden', 'background-color': colorIcon!.new }}>
          {/* <div style={{ width: '6px', height: '6px', position: 'absolute', top: 0, left: 0, 'background-color': colorIcon!.old }} />
          <div style={{ width: '6px', height: '6px', position: 'absolute', top: '2px', left: '2px', 'background-color': colorIcon!.new }} /> */}
        </div>
      </Show>
      {/* <p style={{ width: '100px', opacity: 0.75 }}>{action.type}</p> */}
      <p style={{ 'white-space': 'pre-line', 'text-overflow': 'ellipsis', overflow: 'visible' }}>{description}</p>
    </div>
  );
};

export default ProjectHistoryItem;
