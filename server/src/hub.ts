import { CHAT_MAX_LENGTH, EMPTY_OUTFIT, sanitizeOutfit, type BotLevel, type ClientMessage, type PlayerStats, type ServerMessage } from '@oficina/shared';
import { Matchmaker, send, type Match, type Sock } from './rooms.ts';
import { MemoryStore, hashPassword, randomToken, sameHash, type Account, type Store } from './store.ts';

const BOT_LEVELS: BotLevel[] = ['iniciante', 'competitivo', 'deus'];

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
  return typeof name === 'string' ? name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) : '';
}

/** Texto do chat: uma linha, sem caracteres de controle, com tamanho máximo. */
function cleanChat(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH);
}

const stats = (a: Account): PlayerStats => ({ wins: a.wins, losses: a.losses, botWins: a.botWins, botLosses: a.botLosses });

interface Client {
  /** Conta logada (chave) ou null. */
  account: string | null;
  /** Nome mostrado (da conta, ou do convidado). */
  name: string;
  lastChat: number[];
  authTries: number;
}

/** Recebe as mensagens dos jogadores: contas, chat, pareamento e partidas. */
export class Hub {
  readonly matchmaker = new Matchmaker();
  private clients = new Map<Sock, Client>();

  constructor(private store: Store = new MemoryStore()) {
    this.matchmaker.onResult = (m) => void this.recordResult(m);
  }

  private client(ws: Sock): Client {
    let c = this.clients.get(ws);
    if (!c) {
      c = { account: null, name: '', lastChat: [], authTries: 0 };
      this.clients.set(ws, c);
    }
    return c;
  }

  message(ws: Sock, raw: unknown) {
    if (typeof raw === 'string' && raw.length > 4096) return send(ws, { t: 'error', message: 'Mensagem grande demais.' });
    const msg = parse(raw);
    if (!msg) return send(ws, { t: 'error', message: 'Mensagem inválida.' });
    this.handle(ws, msg).catch(() => send(ws, { t: 'error', message: 'Erro no servidor. Tente de novo.' }));
  }

