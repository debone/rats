import { ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { changeCheese } from '@/data/game-state';
import { CHEESE_DEFS, type CheeseType } from '@/entities/cheese/Cheese';
import type { EntityBase } from '@/entities/entity-kinds';
import { useBodySprite, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import { CrewPickerOverlay } from '@/screens/CrewPickerOverlay/CrewPickerOverlay';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_SetUserData,
  b2BodyType,
  b2Normalize,
  b2Shape_GetFilter,
  b2Shape_SetFilter,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CheeseEntity extends EntityBase {
  bodyId: b2BodyId;
  type: CheeseType;
}

export interface CheeseProps {
  pos: { x: number; y: number };
  type: CheeseType;

  onCollected?: (cheese: CheeseEntity) => void;
  onLost?: (cheese: CheeseEntity) => void;
}

export const Cheese = defineEntity(({ pos, type, onCollected, onLost }: CheeseProps) => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const destroy = getUnmount();

  const { bodyId, shapeId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(pos.x, pos.y),
    radius: 0.3,
    density: 1,
    friction: 0.5,
    restitution: 0,
  });

  const cheeseFilter = b2Shape_GetFilter(shapeId);
  cheeseFilter.maskBits = 0x0005;
  cheeseFilter.categoryBits = 0xfffc;
  b2Shape_SetFilter(shapeId, cheeseFilter);

  const f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
  b2Normalize(f);
  b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);
  physics.enableGravity(bodyId);
  onCleanup(() => {
    physics.disableGravity(bodyId);
    physics.queueDestruction(bodyId);
  });

  b2Body_SetUserData(bodyId, { type: 'cheese', cheeseType: 'blue' });

  const cheese = {
    bodyId,
    type,
  };

  useCollisionHandler(bodyId, () => ({
    tag: 'cheese',
    handlers: {
      paddle: () => {
        onCollected?.(cheese as CheeseEntity);
        destroy();
      },
      'bottom-wall': () => {
        onLost?.(cheese as CheeseEntity);
        destroy();
      },
    },
    entity: cheese,
  }));

  const texture = typedAssets.get(ASSETS.prototype).textures[CHEESE_DEFS[type].texture];
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);

  useBodySprite(sprite, bodyId);

  return cheese;
});

export interface TypeCheeseProps {
  pos: { x: number; y: number };
  onCollected?: (cheese: CheeseEntity) => void;
  onLost?: (cheese: CheeseEntity) => void;
}

export const BlueCheese = ({ pos, onCollected, onLost }: TypeCheeseProps): CheeseEntity => {
  return Cheese({
    pos,
    type: 'blue',
    onCollected: (cheese) => {
      changeCheese(1);
      execute(ShowOverlayCommand, { overlay: CrewPickerOverlay, waitForCompletion: true }).then(() => {
        onCollected?.(cheese);
      });
    },
    onLost,
  });
};

export const YellowCheese = ({ pos, onCollected, onLost }: TypeCheeseProps): CheeseEntity => {
  return Cheese({
    pos,
    type: 'yellow',
    onCollected: (cheese) => {
      changeCheese(1);
      onCollected?.(cheese);
    },
    onLost,
  });
};

export const GreenCheese = ({ pos, onCollected, onLost }: TypeCheeseProps): CheeseEntity => {
  return Cheese({
    pos,
    type: 'green',
    onCollected,
    onLost,
  });
};
