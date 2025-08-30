## Note

NOTE that the editor still uses layer-level history in production (= HistoryController & HistoryManager).
Project-level history is under active development and is not wired into the editor UI yet.

A new controller exists at `./ProjectHistoryController.ts` and is used by tests. It provides:

- undo/redo stacks (undoStack/redoStack)
- canUndo()/canRedo()
- onChange(listener) with lastLabel for UI
- action.label support via BaseHistoryAction

# History Actions

A HistoryAction is the atomic "unit" of project-level history.
Each action type implements undo/redo; both operations should be idempotent.

## Canvas Size

Status: [OK](./actions/CanvasSizeHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.canvasSize.test.ts)

- Currently it only changes the canvas dimensions in the store.
- Limitation: it does not restore content that was clipped or create content for newly visible areas after resizing.

## Color History

Status: [OK](./actions/ColorHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.color.test.ts)

## Image Pool

Status: [OK](./actions/ImagePoolHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.imagePool.test.ts)

## Image Pool Entry Props

Status: [OK](./actions/ImagePoolEntryPropsHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.imagePoolEntryProps.test.ts)

## Layer Buffer

Status: [OK](./actions/LayerBufferHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.layerBuffer.test.ts)

- Diff payloads are kept as arrays for serialization; bridged to Map when delegating to LayerImageAgent.
- If a selection is currently being moved, the action cancels the move locally and becomes a no-op (not centralized).

## Layer List

Status: [OK](./actions/LayerListHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.layerList.test.ts)

- Kinds: add / delete / reorder
- add/delete uses a layer snapshot with an optional pixel buffer to restore content and preserve the layer id
- reorder uses beforeOrder/afterOrder id arrays to be robust across multiple moves

## Layer Props

Status: [OK](./actions/LayerPropsHistoryAction.ts)
Test: [Written](../../../test/history/HistoryActions.layerProps.test.ts)

<br>

## Test Logging

Optional logging during tests:

- Set VITEST_LOG_SEQ=1 to log sequential steps
- Set VITEST_LOG_RND=1 to log randomized steps (seed is fixed in test)
