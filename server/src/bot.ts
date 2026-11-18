import {
  COMBOS,
  getCard,
  playCard,
  resolveTurn,
  setReady,
  toggleKeep,
  type BattleState,
  type BotLevel,
  type PlayerIndex,
} from '@oficina/shared';

const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

/** Escolhe e joga as cartas do bot para este turno, conforme o nível. */
export function botPlays(state: BattleState, p: PlayerIndex, level: BotLevel = 'competitivo'): BattleState {
  if (level === 'iniciante') return beginnerPlays(state, p);
  if (level === 'deus') return searchPlays(state, p, true);
  return searchPlays(state, p, false);
}

// ───────────────────────── Iniciante ─────────────────────────

/** Joga cartas quase ao acaso: não guarda Ki, não pensa em combos nem no que o oponente faz. */
function beginnerPlays(state: BattleState, p: PlayerIndex): BattleState {
  let s = state;
  const f0 = s.fighters[p];
  if (f0.lockedTo) return playLocked(s, p);
  const hand = [...f0.hand].sort(() => Math.random() - 0.5);
  for (const c of hand) {
    if (Math.random() < 0.35) continue;
    const r = playCard(s, p, c.uid);
    if (r.ok) s = r.state;
  }
  return s;
}

function playLocked(state: BattleState, p: PlayerIndex): BattleState {
  const f = state.fighters[p];
  const card = f.hand.find((c) => c.id === f.lockedTo);
  const r = card && playCard(state, p, card.uid);
  return r && r.ok ? r.state : state;
}

// ───────────────────────── Competitivo e Deus das Cartas ─────────────────────────

/**
 * Testa as jogadas possíveis (todas as combinações de cartas que o Ki paga, em boas ordens) e simula
 * o turno inteiro para cada uma, escolhendo a que deixa a melhor situação.
 *
 * - Competitivo: não vê a jogada do oponente; simula como se ele não jogasse nada e evita riscos.
 * - Deus das Cartas: simula contra a jogada real do oponente (o servidor sabe), conhece as cartas que
 *   vai comprar e todas as combinações. Se adapta a cada jogada.
 */
function searchPlays(state: BattleState, p: PlayerIndex, omniscient: boolean): BattleState {
  if (state.fighters[p].lockedTo) return withKeep(playLocked(state, p), p);
  const candidates = enumeratePlays(state, p);
  let best: { s: BattleState; score: number } | null = null;
  for (const seq of candidates) {
    let s = state;
    let ok = true;
    for (const uid of seq) {
      const r = playCard(s, p, uid);
      if (!r.ok) {
        ok = false;
        break;
      }
      s = r.state;
    }
    if (!ok) continue;
    const score = evaluate(s, p, omniscient) + (omniscient ? 0 : Math.random() * 1.5);
    if (!best || score > best.score) best = { s, score };
  }
  return withKeep(best ? best.s : state, p);
}

/** Todas as combinações de cartas que cabem no Ki (até 6 cartas), cada uma em até 3 ordens. */
function enumeratePlays(state: BattleState, p: PlayerIndex): string[][] {
  const f = state.fighters[p];
  const hand = f.hand;
  const out: string[][] = [[]];
  const pick: { uid: string; id: string; cost: number }[] = [];
  const seen = new Set<string>();
  const rec = (i: number, ki: number) => {
    if (i === hand.length) {
      if (!pick.length) return;
      const key = pick.map((x) => x.id).sort().join(',');
      if (seen.has(key)) return;
      seen.add(key);
      for (const order of orders(pick)) out.push(order.map((x) => x.uid));
      return;
    }
    rec(i + 1, ki);
    const c = hand[i];
    const cost = getCard(c.id).cost;
    if (cost <= ki && pick.length < 6) {
      pick.push({ uid: c.uid, id: c.id, cost });
      rec(i + 1, ki - cost);
      pick.pop();
    }
  };
  rec(0, f.ki);
  return out.slice(0, 900);
}

