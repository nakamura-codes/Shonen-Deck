import { OUTFIT_SLOTS, sanitizeOutfit, type AvatarId, isAvatar, type Contact, type PublicProfile, type MatchHistoryRow } from '@oficina/shared';

/**
 * Banco de dados das contas, vitórias/derrotas, sessões e chat.
 *
 * - Na Cloudflare: SQLite do Durable Object (SqlStore), que fica salvo para sempre.
 * - No servidor Node (desenvolvimento): memória + arquivo JSON (MemoryStore).
 *
 * A interface é a mesma para os dois, então a lógica do jogo (hub.ts) não sabe onde os dados estão.
 */
export interface Account {
  avatar?: AvatarId | null;
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
  account?: string;
  text: string;
  at: number;
}

export interface RankRow {
  name: string;
  wins: number;
  losses: number;
}

export interface RecordedMatch extends MatchHistoryRow { id: string; account: string }

type ProfileSummary = Pick<PublicProfile, 'draws' | 'playMs' | 'favorites' | 'recordedMatches' | 'rank' | 'history'>;
export interface Pair { first: string; second: string; requested: string | null; friend: boolean; blockFirst: boolean; blockSecond: boolean }

export interface Store {
  updateAvatar(key: string, id: AvatarId | null): Promise<void>;
  profileSummary(key: string): Promise<ProfileSummary>;
  pair(a: string, b: string): Pair;
  savePair(pair: Pair): void;
  contacts(key: string): Contact[];
  getAccount(key: string): Promise<Account | null>;
  /** Cria a conta; devolve false se o nome já existe. */
  createAccount(a: Account): Promise<boolean>;
  updateOutfit(key: string, outfit: string): Promise<void>;
  addResult(key: string, field: ResultField): Promise<void>;
  recordMatch(row: RecordedMatch): Promise<void>;
  matchHistory(key: string): Promise<MatchHistoryRow[]>;
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
  matches: RecordedMatch[];
  pairs: Pair[];
}

function emptyPair(a: string, b: string): Pair {
  const [first, second] = [a, b].sort();
  return { first, second, requested: null, friend: false, blockFirst: false, blockSecond: false };
}

function asContact(p: Pair, key: string, name: string): Contact[] {
  if (key === p.first ? p.blockFirst : p.blockSecond) return [{ name, state: 'blocked' }];
  if (p.blockFirst || p.blockSecond) return [];
  if (p.friend) return [{ name, state: 'friend' }];
  return p.requested ? [{ name, state: p.requested === key ? 'outgoing' : 'incoming' }] : [];
}

function publicMatch(row: MatchHistoryRow) {
  const { opponent, result, at, outfit } = row;
  return { opponent, result, at, outfit: sanitizeOutfit(outfit) };
}

