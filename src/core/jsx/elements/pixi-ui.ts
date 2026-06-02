import { setCoreProperty } from '@/core/jsx/elements/pixi-core';
import { addChildren, applyProps, createSignalBinding } from '@/core/jsx/shared';
import type { ButtonElement, SliderElement } from '@/core/jsx/types';
import { getSignalValue, isSignal } from '@/core/reactivity/signals/signals';
import { LayoutContainer } from '@pixi/layout/components';
import { Button, Slider } from '@pixi/ui';
import type { Container } from 'pixi.js';

export const PIXI_UI_TAGS = new Set(['button', 'slider']);

const BUTTON_IGNORE = new Set(['enabled', 'onPress', 'onHover', 'onOut']);
const SLIDER_IGNORE = new Set(['value', 'onUpdate']);

export function createUIElement(type: string, props: Record<string, any>): Container {
  const { children, ...rest } = props;

  switch (type) {
    case 'button': {
      const { enabled, onPress, onHover, onOut, layout, ...btnRest } = rest as ButtonElement;
      const view = new LayoutContainer({ layout });
      addChildren(view, children);

      const button = new Button(view);
      if (enabled !== undefined) button.enabled = enabled;
      if (onPress) button.onPress.connect(onPress);
      if (onHover) button.onHover.connect(onHover);
      if (onOut) button.onOut.connect(onOut);

      applyProps(view, btnRest, setUIProperty, BUTTON_IGNORE);
      return view;
    }

    case 'slider': {
      const { value, bg, fill, slider, min, max, step, onUpdate, onChange, layout, ...sliderRest } =
        rest as SliderElement;

      const initialValue = getSignalValue(value);
      const sliderElement = new Slider({ bg, fill, slider, value: initialValue, min, max, step });
      if (layout) sliderElement.layout = layout;
      if (onUpdate) sliderElement.onUpdate.connect(onUpdate);
      if (onChange) sliderElement.onChange.connect(onChange);

      if (isSignal(value)) {
        createSignalBinding(sliderElement, 'value', value, setUIProperty);
      }

      applyProps(sliderElement, sliderRest, setUIProperty, SLIDER_IGNORE);
      return sliderElement;
    }

    default:
      throw new Error(`[pixi-ui] Unknown element type: ${type}`);
  }
}

export function setUIProperty(obj: Container, key: string, value: any): void {
  setCoreProperty(obj, key, value);
}
