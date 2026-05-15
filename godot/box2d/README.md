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
- `type: String` — the entity discriminator. Drives gameplay dispatch
  (`brick`, `wall`, `exit`, `paddle`, …). Promoted to its own field (not
  buried in `user_data`) so prefabs and inherited scenes can override it
  surgically — see "Prefabs" below.
- `user_data: Dictionary[String, Variant]` — gameplay tags. Keys are always
  String (no type picker), values default to whatever you type in but can
  be int/bool/Vector2/etc. when needed. At export time, `type` is merged
  into the dict so gameplay sees a single `userData.type` plus any extras
  (`powerup`, `doorName`, `behaviour`, …). The build pipeline scans every
  authored `user_data` to generate `GeometryBodyUserData` in
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

## Sprites

Two node types, both extending Godot's native sprite nodes so the standard
texture/region/frames editing UI is available:

- `Box2DSprite` — extends `Sprite2D`. For static textures and atlas frames.
- `Box2DAnimatedSprite` — extends `AnimatedSprite2D`. For SpriteFrames-based
  animations.

Drop one as a child of a body. Position/rotation/scale of the sprite is
relative to the body and preserved at runtime — the sprite tracks the
physics body through any rotation/translation. This is the workflow the
editor enables: drop the sprite first to see the art, then trace the
collision polygon over it with Godot's polygon editing tools.

`@export` properties on both:
- `attached: bool` (default true) — true means the sprite is attached to the
  body at runtime (the normal case). Set false to mark it as **editor-only
  reference art** (e.g. a silhouette you're tracing). The exporter skips
  unattached sprites entirely.
- `should_rotate: bool` (default true) — true means the sprite tracks the
  body's rotation. Set false to keep it axis-aligned regardless of body
  angle — useful for shadows, glints, anything that shouldn't tumble with
  the body. The paddle's two shadow sprites are the canonical example.

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

## Background visuals

Anything in the scene tree that isn't a Box2D body, fixture, joint, or
body-bound sprite gets emitted as **background** — purely visual elements
the runtime renders behind/in front of the physics. The point is to
author the level's background art in the same scene as the physics so
brick placements line up exactly with the painted environment.

Two node types are supported today:

- **`Polygon2D` with `texture`** — free-form textured polygons. Author the
  shape with Godot's polygon editor, assign a texture (atlas-resolved
  through `sprite-map.json` just like sprites), and the exporter emits a
  triangulated mesh that the runtime renders as a Pixi `Mesh`. Use this
  for big filled regions: water, sky, terrain fills, anything that
  isn't grid-aligned. **Currently convex polygons only** — concave will
  need an earcut pass; we'll add that the first time an author hits it.

- **Standalone `Sprite2D` / `AnimatedSprite2D` / `Box2DAnimatedSprite`** —
  any sprite that *isn't* a child of a body becomes a free-standing
  background sprite at its authored world position. Use for one-off
  decor: signs, fish, single landmarks. `Box2DSprite`'s
  `attached = false` still works to mark editor-only reference art.

- **`TileMapLayer`** — *not yet*. The binary format is known and the
  exporter side is straightforward, but it needs an atlas-pipeline change
  on the Pixi side (Godot tilesets reference a single atlas image with
  `(x,y)` cell coords; our Pixi pipeline currently ships per-tile frames).
  Until that lands, keep tilemap-style backgrounds in Tiled.

The exporter walks the whole tree, so background nodes can live at the
scene root, inside logical group nodes, or inside an instanced subscene
— anywhere not under a body.

## Coordinate system

Godot is Y-down pixels; Box2D is Y-up meters with `PXM = 16`. The exporter
flips Y and divides by 16 — author wherever feels natural. Bodies,
fixtures, sprites, and joint anchors all share the same Godot pixel space.

## Prefabs

Reusable shapes — `brick`, `door`, `paddle`, future bosses — live as their
own scene files. Prefabs use Godot's native scene-instance system: drag the
`.tscn` into a level scene and you get the whole body+fixture+sprite subtree
at one transform.

The pattern for a prefab class:

```gdscript
# godot/prefabs/brick_prefab.gd
@tool
extends Box2DStaticBody
class_name BrickPrefab

@export var powerup: String = "":
    set(v):
        powerup = v
        _put_in_user_data("powerup", v)   # inherited helper, empty string ⇒ erase
```

In `godot/prefabs/brick.tscn`: root is a `Box2DStaticBody` with the
`BrickPrefab` script, `type = "brick"`, plus a `Box2DPolygonFixture` child
for the collision and a `Sprite2D` child for the art.

Per-instance/per-variant overrides are then surgical:

- **One brick → many bricks**: drag `brick.tscn` into a level scene, hit
  Ctrl-D to duplicate, set `powerup = "yellow"` on the few that drop cheese.
  The Inspector shows `powerup` as a typed `String` field; no dict editing.
- **Variants** (e.g. always-yellow): right-click `brick.tscn` → New
  Inherited Scene → override only `powerup = "yellow"`. Inherited scenes
  only carry the keys that differ, so `brick_yellow.tscn` is a few lines.

Why a `type: String` field instead of a typed enum: gameplay-known types
(`brick`, `wall`, `exit`, …) live in `src/assets/geometry.ts` as the
auto-generated `GeometryEntityType` union. Hard-coding them as a Godot enum
would force two-sided sync; the union is rebuilt from authored data on every
geometry export, so a new type only needs to be set in Godot and handled in
gameplay.

The exporter is intentionally unaware of any specific prefab field — it
just reads `type` and `user_data` off each body. Adding a new prefab field
(`hits` on a strong-brick, `axis` on a moving platform, …) is one
`@export var hits: int = …: set = _set_hits` line per prefab class with a
matching `_put_in_user_data("hits", v)` setter; the typegen picks it up on
next build.

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
  negative y pulls bodies down on screen).
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
