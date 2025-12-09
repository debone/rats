import { xml2js, type Element as XmlElement } from 'xml-js';
import { z } from 'zod';

// Helper to get text content from xml-js element
function textContent(el: XmlElement | undefined): string {
  if (!el?.elements) return '';
  const textNode = el.elements.find((e) => e.type === 'text');
  return (textNode?.text as string) ?? '';
}

// Helper to get attribute value
function attr(el: XmlElement | undefined, name: string): string | undefined {
  return el?.attributes?.[name] as string | undefined;
}

// Helper to find child element by name
function child(el: XmlElement | undefined, name: string): XmlElement | undefined {
  return el?.elements?.find((e) => e.name === name);
}

// Helper to filter children by name
function children(el: XmlElement | undefined, name: string): XmlElement[] {
  return el?.elements?.filter((e) => e.name === name) ?? [];
}

const TiledIntProperty = z.object({
  name: z.string(),
  type: z.literal('int'),
  value: z.number().int(),
});

const TiledBoolProperty = z.object({
  name: z.string(),
  type: z.literal('bool'),
  value: z.boolean(),
});

const TiledFloatProperty = z.object({
  name: z.string(),
  type: z.literal('float'),
  value: z.number(),
});

const TiledStringProperty = z.object({
  name: z.string(),
  type: z.literal('string'),
  value: z.string(),
});

const TiledFileProperty = z.object({
  name: z.string(),
  type: z.literal('file'),
  value: z.string(),
});

const TiledColorProperty = z.object({
  name: z.string(),
  type: z.literal('color'),
  value: z.string(),
});

const TiledObjectProperty = z.object({
  name: z.string(),
  type: z.literal('object'),
  value: z.number(),
});

const TiledProperty = z.discriminatedUnion('type', [
  TiledIntProperty,
  TiledBoolProperty,
  TiledFloatProperty,
  TiledStringProperty,
  TiledFileProperty,
  TiledColorProperty,
  TiledObjectProperty,
]);

const TiledTileLayerBase = z.object({
  name: z.string(),
  type: z.literal('tilelayer'),
  class: z.string().optional(),
  height: z.number(),
  width: z.number(),
  x: z.number(),
  y: z.number(),
  id: z.number(),
  opacity: z.number(),
  properties: z.array(TiledProperty).optional(),
  visible: z.boolean(),
  tintcolor: z.string().optional(),
  parallaxx: z.number().optional(),
  parallaxy: z.number().optional(),
  offsetx: z.number().optional(),
  offsety: z.number().optional(),
});

const TiledTileLayerCSV = TiledTileLayerBase.extend({
  data: z.array(z.number()),
  encoding: z.literal('csv'),
});

const TiledTileLayerGZIP = TiledTileLayerBase.extend({
  data: z.array(z.number()),
  encoding: z.literal('base64'),
  compression: z.literal('gzip'),
});

const TiledTileLayerZLib = TiledTileLayerBase.extend({
  data: z.array(z.number()),
  encoding: z.literal('base64'),
  compression: z.literal('zlib'),
});

const TiledTileLayerZStandard = TiledTileLayerBase.extend({
  data: z.array(z.number()),
  encoding: z.literal('base64'),
  compression: z.literal('zstandard'),
});

const TiledTileLayerBase64 = TiledTileLayerBase.extend({
  data: z.string(),
  encoding: z.literal('base64'),
  compression: z.string().optional(),
});

const TiledTileLayerChunkBase64 = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  data: z.string(),
});
const TiledTileLayerChunkCSV = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  data: z.array(z.number()),
});

const TiledTileLayerChunk = z.union([TiledTileLayerChunkBase64, TiledTileLayerChunkCSV]);

export const TiledTileLayerInfinite = TiledTileLayerBase.extend({
  startx: z.number(),
  starty: z.number(),
  chunks: z.array(TiledTileLayerChunk),
  encoding: z.string().optional(),
  compression: z.string().optional(),
  data: z.undefined(),
});

export const TiledTileLayer = z.union([
  TiledTileLayerBase64,
  TiledTileLayerCSV,
  TiledTileLayerGZIP,
  TiledTileLayerZLib,
  TiledTileLayerZStandard,
  TiledTileLayerInfinite,
]);

