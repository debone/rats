import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import type { EventEmitter } from '@/core/game/EventEmitter';
import { useCollisionHandler, useEmitter, usePhysics, useWorldId } from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { vfx } from '@/systems/vfx/vfx';
import { b2Body_GetTransform, type b2BodyId } from 'phaser-box2d';
import { brickBreak } from '../vfx/burst/brickBreak';
import { loadGodotGeometry, type Box2DGeometry } from '@/lib/loadGodotGeometry';
import { Assets } from 'pixi.js';
import { getGameContext } from '@/data/game-context';
import { LacfreeCrewMember } from '@/entities/crew/Lacfree';
import { getCrewTexture } from '@/screens/CrewPickerOverlay/actions';
import { TEXT_STYLE_DEFAULT } from '@/consts';
import type { LayoutContainer } from '@pixi/layout/components';
import { pickRandomCrewMemberSet } from '@/entities/crew/Crew';

export type ShopBrickEvents = {
  hit: void;
  broken: { x: number; y: number };
};

export interface ShopBrickEntity extends EntityBase {
  bodyId: b2BodyId;
  events: EventEmitter<ShopBrickEvents>;
  hit(): void;
}

export interface ShopBrickProps {
  spawnPos: { x: number; y: number };
}

export const ShopBrick = defineEntity(({ spawnPos }: ShopBrickProps) => {
  const physics = usePhysics();
  const worldId = useWorldId();
  const ctx = getGameContext();

  const events = useEmitter<ShopBrickEvents>();

  const geo = Assets.get<Box2DGeometry>('geometry/bricks/shop-brick.json');

  const { sprites, bodies } = loadGodotGeometry(geo, worldId, {
    transform: { x: spawnPos.x, y: spawnPos.y },
    container: ctx.container ?? undefined,
  });

  const bodyId = bodies[0];

  const avatarSprite = sprites.find((sprite) => sprite.label === 'avatar-sprite');
  const badgeSprite = sprites.find((sprite) => sprite.label === 'badge-sprite');

  const randomCrewMember = pickRandomCrewMemberSet(1);

  avatarSprite!.texture = getCrewTexture(randomCrewMember[0].type);

  // damn it works

  let boxRef!: LayoutContainer;

  <mount target={badgeSprite!}>
    <box ref={(ref) => (boxRef = ref)}>
      <text text={'20'} style={{ ...TEXT_STYLE_DEFAULT, fontSize: 16 }} />
    </box>
  </mount>;

  boxRef.layout = {
    marginLeft: -boxRef.width / 2,
    marginTop: -boxRef.height / 1.8,
  };

  useCollisionHandler(bodyId, () => ({
    tag: 'shop-brick',
    handlers: {
      ball: () => shopBrick.hit(),
    },
    entity: shopBrick,
  }));

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  const shopBrick = entity<ShopBrickEntity>({
    bodyId,
    events,

    hit() {
      events.emit('hit');

      if (Math.random() < 0.5) {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10, { volume: 0.25 });
      } else {
        sfx.playPitched(ASSETS.sounds_Rock_Impact_07, { volume: 0.25 });
      }

      const { x, y } = BodyToScreen(bodyId);
      // TODO: get the angle of the collision and make it the intensity
      vfx.play(brickBreak, { x, y, intensity: Math.random() });

      events.emit('broken', { x, y });

      this.destroy();
    },
  });

  return shopBrick;
});
