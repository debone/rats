import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseGeometryTscn } from './godot-geometry';
import { decodeTileMapData, parsePackedByteArray } from './godot-tscn';

const MINIMAL_TSCN = `[gd_scene load_steps=6 format=3]

[ext_resource type="Script" path="res://box2d/box2d_root.gd" id="0_root"]
[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="1_static"]
[ext_resource type="Script" path="res://box2d/box2d_dynamic_body.gd" id="2_dynamic"]
[ext_resource type="Script" path="res://box2d/box2d_prismatic_joint.gd" id="3_prismatic"]
[ext_resource type="Script" path="res://box2d/box2d_shape_fixture.gd" id="4_shape"]

[sub_resource type="RectangleShape2D" id="rect_1"]
size = Vector2(32, 16)

[node name="Root" type="Node2D"]
script = ExtResource("0_root")
gravity = Vector2(0, -10)

[node name="brick" type="StaticBody2D" parent="."]
position = Vector2(64, -56)
script = ExtResource("1_static")
type = "brick"
user_data = {
"powerup": "yellow"
}

[node name="shape0" type="CollisionShape2D" parent="brick"]
shape = SubResource("rect_1")
script = ExtResource("4_shape")
density = 1.0
restitution = 1.0

[node name="paddle-anchor" type="StaticBody2D" parent="."]
position = Vector2(0, 320)
script = ExtResource("1_static")
type = "paddle-joint-holder"

[node name="paddle-body" type="RigidBody2D" parent="."]
position = Vector2(0, 320)
script = ExtResource("2_dynamic")
type = "paddle-joint-temp"
fixed_rotation = true

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
  it('extracts gravity from the Box2DRoot @export', () => {
    const geo = parseGeometryTscn(MINIMAL_TSCN, {});
    expect(geo.gravity).toEqual({ x: 0, y: -10 });
  });

  it('parses a brick body with typed userData (type @export + user_data dict)', () => {
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

describe('parseGeometryTscn — typed `type` export', () => {
  it('merges the body `type` @export into userData', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="1_body"]

[node name="Root" type="Node2D"]

[node name="brick" type="StaticBody2D" parent="."]
script = ExtResource("1_body")
type = "brick"
user_data = {
"powerup": "yellow"
}
`;
    const geo = parseGeometryTscn(tscn, {});
    const brick = geo.bodies.find((b) => b.name === 'brick')!;
    expect(brick.userData).toEqual({ type: 'brick', powerup: 'yellow' });
  });

  it('explicit `type` export wins over user_data.type', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="1_body"]

[node name="Root" type="Node2D"]

[node name="brick" type="StaticBody2D" parent="."]
script = ExtResource("1_body")
type = "strong-brick"
user_data = {
"type": "brick"
}
`;
    const geo = parseGeometryTscn(tscn, {});
    expect(geo.bodies[0].userData['type']).toBe('strong-brick');
  });
});

describe('parseGeometryTscn — Box2DSprite typed flags', () => {
  it('reads `should_rotate = false` from the typed @export', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://t.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_dynamic_body.gd" id="2_body"]
[ext_resource type="Script" path="res://box2d/box2d_sprite.gd" id="3_sprite"]

[node name="Root" type="Node2D"]

[node name="body" type="RigidBody2D" parent="."]
script = ExtResource("2_body")

[node name="shadow" type="Sprite2D" parent="body"]
texture = ExtResource("1_tex")
script = ExtResource("3_sprite")
should_rotate = false
`;
    const geo = parseGeometryTscn(tscn, { t: { godotPath: 'res://t.tres', type: 'AtlasTexture', pixiFrame: 't#0' } });
    expect(geo.bodies[0].sprites[0].shouldRotate).toBe(false);
  });

  it('binds a Box2DNineSlice under a body as a nine-slice sprite with borders', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://panel.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="2_body"]
[ext_resource type="Script" path="res://box2d/box2d_nine_slice.gd" id="3_ns"]

[node name="Root" type="Node2D"]

[node name="body" type="StaticBody2D" parent="."]
script = ExtResource("2_body")

[node name="panel" type="Sprite2D" parent="body"]
scale = Vector2(4, 3)
texture = ExtResource("1_tex")
script = ExtResource("3_ns")
tile_center = true
`;
    const geo = parseGeometryTscn(tscn, {
      panel: { godotPath: 'res://panel.tres', type: 'AtlasTexture', pixiFrame: 'panel#0', borders: { left: 8, top: 8, right: 8, bottom: 8 } },
    });
    const binding = geo.bodies[0].sprites[0];
    expect(binding.nineSlice).toBe(true);
    expect(binding.borders).toEqual({ left: 8, top: 8, right: 8, bottom: 8 });
    expect(binding.tileCenter).toBe(true);
    // The node scale is preserved so the runtime can stretch by it (corners pinned).
    expect(binding.scale).toEqual({ x: 4, y: 3 });
    expect(binding.pixiFrame).toBe('panel#0');
  });

  it('skips export when `attached = false` (editor-only reference art)', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://t.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_dynamic_body.gd" id="2_body"]
[ext_resource type="Script" path="res://box2d/box2d_sprite.gd" id="3_sprite"]

[node name="Root" type="Node2D"]

[node name="body" type="RigidBody2D" parent="."]
script = ExtResource("2_body")

[node name="trace-art" type="Sprite2D" parent="body"]
texture = ExtResource("1_tex")
script = ExtResource("3_sprite")
attached = false
`;
    const geo = parseGeometryTscn(tscn, { t: { godotPath: 'res://t.tres', type: 'AtlasTexture', pixiFrame: 't#0' } });
    expect(geo.bodies[0].sprites).toEqual([]);
  });
});

