/**
 * Shonen Deck na Cloudflare (plano grátis).
 *
 * - O site (client/dist) é servido como Static Assets do próprio Worker.
 * - /ws vai para um Durable Object ("GameServer") que roda a mesma lógica do servidor Node
 *   (server/src/hub.ts): pareamento, partidas, timers e bot. Uma única instância guarda todas as
 *   partidas em memória, igual ao servidor Node — suficiente para os testes.
 */
import { DurableObject } from 'cloudflare:workers';
import { Hub } from '../server/src/hub.ts';
import type { Sock } from '../server/src/rooms.ts';

interface Env {
  GAME: DurableObjectNamespace<GameServer>;
  ASSETS: Fetcher;
}

/** Adapta o WebSocket da Cloudflare para o formato que a lógica do jogo usa. */
class CfSock implements Sock {
  readonly OPEN = 1;
  constructor(private ws: WebSocket) {}
  get readyState() {
    return this.ws.readyState;
  }
  send(data: string) {
    try {
      this.ws.send(data);
    } catch {
      /* conexão já fechada */
    }
  }
}

export class GameServer extends DurableObject<Env> {
  private hub = new Hub();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperava WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    // accept() normal (sem hibernação): o objeto fica em memória enquanto houver conexões,
    // e os timers dos turnos continuam rodando.
    server.accept();
    const sock = new CfSock(server);
    server.addEventListener('message', (e) => this.hub.message(sock, typeof e.data === 'string' ? e.data : ''));
    const closed = () => this.hub.close(sock);
    server.addEventListener('close', closed);
    server.addEventListener('error', closed);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws') return env.GAME.get(env.GAME.idFromName('principal')).fetch(request);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
