#!/usr/bin/env node
/**
 * One-time bootstrap: convert a .rube file into a Godot .tscn that uses our
 * Box2D node scripts.
 *
 * Usage: tsx devtools/rube-to-godot.ts <input.rube> <output.tscn>
 *
 * The output file is meant to be opened in Godot and refined manually
 * afterward. The exporter (devtools/packer/processors/godot-geometry.ts) will
 * re-parse it during the asset build.
 */

import * as fs from 'fs';
import * as path from 'path';

// Must match src/consts.ts PXM
const PXM = 16;

// Body scripts extend Godot's CollisionObject2D types so child collision
// shapes don't trip the "needs a CollisionObject2D parent" warning.
const BODY_TYPE_TO_SCRIPT: Record<
  number,
  { kind: 'static' | 'kinematic' | 'dynamic'; res: string; godotType: string }
> = {
  0: { kind: 'static', res: 'res://box2d/box2d_static_body.gd', godotType: 'StaticBody2D' },
  1: { kind: 'kinematic', res: 'res://box2d/box2d_kinematic_body.gd', godotType: 'CharacterBody2D' },
  2: { kind: 'dynamic', res: 'res://box2d/box2d_dynamic_body.gd', godotType: 'RigidBody2D' },
};

const JOINT_TYPE_TO_SCRIPT: Record<string, string> = {
  revolute: 'res://box2d/box2d_revolute_joint.gd',
  prismatic: 'res://box2d/box2d_prismatic_joint.gd',
  distance: 'res://box2d/box2d_distance_joint.gd',
  weld: 'res://box2d/box2d_weld_joint.gd',
};

const POLYGON_FIXTURE_SCRIPT = 'res://box2d/box2d_polygon_fixture.gd';
const SHAPE_FIXTURE_SCRIPT = 'res://box2d/box2d_shape_fixture.gd';
const ROOT_SCRIPT = 'res://box2d/box2d_root.gd';

interface V2 {
  x: number;
  y: number;
}

function box2dToGodotPos(p: V2): V2 {
  return { x: p.x * PXM, y: -p.y * PXM };
}

function box2dToGodotAngle(a: number): number {
  return -a;
}

function rotateBox2D(v: V2, angle: number): V2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: cos * v.x - sin * v.y, y: sin * v.x + cos * v.y };
}

interface CustomProp {
  name: string;
  string?: string;
  int?: number;
  float?: number;
  bool?: boolean;
  vec2?: V2;
}

/**
 * Split off a `type` custom prop. The body's `type` field is a dedicated
 * @export (not just a dict entry) so prefab inheritance can override it
 * surgically — see Box2DStaticBody.gd's `type` field.
 */
function extractTypeProp(
  props: CustomProp[] | undefined,
): { typeValue: string | null; otherProps: CustomProp[] | undefined } {
  if (!props) return { typeValue: null, otherProps: undefined };
  const typeProp = props.find((p) => p.name === 'type' && p.string !== undefined);
  if (!typeProp) return { typeValue: null, otherProps: props };
  return { typeValue: typeProp.string!, otherProps: props.filter((p) => p !== typeProp) };
}

/**
 * Emit a Godot Dictionary literal for the body/fixture's `user_data` @export.
 * Returns an empty string if there are no entries.
 */
function customPropsToDict(props: CustomProp[] | undefined): string {
  if (!props || props.length === 0) return '';
  const entries: string[] = [];
  for (const p of props) {
    let v: string | null = null;
    if (p.string !== undefined) v = JSON.stringify(p.string);
    else if (p.int !== undefined) v = String(p.int);
    else if (p.float !== undefined) v = String(p.float);
    else if (p.bool !== undefined) v = p.bool ? 'true' : 'false';
    if (v !== null) entries.push(`"${p.name}": ${v}`);
  }
  if (entries.length === 0) return '';
  return `user_data = {\n${entries.join(',\n')}\n}`;
}

