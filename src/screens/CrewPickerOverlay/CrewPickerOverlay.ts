import { ASSETS, FRAMES, type PrototypeTextures } from '@/assets';
import { TEXT_STYLE_DEFAULT, TEXT_STYLE_TITLE } from '@/consts';
import { typedAssets } from '@/core/assets/typed-assets';
import { DraggableSprite } from '@/core/dnd/DraggableSprite';
import { DroppableLayoutContainer } from '@/core/dnd/DroppableLayoutContainer';
import { DroppableManager } from '@/core/dnd/DroppableManager';
import type { Droppable, DroppableContainer } from '@/core/dnd/types';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { changeScraps, getRunState } from '@/data/game-state';
import type { CrewMember } from '@/entities/crew/Crew';
import { FasterCrewMember } from '@/entities/crew/Faster';
import type { LayoutStyles } from '@pixi/layout';
import { LayoutContainer } from '@pixi/layout/components';
import { Button } from '@pixi/ui';
import { animate } from 'animejs';
import { DropShadowFilter } from 'pixi-filters';
import { Assets, Color, Container, FederatedPointerEvent, Graphics, Sprite, Text, Ticker } from 'pixi.js';

const LOOP_PROTECTION = 1_000_000;

class BaseButton extends Button {
  constructor(layout: Partial<LayoutStyles>, ...containers: Container[]) {
    const view = new LayoutContainer({
      layout: {
        gap: 10,
        padding: 10,
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        ...layout,
      },
    });

    for (const container of containers) {
      view.addChild(container);
    }

    super(view);
  }
}

class PrimaryButton extends BaseButton {
  constructor(label: string) {
    super({}, new Text({ text: label, style: TEXT_STYLE_DEFAULT, layout: true }));
  }
}

class CrewMemberBadge extends LayoutContainer {
  constructor(name: string) {
    /*
+---------------------------------------------------------+
|                                                         |
|  +------------+                                         |
|  |            | TITLE                                   |
|  |            |                                         |
|  |            | Description                             |
|  |            |                                         |
|  |            |                                         |
|  |            |                                         |
|  |            |                                         |
|  +------------+                                         |
|                                                         |
|  +------------+ +-------------------------------------+ |
|  | crew power | | 123 Scraps to hire                  | |
|  +------------+ +-------------------------------------+ |
|                                                         |
+---------------------------------------------------------+
 */
    super({
      layout: {
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 3,
        minWidth: 480,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        gap: 10,
        height: '100%',
      },
    });

    const leftContent = new LayoutContainer({
      layout: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 5,
        debug: true,
      },
    });

    const middleContent = new LayoutContainer({
      layout: {
        flexGrow: 1,
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: 10,
        padding: 5,
      },
    });

    const rightContent = new LayoutContainer({
      layout: {
        height: '100%',
        flexDirection: 'column',
        gap: 10,
        padding: 5,
      },
    });

    const frame = new Sprite({
      texture: typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures[FRAMES.prototype['avatars_tile_2#0']],
      layout: true,
    });
    leftContent.addChild(frame);

    const nameText = new Text({ text: name, style: TEXT_STYLE_TITLE, layout: true });
    middleContent.addChild(nameText);

    const descriptionText = new Text({ text: 'Description', style: TEXT_STYLE_DEFAULT, layout: true });
    middleContent.addChild(descriptionText);

    const crewPowerText = new PrimaryButton('123 Scraps to hire');
    rightContent.addChild(crewPowerText.view!);

    this.addChild(leftContent);
    this.addChild(middleContent);
    this.addChild(rightContent);
  }
}

const layout: Partial<LayoutStyles> = {
  gap: 10,
  padding: 10,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 0x272736,
  borderColor: 0x57294b,
  borderWidth: 1,
  borderRadius: 5,
};

