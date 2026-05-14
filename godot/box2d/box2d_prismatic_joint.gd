@tool
extends Node2D
class_name Box2DPrismaticJoint

## A Box2D prismatic (slider) joint. The Node2D's global_position is the
## anchor; local_axis_a is in pixel-space along this node's local X by default
## (override by rotating the node or setting local_axis_a explicitly).

@export_node_path("Node2D") var body_a: NodePath
@export_node_path("Node2D") var body_b: NodePath
@export var collide_connected: bool = false
@export var reference_angle: float = 0.0
@export var local_axis_a: Vector2 = Vector2(1, 0)
@export_group("Limits")
@export var enable_limit: bool = false
@export var lower_limit: float = 0.0
@export var upper_limit: float = 0.0
@export_group("Motor")
@export var enable_motor: bool = false
@export var motor_speed: float = 0.0
@export var max_motor_force: float = 0.0

func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()

func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	var a := get_node_or_null(body_a) as Node2D
	var b := get_node_or_null(body_b) as Node2D
	var color := Color(1.0, 0.7, 0.2, 0.7)
	if a:
		draw_line(Vector2.ZERO, to_local(a.global_position), color, 1.0)
	if b:
		draw_line(Vector2.ZERO, to_local(b.global_position), color, 1.0)
	# Axis indicator: long line in the local_axis_a direction
	var axis := local_axis_a.normalized() * 20.0
	draw_line(-axis, axis, color, 2.0)
