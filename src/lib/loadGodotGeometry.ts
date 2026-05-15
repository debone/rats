/**
 * Runtime loader for Box2D geometry authored in Godot.
 *
 * Consumes the JSON shape emitted by
 * `devtools/packer/processors/godot-geometry.ts` and instantiates bodies,
 * fixtures, joints, and sprite bindings inside a phaser-box2d world.
 *
 * Supports a per-call `transform` so the same geometry blob can be loaded as
 * a whole level (at origin) or as a fragment spawned mid-level at any pose.
 *
 * The runtime tags each `b2BodyId` / `b2JointId` with a `.name` matching its
 * authored Godot node name, preserving the existing convention that
 * gameplay does `joints.find(j => j.name === 'paddle-joint')`.
 */

import {
  b2Body_SetUserData,
  b2BodyId,
  b2BodyType,
  b2Circle,
  b2ComputeHull,
  b2CreateBody,
  b2CreateCircleShape,
  b2CreateDistanceJoint,
  b2CreatePolygonShape,
  b2CreatePrismaticJoint,
  b2CreateRevoluteJoint,
  b2CreateSegmentShape,
  b2CreateWeldJoint,
  b2DefaultBodyDef,
  b2DefaultPrismaticJointDef,
  b2DefaultRevoluteJointDef,
  b2DefaultShapeDef,
  b2DistanceJointDef,
  b2Joint_SetUserData,
  type b2JointId,
  b2MakePolygon,
  b2MakeRot,
  b2Segment,
  b2Shape_SetUserData,
  b2Vec2,
  b2WeldJointDef,
  type b2WorldId,
} from 'phaser-box2d';
import { Assets, Container, Sprite, Texture } from 'pixi.js';
import { AddSpriteToWorld, type SpriteObject } from '@/systems/physics/WorldSprites';

// ---------------------------------------------------------------------------
// Schema (kept in sync with devtools/packer/processors/godot-geometry.ts)
// ---------------------------------------------------------------------------

export interface Box2DGeometry {
  gravity?: V2;
  bodies: Box2DBodyDef[];
  joints: Box2DJointDef[];
}

export interface V2 {
  x: number;
  y: number;
}

export interface Box2DBodyDef {
  name: string;
  type: 'static' | 'kinematic' | 'dynamic';
  position: V2;
  angle: number;
  fixedRotation?: boolean;
  bullet?: boolean;
  allowSleep?: boolean;
  linearDamping?: number;
  angularDamping?: number;
  gravityScale?: number;
  userData: Record<string, unknown>;
  fixtures: Box2DFixtureDef[];
  sprites: SpriteBinding[];
}

export type Box2DFixtureDef =
  | { shape: 'circle'; center: V2; radius: number; material: Material; userData?: Record<string, unknown> }
  | { shape: 'polygon'; vertices: V2[]; material: Material; userData?: Record<string, unknown> }
  | { shape: 'chain'; vertices: V2[]; loop: boolean; material: Material; userData?: Record<string, unknown> };

export interface Material {
  density: number;
  friction: number;
  restitution: number;
  sensor: boolean;
  categoryBits?: number;
  maskBits?: number;
  groupIndex?: number;
}

export interface SpriteBinding {
  pixiFrame?: string;
  pixiAnimation?: string;
  offset: V2;
  rotation: number;
  scale: V2;
  anchor: V2;
  z?: number;
  tint?: number;
  alpha?: number;
  flipH?: boolean;
  flipV?: boolean;
  shouldRotate?: boolean;
}

type CommonJoint = {
  name: string;
  bodyA: number;
  bodyB: number;
  anchorA: V2;
  anchorB: V2;
  collideConnected?: boolean;
};

