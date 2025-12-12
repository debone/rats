/**
 * Physics System
 *
 * Manages the Box2D physics world.
 * This system is added dynamically when starting a new run and removed on game over.
 */

import { MIN_HEIGHT, MIN_WIDTH, PXM } from '@/consts';
import { assert } from '@/core/common/assert';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { PhaserDebugDraw } from '@/screens/PhaserDebugDraw';
import {
  b2DefaultWorldDef,
  b2DestroyWorld,
  b2Vec2,
  b2World_Draw,
  b2World_Step,
  CreateWorld,
  SetWorldScale,
} from 'phaser-box2d';
import { Container, Graphics } from 'pixi.js';
import { DestroyWorldSprites, UpdateWorldSprites } from './WorldSprites';

export class PhysicsSystem implements System {
  static SYSTEM_ID = 'physics';

  private context!: GameContext;
  private debugGraphics?: Graphics;
  private debugDraw?: PhaserDebugDraw;

  // TODO: devtools option?
  private enableDebug = false;

  private updateHandler = this.update.bind(this);

  init(context: GameContext) {
    this.context = context;
    console.log('[PhysicsSystem] Initializing...');
  }

  createWorld(start: boolean) {
    console.log('[PhysicsSystem] Creating world...');

    // Set world scale (pixels per meter)
    SetWorldScale(PXM);

    // Create Box2D world
    const worldDef = b2DefaultWorldDef();
    worldDef.gravity = new b2Vec2(0, 0); // No gravity for breakout-style game
    worldDef.restitutionThreshold = 0;

    const { worldId } = CreateWorld({ worldDef });
    this.context.worldId = worldId;

    // Self-schedule for update
    if (start) {
      this.start();
    }

    console.log('[PhysicsSystem] World created:', worldId);
  }

  stop() {
    console.log('[PhysicsSystem] Stopping current world...');
    assert(this.context.worldId, 'World ID is not set');
    this.context.systems.unregister('update', this.updateHandler);
  }

  start() {
    console.log('[PhysicsSystem] Starting current world...');
    assert(this.context.worldId, 'World ID is not set');
    this.context.systems.register('update', this.updateHandler);
  }

  destroyWorld() {
    console.log('[PhysicsSystem] Destroying world...');
    assert(this.context.worldId, 'World ID is not set');

    // Clean up sprite associations before destroying the world
    DestroyWorldSprites(this.context.worldId);

    b2DestroyWorld(this.context.worldId);
    this.context.worldId = null;
  }

  private update(delta: number) {
    const worldId = this.context.worldId;
    if (!worldId) return;

    // Clear debug graphics
    if (this.debugGraphics && this.enableDebug) {
      this.debugGraphics.clear();
    }

    // Step the physics world (delta is in milliseconds, convert to seconds)
    // TODO: fix the loop
    b2World_Step(worldId, delta / 1000, 4);

    // Update sprite positions from physics bodies
    UpdateWorldSprites(worldId);

    // Draw debug visualization
    if (this.debugDraw && this.enableDebug) {
      b2World_Draw(worldId, this.debugDraw);
    }
  }

  setupDebugDraw(container: Container) {
    if (this.debugGraphics) {
      console.log('[PhysicsSystem] Replacing existing debug graphics');
      container.addChild(this.debugGraphics);
      return;
    }
    // Create debug graphics
    this.debugGraphics = new Graphics();
    this.debugGraphics.x = MIN_WIDTH / 2;
    this.debugGraphics.y = MIN_HEIGHT / 2;

    this.debugGraphics.zIndex = 10;

    container.addChild(this.debugGraphics);

    // Create debug draw instance
    this.debugDraw = new PhaserDebugDraw(this.debugGraphics, MIN_WIDTH, MIN_HEIGHT, PXM);
    this.debugDraw.drawJoints = true;

    console.log('[PhysicsSystem] Debug draw enabled');
  }

  destroy() {
    // Unregister from scheduler
    this.context.systems.unregister('update', this.updateHandler);

    // Cleanup debug graphics
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = undefined;
    }

    this.destroyWorld();
  }
}
