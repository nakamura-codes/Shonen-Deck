/**
 * Personagem em pixel art feito por camadas: corpo base + uma camada por peça de roupa.
 * Cada camada é uma grade de 24×32 caracteres; "." é transparente e cada letra é uma cor.
 * Para trocar pela arte final, basta substituir por PNGs do mesmo tamanho com os mesmos ids.
 */
export const SPRITE_W = 24;
export const SPRITE_H = 32;

export const PALETTE: Record<string, string> = {
  K: '#1a1420', // contorno
  S: '#f5c9a0', // pele
  s: '#d99a78', // pele sombra
  H: '#2b2b3d', // cabelo
  h: '#4a4a6a', // cabelo brilho
  W: '#f4f4f4', // branco
  w: '#c8ccd4', // branco sombra
  M: '#a04040', // boca
  U: '#d8d2c8', // roupa base
  u: '#b0a898',
  O: '#f08a24', // laranja
  o: '#c0601a',
  B: '#2f5bb8', // azul
  b: '#1f3c80',
  N: '#24242e', // preto
  n: '#3c3c4e',
  Y: '#f2c94c', // palha
  y: '#c99a2e',
  R: '#c8323a', // vermelho
  r: '#8a1f28',
  G: '#c4ced8', // metal
  g: '#7d8a99',
  C: '#1d2a5c', // azul marinho
  c: '#2c3f80',
};

type Layer = Record<number, string>;

export const BASE: Layer = {
  0: '........KKKKKKKK........',
  1: '......KKHHHHHHHHKK......',
  2: '.....KHHHhHHHHhHHHK.....',
  3: '....KHHhHHHHHHHHhHHK....',
  4: '....KHHHHHHHHHHHHHHK....',
  5: '...KHHSSHHSSSSHHSSHHK...',
  6: '...KHSSSSSSSSSSSSSSHK...',
  7: '...KHSSKKSSSSSSKKSSHK...',
  8: '...KSSSKWSSSSSSKWSSSK...',
  9: '...KSSSKKSSSSSSKKSSSK...',
  10: '...KsSSSSSSSSSSSSSSsK...',
  11: '....KsSSSSSMMSSSSSsK....',
  12: '.....KKsSSSSSSSSsKK.....',
  13: '.......KKKSSSSKKK.......',
  14: '........KKsSSsKK........',
  15: '......KKUUUUUUUUKK......',
  16: '.....KUUUUUUUUUUUUK.....',
  17: '....KSKUUUUUUUUUUKSK....',
  18: '....KSKUUUUUUUUUUKSK....',
  19: '....KSKUUUUUUUUUUKSK....',
  20: '....KSKUUUUUUUUUUKSK....',
  21: '....KSSKUUUUUUUUKSSK....',
  22: '.....KKKUUUUUUUUKKK.....',
  23: '.......KUUUUUUUUK.......',
  24: '.......KUUUKKUUUK.......',
  25: '.......KSSSKKSSSK.......',
  26: '.......KSSSKKSSSK.......',
  27: '.......KSSSKKSSSK.......',
  28: '.......KSSSKKSSSK.......',
  29: '.......KSSSKKSSSK.......',
  30: '.......KKKKKKKKKK.......',
};

export const LAYERS: Record<string, Layer> = {
  // ── Corpo ──
  gi_laranja: {
    15: '......KKOOBBBBOOKK......',
    16: '.....KOOOOBBBBOOOOK.....',
    17: '....KOKOOOOBBOOOOKOK....',
    18: '....KOKOOOOBBOOOOKOK....',
    19: '....KOKOOOOOOOOOOKOK....',
    20: '....KBKOOOOOOOOOOKBK....',
    21: '....KSSKBBBBBBBBKSSK....',
    22: '.....KKKOOOOOOOOKKK.....',
    23: '.......KOOOOOOOOK.......',
    24: '.......KOOOKKOOOK.......',
    25: '.......KOOOKKOOOK.......',
    26: '.......KoooKKoooK.......',
  },
  shihakusho: {
    15: '......KKNWWNNWWNKK......',
    16: '.....KNNNWWNNWWNNNK.....',
    17: '....KNKNNNWWWWNNNKNK....',
    18: '...KNNKNNNNWWNNNNKNNK...',
    19: '...KNNKNNNNNNNNNNKNNK...',
    20: '...KnNKNNNNNNNNNNKNnK...',
    21: '....KSSKWWWWWWWWKSSK....',
    22: '.....KKKNNNNNNNNKKK.....',
    23: '......KNNNNNNNNNNK......',
    24: '......KNNNNKKNNNNK......',
    25: '......KnNNNKKNNNnK......',
    26: '......KnnnnKKnnnnK......',
    27: '.......KSSSKKSSSK.......',
  },
  // ── Cabeça ──
  chapeu_palha: {
    0: '.......KKKKKKKKKK.......',
    1: '......KYYYYYYYYYYK......',
    2: '.....KYYyYYYYYYyYYK.....',
    3: '.....KRRRRRRRRRRRRK.....',
    4: '..KKKKyyyyyyyyyyyyKKKK..',
    5: '.KYYYYYYYYYYYYYYYYYYYYK.',
    6: '..KKKKKKKKKKKKKKKKKKKK..',
  },
  bandana_ninja: {
    3: '....KBBBBBBBBBBBBBBK....',
    4: '...KBBKGGGGGGGGKBBBBK...',
    5: '...KBBKGgGGGGgGKBBBBKBK.',
    6: '...KHBBKKKKKKKKBBBBKBBK.',
    7: '...KHSSKKSSSSSSKKSKBBK..',
  },
  // ── Pés ──
  sandalias_ninja: {
    28: '.......KSSSKKSSSK.......',
    29: '.......KBSBKKBSBK.......',
    30: '......KBBBBKKBBBBK......',
    31: '......KKKKKKKKKKKK......',
  },
  botas_marinha: {
    26: '.......KWWWKKWWWK.......',
    27: '.......KCCCKKCCCK.......',
    28: '.......KCCCKKCCCK.......',
    29: '.......KCcCKKCcCK.......',
    30: '......KNNNNKKNNNNK......',
    31: '......KKKKKKKKKKKK......',
  },
  // ── Acessório ──
  faixa_sharingan: {
    6: '...KHSSSSSSSSSSSSNNNK...',
    7: '...KHSSKKSSSSSSNNNNHK...',
    8: '...KNNNKWSSSSSNNNNNNK...',
    9: '...KSSSKKSSSSSNNNSSSK...',
  },
  venda_olhos: {
    7: '...KNNNNNNNNNNNNNNNNK...',
    8: '...KNnNNNNNNNNNNNNnNK...',
    9: '...KNNNNNNNNNNNNNNNNK...',
  },
};

/** Ordem de desenho das camadas por cima do corpo base. */
export const LAYER_ORDER = ['feet', 'body', 'head', 'accessory'] as const;

export function paintLayer(ctx: CanvasRenderingContext2D, layer: Layer) {
  for (const [rowStr, line] of Object.entries(layer)) {
    const y = Number(rowStr);
    for (let x = 0; x < Math.min(line.length, SPRITE_W); x++) {
      const ch = line[x];
      if (ch === '.') continue;
      const color = PALETTE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
