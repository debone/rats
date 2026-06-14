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
## Corner size as a multiple of the strip width (1 = same size as the border).
@export_range(0.0, 8.0, 0.05) var border_corner_scale: float = 1.0
## How each corner piece is rotated: Free = aligned to the joint bisector (current
## behaviour), Snap 90° = bisector rounded to the nearest 0/90/180/270, None = the
## frame is left upright (axis-aligned).
@export_enum("Free", "Snap 90°", "None") var border_corner_orientation: int = 0

@export_group("Export")
## false = editor-only reference art; the exporter skips it.
@export var attached: bool = true
## When true this curve renders NO fill/border of its own — its tessellated
## outline becomes a clip mask for any child TileMapLayer.
@export var mask_children: bool = false


# --- Editor-only preview -----------------------------------------------------
# Path2D only shows the bare curve line, so draw the tessellated outline (plus a
# faint band where the border strip runs) to keep the shape/border visible while
# authoring — including mask_children masks.
func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()

func _draw() -> void:
	if not Engine.is_editor_hint() or curve == null or curve.point_count < 2:
		return
	var pts := curve.tessellate()
	if pts.size() < 2:
		return
	var outline := PackedVector2Array(pts)
	if border_closed or mask_children:
		outline.append(pts[0])
	if border_texture != null:
		var w: float = border_width if border_width > 0.0 else 8.0
		draw_polyline(outline, Color(1.0, 1.0, 1.0, 0.35), w, true)
	if mask_children:
		draw_colored_polygon(pts, Color(1.0, 0.5, 0.2, 0.12))
		draw_polyline(outline, Color(1.0, 0.5, 0.2, 0.9), 2.0, true)
	else:
		draw_polyline(outline, Color(0.2, 0.9, 1.0, 0.9), 2.0, true)
