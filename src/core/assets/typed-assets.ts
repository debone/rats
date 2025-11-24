/**
 * Typed wrapper around PixiJS Assets for better type safety
 *
 * Usage:
 * import { typedAssets } from '@/core/assets/typed-assets';
 * import { ASSETS, FRAMES, FramesData } from '@/assets';
 * import type { TilesTextures } from '@/assets';
 *
 * // Get an atlas with proper typing
 * const tiles = typedAssets.get<TilesTextures>(ASSETS.tiles);
 * const texture = tiles.textures.grid; // Autocomplete works!
 *
 * // Or use FRAMES for texture names
 * const texture2 = tiles.textures[FRAMES.tiles.grid];
 *
 * // Get frame position/size data
 * const frameInfo = FramesData.tiles.grid; // { x, y, w, h }
 */

import { Assets } from 'pixi.js';
import type { AssetAlias, BundleName } from '@/assets';

/**
 * Type-safe wrapper around Assets.get()
 *
 * @example
 * import type { TilesTextures } from '@/assets';
 * const tiles = typedAssets.get<TilesTextures>(ASSETS.tiles);
 * tiles.textures.grid // Properly typed!
 */
function getAsset<T = any>(alias: AssetAlias): T {
  return Assets.get(alias as string) as T;
}

/**
 * Type-safe wrapper around Assets.loadBundle()
 */
async function loadBundle(bundle: BundleName | BundleName[]): Promise<void> {
  await Assets.loadBundle(bundle as string | string[]);
}

/**
 * Type-safe wrapper around Assets.backgroundLoadBundle()
 */
function backgroundLoadBundle(bundle: BundleName | BundleName[]): void {
  Assets.backgroundLoadBundle(bundle as string | string[]);
}

export const typedAssets = {
  get: getAsset,
  loadBundle,
  backgroundLoadBundle,
};
