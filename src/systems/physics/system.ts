/**
 * Physics System
 *
 * Manages the Box2D physics world.
 * This system is added dynamically when starting a new run and removed on game over.
 */

import { MIN_HEIGHT, MIN_WIDTH, PXM } from '@/consts';
import { assert } from '@/core/common/assert';
import type { System } from '@/core/game/System';
import { signal } from '@/core/reactivity/signals/signals';
import { LAYER_NAMES } from '@/core/window/types';
import type { GameContext } from '@/data/game-context';
import { PhaserDebugDraw } from '@/screens/PhaserDebugDraw';
import { animate } from 'animejs';
import {
  b2Body_ApplyForceToCenter,
  b2Body_GetMass,
  b2Body_GetUserData,
  b2Body_IsValid,
  b2BodyId,
  b2DefaultWorldDef,
  b2DestroyBody,
  b2DestroyJoint,
  b2DestroyWorld,
  b2Joint_IsValid,
  b2JointId,
  b2Shape_GetBody,
  b2Vec2,
  b2World_Draw,
  b2World_GetContactEvents,
  b2World_GetSensorEvents,
  b2World_Step,
  b2WorldId,
  CreateWorld,
  SetWorldScale,
} from 'phaser-box2d';
import { Graphics } from 'pixi.js';
import { ClearWorldSprites, DestroyWorldSprites, UpdateWorldSprites } from './WorldSprites';
import { EntityCollisionSystem } from './EntityCollisionSystem';

export class PhysicsSystem implements System {
  static SYSTEM_ID = 'physics';

  private context!: GameContext;
  private debugGraphics?: Graphics;
  private debugDraw?: PhaserDebugDraw;

  // TODO: devtools option?
  private enableDebug = signal(false, { label: 'enableDebug' });

  private updateHandler = this.update.bind(this);

  private orphanBodies: b2BodyId[] = [];

  private pendingDestructions: b2BodyId[] = [];
  private pendingJointDestructions: b2JointId[] = [];

  private gravityEnabled: b2BodyId[] = [];

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

  ramp: number = 1;

  rampUp() {
    assert(this.context.worldId, 'World ID is not set');
    this.context.systems.register('update', this.updateHandler);

    this.ramp = 0;
    animate(this, { ramp: 1, duration: 3000, ease: 'out' });
  }

  destroyWorld() {
    console.log('[PhysicsSystem] Destroying world...');
    assert(this.context.worldId, 'World ID is not set');

    // Clean up sprite associations before destroying the world
    DestroyWorldSprites(this.context.worldId);

    b2DestroyWorld(this.context.worldId);
    this.context.worldId = null;
  }

  enableGravity(bodyId: b2BodyId): void {
    this.gravityEnabled.push(bodyId);
  }

  disableGravity(bodyId: b2BodyId): void {
    this.gravityEnabled = this.gravityEnabled.filter((id) => id !== bodyId);
  }

  registerOrphanBody(bodyId: b2BodyId): void {
    this.orphanBodies.push(bodyId);
  }

  unregisterOrphanBody(bodyId: b2BodyId): void {
    this.orphanBodies = this.orphanBodies.filter((id) => id !== bodyId);
  }

  clearOrphans(): void {
    for (const bodyId of this.orphanBodies) {
      if (b2Body_IsValid(bodyId)) {
        b2DestroyBody(bodyId);
      }
    }
    this.orphanBodies = [];
  }

  private update(delta: number) {
    const worldId = this.context.worldId;
    if (!worldId) return;

    // Clear debug graphics
    if (this.debugGraphics) {
      this.debugGraphics.clear();
    }

    for (const bodyId of this.gravityEnabled) {
      if (b2Body_IsValid(bodyId)) {
        b2Body_ApplyForceToCenter(bodyId, new b2Vec2(0, -10 * b2Body_GetMass(bodyId)), true);
      }
    }

    // Step the physics world (delta is in milliseconds, convert to seconds)
    // TODO: fix the loop
    b2World_Step(worldId, (this.ramp * delta) / 1000, 4);

    this.checkCollisions(this.context.worldId!);

    // Update sprite positions from physics bodies
    UpdateWorldSprites(worldId);

    // Draw debug visualization
    if (this.debugDraw && this.enableDebug.get()) {
      b2World_Draw(worldId, this.debugDraw);
    }

    this.flushDestructions();
  }

