import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseGeometryTscn } from './godot-geometry';

const MINIMAL_TSCN = `[gd_scene load_steps=4 format=3]

[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="1_static"]
[ext_resource type="Script" path="res://box2d/box2d_dynamic_body.gd" id="2_dynamic"]
[ext_resource type="Script" path="res://box2d/box2d_prismatic_joint.gd" id="3_prismatic"]

[sub_resource type="RectangleShape2D" id="rect_1"]
size = Vector2(32, 16)

[node name="Root" type="Node2D"]
metadata/gravity = Vector2(0, -10)

[node name="brick" type="Node2D" parent="."]
position = Vector2(64, -56)
script = ExtResource("1_static")
metadata/type = "brick"
metadata/powerup = "yellow"

[node name="shape0" type="CollisionShape2D" parent="brick"]
shape = SubResource("rect_1")
metadata/density = 1
metadata/restitution = 1

[node name="paddle-anchor" type="Node2D" parent="."]
position = Vector2(0, 320)
script = ExtResource("1_static")
metadata/type = "paddle-joint-holder"

[node name="paddle-body" type="Node2D" parent="."]
position = Vector2(0, 320)
script = ExtResource("2_dynamic")
fixed_rotation = true
metadata/type = "paddle-joint-temp"

[node name="paddle-joint" type="Node2D" parent="."]
position = Vector2(0, 256)
script = ExtResource("3_prismatic")
body_a = NodePath("paddle-anchor")
body_b = NodePath("paddle-body")
local_axis_a = Vector2(1, 0)
enable_limit = true
lower_limit = -160
upper_limit = 160
`;

describe('parseGeometryTscn', () => {
  it('extracts gravity from root metadata', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    expect(geo.gravity).toEqual({ x: 0, y: -10 });
  });

  it('parses a brick body with metadata userData', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    const brick = geo.bodies.find((b) => b.name === 'brick');
    expect(brick).toBeDefined();
    expect(brick!.type).toBe('static');
    // Godot pixel (64, -56) → Box2D (4, 3.5)
    expect(brick!.position).toEqual({ x: 4, y: 3.5 });
    expect(brick!.userData).toEqual({ type: 'brick', powerup: 'yellow' });
  });

  it('converts a RectangleShape2D into a polygon fixture in body-local Box2D meters', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    const brick = geo.bodies.find((b) => b.name === 'brick')!;
    expect(brick.fixtures).toHaveLength(1);
    const fx = brick.fixtures[0];
    expect(fx.shape).toBe('polygon');
    expect(fx.material.density).toBe(1);
    expect(fx.material.restitution).toBe(1);
    // 32x16 px rectangle ⇒ ±16 px / 16 = ±1 m, ±8 px / 16 = ±0.5 m; Y flipped
    if (fx.shape === 'polygon') {
      const xs = fx.vertices.map((v) => v.x).sort((a, b) => a - b);
      const ys = fx.vertices.map((v) => v.y).sort((a, b) => a - b);
      expect(xs).toEqual([-1, -1, 1, 1]);
      expect(ys).toEqual([-0.5, -0.5, 0.5, 0.5]);
    }
  });

  it('does not leak material props into fixture userData', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    const brick = geo.bodies.find((b) => b.name === 'brick')!;
    const fx = brick.fixtures[0];
    expect(fx.userData).toBeUndefined();
  });

  it('builds a prismatic joint and resolves body NodePaths to body indices', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    expect(geo.joints).toHaveLength(1);
    const joint = geo.joints[0];
    expect(joint.name).toBe('paddle-joint');
    expect(joint.type).toBe('prismatic');
    const anchorBodyIdx = geo.bodies.findIndex((b) => b.name === 'paddle-anchor');
    const bodyBIdx = geo.bodies.findIndex((b) => b.name === 'paddle-body');
    expect(joint.bodyA).toBe(anchorBodyIdx);
    expect(joint.bodyB).toBe(bodyBIdx);
    if (joint.type === 'prismatic') {
      expect(joint.localAxisA).toEqual({ x: 1, y: -0 }); // Y-flip preserves (1,0)
      expect(joint.enableLimit).toBe(true);
      // 160 px / 16 = 10 m
      expect(joint.lowerLimit).toBe(-10);
      expect(joint.upperLimit).toBe(10);
    }
  });

  it('encodes body flag exports from script properties', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    const paddleBody = geo.bodies.find((b) => b.name === 'paddle-body')!;
    expect(paddleBody.type).toBe('dynamic');
    expect(paddleBody.fixedRotation).toBe(true);
  });
});