interface RubeBody {
  name?: string;
  type?: number | string;
  position?: V2;
  angle?: number;
  fixedRotation?: boolean;
  awake?: boolean;
  allowSleep?: boolean;
  bullet?: boolean;
  linearDamping?: number;
  angularDamping?: number;
  fixture?: RubeFixture[];
  customProperties?: CustomProp[];
}

interface RubeFixture {
  name?: string;
  density?: number;
  friction?: number;
  restitution?: number;
  sensor?: boolean;
  'filter-categoryBits'?: number;
  'filter-maskBits'?: number;
  'filter-groupIndex'?: number;
  // Post-CLI export shape
  circle?: { center?: V2; radius: number };
  polygon?: { vertices: { x: number[]; y: number[] } };
  chain?: { vertices: { x: number[]; y: number[] } };
  // Raw .rube format: type lives in shapes[], vertices/center/radius live at fixture level
  shapes?: Array<{ type: 'polygon' | 'circle' | 'chain' }>;
  vertices?: { x: number[]; y: number[] };
  center?: V2;
  radius?: number;
  customProperties?: CustomProp[];
}

function normalizeFixtureShape(fx: RubeFixture): { kind: 'circle' | 'polygon' | 'chain'; data: unknown } | null {
  if (fx.circle) return { kind: 'circle', data: fx.circle };
  if (fx.polygon) return { kind: 'polygon', data: fx.polygon };
  if (fx.chain) return { kind: 'chain', data: fx.chain };
  // Raw .rube form
  const shapeType = fx.shapes?.[0]?.type;
  if (shapeType === 'polygon' && fx.vertices) return { kind: 'polygon', data: { vertices: fx.vertices } };
  if (shapeType === 'chain' && fx.vertices) return { kind: 'chain', data: { vertices: fx.vertices } };
  if (shapeType === 'circle' && fx.radius !== undefined)
    return { kind: 'circle', data: { center: fx.center ?? { x: 0, y: 0 }, radius: fx.radius } };
  return null;
}

interface RubeJoint {
  name?: string;
  type: string;
  bodyA: number;
  bodyB: number;
  anchorA?: V2;
  anchorB?: V2;
  collideConnected?: boolean;
  refAngle?: number;
  referenceAngle?: number;
  lowerLimit?: number;
  upperLimit?: number;
  enableLimit?: boolean;
  enableMotor?: boolean;
  motorSpeed?: number;
  maxMotorTorque?: number;
  maxMotorForce?: number;
  localAxisA?: V2;
  length?: number;
  frequency?: number;
  dampingRatio?: number;
}

interface RubeWorld {
  metaworld?: {
    gravity?: V2;
    metabody?: RubeBody[];
    metajoint?: RubeJoint[];
  };
}

function normalizeBodyType(t: number | string | undefined): 'static' | 'kinematic' | 'dynamic' {
  if (t === 2 || t === 'dynamic') return 'dynamic';
  if (t === 1 || t === 'kinematic') return 'kinematic';
  return 'static';
}

/** Emit typed @export lines on the fixture script. */
function fixtureExports(fx: RubeFixture): string[] {
  const out: string[] = [];
  if (fx.density !== undefined && fx.density !== 1) out.push(`density = ${fx.density}`);
  if (fx.friction !== undefined && fx.friction !== 0.2) out.push(`friction = ${fx.friction}`);
  if (fx.restitution !== undefined && fx.restitution !== 0) out.push(`restitution = ${fx.restitution}`);
  if (fx.sensor === true) out.push(`is_sensor = true`);
  if (fx['filter-categoryBits'] !== undefined) out.push(`category_bits = ${fx['filter-categoryBits']}`);
  if (fx['filter-maskBits'] !== undefined) out.push(`mask_bits = ${fx['filter-maskBits']}`);
  if (fx['filter-groupIndex'] !== undefined) out.push(`group_index = ${fx['filter-groupIndex']}`);
  const ud = customPropsToDict(fx.customProperties);
  if (ud) out.push(ud);
  return out;
}