function getShopCard() {
  const card = new LayoutContainer({
    layout,
  });

  card.addChild(new Text({ text: 'Shop Card', style: TEXT_STYLE_DEFAULT, layout: true }));

  const image = new Sprite({ texture: Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'], layout: true });
  card.addChild(image);

  const buyButton = new BaseButton(
    { padding: 5, justifyContent: 'space-between' },
    new Sprite({ texture: Assets.get(ASSETS.prototype).textures['scraps#0'], layout: true }),
    new Text({ text: '100 Scraps', style: TEXT_STYLE_DEFAULT, layout: true }),
  );

  buyButton.onPress.connect(() => {
    console.log('Buy button pressed');
    if (getRunState().scrapsCounter.get() < 100) {
      return;
    }
    changeScraps(-100);
    getRunState().crewMembers.push(new FasterCrewMember('faster-crew-member-1'));
    card.destroy();
  });

  card.addChild(buyButton.view!);

  return card;
}

class CrewPickerPanel {
  public readonly view: LayoutContainer;

  constructor(surface: Container) {
    this.view = new LayoutContainer({
      layout,
    });

    const shop = new LayoutContainer({
      layout,
    });

    const shopTitle = new Text({ text: 'Shop', style: TEXT_STYLE_DEFAULT, layout: true });
    shop.addChild(shopTitle);

    const shopItems = new LayoutContainer({
      layout: {
        ...layout,
        flexDirection: 'row',
        gap: 10,
      },
    });

    shopItems.addChild(getShopCard());
    shopItems.addChild(getShopCard());
    shopItems.addChild(getShopCard());

    shop.addChild(shopItems);

    this.view.addChild(shop);

    const crew = new LayoutContainer({
      layout,
    });

    const title = new Text({ text: 'Crew', style: TEXT_STYLE_DEFAULT, layout: true });
    crew.addChild(title);

    const crewMembersContainer = new LayoutContainer({
      layout: {
        ...layout,
        flexDirection: 'row',
        gap: 10,
      },
    });

    const droppableManager = new DroppableManager();

    const activeMembersContainer = new LayoutContainer({
      layout: {
        ...layout,
        gap: 20,
      },
    });

    activeMembersContainer.addChild(new Text({ text: 'Active Members', style: TEXT_STYLE_DEFAULT, layout: true }));

    const primary = new Button(
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
              scale: 1.25,
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
            this.slot.scale = 1;
            this.slot.layout = true;
            getRunState().crewMembers.push(this.slot.data! as CrewMember);
            console.log('onDrop swap AVATAR', getRunState().crewMembers.getAll());
            this.slot.destroy();
          }

          if (item instanceof DraggableSprite) {
            if (item.data) {
              const crewMember = item.data as CrewMember;
              console.log('onDrop AVATAR', crewMember.name);
              /*
              The below actually is nonsense

              This avatar must be concerned about itself. 
              Trying to manage a broader state from here is nonsense.
*/
              const rest = getRunState()
                .crewMembers.getAll()
                .filter((member) => member.key !== crewMember.key);
              getRunState().crewMembers.set(rest);
              console.log('onDrop AVATAR', getRunState().crewMembers.getAll());

              getRunState().firstMember.set(crewMember);
            }
          }

          this.slot = item;
          this.addChild(item);
          item.scale = 1.25;
          return true;
        }
      })(),
    ) as Button & { view: DroppableContainer };

    droppableManager.addDroppable(primary.view! as DroppableContainer);

    const secondary = new Button(
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
              scale: 1.25,
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
            this.slot.scale = 1;
            this.slot.layout = true;
            getRunState().crewMembers.push(this.slot.data! as CrewMember);
            console.log('onDrop swap AVATAR', getRunState().crewMembers.getAll());
            this.slot.destroy();
          }

          if (item instanceof DraggableSprite) {
            if (item.data) {
              const crewMember = item.data as CrewMember;
              console.log('onDrop AVATAR', crewMember.name);
              /*
              The below actually is nonsense

              This avatar must be concerned about itself. 
              Trying to manage a broader state from here is nonsense.
*/
              const rest = getRunState()
                .crewMembers.getAll()
                .filter((member) => member.key !== crewMember.key);
              getRunState().crewMembers.set(rest);
              console.log('onDrop AVATAR', getRunState().crewMembers.getAll());

              getRunState().secondMember.set(crewMember);
            }
          }

          this.slot = item;
          this.addChild(item);
          item.scale = 1.25;
          return true;
        }
      })(),
    ) as Button & { view: DroppableContainer };

    droppableManager.addDroppable(secondary.view! as DroppableContainer);

    activeMembersContainer.addChild(primary.view!);
    activeMembersContainer.addChild(secondary.view!);

    const passiveMembersContainer = new LayoutContainer({
      layout: {
        ...layout,
        flexGrow: 1,
      },
    });
    passiveMembersContainer.addChild(new Text({ text: 'Passive Members', style: TEXT_STYLE_DEFAULT, layout: true }));

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

    /*
    I'm going for the "this is not the way to do it"

    you see, the signal collection is a good way to keep track of things
    but if we are doing side-effects on it through dnd, putting it around and
    back will not work.

    But also – how then do I add a new crew member? 

    aha.


    So I can't keep this kind of collection the way it is here. 

    */

    getRunState()
      .crewMembers.getAll()
      .forEach((crew) => {
        group2.addChild(getAvatarSprite(crew, droppableManager, surface));
      });

    getRunState().crewMembers.onBatchChange.subscribe((change) => {
      if (!change) return;
      const { adds, removes, moves } = change;
      console.log('onBatchChange', adds, removes, moves);
      adds.forEach((add) => {
        group2.addChild(getAvatarSprite(add.item.get(), droppableManager, this.view));
      });

      //return getAvatarSprite(, droppableManager, this.view);
    }, false);

    passiveMembersContainer.addChild(group2);

    crewMembersContainer.addChild(activeMembersContainer);
    crewMembersContainer.addChild(passiveMembersContainer);

    crew.addChild(crewMembersContainer);

    this.view.addChild(crew);

    const footer = new LayoutContainer({
      layout: {
        ...layout,
        flexDirection: 'row',
      },
    });

    const footerLeft = new LayoutContainer({
      layout: {
        ...layout,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      },
    });

    footerLeft.addChild(new Text({ text: 'RAT', style: TEXT_STYLE_DEFAULT, layout: true }));

    footer.addChild(footerLeft);

    const footerRight = new LayoutContainer({
      layout: {
        ...layout,
      },
    });

    const activeAbility = new LayoutContainer({
      layout: {
        ...layout,
      },
    });
    activeAbility.addChild(new Text({ text: 'Active Ability', style: TEXT_STYLE_DEFAULT, layout: true }));
    footerRight.addChild(activeAbility);

    const passiveAbility = new LayoutContainer({
      layout: {
        ...layout,
      },
    });
    passiveAbility.addChild(new Text({ text: 'Passive Ability', style: TEXT_STYLE_DEFAULT, layout: true }));
    footerRight.addChild(passiveAbility);

    footer.addChild(footerRight);
    this.view.addChild(footer);
  }
}

