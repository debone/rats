@tool
@icon("res://box2d/icons/box2d_distance_joint.svg")
extends Node2D
class_name Box2DDistanceJoint

## A Box2D distance (spring/cable) joint.

@export_node_path("Node2D") var body_a: NodePath
@export_node_path("Node2D") var body_b: NodePath
@export var collide_connected: bool = false
## Rest length, in pixels. The exporter divides by PXM (16) to get Box2D meters.
@export var length: float = 0.0
@export var frequency: float = 0.0
@export_range(0.0, 1.0) var damping_ratio: float = 0.0

const _COLOR := Color(0.4, 0.6, 1.0, 0.8)

func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		queue_redraw()

func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	var a := get_node_or_null(body_a) as Node2D
	var b := get_node_or_null(body_b) as Node2D
	if a:
		draw_dashed_line(Vector2.ZERO, to_local(a.global_position), _COLOR, 1.5, 4.0)
	if b:
		draw_dashed_line(Vector2.ZERO, to_local(b.global_position), _COLOR, 1.5, 4.0)
	# Spring marker
	if a and b:
		var ap := to_local(a.global_position)
		var bp := to_local(b.global_position)
		_draw_spring(ap, bp, _COLOR)
	draw_circle(Vector2.ZERO, 3.0, _COLOR)

func _draw_spring(p1: Vector2, p2: Vector2, color: Color) -> void:
	var dir := (p2 - p1)
	var dist := dir.length()
	if dist < 8.0:
		return
	dir = dir / dist
	var perp := Vector2(-dir.y, dir.x)
	var coils := 6
	var amp := 4.0
	var prev := p1
	for i in range(1, coils * 2 + 1):
		var t := float(i) / float(coils * 2)
		var side := 1.0 if i % 2 == 1 else -1.0
		var pt := p1 + dir * (dist * t) + perp * (amp * side)
		draw_line(prev, pt, color, 1.0)
		prev = pt
	draw_line(prev, p2, color, 1.0)
