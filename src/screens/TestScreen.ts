import { ASSETS } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer, type LayoutContainerOptions } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate, utils } from 'animejs';
import { Assets, Bounds, Container, Sprite, Text, type FederatedPointerEvent, type SpriteOptions } from 'pixi.js';

const LOOP_PROTECTION = 1_000_000;

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
type DroppableLayoutContainer = LayoutContainer & Droppable;

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

    console.log('[droppable] updateDroppableBounds', this.droppableBounds);
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
  originalParent: Container;
  surface: Container;
  cleanup: () => void;

  // TODO
  // - custom callbacks?

  constructor(options: SpriteOptions & { droppableManager: DroppableManager; surface: Container }) {
    super(options);

    this.droppableManager = options.droppableManager;
    this.surface = options.surface;
    this.cleanup = this.makeDraggable(this);

    this.on('added', (parent) => {
      if (!this.originalParent) {
        this.originalParent = parent;
      }
    });
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
      console.log('[drag] onDragMove over droppable', droppable?.label);
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
        console.log('[drag] onDragMove over droppable', droppable.label);
        result = droppable.onDrop(event, sprite);
      }

      if (!result) {
        this.originalParent.addChild(sprite);
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

class LayoutDroppable {
  droppable: DroppableLayoutContainer;
  droppableManager: DroppableManager;

  constructor(droppable: DroppableLayoutContainer, droppableManager: DroppableManager) {
    this.droppable = droppable;
    this.droppableManager = droppableManager;

    this.droppable.overflowContainer.children.forEach((child) => {
      this.makeDraggable(child);
    });

    this.droppable.overflowContainer.on('childAdded', (child: Container) => {
      this.makeDraggable(child);
    });

    // Listen for child removals
    this.droppable.overflowContainer.on('childRemoved', (child, container, index) => {});
  }

  /**
   * Create drop preview manager that animates items shifting apart
   */
  updateDropPreview(targetIndex: number) {
    const GAP_SIZE = 24;

    let adjustedIndex = 0;
    this.droppable.overflowContainer.children.forEach((child) => {
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
    this.droppable.overflowContainer.children.forEach((child) => {
      animate(child, {
        x: 0,
        duration: 150,
        easing: 'easeOutQuad',
      });
    });
  }

  bounds?: Bounds;
  paddingX?: number;
  paddingY?: number;
  gap?: number;
  childrenCount?: number;
  childrenPerLine?: number;
  childrenLines?: number;
  childWidth?: number;
  childHeight?: number;

  updateDimensions() {
    this.bounds = this.droppable.getBounds();
    // Find the position of the first children inside
    // the container and calculate the padding
    const children = this.droppable.overflowContainer.children;
    const firstChild = children[0];
    const firstChildBounds = firstChild.getBounds();
    this.childrenCount = children.length;

    this.paddingX = firstChildBounds.x - this.bounds.x;
    this.paddingY = firstChildBounds.y - this.bounds.y;

    this.gap = this.droppable.layout?.style?.gap ?? 0;

    this.childWidth = firstChildBounds.width + this.gap / 2;
    this.childHeight = firstChildBounds.height + this.gap / 2;

    // How many children can fit in the x direction
    // So sorry if this makes a mess, it should be iterative to find the gap
    this.childrenLines = Math.floor((children.length * this.childWidth) / (this.bounds.width - this.paddingX)) + 1;

    this.childrenPerLine = Math.floor(children.length / this.childrenLines);
  }

  /**
   * Calculate drop index based on pointer X position relative to group children midpoints
   */
  getDropIndex(event: FederatedPointerEvent, size = 0): number {
    const pos = event.getLocalPosition(this.droppable);

    const line = Math.max(Math.min(Math.floor((pos.y - this.paddingY!) / this.childHeight!), this.childrenLines!), 0);
    const column = Math.max(
      Math.min(Math.floor((pos.x - this.paddingX! + this.childWidth! / 2) / this.childWidth!), this.childrenPerLine!),
      0,
    );

    return Math.max(0, Math.min(line * this.childrenPerLine! + column, this.childrenCount! - size));
  }

  makeDraggable(sprite: Container): () => void {
    sprite.interactive = true;
    sprite.cursor = 'grab';

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let wasOverGroup = false;
    let lastDroppable: DroppableContainer | undefined = undefined;
    let droppableGenerator: Generator<undefined, void, DroppableHoverEvent> | undefined = undefined;

    const onPointerDown = (event: FederatedPointerEvent) => {
      if (!sprite.parent) return;
      this.droppableManager.updateDroppableBounds();
      this.updateDimensions();

      //const dropIndex = this.getDropIndex(event);
      //this.updateDropPreview(dropIndex);

      isDragging = true;
      sprite.tint = 0x00ff00;
      sprite.cursor = 'grabbing';
      this.droppable.parent!.addChild(sprite);
      sprite.layout = false;

      sprite.x = event.global.x - sprite.width / 2;
      sprite.y = event.global.y - sprite.height / 2;

      const pos = event.getLocalPosition(sprite.parent);
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

      if (this.overGroup(globalX, globalY)) {
        const dropIndex = this.getDropIndex(event);
        this.updateDropPreview(dropIndex);
        wasOverGroup = true;
      } else if (wasOverGroup) {
        this.resetPreview();
        wasOverGroup = false;
      }
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
      if (droppable) {
        console.log('[drag] onDragMove over droppable', droppable.label);
        /*if (droppable.isBusy()) {
          const slot = droppable.getBlah();
          slot.layout = true;
          this.droppable.addChild(slot);
        }
        droppable.blah();

        sprite.destroy();
        return;*/
      }

      if (this.overGroup(globalX, globalY)) {
        const dropIndex = this.getDropIndex(event, 1);
        this.droppable.addChildAt(sprite, dropIndex);
        //group.layout?.forceUpdate();
      } else {
        this.droppable.addChild(sprite);
      }

      this.droppable.overflowContainer.children.forEach((child) => {
        utils.remove(child);
        child.x = 0;
      });

      sprite.layout = true;
      this.resetPreview();
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

  overGroup(globalX: number, globalY: number): boolean {
    return (
      globalX >= this.bounds!.x &&
      globalX <= this.bounds!.x + this.bounds!.width &&
      globalY >= this.bounds!.y &&
      globalY <= this.bounds!.y + this.bounds!.height
    );
  }
}

class ActuallyDroppableLayout extends LayoutContainer implements Droppable {
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

  bounds?: Bounds;
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
    this.bounds = this.getBounds();
    // Find the position of the first children inside
    // the container and calculate the padding
    const children = this.overflowContainer.children;
    this.childrenCount = children.length;

    if (this.childrenCount === 0) return;

    const firstChild = children[0];
    const firstChildBounds = firstChild.getBounds();

    this.paddingX = firstChildBounds.x - this.bounds.x;
    this.paddingY = firstChildBounds.y - this.bounds.y;

    this.gap = this.layout?.style?.gap ?? 0;

    this.childWidth = firstChildBounds.width + this.gap / 2;
    this.childHeight = firstChildBounds.height + this.gap / 2;

    // How many children can fit in the x direction
    // So sorry if this makes a mess, it should be iterative to find the gap
    this.childrenLines = Math.floor((children.length * this.childWidth) / (this.bounds.width - this.paddingX)) + 1;

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
  getDropIndex(event: FederatedPointerEvent, size = 0): number {
    if (this.childrenCount === 0) return 0;

    const pos = event.getLocalPosition(this);

    const line = Math.max(Math.min(Math.floor((pos.y - this.paddingY!) / this.childHeight!), this.childrenLines!), 0);
    const column = Math.max(
      Math.min(Math.floor((pos.x - this.paddingX! + this.childWidth! / 2) / this.childWidth!), this.childrenPerLine!),
      0,
    );

    return Math.max(0, Math.min(line * this.childrenPerLine! + column, this.childrenCount! - size));
  }

  overGroup(globalX: number, globalY: number): boolean {
    return (
      globalX >= this.bounds!.x &&
      globalX <= this.bounds!.x + this.bounds!.width &&
      globalY >= this.bounds!.y &&
      globalY <= this.bounds!.y + this.bounds!.height
    );
  }

  i = LOOP_PROTECTION;
  *onHover() {
    while (this.i > 0) {
      let { event, isOver } = yield;
      if (isOver) {
        break;
      }

      const globalX = event.global.x;
      const globalY = event.global.y;

      if (this.overGroup(globalX, globalY)) {
        const dropIndex = this.getDropIndex(event);
        this.updateDropPreview(dropIndex);
      }

      this.i--;
    }
    this.resetPreview();
    this.i = LOOP_PROTECTION;
  }

  onDrop(event: FederatedPointerEvent, item: Container) {
    const dropIndex = this.getDropIndex(event, 1);
    this.addChildAt(item, dropIndex);
    item.layout = true;

    this.overflowContainer.children.forEach((child) => {
      utils.remove(child);
      child.x = 0;
    });
    // this.resetPreview();

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

  getAvatarSprite(number: number): Sprite {
    return new Sprite({
      texture: Assets.get(ASSETS.prototype).textures[`avatars_tile_${number}#0`],
      label: `avatar_${number}`,
      layout: true,
    });
  }

  getAvatarSprite2(number: number, droppableManager: DroppableManager): DraggableSprite {
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

    const group = new ActuallyDroppableLayout({
      droppableManager,
      layout: {
        gap: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 200,
        height: 160,
        padding: 20,
        //borderStyle: 'solid',
        borderColor: 'red',
        borderWidth: 1,
        alignContent: 'flex-start',
      },
    });

    group.addChild(this.getAvatarSprite2(1, droppableManager));
    group.addChild(this.getAvatarSprite2(3, droppableManager));
    group.addChild(this.getAvatarSprite2(4, droppableManager));
    group.addChild(this.getAvatarSprite2(2, droppableManager));
    group.addChild(this.getAvatarSprite2(3, droppableManager));
    group.addChild(this.getAvatarSprite2(1, droppableManager));

    this.addChild(group);

    const group2 = new ActuallyDroppableLayout({
      droppableManager,
      layout: {
        gap: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 200,
        height: 160,
        padding: 20,
        //borderStyle: 'solid',
        borderColor: 'red',
        borderWidth: 1,
        alignContent: 'flex-start',
      },
    });

    group2.addChild(this.getAvatarSprite2(2, droppableManager));
    group2.addChild(this.getAvatarSprite2(3, droppableManager));
    group2.addChild(this.getAvatarSprite2(1, droppableManager));
    this.addChild(group2);

    // A

    // Create the external avatar that can be dropped into the group
    const avatar = new Button(
      new (class extends Container implements Droppable {
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
        }

        updateBounds() {}

        i = LOOP_PROTECTION;

        *onHover() {
          while (this.i > 0) {
            let { event, item, isOver } = yield;
            if (isOver) {
              break;
            }

            this.children[0].texture = Assets.get(ASSETS.prototype).textures['avatars_tile_2#0'];

            this.i--;
          }
          this.children[0].texture = Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'];

          this.i = LOOP_PROTECTION;
        }

        onDrop(event: FederatedPointerEvent, item: Container) {
          console.log('onDrop', item);
          item.destroy();
          const sprite = new Sprite({
            texture: Assets.get(ASSETS.prototype).textures['avatars_tile_3#0'],
          });
          this.slot = sprite;
          //makeGroupItemDraggable(sprite);
          this.addChild(sprite);
          return true;
        }

        isBusy() {
          return this.slot !== undefined;
        }

        getBlah() {
          return this.slot;
        }

        slot?: Container;

        blah() {
          console.log('blah');
          const sprite = new Sprite({
            texture: Assets.get(ASSETS.prototype).textures['avatars_tile_3#0'],
          });
          this.slot = sprite;
          //makeGroupItemDraggable(sprite);
          this.addChild(sprite);
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
