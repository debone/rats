import * as path from 'path';
import sharp from 'sharp';

import type { AtlasFrame, AtlasMetadata, ExtractedSprite, SpritesheetData, SpritesheetFrameData } from '../types.ts';
import { generateFrames } from './slices.ts';

interface TrimInfo {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  sprite: ExtractedSprite;
}

interface Space {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BLEED_MARGIN = 1; // 1px bleed margin

export class Atlas {
  private atlasWidth: number = 0;
  private atlasHeight: number = 0;

  private sprites: ExtractedSprite[] = [];
  private trimInfo: Map<string, TrimInfo> = new Map();
  private packedSprites: Map<string, Box[]> = new Map();

  /**
   * Add sprites to the atlas
   */
  addSprites(sprites: ExtractedSprite[]): void {
    // Only add content layers (not slice layers) and filter out ignored layers
    for (const sprite of sprites) {
      // Skip slice layers
      if (sprite.name.endsWith('-slices')) continue;

      // Skip layers starting with _ or named "Layer"
      if (sprite.name.startsWith('_') || sprite.name.startsWith('Layer')) continue;

      this.sprites.push(sprite);
    }
  }

  /**
   * Pack sprites into a texture atlas using a simple rectangle packing algorithm
   */
  private packSprites(sprites: ExtractedSprite[]): Box[] {
    // Group sprites by base name (without frame number)
    const spriteGroups = new Map<string, ExtractedSprite[]>();
    for (const sprite of sprites) {
      const baseName = sprite.name.split('#')[0];
      if (!spriteGroups.has(baseName)) {
        spriteGroups.set(baseName, []);
      }
      spriteGroups.get(baseName)!.push(sprite);
    }

    // Convert sprites to boxes with their ACTUAL TRIMMED dimensions
    const boxes: Box[] = [];
    for (const [_baseName, groupSprites] of spriteGroups) {
      for (const sprite of groupSprites) {
        const trimInfo = this.trimInfo.get(sprite.name);
        if (!trimInfo) continue;

        // Use individual trimmed dimensions for each sprite
        boxes.push({
          x: 0,
          y: 0,
          w: trimInfo.width + BLEED_MARGIN * 2,
          h: trimInfo.height + BLEED_MARGIN * 2,
          sprite,
        });
      }
    }

    // Calculate total area and maximum width
    let area = 0;
    let maxWidth = 0;
    for (const box of boxes) {
      area += box.w * box.h;
      maxWidth = Math.max(maxWidth, box.w);
    }

    // Sort boxes by height, descending
    boxes.sort((a, b) => b.h - a.h);

    // Calculate initial width for a roughly square packing
    const startWidth = Math.max(Math.ceil(Math.sqrt(area / 0.95)), maxWidth);

    // Initialize spaces with a single space
    const spaces: Space[] = [{ x: 0, y: 0, w: startWidth, h: Infinity }];
    const packed: Box[] = [];

    // Pack each box
    for (const box of boxes) {
      // Look through spaces backwards
      for (let i = spaces.length - 1; i >= 0; i--) {
        const space = spaces[i];

        // Check if box fits in this space
        if (box.w > space.w || box.h > space.h) continue;

        // Place box in this space
        box.x = space.x;
        box.y = space.y;
        packed.push(box);

        // Update or split the space
        if (box.w === space.w && box.h === space.h) {
          // Space matches exactly - remove it
          const last = spaces.pop();
          if (i < spaces.length) spaces[i] = last!;
        } else if (box.h === space.h) {
          // Space matches height - update width
          space.x += box.w;
          space.w -= box.w;
        } else if (box.w === space.w) {
          // Space matches width - update height
          space.y += box.h;
          space.h -= box.h;
        } else {
          // Split space into two
          spaces.push({
            x: space.x + box.w,
            y: space.y,
            w: space.w - box.w,
            h: box.h,
          });
          space.y += box.h;
          space.h -= box.h;
        }
        break;
      }
    }

    return packed;
  }

  /**
   * Get pixel color from sprite data with bounds checking
   */
  private getPixel(sprite: ExtractedSprite, x: number, y: number): [number, number, number, number] {
    // Clamp coordinates to sprite bounds
    x = Math.max(0, Math.min(x, sprite.width - 1));
    y = Math.max(0, Math.min(y, sprite.height - 1));

    const index = (y * sprite.width + x) * 4;
    return [sprite.data[index], sprite.data[index + 1], sprite.data[index + 2], sprite.data[index + 3]];
  }

