@tool
extends Node2D
class_name Box2DDistanceJoint

## A Box2D distance (spring/cable) joint.

@export_node_path("Node2D") var body_a: NodePath
@export_node_path("Node2D") var body_b: NodePath
@export var collide_connected: bool = false
## Rest length, in pixels. The exporter converts to Box2D meters via PXM.
@export var length: float = 0.0
@export var frequency: float = 0.0
@export var damping_ratio: float = 0.0

func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()

func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	var a := get_node_or_null(body_a) as Node2D
	var b := get_node_or_null(body_b) as Node2D
	var color := Color(0.4, 0.6, 1.0, 0.7)
	if a and b:
		draw_line(to_local(a.global_position), to_local(b.global_position), color, 1.0)
	draw_circle(Vector2.ZERO, 4.0, color)
