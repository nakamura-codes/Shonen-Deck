/**
 * Prepara as molduras das cartas.
 *
 *   npm run art:frames
 *
 * Lê art/raw/cards_frames/{ataque,tecnica,poder,verso}.png (áreas de conteúdo pintadas de magenta),
 * reduz para o tamanho da carta no jogo, troca o magenta por transparente e grava:
 *  - client/public/assets/cards/frames/<tipo>.png
 *  - client/src/cardFrames.generated.ts  (onde fica cada área em cada moldura)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/cards_frames');
const OUT = join(ROOT, 'client/public/assets/cards/frames');
const LAYOUT = join(ROOT, 'client/src/cardFrames.generated.ts');

/** Tamanho da carta no jogo (proporção 2:3, igual às molduras). */
const CARD_W = 156;
const CARD_H = 234;

const FRAMES = { attack: 'ataque', skill: 'tecnica', power: 'poder' } as const;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const isMagenta = (r: number, g: number, b: number) => r > 225 && b > 225 && g < 70;

/** Caixas das áreas magenta: separa em faixas horizontais e, dentro de cada faixa, em blocos. */
function regions(data: Buffer, W: number, H: number): Rect[] {
  const mag = (x: number, y: number) => {
    const i = (y * W + x) * 3;
    return isMagenta(data[i], data[i + 1], data[i + 2]);
  };
  const out: Rect[] = [];
  let y = 0;
  while (y < H) {
    let any = false;
    for (let x = 0; x < W && !any; x++) any = mag(x, y);
    if (!any) {
      y++;
      continue;
    }
    const y0 = y;
    while (y < H) {
      let rowAny = false;
      for (let x = 0; x < W && !rowAny; x++) rowAny = mag(x, y);
      if (!rowAny) break;
      y++;
    }
    let x = 0;
    while (x < W) {
      let colAny = false;
      for (let yy = y0; yy < y && !colAny; yy++) colAny = mag(x, yy);
      if (!colAny) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < W) {
        let c = false;
        for (let yy = y0; yy < y && !c; yy++) c = mag(x, yy);
        if (!c) break;
        x++;
      }
      if ((x - x0) * (y - y0) > 2000) out.push({ x: x0, y: y0, w: x - x0, h: y - y0 });
    }
  }
  return out;
}

/** Na faixa de cima ficam o círculo do custo (canto esquerdo) e a janela hexagonal. */
function splitTop(data: Buffer, W: number, top: Rect): { cost: Rect; art: Rect } {
  const mag = (x: number, y: number) => {
    const i = (y * W + x) * 3;
    return isMagenta(data[i], data[i + 1], data[i + 2]);
  };
  // Círculo: só a área magenta conectada ao primeiro pixel magenta do canto superior esquerdo
  // (preenchimento), para não pegar pedaços da janela da arte.
  let seed = -1;
  const lim = Math.round(W * 0.25);
  for (let y = top.y; y < top.y + lim && seed < 0; y++)
    for (let x = top.x; x < top.x + lim; x++)
      if (mag(x, y)) {
        seed = y * W + x;
        break;
      }
  const inCircle = new Uint8Array(W * data.length / 3 / W);
  let cx0 = W, cy0 = 1e9, cx1 = 0, cy1 = 0;
  const stack = seed >= 0 ? [seed] : [];
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    if (inCircle[i] || !mag(x, y) || x >= top.x + lim || y >= top.y + lim) continue;
    inCircle[i] = 1;
    cx0 = Math.min(cx0, x); cy0 = Math.min(cy0, y); cx1 = Math.max(cx1, x); cy1 = Math.max(cy1, y);
    stack.push(i - 1, i + 1, i - W, i + W);
  }
  // Janela: largura medida abaixo do círculo (onde o hexágono é mais largo); topo e base
  // medidos na faixa central, longe do círculo.
  let ax0 = W, ay0 = 1e9, ax1 = 0, ay1 = 0;
  for (let y = cy1 + 4; y < top.y + top.h; y++)
    for (let x = top.x; x < top.x + top.w; x++)
      if (mag(x, y) && !inCircle[y * W + x]) {
        ax0 = Math.min(ax0, x);
        ax1 = Math.max(ax1, x);
      }
  for (let y = top.y; y < top.y + top.h; y++)
    for (let x = Math.round(W * 0.3); x < Math.round(W * 0.7); x++)
      if (mag(x, y)) {
        ay0 = Math.min(ay0, y);
        ay1 = Math.max(ay1, y);
      }
  return {
    cost: { x: cx0, y: cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1 },
    art: { x: ax0, y: ay0, w: ax1 - ax0 + 1, h: ay1 - ay0 + 1 },
  };
}