describe('parseGeometryTscn — background', () => {
  it('extracts a textured Polygon2D as a mesh with fan-triangulation', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://water.tres" id="1_tex"]

[node name="Root" type="Node2D"]

[node name="water" type="Polygon2D" parent="."]
position = Vector2(10, 20)
texture = ExtResource("1_tex")
polygon = PackedVector2Array(0, 0, 32, 0, 32, 32, 0, 32)
uv = PackedVector2Array(0, 0, 32, 0, 32, 32, 0, 32)
`;
    const geo = parseGeometryTscn(tscn, {
      water: { godotPath: 'res://water.tres', type: 'AtlasTexture', pixiFrame: 'water#0' },
    });
    expect(geo.background).toBeDefined();
    expect(geo.background!.meshes).toHaveLength(1);
    const mesh = geo.background!.meshes[0];
    expect(mesh.pixiFrame).toBe('water#0');
    expect(mesh.vertices).toHaveLength(4);
    // Fan triangulation of a quad: (0,1,2) + (0,2,3)
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(mesh.position).toEqual({ x: 10, y: 20 });
  });

  it('skips polygons under a body (those are collision fixtures, not visuals)', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://water.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_static_body.gd" id="2_body"]

[node name="Root" type="Node2D"]

[node name="body" type="StaticBody2D" parent="."]
script = ExtResource("2_body")

[node name="not-a-mesh" type="Polygon2D" parent="body"]
texture = ExtResource("1_tex")
polygon = PackedVector2Array(0, 0, 32, 0, 16, 32)
`;
    const geo = parseGeometryTscn(tscn, {
      water: { godotPath: 'res://water.tres', type: 'AtlasTexture', pixiFrame: 'water#0' },
    });
    expect(geo.background).toBeUndefined();
  });

  it('extracts standalone Sprite2D nodes as background sprites', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://prop.tres" id="1_tex"]

[node name="Root" type="Node2D"]

[node name="bg-prop" type="Sprite2D" parent="."]
position = Vector2(64, 96)
texture = ExtResource("1_tex")
`;
    const geo = parseGeometryTscn(tscn, {
      prop: { godotPath: 'res://prop.tres', type: 'AtlasTexture', pixiFrame: 'prop#0' },
    });
    expect(geo.background!.sprites).toHaveLength(1);
    expect(geo.background!.sprites[0].position).toEqual({ x: 64, y: 96 });
    expect(geo.background!.sprites[0].pixiFrame).toBe('prop#0');
  });

  it('extracts a Box2DNineSlice as a nine-patch with borders from the sprite-map', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://bg.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_nine_slice.gd" id="2_ns"]

[node name="Root" type="Node2D"]

[node name="panel" type="Sprite2D" parent="."]
position = Vector2(100, 50)
scale = Vector2(2, 1.5)
texture = ExtResource("1_tex")
script = ExtResource("2_ns")
`;
    const geo = parseGeometryTscn(tscn, {
      bg: {
        godotPath: 'res://bg.tres',
        type: 'AtlasTexture',
        pixiFrame: 'bg#0',
        borders: { left: 15, top: 16, right: 16, bottom: 16 },
      },
    });
    // It must NOT also leak into the plain Sprite2D background bucket.
    expect(geo.background!.sprites).toHaveLength(0);
    expect(geo.background!.ninePatches).toHaveLength(1);
    const np = geo.background!.ninePatches[0];
    expect(np.pixiFrame).toBe('bg#0');
    // No `size` export — the node's scale drives the runtime stretch instead.
    expect(np.scale).toEqual({ x: 2, y: 1.5 });
    expect(np.borders).toEqual({ left: 15, top: 16, right: 16, bottom: 16 });
    expect(np.position).toEqual({ x: 100, y: 50 });
    // Sprite2D defaults to centered → anchor (0.5, 0.5).
    expect(np.anchor).toEqual({ x: 0.5, y: 0.5 });
    // tile_center defaults off, so the flag is omitted.
    expect(np.tileCenter).toBeUndefined();
  });

  it('sets tileCenter on a background nine-patch with tile_center = true', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://bg.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_nine_slice.gd" id="2_ns"]

[node name="Root" type="Node2D"]

[node name="panel" type="Sprite2D" parent="."]
texture = ExtResource("1_tex")
script = ExtResource("2_ns")
tile_center = true
`;
    const geo = parseGeometryTscn(tscn, {
      bg: { godotPath: 'res://bg.tres', type: 'AtlasTexture', pixiFrame: 'bg#0', borders: { left: 8, top: 8, right: 8, bottom: 8 } },
    });
    expect(geo.background!.ninePatches[0].tileCenter).toBe(true);
  });

  it('defaults nine-patch borders to zero when the texture has no slice metadata', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://bg.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_nine_slice.gd" id="2_ns"]

[node name="Root" type="Node2D"]

[node name="panel" type="Sprite2D" parent="."]
texture = ExtResource("1_tex")
script = ExtResource("2_ns")
size = Vector2(64, 64)
`;
    const geo = parseGeometryTscn(tscn, {
      bg: { godotPath: 'res://bg.tres', type: 'AtlasTexture', pixiFrame: 'bg#0' },
    });
    expect(geo.background!.ninePatches).toHaveLength(1);
    expect(geo.background!.ninePatches[0].borders).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('skips a Box2DNineSlice flagged attached = false (editor-only reference art)', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://bg.tres" id="1_tex"]
[ext_resource type="Script" path="res://box2d/box2d_nine_slice.gd" id="2_ns"]

[node name="Root" type="Node2D"]

[node name="panel" type="Sprite2D" parent="."]
texture = ExtResource("1_tex")
script = ExtResource("2_ns")
size = Vector2(64, 64)
attached = false
`;
    const geo = parseGeometryTscn(tscn, {
      bg: { godotPath: 'res://bg.tres', type: 'AtlasTexture', pixiFrame: 'bg#0' },
    });
    expect(geo.background).toBeUndefined();
  });

  it('extracts a Box2DPolygon as a tiled-fill mesh with a tiled border and corner piece', () => {
    const tscn = `[gd_scene load_steps=5 format=3]

[ext_resource type="Texture2D" path="res://sprites/lvl/water.tres" id="1_fill"]
[ext_resource type="Texture2D" path="res://sprites/lvl/foam.tres" id="2_border"]
[ext_resource type="Texture2D" path="res://sprites/lvl/foam_corner.tres" id="3_corner"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="4_poly"]

[node name="Root" type="Node2D"]

[node name="water" type="Polygon2D" parent="."]
position = Vector2(10, 20)
texture = ExtResource("1_fill")
script = ExtResource("4_poly")
polygon = PackedVector2Array(0, 0, 32, 0, 32, 32, 0, 32)
uv = PackedVector2Array(0, 0, 32, 0, 32, 32, 0, 32)
border_texture = ExtResource("2_border")
border_corner_texture = ExtResource("3_corner")
border_width = 6.0
border_texture_scale = 0.5
`;
    const geo = parseGeometryTscn(tscn, {
      fill: { godotPath: 'res://sprites/lvl/water.tres', type: 'AtlasTexture', pixiFrame: 'water#0', atlas: 'levels/lvl.aseprite' },
      border: { godotPath: 'res://sprites/lvl/foam.tres', type: 'AtlasTexture', pixiFrame: 'foam#0', atlas: 'levels/lvl.aseprite' },
      corner: { godotPath: 'res://sprites/lvl/foam_corner.tres', type: 'AtlasTexture', pixiFrame: 'foam_corner#0', atlas: 'fx/foam.aseprite' },
    });
    expect(geo.background!.meshes).toHaveLength(1);
    const mesh = geo.background!.meshes[0];
    expect(mesh.pixiFrame).toBe('water#0');
    expect(mesh.pixiAtlas).toBe('levels/lvl.aseprite');
    expect(mesh.tileFill).toBe(true);
    expect(mesh.border).toEqual({
      pixiFrame: 'foam#0',
      pixiAtlas: 'levels/lvl.aseprite',
      width: 6,
      textureScale: 0.5,
      closed: true,
      cornerFrame: 'foam_corner#0',
      cornerAtlas: 'fx/foam.aseprite',
    });
  });

  it('reads border_corner_size and border_corner_orientation onto the border def', () => {
    const tscn = `[gd_scene load_steps=4 format=3]

[ext_resource type="Texture2D" path="res://b.tres" id="1_border"]
[ext_resource type="Texture2D" path="res://c.tres" id="2_corner"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="3_poly"]

[node name="Root" type="Node2D"]

[node name="p" type="Polygon2D" parent="."]
script = ExtResource("3_poly")
polygon = PackedVector2Array(0, 0, 32, 0, 32, 32, 0, 32)
border_texture = ExtResource("1_border")
border_corner_texture = ExtResource("2_corner")
border_width = 6.0
border_corner_size = Vector2(20, 12)
border_corner_orientation = 1
`;
    const geo = parseGeometryTscn(tscn, {
      b: { godotPath: 'res://b.tres', type: 'AtlasTexture', pixiFrame: 'b#0' },
      c: { godotPath: 'res://c.tres', type: 'AtlasTexture', pixiFrame: 'c#0' },
    });
    expect(geo.background!.meshes[0].border).toMatchObject({
      cornerFrame: 'c#0',
      cornerSize: { x: 20, y: 12 },
      cornerOrientation: 'snap',
    });
  });

  it('omits the border when a Box2DPolygon has no border_texture', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://sprites/lvl/water.tres" id="1_fill"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="2_poly"]

[node name="Root" type="Node2D"]

[node name="water" type="Polygon2D" parent="."]
texture = ExtResource("1_fill")
script = ExtResource("2_poly")
polygon = PackedVector2Array(0, 0, 32, 0, 16, 32)
tile_fill = false
`;
    const geo = parseGeometryTscn(tscn, {
      fill: { godotPath: 'res://sprites/lvl/water.tres', type: 'AtlasTexture', pixiFrame: 'water#0' },
    });
    const mesh = geo.background!.meshes[0];
    expect(mesh.border).toBeUndefined();
    expect(mesh.tileFill).toBeUndefined(); // tile_fill = false → flag omitted
  });

  it('leaves plain Polygon2D meshes free of nine-slice/border fields', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://water.tres" id="1_tex"]

[node name="Root" type="Node2D"]

[node name="water" type="Polygon2D" parent="."]
texture = ExtResource("1_tex")
polygon = PackedVector2Array(0, 0, 32, 0, 16, 32)
`;
    const geo = parseGeometryTscn(tscn, {
      water: { godotPath: 'res://water.tres', type: 'AtlasTexture', pixiFrame: 'water#0' },
    });
    const mesh = geo.background!.meshes[0];
    expect(mesh.tileFill).toBeUndefined();
    expect(mesh.border).toBeUndefined();
  });

  it('skips a Box2DPolygon flagged attached = false', () => {
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://sprites/lvl/water.tres" id="1_fill"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="2_poly"]

[node name="Root" type="Node2D"]

[node name="water" type="Polygon2D" parent="."]
texture = ExtResource("1_fill")
script = ExtResource("2_poly")
polygon = PackedVector2Array(0, 0, 32, 0, 16, 32)
attached = false
`;
    const geo = parseGeometryTscn(tscn, {
      fill: { godotPath: 'res://sprites/lvl/water.tres', type: 'AtlasTexture', pixiFrame: 'water#0' },
    });
    expect(geo.background).toBeUndefined();
  });

  it('tessellates a Box2DCurve into a mesh with a tiled fill + border', () => {
    // 3-point Curve2D with zero handles → straight segments; curve_samples=1
    // collapses each segment to its end point, so the vertices are the corners.
    const tscn = `[gd_scene load_steps=4 format=3]

[ext_resource type="Texture2D" path="res://sprites/lvl/water.tres" id="1_fill"]
[ext_resource type="Texture2D" path="res://sprites/lvl/foam.tres" id="2_border"]
[ext_resource type="Script" path="res://box2d/box2d_curve.gd" id="3_curve"]

[sub_resource type="Curve2D" id="Curve2D_1"]
_data = {
"points": PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 50, 100)
}
point_count = 3

[node name="Root" type="Node2D"]

[node name="blob" type="Path2D" parent="."]
texture = ExtResource("1_fill")
script = ExtResource("3_curve")
curve = SubResource("Curve2D_1")
curve_samples = 1
border_texture = ExtResource("2_border")
border_width = 8.0
border_corner_texture = ExtResource("2_border")
border_corner_min_angle = 30.0
`;
    const geo = parseGeometryTscn(tscn, {
      fill: { godotPath: 'res://sprites/lvl/water.tres', type: 'AtlasTexture', pixiFrame: 'water#0', atlas: 'levels/lvl.aseprite' },
      border: { godotPath: 'res://sprites/lvl/foam.tres', type: 'AtlasTexture', pixiFrame: 'foam#0', atlas: 'fx/foam.aseprite' },
    });
    expect(geo.background!.meshes).toHaveLength(1);
    const mesh = geo.background!.meshes[0];
    expect(mesh.name).toBe('blob');
    expect(mesh.tileFill).toBe(true);
    expect(mesh.pixiFrame).toBe('water#0');
    expect(mesh.pixiAtlas).toBe('levels/lvl.aseprite');
    // curve_samples=1 → the three corner points of the curve.
    expect(mesh.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]);
    expect(mesh.border?.pixiFrame).toBe('foam#0');
    expect(mesh.border?.cornerFrame).toBe('foam#0');
    expect(mesh.border?.cornerMinAngle).toBe(30);
  });

  it('skips a Box2DCurve flagged attached = false', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://box2d/box2d_curve.gd" id="1_curve"]

[sub_resource type="Curve2D" id="Curve2D_1"]
_data = {
"points": PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 50, 100)
}

