@tool
extends Node2D
class_name Box2DStaticBody

## A Box2D static body. Authored in Godot, exported to JSON, instantiated at runtime.
## Add CollisionShape2D / CollisionPolygon2D children for fixtures.
## Add Sprite2D / AnimatedSprite2D children for sprite bindings.
## Set per-node metadata to carry gameplay tags (type, powerup, doorName, ...).

func _get_configuration_warnings() -> PackedStringArray:
	var warnings: PackedStringArray = []
	if get_child_count() == 0:
		warnings.append("Static body has no children. Add a CollisionShape2D or CollisionPolygon2D.")
	return warnings
