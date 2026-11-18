/**
 * Prepara as arenas.
 *
 *   npm run art:arenas
 *
 * Lê art/raw/arenas/<id>.png (panorâmicas 3:1 ou 16:9) e grava client/public/assets/arenas/<id>.png
 * com 1280 px de largura, que é a largura do jogo. A lista de arenas fica em shared/src/arenas.ts.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ARENAS } from '../shared/src/arenas.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/arenas');
const OUT = join(ROOT, 'client/public/assets/arenas');

/**
 * Imagens 16:9 são recortadas numa faixa 3:1. CROP_TOP diz onde a faixa começa (fração da altura),
 * escolhida para os pés dos personagens (87% da faixa) caírem no meio do chão.
 */
const CROP_TOP: Record<string, number> = {
  dragon_ball_arena_cell: 0.2,
  one_piece_thousand_sunny: 0.3,
  naruto_exame_chunin: 0.3,
  bleach_soul_society: 0.28,
  jujutsu_escola_dia: 0.28,
  jujutsu_shibuya: 0.34,
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const arena of ARENAS) {
    const src = join(RAW, `${arena.id}.png`);
    const { width = 0, height = 0 } = await sharp(src).metadata();
    let img = sharp(src);
    const bandH = Math.round(width / 3);
    if (height > bandH * 1.05) {
      const top = Math.min(height - bandH, Math.round(height * (CROP_TOP[arena.id] ?? (height - bandH) / height / 2)));
      img = img.extract({ left: 0, top, width, height: bandH });
    }
    await img
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
