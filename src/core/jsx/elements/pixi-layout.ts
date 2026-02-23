import type { LayoutContainerElement } from '@/core/jsx/types';
import { addChildren, applyProps } from '@/core/jsx/shared';
import { setCoreProperty } from '@/core/jsx/elements/pixi-core';
import { LayoutContainer } from '@pixi/layout/components';
import type { Container } from 'pixi.js';

export const PIXI_LAYOUT_TAGS = new Set(['layoutContainer']);

const LAYOUT_IGNORE = new Set(['layout', 'trackpad', 'background']);

export function createLayoutElement(type: string, props: Record<string, any>): Container {
  const { children, ...rest } = props;

  switch (type) {
    case 'layoutContainer': {
      const { layout, trackpad, background, ...lcRest } = rest as LayoutContainerElement;
      const element = new LayoutContainer({ layout, trackpad, background });
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
