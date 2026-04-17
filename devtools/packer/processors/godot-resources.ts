import * as fs from 'fs';
import * as path from 'path';

import type { SpritesheetData } from '../types.ts';

const GODOT_DIR = path.resolve('./godot');

export interface GodotSpriteEntry {
  godotPath: string;
  type: 'AtlasTexture' | 'SpriteFrames';
  pixiFrame?: string; // single-frame sprites
  pixiAnimation?: string; // animated sprites
  frames?: string[]; // pixi frame names in order
}

export type GodotSpriteMap = Record<string, GodotSpriteEntry>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate Godot .tres resources from atlas data and write them into the Godot project.
 *
 * Called directly from the packer pipe -- receives the Atlas object's metadata and the
 * full-resolution PNG buffer, so no round-trip through disk is needed.
 *
 * baseName is the atlas identifier, e.g. "prototype", "entities/rats", "tiles".
 * Sprites are organized into a subfolder per atlas:
 *   godot/atlases/<baseName>.png
 *   godot/sprites/<baseName>/spriteName.tres
 *   godot/sprite-map.json  (merged across all atlases)
 */
export function generateGodotResources(
  metadata: SpritesheetData,
  atlasBuffer: Buffer,
  baseName: string,
): void {
  const pngFileName = `${path.basename(baseName)}.png`;
  const atlasDirInGodot = path.join(path.dirname(baseName)); // preserves subdir, e.g. "entities"
  const godotAtlasRelPath =
    atlasDirInGodot === '.'
      ? `atlases/${pngFileName}`
      : `atlases/${atlasDirInGodot}/${pngFileName}`;
  const godotAtlasResPath = `res://${godotAtlasRelPath}`;

  // Copy atlas PNG into godot/atlases/ (mirroring baseName directory structure)
  const atlasDestDir = path.join(GODOT_DIR, 'atlases', atlasDirInGodot === '.' ? '' : atlasDirInGodot);
  fs.mkdirSync(atlasDestDir, { recursive: true });
  fs.writeFileSync(path.join(atlasDestDir, pngFileName), atlasBuffer);

  // Sprites go into godot/sprites/<baseName>/ -- one subfolder per atlas
  const spritesDir = path.join(GODOT_DIR, 'sprites', baseName);
  fs.mkdirSync(spritesDir, { recursive: true });

  const godotSpritesBase = `res://sprites/${baseName}`;
  const spriteMap = writeGodotSprites(metadata, godotAtlasResPath, spritesDir, godotSpritesBase);

  mergeIntoSpriteMap(spriteMap);

  console.log(
    `[Godot] Generated ${Object.keys(spriteMap).length} resource(s) for "${baseName}" → godot/sprites/${baseName}/`,
  );
}

/**
 * Post-build step for atlases produced by the {tps} pixiPipe (texture packer).
 * Those atlases don't go through the packer() pipe, so we read the generated
 * JSON files from public/assets/ and produce Godot resources from them.
 *
 * Call this from generateTypeDefinitions() after the asset build completes.
 */
export function generateGodotResourcesFromManifest(
  manifestPath: string,
  publicAssetsDir: string,
): void {
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  for (const bundle of manifest.bundles ?? []) {
    for (const asset of bundle.assets ?? []) {
      const alias: string = Array.isArray(asset.alias) ? asset.alias[0] : asset.alias;
      const srcs: string[] = Array.isArray(asset.src) ? asset.src : [asset.src];

      // Only process spritesheet atlases: full-res .png.json, no @Nx suffix
      const jsonSrc = srcs.find(
        (s: string) => s.endsWith('.png.json') && !s.includes('@'),
      );
      if (!jsonSrc) continue;

      const jsonPath = path.join(publicAssetsDir, jsonSrc);
      if (!fs.existsSync(jsonPath)) continue;

      const metadata: SpritesheetData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      // Skip atlases already handled by the packer pipe (they have #N frame names)
      const firstFrame = Object.keys(metadata.frames)[0] ?? '';
      if (firstFrame.includes('#')) continue;

      // Derive a clean baseName from the manifest alias
      // e.g. "tiles" → "tiles", "ui/buttons" → "ui/buttons"
      const baseName = alias.replace(/\.(aseprite|png|jpg)$/i, '');

      // Read the actual PNG buffer
      const pngFile = metadata.meta.image;
      if (!pngFile) continue;
      const pngPath = path.join(publicAssetsDir, pngFile);
      if (!fs.existsSync(pngPath)) continue;
      const atlasBuffer = fs.readFileSync(pngPath);

      generateGodotResources(metadata, atlasBuffer, baseName);
    }
  }
}

