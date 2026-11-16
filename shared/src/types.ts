export type PlayerIndex = 0 | 1;

export type CardType = 'attack' | 'skill' | 'power';
export type Rarity = 'common' | 'rare' | 'power';

export type PowerId = 'bankai' | 'gearSecond' | 'domain';

/** Efeitos que uma carta pode ter. Os números ficam nos dados (cards.ts). */
export type Effect =
  | { kind: 'damage'; amount: number; times?: number; pierce?: boolean; fixed?: boolean }
  | { kind: 'block'; amount: number }
  | { kind: 'strength'; amount: number; temporary?: boolean }
  | { kind: 'weak'; amount: number }
  | { kind: 'vulnerable'; amount: number }
  | { kind: 'loseHp'; amount: number }
  | { kind: 'drawNext'; amount: number }
  | { kind: 'reveal' }
  | { kind: 'clone' }
  | { kind: 'charge'; turns: number; damage: number; cancelOnDamage?: number }
  | { kind: 'power'; power: PowerId };

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  type: CardType;
  rarity: Rarity;
  text: string;
  effects: Effect[];
  /** Sai do baralho depois de usada. Poderes sempre saem. */
  exhaust?: boolean;
  /** Criada durante a partida (ex.: por combo); não entra em baralho nem roupa. */
  token?: boolean;
  /** Se ainda estiver na mão no fim do turno, some. */
  ethereal?: boolean;
}

export interface ComboDef {
  requires: string[];
  creates: string;
}

export interface CardInstance {
  uid: string;
  id: string;
}

export type OutfitSlot = 'head' | 'body';

export interface OutfitItem {
  id: string;
  slot: OutfitSlot;
  name: string;
  cards: string[];
}

/** Peça vestida em cada espaço; null = vazio (boneco cinza). */
export type Outfit = Record<OutfitSlot, string | null>;

export interface Charge {
  uid: string;
  cardId: string;
  turnsLeft: number;
  damage: number;
  cancelOnDamage?: number;
}

export interface QueuedCard {
  card: CardInstance;
  doubled: boolean;
}

export interface Fighter {
  name: string;
  outfit: Outfit;
  hp: number;
  maxHp: number;
  block: number;
  ki: number;
  strength: number;
  tempStrength: number;
  weak: number;
  vulnerable: number;
  powers: PowerId[];
  charges: Charge[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhausted: CardInstance[];
  queue: QueuedCard[];
  ready: boolean;
  revealing: boolean;
  cloneNext: boolean;
  bonusDraw: number;
  damageTakenThisTurn: number;
  /** Fraco/Vulnerável aplicados neste turno só começam a diminuir no fim do turno seguinte. */
  decayWeak: boolean;
  decayVulnerable: boolean;
  /** Combo feito neste turno: a carta criada chega no próximo. */
  pendingCombo: string | null;
  /** Turno travado: só pode jogar esta carta (de graça). */
  lockedTo: string | null;
}

export interface BattleState {
  seed: number;
  rngState: number;
  turn: number;
  phase: 'planning' | 'over';
  fighters: [Fighter, Fighter];
  winner: PlayerIndex | 'draw' | null;
  uidCounter: number;
  /** Quem a moeda escolheu para começar o turno 1. Depois alterna. */
  firstPlayer: PlayerIndex;
}

export type BattleEvent =
  | { type: 'play'; player: PlayerIndex; cardId: string; doubled: boolean }
  | { type: 'damage'; source: PlayerIndex; target: PlayerIndex; cardId: string; amount: number; blocked: number }
  | { type: 'block'; player: PlayerIndex; amount: number }
  | { type: 'status'; player: PlayerIndex; status: 'strength' | 'weak' | 'vulnerable'; amount: number; cardId?: string }
  | { type: 'hpLoss'; player: PlayerIndex; amount: number; reason: string }
  | { type: 'power'; player: PlayerIndex; power: PowerId }
  | { type: 'chargeStart'; player: PlayerIndex; cardId: string; turns: number }
  | { type: 'chargeFire'; player: PlayerIndex; cardId: string }
  | { type: 'chargeCancel'; player: PlayerIndex; cardId: string }
  | { type: 'combo'; player: PlayerIndex; cardId: string }
  | { type: 'gameOver'; winner: PlayerIndex | 'draw' };

/** O que cada jogador pode ver (sem as cartas escondidas do oponente). */
export interface FighterPublicView {
  name: string;
  outfit: Outfit;
  hp: number;
  maxHp: number;
  block: number;
  ki: number;
  strength: number;
  tempStrength: number;
  weak: number;
  vulnerable: number;
  powers: PowerId[];
  charges: Charge[];
  handCount: number;
  drawCount: number;
  discardCount: number;
  queueCount: number;
  ready: boolean;
  maxKi: number;
  lockedTo: string | null;
}

export interface BattleView {
  you: PlayerIndex;
  turn: number;
  phase: BattleState['phase'];
  winner: BattleState['winner'];
  firstPlayer: PlayerIndex;
  /** Quem resolve primeiro neste turno. */
  turnStarter: PlayerIndex;
  me: FighterPublicView & {
    hand: CardInstance[];
    queue: QueuedCard[];
    cloneNext: boolean;
    revealing: boolean;
    /** Red + Blue já na fila: nenhuma outra carta neste turno. */
    comboLock: boolean;
  };
  opponent: FighterPublicView & { queue: QueuedCard[] | null };
}
