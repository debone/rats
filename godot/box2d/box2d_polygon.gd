@tool
@icon("res://box2d/icons/box2d_sprite.svg")
extends Polygon2D
class_name Box2DPolygon

## A textured background polygon with a tiled fill and an optional tiled
## border traced along its outline. Draw the shape with Godot's polygon editor
## and assign the fill `texture` (a normal atlas frame, resolved through
## sprite-map.json like any other sprite — seamless tile art works best with no
## transparent edges so the packer doesn't trim it).
##
## At runtime the fill is a Pixi CompositeTilemap clipped to the polygon by a
## mask, so the frame tiles across the shape. The border is a tiled quad-strip
## mesh: the `border_texture` frame is repeated along the polygon edges. Both
## tile atlas frames correctly (no GPU texture-repeat involved).
##
## `attached = false` marks the node as editor-only reference art; the exporter
## skips it entirely (same as Box2DSprite).

## Repeat the fill texture across the polygon instead of stretching one copy.
@export var tile_fill: bool = true

@export_group("Border")
## Strip texture tiled along the outline. Leave empty for no border.
@export var border_texture: Texture2D
## Rope thickness in pixels. 0 falls back to the border texture's height.
@export var border_width: float = 0.0
## Length of each repeated tile along the edge, as a multiple of the border
## frame width (1.0 = one frame per repeat; 0.5 = half-width tiles, etc).
@export var border_texture_scale: float = 1.0
## Close the strip back to the first vertex so the border wraps the whole shape.
@export var border_closed: bool = true

@export_group("Export")
## false = editor-only reference art; the exporter skips it.
@export var attached: bool = true
