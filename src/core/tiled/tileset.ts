import { Texture } from 'pixi.js';
import { getCanonicalGid } from './gid';
import { mapProperties, type PropertyMap } from './properties';
import type { TiledTile, TiledTilesetEmbedded } from './types';

/**
 * A record of textures keyed by frame name (from spritesheet)
 */
export type TexturesRecord = Record<string, Texture>;

/**
 * Function that maps a local tile ID to a texture frame name.
 * Default pattern from assetpack: "basename#localId"
 */
export type TileIdToFrameName = (localId: number) => string;

export interface TilesetOptions {
  /** The Tiled tileset data */
  tileset: TiledTilesetEmbedded;
  /** The first GID this tileset uses in the map */
  firstGid: number;
  /**
   * The textures from the spritesheet.
   * Access via: Assets.get('asset-name').textures
   */
  textures: TexturesRecord;
  /**
   * Maps a local tile ID (0-based) to the texture frame name.
   * Default: "name#id" pattern (assetpack default)
   */
  tileIdToFrame?: TileIdToFrameName;
}

/**
 * Runtime representation of a Tiled tileset.
 * Uses pre-loaded spritesheet textures.
 */
export class Tileset {
  readonly name: string;
  readonly firstGid: number;
  readonly tileCount: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly columns: number;
  readonly spacing: number;
  readonly margin: number;
  readonly properties: PropertyMap;

  private readonly _textures: TexturesRecord;
  private readonly _tileIdToFrame: TileIdToFrameName;
  private readonly _tileMetadata = new Map<number, TiledTile>();

  constructor(options: TilesetOptions) {
    const { tileset, firstGid, textures, tileIdToFrame } = options;

    this.name = tileset.name;
    this.firstGid = firstGid;
    this.tileCount = tileset.tilecount;
    this.tileWidth = tileset.tilewidth;
    this.tileHeight = tileset.tileheight;
    this.columns = tileset.columns;
    this.spacing = tileset.spacing;
    this.margin = tileset.margin;
    this.properties = mapProperties(tileset.properties);

    this._textures = textures;
    // Default: assetpack names frames as "basename#index"
    this._tileIdToFrame = tileIdToFrame ?? ((id) => `${tileset.name}#${id}`);

    // Index tile metadata by local ID
    if (tileset.tiles) {
      for (const tile of tileset.tiles) {
        this._tileMetadata.set(tile.id, tile);
      }
    }
  }

  /**
   * Check if a GID belongs to this tileset
   */
  containsGid(gid: number): boolean {
    const canonical = getCanonicalGid(gid);
    return canonical >= this.firstGid && canonical < this.firstGid + this.tileCount;
  }

  /**
   * Get the local tile ID from a global ID
   */
  getLocalId(gid: number): number {
    return getCanonicalGid(gid) - this.firstGid;
  }

  /**
   * Get the texture for a tile by its GID.
   * Returns undefined if the texture isn't found.
   */
  getTextureForGid(gid: number): Texture | undefined {
    const localId = this.getLocalId(gid);
    const frameName = this._tileIdToFrame(localId);

    if (!this._textures[frameName]) {
      throw new Error(`Texture not found for frame name: ${frameName}`);
    }

    return this._textures[frameName];
  }

  /**
   * Get all available texture frame names
   */
  getAvailableFrames(): string[] {
    return Object.keys(this._textures);
  }

  /**
   * Get tile metadata (animations, custom properties, etc.)
   */
  getTileMetadata(gid: number): TiledTile | undefined {
    const localId = this.getLocalId(gid);
    return this._tileMetadata.get(localId);
  }

  /**
   * Check if a tile has animation frames
   */
  hasAnimation(gid: number): boolean {
    const meta = this.getTileMetadata(gid);
    return !!(meta?.animation && meta.animation.length > 0);
  }

  /**
   * Get animation frames for a tile
   */
  getAnimationFrames(gid: number): { texture: Texture; duration: number }[] | null {
    const meta = this.getTileMetadata(gid);
    if (!meta?.animation) return null;

    const frames: { texture: Texture; duration: number }[] = [];
    for (const frame of meta.animation) {
      const texture = this.getTextureForGid(frame.tileid + this.firstGid);
      if (texture) {
        frames.push({ texture, duration: frame.duration });
      }
    }
    return frames.length > 0 ? frames : null;
  }
}
