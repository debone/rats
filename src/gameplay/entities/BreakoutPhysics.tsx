import { ASSETS } from '@/assets';
import type { GeometryBodyUserData } from '@/assets/geometry';
import { MIN_HEIGHT, MIN_WIDTH } from '@/consts';
import { assert } from '@/core/common/assert';
import { attach, defineEntity } from '@/core/entity/scope';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { getRunState } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { useChildren, useSubscribe } from '@/hooks/hooks';
import { loadGodotGeometry, type Box2DGeometry } from '@/lib/loadGodotGeometry';
import { PhysicsSystem } from '@/systems/physics/system';
import {
  b2Body_GetPosition,
  b2Body_GetUserData,
  b2Body_IsValid,
  b2Vec2,
  type b2BodyId,
  type b2JointId,
} from 'phaser-box2d';
import { Assets } from 'pixi.js';
import { Brick } from './Brick';
import { BlueCheese, GreenCheese, YellowCheese } from './Cheese';
import { Door } from './Door';
import { Scrap } from './Scrap';
import { StrongBrick } from './StrongBrick';
import { Wall, wallSparkOnBall } from './Wall';
import { WaterBottom, type WaterBottomEntity } from './WaterBottom';
import { CatPiece } from './cats/CatBody';
import { CatTail } from './cats/CatTail';
import { BrickDebrisParticles } from './particles/BrickDebrisParticles';
import { WallParticles } from './particles/WallParticles';
import { WaterParticles } from './particles/WaterParticles';
import { ShopBrick } from './ShopBrick';

const empty_tags = ['paddle-joint-temp', 'paddle-joint-holder', 'cat-joint-holder'];

/**
 * Body userData shape, sourced from the geometry typegen so adding a new
 * `userData.type` in Godot widens this union — exhaustive switches in this
 * file will then refuse to type-check until the new type is handled.
 */
export type BodyUserData = GeometryBodyUserData;

export interface BodyEntry {
  bodyId: b2BodyId;
  tag: string | undefined;
  userData: BodyUserData | null;
}

export interface BreakoutPhysicsProps {
  levelId: string;
  /** Pixi alias for a Godot-authored geometry JSON, e.g. 'geometry/level-1.json'. */
  geometryAsset: string;
}

