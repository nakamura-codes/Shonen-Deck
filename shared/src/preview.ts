import { getCard } from './cards.ts';
import { RULES } from './engine.ts';
import type { BattleView } from './types.ts';

export interface DamagePreview {
  /** Dano escrito na carta (por golpe). */
  base: number;
  /** Dano que a carta vai causar agora (por golpe), com Força, Fraco, Vulnerável etc. */
  value: number;
}

/**
 * Quanto a carta vai causar se for jogada agora, como próxima da fila.
 * Considera o estado atual e as cartas já na fila (elas resolvem antes desta):
 * Força (inclusive temporária), Bankai, Sonído, Fraco seu e Vulnerável do oponente.
 * Não mostra prévia para golpes carregados (o dano sai no turno seguinte) nem para dano fixo.
 */
export function previewCardDamage(view: BattleView, cardId: string): DamagePreview | null {
  const def = getCard(cardId);
  const dmg = def.effects.find((e) => e.kind === 'damage');
  if (!dmg || dmg.kind !== 'damage' || dmg.fixed) return null;

  const isFirst = view.me.queue.length === 0;
  const base = isFirst && dmg.firstCardAmount !== undefined ? dmg.firstCardAmount : dmg.amount;

  let strength = view.me.strength + view.me.tempStrength;
  let bonus = 0;
  let vulnerable = view.opponent.vulnerable > 0;
  let earlierAttack = false;
  for (const q of view.me.queue) {
    const qd = getCard(q.card.id);
    const times = q.doubled ? 2 : 1;
    for (let r = 0; r < times; r++) {
      for (const e of qd.effects) {
        if (e.kind === 'strength') strength += e.amount;
        if (e.kind === 'nextAttackBonus') bonus += e.amount;
        if (e.kind === 'vulnerable') vulnerable = true;
        if (e.kind === 'damage' && !e.fixed) earlierAttack = true;
      }
    }
  }
  // O Sonído resolve antes (armadura), então o bônus vai para o primeiro ataque da fila.
  if (earlierAttack) bonus = 0;
  const weak = view.me.weak > 0;

  const bankai = view.me.powers.filter((p) => p === 'bankai').length * RULES.bankaiBonus;
  let value = base + bonus;
  // Proporção 7:3: o golpe dobra com o oponente em HP baixo (antes da Força, como no motor).
  if (dmg.doubleBelowHp && view.opponent.hp <= view.opponent.maxHp * dmg.doubleBelowHp) value *= 2;
  value += strength + bankai;
  if (weak) value = Math.floor(value * 0.75);
  if (vulnerable) value = Math.floor(value * 1.25);
  value = Math.max(0, value);
  return { base, value };
}
