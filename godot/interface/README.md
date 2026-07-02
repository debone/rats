# Interface scenes

Physics-free Godot scenes for **UI / HUD / menu** elements (cards, panels,
badges, tooltips) — the interface counterpart to `godot/geometry/` (level
scenes). Author them as a plain `Node2D` tree using the same visual nodes as
geometry scenes (`Box2DPolygon`, `Box2DCurve`, `Box2DNineSlice`, `Box2DSprite`,
`TileMapLayer`) — just **no bodies, fixtures, or joints**.

## Pipeline

Every `.tscn` under this folder (recursively) is compiled by the packer to
`public/assets/interface/<relpath>.json` and registered in the asset manifest
under the **`interface/`** alias namespace (mirrors how `godot/geometry/` maps to
the `geometry/` namespace).

Load one at runtime with no physics world:

```ts
import { loadGodotVisuals } from '@/lib/loadGodotGeometry';

const geo = Assets.get('interface/shop-card.json');
const { meshes, sprites, tileLayers, ninePatches } = loadGodotVisuals(geo, container);
```

The returned Pixi containers drop straight into a Yoga / `@pixi/layout` tree.

If a scene here *does* carry bodies/joints they're skipped with a warning — use
`loadGodotGeometry(geo, worldId, …)` from `godot/geometry/` when you actually
need physics.

See `../box2d/README.md` for the full node reference.