export const BreakoutPhysics = defineEntity(({ levelId, geometryAsset }: BreakoutPhysicsProps) => {
  const { withChildren } = useChildren();
  const ctx = getGameContext();

  const geo = Assets.get<Box2DGeometry>(geometryAsset);
  const {
    bodies: loadedBodies,
    joints: loadedJoints,
    visuals,
  } = loadGodotGeometry(geo, ctx.worldId!, {
    container: ctx.container ?? undefined,
    sprites: true,
  });

  // Static visual elements are authored in raw Godot pixel coords, but body
  // sprites render at WorldOrigin (MIN_WIDTH/2, MIN_HEIGHT/2) + godotPos — the
  // export's ÷PXM + Y-flip and WorldToScreen's ×PXM + Y-flip cancel out. So every
  // static visual needs the same origin offset to line up with the bodies.
  for (const visual of [
    ...visuals.tileLayers,
    ...visuals.meshes,
    ...visuals.sprites,
    ...visuals.ninePatches,
  ]) {
    visual.x += MIN_WIDTH / 2;
    visual.y += MIN_HEIGHT / 2;
    visual.zIndex = -1;
  }

  const particles = withChildren(() => ({
    brickDebris: BrickDebrisParticles(),
    wall: WallParticles(),
    water: WaterParticles(),
  }));

  const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
  assert(paddleJoint, `${levelId}: paddle-joint not found in geometry`);

  const nonStandardBodies: BodyEntry[] = [];

  let micesive_nextBricksHaveMoreRubbles = 0;
  getRunState().crewBoons.micesive_nextBricksHaveMoreRubbles.subscribe((value) => {
    micesive_nextBricksHaveMoreRubbles = value;
  });

  let bricksGiveMoreCheese = false;
  getRunState().crewBoons.ratfather_bricksGiveMoreCheese.subscribe((value) => {
    bricksGiveMoreCheese = value;
  });

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

        attach(waterBottom as WaterBottomEntity, (b: WaterBottomEntity) => {
          useSubscribe(b.events, 'cheeseCollided', ({ object }) => {
            object.lose();
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
        });

        if (!behavior) {
          attach(brick, (b) => {
            useSubscribe(b.events, 'broken', ({ x, y, powerUp }) => {
              console.log('broken', b);
              const nextCheeseIsBlue = getRunState().crewBoons.mrblu_nextCheeseIsBlue.get();
              const doubleCheese = getRunState().crewBoons.twoears_doubleCheese.get();

              if (nextCheeseIsBlue && powerUp !== undefined) {
                getRunState().crewBoons.mrblu_nextCheeseIsBlue.set(false);
                powerUp = 'blue';
              }

              if (powerUp === 'blue') {
                BlueCheese({ pos: new b2Vec2(x, y) });
                if (doubleCheese) {
                  BlueCheese({ pos: new b2Vec2(x, y) });
                }
              } else if (powerUp === 'green') {
                GreenCheese({ pos: new b2Vec2(x, y) });
                if (doubleCheese) {
                  GreenCheese({ pos: new b2Vec2(x, y) });
                }
              } else if (powerUp === 'yellow') {
                YellowCheese({ pos: new b2Vec2(x, y) });
                if (doubleCheese) {
                  YellowCheese({ pos: new b2Vec2(x, y) });
                }
              } else {
                if (micesive_nextBricksHaveMoreRubbles > 0) {
                  micesive_nextBricksHaveMoreRubbles--;
                  for (let i = 0; i < 5; i++) {
                    Scrap({ pos: new b2Vec2(x, y) });
                  }
                } else {
                  let r = Math.random();

                  if (bricksGiveMoreCheese) {
                    r -= 0.1;
                  }

                  if (r < 0.2) {
                    if (nextCheeseIsBlue) {
                      getRunState().crewBoons.mrblu_nextCheeseIsBlue.set(false);
                      BlueCheese({ pos: new b2Vec2(x, y) });
                      if (doubleCheese) {
                        BlueCheese({ pos: new b2Vec2(x, y) });
                      }
                    } else {
                      YellowCheese({ pos: new b2Vec2(x, y) });
                      if (doubleCheese) {
                        YellowCheese({ pos: new b2Vec2(x, y) });
                      }
                    }
                  } else if (r < 0.5) {
                    Scrap({ pos: { x: x - 0.25, y } });
                    Scrap({ pos: { x: x + 0.25, y } });
                  } else {
                    Scrap({ pos: { x, y } });
                  }
                }
              }
            });
          });
        }
      } else if (tag === 'strong-brick') {
        const behavior = (userData as { behaviour?: string } | null)?.behaviour;

        const strongBrick = StrongBrick({
          bodyId,
          debrisEmitter: particles.brickDebris.emitter,
        });

        if (!behavior) {
          attach(strongBrick, (b) => {
            useSubscribe(b.events, 'broken', ({ x, y }) => {
              if (micesive_nextBricksHaveMoreRubbles > 0) {
                micesive_nextBricksHaveMoreRubbles--;
                for (let i = 0; i < 5; i++) {
                  Scrap({ pos: new b2Vec2(x, y) });
                }
              } else {
                let r = Math.random();

                if (bricksGiveMoreCheese) {
                  r -= 0.1;
                }

                if (r < 0.35) {
                  const nextCheeseIsBlue = getRunState().crewBoons.mrblu_nextCheeseIsBlue.get();
                  const doubleCheese = getRunState().crewBoons.twoears_doubleCheese.get();

                  if (nextCheeseIsBlue) {
                    getRunState().crewBoons.mrblu_nextCheeseIsBlue.set(false);
                    BlueCheese({ pos: new b2Vec2(x, y) });
                    if (doubleCheese) {
                      BlueCheese({ pos: new b2Vec2(x, y) });
                    }
                  } else {
                    YellowCheese({ pos: new b2Vec2(x, y) });
                    if (doubleCheese) {
                      YellowCheese({ pos: new b2Vec2(x, y) });
                    }
                  }
                } else {
                  Scrap({ pos: { x: x - 0.25, y } });
                  Scrap({ pos: { x: x + 0.25, y } });
                }
              }
            });
          });
        }
      } else if (tag === 'shop-brick') {
        const spawnPos = b2Body_GetPosition(bodyId);
        ctx.systems.get(PhysicsSystem).queueDestruction(bodyId);
        ShopBrick({ spawnPos });
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
    /** Paddle prismatic joint — pass to `BreakoutPaddle` to create the paddle. */
    paddleJoint: paddleJoint as b2JointId,
    bodies: nonStandardBodies,
    particles,
  };
});
