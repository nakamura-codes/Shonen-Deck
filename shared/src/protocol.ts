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
  | { t: 'saveAvatar'; avatar: AvatarId | null }
  | { t: 'stats' }
  | { t: 'leaderboard' }
  | { t: 'profile'; name: string }
  | { t: 'social' }
  | { t: 'relationship'; name: string; action: SocialAction }
  | { t: 'duel'; name: string; accept?: boolean }
  // Chat global.
  | { t: 'hello'; name: string }
  | { t: 'chat'; text: string };

/** Mensagens do servidor para o cliente. */
export type ServerMessage =
  | { t: 'queued' }
  | { t: 'match'; you: PlayerIndex; opponentName: string; token: string; avatars?: [AvatarId | null, AvatarId | null]; resumed?: boolean }
  | { t: 'state'; view: BattleView; remainingMs: number }
  | { t: 'resolved'; events: BattleEvent[]; view: BattleView; remainingMs: number }
  | { t: 'opponentStatus'; connected: boolean }
  | { t: 'error'; message: string }
  | { t: 'avatarSaved'; avatar: AvatarId | null }
  | { t: 'authOk'; avatar?: AvatarId | null; name: string; session: string; outfit: Outfit; stats: PlayerStats }
  | { t: 'authError'; message: string; silent?: boolean }
  | { t: 'stats'; stats: PlayerStats }
  | { t: 'leaderboard'; rows: { name: string; wins: number; losses: number }[] }
  | { t: 'chat'; from: string; text: string; at: number; account?: string }
  | { t: 'chatHistory'; messages: { from: string; text: string; at: number; account?: string }[] }
  | { t: 'online'; count: number }
  | { t: 'social'; contacts: Contact[] }
  | { t: 'socialNotice'; message: string }
  | { t: 'duelInvite'; from: string }
  | { t: 'profile'; profile: PublicProfile }
  | { t: 'profileError'; name: string; message: string };

export type SocialAction = 'request' | 'accept' | 'remove' | 'block' | 'unblock';
export type ContactState = 'incoming' | 'outgoing' | 'friend' | 'blocked';
export interface Contact { name: string; state: ContactState }

export interface MatchHistoryRow {
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  at: number;
  durationMs: number;
  arena: string;
  turns: number;
  outfit: Outfit;
}
export const AVATARS = {
  naruto: 'Naruto clássico', goku: 'Goku', luffy: 'Luffy com chapéu', ichigo: 'Ichigo', gojo: 'Gojo',
  'naruto-bandana': 'Naruto de perfil', trunks: 'Trunks', 'luffy-chapeu': 'Luffy com chapéu nas costas',
  'ichigo-espada': 'Ichigo com espada', nanami: 'Nanami',
} as const;
export type AvatarId = keyof typeof AVATARS;
export function isAvatar(value: unknown): value is AvatarId {
  return typeof value === 'string' && Object.hasOwn(AVATARS, value);
}

export interface PublicProfile {
  avatar: AvatarId | null;
  name: string;
  createdAt: number;
  outfit: Outfit;
  wins: number;
  losses: number;
  draws: number;
  recordedMatches: number;
  playMs: number;
  favorites: Record<keyof Outfit, { id: string; count: number } | null>;
  rank: number | null;
  history: Pick<MatchHistoryRow, 'opponent' | 'result' | 'at' | 'outfit'>[];
}

/** Vitórias e derrotas da conta: contra jogadores (ranking) e contra o bot (treino). */
export interface PlayerStats {
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
}

export const CHAT_MAX_LENGTH = 200;

export const VS_INTRO_MS = 1600;
export const TURN_SECONDS = 30;
export const RECONNECT_SECONDS = 30;
