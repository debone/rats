@tool
@icon("res://box2d/icons/box2d_static_body.svg")
extends StaticBody2D
class_name Box2DStaticBody

## A Box2D static body. Authored in Godot, exported to JSON, instantiated at
## runtime against phaser-box2d. Static bodies do not move.
##
## Add Box2DPolygonFixture / Box2DShapeFixture children for collision geometry.
## Add Sprite2D / AnimatedSprite2D children to bind sprites to this body.

## Entity discriminator carried into the runtime body's userData under the
## `type` key. Used by gameplay code to dispatch (brick → Brick, exit → Exit,
## …). Promoting it to its own field means prefabs and inherited scenes can
## override it surgically without re-stating the whole user_data dictionary.
@export var type: String = ""

## Arbitrary key→value gameplay tags carried into the runtime body's userData.
## Merged with `type` at export time (this field's `type` key, if any, loses
## to the explicit `type` export above).
@export var user_data: Dictionary[String, Variant] = {}

## Prefab helper: set a single user_data key from a property setter. Empty
## string or null removes the key (so an unset Inspector field doesn't leak
## an empty value into runtime userData). Used by per-prefab classes that
## want to expose typed @export fields:
##
##     @tool
##     extends Box2DStaticBody
##     class_name BrickPrefab
##     @export var powerup: String = "": set = _set_powerup
##     func _set_powerup(v): powerup = v; _put_in_user_data("powerup", v)
##
func _put_in_user_data(key: String, value: Variant) -> void:
	if value == null or (value is String and value == ""):
		user_data.erase(key)
	else:
		user_data[key] = value
