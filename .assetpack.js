import { pixiPipes } from '@assetpack/core/pixi';

export default {
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
