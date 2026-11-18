/**
 * Banco de dados das contas, vitórias/derrotas, sessões e chat.
 *
 * - Na Cloudflare: SQLite do Durable Object (SqlStore), que fica salvo para sempre.
 * - No servidor Node (desenvolvimento): memória + arquivo JSON (MemoryStore).
 *
 * A interface é a mesma para os dois, então a lógica do jogo (hub.ts) não sabe onde os dados estão.
 */
export interface Account {
  /** Nome em minúsculas (único). */
  key: string;
  /** Nome como o jogador escreveu. */
  name: string;
  salt: string;
  hash: string;
  /** Roupas vestidas (JSON). */
  outfit: string;
  /** Partidas contra outros jogadores. */
  wins: number;
  losses: number;
  /** Treinos contra o bot (não contam no ranking). */
  botWins: number;
  botLosses: number;
  createdAt: number;
}

export type ResultField = 'wins' | 'losses' | 'botWins' | 'botLosses';

export interface ChatLine {
  from: string;
  text: string;
  at: number;
}

export interface RankRow {
  name: string;
  wins: number;
  losses: number;
}

export interface Store {
  getAccount(key: string): Promise<Account | null>;
  /** Cria a conta; devolve false se o nome já existe. */
  createAccount(a: Account): Promise<boolean>;
  updateOutfit(key: string, outfit: string): Promise<void>;
  addResult(key: string, field: ResultField): Promise<void>;
  createSession(token: string, key: string): Promise<void>;
  getSession(token: string): Promise<string | null>;
  deleteSession(token: string): Promise<void>;
  /** Ranking: mais vitórias primeiro (empate: menos derrotas). */
  top(limit: number): Promise<RankRow[]>;
  addChat(line: ChatLine): Promise<void>;
  recentChat(limit: number): Promise<ChatLine[]>;
}

export const CHAT_KEEP = 50;

// ───────────────────────── Memória (+ arquivo JSON opcional) ─────────────────────────

interface MemoryData {
  accounts: Record<string, Account>;
  sessions: Record<string, string>;
  chat: ChatLine[];
}

export class MemoryStore implements Store {
  private data: MemoryData = { accounts: {}, sessions: {}, chat: [] };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** `persist` recebe os dados para gravar (ex.: num arquivo); `initial` são os dados já gravados. */
  constructor(
    initial?: Partial<MemoryData> | null,
    private persist?: (json: string) => void,
  ) {
    if (initial) this.data = { accounts: initial.accounts ?? {}, sessions: initial.sessions ?? {}, chat: initial.chat ?? [] };
  }

  private changed() {
    if (!this.persist || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persist?.(JSON.stringify(this.data));
    }, 300);
  }

  async getAccount(key: string) {
    const a = this.data.accounts[key];
    return a ? { ...a } : null;
  }
  async createAccount(a: Account) {
    if (this.data.accounts[a.key]) return false;
    this.data.accounts[a.key] = { ...a };
    this.changed();
    return true;
  }
  async updateOutfit(key: string, outfit: string) {
    const a = this.data.accounts[key];
    if (!a) return;
    a.outfit = outfit;
    this.changed();
  }
  async addResult(key: string, field: ResultField) {
    const a = this.data.accounts[key];
    if (!a) return;
    a[field] += 1;
    this.changed();
  }
  async createSession(token: string, key: string) {
    this.data.sessions[token] = key;
    this.changed();
  }
  async getSession(token: string) {
    return this.data.sessions[token] ?? null;
  }
  async deleteSession(token: string) {
    delete this.data.sessions[token];
    this.changed();
  }
  async top(limit: number) {
    return Object.values(this.data.accounts)
      .filter((a) => a.wins + a.losses > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .slice(0, limit)
      .map((a) => ({ name: a.name, wins: a.wins, losses: a.losses }));
  }
  async addChat(line: ChatLine) {
    this.data.chat.push(line);
    if (this.data.chat.length > CHAT_KEEP) this.data.chat.splice(0, this.data.chat.length - CHAT_KEEP);
    this.changed();
  }
  async recentChat(limit: number) {
    return this.data.chat.slice(-limit);
  }
}

