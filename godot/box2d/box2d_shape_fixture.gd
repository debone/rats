@tool
@icon("res://box2d/icons/box2d_shape_fixture.svg")
extends CollisionShape2D
class_name Box2DShapeFixture

## A circle/rectangle/convex fixture authored on top of Godot's
## CollisionShape2D. Set `shape` to a CircleShape2D, RectangleShape2D, or
## ConvexPolygonShape2D resource.

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
@export var user_data: Dictionary[String, Variant] = {}
