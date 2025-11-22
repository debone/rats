import { defineConfig } from 'vite';
import path from 'path';
import { assetpackPlugin } from './vite-plugin-assetpack';

const fullReloadAlways = {
  handleHotUpdate({ server }) {
    // TODO: Maybe assets hot reload?
    server.ws.send({ type: 'full-reload' });
    return [];
  },
};

export default defineConfig({
  base: './',
  plugins: [fullReloadAlways, assetpackPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
});
