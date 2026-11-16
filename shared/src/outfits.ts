import type { Outfit, OutfitItem, OutfitSlot } from './types.ts';

/** Cada peça de roupa adiciona cartas ao baralho inicial. Montar o visual monta a build. */
export const OUTFIT_ITEMS: OutfitItem[] = [
  { id: 'chapeu_palha', slot: 'head', name: 'Chapéu de Palha', cards: ['gatling', 'gear_second'] },
  { id: 'bandana_ninja', slot: 'head', name: 'Bandana Ninja', cards: ['rasengan', 'kage_bunshin'] },
  { id: 'gi_laranja', slot: 'body', name: 'Gi Laranja', cards: ['kamehameha', 'genki_dama'] },
  { id: 'shihakusho', slot: 'body', name: 'Shihakusho Negro', cards: ['getsuga', 'bankai'] },
  { id: 'sandalias_ninja', slot: 'feet', name: 'Sandálias Ninja', cards: ['chidori', 'shunpo'] },
  { id: 'botas_marinha', slot: 'feet', name: 'Botas da Marinha', cards: ['haki', 'pistol'] },
  { id: 'faixa_sharingan', slot: 'accessory', name: 'Faixa no Olho', cards: ['sharingan', 'kaioken'] },
  { id: 'venda_olhos', slot: 'accessory', name: 'Venda nos Olhos', cards: ['domain_expansion', 'haki'] },
];

export const OUTFIT_SLOTS: OutfitSlot[] = ['head', 'body', 'feet', 'accessory'];

export const SLOT_LABELS: Record<OutfitSlot, string> = {
  head: 'Cabeça',
  body: 'Corpo',
  feet: 'Pés',
  accessory: 'Acessório',
};

export const DEFAULT_OUTFIT: Outfit = {
  head: 'chapeu_palha',
  body: 'gi_laranja',
  feet: 'sandalias_ninja',
  accessory: 'faixa_sharingan',
};

export function itemsForSlot(slot: OutfitSlot): OutfitItem[] {
  return OUTFIT_ITEMS.filter((i) => i.slot === slot);
}

export function getItem(id: string): OutfitItem | undefined {
  return OUTFIT_ITEMS.find((i) => i.id === id);
}

/** Valida a roupa recebida da rede. Peças inválidas voltam para o padrão. */
export function sanitizeOutfit(input: unknown): Outfit {
  const out: Outfit = { ...DEFAULT_OUTFIT };
  if (input && typeof input === 'object') {
    for (const slot of OUTFIT_SLOTS) {
      const id = (input as Record<string, unknown>)[slot];
      const item = typeof id === 'string' ? getItem(id) : undefined;
      if (item && item.slot === slot) out[slot] = item.id;
    }
  }
  return out;
}

export function outfitCards(outfit: Outfit): string[] {
  return OUTFIT_SLOTS.flatMap((slot) => getItem(outfit[slot])?.cards ?? []);
}
