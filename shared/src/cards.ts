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
    id: 'gear_second', name: 'Gear Second', cost: 1, type: 'power', rarity: 'power',
    text: 'Poder: no início de cada turno, +1 Ki e perde 2 HP.',
    effects: [{ kind: 'power', power: 'gearSecond' }],
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
    text: 'Poder: seus ataques causam +3 de dano por golpe.',
    effects: [{ kind: 'power', power: 'bankai' }],
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
    effects: [{ kind: 'power', power: 'domain' }],
  },
  haki: {
    id: 'haki', name: 'Busoshoku Haki', cost: 1, type: 'skill', rarity: 'common',
    text: 'Ganha 8 de Bloqueio e 1 de Força.',
    effects: [{ kind: 'block', amount: 8 }, { kind: 'strength', amount: 1 }],
  },
  red: {
    id: 'red', name: 'Red', cost: 3, type: 'attack', rarity: 'rare',
    text: 'Causa 14 de dano. Com Blue no mesmo turno: Hollow Purple.',
    effects: [{ kind: 'damage', amount: 14 }],
  },
  blue: {
    id: 'blue', name: 'Blue', cost: 2, type: 'skill', rarity: 'rare',
    text: 'Aplica 1 de Fraco e 1 de Vulnerável. Com Red no mesmo turno: Hollow Purple.',
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
    text: 'Desvia da próxima habilidade de dano do oponente neste turno.',
    effects: [{ kind: 'evade' }],
  },
  black_flash: {
    id: 'black_flash', name: 'Black Flash', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 8 de dano. Se for a 1ª carta que você joga no turno, causa 20.',
    effects: [{ kind: 'damage', amount: 8, firstCardAmount: 20 }],
  },
  boogie_woogie: {
    id: 'boogie_woogie', name: 'Boogie Woogie', cost: 2, type: 'skill', rarity: 'rare',
    text: 'Troca de lugar: a próxima habilidade de dano do oponente neste turno acerta ele mesmo.',
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
    text: 'Atordoa o oponente no próximo turno (não joga cartas). Ki máximo dele -2 por 2 turnos. Exaurir.',
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
    text: 'Poder: +2 de Força. No início de cada turno, perde 2 HP.',
    effects: [{ kind: 'strength', amount: 2 }, { kind: 'power', power: 'hollow' }],
  },
  sonido: {
    id: 'sonido', name: 'Sonído', cost: 0, type: 'skill', rarity: 'common',
    text: 'Ganha 4 de Bloqueio. Seu próximo ataque neste turno causa +3.',
    effects: [{ kind: 'block', amount: 4 }, { kind: 'nextAttackBonus', amount: 3 }],
  },
  leitura_de_poder: {
    id: 'leitura_de_poder', name: 'Leitura de Poder', cost: 1, type: 'skill', rarity: 'common',
    text: 'Vê as cartas do oponente neste turno. Você escolhe qual das suas cartas resolve primeiro.',
    effects: [{ kind: 'reveal' }, { kind: 'reorder' }],
  },
  galick_gun: {
    id: 'galick_gun', name: 'Galick Gun', cost: 2, type: 'attack', rarity: 'rare',
    text: 'Causa 10 de dano. Com 5 de Ki: gasta tudo e vira Big Bang Attack no próximo turno.',
    effects: [{ kind: 'damage', amount: 10 }],
    evolve: { atKi: 5, into: 'big_bang_attack' },
  },
  big_bang_attack: {
    id: 'big_bang_attack', name: 'Big Bang Attack', cost: 5, type: 'attack', rarity: 'power',
    text: 'Causa 30 de dano. Ignora Bloqueio e modificadores. Fica na mão até ser usada. Depois, o Galick Gun volta ao baralho.',
    effects: [{ kind: 'damage', amount: 30, pierce: true, fixed: true }, { kind: 'returnCard', cardId: 'galick_gun' }],
    exhaust: true,
    token: true,
    retain: true,
  },
  final_flash: {
    id: 'final_flash', name: 'Final Flash', cost: 3, type: 'attack', rarity: 'rare',
    text: 'Carrega 1 turno. Depois causa 28 de dano.',
    effects: [{ kind: 'charge', turns: 1, damage: 28 }],
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
    id: 'shunpo', name: 'Shunpo', cost: 0, type: 'skill', rarity: 'common',
    text: 'Ganha 5 de Bloqueio. +1 carta no próximo turno.',
    effects: [{ kind: 'block', amount: 5 }, { kind: 'drawNext', amount: 1 }],
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
