@tool
@icon("res://box2d/icons/box2d_sprite.svg")
extends Polygon2D
class_name Box2DPolygon

## A textured background polygon with a tiled fill and an optional tiled rope
## border traced along its outline. Draw the shape with Godot's polygon editor
## and assign the fill `texture` (a standalone tileable texture, NOT an atlas
## frame — tiling needs GPU texture-repeat, which only works on a texture that
## owns its whole image). Generated standalone textures live under
## `res://textures/` after an asset build.
##
## The fill is rendered at runtime as a Pixi Mesh whose texture repeats across
## the polygon (when `tile_fill` is on). The border is rendered as a Pixi
## MeshRope: the `border_texture` strip is tiled along the polygon edges.
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
## How the strip is tiled along the rope:
## - 0 stretches one copy across the whole length
## - > 0 repeats it preserving aspect ratio (1.0 = original pixel size)
@export var border_texture_scale: float = 1.0
## Close the rope back to the first vertex so the border wraps the whole shape.
@export var border_closed: bool = true

@export_group("Export")
## false = editor-only reference art; the exporter skips it.
@export var attached: bool = true
