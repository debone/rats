import { defineConfig } from 'vite';
import path from 'path';
import { assetpackPlugin } from './vite-plugin-assetpack';

export default defineConfig({
  mode: 'development',
  base: './',
  plugins: [assetpackPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  build: {
    sourcemap: true,
  },
});
