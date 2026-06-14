@tool
@icon("res://box2d/icons/box2d_sprite.svg")
extends Path2D
class_name Box2DCurve

## A textured background shape with a bezier outline. Draw it with Path2D's curve
## handles, then it renders at runtime exactly like a Box2DPolygon — a masked
## tiled fill plus an optional tiled quad-strip border — except the outline is
## the tessellated bezier curve instead of straight polygon edges.
##
## At export the curve is tessellated into vertices (`curve_samples` per
## segment); the runtime masks the tiled fill to that outline and traces the
## border strip along it. For a closed blob, make the curve a loop (drop the last
## point on the first). Concave shapes are fine because the tiled fill clips with
## an earcut mask — keep `tile_fill` on (the stretched fill assumes convex).
##
## The Godot editor only draws the bare curve line (Path2D default); the fill /
## border / corners are runtime-only, same as Box2DPolygon.
##
## `attached = false` marks the node as editor-only reference art; the exporter
## skips it.

## Fill texture, tiled across the shape (an ordinary atlas frame).
@export var texture: Texture2D
## Repeat the fill texture across the shape instead of stretching one copy.
@export var tile_fill: bool = true
## Bezier samples per curve segment — higher is a smoother outline and border.
@export_range(1, 64) var curve_samples: int = 8

@export_group("Border")
## Strip texture tiled along the outline. Leave empty for no border.
@export var border_texture: Texture2D
## Strip thickness in pixels. 0 falls back to the border texture's height.
@export var border_width: float = 0.0
## Length of each repeated tile along the edge, as a multiple of the border
## frame width (1.0 = one frame per repeat; 0.5 = half-width tiles, etc).
@export var border_texture_scale: float = 1.0
## Close the strip back to the first vertex so the border wraps the whole shape.
@export var border_closed: bool = true
## Optional frame stamped at each corner (sized to the strip width, oriented to
## the bisector). On a curve most joints are shallow — see border_corner_min_angle.
@export var border_corner_texture: Texture2D
## Only stamp a corner piece when the outline turns by at least this many degrees.
## Defaults higher than Box2DPolygon so a smooth curve only gets corners at
## genuinely sharp vertices instead of every tessellation point.
@export_range(0.0, 180.0) var border_corner_min_angle: float = 45.0

@export_group("Export")
## false = editor-only reference art; the exporter skips it.
@export var attached: bool = true
