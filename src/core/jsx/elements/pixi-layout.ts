import { setCoreProperty } from '@/core/jsx/elements/pixi-core';
import { addChildren, applyProps } from '@/core/jsx/shared';
import { getSignalValue } from '@/core/reactivity/signals/signals';
import { LayoutContainer } from '@pixi/layout/components';
import type { Container } from 'pixi.js';

export const PIXI_LAYOUT_TAGS = new Set(['layoutContainer', 'box']);

const LAYOUT_IGNORE = new Set(['layout', 'trackpad', 'background', 'borderColor', 'borderWidth']);

export function createLayoutElement(type: string, props: Record<string, any>): Container {
  const { children, ...rest } = props;

  switch (type) {
    case 'layoutContainer':
    case 'box': {
      const { layout, trackpad, background, borderColor, borderWidth, ...lcRest } = rest as any;

      const finalLayout = {
        ...layout,
        borderColor: getSignalValue(borderColor),
        borderWidth: getSignalValue(borderWidth, 1),
      };

      const element = new LayoutContainer({ layout: finalLayout, trackpad, background });
      applyProps(element, lcRest, setLayoutProperty, LAYOUT_IGNORE);
      addChildren(element, children);
      return element;
    }

    default:
      throw new Error(`[pixi-layout] Unknown element type: ${type}`);
  }
}

export function setLayoutProperty(obj: Container, key: string, value: any): void {
  setCoreProperty(obj, key, value);
}
