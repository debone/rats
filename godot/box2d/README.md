# Box2D node scripts

Authoring kit for building Box2D geometry in the Godot editor. Drop one of
these node types from the "Create Node" dialog and start authoring.

## Bodies

Three node types, each extending the matching Godot `CollisionObject2D`
subtype so child collision shapes don't trip the "needs a CollisionObject2D
parent" warning. The exporter only cares about the script class, not Godot's
own physics behaviour, so none of Godot's physics settings (mass, friction,
collision layers …) affect the runtime — set them via the Box2D-specific
`@export` properties below.

- `Box2DStaticBody` — non-moving collider (walls, bricks, scenery).
- `Box2DKinematicBody` — script-moved body (kinematic platforms).
- `Box2DDynamicBody` — full physics body.

`@export` properties on each body:
- `user_data: Dictionary[String, Variant]` — gameplay tags. Keys are always
  String (no type picker), values default to whatever you type in but can
  be int/bool/Vector2/etc. when needed. The runtime entity dispatch reads
  `user_data.type`; other keys (`powerup`, `doorName`, `behaviour`, …) are
  carried verbatim into the body's runtime userData. The build pipeline
  scans every authored `user_data` to generate `GeometryBodyUserData` in
  `src/assets/geometry.ts` (see below).
- `fixed_rotation: bool`, `bullet: bool` — kinematic and dynamic.
- `allow_sleep: bool`, `linear_damping: float`, `angular_damping: float`,
  `gravity_scale: float` — dynamic only.

## Fixtures

Two node types extending Godot's collision nodes:

- `Box2DPolygonFixture` — extends `CollisionPolygon2D`. Use `build_mode =
  SOLIDS` for filled (convex/concave) polygons, `SEGMENTS` for chain shapes.
  Concave polygons are decomposed at export time.
- `Box2DShapeFixture` — extends `CollisionShape2D`. Set `shape` to a
  `CircleShape2D`, `RectangleShape2D`, or `ConvexPolygonShape2D`.

Both expose Box2D fixture material directly:
- `density: float` (default 1)
- `friction: float` (default 0.2)
- `restitution: float` (default 0)
- `is_sensor: bool` (default false)
- `category_bits: int`, `mask_bits: int`, `group_index: int`
- `user_data: Dictionary` — per-fixture gameplay tags.

(Plain `CollisionPolygon2D`/`CollisionShape2D` without our scripts also
work; the exporter falls back to reading material props from node Metadata.)

## Sprites

Drop a `Sprite2D` or `AnimatedSprite2D` as a child of a body to bind a
sprite to it. Position/rotation/scale of the sprite is relative to the body
and is preserved at runtime — the sprite tracks the physics body through
any rotation/translation. This is the workflow the editor enables: drop the
sprite first to see the art, then trace the collision polygon over it with
Godot's polygon editing tools.

To mark a sprite as editor-only (silhouette/reference art you're tracing),
set its metadata `reference = true`. It won't be exported.

## Joints

- `Box2DRevoluteJoint` — hinge.
- `Box2DPrismaticJoint` — slider. `lower_limit`/`upper_limit` are in pixels
  (the exporter divides by PXM = 16 to get Box2D meters). The editor gizmo
  draws the axis line at the actual range of motion.
- `Box2DDistanceJoint` — spring/cable.
- `Box2DWeldJoint` — rigid lock.

Set `body_a` and `body_b` to NodePaths pointing at the two bodies. The
joint Node2D's global position is the anchor; the exporter resolves it into
each body's local space. The editor gizmos draw dashed lines from the
anchor to each connected body so you can see at a glance what's wired up.

## Coordinate system

Godot is Y-down pixels; Box2D is Y-up meters with `PXM = 16`. The exporter
flips Y and divides by 16 — author wherever feels natural. Bodies,
fixtures, sprites, and joint anchors all share the same Godot pixel space.

## Composing scenes (subscene instances)

Save a piece of geometry as its own `.tscn` (e.g. `godot/geometry/cat.tscn`
with a Box2DDynamicBody root, child polygon, child sprite). To use it in a
larger scene, drag the file into another scene's tree, or use Scene → Add
Child Node → Instantiate Child Scene. The exporter follows `instance=`
references and inlines the subscene's bodies and joints, applying the
instance's transform. Names are prefixed: a body called `head` inside
`cat.tscn` instanced as `Cat` becomes `Cat/head` in the runtime
`bodiesByName` map. Joints inside the subscene continue to wire to the
correct bodies.

## Logical grouping

Any `Node2D` (or plain `Node`) can hold child Box2D bodies as a logical
group. Use them for organisation, lockable layers, hidden reference art,
etc. The exporter walks the whole tree to find Box2D bodies — group depth
doesn't matter.

## Scene root (`Box2DRoot`)

Attach `res://box2d/box2d_root.gd` (`Box2DRoot`) to the top `Node2D` of each
scene under `godot/geometry/`. It's the canonical home for scene-wide
Box2D settings and editor tooling:

- `gravity: Vector2` — Box2D world gravity (Y-up meters, Box2D convention;
  negative y pulls bodies down on screen). The exporter reads it here;
  the old `metadata/gravity` still works as a fallback for unmigrated
  scenes.
- `show_collision: bool` — editor-only toggle. Flip it in the Inspector and
  every `CollisionPolygon2D`/`CollisionShape2D` in the subtree hides or
  reappears in one click; sprites stay visible so you can review the pure
  art layout. Never exported.

Subscenes that get instanced into a parent scene don't need their own
`Box2DRoot` — only the top-level scene does.

## Generated types

`src/assets/geometry.ts` is regenerated on every build. It contains:

- `GeometryBodyMap` / `GeometryJointMap` — per-scene unions of body and
  joint names. Use for autocomplete on `bodiesByName.get(...)`.
- `GeometryEntityType` — the union of every distinct `user_data.type`
  value seen across all `godot/geometry/*.tscn` files.
- `GeometryBodyUserData` — discriminated union of every `user_data` shape
  seen, indexed by `type`. Each variant lists every key ever set on a
  body of that type, with literal-value unions. Drives entity dispatch:
  adding a new type in Godot widens the union and breaks exhaustive
  switches at type-check time. That's the point.

## Editing tips

- **Move just the collision shape** (without moving the body): select the
  `Box2DPolygonFixture`/`Box2DShapeFixture` child directly in the scene
  tree, then drag it. Selecting the parent body moves the whole subtree.
- **Move just the body's origin** (so its sprite/collision children stay in
  place): in Godot's editor, hold Alt while dragging the body's pivot
  handle.
- **Lock a node** so it doesn't move accidentally: right-click in scene
  tree → "Lock node".
- **Hide reference art** while editing: toggle the eye icon next to a
  Sprite2D or group node.
