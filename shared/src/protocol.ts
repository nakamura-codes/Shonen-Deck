import type { BattleEvent, BattleView, BotLevel, Outfit, PlayerIndex } from './types.ts';

/** Mensagens do cliente para o servidor. O cliente só envia intenções. */
export type ClientMessage =
  | { t: 'join'; name: string; outfit: Outfit; vsBot?: boolean; botLevel?: BotLevel }
  | { t: 'rejoin'; token: string }
  | { t: 'leaveQueue' }
  | { t: 'play'; uid: string }
  | { t: 'undo' }
  | { t: 'moveFirst'; uid: string }
  | { t: 'keep'; uid: string }
  | { t: 'ready' }
  // Contas (guardadas no servidor).
  | { t: 'register'; name: string; pass: string }
  | { t: 'login'; name: string; pass: string }
  | { t: 'resume'; session: string }
  | { t: 'logout' }
  | { t: 'saveOutfit'; outfit: Outfit }
  | { t: 'stats' }
  | { t: 'leaderboard' }
  // Chat global.
  | { t: 'hello'; name: string }
  | { t: 'chat'; text: string };

/** Mensagens do servidor para o cliente. */
export type ServerMessage =
  | { t: 'queued' }
  | { t: 'match'; you: PlayerIndex; opponentName: string; token: string }
  | { t: 'state'; view: BattleView; remainingMs: number }
  | { t: 'resolved'; events: BattleEvent[]; view: BattleView; remainingMs: number }
  | { t: 'opponentStatus'; connected: boolean }
  | { t: 'error'; message: string }
  | { t: 'authOk'; name: string; session: string; outfit: Outfit; stats: PlayerStats }
  | { t: 'authError'; message: string; silent?: boolean }
  | { t: 'stats'; stats: PlayerStats }
  | { t: 'leaderboard'; rows: { name: string; wins: number; losses: number }[] }
  | { t: 'chat'; from: string; text: string; at: number }
  | { t: 'chatHistory'; messages: { from: string; text: string; at: number }[] }
  | { t: 'online'; count: number };

/** Vitórias e derrotas da conta: contra jogadores (ranking) e contra o bot (treino). */
export interface PlayerStats {
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
}

export const CHAT_MAX_LENGTH = 200;

export const TURN_SECONDS = 30;
export const RECONNECT_SECONDS = 30;
