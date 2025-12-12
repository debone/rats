/**
 * Re-export Tiled types from the parser for runtime use.
 * These are the JSON structures produced by our build-time TMX parser.
 */

// The parser types would typically be shared, but since the parser is in devtools,
// we define the runtime types here matching the JSON output.

export interface TiledProperty {
  name: string;
  type: 'int' | 'bool' | 'float' | 'string' | 'file' | 'color' | 'object';
  value: string | number | boolean;
}

export interface TiledTileLayer {
  name: string;
  type: 'tilelayer';
  id: number;
  width: number;
  height: number;
  x: number;
  y: number;
  opacity: number;
  visible: boolean;
  data: number[];
  encoding?: 'csv' | 'base64';
  compression?: string;
  offsetx?: number;
  offsety?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  class?: string;
  properties?: TiledProperty[];
}

export interface TiledObjectLayer {
  name: string;
  type: 'objectgroup';
  id: number;
  x: number;
  y: number;
  opacity: number;
  visible: boolean;
  draworder: string;
  objects: TiledObject[];
  offsetx?: number;
  offsety?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  class?: string;
  properties?: TiledProperty[];
}

export interface TiledObject {
  id?: number;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible?: boolean;
  gid?: number;
  point?: boolean;
  ellipse?: boolean;
  polygon?: { x: number; y: number }[];
  polyline?: { x: number; y: number }[];
  template?: string;
  properties?: TiledProperty[];
}

export interface TiledImageLayer {
  name: string;
  type: 'imagelayer';
  id: number;
  x: number;
  y: number;
  opacity: number;
  visible: boolean;
  image?: string;
  offsetx?: number;
  offsety?: number;
  parallaxx?: number;
  parallaxy?: number;
  tintcolor?: string;
  repeatx?: boolean;
  repeaty?: boolean;
  class?: string;
  properties?: TiledProperty[];
}

export type TiledLayer = TiledTileLayer | TiledObjectLayer | TiledImageLayer;

export interface TiledTilesetRef {
  firstgid: number;
  source: string;
}

export interface TiledTilesetEmbedded {
  name: string;
  firstgid?: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  columns: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  spacing: number;
  margin: number;
  tiles?: TiledTile[];
  properties?: TiledProperty[];
  class?: string;
}

export interface TiledTile {
  id: number;
  type?: string;
  animation?: { duration: number; tileid: number }[];
  properties?: TiledProperty[];
  image?: string;
  imagewidth?: number;
  imageheight?: number;
}

export type TiledTileset = TiledTilesetRef | TiledTilesetEmbedded;

export interface TiledMap {
  type: string;
  version: string;
  tiledversion: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite: boolean;
  orientation: 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal';
  renderorder: 'right-down' | 'right-up' | 'left-down' | 'left-up';
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  backgroundcolor?: string;
  properties?: TiledProperty[];
  class?: string;
}

export interface TiledTilesetFile extends TiledTilesetEmbedded {
  type: 'tileset';
  tiledversion?: string;
  version?: string;
}

/** Type guard for external tileset reference */
export function isTilesetRef(ts: TiledTileset): ts is TiledTilesetRef {
  return 'source' in ts;
}

/** Type guard for embedded tileset */
export function isTilesetEmbedded(ts: TiledTileset): ts is TiledTilesetEmbedded {
  return !('source' in ts);
}

/** Type guard for tile layer */
export function isTileLayer(layer: TiledLayer): layer is TiledTileLayer {
  return layer.type === 'tilelayer';
}

/** Type guard for object layer */
export function isObjectLayer(layer: TiledLayer): layer is TiledObjectLayer {
  return layer.type === 'objectgroup';
}

/** Type guard for image layer */
export function isImageLayer(layer: TiledLayer): layer is TiledImageLayer {
  return layer.type === 'imagelayer';
}