export type Box2DJointDef =
  | (CommonJoint & {
      type: 'revolute';
      referenceAngle?: number;
      enableLimit?: boolean;
      lowerLimit?: number;
      upperLimit?: number;
      enableMotor?: boolean;
      motorSpeed?: number;
      maxMotorTorque?: number;
    })
  | (CommonJoint & {
      type: 'prismatic';
      referenceAngle?: number;
      localAxisA: V2;
      enableLimit?: boolean;
      lowerLimit?: number;
      upperLimit?: number;
      enableMotor?: boolean;
      motorSpeed?: number;
      maxMotorForce?: number;
    })
  | (CommonJoint & { type: 'distance'; length: number; frequency?: number; dampingRatio?: number })
  | (CommonJoint & { type: 'weld'; referenceAngle?: number });

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export interface LoadGodotGeometryOptions {
  /** Spawn transform applied to all body positions/angles. */
  transform?: { x?: number; y?: number; angle?: number };
  /** When false, fixtures and joints are created but sprite bindings are skipped. */
  sprites?: boolean;
  /** Pixi container to which instantiated sprites are added (required when sprites are enabled and the geometry has any). */
  container?: Container;
}

export interface LoadGodotGeometryResult {
  bodies: b2BodyId[];
  joints: b2JointId[];
  bodiesByName: Map<string, b2BodyId>;
  jointsByName: Map<string, b2JointId>;
  sprites: SpriteObject[];
}

export function loadGodotGeometry(
  geo: Box2DGeometry,
  worldId: b2WorldId,
  options: LoadGodotGeometryOptions = {},
): LoadGodotGeometryResult {
  const tx = options.transform?.x ?? 0;
  const ty = options.transform?.y ?? 0;
  const ta = options.transform?.angle ?? 0;
  const cosT = Math.cos(ta);
  const sinT = Math.sin(ta);
  const spritesEnabled = options.sprites !== false;

  const bodies: b2BodyId[] = [];
  const bodiesByName = new Map<string, b2BodyId>();
  const sprites: SpriteObject[] = [];

  for (const def of geo.bodies) {
    const bd = b2DefaultBodyDef();
    bd.type =
      def.type === 'dynamic'
        ? b2BodyType.b2_dynamicBody
        : def.type === 'kinematic'
          ? b2BodyType.b2_kinematicBody
          : b2BodyType.b2_staticBody;

    const localX = def.position.x;
    const localY = def.position.y;
    bd.position = new b2Vec2(cosT * localX - sinT * localY + tx, sinT * localX + cosT * localY + ty);
    bd.rotation = b2MakeRot(def.angle + ta);

    if (def.fixedRotation !== undefined) bd.fixedRotation = def.fixedRotation;
    if (def.bullet !== undefined) bd.isBullet = def.bullet;
    if (def.allowSleep !== undefined) bd.enableSleep = def.allowSleep;
    if (def.linearDamping !== undefined) bd.linearDamping = def.linearDamping;
    if (def.angularDamping !== undefined) bd.angularDamping = def.angularDamping;
    if (def.gravityScale !== undefined) bd.gravityScale = def.gravityScale;
    bd.isAwake = true;

    const bodyId = b2CreateBody(worldId, bd);
    (bodyId as { name?: string }).name = def.name;
    if (def.userData && Object.keys(def.userData).length > 0) {
      b2Body_SetUserData(bodyId, def.userData);
    }

    for (const fx of def.fixtures) {
      createFixture(bodyId, fx);
    }

    if (spritesEnabled && def.sprites.length > 0) {
      if (!options.container) {
        console.warn(
          `[loadGodotGeometry] body "${def.name}" has sprite bindings but no container was provided; skipping sprites for this body.`,
        );
      } else {
        for (const binding of def.sprites) {
          const sprite = instantiateSprite(binding);
          if (!sprite) continue;
          options.container.addChild(sprite);
          AddSpriteToWorld(worldId, sprite, bodyId, {
            offsetX: binding.offset.x,
            offsetY: binding.offset.y,
            localRotation: binding.rotation,
          });
          sprites.push(sprite);
        }
      }
    }

    bodies.push(bodyId);
    if (!bodiesByName.has(def.name)) bodiesByName.set(def.name, bodyId);
  }

  const joints: b2JointId[] = [];
  const jointsByName = new Map<string, b2JointId>();

  for (const jdef of geo.joints) {
    const jointId = createJoint(jdef, worldId, bodies);
    if (!jointId) continue;
    (jointId as { name?: string }).name = jdef.name;
    joints.push(jointId);
    if (!jointsByName.has(jdef.name)) jointsByName.set(jdef.name, jointId);
  }

  return { bodies, joints, bodiesByName, jointsByName, sprites };
}

