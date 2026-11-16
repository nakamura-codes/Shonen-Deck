import { BASE_DECK, cardPhase, getCard } from './cards.ts';
import { outfitCards } from './outfits.ts';
import { shuffle } from './rng.ts';
import type {
  BattleEvent,
  BattleState,
  BattleView,
  CardInstance,
  Fighter,
  FighterPublicView,
  Outfit,
  PlayerIndex,
  QueuedCard,
} from './types.ts';

export const RULES = {
  maxHp: 60,
  kiPerTurn: 3,
  drawPerTurn: 5,
  maxHandSize: 10,
  turnLimit: 40,
  bankaiBonus: 3,
} as const;

export interface PlayerSetup {
  name: string;
  outfit: Outfit;
}

export type ActionResult = { ok: true; state: BattleState } | { ok: false; error: string };

const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

function clone<T>(v: T): T {
  return structuredClone(v);
}

function newFighter(setup: PlayerSetup, cards: CardInstance[]): Fighter {
  return {
    name: setup.name,
    outfit: setup.outfit,
    hp: RULES.maxHp,
    maxHp: RULES.maxHp,
    block: 0,
    ki: 0,
    strength: 0,
    tempStrength: 0,
    weak: 0,
    vulnerable: 0,
    powers: [],
    charges: [],
    drawPile: cards,
    hand: [],
    discard: [],
    exhausted: [],
    queue: [],
    ready: false,
    revealing: false,
    cloneNext: false,
    bonusDraw: 0,
    damageTakenThisTurn: 0,
    decayWeak: false,
    decayVulnerable: false,
  };
}

export function buildDeck(outfit: Outfit): string[] {
  return [...BASE_DECK, ...outfitCards(outfit)];
}

/** Cria a batalha e já começa o turno 1 (cartas compradas). */
export function createBattle(seed: number, players: [PlayerSetup, PlayerSetup]): BattleState {
  let rng = seed >>> 0;
  let uid = 0;
  const fighters = players.map((setup) => {
    const cards = buildDeck(setup.outfit).map((id) => ({ uid: `c${uid++}`, id }));
    const [shuffled, next] = shuffle(cards, rng);
    rng = next;
    return newFighter(setup, shuffled);
  }) as [Fighter, Fighter];

  const state: BattleState = {
    seed,
    rngState: rng,
    turn: 0,
    phase: 'planning',
    fighters,
    winner: null,
    uidCounter: uid,
  };
  startTurn(state, []);
  return state;
}

function draw(state: BattleState, f: Fighter, n: number) {
  for (let i = 0; i < n; i++) {
    if (f.hand.length >= RULES.maxHandSize) return;
    if (f.drawPile.length === 0) {
      if (f.discard.length === 0) return;
      const [shuffled, next] = shuffle(f.discard, state.rngState);
      state.rngState = next;
      f.drawPile = shuffled;
      f.discard = [];
    }
    f.hand.push(f.drawPile.shift()!);
  }
}

function startTurn(state: BattleState, events: BattleEvent[]) {
  state.turn += 1;
  state.phase = 'planning';
  for (const p of [0, 1] as PlayerIndex[]) {
    const f = state.fighters[p];
    f.block = 0;
    f.ki = RULES.kiPerTurn;
    f.queue = [];
    f.ready = false;
    f.revealing = false;
    f.cloneNext = false;
    f.damageTakenThisTurn = 0;
  }
  // Poderes ativos acontecem no início do turno.
  for (const p of [0, 1] as PlayerIndex[]) {
    const f = state.fighters[p];
    for (const power of f.powers) {
      if (power === 'gearSecond') {
        f.ki += 1;
        loseHp(f, p, 2, 'Gear Second', events);
      } else if (power === 'domain') {
        state.fighters[other(p)].weak += 1;
        events.push({ type: 'status', player: other(p), status: 'weak', amount: 1 });
      }
    }
  }
  for (const f of state.fighters) {
    f.decayWeak = f.weak > 0;
    f.decayVulnerable = f.vulnerable > 0;
    draw(state, f, RULES.drawPerTurn + f.bonusDraw);
    f.bonusDraw = 0;
  }
  checkGameOver(state, events);
}

function loseHp(f: Fighter, p: PlayerIndex, amount: number, reason: string, events: BattleEvent[]) {
  f.hp = Math.max(0, f.hp - amount);
  events.push({ type: 'hpLoss', player: p, amount, reason });
}

/** Recalcula as marcas que dependem da fila (clone pendente e Sharingan). */
function recomputeQueueFlags(f: Fighter) {
  let cloneNext = false;
  let revealing = false;
  for (const q of f.queue) {
    const def = getCard(q.card.id);
    if (def.effects.some((e) => e.kind === 'reveal')) revealing = true;
    if (def.effects.some((e) => e.kind === 'clone')) cloneNext = true;
    else cloneNext = false;
  }
  f.cloneNext = cloneNext;
  f.revealing = revealing;
}

