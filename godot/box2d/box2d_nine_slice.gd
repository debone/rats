@tool
@icon("res://box2d/icons/box2d_sprite.svg")
extends Sprite2D
class_name Box2DNineSlice

## A stretchable nine-slice background. Drop it into a level scene like a
## Box2DSprite, assign the sliced texture (the aseprite-exported AtlasTexture
## whose source had a `-slices` layer), and set `size` to the stretched
## dimensions you want at runtime.
##
## The non-stretching borders (left/top/right/bottom) are NOT entered here:
## they come from the aseprite slice layer, are baked into the atlas metadata,
## and are threaded through sprite-map.json → geometry JSON → the runtime's
## Pixi NineSliceSprite. So this node only needs the texture and a target size.
##
## In the Godot editor the source texture is shown at its natural size (Sprite2D
## default). The `size` export only affects how the runtime stretches it.
##
## `attached` — true (default) means the node is exported and rendered at
## runtime. false makes it editor-only reference art that the exporter skips.

## Stretched size in pixels. Corners stay fixed; edges and center stretch to fill.
@export var size: Vector2 = Vector2(48, 48)

## When false, the exporter skips this node (editor-only reference art).
@export var attached: bool = true
