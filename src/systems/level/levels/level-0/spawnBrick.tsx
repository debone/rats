import { ASSETS, type PrototypeTextures } from '@/assets';
import { typedAssets } from '@/core/assets/typed-assets';
import { sfx } from '@/core/audio/audio';
import { shake } from '@/core/camera/effects/shake';
import type { ParticleEmitter } from '@/core/particles/ParticleEmitter';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import { BRICK_POWER_UP_DEFS, type BrickPowerUps } from '@/entities/bricks/Brick';
import { CHEESE_DEFS } from '@/entities/cheese/Cheese';
import type { LevelSystems } from '@/systems/level/Level';
import { BodyToScreen } from '@/systems/physics/WorldSprites';
import {
  b2Body_ApplyLinearImpulseToCenter,
  b2Body_GetPosition,
  b2Body_SetUserData,
  b2BodyType,
  b2Normalize,
  b2Vec2,
  CreateCircle,
  type b2BodyId,
} from 'phaser-box2d';
import { Sprite } from 'pixi.js';

// ---- Entity types ----

export interface BrddddickEntity {
  bodyId: b2BodyId;
  powerUp: BrickPowerUps | undefined;
  spawnPos: { x: number; y: number };
  destroyed: boolean;
  hit(): void;
  //restore(): void;
  destroy(): void;
}

export interface BluedddddddddCheeseEntity {
  bodyId: b2BodyId;
  destroyed: boolean;
  destroy(): void;
}

// ---- mountEffect — useEffect without React ----

function createModddddduntScope() {
  const cleanups: Array<() => void> = [];

  function mountEffect(effect: () => (() => void) | void) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }

  function unmount() {
    cleanups.forEach((c) => c());
    cleanups.length = 0;
  }

  return { mountEffect, unmount };
}

// ---- Default behaviors ----

const defaultOnddddddHit = (_brick: BrickEntity, ctx: GameContext) => {
  if (Math.random() < 0.5) {
    sfx.playPitched(ASSETS.sounds_Rock_Impact_Small_10);
  } else {
    sfx.playPitched(ASSETS.sounds_Rock_Impact_07);
  }
  shake(ctx.camera!, { intensity: Math.random() * 1, duration: 300 });
};

// ---- Components ----

interface BrickPrdddddops {
  systems: LevelSystems;
  bodyId: b2BodyId;
  debrisEmitter: ParticleEmitter;
  powerUp?: BrickPowerUps;
  onHit?: (brick: BrickEntity, ctx: GameContext) => void;
  onBreak?: (brick: BrickEntity) => void;
}