/** Jogador coloca uma carta da mão na fila do turno (escondida até a revelação). */
export function playCard(state: BattleState, player: PlayerIndex, cardUid: string): ActionResult {
  if (state.phase !== 'planning') return { ok: false, error: 'A partida não está na fase de escolha.' };
  const f = state.fighters[player];
  if (f.ready) return { ok: false, error: 'Você já confirmou este turno.' };
  const idx = f.hand.findIndex((c) => c.uid === cardUid);
  if (idx < 0) return { ok: false, error: 'Essa carta não está na sua mão.' };
  const def = getCard(f.hand[idx].id);
  if (def.cost > f.ki) return { ok: false, error: 'Ki insuficiente.' };

  const next = clone(state);
  const nf = next.fighters[player];
  const [card] = nf.hand.splice(idx, 1);
  nf.ki -= def.cost;
  const isClone = def.effects.some((e) => e.kind === 'clone');
  nf.queue.push({ card, doubled: nf.cloneNext && !isClone });
  recomputeQueueFlags(nf);
  return { ok: true, state: next };
}

/** Desfaz a última carta colocada na fila. */
export function undoLastCard(state: BattleState, player: PlayerIndex): ActionResult {
  if (state.phase !== 'planning') return { ok: false, error: 'A partida não está na fase de escolha.' };
  const f = state.fighters[player];
  if (f.ready) return { ok: false, error: 'Você já confirmou este turno.' };
  if (f.queue.length === 0) return { ok: false, error: 'Nenhuma carta para desfazer.' };
  const next = clone(state);
  const nf = next.fighters[player];
  const q = nf.queue.pop()!;
  nf.ki += getCard(q.card.id).cost;
  nf.hand.push(q.card);
  recomputeQueueFlags(nf);
  return { ok: true, state: next };
}

export function setReady(state: BattleState, player: PlayerIndex): ActionResult {
  if (state.phase !== 'planning') return { ok: false, error: 'A partida não está na fase de escolha.' };
  const next = clone(state);
  next.fighters[player].ready = true;
  return { ok: true, state: next };
}

export function bothReady(state: BattleState): boolean {
  return state.fighters[0].ready && state.fighters[1].ready;
}

