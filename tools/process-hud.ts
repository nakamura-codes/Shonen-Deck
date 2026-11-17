/**
 * Prepara a HUD de baixo da batalha e os botões.
 *
 *   npm run art:hud
 *
 * Entrada (art/raw/ui/):
 *  - hud.png     faixa 2560×586 (o dobro de 1280×293), fundo preto nos cantos, áreas em magenta
 *  - botoes.png  três botões lado a lado em fundo preto: normal, mouse em cima, desabilitado
 *
 * Saída:
 *  - client/public/assets/ui/hud.png, btn_normal.png, btn_hover.png, btn_disabled.png
 *  - client/src/hud.generated.ts  posição de cada área da HUD (em pixels da tela de 1280×720)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/ui');
const OUT = join(ROOT, 'client/public/assets/ui');
const LAYOUT = join(ROOT, 'client/src/hud.generated.ts');

const HUD_W = 1280;
const HUD_H = 293;
const HUD_Y = 720 - HUD_H;

interface Rect { x: number; y: number; w: number; h: number }

type Px = { data: Buffer; w: number; h: number };

const isMag = (d: Buffer, i: number) => d[i * 4] > 200 && d[i * 4 + 2] > 200 && d[i * 4 + 1] < 110;
const isPink = (d: Buffer, i: number) => d[i * 4] > 140 && d[i * 4 + 2] > 120 && d[i * 4 + 1] < 150 && d[i * 4] - d[i * 4 + 1] > 60;
const isBlack = (d: Buffer, i: number) => d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 45;

/** Componentes conectados que satisfazem `test` (caixas). */
function components(p: Px, test: (i: number) => boolean, minArea: number): Rect[] {
  const seen = new Uint8Array(p.w * p.h);
  const out: Rect[] = [];
  for (let s = 0; s < p.w * p.h; s++) {
    if (seen[s] || !test(s)) continue;
    let x0 = p.w, y0 = p.h, x1 = 0, y1 = 0, n = 0;
    const st = [s];
    seen[s] = 1;
    while (st.length) {
      const i = st.pop()!;
      const x = i % p.w, y = (i - x) / p.w;
      n++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const j of [x > 0 ? i - 1 : -1, x < p.w - 1 ? i + 1 : -1, y > 0 ? i - p.w : -1, y < p.h - 1 ? i + p.w : -1]) {
        if (j >= 0 && !seen[j] && test(j)) {
          seen[j] = 1;
          st.push(j);
        }
      }
    }
    if (n >= minArea) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

/** Fundo preto ligado à borda da imagem vira transparente; magenta (e a borda rosada) também. */
function cleanup(p: Px) {
  const d = p.data;
  const st: number[] = [];
  for (let x = 0; x < p.w; x++) st.push(x, (p.h - 1) * p.w + x);
  for (let y = 0; y < p.h; y++) st.push(y * p.w, y * p.w + p.w - 1);
  const seen = new Uint8Array(p.w * p.h);
  while (st.length) {
    const i = st.pop()!;
    if (seen[i] || !isBlack(d, i)) continue;
    seen[i] = 1;
    d[i * 4 + 3] = 0;
    const x = i % p.w, y = (i - x) / p.w;
    if (x > 0) st.push(i - 1);
    if (x < p.w - 1) st.push(i + 1);
    if (y > 0) st.push(i - p.w);
    if (y < p.h - 1) st.push(i + p.w);
  }
  for (let i = 0; i < p.w * p.h; i++) if (isMag(d, i)) d[i * 4 + 3] = 0;
  for (let pass = 0; pass < 3; pass++) {
    const grow: number[] = [];
    for (let i = 0; i < p.w * p.h; i++) {
      if (d[i * 4 + 3] === 0 || !isPink(d, i)) continue;
      const x = i % p.w;
      if ([x > 0 ? i - 1 : i, x < p.w - 1 ? i + 1 : i, i - p.w, i + p.w].some((j) => j >= 0 && j < p.w * p.h && d[j * 4 + 3] === 0)) grow.push(i);
    }
    for (const i of grow) d[i * 4 + 3] = 0;
  }
}

async function load(file: string, w?: number, h?: number): Promise<Px> {
  let img = sharp(join(RAW, file)).ensureAlpha();
  if (w && h) img = img.resize(w, h, { kernel: 'lanczos3' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function save(p: Px, file: string) {
  await sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } }).png({ palette: true, colors: 128, dither: 0 }).toFile(join(OUT, file));
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // HUD: mede as áreas magenta na imagem reduzida (antes de virarem transparentes).
  const hud = await load('hud.png', HUD_W, HUD_H);
  const holes = components(hud, (i) => isMag(hud.data, i), 150).sort((a, b) => a.y - b.y || a.x - b.x);
  const top = holes.filter((r) => r.w > HUD_W * 0.2).sort((a, b) => a.x - b.x); // barras de HP
  const rest = holes.filter((r) => r.w <= HUD_W * 0.2);
  const left = rest.filter((r) => r.x < HUD_W * 0.25);
  const right = rest.filter((r) => r.x > HUD_W * 0.75).sort((a, b) => a.y - b.y);
  const ki = left.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
  const piles = left.filter((r) => r !== ki).sort((a, b) => a.x - b.x);
  if (top.length !== 2 || piles.length !== 2 || right.length !== 2) {
    throw new Error(`HUD: esperava 2 barras, 1 círculo, 2 contadores e 2 botões; achei ${JSON.stringify(holes)}`);
  }
  // Área das cartas: o retângulo escuro do meio (entre o círculo e os botões).
  const shift = (r: Rect): Rect => ({ x: r.x, y: r.y + HUD_Y, w: r.w, h: r.h });
  cleanup(hud);
  await save(hud, 'hud.png');
  console.log('  ✓ hud');

  // Botões: três figuras lado a lado.
  const btn = await load('botoes.png');
  const shapes = components(btn, (i) => !isBlack(btn.data, i), 5000).sort((a, b) => a.x - b.x);
  if (shapes.length < 3) throw new Error(`botoes: esperava 3 botões, achei ${shapes.length}`);
  cleanup(btn);
  const names = ['btn_normal', 'btn_hover', 'btn_disabled'];
  for (let k = 0; k < 3; k++) {
    const r = shapes[k];
    const w = Math.round(r.w / 2), h = Math.round(r.h / 2);
    const crop = await sharp(btn.data, { raw: { width: btn.w, height: btn.h, channels: 4 } })
      .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
      .resize(w, h, { kernel: 'lanczos3' })
      .raw()
      .toBuffer();
    // Limpa de novo a borda rosada que a redução cria.
    const p: Px = { data: crop, w, h };
    for (let i = 0; i < w * h; i++) if (isPink(crop, i) && crop[i * 4 + 3] > 0) crop[i * 4 + 3] = 0;
    await save(p, `${names[k]}.png`);
    console.log(`  ✓ ${names[k]} (${w}×${h})`);
  }

  const layout = {
    panel: { x: 0, y: HUD_Y, w: HUD_W, h: HUD_H },
    hpLeft: shift(top[0]),
    hpRight: shift(top[1]),
    ki: shift(ki),
    drawPile: shift(piles[0]),
    discardPile: shift(piles[1]),
    readyBtn: shift(right[0]),
    undoBtn: shift(right[1]),
  };
  writeFileSync(
    LAYOUT,
    `// Gerado por tools/process-hud.ts — não edite à mão.\n// Áreas da HUD de baixo, em pixels da tela (1280×720).\n` +
      `export const HUD = ${JSON.stringify(layout, null, 2)} as const;\n`,
  );
  console.log('  ✓ layout da HUD', JSON.stringify(layout));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
