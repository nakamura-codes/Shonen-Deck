/**
 * Prepara as armas (slot Mão).
 *
 *   npm run art:weapons
 *
 * Entrada: art/raw/armas/armas.png — as 5 armas lado a lado em fundo verde (#00FF00), todas na
 * diagonal apontando para cima e para a direita, com o CABO embaixo à esquerda.
 *
 * Saída:
 *  - client/public/assets/weapons/<id>.png  sprite para o boneco segurar (2 px por pixel do boneco)
 *  - client/public/assets/items/<id>.png    ícone do inventário
 *  - client/src/weapons.generated.ts        onde fica o cabo em cada sprite (para encaixar na mão)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'art/raw/armas/armas.png');
const OUT_SPRITE = join(ROOT, 'client/public/assets/weapons');
const OUT_ICON = join(ROOT, 'client/public/assets/items');
const LAYOUT = join(ROOT, 'client/src/weapons.generated.ts');

/** Da esquerda para a direita na imagem, com o comprimento (em pixels do boneco de 64×80). */
const WEAPONS: { id: string; length: number; grip?: [number, number] }[] = [
  { id: 'espada_trunks', length: 32 },
  { id: 'pistola_pirata', length: 15 },
  { id: 'kunai_ninja', length: 13 },
  // A fita pendurada no cabo engana a busca automática: o cabo é marcado à mão (fração da caixa).
  { id: 'zanpakuto', length: 36, grip: [0.13, 0.7] as [number, number] },
  { id: 'cutelo_nanami', length: 21 },
];
/** O sprite tem o dobro da resolução do boneco: mais detalhe, mesmo tamanho na tela. */
const RES = 2;

type Rect = { x: number; y: number; w: number; h: number };

async function main() {
  mkdirSync(OUT_SPRITE, { recursive: true });
  mkdirSync(OUT_ICON, { recursive: true });
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  // Fundo verde vira transparente (inclusive a borda esverdeada).
  const green = (i: number) => data[i * 4 + 1] > 150 && data[i * 4 + 1] > data[i * 4] + 60 && data[i * 4 + 1] > data[i * 4 + 2] + 60;
  for (let i = 0; i < W * H; i++) if (green(i)) data[i * 4 + 3] = 0;

  // Peças: componentes conectados de pixels opacos.
  const seen = new Uint8Array(W * H);
  const parts: Rect[] = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || data[s * 4 + 3] === 0) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    const st = [s];
    seen[s] = 1;
    while (st.length) {
      const i = st.pop()!;
      const x = i % W, y = (i - x) / W;
      n++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !seen[j] && data[j * 4 + 3] > 0) {
          seen[j] = 1;
          st.push(j);
        }
      }
    }
    if (n > 2000) parts.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  parts.sort((a, b) => a.x - b.x);
  if (parts.length !== WEAPONS.length) throw new Error(`armas: esperava ${WEAPONS.length} armas, achei ${parts.length}`);

  const layout: Record<string, { w: number; h: number; gripX: number; gripY: number }> = {};
  for (let k = 0; k < WEAPONS.length; k++) {
    const { id, length, grip } = WEAPONS[k];
    const r = parts[k];
    // Cabo: o pixel opaco mais "embaixo à esquerda" (maior y − x), um pouco para dentro.
    let best = -Infinity, gx = 0, gy = 0;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        if (data[(y * W + x) * 4 + 3] > 0 && y - (x - r.x) - r.y > best) {
          best = y - (x - r.x) - r.y;
          gx = x - r.x;
          gy = y - r.y;
        }
    const diag = Math.hypot(r.w, r.h);
    if (grip) {
      gx = grip[0] * r.w;
      gy = grip[1] * r.h;
    } else {
      const inset = diag * 0.1;
      gx += inset / Math.SQRT2;
      gy -= inset / Math.SQRT2;
    }

    const crop = sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract({ left: r.x, top: r.y, width: r.w, height: r.h });
    const buf = await crop.png().toBuffer();
    const k2 = (length * RES) / diag;
    const sw = Math.max(4, Math.round(r.w * k2)), sh = Math.max(4, Math.round(r.h * k2));
    // Reduz e deixa o alfa duro (pixel art sem borda borrada).
    const small = await sharp(buf).resize(sw, sh, { kernel: 'lanczos3' }).raw().toBuffer();
    for (let i = 0; i < sw * sh; i++) small[i * 4 + 3] = small[i * 4 + 3] > 110 ? 255 : 0;
    await sharp(small, { raw: { width: sw, height: sh, channels: 4 } }).png().toFile(join(OUT_SPRITE, `${id}.png`));
    layout[id] = { w: sw, h: sh, gripX: +(gx * k2).toFixed(1), gripY: +(gy * k2).toFixed(1) };

    // Ícone do inventário: a arma inteira com 56 px no lado maior (como os ícones das roupas).
    const iconK = 56 / Math.max(r.w, r.h);
    const iw = Math.round(r.w * iconK), ih = Math.round(r.h * iconK);
    const icon = await sharp(buf).resize(iw, ih, { kernel: 'lanczos3' }).raw().toBuffer();
    for (let i = 0; i < iw * ih; i++) icon[i * 4 + 3] = icon[i * 4 + 3] > 110 ? 255 : 0;
    await sharp(icon, { raw: { width: iw, height: ih, channels: 4 } }).png().toFile(join(OUT_ICON, `${id}.png`));
    console.log(`  ✓ ${id} (${sw}×${sh}, cabo em ${layout[id].gripX},${layout[id].gripY})`);
  }

  writeFileSync(
    LAYOUT,
    `// Gerado por tools/process-weapons.ts — não edite à mão.\n` +
      `// Tamanho de cada sprite de arma (2 px por pixel do boneco) e onde fica o cabo, apontando para cima e para a direita.\n` +
      `export const WEAPON_RES = ${RES};\nexport const WEAPONS: Record<string, { w: number; h: number; gripX: number; gripY: number }> = ${JSON.stringify(layout, null, 2)};\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
