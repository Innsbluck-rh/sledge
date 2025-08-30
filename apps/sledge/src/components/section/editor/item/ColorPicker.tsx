import iro from '@jaames/iro';
import { IroColorPicker } from '@jaames/iro/dist/ColorPicker';
import { Component, createEffect, createSignal, onMount } from 'solid-js';
import { currentColor, setCurrentColor } from '~/controllers/color/ColorController';
import { ColorHistoryAction } from '~/controllers/history/actions/ColorHistoryAction';
import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { colorStore } from '~/stores/EditorStores';
import { hexToRGBA, RGBAColor } from '~/utils/ColorUtils';

const ColorPicker: Component<{ width: number }> = (props) => {
  let colorPicker: IroColorPicker;

  const [colorOnPointerDown, setColorOnPointerDown] = createSignal<RGBAColor | undefined>(undefined);

  createEffect(() => {
    colorPicker.setColors([currentColor()]);
  });

  const handlePointerUp = () => {
    const oldColor = colorOnPointerDown();
    if (oldColor) {
      const action = new ColorHistoryAction(colorStore.currentPalette, oldColor, hexToRGBA(colorPicker.color.hexString), {
        from: 'ColorController.setCurrentColor',
      });
      projectHistoryController.addAction(action);
    }
    setColorOnPointerDown(undefined);
  };

  onMount(() => {
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
    };
  });

  return (
    <div
      ref={(el) => {
        colorPicker = iro.ColorPicker(el, {
          width: props.width,
          padding: 0,
          color: currentColor(),
          handleRadius: 4,
          layoutDirection: 'horizontal',
          layout: [
            {
              component: iro.ui.Box,
              options: {},
            },
            {
              component: iro.ui.Slider,
              options: {
                // can also be 'saturation', 'value', 'red', 'green', 'blue', 'alpha' or 'kelvin'
                sliderType: 'hue',
              },
            },
          ],
        });
        colorPicker.on('color:change', function (color: any) {
          setCurrentColor(color.hexString, { noDiff: true });
        });
      }}
      onPointerDown={(e) => {
        setColorOnPointerDown(hexToRGBA(currentColor()));
      }}
    />
  );
};

export default ColorPicker;