[node name="Root" type="Node2D"]

[node name="blob" type="Path2D" parent="."]
script = ExtResource("1_curve")
curve = SubResource("Curve2D_1")
attached = false
`;
    const geo = parseGeometryTscn(tscn, {});
    expect(geo.background).toBeUndefined();
  });
});

describe('decodeTileMapData', () => {
  // 2-byte LE header (version 0) + 12-byte cells (coord_x/y int16, source_id/atlas_x/y/alt uint16, all LE)
  function makeBlob(cells: Array<[number, number, number, number, number, number]>): Uint8Array {
    const buf = new ArrayBuffer(2 + cells.length * 12);
    const v = new DataView(buf);
    v.setUint16(0, 0, true);
    cells.forEach(([cx, cy, src, ax, ay, alt], i) => {
      const o = 2 + i * 12;
      v.setInt16(o + 0, cx, true);
      v.setInt16(o + 2, cy, true);
      v.setUint16(o + 4, src, true);
      v.setUint16(o + 6, ax, true);
      v.setUint16(o + 8, ay, true);
      v.setUint16(o + 10, alt, true);
    });
    return new Uint8Array(buf);
  }

  it('decodes a small blob of positive cells', () => {
    const blob = makeBlob([
      [0, 0, 0, 3, 2, 0],
      [1, 0, 0, 4, 2, 0],
    ]);
    expect(decodeTileMapData(blob)).toEqual([
      { coordX: 0, coordY: 0, sourceId: 0, atlasX: 3, atlasY: 2, alternativeTile: 0 },
      { coordX: 1, coordY: 0, sourceId: 0, atlasX: 4, atlasY: 2, alternativeTile: 0 },
    ]);
  });

  it('decodes negative cell coordinates (two\'s complement int16)', () => {
    const blob = makeBlob([[-5, -3, 0, 0, 0, 0]]);
    const cells = decodeTileMapData(blob);
    expect(cells[0].coordX).toBe(-5);
    expect(cells[0].coordY).toBe(-3);
  });

  it('skips sentinel "empty" cells (source_id or atlas_x == 0xFFFF)', () => {
    const blob = makeBlob([
      [0, 0, 0xffff, 0, 0, 0],
      [1, 0, 0, 0xffff, 0, 0],
      [2, 0, 0, 5, 5, 0],
    ]);
    const cells = decodeTileMapData(blob);
    expect(cells).toHaveLength(1);
    expect(cells[0].coordX).toBe(2);
  });

  it('parses the PackedByteArray("...") base64 form', () => {
    const blob = makeBlob([[0, 0, 0, 1, 0, 0]]);
    const b64 = Buffer.from(blob).toString('base64');
    const decoded = parsePackedByteArray(`PackedByteArray("${b64}")`);
    expect(decoded).toEqual(blob);
  });

  it('parses the PackedByteArray(0, 1, 2, …) decimal form', () => {
    const blob = makeBlob([[0, 0, 0, 1, 0, 0]]);
    const decimal = `PackedByteArray(${[...blob].join(', ')})`;
    const decoded = parsePackedByteArray(decimal);
    expect(decoded).toEqual(blob);
  });
});

describe('parseGeometryTscn — TileMapLayer', () => {
  function makeBlob(cells: Array<[number, number, number, number, number, number]>): string {
    const buf = new ArrayBuffer(2 + cells.length * 12);
    const v = new DataView(buf);
    v.setUint16(0, 0, true);
    cells.forEach(([cx, cy, src, ax, ay, alt], i) => {
      const o = 2 + i * 12;
      v.setInt16(o + 0, cx, true);
      v.setInt16(o + 2, cy, true);
      v.setUint16(o + 4, src, true);
      v.setUint16(o + 6, ax, true);
      v.setUint16(o + 8, ay, true);
      v.setUint16(o + 10, alt, true);
    });
    return Buffer.from(new Uint8Array(buf)).toString('base64');
  }

  it('resolves cells via tilesheet metadata into Pixi frame names', () => {
    // 10-column tilesheet → cell (3, 2) is index 23 → "tiles_23#0"
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-tilemap-'));
    fs.mkdirSync(path.join(tmpRoot, 'box2d'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'tileset.tres'),
      `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://sprites/sheet.tres" id="1_tex"]