export function needsDecoding(
  x: TiledTileLayer,
): x is TiledTileLayer & { encoding: 'base64'; data: string; compression: string } {
  return (x as any).encoding === 'base64';
}

export function isCSV(x: TiledTileLayer): x is TiledTileLayer & { encoding: 'csv'; data: number[] } {
  return (x as any).encoding === 'csv' || Array.isArray((x as any).data);
}

const TiledPoint = z.object({
  x: z.number(),
  y: z.number(),
});

const TiledPolygon = z.array(TiledPoint);

export const TiledText = z.object({
  text: z.string(),
  color: z.string().optional(),
  fontfamily: z.string().optional(),
  pixelsize: z.number().optional(),
  wrap: z.boolean().optional(),
  halign: z.union([z.literal('left'), z.literal('center'), z.literal('right'), z.literal('justify')]).optional(),
  valign: z.union([z.literal('top'), z.literal('center'), z.literal('bottom')]).optional(),
});

const TiledObject = z.object({
  id: z.number().optional(), // Template files might not have an id for some reason
  name: z.string().optional(),
  type: z.string().optional(),
  x: z.number().optional(), // template files dont have x/y sometimes
  y: z.number().optional(), // template files dont have x/y sometimes
  rotation: z.number().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
  visible: z.boolean().optional(),
  gid: z.number().optional(),
  text: TiledText.optional(),
  point: z.boolean().optional(),
  ellipse: z.boolean().optional(),
  polyline: z.array(TiledPoint).optional(),
  polygon: TiledPolygon.optional(),
  template: z.string().optional(),
  properties: z.array(TiledProperty).optional(),
});

const TiledAnimation = z.object({
  duration: z.number(),
  tileid: z.number(),
});

const TiledObjectLayer = z.object({
  name: z.string(),
  draworder: z.string(),
  type: z.literal('objectgroup'),
  class: z.string().optional(),
  x: z.number(),
  y: z.number(),
  id: z.number(),
  color: z.string().optional(),
  tintcolor: z.string().optional(),
  parallaxx: z.number().optional(),
  parallaxy: z.number().optional(),
  offsetx: z.number().optional(),
  offsety: z.number().optional(),
  opacity: z.number(),
  properties: z.array(TiledProperty).optional(),
  visible: z.boolean(),
  objects: z.array(TiledObject),
});

const TiledImageLayer = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  id: z.number(),
  type: z.literal('imagelayer'),
  class: z.string().optional(),
  image: z.string().optional(),
  opacity: z.number(),
  properties: z.array(TiledProperty).optional(),
  visible: z.boolean(),
  tintcolor: z.string().optional(),
  repeatx: z.boolean().optional(),
  repeaty: z.boolean().optional(),
  parallaxx: z.number().optional(),
  parallaxy: z.number().optional(),
  offsetx: z.number().optional(),
  offsety: z.number().optional(),
  transparentcolor: z.string().optional(),
});

// FIXME recursive Group Layer definition
const TiledLayer = z.union([TiledTileLayer, TiledImageLayer, TiledObjectLayer]);

const TiledObjectGroup = z.object({
  draworder: z.string(),
  id: z.number().optional(), // sometimes tiled doesn't put an id here :( inconsistent
  name: z.string(),
  x: z.number(),
  y: z.number(),
  opacity: z.number(),
  tintcolor: z.string().optional(),
  type: z.literal('objectgroup'),
  visible: z.boolean(),
  objects: z.array(TiledObject),
  properties: z.array(TiledProperty).optional(),
});

export const TiledTile = z.object({
  id: z.number(),
  type: z.string().optional(),
  animation: z.array(TiledAnimation).optional(),
  objectgroup: TiledObjectGroup.optional(),
  probability: z.number().optional(),
  properties: z.array(TiledProperty).optional(),
  // Tiles can be collections of images
  image: z.string().optional(),
  imageheight: z.number().optional(),
  imagewidth: z.number().optional(),
});

