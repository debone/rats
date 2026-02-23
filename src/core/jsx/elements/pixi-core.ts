import type { GraphicsElement, SpriteElement, TextElement } from '@/core/jsx/types';
import { addChildren, applyProps } from '@/core/jsx/shared';
import { getSignalValue } from '@/core/reactivity/signals/signals';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { TEXT_STYLE_DEFAULT } from '@/consts';

export const PIXI_CORE_TAGS = new Set(['container', 'sprite', 'text', 'graphics', 'mount']);

export function createCoreElement(type: string, props: Record<string, any>): Container {
  const { children, ...rest } = props;

  let element: Container;

  switch (type) {
    case 'mount': {
      const { target } = rest;
      if (!target) throw new Error('<mount> requires a target prop');
      addChildren(target, children);
      return target;
    }

    case 'container': {
      element = new Container();
      break;
    }

    case 'sprite': {
      const { texture, anchor, ...spriteRest } = rest as SpriteElement;
      element = new Sprite({ texture });
      if (anchor !== undefined) {
        const a = getSignalValue(anchor);
        if (typeof a === 'number') {
          (element as Sprite).anchor.set(a);
        } else {
          (element as Sprite).anchor.set(a.x, a.y);
        }
      }
      applyProps(element, spriteRest, setCoreProperty, SPRITE_IGNORE);
      addChildren(element, children);
      return element;
    }

    case 'text': {
      const { text, style, ...textRest } = rest as TextElement;
      let textStyle = style;
      if (!textStyle) {
        textStyle = TEXT_STYLE_DEFAULT;
      }
      element = new Text({ text: text as string, style: textStyle });
      applyProps(element, textRest, setCoreProperty, TEXT_IGNORE);
      addChildren(element, children);
      return element;
    }

    case 'graphics': {
      const { draw, ...graphicsRest } = rest as GraphicsElement;
      element = new Graphics();
      if (draw) draw(element as Graphics);
      applyProps(element, graphicsRest, setCoreProperty, GRAPHICS_IGNORE);
      addChildren(element, children);
      return element;
    }

    default:
      throw new Error(`[pixi-core] Unknown element type: ${type}`);
  }

  applyProps(element, rest, setCoreProperty);
  addChildren(element, children);
  return element;
}

const SPRITE_IGNORE = new Set(['texture', 'anchor']);
const TEXT_IGNORE = new Set(['text', 'style']);
const GRAPHICS_IGNORE = new Set(['draw']);

export function setCoreProperty(obj: Container, key: string, value: any): void {
  switch (key) {
    case 'interactive':
      obj.interactive = value;
      break;
    case 'cursor':
      obj.cursor = value;
      break;
    case 'label':
      obj.label = value;
      break;
    case 'layout':
      obj.layout = value;
      break;
    case 'onPointerdown':
      obj.on('pointerdown', value);
      break;
    case 'onPointerup':
      obj.on('pointerup', value);
      break;
    case 'onPointerover':
      obj.on('pointerover', value);
      break;
    case 'onPointermove':
      obj.on('pointermove', value);
      break;
    case 'onPointerout':
      obj.on('pointerout', value);
      break;
    default:
      (obj as any)[key] = value;
      break;
  }
}
