import { getCard, playCard, type BattleState, type PlayerIndex } from '@oficina/shared';

/** IA simples: escolhe as cartas por pontuação até acabar o Ki. Serve para testar sozinho. */
export function botPlays(state: BattleState, p: PlayerIndex): BattleState {
  let s = state;
  for (let guard = 0; guard < 12; guard++) {
    const f = s.fighters[p];
    const opp = s.fighters[p === 0 ? 1 : 0];
    let best: { uid: string; score: number } | null = null;
    for (const c of f.hand) {
      const def = getCard(c.id);
      if (def.cost > f.ki) continue;
      const kiAfter = f.ki - def.cost;
      let score = 0;
      for (const e of def.effects) {
        if (e.kind === 'damage') score += e.amount * (e.times ?? 1);
        if (e.kind === 'charge') score += e.damage * 0.6;
        if (e.kind === 'block') score += opp.charges.length > 0 || f.hp < 25 ? e.amount * 1.3 : e.amount * 0.7;
        if (e.kind === 'power') score += s.turn <= 4 ? 14 : 4;
        if (e.kind === 'strength') score += kiAfter >= 1 ? 6 : 1;
        if (e.kind === 'vulnerable' || e.kind === 'weak') score += 3;
        if (e.kind === 'loseHp') score -= f.hp < 15 ? 20 : 2;
        if (e.kind === 'clone') score += kiAfter >= 2 ? 6 : -5;
        if (e.kind === 'reveal') score += 2;
        if (e.kind === 'drawNext') score += 2;
      }
      score = score / Math.max(1, def.cost) + Math.random() * 2;
      if (!best || score > best.score) best = { uid: c.uid, score };
    }
    if (!best || best.score <= 0) break;
    const r = playCard(s, p, best.uid);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}
