/**
 * Prepara o painel da Coleção de cartas.
 *
 *   npm run art:collection
 *
 * Entrada: art/raw/ui/colecao.png (painel com fundo transparente; título, 32 espaços e 2 setas em magenta).
 * Saída: client/public/assets/ui/colecao.png (magenta vira transparente) e client/src/collection.generated.ts
 * com as áreas em pixels da tela (1280×720): title, slots (em ordem de leitura), prev, next.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'art/raw/ui/colecao.png');
const OUT = join(ROOT, 'client/public/assets/ui/colecao.png');
const LAYOUT = join(ROOT, 'client/src/collection.generated.ts');

interface Rect { x: number; y: number; w: number; h: number }

async function main() {
  // Trabalha em 2560×1440 (o jogo é desenhado em até 2x) e converte as medidas para 1280×720.
  const { data, info } = await sharp(SRC).ensureAlpha().resize(2560, 1440, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const mag = (i: number) => data[i * 4 + 3] > 0 && data[i * 4] > 190 && data[i * 4 + 2] > 190 && data[i * 4 + 1] < 120;
  const seen = new Uint8Array(W * H);
  const holes: Rect[] = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !mag(s)) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    const st = [s];
    seen[s] = 1;
    while (st.length) {
      const i = st.pop()!;
      const x = i % W, y = (i - x) / W;
      n++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && !seen[j] && mag(j)) { seen[j] = 1; st.push(j); }
    }
    if (n > 800) holes.push({ x: Math.round(x0 / 2), y: Math.round(y0 / 2), w: Math.round((x1 - x0 + 1) / 2), h: Math.round((y1 - y0 + 1) / 2) });
  }
  // Borda rosada da redução também vira transparente.
  for (let pass = 0; pass < 3; pass++) {
    const grow: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (!data[i * 4 + 3] || mag(i)) continue;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (!(r > 140 && b > 120 && g < 150 && r - g > 60)) continue;
      const x = i % W;
      if ([x > 0 ? i - 1 : i, x < W - 1 ? i + 1 : i, i - W, i + W].some((j) => j >= 0 && j < W * H && (mag(j) || data[j * 4 + 3] === 0))) grow.push(i);
    }
    for (const i of grow) data[i * 4 + 3] = 0;
  }
  for (let i = 0; i < W * H; i++) if (mag(i)) data[i * 4 + 3] = 0;
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ palette: true, colors: 128, dither: 0 }).toFile(OUT);

  const title = holes.reduce((a, b) => (a.w > b.w ? a : b));
  const rest = holes.filter((r) => r !== title);
  // Setas: as duas áreas mais baixas (abaixo da última fila de espaços).
  const bottom = Math.max(...rest.map((r) => r.y));
  const arrows = rest.filter((r) => r.y > bottom - 10).sort((a, b) => a.x - b.x);
  const slots = rest.filter((r) => !arrows.includes(r)).sort((a, b) => Math.round(a.y / 20) - Math.round(b.y / 20) || a.x - b.x);
  if (slots.length !== 32 || arrows.length !== 2) throw new Error(`colecao: esperava 32 espaços e 2 setas; achei ${slots.length} e ${arrows.length}`);
  writeFileSync(LAYOUT, `// Gerado por tools/process-collection.ts — não edite à mão.\n// Áreas do painel da Coleção, em pixels da tela (1280×720).\nexport const COLLECTION = ${JSON.stringify({ title, slots, prev: arrows[0], next: arrows[1] }, null, 2)} as const;\n`);
  console.log(`  ✓ colecao (${slots.length} espaços)`, JSON.stringify({ title, prev: arrows[0], next: arrows[1], first: slots[0] }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