// ---------------------------------------------------------------------------
// Fixture creation
// ---------------------------------------------------------------------------

function createFixture(bodyId: b2BodyId, fx: Box2DFixtureDef): void {
  const sd = b2DefaultShapeDef();
  sd.density = fx.material.density;
  sd.friction = fx.material.friction;
  sd.restitution = fx.material.restitution;
  sd.isSensor = fx.material.sensor;
  if (fx.material.categoryBits !== undefined) sd.filter.categoryBits = fx.material.categoryBits;
  if (fx.material.maskBits !== undefined) sd.filter.maskBits = fx.material.maskBits;
  if (fx.material.groupIndex !== undefined) sd.filter.groupIndex = fx.material.groupIndex;

  let shapeId: unknown = null;

  if (fx.shape === 'circle') {
    const c = new b2Circle(new b2Vec2(fx.center.x, fx.center.y), fx.radius);
    shapeId = b2CreateCircleShape(bodyId, sd, c);
  } else if (fx.shape === 'polygon') {
    const verts = fx.vertices.map((v) => new b2Vec2(v.x, v.y));
    const hull = b2ComputeHull(verts, verts.length);
    const poly = b2MakePolygon(hull, 0);
    shapeId = b2CreatePolygonShape(bodyId, sd, poly);
  } else if (fx.shape === 'chain') {
    let lastVertex: b2Vec2 | null = null;
    for (const v of fx.vertices) {
      const thisVertex = new b2Vec2(v.x, v.y);
      if (lastVertex) {
        const seg = new b2Segment(lastVertex, thisVertex);
        shapeId = b2CreateSegmentShape(bodyId, sd, seg);
      }
      lastVertex = thisVertex;
    }
  }

  if (shapeId && fx.userData) {
    b2Shape_SetUserData(shapeId as never, fx.userData);
  }
}

// ---------------------------------------------------------------------------
// Joint creation
// ---------------------------------------------------------------------------

