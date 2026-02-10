import { FederatedPointerEvent, Sprite, type Container, type SpriteOptions } from 'pixi.js';
import type { DroppableManager } from './DroppableManager';
import type { DroppableContainer, DroppableHoverEvent } from './types';

export class DraggableSprite<T> extends Sprite {
  droppableManager: DroppableManager;
  owner?: Container;
  surface: Container;
  cleanup: () => void;

  data?: T;
  // TODO
  // - custom callbacks

  constructor(options: SpriteOptions & { droppableManager: DroppableManager; surface: Container; data?: T }) {
    super(options);

    this.droppableManager = options.droppableManager;
    this.surface = options.surface;
    this.cleanup = this.makeDraggable(this);

    this.data = options.data;

    this.once('added', (parent) => {
      this.owner = parent;
    });
  }

  setOwner(owner: Container) {
    this.owner = owner;
  }

  destroy(...args: Parameters<Sprite['destroy']>) {
    this.cleanup();
    super.destroy(...args);
  }

  makeDraggable(sprite: Sprite): () => void {
    sprite.interactive = true;
    sprite.cursor = 'grab';
    sprite.on('destroy', () => {
      this.cleanup();
    });

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let lastDroppable: DroppableContainer | undefined = undefined;
    let droppableGenerator: Generator<undefined, void, DroppableHoverEvent> | undefined = undefined;

    const onPointerDown = (event: FederatedPointerEvent) => {
      if (!this.parent) return;
      this.droppableManager.updateDroppableBounds();

      isDragging = true;
      sprite.tint = 0x00ff00;
      sprite.cursor = 'grabbing';

      sprite.scale = 1;

      // The order IS important. We remove a "layout" element
      this.surface.addChild(sprite);
      // Before making it not a layout. Otherwise the yoga or
      // whoever maths on the container, doesn't like it
      sprite.layout = false;

      const pos = event.getLocalPosition(sprite.parent!);
      sprite.x = pos.x - sprite.width / 2;
      sprite.y = pos.y - sprite.height / 2;

      dragOffset.x = -sprite.width / 2;
      dragOffset.y = -sprite.height / 2;
    };

    const onPointerMove = (event: FederatedPointerEvent) => {
      if (!isDragging || !sprite.parent) return;
      sprite.tint = 0x00ffff;
      const pos = event.getLocalPosition(sprite.parent);
      sprite.x = pos.x + dragOffset.x;
      sprite.y = pos.y + dragOffset.y;

      const globalX = event.global.x;
      const globalY = event.global.y;

      const droppable = this.droppableManager.getDroppable(globalX, globalY);
      if (lastDroppable !== droppable) {
        droppableGenerator?.next({ event, item: sprite, isOver: true });
        lastDroppable = droppable;
        if (lastDroppable) {
          droppableGenerator = lastDroppable.onHover();
        }
      }

      if (droppable) droppableGenerator?.next({ event, item: sprite, isOver: false });
    };

    const endDrag = (event: FederatedPointerEvent) => {
      if (!isDragging) return;
      sprite.tint = 0xffffff;
      isDragging = false;
      sprite.cursor = 'grab';
      sprite.x = 0;
      sprite.y = 0;

      // TODO exit the droppable hover
      if (lastDroppable) {
        droppableGenerator?.next({ event, item: sprite, isOver: true });
        lastDroppable = undefined;
        droppableGenerator = undefined;
      }

      const globalX = event.global.x;
      const globalY = event.global.y;

      const droppable = this.droppableManager.getDroppable(globalX, globalY);
      let result = false;
      if (droppable) {
        result = droppable.onDrop(event, sprite);
      }

      if (!result) {
        // TODO: onDropFail?
        this.owner?.addChild(sprite);
        // meh
        sprite.layout = true;
      }
    };

    sprite.on('pointerdown', onPointerDown);
    sprite.on('globalpointermove', onPointerMove);
    sprite.on('pointerup', endDrag);
    sprite.on('pointerupoutside', endDrag);

    // Return cleanup function
    return () => {
      sprite.off('pointerdown', onPointerDown);
      sprite.off('globalpointermove', onPointerMove);
      sprite.off('pointerup', endDrag);
      sprite.off('pointerupoutside', endDrag);
    };
  }
}
