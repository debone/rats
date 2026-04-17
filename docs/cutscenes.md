# Cutscene Pipeline

Godot 4 is used as an external visual editor for cutscene authoring. The PixiJS game never runs Godot; it only consumes the data Godot produces. The asset pipeline bridges the two by feeding game assets into Godot and converting Godot's animation files back into game-consumable JSON.

---

## Architecture

```
assets/                          (source)
  *.aseprite
  sounds/*.wav
      │
      ▼
 packer() pipe                   (devtools/packer/)
  + pixiPipes                    (TPS folders)
      │
      ├─── public/assets/        (PixiJS runtime)
      │      *.webp / *.png.json
      │
      └─── godot/                (Godot editor project)
             atlases/   ← atlas PNGs copied here
             sprites/   ← .tres resources (AtlasTexture / SpriteFrames)
             sounds/    ← .wav files copied here
             sprite-map.json  ← godotPath ↔ pixiFrame lookup table
             cutscenes/ ← .tscn files authored by hand in Godot
                  │
                  ▼
           godot-scene.ts parser
                  │
                  ▼
      public/assets/cutscenes/
             *.json             (runtime cutscene data)
                  │
                  ▼
         CutscenePlayer.ts      (animejs timeline + sfx)
```

The key invariant: **the game's source assets are the single source of truth**. Godot resources are generated, not edited by hand, and are excluded from Git.

---

## Directory Structure

```
godot/
  project.godot          ← Godot 4 project (committed)
  cutscenes/             ← hand-authored .tscn files (committed)
  atlases/               ← generated, gitignored
  sprites/               ← generated, gitignored
  sounds/                ← generated, gitignored
  sprite-map.json        ← generated, gitignored

devtools/
  vite-plugin-assetpack.ts    ← orchestrates all generation steps
  packer/
    index.ts                  ← calls generateGodotResources() inline
    processors/
      godot-resources.ts      ← .tres generator + sound copier
      godot-scene.ts          ← .tscn parser

src/
  core/cutscene/
    types.ts                  ← shared runtime types
    CutscenePlayer.ts         ← runtime player
    PlayCutsceneCommand.ts    ← command wrapper

public/assets/cutscenes/      ← generated, gitignored
```

---

## Phase 1 — Godot Project

`godot/project.godot` is a minimal Godot 4.3 project committed to the repository. It is configured to match the game exactly:

- **Viewport**: 480×640 (matches `MIN_WIDTH` / `MIN_HEIGHT` in `src/consts.ts`)
- **Stretch mode**: `canvas_items` / `keep` — same proportions as the game
- **Texture filter**: `0` (nearest neighbour) — pixel art
- **Renderer**: `gl_compatibility` (2D, no 3D overhead)

Open `godot/` as a Godot project to author cutscenes. The generated resource folders (`atlases/`, `sprites/`, `sounds/`) must exist before opening; they are populated by running `npm start` or `npm run build:prod` first.

---

## Phase 2 — Asset Pipeline → Godot Resources

Every time the asset pipeline runs it writes Godot-native resources alongside the PixiJS outputs. Two separate paths handle the two kinds of atlases.

### Aseprite atlases — `generateGodotResources()`

**File**: `devtools/packer/processors/godot-resources.ts`  
**Called from**: `devtools/packer/index.ts`, immediately after the PixiJS atlas is packed.

Receives the in-memory `SpritesheetData` metadata and the atlas PNG buffer directly — no disk round-trip.

For each atlas with base name `baseName` (e.g. `"entities/rats"`, `"prototype"`):

| Output | Path |
|--------|------|
| Atlas PNG | `godot/atlases/<baseName>.png` |
| Single-frame sprite | `godot/sprites/<baseName>/<spriteName>.tres` (type `AtlasTexture`) |
| Multi-frame animation | `godot/sprites/<baseName>/<animName>.tres` (type `SpriteFrames`) |
| Sprite-map entry | merged into `godot/sprite-map.json` |

**`AtlasTexture`** resources encode `region` (the rect inside the atlas) and `margin` (the transparent padding PixiJS trims). This lets Godot display sprites at the correct size and position matching the PixiJS rendering.

