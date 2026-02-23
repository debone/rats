import { defineConfig } from 'vite';
import path from 'path';
import { assetpackPlugin } from './vite-plugin-assetpack';

export default defineConfig(({ mode }) => ({
  mode,
  base: './',
  plugins: [assetpackPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@/core/jsx',
  },
  build: {
    sourcemap: mode === 'development' ? true : false,
  },
}));
