@tool
@icon("res://box2d/icons/box2d_polygon_fixture.svg")
extends CollisionPolygon2D
class_name Box2DPolygonFixture

## A polygon fixture authored on top of Godot's CollisionPolygon2D.
## Use SOLIDS build_mode for convex/concave polygons (concave is
## decomposed at export time); use SEGMENTS for chain shapes.

@export_group("Material")
@export var density: float = 1.0
@export var friction: float = 0.2
@export_range(0.0, 1.0) var restitution: float = 0.0
@export var is_sensor: bool = false

@export_group("Filter")
@export var category_bits: int = 0x0001
@export var mask_bits: int = 0xFFFF
@export var group_index: int = 0

@export_group("User data")
@export var user_data: Dictionary = {}
