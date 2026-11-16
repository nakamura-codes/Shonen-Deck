import { COMBOS, getCard, playCard, type BattleState, type PlayerIndex } from '@oficina/shared';

/** IA simples: escolhe as cartas por pontuação até acabar o Ki. Serve para testar sozinho. */
export function botPlays(state: BattleState, p: PlayerIndex): BattleState {
  let s = state;
  const f0 = s.fighters[p];

  // Turno travado pelo combo: só a carta criada.
  if (f0.lockedTo) {
    const card = f0.hand.find((c) => c.id === f0.lockedTo);
    if (card) {
      const r = playCard(s, p, card.uid);
      if (r.ok) s = r.state;
    }
    return s;
  }

  // Combo na mão: faz se tiver Ki; senão guarda Ki (só cartas de custo 0).
  const ids = f0.hand.map((c) => c.id);
  const combo = COMBOS.find((c) => c.requires.every((id) => ids.includes(id)));
  let saving = false;
  if (combo) {
    const cost = combo.requires.reduce((sum, id) => sum + getCard(id).cost, 0);
    if (cost <= f0.ki) {
      // Debuff/buff primeiro para reforçar o ataque.
      const ordered = [...combo.requires].sort((a, b) => (getCard(a).type === 'attack' ? 1 : 0) - (getCard(b).type === 'attack' ? 1 : 0));
      for (const id of ordered) {
        const card = s.fighters[p].hand.find((c) => c.id === id);
        const r = card && playCard(s, p, card.uid);
        if (r && r.ok) s = r.state;
      }
      return s;
    }
    saving = true;
  }

  for (let guard = 0; guard < 12; guard++) {
    const f = s.fighters[p];
    const opp = s.fighters[p === 0 ? 1 : 0];
    let best: { uid: string; score: number } | null = null;
    for (const c of f.hand) {
      const def = getCard(c.id);
      if (def.cost > f.ki) continue;
      if (saving && def.cost > 0) continue;
      if (combo?.requires.includes(def.id)) continue;
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
