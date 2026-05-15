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

const SCRIPT_TO_JOINT_TYPE: Record<string, 'revolute' | 'prismatic' | 'distance' | 'weld'> = {
  'res://box2d/box2d_revolute_joint.gd': 'revolute',
  'res://box2d/box2d_prismatic_joint.gd': 'prismatic',
  'res://box2d/box2d_distance_joint.gd': 'distance',
  'res://box2d/box2d_weld_joint.gd': 'weld',
};

const BOX2D_ROOT_SCRIPT = 'res://box2d/box2d_root.gd';

// ---------------------------------------------------------------------------
// Output schema (mirrored in src/lib/loadGodotGeometry.ts)
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
  /** If false, the sprite stays axis-aligned regardless of body rotation. */
  shouldRotate?: boolean;
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

  const tscnFiles = fs.readdirSync(geometryDir).filter((f) => f.endsWith('.tscn'));
  const parsed = new Map<string, Box2DGeometry>();
  const godotRoot = path.resolve(path.dirname(path.resolve(geometryDir)));
  const subsceneCache = new Map<string, Box2DGeometry>();

  for (const file of tscnFiles) {
    const name = file.replace('.tscn', '');
    const filePath = path.join(geometryDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const geometry = parseGeometryTscn(content, spriteMap, { godotRoot, subsceneCache });
    lintGeometry(name, geometry);
    fs.writeFileSync(path.join(outputDir, `${name}.json`), JSON.stringify(geometry, null, 2));
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
  const subShapes: Record<string, SubShape> = {};
  for (const s of sections) {
    if (s.type !== 'sub_resource') continue;
    const id = unquote(s.attrs.id ?? '');
    const type = unquote(s.attrs.type ?? '');
    if (!id) continue;
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
  const godotPathToPixi: Record<string, { frame?: string; anim?: string }> = {};
  for (const entry of Object.values(spriteMap)) {
    godotPathToPixi[entry.godotPath] = { frame: entry.pixiFrame, anim: entry.pixiAnimation };
  }

  // Identify local body nodes
  const bodyNodes: NodeInfo[] = nodes.filter(
    (n) => n.scriptResPath !== undefined && n.scriptResPath in SCRIPT_TO_BODY_TYPE,
  );

  // Build local body defs
  const bodies: Box2DBodyDef[] = bodyNodes.map((bodyNode) =>
    buildBodyDef(bodyNode, nodes, subShapes, extResources, godotPathToPixi, globalTransforms),
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
  // Subscene NodePaths are already resolved internally (during the recursive
  // parseGeometryTscn call), so we don't need to re-rewrite them.
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
  }

  // Build local joint defs (after subscene merge so indices are stable)
  for (const n of nodes) {
    if (!n.scriptResPath || !(n.scriptResPath in SCRIPT_TO_JOINT_TYPE)) continue;
    const j = buildJointDef(n, nodes, bodyPathToIndex, globalTransforms);
    if (j) joints.push(j);
  }

  // Scene-level gravity: prefer Box2DRoot's `gravity` export, fall back to
  // legacy `metadata/gravity` on the root for unmigrated scenes.
  const root = nodes.find((n) => n.parentPath === '');
  let gravity: V2 | undefined;
  if (root) {
    if (root.scriptResPath === BOX2D_ROOT_SCRIPT) {
      const gravProp = root.props.get('gravity');
      if (gravProp) {
        const decoded = decodeGodotValue(gravProp);
        if (decoded && typeof decoded === 'object' && 'x' in decoded && 'y' in decoded) {
          gravity = decoded as V2;
        }
      }
    }
    if (gravity === undefined) {
      const gravProp = root.props.get('metadata/gravity');
      if (gravProp) {
        const decoded = decodeGodotValue(gravProp);
        if (decoded && typeof decoded === 'object' && 'x' in decoded && 'y' in decoded) {
          gravity = decoded as V2;
        }
      }
    }
  }

  return { gravity, bodies, joints };
}

// ---------------------------------------------------------------------------
// Body builder
// ---------------------------------------------------------------------------

function buildBodyDef(
  bodyNode: NodeInfo,
  allNodes: NodeInfo[],
  subShapes: Record<string, SubShape>,
  extResources: Record<string, string>,
  godotPathToPixi: Record<string, { frame?: string; anim?: string }>,
  globalTransforms: Map<string, GTransform>,
): Box2DBodyDef {
  const type = SCRIPT_TO_BODY_TYPE[bodyNode.scriptResPath!];
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
      const isReference = decodeGodotValue(child.props.get('metadata/reference') ?? 'false') === true;
      if (isReference) continue;
      const binding = buildSpriteBinding(child, bodyNode, extResources, godotPathToPixi, globalTransforms);
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
  const userData = collectUserData(shapeNode, true);
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
  godotPathToPixi: Record<string, { frame?: string; anim?: string }>,
  globalTransforms: Map<string, GTransform>,
): SpriteBinding | null {
  const local = transformInBody(spriteNode, bodyNode, globalTransforms);

  // Resolve texture
  let pixiFrame: string | undefined;
  let pixiAnimation: string | undefined;
  if (spriteNode.type === 'Sprite2D') {
    const texProp = spriteNode.props.get('texture');
    const extId = texProp?.match(/ExtResource\("([^"]+)"\)/)?.[1];
    if (extId && extResources[extId]) {
      const resolved = godotPathToPixi[extResources[extId]];
      if (resolved) {
        pixiFrame = resolved.frame;
        pixiAnimation = resolved.anim;
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
  // `metadata/rotate = false` opts the sprite out of body-angle tracking.
  // Used for things like shadows that should stay flat on the floor even as
  // the body rotates. Default is true (sprites follow the body).
  const rotateProp = spriteNode.props.get('metadata/rotate');
  const shouldRotate = rotateProp === undefined ? true : decodeGodotValue(rotateProp) === true;

  const binding: SpriteBinding = {
    offset: { x: local.origin.x + offset.x, y: local.origin.y + offset.y },
    rotation: local.rotation,
    scale: { x: local.scale.x, y: local.scale.y },
    anchor: centered ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
  };
  if (pixiFrame) binding.pixiFrame = pixiFrame;
  if (pixiAnimation) binding.pixiAnimation = pixiAnimation;
  if (zIndex) binding.z = zIndex;
  if (tint !== undefined && tint !== 0xffffff) binding.tint = tint;
  if (alpha !== undefined && alpha !== 1) binding.alpha = alpha;
  if (flipH) binding.flipH = true;
  if (flipV) binding.flipV = true;
  if (!shouldRotate) binding.shouldRotate = false;

  return binding;
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

const RESERVED_METADATA_KEYS = new Set(['reference', 'gravity']);
const FIXTURE_MATERIAL_KEYS = new Set([
  'density',
  'friction',
  'restitution',
  'sensor',
  'category_bits',
  'mask_bits',
  'group_index',
]);

function collectUserData(node: NodeInfo, isFixture = false): Record<string, unknown> {
  // Prefer the typed `user_data` Dictionary export (from the new authoring
  // kit). Fall back to metadata/* for scenes that haven't migrated yet.
  const typed = node.props.get('user_data');
  if (typed !== undefined) {
    const decoded = decodeGodotValue(typed);
    if (decoded && typeof decoded === 'object' && !('x' in (decoded as object))) {
      return decoded as Record<string, unknown>;
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of node.props) {
    if (!k.startsWith('metadata/')) continue;
    const key = k.slice('metadata/'.length);
    if (RESERVED_METADATA_KEYS.has(key)) continue;
    if (isFixture && FIXTURE_MATERIAL_KEYS.has(key)) continue;
    out[key] = decodeGodotValue(v);
  }
  return out;
}

function collectMaterial(shape: NodeInfo): Material {
  // Prefer typed @export properties from Box2DPolygonFixture/Box2DShapeFixture.
  // Fall back to metadata/* for plain CollisionPolygon2D / CollisionShape2D.
  const readNum = (typedKey: string, metaKey: string, fallback: number): number => {
    const direct = shape.props.get(typedKey);
    if (direct !== undefined) {
      const v = decodeGodotValue(direct);
      if (typeof v === 'number') return v;
    }
    const meta = shape.props.get(`metadata/${metaKey}`);
    if (meta !== undefined) {
      const v = decodeGodotValue(meta);
      if (typeof v === 'number') return v;
    }
    return fallback;
  };
  const readBool = (typedKey: string, metaKey: string, fallback: boolean): boolean => {
    const direct = shape.props.get(typedKey);
    if (direct !== undefined) {
      const v = decodeGodotValue(direct);
      if (typeof v === 'boolean') return v;
    }
    const meta = shape.props.get(`metadata/${metaKey}`);
    if (meta !== undefined) {
      const v = decodeGodotValue(meta);
      if (typeof v === 'boolean') return v;
    }
    return fallback;
  };
  const out: Material = {
    density: readNum('density', 'density', 1),
    friction: readNum('friction', 'friction', 0.2),
    restitution: readNum('restitution', 'restitution', 0),
    sensor: readBool('is_sensor', 'sensor', false),
  };
  const readOptInt = (typedKey: string, metaKey: string): number | undefined => {
    const direct = shape.props.get(typedKey);
    if (direct !== undefined) {
      const v = decodeGodotValue(direct);
      if (typeof v === 'number') return v;
    }
    const meta = shape.props.get(`metadata/${metaKey}`);
    if (meta !== undefined) {
      const v = decodeGodotValue(meta);
      if (typeof v === 'number') return v;
    }
    return undefined;
  };
  const cb = readOptInt('category_bits', 'category_bits');
  if (cb !== undefined) out.categoryBits = cb;
  const mb = readOptInt('mask_bits', 'mask_bits');
  if (mb !== undefined) out.maskBits = mb;
  const gi = readOptInt('group_index', 'group_index');
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
