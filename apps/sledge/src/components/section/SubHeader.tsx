import { flexRow } from '@sledge/core';
import { vars } from '@sledge/theme';
import { Icon } from '@sledge/ui';
import { Component, createSignal, For, JSX, Show } from 'solid-js';
import { sectionCaption } from '~/styles/section/section_item.css';

export interface SubHeaderIcon {
  src: string;
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
}

interface Props {
  // title?: string;
  icons?: SubHeaderIcon[];
  defaultExpanded?: boolean;
  onExpandChanged?: (expanded: boolean) => void;
  children: JSX.Element;
}
export const SectionSubHeader: Component<Props> = (props) => {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? true);

  return (
    <div class={flexRow} style={{ 'align-items': 'center', 'margin-bottom': expanded() ? '8px' : '0px' }}>
      <svg width='0' height='0'>
        <defs>
          <clipPath id='clipPath-triangle7'>
            <path d='M 3 6 L 4 6 L 4 5 L 5 5 L 5 4 L 6 4 L 6 3 L 7 3 L 7 2 L 0 2 L 0 3 L 1 3 L 1 4 L 2 4 L 2 5 L 3 5 L 3 6 Z' fill='black' />
          </clipPath>
          <clipPath id='clipPath-triangle7-flip'>
            <path d='M 0 6 L 7 6 L 7 5 L 6 5 L 6 4 L 5 4 L 5 3 L 4 3 L 4 2 L 3 2 L 3 3 L 2 3 L 2 4 L 1 4 L 1 5 L 0 5 L 0 6 Z' fill='black' />
          </clipPath>
        </defs>
      </svg>
      <div
        class={flexRow}
        style={{
          gap: '4px',
          'align-items': 'center',
          cursor: 'pointer',
          'pointer-events': 'all',
        }}
        onClick={() => {
          setExpanded(!expanded());

          props.onExpandChanged?.(expanded());
        }}
      >
        <div
          style={{
            width: '12px',
            height: '9px',
            overflow: 'visible',
            'box-sizing': 'border-box',
            'background-color': vars.color.onBackground,
            opacity: 0.7,
            'clip-path': expanded() ? 'url(#clipPath-triangle7)' : 'url(#clipPath-triangle7-flip)',
          }}
        />
        <p class={sectionCaption} style={{ margin: 0 }}>
          {props.children}
        </p>
      </div>
      <div
        style={{
          height: '1px',
          'flex-grow': 1,
          width: '100%',
          'margin-left': '8px',
          'background-color': vars.color.borderSecondary,
        }}
      />
      <Show when={expanded()}>
        <div
          class={flexRow}
          style={{
            'margin-left': '12px',
            gap: '12px',
          }}
        >
          <For each={props.icons}>
            {(item) => {
              const disabled = item.disabled ?? false;
              return (
                <div
                  style={{ cursor: disabled ? 'none' : 'pointer', 'pointer-events': disabled ? 'none' : 'all' }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Icon
                    src={item.src}
                    base={12}
                    scale={1}
                    color={disabled ? vars.color.muted : vars.color.onBackground}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      item.onClick(e);
                    }}
                  />
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};