/** Ordens que valem testar: reforços antes dos ataques, o Kage Bunshin antes da melhor carta, etc. */
function orders<T extends { id: string }>(cards: T[]): T[][] {
  const rank = (id: string) => {
    const d = getCard(id);
    if (d.effects.some((e) => e.kind === 'clone')) return 0;
    if (d.effects.some((e) => e.kind === 'strength' || e.kind === 'vulnerable' || e.kind === 'weak' || e.kind === 'power' || e.kind === 'nextAttackBonus')) return 1;
    if (d.type !== 'attack') return 2;
    return 3;
  };
  const dmg = (id: string) => getCard(id).effects.reduce((s, e) => s + (e.kind === 'damage' ? e.amount * (e.times ?? 1) : e.kind === 'charge' ? e.damage : 0), 0);
  const base = [...cards].sort((a, b) => rank(a.id) - rank(b.id) || dmg(b.id) - dmg(a.id));
  const list = [base];
  if (cards.length >= 2) {
    // Ataques mais fortes primeiro (o primeiro golpe pode decidir quem cai antes).
    list.push([...cards].sort((a, b) => rank(a.id) - rank(b.id) || dmg(a.id) - dmg(b.id)));
    // Black Flash / Senka: valem mais como primeira carta.
    const first = cards.find((c) => getCard(c.id).effects.some((e) => e.kind === 'damage' && e.firstCardAmount !== undefined));
    if (first) list.push([first, ...base.filter((c) => c !== first)]);
  }
  return list;
}

/** Valor de uma jogada: simula o turno e mede quem ficou em vantagem. */
function evaluate(afterPlay: BattleState, p: PlayerIndex, omniscient: boolean): number {
  const o = other(p);
  let s = afterPlay;
  if (!omniscient) {
    // Sem ver o oponente: considera que ele não joga nada (mede só o valor das próprias cartas).
    s = structuredClone(s);
    s.fighters[o].queue = [];
  }
  for (const pl of [0, 1] as PlayerIndex[]) {
    if (!s.fighters[pl].ready) {
      const r = setReady(s, pl);
      if (r.ok) s = r.state;
    }
  }
  const res = resolveTurn(s).state;
  const me = res.fighters[p];
  const op = res.fighters[o];
  if (res.phase === 'over') {
    if (res.winner === p) return 10000 + me.hp;
    if (res.winner === o) return -10000;
    return -500;
  }
  let score = (me.hp - op.hp) * 3;
  // Ameaças e vantagens que ficam para os próximos turnos.
  score += me.charges.reduce((t, c) => t + c.damage, 0) * 1.6;
  score -= op.charges.reduce((t, c) => t + c.damage, 0) * (omniscient ? 1.2 : 0.8);
  score += op.vulnerable * 5 + op.weak * 5 - me.weak * 5 - me.vulnerable * 5;
  score += me.strength * 4;
  score += me.powers.reduce((t, pw, i) => t + (pw === 'bankai' ? 9 : pw === 'hollow' ? 8 : pw === 'gearSecond' ? 4 : 6) * (me.powerTurns[i] ?? 1), 0);
  score += me.ki * 2.5;
  if (me.pendingCombo || me.lockedTo) score += 40;
  score += me.hand.length * 1.5;
  if (op.stunned) score += 20;
  // Com pouco HP, cada ponto vale mais.
  if (me.hp < 20) score += me.hp * 2;
  if (op.hp < 20) score -= op.hp * 2;
  return score;
}

/** Trava (cadeado) a carta mais valiosa que sobrou na mão. */
function withKeep(state: BattleState, p: PlayerIndex): BattleState {
  const f = state.fighters[p];
  const combo = COMBOS.flatMap((c) => c.requires);
  let best: { uid: string; v: number } | null = null;
  for (const c of f.hand) {
    if (c.uid === f.lastKeptUid) continue;
    const d = getCard(c.id);
    if (d.ethereal || d.retain) continue;
    const v = d.cost * 3 + (combo.includes(c.id) ? 10 : 0) + (d.rarity === 'rare' ? 3 : 0) + (d.rarity === 'power' ? 5 : 0);
    if (!best || v > best.v) best = { uid: c.uid, v };
  }
  if (!best || f.keepUid === best.uid) return state;
  const r = toggleKeep(state, p, best.uid);
  return r.ok ? r.state : state;
}
