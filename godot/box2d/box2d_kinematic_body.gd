@tool
@icon("res://box2d/icons/box2d_kinematic_body.svg")
extends CharacterBody2D
class_name Box2DKinematicBody

## A Box2D kinematic body. Moved by gameplay code; not affected by physics
## forces.

@export var user_data: Dictionary[String, Variant] = {}

@export_group("Box2D")
@export var fixed_rotation: bool = false
@export var bullet: bool = false