[sub_resource type="TileSetAtlasSource" id="atlas_0"]
texture = ExtResource("1_tex")
texture_region_size = Vector2i(32, 32)

[resource]
sources/0 = SubResource("atlas_0")
tile_size = Vector2i(32, 32)
`,
    );

    const blob = makeBlob([
      [0, 0, 0, 3, 2, 0],
      [1, 0, 0, 0, 0, 0],
    ]);
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="TileSet" path="res://tileset.tres" id="1_ts"]

[node name="Root" type="Node2D"]

[node name="bg" type="TileMapLayer" parent="."]
tile_set = ExtResource("1_ts")
tile_map_data = PackedByteArray("${blob}")
`;
    const geo = parseGeometryTscn(
      tscn,
      {
        sheet: {
          godotPath: 'res://sprites/sheet.tres',
          type: 'AtlasTexture',
          pixiFrame: 'sheet#0',
          tilesheet: { framePrefix: 'tiles', cols: 10, rows: 10, tileSize: 32 },
        },
      },
      { godotRoot: tmpRoot },
    );
    expect(geo.background!.tileLayers).toHaveLength(1);
    const layer = geo.background!.tileLayers[0];
    expect(layer.name).toBe('bg');
    expect(layer.tileSize).toEqual({ x: 32, y: 32 });
    expect(layer.tiles).toEqual([
      { x: 0, y: 0, pixiFrame: 'tiles_23#0' },
      { x: 1, y: 0, pixiFrame: 'tiles_0#0' },
    ]);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('resolves an animated tile into frames + per-frame durations', () => {
    // Tile (3,2) is a 3-frame animation at 4 fps; frames run horizontally →
    // cells (3,2),(4,2),(5,2) → linear 23,24,25 on a 10-column sheet.
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-anim-tile-'));
    fs.mkdirSync(path.join(tmpRoot, 'box2d'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'tileset.tres'),
      `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://sprites/sheet.tres" id="1_tex"]

[sub_resource type="TileSetAtlasSource" id="atlas_0"]
texture = ExtResource("1_tex")
texture_region_size = Vector2i(32, 32)
3:2/0 = 0
3:2/animation_columns = 0
3:2/animation_frames_count = 3
3:2/animation_speed = 4.0
3:2/animation_frame_0/duration = 1.0
3:2/animation_frame_1/duration = 1.0
3:2/animation_frame_2/duration = 1.0

[resource]
sources/0 = SubResource("atlas_0")
tile_size = Vector2i(32, 32)
`,
    );

    const blob = makeBlob([
      [0, 0, 0, 3, 2, 0],
      [1, 0, 0, 0, 0, 0],
    ]);
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="TileSet" path="res://tileset.tres" id="1_ts"]

[node name="Root" type="Node2D"]

[node name="bg" type="TileMapLayer" parent="."]
tile_set = ExtResource("1_ts")
tile_map_data = PackedByteArray("${blob}")
`;
    const geo = parseGeometryTscn(
      tscn,
      {
        sheet: {
          godotPath: 'res://sprites/sheet.tres',
          type: 'AtlasTexture',
          pixiFrame: 'sheet#0',
          tilesheet: { framePrefix: 'tiles', cols: 10, rows: 10, tileSize: 32 },
        },
      },
      { godotRoot: tmpRoot },
    );

    const tiles = geo.background!.tileLayers[0].tiles;
    expect(tiles[0]).toEqual({
      x: 0,
      y: 0,
      pixiFrame: 'tiles_23#0',
      frames: ['tiles_23#0', 'tiles_24#0', 'tiles_25#0'],
      frameDurations: [250, 250, 250], // 1.0s / 4 fps = 250ms
    });
    // The non-animated neighbour stays a plain static placement.
    expect(tiles[1]).toEqual({ x: 1, y: 0, pixiFrame: 'tiles_0#0' });
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('clips a child TileMapLayer to a mask_children Box2DPolygon (no mesh, clip projected to layer-local)', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-clip-'));
    fs.mkdirSync(path.join(tmpRoot, 'box2d'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'tileset.tres'),
      `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://sprites/sheet.tres" id="1_tex"]

[sub_resource type="TileSetAtlasSource" id="atlas_0"]
texture = ExtResource("1_tex")
texture_region_size = Vector2i(32, 32)

[resource]
sources/0 = SubResource("atlas_0")
tile_size = Vector2i(32, 32)
`,
    );

    const blob = makeBlob([[0, 0, 0, 0, 0, 0]]);
    const tscn = `[gd_scene load_steps=3 format=3]

[ext_resource type="TileSet" path="res://tileset.tres" id="1_ts"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="2_poly"]

[node name="Root" type="Node2D"]

[node name="clip" type="Polygon2D" parent="."]
position = Vector2(10, 20)
script = ExtResource("2_poly")
polygon = PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)
mask_children = true