const TYPED_TSCN = `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="1_body"]
[ext_resource type="Script" path="res://box2d/box2d_polygon_fixture.gd" id="2_fx"]

[node name="Root" type="Node2D"]

[node name="brick" type="StaticBody2D" parent="."]
position = Vector2(64, -56)
script = ExtResource("1_body")
user_data = {
"type": "brick",
"powerup": "yellow"
}

[node name="shape0" type="CollisionPolygon2D" parent="brick"]
script = ExtResource("2_fx")
polygon = PackedVector2Array(-16, -8, 16, -8, 16, 8, -16, 8)
density = 2.5
friction = 0.7
restitution = 0.9
is_sensor = true
user_data = {
"label": "main"
}
`;

describe('parseGeometryTscn — typed exports', () => {
  it('reads typed user_data Dictionary on bodies', () => {
    const geo = parseGeometryTscn(TYPED_TSCN, {});
    const brick = geo.bodies.find((b) => b.name === 'brick')!;
    expect(brick.userData).toEqual({ type: 'brick', powerup: 'yellow' });
  });

  it('reads typed material exports on Box2DPolygonFixture', () => {
    const geo = parseGeometryTscn(TYPED_TSCN, {});
    const brick = geo.bodies.find((b) => b.name === 'brick')!;
    const fx = brick.fixtures[0];
    expect(fx.material.density).toBe(2.5);
    expect(fx.material.friction).toBe(0.7);
    expect(fx.material.restitution).toBe(0.9);
    expect(fx.material.sensor).toBe(true);
  });

  it('reads typed user_data Dictionary on fixtures', () => {
    const geo = parseGeometryTscn(TYPED_TSCN, {});
    const brick = geo.bodies.find((b) => b.name === 'brick')!;
    const fx = brick.fixtures[0];
    expect(fx.userData).toEqual({ label: 'main' });
  });
});

describe('parseGeometryTscn — subscene instancing', () => {
  let tmpRoot: string;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-geom-'));
    fs.mkdirSync(path.join(tmpRoot, 'box2d'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'geometry'), { recursive: true });
    // Subscene file: a "head" body at local origin
    fs.writeFileSync(
      path.join(tmpRoot, 'geometry', 'cat.tscn'),
      `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://box2d/box2d_dynamic_body.gd" id="1_body"]

[node name="CatRoot" type="Node2D"]

[node name="head" type="RigidBody2D" parent="."]
position = Vector2(16, 0)
script = ExtResource("1_body")
user_data = {
"type": "cat-body"
}
`,
    );
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('inlines subscene bodies and applies the instance transform', () => {
    const outerTscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://geometry/cat.tscn" id="1_cat"]

[node name="Stage" type="Node2D"]

[node name="Cat" type="Node2D" parent="." instance=ExtResource("1_cat")]
position = Vector2(160, 0)
`;
    const cache = new Map();
    const geo = parseGeometryTscn(outerTscn, {}, { godotRoot: tmpRoot, subsceneCache: cache });
    expect(geo.bodies).toHaveLength(1);
    expect(geo.bodies[0].name).toBe('Cat/head');
    // head was at (16, 0) inside cat.tscn = Box2D (1, 0) m
    // Cat instance is at (160, 0) Godot pixels = Box2D (10, 0) m
    // Expected merged position: (1 + 10, 0) = (11, 0) in m
    expect(geo.bodies[0].position.x).toBeCloseTo(11, 5);
    expect(geo.bodies[0].position.y).toBeCloseTo(0, 5);
    expect(geo.bodies[0].userData).toEqual({ type: 'cat-body' });
  });
});
