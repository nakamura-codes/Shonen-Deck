/**
 * Prepara as arenas.
 *
 *   npm run art:arenas
 *
 * Lê art/raw/arenas/<id>.png (16:9, ex.: 1920×1080) e grava client/public/assets/arenas/<id>.png
 * em 1280×720: a arena é o fundo da tela inteira e a HUD fica por cima, embaixo.
 * O chão onde os personagens pisam deve ficar entre ~52% e ~66% da altura.
 * A lista de arenas fica em shared/src/arenas.ts.
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
      .resize(1280, 720, { fit: 'cover', kernel: 'lanczos3' })
      .png({ palette: true, colors: 256, dither: 0.3 })
      .toFile(join(OUT, `${arena.id}.png`));
    console.log(`  ✓ ${arena.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
