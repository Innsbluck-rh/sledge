import { flexRow } from '@sledge/core';
import { vars } from '@sledge/theme';
import { Dropdown, Slider } from '@sledge/ui';
import { Component, createEffect, createSignal, For } from 'solid-js';
import SectionItem from '~/components/section/SectionItem';
import { setLayerProp } from '~/controllers/layer/LayerController';
import { activeLayer, addLayer, allLayers, moveLayer, removeLayer } from '~/controllers/layer/LayerListController';
import { BlendModeOptions } from '~/models/layer/Layer';
import { layerListStore } from '~/stores/ProjectStores';
import { layerList } from '~/styles/section/editor/layer.css';
import { sectionContent } from '~/styles/section/section_item.css';
import { listenEvent } from '~/utils/TauriUtils';
import { useLongPressReorder } from '~/utils/useLongPressReorder';
import BaseLayerItem from './item/BaseLayerItem';
import LayerItem from './item/LayerItem';

const LayerList: Component<{}> = () => {
  const [items, setItems] = createSignal(allLayers());
  const [activeItem, setActiveItem] = createSignal<string | null>(null);
  const ids = () => items().map((l) => l.id);

  listenEvent('onSetup', () => {
    setItems(allLayers());
  });

  createEffect(() => {
    setItems(allLayers());
  });

  function handleMove(draggedId: string, targetIndex: number) {
    const fromIndex = layerListStore.layers.findIndex((l) => l.id === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;

    moveLayer(fromIndex, targetIndex);
    setItems(allLayers());
  }

  // DnD hook wiring
  let listRef: HTMLDivElement | undefined;
  const dnd = useLongPressReorder({
    getItems: items,
    getId: (l) => l.id,
    containerRef: () => listRef,
    longPressMs: 350,
    onDrop: (from, to, id) => {
      const adjusted = to > from ? to - 1 : to;
      handleMove(id, adjusted);
      setActiveItem(null);
    },
  });

  return (
    <SectionItem
      title='layers.'
      subHeaderIcons={[
        {
          src: '/icons/misc/plus_12.png',
          onClick: () => {
            addLayer({ name: 'layer1' });
            setItems(allLayers());
          },
        },
        {
          src: '/icons/misc/minus_12.png',
          onClick: () => {
            const id = activeLayer()?.id;
            if (id) {
              // LayerListController.removeLayer already adds history; just call it
              removeLayer(id);
            }
            setItems(allLayers());
          },
          disabled: layerListStore.layers.length <= 1,
        },
      ]}
    >
      <div class={sectionContent}>
        <div
          class={flexRow}
          style={{
            'align-items': 'center',
            gap: vars.spacing.sm,
            'margin-bottom': vars.spacing.sm,
          }}
        >
          <div
            class={flexRow}
            style={{
              width: '120px',
              height: 'auto',
            }}
          >
            <Dropdown
              value={activeLayer().mode}
              options={BlendModeOptions}
              onChange={(e) => {
                setLayerProp(activeLayer().id, 'mode', e);
              }}
            />
          </div>
          <div class={flexRow} style={{ width: '100%', 'align-items': 'center' }}>
            <p style={{ width: '36px' }}>{Math.ceil(activeLayer().opacity * 100)}%</p>
            <Slider
              value={activeLayer().opacity}
              min={0}
              max={1}
              allowFloat={true}
              floatSignificantDigits={2}
              labelMode={'none'}
              onChange={(newValue) => {
                setLayerProp(activeLayer().id, 'opacity', newValue, {
                  noDiff: true,
                });
              }}
            />
          </div>
        </div>

        <div class={layerList} ref={(el) => (listRef = el)}>
          {/* <ImagePoolItem /> */}
          <For each={items()}>
            {(layer, index) => {
              return (
                <div
                  ref={(el) => dnd.registerItem(el, layer.id)}
                  onPointerDown={(e) => dnd.onPointerDown(e, layer.id)}
                  // isolate pointer to allow intentional long-press without scrolling
                  style={{ 'touch-action': 'none' }}
                >
                  <LayerItem layer={layer} index={index()} isLast={index() === items().length - 1} />
                </div>
              );
            }}
          </For>
          <BaseLayerItem />
        </div>
      </div>
    </SectionItem>
  );
};

export default LayerList;
