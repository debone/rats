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
import { Assets, Container, Graphics, Mesh, MeshGeometry, NineSliceSprite, Sprite, Texture } from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';
import { AddSpriteToWorld, type SpriteObject } from '@/systems/physics/WorldSprites';

// ---------------------------------------------------------------------------
// Schema (kept in sync with devtools/packer/processors/godot-geometry.ts)
// ---------------------------------------------------------------------------

export interface Box2DGeometry {
  gravity?: V2;
  bodies: Box2DBodyDef[];
  joints: Box2DJointDef[];
  background?: BackgroundDef;
}

export interface BackgroundDef {
  meshes: MeshDef[];
  sprites: BackgroundSpriteDef[];
  tileLayers: TileLayerDef[];
  ninePatches: NinePatchDef[];
}

export interface NinePatchDef {
  name: string;
  pixiFrame: string;
  position: V2;
  rotation: number;
  scale: V2;
  anchor: V2;
  /** Stretched size in pixels. */
  size: V2;
  /** Non-stretching border widths in texture pixels. */
  borders: { left: number; top: number; right: number; bottom: number };
  z?: number;
  tint?: number;
  alpha?: number;
}

export interface TileLayerDef {
  name: string;
  position: V2;
  rotation: number;
  scale: V2;
  tileSize: V2;
  z?: number;
  tiles: { x: number; y: number; pixiFrame: string; transform?: number }[];
}

export interface MeshDef {
  name: string;
  position: V2;
  rotation: number;
  scale: V2;
  vertices: V2[];
  uvs: V2[]; // Texture pixel space; normalized to 0..1 at runtime using texture dimensions
  indices: number[];
  pixiFrame?: string;
  z?: number;
  tint?: number;
  alpha?: number;
  /** Tile the fill texture across the polygon (masked tilemap) instead of stretching it. */
  tileFill?: boolean;
  /** Optional tiled quad-strip border traced along the polygon outline (`vertices`). */
  border?: MeshBorderDef;
}

export interface MeshBorderDef {
  pixiFrame: string;
  /** Strip thickness in pixels. 0 → fall back to the texture's height. */
  width: number;
  /** Scales the length of each repeated tile along the edge (1 = one frame width). */
  textureScale: number;
  /** Close the strip back to the first vertex so it wraps the whole shape. */
  closed: boolean;
}

export interface BackgroundSpriteDef {
  name: string;
  pixiFrame?: string;
  pixiAnimation?: string;
  position: V2;
  rotation: number;
  scale: V2;
  anchor: V2;
  z?: number;
  tint?: number;
  alpha?: number;
  flipH?: boolean;
  flipV?: boolean;
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
  name: string;
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
  /** Sprites bound to bodies; tracked by WorldSprites and updated each frame. */
  sprites: SpriteObject[];
  /** Standalone background visuals (Polygon2D meshes + non-body Sprite2D + TileMapLayers + nine-slices). */
  background: { meshes: Container[]; sprites: Sprite[]; tileLayers: Container[]; ninePatches: NineSliceSprite[] };
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

  // Background visuals — Polygon2D meshes, standalone Sprite2D, TileMapLayers
  const bgMeshes: Container[] = [];
  const bgSprites: Sprite[] = [];
  const bgTileLayers: Container[] = [];
  const bgNinePatches: NineSliceSprite[] = [];
  if (spritesEnabled && geo.background && options.container) {
    for (const m of geo.background.meshes) {
      const mesh = instantiateMesh(m, tx, ty, cosT, sinT, ta);
      if (mesh) {
        options.container.addChild(mesh);
        bgMeshes.push(mesh);
      }
    }
    for (const s of geo.background.sprites) {
      const sprite = instantiateBackgroundSprite(s, tx, ty, cosT, sinT, ta);
      if (sprite) {
        options.container.addChild(sprite);
        bgSprites.push(sprite);
      }
    }
    for (const layer of geo.background.tileLayers) {
      const container = instantiateTileLayer(layer, tx, ty, cosT, sinT, ta);
      if (container) {
        options.container.addChild(container);
        bgTileLayers.push(container);
      }
    }
    // `?? []` keeps older geometry blobs (emitted before nine-slice support)
    // loadable — they simply have no `ninePatches` array.
    for (const np of geo.background.ninePatches ?? []) {
      const sprite = instantiateNinePatch(np, tx, ty, cosT, sinT, ta);
      if (sprite) {
        options.container.addChild(sprite);
        bgNinePatches.push(sprite);
      }
    }
  }

