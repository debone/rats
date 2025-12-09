import { Assets, Container } from 'pixi.js';
import { mapProperties, type PropertyMap } from './properties';
import { TileLayer } from './tile-layer';
import { Tileset, type TexturesRecord, type TileIdToFrameName } from './tileset';
import type { TiledMap, TiledTilesetFile } from './types';
import { isTileLayer } from './types';

/**
 * Typed map definition from generated tiled.ts
 */
export interface TiledMapDefinition<
  TLayers extends Record<string, { type: string; id: number; class?: string }> = Record<
    string,
    { type: string; id: number; class?: string }
  >,
  TTilesets extends Record<string, { firstgid: number; path: string; imagePath: string }> = Record<
    string,
    { firstgid: number; path: string; imagePath: string }
  >,
> {
  path: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: TLayers;
  tilesets: TTilesets;
  properties?: Record<string, any>;
}

/**
 * Configuration for how to load a tileset's textures
 */
export interface TilesetTextureConfig {
  /**
   * The textures record from a loaded spritesheet.
   * Get via: Assets.get('asset-name').textures
   */
  textures: TexturesRecord;
  /**
   * Maps a local tile ID (0-based) to texture frame name.
   * Default: "tilesetName#id" (assetpack pattern)
   */
  tileIdToFrame?: TileIdToFrameName;
}

/**
 * Extract tileset names from a map definition
 */
type TilesetNames<T extends TiledMapDefinition> = keyof T['tilesets'];

export interface TiledResourceOptions<T extends TiledMapDefinition> {
  /**
   * Typed map definition from TILED_MAPS.
   */
  map: T;

  /**
   * Texture configuration for each tileset.
   * Keys must match the tileset names in the map definition.
   */
  tilesetTextures: { [K in TilesetNames<T>]: TilesetTextureConfig };

  /**
   * Optional: Override base path for resolving asset paths.
   */
  basePath?: string;
}

/**
 * Main Tiled resource loader and container.
 * Works with pre-loaded spritesheet assets.
 */
export class TiledResource<T extends TiledMapDefinition = TiledMapDefinition> {
  readonly mapDef: T;
  readonly basePath: string;

  /** The raw Tiled map data */
  map!: TiledMap;

  /** Loaded tilesets */
  tilesets: Tileset[] = [];

  /** Loaded tile layers */
  tileLayers: TileLayer[] = [];

  /** Map properties */
  properties!: PropertyMap;

  /** Container holding all layers */
  readonly container: Container;

  private _loaded = false;
  private _tilesetTextures: { [K in TilesetNames<T>]: TilesetTextureConfig };

  constructor(options: TiledResourceOptions<T>) {
    this.mapDef = options.map;
    this.basePath = options.basePath ?? this._extractBasePath(options.map.path);
    this._tilesetTextures = options.tilesetTextures;
    this.container = new Container();
  }

  private _extractBasePath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(0, lastSlash + 1) : '';
  }

  /**
   * Load/initialize the map and all its dependencies.
   * All assets must be pre-loaded via bundles.
   */
  load(): void {
    if (this._loaded) return;

    // Get map JSON (must be pre-loaded)
    this.map = Assets.get<TiledMap>(this.mapDef.path);
    if (!this.map) {
      throw new Error(`Map not found: ${this.mapDef.path}. Make sure it's loaded via a bundle.`);
    }
    this.properties = mapProperties(this.map.properties);

    // Load tilesets
    this._loadTilesets();

    // Sort tilesets by firstGid descending for efficient lookup
    this.tilesets.sort((a, b) => b.firstGid - a.firstGid);

    // Create tile layers
    this._createLayers();

    this._loaded = true;
  }

  private _loadTilesets(): void {
    for (const [tilesetName, tilesetDef] of Object.entries(this.mapDef.tilesets)) {
      // Get tileset JSON (must be pre-loaded)
      const tilesetFile = Assets.get<TiledTilesetFile>(tilesetDef.path);
      if (!tilesetFile) {
        console.warn(`Tileset JSON not found: ${tilesetDef.path}. Skipping.`);
        continue;
      }

      // Get texture config for this tileset (typed, so it must exist)
      const textureConfig = this._tilesetTextures[tilesetName as TilesetNames<T>];

      this.tilesets.push(
        new Tileset({
          tileset: tilesetFile,
          firstGid: tilesetDef.firstgid,
          textures: textureConfig.textures,
          tileIdToFrame: textureConfig.tileIdToFrame,
        }),
      );
    }
  }

  private _createLayers(): void {
    let zIndex = 0;

    for (const layer of this.map.layers) {
      if (isTileLayer(layer)) {
        const tileLayer = new TileLayer({
          layer,
          tilesets: this.tilesets,
          tileWidth: this.map.tilewidth,
          tileHeight: this.map.tileheight,
        });

        tileLayer.tilemap.zIndex = zIndex;
        this.tileLayers.push(tileLayer);
        this.container.addChild(tileLayer.tilemap);
      }

      // TODO: Add object layer and image layer support
      zIndex++;
    }
  }

  /**
   * Find a tileset by GID
   */
  getTilesetForGid(gid: number): Tileset | undefined {
    for (const tileset of this.tilesets) {
      if (tileset.containsGid(gid)) {
        return tileset;
      }
    }
    return undefined;
  }

  /**
   * Get a layer by name (case insensitive)
   */
  getLayerByName(name: string): TileLayer | undefined {
    return this.tileLayers.find((l) => l.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Get a layer by its typed key from the map definition
   */
  getLayer<K extends keyof T['layers']>(key: K): TileLayer | undefined {
    const layerDef = this.mapDef.layers[key as string];
    if (!layerDef) return undefined;

    return this.tileLayers.find((l) => l.id === layerDef.id);
  }

  /**
   * Get all layers matching a property
   */
  getLayersByProperty(name: string, value?: unknown): TileLayer[] {
    return this.tileLayers.filter((l) => {
      const prop = l.properties.get(name.toLowerCase());
      if (prop === undefined) return false;
      if (value === undefined) return true;
      return prop === value;
    });
  }

  /**
   * Check if loaded
   */
  isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Map dimensions in pixels
   */
  get pixelWidth(): number {
    return this.map.width * this.map.tilewidth;
  }

  get pixelHeight(): number {
    return this.map.height * this.map.tileheight;
  }
}
