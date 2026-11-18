import type { CardDef, ComboDef } from './types.ts';

/**
 * Todas as cartas do jogo. Para balancear, mude só os números aqui.
 * A arte de cada carta fica em client/public/assets/cards/<id>.png.
 */
export const CARDS: Record<string, CardDef> = {
  golpe_basico: {
    id: 'golpe_basico', name: 'Golpe Básico', cost: 1, type: 'attack', rarity: 'common',
    text: 'Causa 6 de dano.',
    effects: [{ kind: 'damage', amount: 6 }],
  },
  defesa_basica: {
    id: 'defesa_basica', name: 'Defesa Básica', cost: 1, type: 'skill', rarity: 'common',
    text: 'Ganha 5 de Bloqueio.',
    effects: [{ kind: 'block', amount: 5 }],
  },
  pistol: {
    id: 'pistol', name: 'Gomu Gomu no Pistol', cost: 1, type: 'attack', rarity: 'common',
    text: 'Causa 7 de dano.',
    effects: [{ kind: 'damage', amount: 7 }],
  },
  gatling: {
    id: 'gatling', name: 'Gomu Gomu no Gatling', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 3 de dano 4 vezes.',
    effects: [{ kind: 'damage', amount: 3, times: 4 }],
  },
  gear_second: {
    id: 'gear_second', name: 'Gear Second', cost: 2, type: 'power', rarity: 'power',
    text: 'Poder (2 turnos): +1 Ki e perde 5 HP em cada um desses turnos.',
    effects: [{ kind: 'power', power: 'gearSecond', turns: 2 }],
  },
  kamehameha: {
    id: 'kamehameha', name: 'Kamehameha', cost: 1, type: 'attack', rarity: 'rare',
    text: 'Carrega 1 turno. Depois causa 18 de dano.',
    effects: [{ kind: 'charge', turns: 1, damage: 18 }],
  },
  genki_dama: {
    id: 'genki_dama', name: 'Genki Dama', cost: 3, type: 'attack', rarity: 'rare',
    text: 'Carrega 2 turnos e causa 40. Cancela se você sofrer 15+ num turno.',
    effects: [{ kind: 'charge', turns: 2, damage: 40, cancelOnDamage: 15 }],
  },
  kaioken: {
    id: 'kaioken', name: 'Kaioken', cost: 0, type: 'skill', rarity: 'common',
    text: 'Perde 5 HP. Ganha 3 de Força neste turno.',
    effects: [{ kind: 'loseHp', amount: 5 }, { kind: 'strength', amount: 3, temporary: true }],
  },
  getsuga: {
    id: 'getsuga', name: 'Getsuga Tenshou', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 14 de dano. Exaurir.',
    effects: [{ kind: 'damage', amount: 14 }],
    exhaust: true,
  },
  bankai: {
    id: 'bankai', name: 'Bankai', cost: 3, type: 'power', rarity: 'power',
    text: 'Poder (2 turnos): seus ataques causam +3 de dano por golpe.',
    effects: [{ kind: 'power', power: 'bankai', turns: 2 }],
  },
  rasengan: {
    id: 'rasengan', name: 'Rasengan', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 12 de dano. Aplica 1 de Vulnerável (+25% de dano).',
    effects: [{ kind: 'damage', amount: 12 }, { kind: 'vulnerable', amount: 1 }],
  },
  kage_bunshin: {
    id: 'kage_bunshin', name: 'Kage Bunshin', cost: 1, type: 'skill', rarity: 'common',
    text: 'A próxima carta jogada neste turno acontece 2 vezes.',
    effects: [{ kind: 'clone' }],
  },
  chidori: {
    id: 'chidori', name: 'Chidori', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 10 de dano. Ignora Bloqueio.',
    effects: [{ kind: 'damage', amount: 10, pierce: true }],
  },
  sharingan: {
    id: 'sharingan', name: 'Sharingan', cost: 1, type: 'skill', rarity: 'common',
    text: 'Vê as cartas do oponente neste turno. +4 de Bloqueio.',
    effects: [{ kind: 'reveal' }, { kind: 'block', amount: 4 }],
  },
  domain_expansion: {
    id: 'domain_expansion', name: 'Domain Expansion', cost: 3, type: 'power', rarity: 'power',
    text: 'Poder: no início de cada turno, o oponente recebe 1 de Fraco.',
    effects: [{ kind: 'power', power: 'domain', turns: 3 }],
  },
  haki: {
    id: 'haki', name: 'Busoshoku Haki', cost: 1, type: 'skill', rarity: 'common',
    text: 'Ganha 8 de Bloqueio e 1 de Força neste turno.',
    effects: [{ kind: 'block', amount: 8 }, { kind: 'strength', amount: 1, temporary: true }],
  },
  red: {
    id: 'red', name: 'Red', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 14 de dano. Com Blue no turno: Hollow Purple.',
    effects: [{ kind: 'damage', amount: 14 }],
  },
  blue: {
    id: 'blue', name: 'Blue', cost: 2, type: 'skill', rarity: 'rare',
    text: '1 de Fraco e 1 de Vulnerável. Com Red no turno: Hollow Purple.',
    effects: [{ kind: 'weak', amount: 1 }, { kind: 'vulnerable', amount: 1 }],
  },
  hollow_purple: {
    id: 'hollow_purple', name: 'Hollow Purple', cost: 0, type: 'attack', rarity: 'power',
    text: 'Causa 30 de dano. Ignora Bloqueio e modificadores.',
    effects: [{ kind: 'damage', amount: 30, pierce: true, fixed: true }],
    exhaust: true,
    token: true,
    ethereal: true,
  },
  infinity: {
    id: 'infinity', name: 'Infinity', cost: 2, type: 'skill', rarity: 'rare',
    text: 'Desvia do próximo golpe do oponente neste turno.',
    effects: [{ kind: 'evade' }],
  },
  black_flash: {
    id: 'black_flash', name: 'Black Flash', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 8 de dano. Se for sua 1ª carta do turno, causa 20.',
    effects: [{ kind: 'damage', amount: 8, firstCardAmount: 20 }],
  },
  boogie_woogie: {
    id: 'boogie_woogie', name: 'Boogie Woogie', cost: 2, type: 'skill', rarity: 'rare',
    text: 'O próximo golpe do oponente neste turno acerta ele mesmo.',
    effects: [{ kind: 'reflect' }],
  },
  tecnica_reversa: {
    id: 'tecnica_reversa', name: 'Técnica Reversa', cost: 2, type: 'skill', rarity: 'rare',
    text: 'Recupera 10 HP. Exaurir.',
    effects: [{ kind: 'heal', amount: 10 }],
    exhaust: true,
  },
  ki_blast: {
    id: 'ki_blast', name: 'Ki Blast', cost: 1, type: 'attack', rarity: 'common',
    text: 'Causa 3 de dano 2 vezes.',
    effects: [{ kind: 'damage', amount: 3, times: 2 }],
  },
  haki_do_rei: {
    id: 'haki_do_rei', name: 'Haki do Rei', cost: 3, type: 'skill', rarity: 'rare',
    text: 'Atordoa o oponente por 1 turno. Ki máximo dele -2 por 2 turnos. Exaurir.',
    effects: [{ kind: 'stun', turns: 1, kiPenalty: 2, kiPenaltyTurns: 2 }],
    exhaust: true,
  },
  cero: {
    id: 'cero', name: 'Cero', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Carrega 1 turno. Depois causa 16 de dano.',
    effects: [{ kind: 'charge', turns: 1, damage: 16 }],
  },
  hollowficacao: {
    id: 'hollowficacao', name: 'Hollowficação', cost: 2, type: 'power', rarity: 'power',
    text: 'Poder (2 turnos): +3 de Força. Perde 5 HP em cada um desses turnos.',
    effects: [{ kind: 'power', power: 'hollow', turns: 2 }],
  },
  sonido: {
    id: 'sonido', name: 'Sonído', cost: 0, type: 'skill', rarity: 'common',
    text: 'Ganha 3 de Bloqueio. Seu próximo ataque neste turno causa +3.',
    effects: [{ kind: 'block', amount: 3 }, { kind: 'nextAttackBonus', amount: 3 }],
  },
  leitura_de_poder: {
    id: 'leitura_de_poder', name: 'Leitura de Poder', cost: 1, type: 'skill', rarity: 'common',
    text: 'Vê as cartas do oponente. Você escolhe qual carta sua resolve primeiro.',
    effects: [{ kind: 'reveal' }, { kind: 'reorder' }],
  },
  galick_gun: {
    id: 'galick_gun', name: 'Galick Gun', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 10 de dano. Com 5 de Ki: gasta tudo e evolui para Big Bang Attack.',
    effects: [{ kind: 'damage', amount: 10 }],
    evolve: { atKi: 5, into: 'big_bang_attack' },
  },
  big_bang_attack: {
    id: 'big_bang_attack', name: 'Big Bang Attack', cost: 5, type: 'attack', rarity: 'power',
    text: 'Causa 30 de dano. Ignora Bloqueio e modificadores. Fica na mão até ser usada.',
    effects: [{ kind: 'damage', amount: 30, pierce: true, fixed: true }, { kind: 'returnCard', cardId: 'galick_gun' }],
    exhaust: true,
    token: true,
    retain: true,
  },
  kunai: {
    id: 'kunai', name: 'Kunai', cost: 0, type: 'attack', rarity: 'common',
    text: 'Causa 4 de dano.',
    effects: [{ kind: 'damage', amount: 4 }],
  },
  sake: {
    id: 'sake', name: 'Sake', cost: 1, type: 'skill', rarity: 'common',
    text: 'Recupera 6 HP. Exaurir.',
    effects: [{ kind: 'heal', amount: 6 }],
    exhaust: true,
  },
  modo_sabio: {
    id: 'modo_sabio', name: 'Modo Sábio', cost: 2, type: 'skill', rarity: 'rare',
    text: 'Nos próximos 2 turnos: +1 de Força e +1 carta comprada.',
    effects: [{ kind: 'sage', turns: 2, strength: 1, draw: 1 }],
  },
  shunpo: {
    id: 'shunpo', name: 'Shunpo', cost: 1, type: 'skill', rarity: 'common',
    text: 'Ganha 5 de Bloqueio. +1 carta no próximo turno.',
    effects: [{ kind: 'block', amount: 5 }, { kind: 'drawNext', amount: 1 }],
  },
  // ── Armas (slot Mão) ──
  burning_attack: {
    id: 'burning_attack', name: 'Burning Attack', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 12 de dano.',
    effects: [{ kind: 'damage', amount: 12 }],
  },
  corte_do_futuro: {
    id: 'corte_do_futuro', name: 'Corte do Futuro', cost: 1, type: 'attack', rarity: 'common',
    text: 'Causa 3 de dano 3 vezes.',
    effects: [{ kind: 'damage', amount: 3, times: 3 }],
  },
  shining_sword: {
    id: 'shining_sword', name: 'Shining Sword Attack', cost: 3, type: 'attack', rarity: 'rare',
    text: 'Causa 20 de dano. Exaurir.',
    effects: [{ kind: 'damage', amount: 20 }],
    exhaust: true,
  },
  tiro_duplo: {
    id: 'tiro_duplo', name: 'Tiro Duplo', cost: 1, type: 'attack', rarity: 'common',
    text: 'Causa 4 de dano 2 vezes.',
    effects: [{ kind: 'damage', amount: 4, times: 2 }],
  },
  tiro_certeiro: {
    id: 'tiro_certeiro', name: 'Tiro Certeiro', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 9 de dano. Ignora Bloqueio.',
    effects: [{ kind: 'damage', amount: 9, pierce: true }],
  },
  recarregar: {
    id: 'recarregar', name: 'Recarregar', cost: 0, type: 'skill', rarity: 'common',
    text: 'Ganha 3 de Bloqueio. +1 carta no próximo turno.',
    effects: [{ kind: 'block', amount: 3 }, { kind: 'drawNext', amount: 1 }],
  },
  kunai_explosiva: {
    id: 'kunai_explosiva', name: 'Kunai Explosiva', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 12 de dano.',
    effects: [{ kind: 'damage', amount: 12 }],
  },
  hiraishin: {
    id: 'hiraishin', name: 'Hiraishin', cost: 2, type: 'skill', rarity: 'rare',
    text: 'Desvia do próximo golpe do oponente neste turno. Seu próximo ataque causa +4.',
    effects: [{ kind: 'evade' }, { kind: 'nextAttackBonus', amount: 4 }],
  },
  corte_shinigami: {
    id: 'corte_shinigami', name: 'Corte Shinigami', cost: 1, type: 'attack', rarity: 'common',
    text: 'Causa 9 de dano.',
    effects: [{ kind: 'damage', amount: 9 }],
  },
  senbonzakura: {
    id: 'senbonzakura', name: 'Senbonzakura', cost: 3, type: 'attack', rarity: 'rare',
    text: 'Causa 2 de dano 8 vezes.',
    effects: [{ kind: 'damage', amount: 2, times: 8 }],
  },
  defesa_de_lamina: {
    id: 'defesa_de_lamina', name: 'Defesa de Lâmina', cost: 1, type: 'skill', rarity: 'common',
    text: 'Ganha 7 de Bloqueio.',
    effects: [{ kind: 'block', amount: 7 }],
  },
  proporcao_7_3: {
    id: 'proporcao_7_3', name: 'Proporção 7:3', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 10 de dano. Dano dobrado se o oponente tiver 40% de HP ou menos.',
    effects: [{ kind: 'damage', amount: 10, doubleBelowHp: 0.4 }],
  },
  hora_extra: {
    id: 'hora_extra', name: 'Hora Extra', cost: 0, type: 'skill', rarity: 'common',
    text: 'Ganha 2 de Força neste turno.',
    effects: [{ kind: 'strength', amount: 2, temporary: true }],
  },
  colapso: {
    id: 'colapso', name: 'Colapso', cost: 3, type: 'attack', rarity: 'rare',
    text: 'Causa 18 de dano. Ignora Bloqueio. Exaurir.',
    effects: [{ kind: 'damage', amount: 18, pierce: true }],
    exhaust: true,
  },
  kawarimi: {
    id: 'kawarimi', name: 'Kawarimi no Jutsu', cost: 1, type: 'skill', rarity: 'common',
    text: 'Desvia do próximo golpe do oponente neste turno. Exaurir.',
    effects: [{ kind: 'evade' }],
    exhaust: true,
  },
};

export function getCard(id: string): CardDef {
  const card = CARDS[id];
  if (!card) throw new Error(`Carta desconhecida: ${id}`);
  return card;
}

/**
 * Armadura resolve antes de tudo (tem Bloqueio e não causa dano).
 * O resto resolve na ordem em que cada jogador jogou.
 */
export function isArmor(card: CardDef): boolean {
  const defensive = card.effects.some((e) => e.kind === 'block' || e.kind === 'evade' || e.kind === 'reflect');
  return defensive && !card.effects.some((e) => e.kind === 'damage' || e.kind === 'charge');
}

/** Combos: jogar todas as cartas de `requires` no mesmo turno cria `creates` no turno seguinte. */
export const COMBOS: ComboDef[] = [{ requires: ['red', 'blue'], creates: 'hollow_purple' }];

export function comboFor(cardIds: string[]): ComboDef | undefined {
  return COMBOS.find((c) => c.requires.every((id) => cardIds.includes(id)));
}

export const BASE_DECK = ['golpe_basico', 'golpe_basico', 'golpe_basico', 'golpe_basico', 'defesa_basica', 'defesa_basica', 'defesa_basica', 'defesa_basica'];