  return {
    bodies,
    joints,
    bodiesByName,
    jointsByName,
    sprites,
    background: { meshes: bgMeshes, sprites: bgSprites, tileLayers: bgTileLayers, ninePatches: bgNinePatches },
  };
}

/**
 * D4 tile transform table keyed by the 3-bit alternativeTile flag
 * (bit2=transpose, bit1=flipV, bit0=flipH).
 *
 * Each entry: { rotation (rad), scaleX, scaleY, dx, dy }
 * where dx/dy are added to the tile's pixel position AFTER multiplying by
 * tileSize to keep the transformed sprite inside its cell.
 */
const TILE_TRANSFORMS: ReadonlyArray<{ r: number; sx: number; sy: number; dx: number; dy: number }> = [
  { r: 0, sx: 1, sy: 1, dx: 0, dy: 0 }, // 000 — identity
  { r: 0, sx: -1, sy: 1, dx: 1, dy: 0 }, // 001 — flip H
  { r: 0, sx: 1, sy: -1, dx: 0, dy: 1 }, // 010 — flip V
  { r: 0, sx: -1, sy: -1, dx: 1, dy: 1 }, // 011 — flip H+V (180°)
  { r: -Math.PI / 2, sx: -1, sy: 1, dx: 0, dy: 0 }, // 100 — transpose
  { r: Math.PI / 2, sx: 1, sy: 1, dx: 1, dy: 0 }, // 101 — transpose+H  (90° CW)
  { r: -Math.PI / 2, sx: 1, sy: 1, dx: 0, dy: 1 }, // 110 — transpose+V  (90° CCW)
  { r: Math.PI / 2, sx: -1, sy: 1, dx: 1, dy: 1 }, // 111 — transpose+H+V
];

function instantiateTileLayer(
  def: TileLayerDef,
  tx: number,
  ty: number,
  cosT: number,
  sinT: number,
  ta: number,
): Container | null {
  if (def.tiles.length === 0) return null;
  const container = new Container();
  container.label = def.name;
  const sw = def.tileSize.x;
  const sh = def.tileSize.y;
  for (const tile of def.tiles) {
    let texture: Texture | undefined;
    try {
      texture = Assets.get<Texture>(tile.pixiFrame) ?? Texture.from(tile.pixiFrame);
    } catch {
      console.warn(`[loadGodotGeometry] Tile texture not found: "${tile.pixiFrame}"`);
      continue;
    }
    if (!texture) continue;
    const sprite = new Sprite({ texture });
    const t = TILE_TRANSFORMS[(tile.transform ?? 0) & 0x7];
    sprite.scale.set(t.sx, t.sy);
    sprite.rotation = t.r;
    sprite.position.set((tile.x + t.dx) * sw, (tile.y + t.dy) * sh);
    container.addChild(sprite);
  }
  const localX = def.position.x;
  const localY = def.position.y;
  container.position.set(cosT * localX - sinT * localY + tx, sinT * localX + cosT * localY + ty);
  container.rotation = def.rotation + ta;
  container.scale.set(def.scale.x, def.scale.y);
  if (def.z !== undefined) container.zIndex = def.z;
  return container;
}

/**
 * A textured background polygon. Returns a Container holding the fill (a
 * polygon-masked CompositeTilemap when `tileFill`, otherwise a stretched Mesh)
 * and, optionally, a tiled quad-strip border traced along the outline. Both the
 * fill tiling and the border tile atlas frames correctly — no GPU texture-repeat
 * is used, so the fill/border textures stay regular atlas frames.
 */