const TiledTilesetEmbedded = z.object({
  name: z.string(),
  firstgid: z.number().optional(),
  class: z.string().optional(),
  objectalignment: z
    .union([
      z.literal('topleft'),
      z.literal('top'),
      z.literal('topright'),
      z.literal('left'),
      z.literal('center'),
      z.literal('right'),
      z.literal('bottomleft'),
      z.literal('bottom'),
      z.literal('bottomright'),
    ])
    .optional(),
  // optional image/width/height if collection of images
  image: z.string().optional(),
  imagewidth: z.number().optional(),
  imageheight: z.number().optional(),
  columns: z.number(),
  tileheight: z.number(),
  tilewidth: z.number(),
  tilecount: z.number(),

  grid: z
    .object({
      height: z.number(),
      width: z.number(),
      orientation: z.union([z.literal('isometric'), z.literal('orthogonal')]),
    })
    .optional(),
  // Can specify a drawing offset
  tileoffset: TiledPoint.optional(),
  spacing: z.number(),
  margin: z.number(),
  tiles: z.array(TiledTile).optional(),
  properties: z.array(TiledProperty).optional(),
});

export function isTiledTilesetSingleImage(
  x: TiledTileset,
): x is TiledTilesetEmbedded & { image: string; imagewidth: number; imageheight: number } {
  return !!(x as TiledTilesetEmbedded).image;
}

export function isTiledTilesetCollectionOfImages(
  x: TiledTileset,
): x is Omit<TiledTilesetEmbedded, 'image' | 'imagewidth' | 'imageheight'> {
  return !!!(x as TiledTilesetEmbedded).image;
}

export const TiledTilesetFile = TiledTilesetEmbedded.extend({
  tiledversion: z.string().optional(),
  type: z.literal('tileset'),
  version: z.string().optional(),
});

const TiledTilesetExternal = z.object({
  firstgid: z.number(),
  source: z.string(),
});

export const TiledTileset = z.union([TiledTilesetEmbedded, TiledTilesetExternal]);

export const TiledTemplate = z.object({
  object: TiledObject.extend({ id: z.number().optional() }),
  tileset: TiledTilesetExternal.optional(),
  type: z.literal('template'),
});

export const TiledMap = z.object({
  type: z.string(),
  class: z.string().optional(),
  tiledversion: z.string(),
  version: z.string(),
  width: z.number(),
  height: z.number(),
  tilewidth: z.number(),
  tileheight: z.number(),
  compressionlevel: z.number().optional(),
  infinite: z.boolean(),
  nextlayerid: z.number(),
  nextobjectid: z.number(),
  parallaxoriginx: z.number().optional(),
  parallaxoriginy: z.number().optional(),
  hexsidelength: z.number().optional(),
  staggeraxis: z.literal('y').or(z.literal('x')).optional(),
  staggerindex: z.literal('odd').or(z.literal('even')).optional(),
  orientation: z.union([
    z.literal('isometric'),
    z.literal('orthogonal'),
    z.literal('staggered'),
    z.literal('hexagonal'),
  ]),
  renderorder: z.union([z.literal('right-down'), z.literal('right-up'), z.literal('left-down'), z.literal('left-up')]),
  backgroundcolor: z.string().optional(),
  layers: z.array(TiledLayer),
  tilesets: z.array(TiledTileset),
  properties: z.array(TiledProperty).optional(),
});

export type TiledObjectGroup = z.infer<typeof TiledObjectGroup>;
export type TiledObject = z.infer<typeof TiledObject>;
export type TiledTile = z.infer<typeof TiledTile>;
export type TiledText = z.infer<typeof TiledText>;

export type TiledTileset = z.infer<typeof TiledTileset>;
export type TiledTilesetEmbedded = z.infer<typeof TiledTilesetEmbedded>;
export type TiledTilesetExternal = z.infer<typeof TiledTilesetExternal>;
export type TiledTilesetFile = z.infer<typeof TiledTilesetFile>;

export type TiledTemplate = z.infer<typeof TiledTemplate>;

export type TiledMap = z.infer<typeof TiledMap>;
export type TiledTileLayer = z.infer<typeof TiledTileLayer>;
export type TiledTileLayerInfinite = z.infer<typeof TiledTileLayerInfinite>;
export type TiledObjectLayer = z.infer<typeof TiledObjectLayer>;
export type TiledImageLayer = z.infer<typeof TiledImageLayer>;
export type TiledLayer = z.infer<typeof TiledLayer>;
export type TiledProperty = z.infer<typeof TiledProperty>;
export type TiledPropertyTypes = Pick<TiledProperty, 'type'>['type'];

