import type Aseprite from '../lib/ase-parser.ts';
import type { AsepriteTypes } from '../lib/ase-parser.ts';
import type { ExtractedSprite } from '../types.ts';

interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AtlasConfig {
  [key: string]: AtlasFrame;
}

/**
 * Blend a source pixel onto a destination pixel with alpha blending
 */
function blendPixel(
  compositeData: Uint8Array,
  dstIdx: number,
  srcR: number,
  srcG: number,
  srcB: number,
  srcA: number,
): void {
  if (srcA === 0) return; // Skip fully transparent pixels

  const dstA = compositeData[dstIdx + 3];

  if (srcA === 255 || dstA === 0) {
    // Source is opaque or destination is transparent - direct copy
    compositeData[dstIdx] = srcR;
    compositeData[dstIdx + 1] = srcG;
    compositeData[dstIdx + 2] = srcB;
    compositeData[dstIdx + 3] = srcA;
  } else {
    // Alpha blending
    const srcAlpha = srcA / 255;
    const dstAlpha = dstA / 255;
    const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

    if (outAlpha > 0) {
      compositeData[dstIdx] = Math.round(
        (srcR * srcAlpha + compositeData[dstIdx] * dstAlpha * (1 - srcAlpha)) / outAlpha,
      );
      compositeData[dstIdx + 1] = Math.round(
        (srcG * srcAlpha + compositeData[dstIdx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha,
      );
      compositeData[dstIdx + 2] = Math.round(
        (srcB * srcAlpha + compositeData[dstIdx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha,
      );
      compositeData[dstIdx + 3] = Math.round(outAlpha * 255);
    }
  }
}

/**
 * Render a tilemap cel onto the composite buffer
 */
function renderTilemapCel(
  cel: AsepriteTypes.Cel,
  tileset: AsepriteTypes.Tileset,
  compositeData: Uint8Array,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (!cel.tilemapMetadata || !tileset.rawTilesetData) return;

  const { bitsPerTile, bitmaskForTileId, bitmaskForXFlip, bitmaskForYFlip, bitmaskFor90CWRotation } =
    cel.tilemapMetadata;
  const bytesPerTile = bitsPerTile / 8;
  const tileWidth = tileset.tileWidth;
  const tileHeight = tileset.tileHeight;
  const tilesetData = tileset.rawTilesetData;

  // cel.w and cel.h are in tiles, not pixels for tilemaps
  const tilemapWidth = cel.w;
  const tilemapHeight = cel.h;

  const celData = cel.rawCelData instanceof Uint8Array ? cel.rawCelData : new Uint8Array(cel.rawCelData);

  for (let tileY = 0; tileY < tilemapHeight; tileY++) {
    for (let tileX = 0; tileX < tilemapWidth; tileX++) {
      const tileIndex = tileY * tilemapWidth + tileX;
      const tileDataOffset = tileIndex * bytesPerTile;

      // Read tile value (handle different byte sizes)
      let tileValue = 0;
      for (let b = 0; b < bytesPerTile; b++) {
        tileValue |= celData[tileDataOffset + b] << (b * 8);
      }

      // Extract tile ID and flags using bitmasks
      const tileId = tileValue & bitmaskForTileId;
      const xFlip = (tileValue & bitmaskForXFlip) !== 0;
      const yFlip = (tileValue & bitmaskForYFlip) !== 0;
      const rotate90 = (tileValue & bitmaskFor90CWRotation) !== 0;

      // Get tile pixel data from tileset (tile IDs are 0-indexed)
      const tilePixelOffset = tileId * tileWidth * tileHeight * 4;

      // Calculate destination position in pixels
      const destBaseX = cel.xpos + tileX * tileWidth;
      const destBaseY = cel.ypos + tileY * tileHeight;

      // Render tile pixels
      for (let py = 0; py < tileHeight; py++) {
        for (let px = 0; px < tileWidth; px++) {
          // Apply transformations to source coordinates
          let srcPx = px;
          let srcPy = py;

          if (rotate90) {
            // 90° clockwise rotation: (x, y) -> (tileHeight - 1 - y, x)
            const temp = srcPx;
            srcPx = tileHeight - 1 - srcPy;
            srcPy = temp;
          }

          if (xFlip) srcPx = tileWidth - 1 - srcPx;
          if (yFlip) srcPy = tileHeight - 1 - srcPy;

          const srcIdx = tilePixelOffset + (srcPy * tileWidth + srcPx) * 4;
          const destX = destBaseX + px;
          const destY = destBaseY + py;

          // Skip if outside canvas bounds
          if (destX < 0 || destX >= canvasWidth || destY < 0 || destY >= canvasHeight) continue;

          const dstIdx = (destY * canvasWidth + destX) * 4;

          const srcR = tilesetData[srcIdx];
          const srcG = tilesetData[srcIdx + 1];
          const srcB = tilesetData[srcIdx + 2];
          const srcA = tilesetData[srcIdx + 3];

          blendPixel(compositeData, dstIdx, srcR, srcG, srcB, srcA);
        }
      }
    }
  }
}

/**
 * Create a composite sprite by flattening all visible layers for a frame
 */
function createCompositeSprite(
  asepriteFile: Aseprite,
  frameIndex: number,
  baseName: string,
  spritesheetSize: number,
): ExtractedSprite | null {
  const frame = asepriteFile.frames[frameIndex];
  if (!frame) return null;

  const width = asepriteFile.width;
  const height = asepriteFile.height;

  // Create a buffer for the composite image (RGBA)
  const compositeData = new Uint8Array(width * height * 4);

  // Sort cels by layer index (bottom to top)
  const cels = [...frame.cels].sort((a, b) => a.layerIndex - b.layerIndex);

  // Composite each cel onto the buffer
  for (const cel of cels) {
    const layer = asepriteFile.layers[cel.layerIndex];
    if (!layer) continue;

    // Skip invisible layers, slice layers, and layers starting with _ or "Layer"
    if (layer.name.startsWith('_') || layer.name.startsWith('Layer') || layer.name.endsWith('-slices')) {
      continue;
    }

    // Skip if layer is not visible (check flags)
    if (layer.flags && !layer.flags.visible) continue;

    if (!cel.rawCelData || cel.rawCelData.length === 0 || cel.w === 0 || cel.h === 0) {
      continue;
    }

    // Handle tilemap layers
    if (cel.tilemapMetadata && layer.tilesetIndex !== undefined) {
      const tileset = asepriteFile.tilesets[layer.tilesetIndex];
      if (tileset && tileset.rawTilesetData) {
        renderTilemapCel(cel, tileset, compositeData, width, height);
      }
      continue;
    }

    // Handle regular image layers
    const celData = cel.rawCelData instanceof Uint8Array ? cel.rawCelData : new Uint8Array(cel.rawCelData);

    // Composite the cel onto the buffer with alpha blending
    for (let y = 0; y < cel.h; y++) {
      for (let x = 0; x < cel.w; x++) {
        const destX = cel.xpos + x;
        const destY = cel.ypos + y;

        // Skip if outside bounds
        if (destX < 0 || destX >= width || destY < 0 || destY >= height) continue;

        const srcIdx = (y * cel.w + x) * 4;
        const dstIdx = (destY * width + destX) * 4;

        const srcR = celData[srcIdx];
        const srcG = celData[srcIdx + 1];
        const srcB = celData[srcIdx + 2];
        const srcA = celData[srcIdx + 3];

        blendPixel(compositeData, dstIdx, srcR, srcG, srcB, srcA);
      }
    }
  }

  console.log(`  Created composite sprite "${baseName}_spritesheet" (${width}x${height}) with ss=${spritesheetSize}`);

  return {
    index: -1, // Special index for composite
    name: `${baseName}_spritesheet`,
    path: '',
    width,
    height,
    x: 0,
    y: 0,
    data: compositeData,
    frameIndex,
    spritesheetSize,
  };
}

/**
 * Extract sprites from an Aseprite file's frames
 */
export async function extractSprites(
  asepriteFile: Aseprite,
  options?: { spritesheetSize?: number; baseName?: string },
): Promise<{ sprites: ExtractedSprite[]; atlasConfig: AtlasConfig }> {
  if (asepriteFile.frames.length === 0) {
    console.warn('No frames found in the Aseprite file');
    return {
      sprites: [],
      atlasConfig: {},
    };
  }

  console.log(`Extracting sprites from all frames...`);
  const extractedSprites: ExtractedSprite[] = [];
  const layerFrames = new Map<number, ExtractedSprite[]>();

  // First, extract all frames for each layer
  for (let frameIndex = 0; frameIndex < asepriteFile.frames.length; frameIndex++) {
    const frame = asepriteFile.frames[frameIndex];
    const cels = frame.cels.map((cel) => cel).sort((a, b) => a.layerIndex - b.layerIndex);

    for (const cel of cels) {
      const sprite = await extractSprite(cel, asepriteFile);
      if (sprite) {
        // Store the frame index in the sprite
        sprite.frameIndex = frameIndex;

        // Group sprites by layer
        if (!layerFrames.has(cel.layerIndex)) {
          layerFrames.set(cel.layerIndex, []);
        }
        layerFrames.get(cel.layerIndex)!.push(sprite);
      }
    }
  }

  // Now process each layer's frames
  for (const [layerIndex, frames] of layerFrames.entries()) {
    const layer = asepriteFile.layers[layerIndex];
    if (!layer) continue;

    // Skip if layer name starts with _ or is "Layer"
    if (layer.name.startsWith('_') || layer.name.startsWith('Layer')) continue;

    // For slice layers, just use the first frame
    if (layer.name.endsWith('-slices')) {
      if (frames.length > 0) {
        extractedSprites.push(frames[0]);
      }
      continue;
    }

    // For content layers, include all frames
    extractedSprites.push(...frames);
  }

  // Create a map of slice layers for easier lookup
  const sliceLayers = new Map<string, ExtractedSprite>();

  // Find all slice layers and map them to their corresponding content layer
  extractedSprites.forEach((sprite) => {
    if (sprite.name.endsWith('-slices')) {
      const contentLayerName = sprite.name.replace('-slices', '');
      sliceLayers.set(contentLayerName, sprite);
    }
  });

  const atlasConfig: AtlasConfig = {};

  // Process each sprite, generating frames if it has a corresponding slice layer
  for (const sprite of extractedSprites) {
    // Skip slice layers themselves - they're just for defining the slices
    if (sprite.name.endsWith('-slices')) continue;

    // Find matching slice layer for this content layer
    const sliceSprite = sliceLayers.get(sprite.name);

    // Link slice layer if found
    if (sliceSprite) {
      // Just store a reference to the entire slice sprite
      sprite.sliceSprite = sliceSprite;
      console.log(
        `  Found slice layer "${sprite.name}-slices" for "${sprite.name}" at position (${sliceSprite.x}, ${sliceSprite.y}) with dimensions ${sliceSprite.width}x${sliceSprite.height}`,
      );
    }

    // Generate frame name with animation frame index if applicable
    const frameName = sprite.frameIndex !== undefined ? `${sprite.name}#${sprite.frameIndex}` : sprite.name;

    // Add frame to atlas config
    if (frameName) {
      atlasConfig[frameName] = {
        x: sprite.x,
        y: sprite.y,
        w: sprite.width,
        h: sprite.height,
      };
    }
  }

  // Extract tiles from tilesets
  if (asepriteFile.tilesets && asepriteFile.tilesets.length > 0) {
    console.log(`Found ${asepriteFile.tilesets.length} tileset(s), extracting tiles...`);

    for (const tileset of asepriteFile.tilesets) {
      if (!tileset.rawTilesetData || tileset.tileCount === 0) {
        console.log(`  Skipping tileset "${tileset.name}" (no tile data)`);
        continue;
      }

      console.log(
        `  Extracting ${tileset.tileCount} tiles from tileset "${tileset.name}" (${tileset.tileWidth}x${tileset.tileHeight})`,
      );

      // Extract each tile from the tileset
      for (let tileIndex = 0; tileIndex < tileset.tileCount; tileIndex++) {
        const tileData = extractTileFromTileset(tileset, tileIndex);

        if (tileData) {
          const tileName = `${tileset.name}_tile_${tileIndex}`;
          const tileSprite: ExtractedSprite = {
            index: extractedSprites.length,
            name: tileName,
            path: '',
            width: tileset.tileWidth,
            height: tileset.tileHeight,
            x: 0,
            y: 0,
            data: tileData,
          };

          extractedSprites.push(tileSprite);

          // Add to atlas config
          atlasConfig[tileName] = {
            x: 0,
            y: 0,
            w: tileset.tileWidth,
            h: tileset.tileHeight,
          };
        }
      }
    }
  }

  // Create composite sprites for spritesheet if ss option is provided
  if (options?.spritesheetSize && options?.baseName) {
    console.log(`Creating composite sprites for spritesheet (ss=${options.spritesheetSize})...`);

    for (let frameIndex = 0; frameIndex < asepriteFile.frames.length; frameIndex++) {
      const compositeSprite = createCompositeSprite(
        asepriteFile,
        frameIndex,
        options.baseName,
        options.spritesheetSize,
      );

      if (compositeSprite) {
        extractedSprites.push(compositeSprite);

        // Add to atlas config
        const frameName = `${compositeSprite.name}#${frameIndex}`;
        atlasConfig[frameName] = {
          x: 0,
          y: 0,
          w: compositeSprite.width,
          h: compositeSprite.height,
        };
      }
    }
  }

  console.log(`Generated atlas with ${Object.keys(atlasConfig).length} frames`);

  return { sprites: extractedSprites, atlasConfig };
}

/**
 * Extract a single tile from a tileset's raw data
 */
function extractTileFromTileset(tileset: AsepriteTypes.Tileset, tileIndex: number): Uint8Array | null {
  if (!tileset.rawTilesetData || tileIndex >= tileset.tileCount) {
    return null;
  }

  const tileWidth = tileset.tileWidth;
  const tileHeight = tileset.tileHeight;
  const bytesPerPixel = 4; // RGBA
  const tileSize = tileWidth * tileHeight * bytesPerPixel;

  // Calculate the offset for this tile in the raw tileset data
  const offset = tileIndex * tileSize;

  // Extract the tile data
  const tileData = new Uint8Array(tileSize);
  for (let i = 0; i < tileSize; i++) {
    tileData[i] = tileset.rawTilesetData[offset + i];
  }

  return tileData;
}

async function extractSprite(cel: AsepriteTypes.Cel, asepriteFile: Aseprite): Promise<ExtractedSprite | null> {
  const layer = asepriteFile.layers[cel.layerIndex];
  if (!layer) {
    console.log(`  Skipping cel with invalid layer index ${cel.layerIndex}`);
    return null;
  }

  const spriteName = layer.name || `sprite_${cel.layerIndex}`;

  if (!cel.rawCelData || cel.rawCelData.length === 0 || cel.w === 0 || cel.h === 0) {
    console.log(`  Skipping sprite "${spriteName}" (no data)`);
    return null;
  }

  console.log(`  Extracting sprite "${spriteName}" (${cel.w}x${cel.h})`);

  // Ensure the data is a Uint8Array (convert Buffer if needed)
  let data: Uint8Array;

  if (cel.rawCelData instanceof Uint8Array) {
    data = cel.rawCelData;
  } else if (Buffer.isBuffer(cel.rawCelData)) {
    data = new Uint8Array(cel.rawCelData);
  } else if (Array.isArray(cel.rawCelData)) {
    // Handle array data
    data = new Uint8Array(cel.rawCelData);
  } else {
    console.error(`Unknown data format for "${spriteName}":`, typeof cel.rawCelData);
    throw new Error(`Unsupported data format for layer: ${spriteName}`);
  }

  // Validate that the data size matches the expected dimensions
  const expectedSize = cel.w * cel.h * 4; // RGBA = 4 bytes per pixel
  if (data.length !== expectedSize) {
    console.warn(`Data size mismatch for "${spriteName}": expected ${expectedSize} bytes, got ${data.length} bytes`);

    // If the data is too small, pad it (this shouldn't happen but just in case)
    if (data.length < expectedSize) {
      const paddedData = new Uint8Array(expectedSize);
      paddedData.set(data);
      data = paddedData;
    } else if (data.length > expectedSize) {
      // If the data is too large, truncate it (this also shouldn't happen)
      data = data.slice(0, expectedSize);
    }
  }

  return {
    index: cel.layerIndex,
    name: spriteName,
    path: '',
    width: cel.w,
    height: cel.h,
    x: cel.xpos,
    y: cel.ypos,
    data: data,
  };
}
