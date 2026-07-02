/**
 * Godot → Box2D geometry exporter.
 *
 * Walks .tscn files containing Box2D body / joint nodes (defined by the
 * `godot/box2d/*.gd` scripts), plus their child CollisionShape2D /
 * CollisionPolygon2D / Sprite2D / AnimatedSprite2D nodes, and emits a JSON
 * blob that the runtime loader (`src/lib/loadGodotGeometry.ts`) consumes.
 *
 * Coordinate conversion: Godot is Y-down pixels, Box2D is Y-up meters with
 * PXM = 16. Conversion happens here so the runtime sees pure Box2D meters.
 * Sprite bindings stay in pixels (Pixi space, same Y-down orientation as
 * Godot).
 */

import * as fs from 'fs';
import * as path from 'path';

import type { GodotSpriteMap } from './godot-resources.ts';
import {
  decodeGodotValue,
  decodeTileMapData,
  parsePackedByteArray,
  parsePackedVector2Array,
  parseTransform2D,
  parseTscnSections,
  parseVector2,
  unquote,
  type TscnSection,
} from './godot-tscn.ts';
import { decomposePolygon } from './polygon-decompose.ts';

// Must match src/consts.ts PXM. Pixels per Box2D meter.
const PXM = 16;

// Mapping from script res:// path → body / joint type
const SCRIPT_TO_BODY_TYPE: Record<string, 'static' | 'kinematic' | 'dynamic'> = {
  'res://box2d/box2d_static_body.gd': 'static',
  'res://box2d/box2d_kinematic_body.gd': 'kinematic',
  'res://box2d/box2d_dynamic_body.gd': 'dynamic',
};

// Fallback: infer body type from the Godot built-in node type when a custom
// script (e.g. brick_prefab.gd extending StaticBody2D) is used instead of one
// of the Box2D marker scripts above.
const GODOT_TYPE_TO_BODY_TYPE: Record<string, 'static' | 'kinematic' | 'dynamic'> = {
  StaticBody2D: 'static',
  AnimatableBody2D: 'static',
  CharacterBody2D: 'kinematic',
  RigidBody2D: 'dynamic',
};

function resolveBodyType(n: { scriptResPath?: string; type: string }): 'static' | 'kinematic' | 'dynamic' | undefined {
  if (n.scriptResPath && n.scriptResPath in SCRIPT_TO_BODY_TYPE) return SCRIPT_TO_BODY_TYPE[n.scriptResPath];
  return GODOT_TYPE_TO_BODY_TYPE[n.type];
}

const SCRIPT_TO_JOINT_TYPE: Record<string, 'revolute' | 'prismatic' | 'distance' | 'weld'> = {
  'res://box2d/box2d_revolute_joint.gd': 'revolute',
  'res://box2d/box2d_prismatic_joint.gd': 'prismatic',
  'res://box2d/box2d_distance_joint.gd': 'distance',
  'res://box2d/box2d_weld_joint.gd': 'weld',
};

const BOX2D_ROOT_SCRIPT = 'res://box2d/box2d_root.gd';
const BOX2D_NINE_SLICE_SCRIPT = 'res://box2d/box2d_nine_slice.gd';
const BOX2D_POLYGON_SCRIPT = 'res://box2d/box2d_polygon.gd';
const BOX2D_CURVE_SCRIPT = 'res://box2d/box2d_curve.gd';

// ---------------------------------------------------------------------------
// Output schema (mirrored in src/lib/loadGodotGeometry.ts)
// ---------------------------------------------------------------------------

export interface Box2DGeometry {
  gravity?: V2;
  bodies: Box2DBodyDef[];
  joints: Box2DJointDef[];
  /** Visual-only visuals elements (Polygon2D meshes, standalone Sprite2D/AnimatedSprite2D). */
  visuals?: VisualsDef;
}

export interface VisualsDef {
  /** Polygon2D nodes (textured polygons) not under a body. Rendered as Pixi Meshes. */
  meshes: MeshDef[];
  /** Sprite2D / AnimatedSprite2D nodes not under a body. Stand-alone visual sprites. */
  sprites: VisualSpriteDef[];
  /** TileMapLayer nodes, flattened to per-cell sprite placements. */
  tileLayers: TileLayerDef[];
  /** Box2DNineSlice nodes, rendered as Pixi NineSliceSprites. */
  ninePatches: NinePatchDef[];
}

/**
 * A stretchable nine-slice authored as a Box2DNineSlice node (a Sprite2D with
 * the box2d_nine_slice.gd script). The texture resolves to a Pixi frame and the
 * non-stretching `borders` come from the aseprite slice layer (threaded through
 * sprite-map.json). `size` is the stretched target; the runtime instantiates a
 * NineSliceSprite at that size with the corners pinned by `borders`.
 */
export interface NinePatchDef {
  name: string;
  pixiFrame: string;
  /** Atlas alias for `pixiFrame`. */
  pixiAtlas?: string;
  position: V2;
  rotation: number;
  scale: V2;
  anchor: V2;
  /** Non-stretching border widths in texture pixels. */
  borders: { left: number; top: number; right: number; bottom: number };
  /** Tile (repeat) the center region instead of stretching it. */
  tileCenter?: boolean;
  z?: number;
  tint?: number;
  alpha?: number;
}

/**
 * Flat dump of a Godot TileMapLayer. Each tile is its own placement with the
 * Pixi frame name pre-resolved against the tilesheet metadata in sprite-map.
 * The runtime just instantiates a Sprite at (cellX * tileSize.x, cellY *
 * tileSize.y) for each entry — no atlas-slicing at runtime.
 */
export interface TileLayerDef {
  name: string;
  position: V2;
  rotation: number;
  scale: V2;
  tileSize: V2;
  z?: number;
  tiles: TilePlacement[];
  /**
   * Optional clip polygon (this layer's local pixel space). Present when the
   * layer is a child of a Box2DPolygon/Box2DCurve with `mask_children = true`;
   * the runtime masks the tile container to this outline.
   */
  clip?: V2[];
}

export interface TilePlacement {
  /** Cell coordinates in the layer, in tile units (not pixels). */
  x: number;
  y: number;
  /** Pre-resolved Pixi frame name (e.g. `"level-1_spritesheet_23#0"`). */
  pixiFrame: string;
  /**
   * D4 transform key (0–7) from Godot's alternativeTile bits 12–14.
   * Bit layout: bit2=transpose, bit1=flipV, bit0=flipH.
   * 0 means no transform (omitted from JSON when zero).
   */
  transform?: number;
}

/**
 * A textured polygon authored as a Godot Polygon2D. Vertices and UVs are in
 * Godot pixel space; UVs are normalized at runtime against the resolved texture
 * dimensions. Indices are pre-triangulated (fan from vertex 0 — assumes the
 * polygon is convex; concave polygons will need earcut later).
 */
export interface MeshDef {
  name: string;
  position: V2;
  rotation: number;
  scale: V2;
  vertices: V2[]; // Godot pixel space, relative to the mesh node
  uvs: V2[]; // Same length as vertices, in texture pixel space
  indices: number[]; // Triangle vertex indices
  pixiFrame?: string;
  /** Atlas alias for `pixiFrame` (frame names aren't globally unique). */
  pixiAtlas?: string;
  z?: number;
  tint?: number;
  alpha?: number;
  /**
   * Tile the fill texture across the polygon instead of stretching one frame
   * over it. Rendered at runtime as a grid of tile sprites clipped to the
   * polygon by a mask, so ordinary atlas frames tile correctly.
   */
  tileFill?: boolean;
  /** Optional tiled quad-strip border traced along the polygon outline (`vertices`). */
  border?: MeshBorderDef;
  /** Render after tile layers (e.g. a mask_children border that frames its tilemap). */
  overlay?: boolean;
}

/**
 * A strip texture tiled along a polygon's outline, rendered at runtime as a
 * tiled quad-strip mesh whose path is the mesh `vertices`.
 */
export interface MeshBorderDef {
  pixiFrame: string;
  /** Atlas alias for `pixiFrame`. */
  pixiAtlas?: string;
  /** Strip thickness in pixels. 0 → fall back to the texture's height. */
  width: number;
  /** Scales the length of each repeated tile along the edge (1 = one frame width). */
  textureScale: number;
  /** Close the strip back to the first vertex so it wraps the whole shape. */
  closed: boolean;
  /** Optional frame stamped at each corner (oriented to the bisector) over the joint. */
  cornerFrame?: string;
  /** Atlas alias for `cornerFrame`. */
  cornerAtlas?: string;
  /** Only stamp a corner piece when the turn deviates by ≥ this many degrees (0 = always). */
  cornerMinAngle?: number;
  /** Corner size in px (x = along the outline, y = across). Each axis falls back to the strip width when ≤ 0. */
  cornerSize?: V2;
  /** Corner rotation: 'free' = bisector tangent (default), 'snap' = nearest 90°, 'none' = unrotated. */
  cornerOrientation?: 'free' | 'snap' | 'none';
}

/**
 * A free-standing sprite — Sprite2D or AnimatedSprite2D placed in the scene
 * tree but not as a child of any Box2D body. Position is in world space (Godot
 * pixels). Used for backdrop decor: signs, fish, single-instance props.
 */
export interface VisualSpriteDef {
  name: string;
  pixiFrame?: string;
  pixiAnimation?: string;
  /** Atlas alias for `pixiFrame`. */
  pixiAtlas?: string;
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
  /** Atlas alias for `pixiFrame`. */
  pixiAtlas?: string;
  offset: V2;
  rotation: number;
  scale: V2;
  anchor: V2;
  z?: number;
  tint?: number;
  alpha?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** If false, the sprite stays axis-aligned regardless of body rotation. */
  shouldRotate?: boolean;
  /** Render as a NineSliceSprite stretched by `scale` (Box2DNineSlice under a body). */
  nineSlice?: boolean;
  /** Nine-slice border widths in texture px (only meaningful with `nineSlice`). */
  borders?: { left: number; top: number; right: number; bottom: number };
  /** Tile (repeat) the nine-slice center instead of stretching it. */
  tileCenter?: boolean;
}

export type Box2DJointDef =
  | RevoluteJointDef
  | PrismaticJointDef
  | DistanceJointDef
  | WeldJointDef;

interface CommonJointFields {
  name: string;
  bodyA: number;
  bodyB: number;
  anchorA: V2;
  anchorB: V2;
  collideConnected?: boolean;
}

export interface RevoluteJointDef extends CommonJointFields {
  type: 'revolute';
  referenceAngle?: number;
  enableLimit?: boolean;
  lowerLimit?: number;
  upperLimit?: number;
  enableMotor?: boolean;
  motorSpeed?: number;
  maxMotorTorque?: number;
}

export interface PrismaticJointDef extends CommonJointFields {
  type: 'prismatic';
  referenceAngle?: number;
  localAxisA: V2;
  enableLimit?: boolean;
  lowerLimit?: number;
  upperLimit?: number;
  enableMotor?: boolean;
  motorSpeed?: number;
  maxMotorForce?: number;
}

export interface DistanceJointDef extends CommonJointFields {
  type: 'distance';
  length: number;
  frequency?: number;
  dampingRatio?: number;
}

