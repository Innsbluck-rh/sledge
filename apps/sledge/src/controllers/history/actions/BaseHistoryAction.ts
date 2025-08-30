export type HistoryActionTypes =
  | 'canvas_size'
  | 'color'
  | 'image_pool'
  | 'image_pool_entry_props'
  | 'layer_buffer'
  | 'layer_list'
  | 'layer_props'
  | 'unknown';

// not in use for now
type UnusedHistoryActionTypes = 'project' | 'interact_move' | 'section_resize';

// Base class for all history actions
export abstract class BaseHistoryAction {
  abstract readonly type: HistoryActionTypes;

  constructor(
    public readonly context?: any, // The context for action (used for log etc)
    public readonly label?: string // A short label for UI like "Undo: Brush" etc.
  ) {}

  abstract undo(): void;
  abstract redo(): void;
}
