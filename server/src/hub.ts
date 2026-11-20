import { ARENAS, isAvatar, CHAT_MAX_LENGTH, EMPTY_OUTFIT, sanitizeOutfit, type SocialAction, type BotLevel, type ClientMessage, type PlayerStats, type ServerMessage } from '@oficina/shared';
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
  pending: Promise<void>;
}

/** Recebe as mensagens dos jogadores: contas, chat, pareamento e partidas. */
export class Hub {
  readonly matchmaker = new Matchmaker();
  private clients = new Map<Sock, Client>();

  constructor(private store: Store = new MemoryStore()) {
    this.matchmaker.onResult = (m) => { void this.recordResult(m).catch(err => console.error('Falha ao registrar partida:', err)); };
  }

  private client(ws: Sock): Client {
    let c = this.clients.get(ws);
    if (!c) {
      c = { account: null, name: '', lastChat: [], authTries: 0, pending: Promise.resolve() };
      this.clients.set(ws, c);
    }
    return c;
  }

  message(ws: Sock, raw: unknown) {
    if (typeof raw === 'string' && raw.length > 4096) return send(ws, { t: 'error', message: 'Mensagem grande demais.' });
    const msg = parse(raw);
    if (!msg) return send(ws, { t: 'error', message: 'Mensagem inválida.' });
    // A retomada da conta termina antes de o mesmo socket consultar o perfil ou entrar na fila.
    const client = this.client(ws);
    client.pending = client.pending.then(() => {
      if (this.clients.get(ws) === client) return this.handle(ws, msg);
    }).catch(() => send(ws, { t: 'error', message: 'Erro no servidor. Tente de novo.' }));
  }

