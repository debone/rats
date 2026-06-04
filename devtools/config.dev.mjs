import { defineConfig } from 'vite';
import path from 'path';
import { assetpackPlugin } from './vite-plugin-assetpack';
import { timelinesPlugin } from './vite-plugin-timelines';

const fullReloadAlways = {
  handleHotUpdate({ file, server }) {
    // The timeline editor applies its edits live and Save just persists them, so a
    // timeline JSON write shouldn't blow away the running game (and the open
    // editor) with a full reload. Everything else still force-reloads.
    if (file.includes('/assets/timelines/')) return [];

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
