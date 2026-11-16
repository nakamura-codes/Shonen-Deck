import type { ClientMessage, ServerMessage } from '@oficina/shared';

type Listener = (msg: ServerMessage) => void;

const TOKEN_KEY = 'oficina.matchToken';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Conexão WebSocket com o servidor de batalha. Reconecta sozinha se cair. */
export class Net {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private outbox: ClientMessage[] = [];
  connected = false;

  constructor(private url: string) {
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      const token = this.token;
      if (token) ws.send(JSON.stringify({ t: 'rejoin', token } satisfies ClientMessage));
      for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === 'match') this.token = msg.token;
      for (const l of [...this.listeners]) l(msg);
    };
    ws.onclose = () => {
      this.connected = false;
      setTimeout(() => this.connect(), 1500);
    };
  }

  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.outbox.push(msg);
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get token(): string | null {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  }

  set token(v: string | null) {
    const s = storage();
    if (!s) return;
    try {
      if (v) s.setItem(TOKEN_KEY, v);
      else s.removeItem(TOKEN_KEY);
    } catch {
      /* armazenamento indisponível: sem reconexão automática */
    }
  }
}

export function defaultServerUrl(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
