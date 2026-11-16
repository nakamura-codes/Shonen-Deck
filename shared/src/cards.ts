import type { CardDef } from './types.ts';

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
    text: 'Causa 12 de dano. Aplica 1 de Vulnerável.',
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

/** Fase de resolução: 0 = bloqueio, 1 = buffs/debuffs/poderes, 2 = ataques. */
export function cardPhase(card: CardDef): 0 | 1 | 2 {
  if (card.effects.some((e) => e.kind === 'damage' || e.kind === 'charge')) return 2;
  if (card.effects.every((e) => e.kind === 'block' || e.kind === 'drawNext' || e.kind === 'reveal')) return 0;
  return 1;
}

export const BASE_DECK = ['golpe_basico', 'golpe_basico', 'golpe_basico', 'golpe_basico', 'defesa_basica', 'defesa_basica', 'defesa_basica', 'defesa_basica'];
