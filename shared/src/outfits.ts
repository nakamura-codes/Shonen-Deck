import type { Outfit, OutfitItem, OutfitSlot } from './types.ts';

/**
 * Peças de roupa. Cada uma coloca 3 cartas no baralho quando está vestida.
 * Todo jogador tem todas as peças no inventário; escolhe quais vestir.
 * A arte fica em client/public/assets/items/<id>.png e as figuras em assets/character/.
 */
export const OUTFIT_ITEMS: OutfitItem[] = [
  { id: 'chapeu_palha', slot: 'head', name: 'Chapéu de Palha', cards: ['pistol', 'gatling', 'gear_second'] },
  { id: 'venda_olhos', slot: 'head', name: 'Cabelo e Venda', cards: ['domain_expansion', 'sharingan', 'kaioken'] },
  { id: 'bandana_ninja', slot: 'head', name: 'Bandana Ninja', cards: ['rasengan', 'kage_bunshin', 'chidori'] },
  { id: 'gi_laranja', slot: 'body', name: 'Gi Laranja', cards: ['kamehameha', 'genki_dama', 'haki'] },
  { id: 'shihakusho', slot: 'body', name: 'Shihakusho Negro', cards: ['getsuga', 'bankai', 'shunpo'] },
  { id: 'uniforme_jujutsu', slot: 'body', name: 'Uniforme Jujutsu', cards: ['haki', 'shunpo', 'sharingan'] },
];

export const OUTFIT_SLOTS: OutfitSlot[] = ['head', 'body'];

export const SLOT_LABELS: Record<OutfitSlot, string> = {
  head: 'Cabeça',
  body: 'Corpo',
};

/** Personagem novo: totalmente cinza, sem nada vestido. */
export const EMPTY_OUTFIT: Outfit = { head: null, body: null };

export function itemsForSlot(slot: OutfitSlot): OutfitItem[] {
  return OUTFIT_ITEMS.filter((i) => i.slot === slot);
}

export function getItem(id: string | null | undefined): OutfitItem | undefined {
  return id ? OUTFIT_ITEMS.find((i) => i.id === id) : undefined;
}

/** Valida a roupa recebida da rede ou do armazenamento. Peça inválida = espaço vazio. */
export function sanitizeOutfit(input: unknown): Outfit {
  const out: Outfit = { ...EMPTY_OUTFIT };
  if (input && typeof input === 'object') {
    for (const slot of OUTFIT_SLOTS) {
      const item = getItem((input as Record<string, unknown>)[slot] as string);
      if (item && item.slot === slot) out[slot] = item.id;
    }
  }
  return out;
}

export function outfitCards(outfit: Outfit): string[] {
  return OUTFIT_SLOTS.flatMap((slot) => getItem(outfit[slot])?.cards ?? []);
}

/** Nome do arquivo da figura do personagem para essa combinação de roupas. */
export function figureKey(outfit: Outfit): string {
  return `fig_${outfit.head ?? 'none'}_${outfit.body ?? 'none'}`;
}
