export interface PackerOptions {
  input: string;
  output: string;
  name?: string;
  debug?: boolean;
}

export interface ExtractedSprite {
  index: number;
  name: string;
  path: string;
  width: number;
  height: number;
  x: number;
  y: number;
  data: Uint8Array;
  sliceSprite?: ExtractedSprite; // Reference to the slice layer sprite if it exists
  frameIndex?: number; // The frame index in the animation sequence
  spritesheetSize?: number; // Grid size for automatic spritesheet slicing (ss metadata)
}

// Modified for Phaser 3 MultiAtlas format
export interface AtlasFrame {
  filename: string; // Now in format "spriteName#frameIndex" or "spriteName#frameIndex.sliceIndex"
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  sourceSize: {
    w: number;
    h: number;
  };
}

// Single texture within a MultiAtlas
export interface AtlasTexture {
  image: string;
  format: string;
  size: {
    w: number;
    h: number;
  };
  scale: number;
  frames: AtlasFrame[];
}

// MultiAtlas compatible format
export interface AtlasMetadata {
  textures: AtlasTexture[];
  meta: {
    app: string;
    version: string;
    format: string;
  };
}

// New interfaces that were copied from pixi.js

export interface PointData {
  /** X coordinate */
  x: number;

  /** Y coordinate */
  y: number;
}

export type Dict<T> = { [key: string]: T };

/**
 * Stores the width of the non-scalable borders, for example when used with {@link NineSlicePlane} texture.
 * @category rendering
 * @advanced
 */
export interface TextureBorders {
  /** left border in pixels */
  left: number;
  /** top border in pixels */
  top: number;
  /** right border in pixels */
  right: number;
  /** bottom border in pixels */
  bottom: number;
}

/**
 * Represents the JSON data for a spritesheet atlas.
 * @category assets
 * @advanced
 */
export interface SpritesheetFrameData {
  /** The frame rectangle of the texture. */
  frame: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Whether the texture is trimmed. */
  trimmed?: boolean;
  /** Whether the texture is rotated. */
  rotated?: boolean;
  /** The source size of the texture. */
  sourceSize?: {
    w: number;
    h: number;
  };
  /** The sprite source size. */
  spriteSourceSize?: {
    h?: number;
    w?: number;
    x: number;
    y: number;
  };
  /** The anchor point of the texture. */
  anchor?: PointData;
  /** The 9-slice borders of the texture. */
  borders?: TextureBorders;
}

/**
 * Atlas format.
 * @category assets
 * @advanced
 */
export interface SpritesheetData {
  /** The frames of the atlas. */
  frames: Dict<SpritesheetFrameData>;
  /** The animations of the atlas. */
  animations?: Dict<string[]>;
  /** The meta data of the atlas. */
  meta: {
    app?: string;
    format?: string;
    frameTags?: {
      from: number;
      name: string;
      to: number;
      direction: string;
    }[];
    image?: string;
    layers?: {
      blendMode: string;
      name: string;
      opacity: number;
    }[];
    scale: number | string;
    size?: {
      h: number;
      w: number;
    };
    slices?: {
      color: string;
      name: string;
      keys: {
        frame: number;
        bounds: {
          x: number;
          y: number;
          w: number;
          h: number;
        };
      }[];
    }[];
    related_multi_packs?: string[];
    version?: string;
  };
}