export function isInfiniteLayer(tileLayer: TiledTileLayer): tileLayer is TiledTileLayerInfinite {
  return !!(tileLayer as TiledTileLayerInfinite).chunks;
}

export function isTiledTilesetEmbedded(ts: TiledTileset): ts is TiledTilesetEmbedded {
  return !!!(ts as TiledTilesetExternal).source;
}

export function isTiledTilesetExternal(ts: TiledTileset): ts is TiledTilesetExternal {
  return !!(ts as TiledTilesetExternal).source;
}

class BoundingBox {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  combine(other: BoundingBox) {
    const right = this.x + this.width;
    const bottom = this.y + this.height;

    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    const endRight = Math.max(right, otherRight);
    const endBottom = Math.max(bottom, otherBottom);

    const compositeBB = new BoundingBox(
      Math.min(this.x, other.x),
      Math.min(this.y, other.y),
      endRight - Math.min(this.x, other.x),
      endBottom - Math.min(this.y, other.y),
    );
    return compositeBB;
  }
}

export class TiledParser {
  _coerceNumber(value: any) {
    return +value;
  }
  _coerceBoolean(value: any) {
    switch (value) {
      case '0':
        return false;
      case 'false':
        return false;
      case 'true':
        return true;
      default:
        return !!Boolean(value);
    }
  }

  _coerceType(type: TiledPropertyTypes, value: string) {
    if (type === 'bool') {
      return this._coerceBoolean(value);
    }

    if (type === 'int' || type === 'float') {
      return this._coerceNumber(value);
    }

    if (type === 'object') {
      return this._coerceNumber(value);
    }
    return value;
  }

  _parsePropertiesNode(propertiesNode: XmlElement, target: any) {
    const properties: TiledProperty[] = [];
    for (const prop of children(propertiesNode, 'property')) {
      const type = attr(prop, 'type') ?? 'string';
      let value: any = attr(prop, 'value');
      if (!value) {
        value = textContent(prop);
      }
      properties.push({
        name: attr(prop, 'name') ?? '',
        type: type,
        value: this._coerceType(type as TiledPropertyTypes, value as string),
      } as TiledProperty);
    }
    target.properties = properties;
  }

  _parseAttributes(node: XmlElement, target: any) {
    // attribute names to coerce into numbers
    const numberProps = new Set([
      'width',
      'height',
      'columns',
      'firstgid',
      'spacing',
      'margin',
      'tilecount',
      'tilewidth',
      'tileheight',
      'opacity',
      'compressionlevel',
      'nextlayerid',
      'nextobjectid',
      'parallaxoriginx',
      'parallaxoriginy',
      'parallaxx',
      'parallaxy',
      'hexsidelength',
      'offsetx',
      'offsety',
      'id',
      'gid',
      'x',
      'y',
      'rotation',
      'probability',
    ]);

    // attribute names to coerce into booleans
    const booleanProps = new Set(['infinite', 'visible', 'repeatx', 'repeaty']);

    const attrs = node.attributes ?? {};
    for (const [name, value] of Object.entries(attrs)) {
      if (numberProps.has(name)) {
        target[name] = this._coerceNumber(value);
      } else if (booleanProps.has(name)) {
        target[name] = this._coerceBoolean(value);
      } else {
        target[name] = value;
      }
    }
  }

  /**
   * Parses XML string into xml-js element structure.
   * @param xml
   * @returns The root element of the parsed XML
   */
  _parseXml(xml: string): XmlElement {
    const result = xml2js(xml, { compact: false }) as XmlElement;
    return result;
  }

