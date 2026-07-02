import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectGeometryAssetsIntoManifest } from './geometry-manifest';

describe('injectGeometryAssetsIntoManifest', () => {
  let tmp: string;
  let manifestPath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-manifest-'));
    manifestPath = path.join(tmp, 'assets-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ bundles: [{ name: 'default', assets: [] }] }));
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const writeOut = (dir: string, rel: string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '{}');
  };

  const readAssets = () => JSON.parse(fs.readFileSync(manifestPath, 'utf-8')).bundles[0].assets;

  it('defaults to the `geometry/` alias prefix', () => {
    const outDir = path.join(tmp, 'geometry');
    writeOut(outDir, '0-theDepths/level-0.json');
    injectGeometryAssetsIntoManifest(manifestPath, outDir);
    const assets = readAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].alias).toEqual(['geometry/0-theDepths/level-0.json']);
    expect(assets[0].src).toEqual(['geometry/0-theDepths/level-0.json']);
  });

  it('namespaces aliases/src under a custom prefix (interface)', () => {
    const outDir = path.join(tmp, 'interface');
    writeOut(outDir, 'shop-card.json');
    injectGeometryAssetsIntoManifest(manifestPath, outDir, 'interface');
    const assets = readAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].alias).toEqual(['interface/shop-card.json']);
    expect(assets[0].src).toEqual(['interface/shop-card.json']);
  });

  it('does not duplicate an alias already present in the bundle', () => {
    const outDir = path.join(tmp, 'interface');
    writeOut(outDir, 'shop-card.json');
    injectGeometryAssetsIntoManifest(manifestPath, outDir, 'interface');
    injectGeometryAssetsIntoManifest(manifestPath, outDir, 'interface');
    expect(readAssets()).toHaveLength(1);
  });
});
