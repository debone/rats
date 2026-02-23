import type { Signal, SignalValue } from '@/core/reactivity/signals/types';
import type { LayoutStyles } from '@pixi/layout';
import type { LayoutContainerOptions } from '@pixi/layout/components';
import type { Container, ColorSource, ContainerChild, TextStyleOptions, Texture } from 'pixi.js';

export type PixiJsxChild = ContainerChild | PixiJsxChild[];

export interface PixiJsxProps<T extends Container = Container> {
  children?: PixiJsxChild | PixiJsxChild[];
  ref?: (instance: T) => void;
  bind?: Record<string, Signal<any>>;

  label?: string;

  x?: SignalValue<number>;
  y?: SignalValue<number>;
  alpha?: SignalValue<number>;
  visible?: SignalValue<boolean>;
  scale?: SignalValue<number>;
  scaleX?: SignalValue<number>;
  scaleY?: SignalValue<number>;
  tint?: SignalValue<ColorSource>;
  interactive?: boolean;
  cursor?: string;

  layout?: Partial<LayoutStyles> | boolean;

  onPointerdown?: (event: any) => void;
  onPointerup?: (event: any) => void;
  onPointerover?: (event: any) => void;
  onPointermove?: (event: any) => void;
  onPointerout?: (event: any) => void;
}

// pixi.js core elements
export interface ContainerElement extends PixiJsxProps<Container> {}

export interface SpriteElement extends PixiJsxProps {
  texture: Texture;
  anchor?: SignalValue<number | { x: number; y: number }>;
}

export interface TextElement extends PixiJsxProps {
  text?: SignalValue<string>;
  style?: TextStyleOptions;
}

export interface GraphicsElement extends PixiJsxProps {
  draw?: (g: import('pixi.js').Graphics) => void;
}

// @pixi/layout elements
export interface LayoutContainerElement extends PixiJsxProps {
  layout?: Partial<LayoutStyles>;
  trackpad?: LayoutContainerOptions['trackpad'];
  background?: LayoutContainerOptions['background'];
}

// @pixi/ui elements (minimal for now)
export interface ButtonElement extends PixiJsxProps {
  enabled?: boolean;
  onPress?: () => void;
}

// Structural elements
export interface MountElement {
  target: Container;
  children?: PixiJsxChild | PixiJsxChild[];
}

// JSX namespace
export interface IntrinsicElementMap {
  container: ContainerElement;
  sprite: SpriteElement;
  text: TextElement;
  graphics: GraphicsElement;
  layoutContainer: LayoutContainerElement;
  button: ButtonElement;
  mount: MountElement;
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends IntrinsicElementMap {}
    type Element = Container;
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}
