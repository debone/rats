import { ASSETS } from '@/assets';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import { DraggableSprite } from '@/core/dnd/DraggableSprite';
import { DroppableLayoutContainer } from '@/core/dnd/DroppableLayoutContainer';
import { DroppableManager } from '@/core/dnd/DroppableManager';
import type { Droppable } from '@/core/dnd/types';
import type { Cleanup, Signal } from '@/core/reactivity/signals/types';
import { LAYER_NAMES, type AppScreen } from '@/core/window/types';
import { getGameContext } from '@/data/game-context';
import { changeScraps, getRunState } from '@/data/game-state';
import { CREW_DEFS, CrewMemberInstance } from '@/entities/crew/Crew';
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
    getRunState().crewMembers.push(new CrewMemberInstance('faster', 'faster-crew-member-1'));
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

    const primarySlot = new ActiveMemberSlot(getRunState().firstMember, droppableManager, surface);
    droppableManager.addDroppable(primarySlot);

    const secondarySlot = new ActiveMemberSlot(getRunState().secondMember, droppableManager, surface);
    droppableManager.addDroppable(secondarySlot);

    activeMembersContainer.addChild(primarySlot);
    activeMembersContainer.addChild(secondarySlot);

    const passiveMembersContainer = new LayoutContainer({
      layout: {
        ...layout,
        flexGrow: 1,
      },
    });
    passiveMembersContainer.addChild(new Text({ text: 'Passive Members', style: TEXT_STYLE_DEFAULT, layout: true }));

    const group2 = new BenchContainer({
      droppableManager,
      label: 'group2',
      layout: {
        gap: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 200,
        height: 160,
        padding: 20,
        alignContent: 'flex-start',
      },
    });

    getRunState()
      .crewMembers.getAll()
      .forEach((crew) => {
        const avatar = getAvatarSprite(crew, droppableManager, surface);
        avatar.on('dragcancel', () => {
          avatar.layout = true;
        });
        group2.addChild(avatar);
      });

    const cleanupBatchChange = getRunState().crewMembers.onBatchChange.subscribe((change) => {
      if (!change) return;
      change.adds.forEach((add) => {
        const avatar = getAvatarSprite(add.item.get(), droppableManager, surface);
        avatar.on('dragcancel', () => {
          avatar.layout = true;
        });
        group2.addChild(avatar);
      });
    }, false);

    this.view.on('destroyed', cleanupBatchChange);

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

function getAvatarSprite(crew: CrewMemberInstance, droppableManager: DroppableManager, surface: Container) {
  return new DraggableSprite<CrewMemberInstance>({
    data: crew,
    texture: Assets.get(ASSETS.prototype).textures[CREW_DEFS[crew.defKey].textureName],
    label: `avatar_${crew.defKey}`,
    layout: true,
    droppableManager,
    surface,
  });
}

/**
 * A droppable slot that binds to a single member signal.
 *
 * The signal subscription is the single source of truth for the slot's visual:
 * it creates and destroys the avatar sprite. onDrop only updates data (signal +
 * pool) and destroys the dragged sprite — the subscription reacts and builds
 * the visual. This keeps layout state consistent (layout:false, x/y reset)
 * whether the slot was populated by DnD or by reopening with an existing signal.
 */
class ActiveMemberSlot extends Container implements Droppable {
  slot?: DraggableSprite<CrewMemberInstance>;
  private i = LOOP_PROTECTION;

