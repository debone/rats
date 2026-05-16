@tool
extends Box2DStaticBody
class_name BrickPrefab

## Brick prefab: a standard breakable brick. `type` is set to "brick" in the
## prefab scene; per-instance variations expose `powerup` as a typed field.
## When a cheese powerup is set, the brick drops a Yellow/Blue/Green cheese
## on break (see BreakoutPhysics → 'brick' dispatch).
##
## Pattern: each prefab class adds typed @export fields and a setter that
## pushes them into user_data via `_put_in_user_data` (inherited from
## Box2DStaticBody). Gameplay reads them back through the runtime body's
## userData, so the field list stays Godot-local — no TS/Godot sync needed.

@export var powerup: String = "":
	set(v):
		powerup = v
		_put_in_user_data("powerup", v)

@export var behaviour: String = "":
	set(v):
		behaviour = v
		_put_in_user_data("behaviour", v)
