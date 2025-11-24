# Generated Asset Types

This directory contains auto-generated TypeScript definitions for your game assets.

**⚠️ DO NOT EDIT FILES IN THIS DIRECTORY MANUALLY**

These files are automatically generated during the asset packing process.

## Generated Files

### `manifest.ts`

Contains TypeScript definitions for all assets in the assets manifest:

- `AssetAlias` - Union type of all asset aliases
- `BundleName` - Union type of all bundle names
- `ASSETS` - Constant object with all asset aliases
- `BUNDLES` - Constant object with all bundle names

### `frames.ts`

Contains frame names and frame data:

- `FRAMES` - Frame name strings for accessing textures
- `FramesData` - Frame position and size data
- Texture types for each atlas (e.g., `TilesTextures`, `BackgroundTextures`)

### `index.ts`

Re-exports everything for convenient importing

## Usage

### Type-safe asset loading with proper types

```typescript
import { Assets } from 'pixi.js';
import { typedAssets } from '@/core/assets/typed-assets';
import { ASSETS, BUNDLES } from '@/assets';
import type { TilesTextures } from '@/assets';

// Load a bundle
await Assets.loadBundle([BUNDLES.DEFAULT]);

// Get an asset with proper typing
const tiles = typedAssets.get<TilesTextures>(ASSETS.tiles);
tiles.textures.grid; // Autocomplete works!
```

### Using FRAMES constants and frame data

```typescript
import { Assets } from 'pixi.js';
import { ASSETS, FRAMES, FramesData } from '@/assets';

const tiles = Assets.get(ASSETS.tiles);

// Access textures with FRAMES constants
const gridTexture = tiles.textures[FRAMES.tiles.grid];
const ballTexture = tiles.textures[FRAMES.tiles.ball];

// Or access directly (untyped but works)
const gridTexture2 = tiles.textures.grid;

// Access frame data (position/size)
const gridFrame = FramesData.tiles.grid; // { x: 2, y: 2, w: 32, h: 32 }
console.log(`Grid size: ${gridFrame.w}x${gridFrame.h}`);
```

## Regeneration

These files are regenerated automatically when:

1. Running `npm run dev` (watch mode)
2. Running `npm run build` (build mode)
3. Asset files change during watch mode

If the generated files are missing or outdated, restart your dev server or run a build.