function attackDamage(state: BattleState, source: PlayerIndex, target: PlayerIndex, base: number): number {
  const a = state.fighters[source];
  const t = state.fighters[target];
  const bankai = a.powers.filter((p) => p === 'bankai').length * RULES.bankaiBonus;
  let dmg = base + a.strength + a.tempStrength + bankai;
  if (a.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (t.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

function dealDamage(
  state: BattleState,
  source: PlayerIndex,
  target: PlayerIndex,
  base: number,
  pierce: boolean,
  cardId: string,
  events: BattleEvent[],
) {
  const t = state.fighters[target];
  const dmg = attackDamage(state, source, target, base);
  const blocked = pierce ? 0 : Math.min(t.block, dmg);
  t.block -= blocked;
  const hpDamage = dmg - blocked;
  t.hp = Math.max(0, t.hp - hpDamage);
  t.damageTakenThisTurn += hpDamage;
  events.push({ type: 'damage', source, target, cardId, amount: hpDamage, blocked });
}

function resolveCard(state: BattleState, player: PlayerIndex, q: QueuedCard, events: BattleEvent[]) {
  const def = getCard(q.card.id);
  const f = state.fighters[player];
  const opp = other(player);
  const repeats = q.doubled ? 2 : 1;
  for (let r = 0; r < repeats; r++) {
    for (const e of def.effects) {
      switch (e.kind) {
        case 'damage':
          for (let i = 0; i < (e.times ?? 1); i++) dealDamage(state, player, opp, e.amount, !!e.pierce, def.id, events);
          break;
        case 'block':
          f.block += e.amount;
          events.push({ type: 'block', player, amount: e.amount });
          break;
        case 'strength':
          if (e.temporary) f.tempStrength += e.amount;
          else f.strength += e.amount;
          events.push({ type: 'status', player, status: 'strength', amount: e.amount });
          break;
        case 'weak':
        case 'vulnerable':
          state.fighters[opp][e.kind] += e.amount;
          events.push({ type: 'status', player: opp, status: e.kind, amount: e.amount });
          break;
        case 'loseHp':
          loseHp(f, player, e.amount, def.name, events);
          break;
        case 'drawNext':
          f.bonusDraw += e.amount;
          break;
        case 'charge':
          f.charges.push({
            uid: `ch${state.uidCounter++}`,
            cardId: def.id,
            turnsLeft: e.turns,
            damage: e.damage,
            cancelOnDamage: e.cancelOnDamage,
          });
          events.push({ type: 'chargeStart', player, cardId: def.id, turns: e.turns });
          break;
        case 'power':
          f.powers.push(e.power);
          events.push({ type: 'power', player, power: e.power });
          break;
        case 'reveal':
        case 'clone':
          break;
      }
    }
  }
  if (def.exhaust || def.type === 'power') f.exhausted.push(q.card);
  else f.discard.push(q.card);
}

function tickCharges(state: BattleState, order: PlayerIndex[], events: BattleEvent[]) {
  for (const p of order) {
    const f = state.fighters[p];
    const remaining = [];
    for (const ch of f.charges) {
      ch.turnsLeft -= 1;
      if (ch.turnsLeft <= 0) {
        events.push({ type: 'chargeFire', player: p, cardId: ch.cardId });
        dealDamage(state, p, other(p), ch.damage, false, ch.cardId, events);
      } else {
        remaining.push(ch);
      }
    }
    f.charges = remaining;
  }
}

function checkGameOver(state: BattleState, events: BattleEvent[]): boolean {
  if (state.phase === 'over') return true;
  const [a, b] = state.fighters;
  let winner: BattleState['winner'] = null;
  if (a.hp <= 0 && b.hp <= 0) winner = 'draw';
  else if (a.hp <= 0) winner = 1;
  else if (b.hp <= 0) winner = 0;
  else if (state.turn > RULES.turnLimit) winner = a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1;
  if (winner === null) return false;
  state.phase = 'over';
  state.winner = winner;
  events.push({ type: 'gameOver', winner });
  return true;
}

/**
 * Revela e resolve as cartas dos dois jogadores.
 * Ordem: bloqueio → buffs/debuffs/poderes → golpes carregados → ataques.
 * Dentro de cada fase as cartas se alternam; quem começa alterna a cada turno.
 */
export function resolveTurn(state: BattleState): { state: BattleState; events: BattleEvent[] } {
  const next = clone(state);
  const events: BattleEvent[] = [];
  if (next.phase !== 'planning') return { state: next, events };

  const first: PlayerIndex = next.turn % 2 === 1 ? 0 : 1;
  const order: PlayerIndex[] = [first, other(first)];

  for (const p of order) {
    for (const q of next.fighters[p].queue) events.push({ type: 'play', player: p, cardId: q.card.id, doubled: q.doubled });
  }

  for (const phase of [0, 1, 2] as const) {
    if (phase === 2) {
      tickCharges(next, order, events);
      if (checkGameOver(next, events)) return { state: next, events };
    }
    const lists = order.map((p) => next.fighters[p].queue.filter((q) => cardPhase(getCard(q.card.id)) === phase));
    const len = Math.max(lists[0].length, lists[1].length);
    for (let i = 0; i < len; i++) {
      for (let k = 0; k < 2; k++) {
        const q = lists[k][i];
        if (q) resolveCard(next, order[k], q, events);
      }
    }
    if (checkGameOver(next, events)) return { state: next, events };
  }

  // Golpes carregados que podem ser interrompidos.
  for (const p of order) {
    const f = next.fighters[p];
    f.charges = f.charges.filter((ch) => {
      if (ch.cancelOnDamage !== undefined && f.damageTakenThisTurn >= ch.cancelOnDamage) {
        events.push({ type: 'chargeCancel', player: p, cardId: ch.cardId });
        return false;
      }
      return true;
    });
  }

  // Fim do turno.
  for (const f of next.fighters) {
    f.discard.push(...f.hand);
    f.hand = [];
    f.queue = [];
    if (f.decayWeak) f.weak = Math.max(0, f.weak - 1);
    if (f.decayVulnerable) f.vulnerable = Math.max(0, f.vulnerable - 1);
    f.tempStrength = 0;
  }

  startTurn(next, events);
  return { state: next, events };
}

function publicView(f: Fighter): FighterPublicView {
  return {
    name: f.name,
    outfit: f.outfit,
    hp: f.hp,
    maxHp: f.maxHp,
    block: f.block,
    ki: f.ki,
    strength: f.strength,
    tempStrength: f.tempStrength,
    weak: f.weak,
    vulnerable: f.vulnerable,
    powers: f.powers,
    charges: f.charges,
    handCount: f.hand.length,
    drawCount: f.drawPile.length,
    discardCount: f.discard.length,
    queueCount: f.queue.length,
    ready: f.ready,
  };
}

/** Estado visto por um jogador: as cartas escolhidas pelo oponente ficam escondidas, a não ser com Sharingan. */
export function viewFor(state: BattleState, player: PlayerIndex): BattleView {
  const me = state.fighters[player];
  const opp = state.fighters[other(player)];
  return {
    you: player,
    turn: state.turn,
    phase: state.phase,
    winner: state.winner,
    me: { ...publicView(me), hand: me.hand, queue: me.queue, cloneNext: me.cloneNext, revealing: me.revealing },
    opponent: { ...publicView(opp), queue: me.revealing ? opp.queue : null },
  };
}

/** Pré-visualização do dano de um golpe contra o oponente atual (para a interface). */
export function previewDamage(state: BattleState, player: PlayerIndex, base: number): number {
  return attackDamage(state, player, other(player), base);
}
