import { createCoreElement, PIXI_CORE_TAGS } from '@/core/jsx/elements/pixi-core';
import { createLayoutElement, PIXI_LAYOUT_TAGS } from '@/core/jsx/elements/pixi-layout';
import { createUIElement, PIXI_UI_TAGS } from '@/core/jsx/elements/pixi-ui';
import type { Container } from 'pixi.js';

export function setupPixiElement(type: string, props: Record<string, any>): Container {
  if (PIXI_CORE_TAGS.has(type)) return createCoreElement(type, props);
  if (PIXI_LAYOUT_TAGS.has(type)) return createLayoutElement(type, props);
  if (PIXI_UI_TAGS.has(type)) return createUIElement(type, props);

  throw new Error(`Unknown JSX element type: <${type}>`);
}
