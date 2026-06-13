import * as fs from 'fs';
import * as path from 'path';

import type { SpritesheetData, TextureBorders } from '../types.ts';

const GODOT_DIR = path.resolve('./godot');

export interface GodotSpriteEntry {
  godotPath: string;
  type: 'AtlasTexture' | 'SpriteFrames' | 'Texture2D';
  pixiFrame?: string; // single-frame sprites
  pixiAnimation?: string; // animated sprites
  frames?: string[]; // pixi frame names in order
  /**
   * Present when this entry is a grid-layout spritesheet ({ss=N} source).
   * The AtlasTexture covers the full grid; the same image has per-tile
   * frames named `${framePrefix}_${index}#0` (row-major). Used by the
   * Box2D geometry exporter to resolve Godot TileMapLayer cells to Pixi
   * tile frames.
   */
  tilesheet?: TilesheetInfo;
  /**
   * Present when this entry's frame carries 9-slice borders (authored via the
   * aseprite slice layer). Threaded through so the Box2D geometry exporter can
   * emit explicit borders for Box2DNineSlice nodes — the runtime renders a
   * NineSliceSprite without having to rely on Pixi's texture.defaultBorders.
   */
  borders?: TextureBorders;
}

export interface TilesheetInfo {
  framePrefix: string; // e.g. "level-1_spritesheet"
  cols: number;
  rows: number;
  tileSize: number; // square tiles (Godot's TileSet expects Vector2i but we keep one number for the {ss=N} convention)
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

  // Standalone tileable textures: copy plain (non-atlas) images under the
  // `textures/` alias prefix into godot/textures/ and index them so a
  // Box2DPolygon can reference them as Texture2D for its tiled fill / rope
  // border. These need GPU texture-repeat, which only works on a texture that
  // owns its whole source image — hence standalone, not packed into an atlas.
  writeGodotStandaloneTextures(manifest, publicAssetsDir);

  // Tilesheet metadata pass: walk every manifest (including those the packer
  // pipe already processed and we skipped above) and attach tilesheet info to
  // matching sprite-map entries. The .tres files are already there; we're
  // just enriching the index so the Box2D geometry exporter can translate
  // Godot TileMapLayer cells into Pixi tile-frame names.
  attachTilesheetsFromAllManifests(manifestPath, publicAssetsDir);
}

/**
 * Index standalone tileable textures for Godot. A "standalone" asset is a plain
 * image (no `.png.json` atlas sibling) whose alias lives under `textures/`.
 *
 * Returns the sprite-map additions (also merged into godot/sprite-map.json).
 * Exported-shape kept pure-ish so the file copy can be skipped/tested: the
 * actual fs writes are guarded by existence checks.
 */
export function collectStandaloneTextureEntries(
  manifest: { bundles?: { assets?: { alias: string | string[]; src: string | string[] }[] }[] },
): GodotSpriteMap {
  const additions: GodotSpriteMap = {};
  for (const bundle of manifest.bundles ?? []) {
    for (const asset of bundle.assets ?? []) {
      const alias: string = Array.isArray(asset.alias) ? asset.alias[0] : asset.alias;
      const srcs: string[] = Array.isArray(asset.src) ? asset.src : [asset.src];
      if (!alias || !alias.startsWith('textures/')) continue;
      // Skip atlases (they have a JSON sidecar) — those go through the atlas path.
      if (srcs.some((s) => s.endsWith('.json'))) continue;
      // Prefer the full-resolution PNG (no `@Nx` suffix); fall back to any PNG.
      const png = srcs.find((s) => s.endsWith('.png') && !s.includes('@')) ?? srcs.find((s) => s.endsWith('.png'));
      if (!png) continue;
      const godotRelPath = `textures/${alias.slice('textures/'.length)}.png`;
      additions[godotRelPath] = {
        godotPath: `res://${godotRelPath}`,
        type: 'Texture2D',
        pixiFrame: alias,
      };
      // Stash the source path so the writer can copy it without re-deriving.
      (additions[godotRelPath] as GodotSpriteEntry & { _src?: string })._src = png;
    }
  }
  return additions;
}

