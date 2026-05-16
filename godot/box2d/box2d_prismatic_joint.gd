@tool
@icon("res://box2d/icons/box2d_prismatic_joint.svg")
extends Node2D
class_name Box2DPrismaticJoint

## A Box2D prismatic (slider) joint. The Node2D's global_position is the
## anchor; local_axis_a is in body A's local pixel space.

@export_node_path("Node2D") var body_a: NodePath
@export_node_path("Node2D") var body_b: NodePath
@export var collide_connected: bool = false
@export var reference_angle: float = 0.0
@export var local_axis_a: Vector2 = Vector2(1, 0)
@export_group("Limits")
@export var enable_limit: bool = false
## In pixels — exporter divides by PXM (16) to get Box2D meters.
@export var lower_limit: float = 0.0
## In pixels — exporter divides by PXM (16) to get Box2D meters.
@export var upper_limit: float = 0.0
@export_group("Motor")
@export var enable_motor: bool = false
@export var motor_speed: float = 0.0
@export var max_motor_force: float = 0.0

const _COLOR := Color(1.0, 0.7, 0.2, 0.8)

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
	var axis := local_axis_a if local_axis_a.length_squared() > 0 else Vector2(1, 0)
	axis = axis.normalized()
	# Axis line drawn from lower_limit to upper_limit along the axis (in pixel
	# space), so the editor visualises the actual range of motion. Falls back
	# to a 20-pixel stub when limits aren't enabled.
	var lo := lower_limit if enable_limit else -20.0
	var hi := upper_limit if enable_limit else 20.0
	draw_line(axis * lo, axis * hi, _COLOR, 2.0)
	# Tick marks at the limits
	var perp := Vector2(-axis.y, axis.x) * 5.0
	draw_line(axis * lo - perp, axis * lo + perp, _COLOR, 2.0)
	draw_line(axis * hi - perp, axis * hi + perp, _COLOR, 2.0)
	# Anchor pivot
	draw_circle(Vector2.ZERO, 3.0, _COLOR)
