/**
 * Tiled Map Runtime
 *
 * Provides runtime loading and rendering of Tiled maps using PixiJS.
 * Maps are pre-converted from TMX to JSON at build time.
 *
 * @example
 * ```typescript
 * import { TiledResource } from '@/core/tiled';
 *
 * const map = new TiledResource({ mapPath: 'assets/backgrounds/level-1.json' });
 * await map.load();
 *
 * // Add to scene
 * container.addChild(map.container);
 *
 * // Query layers
 * const background = map.getLayerByName('background');
 * const solidLayers = map.getLayersByProperty('solid', true);
 * ```
 */

export {
  TiledResource,
  type TiledResourceOptions,
  type TiledMapDefinition,
  type TilesetTextureConfig,
  type Layer,
} from './tiled-resource';
export { TileLayer, type TileLayerOptions } from './tile-layer';
export { ObjectLayer, type ObjectLayerOptions, type ParsedObject } from './object-layer';
export { ImageLayer, type ImageLayerOptions } from './image-layer';
export { Tileset, type TilesetOptions, type TexturesRecord, type TileIdToFrameName } from './tileset';
export { mapProperties, getProperty, type PropertyMap } from './properties';
export {
  getCanonicalGid,
  isFlippedHorizontally,
  isFlippedVertically,
  isFlippedDiagonally,
  FLIPPED_HORIZONTALLY_FLAG,
  FLIPPED_VERTICALLY_FLAG,
  FLIPPED_DIAGONALLY_FLAG,
} from './gid';
export * from './types';
