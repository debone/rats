import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { assert } from '@/core/common/assert';
import { getEntitiesOfKind } from '@/core/entity/entity';
import { defineEntity, getUnmount, type AttachHandle } from '@/core/entity/scope';
import { execute } from '@/core/game/Command';
import { TiledResource } from '@/core/tiled';
import type { TiledMapDefinition } from '@/core/tiled/tiled-resource';
import { GameEvent } from '@/data/events';
import { getGameContext } from '@/data/game-context';
import { activateCrewAbility, setLevelState } from '@/data/game-state';
import type { BrickPowerUps } from '@/entities/bricks/Brick';
import { ENTITY_KINDS, type EntityBase } from '@/entities/entity-kinds';
import { loadSceneIntoWorld } from '@/lib/loadrube';
import { PhysicsSystem } from '@/systems/physics/system';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import { b2Body_GetPosition, b2Body_GetUserData, b2Body_IsValid, type b2BodyId, type b2JointId } from 'phaser-box2d';
import { Assets } from 'pixi.js';

import { attachPaddleBallSnap } from './attachments/paddleBallSnap';
import { Levels_LevelStartCommand } from './commands/LevelStartCommand';
import { BrickDebrisParticles } from './entities/BrickDebrisParticles';
import { KeyListener } from './entities/KeyListener';
import { NormBall } from './entities/NormBall';
import { Paddle } from './entities/Paddle';
import { PlusCheeseParticles } from './entities/PlusCheeseParticles';
import { PlusClayParticles } from './entities/PlusClayParticles';
import { Wall, wallSparkOnBall } from './entities/Wall';
import { WallParticles } from './entities/WallParticles';
import { WaterParticles } from './entities/WaterParticles';

export interface LevelParticles {
  brickDebris: ReturnType<typeof BrickDebrisParticles>['emitter'];
  water: ReturnType<typeof WaterParticles>['emitter'];
  wall: ReturnType<typeof WallParticles>['emitter'];
  plusCheese: ReturnType<typeof PlusCheeseParticles>['emitter'];
  plusClay: ReturnType<typeof PlusClayParticles>['emitter'];
}

export interface BodyHandlerContext {
  bodyId: b2BodyId;
  tag: string | undefined;
  userData: { type: string; powerup?: BrickPowerUps; doorName?: string } | null;
  particles: LevelParticles;
}

export interface BackgroundConfig {
  tiledMap: TiledMapDefinition;
  includeBroadBg?: boolean;
}

export interface BreakoutLevelProps {
  levelId: string;
  name: string;
  rubeAsset: string;
  background: BackgroundConfig;
  onLoad?: (ctx: { particles: LevelParticles }) => void;
  onBodyLoad: (ctx: BodyHandlerContext) => boolean | void;
}

export interface BreakoutLevelEntity extends EntityBase<typeof ENTITY_KINDS.breakoutLevel> {
  readonly children: Set<EntityBase>;
  load(): Promise<void>;
  update(delta: number): void;
  createBall(): void;
}