  constructor(
    private readonly memberSignal: Signal<CrewMemberInstance | undefined>,
    droppableManager: DroppableManager,
    surface: Container,
  ) {
    super({ layout: true });

    this.addChild(
      new Sprite({
        texture: Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'],
        layout: true,
        scale: 1.25,
      }),
    );

    // Keep this.slot in sync with what is physically inside the container.
    // childAdded handles the "dropped nowhere, returned to owner" case.
    this.on('childAdded', (child) => {
      if (child instanceof DraggableSprite) {
        this.slot = child as DraggableSprite<CrewMemberInstance>;
      }
    });

    this.on('childRemoved', (child) => {
      if (child === this.slot) {
        this.slot = undefined;
      }
    });

    // The subscription is the only place that creates or destroys the slot sprite.
    const cleanupSignal = memberSignal.subscribe((member) => {
      if (!member || member.defKey === 'empty') {
        this.slot?.destroy();
        return;
      }

      // Idempotent: already showing the right member (e.g. returned to owner).
      if (member.key === this.slot?.data?.key) return;

      // Swap: return the displaced member to the bench pool.
      const displaced = this.slot?.data as CrewMemberInstance | undefined;
      if (displaced && displaced.defKey !== 'empty') {
        getRunState().crewMembers.push(displaced);
      }
      this.slot?.destroy();

      const sprite = getAvatarSprite(member, droppableManager, surface);
      sprite.on('dragstart', () => {
        this.memberSignal.set(new CrewMemberInstance('empty', 'empty'));
      });
      sprite.on('dragcancel', () => {
        //sprite.layout = false; // endDrag set layout=true before emitting; undo it
        this.memberSignal.set(member); // subscription idempotency check keeps the returned sprite
        sprite.scale = 1.25;
      });
      sprite.layout = false;
      sprite.x = 0;
      sprite.y = 0;
      this.addChild(sprite); // triggers childAdded → sets this.slot
      sprite.scale = 1.25;
    });

    // TODO: huh?
    this.on('destroyed', cleanupSignal);
  }

  updateBounds() {}

  *onHover() {
    while (this.i > 0) {
      const { isOver } = yield;
      if (isOver) break;
      this.tint = this.slot ? 0xdd0000 : 0x00ffff;
      (this.children[0] as Sprite).texture = Assets.get(ASSETS.prototype).textures['avatars_tile_2#0'];
      this.i--;
    }
    this.tint = 0xffffff;
    (this.children[0] as Sprite).texture = Assets.get(ASSETS.prototype).textures['avatars_tile_1#0'];
    this.i = LOOP_PROTECTION;
  }

  /*

  onDrop(_event: FederatedPointerEvent, item: Container) {
          if (this.slot) {
            // SWAP
            this.slot.scale = 1;
            this.slot.layout = true;
            getRunState().crewMembers.push(this.slot.data! as CrewMemberInstance);
            console.log('onDrop swap AVATAR', getRunState().crewMembers.getAll());
            this.slot.destroy();
          }

          if (item instanceof DraggableSprite) {
            if (item.data) {
              const crewMember = item.data as CrewMemberInstance;
              console.log('onDrop AVATAR', crewMember.defKey);
              /*
              The below actually is nonsense

              This avatar must be concerned about itself. 
              Trying to manage a broader state from here is nonsense.
* /
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
*/

  onDrop(_event: FederatedPointerEvent, item: Container) {
    if (item instanceof DraggableSprite && item.data) {
      const crewMember = item.data as CrewMemberInstance;
      // Destroy the dragged sprite — the subscription creates a fresh one.
      item.destroy();
      const rest = getRunState()
        .crewMembers.getAll()
        .filter((m) => m.key !== crewMember.key);
      getRunState().crewMembers.set(rest);
      this.memberSignal.set(crewMember);
    }
    return true;
  }
}

/**
 * The bench container. Extends DroppableLayoutContainer with signal and pool
 * awareness: when a member from an active slot is dropped here, it clears
 * that slot's signal and pushes the member back into crewMembers.
 * The onBatchChange subscriber then creates the bench sprite reactively.
 */
class BenchContainer extends DroppableLayoutContainer {
  onDrop(event: FederatedPointerEvent, item: Container): boolean {
    if (item instanceof DraggableSprite && item.data) {
      const member = item.data as CrewMemberInstance;
      const runState = getRunState();

      if (!runState.crewMembers.getAll().some((m) => m.key === member.key)) {
        // Member came from a slot — dragstart already cleared the slot signal.
        // Just return it to the pool; onBatchChange creates the bench sprite.
        item.destroy();
        runState.crewMembers.push(member);
        this.resetPreview();
        return true;
      }
    }
    return super.onDrop(event, item);
  }
}

export class CrewPickerOverlay extends Container implements AppScreen {
  static readonly SCREEN_ID = 'crew-picker';
  static readonly assetBundles = ['default'];

  private _cleanupSignals: Cleanup[] = [];
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

    const cleanupScraps = getRunState().scrapsCounter.subscribe((count) => {
      scrapCount.text = `${count} Scraps`;
    });
    this._cleanupSignals.push(cleanupScraps);

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
    for (let i = this.children.length - 1; i >= 0; i--) {
      this.children[i].destroy({ children: true });
    }

    for (let i = this._cleanupSignals.length - 1; i >= 0; i--) {
      this._cleanupSignals[i]();
    }
    this._cleanupSignals = [];
  }
}