export class MemoryStore implements Store {
  pair(a: string, b: string) {
    const base = emptyPair(a, b);
    return { ...(this.data.pairs.find(p => p.first === base.first && p.second === base.second) ?? base) };
  }
  savePair(pair: Pair) {
    this.data.pairs = this.data.pairs.filter(p => p.first !== pair.first || p.second !== pair.second);
    if (pair.friend || pair.requested || pair.blockFirst || pair.blockSecond) this.data.pairs.push({ ...pair });
    this.changed();
  }
  contacts(key: string) {
    return this.data.pairs.filter(p => p.first === key || p.second === key).flatMap(p =>
      asContact(p, key, this.data.accounts[p.first === key ? p.second : p.first].name));
  }
  async profileSummary(key: string): Promise<ProfileSummary> {
    const rows = await this.matchHistory(key);
    const acc = this.data.accounts[key];
    const rank = acc.wins + acc.losses ? 1 + Object.values(this.data.accounts).filter(a =>
      a.wins > acc.wins || (a.wins === acc.wins && a.losses < acc.losses && a.wins + a.losses > 0)).length : null;
    const favorites: ProfileSummary['favorites'] = { head: null, body: null, hand: null };
    for (const slot of OUTFIT_SLOTS) {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const id = row.outfit[slot];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const best = [...counts].sort(([a, n], [b, m]) => m - n || a.localeCompare(b))[0];
      if (best) favorites[slot] = { id: best[0], count: best[1] };
    }
    return { favorites, rank, history: rows.slice(0, 20).map(publicMatch), recordedMatches: rows.length,
      draws: rows.filter(r => r.result === 'draw').length, playMs: rows.reduce((sum, row) => sum + row.durationMs, 0) };
  }
  private data: MemoryData = { accounts: {}, sessions: {}, chat: [], matches: [], pairs: [] };
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** `persist` recebe os dados para gravar (ex.: num arquivo); `initial` são os dados já gravados. */
  constructor(
    initial?: Partial<MemoryData> | null,
    private persist?: (json: string) => void,
  ) {
    if (initial) this.data = { accounts: initial.accounts ?? {}, sessions: initial.sessions ?? {}, chat: initial.chat ?? [], matches: initial.matches ?? [], pairs: initial.pairs ?? [] };
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
  async updateAvatar(key: string, id: AvatarId | null) {
    const a = this.data.accounts[key];
    if (!a) return;
    a.avatar = id;
    this.changed();
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
  async recordMatch(row: RecordedMatch) {
    const acc = this.data.accounts[row.account];
    if (!acc || this.data.matches.some(m => m.id === row.id && m.account === row.account)) return;
    this.data.matches.push(structuredClone(row));
    if (row.result === 'win') acc.wins++;
    if (row.result === 'loss') acc.losses++;
    this.changed();
  }
  async matchHistory(key: string): Promise<MatchHistoryRow[]> {
    return this.data.matches.filter(m => m.account === key).sort((a,b) => b.at-a.at)
      .map(({ id, account, ...row }) => structuredClone(row));
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
    sql.exec(`CREATE TABLE IF NOT EXISTS relationships (
      first_key TEXT, second_key TEXT, requested TEXT, friend INTEGER, block_first INTEGER, block_second INTEGER,
      PRIMARY KEY(first_key, second_key))`);
    sql.exec('CREATE INDEX IF NOT EXISTS relationships_second ON relationships(second_key)');
    if (!sql.exec('PRAGMA table_info(accounts)').toArray().some(r => r.name === 'avatar')) {
      sql.exec('ALTER TABLE accounts ADD COLUMN avatar TEXT');
    }
    sql.exec(`CREATE INDEX IF NOT EXISTS accounts_rank ON accounts (wins DESC, losses ASC)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS pvp_history (
      match_id TEXT NOT NULL, account TEXT NOT NULL, opponent TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('win','loss','draw')), at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL, arena TEXT NOT NULL, turns INTEGER NOT NULL, outfit TEXT NOT NULL,
      PRIMARY KEY(match_id, account))`);
    sql.exec(`CREATE INDEX IF NOT EXISTS pvp_history_account ON pvp_history(account, at DESC)`);
    sql.exec(`CREATE TRIGGER IF NOT EXISTS pvp_history_result AFTER INSERT ON pvp_history
      BEGIN UPDATE accounts SET wins = wins + CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN NEW.result = 'loss' THEN 1 ELSE 0 END WHERE key = NEW.account; END`);
    sql.exec(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, key TEXT NOT NULL, created_at INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)`);
    if (!sql.exec('PRAGMA table_info(chat)').toArray().some(r => r.name === 'account')) {
      sql.exec('ALTER TABLE chat ADD COLUMN account TEXT');
    }
  }

  private readPair(r: Record<string, unknown>): Pair {
    return { first: String(r.first_key), second: String(r.second_key), requested: r.requested ? String(r.requested) : null,
      friend: Boolean(r.friend), blockFirst: Boolean(r.block_first), blockSecond: Boolean(r.block_second) };
  }
  pair(a: string, b: string) {
    const base = emptyPair(a, b);
    const [r] = this.sql.exec('SELECT * FROM relationships WHERE first_key = ? AND second_key = ?', base.first, base.second).toArray();
    return r ? this.readPair(r) : base;
  }
  savePair(p: Pair) {
    if (!p.friend && !p.requested && !p.blockFirst && !p.blockSecond) {
      this.sql.exec('DELETE FROM relationships WHERE first_key = ? AND second_key = ?', p.first, p.second);
      return;
    }
    this.sql.exec('INSERT OR REPLACE INTO relationships VALUES (?, ?, ?, ?, ?, ?)',
      p.first, p.second, p.requested, Number(p.friend), Number(p.blockFirst), Number(p.blockSecond));
  }
  contacts(key: string) {
    return this.sql.exec(`SELECT r.*, a.name FROM relationships r JOIN accounts a ON
      a.key = CASE WHEN first_key = ? THEN second_key ELSE first_key END
      WHERE first_key = ? OR second_key = ? ORDER BY a.key`, key, key, key).toArray()
      .flatMap(r => asContact(this.readPair(r), key, String(r.name)));
  }
  async profileSummary(key: string): Promise<ProfileSummary> {
    const [totals] = this.sql.exec(`SELECT count(*) AS n, sum(duration_ms) AS ms, sum(result = 'draw') AS draws
      FROM pvp_history WHERE account = ?`, key).toArray();
    const [rank] = this.sql.exec(`SELECT 1 + (SELECT count(*) FROM accounts b WHERE b.wins + b.losses > 0 AND
      (b.wins > a.wins OR (b.wins = a.wins AND b.losses < a.losses))) AS position
      FROM accounts a WHERE a.key = ? AND a.wins + a.losses > 0`, key).toArray();
    const favorites: ProfileSummary['favorites'] = { head: null, body: null, hand: null };
    for (const slot of OUTFIT_SLOTS) {
      const [best] = this.sql.exec(`SELECT json_extract(outfit, ?) AS item, count(*) AS n FROM pvp_history
        WHERE account = ? AND item IS NOT NULL GROUP BY item ORDER BY n DESC, item ASC LIMIT 1`, '$.' + slot, key).toArray();
      if (best) favorites[slot] = { id: String(best.item), count: Number(best.n) };
    }
    const history = this.sql.exec(`SELECT opponent, result, at, outfit FROM pvp_history
      WHERE account = ? ORDER BY at DESC, rowid DESC LIMIT 20`, key).toArray().map(r => ({
        opponent: String(r.opponent), result: r.result as MatchHistoryRow['result'], at: Number(r.at),
        outfit: sanitizeOutfit(JSON.parse(String(r.outfit))),
      }));
    return { favorites, history, rank: rank ? Number(rank.position) : null, draws: Number(totals.draws),
      recordedMatches: Number(totals.n), playMs: Number(totals.ms) };
  }

  private static row(r: Record<string, unknown>): Account {
    return {
      avatar: isAvatar(r.avatar) ? r.avatar : null,
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
  async updateAvatar(key: string, id: AvatarId | null) {
    this.sql.exec('UPDATE accounts SET avatar = ? WHERE key = ?', id, key);
  }
  async updateOutfit(key: string, outfit: string) {
    this.sql.exec('UPDATE accounts SET outfit = ? WHERE key = ?', outfit, key);
  }
  async addResult(key: string, field: ResultField) {
    const col = { wins: 'wins', losses: 'losses', botWins: 'bot_wins', botLosses: 'bot_losses' }[field];
    this.sql.exec(`UPDATE accounts SET ${col} = ${col} + 1 WHERE key = ?`, key);
  }
  async recordMatch(row: RecordedMatch) {
    this.sql.exec('INSERT OR IGNORE INTO pvp_history (match_id, account, opponent, result, at, duration_ms, arena, turns, outfit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      row.id, row.account, row.opponent, row.result, row.at, row.durationMs, row.arena, row.turns, JSON.stringify(row.outfit));
  }
  async matchHistory(key: string): Promise<MatchHistoryRow[]> {
    return this.sql.exec('SELECT opponent, result, at, duration_ms, arena, turns, outfit FROM pvp_history WHERE account = ? ORDER BY at DESC', key).toArray().map(r => ({
      opponent: String(r.opponent), result: String(r.result) as MatchHistoryRow['result'], at: Number(r.at),
      durationMs: Number(r.duration_ms), arena: String(r.arena), turns: Number(r.turns),
      outfit: JSON.parse(String(r.outfit)) as MatchHistoryRow['outfit'],
    }));
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
    this.sql.exec('INSERT INTO chat (sender, text, at, account) VALUES (?, ?, ?, ?)', line.from, line.text, line.at, line.account ?? null);
    this.sql.exec('DELETE FROM chat WHERE id NOT IN (SELECT id FROM chat ORDER BY id DESC LIMIT ?)', CHAT_KEEP);
  }
  async recentChat(limit: number) {
    return this.sql
      .exec('SELECT sender, text, at, account FROM chat ORDER BY id DESC LIMIT ?', limit)
      .toArray()
      .reverse()
      .map((r) => ({ from: String(r.sender), account: r.account ? String(r.account) : undefined, text: String(r.text), at: Number(r.at) }));
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
