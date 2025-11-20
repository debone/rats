import { defineConfig } from 'vite';
import path from 'path';

const fullReloadAlways = {
  handleHotUpdate({ server }) {
    // TODO: Maybe assets hot reload?
    server.ws.send({ type: 'full-reload' });
    return [];
  },
};

export default defineConfig({
  base: './',
  plugins: [fullReloadAlways],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