export const Brddddick = ({
  systems,
  bodyId: initialBodyId,
  debrisEmitter,
  powerUp,
  onHit = defaultOnHit,
  onBreak,
}: BrickProps): { brick: BrickEntity; cleanup: () => void } => {
  const worldId = systems.context.worldId!;
  const bg = typedAssets.get<PrototypeTextures>(ASSETS.prototype).textures;

  const pos = b2Body_GetPosition(initialBodyId);
  const spawnPos = { x: pos.x, y: pos.y };

  // why would each brick keep this?
  let { mountEffect, unmount } = createMountScope();

  const sprite = new Sprite(bg[`bricks_tile_1#0`]);
  sprite.anchor.set(0.5, 0.5);

  mountEffect(() => {
    systems.renderer.addToBody(sprite, brick.bodyId);
    return () => systems.renderer.removeFromBody(sprite);
  });

  if (powerUp) {
    mountEffect(() => {
      const puSprite = new Sprite((bg as Record<string, any>)[BRICK_POWER_UP_DEFS[powerUp].texture]);
      puSprite.anchor.set(0.5, 0.5);

      systems.renderer.addToBody(puSprite, brick.bodyId);
      return () => systems.renderer.removeFromBody(puSprite);
    });
  }

  mountEffect(() => {
    systems.collision.add(brick.bodyId, {
      tag: 'brick',
      handlers: { ball: () => brick.hit() },
      entity: brick,
    });
    return () => systems.collision.remove(brick.bodyId);
  });

  const brick: BrickEntity = {
    bodyId: initialBodyId,
    powerUp,
    spawnPos,
    destroyed: false,

    hit() {
      if (this.destroyed) return;

      onHit(this, systems.context);

      const { x, y } = BodyToScreen(this.bodyId);
      debrisEmitter.explode(8, x, y);

      const bodyPos = b2Body_GetPosition(this.bodyId);
      systems.context.events.emit(GameEvent.BRICK_DESTROYED, {
        brickId: String(this.bodyId),
        position: { x: bodyPos.x, y: bodyPos.y },
        score: 100,
      });

      onBreak?.(this);
      this.destroy();
    },

    /*
    restore() {
      this.destroyed = false;

      const brickVertices = [
        new b2Vec2(-0.5, 0.5),
        new b2Vec2(0.5, 0.5),
        new b2Vec2(0.5, -0.5),
        new b2Vec2(-0.5, -0.5),
      ];
      const { bodyId: newBodyId } = CreatePolygon({
        position: new b2Vec2(spawnPos.x, spawnPos.y),
        type: b2BodyType.b2_staticBody,
        vertices: brickVertices,
        worldId,
      });
      b2Body_SetUserData(newBodyId, { type: 'brick', powerup: powerUp });
      this.bodyId = newBodyId;

      ({ mountEffect, unmount } = createMountScope());
      mount();
    },*/

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      systems.physics.queueDestruction(this.bodyId);
      unmount();
    },
  };

  return { brick, cleanup: unmount };
};

export const BlueBriddddck = (props: Omit<BrickProps, 'powerUp'>) => Brick({ ...props, powerUp: 'blue' as const });

// ---- BlueCheese ----

interface BlueCheddddddeseProps {
  systems: LevelSystems;
  pos: { x: number; y: number };
  waterEmitter: ParticleEmitter;
  onCollected?: (cheese: BlueCheeseEntity) => void;
  onLost?: (cheese: BlueCheeseEntity) => void;
}

export const BlueChedddddddese = ({
  systems,
  pos,
  waterEmitter,
  onCollected = (cheese) => cheese.destroy(),
  onLost = (cheese) => cheese.destroy(),
}: BlueCheeseProps): BlueCheeseEntity => {
  const worldId = systems.context.worldId!;
  const { mountEffect, unmount } = createMountScope();

  const { bodyId } = CreateCircle({
    worldId,
    type: b2BodyType.b2_dynamicBody,
    position: new b2Vec2(pos.x, pos.y),
    radius: 0.3,
    density: 1,
    friction: 0.5,
    restitution: 0,
  });
  b2Body_SetUserData(bodyId, { type: 'cheese', cheeseType: 'blue' });

  const texture = typedAssets.get(ASSETS.prototype).textures[CHEESE_DEFS['blue'].texture];
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.5);

  mountEffect(() => {
    systems.renderer.addToBody(sprite, bodyId);
    return () => systems.renderer.removeFromBody(sprite);
  });

  const f = new b2Vec2(Math.random() * 1 - 0.5, Math.random() * 1 - 0.5);
  b2Normalize(f);
  b2Body_ApplyLinearImpulseToCenter(bodyId, f, true);
  systems.physics.enableGravity(bodyId);

  const cheese: BlueCheeseEntity = {
    bodyId,
    destroyed: false,

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      systems.physics.disableGravity(bodyId);
      systems.physics.queueDestruction(bodyId);
      unmount();
    },
  };

  mountEffect(() => {
    systems.collision.add(bodyId, {
      tag: 'cheese',
      handlers: {
        paddle: () => onCollected(cheese),
        'bottom-wall': () => {
          const { x, y } = BodyToScreen(bodyId);
          waterEmitter.explode(20, x, y);
          onLost(cheese);
        },
      },
      entity: cheese,
    });
    return () => systems.collision.remove(bodyId);
  });

  return cheese;
};
