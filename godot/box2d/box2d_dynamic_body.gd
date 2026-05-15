@tool
@icon("res://box2d/icons/box2d_dynamic_body.svg")
extends RigidBody2D
class_name Box2DDynamicBody

## A Box2D dynamic body. Reacts to forces, collisions, and gravity.

@export var type: String = ""
@export var user_data: Dictionary[String, Variant] = {}

@export_group("Box2D")
@export var fixed_rotation: bool = false
@export var bullet: bool = false
@export var allow_sleep: bool = true
@export var linear_damping: float = 0.0
@export var angular_damping: float = 0.0
@export var gravity_scale: float = 1.0

func _put_in_user_data(key: String, value: Variant) -> void:
	if value == null or (value is String and value == ""):
		user_data.erase(key)
	else:
		user_data[key] = value
