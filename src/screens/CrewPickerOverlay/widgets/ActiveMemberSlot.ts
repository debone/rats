import { DraggableSprite } from '@/core/dnd/DraggableSprite';
import type { DroppableManager } from '@/core/dnd/DroppableManager';
import type { Droppable } from '@/core/dnd/types';
import type { Signal } from '@/core/reactivity/signals/types';
import { getRunState } from '@/data/game-state';
import { CrewMemberInstance } from '@/entities/crew/Crew';
import { Container, type FederatedPointerEvent, Sprite } from 'pixi.js';
import { getCrewTexture, getSlotTexture } from '../actions';

const LOOP_PROTECTION = 1_000_000;

export function getAvatarSprite(crew: CrewMemberInstance, droppableManager: DroppableManager, surface: Container) {
  return new DraggableSprite<CrewMemberInstance>({
    data: crew,
    texture: getCrewTexture(crew.defKey),
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
export class ActiveMemberSlot extends Container implements Droppable {
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
        texture: getSlotTexture('empty'),
        layout: true,
        scale: 1.25,
      }),
    );

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

    const cleanupSignal = memberSignal.subscribe((member) => {
      if (!member || member.defKey === 'empty') {
        this.slot?.destroy();
        return;
      }

      if (member.key === this.slot?.data?.key) return;

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
        this.memberSignal.set(member);
        sprite.scale = 1.25;
      });
      sprite.layout = false;
      sprite.x = 0;
      sprite.y = 0;
      this.addChild(sprite);
      sprite.scale = 1.25;
    });

    this.on('destroyed', cleanupSignal);
  }

  updateBounds() {}

  *onHover() {
    while (this.i > 0) {
      const { isOver } = yield;
      if (isOver) break;
      this.tint = this.slot ? 0xdd0000 : 0x00ffff;
      (this.children[0] as Sprite).texture = getSlotTexture('hover');
      this.i--;
    }
    this.tint = 0xffffff;
    (this.children[0] as Sprite).texture = getSlotTexture('empty');
    this.i = LOOP_PROTECTION;
  }

  onDrop(_event: FederatedPointerEvent, item: Container) {
    if (item instanceof DraggableSprite && item.data) {
      const crewMember = item.data as CrewMemberInstance;
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
