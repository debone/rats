import { AssetPack, type AssetPackConfig } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import * as fs from 'fs';
import type { Plugin, ResolvedConfig } from 'vite';
import { packer } from './packer';
import { generateManifestTypes } from './packer/processors/manifest-types';
import { generateTiledTypes } from './packer/processors/tiled-types';
import { generateAtlasTypes } from './packer/processors/typescript';
import { rube } from './rube';
import { tiled } from './tiled';

const pixis = pixiPipes({
  cacheBust: true,
  texturePacker: {
    texturePacker: {
      removeFileExtension: true,
    },
  },
  manifest: {
    output: './public/assets/assets-manifest.json',
    createShortcuts: false, // Don't create flat aliases for nested assets
  },
});

const pxPipes = pixis.filter((pipe) => pipe.name !== 'jasdasdson');

export function assetpackPlugin(): Plugin {
  const apConfig: AssetPackConfig = {
    entry: './assets',
    output: './public/assets/',
    ignore: ['**/*.tiled-project', '**/*.tiled-session'],
    pipes: [packer(), rube(), tiled(), ...pxPipes],
  };

  let mode: ResolvedConfig['command'];
  let ap: AssetPack | undefined;
  let manifestWatcher: fs.FSWatcher | undefined;

  /**
   * Generate all TypeScript definitions after assets are processed
   */
  function generateTypeDefinitions() {
    console.log('Generating TypeScript definitions...');
    generateManifestTypes('./public/assets/assets-manifest.json', './src/assets/manifest.ts');
    generateAtlasTypes('./public/assets/', './src/assets/');
    generateTiledTypes('./public/assets/', './src/assets/tiled.ts');
  }

  return {
    name: 'vite-plugin-assetpack',
    configResolved(resolvedConfig) {
      mode = resolvedConfig.command;
      if (!resolvedConfig.publicDir) return;
      if (apConfig.output) return;
      const publicDir = resolvedConfig.publicDir.replace(process.cwd(), '');
      apConfig.output = `.${publicDir}/assets/`;
    },
    buildStart: async () => {
      if (mode === 'serve') {
        if (ap) return;
        ap = new AssetPack(apConfig);

        // Start watching and generate types on first run
        void ap.watch(() => {
          generateTypeDefinitions();
        });
      } else {
        await new AssetPack(apConfig).run();
        generateTypeDefinitions();
      }
    },
    buildEnd: async () => {
      if (manifestWatcher) {
        manifestWatcher.close();
        manifestWatcher = undefined;
      }
      if (ap) {
        await ap.stop();
        ap = undefined;
      }
    },
  };
}
