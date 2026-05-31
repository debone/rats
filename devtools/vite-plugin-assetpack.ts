import { AssetPack, type AssetPackConfig } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import * as fs from 'fs';
import type { Plugin, ResolvedConfig } from 'vite';
import { packer } from './packer';
import { generateManifestTypes } from './packer/processors/manifest-types';
import { copyGodotSounds, generateGodotResourcesFromManifest } from './packer/processors/godot-resources';
import { injectCutsceneAssetsIntoManifest } from './packer/processors/cutscene-manifest';
import { injectGeometryAssetsIntoManifest } from './packer/processors/geometry-manifest';
import { generateCutsceneJsonFiles } from './packer/processors/godot-scene';
import { generateGeometryJsonFiles } from './packer/processors/godot-geometry';
import { generateTiledTypes } from './packer/processors/tiled-types';
import { generateAtlasTypes } from './packer/processors/typescript';
import { tiled } from './tiled';

const pixis = pixiPipes({
  cacheBust: true,
  texturePacker: {
    texturePacker: {
      removeFileExtension: true,
    },
  },
  compression: {
    webp: {
      lossless: true,
      quality: 100,
    },
    jpg: {
      quality: 100,
    },
    png: {
      quality: 100,
      compressionLevel: 9,
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
    // `assets/timelines` is handled verbatim by vite-plugin-timelines (stable
    // names for the editor's fixed-path fetch), so keep assetpack's hashing pipe
    // off it.
    ignore: ['**/*.tiled-project', '**/*.tiled-session', '**/.gitkeep', 'timelines/**'],
    pipes: [packer(), tiled(), ...pxPipes],
  };

  let mode: ResolvedConfig['command'];
  let ap: AssetPack | undefined;
  let manifestWatcher: fs.FSWatcher | undefined;
  let tscnWatcher: fs.FSWatcher | undefined;
  let geometryWatcher: fs.FSWatcher | undefined;

  /**
   * Generate all TypeScript definitions and Godot resources after assets are processed
   */
  function generateTypeDefinitions() {
    console.log('Generating TypeScript definitions...');
    generateAtlasTypes('./public/assets/', './src/assets/');
    generateTiledTypes('./public/assets/', './src/assets/tiled.ts');

    // Godot: handle {tps} atlases (not covered by the packer pipe) and sounds
    generateGodotResourcesFromManifest('./public/assets/assets-manifest.json', './public/assets');
    copyGodotSounds('./assets/sounds');

    // Godot: convert authored cutscenes to runtime JSON + generate types
    generateCutsceneJsonFiles('./godot/cutscenes', './public/assets/cutscenes', './godot/sprite-map.json', './src/assets/cutscenes.ts');
    injectCutsceneAssetsIntoManifest('./public/assets/assets-manifest.json', './public/assets/cutscenes');

    // Godot: convert authored geometry (.tscn with Box2D bodies/joints) → runtime JSON
    generateGeometryJsonFiles('./godot/geometry', './public/assets/geometry', './godot/sprite-map.json', './src/assets/geometry.ts');
    injectGeometryAssetsIntoManifest('./public/assets/assets-manifest.json', './public/assets/geometry');

    generateManifestTypes('./public/assets/assets-manifest.json', './src/assets/manifest.ts');
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

        // Watch godot/cutscenes/ for .tscn changes independently of assetpack
        const cutscenesDir = './godot/cutscenes';
        if (fs.existsSync(cutscenesDir)) {
          tscnWatcher = fs.watch(cutscenesDir, (_, filename) => {
            if (filename?.endsWith('.tscn')) {
              console.log(`[Godot] ${filename} changed, regenerating cutscenes...`);
              generateCutsceneJsonFiles(cutscenesDir, './public/assets/cutscenes', './godot/sprite-map.json', './src/assets/cutscenes.ts');
              injectCutsceneAssetsIntoManifest('./public/assets/assets-manifest.json', './public/assets/cutscenes');
              generateManifestTypes('./public/assets/assets-manifest.json', './src/assets/manifest.ts');
            }
          });
        }

        // Watch godot/geometry/ for .tscn changes (recursive = any subdirectory)
        const geometryDir = './godot/geometry';
        if (fs.existsSync(geometryDir)) {
          geometryWatcher = fs.watch(geometryDir, { recursive: true }, (_, filename) => {
            if (filename?.endsWith('.tscn')) {
              console.log(`[Godot] ${filename} changed, regenerating geometry...`);
              generateGeometryJsonFiles(geometryDir, './public/assets/geometry', './godot/sprite-map.json', './src/assets/geometry.ts');
              injectGeometryAssetsIntoManifest('./public/assets/assets-manifest.json', './public/assets/geometry');
              generateManifestTypes('./public/assets/assets-manifest.json', './src/assets/manifest.ts');
            }
          });
        }
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
      if (tscnWatcher) {
        tscnWatcher.close();
        tscnWatcher = undefined;
      }
      if (geometryWatcher) {
        geometryWatcher.close();
        geometryWatcher = undefined;
      }
      if (ap) {
        await ap.stop();
        ap = undefined;
      }
    },
  };
}
