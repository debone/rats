@tool
@icon("res://box2d/icons/box2d_root.svg")
extends Node2D
class_name Box2DRoot

## Canonical root for a Box2D scene. Attach this script to the top Node2D
## of any `godot/geometry/*.tscn` to expose scene-wide Box2D settings in one
## place (gravity, editor visibility toggle, room for future config).

## Box2D world gravity (Y-up meters, Box2D convention). Negative y pulls
## bodies down on screen because Box2D Y-up flips Godot's Y-down at export.
@export var gravity: Vector2 = Vector2(0, -10)

## Editor-only: toggle every `CollisionPolygon2D` and `CollisionShape2D` in
## the subtree on or off. Lets you see the pure art layout in one click and
## get the collision overlay back with another. Never exported.
@export var show_collision: bool = true:
	set(v):
		show_collision = v
		if is_node_ready() or Engine.is_editor_hint():
			_apply_visibility()

@export_range(0.0, 100.0, 0.1) var alpha: float = 100.0

@export_range(0.0, 100.0, 0.1) var art_alpha: float = 100.0:
	set(v):
		alpha = remap(v, 0.0, 100.0, 0.0, 1.0)
		art_alpha = v
		if is_node_ready() or Engine.is_editor_hint():
			_apply_visibility()

func _ready() -> void:
	_apply_visibility()

func _apply_visibility() -> void:
	_walk(self, show_collision, alpha)

func _walk(node: Node, vis: bool, alpha: float) -> void:
	if node is CollisionPolygon2D or node is CollisionShape2D:
		node.visible = vis
		node.modulate.a = alpha
		return
	for child in node.get_children():
		_walk(child, vis, alpha)
