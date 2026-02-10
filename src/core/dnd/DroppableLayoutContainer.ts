import { LayoutContainer, type LayoutContainerOptions } from '@pixi/layout/components';
import { animate, utils } from 'animejs';
import type { Bounds, Container, FederatedPointerEvent } from 'pixi.js';
import { DraggableSprite } from './DraggableSprite';
import type { DroppableManager } from './DroppableManager';
import { LOOP_PROTECTION, type Droppable } from './types';

export class DroppableLayoutContainer extends LayoutContainer implements Droppable {
  droppableManager: DroppableManager;

  constructor(options: LayoutContainerOptions & { droppableManager: DroppableManager }) {
    super(options);
    this.droppableManager = options.droppableManager;
    this.droppableManager.addDroppable(this);
  }

  destroy(...args: Parameters<LayoutContainer['destroy']>) {
    this.droppableManager.removeDroppable(this);
    super.destroy(...args);
  }

  boundaries?: Bounds;
  paddingX?: number;
  paddingY?: number;
  gap?: number;
  childrenCount?: number;
  childrenPerLine?: number;
  childrenLines?: number;
  childWidth?: number;
  childHeight?: number;

  // TODO: flex direction column, and reverses
  updateBounds() {
    this.boundaries = this.getBounds();
    // Find the position of the first children inside
    // the container and calculate the padding
    const children = this.overflowContainer.children;

    if (children.length === 0) return;

    const firstChild = children[0];
    const firstChildBounds = firstChild.getBounds();

    this.paddingX = firstChildBounds.x - this.boundaries.x;
    this.paddingY = firstChildBounds.y - this.boundaries.y;

    this.gap = this.layout?.style?.gap ?? 0;

    this.childWidth = firstChildBounds.width + this.gap / 2;
    this.childHeight = firstChildBounds.height + this.gap / 2;

    // How many children can fit in the x direction
    // So sorry if this makes a mess, it should be iterative to find the gap
    this.childrenLines = Math.floor((children.length * this.childWidth) / (this.boundaries.width - this.paddingX)) + 1;

    this.childrenPerLine = Math.floor(children.length / this.childrenLines);
  }

  updateDropPreview(targetIndex: number) {
    const GAP_SIZE = 24;

    let adjustedIndex = 0;
    this.overflowContainer.children.forEach((child) => {
      const offset = adjustedIndex >= targetIndex ? GAP_SIZE / 2 : -GAP_SIZE / 2;
      animate(child, {
        x: offset,
        duration: 150,
        easing: 'easeOutQuad',
      });
      adjustedIndex++;
    });
  }

  resetPreview() {
    this.overflowContainer.children.forEach((child) => {
      utils.remove(child);
      animate(child, {
        x: 0,
        duration: 150,
        easing: 'easeOutQuad',
      });
    });
  }

  /**
   * Calculate drop index based on pointer X position relative to group children midpoints
   */
  getDropIndex(event: FederatedPointerEvent): number {
    if (this.overflowContainer.children.length === 0) return 0;

    const pos = event.getLocalPosition(this);

    const line = Math.max(Math.min(Math.floor((pos.y - this.paddingY!) / this.childHeight!), this.childrenLines!), 0);
    const column = Math.max(
      Math.min(Math.floor((pos.x - this.paddingX! + this.childWidth! / 2) / this.childWidth!), this.childrenPerLine!),
      0,
    );

    return Math.max(0, Math.min(line * this.childrenPerLine! + column, this.overflowContainer.children.length));
  }

  i = LOOP_PROTECTION;
  currentDropIndex?: number;

  *onHover() {
    console.log('startHover', this.overflowContainer.children);

    while (this.i > 0) {
      let { event, isOver } = yield;
      if (isOver) {
        break;
      }

      const dropIndex = this.getDropIndex(event);

      if (this.currentDropIndex !== dropIndex) {
        this.currentDropIndex = dropIndex;
        this.updateDropPreview(dropIndex);
      }

      this.i--;
    }
    this.resetPreview();

    console.log('endHover', this.overflowContainer.children);
    this.i = LOOP_PROTECTION;
  }

  onDrop(event: FederatedPointerEvent, item: Container) {
    const dropIndex = this.getDropIndex(event);
    this.addChildAt(item, dropIndex);
    if (item instanceof DraggableSprite) {
      item.setOwner(this);
    }
    item.layout = true;

    this.resetPreview();

    return true;
  }
}
