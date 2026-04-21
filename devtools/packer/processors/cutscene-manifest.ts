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
 * Append cutscene JSON files to the default bundle so they get stable aliases
 * (e.g. cutscenes/rat-cat.json) and appear in generated ASSETS / load with default bundle.
 *
 * AssetPack only scans ./assets; cutscenes are emitted beside the manifest, so we merge here.
 */
export function injectCutsceneAssetsIntoManifest(manifestPath: string, cutscenesDir: string): void {
  if (!fs.existsSync(manifestPath) || !fs.existsSync(cutscenesDir)) return;

  const manifest: AssetsManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const files = fs.readdirSync(cutscenesDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return;

  const defaultBundle = manifest.bundles?.find((b) => b.name === 'default');
  if (!defaultBundle?.assets) return;

  const existingAliases = new Set<string>();
  for (const asset of defaultBundle.assets) {
    for (const a of asset.alias ?? []) existingAliases.add(a);
  }

  let added = false;
  for (const file of files) {
    const alias = `cutscenes/${file}`;
    if (existingAliases.has(alias)) continue;
    const srcRel = path.posix.join('cutscenes', file);
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
    console.log('[Godot] Cutscene JSON merged into assets-manifest.json');
  }
}