export const BreakoutLevel = defineEntity((props: BreakoutLevelProps): BreakoutLevelEntity => {
  const unmount = getUnmount();
  const children = new Set<EntityBase>();

  let ballSnap: AttachHandle<{ launch: () => void; jointId: b2JointId }> | undefined;

  function createBall(): void {
    const paddle = getEntitiesOfKind(ENTITY_KINDS.paddle)[0];
    assert(paddle, `${props.levelId} createBall: no paddle entity`);
    const paddlePosition = b2Body_GetPosition(paddle.bodyId);
    const normBall = NormBall({ x: paddlePosition.x, y: paddlePosition.y + 1 });
    ballSnap?.detach();
    ballSnap = attachPaddleBallSnap(paddle, normBall);
  }

  async function load(): Promise<void> {
    console.log(`[BreakoutLevel] Loading ${props.levelId}...`);
    const ctx = getGameContext();
    setLevelState({ id: props.levelId, name: props.name });

    const { loadedBodies, loadedJoints } = loadSceneIntoWorld(
      Assets.get(props.rubeAsset),
      ctx.worldId!,
    );

    loadBackground(props.background, ctx);

    const particles: LevelParticles = {
      brickDebris: BrickDebrisParticles().emitter,
      water: WaterParticles().emitter,
      wall: WallParticles().emitter,
      plusCheese: PlusCheeseParticles().emitter,
      plusClay: PlusClayParticles().emitter,
    };

    KeyListener({ key: 'KeyQ', onPress: () => activateCrewAbility(0) });
    KeyListener({ key: 'KeyW', onPress: () => activateCrewAbility(1) });

    const paddleJoint = loadedJoints.find((joint) => (joint as any).name === 'paddle-joint');
    assert(paddleJoint, `${props.levelId}: paddle-joint not found in RUBE`);

    Paddle({
      jointId: paddleJoint,
      brickDebrisEmitter: particles.brickDebris,
      plusClayEmitter: particles.plusClay,
      plusCheeseEmitter: particles.plusCheese,
    });

    props.onLoad?.({ particles });

    createBall();

    loadedBodies.forEach((bodyId) => {
      if (!b2Body_IsValid(bodyId)) return;

      const userData = b2Body_GetUserData(bodyId) as {
        type: string;
        powerup?: BrickPowerUps;
        doorName?: string;
      } | null;
      const tag = userData?.type;

      if (tag === 'left-wall' || tag === 'right-wall' || tag === 'top-wall') {
        Wall({ bodyId, wallCollisionTag: tag, onBall: wallSparkOnBall(tag, particles.wall) });
      } else if (tag === 'exit') {
        Wall({
          bodyId,
          wallCollisionTag: 'exit',
          onBall: async () => {
            ctx.events.emit(GameEvent.BALL_EXITED);
          },
        });
      } else if (tag === 'bottom-wall') {
        Wall({
          bodyId,
          wallCollisionTag: 'bottom-wall',
          onCheese: async ({ cheeseBody }) => {
            const { x, y } = BodyToScreen(cheeseBody.bodyId);
            particles.water.explode(25, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            cheeseBody.destroy();
          },
          onBall: async ({ ballBody }) => {
            const { x, y } = BodyToScreen(ballBody.bodyId);
            particles.water.explode(100, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Large_4_2, { volume: 0.25 });
            ballBody.destroy();

            if (getEntitiesOfKind(ENTITY_KINDS.normBall).length === 0) {
              ctx.events.emit(GameEvent.BALL_LOST);
            }
          },
          onScrap: async ({ scrapBody }) => {
            const { x, y } = BodyToScreen(scrapBody.bodyId);
            particles.water.explode(10, x, y);
            sfx.playPitched(ASSETS.sounds_Splash_Small_3_2, { volume: 0.25 });
            scrapBody.destroy();
          },
        });
      } else {
        const handled = props.onBodyLoad({
          bodyId,
          tag,
          userData,
          particles,
        });
        if (!handled) {
          ctx.systems.get(PhysicsSystem).registerOrphanBody(bodyId);
        }
      }
    });

    await execute(Levels_LevelStartCommand);
    console.log(`[BreakoutLevel] ${props.levelId} loaded`);
  }

  return {
    kind: ENTITY_KINDS.breakoutLevel,
    children,
    load,
    update(_delta) {},
    createBall,
    destroy() {
      Array.from(children).forEach((e) => e.destroy());
      unmount();
    },
  };
});

function loadBackground(
  config: BackgroundConfig,
  ctx: ReturnType<typeof getGameContext>,
): void {
  const bg = typedAssets.get<PrototypeTextures>(ASSETS.levels_level_1).textures;

  const tilesetTextures: Record<
    string,
    { textures: typeof bg; tileIdToFrame: (id: number) => string }
  > = {
    level_1_tileset: {
      textures: bg,
      tileIdToFrame: (id) => `level-1_spritesheet_${id}#0`,
    },
  };

  if (config.includeBroadBg) {
    tilesetTextures.broad_bg = {
      textures: bg,
      tileIdToFrame: (id) => `broad_bg_${id}#0`,
    };
  }

  const map = new TiledResource({ map: config.tiledMap, tilesetTextures });
  map.load();

  const origin = map.getLayer('meta')?.getObjectsByName('origin')[0];
  if (origin) {
    map.container.x = -origin.x;
    map.container.y = -origin.y;
  }
  map.container.zIndex = -1;
  ctx.container!.addChild(map.container);
}
