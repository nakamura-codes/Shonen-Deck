import type { BattleEvent, BattleView, Outfit, PlayerIndex } from './types.ts';

/** Mensagens do cliente para o servidor. O cliente só envia intenções. */
export type ClientMessage =
  | { t: 'join'; name: string; outfit: Outfit; vsBot?: boolean }
  | { t: 'rejoin'; token: string }
  | { t: 'leaveQueue' }
  | { t: 'play'; uid: string }
  | { t: 'undo' }
  | { t: 'moveFirst'; uid: string }
  | { t: 'keep'; uid: string }
  | { t: 'ready' };

/** Mensagens do servidor para o cliente. */
export type ServerMessage =
  | { t: 'queued' }
  | { t: 'match'; you: PlayerIndex; opponentName: string; token: string }
  | { t: 'state'; view: BattleView; remainingMs: number }
  | { t: 'resolved'; events: BattleEvent[]; view: BattleView; remainingMs: number }
  | { t: 'opponentStatus'; connected: boolean }
  | { t: 'error'; message: string };

export const TURN_SECONDS = 30;
export const RECONNECT_SECONDS = 30;
