import { ASSETS } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate, utils } from 'animejs';
import { Assets, Bounds, Container, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';

interface DraggableOptions {
  onDragStart?: () => void;
  onDragMove?: (event: FederatedPointerEvent, globalX: number, globalY: number) => void;
  onDragEnd?: (event: FederatedPointerEvent, globalX: number, globalY: number) => void;
}

function makeDraggable(parent: Container, sprite: Container, options: DraggableOptions): () => void {
  sprite.interactive = true;
  sprite.cursor = 'grab';

  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  const onPointerDown = (event: FederatedPointerEvent) => {
    if (!sprite.parent) return;
    options.onDragStart?.();

    sprite.tint = 0x00ff00;
    isDragging = true;
    sprite.cursor = 'grabbing';
    parent.addChild(sprite);
    sprite.layout = false;
    sprite.x = event.global.x - sprite.width / 2;
    sprite.y = event.global.y - sprite.height / 2;

    const pos = event.getLocalPosition(sprite.parent);
    dragOffset.x = sprite.x - pos.x;
    dragOffset.y = sprite.y - pos.y;
    ////console.log('[drag] onPointerDown', pos, dragOffset);
  };

  const onPointerMove = (event: FederatedPointerEvent) => {
    if (!isDragging || !sprite.parent) return;
    sprite.tint = 0x00ffff;
    const pos = event.getLocalPosition(sprite.parent);
    sprite.x = pos.x + dragOffset.x;
    sprite.y = pos.y + dragOffset.y;
    options.onDragMove?.(event, event.global.x, event.global.y);
  };

  const endDrag = (event: FederatedPointerEvent) => {
    if (!isDragging) return;
    sprite.tint = 0xffffff;
    isDragging = false;
    sprite.cursor = 'grab';
    sprite.x = 0;
    sprite.y = 0;

    options.onDragEnd?.(event, event.global.x, event.global.y);
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

/**
 * Calculate drop index based on pointer X position relative to group children midpoints
 */
function getDropIndex(
  group: LayoutContainer,
  event: FederatedPointerEvent,
  globalX: number,
  draggedSprite?: Container,
): number {
  const pos = event.getLocalPosition(group);
  const bounds = group.getBounds();

  // Find the position of the first children inside
  // the container and calculate the padding
  const firstChild = group.overflowContainer.children[0];
  const firstChildBounds = firstChild.getBounds();

  const paddingX = firstChildBounds.x - bounds.x;
  const paddingY = firstChildBounds.y - bounds.y;

  // The gap is a horrible problem if I don't know how many lines there are
  const gap = group.layout?.style?.gap ?? 0;

  const children = group.overflowContainer.children;
  const childrenCount = children.length;

  const childBounds = children[0].getBounds();
  const childWidth = childBounds.width + gap / 2;
  const childHeight = childBounds.height + gap / 2;

  // How many children can fit in the x direction
  // So sorry if this makes a mess, it should be iterative to find the gap
  const childrenLines = Math.floor((childrenCount * childWidth) / (bounds.width - paddingX)) + 1;

  ////console.log('[drag] childrenLines', childrenLines, childrenCount, childWidth, bounds.width, paddingX);

  const childrenPerLine = Math.floor(childrenCount / childrenLines);

  /*
    I know where the mouse is.
    I know the boundaries and a guess of how many lines there are
    Assuming all children are the same size and gap math didn't go wary
    The index is roughly 
  */

  // First, which line am I?
  const line = Math.max(Math.min(Math.floor((pos.y - paddingY) / childHeight), childrenLines), 0);
  const column = Math.max(Math.min(Math.floor((pos.x - paddingX + childWidth / 2) / childWidth), childrenPerLine), 0);
  //console.log('[drag] line', childrenLines, line, column);

  return Math.max(0, Math.min(line * childrenPerLine + column, childrenCount));
}

/**
 * Create drop preview manager that animates items shifting apart
 */
function createDropPreview(group: LayoutContainer) {
  let currentDropIndex = -1;
  const GAP_SIZE = 24;

  return {
    update(targetIndex: number, draggedSprite?: Container) {
      let adjustedIndex = 0;
      group.overflowContainer.children.forEach((child) => {
        utils.remove(child);
        const offset = adjustedIndex >= targetIndex ? GAP_SIZE / 2 : -GAP_SIZE / 2;
        animate(child, {
          x: offset,
          duration: 150,
          easing: 'easeOutQuad',
        });
        adjustedIndex++;
      });
    },

    reset() {
      currentDropIndex = -1;
      group.overflowContainer.children.forEach((child) => {
        animate(child, {
          x: 0,
          duration: 150,
          easing: 'easeOutQuad',
        });
      });
    },

    getCurrentIndex() {
      return currentDropIndex;
    },
  };
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

  async prepare() {
    const navigation = getGameContext().navigation;
    navigation.addToLayer(this, LAYER_NAMES.UI);

    const droppables: Container[] = [];

    const droppableBounds = new Map<Container, Bounds>();

    const matchDroppable = (globalX: number, globalY: number): Container | undefined => {
      return droppables.find((droppable) => {
        const bounds = droppableBounds.get(droppable);
        if (!bounds) return false;
        return (
          globalX >= bounds.x &&
          globalX <= bounds.x + bounds.width &&
          globalY >= bounds.y &&
          globalY <= bounds.y + bounds.height
        );
      });
    };

    const updateDroppableBounds = () => {
      droppables.forEach((droppable) => {
        const bounds = droppable.getBounds();
        droppableBounds.set(droppable, bounds);
      });
    };

    const text = new Text({
      text: 'Test Screen',
      style: { ...TEXT_STYLE_DEFAULT, fontSize: 24 },
      layout: true,
    });
    this.addChild(text);

    const group = new LayoutContainer({
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

    // Make a group item draggable and reorderable
    const makeGroupItemDraggable = (sprite: Container) => {
      let originalIndex = -1;

      makeDraggable(this, sprite, {
        onDragStart: () => {
          updateDroppableBounds();
          // originalIndex = group.getChildIndex(sprite);
          //this.addChild(sprite);
          /*console.log('[drag] onDragStart', sprite.label, originalIndex);
          sprite.alpha = 0.7;
          sprite.zIndex = 100;
          // Disable layout so the sprite can be moved freely
          sprite.layout = false;
          sprite.tint = 0x00ff00;*/
        },
        onDragMove: (event, globalX, globalY) => {
          //console.log('[drag] onDragMove', sprite.label, globalX, globalY);
          const droppable = matchDroppable(globalX, globalY);
          if (droppable) {
            //console.log('[drag] onDragMove over droppable', droppable.label);
          } else {
            //console.log('[drag] onDragMove not over droppable');
          }
          if (isOverGroup(globalX, globalY)) {
            const dropIndex = getDropIndex(group, event, globalX, sprite);
            dropPreview.update(dropIndex, sprite);
            //  console.log('[drag] onDragMove over group', sprite.label, dropIndex);
          } else {
            dropPreview.reset();
            //console.log('[drag] onDragMove not over group', sprite.label, 'reset');
            //console.log(event);
          }
          /**/
        },
        onDragEnd: (event, globalX, globalY) => {
          const droppable = matchDroppable(globalX, globalY);
          if (droppable) {
            console.log('[drag] onDragMove over droppable', droppable.label);
            if (droppable.isBusy()) {
              const slot = droppable.getBlah();
              slot.layout = true;
              group.addChild(slot);
            }
            droppable.blah();

            sprite.destroy();
            return;
          }
          if (isOverGroup(globalX, globalY)) {
            //const dropIndex = dropPreview.getCurrentIndex();
            const dropIndex = getDropIndex(group, event, globalX, sprite);

            group.addChildAt(sprite, dropIndex);
            //group.layout?.forceUpdate();
          } else {
            group.addChild(sprite);
          }

          group.overflowContainer.children.forEach((child) => {
            utils.remove(child);
            child.x = 0;
          });

          sprite.layout = true;
          dropPreview.reset();
          /*sprite.alpha = 1;
          sprite.zIndex = 0;
          //group.addChild(sprite);
          // Re-enable layout
          //sprite.layout = true;
          //sprite.x = 0;

          if (isOverGroup(globalX, globalY)) {
            const dropIndex = dropPreview.getCurrentIndex();
            if (dropIndex !== -1 && dropIndex !== originalIndex) {
              group.removeChild(sprite);
              // Adjust index if we removed from before the target
              const adjustedIndex = dropIndex > originalIndex ? dropIndex - 1 : dropIndex;
              group.addChildAt(sprite, adjustedIndex);
            }
          }

          dropPreview.reset();*/
        },
      });
    };

    group.addChild(this.getAvatarSprite(1));
    group.addChild(this.getAvatarSprite(3));
    group.addChild(this.getAvatarSprite(4));
    group.addChild(this.getAvatarSprite(2));
    group.addChild(this.getAvatarSprite(3));
    group.addChild(this.getAvatarSprite(1));
    //group.addChild(this.getAvatarSprite(3));
    this.addChild(group);

    const dropPreview = createDropPreview(group);

    // Helper to check if pointer is over group
    const isOverGroup = (globalX: number, globalY: number): boolean => {
      const groupBounds = group.getBounds();
      //console.log('[drag] isOverGroup', globalX, globalY, groupBounds);
      return (
        globalX >= groupBounds.x &&
        globalX <= groupBounds.x + groupBounds.width &&
        globalY >= groupBounds.y &&
        globalY <= groupBounds.y + groupBounds.height
      );
    };

    // Make existing group items draggable
    // Use spread to get a snapshot of children array
    group.overflowContainer.children.forEach((child) => makeGroupItemDraggable(child));

    // Create the external avatar that can be dropped into the group
    const avatar = new Button(
      new (class extends Container {
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
          makeGroupItemDraggable(sprite);
          this.addChild(sprite);
        }
      })(),
    ) as Button & { view: Sprite };

    avatar.onHover.connect(() => {
      avatar.view.texture = Assets.get(ASSETS.prototype).textures['avatars_tile_2#0'];
    });
    avatar.onOut.connect(() => {
      avatar.view.texture = Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'];
    });

    droppables.push(avatar.view!);

    this.addChild(avatar.view!);

    /*
    const setupExternalAvatarDrag = () => {
      cleanupAvatarDrag = makeDraggable(avatar, {
        onDragStart: () => {
          avatarOriginalPosition = { x: avatar.x, y: avatar.y };
          avatar.alpha = 0.7;
          avatar.zIndex = 100;
        },
        onDragMove: (globalX, globalY) => {
          if (isOverGroup(globalX, globalY)) {
            avatar.tint = 0x00ff00;
            const dropIndex = getDropIndex(group, globalX);
            dropPreview.update(dropIndex);
          } else {
            avatar.tint = 0xffffff;
            dropPreview.reset();
          }
        },
        onDragEnd: (globalX, globalY) => {
          avatar.alpha = 1;
          avatar.zIndex = 0;

          if (isOverGroup(globalX, globalY)) {
            const dropIndex = dropPreview.getCurrentIndex();
            if (dropIndex !== -1) {
              if (dropIndex >= group.children.length) {
                group.addChild(avatar);
              } else {
                this.removeChild(avatar);
                group.addChildAt(avatar, dropIndex);
              }
              // Remove from current parent and add to group
              avatar.layout = true;
              avatar.x = 0;

              // Clean up external drag handlers and set up group item drag
              cleanupAvatarDrag?.();
              cleanupAvatarDrag = null;
              makeGroupItemDraggable(avatar);
            }
          } else {
            // Return to original position
            avatar.x = avatarOriginalPosition.x;
            avatar.y = avatarOriginalPosition.y;
          }

          dropPreview.reset();
        },
      });
    };

    setupExternalAvatarDrag();*/
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