export interface WeldJointDef extends CommonJointFields {
  type: 'weld';
  referenceAngle?: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Recursively collect all .tscn files under a directory. */
function walkTscnFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTscnFiles(full));
    } else if (entry.name.endsWith('.tscn')) {
      results.push(full);
    }
  }
  return results;
}

export function generateGeometryJsonFiles(
  geometryDir: string,
  outputDir: string,
  spriteMapPath: string,
  typesOutputPath: string,
): void {
  if (!fs.existsSync(geometryDir)) return;

  const spriteMap: GodotSpriteMap = fs.existsSync(spriteMapPath)
    ? JSON.parse(fs.readFileSync(spriteMapPath, 'utf-8'))
    : {};

  fs.mkdirSync(outputDir, { recursive: true });

  const tscnFiles = walkTscnFiles(geometryDir);
  const parsed = new Map<string, Box2DGeometry>();
  const godotRoot = path.resolve(path.dirname(path.resolve(geometryDir)));
  const subsceneCache = new Map<string, Box2DGeometry>();

  for (const filePath of tscnFiles) {
    // Use the path relative to geometryDir (forward-slash, no extension) as the key,
    // e.g. "0-theDepths/level-0" so GeometryBodyMap keys are stable and unique.
    const relPath = path.relative(geometryDir, filePath).replace(/\\/g, '/');
    const name = relPath.replace(/\.tscn$/, '');
    const content = fs.readFileSync(filePath, 'utf-8');
    const geometry = parseGeometryTscn(content, spriteMap, { godotRoot, subsceneCache });
    lintGeometry(name, geometry);
    const outFile = path.join(outputDir, name + '.json');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(geometry, null, 2));
    parsed.set(name, geometry);
    console.log(
      `[Godot] Geometry → ${name}.json (${geometry.bodies.length} body, ${geometry.joints.length} joint)`,
    );
  }

  writeGeometryTypes(parsed, typesOutputPath);
}

// ---------------------------------------------------------------------------
// Validation lints — surface common authoring mistakes during build
// ---------------------------------------------------------------------------

