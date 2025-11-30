import {
  b2DefaultWorldDef,
  b2Vec2,
  b2World_Step,
  b2World_Draw,
  CreateWorld,
  SetWorldScale,
  type b2WorldId,
} from 'phaser-box2d';
import type { System } from './System';
import type { Game } from '../core/Game';
import { Graphics } from 'pixi.js';
import { PhaserDebugDraw } from '@/screens/PhaserDebugDraw';
import { MIN_WIDTH, MIN_HEIGHT } from '@/consts';

/**
 * PhysicsSystem manages the Box2D physics world
 */
export class PhysicsSystem implements System {
  static SYSTEM_ID = 'physics';

  game?: Game;

  private debugGraphics?: Graphics;
  private debugDraw?: PhaserDebugDraw;
  private enableDebug = true;

  init() {
    console.log('[PhysicsSystem] Initializing...');

    // Set world scale (pixels per meter)
    SetWorldScale(20);

    // Create Box2D world
    const worldDef = b2DefaultWorldDef();
    worldDef.gravity = new b2Vec2(0, 0); // No gravity for breakout-style game
    worldDef.restitutionThreshold = 0;

    const { worldId } = CreateWorld({ worldDef });
    this.game!.context.worldId = worldId;

    // Setup debug draw if enabled
    if (this.enableDebug) {
      this.setupDebugDraw();
    }

    console.log('[PhysicsSystem] World created:', worldId);
  }

  update(delta: number) {
    const worldId = this.game!.context.worldId;

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
    const { container } = this.game!.context;

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
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
    }
  }
}