async function frame(file: string, outName: string, transparentHoles: boolean) {
  const src = sharp(join(RAW, `${file}.png`)).removeAlpha();
  const { data, info } = await src.clone().raw().toBuffer({ resolveWithObject: true });
  const small = await src
    .resize(CARD_W, CARD_H, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(CARD_W * CARD_H * 4);
  for (let i = 0; i < CARD_W * CARD_H; i++) {
    const r = small.data[i * 3], g = small.data[i * 3 + 1], b = small.data[i * 3 + 2];
    // Magenta (e a borda misturada com ele) vira buraco.
    const pinkish = r > 200 && b > 200 && g < 130 && Math.abs(r - b) < 60;
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b;
    out[i * 4 + 3] = transparentHoles && pinkish ? 0 : 255;
  }
  // A redução mistura o magenta com a moldura e deixa uma borda rosada em volta dos buracos.
  // Os pixels rosados vizinhos de um buraco também viram buraco (algumas passadas).
  if (transparentHoles) {
    for (let pass = 0; pass < 3; pass++) {
      const grow: number[] = [];
      for (let y = 1; y < CARD_H - 1; y++)
        for (let x = 1; x < CARD_W - 1; x++) {
          const i = y * CARD_W + x;
          if (out[i * 4 + 3] === 0) continue;
          const r = out[i * 4], g = out[i * 4 + 1], b = out[i * 4 + 2];
          const rosado = r > 140 && b > 120 && g < 150 && r - g > 60 && b - g > 40;
          if (!rosado) continue;
          if ([i - 1, i + 1, i - CARD_W, i + CARD_W].some((j) => out[j * 4 + 3] === 0)) grow.push(i);
        }
      for (const i of grow) out[i * 4 + 3] = 0;
    }
  }
  await sharp(out, { raw: { width: CARD_W, height: CARD_H, channels: 4 } })
    .png({ palette: true, colors: 96, dither: 0 })
    .toFile(join(OUT, `${outName}.png`));
  console.log(`  ✓ ${outName}`);
  return { data, W: info.width, H: info.height, alpha: out };
}

/** Buraco (transparente) da moldura reduzida que contém o centro de `guess`: a medida exata usada no jogo. */
function holeAround(alpha: Buffer, guess: Rect): Rect {
  const seed = Math.round(guess.y + guess.h / 2) * CARD_W + Math.round(guess.x + guess.w / 2);
  if (alpha[seed * 4 + 3] !== 0) return guess;
  const seen = new Uint8Array(CARD_W * CARD_H);
  let x0 = CARD_W, y0 = CARD_H, x1 = 0, y1 = 0;
  const st = [seed];
  while (st.length) {
    const i = st.pop()!;
    const x = i % CARD_W, y = (i - x) / CARD_W;
    if (seen[i] || alpha[i * 4 + 3] !== 0 || x > guess.x + guess.w + 6 || y > guess.y + guess.h + 6) continue;
    seen[i] = 1;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (x > 0) st.push(i - 1);
    if (x < CARD_W - 1) st.push(i + 1);
    if (y > 0) st.push(i - CARD_W);
    if (y < CARD_H - 1) st.push(i + CARD_W);
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const scaleRect = (r: Rect, W: number, H: number): Rect => ({
  x: Math.round((r.x / W) * CARD_W),
  y: Math.round((r.y / H) * CARD_H),
  w: Math.round((r.w / W) * CARD_W),
  h: Math.round((r.h / H) * CARD_H),
});

async function main() {
  mkdirSync(OUT, { recursive: true });
  const layout: Record<string, Record<string, Rect>> = {};
  for (const [type, file] of Object.entries(FRAMES)) {
    const { data, W, H, alpha } = await frame(file, type, true);
    const regs = regions(data, W, H).sort((a, b) => a.y - b.y);
    // Ignora pedaços pequenos (ex.: um canto) e fica com as 4 áreas principais por altura.
    const main4 = regs.filter((r) => r.w > W * 0.4).sort((a, b) => a.y - b.y);
    if (main4.length < 4) throw new Error(`${file}: esperava 4 áreas magenta, achei ${main4.length}`);
    const [top, name, text, typeStrip] = main4;
    const { cost, art } = splitTop(data, W, top);
    layout[type] = {
      cost: holeAround(alpha, scaleRect(cost, W, H)),
      art: scaleRect(art, W, H),
      name: scaleRect(name, W, H),
      text: scaleRect(text, W, H),
      type: scaleRect(typeStrip, W, H),
    };
  }
  await frame('verso', 'back', false);
  writeFileSync(
    LAYOUT,
    `// Gerado por tools/process-frames.ts — não edite à mão.\n` +
      `// Áreas de cada moldura, em pixels, com a carta de ${CARD_W}×${CARD_H} e origem no canto superior esquerdo.\n` +
      `export const FRAME_SIZE = { w: ${CARD_W}, h: ${CARD_H} } as const;\n` +
      `export const FRAME_LAYOUT = ${JSON.stringify(layout, null, 2)} as const;\n`,
  );
  console.log('  ✓ layout das molduras');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