function lintGeometry(name: string, geo: Box2DGeometry): void {
  // Duplicate body names — gameplay uses `bodies.find(b => b.name === ...)`,
  // duplicates make those lookups silently pick the first match.
  const nameCount = new Map<string, number>();
  for (const b of geo.bodies) nameCount.set(b.name, (nameCount.get(b.name) ?? 0) + 1);
  for (const [bodyName, count] of nameCount) {
    if (count > 1) console.warn(`[Godot] ${name}: duplicate body name "${bodyName}" (${count}×)`);
  }

  // Dynamic body with no fixtures — it'll spawn but never collide with anything.
  for (const b of geo.bodies) {
    if (b.type === 'dynamic' && b.fixtures.length === 0) {
      console.warn(`[Godot] ${name}: dynamic body "${b.name}" has no fixtures`);
    }
  }

  // Polygons with > 8 vertices — Box2D's per-fixture vertex cap. The exporter
  // decomposes concave polygons, but a convex polygon with too many vertices
  // would slip through.
  for (const b of geo.bodies) {
    for (let i = 0; i < b.fixtures.length; i++) {
      const fx = b.fixtures[i];
      if (fx.shape === 'polygon' && fx.vertices.length > 8) {
        console.warn(
          `[Godot] ${name}: body "${b.name}" fixture[${i}] has ${fx.vertices.length} vertices (Box2D max is 8)`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Type-aug emitter
// ---------------------------------------------------------------------------

function writeGeometryTypes(geometries: Map<string, Box2DGeometry>, outputPath: string): void {
  if (geometries.size === 0) return;

  const lines: string[] = [
    `// AUTO-GENERATED by the asset pipeline — do not edit manually`,
    ``,
    `/** Body names per geometry file, for autocomplete on bodiesByName.get(...). */`,
    `export type GeometryBodyMap = {`,
  ];
  for (const [name, geo] of geometries) {
    const bodyNames = geo.bodies.map((b) => `'${b.name}'`).filter((s, i, arr) => arr.indexOf(s) === i);
    lines.push(`  '${name}': ${bodyNames.length ? bodyNames.join(' | ') : 'never'};`);
  }
  lines.push(`};`, ``);

  lines.push(`/** Joint names per geometry file, for autocomplete on jointsByName.get(...). */`);
  lines.push(`export type GeometryJointMap = {`);
  for (const [name, geo] of geometries) {
    const jointNames = geo.joints.map((j) => `'${j.name}'`).filter((s, i, arr) => arr.indexOf(s) === i);
    lines.push(`  '${name}': ${jointNames.length ? jointNames.join(' | ') : 'never'};`);
  }
  lines.push(`};`, ``);

  emitBodyUserDataUnion(geometries, lines);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`[Godot] Geometry types → ${outputPath}`);
}

/**
 * Emit `GeometryBodyUserData` — a discriminated union over every distinct
 * `userData.type` value seen across all geometry files. Each variant lists all
 * `userData.*` keys ever observed on bodies of that type, with each value
 * collapsed to a literal-or-primitive union.
 *
 * Example:
 *   export type GeometryBodyUserData =
 *     | { type: 'brick'; powerup?: 'yellow' | 'blue' | 'green'; behaviour?: 'strong' }
 *     | { type: 'door'; doorName?: 'door-a' | 'door-b' | 'door-c' }
 *     | { type: 'wall'; size?: number };
 */
function emitBodyUserDataUnion(geometries: Map<string, Box2DGeometry>, lines: string[]): void {
  // Map<discriminator, Map<key, Set<rendered value literal>>>
  const byType = new Map<string, Map<string, Set<string>>>();
  const untyped = new Map<string, Set<string>>(); // bodies with no `type` key

  for (const geo of geometries.values()) {
    for (const b of geo.bodies) {
      const ud = b.userData ?? {};
      const typeVal = ud['type'];
      const bucket = typeof typeVal === 'string' ? typeVal : null;
      const target = bucket === null ? untyped : (byType.get(bucket) ?? new Map<string, Set<string>>());
      if (bucket !== null && !byType.has(bucket)) byType.set(bucket, target);
      for (const [k, v] of Object.entries(ud)) {
        if (k === 'type') continue;
        let values = target.get(k);
        if (!values) {
          values = new Set();
          target.set(k, values);
        }
        values.add(renderTsLiteral(v));
      }
    }
  }

  lines.push(`/**`);
  lines.push(` * Discriminated union of every userData shape seen on bodies across all geometry`);
  lines.push(` * files. The \`type\` discriminator is the entity tag; the other keys are every`);
  lines.push(` * \`user_data\` key ever set on a body of that type. Drives entity dispatch in`);
  lines.push(` * \`BreakoutPhysics\` — adding a new type in Godot widens this union and breaks`);
  lines.push(` * exhaustive switches at type-check time.`);
  lines.push(` */`);
  lines.push(`export type GeometryBodyUserData =`);

  const sortedTypes = [...byType.keys()].sort();
  const variants: string[] = [];
  for (const t of sortedTypes) {
    const keys = byType.get(t)!;
    const parts: string[] = [`type: '${t}'`];
    for (const [k, valSet] of [...keys.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const values = [...valSet].sort();
      parts.push(`${jsKey(k)}?: ${values.join(' | ')}`);
    }
    variants.push(`  | { ${parts.join('; ')} }`);
  }
  if (untyped.size > 0 || sortedTypes.length === 0) {
    // Bodies without a `type` discriminator (or no bodies at all yet).
    const parts: string[] = [`type?: undefined`];
    for (const [k, valSet] of [...untyped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const values = [...valSet].sort();
      parts.push(`${jsKey(k)}?: ${values.join(' | ')}`);
    }
    variants.push(`  | { ${parts.join('; ')} }`);
  }
  lines.push(...variants);
  lines.push(``);
  lines.push(`/** Distinct \`userData.type\` values seen across every authored body. */`);
  lines.push(`export type GeometryEntityType = GeometryBodyUserData extends { type: infer T } ? T : never;`);
  lines.push(``);
}

/** Render a JS value as a TypeScript type literal (string → "'foo'", number → "10", etc.). */
function renderTsLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Anything else (object/array) — collapse to a plain type rather than a literal.
  if (Array.isArray(v)) return 'unknown[]';
  return 'Record<string, unknown>';
}

/** Quote a key only when it isn't a valid bare identifier. */
function jsKey(k: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k.replace(/'/g, "\\'")}'`;
}

// ---------------------------------------------------------------------------
// .tscn parsing
// ---------------------------------------------------------------------------

interface NodeInfo {
  name: string;
  type: string; // Godot built-in type, e.g. "Node2D", "Sprite2D", "CollisionShape2D"
  parentPath: string; // empty string for root, "." for root's direct children
  fullPath: string; // ".", "Body", "Body/Shape"
  scriptResId?: string;
  scriptResPath?: string; // resolved res:// path
  /** When set, this node is an instance of another .tscn (PackedScene). */
  instanceResPath?: string;
  props: Map<string, string>;
}

export interface ParseGeometryOptions {
  /** Absolute path to the godot/ project root, used to resolve `res://` paths. */
  godotRoot?: string;
  /** Cache of already-parsed subscenes, keyed by absolute path. */
  subsceneCache?: Map<string, Box2DGeometry>;
}

export function parseGeometryTscn(
  content: string,
  spriteMap: GodotSpriteMap,
  options: ParseGeometryOptions = {},
): Box2DGeometry {
  const sections: TscnSection[] = parseTscnSections(content);

  // Resolve ExtResources: id → { path, type }
  const extResources: Record<string, string> = {};
  const extResourceTypes: Record<string, string> = {};
  for (const s of sections) {
    if (s.type !== 'ext_resource') continue;
    const id = unquote(s.attrs.id ?? '');
    const resPath = unquote(s.attrs.path ?? '');
    const resType = unquote(s.attrs.type ?? '');
    if (id && resPath) {
      extResources[id] = resPath;
      if (resType) extResourceTypes[id] = resType;
    }
  }

  // Resolve sub_resource shapes: id → shape data
  // Also keep a full index of all sub_resource sections so inline TileSet/
  // TileSetAtlasSource definitions can be resolved without reading a .tres file.
  const subShapes: Record<string, SubShape> = {};
  const subResections: Record<string, TscnSection> = {};
  for (const s of sections) {
    if (s.type !== 'sub_resource') continue;
    const id = unquote(s.attrs.id ?? '');
    const type = unquote(s.attrs.type ?? '');
    if (!id) continue;
    subResections[id] = s;
    if (type === 'RectangleShape2D') {
      const size = parseVector2(s.props.get('size') ?? '') ?? { x: 20, y: 20 };
      subShapes[id] = { kind: 'rect', size };
    } else if (type === 'CircleShape2D') {
      const radius = parseFloat(s.props.get('radius') ?? '10');
      subShapes[id] = { kind: 'circle', radius };
    } else if (type === 'ConvexPolygonShape2D') {
      const points = parsePackedVector2Array(s.props.get('points') ?? '');
      subShapes[id] = { kind: 'convex', points };
    }
  }

  // Build node list with resolved full paths
  const nodes: NodeInfo[] = [];
  for (const s of sections) {
    if (s.type !== 'node') continue;
    const name = unquote(s.attrs.name ?? '');
    const type = unquote(s.attrs.type ?? 'Node');
    const parentAttr = s.attrs.parent !== undefined ? unquote(s.attrs.parent) : '';
    const scriptResId = s.props.get('script')?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    const scriptResPath = scriptResId ? extResources[scriptResId] : undefined;
    const instanceMatch = s.attrs.instance?.match(/ExtResource\("([^"]+)"\)/);
    const instanceResId = instanceMatch?.[1];
    const instanceResPath =
      instanceResId && extResourceTypes[instanceResId] === 'PackedScene' ? extResources[instanceResId] : undefined;

    const parentPath = parentAttr; // '' for root, '.' for direct children of root, 'Body' for grand-children, etc.
    let fullPath: string;
    if (parentPath === '') {
      fullPath = '.';
    } else if (parentPath === '.') {
      fullPath = name;
    } else {
      fullPath = `${parentPath}/${name}`;
    }
    nodes.push({ name, type, parentPath, fullPath, scriptResId, scriptResPath, instanceResPath, props: s.props });
  }

  // Pre-compute global transforms for all nodes (Godot pixel space)
  const nodeByPath = new Map<string, NodeInfo>();
  for (const n of nodes) nodeByPath.set(n.fullPath, n);
  const globalTransforms = new Map<string, GTransform>();
  for (const n of nodes) globalTransforms.set(n.fullPath, computeGlobalTransform(n, nodeByPath, globalTransforms));

  // Build sprite-map reverse lookup
  const godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }> = {};
  for (const entry of Object.values(spriteMap)) {
    godotPathToPixi[entry.godotPath] = { frame: entry.pixiFrame, anim: entry.pixiAnimation, atlas: entry.atlas };
  }

  // Reverse lookup: texture .tres path → 9-slice borders (from the aseprite slice
  // layer, threaded through sprite-map.json). Used by both body-attached and
  // visuals Box2DNineSlice nodes.
  const godotPathToBorders: Record<string, NinePatchDef['borders']> = {};
  for (const entry of Object.values(spriteMap)) {
    if (entry.borders) godotPathToBorders[entry.godotPath] = entry.borders;
  }

  // Identify local body nodes (Box2D-scripted OR plain Godot physics body types
  // whose script isn't one of the marker scripts, e.g. custom prefab scripts
  // that extend StaticBody2D / RigidBody2D / CharacterBody2D).
  const bodyNodes: NodeInfo[] = nodes.filter((n) => resolveBodyType(n) !== undefined);

  // Build local body defs
  const bodies: Box2DBodyDef[] = bodyNodes.map((bodyNode) =>
    buildBodyDef(bodyNode, nodes, subShapes, extResources, godotPathToPixi, godotPathToBorders, globalTransforms),
  );

  // Map from local body fullPath → body index in output bodies array
  const bodyPathToIndex = new Map<string, number>();
  bodyNodes.forEach((n, i) => bodyPathToIndex.set(n.fullPath, i));

  const joints: Box2DJointDef[] = [];

  // Inline subscene instances. For each instance node:
  //   - load (and cache) the subscene's Box2DGeometry
  //   - apply the instance's global transform to each subscene body's position/angle
  //   - prefix subscene body names with "<instance>/" to keep them unique
  //   - shift joint bodyA/bodyB indices by the current bodies array length
  //   - merge the subscene's visual elements, transformed into parent space
  // Subscene NodePaths are already resolved internally (during the recursive
  // parseGeometryTscn call), so we don't need to re-rewrite them.
  const subVisuals: VisualsDef = { meshes: [], sprites: [], tileLayers: [], ninePatches: [] };
  const instanceNodes = nodes.filter((n) => n.instanceResPath !== undefined);
  for (const instNode of instanceNodes) {
    const subPath = resolveResPath(instNode.instanceResPath!, options.godotRoot);
    if (!subPath) continue;
    let subGeo = options.subsceneCache?.get(subPath);
    if (!subGeo) {
      if (!fs.existsSync(subPath)) {
        console.warn(`[Godot] Subscene not found: ${subPath}`);
        continue;
      }
      const subContent = fs.readFileSync(subPath, 'utf-8');
      subGeo = parseGeometryTscn(subContent, spriteMap, options);
      options.subsceneCache?.set(subPath, subGeo);
    }

    // Collect property overrides from the instance node. In Godot 4, properties
    // set on the [node ... instance=...] section are overrides for the root node
    // of the subscene. We merge them into every inlined body's userData so that
    // per-placement customisation (e.g. `behaviour`, `doorName`) reaches the
    // runtime. The instance's `type` export also wins over the subscene default.
    const instUserData = collectUserData(instNode);
    const instTypeExport = decodeGodotValue(instNode.props.get('type') ?? '""');
    if (typeof instTypeExport === 'string' && instTypeExport !== '') {
      instUserData['type'] = instTypeExport;
    }
    const hasOverrides = Object.keys(instUserData).length > 0;

    const instGT = globalTransforms.get(instNode.fullPath)!;
    const baseIndex = bodies.length;
    for (const subBody of subGeo.bodies) {
      // subBody.position is in subscene root's Box2D meters. Transform by the
      // instance's global Godot transform, then convert to outer Box2D meters.
      const subPxX = subBody.position.x * PXM;
      const subPxY = -subBody.position.y * PXM;
      const cosI = Math.cos(instGT.rotation);
      const sinI = Math.sin(instGT.rotation);
      const worldPxX = instGT.origin.x + cosI * subPxX - sinI * subPxY;
      const worldPxY = instGT.origin.y + sinI * subPxX + cosI * subPxY;
      bodies.push({
        ...subBody,
        name: `${instNode.name}/${subBody.name}`,
        position: { x: worldPxX / PXM, y: -worldPxY / PXM },
        angle: subBody.angle - instGT.rotation,
        // Instance-level overrides win over the subscene's own userData/type.
        userData: hasOverrides ? { ...subBody.userData, ...instUserData } : subBody.userData,
      });
    }
    for (const subJoint of subGeo.joints) {
      // Shift body indices to point into the merged array; everything else
      // (anchors are body-local, limits are scalar) stays unchanged.
      joints.push({
        ...subJoint,
        name: `${instNode.name}/${subJoint.name}`,
        bodyA: subJoint.bodyA + baseIndex,
        bodyB: subJoint.bodyB + baseIndex,
      } as Box2DJointDef);
    }

    // Visual elements stay in Godot pixel space (no PXM / Y-flip), so compose
    // the instance's global transform directly with each item's local transform.
    if (subGeo.visuals) {
      const cosI = Math.cos(instGT.rotation);
      const sinI = Math.sin(instGT.rotation);
      const place = <T extends { name: string; position: V2; rotation: number; scale: V2 }>(item: T): T => {
        const lx = item.position.x * instGT.scale.x;
        const ly = item.position.y * instGT.scale.y;
        return {
          ...item,
          name: `${instNode.name}/${item.name}`,
          position: { x: instGT.origin.x + cosI * lx - sinI * ly, y: instGT.origin.y + sinI * lx + cosI * ly },
          rotation: item.rotation + instGT.rotation,
          scale: { x: item.scale.x * instGT.scale.x, y: item.scale.y * instGT.scale.y },
        };
      };
      for (const m of subGeo.visuals.meshes) subVisuals.meshes.push(place(m));
      for (const s of subGeo.visuals.sprites) subVisuals.sprites.push(place(s));
      for (const t of subGeo.visuals.tileLayers) subVisuals.tileLayers.push(place(t));
      for (const np of subGeo.visuals.ninePatches) subVisuals.ninePatches.push(place(np));
    }
  }

  // Build local joint defs (after subscene merge so indices are stable)
  for (const n of nodes) {
    if (!n.scriptResPath || !(n.scriptResPath in SCRIPT_TO_JOINT_TYPE)) continue;
    const j = buildJointDef(n, nodes, bodyPathToIndex, globalTransforms);
    if (j) joints.push(j);
  }

  // Scene-level gravity from Box2DRoot's `gravity` export.
  const root = nodes.find((n) => n.parentPath === '');
  let gravity: V2 | undefined;
  if (root && root.scriptResPath === BOX2D_ROOT_SCRIPT) {
    const gravProp = root.props.get('gravity');
    if (gravProp) {
      const decoded = decodeGodotValue(gravProp);
      if (decoded && typeof decoded === 'object' && 'x' in decoded && 'y' in decoded) {
        gravity = decoded as V2;
      }
    }
  }

  // Visuals: Polygon2D meshes + standalone Sprite2D/AnimatedSprite2D not
  // under a body. We identify "under a body" by walking up the parent chain
  // to either a body node or the root.
  const bodyPaths = new Set(bodyNodes.map((n) => n.fullPath));
  const isUnderBody = (path: string): boolean => {
    let cur = path;
    while (cur && cur !== '.') {
      if (bodyPaths.has(cur)) return true;
      const slash = cur.lastIndexOf('/');
      cur = slash >= 0 ? cur.slice(0, slash) : '.';
    }
    return false;
  };

  const ownVisuals = buildVisuals(
    nodes,
    isUnderBody,
    extResources,
    subResections,
    godotPathToPixi,
    globalTransforms,
    spriteMap,
    options.godotRoot,
  );

  // Combine this scene's own visual elements with those merged in from
  // instanced subscenes (e.g. a Box2DPolygon authored in a reusable .tscn).
  const hasSubVisuals =
    subVisuals.meshes.length > 0 ||
    subVisuals.sprites.length > 0 ||
    subVisuals.tileLayers.length > 0 ||
    subVisuals.ninePatches.length > 0;
  let visuals: VisualsDef | null | undefined = ownVisuals;
  if (hasSubVisuals) {
    visuals = {
      meshes: [...(ownVisuals?.meshes ?? []), ...subVisuals.meshes],
      sprites: [...(ownVisuals?.sprites ?? []), ...subVisuals.sprites],
      tileLayers: [...(ownVisuals?.tileLayers ?? []), ...subVisuals.tileLayers],
      ninePatches: [...(ownVisuals?.ninePatches ?? []), ...subVisuals.ninePatches],
    };
  }

  return { gravity, bodies, joints, ...(visuals ? { visuals } : {}) };
}

// ---------------------------------------------------------------------------
// Body builder
// ---------------------------------------------------------------------------

function buildBodyDef(
  bodyNode: NodeInfo,
  allNodes: NodeInfo[],
  subShapes: Record<string, SubShape>,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  godotPathToBorders: Record<string, NinePatchDef['borders']>,
  globalTransforms: Map<string, GTransform>,
): Box2DBodyDef {
  const type = resolveBodyType(bodyNode)!;
  const gt = globalTransforms.get(bodyNode.fullPath)!;

  const position: V2 = { x: gt.origin.x / PXM, y: -gt.origin.y / PXM };
  const angle = -gt.rotation;

  // Direct children only (avoid stealing children of nested bodies)
  const childPaths = collectChildPaths(bodyNode.fullPath, allNodes);

  const fixtures: Box2DFixtureDef[] = [];
  const sprites: SpriteBinding[] = [];
  for (const childPath of childPaths) {
    const child = allNodes.find((n) => n.fullPath === childPath)!;
    if (child.type === 'CollisionShape2D' || child.type === 'CollisionPolygon2D') {
      fixtures.push(...buildFixtures(child, bodyNode, subShapes, globalTransforms));
    } else if (child.type === 'Sprite2D' || child.type === 'AnimatedSprite2D') {
      // `attached = false` on a Box2DSprite marks it as editor-only reference
      // art (silhouettes you're tracing); the exporter skips it entirely.
      const attachedProp = child.props.get('attached');
      if (attachedProp !== undefined && decodeGodotValue(attachedProp) === false) continue;
      const binding = buildSpriteBinding(child, bodyNode, extResources, godotPathToPixi, godotPathToBorders, globalTransforms);
      if (binding) sprites.push(binding);
    }
  }

  // Body-level userData. Merges the explicit `type` @export (introduced for
  // prefab-friendly typed Inspector overrides) into the user_data dict — the
  // explicit field wins so prefabs can override `type` without re-stating the
  // whole dict.
  const userData = collectUserData(bodyNode);
  const typeExport = decodeGodotValue(bodyNode.props.get('type') ?? '""');
  if (typeof typeExport === 'string' && typeExport !== '') {
    userData['type'] = typeExport;
  }

  // Body-level Box2D flags from script exports (stored as direct props on the node)
  const out: Box2DBodyDef = {
    name: bodyNode.name,
    type,
    position,
    angle,
    userData,
    fixtures,
    sprites,
  };

  const readBool = (key: string): boolean | undefined => {
    const raw = bodyNode.props.get(key);
    if (raw === undefined) return undefined;
    const v = decodeGodotValue(raw);
    return typeof v === 'boolean' ? v : undefined;
  };
  const readFloat = (key: string): number | undefined => {
    const raw = bodyNode.props.get(key);
    if (raw === undefined) return undefined;
    const v = decodeGodotValue(raw);
    return typeof v === 'number' ? v : undefined;
  };

  const fixedRotation = readBool('fixed_rotation');
  if (fixedRotation !== undefined) out.fixedRotation = fixedRotation;
  const bullet = readBool('bullet');
  if (bullet !== undefined) out.bullet = bullet;
  const allowSleep = readBool('allow_sleep');
  if (allowSleep !== undefined) out.allowSleep = allowSleep;
  const linDamp = readFloat('linear_damping');
  if (linDamp !== undefined) out.linearDamping = linDamp;
  const angDamp = readFloat('angular_damping');
  if (angDamp !== undefined) out.angularDamping = angDamp;
  const gravScale = readFloat('gravity_scale');
  if (gravScale !== undefined) out.gravityScale = gravScale;

  return out;
}

function buildFixtures(
  shapeNode: NodeInfo,
  bodyNode: NodeInfo,
  subShapes: Record<string, SubShape>,
  globalTransforms: Map<string, GTransform>,
): Box2DFixtureDef[] {
  const material = collectMaterial(shapeNode);
  const userData = collectUserData(shapeNode);
  const localTransform = transformInBody(shapeNode, bodyNode, globalTransforms);

  if (shapeNode.type === 'CollisionShape2D') {
    const shapeProp = shapeNode.props.get('shape');
    const subId = shapeProp?.match(/SubResource\("([^"]+)"\)/)?.[1];
    if (!subId) return [];
    const sub = subShapes[subId];
    if (!sub) return [];

    if (sub.kind === 'circle') {
      const center: V2 = { x: localTransform.origin.x / PXM, y: -localTransform.origin.y / PXM };
      // Circle radius scales with the average of x/y scale
      const r = (sub.radius * (Math.abs(localTransform.scale.x) + Math.abs(localTransform.scale.y))) / 2 / PXM;
      return [
        { shape: 'circle', center, radius: r, material, ...(Object.keys(userData).length ? { userData } : {}) },
      ];
    }
    if (sub.kind === 'rect') {
      const hx = (sub.size.x / 2) * localTransform.scale.x;
      const hy = (sub.size.y / 2) * localTransform.scale.y;
      const cornersLocal: V2[] = [
        { x: -hx, y: -hy },
        { x: hx, y: -hy },
        { x: hx, y: hy },
        { x: -hx, y: hy },
      ];
      const verts = cornersLocal.map((p) => transformAndMeters(p, localTransform.rotation, localTransform.origin));
      return [
        { shape: 'polygon', vertices: verts, material, ...(Object.keys(userData).length ? { userData } : {}) },
      ];
    }
    if (sub.kind === 'convex') {
      const verts = sub.points
        .map((p) => ({ x: p.x * localTransform.scale.x, y: p.y * localTransform.scale.y }))
        .map((p) => transformAndMeters(p, localTransform.rotation, localTransform.origin));
      return [
        { shape: 'polygon', vertices: verts, material, ...(Object.keys(userData).length ? { userData } : {}) },
      ];
    }
    return [];
  }

  if (shapeNode.type === 'CollisionPolygon2D') {
    const polygon = parsePackedVector2Array(shapeNode.props.get('polygon') ?? '');
    const buildMode = parseInt(unquote(shapeNode.props.get('build_mode') ?? '0'), 10);
    const scaledLocal = polygon.map((p) => ({ x: p.x * localTransform.scale.x, y: p.y * localTransform.scale.y }));
    const bodyLocal = scaledLocal.map((p) => transformAndMeters(p, localTransform.rotation, localTransform.origin));

    if (buildMode === 1) {
      // SEGMENTS — chain
      return [
        {
          shape: 'chain',
          vertices: bodyLocal,
          loop: false,
          material,
          ...(Object.keys(userData).length ? { userData } : {}),
        },
      ];
    }
    // SOLIDS — convex polygon, decompose if necessary
    const pieces = decomposePolygon(bodyLocal);
    return pieces.map((piece) => ({
      shape: 'polygon' as const,
      vertices: piece,
      material,
      ...(Object.keys(userData).length ? { userData } : {}),
    }));
  }

  return [];
}

function buildSpriteBinding(
  spriteNode: NodeInfo,
  bodyNode: NodeInfo,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  godotPathToBorders: Record<string, NinePatchDef['borders']>,
  globalTransforms: Map<string, GTransform>,
): SpriteBinding | null {
  const local = transformInBody(spriteNode, bodyNode, globalTransforms);

  // Resolve texture
  let pixiFrame: string | undefined;
  let pixiAnimation: string | undefined;
  let pixiAtlas: string | undefined;
  let texResPath: string | undefined;
  if (spriteNode.type === 'Sprite2D') {
    const texProp = spriteNode.props.get('texture');
    const extId = texProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (extId && extResources[extId]) {
      texResPath = extResources[extId];
      const resolved = godotPathToPixi[texResPath];
      if (resolved) {
        pixiFrame = resolved.frame;
        pixiAnimation = resolved.anim;
        pixiAtlas = resolved.atlas;
      }
    }
  } else if (spriteNode.type === 'AnimatedSprite2D') {
    const framesProp = spriteNode.props.get('sprite_frames');
    const extId = framesProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (extId && extResources[extId]) {
      const resolved = godotPathToPixi[extResources[extId]];
      if (resolved) {
        pixiFrame = resolved.frame;
        pixiAnimation = resolved.anim;
        pixiAtlas = resolved.atlas;
      }
    }
  }
  if (!pixiFrame && !pixiAnimation) return null;

  // Godot Sprite2D's `centered` is true by default → anchor (0.5, 0.5).
  // Pixi defaults anchor to (0, 0), so we always emit the anchor explicitly.
  const centeredRaw = spriteNode.props.get('centered');
  const centered = centeredRaw === undefined ? true : decodeGodotValue(centeredRaw) === true;

  const offset = parseVector2(spriteNode.props.get('offset') ?? '') ?? { x: 0, y: 0 };
  const flipH = decodeGodotValue(spriteNode.props.get('flip_h') ?? 'false') === true;
  const flipV = decodeGodotValue(spriteNode.props.get('flip_v') ?? 'false') === true;
  const modulate = spriteNode.props.get('modulate');
  let tint: number | undefined;
  let alpha: number | undefined;
  if (modulate) {
    const colorMatch = modulate.match(/Color\(([^)]+)\)/);
    if (colorMatch) {
      const parts = colorMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const r = Math.round((parts[0] ?? 1) * 255);
      const g = Math.round((parts[1] ?? 1) * 255);
      const b = Math.round((parts[2] ?? 1) * 255);
      tint = (r << 16) | (g << 8) | b;
      if (parts.length > 3) alpha = parts[3];
    }
  }
  const zIndex = parseInt(unquote(spriteNode.props.get('z_index') ?? '0'), 10) || undefined;
  // `should_rotate = false` on a Box2DSprite opts the sprite out of body-angle
  // tracking — stays axis-aligned regardless of body rotation (shadows, glints,
  // anything that shouldn't tumble with the body).
  const shouldRotate = decodeGodotValue(spriteNode.props.get('should_rotate') ?? 'true') !== false;

  const binding: SpriteBinding = {
    name: spriteNode.name,
    offset: { x: local.origin.x + offset.x, y: local.origin.y + offset.y },
    rotation: local.rotation,
    scale: { x: local.scale.x, y: local.scale.y },
    anchor: centered ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
  };
  if (pixiFrame) binding.pixiFrame = pixiFrame;
  if (pixiAnimation) binding.pixiAnimation = pixiAnimation;
  if (pixiAtlas) binding.pixiAtlas = pixiAtlas;
  if (zIndex) binding.z = zIndex;
  if (tint !== undefined && tint !== 0xffffff) binding.tint = tint;
  if (alpha !== undefined && alpha !== 1) binding.alpha = alpha;
  if (flipH) binding.flipH = true;
  if (flipV) binding.flipV = true;
  if (!shouldRotate) binding.shouldRotate = false;

  // Box2DNineSlice under a body: render as a NineSliceSprite stretched by the
  // node's scale (corners pinned), same as a standalone nine-slice but bound to
  // the body. Borders come from the aseprite slice layer via the sprite-map.
  if (spriteNode.scriptResPath === BOX2D_NINE_SLICE_SCRIPT) {
    binding.nineSlice = true;
    binding.borders = (texResPath ? godotPathToBorders[texResPath] : undefined) ?? {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    };
    if (decodeGodotValue(spriteNode.props.get('tile_center') ?? 'false') === true) binding.tileCenter = true;
  }

  return binding;
}

// ---------------------------------------------------------------------------
// Visual builders — Polygon2D meshes and standalone Sprite2D
// ---------------------------------------------------------------------------

function buildVisuals(
  nodes: NodeInfo[],
  isUnderBody: (path: string) => boolean,
  extResources: Record<string, string>,
  subResections: Record<string, TscnSection>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  globalTransforms: Map<string, GTransform>,
  spriteMap: GodotSpriteMap,
  godotRoot: string | undefined,
): VisualsDef | null {
  const meshes: MeshDef[] = [];
  const sprites: VisualSpriteDef[] = [];
  const tileLayers: TileLayerDef[] = [];
  const ninePatches: NinePatchDef[] = [];

  // Reverse lookup: texture .tres path → 9-slice borders (from the aseprite
  // slice layer, threaded through sprite-map.json by generateGodotResources).
  const godotPathToBorders: Record<string, NinePatchDef['borders']> = {};
  for (const entry of Object.values(spriteMap)) {
    if (entry.borders) godotPathToBorders[entry.godotPath] = entry.borders;
  }

  // Cache parsed TileSet .tres files — one TileSet is usually shared by many
  // TileMapLayer nodes in the same scene.
  const tilesetCache = new Map<string, TileSetInfo | null>();
  const resolveTileSet = (resPath: string): TileSetInfo | null => {
    if (tilesetCache.has(resPath)) return tilesetCache.get(resPath)!;
    const info = loadTileSet(resPath, spriteMap, godotRoot);
    tilesetCache.set(resPath, info);
    return info;
  };

  // Pre-pass: collect clip shapes. A Box2DPolygon/Box2DCurve with
  // `mask_children = true` is a mask for its child TileMapLayers — it renders no
  // mesh of its own. Vertices are kept in world (scene) space here, then mapped
  // into each child layer's local space when the layer is built.
  const clipShapesWorld = new Map<string, V2[]>();
  for (const n of nodes) {
    if (isUnderBody(n.fullPath)) continue;
    const isPoly = n.type === 'Polygon2D' && n.scriptResPath === BOX2D_POLYGON_SCRIPT;
    const isCurve = n.scriptResPath === BOX2D_CURVE_SCRIPT;
    if (!isPoly && !isCurve) continue;
    if (decodeGodotValue(n.props.get('mask_children') ?? 'false') !== true) continue;
    const localVerts = isPoly ? parsePackedVector2Array(n.props.get('polygon') ?? '') : curveVertices(n, subResections);
    if (localVerts.length < 3) continue;
    const gt = globalTransforms.get(n.fullPath)!;
    clipShapesWorld.set(
      n.fullPath,
      localVerts.map((v) => applyGTransform(gt, v)),
    );
  }

  for (const n of nodes) {
    if (isUnderBody(n.fullPath)) continue;
    if (clipShapesWorld.has(n.fullPath)) {
      // A clip mask renders no fill of its own — the masked child TileMapLayer is
      // the fill. But it can still carry a tiled `border_texture` to frame the
      // masked region, so emit a border-only mesh (fill stripped) when present.
      const attachedProp = n.props.get('attached');
      if (attachedProp !== undefined && decodeGodotValue(attachedProp) === false) continue;
      const isCurveClip = n.scriptResPath === BOX2D_CURVE_SCRIPT;
      const m = isCurveClip
        ? buildCurveMesh(n, extResources, godotPathToPixi, subResections, globalTransforms)
        : buildMeshDef(n, extResources, godotPathToPixi, globalTransforms);
      if (m?.border) {
        delete m.pixiFrame;
        delete m.pixiAtlas;
        delete m.tileFill;
        m.overlay = true; // draw the border on top of the masked tilemap, not under it
        meshes.push(m);
      }
      continue; // the clip polygon itself is projected onto the child layer below
    }
    if (n.type === 'Polygon2D') {
      // Box2DPolygon (tiled fill + tiled border) is also a Polygon2D; the
      // `attached = false` flag marks it as editor-only reference art.
      if (n.scriptResPath === BOX2D_POLYGON_SCRIPT) {
        const attachedProp = n.props.get('attached');
        if (attachedProp !== undefined && decodeGodotValue(attachedProp) === false) continue;
      }
      const m = buildMeshDef(n, extResources, godotPathToPixi, globalTransforms);
      if (m) meshes.push(m);
    } else if (n.scriptResPath === BOX2D_CURVE_SCRIPT) {
      // Box2DCurve is a Path2D whose bezier curve is tessellated into the mesh
      // vertices, then rendered with the same masked fill + quad-strip border.
      const attachedProp = n.props.get('attached');
      if (attachedProp !== undefined && decodeGodotValue(attachedProp) === false) continue;
      const m = buildCurveMesh(n, extResources, godotPathToPixi, subResections, globalTransforms);
      if (m) meshes.push(m);
    } else if (n.scriptResPath === BOX2D_NINE_SLICE_SCRIPT) {
      // Box2DNineSlice is a Sprite2D subclass, so this must be checked before
      // the plain Sprite2D branch below or it would be exported twice.
      const attachedProp = n.props.get('attached');
      if (attachedProp !== undefined && decodeGodotValue(attachedProp) === false) continue;
      const np = buildNinePatch(n, extResources, godotPathToPixi, godotPathToBorders, globalTransforms);
      if (np) ninePatches.push(np);
    } else if (n.type === 'Sprite2D' || n.type === 'AnimatedSprite2D') {
      // Respect Box2DSprite's `attached = false` (editor-only reference art).
      const attachedProp = n.props.get('attached');
      if (attachedProp !== undefined && decodeGodotValue(attachedProp) === false) continue;
      const s = buildVisualSprite(n, extResources, godotPathToPixi, globalTransforms);
      if (s) sprites.push(s);
    } else if (n.type === 'TileMapLayer') {
      const layer = buildTileLayer(n, extResources, subResections, globalTransforms, spriteMap, resolveTileSet);
      if (layer) {
        // If this layer is a child of a clip shape, project the clip polygon into
        // the layer's local space so the runtime can mask the tile container.
        const clipWorld = clipShapesWorld.get(n.parentPath);
        if (clipWorld) {
          const layerGT = globalTransforms.get(n.fullPath)!;
          layer.clip = clipWorld.map((w) => applyInverseGTransform(layerGT, w));
        }
        tileLayers.push(layer);
      }
    }
  }

  if (
    meshes.length === 0 &&
    sprites.length === 0 &&
    tileLayers.length === 0 &&
    ninePatches.length === 0
  ) {
    return null;
  }
  return { meshes, sprites, tileLayers, ninePatches };
}

// ---------------------------------------------------------------------------
// TileMapLayer + TileSet resolution
// ---------------------------------------------------------------------------

/**
 * Parsed TileSet info — what each `source_id` in a TileMapLayer cell maps to.
 * Each source carries the tilesheet metadata (Pixi frame prefix + grid size)
 * so cell (atlas_x, atlas_y) resolves to a concrete Pixi frame at export time.
 */
interface TileSetInfo {
  sources: Map<number, TileSetSourceInfo>;
}

interface TileSetSourceInfo {
  textureGodotPath: string;
  framePrefix: string;
  cols: number;
  rows: number;
  tileSize: number;
}

function loadTileSet(
  resPath: string,
  spriteMap: GodotSpriteMap,
  godotRoot: string | undefined,
): TileSetInfo | null {
  const abs = resolveResPath(resPath, godotRoot);
  if (!abs || !fs.existsSync(abs)) {
    console.warn(`[Godot] TileSet not found: ${resPath}`);
    return null;
  }
  const content = fs.readFileSync(abs, 'utf-8');
  const sections = parseTscnSections(content);

  // Build ext_resource and sub_resource lookups inside this .tres.
  const extRes: Record<string, string> = {}; // id → res:// path
  const subRes: Record<string, TscnSection> = {}; // id → section
  for (const s of sections) {
    if (s.type === 'ext_resource' && s.attrs.id) {
      extRes[unquote(s.attrs.id)] = unquote(s.attrs.path ?? '');
    } else if (s.type === 'sub_resource' && s.attrs.id) {
      subRes[unquote(s.attrs.id)] = s;
    }
  }

  // Find the `[resource]` section — it lists `sources/<id> = SubResource(...)`.
  const resSection = sections.find((s) => s.type === 'resource');
  if (!resSection) return null;

  // Resolve each source.
  const sources = new Map<number, TileSetSourceInfo>();
  for (const [key, value] of resSection.props) {
    const m = key.match(/^sources\/(\d+)$/);
    if (!m) continue;
    const sourceId = parseInt(m[1], 10);
    const subRefMatch = value.match(/SubResource\("([^"]+)"\)/);
    if (!subRefMatch) continue;
    const subSection = subRes[subRefMatch[1]];
    if (!subSection || subSection.attrs.type !== '"TileSetAtlasSource"') continue;

    const texRef = subSection.props.get('texture');
    const texExtId = texRef?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (!texExtId) continue;
    const texPath = extRes[texExtId];
    if (!texPath) continue;

    // Look the texture up in the sprite-map by godotPath; pull tilesheet info.
    const entry = Object.values(spriteMap).find((e) => e.godotPath === texPath);
    if (!entry?.tilesheet) {
      console.warn(
        `[Godot] TileSet source ${sourceId} → ${texPath} has no tilesheet metadata. ` +
          `Make sure the source is a {ss=N} spritesheet (the per-tile frames + bare grid frame must both exist in sprite-map.json).`,
      );
      continue;
    }
    sources.set(sourceId, {
      textureGodotPath: texPath,
      framePrefix: entry.tilesheet.framePrefix,
      cols: entry.tilesheet.cols,
      rows: entry.tilesheet.rows,
      tileSize: entry.tilesheet.tileSize,
    });
  }
  return { sources };
}

/**
 * Parse an inline TileSet defined as a sub_resource in the same .tscn file.
 * Mirrors the logic in loadTileSet but works from already-parsed sections
 * instead of reading an external .tres file.
 */
function parseTileSetFromSubResources(
  tileSetId: string,
  subResections: Record<string, TscnSection>,
  extResources: Record<string, string>,
  spriteMap: GodotSpriteMap,
): TileSetInfo | null {
  const tileSetSection = subResections[tileSetId];
  if (!tileSetSection) return null;

  const sources = new Map<number, TileSetSourceInfo>();
  for (const [key, value] of tileSetSection.props) {
    const m = key.match(/^sources\/(\d+)$/);
    if (!m) continue;
    const sourceId = parseInt(m[1], 10);
    const subRefId = value.match(/SubResource\("([^"]+)"\)/)?.[1];
    if (!subRefId) continue;
    const sourceSection = subResections[subRefId];
    if (!sourceSection || unquote(sourceSection.attrs.type ?? '') !== 'TileSetAtlasSource') continue;

    const texRef = sourceSection.props.get('texture');
    const texExtId = texRef?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (!texExtId) continue;
    const texPath = extResources[texExtId];
    if (!texPath) continue;

    const entry = Object.values(spriteMap).find((e) => e.godotPath === texPath);
    if (!entry?.tilesheet) {
      console.warn(
        `[Godot] Inline TileSet source ${sourceId} → ${texPath} has no tilesheet metadata. ` +
          `Make sure the source is a {ss=N} spritesheet.`,
      );
      continue;
    }
    sources.set(sourceId, {
      textureGodotPath: texPath,
      framePrefix: entry.tilesheet.framePrefix,
      cols: entry.tilesheet.cols,
      rows: entry.tilesheet.rows,
      tileSize: entry.tilesheet.tileSize,
    });
  }
  return { sources };
}

function buildTileLayer(
  layerNode: NodeInfo,
  extResources: Record<string, string>,
  subResections: Record<string, TscnSection>,
  globalTransforms: Map<string, GTransform>,
  spriteMap: GodotSpriteMap,
  resolveTileSet: (resPath: string) => TileSetInfo | null,
): TileLayerDef | null {
  const tileSetRef = layerNode.props.get('tile_set');
  if (!tileSetRef) {
    console.warn(`[Godot] TileMapLayer "${layerNode.name}" has no tile_set`);
    return null;
  }

  let tileSet: TileSetInfo | null = null;

  const subId = tileSetRef.match(/SubResource\("([^"]+)"\)/)?.[1];
  if (subId) {
    // Inline TileSet defined as a sub_resource in the same .tscn file.
    tileSet = parseTileSetFromSubResources(subId, subResections, extResources, spriteMap);
  } else {
    const extId = tileSetRef.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (!extId) {
      console.warn(`[Godot] TileMapLayer "${layerNode.name}" has no tile_set`);
      return null;
    }
    const resPath = extResources[extId];
    if (!resPath) return null;
    tileSet = resolveTileSet(resPath);
  }

  if (!tileSet) return null;

  const rawBlob = layerNode.props.get('tile_map_data');
  if (!rawBlob) return { ...emptyLayer(layerNode, globalTransforms, tileSet), tiles: [] };
  const bytes = parsePackedByteArray(rawBlob);
  if (!bytes) return null;
  const cells = decodeTileMapData(bytes);

  const tiles: TilePlacement[] = [];
  for (const cell of cells) {
    const src = tileSet.sources.get(cell.sourceId);
    if (!src) continue;
    if (cell.atlasX < 0 || cell.atlasX >= src.cols || cell.atlasY < 0 || cell.atlasY >= src.rows) {
      console.warn(
        `[Godot] TileMapLayer "${layerNode.name}" cell (${cell.coordX},${cell.coordY}) → atlas (${cell.atlasX},${cell.atlasY}) out of range`,
      );
      continue;
    }
    const linearIdx = cell.atlasY * src.cols + cell.atlasX;
    // Extract D4 transform from alternativeTile bits 12-14: bit0=H, bit1=V, bit2=T
    const transform = (cell.alternativeTile >> 12) & 0x7;
    const placement: TilePlacement = { x: cell.coordX, y: cell.coordY, pixiFrame: `${src.framePrefix}_${linearIdx}#0` };
    if (transform !== 0) placement.transform = transform;
    tiles.push(placement);
  }

  return { ...emptyLayer(layerNode, globalTransforms, tileSet), tiles };
}

function emptyLayer(
  layerNode: NodeInfo,
  globalTransforms: Map<string, GTransform>,
  tileSet: TileSetInfo,
): Omit<TileLayerDef, 'tiles'> {
  const gt = globalTransforms.get(layerNode.fullPath)!;
  // All sources in a TileSet share the same tile_size in practice; pick the first.
  const first = tileSet.sources.values().next().value;
  const tileSize: V2 = first ? { x: first.tileSize, y: first.tileSize } : { x: 16, y: 16 };
  const zIndex = parseInt(unquote(layerNode.props.get('z_index') ?? '0'), 10) || undefined;
  const out: Omit<TileLayerDef, 'tiles'> = {
    name: layerNode.name,
    position: gt.origin,
    rotation: gt.rotation,
    scale: gt.scale,
    tileSize,
  };
  if (zIndex) (out as TileLayerDef).z = zIndex;
  return out;
}

function buildMeshDef(
  polyNode: NodeInfo,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  globalTransforms: Map<string, GTransform>,
): MeshDef | null {
  // Vertices in the polygon node's local space (Godot pixels).
  const polygon = parsePackedVector2Array(polyNode.props.get('polygon') ?? '');
  if (polygon.length < 3) return null;

  // UVs — same length as polygon, in texture pixel space. If empty, Godot
  // defaults to using the polygon itself (texture projected from world space).
  let uvs = parsePackedVector2Array(polyNode.props.get('uv') ?? '');
  if (uvs.length !== polygon.length) uvs = polygon;

  // Texture — resolve through the sprite-map to a pixi frame key + atlas.
  let pixiFrame: string | undefined;
  let pixiAtlas: string | undefined;
  const texProp = polyNode.props.get('texture');
  const extId = texProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
  if (extId && extResources[extId]) {
    const resolved = godotPathToPixi[extResources[extId]];
    pixiFrame = resolved?.frame;
    pixiAtlas = resolved?.atlas;
  }

  // Triangulate. Fan from vertex 0 — works for convex polygons; concave needs
  // earcut, which we'll wire in if/when authors hit it.
  const indices: number[] = [];
  for (let i = 1; i < polygon.length - 1; i++) {
    indices.push(0, i, i + 1);
  }

  const gt = globalTransforms.get(polyNode.fullPath)!;
  const modulate = polyNode.props.get('modulate');
  let tint: number | undefined;
  let alpha: number | undefined;
  if (modulate) {
    const colorMatch = modulate.match(/Color\(([^)]+)\)/);
    if (colorMatch) {
      const parts = colorMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const r = Math.round((parts[0] ?? 1) * 255);
      const g = Math.round((parts[1] ?? 1) * 255);
      const b = Math.round((parts[2] ?? 1) * 255);
      tint = (r << 16) | (g << 8) | b;
      if (parts.length > 3) alpha = parts[3];
    }
  }
  const zIndex = parseInt(unquote(polyNode.props.get('z_index') ?? '0'), 10) || undefined;

  const out: MeshDef = {
    name: polyNode.name,
    position: gt.origin,
    rotation: gt.rotation,
    scale: gt.scale,
    vertices: polygon,
    uvs,
    indices,
  };
  if (pixiFrame) out.pixiFrame = pixiFrame;
  if (pixiAtlas) out.pixiAtlas = pixiAtlas;
  if (zIndex) out.z = zIndex;
  if (tint !== undefined && tint !== 0xffffff) out.tint = tint;
  if (alpha !== undefined && alpha !== 1) out.alpha = alpha;

  // Box2DPolygon adds tiled-fill + a tiled quad-strip border on top of a plain
  // textured Polygon2D. Plain Polygon2D nodes keep the existing stretch behaviour.
  if (polyNode.scriptResPath === BOX2D_POLYGON_SCRIPT) {
    const tileFill = decodeGodotValue(polyNode.props.get('tile_fill') ?? 'true') !== false;
    if (tileFill) out.tileFill = true;
    const border = buildMeshBorder(polyNode, extResources, godotPathToPixi);
    if (border) out.border = border;
  }
  return out;
}

/**
 * Parse the shared `border_*` exports (used by Box2DPolygon and Box2DCurve) into
 * a MeshBorderDef, resolving the strip + optional corner frame through the
 * sprite-map. Returns undefined when there's no resolvable border texture.
 */
function buildMeshBorder(
  node: NodeInfo,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
): MeshBorderDef | undefined {
  const borderTexProp = node.props.get('border_texture');
  const borderExtId = borderTexProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
  const borderResPath = borderExtId ? extResources[borderExtId] : undefined;
  const borderResolved = borderResPath ? godotPathToPixi[borderResPath] : undefined;
  if (!borderResolved?.frame) {
    if (borderTexProp) {
      console.warn(`[Godot] "${node.name}" border_texture did not resolve to a frame; skipping border`);
    }
    return undefined;
  }

  const width = parseFloat(unquote(node.props.get('border_width') ?? '0')) || 0;
  const rawScale = node.props.get('border_texture_scale');
  const textureScale = rawScale !== undefined ? parseFloat(unquote(rawScale)) || 0 : 1;
  const closed = decodeGodotValue(node.props.get('border_closed') ?? 'true') !== false;
  const border: MeshBorderDef = { pixiFrame: borderResolved.frame, width, textureScale, closed };
  if (borderResolved.atlas) border.pixiAtlas = borderResolved.atlas;

  // Optional corner piece stamped over each joint. `border_corner_min_angle`
  // (degrees) suppresses corners on shallow turns — so a finely-tessellated
  // curve only gets corner pieces at genuinely sharp vertices.
  const cornerExtId = node.props.get('border_corner_texture')?.match(/ExtResource\("([^"]+)"\)/)?.[1];
  const cornerResPath = cornerExtId ? extResources[cornerExtId] : undefined;
  const cornerResolved = cornerResPath ? godotPathToPixi[cornerResPath] : undefined;
  if (cornerResolved?.frame) {
    border.cornerFrame = cornerResolved.frame;
    if (cornerResolved.atlas) border.cornerAtlas = cornerResolved.atlas;
    const minAngle = parseFloat(unquote(node.props.get('border_corner_min_angle') ?? '0')) || 0;
    if (minAngle > 0) border.cornerMinAngle = minAngle;
    const cornerSize = parseVector2(node.props.get('border_corner_size') ?? '');
    if (cornerSize && (cornerSize.x > 0 || cornerSize.y > 0)) border.cornerSize = cornerSize;
    // border_corner_orientation enum: 0 = Free (bisector), 1 = Snap 90°, 2 = None.
    const orient = parseInt(unquote(node.props.get('border_corner_orientation') ?? '0'), 10) || 0;
    if (orient === 1) border.cornerOrientation = 'snap';
    else if (orient === 2) border.cornerOrientation = 'none';
  }
  return border;
}

/**
 * Box2DCurve — a Path2D whose bezier Curve2D is tessellated into mesh vertices,
 * then rendered with the same masked tiled fill + quad-strip border as a
 * Box2DPolygon. The masked fill earcuts its polygon mask, so concave/curved
 * outlines render correctly (use `tile_fill`, not the stretched mesh).
 */
function buildCurveMesh(
  node: NodeInfo,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  subResections: Record<string, TscnSection>,
  globalTransforms: Map<string, GTransform>,
): MeshDef | null {
  const curveId = node.props.get('curve')?.match(/SubResource\("([^"]+)"\)/)?.[1];
  if (!curveId || !subResections[curveId]) {
    console.warn(`[Godot] Box2DCurve "${node.name}" has no curve resource; skipping`);
    return null;
  }
  const vertices = curveVertices(node, subResections);
  if (vertices.length < 3) {
    console.warn(`[Godot] Box2DCurve "${node.name}" tessellated to <3 points; skipping`);
    return null;
  }

  // Path2D has no `texture`, so Box2DCurve adds its own fill texture export.
  const texExtId = node.props.get('texture')?.match(/ExtResource\("([^"]+)"\)/)?.[1];
  const resolved = texExtId && extResources[texExtId] ? godotPathToPixi[extResources[texExtId]] : undefined;

  // Fan triangulation is only consumed by the non-tiled stretched fill; the tiled
  // fill clips with an earcut polygon mask, so concave curves are fine there.
  const indices: number[] = [];
  for (let i = 1; i < vertices.length - 1; i++) indices.push(0, i, i + 1);

  const gt = globalTransforms.get(node.fullPath)!;
  const out: MeshDef = {
    name: node.name,
    position: gt.origin,
    rotation: gt.rotation,
    scale: gt.scale,
    vertices,
    uvs: vertices,
    indices,
  };
  if (resolved?.frame) out.pixiFrame = resolved.frame;
  if (resolved?.atlas) out.pixiAtlas = resolved.atlas;
  const zIndex = parseInt(unquote(node.props.get('z_index') ?? '0'), 10) || undefined;
  if (zIndex) out.z = zIndex;

  const tileFill = decodeGodotValue(node.props.get('tile_fill') ?? 'true') !== false;
  if (tileFill) out.tileFill = true;
  const border = buildMeshBorder(node, extResources, godotPathToPixi);
  if (border) out.border = border;
  return out;
}

/** Apply a global transform (translate + rotate + scale) to a local-space point. */
function applyGTransform(gt: GTransform, v: V2): V2 {
  const sx = v.x * gt.scale.x;
  const sy = v.y * gt.scale.y;
  const c = Math.cos(gt.rotation);
  const s = Math.sin(gt.rotation);
  return { x: gt.origin.x + c * sx - s * sy, y: gt.origin.y + s * sx + c * sy };
}

/** Inverse of applyGTransform: map a world-space point into the transform's local space. */
function applyInverseGTransform(gt: GTransform, w: V2): V2 {
  const dx = w.x - gt.origin.x;
  const dy = w.y - gt.origin.y;
  const c = Math.cos(gt.rotation);
  const s = Math.sin(gt.rotation);
  return { x: (c * dx + s * dy) / (gt.scale.x || 1), y: (-s * dx + c * dy) / (gt.scale.y || 1) };
}

/** Resolve a Box2DCurve node's Curve2D sub-resource and tessellate it into local-space vertices. */
function curveVertices(node: NodeInfo, subResections: Record<string, TscnSection>): V2[] {
  const curveId = node.props.get('curve')?.match(/SubResource\("([^"]+)"\)/)?.[1];
  const curveSection = curveId ? subResections[curveId] : undefined;
  if (!curveSection) return [];
  // Godot Curve2D `_data.points` is a flat PackedVector2Array of (in, out, pos)
  // triples per control point (handles are offsets relative to the position).
  const rawPoints = parsePackedVector2Array(curveSection.props.get('_data') ?? '');
  const samples = Math.max(1, Math.round(parseFloat(unquote(node.props.get('curve_samples') ?? '8')) || 8));
  return tessellateCurve2D(rawPoints, samples);
}

/**
 * Tessellate a Godot Curve2D into a polyline. `points` are the (in, out, pos)
 * triples; each segment between consecutive points is a cubic bezier
 * (P0=pos_i, P1=pos_i+out_i, P2=pos_{i+1}+in_{i+1}, P3=pos_{i+1}) sampled at
 * `samples` steps. Shared segment endpoints are emitted once.
 */
function tessellateCurve2D(points: V2[], samples: number): V2[] {
  const count = Math.floor(points.length / 3);
  if (count < 2) return [];
  const pos = (i: number) => points[i * 3 + 2];
  const outH = (i: number) => points[i * 3 + 1];
  const inH = (i: number) => points[i * 3 + 0];

  const result: V2[] = [pos(0)];
  for (let i = 0; i < count - 1; i++) {
    const p0 = pos(i);
    const p1 = { x: p0.x + outH(i).x, y: p0.y + outH(i).y };
    const p3 = pos(i + 1);
    const p2 = { x: p3.x + inH(i + 1).x, y: p3.y + inH(i + 1).y };
    for (let s = 1; s <= samples; s++) {
      const t = s / samples;
      const u = 1 - t;
      result.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
  }
  return result;
}

function buildVisualSprite(
  spriteNode: NodeInfo,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  globalTransforms: Map<string, GTransform>,
): VisualSpriteDef | null {
  let pixiFrame: string | undefined;
  let pixiAnimation: string | undefined;
  let pixiAtlas: string | undefined;
  if (spriteNode.type === 'Sprite2D') {
    const texProp = spriteNode.props.get('texture');
    const extId = texProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (extId && extResources[extId]) {
      const resolved = godotPathToPixi[extResources[extId]];
      if (resolved) {
        pixiFrame = resolved.frame;
        pixiAnimation = resolved.anim;
        pixiAtlas = resolved.atlas;
      }
    }
  } else {
    const framesProp = spriteNode.props.get('sprite_frames');
    const extId = framesProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (extId && extResources[extId]) {
      const resolved = godotPathToPixi[extResources[extId]];
      if (resolved) {
        pixiFrame = resolved.frame;
        pixiAnimation = resolved.anim;
        pixiAtlas = resolved.atlas;
      }
    }
  }
  if (!pixiFrame && !pixiAnimation) return null;

  const centeredRaw = spriteNode.props.get('centered');
  const centered = centeredRaw === undefined ? true : decodeGodotValue(centeredRaw) === true;
  const offset = parseVector2(spriteNode.props.get('offset') ?? '') ?? { x: 0, y: 0 };
  const flipH = decodeGodotValue(spriteNode.props.get('flip_h') ?? 'false') === true;
  const flipV = decodeGodotValue(spriteNode.props.get('flip_v') ?? 'false') === true;
  const modulate = spriteNode.props.get('modulate');
  let tint: number | undefined;
  let alpha: number | undefined;
  if (modulate) {
    const colorMatch = modulate.match(/Color\(([^)]+)\)/);
    if (colorMatch) {
      const parts = colorMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const r = Math.round((parts[0] ?? 1) * 255);
      const g = Math.round((parts[1] ?? 1) * 255);
      const b = Math.round((parts[2] ?? 1) * 255);
      tint = (r << 16) | (g << 8) | b;
      if (parts.length > 3) alpha = parts[3];
    }
  }
  const zIndex = parseInt(unquote(spriteNode.props.get('z_index') ?? '0'), 10) || undefined;
  const gt = globalTransforms.get(spriteNode.fullPath)!;

  const out: VisualSpriteDef = {
    name: spriteNode.name,
    position: { x: gt.origin.x + offset.x, y: gt.origin.y + offset.y },
    rotation: gt.rotation,
    scale: gt.scale,
    anchor: centered ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
  };
  if (pixiFrame) out.pixiFrame = pixiFrame;
  if (pixiAnimation) out.pixiAnimation = pixiAnimation;
  if (pixiAtlas) out.pixiAtlas = pixiAtlas;
  if (zIndex) out.z = zIndex;
  if (tint !== undefined && tint !== 0xffffff) out.tint = tint;
  if (alpha !== undefined && alpha !== 1) out.alpha = alpha;
  if (flipH) out.flipH = true;
  if (flipV) out.flipV = true;
  return out;
}

function buildNinePatch(
  node: NodeInfo,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string; atlas?: string }>,
  godotPathToBorders: Record<string, NinePatchDef['borders']>,
  globalTransforms: Map<string, GTransform>,
): NinePatchDef | null {
  const texProp = node.props.get('texture');
  const extId = texProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
  const texResPath = extId ? extResources[extId] : undefined;
  const resolved = texResPath ? godotPathToPixi[texResPath] : undefined;
  const pixiFrame = resolved?.frame;
  if (!pixiFrame) {
    console.warn(`[Godot] Box2DNineSlice "${node.name}" has no resolvable texture; skipping`);
    return null;
  }

  // Borders are authored in the aseprite slice layer and threaded through the
  // sprite-map. Falling back to zero just makes the runtime stretch uniformly.
  const resolvedBorders = texResPath ? godotPathToBorders[texResPath] : undefined;
  const borders = resolvedBorders ?? { left: 0, top: 0, right: 0, bottom: 0 };
  if (!resolvedBorders) {
    console.warn(`[Godot] Box2DNineSlice "${node.name}" texture has no slice borders; rendering as a plain stretch`);
  }

  const centeredRaw = node.props.get('centered');
  const centered = centeredRaw === undefined ? true : decodeGodotValue(centeredRaw) === true;
  const offset = parseVector2(node.props.get('offset') ?? '') ?? { x: 0, y: 0 };
  const zIndex = parseInt(unquote(node.props.get('z_index') ?? '0'), 10) || undefined;

  const modulate = node.props.get('modulate');
  let tint: number | undefined;
  let alpha: number | undefined;
  if (modulate) {
    const colorMatch = modulate.match(/Color\(([^)]+)\)/);
    if (colorMatch) {
      const parts = colorMatch[1].split(',').map((s) => parseFloat(s.trim()));
      const r = Math.round((parts[0] ?? 1) * 255);
      const g = Math.round((parts[1] ?? 1) * 255);
      const b = Math.round((parts[2] ?? 1) * 255);
      tint = (r << 16) | (g << 8) | b;
      if (parts.length > 3) alpha = parts[3];
    }
  }

  const gt = globalTransforms.get(node.fullPath)!;
  const out: NinePatchDef = {
    name: node.name,
    pixiFrame,
    position: { x: gt.origin.x + offset.x, y: gt.origin.y + offset.y },
    rotation: gt.rotation,
    scale: gt.scale,
    anchor: centered ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
    borders,
  };
  if (decodeGodotValue(node.props.get('tile_center') ?? 'false') === true) out.tileCenter = true;
  if (resolved?.atlas) out.pixiAtlas = resolved.atlas;
  if (zIndex) out.z = zIndex;
  if (tint !== undefined && tint !== 0xffffff) out.tint = tint;
  if (alpha !== undefined && alpha !== 1) out.alpha = alpha;
  return out;
}

// ---------------------------------------------------------------------------
// Joint builder
// ---------------------------------------------------------------------------

function buildJointDef(
  jointNode: NodeInfo,
  allNodes: NodeInfo[],
  bodyPathToIndex: Map<string, number>,
  globalTransforms: Map<string, GTransform>,
): Box2DJointDef | null {
  const jointType = SCRIPT_TO_JOINT_TYPE[jointNode.scriptResPath!];
  const bodyAPath = unquote(jointNode.props.get('body_a') ?? '').replace(/^NodePath\("(.*)"\)$/, '$1');
  const bodyBPath = unquote(jointNode.props.get('body_b') ?? '').replace(/^NodePath\("(.*)"\)$/, '$1');

  // NodePath is relative to the joint node. Resolve.
  const aFull = resolveNodePath(jointNode.fullPath, bodyAPath, allNodes);
  const bFull = resolveNodePath(jointNode.fullPath, bodyBPath, allNodes);
  const ai = aFull !== null ? bodyPathToIndex.get(aFull) : undefined;
  const bi = bFull !== null ? bodyPathToIndex.get(bFull) : undefined;
  if (ai === undefined || bi === undefined) {
    console.warn(`[Godot] Joint "${jointNode.name}" references missing body (a=${bodyAPath}, b=${bodyBPath})`);
    return null;
  }

  const jointGT = globalTransforms.get(jointNode.fullPath)!;
  const anchorWorldGodot = jointGT.origin;
  const aGT = globalTransforms.get(aFull!)!;
  const bGT = globalTransforms.get(bFull!)!;
  const anchorA = bodyLocalFromWorld(anchorWorldGodot, aGT);
  const anchorB = bodyLocalFromWorld(anchorWorldGodot, bGT);

  const readBool = (key: string): boolean | undefined => {
    const raw = jointNode.props.get(key);
    if (raw === undefined) return undefined;
    const v = decodeGodotValue(raw);
    return typeof v === 'boolean' ? v : undefined;
  };
  const readFloat = (key: string): number | undefined => {
    const raw = jointNode.props.get(key);
    if (raw === undefined) return undefined;
    const v = decodeGodotValue(raw);
    return typeof v === 'number' ? v : undefined;
  };

  const collideConnected = readBool('collide_connected');

  const common: CommonJointFields = {
    name: jointNode.name,
    bodyA: ai,
    bodyB: bi,
    anchorA,
    anchorB,
    ...(collideConnected !== undefined ? { collideConnected } : {}),
  };

  if (jointType === 'revolute') {
    const def: RevoluteJointDef = { ...common, type: 'revolute' };
    const refAngle = readFloat('reference_angle');
    if (refAngle !== undefined) def.referenceAngle = -refAngle;
    const enableLimit = readBool('enable_limit');
    if (enableLimit !== undefined) def.enableLimit = enableLimit;
    // Godot is CW; Box2D is CCW. Lower in CW = upper in CCW (and vice versa).
    const lower = readFloat('lower_limit');
    const upper = readFloat('upper_limit');
    if (upper !== undefined) def.lowerLimit = -upper;
    if (lower !== undefined) def.upperLimit = -lower;
    const enableMotor = readBool('enable_motor');
    if (enableMotor !== undefined) def.enableMotor = enableMotor;
    const motorSpeed = readFloat('motor_speed');
    if (motorSpeed !== undefined) def.motorSpeed = -motorSpeed;
    const maxTorque = readFloat('max_motor_torque');
    if (maxTorque !== undefined) def.maxMotorTorque = maxTorque;
    return def;
  }
  if (jointType === 'prismatic') {
    const axisGodot = parseVector2(jointNode.props.get('local_axis_a') ?? '') ?? { x: 1, y: 0 };
    // local_axis_a is in body A's local pixel frame; flip Y for Box2D
    const def: PrismaticJointDef = {
      ...common,
      type: 'prismatic',
      localAxisA: normalize({ x: axisGodot.x, y: -axisGodot.y }),
    };
    const refAngle = readFloat('reference_angle');
    if (refAngle !== undefined) def.referenceAngle = -refAngle;
    const enableLimit = readBool('enable_limit');
    if (enableLimit !== undefined) def.enableLimit = enableLimit;
    const lower = readFloat('lower_limit');
    if (lower !== undefined) def.lowerLimit = lower / PXM;
    const upper = readFloat('upper_limit');
    if (upper !== undefined) def.upperLimit = upper / PXM;
    const enableMotor = readBool('enable_motor');
    if (enableMotor !== undefined) def.enableMotor = enableMotor;
    const motorSpeed = readFloat('motor_speed');
    if (motorSpeed !== undefined) def.motorSpeed = motorSpeed / PXM;
    const maxForce = readFloat('max_motor_force');
    if (maxForce !== undefined) def.maxMotorForce = maxForce;
    return def;
  }
  if (jointType === 'distance') {
    const len = readFloat('length') ?? 0;
    const def: DistanceJointDef = { ...common, type: 'distance', length: len / PXM };
    const freq = readFloat('frequency');
    if (freq !== undefined) def.frequency = freq;
    const damp = readFloat('damping_ratio');
    if (damp !== undefined) def.dampingRatio = damp;
    return def;
  }
  if (jointType === 'weld') {
    const def: WeldJointDef = { ...common, type: 'weld' };
    const refAngle = readFloat('reference_angle');
    if (refAngle !== undefined) def.referenceAngle = -refAngle;
    return def;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface GTransform {
  origin: V2;
  rotation: number; // Godot radians (CW)
  scale: V2;
}

type SubShape =
  | { kind: 'rect'; size: V2 }
  | { kind: 'circle'; radius: number }
  | { kind: 'convex'; points: V2[] };

function computeGlobalTransform(
  node: NodeInfo,
  nodeByPath: Map<string, NodeInfo>,
  cache: Map<string, GTransform>,
): GTransform {
  const cached = cache.get(node.fullPath);
  if (cached) return cached;

  const local = parseLocalTransform(node);

  let parentT: GTransform = { origin: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
  if (node.parentPath && node.parentPath !== '.') {
    const parent = nodeByPath.get(node.parentPath);
    if (parent) parentT = computeGlobalTransform(parent, nodeByPath, cache);
  }
  // Parent at root path "." is the actual root node, which has parentPath === ''
  if (node.parentPath === '.') {
    const root = [...nodeByPath.values()].find((n) => n.parentPath === '');
    if (root) parentT = computeGlobalTransform(root, nodeByPath, cache);
  }

  // Compose: world = parent ∘ local
  const cosP = Math.cos(parentT.rotation);
  const sinP = Math.sin(parentT.rotation);
  const sx = local.origin.x * parentT.scale.x;
  const sy = local.origin.y * parentT.scale.y;
  const origin: V2 = {
    x: parentT.origin.x + cosP * sx - sinP * sy,
    y: parentT.origin.y + sinP * sx + cosP * sy,
  };
  const out: GTransform = {
    origin,
    rotation: parentT.rotation + local.rotation,
    scale: { x: parentT.scale.x * local.scale.x, y: parentT.scale.y * local.scale.y },
  };
  cache.set(node.fullPath, out);
  return out;
}

function parseLocalTransform(node: NodeInfo): GTransform {
  // Godot may store either position/rotation/scale separately or as a Transform2D
  const tProp = node.props.get('transform');
  if (tProp) {
    const t = parseTransform2D(tProp);
    if (t) return { origin: t.origin, rotation: t.rotation, scale: t.scale };
  }
  const position = parseVector2(node.props.get('position') ?? '') ?? { x: 0, y: 0 };
  const rotation = parseFloat(unquote(node.props.get('rotation') ?? '0')) || 0;
  const scale = parseVector2(node.props.get('scale') ?? '') ?? { x: 1, y: 1 };
  return { origin: position, rotation, scale };
}

/** Transform a child node's local Godot transform into its containing body's local Godot frame. */
function transformInBody(child: NodeInfo, body: NodeInfo, globalTransforms: Map<string, GTransform>): GTransform {
  const bodyGT = globalTransforms.get(body.fullPath)!;
  const childGT = globalTransforms.get(child.fullPath)!;
  // local = body⁻¹ · child
  const dx = childGT.origin.x - bodyGT.origin.x;
  const dy = childGT.origin.y - bodyGT.origin.y;
  const cosB = Math.cos(-bodyGT.rotation);
  const sinB = Math.sin(-bodyGT.rotation);
  const localOrigin = {
    x: (cosB * dx - sinB * dy) / (bodyGT.scale.x || 1),
    y: (sinB * dx + cosB * dy) / (bodyGT.scale.y || 1),
  };
  return {
    origin: localOrigin,
    rotation: childGT.rotation - bodyGT.rotation,
    scale: { x: childGT.scale.x / (bodyGT.scale.x || 1), y: childGT.scale.y / (bodyGT.scale.y || 1) },
  };
}

/**
 * Transform a point in the shape's local Godot pixel space into the body's
 * local Box2D frame (meters, Y-up).
 * `rotation` is the shape's local rotation (Godot CW radians).
 * `origin` is the shape's local position in the body's local pixel frame.
 */
function transformAndMeters(pt: V2, rotation: number, origin: V2): V2 {
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const rx = cosR * pt.x - sinR * pt.y;
  const ry = sinR * pt.x + cosR * pt.y;
  const xPx = rx + origin.x;
  const yPx = ry + origin.y;
  return { x: xPx / PXM, y: -yPx / PXM };
}

/** Inverse-transform a world-space pixel point into a body's local Box2D meters. */
function bodyLocalFromWorld(worldPx: V2, bodyGT: GTransform): V2 {
  const dx = worldPx.x - bodyGT.origin.x;
  const dy = worldPx.y - bodyGT.origin.y;
  const cosB = Math.cos(-bodyGT.rotation);
  const sinB = Math.sin(-bodyGT.rotation);
  const localPx = {
    x: (cosB * dx - sinB * dy) / (bodyGT.scale.x || 1),
    y: (sinB * dx + cosB * dy) / (bodyGT.scale.y || 1),
  };
  return { x: localPx.x / PXM, y: -localPx.y / PXM };
}

function collectChildPaths(parentPath: string, allNodes: NodeInfo[]): string[] {
  // Direct children only (parent attr equals parentPath)
  const refParent = parentPath === '.' ? '.' : parentPath;
  return allNodes.filter((n) => n.parentPath === refParent).map((n) => n.fullPath);
}

function collectUserData(node: NodeInfo): Record<string, unknown> {
  const typed = node.props.get('user_data');
  if (typed === undefined) return {};
  const decoded = decodeGodotValue(typed);
  if (decoded && typeof decoded === 'object' && !('x' in (decoded as object))) {
    return decoded as Record<string, unknown>;
  }
  return {};
}

function collectMaterial(shape: NodeInfo): Material {
  const readNum = (key: string, fallback: number): number => {
    const raw = shape.props.get(key);
    if (raw === undefined) return fallback;
    const v = decodeGodotValue(raw);
    return typeof v === 'number' ? v : fallback;
  };
  const readBool = (key: string, fallback: boolean): boolean => {
    const raw = shape.props.get(key);
    if (raw === undefined) return fallback;
    const v = decodeGodotValue(raw);
    return typeof v === 'boolean' ? v : fallback;
  };
  const readOptInt = (key: string): number | undefined => {
    const raw = shape.props.get(key);
    if (raw === undefined) return undefined;
    const v = decodeGodotValue(raw);
    return typeof v === 'number' ? v : undefined;
  };
  const out: Material = {
    density: readNum('density', 1),
    friction: readNum('friction', 0.2),
    restitution: readNum('restitution', 0),
    sensor: readBool('is_sensor', false),
  };
  const cb = readOptInt('category_bits');
  if (cb !== undefined) out.categoryBits = cb;
  const mb = readOptInt('mask_bits');
  if (mb !== undefined) out.maskBits = mb;
  const gi = readOptInt('group_index');
  if (gi !== undefined) out.groupIndex = gi;
  return out;
}

/** Resolve a `res://...` path to an absolute filesystem path under the godot project root. */
function resolveResPath(resPath: string, godotRoot?: string): string | null {
  if (!godotRoot) return null;
  const m = resPath.match(/^res:\/\/(.+)$/);
  if (!m) return null;
  return path.join(godotRoot, m[1]);
}

function resolveNodePath(fromPath: string, relativePath: string, allNodes: NodeInfo[]): string | null {
  if (!relativePath) return null;
  // Absolute path "/root/SceneRoot/..." not supported; we only use scene-relative NodePaths.
  // The NodePath is relative to the joint node's parent (Godot convention) OR scene root if starting with "/"
  // For our convention, the export-time NodePath is relative to the joint's parent.
  if (relativePath.startsWith('/')) return null;

  // Walk up from joint's parent
  const fromParent = fromPath.includes('/') ? fromPath.split('/').slice(0, -1).join('/') : '.';
  const parts = fromParent === '.' ? [] : fromParent.split('/');
  const relParts = relativePath.split('/');
  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part === '.' || part === '') {
      continue;
    } else {
      parts.push(part);
    }
  }
  const resolved = parts.length === 0 ? '.' : parts.join('/');
  if (allNodes.some((n) => n.fullPath === resolved)) return resolved;
  return null;
}

function normalize(v: V2): V2 {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
}
