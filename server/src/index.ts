import { WebSocketServer, type WebSocket } from 'ws';
import { sanitizeOutfit, type ClientMessage } from '@oficina/shared';
import { Matchmaker, send } from './rooms.ts';

const PORT = Number(process.env.PORT ?? 2567);
const wss = new WebSocketServer({ port: PORT, path: '/ws', maxPayload: 4096 });
const matchmaker = new Matchmaker();

function parse(raw: unknown): ClientMessage | null {
  try {
    const msg = JSON.parse(String(raw));
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return null;
    return msg as ClientMessage;
  } catch {
    return null;
  }
}

function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) : '';
  return s || 'Jogador';
}

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw) => {
    const msg = parse(raw);
    if (!msg) return send(ws, { t: 'error', message: 'Mensagem inválida.' });

    switch (msg.t) {
      case 'join':
        matchmaker.join({ ws, name: cleanName(msg.name), outfit: sanitizeOutfit(msg.outfit) }, msg.vsBot === true);
        return;
      case 'rejoin':
        if (typeof msg.token !== 'string' || !matchmaker.rejoin(msg.token, ws)) {
          send(ws, { t: 'error', message: 'Partida não encontrada.' });
        }
        return;
      case 'leaveQueue':
        matchmaker.leaveQueue(ws);
        return;
      case 'play':
      case 'moveFirst':
      case 'undo':
      case 'ready': {
        const found = matchmaker.matchOf(ws);
        if (!found) return send(ws, { t: 'error', message: 'Você não está em uma partida.' });
        if ((msg.t === 'play' || msg.t === 'moveFirst') && typeof msg.uid !== 'string') return send(ws, { t: 'error', message: 'Carta inválida.' });
        found.match.handle(found.seat, msg);
        return;
      }
      default:
        send(ws, { t: 'error', message: 'Mensagem desconhecida.' });
    }
  });

  ws.on('close', () => matchmaker.disconnect(ws));
});

console.log(`Servidor de batalha em ws://localhost:${PORT}/ws`);
