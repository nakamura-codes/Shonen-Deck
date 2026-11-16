/**
 * Prepara a arte das cartas.
 *
 *   npm run art
 *
 * Lê art/raw/<id>.png (imagens do ChatGPT, de qualquer tamanho) e grava
 * client/public/assets/cards/<id>.png com:
 *  - redução para 64×64 e paleta limpa (pixel art de verdade, sem borrado);
 *  - recorte hexagonal;
 *  - moldura pixelada na cor da raridade (prata = comum, ouro = rara, roxo = poder).
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import sharp from 'sharp';
import { CARDS } from '../shared/src/cards.ts';
import type { Rarity } from '../shared/src/types.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw');
const OUT = join(ROOT, 'client/public/assets/cards');

const ICON = 64;
const W = 70;
const H = 80;
const CX = W / 2;
const CY = H / 2;
const ICON_INRADIUS = 29.5;

type RGB = [number, number, number];
const hex = (s: string): RGB => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;

const FRAMES: Record<Rarity, { outline: RGB; inner: RGB; light: RGB; mid: RGB; dark: RGB }> = {
  common: { outline: hex('#1b2333'), inner: hex('#1e2a3c'), light: hex('#f2f6fb'), mid: hex('#aebccb'), dark: hex('#6b7b91') },
  rare: { outline: hex('#2e120a'), inner: hex('#6b2a10'), light: hex('#ffe28a'), mid: hex('#f0a830'), dark: hex('#b8561a') },
  power: { outline: hex('#1d0b2e'), inner: hex('#2a1040'), light: hex('#e9b8ff'), mid: hex('#a858e8'), dark: hex('#6a2aa8') },
};

/** "Distância" hexagonal (hexágono com ponta para cima), em unidades de raio interno. */
function hexDist(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return Math.max(ax, 0.5 * ax + (Math.sqrt(3) / 2) * ay);
}

async function processCard(id: string, file: string) {
  const card = CARDS[id];
  if (!card) {
    console.warn(`  ! ${basename(file)}: não existe carta "${id}" em shared/src/cards.ts (ignorado)`);
    return;
  }

  const { data: src } = await sharp(file)
    .removeAlpha()
    .resize(ICON, ICON, { fit: 'cover', kernel: 'lanczos3' })
    .png({ palette: true, colors: 32, dither: 0 })
    .toBuffer()
    .then((b) => sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true }));

  const frame = FRAMES[card.rarity];
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = hexDist(x + 0.5 - CX, y + 0.5 - CY);
      const o = (y * W + x) * 4;
      let c: RGB | null = null;
      if (d <= ICON_INRADIUS) {
        const sx = Math.min(ICON - 1, Math.max(0, Math.floor(x - CX + ICON / 2)));
        const sy = Math.min(ICON - 1, Math.max(0, Math.floor(y - CY + ICON / 2)));
        const i = (sy * ICON + sx) * 3;
        c = [src[i], src[i + 1], src[i + 2]];
      } else if (d <= ICON_INRADIUS + 1) {
        c = frame.inner;
      } else if (d <= ICON_INRADIUS + 4) {
        // Faixa colorida com luz vindo de cima.
        const t = y / H;
        c = t < 0.38 ? frame.light : t < 0.68 ? frame.mid : frame.dark;
        if (d > ICON_INRADIUS + 3 && t < 0.68) c = frame.mid;
      } else if (d <= ICON_INRADIUS + 5) {
        c = frame.outline;
      }
      if (c) {
        out[o] = c[0];
        out[o + 1] = c[1];
        out[o + 2] = c[2];
        out[o + 3] = 255;
      }
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(join(OUT, `${id}.png`));
  console.log(`  ✓ ${id} (${card.rarity})`);
}

async function main() {
  if (!existsSync(RAW)) throw new Error(`Pasta não encontrada: ${RAW}`);
  mkdirSync(OUT, { recursive: true });
  const files = readdirSync(RAW).filter((f) => f.toLowerCase().endsWith('.png'));
  console.log(`Processando ${files.length} imagens de art/raw…`);
  for (const f of files) await processCard(basename(f, '.png'), join(RAW, f));

  const missing = Object.keys(CARDS).filter((id) => !files.includes(`${id}.png`));
  if (missing.length) console.log(`Cartas ainda sem arte (usam ícone provisório): ${missing.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