  private async handle(ws: Sock, msg: ClientMessage) {
    const mm = this.matchmaker;
    const me = this.client(ws);
    switch (msg.t) {
      case 'hello':
        if (!me.account) me.name = cleanName(msg.name) || me.name;
        send(ws, { t: 'chatHistory', messages: await this.store.recentChat(30) });
        this.broadcastOnline();
        return;
      case 'register':
      case 'login':
        return this.auth(ws, me, msg.t, msg.name, msg.pass);
      case 'resume': {
        const key = typeof msg.session === 'string' ? await this.store.getSession(msg.session) : null;
        const acc = key ? await this.store.getAccount(key) : null;
        if (!acc) return send(ws, { t: 'authError', message: 'Sessão expirada. Entre de novo.', silent: true });
        me.account = acc.key;
        me.name = acc.name;
        send(ws, { t: 'authOk', name: acc.name, session: msg.session, outfit: this.outfitOf(acc), stats: stats(acc) });
        return;
      }
      case 'logout':
        me.account = null;
        return;
      case 'saveOutfit':
        if (me.account) await this.store.updateOutfit(me.account, JSON.stringify(sanitizeOutfit(msg.outfit)));
        return;
      case 'stats': {
        const acc = me.account ? await this.store.getAccount(me.account) : null;
        if (acc) send(ws, { t: 'stats', stats: stats(acc) });
        return;
      }
      case 'leaderboard':
        send(ws, { t: 'leaderboard', rows: await this.store.top(20) });
        return;
      case 'chat':
        return this.chat(ws, me, msg.text);
      case 'join': {
        // Com conta, o nome da partida é sempre o da conta (o ranking não pode ser falsificado).
        const name = me.account ? me.name : cleanName(msg.name) || 'Jogador';
        const level = BOT_LEVELS.includes(msg.botLevel as BotLevel) ? (msg.botLevel as BotLevel) : 'competitivo';
        mm.join({ ws, name, outfit: sanitizeOutfit(msg.outfit), account: me.account }, msg.vsBot === true, level);
        return;
      }
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

  private outfitOf(acc: Account) {
    try {
      return sanitizeOutfit(JSON.parse(acc.outfit));
    } catch {
      return { ...EMPTY_OUTFIT };
    }
  }

  private async auth(ws: Sock, me: Client, mode: 'register' | 'login', rawName: unknown, rawPass: unknown) {
    const fail = (message: string) => send(ws, { t: 'authError', message });
    if (++me.authTries > 20) return fail('Muitas tentativas. Recarregue a página e tente de novo.');
    const name = cleanName(rawName);
    const pass = typeof rawPass === 'string' ? rawPass : '';
    if (name.length < 3) return fail('O nome precisa ter pelo menos 3 letras.');
    if (pass.length < 4 || pass.length > 64) return fail('A senha precisa ter de 4 a 64 caracteres.');
    const key = name.toLowerCase();
    if (key.startsWith('convidado') || key.startsWith('bot ') || key === 'deus das cartas') return fail('Esse nome é reservado. Escolha outro.');
    let acc = await this.store.getAccount(key);
    if (mode === 'register') {
      if (acc) return fail('Esse nome já tem conta. Use Entrar.');
      const salt = randomToken(16);
      acc = { key, name, salt, hash: await hashPassword(pass, salt), outfit: JSON.stringify(EMPTY_OUTFIT), wins: 0, losses: 0, botWins: 0, botLosses: 0, createdAt: Date.now() };
      if (!(await this.store.createAccount(acc))) return fail('Esse nome já tem conta. Use Entrar.');
    } else {
      if (!acc) return fail('Conta não encontrada. Use Criar conta.');
      if (!sameHash(await hashPassword(pass, acc.salt), acc.hash)) return fail('Senha incorreta.');
    }
    const session = randomToken();
    await this.store.createSession(session, key);
    me.account = key;
    me.name = acc.name;
    me.authTries = 0;
    send(ws, { t: 'authOk', name: acc.name, session, outfit: this.outfitOf(acc), stats: stats(acc) });
  }

  private async chat(ws: Sock, me: Client, raw: unknown) {
    const text = cleanChat(raw);
    if (!text) return;
    if (!me.name) return send(ws, { t: 'error', message: 'Entre no jogo para usar o chat.' });
    // No máximo 5 mensagens a cada 10 segundos.
    const now = Date.now();
    me.lastChat = me.lastChat.filter((t) => now - t < 10_000);
    if (me.lastChat.length >= 5) return send(ws, { t: 'error', message: 'Calma! Espere um pouco para mandar outra mensagem.' });
    me.lastChat.push(now);
    const line = { from: me.name, text, at: now };
    await this.store.addChat(line);
    this.broadcast({ t: 'chat', ...line });
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.clients.keys()) if (ws.readyState === ws.OPEN) ws.send(data);
  }

  private broadcastOnline() {
    this.broadcast({ t: 'online', count: [...this.clients.values()].filter((c) => c.name).length });
  }

  /** Grava vitória/derrota de quem tem conta. Contra o bot conta como treino (fora do ranking). */
  private async recordResult(m: Match) {
    const w = m.state.winner;
    if (w !== 0 && w !== 1) return;
    const vsBot = m.seats.some((s) => s.isBot);
    for (const [i, seat] of m.seats.entries()) {
      if (!seat.account) continue;
      const won = i === w;
      await this.store.addResult(seat.account, vsBot ? (won ? 'botWins' : 'botLosses') : won ? 'wins' : 'losses');
    }
  }

  close(ws: Sock) {
    this.matchmaker.disconnect(ws);
    const had = this.clients.get(ws)?.name;
    this.clients.delete(ws);
    if (had) this.broadcastOnline();
  }
}
