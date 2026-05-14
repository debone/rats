@tool
extends Node2D
class_name Box2DVisibility

## Attach once to the scene root (or any ancestor that contains all Box2D
## bodies). Toggle `show_collision` in the Inspector to show or hide every
## CollisionPolygon2D and CollisionShape2D in the subtree — one click to
## see the pure art layout, one click to get the collision overlay back.

@export var show_collision: bool = true:
	set(v):
		show_collision = v
		if is_node_ready() or Engine.is_editor_hint():
			_apply()

func _ready() -> void:
	_apply()

func _apply() -> void:
	_walk(self, show_collision)

func _walk(node: Node, vis: bool) -> void:
	if node is CollisionPolygon2D or node is CollisionShape2D:
		node.visible = vis
		return  # collision nodes have no Box2D children; skip their subtree
	for child in node.get_children():
		_walk(child, vis)
