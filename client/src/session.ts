import { EMPTY_OUTFIT, sanitizeOutfit, type BattleView, type Outfit, type PlayerIndex } from '@oficina/shared';
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
  match: null as null | { you: PlayerIndex; opponentName: string },
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

// ───────────────────────── Contas (por enquanto, só neste navegador) ─────────────────────────
// Até termos servidor com banco de dados, as contas ficam no localStorage: nome + hash da senha +
// roupas. Serve para testes; não é segurança de verdade.

const ACCOUNTS_KEY = 'shonen.accounts';
const CURRENT_KEY = 'shonen.current';

interface Account {
  name: string;
  passHash: string | null;
  outfit: Outfit;
}

function loadAccounts(): Record<string, Account> {
  try {
    return JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function storeAccounts(a: Record<string, Account>) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
  } catch {
    /* ignora */
  }
}

async function hash(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`shonen-deck:${text}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return text; // sem crypto.subtle (http sem https): guarda como veio
  }
}

const cleanName = (n: string) => n.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16);

export const auth = {
  get loggedIn(): boolean {
    try {
      return !!window.localStorage.getItem(CURRENT_KEY);
    } catch {
      return false;
    }
  },
  /** Entra (ou cria a conta, com `create`). Devolve a mensagem de erro, ou null se deu certo. */
  async login(rawName: string, password: string, create: boolean): Promise<string | null> {
    const name = cleanName(rawName);
    if (name.length < 3) return 'O nome precisa ter pelo menos 3 letras.';
    if (password.length < 4) return 'A senha precisa ter pelo menos 4 caracteres.';
    const accounts = loadAccounts();
    const key = name.toLowerCase();
    const h = await hash(password);
    const acc = accounts[key];
    if (create) {
      if (acc) return 'Esse nome já tem conta neste navegador. Use Entrar.';
      accounts[key] = { name, passHash: h, outfit: { ...EMPTY_OUTFIT } };
    } else {
      if (!acc) return 'Conta não encontrada. Use Criar conta.';
      if (acc.passHash !== h) return 'Senha incorreta.';
    }
    storeAccounts(accounts);
    this.enter(accounts[key]);
    return null;
  },
  /** Entra como convidado (nome aleatório, sem senha). */
  guest() {
    const accounts = loadAccounts();
    let name = '';
    do name = `Convidado${Math.floor(Math.random() * 9000 + 1000)}`;
    while (accounts[name.toLowerCase()]);
    accounts[name.toLowerCase()] = { name, passHash: null, outfit: { ...EMPTY_OUTFIT } };
    storeAccounts(accounts);
    this.enter(accounts[name.toLowerCase()]);
  },
  enter(acc: Account) {
    session.name = acc.name;
    session.outfit = sanitizeOutfit(acc.outfit);
    try {
      window.localStorage.setItem(CURRENT_KEY, acc.name.toLowerCase());
    } catch {
      /* ignora */
    }
  },
  logout() {
    try {
      window.localStorage.removeItem(CURRENT_KEY);
    } catch {
      /* ignora */
    }
  },
  /** Guarda as roupas (e o nome) na conta atual. */
  saveCurrent() {
    try {
      const key = window.localStorage.getItem(CURRENT_KEY);
      if (!key) return;
      const accounts = loadAccounts();
      if (!accounts[key]) return;
      accounts[key].outfit = session.outfit;
      storeAccounts(accounts);
    } catch {
      /* ignora */
    }
  },
};

// Ao abrir o jogo já logado, carrega as roupas da conta.
try {
  const key = window.localStorage.getItem(CURRENT_KEY);
  const acc = key ? loadAccounts()[key] : undefined;
  if (acc) {
    session.name = acc.name;
    session.outfit = sanitizeOutfit(acc.outfit);
  }
} catch {
  /* ignora */
}

session.net.on((msg) => {
  if (msg.t === 'match') session.lastView = null;
  if (msg.t === 'state' || msg.t === 'resolved') {
    session.lastView = { view: msg.view, deadline: Date.now() + msg.remainingMs };
  }
});
