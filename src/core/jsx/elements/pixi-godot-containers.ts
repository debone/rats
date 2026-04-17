/**
 * Godot Control container names as JSX intrinsics — each maps to `LayoutContainer` + Yoga
 * (or `gridContainer` → `@pixi/ui` `List` for wrapped flow).
 *
 * `<text>` applies default flex-safe layout (`flexShrink: 0`, `alignSelf: center`); override or `layout={false}` to disable.
 *
 * `vBoxContainer` defaults include `width`/`height: '100%'` (fills a `Panel` like Godot).
 * `hBoxContainer` defaults include `width: '100%'`, `flexShrink: 0`, and `justifyContent: 'center'`
 * so short rows sit in the middle (override with `layout` when you want a start-aligned toolbar).
 *
 * Borders, radii, background colors, etc. are `LayoutStyles` — pass them on `layout`, not as separate props.
 */
import { setCoreProperty } from '@/core/jsx/elements/pixi-core';
import { addChildren, applyProps } from '@/core/jsx/shared';
import type { LayoutStyles } from '@pixi/layout';
import { LayoutContainer, type LayoutContainerOptions, type TrackpadOptions } from '@pixi/layout/components';
import { List, type ListOptions, type ListType } from '@pixi/ui';
import type { Container, ContainerChild } from 'pixi.js';

/** Godot `theme_constants/separation` default for Box/Flow containers. */
const DEFAULT_SEPARATION = 4;

const LAYOUT_CONTAINER_IGNORE = new Set([
  'layout',
  'trackpad',
  'background',
  'separation',
  'horizontalScrollEnabled',
  'verticalScrollEnabled',
  'margin',
  'marginLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginX',
  'marginY',
]);

const GRID_IGNORE = new Set([
  'layout',
  'arrangeType',
  'listType',
  'elementsMargin',
  'maxWidth',
  'maxHeight',
  'padding',
  'vertPadding',
  'horPadding',
  'topPadding',
  'bottomPadding',
  'leftPadding',
  'rightPadding',
]);

export const GODOT_CONTAINER_TAGS = new Set([
  'vBoxContainer',
  'hBoxContainer',
  'centerContainer',
  'hFlowContainer',
  'vFlowContainer',
  'gridContainer',
  'marginContainer',
  'panelContainer',
  'scrollContainer',
  'spacer',
]);

export function mergeLayout(
  defaults: Partial<LayoutStyles>,
  user?: Partial<LayoutStyles> | boolean,
): Partial<LayoutStyles> {
  if (user === true) {
    return { ...defaults };
  }
  if (!user || typeof user !== 'object') {
    return { ...defaults };
  }
  return { ...defaults, ...user };
}

function gapFromSeparation(separation: number | undefined, defaults: Partial<LayoutStyles>): Partial<LayoutStyles> {
  if (separation === undefined) {
    return defaults;
  }
  return { ...defaults, gap: separation };
}

function marginPaddingFromProps(props: {
  margin?: number;
  marginLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginX?: number;
  marginY?: number;
}): Partial<LayoutStyles> {
  if (props.margin != null) {
    return { padding: props.margin };
  }
  const hasIndividual =
    props.marginLeft != null ||
    props.marginTop != null ||
    props.marginRight != null ||
    props.marginBottom != null ||
    props.marginX != null ||
    props.marginY != null;
  if (!hasIndividual) {
    return {};
  }
  return {
    paddingTop: props.marginTop ?? props.marginY ?? 0,
    paddingRight: props.marginRight ?? props.marginX ?? 0,
    paddingBottom: props.marginBottom ?? props.marginY ?? 0,
    paddingLeft: props.marginLeft ?? props.marginX ?? 0,
  };
}

function buildScrollTrackpad(
  user: TrackpadOptions | undefined,
  horizontalScrollEnabled: boolean | undefined,
  verticalScrollEnabled: boolean | undefined,
): TrackpadOptions | undefined {
  const h = horizontalScrollEnabled !== false;
  const v = verticalScrollEnabled !== false;
  const axisLocks: TrackpadOptions = {
    ...(!h ? { xConstrainPercent: -1 } : {}),
    ...(!v ? { yConstrainPercent: -1 } : {}),
  };
  if (!user && !Object.keys(axisLocks).length) {
    return undefined;
  }
  return { ...(user ?? {}), ...axisLocks };
}

function layoutContainerOptionsFromProps(
  props: Record<string, unknown>,
  layout: Partial<LayoutStyles> | boolean | undefined,
  layoutDefaults: Partial<LayoutStyles>,
): LayoutContainerOptions {
  const { trackpad, background } = props;
  const opts: LayoutContainerOptions = {
    layout: mergeLayout(layoutDefaults, layout as Partial<LayoutStyles> | boolean | undefined),
  };
  if (trackpad != null) {
    opts.trackpad = trackpad as TrackpadOptions;
  }
  if (background != null) {
    opts.background = background as ContainerChild;
  }
  return opts;
}

export function setGodotLayoutProperty(obj: Container, key: string, value: unknown): void {
  setCoreProperty(obj, key, value);
}

