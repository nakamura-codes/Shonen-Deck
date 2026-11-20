import { EMPTY_OUTFIT, sanitizeOutfit, type AvatarId, type BattleView, type ClientMessage, type Outfit, type PlayerStats, type ServerMessage } from '@oficina/shared';
import { Net, defaultServerUrl } from './net.ts';

const PROFILE_KEY = 'oficina.profile';

interface Profile {
  created: boolean;
  name: string;
  outfit: Outfit;
}

function loadProfile(): Profile {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { created: p.created === true, name: typeof p.name === 'string' ? p.name : '', outfit: sanitizeOutfit(p.outfit) };
    }
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return { created: false, name: '', outfit: { ...EMPTY_OUTFIT } };
}

const profile = loadProfile();

/** Estado compartilhado entre as cenas. O personagem fica salvo neste navegador. */
export const session = {
  net: new Net(defaultServerUrl()),
  created: profile.created,
  name: profile.name || `Jogador${Math.floor(Math.random() * 900 + 100)}`,
  outfit: profile.outfit,
  match: null as Extract<ServerMessage, { t: 'match' }> | null,
  /** Último estado recebido (a cena de batalha pode abrir depois da primeira mensagem chegar). */
  lastView: null as null | { view: BattleView; deadline: number },
  save() {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ created: this.created, name: this.name, outfit: this.outfit }));
      auth.saveCurrent();
    } catch {
      /* ignora: o personagem só não fica salvo */
    }
  },
  reset() {
    this.created = false;
    this.name = '';
    this.outfit = { ...EMPTY_OUTFIT };
    this.save();
  },
};

// ───────────────────────── Contas (guardadas no servidor) ─────────────────────────
// A conta (nome, senha, roupas, vitórias e derrotas) fica no banco do servidor. O navegador guarda só
// a "sessão" (um código para não precisar digitar a senha toda vez). Convidados ficam só no navegador.

const SESSION_KEY = 'shonen.session';
const CURRENT_KEY = 'shonen.current';
/** Contas antigas, de quando tudo ficava no navegador (usadas só para migrar para o servidor). */
const OLD_ACCOUNTS_KEY = 'shonen.accounts';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null) {
  try {
    if (v === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, v);
  } catch {
    /* ignora */
  }
}

async function oldHash(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`shonen-deck:${text}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return text;
  }
}

const cleanName = (n: string) => n.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);

export const auth = {
  /** Vitórias e derrotas da conta (null para convidado ou antes do servidor responder). */
  stats: null as PlayerStats | null,
  avatar: null as AvatarId | null,
  get loggedIn(): boolean {
    return !!read(CURRENT_KEY);
  },
  get isGuest(): boolean {
    return (read(CURRENT_KEY) ?? '').startsWith('guest:');
  },
  /** Entra (ou cria a conta, com `create`). Devolve a mensagem de erro, ou null se deu certo. */
  async login(rawName: string, password: string, create: boolean): Promise<string | null> {
    const name = cleanName(rawName);
    if (name.length < 3) return 'O nome precisa ter pelo menos 3 letras.';
    if (password.length < 4) return 'A senha precisa ter pelo menos 4 caracteres.';
    let res = await request({ t: create ? 'register' : 'login', name, pass: password });
    // Conta antiga, que existia só neste navegador: cria no servidor com a mesma senha.
    if (!create && res.t === 'authError' && res.message.startsWith('Conta não encontrada')) {
      try {
        const old = JSON.parse(read(OLD_ACCOUNTS_KEY) ?? '{}')[name.toLowerCase()];
        if (old?.passHash && old.passHash === (await oldHash(password))) {
          res = await request({ t: 'register', name, pass: password });
          if (res.t === 'authOk') session.net.send({ t: 'saveOutfit', outfit: sanitizeOutfit(old.outfit) });
        }
      } catch {
        /* sem conta antiga */
      }
    }
    if (res.t === 'authError') return res.message;
    return null;
  },
  /** Entra como convidado (nome aleatório, sem senha; nada vai para o ranking). */
  guest() {
    const name = `Convidado${Math.floor(Math.random() * 9000 + 1000)}`;
    write(SESSION_KEY, null);
    write(CURRENT_KEY, `guest:${name}`);
    session.name = name;
    auth.stats = null;
    auth.avatar = null;
    session.net.send({ t: 'hello', name });
  },
  logout() {
    session.net.send({ t: 'logout' });
    write(SESSION_KEY, null);
    write(CURRENT_KEY, null);
    auth.stats = null;
    auth.avatar = null;
  },
  /** Guarda as roupas na conta (no servidor). */
  saveCurrent() {
    if (read(SESSION_KEY)) session.net.send({ t: 'saveOutfit', outfit: session.outfit });
  },
};

type AuthReply = Extract<ServerMessage, { t: 'authOk' } | { t: 'authError' }>;

/** Manda um pedido de login/cadastro e espera a resposta do servidor. */
function request(msg: ClientMessage): Promise<AuthReply> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => (off(), resolve({ t: 'authError', message: 'Sem conexão com o servidor. Tente de novo.' })), 10_000);
    const off = session.net.on((m) => {
      if (m.t !== 'authOk' && m.t !== 'authError') return;
      if (m.t === 'authError' && m.silent) return;
      clearTimeout(timer);
      off();
      resolve(m);
    });
    session.net.send(msg);
  });
}

// Respostas do servidor sobre a conta.
session.net.on((msg) => {
  if (msg.t === 'authOk') {
    write(SESSION_KEY, msg.session);
    write(CURRENT_KEY, msg.name.toLowerCase());
    session.name = msg.name;
    session.outfit = sanitizeOutfit(msg.outfit);
    auth.stats = msg.stats;
    auth.avatar = msg.avatar ?? null;
  } else if (msg.t === 'avatarSaved') {
    auth.avatar = msg.avatar;
  } else if (msg.t === 'authError' && msg.silent) {
    // Sessão expirou: volta a pedir login na próxima vez.
    write(SESSION_KEY, null);
    write(CURRENT_KEY, null);
  } else if (msg.t === 'stats') {
    auth.stats = msg.stats;
  }
});

// Ao abrir (e a cada reconexão): apresenta-se para o chat e retoma a conta.
session.net.onOpen(() => {
  const current = read(CURRENT_KEY);
  if (current?.startsWith('guest:')) session.name = current.slice(6);
  const token = read(SESSION_KEY);
  if (token) session.net.send({ t: 'resume', session: token });
  else session.net.send({ t: 'hello', name: session.name });
});

session.net.on((msg) => {
  if (msg.t === 'match') {
    session.match = msg;
    session.lastView = null;
  }
  if (msg.t === 'state' || msg.t === 'resolved') {
    session.lastView = { view: msg.view, deadline: Date.now() + msg.remainingMs };
  }
});
