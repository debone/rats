/**
 * Physics System
 *
 * Manages the Box2D physics world.
 * This system is added dynamically when starting a new run and removed on game over.
 */

import {
  b2DefaultWorldDef,
  b2Vec2,
  b2World_Step,
  b2World_Draw,
  CreateWorld,
  SetWorldScale,
  b2DestroyWorld,
} from 'phaser-box2d';
import type { System } from '@/core/game/System';
import type { GameContext } from '@/data/game-context';
import { Graphics } from 'pixi.js';
import { PhaserDebugDraw } from '@/screens/PhaserDebugDraw';
import { MIN_WIDTH, MIN_HEIGHT } from '@/consts';
import { assert } from '@/core/common/assert';

export class PhysicsSystem implements System {
  static SYSTEM_ID = 'physics';

  private context!: GameContext;
  private debugGraphics?: Graphics;
  private debugDraw?: PhaserDebugDraw;
  private enableDebug = true;

  private updateHandler = this.update.bind(this);

  init(context: GameContext) {
    this.context = context;
    console.log('[PhysicsSystem] Initializing...');
  }

  createWorld(start: boolean) {
    console.log('[PhysicsSystem] Creating world...');

    // Set world scale (pixels per meter)
    SetWorldScale(20);

    // Create Box2D world
    const worldDef = b2DefaultWorldDef();
    worldDef.gravity = new b2Vec2(0, 0); // No gravity for breakout-style game
    worldDef.restitutionThreshold = 0;

    const { worldId } = CreateWorld({ worldDef });
    this.context.worldId = worldId;

    // Setup debug draw if enabled
    if (this.enableDebug) {
      this.setupDebugDraw();
    }

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
    b2World_Step(worldId, delta / 1000, 4);

    // Draw debug visualization
    if (this.debugDraw && this.enableDebug) {
      b2World_Draw(worldId, this.debugDraw);
    }
  }

  private setupDebugDraw() {
    const { container } = this.context;
    if (!container) return;

    // Create debug graphics
    this.debugGraphics = new Graphics();
    this.debugGraphics.x = MIN_WIDTH / 2;
    this.debugGraphics.y = MIN_HEIGHT / 2;

    container.addChild(this.debugGraphics);

    // Create debug draw instance
    this.debugDraw = new PhaserDebugDraw(this.debugGraphics, MIN_WIDTH, MIN_HEIGHT, 13);

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