**`SpriteFrames`** resources wrap a sequence of `AtlasTexture` sub-resources. Each frame gets its own `AtlasTexture` with the correct region and margin. The exported animation is named `"default"` and loops at 8 fps.

### TPS atlases — `generateGodotResourcesFromManifest()`

**File**: `devtools/packer/processors/godot-resources.ts`  
**Called from**: `devtools/vite-plugin-assetpack.ts` → `generateTypeDefinitions()` (post-build)

Atlases produced by `{tps}` folders go through `pixiPipes` and bypass the `packer()` pipe. This function reads `public/assets/assets-manifest.json` after the build, finds all `.png.json` spritesheet files whose frame names don't contain `#` (TPS style), then calls `generateGodotResources()` for each one.

### Sound files — `copyGodotSounds()`

**File**: `devtools/packer/processors/godot-resources.ts`  
**Called from**: `devtools/vite-plugin-assetpack.ts` → `generateTypeDefinitions()` (post-build)

Copies `.wav` files from `assets/sounds/` → `godot/sounds/`. Godot auto-imports `.wav` natively; no `.tres` wrapper is needed. Only files newer than the destination are copied to avoid disturbing Godot's importer.

### `sprite-map.json`

Every call to `generateGodotResources()` merges its results into `godot/sprite-map.json`. The schema:

```json
{
  "rat-boat": {
    "godotPath": "res://sprites/rats/rat-boat.tres",
    "type": "AtlasTexture",
    "pixiFrame": "rat-boat#0"
  },
  "captain": {
    "godotPath": "res://sprites/entities/captain.tres",
    "type": "SpriteFrames",
    "pixiAnimation": "captain",
    "frames": ["captain#0", "captain#1", "captain#2"]
  }
}
```

This table is the bridge Phase 3 uses to map Godot resource paths back to PixiJS frame names.

---

## Phase 3 — `.tscn` Parser

**File**: `devtools/packer/processors/godot-scene.ts`  
**Entry point**: `generateCutsceneJsonFiles(godotCutscenesDir, outputDir, spriteMapPath)`  
**Called from**: `devtools/vite-plugin-assetpack.ts` — once after the full build and again whenever a `.tscn` file changes (watched independently of assetpack).

### Authoring in Godot

Create a scene in `godot/cutscenes/`. The scene structure Godot expects:

```
AnimationPlayer      ← root node (name matters for NodePath resolution)
├─ Sprite2D          ← one per sprite in the cutscene
├─ Sprite2D
└─ AudioStreamPlayer ← one per sound, stream pre-assigned in the Inspector
```

Keyframe properties on Sprite2D nodes supported by the parser:

| Godot property | Maps to PixiJS |
|---|---|
| `position` | `sprite.x`, `sprite.y` |
| `scale` | `sprite.scale.x`, `sprite.scale.y` |
| `rotation` | `sprite.rotation` (radians) |
| `modulate:a` | `sprite.alpha` |
| `visible` | `sprite.visible` |
| `z_index` | `sprite.zIndex` |

Godot's internal `RESET` animation is automatically excluded from the output.

### Parser internals

`parseTscn(content, spriteMap)` processes the `.tscn` file in a single pass through its sections:

1. **`[ext_resource]`** — builds `id → res:// path` lookup (textures and audio streams)
2. **`[node]` — `AudioStreamPlayer`** — resolves `stream = ExtResource(...)` to a sound alias (filename without extension)
3. **`[sub_resource type=Animation]`** — extracts `value` tracks and `audio` tracks per animation
4. **`[sub_resource type=AnimationLibrary]`** — maps animation names to sub-resource IDs
5. **`[node]` — `Sprite2D`** — resolves `texture = ExtResource(...)` → `res://sprites/...` → PixiJS frame name via `sprite-map.json`

### Output format

Each `.tscn` file produces one `.json` file in `public/assets/cutscenes/`:

```jsonc
{
  "nodes": {
    "RatBoat":  { "type": "Sprite2D", "pixiTexture": "rat-boat#0" },
    "CatBody":  { "type": "Sprite2D", "pixiTexture": "cat-body#0" },
    "CatMeowB": { "type": "AudioStreamPlayer" }
  },
  "animations": {
    "intro": {
      "length": 5.0,
      "tracks": [
        {
          "node": "RatBoat",
          "property": "position",
          "interpolation": "linear",
          "keyframes": [
            { "time": 0, "value": { "x": 225, "y": 467 }, "transition": 1 },
            { "time": 5, "value": { "x": 218, "y": 144 }, "transition": 1 }
          ]
        }
        // ...more tracks
      ],
      "audioCues": [
        { "sound": "Cat Meow B", "time": 2 }
      ]
    }
  }
}
```

---

## Phase 4 — Runtime Player

### Types — `src/core/cutscene/types.ts`

Runtime counterparts to the parser output. `CutsceneData`, `CutsceneAnimation`, `CutsceneTrack`, `CutsceneKeyframe`, `CutsceneAudioCue`.

### Generated types — `src/assets/cutscenes.ts`

Auto-generated every time a `.tscn` file is processed. Provides two mapped types:

```typescript
// src/assets/cutscenes.ts (example output)
export type CutsceneNodeMap = {
  'rat-cat': {
    RatBoat: Container;
    CatBody: Container;
    CatTail: Container;
  };
};

export type CutsceneAnimationMap = {
  'rat-cat': 'intro';
};
```

`CutsceneNodeMap` includes only `Sprite2D` nodes — `AudioStreamPlayer` and `AnimationPlayer` nodes are excluded since they have no PixiJS counterpart.

### `CutscenePlayer` — `src/core/cutscene/CutscenePlayer.ts`

An animation driver. Takes pre-loaded `CutsceneData` and a node map, drives the timeline, optionally creates and cleans up missing nodes.

**Constructor**

```typescript
import type { CutsceneNodeMap, CutsceneAnimationMap } from '@/assets/cutscenes';
import { CutscenePlayer } from '@/core/cutscene/CutscenePlayer';

const data = Assets.get<CutsceneData>('cutscenes/rat-cat.json');
const player = new CutscenePlayer<CutsceneNodeMap['rat-cat'], CutsceneAnimationMap['rat-cat']>(data);
```

The type parameters are optional — without them you get `Record<string, Container>` and `string`. With them you get full autocompletion on node names and animation names.

**`play()` — two overloads**

```typescript
// cleanup: true (default) → void. Player-created nodes are destroyed on completion.
await player.play('intro');
await player.play('intro', { RatBoat: existingRat });

// cleanup: false → returns full node map. All nodes survive for reuse.
const { RatBoat, CatBody } = await player.play('intro', {}, { cleanup: false });
```

Nodes absent from the input map are created automatically from the cutscene definition (`Sprite2D` → `Sprite`, `anchor(0.5, 0.5)`). Caller-passed nodes are **never** destroyed regardless of the `cleanup` flag.

**`onSetup` callback**

Called after all nodes are created/merged but before animation starts. This is the right place to add player-created nodes to the display tree:

```typescript
await player.play('intro', {}, {
  onSetup: ({ CatBody, CatTail }) => {
    navigation.addToLayer(CatBody, 'overlay');
    navigation.addToLayer(CatTail, 'overlay');
  },
});
```

**Lifecycle inside `play()`:**

1. Create missing nodes from `data.nodes` (Sprite2D only)
2. Call `onSetup(allNodes)` — caller adds nodes to display tree
3. `applyInitialState()` — snaps every container to its t=0 keyframe value directly (no animation)
4. `runAnimation()` — builds a single `animejs` timeline:
   - Each pair of consecutive keyframes → `tl.add(target, props, fromTime * 1000)`
   - Each audio cue → `tl.call(() => sfx.play(cue.sound), cue.time * 1000)`
   - `await tl` resolves when everything completes
5. If `cleanup: true`, destroy player-created nodes and return `void`
6. If `cleanup: false`, return the full node map

**Property mapping:**

