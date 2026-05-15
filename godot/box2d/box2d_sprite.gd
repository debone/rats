@tool
@icon("res://box2d/icons/box2d_sprite.svg")
extends Sprite2D
class_name Box2DSprite

## A Sprite2D that's bound to a Box2D body at runtime — the typed home for
## per-sprite runtime flags. Drop it as a child of a Box2DStaticBody /
## Kinematic / Dynamic just like a plain Sprite2D; the exporter tracks the
## same position/rotation/scale/anchor.
##
## Two flags differentiate it from a plain Sprite2D:
##
## `attached` — true means the sprite is attached to the body at runtime
## (instantiated, position-tracked, the normal case). false means it's
## editor-only reference art (e.g. a silhouette you're tracing for the
## collision polygon) and the exporter skips it entirely.
##
## `should_rotate` — true means the sprite tracks the body's rotation
## (default). false keeps it axis-aligned regardless of body angle — used
## for shadows, glints, UI bits that shouldn't tumble with the body.

@export var attached: bool = true
@export var should_rotate: bool = true
