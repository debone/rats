import * as fs from 'fs';
import * as path from 'path';

interface ManifestAsset {
  alias: string[];
  src: string[];
}

interface AssetsManifest {
  bundles: { name: string; assets: ManifestAsset[] }[];
}

/**
 * Build a lookup map from alias to actual src path
 */
function buildAliasToSrcMap(assetsDir: string): Map<string, string> {
  const manifestPath = path.join(assetsDir, 'assets-manifest.json');
  const aliasMap = new Map<string, string>();

  if (!fs.existsSync(manifestPath)) {
    console.warn('assets-manifest.json not found at', manifestPath);
    return aliasMap;
  }

  try {
    const manifest: AssetsManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    for (const bundle of manifest.bundles) {
      for (const asset of bundle.assets) {
        for (const alias of asset.alias) {
          // Use the first src file (they're typically the same content, just different formats)
          if (asset.src.length > 0) {
            aliasMap.set(alias, asset.src[0]);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to parse assets-manifest.json:', error);
  }

  return aliasMap;
}

interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup' | 'imagelayer';
  id: number;
  class?: string;
  properties?: { name: string; type: string; value: any }[];
}

interface TiledTilesetRef {
  firstgid: number;
  source: string;
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTilesetRef[];
  properties?: { name: string; type: string; value: any }[];
}

interface TiledTilesetFile {
  name: string;
  image: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
}

interface MapInfo {
  key: string;
  path: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: Record<string, { type: string; id: number; class?: string }>;
  tilesets: Record<string, { firstgid: number; path: string; imagePath: string }>;
  properties: Record<string, any>;
}

/**
 * Sanitize a path/name to a valid TypeScript identifier
 */
function sanitizeKey(name: string): string {
  return name
    .replace(/\.(json|tsx|tmx|png|webp)$/i, '')
    .replace(/[\/.-]/g, '_')
    .replace(/^(\d)/, '_$1');
}

/**
 * Extract properties into a simple key-value object
 */
function extractProperties(props?: { name: string; value: any }[]): Record<string, any> {
  if (!props) return {};
  const result: Record<string, any> = {};
  for (const prop of props) {
    result[prop.name.toLowerCase()] = prop.value;
  }
  return result;
}

/**
 * Find all Tiled map JSON files recursively
 */
function findTiledMapFiles(dir: string, rootDir: string): { path: string; relativePath: string }[] {
  const results: { path: string; relativePath: string }[] = [];

  if (!fs.existsSync(dir)) return results;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results.push(...findTiledMapFiles(filePath, rootDir));
    } else if (file.endsWith('.json') && !file.includes('assets-manifest') && !file.includes('.png.json')) {
      // Check if it's a Tiled map (has layers and tilesets)
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (content.layers && content.tilesets && content.type === 'map') {
          const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
          results.push({ path: filePath, relativePath });
        }
      } catch {
        // Not a valid JSON or not a Tiled map
      }
    }
  }

  return results;
}

/**
 * Generate TypeScript definitions for Tiled maps
 */
