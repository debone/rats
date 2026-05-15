@tool
@icon("res://box2d/icons/box2d_animated_sprite.svg")
extends AnimatedSprite2D
class_name Box2DAnimatedSprite

## An AnimatedSprite2D bound to a Box2D body at runtime. Same role as
## Box2DSprite, but for SpriteFrames-based animations. See box2d_sprite.gd
## for `attached` / `should_rotate` semantics.

@export var attached: bool = true
@export var should_rotate: bool = true
