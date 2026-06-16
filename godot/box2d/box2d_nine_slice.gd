@tool
@icon("res://box2d/icons/box2d_sprite.svg")
extends Sprite2D
class_name Box2DNineSlice

## A stretchable nine-slice background. Drop it into a level scene like a
## Box2DSprite and assign the sliced texture (the aseprite-exported AtlasTexture
## whose source had a `-slices` layer).
##
## Size it by SCALING the node (the normal Node2D transform handles) — there is no
## separate `size` export. At runtime the stretched dimensions are the natural
## texture size × the node's scale, but the corners stay at their natural pixel
## size (only the edges/center stretch), which is the whole point of a nine-slice.
##
## The non-stretching borders (left/top/right/bottom) are NOT entered here: they
## come from the aseprite slice layer, are baked into the atlas metadata, and are
## threaded through sprite-map.json → geometry JSON → the runtime's Pixi
## NineSliceSprite. So this node only needs the texture.
##
## Caveat: in the Godot editor a scaled Sprite2D stretches the corners too, so the
## editor preview won't perfectly match the runtime corner-pinning.
##
## `attached` — true (default) means the node is exported and rendered at
## runtime. false makes it editor-only reference art that the exporter skips.

## When true the center region repeats (tiles) at its natural size instead of
## stretching to fill. Corners stay pinned and the edges still stretch along their
## run. (Editor preview still stretches — the tiling is applied at runtime.)
@export var tile_center: bool = false

## When false, the exporter skips this node (editor-only reference art).
@export var attached: bool = true