  parseObject(objectNode: XmlElement, strict = true): TiledObject {
    const object: any = {};
    object.type = '';
    object.x = 0;
    object.y = 0;

    if (!attr(objectNode, 'template')) {
      object.visible = true;
      object.name = '';
      object.rotation = 0;
      object.height = 0;
      object.width = 0;
    }

    this._parseAttributes(objectNode, object);

    const propertiesNode = child(objectNode, 'properties');
    if (propertiesNode) {
      this._parsePropertiesNode(propertiesNode, object);
    }

    const text = child(objectNode, 'text');
    if (text) {
      object.text = {
        text: textContent(text),
      };

      const fontfamily = attr(text, 'fontfamily');
      if (fontfamily) {
        object.text.fontfamily = fontfamily;
      }

      const color = attr(text, 'color');
      if (color) {
        object.text.color = color;
      }

      const pixelsize = attr(text, 'pixelsize');
      if (pixelsize) {
        object.text.pixelsize = this._coerceNumber(pixelsize);
      }

      const wrap = attr(text, 'wrap');
      if (wrap) {
        object.text.wrap = this._coerceBoolean(wrap);
      }

      const valign = attr(text, 'valign');
      if (valign) {
        object.text.valign = valign;
      }
      const halign = attr(text, 'halign');
      if (halign) {
        object.text.halign = halign;
      }
    }

    if (child(objectNode, 'point')) {
      object.point = true;
    }

    if (child(objectNode, 'ellipse')) {
      object.ellipse = true;
    }

    const polygon = child(objectNode, 'polygon');
    if (polygon) {
      const pointsStr = attr(polygon, 'points');
      object.polygon = pointsStr
        ? pointsStr.split(' ').map((p) => {
            const [x, y] = p.split(',');
            return { x: +x, y: +y };
          })
        : [];
    }

    const polyline = child(objectNode, 'polyline');
    if (polyline) {
      const pointsStr = attr(polyline, 'points');
      object.polyline = pointsStr
        ? pointsStr.split(' ').map((p) => {
            const [x, y] = p.split(',');
            return { x: +x, y: +y };
          })
        : [];
    }

    if (strict) {
      try {
        return TiledObject.parse(object);
      } catch (e) {
        console.error('Could not parse object', object, e);
        throw e;
      }
    }
    return object as TiledObject;
  }

  parseTileset(tilesetNode: XmlElement, strict = true): TiledTileset {
    const tileset: any = {};
    tileset.spacing = 0;
    tileset.margin = 0;
    this._parseAttributes(tilesetNode, tileset);

    if (tileset.source) {
      try {
        return TiledTileset.parse(tileset);
      } catch (e) {
        console.error('Could not parse external tileset', tileset, e);
      }
    }

    for (const tilesetChild of tilesetNode.elements ?? []) {
      switch (tilesetChild.name) {
        case 'properties': {
          this._parsePropertiesNode(tilesetChild, tileset);
          break;
        }
        case 'tileoffset': {
          const tileoffset: any = {};
          this._parseAttributes(tilesetChild, tileoffset);
          tileset.tileoffset = tileoffset;
          break;
        }
        case 'grid': {
          const grid: any = {};
          this._parseAttributes(tilesetChild, grid);
          tileset.grid = grid;
          break;
        }
        case 'image': {
          tileset.image = attr(tilesetChild, 'source');
          tileset.imagewidth = this._coerceNumber(attr(tilesetChild, 'width'));
          tileset.imageheight = this._coerceNumber(attr(tilesetChild, 'height'));
          break;
        }
        case 'tile': {
          if (!tileset.tiles) {
            tileset.tiles = [];
          }
          const tile: any = {};
          this._parseAttributes(tilesetChild, tile);

          for (const tileChild of tilesetChild.elements ?? []) {
            switch (tileChild.name) {
              case 'image': {
                tile.image = attr(tileChild, 'source');
                tile.imagewidth = this._coerceNumber(attr(tileChild, 'width'));
                tile.imageheight = this._coerceNumber(attr(tileChild, 'height'));
                break;
              }
              case 'objectgroup': {
                const objectgroup: any = {};
                objectgroup.type = 'objectgroup';
                objectgroup.name = '';
                objectgroup.visible = true;
                objectgroup.x = 0;
                objectgroup.y = 0;
                objectgroup.opacity = 1;
                objectgroup.objects = [];
                this._parseAttributes(tileChild, objectgroup);
                tile.objectgroup = objectgroup;

                for (const objectChild of children(tileChild, 'object')) {
                  objectgroup.objects.push(this.parseObject(objectChild, strict));
                }
                break;
              }
              case 'animation': {
                tile.animation = children(tileChild, 'frame').map((frameChild) => ({
                  duration: this._coerceNumber(attr(frameChild, 'duration')),
                  tileid: this._coerceNumber(attr(frameChild, 'tileid')),
                }));
                break;
              }
              case 'properties': {
                this._parsePropertiesNode(tileChild, tile);
                break;
              }
            }
          }

          if (strict) {
            try {
              tileset.tiles.push(TiledTile.parse(tile));
            } catch (e) {
              console.error('Could not parse Tile', tile, e);
              throw e;
            }
          } else {
            tileset.tiles.push(tile as TiledTile);
          }
          break;
        }
      }
    }
    if (strict) {
      try {
        return TiledTileset.parse(tileset);
      } catch (e) {
        console.error('Could not parse Tileset', tileset, e);
        throw e;
      }
    }
    return tileset as TiledTileset;
  }