/**
 * Copy source WAV files from assets/sounds/ into godot/sounds/.
 * Godot auto-imports WAV files -- no .tres wrapper needed.
 * The original filenames (without hashes) are preserved.
 */
export function copyGodotSounds(soundsSourceDir: string): void {
  if (!fs.existsSync(soundsSourceDir)) return;

  const godotSoundsDir = path.join(GODOT_DIR, 'sounds');
  fs.mkdirSync(godotSoundsDir, { recursive: true });

  const wavFiles = fs.readdirSync(soundsSourceDir).filter((f) => f.endsWith('.wav'));
  let copied = 0;

  for (const wav of wavFiles) {
    const src = path.join(soundsSourceDir, wav);
    const dest = path.join(godotSoundsDir, wav);
    // Only copy if source is newer (avoid unnecessary churn in Godot's importer)
    const srcMtime = fs.statSync(src).mtimeMs;
    const destMtime = fs.existsSync(dest) ? fs.statSync(dest).mtimeMs : 0;
    if (srcMtime > destMtime) {
      fs.copyFileSync(src, dest);
      copied++;
    }
  }

  if (copied > 0) {
    console.log(`[Godot] Copied ${copied} sound file(s) → godot/sounds/`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Write .tres files for all sprites/animations in a metadata object.
 * Handles both Aseprite-style frame names (name#index) and TPS-style (plain names).
 */
function writeGodotSprites(
  metadata: SpritesheetData,
  godotAtlasResPath: string,
  spritesDir: string,
  godotSpritesBase: string,
): GodotSpriteMap {
  const spriteMap: GodotSpriteMap = {};
  const animatedNames = new Set(
    Object.entries(metadata.animations ?? {})
      .filter(([, frames]) => frames.length > 1)
      .map(([name]) => name),
  );

  // Single-frame sprites
  for (const [frameName, frameData] of Object.entries(metadata.frames)) {
    const hashIdx = frameName.indexOf('#');
    const spriteName = hashIdx >= 0 ? frameName.slice(0, hashIdx) : frameName;
    const frameIdx = hashIdx >= 0 ? frameName.slice(hashIdx + 1) : '0';

    if (animatedNames.has(spriteName)) continue;
    if (frameIdx !== '0') continue;

    const { frame, spriteSourceSize, sourceSize } = frameData;
    const margin = computeMargin(frame, spriteSourceSize, sourceSize);
    const tresContent = generateAtlasTextureTres(godotAtlasResPath, frame, margin);
    fs.writeFileSync(path.join(spritesDir, `${spriteName}.tres`), tresContent);

    spriteMap[spriteName] = {
      godotPath: `${godotSpritesBase}/${spriteName}.tres`,
      type: 'AtlasTexture',
      pixiFrame: frameName,
    };
  }

  // Multi-frame animated sprites
  for (const [animName, frameNames] of Object.entries(metadata.animations ?? {})) {
    if (frameNames.length <= 1) continue;

    const frames = frameNames.map((fn) => {
      const frameData = metadata.frames[fn];
      const { frame, spriteSourceSize, sourceSize } = frameData;
      return { frame, margin: computeMargin(frame, spriteSourceSize, sourceSize) };
    });

    const tresContent = generateSpriteFramesTres(godotAtlasResPath, frames);
    fs.writeFileSync(path.join(spritesDir, `${animName}.tres`), tresContent);

    spriteMap[animName] = {
      godotPath: `${godotSpritesBase}/${animName}.tres`,
      type: 'SpriteFrames',
      pixiAnimation: animName,
      frames: frameNames,
    };
  }

  return spriteMap;
}

function mergeIntoSpriteMap(additions: GodotSpriteMap): void {
  const spriteMapPath = path.join(GODOT_DIR, 'sprite-map.json');
  const existing: GodotSpriteMap = fs.existsSync(spriteMapPath)
    ? JSON.parse(fs.readFileSync(spriteMapPath, 'utf-8'))
    : {};
  fs.writeFileSync(spriteMapPath, JSON.stringify({ ...existing, ...additions }, null, 2));
}

// ---------------------------------------------------------------------------
// Margin / trim helpers
// ---------------------------------------------------------------------------

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Margin {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function computeMargin(
  frame: Rect,
  spriteSourceSize?: { x: number; y: number; w?: number; h?: number },
  sourceSize?: { w: number; h: number },
): Margin {
  if (!spriteSourceSize || !sourceSize) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  return {
    left: spriteSourceSize.x,
    top: spriteSourceSize.y,
    right: sourceSize.w - spriteSourceSize.x - frame.w,
    bottom: sourceSize.h - spriteSourceSize.y - frame.h,
  };
}

// ---------------------------------------------------------------------------
// .tres generators
// ---------------------------------------------------------------------------

function generateAtlasTextureTres(atlasPath: string, frame: Rect, margin: Margin): string {
  const lines: string[] = [
    `[gd_resource type="AtlasTexture" load_steps=2 format=3]`,
    ``,
    `[ext_resource type="Texture2D" path="${atlasPath}" id="1"]`,
    ``,
    `[resource]`,
    `atlas = ExtResource("1")`,
    `region = Rect2(${frame.x}, ${frame.y}, ${frame.w}, ${frame.h})`,
  ];

  const { left, top, right, bottom } = margin;
  if (left !== 0 || top !== 0 || right !== 0 || bottom !== 0) {
    lines.push(`margin = Rect2(${left}, ${top}, ${right}, ${bottom})`);
  }

  lines.push(``);
  return lines.join('\n');
}

function generateSpriteFramesTres(
  atlasPath: string,
  frames: Array<{ frame: Rect; margin: Margin }>,
): string {
  const loadSteps = 1 + frames.length + 1;
  const lines: string[] = [
    `[gd_resource type="SpriteFrames" load_steps=${loadSteps} format=3]`,
    ``,
    `[ext_resource type="Texture2D" path="${atlasPath}" id="1"]`,
    ``,
  ];

  frames.forEach(({ frame, margin }, i) => {
    const id = `AtlasTexture_${i}`;
    lines.push(`[sub_resource type="AtlasTexture" id="${id}"]`);
    lines.push(`atlas = ExtResource("1")`);
    lines.push(`region = Rect2(${frame.x}, ${frame.y}, ${frame.w}, ${frame.h})`);

    const { left, top, right, bottom } = margin;
    if (left !== 0 || top !== 0 || right !== 0 || bottom !== 0) {
      lines.push(`margin = Rect2(${left}, ${top}, ${right}, ${bottom})`);
    }

    lines.push(``);
  });

  const frameEntries = frames
    .map((_, i) => `{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_${i}")\n}`)
    .join(', ');

  lines.push(`[resource]`);
  lines.push(`animations = [{`);
  lines.push(`"frames": [${frameEntries}],`);
  lines.push(`"loop": true,`);
  lines.push(`"name": &"default",`);
  lines.push(`"speed": 8.0`);
  lines.push(`}]`);
  lines.push(``);

  return lines.join('\n');
}