  private async handle(ws: Sock, msg: ClientMessage) {
    const mm = this.matchmaker;
    const me = this.client(ws);
    switch (msg.t) {
      case 'hello':
        if (!me.account) me.name = cleanName(msg.name) || me.name;
        await this.sendHistory(ws, me);
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
        send(ws, { t: 'authOk', avatar: acc.avatar ?? null, name: acc.name, session: msg.session, outfit: this.outfitOf(acc), stats: stats(acc) });
        this.sendContacts(ws, me);
        this.broadcastOnline();
        await this.sendHistory(ws, me);
        return;
      }
      case 'logout':
        me.account = null;
        me.name = '';
        this.clearInvites(ws);
        send(ws, { t: 'social', contacts: [] });
        return;
      case 'saveAvatar': {
        const account = me.account;
        if (!account || (msg.avatar !== null && !isAvatar(msg.avatar))) return;
        await this.store.updateAvatar(account, msg.avatar);
        for (const [peer, c] of this.clients) {
          if (c.account === account) send(peer, { t: 'avatarSaved', avatar: msg.avatar });
        }
        return;
      }
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
      case 'profile': {
        const name = cleanName(msg.name);
        if (!me.account) return send(ws, { t:'profileError',name,message:'Entre com uma conta para consultar perfis.' });
        const a = await this.store.getAccount(name.toLowerCase());
        if (!a) return send(ws, { t:'profileError',name,message:'Perfil não encontrado.' });
        const summary = await this.store.profileSummary(a.key);
        send(ws, { t: 'profile', profile: { avatar: a.avatar ?? null, name: a.name, createdAt: a.createdAt, outfit: this.outfitOf(a),
          wins: a.wins, losses: a.losses, ...summary } });
        return;
      }
      case 'social':
        this.sendContacts(ws, me);
        return;
      case 'relationship':
        return this.relationship(ws, me, msg.name, msg.action);
      case 'duel':
        return this.duel(ws, me, msg.name, msg.accept === true);
      case 'chat':
        return this.chat(ws, me, msg.text);
      case 'join': {
        // Com conta, o nome da partida é sempre o da conta (o ranking não pode ser falsificado).
        const name = me.account ? me.name : cleanName(msg.name) || 'Jogador';
        const level = BOT_LEVELS.includes(msg.botLevel as BotLevel) ? (msg.botLevel as BotLevel) : 'competitivo';
        const avatar = me.account ? (await this.store.getAccount(me.account))?.avatar ?? null : null;
        mm.join({ ws, name, avatar, outfit: sanitizeOutfit(msg.outfit), account: me.account }, msg.vsBot === true, level);
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
    send(ws, { t: 'authOk', avatar: acc.avatar ?? null, name: acc.name, session, outfit: this.outfitOf(acc), stats: stats(acc) });
    this.sendContacts(ws, me);
    await this.sendHistory(ws, me);
  }

  private blocked(a?: string | null, b?: string | null) {
    if (!a || !b || a === b) return false;
    const p = this.store.pair(a, b);
    return p.blockFirst || p.blockSecond;
  }
  private async sendHistory(ws: Sock, me: Client) {
    const messages = (await this.store.recentChat(50)).filter(m => !this.blocked(me.account, m.account)).slice(-30);
    send(ws, { t: 'chatHistory', messages });
  }
  private sendContacts(ws: Sock, me: Client) {
    send(ws, { t: 'social', contacts: me.account ? this.store.contacts(me.account) : [] });
  }
  private async relationship(ws: Sock, me: Client, name: string, action: SocialAction) {
    const key = me.account;
    const target = await this.store.getAccount(cleanName(name).toLowerCase());
    if (!key || key !== me.account || !target || key === target.key) return;
    const p = this.store.pair(key, target.key);
    const ownBlock = key === p.first ? 'blockFirst' : 'blockSecond';
    if (action === 'block' || action === 'remove') {
      for (const [peer, invite] of this.invites) {
        if ((invite.from === key && invite.target === target.key) || (invite.from === target.key && invite.target === key)) this.invites.delete(peer);
      }
    }
    if (action === 'block') {
      p[ownBlock] = true;
      p.requested = null;
      p.friend = false;
    } else if (action === 'unblock') {
      p[ownBlock] = false;
    } else if (p.blockFirst || p.blockSecond) {
      return send(ws, { t: 'socialNotice', message: 'Ação indisponível.' });
    } else if (action === 'request' && !p.requested && !p.friend) {
      p.requested = key;
    } else if (action === 'accept' && p.requested === target.key) {
      p.friend = true;
      p.requested = null;
    } else if (action === 'remove') {
      p.friend = false;
      p.requested = null;
    } else return;
    this.store.savePair(p);
    for (const [peer, c] of this.clients) {
      if (c.account !== key && c.account !== target.key) continue;
      this.sendContacts(peer, c);
      if (action === 'block' || action === 'unblock') await this.sendHistory(peer, c);
    }
  }

  private invites = new Map<Sock, { target: string; from: string; until: number }>();
  private clearInvites(ws: Sock) { this.invites.delete(ws); }

  private async duel(ws: Sock, me: Client, raw: string, accept: boolean) {
    const target = cleanName(raw).toLowerCase();
    const key = me.account;
    const notice = (message: string) => send(ws, { t: 'socialNotice', message });
    if (!key || key === target || !this.store.pair(key, target).friend) return notice('O duelo exige amizade aceita.');
    const available = (peer: Sock) => peer.readyState === peer.OPEN && !this.matchmaker.busy(peer);
    const peers = [...this.clients].filter(([peer, c]) => c.account === target && available(peer));
    if (!available(ws) || !peers.length) return notice('Jogador indisponível para duelo.');
    if (!accept) {
      this.invites.set(ws, { target, from: key, until: Date.now() + 60000 });
      for (const [peer] of peers) send(peer, { t: 'duelInvite', from: me.name });
      return notice('Convite enviado. Válido por um minuto.');
    }
    const inviter = peers.find(([peer]) => {
      const invite = this.invites.get(peer);
      return invite?.from === target && invite.target === key && invite.until > Date.now();
    });
    if (!inviter) return notice('O convite expirou.');
    const [other] = inviter;
    const accepted = this.invites.get(other)!;
    const [a, b] = await Promise.all([this.store.getAccount(target), this.store.getAccount(key)]);
    if (this.invites.get(other) !== accepted || accepted.until <= Date.now() || !a || !b || this.clients.get(other)?.account !== target ||
        this.clients.get(ws)?.account !== key || !this.store.pair(key, target).friend ||
        !available(ws) || !available(other)) return notice('Duelo indisponível.');
    this.invites.delete(other);
    this.invites.delete(ws);
    this.matchmaker.privateMatch({ ws: other, name: a.name, account: a.key, avatar: a.avatar, outfit: this.outfitOf(a) },
      { ws, name: b.name, account: b.key, avatar: b.avatar, outfit: this.outfitOf(b) });
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
    const line = { from: me.name, account: me.account ?? undefined, text, at: now };
    await this.store.addChat(line);
    for (const [peer, client] of this.clients) {
      if (!this.blocked(client.account, line.account)) send(peer, { t: 'chat', ...line });
    }
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
    if (w === null) return;
    const vsBot = m.seats.some(s=>s.isBot);
    const at = Date.now();
    for (const [i,seat] of m.seats.entries()) {
      if (!seat.account) continue;
      const won = i === w;
      if (vsBot) {
        if (w !== 'draw') await this.store.addResult(seat.account, won ? 'botWins' : 'botLosses');
      } else {
        await this.store.recordMatch({id:m.id,account:seat.account,opponent:m.seats[1-i].name,
          result:w==='draw'?'draw':won?'win':'loss',at,durationMs:Math.max(0,at-m.startedAt),
          arena:ARENAS[m.state.arena]?.id??ARENAS[0].id,turns:m.state.turn,outfit:sanitizeOutfit(m.state.fighters[i].outfit)});
      }
    }
  }

  close(ws: Sock) {
    this.clearInvites(ws);
    this.matchmaker.disconnect(ws);
    const had = this.clients.get(ws)?.name;
    this.clients.delete(ws);
    if (had) this.broadcastOnline();
  }
}