  _largestBounds = new BoundingBox(0, 0, 0, 0);
  parseTileLayer(layerNode: XmlElement, infinite: boolean, strict = true): TiledLayer {
    const layer: any = {};
    layer.type = 'tilelayer';
    layer.x = 0;
    layer.y = 0;
    layer.opacity = 1;
    layer.visible = true;
    this._parseAttributes(layerNode, layer);

    for (const layerChild of layerNode.elements ?? []) {
      switch (layerChild.name) {
        case 'properties': {
          this._parsePropertiesNode(layerChild, layer);
          break;
        }
        case 'data': {
          const encoding = attr(layerChild, 'encoding');
          // technically breaking compat, but this is useful
          if (encoding) {
            layer.encoding = encoding;
          }

          const compression = attr(layerChild, 'compression');
          if (compression) {
            layer.compression = compression;
          }

          const dataText = textContent(layerChild);

          if (infinite) {
            layer.width = 0;
            layer.height = 0;
            layer.chunks = [];
            // Tiled appears to have an undocumented minimum bounds
            let bounds: BoundingBox = new BoundingBox(0, 0, 0, 0);

            for (const chunkTag of children(layerChild, 'chunk')) {
              const chunk: any = {};
              this._parseAttributes(chunkTag, chunk);
              const chunkText = textContent(chunkTag);

              switch (layer.encoding) {
                case 'base64': {
                  chunk.data = chunkText.trim();
                  break;
                }
                case 'csv': {
                  chunk.data = chunkText.split(',').map((id) => +id);
                  break;
                }
              }

              // combining bounding boxes actually probably is easiest here
              const chunkBounds = new BoundingBox(chunk.x, chunk.y, chunk.width, chunk.height);
              bounds = bounds.combine(chunkBounds);
              layer.chunks.push(chunk);
            }

            layer.width = bounds.width;
            layer.height = bounds.height;
            layer.startx = bounds.x;
            layer.starty = bounds.y;

            this._largestBounds = this._largestBounds.combine(
              new BoundingBox(layer.startx, layer.starty, layer.width, layer.height),
            );
          } else {
            switch (layer.encoding) {
              case 'base64': {
                layer.data = dataText.trim();
                break;
              }
              case 'csv': {
                layer.data = dataText.split(',').map((id) => +id);
                break;
              }
            }
          }
        }
      }
    }
    if (strict) {
      try {
        return TiledLayer.parse(layer);
      } catch (e) {
        console.error('Could not parse tiled tile layer', layer, e);
        throw e;
      }
    }
    return layer as TiledLayer;
  }

  parseObjectGroup(groupNode: XmlElement, strict = true): TiledLayer {
    const group: any = {};
    group.type = 'objectgroup';
    group.draworder = 'topdown';
    group.visible = true;
    group.x = 0;
    group.y = 0;
    group.opacity = 1;
    group.objects = [];
    this._parseAttributes(groupNode, group);

    for (const groupChild of groupNode.elements ?? []) {
      switch (groupChild.name) {
        case 'properties': {
          this._parsePropertiesNode(groupChild, group);
          break;
        }
        case 'object': {
          group.objects.push(this.parseObject(groupChild, strict));
          break;
        }
      }
    }

    if (strict) {
      try {
        return TiledLayer.parse(group);
      } catch (e) {
        console.error('Could not parse object group', group, e);
        throw e;
      }
    }
    return group as TiledLayer;
  }

