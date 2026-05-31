import { defineConfig } from 'vite';
import path from 'path';
import { assetpackPlugin } from './vite-plugin-assetpack';
import { timelinesPlugin } from './vite-plugin-timelines';

export default defineConfig(({ mode }) => ({
  mode,
  base: './',
  plugins: [assetpackPlugin(), timelinesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@/core/jsx',
    jsxDev: false,
    jsxSideEffects: true,
  },
  build: {
    sourcemap: mode === 'development' ? true : false,
  },
}));
