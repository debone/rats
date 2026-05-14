import { ASSETS } from '@/assets';
import { assert } from '@/core/common/assert';
import { attach, defineEntity } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { type Box2DGeometry, loadGodotGeometry } from '@/lib/loadGodotGeometry';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { PhysicsSystem } from '@/systems/physics/system';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, type b2BodyId, type b2JointId } from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { Brick } from './Brick';
import { BlueCheese, GreenCheese, YellowCheese } from './Cheese';
import { Door } from './Door';
import { Scrap } from './Scrap';
import { StrongBrick } from './StrongBrick';
import { Wall, wallSparkOnBall } from './Wall';
import { WaterBottom } from './WaterBottom';
import { CatPiece } from './cats/CatBody';
import { CatTail } from './cats/CatTail';
import { BrickDebrisParticles } from './particles/BrickDebrisParticles';
import { WallParticles } from './particles/WallParticles';
import { WaterParticles } from './particles/WaterParticles';

const empty_tags = ['paddle-joint-temp', 'paddle-joint-holder', 'cat-joint-holder'];

export interface BodyUserData {
  type: string;
  powerup?: BrickPowerUps;
  doorName?: string;
  behaviour?: string;
}

export interface BodyEntry {
  bodyId: b2BodyId;
  tag: string | undefined;
  userData: BodyUserData | null;
}

export interface BreakoutPhysicsProps {
  levelId: string;
  rubeAsset?: string;
  /** Pixi alias for a Godot-authored geometry JSON, e.g. 'geometry/level-1.json'. */
  geometryAsset?: string;
}

export const BreakoutPhysics = defineEntity(({ levelId, rubeAsset, geometryAsset }: BreakoutPhysicsProps) => {
  const { withChildren } = useChildren();
  const ctx = getGameContext();

  let loadedBodies: b2BodyId[];
  let loadedJoints: b2JointId[];
  if (geometryAsset) {
    const geo = Assets.get<Box2DGeometry>(geometryAsset);
    const result = loadGodotGeometry(geo, ctx.worldId!, { container: ctx.container ?? undefined });
    loadedBodies = result.bodies;
    loadedJoints = result.joints;
  } else if (rubeAsset) {
    const rube = Assets.get(rubeAsset);
    const loaded = loadSceneIntoWorld(rube, ctx.worldId!);
    loadedBodies = loaded.loadedBodies;
    loadedJoints = loaded.loadedJoints;
  } else {
    throw new Error(`${levelId}: BreakoutPhysics requires either rubeAsset or geometryAsset`);
  }

  const particles = withChildren(() => ({
    brickDebris: BrickDebrisParticles(),
    wall: WallParticles(),
    water: WaterParticles(),
  }));

  const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
  assert(paddleJoint, `${levelId}: paddle-joint not found in RUBE`);

  const nonStandardBodies: BodyEntry[] = [];

  withChildren(() => {
    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;

      const userData = b2Body_GetUserData(bodyId) as BodyUserData | null;
      const tag = userData?.type;

      if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({ bodyId, wallCollisionTag: tag, onBall: wallSparkOnBall(tag, particles.wall.emitter) });
      } else if (tag === 'exit') {
        Wall({
          bodyId,
          wallCollisionTag: 'exit',
          onBall: () => {
            ctx.events.emit(GameEvent.BALL_EXITED);
          },
        });
      } else if (tag === 'bottom-wall') {
        const waterBottom = WaterBottom({
          bodyId,
          waterParticles: particles.water.emitter,
        });

        attach(waterBottom, (b) => {
          useSubscribe(b.events, 'cheeseCollided', ({ object }) => {
            object.destroy();
          });
          useSubscribe(b.events, 'ballCollided', ({ object }) => {
            object.destroy();
            ctx.events.emit(GameEvent.BALL_LOST);
          });
          useSubscribe(b.events, 'scrapCollided', ({ object }) => {
            object.destroy();
          });
        });
      } else if (tag === 'door') {
        const pos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        Door({
          spawnPos: { x: pos.x, y: pos.y },
          length: 4,
          name: userData?.doorName,
          sound: ASSETS.sounds_Chest_Open_Creak_3_1,
        });
      } else if (tag === 'brick') {
        const powerUp = userData?.powerup as BrickPowerUps | undefined;
        const behavior = userData?.behaviour as string | undefined;

        const brick = Brick({
          bodyId,
          powerUp,
          debrisEmitter: particles.brickDebris.emitter,
        });

        if (!behavior) {
          attach(brick, (b) => {
            useSubscribe(b.events, 'broken', ({ x, y, powerUp }) => {
              if (powerUp === 'blue') {
                BlueCheese({ pos: { x, y } });
              } else if (powerUp === 'green') {
                GreenCheese({ pos: { x, y } });
              } else if (powerUp === 'yellow') {
                YellowCheese({ pos: { x, y } });
              } else {
                const r = Math.random();
                if (r < 0.2) {
                  YellowCheese({ pos: { x, y } });
                } else if (r < 0.5) {
                  Scrap({ pos: { x: x - 0.25, y } });
                  Scrap({ pos: { x: x + 0.25, y } });
                } else {
                  Scrap({ pos: { x, y } });
                }
              }
            });
          });
        }
      } else if (tag === 'strong-brick') {
        const behavior = userData?.behaviour as string | undefined;

        const strongBrick = StrongBrick({
          bodyId,
          debrisEmitter: particles.brickDebris.emitter,
        });

        if (!behavior) {
          attach(strongBrick, (b) => {
            useSubscribe(b.events, 'broken', ({ x, y }) => {
              const r = Math.random();
              if (r < 0.35) {
                YellowCheese({ pos: { x, y } });
              } else if (r < 0.7) {
                Scrap({ pos: { x: x - 0.25, y } });
                Scrap({ pos: { x: x + 0.25, y } });
              }
            });
          });
        }
      } else if (tag === 'cat-body') {
        CatPiece({ bodyId, texture: 'cat-body#0' });
      } else if (tag === 'cat-piece') {
        CatTail({ bodyId, texture: 'cat-tail#0' });
      } else if (tag && empty_tags.includes(tag)) {
        // Ignore empty tags
      } else {
        throw new Error(`Unknown body tag: ${tag}`);
        nonStandardBodies.push({ bodyId, tag, userData });
      }
    });
  });

  return {
    /** Joint from the RUBE scene — pass to `BreakoutPaddle` to create the paddle. */
    paddleJoint: paddleJoint as b2JointId,
    bodies: nonStandardBodies,
    particles,
  };
});
