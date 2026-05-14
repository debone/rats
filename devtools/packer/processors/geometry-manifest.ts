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

/**
 * Append geometry JSON files to the default bundle so they get stable aliases
 * (e.g. geometry/level-1.json) and load with the default bundle.
 */
export function injectGeometryAssetsIntoManifest(manifestPath: string, geometryDir: string): void {
  if (!fs.existsSync(manifestPath) || !fs.existsSync(geometryDir)) return;

  const manifest: AssetsManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const files = fs.readdirSync(geometryDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return;

  const defaultBundle = manifest.bundles?.find((b) => b.name === 'default');
  if (!defaultBundle?.assets) return;

  const existingAliases = new Set<string>();
  for (const asset of defaultBundle.assets) {
    for (const a of asset.alias ?? []) existingAliases.add(a);
  }

  let added = false;
  for (const file of files) {
    const alias = `geometry/${file}`;
    if (existingAliases.has(alias)) continue;
    const srcRel = path.posix.join('geometry', file);
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
