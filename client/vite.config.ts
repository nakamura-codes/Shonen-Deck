import { defineConfig } from 'vite';

const SERVER = process.env.GAME_SERVER ?? 'ws://localhost:2567';

export default defineConfig({
  server: {
    port: 5173,
    proxy: { '/ws': { target: SERVER, ws: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/ws': { target: SERVER, ws: true } },
  },
});
