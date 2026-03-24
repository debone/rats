import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { defineEntity, getUnmount, onCleanup } from '@/core/entity/scope';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { GameEvent } from '@/data/events';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import {
  useBodySprite,
  useCollisionHandler,
  useGameEvent,
  useImmediateUpdate,
  usePhysics,
  useWorldId,
} from '@/hooks/hooks';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  b2Body_GetPosition,
  b2Body_GetTransform,
  b2Body_SetLinearVelocity,
  b2Body_SetTransform,
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
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
  CreatePolygon,
} from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import { attachCaptainBoost } from '../attachments/paddleCaptainBoost';

export interface PaddleEntity extends EntityBase<typeof ENTITY_KINDS.paddle> {
  bodyId: b2BodyId;
  sprite: Sprite;
  maxSpeed: number;
  destroy(): void;
}

export interface PaddleProps {
  jointId: b2JointId;
  brickDebrisEmitter: ParticleEmitter;
}

export const Paddle = defineEntity(({ jointId, brickDebrisEmitter }: PaddleProps): PaddleEntity => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const unmount = getUnmount();

  const anchorBodyId = b2Joint_GetBodyA(jointId);
  const tempBodyId = b2Joint_GetBodyB(jointId);
  const pos = b2Body_GetPosition(tempBodyId);

  const paddleVertices = [
    new b2Vec2(2, -0.25),
    new b2Vec2(1.8, 0.2),
    new b2Vec2(0.5, 0.5),
    new b2Vec2(-0.5, 0.5),
    new b2Vec2(-1.8, 0.2),
    new b2Vec2(-2, -0.25),
  ];

  const { bodyId } = CreatePolygon({
    position: new b2Vec2(pos.x, pos.y),
    type: b2BodyType.b2_dynamicBody,
    vertices: paddleVertices,
    density: 10,
    friction: 0.5,
    worldId,
  });
  b2Body_SetUserData(bodyId, { type: 'paddle' });

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

  const paddleSprite = new Sprite(Assets.get(ASSETS.entities_rats).textures['rat-boat#0']);
  paddleSprite.anchor.set(0.5, 0);
  useBodySprite(paddleSprite, bodyId, { offsetY: -34 });

  let boatForce = 0;

  const paddle: PaddleEntity = {
    kind: ENTITY_KINDS.paddle,
    bodyId,
    sprite: paddleSprite,
    maxSpeed: 15,
    destroy() {
      unmount();
    },
  };

  useCollisionHandler(bodyId, () => ({
    tag: 'paddle',
    handlers: {
      ball: () => {
        sfx.playPitched(ASSETS.sounds_Hit_Jacket_Light_A);
      },
      scrap: () => {
        sfx.playPitched(ASSETS.sounds_Hit_Jacket_Light_A);
        const { x, y } = BodyToScreen(bodyId);
        brickDebrisEmitter!.explode(10, x, y + 4);
      },
    },
    entity: paddle,
  }));

  let captainBoostHandle: { detach: () => void } | undefined;
  useGameEvent(GameEvent.POWERUP_CAPTAIN, () => {
    captainBoostHandle?.detach();
    captainBoostHandle = attachCaptainBoost(paddle);
  });

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
      b2Body_SetLinearVelocity(bodyId, new b2Vec2(boatForce * paddle.maxSpeed, 0));
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
