import { defineConfig } from 'vite';
import path from 'path';
import { assetpackPlugin } from './vite-plugin-assetpack';
import { timelinesPlugin } from './vite-plugin-timelines';

const fullReloadAlways = {
  handleHotUpdate({ server }) {
    // TODO: Maybe assets hot reload?
    server.ws.send({ type: 'full-reload' });
    return [];
  },
};

export default defineConfig({
  base: './',
  plugins: [fullReloadAlways, assetpackPlugin(), timelinesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@/core/jsx',
  },
});
