import * as fs from 'fs';
import * as path from 'path';

interface ManifestAsset {
  alias: string[];
  src: string[];
  data: { tags: Record<string, unknown> };
}

interface ManifestBundle {
  name: string;
  assets: ManifestAsset[];
}

interface AssetsManifest {
  bundles: ManifestBundle[];
}

/** Recursively collect all .json files under a directory, returning relative paths. */
function walkJsonFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJsonFiles(full, base));
    } else if (entry.name.endsWith('.json')) {
      results.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

/**
 * Append geometry JSON files to the default bundle so they get stable aliases
 * (e.g. geometry/0-theDepths/level-0.json) and load with the default bundle.
 */
export function injectGeometryAssetsIntoManifest(manifestPath: string, geometryDir: string): void {
  if (!fs.existsSync(manifestPath) || !fs.existsSync(geometryDir)) return;

  const manifest: AssetsManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const files = walkJsonFiles(geometryDir);
  if (files.length === 0) return;

  const defaultBundle = manifest.bundles?.find((b) => b.name === 'default');
  if (!defaultBundle?.assets) return;

  const existingAliases = new Set<string>();
  for (const asset of defaultBundle.assets) {
    for (const a of asset.alias ?? []) existingAliases.add(a);
  }

  let added = false;
  for (const relFile of files) {
    const alias = `geometry/${relFile}`;
    if (existingAliases.has(alias)) continue;
    const srcRel = path.posix.join('geometry', relFile);
    defaultBundle.assets.push({
      alias: [alias],
      src: [srcRel],
      data: { tags: {} },
    });
    existingAliases.add(alias);
    added = true;
  }

  if (added) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('[Godot] Geometry JSON merged into assets-manifest.json');
  }
}
