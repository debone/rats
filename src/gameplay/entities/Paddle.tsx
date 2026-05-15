import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import {
  useChildren,
  useCollisionHandler,
  useImmediateUpdate,
  usePhysics,
  useWorldId,
} from '@/hooks/hooks';
import { type Box2DGeometry, loadGodotGeometry } from '@/lib/loadGodotGeometry';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  b2Body_GetPosition,
  b2Body_GetTransform,
  b2Body_SetLinearVelocity,
  b2Body_SetTransform,
  b2BodyId,
  b2CreatePrismaticJoint,
  b2DefaultPrismaticJointDef,
  b2DestroyBody,
  b2DestroyJoint,
  b2Joint_GetBodyA,
  b2Joint_GetBodyB,
  b2Joint_GetLocalAnchorA,
  b2Joint_GetLocalAnchorB,
  b2JointId,
  b2PrismaticJoint_GetLowerLimit,
  b2PrismaticJoint_GetUpperLimit,
  b2Vec2,
} from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import { BrickDebrisParticles } from './particles/BrickDebrisParticles';
import { PlusCheeseParticles } from './particles/PlusCheeseParticles';
import { PlusClayParticles } from './particles/PlusClayParticles';

export interface PaddleEntity extends EntityBase {
  bodyId: b2BodyId;
  sprite: Sprite;
  maxSpeed: number;
}

export interface PaddleProps {
  jointId: b2JointId;
}

export const Paddle = defineEntity(({ jointId }: PaddleProps) => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const { withChildren } = useChildren();

  const { brickDebris, plusClay, plusCheese } = withChildren(() => ({
    brickDebris: BrickDebrisParticles(),
    plusClay: PlusClayParticles(),
    plusCheese: PlusCheeseParticles(),
  }));

  const ctx = getGameContext();
  const anchorBodyId = b2Joint_GetBodyA(jointId);
  const tempBodyId = b2Joint_GetBodyB(jointId);
  const pos = b2Body_GetPosition(tempBodyId);

  // Spawn the paddle body + 3 authored sprites from godot/geometry/paddle.tscn,
  // positioned at the temp body's pose. The polygon shape, density/friction,
  // category bits, sprite offsets, and `shouldRotate` flags on the shadow
  // sprites all come from the .tscn — no manual vertices or sprite setup here.
  const geo = Assets.get<Box2DGeometry>('geometry/paddle.json');
  const loaded = loadGodotGeometry(geo, worldId, {
    transform: { x: pos.x, y: pos.y },
    container: ctx.container ?? undefined,
  });
  const bodyId = loaded.bodies[0];
  // The boat sprite (the one that tracks body rotation) is the entity's
  // public sprite — used by paddleCaptainBoost for tint adjustments.
  const paddleSprite = loaded.sprites.find(
    (s) => (s as { shouldRotate?: boolean }).shouldRotate !== false,
  ) as Sprite;

  const prismaticJointDef2 = b2DefaultPrismaticJointDef();
  prismaticJointDef2.bodyIdA = anchorBodyId;
  prismaticJointDef2.bodyIdB = bodyId;
  prismaticJointDef2.collideConnected = false;
  prismaticJointDef2.localAnchorA = b2Joint_GetLocalAnchorA(jointId).clone();
  prismaticJointDef2.localAnchorB = b2Joint_GetLocalAnchorB(jointId).clone();
  prismaticJointDef2.enableLimit = true;
  prismaticJointDef2.lowerTranslation = b2PrismaticJoint_GetLowerLimit(jointId);
  prismaticJointDef2.upperTranslation = b2PrismaticJoint_GetUpperLimit(jointId);
  b2CreatePrismaticJoint(worldId, prismaticJointDef2);

  b2DestroyJoint(jointId);
  b2DestroyBody(tempBodyId);

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  let boatForce = 0;
  let boatVelocityAdjustment = 1;
  getRunState().stats.boatVelocityRatio.subscribe((velocity) => {
    boatVelocityAdjustment = velocity;
  });

  const paddle = entity<PaddleEntity>({
    bodyId,
    sprite: paddleSprite,
    maxSpeed: 15,
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'paddle',
    handlers: {
      ball: () => {
        sfx.playPitched(ASSETS.sounds_Hit_Jacket_Light_A, { volume: 0.25 });
      },
      scrap: () => {
        sfx.playPitched(ASSETS.sounds_Hit_Jacket_Light_A, { volume: 0.25 });
        const { x, y } = BodyToScreen(bodyId);
        brickDebris.emitter.explode(10, x, y + 4);
        plusClay.emitter.explode(1, x, y - 5);
      },
      cheese: () => {
        sfx.playPitched(ASSETS.sounds_Sell_Building_A, { volume: 0.25 });
        const { x, y } = BodyToScreen(bodyId);
        plusCheese.emitter.explode(1, x, y - 5);
      },
    },
    entity: paddle,
  }));

  /*
    let captainBoostHandle: { detach: () => void } | undefined;
    useGameEvent(GameEvent.POWERUP_CAPTAIN, () => {
      captainBoostHandle?.detach();
      captainBoostHandle = attachCaptainBoost(paddle);
    });*/

  useImmediateUpdate(() => {
    b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 0));
    const transform = b2Body_GetTransform(bodyId);
    transform.q.s = 0;
    b2Body_SetTransform(bodyId, transform.p, transform.q);

    if (InputDevice.keyboard.key.ArrowLeft) {
      boatForce = Math.max(boatForce - 0.1, -1);
    } else if (InputDevice.keyboard.key.ArrowRight) {
      boatForce = Math.min(boatForce + 0.1, 1);
    } else {
      if (boatForce > 0) {
        boatForce = Math.max(boatForce - 0.2, 0);
      } else {
        boatForce = Math.min(boatForce + 0.2, 0);
      }
    }

    if (InputDevice.gamepads[0] !== undefined) {
      boatForce = InputDevice.gamepads[0]?.leftJoystick.x ?? 0;
    }

    if (boatForce !== 0) {
      transform.q.s = boatForce * 0.25;
      b2Body_SetTransform(bodyId, transform.p, transform.q);
      b2Body_SetLinearVelocity(bodyId, new b2Vec2(boatForce * paddle.maxSpeed * boatVelocityAdjustment, 0));
    }

    if (InputDevice.keyboard.key.ArrowUp) {
      b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, 10));
    }

    if (InputDevice.keyboard.key.ArrowDown) {
      b2Body_SetLinearVelocity(bodyId, new b2Vec2(0, -10));
    }
  });

  return paddle;
});
