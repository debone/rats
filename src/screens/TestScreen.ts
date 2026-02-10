import { ASSETS } from '@/assets';
import { MIN_HEIGHT, MIN_WIDTH, TEXT_STYLE_DEFAULT } from '@/consts';
import { DraggableSprite } from '@/core/dnd/DraggableSprite';
import { DroppableLayoutContainer } from '@/core/dnd/DroppableLayoutContainer';
import { DroppableManager } from '@/core/dnd/DroppableManager';
import type { Droppable, DroppableContainer } from '@/core/dnd/types';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { Button } from '@pixi/ui';
import { Assets, Container, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';

const LOOP_PROTECTION = 1_000_000;
// TODO: the tooltip must be a separated layer overlay
// Best thing to do right now is to just make it a separated piece of screen

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

  getAvatarSprite(number: number, droppableManager: DroppableManager): DraggableSprite<unknown> {
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
            (this.slot as DraggableSprite<unknown>).owner?.addChild(this.slot);
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