export function generateTiledTypes(assetsDir: string, outputPath: string): void {
  try {
    // Build alias to src map from manifest
    const aliasMap = buildAliasToSrcMap(assetsDir);

    const mapFiles = findTiledMapFiles(assetsDir, assetsDir);
    const maps: MapInfo[] = [];

    for (const file of mapFiles) {
      const content = fs.readFileSync(file.path, 'utf-8');
      const mapData: TiledMap = JSON.parse(content);

      const mapKey = sanitizeKey(file.relativePath);
      const basePath = path.dirname(file.relativePath);

      // Build layers info
      const layers: Record<string, { type: string; id: number; class?: string }> = {};
      for (const layer of mapData.layers) {
        const layerKey = sanitizeKey(layer.name);
        layers[layerKey] = {
          type: layer.type,
          id: layer.id,
          ...(layer.class ? { class: layer.class } : {}),
        };
      }

      // Build tilesets info
      const tilesets: Record<string, { firstgid: number; path: string; imagePath: string }> = {};
      for (const tileset of mapData.tilesets) {
        // Build the alias path (e.g., "backgrounds/tiles.tsx")
        const tilesetAlias = path.join(basePath, tileset.source).split(path.sep).join('/');

        // Look up the actual hashed filename from the manifest
        const tilesetSrc = aliasMap.get(tilesetAlias);
        const tilesetJsonPath = tilesetSrc
          ? path.join(assetsDir, tilesetSrc)
          : path.join(assetsDir, basePath, tileset.source.replace('.tsx', '.json'));

        if (fs.existsSync(tilesetJsonPath)) {
          const tilesetData: TiledTilesetFile = JSON.parse(fs.readFileSync(tilesetJsonPath, 'utf-8'));
          const tilesetKey = sanitizeKey(tilesetData.name || tileset.source);

          // Resolve image path relative to assets dir
          const tilesetDir = path.dirname(tilesetJsonPath);
          const absoluteImagePath = path.resolve(tilesetDir, tilesetData.image);
          const relativeImagePath = path.relative(assetsDir, absoluteImagePath).split(path.sep).join('/');

          tilesets[tilesetKey] = {
            firstgid: tileset.firstgid,
            path: path.join(basePath, tileset.source).split(path.sep).join('/'),
            imagePath: relativeImagePath,
          };
        }
      }

      maps.push({
        key: mapKey.slice(0, -7),
        path: file.relativePath.replace('.json', '').slice(0, -7) + '.tmx',
        width: mapData.width,
        height: mapData.height,
        tileWidth: mapData.tilewidth,
        tileHeight: mapData.tileheight,
        layers,
        tilesets,
        properties: extractProperties(mapData.properties),
      });
    }

    // Generate TypeScript content
    let content = `// Auto-generated TypeScript file for Tiled maps\n`;
    content += `// Do not edit this file manually - it will be overwritten\n\n`;

    if (maps.length === 0) {
      content += `export const TILED_MAPS = {} as const;\n`;
      content += `export type TiledMapKey = never;\n`;
    } else {
      // Generate TILED_MAPS constant
      content += `export const TILED_MAPS = {\n`;

      for (const map of maps) {
        content += `  ${map.key}: {\n`;
        content += `    path: "${map.path}",\n`;
        content += `    width: ${map.width},\n`;
        content += `    height: ${map.height},\n`;
        content += `    tileWidth: ${map.tileWidth},\n`;
        content += `    tileHeight: ${map.tileHeight},\n`;

        // Layers
        content += `    layers: {\n`;
        for (const [layerKey, layerInfo] of Object.entries(map.layers)) {
          content += `      ${layerKey}: { type: "${layerInfo.type}" as const, id: ${layerInfo.id}`;
          if (layerInfo.class) content += `, class: "${layerInfo.class}"`;
          content += ` },\n`;
        }
        content += `    },\n`;

        // Tilesets
        content += `    tilesets: {\n`;
        for (const [tilesetKey, tilesetInfo] of Object.entries(map.tilesets)) {
          content += `      ${tilesetKey}: {\n`;
          content += `        firstgid: ${tilesetInfo.firstgid},\n`;
          content += `        path: "${tilesetInfo.path}",\n`;
          content += `        imagePath: "${tilesetInfo.imagePath}",\n`;
          content += `      },\n`;
        }
        content += `    },\n`;

        // Properties
        if (Object.keys(map.properties).length > 0) {
          content += `    properties: ${JSON.stringify(map.properties)},\n`;
        }

        content += `  },\n`;
      }

      content += `} as const;\n\n`;

      // Generate type for map keys
      content += `export type TiledMapKey = keyof typeof TILED_MAPS;\n\n`;

      // Generate layer name types per map
      for (const map of maps) {
        const typeName = map.key.charAt(0).toUpperCase() + map.key.slice(1);
        content += `export type ${typeName}Layer = keyof typeof TILED_MAPS["${map.key}"]["layers"];\n`;
      }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content);
    console.log(`Generated Tiled types at ${outputPath} (${maps.length} maps)`);
  } catch (error) {
    console.error('Failed to generate Tiled types:', error);
  }
}
