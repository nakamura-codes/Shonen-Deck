/**
 * Prepara as arenas.
 *
 *   npm run art:arenas
 *
 * Lê art/raw/arenas/<id>.png (panorâmicas 3:1) e grava client/public/assets/arenas/<id>.png
 * com 1280 px de largura, que é a largura do jogo. A lista de arenas fica em shared/src/arenas.ts.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ARENAS } from '../shared/src/arenas.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/arenas');
const OUT = join(ROOT, 'client/public/assets/arenas');

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const arena of ARENAS) {
    await sharp(join(RAW, `${arena.id}.png`))
      .resize(1280, 427, { fit: 'cover', kernel: 'lanczos3' })
      .png({ palette: true, colors: 256, dither: 0.3 })
      .toFile(join(OUT, `${arena.id}.png`));
    console.log(`  ✓ ${arena.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
