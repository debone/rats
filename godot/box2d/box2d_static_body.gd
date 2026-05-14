@tool
@icon("res://box2d/icons/box2d_static_body.svg")
extends StaticBody2D
class_name Box2DStaticBody

## A Box2D static body. Authored in Godot, exported to JSON, instantiated at
## runtime against phaser-box2d. Static bodies do not move.
##
## Add Box2DPolygonFixture / Box2DShapeFixture children for collision geometry.
## Add Sprite2D / AnimatedSprite2D children to bind sprites to this body.

## Gameplay tags / arbitrary key→value data carried into the runtime body's
## userData. The runtime entity dispatch reads `user_data.type`.
@export var user_data: Dictionary = {}