function createJoint(jdef: Box2DJointDef, worldId: b2WorldId, bodies: b2BodyId[]): b2JointId | null {
  const bodyA = bodies[jdef.bodyA];
  const bodyB = bodies[jdef.bodyB];
  if (!bodyA || !bodyB) {
    console.warn(`[loadGodotGeometry] joint "${jdef.name}" references invalid body index`);
    return null;
  }
  const anchorA = new b2Vec2(jdef.anchorA.x, jdef.anchorA.y);
  const anchorB = new b2Vec2(jdef.anchorB.x, jdef.anchorB.y);

  if (jdef.type === 'revolute') {
    const jd = b2DefaultRevoluteJointDef();
    jd.bodyIdA = bodyA;
    jd.bodyIdB = bodyB;
    jd.localAnchorA = anchorA;
    jd.localAnchorB = anchorB;
    if (jdef.collideConnected !== undefined) jd.collideConnected = jdef.collideConnected;
    if (jdef.referenceAngle !== undefined) jd.referenceAngle = jdef.referenceAngle;
    if (jdef.enableLimit !== undefined) jd.enableLimit = jdef.enableLimit;
    if (jdef.lowerLimit !== undefined) jd.lowerAngle = jdef.lowerLimit;
    if (jdef.upperLimit !== undefined) jd.upperAngle = jdef.upperLimit;
    if (jdef.enableMotor !== undefined) jd.enableMotor = jdef.enableMotor;
    if (jdef.motorSpeed !== undefined) jd.motorSpeed = jdef.motorSpeed;
    if (jdef.maxMotorTorque !== undefined) jd.maxMotorTorque = jdef.maxMotorTorque;
    const joint = b2CreateRevoluteJoint(worldId, jd);
    setJointUserData(joint, jdef);
    return joint;
  }
  if (jdef.type === 'prismatic') {
    const jd = b2DefaultPrismaticJointDef();
    jd.bodyIdA = bodyA;
    jd.bodyIdB = bodyB;
    jd.localAnchorA = anchorA;
    jd.localAnchorB = anchorB;
    jd.localAxisA = new b2Vec2(jdef.localAxisA.x, jdef.localAxisA.y);
    if (jdef.collideConnected !== undefined) jd.collideConnected = jdef.collideConnected;
    if (jdef.referenceAngle !== undefined) jd.referenceAngle = jdef.referenceAngle;
    if (jdef.enableLimit !== undefined) jd.enableLimit = jdef.enableLimit;
    if (jdef.lowerLimit !== undefined) jd.lowerTranslation = jdef.lowerLimit;
    if (jdef.upperLimit !== undefined) jd.upperTranslation = jdef.upperLimit;
    if (jdef.enableMotor !== undefined) jd.enableMotor = jdef.enableMotor;
    if (jdef.motorSpeed !== undefined) jd.motorSpeed = jdef.motorSpeed;
    if (jdef.maxMotorForce !== undefined) jd.maxMotorForce = jdef.maxMotorForce;
    const joint = b2CreatePrismaticJoint(worldId, jd);
    setJointUserData(joint, jdef);
    return joint;
  }
  if (jdef.type === 'distance') {
    const jd = new b2DistanceJointDef();
    jd.bodyIdA = bodyA;
    jd.bodyIdB = bodyB;
    jd.localAnchorA = anchorA;
    jd.localAnchorB = anchorB;
    jd.length = jdef.length;
    if (jdef.collideConnected !== undefined) jd.collideConnected = jdef.collideConnected;
    if (jdef.frequency !== undefined) jd.hertz = jdef.frequency;
    if (jdef.dampingRatio !== undefined) jd.dampingRatio = jdef.dampingRatio;
    const joint = b2CreateDistanceJoint(worldId, jd);
    setJointUserData(joint, jdef);
    return joint;
  }
  if (jdef.type === 'weld') {
    const jd = new b2WeldJointDef();
    jd.bodyIdA = bodyA;
    jd.bodyIdB = bodyB;
    jd.localAnchorA = anchorA;
    jd.localAnchorB = anchorB;
    if (jdef.collideConnected !== undefined) jd.collideConnected = jdef.collideConnected;
    if (jdef.referenceAngle !== undefined) jd.referenceAngle = jdef.referenceAngle;
    const joint = b2CreateWeldJoint(worldId, jd);
    setJointUserData(joint, jdef);
    return joint;
  }
  return null;
}

function setJointUserData(joint: b2JointId, jdef: Box2DJointDef): void {
  // Preserve userData if any was stashed in metadata under a 'userData' key
  // in future. For now joints carry no user data — gameplay looks up by name.
  void joint;
  void jdef;
}

// ---------------------------------------------------------------------------
// Sprite instantiation
// ---------------------------------------------------------------------------

function instantiateSprite(binding: SpriteBinding): Sprite | null {
  let texture: Texture | undefined;
  const key = binding.pixiFrame ?? binding.pixiAnimation;
  if (!key) return null;
  try {
    texture = Assets.get<Texture>(key) ?? Texture.from(key);
  } catch {
    console.warn(`[loadGodotGeometry] Texture not found: "${key}"`);
    return null;
  }
  if (!texture) return null;
  const sprite = new Sprite({ texture });
  sprite.anchor.set(binding.anchor.x, binding.anchor.y);
  sprite.scale.set(binding.scale.x, binding.scale.y);
  if (binding.tint !== undefined) sprite.tint = binding.tint;
  if (binding.alpha !== undefined) sprite.alpha = binding.alpha;
  if (binding.flipH) sprite.scale.x *= -1;
  if (binding.flipV) sprite.scale.y *= -1;
  if (binding.z !== undefined) sprite.zIndex = binding.z;
  if (binding.shouldRotate === false) (sprite as Sprite & { shouldRotate?: boolean }).shouldRotate = false;
  // rotation is applied each frame by BodyToSprite via the SpriteEntry's localRotation
  return sprite;
}

// Silence unused-export linting until b2Joint_SetUserData is needed.
void b2Joint_SetUserData;