function getAvatarSprite(crew: CrewMember, droppableManager: DroppableManager, surface: Container) {
  return new DraggableSprite<CrewMember>({
    data: crew,
    texture: Assets.get(ASSETS.prototype).textures[crew.textureName],
    label: `avatar_${crew.textureName}`,
    layout: true,
    droppableManager,
    surface,
  });
}

export class CrewPickerOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'crew-picker';
  static readonly assetBundles = ['default'];

  private _background: Graphics;

  constructor() {
    super({
      layout: {
        backgroundColor: new Color({ r: 30, g: 30, b: 45, a: 0.8 }),
        gap: 10,
        padding: 10,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    const background = new Graphics().rect(0, 0, 50, 50).fill({ color: 0x000000, alpha: 0.5 });
    background.interactive = true;
    this.addChild(background);

    this._background = background;

    const popupBackground = new LayoutContainer({
      layout: {
        backgroundColor: 0x272736,
        borderColor: 0x57294b,
        borderWidth: 1,
        borderRadius: 5,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      },
      alpha: 0,
    });

    this._popupBackground = popupBackground;

    this._popupBackground.background.filters = [
      new DropShadowFilter({
        color: 0x101019,
        blur: 10,
      }),
    ];
  }

  private _popupBackground: LayoutContainer;

  async prepare() {
    console.log('[CrewPickerOverlay] Preparing...');

    const context = getGameContext();

    const header = new LayoutContainer({
      layout: {
        ...layout,
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
    });

    const addScraps = new PrimaryButton('Add Scraps');
    addScraps.onPress.connect(() => {
      console.log('Add scraps button pressed');
      changeScraps(50);
    });
    header.addChild(addScraps.view!);

    const scrapCount = new Text({
      text: `0 Scraps`,
      style: TEXT_STYLE_DEFAULT,
      layout: true,
    });
    getRunState().scrapsCounter.subscribe((count) => {
      scrapCount.text = `${count} Scraps`;
    });
    header.addChild(scrapCount);

    const closeButton = new PrimaryButton('Close');

    closeButton.onPress.connect(() => {
      // navigation.dismissPopup();
      console.log('Close button pressed');
      context.navigation.dismissCurrentOverlay();
    });

    //this._popupBackground.addChild(closeButton.view!);
    header.addChild(closeButton.view!);
    this._popupBackground.addChild(header);

    this.addChild(this._popupBackground);

    const crewPickerPanel = new CrewPickerPanel(this);
    this._popupBackground.addChild(crewPickerPanel.view!);

    context.navigation.addToLayer(this, LAYER_NAMES.POPUP);

    console.log('[CrewPickerOverlay] Prepared');
  }

  /**
   * Show is called when the screen is displayed.
   */
  async show() {
    console.log('[GameScreen] Showing...');
    // The game is already running via systems

    await animate(this._popupBackground, { alpha: 1, duration: 500 });

    // We just need to display the visuals
    console.log('[GameScreen] Shown');
  }

  async hide() {
    await animate(this._popupBackground.scale, { x: 0, y: 0, duration: 500, ease: 'inOutBack' });
  }

  /**
   * Update is called every frame.
   * Note: Game logic updates are handled by the SystemRunner in main.ts
   */
  update(_time: Ticker) {
    // Game screen specific updates (UI animations, etc.)
    // The actual game logic is updated by SystemRunner
  }

  /**
   * Resize is called when the screen size changes.
   */
  resize(w: number, h: number) {
    this._background.width = w;
    this._background.height = h;
  }

  /**
   * Called when window loses focus.
   */
  blur() {
    console.log('[GameScreen] Blurring...');
    const context = getGameContext();
    context.phase = 'paused';
  }

  /**
   * Called when window gains focus.
   */
  focus() {
    console.log('[GameScreen] Focusing...');
    const context = getGameContext();
    if (context.phase === 'paused') {
      context.phase = 'level';
    }
  }

  /**
   * Reset is called when the screen is removed.
   */
  reset() {
    console.log('[GameScreen] Resetting...');

    // Destroy containers
    for (const child of this.children) {
      child.destroy();
    }
  }
}
