import type { ButtonElement } from '@/core/jsx/types';
import { addChildren, applyProps } from '@/core/jsx/shared';
import { setCoreProperty } from '@/core/jsx/elements/pixi-core';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import type { Container } from 'pixi.js';

export const PIXI_UI_TAGS = new Set(['button']);

const BUTTON_IGNORE = new Set(['enabled', 'onPress']);

export function createUIElement(type: string, props: Record<string, any>): Container {
  const { children, ...rest } = props;

  switch (type) {
    case 'button': {
      const { enabled, onPress, layout, ...btnRest } = rest as ButtonElement & { layout?: any };
      const view = new LayoutContainer({ layout });
      addChildren(view, children);

      const button = new Button(view);
      if (enabled !== undefined) button.enabled = enabled;
      if (onPress) button.onPress.connect(onPress);

      applyProps(view, btnRest, setUIProperty, BUTTON_IGNORE);
      return view;
    }

    default:
      throw new Error(`[pixi-ui] Unknown element type: ${type}`);
  }
}

export function setUIProperty(obj: Container, key: string, value: any): void {
  setCoreProperty(obj, key, value);
}
