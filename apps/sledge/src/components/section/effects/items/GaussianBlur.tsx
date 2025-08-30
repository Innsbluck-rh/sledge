import { flexCol } from '@sledge/core';
import { accentedButton } from '@sledge/theme';
import { Slider, ToggleSwitch } from '@sledge/ui';
import { AlphaBlurMode, gaussian_blur, GaussianBlurOption } from '@sledge/wasm';
import { Component, createSignal } from 'solid-js';
import SectionItem from '~/components/section/SectionItem';
import { getActiveAgent } from '~/controllers/layer/LayerAgentManager';
import { canvasStore } from '~/stores/ProjectStores';
import { sectionContent, sectionSubCaption, sectionSubContent } from '~/styles/section/section_item.css';

const GaussianBlur: Component = () => {
  const [blurOptions, setBlurOptions] = createSignal<GaussianBlurOption>(new GaussianBlurOption(1000, AlphaBlurMode.Blur));
  return (
    <SectionItem title='gaussian blur.'>
      <div class={sectionContent} style={{ gap: '4px', 'margin-bottom': '8px' }}>
        <p class={sectionSubCaption}>radius.</p>
        <div class={sectionSubContent}>
          <Slider
            labelMode='left'
            value={blurOptions().radius}
            min={0}
            max={1000}
            allowFloat={false}
            onChange={(value) => {
              setBlurOptions((prev) => new GaussianBlurOption(value, prev.alpha_mode));
            }}
          />
        </div>

        <p class={sectionSubCaption}>clamp at transparency.</p>
        <div class={sectionSubContent}>
          <ToggleSwitch
            checked={blurOptions().alpha_mode === AlphaBlurMode.Skip}
            onChange={(value) => {
              setBlurOptions((prev) => new GaussianBlurOption(prev.radius, value ? AlphaBlurMode.Skip : AlphaBlurMode.Blur));
            }}
          />
        </div>

        <div
          class={flexCol}
          style={{
            width: '100%',
            'align-items': 'end',
          }}
        >
          <button
            class={accentedButton}
            onClick={() => {
              const agent = getActiveAgent();
              if (agent) {
                const originalBuffer = new Uint8ClampedArray(agent.getBuffer());
                gaussian_blur(agent.getNonClampedBuffer(), canvasStore.canvas.width, canvasStore.canvas.height, blurOptions());
                agent.forceUpdate();

                agent.getDiffManager().setWhole(originalBuffer, agent.getBuffer());
                agent.registerToHistory({ tool: 'fx', fxName: 'GaussianBlur' });
              }
            }}
          >
            Apply.
          </button>
        </div>
      </div>
    </SectionItem>
  );
};

export default GaussianBlur;
