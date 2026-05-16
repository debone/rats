@tool
@icon("res://box2d/icons/box2d_revolute_joint.svg")
extends Node2D
class_name Box2DRevoluteJoint

## A Box2D revolute (hinge) joint. The Node2D's global_position is the
## joint world anchor; the exporter resolves it into bodyA/bodyB local space.

@export_node_path("Node2D") var body_a: NodePath
@export_node_path("Node2D") var body_b: NodePath
@export var collide_connected: bool = false
@export var reference_angle: float = 0.0
@export_group("Limits")
@export var enable_limit: bool = false
@export var lower_limit: float = 0.0
@export var upper_limit: float = 0.0
@export_group("Motor")
@export var enable_motor: bool = false
@export var motor_speed: float = 0.0
@export var max_motor_torque: float = 0.0

const _COLOR := Color(0.2, 1.0, 0.2, 0.8)

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
	# Hinge marker — outer circle + inner pivot dot
	draw_arc(Vector2.ZERO, 6.0, 0.0, TAU, 24, _COLOR, 1.5)
	draw_circle(Vector2.ZERO, 2.0, _COLOR)
	# Limit arc, if enabled. Angles are Godot CW radians (0 = right, PI/2 = down).
	if enable_limit:
		var lo := minf(lower_limit, upper_limit)
		var hi := maxf(lower_limit, upper_limit)
		if hi - lo < 0.001:
			# Locked rotation — draw a single tick at the limit angle
			draw_line(Vector2.ZERO, Vector2(cos(lo), sin(lo)) * 14.0, _COLOR, 1.5)
		else:
			var pts := maxi(8, int((hi - lo) / TAU * 48) + 2)
			draw_arc(Vector2.ZERO, 12.0, lo, hi, pts, _COLOR, 1.5)
			# Sector radii so the allowed range reads as a wedge
			draw_line(Vector2.ZERO, Vector2(cos(lo), sin(lo)) * 12.0, _COLOR, 1.5)
			draw_line(Vector2.ZERO, Vector2(cos(hi), sin(hi)) * 12.0, _COLOR, 1.5)
