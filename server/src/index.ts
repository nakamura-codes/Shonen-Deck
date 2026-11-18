import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub } from './hub.ts';
import { Match } from './rooms.ts';
import { MemoryStore } from './store.ts';

const PORT = Number(process.env.PORT ?? 2567);
if (process.env.SEED) Match.seed = Number(process.env.SEED);

// Banco local de desenvolvimento: server/data/db.json (fora do git).
const DB = process.env.DB_FILE ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'db.json');
let initial = null;
try {
  if (existsSync(DB)) initial = JSON.parse(readFileSync(DB, 'utf8'));
} catch {
  console.warn('Não consegui ler o banco local; começando vazio.');
}
const store = new MemoryStore(initial, (json) => {
  mkdirSync(dirname(DB), { recursive: true });
  writeFileSync(DB, json);
});

const wss = new WebSocketServer({ port: PORT, path: '/ws', maxPayload: 4096 });
const hub = new Hub(store);

wss.on('connection', (ws) => {
  ws.on('message', (raw) => hub.message(ws, String(raw)));
  ws.on('close', () => hub.close(ws));
});

console.log(`Servidor de batalha em ws://localhost:${PORT}/ws (banco: ${DB})`);
