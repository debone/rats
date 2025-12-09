import { Asset, type AssetPipe, checkExt, createNewAssetAt, swapExt } from '@assetpack/core';
import { TiledParser } from './lib/tmx-parser';

type TiledTags = 'tiled';

export function tiled(): AssetPipe<{}, TiledTags> {
  return {
    name: 'tiled',
    defaultOptions: {},
    tags: {
      tiled: 'tiled',
    },
    test: (asset): asset is Asset & { buffer: Buffer } => checkExt(asset.path, '.tmx') || checkExt(asset.path, '.tsx'),
    transform: async (asset) => {
      const parser = new TiledParser();
      const xml = asset.buffer.toString();

      const result = checkExt(asset.path, '.tsx') ? parser.parseExternalTileset(xml) : parser.parse(xml);

      const jsonBuffer = Buffer.from(JSON.stringify(result, null, 2));
      const jsonAsset = createNewAssetAt(asset, swapExt(asset.path, '.json'));
      jsonAsset.buffer = jsonBuffer;
      return [jsonAsset];
    },
  };
}
