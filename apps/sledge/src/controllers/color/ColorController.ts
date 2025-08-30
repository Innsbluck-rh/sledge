import { projectHistoryController } from '~/controllers/history/ProjectHistoryController';
import { ColorHistoryAction } from '~/controllers/history/actions/ColorHistoryAction';
import { PaletteType } from '~/models/color/PaletteType';
import { colorStore, setColorStore } from '~/stores/EditorStores';
import { hexToRGBA } from '~/utils/ColorUtils';

export const currentColor = (): string => {
  return colorStore[colorStore.currentPalette];
};

interface SetCurrentColorOptions {
  noDiff?: boolean;
}

export const setCurrentColor = (colorHexString: string, options?: SetCurrentColorOptions) => {
  const palette = colorStore.currentPalette;
  const oldHex = colorStore[palette];
  // Update state first
  const result = setColorStore(palette, colorHexString);
  if (!options?.noDiff) {
    // Push history action (old/new as RGBA)
    const oldRGBA = hexToRGBA(oldHex);
    const newRGBA = hexToRGBA(colorHexString);
    const action = new ColorHistoryAction(palette as PaletteType, oldRGBA, newRGBA, { from: 'ColorController.setCurrentColor' });
    projectHistoryController.addAction(action);
  }
  return result;
};
export const setColor = (palette: PaletteType, colorHexString: string) => {
  return setColorStore(palette, colorHexString);
};
export const selectPalette = (palette: PaletteType) => {
  return setColorStore('currentPalette', palette);
};