  parseImageLayer(imageNode: XmlElement, strict = true): TiledLayer {
    const imageLayer: any = {};
    imageLayer.type = 'imagelayer';
    imageLayer.visible = true;
    imageLayer.x = 0;
    imageLayer.y = 0;
    imageLayer.opacity = 1;

    const image = child(imageNode, 'image');
    imageLayer.image = attr(image, 'source');

    const properties = child(imageNode, 'properties');
    if (properties) {
      this._parsePropertiesNode(properties, imageLayer);
    }

    const transparentcolor = attr(image, 'trans');
    if (transparentcolor) {
      imageLayer.transparentcolor = '#' + transparentcolor;
    }

    this._parseAttributes(imageNode, imageLayer);

    if (strict) {
      try {
        return TiledLayer.parse(imageLayer);
      } catch (e) {
        console.error('Could not parse layer', imageLayer, e);
        throw e;
      }
    }
    return imageLayer as TiledLayer;
  }

  parseExternalTemplate(txXml: string, strict = true): TiledTemplate {
    const root = this._parseXml(txXml);
    const templateElement = child(root, 'template');
    const template: any = {};
    template.type = 'template';

    const objectElement = child(templateElement, 'object');
    if (objectElement) {
      template.object = this.parseObject(objectElement, strict);
    }

    const tileSetElement = child(templateElement, 'tileset');
    if (tileSetElement) {
      template.tileset = this.parseTileset(tileSetElement, strict);
    }

    if (strict) {
      try {
        return TiledTemplate.parse(template);
      } catch (e) {
        console.error('Could not parse template', template, e);
        throw e;
      }
    }
    return template as TiledTemplate;
  }

  /**
   * Takes Tiled tmx xml and produces the equivalent Tiled txj (json) content
   * @param tsxXml
   */
  parseExternalTileset(tsxXml: string, strict = true): TiledTilesetFile {
    const root = this._parseXml(tsxXml);
    const tilesetElement = child(root, 'tileset')!;

    const tileset = this.parseTileset(tilesetElement, strict);

    (tileset as any).type = 'tileset';
    this._parseAttributes(tilesetElement, tileset);

    if (strict) {
      try {
        return TiledTilesetFile.parse(tileset);
      } catch (e) {
        console.error('Could not parse tileset file', tileset, e);
        throw e;
      }
    }
    return tileset as TiledTilesetFile;
  }

  /**
   * Takes Tiled tmx xml and produces the equivalent Tiled tmj (json) content
   * @param tmxXml
   * @returns
   */
  parse(tmxXml: string, strict = true): TiledMap {
    const root = this._parseXml(tmxXml);
    const mapElement = child(root, 'map')!;

    const tiledMap: any = {};
    tiledMap.type = 'map';
    tiledMap.compressionlevel = -1;
    tiledMap.layers = [];
    tiledMap.tilesets = [];

    this._parseAttributes(mapElement, tiledMap);

    const parseHelper = (node: XmlElement, strict = true) => {
      switch (node.name) {
        case 'group': {
          // recurse through groups!
          // currently we support groups by flattening them, no group types
          for (const groupChild of node.elements ?? []) {
            parseHelper(groupChild, strict);
          }
          break;
        }
        case 'layer': {
          tiledMap.layers.push(this.parseTileLayer(node, tiledMap.infinite, strict));
          break;
        }
        case 'properties': {
          this._parsePropertiesNode(node, tiledMap);
          break;
        }
        case 'tileset': {
          tiledMap.tilesets.push(this.parseTileset(node, strict));
          break;
        }
        case 'objectgroup': {
          tiledMap.layers.push(this.parseObjectGroup(node, strict));
          break;
        }
        case 'imagelayer': {
          tiledMap.layers.push(this.parseImageLayer(node, strict));
          break;
        }
      }
    };

    // Parse all layers
    for (const mapChild of mapElement.elements ?? []) {
      parseHelper(mapChild, strict);
    }

    if (strict) {
      try {
        return TiledMap.parse(tiledMap);
      } catch (e) {
        console.error('Could not parse Tiled map', e);
        throw e;
      }
    }

    return tiledMap as TiledMap;
  }
}
