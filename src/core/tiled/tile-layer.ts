import { CompositeTilemap } from '@pixi/tilemap';
import { getCanonicalGid, isFlippedDiagonally, isFlippedHorizontally, isFlippedVertically } from './gid';
import { mapProperties, type PropertyMap } from './properties';
import type { Tileset } from './tileset';
import type { TiledTileLayer } from './types';

export interface TileLayerOptions {
  /** The Tiled layer data */
  layer: TiledTileLayer;
  /** Available tilesets, sorted by firstGid descending for lookup */
  tilesets: Tileset[];
  /** Map tile width */
  tileWidth: number;
  /** Map tile height */
  tileHeight: number;
}

/**
 * Runtime tile layer that renders to a PixiJS CompositeTilemap.
 */
export class TileLayer {
  readonly name: string;
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly properties: PropertyMap;
  readonly tilemap: CompositeTilemap;

  private readonly _layer: TiledTileLayer;
  private readonly _tilesets: Tileset[];
  private readonly _tileWidth: number;
  private readonly _tileHeight: number;

  constructor(options: TileLayerOptions) {
    const { layer, tilesets, tileWidth, tileHeight } = options;

    this.name = layer.name;
    this.id = layer.id;
    this.width = layer.width;
    this.height = layer.height;
    this.visible = layer.visible;
    this.opacity = layer.opacity;
    this.properties = mapProperties(layer.properties);

    this._layer = layer;
    this._tilesets = tilesets;
    this._tileWidth = tileWidth;
    this._tileHeight = tileHeight;

    // Create the tilemap
    this.tilemap = new CompositeTilemap();
    this.tilemap.visible = this.visible;
    this.tilemap.alpha = this.opacity;

    // Apply offset if specified
    if (layer.offsetx !== undefined) this.tilemap.x = layer.offsetx;
    if (layer.offsety !== undefined) this.tilemap.y = layer.offsety;

    // Build the tilemap
    this._buildTilemap();
  }

  /**
   * Find the tileset that contains a given GID
   */
  private _getTilesetForGid(gid: number): Tileset | undefined {
    const canonical = getCanonicalGid(gid);
    // Tilesets should be sorted by firstGid descending for this lookup
    for (const tileset of this._tilesets) {
      if (tileset.containsGid(canonical)) {
        return tileset;
      }
    }
    return undefined;
  }

  /**
   * Build the tilemap from layer data
   */
  private _buildTilemap(): void {
    const data = this._layer.data;
    if (!data) return;

    for (let i = 0; i < data.length; i++) {
      const gid = data[i];
      if (gid === 0) continue; // Empty tile

      const tileset = this._getTilesetForGid(gid);
      if (!tileset) {
        console.warn(`No tileset found for GID ${gid}`);
        continue;
      }

      const x = (i % this.width) * this._tileWidth;
      const y = Math.floor(i / this.width) * this._tileHeight;

      const texture = tileset.getTextureForGid(gid);

      // Handle flipping
      const flipH = isFlippedHorizontally(gid);
      const flipV = isFlippedVertically(gid);
      const flipD = isFlippedDiagonally(gid);

      // Calculate transform for flipped tiles
      // @pixi/tilemap supports rotation and scale
      let rotation = 0;
      let scaleX = 1;
      let scaleY = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (flipD) {
        // Diagonal flip = rotate -90° and flip horizontally
        rotation = -Math.PI / 2;
        scaleX = -1;
        offsetX = this._tileWidth;
      }
      if (flipH) {
        if (flipD) {
          scaleX = 1;
          scaleY = -1;
          offsetY = this._tileHeight;
        } else {
          scaleX = -1;
          offsetX = this._tileWidth;
        }
      }
      if (flipV) {
        if (flipD) {
          scaleX = -1;
          scaleY = 1;
          offsetX = this._tileWidth;
          offsetY = 0;
        } else {
          scaleY = -1;
          offsetY = this._tileHeight;
        }
      }

      // Add tile to tilemap
      if (rotation !== 0 || scaleX !== 1 || scaleY !== 1) {
        this.tilemap.tile(texture, x + offsetX, y + offsetY, {
          u: texture.frame.x - (texture.trim?.x || 0),
          v: texture.frame.y - (texture.trim?.y || 0),
          rotate: rotation,
          scaleX,
          scaleY,
        } as any);
      } else {
        this.tilemap.tile(texture, x, y, {
          u: texture.frame.x - (texture.trim?.x || 0),
          v: texture.frame.y - (texture.trim?.y || 0),
        });
      }
    }
  }

  /**
   * Get the GID at a specific tile coordinate
   */
  getGidAt(tileX: number, tileY: number): number {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
      return 0;
    }
    const index = tileY * this.width + tileX;
    return this._layer.data[index] ?? 0;
  }

  /**
   * Get the GID at a world position
   */
  getGidAtWorld(worldX: number, worldY: number): number {
    const tileX = Math.floor(worldX / this._tileWidth);
    const tileY = Math.floor(worldY / this._tileHeight);
    return this.getGidAt(tileX, tileY);
  }
}
