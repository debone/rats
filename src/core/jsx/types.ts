import type { Signal, SignalValue } from '@/core/reactivity/signals/types';
import type { LayoutStyles } from '@pixi/layout';
import type { LayoutContainer, LayoutContainerOptions } from '@pixi/layout/components';
import type { ListType } from '@pixi/ui';
import type {
  ColorSource,
  Container,
  ContainerChild,
  Graphics,
  Sprite,
  Text,
  TextStyleOptions,
  Texture,
} from 'pixi.js';

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

export interface SpriteElement extends PixiJsxProps<Sprite> {
  texture: Texture;
  anchor?: SignalValue<number | { x: number; y: number }>;
}

export interface TextElement extends PixiJsxProps<Text> {
  text?: SignalValue<string>;
  style?: TextStyleOptions;
  /**
   * Omitted / `true` → `{ flexShrink: 0, alignSelf: 'center' }` merged with your object when passed.
   * `false` → no layout (Yoga off).
   */
  layout?: Partial<LayoutStyles> | boolean;
}

export interface GraphicsElement extends PixiJsxProps<Graphics> {
  draw?: (g: import('pixi.js').Graphics) => void;
}

// @pixi/layout elements — use `layout={{ … }}` for `LayoutStyles` (borders, padding, flex, …)
export interface LayoutContainerElement extends PixiJsxProps<LayoutContainer> {
  layout?: Partial<LayoutStyles>;
  trackpad?: LayoutContainerOptions['trackpad'];
  background?: LayoutContainerOptions['background'];
}

// Godot-style containers → LayoutContainer / @pixi/ui List
export interface GodotBoxContainerElement extends LayoutContainerElement {
  /** Godot BoxContainer separation → Yoga `gap` */
  separation?: number;
}

export interface GodotScrollContainerElement extends LayoutContainerElement {
  /** When false, horizontal pan/scroll is disabled (`Trackpad` / overflow). Default true. */
  horizontalScrollEnabled?: boolean;
  /** When false, vertical pan/scroll is disabled. Default true. */
  verticalScrollEnabled?: boolean;
}

export interface GodotMarginContainerElement extends LayoutContainerElement {
  margin?: number;
  marginLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginX?: number;
  marginY?: number;
}

/** Flow-style grid: `@pixi/ui` `List` (wrap). Use `arrangeType` / `listType` for layout mode. */
export interface GodotGridContainerElement extends PixiJsxProps<Container> {
  layout?: Partial<LayoutStyles> | boolean;
  arrangeType?: ListType;
  /** Alias for `arrangeType` */
  listType?: ListType;
  elementsMargin?: number;
  maxWidth?: number;
  maxHeight?: number;
  padding?: number;
  vertPadding?: number;
  horPadding?: number;
  topPadding?: number;
  bottomPadding?: number;
  leftPadding?: number;
  rightPadding?: number;
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
  box: LayoutContainerElement;
  vBoxContainer: GodotBoxContainerElement;
  hBoxContainer: GodotBoxContainerElement;
  centerContainer: LayoutContainerElement;
  hFlowContainer: GodotBoxContainerElement;
  vFlowContainer: GodotBoxContainerElement;
  gridContainer: GodotGridContainerElement;
  marginContainer: GodotMarginContainerElement;
  panelContainer: GodotBoxContainerElement;
  scrollContainer: GodotScrollContainerElement;
  spacer: LayoutContainerElement;
  button: ButtonElement;
  mount: MountElement;
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends IntrinsicElementMap {}
    type Element = any;
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}