| Track property | animejs target | animejs props |
|---|---|---|
| `position` | `container` | `{ x, y }` |
| `scale` | `container.scale` | `{ x, y }` |
| `rotation` | `container` | `{ rotation }` |
| `modulate:a` | `container` | `{ alpha }` |
| `visible` | `container` | `{ visible }` |
| `z_index` | `container` | `{ zIndex }` |

**Interpolation mapping:**

| Godot interp | animejs easing |
|---|---|
| `nearest` (0) | `steps(1)` |
| `linear` (1) | `linear` |
| `cubic` (2, 4) | `easeInOutCubic` |

### `PlayCutsceneCommand` — `src/core/cutscene/PlayCutsceneCommand.ts`

Convenience wrapper for fire-and-forget cutscenes. Reads from the asset cache, creates all sprites, adds them to a layer, plays, then destroys everything.

```typescript
// Simplest — plays first animation, renders on 'overlay':
yield* execute(PlayCutsceneCommand, { name: 'rat-cat' });

// Explicit animation and layer:
yield* execute(PlayCutsceneCommand, { name: 'rat-cat', animation: 'intro', layer: 'overlay' });
```

The command calls `Assets.load()` internally, which fetches the JSON on first use and returns it from cache on subsequent calls — no pre-loading required.

---

## Adding a New Cutscene

1. Run `npm start` once to populate `godot/atlases/`, `godot/sprites/`, `godot/sounds/`.
2. Open `godot/` in Godot 4. Create a new scene in `godot/cutscenes/` following the node structure described in Phase 3.
3. Assign textures from `res://sprites/...` to your Sprite2D nodes. Add an `AudioStreamPlayer` for each sound and assign a stream from `res://sounds/`.
4. Animate with `AnimationPlayer`. Any property in the mapping table above is supported.
5. Save the `.tscn` file — the Vite dev server watches `godot/cutscenes/` and automatically regenerates the JSON in `public/assets/cutscenes/`.
6. Load the JSON as part of your screen's asset bundle (or via `Assets.load('cutscenes/rat-cat.json')`), then pick one of these patterns:

**Fire-and-forget** (via command — everything is created and cleaned up automatically):
```typescript
yield* execute(PlayCutsceneCommand, { name: 'rat-cat' });
```

**Full control** (direct player — you own the objects):
```typescript
import type { CutsceneNodeMap, CutsceneAnimationMap } from '@/assets/cutscenes';

const data = Assets.get<CutsceneData>('cutscenes/rat-cat.json');
const player = new CutscenePlayer<CutsceneNodeMap['rat-cat'], CutsceneAnimationMap['rat-cat']>(data);

// Pass existing objects in — player creates the rest
const rat = existingRatSprite;
const { RatBoat, CatBody, CatTail } = await player.play('intro', { RatBoat: rat }, {
  cleanup: false,
  onSetup: ({ CatBody, CatTail }) => {
    // Only add the player-created ones — rat is already in the scene
    navigation.addToLayer(CatBody, 'overlay');
    navigation.addToLayer(CatTail, 'overlay');
  },
});

// All three are alive — reuse them in the next scene, animate again, etc.
```

---

## Extending the Pipeline

### New animatable properties

Add a `case` in `buildAnimProps()` in `CutscenePlayer.ts`. No parser changes needed — unknown properties fall through to `{ [property]: value }` already.

### Camera tracks

`resolveNode()` in `CutscenePlayer.ts` currently returns `null` for non-Sprite2D nodes. To add camera support, check if `track.node === 'Camera'` and route to `this.context.camera`. The camera's `state` object is writable and animejs can target it directly (the `Camera.update()` method reads from `state` every tick).

### `AnimatedSprite2D` / `SpriteFrames` playback

Multi-frame animations are already in `sprite-map.json` as `SpriteFrames` entries. The current player creates static `Sprite` nodes. To support animated sprites, detect `node.type === 'AnimatedSprite2D'` in `buildNodes()` and use a PixiJS `AnimatedSprite` driven by the `frames` array from the sprite-map entry.

### Looping / skippable cutscenes

`CutscenePlayer.play()` returns a `Promise`. To allow skipping, keep a reference to the player and call `tl.pause()` / `tl.seek(tl.duration)` on user input (expose the timeline from `runAnimation` if needed).
