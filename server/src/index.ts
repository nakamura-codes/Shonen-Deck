import { WebSocketServer } from 'ws';
import { Hub } from './hub.ts';
import { Match } from './rooms.ts';

const PORT = Number(process.env.PORT ?? 2567);
if (process.env.SEED) Match.seed = Number(process.env.SEED);

const wss = new WebSocketServer({ port: PORT, path: '/ws', maxPayload: 4096 });
const hub = new Hub();

wss.on('connection', (ws) => {
  ws.on('message', (raw) => hub.message(ws, String(raw)));
  ws.on('close', () => hub.close(ws));
});

console.log(`Servidor de batalha em ws://localhost:${PORT}/ws`);
