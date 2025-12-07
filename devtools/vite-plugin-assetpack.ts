import { AssetPack, AssetPackConfig } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import { texturePackerCompress } from '@assetpack/core/texture-packer';
import { Plugin, ResolvedConfig } from 'vite';
import { packer } from './packer';
import { generateAtlasTypes } from './packer/processors/typescript';
import { generateManifestTypes } from './packer/processors/manifest-types';
import * as fs from 'fs';
import { rube } from './rube';

const pixis = pixiPipes({
  cacheBust: false,
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

const pxPipes = pixis.filter((pipe) => pipe.name !== 'json');

export function assetpackPlugin(): Plugin {
  const apConfig: AssetPackConfig = {
    entry: './assets',
    output: './public/assets/',
    cache: false,
    pipes: [packer(), rube(), ...pxPipes],
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
        void ap.watch().then(() => {
          generateTypeDefinitions();

          // Watch the manifest file for changes and regenerate types
          manifestWatcher = fs.watch('./public/assets/assets-manifest.json', (eventType) => {
            if (eventType === 'change') {
              console.log('Assets changed, regenerating types...');
              setTimeout(() => {
                generateTypeDefinitions();
              }, 100); // Small delay to ensure files are written
            }
          });
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
