import { type AssetPipe, checkExt, createNewAssetAt, swapExt } from '@assetpack/core';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface RubeOptions {
  executable: string;
}

type RubeTags = 'rube';

export function rube(
  _options: RubeOptions = { executable: './rube/R.U.B.E.app/Contents/MacOS/rube' },
): AssetPipe<RubeOptions, RubeTags> {
  return {
    name: 'rube',
    defaultOptions: {
      executable: _options.executable,
    },
    tags: {
      rube: 'rube',
    },
    test: (asset) => checkExt(asset.path, '.rube'),
    transform: async (asset, options) => {
      const { executable } = options;

      // Create a hashed filename for the temp file
      const hash = createHash('md5').update(asset.path).digest('hex').slice(0, 8);
      const tmpDir = path.resolve('tmp');
      const tmpFile = path.join(tmpDir, `${hash}.json`);

      // Ensure tmp directory exists
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      console.log(`Running Rube command: ${executable} -i ${asset.path} -e ${tmpFile}`);
      execSync(`${executable} -i ${asset.path} -e ${tmpFile}`);

      // Read the output file content
      const buffer = fs.readFileSync(tmpFile);

      // Create the new asset and set its buffer
      const jsonAsset = createNewAssetAt(asset, swapExt(asset.path, '.json'));
      jsonAsset.buffer = buffer;

      return [jsonAsset];
    },
  };
}