  /**
   * Save each layer as a separate image file, cropped to content
   */
  async buffer(): Promise<Buffer> {
    if (this.sprites.length === 0) {
      throw new Error('No sprites to process');
    }

    // First pass: calculate trim info for each sprite
    for (const sprite of this.sprites) {
      // Find the content bounds by scanning for non-transparent pixels
      let left = sprite.width;
      let top = sprite.height;
      let right = 0;
      let bottom = 0;

      for (let y = 0; y < sprite.height; y++) {
        for (let x = 0; x < sprite.width; x++) {
          const index = (y * sprite.width + x) * 4;
          // Check if pixel is not transparent
          if (sprite.data[index + 3] !== 0) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }

      // Handle case where there's no visible content
      if (left > right || top > bottom) {
        console.log(`  No visible content in layer "${sprite.name}", skipping`);
        continue;
      }

      const width = right - left + 1;
      const height = bottom - top + 1;

      // Store the trim information
      this.trimInfo.set(sprite.name, {
        left,
        top,
        width,
        height,
      });
    }

    // Pack the sprites
    const packedBoxes = this.packSprites(this.sprites);

    // Find atlas dimensions
    this.atlasWidth = 0;
    this.atlasHeight = 0;
    for (const box of packedBoxes) {
      this.atlasWidth = Math.max(this.atlasWidth, box.x + box.w);
      this.atlasHeight = Math.max(this.atlasHeight, box.y + box.h);
    }

    // Create atlas buffer
    const atlasBuffer = Buffer.alloc(this.atlasWidth * this.atlasHeight * 4);

    // Copy each sprite to its position in the atlas
    for (const box of packedBoxes) {
      const sprite = box.sprite;
      const trimInfo = this.trimInfo.get(sprite.name);
      if (!trimInfo) continue;

      // Copy sprite data to atlas with bleed margin
      for (let y = -BLEED_MARGIN; y < trimInfo.height + BLEED_MARGIN; y++) {
        for (let x = -BLEED_MARGIN; x < trimInfo.width + BLEED_MARGIN; x++) {
          // Get source pixel coordinates (with bleed)
          const srcX = x + trimInfo.left;
          const srcY = y + trimInfo.top;

          // Get the pixel color (will be clamped to edges)
          const [r, g, b, a] = this.getPixel(sprite, srcX, srcY);

          // Calculate target position in atlas (including bleed margin)
          const targetX = box.x + x + BLEED_MARGIN;
          const targetY = box.y + y + BLEED_MARGIN;
          const targetIndex = (targetY * this.atlasWidth + targetX) * 4;

          // Copy pixel to atlas
          atlasBuffer[targetIndex] = r;
          atlasBuffer[targetIndex + 1] = g;
          atlasBuffer[targetIndex + 2] = b;
          atlasBuffer[targetIndex + 3] = a;
        }
      }

      // Store the packed position for metadata generation
      const baseName = sprite.name.split('#')[0];
      if (!this.packedSprites.has(baseName)) {
        this.packedSprites.set(baseName, []);
      }
      this.packedSprites.get(baseName)!.push(box);
    }

    return sharp(atlasBuffer, {
      raw: {
        width: this.atlasWidth,
        height: this.atlasHeight,
        channels: 4,
      },
    })
      .png()
      .toBuffer();
  }

  metadata(imageName: string): SpritesheetData {
    const frames: { [key: string]: SpritesheetFrameData } = {};
    const animations: { [key: string]: string[] } = {};

    // Generate frames for each sprite group
    for (const [spriteName, boxes] of this.packedSprites) {
      const frameNames: string[] = [];

      // Check if we have slices
      const sliceSprite = boxes[0].sprite.sliceSprite;

      boxes.forEach((box, frameIndex) => {
        const trimInfo = this.trimInfo.get(box.sprite.name);
        if (!trimInfo) return;

        const frameName = `${spriteName}#${frameIndex}`;
        frameNames.push(frameName);

        const frameData: SpritesheetFrameData = {
          frame: {
            x: box.x + BLEED_MARGIN,
            y: box.y + BLEED_MARGIN,
            w: trimInfo.width,
            h: trimInfo.height,
          },
          rotated: false,
          trimmed: true,
          spriteSourceSize: {
            x: trimInfo.left,
            y: trimInfo.top,
            w: trimInfo.width,
            h: trimInfo.height,
          },
          sourceSize: {
            w: box.sprite.width,
            h: box.sprite.height,
          },
        };

        // If we have slices, add borders and individual slice frames
        if (sliceSprite) {
          const sliceFrames = generateFrames(box.sprite);

          // For 9-slice, we expect a 3x3 grid of slices
          // Extract unique X and Y positions to determine borders
          const xPositions = [...new Set(sliceFrames.map((s) => s.x))].sort((a, b) => a - b);
          const yPositions = [...new Set(sliceFrames.map((s) => s.y))].sort((a, b) => a - b);

          // Calculate borders relative to the trimmed frame
          if (xPositions.length >= 2 && yPositions.length >= 2) {
            frameData.borders = {
              left: xPositions[1] - trimInfo.left,
              top: yPositions[1] - trimInfo.top,
              right: trimInfo.width - (xPositions[xPositions.length - 1] - trimInfo.left),
              bottom: trimInfo.height - (yPositions[yPositions.length - 1] - trimInfo.top),
            };
          }

          // Also create individual frames for each slice region
          sliceFrames.forEach((slice, sliceIndex) => {
            const sliceFrameName = `${spriteName}#${frameIndex}.${sliceIndex}`;

            // Adjust slice coordinates relative to the packed position, accounting for bleed margin
            const adjustedX = box.x + BLEED_MARGIN + (slice.x - trimInfo.left);
            const adjustedY = box.y + BLEED_MARGIN + (slice.y - trimInfo.top);

            frames[sliceFrameName] = {
              frame: {
                x: adjustedX,
                y: adjustedY,
                w: slice.w,
                h: slice.h,
              },
              rotated: false,
              trimmed: false,
              spriteSourceSize: {
                x: 0,
                y: 0,
                w: slice.w,
                h: slice.h,
              },
              sourceSize: {
                w: slice.w,
                h: slice.h,
              },
            };
          });
        }

        frames[frameName] = frameData;
      });

      // Add animation only if there's more than one frame
      if (frameNames.length > 1) {
        animations[spriteName] = frameNames;
      }
    }

    return {
      frames,
      animations,
      meta: {
        app: 'Aseprite Packer',
        version: '1.0',
        image: imageName,
        format: 'RGBA8888',
        scale: 1,
        size: {
          w: this.atlasWidth,
          h: this.atlasHeight,
        },
        related_multi_packs: [],
      },
    };
  }
}
