import { Assets, Container } from 'pixi.js';
import { ImageLayer } from './image-layer';
import { ObjectLayer, type ParsedObject } from './object-layer';
import { mapProperties, type PropertyMap } from './properties';
import { TileLayer } from './tile-layer';
import { Tileset, type TexturesRecord, type TileIdToFrameName } from './tileset';
import type { TiledMap, TiledTilesetFile } from './types';
import { isImageLayer, isObjectLayer, isTileLayer } from './types';

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
 * Union type for all layer types
 */
export type Layer = TileLayer | ObjectLayer | ImageLayer;

/**
 * Maps Tiled layer type strings to runtime layer classes
 */
type LayerTypeMap = {
  tilelayer: TileLayer;
  objectgroup: ObjectLayer;
  imagelayer: ImageLayer;
};

/**
 * Infer the layer class type from the map definition
 */
type InferLayerType<
  T extends TiledMapDefinition,
  K extends keyof T['layers'],
> = T['layers'][K]['type'] extends keyof LayerTypeMap ? LayerTypeMap[T['layers'][K]['type']] : Layer;

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

  /** All layers in z-order (as they appear in Tiled) */
  layers: Layer[] = [];

  /** Tile layers only */
  tileLayers: TileLayer[] = [];

  /** Object layers only */
  objectLayers: ObjectLayer[] = [];

  /** Image layers only */
  imageLayers: ImageLayer[] = [];

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
        this.layers.push(tileLayer);
        this.tileLayers.push(tileLayer);
        this.container.addChild(tileLayer.tilemap);
      } else if (isObjectLayer(layer)) {
        const objectLayer = new ObjectLayer({ layer });
        this.layers.push(objectLayer);
        this.objectLayers.push(objectLayer);
        // Object layers don't have a visual by default
        // Use objectLayer.createDebugGraphics() to visualize
      } else if (isImageLayer(layer)) {
        const imageLayer = new ImageLayer({
          layer,
          basePath: this.basePath,
        });

        imageLayer.container.zIndex = zIndex;
        this.layers.push(imageLayer);
        this.imageLayers.push(imageLayer);
        this.container.addChild(imageLayer.container);
      }

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
   * Get any layer by name (case insensitive)
   */
  getLayerByName(name: string): Layer | undefined {
    return this.layers.find((l) => l.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Get a layer by its typed key from the map definition.
   * Returns the correctly typed layer based on the layer type in the definition.
   */
  getLayer<K extends keyof T['layers']>(key: K): InferLayerType<T, K> | undefined {
    const layerDef = this.mapDef.layers[key as string];
    if (!layerDef) return undefined;

    return this.layers.find((l) => l.id === layerDef.id) as InferLayerType<T, K> | undefined;
  }

  /**
   * Get all tile layers matching a property
   */
  getLayersByProperty(name: string, value?: unknown): TileLayer[] {
    return this.tileLayers.filter((l) => {
      const prop = l.properties.get(name.toLowerCase());
      if (prop === undefined) return false;
      if (value === undefined) return true;
      return prop === value;
    });
  }

  // ==================== Object Layer Methods ====================

  /**
   * Get an object layer by name (case insensitive)
   */
  getObjectLayerByName(name: string): ObjectLayer | undefined {
    return this.objectLayers.find((l) => l.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Get all objects from all object layers by type/class
   */
  getObjectsByType(type: string): ParsedObject[] {
    return this.objectLayers.flatMap((l) => l.getObjectsByType(type));
  }

  /**
   * Get all objects from all object layers by name
   */
  getObjectsByName(name: string): ParsedObject[] {
    return this.objectLayers.flatMap((l) => l.getObjectsByName(name));
  }

  /**
   * Get all objects from all object layers with a specific property
   */
  getObjectsByProperty(name: string, value?: unknown): ParsedObject[] {
    return this.objectLayers.flatMap((l) => l.getObjectsByProperty(name, value));
  }

  /**
   * Get a single object by ID (searches all object layers)
   */
  getObjectById(id: number): ParsedObject | undefined {
    for (const layer of this.objectLayers) {
      const obj = layer.getObjectById(id);
      if (obj) return obj;
    }
    return undefined;
  }

  // ==================== Image Layer Methods ====================

  /**
   * Get an image layer by name (case insensitive)
   */
  getImageLayerByName(name: string): ImageLayer | undefined {
    return this.imageLayers.find((l) => l.name.toLowerCase() === name.toLowerCase());
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
