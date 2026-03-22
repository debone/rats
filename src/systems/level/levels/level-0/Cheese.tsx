import { ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { ENTITY_KINDS, type EntityBase } from '@/core/entity/entity-kinds';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { changeCheese } from '@/data/game-state';
import { CHEESE_DEFS, type CheeseType } from '@/entities/cheese/Cheese';
import { useBodySprite, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import { CrewPickerOverlay } from '@/screens/CrewPickerOverlay/CrewPickerOverlay';
import { ShowOverlayCommand } from '@/systems/navigation/commands/ShowOverlayCommand';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_SetUserData,
  b2BodyType,
  b2Normalize,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CheeseEntity extends EntityBase<typeof ENTITY_KINDS.cheese> {
  bodyId: b2BodyId;
  type: CheeseType;
  destroy(): void;
}

export interface CheeseProps {
  pos: { x: number; y: number };
  type: CheeseType;

  onCollected?: (cheese: CheeseEntity) => void;
  onLost?: (cheese: CheeseEntity) => void;
}

export const Cheese = defineEntity(({ pos, type, onCollected, onLost }: CheeseProps): CheeseEntity => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const unmount = getUnmount();

  const { bodyId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(pos.x, pos.y),
    radius: 0.3,
    density: 1,
    friction: 0.5,
    restitution: 0,
  });

  const f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
  b2Normalize(f);
  b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);
  physics.enableGravity(bodyId);
  onCleanup(() => {
    physics.disableGravity(bodyId);
    physics.queueDestruction(bodyId);
  });

  b2Body_SetUserData(bodyId, { type: 'cheese', cheeseType: 'blue' });

  useCollisionHandler(bodyId, () => ({
    tag: 'cheese',
    handlers: {
      paddle: () => {
        onCollected?.(cheese);
        cheese.destroy();
      },
      'bottom-wall': () => {
        onLost?.(cheese);
        cheese.destroy();
      },
    },
    entity: cheese,
  }));

  const texture = typedAssets.get(ASSETS.prototype).textures[CHEESE_DEFS[type].texture];
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);

  useBodySprite(sprite, bodyId);

  const cheese: CheeseEntity = {
    kind: ENTITY_KINDS.cheese,
    bodyId,
    type,

    destroy() {
      unmount();
    },
  };

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
