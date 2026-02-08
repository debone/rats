import { ASSETS } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer, type LayoutContainerOptions } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate, utils } from 'animejs';
import { Assets, Bounds, Container, Sprite, Text, type FederatedPointerEvent, type SpriteOptions } from 'pixi.js';

const LOOP_PROTECTION = 1_000_000;
// TODO: the tooltip must be a separated layer overlay
// Best thing to do right now is to just make it a separated piece of screen

interface DraggableOptions {
  onDragStart?: () => void;
  onDragMove?: (event: FederatedPointerEvent, globalX: number, globalY: number) => void;
  onDragEnd?: (event: FederatedPointerEvent, globalX: number, globalY: number) => void;
}

interface DroppableHoverEvent {
  event: FederatedPointerEvent;
  item: Container;
  isOver: boolean;
}

interface Droppable {
  updateBounds(): void;
  onHover(): Generator<undefined, void, DroppableHoverEvent>;
  onDrop(event: FederatedPointerEvent, item: Container): boolean;
}

type DroppableContainer = Container & Droppable;

class DroppableManager {
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

class DraggableSprite extends Sprite {
  droppableManager: DroppableManager;
  owner?: Container;
  surface: Container;
  cleanup: () => void;
  // TODO
  // - custom callbacks

  constructor(options: SpriteOptions & { droppableManager: DroppableManager; surface: Container }) {
    super(options);

    this.droppableManager = options.droppableManager;
    this.surface = options.surface;
    this.cleanup = this.makeDraggable(this);
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

      this.surface.addChild(sprite);
      sprite.layout = false;

      sprite.x = event.global.x - sprite.width / 2;
      sprite.y = event.global.y - sprite.height / 2;

      const pos = event.getLocalPosition(sprite.parent!);
      dragOffset.x = sprite.x - pos.x;
      dragOffset.y = sprite.y - pos.y;
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

class DroppableLayoutContainer extends LayoutContainer implements Droppable {
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

export class TestScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'test';
  static readonly assetBundles = ['default'];

  constructor() {
    super({
      layout: {
        width: MIN_WIDTH,
        height: MIN_HEIGHT,
        justifyContent: 'center',
        backgroundColor: 'purple',
        alignItems: 'center',
        flexDirection: 'column',
        padding: 20,
        gap: 20,
      },
    });
  }

  getAvatarSprite(number: number, droppableManager: DroppableManager): DraggableSprite {
    return new DraggableSprite({
      texture: Assets.get(ASSETS.prototype).textures[`avatars_tile_${number}#0`],
      label: `avatar_${number}`,
      layout: true,
      droppableManager,
      surface: this.parent!,
    });
  }

  async prepare() {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    const droppableManager = new DroppableManager();

    const text = new Text({
      text: 'Test Screen',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 24 },
      layout: true,
    });
    this.addChild(text);

    const group = new DroppableLayoutContainer({
      droppableManager,
      label: 'group',
      layout: {
        gap: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 200,
        height: 160,
        padding: 20,
        //borderStyle: 'solid',
        alignContent: 'flex-start',
      },
    });

    group.addChild(this.getAvatarSprite(1, droppableManager));
    group.addChild(this.getAvatarSprite(3, droppableManager));
    group.addChild(this.getAvatarSprite(4, droppableManager));
    group.addChild(this.getAvatarSprite(2, droppableManager));
    group.addChild(this.getAvatarSprite(3, droppableManager));
    group.addChild(this.getAvatarSprite(1, droppableManager));

    this.addChild(group);

    const group2 = new DroppableLayoutContainer({
      droppableManager,
      label: 'group2',
      layout: {
        gap: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 200,
        height: 160,
        padding: 20,
        //borderStyle: 'solid',
        alignContent: 'flex-start',
      },
    });

    group2.addChild(this.getAvatarSprite(2, droppableManager));
    group2.addChild(this.getAvatarSprite(3, droppableManager));
    group2.addChild(this.getAvatarSprite(1, droppableManager));
    this.addChild(group2);

    // A

    // Create the external avatar that can be dropped into the group
    const avatar = new Button(
      new (class extends Container implements Droppable {
        label = 'avatar';
        constructor() {
          super({
            layout: true,
          });
          this.addChild(
            new Sprite({
              texture: Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'],
              layout: true,
            }),
          );

          // TODO: Draggable.onRemove? Droppable.onRemove?
          this.on('childRemoved', (child) => {
            if (child === this.slot) {
              this.slot = undefined;
            }
          });
        }

        updateBounds() {}

        i = LOOP_PROTECTION;

        *onHover() {
          while (this.i > 0) {
            let { event, item, isOver } = yield;
            if (isOver) {
              break;
            }

            if (this.slot) {
              this.tint = 0xdd0000;
            } else {
              this.tint = 0x00ffff;
            }

            (this.children[0] as Sprite).texture = Assets.get(ASSETS.prototype).textures['avatars_tile_2#0'];

            this.i--;
          }
          this.tint = 0xffffff;
          (this.children[0] as Sprite).texture = Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'];

          this.i = LOOP_PROTECTION;
        }

        slot?: Container;

        onDrop(event: FederatedPointerEvent, item: Container) {
          if (this.slot) {
            // SWAP
            this.slot.layout = true;
            (this.slot as DraggableSprite).owner?.addChild(this.slot);
            this.slot = undefined;
          }

          if (item instanceof DraggableSprite) {
            // runState.setCaptain(item.crew);
            //console.log('onDrop', item.somethingSomething);
          }

          this.slot = item;
          this.addChild(item);
          return true;
        }
      })(),
    ) as Button & { view: DroppableContainer };

    /**

    avatar.onHover.connect(() => {
      avatar.view.children[0].texture = Assets.get(ASSETS.prototype).textures['avatars_tile_2#0'];
    });
    avatar.onOut.connect(() => {
      avatar.view.children[0].texture = Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'];
    });

    /**/

    droppableManager.addDroppable(avatar.view! as DroppableContainer);

    this.addChild(avatar.view!);
  }

  async show(): Promise<void> {
    // INSERT_YOUR_CODE
    // Fade in the gameContainer when the screen is shown using animejs
  }

  resize(_w: number, _h: number) {
    // TODO: Implement resize
  }

  reset() {
    this.children.forEach((child) => child.destroy());
  }
}