[node name="tiles" type="TileMapLayer" parent="clip"]
position = Vector2(5, 5)
tile_set = ExtResource("1_ts")
tile_map_data = PackedByteArray("${blob}")
`;
    const geo = parseGeometryTscn(
      tscn,
      {
        sheet: {
          godotPath: 'res://sprites/sheet.tres',
          type: 'AtlasTexture',
          pixiFrame: 'sheet#0',
          tilesheet: { framePrefix: 'tiles', cols: 10, rows: 10, tileSize: 32 },
        },
      },
      { godotRoot: tmpRoot },
    );
    // The clip polygon renders no mesh of its own.
    expect(geo.background!.meshes).toHaveLength(0);
    expect(geo.background!.tileLayers).toHaveLength(1);
    // clip = polygon world verts (poly + (10,20)) mapped into the layer's local
    // space (layer global = (15,25)), i.e. each polygon vertex shifted by (-5,-5).
    expect(geo.background!.tileLayers[0].clip).toEqual([
      { x: -5, y: -5 },
      { x: 59, y: -5 },
      { x: 59, y: 59 },
      { x: -5, y: 59 },
    ]);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('emits a border-only mesh (no fill) for a mask_children shape with a border_texture', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-clipborder-'));
    fs.mkdirSync(path.join(tmpRoot, 'box2d'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'tileset.tres'),
      `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://sprites/sheet.tres" id="1_tex"]