function instantiateMesh(
  def: MeshDef,
  tx: number,
  ty: number,
  cosT: number,
  sinT: number,
  ta: number,
): Container | null {
  if (!def.pixiFrame) return null;
  let texture: Texture;
  try {
    texture = Assets.get<Texture>(def.pixiFrame) ?? Texture.from(def.pixiFrame);
  } catch {
    console.warn(`[loadGodotGeometry] Mesh texture not found: "${def.pixiFrame}"`);
    return null;
  }
  if (!texture) return null;

  const fill = def.tileFill ? buildTiledFill(texture, def.vertices) : buildStretchedFill(texture, def);
  if (def.tint !== undefined && 'tint' in fill) (fill as Mesh).tint = def.tint;

  const container = new Container();
  container.label = def.name;
  container.addChild(fill);

  if (def.border) {
    const border = buildBorderStrip(def.border, def.vertices);
    if (border) {
      if (def.tint !== undefined) border.tint = def.tint;
      container.addChild(border);
    }
  }

  // The fill/border geometry stays in node-local space; the container carries
  // the node's spawn transform (translation + rotation + scale).
  const localX = def.position.x;
  const localY = def.position.y;
  container.position.set(cosT * localX - sinT * localY + tx, sinT * localX + cosT * localY + ty);
  container.rotation = def.rotation + ta;
  container.scale.set(def.scale.x, def.scale.y);
  if (def.alpha !== undefined) container.alpha = def.alpha;
  if (def.z !== undefined) container.zIndex = def.z;
  return container;
}

/** Plain stretched fill: one frame mapped across the polygon (legacy Polygon2D behaviour). */
function buildStretchedFill(texture: Texture, def: MeshDef): Mesh {
  const positions = new Float32Array(def.vertices.length * 2);
  for (let i = 0; i < def.vertices.length; i++) {
    positions[i * 2] = def.vertices[i].x;
    positions[i * 2 + 1] = def.vertices[i].y;
  }
  // Normalize UVs from texture pixel space → 0..1.
  const tw = texture.width || 1;
  const th = texture.height || 1;
  const uvs = new Float32Array(def.uvs.length * 2);
  for (let i = 0; i < def.uvs.length; i++) {
    uvs[i * 2] = def.uvs[i].x / tw;
    uvs[i * 2 + 1] = def.uvs[i].y / th;
  }
  const geometry = new MeshGeometry({ positions, uvs, indices: new Uint32Array(def.indices) });
  const mesh = new Mesh({ geometry, texture });
  mesh.label = 'fill';
  return mesh;
}

/**
 * Tiled fill: a CompositeTilemap covering the polygon's bounding box, clipped to
 * the polygon by a Graphics mask. The frame tiles within the atlas correctly
 * because each cell is its own quad (no GPU wrap).
 */
function buildTiledFill(texture: Texture, vertices: V2[]): Container {
  const group = new Container();
  group.label = 'fill';

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }

  const tw = texture.width || 1;
  const th = texture.height || 1;
  const tilemap = new CompositeTilemap();
  // Snap the tiling origin to the grid so cells line up regardless of bbox edges.
  const startX = Math.floor(minX / tw) * tw;
  const startY = Math.floor(minY / th) * th;
  for (let y = startY; y < maxY; y += th) {
    for (let x = startX; x < maxX; x += tw) {
      tilemap.tile(texture, x, y);
    }
  }

  const mask = new Graphics();
  mask.poly(vertices.flatMap((v) => [v.x, v.y])).fill(0xffffff);
  group.addChild(mask);
  group.addChild(tilemap);
  tilemap.mask = mask;
  return group;
}

/**
 * Tiled quad-strip border traced along the polygon edges. Each repeat is a
 * discrete quad mapping the frame's full 0..1 UV, so it tiles an atlas frame
 * without any GPU texture-repeat. The strip is centred on each edge.
 */
