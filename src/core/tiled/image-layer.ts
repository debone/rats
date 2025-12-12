import { Assets, Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { mapProperties, type PropertyMap } from './properties';
import type { TiledImageLayer } from './types';

export interface ImageLayerOptions {
  /** The Tiled layer data */
  layer: TiledImageLayer;
  /** Base path for resolving image paths */
  basePath: string;
}

/**
 * Runtime image layer from Tiled.
 * Displays a single image, optionally repeating.
 */
export class ImageLayer {
  readonly name: string;
  readonly id: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly properties: PropertyMap;

  /** The display container for this layer */
  readonly container: Container;

  /** The sprite displaying the image (or TilingSprite if repeating) */
  sprite?: Sprite | TilingSprite;

  private readonly _layer: TiledImageLayer;
  private readonly _basePath: string;

  constructor(options: ImageLayerOptions) {
    const { layer, basePath } = options;

    this.name = layer.name;
    this.id = layer.id;
    this.visible = layer.visible;
    this.opacity = layer.opacity;
    this.properties = mapProperties(layer.properties);

    this._layer = layer;
    this._basePath = basePath;

    this.container = new Container();
    this.container.visible = this.visible;
    this.container.alpha = this.opacity;

    // Apply offset
    if (layer.offsetx) this.container.x = layer.offsetx;
    if (layer.offsety) this.container.y = layer.offsety;

    // Load the image if specified
    if (layer.image) {
      this._loadImage(layer.image);
    }
  }

  private _loadImage(imagePath: string): void {
    // Resolve the path relative to the map
    const resolvedPath = this._resolvePath(imagePath);

    // Get the texture (must be pre-loaded)
    const texture = Assets.get<Texture>(resolvedPath);
    if (!texture) {
      console.warn(`Image layer texture not found: ${resolvedPath}`);
      return;
    }

    const repeatX = this._layer.repeatx ?? false;
    const repeatY = this._layer.repeaty ?? false;

    if (repeatX || repeatY) {
      // Use TilingSprite for repeating images
      const tilingSprite = new TilingSprite({
        texture,
        width: repeatX ? texture.width * 100 : texture.width, // Large enough to cover typical screens
        height: repeatY ? texture.height * 100 : texture.height,
      });

      // If only repeating in one direction, we might need to handle this differently
      // For now, just make it large enough
      this.sprite = tilingSprite;
    } else {
      // Regular sprite
      this.sprite = new Sprite(texture);
    }

    // Apply tint if specified
    if (this._layer.tintcolor) {
      const tintHex = this._layer.tintcolor.replace('#', '0x');
      this.sprite.tint = parseInt(tintHex, 16);
    }

    this.container.addChild(this.sprite);
  }

  private _resolvePath(relativePath: string): string {
    // Handle ../ in paths
    const parts = (this._basePath + relativePath).split('/');
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.' && part !== '') {
        resolved.push(part);
      }
    }

    return resolved.join('/');
  }

  /**
   * Set the size of the tiling sprite (for repeating layers).
   * Call this to match your viewport/world size.
   */
  setTilingSize(width: number, height: number): void {
    if (this.sprite instanceof TilingSprite) {
      this.sprite.width = width;
      this.sprite.height = height;
    }
  }

  /**
   * Get the original image path from the layer
   */
  get imagePath(): string | undefined {
    return this._layer.image;
  }
}