[sub_resource type="TileSetAtlasSource" id="atlas_0"]
texture = ExtResource("1_tex")
texture_region_size = Vector2i(32, 32)

[resource]
sources/0 = SubResource("atlas_0")
tile_size = Vector2i(32, 32)
`,
    );

    const blob = makeBlob([[0, 0, 0, 0, 0, 0]]);
    const tscn = `[gd_scene load_steps=4 format=3]

[ext_resource type="TileSet" path="res://tileset.tres" id="1_ts"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="2_poly"]
[ext_resource type="Texture2D" path="res://sprites/border.tres" id="3_border"]

[node name="Root" type="Node2D"]

[node name="clip" type="Polygon2D" parent="."]
script = ExtResource("2_poly")
polygon = PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)
mask_children = true
border_texture = ExtResource("3_border")
border_width = 8.0

[node name="tiles" type="TileMapLayer" parent="clip"]
tile_set = ExtResource("1_ts")
tile_map_data = PackedByteArray("${blob}")
`;
    const geo = parseGeometryTscn(
      tscn,
      {
        sheet: {
          godotPath: 'res://sprites/sheet.tres',
          type: 'AtlasTexture',
          pixiFrame: 'sheet#0',
          tilesheet: { framePrefix: 'tiles', cols: 10, rows: 10, tileSize: 32 },
        },
        border: { godotPath: 'res://sprites/border.tres', type: 'AtlasTexture', pixiFrame: 'border#0' },
      },
      { godotRoot: tmpRoot },
    );
    // The mask still projects its clip polygon onto the child layer...
    expect(geo.background!.tileLayers[0].clip).toHaveLength(4);
    // ...and now also emits a border-only mesh: a border, but no fill frame/tiling.
    expect(geo.background!.meshes).toHaveLength(1);
    const mesh = geo.background!.meshes[0];
    expect(mesh.pixiFrame).toBeUndefined();
    expect(mesh.tileFill).toBeUndefined();
    expect(mesh.border).toMatchObject({ pixiFrame: 'border#0', width: 8 });
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});

describe('parseGeometryTscn — Box2DRoot', () => {
  it('reads gravity from a Box2DRoot script @export on the root', () => {
    const tscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://box2d/box2d_root.gd" id="1_root"]

[node name="Geometry" type="Node2D"]
script = ExtResource("1_root")
gravity = Vector2(0, -20)
`;
    const geo = parseGeometryTscn(tscn, {});
    expect(geo.gravity).toEqual({ x: 0, y: -20 });
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

  it('merges a subscene background mesh into the parent, transformed into parent space', () => {
    // Subscene with a Box2DPolygon (background visual, no body)
    fs.writeFileSync(
      path.join(tmpRoot, 'geometry', 'pool.tscn'),
      `[gd_scene load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://sprites/lvl/water.tres" id="1_fill"]
[ext_resource type="Script" path="res://box2d/box2d_polygon.gd" id="2_poly"]

[node name="PoolRoot" type="Node2D"]

[node name="water" type="Polygon2D" parent="."]
position = Vector2(10, 0)
texture = ExtResource("1_fill")
script = ExtResource("2_poly")
polygon = PackedVector2Array(0, 0, 32, 0, 32, 32, 0, 32)
`,
    );

    const outerTscn = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://geometry/pool.tscn" id="1_pool"]

[node name="Stage" type="Node2D"]

[node name="Pool" type="Node2D" parent="." instance=ExtResource("1_pool")]
position = Vector2(160, 0)
`;
    const geo = parseGeometryTscn(
      outerTscn,
      { fill: { godotPath: 'res://sprites/lvl/water.tres', type: 'AtlasTexture', pixiFrame: 'water#0' } },
      { godotRoot: tmpRoot, subsceneCache: new Map() },
    );
    expect(geo.background?.meshes).toHaveLength(1);
    const mesh = geo.background!.meshes[0];
    expect(mesh.name).toBe('Pool/water');
    expect(mesh.pixiFrame).toBe('water#0');
    expect(mesh.tileFill).toBe(true);
    // water node at (10, 0) inside pool.tscn, instance at (160, 0) → (170, 0).
    expect(mesh.position.x).toBeCloseTo(170, 5);
    expect(mesh.position.y).toBeCloseTo(0, 5);
  });
});