  protected checkCollisions(worldId: b2WorldId): void {
    const contactEvents = b2World_GetContactEvents(worldId);

    for (let i = 0; i < contactEvents.beginCount; i++) {
      const event = contactEvents.beginEvents[i];
      if (!event) continue;

      const bodyIdA = b2Shape_GetBody(event.shapeIdA);
      const bodyIdB = b2Shape_GetBody(event.shapeIdB);

      if (!b2Body_IsValid(bodyIdA) || !b2Body_IsValid(bodyIdB)) continue;

      this.dispatchCollision(bodyIdA, bodyIdB);
    }

    const sensorEvents = b2World_GetSensorEvents(worldId);

    for (let i = 0; i < sensorEvents.beginCount; i++) {
      const event = sensorEvents.beginEvents[i];
      if (!event) continue;

      const bodyIdA = b2Shape_GetBody(event.visitorShapeId);
      const bodyIdB = b2Shape_GetBody(event.sensorShapeId);

      if (!b2Body_IsValid(bodyIdA) || !b2Body_IsValid(bodyIdB)) continue;

      this.dispatchCollision(bodyIdA, bodyIdB);
    }
  }

  private dispatchCollision(bodyIdA: b2BodyId, bodyIdB: b2BodyId): void {
    const entityCollisions = this.context.systems.get(EntityCollisionSystem);
    const entityA = entityCollisions.get(bodyIdA);
    const entityB = entityCollisions.get(bodyIdB);

    let handled = false;

    if (entityA && entityB) {
      if (entityA.handlers[entityB.tag]) {
        entityA.handlers[entityB.tag](entityA.entity, entityB.entity);
        handled = true;
      }
      if (entityB.handlers[entityA.tag]) {
        entityB.handlers[entityA.tag](entityB.entity, entityA.entity);
        handled = true;
      }
    } else if (entityA) {
      const userDataB = b2Body_GetUserData(bodyIdB) as { type: string } | null;
      if (userDataB?.type && entityA.handlers[userDataB.type]) {
        entityA.handlers[userDataB.type](entityA.entity, bodyIdB);
        handled = true;
      }
    } else if (entityB) {
      const userDataA = b2Body_GetUserData(bodyIdA) as { type: string } | null;
      if (userDataA?.type && entityB.handlers[userDataA.type]) {
        entityB.handlers[userDataA.type](entityB.entity, bodyIdA);
        handled = true;
      }
    }

    if (!handled) {
      // console.error(`There are no handlers for this collision`, { bodyIdA, bodyIdB });
      // throw new Error(`There are no handlers for this collision ${bodyIdA} and ${bodyIdB}`);
      // I had something here... but it assumes things that we don't care about colliding (which I'm not sure which one are these, but hey....)
    }
  }

  /**
   * Queue a body for destruction.
   * Use this instead of destroying bodies directly during collision handling
   * to avoid modifying the physics world during iteration.
   */
  queueDestruction(bodyId: b2BodyId): void {
    this.pendingDestructions.push(bodyId);
  }

  queueJointDestruction(jointId: b2JointId): void {
    this.pendingJointDestructions.push(jointId);
  }

  /**
   * Destroy all queued bodies.
   * Call this after processing all collisions for the frame.
   */
  flushDestructions(): void {
    for (const bodyId of this.pendingDestructions) {
      if (b2Body_IsValid(bodyId)) {
        b2DestroyBody(bodyId);
      }
    }
    this.pendingDestructions = [];

    for (const jointId of this.pendingJointDestructions) {
      if (b2Joint_IsValid(jointId)) {
        b2DestroyJoint(jointId);
      }
    }
    this.pendingJointDestructions = [];
  }

  /**
   * Clear all sprite associations without destroying the world.
   * Call this when resetting a level/screen.
   */
  clearSprites() {
    if (this.context.worldId) {
      ClearWorldSprites(this.context.worldId);
    }
  }

  /**
   * Clean up debug graphics (call before setting up new ones)
   */
  cleanupDebugDraw() {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = undefined;
      this.debugDraw = undefined;
    }
  }

  setupDebugDraw() {
    // Clean up existing debug graphics first
    this.cleanupDebugDraw();

    // Create debug graphics
    this.debugGraphics = new Graphics();

    // Add debug graphics to debug layer but don't make it visible yet
    this.context.navigation.addToLayer(this.debugGraphics, LAYER_NAMES.DEBUG, false);

    this.enableDebug.subscribe((value) => {
      if (value) {
        this.context.navigation.showLayer(LAYER_NAMES.DEBUG);
      } else {
        this.context.navigation.hideLayer(LAYER_NAMES.DEBUG);
      }
    });

    // Create debug draw instance
    this.debugDraw = new PhaserDebugDraw(this.debugGraphics, MIN_WIDTH + 166, MIN_HEIGHT + 105, PXM * 2);
    this.debugDraw.drawJoints = true;

    console.log('[PhysicsSystem] Debug draw setup');
  }

  destroy() {
    // Unregister from scheduler
    this.context.systems.unregister('update', this.updateHandler);

    this.pendingDestructions = [];

    // Cleanup debug graphics
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = undefined;
    }

    this.destroyWorld();
  }
}
