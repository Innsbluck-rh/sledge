import type { LabelMode } from '@sledge/core';
import { type Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { handle, line, lineHitbox, slider, sliderRoot, valueLabel, valueLabelContainer, valueLabelInput } from '../../styles/control/slider.css';

interface SliderProps {
  min: number;
  max: number;
  defaultValue?: number;
  value?: number;
  wheelSpin?: boolean;
  allowFloat?: boolean;
  floatSignificantDigits?: number;
  labelMode: LabelMode;
  customFormat?: string;
  allowDirectInput?: boolean;
  onChange?: (newValue: number) => void;
  onDoubleClick?: () => void;
  onPointerDownOnValidArea?: (e: PointerEvent | MouseEvent) => boolean;
}

const Slider: Component<SliderProps> = (props) => {
  let labelRef: HTMLDivElement;
  let directInputRef: HTMLInputElement;
  let sliderRef: HTMLDivElement;
  const [directInputMode, setDirectInputMode] = createSignal(false);

  const [value, setValue] = createSignal(props.defaultValue ?? props.min);
  createEffect(() => {
    if (props.value !== undefined) setValue(props.value);
  });

  const getFormattedValue = (value: number): string => {
    let formatted = `${value}`;
    // format (like "[value]px" -> "1200px")
    if (props.customFormat !== undefined) {
      formatted = props.customFormat.replaceAll('[value]', formatted);
    } else {
      formatted = `${value}.`;
    }
    return formatted;
  };

  const [isDrag, setDrag] = createSignal(false);
  const percent = () => ((value() - props.min) / (props.max - props.min)) * 100;

  const update = (newValue: number) => {
    setValue(newValue);
    props.onChange?.(newValue);
  };

  const onPointerDownOnValidArea = (e: PointerEvent | MouseEvent): boolean => {
    if (props.onPointerDownOnValidArea) {
      return props.onPointerDownOnValidArea(e);
    }
    return true;
  };

  const handlePointerDown = (e: PointerEvent) => {
    const shouldStartDrag = onPointerDownOnValidArea(e);
    if (shouldStartDrag) setDrag(true);
    else setDrag(false);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!sliderRef || !isDrag()) {
      setDrag(false);
    } else {
      const { left, width } = sliderRef.getBoundingClientRect();
      let pos = Math.max(0, Math.min(e.clientX - left, width));
      const raw = props.min + (pos / width) * (props.max - props.min);
      update(getFixedValue(raw));
    }
  };

  const cancelHandling = () => {
    setDrag(false);
  };

  const onLineClick = (e: MouseEvent) => {
    const shouldStartDrag = onPointerDownOnValidArea(e);
    if (!sliderRef || !shouldStartDrag) return;
    const { left, width } = sliderRef.getBoundingClientRect();
    let pos = Math.max(0, Math.min(e.clientX - left, width));
    const raw = props.min + (pos / width) * (props.max - props.min);
    update(getFixedValue(raw));
  };

  const getFixedValue = (raw: number): number => {
    let newValue = raw;
    if (props.allowFloat) {
      if (props.floatSignificantDigits) {
        newValue = parseFloat(raw.toFixed(props.floatSignificantDigits));
      } else {
        newValue = raw;
      }
    } else {
      newValue = Math.round(raw);
    }

    newValue = Math.max(props.min, Math.min(newValue, props.max));

    return newValue;
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (directInputMode() && labelRef && !labelRef.contains(e.target as Node)) {
      update(Number(directInputRef.value));
      setDirectInputMode(false);
    }
  };

  const cancelDirectInput = () => {
    setDirectInputMode(false);
  };

  const handleOnWheel = (e: WheelEvent) => {
    if (props.wheelSpin) {
      const newValue = getFixedValue(value() + (e.deltaY < 0 ? 1 : -1));
      update(getFixedValue(newValue));
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', cancelHandling);
    document.addEventListener('pointercancel', cancelHandling);
  });
  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', cancelHandling);
    document.removeEventListener('pointercancel', cancelHandling);
  });

  const labelArea = (
    <div ref={(el) => (labelRef = el)} class={valueLabelContainer} onWheel={handleOnWheel}>
      <Show
        when={directInputMode()}
        fallback={
          <p
            class={valueLabel}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              setDirectInputMode(true);
              directInputRef.select();
            }}
          >
            {getFormattedValue(value())}
          </p>
        }
      >
        <input
          class={valueLabelInput}
          ref={(el) => (directInputRef = el)}
          onSubmit={(e) => {
            setDirectInputMode(false);
          }}
          onFocusOut={cancelDirectInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              update(Number(directInputRef.value));
              setDirectInputMode(false);
            }
          }}
          value={value()}
          type={'number'}
        />
      </Show>
    </div>
  );

  return (
    <div class={sliderRoot}>
      <Show when={props.labelMode === 'left'}>{labelArea}</Show>

      <div
        class={slider}
        ref={(el) => (sliderRef = el)}
        onPointerDown={handlePointerDown}
        onDblClick={() => {
          props.onDoubleClick?.();
        }}
        onClick={onLineClick}
      >
        <div class={lineHitbox} onWheel={handleOnWheel}>
          <div class={line} />
        </div>
        <div style={{ left: `${percent()}%` }} class={handle} />
      </div>

      <Show when={props.labelMode === 'right'}>{labelArea}</Show>
    </div>
  );
};

export default Slider;
