import { ASSETS } from '@/assets';
import { sfx } from '@/core/audio/audio';
import { defineEntity, entity, onCleanup, type EntityBase } from '@/core/entity/scope';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import { useChildren, useCollisionHandler, useImmediateUpdate, usePhysics, useWorldId } from '@/hooks/hooks';
import { loadGodotGeometry, type Box2DGeometry } from '@/lib/loadGodotGeometry';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  b2Body_GetTransform,
  b2Body_SetLinearVelocity,
  b2Body_SetTransform,
  b2BodyId,
  b2CreatePrismaticJoint,
  b2DefaultPrismaticJointDef,
  b2Vec2,
} from 'phaser-box2d';
import { Assets, Sprite } from 'pixi.js';
import { InputDevice } from 'pixijs-input-devices';
import { BrickDebrisParticles } from './particles/BrickDebrisParticles';
import { PlusCheeseParticles } from './particles/PlusCheeseParticles';
import { PlusClayParticles } from './particles/PlusClayParticles';
import { GameEvent } from '@/data/events';

export interface PaddleEntity extends EntityBase {
  bodyId: b2BodyId;
  sprite: Sprite;
  maxSpeed: number;
}

/** Stable joint parameters extracted once from the level geometry joint. */
export interface PaddleJointConfig {
  anchorBodyId: b2BodyId;
  localAnchorA: b2Vec2;
  localAnchorB: b2Vec2;
  lowerLimit: number;
  upperLimit: number;
}

export const PaddleSizes = {
  small: 'geometry/paddles/paddle-small.json',
  normal: 'geometry/paddles/paddle.json',
  large: 'geometry/paddles/paddle-wider.json',
} as const;

export type PaddleSize = keyof typeof PaddleSizes;

export interface PaddleProps {
  jointConfig: PaddleJointConfig;
  spawnPos: b2Vec2;
  size: PaddleSize;
}

export const Paddle = defineEntity(({ jointConfig, spawnPos, size = 'normal' }: PaddleProps) => {
  const worldId = useWorldId();
  const physics = usePhysics();
  const { withChildren } = useChildren();

  const { brickDebris, plusClay, plusCheese } = withChildren(() => ({
    brickDebris: BrickDebrisParticles(),
    plusClay: PlusClayParticles(),
    plusCheese: PlusCheeseParticles(),
  }));

  const ctx = getGameContext();

  const paddleAsset = PaddleSizes[size];
  const geo = Assets.get<Box2DGeometry>(paddleAsset);
  const loaded = loadGodotGeometry(geo, worldId, {
    transform: { x: spawnPos.x, y: spawnPos.y },
    container: ctx.container ?? undefined,
  });
  const bodyId = loaded.bodies[0];
  const paddleSprite = loaded.sprites.find((s) => (s as { shouldRotate?: boolean }).shouldRotate !== false) as Sprite;

  const prismaticDef = b2DefaultPrismaticJointDef();
  prismaticDef.bodyIdA = jointConfig.anchorBodyId;
  prismaticDef.bodyIdB = bodyId;
  prismaticDef.collideConnected = false;
  prismaticDef.localAnchorA = jointConfig.localAnchorA.clone();
  prismaticDef.localAnchorB = jointConfig.localAnchorB.clone();
  prismaticDef.enableLimit = true;
  prismaticDef.lowerTranslation = jointConfig.lowerLimit;
  prismaticDef.upperTranslation = jointConfig.upperLimit;
  b2CreatePrismaticJoint(worldId, prismaticDef);

  onCleanup(() => {
    physics.queueDestruction(bodyId);
  });

  const paddle = entity<PaddleEntity>({
    bodyId,
    sprite: paddleSprite,
    maxSpeed: 15,
  });

  let doesBallStick = false;
  getRunState().crewBoons.pirat_ballsStickToBoat.subscribe((value) => {
    doesBallStick = value;
  });

  useCollisionHandler(bodyId, () => ({
    tag: 'paddle',
    handlers: {
      ball: () => {
        sfx.playPitched(ASSETS.sounds_Hit_Jacket_Light_A, { volume: 0.25 });
        if (doesBallStick) {
          getGameContext().events.emit(GameEvent.CREW_STICK_BALL_TO_PADDLE);
        }
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

  let boatForce = 0;
  let boatVelocityAdjustment = 1;
  getRunState().stats.boatVelocityRatio.subscribe((velocity) => {
    boatVelocityAdjustment = velocity;
  });

  useImmediateUpdate(() => {
    if (!paddle) return;

    b2Body_SetLinearVelocity(paddle.bodyId, new b2Vec2(0, 0));
    const transform = b2Body_GetTransform(paddle.bodyId);
    transform.q.s = 0;
    b2Body_SetTransform(paddle.bodyId, transform.p, transform.q);

    if (InputDevice.keyboard.key.ArrowLeft) {
      boatForce = Math.max(boatForce - 0.1, -1);
    } else if (InputDevice.keyboard.key.ArrowRight) {
      boatForce = Math.min(boatForce + 0.1, 1);
    } else {
      boatForce = boatForce > 0 ? Math.max(boatForce - 0.2, 0) : Math.min(boatForce + 0.2, 0);
    }

    if (InputDevice.gamepads[0] !== undefined) {
      boatForce = InputDevice.gamepads[0]?.leftJoystick.x ?? 0;
    }

    if (boatForce !== 0) {
      transform.q.s = boatForce * 0.25;
      b2Body_SetTransform(paddle.bodyId, transform.p, transform.q);
      b2Body_SetLinearVelocity(paddle.bodyId, new b2Vec2(boatForce * paddle.maxSpeed * boatVelocityAdjustment, 0));
    }
  });

  return paddle;
});