function writeGodotStandaloneTextures(
  manifest: { bundles?: { assets?: { alias: string | string[]; src: string | string[] }[] }[] },
  publicAssetsDir: string,
): void {
  const entries = collectStandaloneTextureEntries(manifest);
  const clean: GodotSpriteMap = {};
  let copied = 0;

  for (const [key, entry] of Object.entries(entries)) {
    const src = (entry as GodotSpriteEntry & { _src?: string })._src;
    delete (entry as GodotSpriteEntry & { _src?: string })._src;
    clean[key] = entry;
    if (!src) continue;

    const srcPath = path.join(publicAssetsDir, src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`[Godot] Standalone texture source missing, skipping copy: ${src}`);
      continue;
    }
    const destPath = path.join(GODOT_DIR, key); // key is "textures/<name>.png"
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    copied++;
  }

  if (Object.keys(clean).length > 0) {
    mergeIntoSpriteMap(clean);
    console.log(`[Godot] Indexed ${Object.keys(clean).length} standalone texture(s); copied ${copied} → godot/textures/`);
  }
}

function attachTilesheetsFromAllManifests(manifestPath: string, publicAssetsDir: string): void {
  const spriteMapPath = path.join(GODOT_DIR, 'sprite-map.json');
  if (!fs.existsSync(spriteMapPath)) return;
  const spriteMap: GodotSpriteMap = JSON.parse(fs.readFileSync(spriteMapPath, 'utf-8'));
  if (!fs.existsSync(manifestPath)) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  let updated = false;
  for (const bundle of manifest.bundles ?? []) {
    for (const asset of bundle.assets ?? []) {
      const srcs: string[] = Array.isArray(asset.src) ? asset.src : [asset.src];
      const jsonSrc = srcs.find((s: string) => s.endsWith('.png.json') && !s.includes('@'));
      if (!jsonSrc) continue;
      const jsonPath = path.join(publicAssetsDir, jsonSrc);
      if (!fs.existsSync(jsonPath)) continue;
      const metadata: SpritesheetData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      for (const [, entry] of Object.entries(spriteMap)) {
        if (entry.type !== 'AtlasTexture') continue;
        if (entry.tilesheet) continue; // already attached
        const bareKey = entry.pixiFrame;
        if (!bareKey || !metadata.frames[bareKey]) continue;
        // Derive the frame prefix from pixiFrame (e.g. "rat-boat#0" → "rat-boat")
        const framePrefix = bareKey.replace(/#\d+$/, '');
        const ts = detectTilesheet(framePrefix, metadata);
        if (ts) {
          entry.tilesheet = ts;
          updated = true;
        }
      }
    }
  }

  if (updated) {
    fs.writeFileSync(spriteMapPath, JSON.stringify(spriteMap, null, 2));
    console.log('[Godot] Tilesheet metadata attached to sprite-map.json');
  }
}

function detectTilesheet(name: string, metadata: SpritesheetData): TilesheetInfo | null {
  const bareKey = `${name}#0`;
  if (!metadata.frames[bareKey]) return null;
  const tileRe = new RegExp(`^${escapeRegExp(name)}_(\\d+)#0$`);
  let tileCount = 0;
  let firstTileKey: string | undefined;
  for (const frameKey of Object.keys(metadata.frames)) {
    if (tileRe.test(frameKey)) {
      tileCount++;
      if (!firstTileKey) firstTileKey = frameKey;
    }
  }
  if (tileCount < 2 || !firstTileKey) return null;
  const bare = metadata.frames[bareKey]?.sourceSize;
  const tile = metadata.frames[firstTileKey]?.sourceSize;
  if (!bare || !tile) return null;
  if (tile.w !== tile.h) return null;
  const cols = Math.round(bare.w / tile.w);
  const rows = Math.round(bare.h / tile.h);
  if (cols * rows < tileCount) return null;
  return { framePrefix: name, cols, rows, tileSize: tile.w };
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

    // Key by the full res:// path (without scheme) so that two atlases that
    // share a sprite name (e.g. "rat-boat" in both boats/ and rats/) get
    // independent entries and never overwrite each other.
    const spriteKey = `${godotSpritesBase}/${spriteName}`.replace(/^res:\/\//, '');
    spriteMap[spriteKey] = {
      godotPath: `${godotSpritesBase}/${spriteName}.tres`,
      type: 'AtlasTexture',
      pixiFrame: frameName,
    };
    if (frameData.borders) {
      spriteMap[spriteKey].borders = frameData.borders;
    }
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

    const animKey = `${godotSpritesBase}/${animName}`.replace(/^res:\/\//, '');
    spriteMap[animKey] = {
      godotPath: `${godotSpritesBase}/${animName}.tres`,
      type: 'SpriteFrames',
      pixiAnimation: animName,
      frames: frameNames,
    };
  }

  for (const [, entry] of Object.entries(spriteMap)) {
    if (entry.type === 'AtlasTexture' && !entry.tilesheet) {
      const ts = detectTilesheet(entry.pixiFrame?.replace(/#\d+$/, '') ?? '', metadata);
      if (ts) entry.tilesheet = ts;
    }
  }
  return spriteMap;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
