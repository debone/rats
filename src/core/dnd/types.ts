import type { Container, FederatedPointerEvent } from 'pixi.js';

export interface Draggable {
  onDragStart?: (event: FederatedPointerEvent) => void;
  onDragMove?: (event: FederatedPointerEvent, globalX: number, globalY: number) => void;
  onDragEnd?: (event: FederatedPointerEvent, globalX: number, globalY: number) => void;
}

export interface DroppableHoverEvent {
  event: FederatedPointerEvent;
  item: Container;
  isOver: boolean;
}

export interface Droppable {
  updateBounds(): void;
  onHover(): Generator<undefined, void, DroppableHoverEvent>;
  onDrop(event: FederatedPointerEvent, item: Container): boolean;
}

export type DroppableContainer = Container & Droppable;

export const LOOP_PROTECTION = 1_000_000;
