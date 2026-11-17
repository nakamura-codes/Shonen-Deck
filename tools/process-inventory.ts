/**
 * Prepara a tela de inventário.
 *
 *   npm run art:inventory
 *
 * Entrada (art/raw/ui/):
 *  - inventario.png      fundo 16:9 com painéis; título e plaquinha do nome em magenta
 *  - molduras_peca.png   duas molduras de peça lado a lado em fundo preto (normal, selecionada), meio em magenta
 *
 * Saída:
 *  - client/public/assets/ui/inventario.png, slot_normal.png, slot_selected.png
 *  - client/src/inventory.generated.ts  posições (em pixels da tela de 1280×720) e área interna das molduras
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/ui');
const OUT = join(ROOT, 'client/public/assets/ui');
const LAYOUT = join(ROOT, 'client/src/inventory.generated.ts');

interface Rect { x: number; y: number; w: number; h: number }
type Px = { data: Buffer; w: number; h: number };

const isMag = (d: Buffer, i: number) => d[i * 4] > 200 && d[i * 4 + 2] > 200 && d[i * 4 + 1] < 110;
const isPink = (d: Buffer, i: number) => d[i * 4] > 140 && d[i * 4 + 2] > 120 && d[i * 4 + 1] < 150 && d[i * 4] - d[i * 4 + 1] > 60;
const isBlack = (d: Buffer, i: number) => d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 45;

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
        if (j >= 0 && !seen[j] && test(j)) { seen[j] = 1; st.push(j); }
      }
    }
    if (n >= minArea) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out;
}

/** Magenta (e a borda rosada) vira transparente; com `blackBg`, o preto ligado à borda também. */
function cleanup(p: Px, blackBg: boolean) {
  const d = p.data;
  if (blackBg) {
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

async function load(file: string): Promise<Px> {
  const { data, info } = await sharp(join(RAW, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

async function save(p: Px, file: string) {
  await sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } }).png({ palette: true, colors: 192, dither: 0 }).toFile(join(OUT, file));
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // Fundo: medido na resolução original e convertido para a tela de 1280×720.
  const bg = await load('inventario.png');
  const sx = 1280 / bg.w, sy = 720 / bg.h;
  const toScreen = (r: Rect): Rect => ({ x: Math.round(r.x * sx), y: Math.round(r.y * sy), w: Math.round(r.w * sx), h: Math.round(r.h * sy) });
  const holes = components(bg, (i) => isMag(bg.data, i), 2000).sort((a, b) => b.w * b.h - a.w * a.h);
  if (holes.length < 2) throw new Error(`inventario: esperava título e plaquinha em magenta; achei ${holes.length}`);
  const [title, name] = holes.slice(0, 2).sort((a, b) => a.y - b.y || b.w - a.w);
  cleanup(bg, false);
  await save(bg, 'inventario.png');
  console.log('  ✓ inventario');

  // Molduras das peças.
  const fr = await load('molduras_peca.png');
  // Cada moldura = faixa de colunas com pixels claros, separada da outra por colunas escuras.
  const bright = (x: number, y: number) => { const i = (y * fr.w + x) * 4; return fr.data[i] + fr.data[i + 1] + fr.data[i + 2] > 150; };
  const cols: [number, number][] = [];
  let c0 = -1;
  for (let x = 0; x <= fr.w; x++) {
    let any = false;
    if (x < fr.w) for (let y = 0; y < fr.h && !any; y++) any = bright(x, y);
    if (any && c0 < 0) c0 = x;
    if (!any && c0 >= 0) { if (x - c0 > 100) cols.push([c0, x]); c0 = -1; }
  }
  const shapes: Rect[] = cols.map(([x0, x1]) => {
    let y0 = fr.h, y1 = 0;
    for (let y = 0; y < fr.h; y++) for (let x = x0; x < x1; x++) if (bright(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 + 1 };
  });
  if (shapes.length < 2) throw new Error(`molduras_peca: esperava 2 molduras, achei ${shapes.length}`);
  const inner = components(fr, (i) => isMag(fr.data, i), 20000).sort((a, b) => a.x - b.x);
  cleanup(fr, true);
  const slots: Record<string, unknown> = {};
  for (const [k, name2] of [[0, 'slot_normal'], [1, 'slot_selected']] as const) {
    const r = shapes[k];
    const w = Math.round(r.w / 3), h = Math.round(r.h / 3);
    const buf = await sharp(fr.data, { raw: { width: fr.w, height: fr.h, channels: 4 } })
      .extract({ left: r.x, top: r.y, width: r.w, height: r.h }).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
    for (let i = 0; i < w * h; i++) if (isPink(buf, i)) buf[i * 4 + 3] = 0;
    await save({ data: buf, w, h }, `${name2}.png`);
    const m = inner[k];
    // Área interna em frações da moldura (0..1), para encaixar o conteúdo em qualquer tamanho.
    slots[name2] = { inner: { x: (m.x - r.x) / r.w, y: (m.y - r.y) / r.h, w: m.w / r.w, h: m.h / r.h }, aspect: r.w / r.h };
    console.log(`  ✓ ${name2} (${w}×${h})`);
  }

  const layout = { title: toScreen(title), name: toScreen(name), slots };
  writeFileSync(
    LAYOUT,
    `// Gerado por tools/process-inventory.ts — não edite à mão.\n// Posições na tela (1280×720) e área interna das molduras de peça (frações).\n` +
      `export const INV = ${JSON.stringify(layout, null, 2)} as const;\n`,
  );
  console.log('  ✓ layout', JSON.stringify(layout));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
