@tool
extends Node2D
class_name Box2DDynamicBody

## A Box2D dynamic body.

@export var fixed_rotation: bool = false
@export var bullet: bool = false
@export var allow_sleep: bool = true
@export var linear_damping: float = 0.0
@export var angular_damping: float = 0.0
@export var gravity_scale: float = 1.0
