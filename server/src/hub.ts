import { sanitizeOutfit, type ClientMessage } from '@oficina/shared';
import { Matchmaker, send, type Sock } from './rooms.ts';

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

/** Recebe as mensagens dos jogadores e repassa para o pareamento e as partidas. */
export class Hub {
  readonly matchmaker = new Matchmaker();

  message(ws: Sock, raw: unknown) {
    if (typeof raw === 'string' && raw.length > 4096) return send(ws, { t: 'error', message: 'Mensagem grande demais.' });
    const msg = parse(raw);
    if (!msg) return send(ws, { t: 'error', message: 'Mensagem inválida.' });
    const mm = this.matchmaker;
    switch (msg.t) {
      case 'join':
        mm.join({ ws, name: cleanName(msg.name), outfit: sanitizeOutfit(msg.outfit) }, msg.vsBot === true);
        return;
      case 'rejoin':
        if (typeof msg.token !== 'string' || !mm.rejoin(msg.token, ws)) send(ws, { t: 'error', message: 'Partida não encontrada.' });
        return;
      case 'leaveQueue':
        mm.leaveQueue(ws);
        return;
      case 'play':
      case 'moveFirst':
      case 'keep':
      case 'undo':
      case 'ready': {
        const found = mm.matchOf(ws);
        if (!found) return send(ws, { t: 'error', message: 'Você não está em uma partida.' });
        if ((msg.t === 'play' || msg.t === 'moveFirst' || msg.t === 'keep') && typeof msg.uid !== 'string') return send(ws, { t: 'error', message: 'Carta inválida.' });
        found.match.handle(found.seat, msg);
        return;
      }
      default:
        send(ws, { t: 'error', message: 'Mensagem desconhecida.' });
    }
  }

  close(ws: Sock) {
    this.matchmaker.disconnect(ws);
  }
}
