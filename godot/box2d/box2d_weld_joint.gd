@tool
extends Node2D
class_name Box2DWeldJoint

## A Box2D weld (rigid) joint. Locks two bodies together at this anchor.

@export_node_path("Node2D") var body_a: NodePath
@export_node_path("Node2D") var body_b: NodePath
@export var collide_connected: bool = false
@export var reference_angle: float = 0.0

func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()

func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	var a := get_node_or_null(body_a) as Node2D
	var b := get_node_or_null(body_b) as Node2D
	var color := Color(1.0, 0.3, 0.3, 0.7)
	if a:
		draw_line(Vector2.ZERO, to_local(a.global_position), color, 1.0)
	if b:
		draw_line(Vector2.ZERO, to_local(b.global_position), color, 1.0)
	# Cross marker
	draw_line(Vector2(-4, -4), Vector2(4, 4), color, 1.5)
	draw_line(Vector2(-4, 4), Vector2(4, -4), color, 1.5)
