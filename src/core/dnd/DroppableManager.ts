import type { Bounds, Container } from 'pixi.js';
import type { DroppableContainer } from './types';

export class DroppableManager {
  droppables: DroppableContainer[] = [];
  droppableBounds: Map<Container, Bounds> = new Map();

  constructor() {
    this.droppables = [];
    this.droppableBounds = new Map();
  }

  addDroppable(droppable: DroppableContainer) {
    this.droppables.push(droppable);
    this.droppableBounds.set(droppable, droppable.getBounds());
  }

  removeDroppable(droppable: DroppableContainer) {
    this.droppables.splice(this.droppables.indexOf(droppable), 1);
    this.droppableBounds.delete(droppable);
  }

  updateDroppableBounds() {
    this.droppables.forEach((droppable) => {
      const bounds = droppable.getBounds();
      droppable.updateBounds?.();
      this.droppableBounds.set(droppable, bounds);
    });
  }

  getDroppable(globalX: number, globalY: number): DroppableContainer | undefined {
    return this.droppables.find((droppable) => {
      const bounds = this.droppableBounds.get(droppable);
      if (!bounds) return false;
      return (
        globalX >= bounds.x &&
        globalX <= bounds.x + bounds.width &&
        globalY >= bounds.y &&
        globalY <= bounds.y + bounds.height
      );
    });
  }
}
