import { ASSETS } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { addBallToRun, changeBlueCheese, changeCheese, changeGreenCheese, getRunState } from '@/data/game-state';
import { CHEESE_DEFS, type CheeseType } from '@/entities/cheese/Cheese';
import { useBodySprite, useCollisionHandler, usePhysics, useWorldId } from '@/hooks/hooks';
import { PhysicsLayer, PICKUP_MASK, setBodyFilter } from '@/systems/physics/PhysicsLayers';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_SetLinearVelocity,
  b2Body_SetUserData,
  b2BodyType,
  b2Normalize,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

export interface CheeseEntity extends EntityBase {
  type: CheeseType;
  bodyId: b2BodyId;
  lose(): void;
}

export interface CheeseProps {
  pos: b2Vec2;
  type?: CheeseType;
  vel?: b2Vec2;

  onCollected?: (cheese: CheeseEntity) => void;
  onLost?: (cheese: CheeseEntity) => void;
}

export const Cheese = defineEntity(({ pos, vel, type = 'yellow', onCollected, onLost }: CheeseProps) => {
  const worldId = useWorldId();
  const physics = usePhysics();

  const { bodyId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(pos.x, pos.y),
    radius: 0.3,
    density: 1,
    friction: 0.5,
    restitution: 0,
  });

  setBodyFilter(bodyId, PhysicsLayer.CHEESE, PICKUP_MASK);

  const f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
  b2Normalize(f);
  b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);

  if (vel) {
    b2Body_SetLinearVelocity(bodyId, vel);
  }

  physics.enableGravity(bodyId);
  onCleanup(() => {
    physics.disableGravity(bodyId);
    physics.queueDestruction(bodyId);
  });

  b2Body_SetUserData(bodyId, { type: 'cheese', cheeseType: 'blue' });

  let micesive_cheeseGivesBalls = false;
  getRunState().crewBoons.micesive_cheeseGivesBalls.subscribe((value) => {
    micesive_cheeseGivesBalls = value;
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'cheese',
    handlers: {
      paddle: () => {
        if (micesive_cheeseGivesBalls) {
          addBallToRun(1);
        }

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

  const cheese = entity<CheeseEntity>({
    type,
    bodyId,
    lose() {
      onLost?.(this);
      this.destroy();
    },
  });

  return cheese;
});

export interface TypeCheeseProps {
  pos: b2Vec2;
  vel?: b2Vec2;
  onCollected?: (cheese: CheeseEntity) => void;
  onLost?: (cheese: CheeseEntity) => void;
}

export const BlueCheese = ({ pos, vel, onCollected, onLost }: TypeCheeseProps): CheeseEntity => {
  return Cheese({
    pos,
    vel,
    type: 'blue',
    onCollected: (cheese) => {
      changeBlueCheese(1);
      onCollected?.(cheese);
      /*
      execute(ShowOverlayCommand, { overlay: CrewPickerOverlay, waitForCompletion: true }).then(() => {
        onCollected?.(cheese);
      });
      */
    },
    onLost,
  });
};

export const YellowCheese = ({ pos, vel, onCollected, onLost }: TypeCheeseProps): CheeseEntity => {
  return Cheese({
    pos,
    vel,
    type: 'yellow',
    onCollected: (cheese) => {
      changeCheese(1);
      onCollected?.(cheese);
    },
    onLost,
  });
};

export const GreenCheese = ({ pos, vel, onCollected, onLost }: TypeCheeseProps): CheeseEntity => {
  return Cheese({
    pos,
    vel,
    type: 'green',
    onCollected: (cheese) => {
      changeGreenCheese(1);
      onCollected?.(cheese);
    },
    onLost,
  });
};
