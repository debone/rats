import { AssetPack, AssetPackConfig } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';
import { Plugin, ResolvedConfig } from 'vite';

export function assetpackPlugin(): Plugin {
  const apConfig: AssetPackConfig = {
    entry: './assets',
    output: './public/assets/',
    cache: true,
    pipes: [
      ...pixiPipes({
        cacheBust: false,
        texturePacker: {
          texturePacker: {
            removeFileExtension: true,
          },
        },
        manifest: {
          output: './public/assets/assets-manifest.json',
        },
      }),
    ],
  };
  let mode: ResolvedConfig['command'];
  let ap: AssetPack | undefined;

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
        void ap.watch();
      } else {
        await new AssetPack(apConfig).run();
      }
    },
    buildEnd: async () => {
      if (ap) {
        await ap.stop();
        ap = undefined;
      }
    },
  };
}