// ───────────────────────── SQLite (Durable Object da Cloudflare) ─────────────────────────

/** O pedaço da API `ctx.storage.sql` da Cloudflare que usamos. */
export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
}

export class SqlStore implements Store {
  constructor(private sql: SqlLike) {
    sql.exec(`CREATE TABLE IF NOT EXISTS accounts (
      key TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
      outfit TEXT NOT NULL DEFAULT '{}', wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
      bot_wins INTEGER NOT NULL DEFAULT 0, bot_losses INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS accounts_rank ON accounts (wins DESC, losses ASC)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, key TEXT NOT NULL, created_at INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`);
  }

  private static row(r: Record<string, unknown>): Account {
    return {
      key: String(r.key),
      name: String(r.name),
      salt: String(r.salt),
      hash: String(r.hash),
      outfit: String(r.outfit),
      wins: Number(r.wins),
      losses: Number(r.losses),
      botWins: Number(r.bot_wins),
      botLosses: Number(r.bot_losses),
      createdAt: Number(r.created_at),
    };
  }

  async getAccount(key: string) {
    const rows = this.sql.exec('SELECT * FROM accounts WHERE key = ?', key).toArray();
    return rows.length ? SqlStore.row(rows[0]) : null;
  }
  async createAccount(a: Account) {
    if (await this.getAccount(a.key)) return false;
    this.sql.exec(
      'INSERT INTO accounts (key, name, salt, hash, outfit, wins, losses, bot_wins, bot_losses, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      a.key, a.name, a.salt, a.hash, a.outfit, a.wins, a.losses, a.botWins, a.botLosses, a.createdAt,
    );
    return true;
  }
  async updateOutfit(key: string, outfit: string) {
    this.sql.exec('UPDATE accounts SET outfit = ? WHERE key = ?', outfit, key);
  }
  async addResult(key: string, field: ResultField) {
    const col = { wins: 'wins', losses: 'losses', botWins: 'bot_wins', botLosses: 'bot_losses' }[field];
    this.sql.exec(`UPDATE accounts SET ${col} = ${col} + 1 WHERE key = ?`, key);
  }
  async createSession(token: string, key: string) {
    this.sql.exec('INSERT OR REPLACE INTO sessions (token, key, created_at) VALUES (?, ?, ?)', token, key, Date.now());
  }
  async getSession(token: string) {
    const rows = this.sql.exec('SELECT key FROM sessions WHERE token = ?', token).toArray();
    return rows.length ? String(rows[0].key) : null;
  }
  async deleteSession(token: string) {
    this.sql.exec('DELETE FROM sessions WHERE token = ?', token);
  }
  async top(limit: number) {
    return this.sql
      .exec('SELECT name, wins, losses FROM accounts WHERE wins + losses > 0 ORDER BY wins DESC, losses ASC LIMIT ?', limit)
      .toArray()
      .map((r) => ({ name: String(r.name), wins: Number(r.wins), losses: Number(r.losses) }));
  }
  async addChat(line: ChatLine) {
    this.sql.exec('INSERT INTO chat (sender, text, at) VALUES (?, ?, ?)', line.from, line.text, line.at);
    this.sql.exec('DELETE FROM chat WHERE id NOT IN (SELECT id FROM chat ORDER BY id DESC LIMIT ?)', CHAT_KEEP);
  }
  async recentChat(limit: number) {
    return this.sql
      .exec('SELECT sender, text, at FROM chat ORDER BY id DESC LIMIT ?', limit)
      .toArray()
      .reverse()
      .map((r) => ({ from: String(r.sender), text: String(r.text), at: Number(r.at) }));
  }
}

// ───────────────────────── Senhas ─────────────────────────

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return hex(a);
}

/** PBKDF2-SHA256 (WebCrypto: funciona no Node e na Cloudflare). */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 20000 }, key, 256);
  return hex(bits);
}

/** Compara sem revelar pelo tempo onde a diferença está. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
