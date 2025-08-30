import { BaseHistoryAction } from '~/controllers/history/actions/BaseHistoryAction';

// new history controller for project-level history
export class ProjectHistoryController {
  private undoStack: BaseHistoryAction[] = [];
  private redoStack: BaseHistoryAction[] = [];
  private listeners: Set<(state: { canUndo: boolean; canRedo: boolean; lastLabel?: string }) => void> = new Set();

  constructor() {
    // Initialize the history controller
  }

  getUndoStack(): BaseHistoryAction[] {
    return this.undoStack;
  }

  getRedoStack(): BaseHistoryAction[] {
    return this.redoStack;
  }

  addAction(action: BaseHistoryAction): void {
    this.undoStack.push(action);
    this.redoStack = [];
    this.emitChange();
  }

  undo(): void {
    const action = this.undoStack.pop();
    if (action) {
      action.undo();
      this.redoStack.push(action);
      this.emitChange();
    }
  }

  redo(): void {
    const action = this.redoStack.pop();
    if (action) {
      action.redo();
      this.undoStack.push(action);
      this.emitChange();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  onChange(listener: (state: { canUndo: boolean; canRedo: boolean; lastLabel?: string }) => void): () => void {
    this.listeners.add(listener);
    // emit initial
    listener({ canUndo: this.canUndo(), canRedo: this.canRedo(), lastLabel: this.undoStack[this.undoStack.length - 1]?.label });
    return () => this.listeners.delete(listener);
  }

  private emitChange() {
    const lastLabel = this.undoStack[this.undoStack.length - 1]?.label;
    const snapshot = { canUndo: this.canUndo(), canRedo: this.canRedo(), lastLabel };
    this.listeners.forEach((l) => l(snapshot));
  }

  public clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  public isHistoryAvailable() {
    return this.getUndoStack().length > 0 || this.getRedoStack().length > 0;
  }
}

export const projectHistoryController = new ProjectHistoryController();
