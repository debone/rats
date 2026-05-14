# Box2D node scripts

Authoring kit for building Box2D geometry in the Godot editor. Drop one of
these node types in the "Create Node" dialog and start authoring.

## Bodies
- `Box2DStaticBody` — non-moving collider (walls, bricks, scenery).
- `Box2DKinematicBody` — script-moved body (kinematic platforms).
- `Box2DDynamicBody` — full physics body.

## Fixtures
Use Godot's native `CollisionShape2D` (with `CircleShape2D`, `RectangleShape2D`,
or `ConvexPolygonShape2D` resources) and `CollisionPolygon2D` as **children** of
a body. The collision node's transform is in pixel-space relative to the body;
the exporter converts to Box2D meters via `PXM = 16`.

Per-fixture Box2D material properties go in node Metadata
(Inspector → Node → Metadata):
- `density: float` (default 1)
- `friction: float` (default 0.2)
- `restitution: float` (default 0)
- `sensor: bool` (default false)
- `category_bits: int`, `mask_bits: int`, `group_index: int`

## Sprites
Drop a `Sprite2D` or `AnimatedSprite2D` as a child of a body to bind a sprite
to it. Position/rotation/scale of the sprite is relative to the body and is
preserved at runtime — the sprite tracks the physics body through any
rotation/translation.

To mark a sprite as editor-only (silhouette/reference art you're tracing),
set its metadata `reference = true`. It won't be exported.

## Joints
- `Box2DRevoluteJoint` — hinge.
- `Box2DPrismaticJoint` — slider.
- `Box2DDistanceJoint` — spring/cable.
- `Box2DWeldJoint` — rigid lock.

Set `body_a` and `body_b` to NodePaths pointing at the two bodies. The joint
Node2D's global position is the anchor; the exporter resolves it into each
body's local space.

## Gameplay tags
A body's `metadata/type` string drives gameplay dispatch (`brick`, `wall`,
`door`, `exit`, …). Other metadata fields are carried into the body's
runtime `userData`:
- `metadata/type = "brick"`
- `metadata/powerup = "yellow"` / `"blue"` / `"green"`
- `metadata/doorName = "main"`
- `metadata/behaviour = "Level0"`

## Coordinate system
Godot is Y-down pixels; Box2D is Y-up meters with `PXM = 16`. Conversion
happens at export time. Author wherever feels natural — bodies, fixtures,
sprites, and joint anchors all share the same Godot pixel space.