function uniqueName(base: string, used: Map<string, number>): string {
  // Godot node names allow dashes; preserve them so gameplay's
  // `joints.find(j => j.name === 'paddle-joint')` lookups keep working.
  const safe = base.replace(/[^A-Za-z0-9_-]/g, '_') || 'Node';
  const n = (used.get(safe) ?? 0) + 1;
  used.set(safe, n);
  return n === 1 ? safe : `${safe}_${n}`;
}

function convert(rube: RubeWorld): string {
  const meta = rube.metaworld;
  if (!meta) throw new Error('Missing metaworld');

  const bodies = meta.metabody ?? [];
  const joints = meta.metajoint ?? [];
  const gravity = meta.gravity ?? { x: 0, y: -10 };

  // Resolve ExtResource ids for every script we may emit. Box2DRoot is always
  // present — it owns scene-wide gravity and the editor visibility toggle.
  const usedScripts = new Set<string>([ROOT_SCRIPT]);
  let anyShapeFixture = false;
  let anyPolygonFixture = false;
  for (const b of bodies) {
    const t = normalizeBodyType(b.type);
    usedScripts.add(BODY_TYPE_TO_SCRIPT[t === 'dynamic' ? 2 : t === 'kinematic' ? 1 : 0].res);
    for (const fx of b.fixture ?? []) {
      const norm = normalizeFixtureShape(fx);
      if (norm?.kind === 'circle') anyShapeFixture = true;
      else if (norm?.kind === 'polygon' || norm?.kind === 'chain') anyPolygonFixture = true;
    }
  }
  if (anyShapeFixture) usedScripts.add(SHAPE_FIXTURE_SCRIPT);
  if (anyPolygonFixture) usedScripts.add(POLYGON_FIXTURE_SCRIPT);
  for (const j of joints) {
    const s = JOINT_TYPE_TO_SCRIPT[j.type === 'rope' ? 'distance' : j.type];
    if (s) usedScripts.add(s);
  }
  const scriptList = [...usedScripts];
  const scriptId = new Map<string, string>(); // res path → id like "1_aaa"
  scriptList.forEach((res, i) => scriptId.set(res, `${i + 1}_b2d`));

  // Body names and Godot world positions
  const usedBodyNames = new Map<string, number>();
  const bodyMeta: Array<{ rube: RubeBody & { id?: number }; name: string; godotPos: V2; godotAngle: number }> =
    bodies.map((b) => {
      const rawName = b.name ?? 'body';
      const name = uniqueName(rawName, usedBodyNames);
      const pos = b.position ?? { x: 0, y: 0 };
      const godotPos = box2dToGodotPos(pos);
      const godotAngle = box2dToGodotAngle(b.angle ?? 0);
      return { rube: b as RubeBody & { id?: number }, name, godotPos, godotAngle };
    });

  // RUBE's raw .rube file references joints by the body `id` field, not the array
  // index (the RUBE CLI export later flattens to array indices, but we operate on
  // the raw form). Build a lookup so joint.bodyA can match either.
  const idToIndex = new Map<number, number>();
  bodyMeta.forEach((bm, i) => {
    if (bm.rube.id !== undefined) idToIndex.set(bm.rube.id, i);
  });
  const resolveBodyRef = (ref: number): number => {
    if (idToIndex.has(ref)) return idToIndex.get(ref)!;
    if (ref >= 0 && ref < bodyMeta.length) return ref;
    return -1;
  };

  // SubResources: one per polygon vertex array? We instead emit polygons
  // inline as CollisionPolygon2D.polygon = PackedVector2Array. CircleShape2D
  // and RectangleShape2D need sub_resource entries.
  const subResources: string[] = [];
  let nextSubId = 1;
  const issueSubId = (prefix: string) => `${prefix}_${nextSubId++}`;

  // Build node sections
  const nodeSections: string[] = [];

  // Root scene node — Box2DRoot script owns scene-wide gravity + visibility.
  const gravityStr = `Vector2(${gravity.x}, ${gravity.y})`;
  const rootScriptId = scriptId.get(ROOT_SCRIPT)!;
  nodeSections.push(
    `[node name="Geometry" type="Node2D"]\nscript = ExtResource("${rootScriptId}")\ngravity = ${gravityStr}\n`,
  );

  // Bodies and their fixtures + sprite stubs
  const usedFixtureNames = new Map<string, number>();
  for (const bm of bodyMeta) {
    const t = normalizeBodyType(bm.rube.type);
    const bodyEntry = BODY_TYPE_TO_SCRIPT[t === 'dynamic' ? 2 : t === 'kinematic' ? 1 : 0];
    const sId = scriptId.get(bodyEntry.res)!;

    const bodyLines: string[] = [];
    bodyLines.push(`[node name="${bm.name}" type="${bodyEntry.godotType}" parent="."]`);
    if (bm.godotPos.x !== 0 || bm.godotPos.y !== 0) {
      bodyLines.push(`position = Vector2(${bm.godotPos.x}, ${bm.godotPos.y})`);
    }
    if (bm.godotAngle !== 0) {
      bodyLines.push(`rotation = ${bm.godotAngle}`);
    }
    bodyLines.push(`script = ExtResource("${sId}")`);
    // Promote a `type` custom prop to the dedicated `type` @export so prefabs
    // and inherited scenes can override the entity discriminator on its own,
    // without touching the rest of user_data.
    const { typeValue, otherProps } = extractTypeProp(bm.rube.customProperties);
    if (typeValue) bodyLines.push(`type = ${JSON.stringify(typeValue)}`);
    const ud = customPropsToDict(otherProps);
    if (ud) bodyLines.push(ud);
    if (bm.rube.fixedRotation === true) bodyLines.push(`fixed_rotation = true`);
    if (bm.rube.bullet === true) bodyLines.push(`bullet = true`);
    if (t === 'dynamic') {
      if (bm.rube.allowSleep === false) bodyLines.push(`allow_sleep = false`);
      if (bm.rube.linearDamping !== undefined && bm.rube.linearDamping !== 0)
        bodyLines.push(`linear_damping = ${bm.rube.linearDamping}`);
      if (bm.rube.angularDamping !== undefined && bm.rube.angularDamping !== 0)
        bodyLines.push(`angular_damping = ${bm.rube.angularDamping}`);
    }
    nodeSections.push(bodyLines.join('\n') + '\n');

    // Fixtures as child nodes — use the typed Box2D{Polygon,Shape}Fixture scripts.
    const fixtures = bm.rube.fixture ?? [];
    for (const fx of fixtures) {
      const normalized = normalizeFixtureShape(fx);
      if (!normalized) continue;
      const rawFxName = fx.name ?? 'fixture';
      const fxName = uniqueName(rawFxName, usedFixtureNames);
      const exports = fixtureExports(fx);

      if (normalized.kind === 'circle') {
        const c = normalized.data as { center: V2; radius: number };
        const subId = issueSubId('CircleShape2D');
        subResources.push(`[sub_resource type="CircleShape2D" id="${subId}"]\nradius = ${c.radius * PXM}\n`);
        const godotCenter = box2dToGodotPos(c.center);
        const fxScriptId = scriptId.get(SHAPE_FIXTURE_SCRIPT)!;
        const lines: string[] = [
          `[node name="${fxName}" type="CollisionShape2D" parent="${bm.name}"]`,
        ];
        if (godotCenter.x !== 0 || godotCenter.y !== 0) {
          lines.push(`position = Vector2(${godotCenter.x}, ${godotCenter.y})`);
        }
        lines.push(`shape = SubResource("${subId}")`);
        lines.push(`script = ExtResource("${fxScriptId}")`);
        for (const e of exports) lines.push(e);
        nodeSections.push(lines.join('\n') + '\n');
      } else if (normalized.kind === 'polygon') {
        const p = normalized.data as { vertices: { x: number[]; y: number[] } };
        const xs = p.vertices.x;
        const ys = p.vertices.y;
        const pts: string[] = [];
        for (let i = 0; i < xs.length; i++) {
          // Vertices are body-local Box2D meters → body-local Godot pixels
          pts.push(`${xs[i] * PXM}, ${-ys[i] * PXM}`);
        }
        const fxScriptId = scriptId.get(POLYGON_FIXTURE_SCRIPT)!;
        const lines: string[] = [
          `[node name="${fxName}" type="CollisionPolygon2D" parent="${bm.name}"]`,
          `polygon = PackedVector2Array(${pts.join(', ')})`,
          `script = ExtResource("${fxScriptId}")`,
        ];
        for (const e of exports) lines.push(e);
        nodeSections.push(lines.join('\n') + '\n');
      } else if (normalized.kind === 'chain') {
        const p = normalized.data as { vertices: { x: number[]; y: number[] } };
        const xs = p.vertices.x;
        const ys = p.vertices.y;
        const pts: string[] = [];
        for (let i = 0; i < xs.length; i++) {
          pts.push(`${xs[i] * PXM}, ${-ys[i] * PXM}`);
        }
        const fxScriptId = scriptId.get(POLYGON_FIXTURE_SCRIPT)!;
        const lines: string[] = [
          `[node name="${fxName}" type="CollisionPolygon2D" parent="${bm.name}"]`,
          `build_mode = 1`,
          `polygon = PackedVector2Array(${pts.join(', ')})`,
          `script = ExtResource("${fxScriptId}")`,
        ];
        for (const e of exports) lines.push(e);
        nodeSections.push(lines.join('\n') + '\n');
      }
    }
  }

  // Joints
  const usedJointNames = new Map<string, number>();
  for (const j of joints) {
    const jType = j.type === 'rope' ? 'distance' : j.type;
    const scriptRes = JOINT_TYPE_TO_SCRIPT[jType];
    if (!scriptRes) {
      console.warn(`Skipping unsupported joint type "${j.type}"`);
      continue;
    }
    const sId = scriptId.get(scriptRes)!;
    const rawName = j.name ?? `${jType}_joint`;
    const name = uniqueName(rawName, usedJointNames);

    const ai = resolveBodyRef(j.bodyA);
    const bi = resolveBodyRef(j.bodyB);
    if (ai < 0 || bi < 0) {
      console.warn(`Skipping joint "${rawName}" with missing body index (a=${j.bodyA}, b=${j.bodyB})`);
      continue;
    }
    const bodyA = bodyMeta[ai];
    const bodyB = bodyMeta[bi];

    // Anchor world position (Box2D meters) = bodyA.pos + R(bodyA.angle) · localAnchorA
    const anchorA = j.anchorA ?? { x: 0, y: 0 };
    const bodyABox2dPos = bodyA.rube.position ?? { x: 0, y: 0 };
    const bodyABox2dAngle = bodyA.rube.angle ?? 0;
    const worldBox2d = {
      x: bodyABox2dPos.x + rotateBox2D(anchorA, bodyABox2dAngle).x,
      y: bodyABox2dPos.y + rotateBox2D(anchorA, bodyABox2dAngle).y,
    };
    const worldGodot = box2dToGodotPos(worldBox2d);

    const lines: string[] = [`[node name="${name}" type="Node2D" parent="."]`];
    if (worldGodot.x !== 0 || worldGodot.y !== 0) {
      lines.push(`position = Vector2(${worldGodot.x}, ${worldGodot.y})`);
    }
    lines.push(`script = ExtResource("${sId}")`);
    lines.push(`body_a = NodePath("${bodyA.name}")`);
    lines.push(`body_b = NodePath("${bodyB.name}")`);
    if (j.collideConnected) lines.push(`collide_connected = true`);

    if (jType === 'revolute') {
      // Reference angle: Godot CW = -RUBE refAngle (handled by processor's negation).
      if (j.refAngle !== undefined && j.refAngle !== 0) lines.push(`reference_angle = ${-j.refAngle}`);
      if (j.enableLimit !== undefined) lines.push(`enable_limit = ${j.enableLimit}`);
      // Lower in CW = -upper in CCW; vice versa
      if (j.upperLimit !== undefined) lines.push(`lower_limit = ${-j.upperLimit}`);
      if (j.lowerLimit !== undefined) lines.push(`upper_limit = ${-j.lowerLimit}`);
      if (j.enableMotor !== undefined) lines.push(`enable_motor = ${j.enableMotor}`);
      if (j.motorSpeed !== undefined && j.motorSpeed !== 0) lines.push(`motor_speed = ${-j.motorSpeed}`);
      if (j.maxMotorTorque !== undefined && j.maxMotorTorque !== 0)
        lines.push(`max_motor_torque = ${j.maxMotorTorque}`);
    } else if (jType === 'prismatic') {
      // local_axis_a: Y-flip (Godot Y-down vs Box2D Y-up)
      const ax = j.localAxisA ?? { x: 1, y: 0 };
      lines.push(`local_axis_a = Vector2(${ax.x}, ${-ax.y})`);
      if (j.refAngle !== undefined && j.refAngle !== 0) lines.push(`reference_angle = ${-j.refAngle}`);
      if (j.enableLimit !== undefined) lines.push(`enable_limit = ${j.enableLimit}`);
      // Limits and motor speed are in Box2D meters/sec; convert to pixels for Godot
      if (j.lowerLimit !== undefined) lines.push(`lower_limit = ${j.lowerLimit * PXM}`);
      if (j.upperLimit !== undefined) lines.push(`upper_limit = ${j.upperLimit * PXM}`);
      if (j.enableMotor !== undefined) lines.push(`enable_motor = ${j.enableMotor}`);
      if (j.motorSpeed !== undefined && j.motorSpeed !== 0) lines.push(`motor_speed = ${j.motorSpeed * PXM}`);
      if (j.maxMotorForce !== undefined && j.maxMotorForce !== 0)
        lines.push(`max_motor_force = ${j.maxMotorForce}`);
    } else if (jType === 'distance') {
      lines.push(`length = ${(j.length ?? 0) * PXM}`);
      if (j.frequency !== undefined && j.frequency !== 0) lines.push(`frequency = ${j.frequency}`);
      if (j.dampingRatio !== undefined && j.dampingRatio !== 0) lines.push(`damping_ratio = ${j.dampingRatio}`);
    } else if (jType === 'weld') {
      const refA = j.referenceAngle ?? j.refAngle;
      if (refA !== undefined && refA !== 0) lines.push(`reference_angle = ${-refA}`);
    }
    nodeSections.push(lines.join('\n') + '\n');
  }

  // Assemble final TSCN
  const totalLoadSteps = scriptList.length + subResources.length;
  const header = `[gd_scene load_steps=${totalLoadSteps + 1} format=3]\n`;
  const extResources = scriptList
    .map((res) => `[ext_resource type="Script" path="${res}" id="${scriptId.get(res)}"]`)
    .join('\n');

  return (
    header +
    '\n' +
    extResources +
    '\n\n' +
    subResources.join('\n') +
    (subResources.length ? '\n' : '') +
    nodeSections.join('\n')
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: tsx devtools/rube-to-godot.ts <input.rube> <output.tscn>');
  process.exit(1);
}
const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);
const rube = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const tscn = convert(rube);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, tscn);
console.log(`Wrote ${outputPath}`);