export function createGodotContainerElement(type: string, props: Record<string, unknown>): Container {
  switch (type) {
    case 'vBoxContainer':
      return createVBox(props);
    case 'hBoxContainer':
      return createHBox(props);
    case 'centerContainer':
      return createCenter(props);
    case 'hFlowContainer':
      return createHFlow(props);
    case 'vFlowContainer':
      return createVFlow(props);
    case 'gridContainer':
      return createGrid(props);
    case 'marginContainer':
      return createMargin(props);
    case 'panelContainer':
      return createPanel(props);
    case 'scrollContainer':
      return createScroll(props);
    case 'spacer':
      return createSpacer(props);
    default:
      throw new Error(`[godot-containers] Unknown element type: ${type}`);
  }
}

function createVBox(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, separation, ...rest } = props;
  const defaults = gapFromSeparation(separation as number | undefined, {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    height: '100%',
    gap: DEFAULT_SEPARATION,
  });
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createHBox(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, separation, ...rest } = props;
  const defaults = gapFromSeparation(separation as number | undefined, {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    flexShrink: 0,
    gap: DEFAULT_SEPARATION,
  });
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createCenter(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, ...rest } = props;
  const defaults: Partial<LayoutStyles> = {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  };
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createHFlow(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, separation, ...rest } = props;
  const defaults = gapFromSeparation(separation as number | undefined, {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    gap: DEFAULT_SEPARATION,
  });
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createVFlow(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, separation, ...rest } = props;
  const defaults = gapFromSeparation(separation as number | undefined, {
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    gap: DEFAULT_SEPARATION,
  });
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createGrid(props: Record<string, unknown>): List {
  const {
    children,
    layout,
    arrangeType,
    listType,
    elementsMargin,
    maxWidth,
    maxHeight,
    padding,
    vertPadding,
    horPadding,
    topPadding,
    bottomPadding,
    leftPadding,
    rightPadding,
    ...rest
  } = props;

  const type = (arrangeType ?? listType ?? 'bidirectional') as ListType;
  const listOptions: { type?: ListType } & ListOptions = {
    type,
    ...(elementsMargin !== undefined && { elementsMargin: elementsMargin as number }),
    ...(maxWidth !== undefined && { maxWidth: maxWidth as number }),
    ...(maxHeight !== undefined && { maxHeight: maxHeight as number }),
    ...(padding !== undefined && { padding: padding as number }),
    ...(vertPadding !== undefined && { vertPadding: vertPadding as number }),
    ...(horPadding !== undefined && { horPadding: horPadding as number }),
    ...(topPadding !== undefined && { topPadding: topPadding as number }),
    ...(bottomPadding !== undefined && { bottomPadding: bottomPadding as number }),
    ...(leftPadding !== undefined && { leftPadding: leftPadding as number }),
    ...(rightPadding !== undefined && { rightPadding: rightPadding as number }),
  };

  const list = new List(listOptions);
  list.layout = mergeLayout({ width: '100%', height: '100%' }, layout as Partial<LayoutStyles> | boolean | undefined);
  applyProps(list, rest, setGodotLayoutProperty, GRID_IGNORE);
  addChildren(list, children);
  return list;
}

function createMargin(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, margin, marginLeft, marginTop, marginRight, marginBottom, marginX, marginY, ...rest } =
    props;

  const marginPad = marginPaddingFromProps({
    margin: margin as number | undefined,
    marginLeft: marginLeft as number | undefined,
    marginTop: marginTop as number | undefined,
    marginRight: marginRight as number | undefined,
    marginBottom: marginBottom as number | undefined,
    marginX: marginX as number | undefined,
    marginY: marginY as number | undefined,
  });

  const defaults: Partial<LayoutStyles> = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    ...marginPad,
  };

  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createPanel(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, ...rest } = props;
  const defaults: Partial<LayoutStyles> = {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 8,
  };
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createScroll(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, trackpad, horizontalScrollEnabled, verticalScrollEnabled, ...rest } = props;

  const mergedTrackpad = buildScrollTrackpad(
    trackpad as TrackpadOptions | undefined,
    horizontalScrollEnabled as boolean | undefined,
    verticalScrollEnabled as boolean | undefined,
  );

  const defaults: Partial<LayoutStyles> = {
    width: '100%',
    height: '100%',
    overflow: 'scroll',
  };

  const scrollProps = {
    ...props,
    ...(mergedTrackpad !== undefined ? { trackpad: mergedTrackpad } : {}),
  };

  const element = new LayoutContainer(layoutContainerOptionsFromProps(scrollProps, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}

function createSpacer(props: Record<string, unknown>): LayoutContainer {
  const { children, layout, ...rest } = props;
  const defaults: Partial<LayoutStyles> = {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 0,
  };
  const element = new LayoutContainer(layoutContainerOptionsFromProps(props, layout as never, defaults));
  applyProps(element, rest, setGodotLayoutProperty, LAYOUT_CONTAINER_IGNORE);
  addChildren(element, children);
  return element;
}
