import { Vec2 } from '@sledge/core';
import { getAgentOf } from '~/controllers/layer/LayerAgentManager';
import { findLayerById } from '~/controllers/layer/LayerListController';
import LayerImageAgent from '~/controllers/layer/image/LayerImageAgent';
import { DebugLogger, setBottomBarText } from '~/controllers/log/LogController';
import { getPrevActiveToolCategoryId, isToolAllowedInCurrentLayer, setActiveToolCategory } from '~/controllers/tool/ToolController';
import { interactStore } from '~/stores/EditorStores';
import { ToolArgs, ToolResult } from '~/tools/ToolBehavior';
import { ToolCategory } from '~/tools/Tools';
import { hexToRGBA } from '~/utils/ColorUtils';
import { eventBus } from '~/utils/EventBus';
import { currentColor } from '../color/ColorController';

export enum DrawState {
  start,
  move,
  end,
  cancel,
}

const LOG_LABEL = 'LayerCanvasOperator';
const logger = new DebugLogger(LOG_LABEL, false);

export default class LayerCanvasOperator {
  constructor(private readonly getLayerIdToDraw: () => string) {}

  private getMagnificatedPosition(position: Vec2, dotMagnification: number) {
    return {
      x: Math.floor(position.x / dotMagnification),
      y: Math.floor(position.y / dotMagnification),
    };
  }

  public handleDraw(state: DrawState, originalEvent: PointerEvent, toolCategory: ToolCategory, position: Vec2, lastPosition?: Vec2) {
    const agent = getAgentOf(this.getLayerIdToDraw());
    if (!agent) return;
    const layer = findLayerById(this.getLayerIdToDraw());
    if (!layer) return;

    const rawPosition = position;
    const rawLastPosition = lastPosition;

    position = this.getMagnificatedPosition(position, layer.dotMagnification);
    if (lastPosition) lastPosition = this.getMagnificatedPosition(lastPosition, layer.dotMagnification);

    if (toolCategory.behavior.onlyOnCanvas && !interactStore.isMouseOnCanvas) return;

    // This won't suppress all draw actions on inactive layers.
    // It's due to prevent showing warn in every click out of canvas.
    if (!isToolAllowedInCurrentLayer(toolCategory) && interactStore.isMouseOnCanvas) {
      console.warn('Layer is inactive.');
      setBottomBarText('Layer is inactive.', {
        kind: 'error',
        duration: 1000,
      });
      return;
    }

    // This will suppress all draw actions on inactive layers.
    if (!isToolAllowedInCurrentLayer(toolCategory)) {
      return;
    }

    const toolArgs: ToolArgs = {
      rawPosition,
      rawLastPosition,
      position,
      lastPosition,
      presetName: toolCategory.presets?.selected,
      color: hexToRGBA(currentColor()),
      event: originalEvent,
    };
    const result = this.useTool(agent, state, toolCategory, toolArgs);

    if (result) {
      if (result.shouldUpdate) {
        eventBus.emit('webgl:requestUpdate', { onlyDirty: true, context: 'LayerCanvasOperator (action: ' + DrawState[state] + ')' });
        eventBus.emit('preview:requestUpdate', { layerId: layer.id });
      }
      if (result.shouldRegisterToHistory) {
        agent.registerToHistory({ tool: toolCategory.id });
      }

      if (result.shouldReturnToPrevTool) {
        const prevTool = getPrevActiveToolCategoryId();
        if (prevTool) setActiveToolCategory(prevTool);
      }
    }
  }

  private useTool(agent: LayerImageAgent, state: DrawState, tool: ToolCategory, toolArgs: ToolArgs) {
    let toolResult: ToolResult | undefined = undefined;
    const start = new Date().getTime();
    switch (state) {
      case DrawState.start:
        toolResult = tool.behavior.onStart(agent, toolArgs);
        break;
      case DrawState.move:
        toolResult = tool.behavior.onMove(agent, toolArgs);
        break;
      case DrawState.end:
        toolResult = tool.behavior.onEnd(agent, toolArgs);
        break;
      case DrawState.cancel:
        toolResult = tool.behavior.onCancel?.(agent, toolArgs);
        break;
    }
    const end = new Date().getTime();
    logger.debugLog(`${tool.name} ${DrawState[state]} executed in ${end - start} ms: ${toolResult}`);
    if (toolResult?.result) {
      setBottomBarText(toolResult.result, {
        duration: 1500,
      });
    }
    return toolResult;
  }
}
