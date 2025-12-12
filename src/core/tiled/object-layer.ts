import { Container, Graphics } from 'pixi.js';
import { mapProperties, type PropertyMap } from './properties';
import type { TiledObject, TiledObjectLayer } from './types';

/**
 * Parsed object with properties as a Map
 */
export interface ParsedObject {
  /** Tiled object ID */
  id: number;
  /** Object name from Tiled */
  name: string;
  /** Object type/class from Tiled */
  type: string;
  /** X position in pixels */
  x: number;
  /** Y position in pixels */
  y: number;
  /** Width (for rectangles, ellipses) */
  width: number;
  /** Height (for rectangles, ellipses) */
  height: number;
  /** Rotation in degrees */
  rotation: number;
  /** Visibility */
  visible: boolean;
  /** GID if this is a tile object */
  gid?: number;
  /** True if this is a point object */
  point: boolean;
  /** True if this is an ellipse */
  ellipse: boolean;
  /** Polygon points (relative to x,y) */
  polygon?: { x: number; y: number }[];
  /** Polyline points (relative to x,y) */
  polyline?: { x: number; y: number }[];
  /** Custom properties */
  properties: PropertyMap;
  /** Original Tiled object data */
  tiledObject: TiledObject;
}

export interface ObjectLayerOptions {
  /** The Tiled layer data */
  layer: TiledObjectLayer;
}

/**
 * Runtime object layer from Tiled.
 * Provides access to objects for game logic (spawn points, triggers, etc.)
 */
export class ObjectLayer {
  readonly name: string;
  readonly id: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly properties: PropertyMap;

  /** All parsed objects in this layer */
  readonly objects: ParsedObject[];

  /**
   * Optional container for debug visualization.
   * Not created by default - call createDebugGraphics() to generate.
   */
  debugContainer?: Container;

  private readonly _layer: TiledObjectLayer;

  constructor(options: ObjectLayerOptions) {
    const { layer } = options;

    this.name = layer.name;
    this.id = layer.id;
    this.visible = layer.visible;
    this.opacity = layer.opacity;
    this.properties = mapProperties(layer.properties);

    this._layer = layer;

    // Parse all objects
    this.objects = layer.objects.map((obj) => this._parseObject(obj));
  }

  private _parseObject(obj: TiledObject): ParsedObject {
    return {
      id: obj.id ?? 0,
      name: obj.name ?? '',
      type: obj.type ?? '',
      x: obj.x ?? 0,
      y: obj.y ?? 0,
      width: obj.width ?? 0,
      height: obj.height ?? 0,
      rotation: obj.rotation ?? 0,
      visible: obj.visible ?? true,
      gid: obj.gid,
      point: obj.point ?? false,
      ellipse: obj.ellipse ?? false,
      polygon: obj.polygon,
      polyline: obj.polyline,
      properties: mapProperties(obj.properties),
      tiledObject: obj,
    };
  }

  /**
   * Get objects by name (case insensitive)
   */
  getObjectsByName(name: string): ParsedObject[] {
    const lower = name.toLowerCase();
    return this.objects.filter((o) => o.name.toLowerCase() === lower);
  }

  /**
   * Get objects by type/class (case insensitive)
   */
  getObjectsByType(type: string): ParsedObject[] {
    const lower = type.toLowerCase();
    return this.objects.filter((o) => o.type.toLowerCase() === lower);
  }

  /**
   * Get objects that have a specific property
   */
  getObjectsByProperty(name: string, value?: unknown): ParsedObject[] {
    const lower = name.toLowerCase();
    return this.objects.filter((o) => {
      const prop = o.properties.get(lower);
      if (prop === undefined) return false;
      if (value === undefined) return true;
      return prop === value;
    });
  }

  /**
   * Get a single object by ID
   */
  getObjectById(id: number): ParsedObject | undefined {
    return this.objects.find((o) => o.id === id);
  }

  /**
   * Get all point objects
   */
  getPoints(): ParsedObject[] {
    return this.objects.filter((o) => o.point);
  }

  /**
   * Get all rectangle objects (have width/height, not ellipse/polygon/polyline)
   */
  getRectangles(): ParsedObject[] {
    return this.objects.filter(
      (o) => !o.point && !o.ellipse && !o.polygon && !o.polyline && o.width > 0 && o.height > 0,
    );
  }

  /**
   * Get all ellipse objects
   */
  getEllipses(): ParsedObject[] {
    return this.objects.filter((o) => o.ellipse);
  }

  /**
   * Get all polygon objects
   */
  getPolygons(): ParsedObject[] {
    return this.objects.filter((o) => o.polygon);
  }

  /**
   * Get all polyline objects
   */
  getPolylines(): ParsedObject[] {
    return this.objects.filter((o) => o.polyline);
  }

  /**
   * Create debug graphics for visualizing objects.
   * Useful during development.
   */
  createDebugGraphics(options?: { color?: number; alpha?: number }): Container {
    const { color = 0x00ff00, alpha = 0.5 } = options ?? {};

    const container = new Container();
    container.alpha = this.opacity;
    container.visible = this.visible;

    // Apply offset
    if (this._layer.offsetx) container.x = this._layer.offsetx;
    if (this._layer.offsety) container.y = this._layer.offsety;

    for (const obj of this.objects) {
      if (!obj.visible) continue;

      const g = new Graphics();

      if (obj.point) {
        // Draw point as a small circle
        g.circle(obj.x, obj.y, 4);
        g.fill({ color, alpha });
      } else if (obj.ellipse) {
        // Draw ellipse
        g.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, obj.height / 2);
        g.stroke({ color, alpha, width: 2 });
      } else if (obj.polygon) {
        // Draw polygon
        const points = obj.polygon.flatMap((p) => [obj.x + p.x, obj.y + p.y]);
        g.poly(points, true);
        g.stroke({ color, alpha, width: 2 });
      } else if (obj.polyline) {
        // Draw polyline
        g.moveTo(obj.x + obj.polyline[0].x, obj.y + obj.polyline[0].y);
        for (let i = 1; i < obj.polyline.length; i++) {
          g.lineTo(obj.x + obj.polyline[i].x, obj.y + obj.polyline[i].y);
        }
        g.stroke({ color, alpha, width: 2 });
      } else if (obj.width > 0 && obj.height > 0) {
        // Draw rectangle
        g.rect(obj.x, obj.y, obj.width, obj.height);
        g.stroke({ color, alpha, width: 2 });
      }

      // Handle rotation
      if (obj.rotation !== 0) {
        g.pivot.set(obj.x, obj.y);
        g.position.set(obj.x, obj.y);
        g.rotation = (obj.rotation * Math.PI) / 180;
      }

      container.addChild(g);
    }

    this.debugContainer = container;
    return container;
  }
}