function buildBorderStrip(border: MeshBorderDef, vertices: V2[]): Mesh | null {
  if (vertices.length < 2) return null;
  let texture: Texture;
  try {
    texture = Assets.get<Texture>(border.pixiFrame) ?? Texture.from(border.pixiFrame);
  } catch {
    console.warn(`[loadGodotGeometry] Mesh border texture not found: "${border.pixiFrame}"`);
    return null;
  }
  if (!texture) return null;

  const frameW = texture.width || 1;
  const frameH = texture.height || 1;
  const halfWidth = (border.width > 0 ? border.width : frameH) / 2;
  const tileLen = Math.max(1, frameW * (border.textureScale > 0 ? border.textureScale : 1));

  const ring = border.closed ? [...vertices, vertices[0]] : vertices;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vi = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) continue;
    const ax = dx / len; // along-edge unit
    const ay = dy / len;
    const nx = -ay; // edge normal
    const ny = ax;

    for (let dist = 0; dist < len - 1e-3; dist += tileLen) {
      const seg = Math.min(tileLen, len - dist);
      const u = seg / tileLen; // partial quad → clip the U end
      const p0x = a.x + ax * dist;
      const p0y = a.y + ay * dist;
      const p1x = a.x + ax * (dist + seg);
      const p1y = a.y + ay * (dist + seg);
      positions.push(
        p0x + nx * halfWidth,
        p0y + ny * halfWidth, // u=0, v=0
        p1x + nx * halfWidth,
        p1y + ny * halfWidth, // u,   v=0
        p1x - nx * halfWidth,
        p1y - ny * halfWidth, // u,   v=1
        p0x - nx * halfWidth,
        p0y - ny * halfWidth, // u=0, v=1
      );
      uvs.push(0, 0, u, 0, u, 1, 0, 1);
      indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }

  if (indices.length === 0) return null;
  const geometry = new MeshGeometry({
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  });
  const mesh = new Mesh({ geometry, texture });
  mesh.label = `${border.pixiFrame}-border`;
  return mesh;
}

function instantiateBackgroundSprite(
  def: BackgroundSpriteDef,
  tx: number,
  ty: number,
  cosT: number,
  sinT: number,
  ta: number,
): Sprite | null {
  const key = def.pixiFrame ?? def.pixiAnimation;
  if (!key) return null;
  let texture: Texture | undefined;
  try {
    texture = Assets.get<Texture>(key) ?? Texture.from(key);
  } catch {
    console.warn(`[loadGodotGeometry] Background sprite texture not found: "${key}"`);
    return null;
  }
  if (!texture) return null;
  const sprite = new Sprite({ texture });
  sprite.label = def.name;
  sprite.anchor.set(def.anchor.x, def.anchor.y);
  sprite.scale.set(def.scale.x, def.scale.y);
  if (def.flipH) sprite.scale.x *= -1;
  if (def.flipV) sprite.scale.y *= -1;
  if (def.tint !== undefined) sprite.tint = def.tint;
  if (def.alpha !== undefined) sprite.alpha = def.alpha;
  if (def.z !== undefined) sprite.zIndex = def.z;

  const localX = def.position.x;
  const localY = def.position.y;
  sprite.position.set(cosT * localX - sinT * localY + tx, sinT * localX + cosT * localY + ty);
  sprite.rotation = def.rotation + ta;
  return sprite;
}

function instantiateNinePatch(
  def: NinePatchDef,
  tx: number,
  ty: number,
  cosT: number,
  sinT: number,
  ta: number,
): NineSliceSprite | null {
  let texture: Texture | undefined;
  try {
    texture = Assets.get<Texture>(def.pixiFrame) ?? Texture.from(def.pixiFrame);
  } catch {
    console.warn(`[loadGodotGeometry] Nine-slice texture not found: "${def.pixiFrame}"`);
    return null;
  }
  if (!texture) return null;

  const sprite = new NineSliceSprite({
    texture,
    leftWidth: def.borders.left,
    topHeight: def.borders.top,
    rightWidth: def.borders.right,
    bottomHeight: def.borders.bottom,
    width: def.size.x,
    height: def.size.y,
  });
  sprite.label = def.name;
  // NineSliceSprite draws from its top-left; honour Godot's `centered` anchor by
  // pivoting so position/rotation pivot around the same point a Sprite2D would.
  sprite.pivot.set(def.anchor.x * def.size.x, def.anchor.y * def.size.y);
  sprite.scale.set(def.scale.x, def.scale.y);
  if (def.tint !== undefined) sprite.tint = def.tint;
  if (def.alpha !== undefined) sprite.alpha = def.alpha;
  if (def.z !== undefined) sprite.zIndex = def.z;

  const localX = def.position.x;
  const localY = def.position.y;
  sprite.position.set(cosT * localX - sinT * localY + tx, sinT * localX + cosT * localY + ty);
  sprite.rotation = def.rotation + ta;
  return sprite;
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
  sprite.label = binding.name;
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
