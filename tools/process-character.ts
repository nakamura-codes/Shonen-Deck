/**
 * Prepara a arte do personagem e dos ícones de roupa.
 *
 *   npm run art:character
 *
 * Entrada (art/raw/character/):
 *  - humanoide_cinza.png   boneco cinza sem roupa (folha com 4 quadros; usamos o primeiro)
 *  - seis_visuais.png      3 peças de cabeça sozinhas + 3 peças de corpo sozinhas
 *  - nove_combinacoes.png  3×3: linhas = cabeça, colunas = corpo
 *  - icones_roupas.png     ícones do inventário (2 linhas × 3)
 *  - combinacoes_naruto_hollow.png  linha 1: cada cabeça + uniforme do Naruto; linha 2: máscara + cada corpo
 *  - mascara_hollow.png    máscara Hollow sozinha
 *  - uniforme_naruto.png   uniforme do Naruto sozinho
 *
 * Saída:
 *  - client/public/assets/character/fig_<cabeça|none>_<corpo|none>.png  (as 16 combinações)
 *  - client/public/assets/items/<id>.png
 *
 * Todas as figuras são reduzidas para a mesma escala (corpo com BODY_H pixels) e
 * alinhadas pelos pés, para trocar de roupa sem o personagem "pular".
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/character');
const OUT_FIG = join(ROOT, 'client/public/assets/character');
const OUT_ITEMS = join(ROOT, 'client/public/assets/items');

const HEADS = ['chapeu_palha', 'venda_olhos', 'bandana_ninja'] as const;
const BODIES = ['gi_laranja', 'shihakusho', 'uniforme_jujutsu'] as const;
const MASK = 'mascara_hollow';
const NARUTO = 'uniforme_naruto';
const LUFFY = 'roupa_luffy';

/** Altura do corpo (sem chapéu) em pixels na arte final. */
const BODY_H = 64;
const CANVAS_W = 64;
const CANVAS_H = 80;
const FEET_Y = CANVAS_H - 2;

interface Img {
  w: number;
  h: number;
  data: Buffer; // RGBA
}

async function load(file: string): Promise<Img> {
  const { data, info } = await sharp(join(RAW, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data };
}

const opaque = (img: Img, x: number, y: number) => img.data[(y * img.w + x) * 4 + 3] > 100;

/** Trechos contínuos onde a máscara é verdadeira (ignora trechos muito pequenos). */
function runs(mask: boolean[], min = 20): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  mask.forEach((v, i) => {
    if (v && s < 0) s = i;
    if (!v && s >= 0) {
      out.push([s, i]);
      s = -1;
    }
  });
  if (s >= 0) out.push([s, mask.length]);
  return out.filter(([a, b]) => b - a >= min);
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Acha as figuras: primeiro as linhas, depois as colunas de cada linha. */
function findFigures(img: Img): Box[][] {
  const rowMask = Array.from({ length: img.h }, (_, y) => {
    for (let x = 0; x < img.w; x++) if (opaque(img, x, y)) return true;
    return false;
  });
  return runs(rowMask).map(([y0, y1]) => {
    const colMask = Array.from({ length: img.w }, (_, x) => {
      for (let y = y0; y < y1; y++) if (opaque(img, x, y)) return true;
      return false;
    });
    return runs(colMask).map(([x0, x1]) => {
      let top = y1;
      let bottom = y0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          if (opaque(img, x, y)) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y + 1);
          }
      return { x0, y0: top, x1, y1: bottom };
    });
  });
}

/** Recorta, reduz para a escala do jogo, limpa a paleta e alinha pelos pés. */
async function normalize(img: Img, box: Box, scale: number): Promise<Buffer> {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const crop = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(crop, y * w * 4, ((box.y0 + y) * img.w + box.x0) * 4, ((box.y0 + y) * img.w + box.x1) * 4);

  const small = await sharp(crop, { raw: { width: w, height: h, channels: 4 } })
    .resize(tw, th, { kernel: 'lanczos3' })
    .png({ palette: true, colors: 48, dither: 0 })
    .toBuffer()
    .then((b) => sharp(b).ensureAlpha().raw().toBuffer());

  // Centro dos pés (últimas linhas) para alinhar todas as figuras no mesmo ponto.
  let sum = 0;
  let count = 0;
  for (let y = th - Math.max(3, Math.round(th * 0.06)); y < th; y++)
    for (let x = 0; x < tw; x++)
      if (small[(y * tw + x) * 4 + 3] > 127) {
        sum += x;
        count++;
      }
  const feetX = count ? sum / count : tw / 2;

  const out = Buffer.alloc(CANVAS_W * CANVAS_H * 4);
  const ox = Math.round(CANVAS_W / 2 - feetX);
  const oy = FEET_Y - th;
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4;
      if (small[i + 3] <= 127) continue;
      const cx = x + ox;
      const cy = y + oy;
      if (cx < 0 || cy < 0 || cx >= CANVAS_W || cy >= CANVAS_H) continue;
      const o = (cy * CANVAS_W + cx) * 4;
      out[o] = small[i];
      out[o + 1] = small[i + 1];
      out[o + 2] = small[i + 2];
      out[o + 3] = 255;
    }
  return out;
}

async function save(buf: Buffer, w: number, h: number, file: string) {
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
}

async function figures() {
  mkdirSync(OUT_FIG, { recursive: true });
  const write = async (img: Img, box: Box, bodyHeight: number, head: string, body: string) => {
    const buf = await normalize(img, box, BODY_H / bodyHeight);
    await save(buf, CANVAS_W, CANVAS_H, join(OUT_FIG, `fig_${head}_${body}.png`));
    console.log(`  ✓ fig_${head}_${body}`);
  };

  // Boneco cinza: a figura inteira é corpo (sem chapéu).
  const gray = await load('humanoide_cinza.png');
  const grayBox = findFigures(gray)[0][0];
  await write(gray, grayBox, grayBox.y1 - grayBox.y0, 'none', 'none');

  // Seis visuais: as 3 roupas de corpo não têm nada na cabeça, então dão a altura do corpo.
  const six = await load('seis_visuais.png');
  const sixBoxes = findFigures(six)[0];
  if (sixBoxes.length !== 6) throw new Error(`seis_visuais: esperava 6 figuras, achei ${sixBoxes.length}`);
  const sixBody = Math.max(...sixBoxes.slice(3).map((b) => b.y1 - b.y0));
  for (let i = 0; i < 3; i++) await write(six, sixBoxes[i], sixBody, HEADS[i], 'none');
  for (let i = 0; i < 3; i++) await write(six, sixBoxes[3 + i], sixBody, 'none', BODIES[i]);

  // Nove combinações: todas têm algo na cabeça. A bandana quase não aumenta a altura,
  // então a linha da bandana (corrigida pela proporção vista nos seis visuais) dá a escala.
  const nine = await load('nove_combinacoes.png');
  const grid = findFigures(nine);
  if (grid.length !== 3 || grid.some((r) => r.length !== 3)) throw new Error('nove_combinacoes: esperava uma grade 3×3');
  const bandanaExtra = (sixBoxes[2].y1 - sixBoxes[2].y0) / sixBody;
  const nineBody = Math.max(...grid[2].map((b) => b.y1 - b.y0)) / bandanaExtra;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) await write(nine, grid[r][c], nineBody, HEADS[r], BODIES[c]);

  // Máscara Hollow e uniforme do Naruto. A máscara não aumenta a altura, então as figuras
  // com máscara dão a altura do corpo.
  const extra = await load('combinacoes_naruto_hollow.png');
  const rows = findFigures(extra);
  if (rows.length !== 2 || rows[0].length !== 4 || rows[1].length !== 3) throw new Error('combinacoes_naruto_hollow: esperava 4 + 3 figuras');
  const extraBody = Math.max(...rows[1].map((b) => b.y1 - b.y0));
  for (let i = 0; i < 3; i++) await write(extra, rows[0][i], extraBody, HEADS[i], NARUTO);
  await write(extra, rows[0][3], extraBody, MASK, NARUTO);
  for (let i = 0; i < 3; i++) await write(extra, rows[1][i], extraBody, MASK, BODIES[i]);

  for (const [file, head, body] of [
    ['mascara_hollow.png', MASK, 'none'],
    ['uniforme_naruto.png', 'none', NARUTO],
  ] as const) {
    const img = await load(file);
    const box = findFigures(img)[0][0];
    await write(img, box, box.y1 - box.y0, head, body);
  }
}

/** Linha do pescoço: a linha mais estreita entre 20% e 50% da altura da figura. */
function neckRow(img: Img, box: Box): number {
  let best = box.y0;
  let bestW = Infinity;
  const h = box.y1 - box.y0;
  for (let y = box.y0 + Math.round(h * 0.2); y < box.y0 + Math.round(h * 0.5); y++) {
    let w = 0;
    for (let x = box.x0; x < box.x1; x++) if (opaque(img, x, y)) w++;
    if (w < bestW) {
      bestW = w;
      best = y;
    }
  }
  return best;
}

/** Ícone recortado de uma figura (para peças que vieram sem ícone próprio). */
async function iconFromFigure(file: string | Img, part: 'head' | 'body', id: string) {
  const img = typeof file === 'string' ? await load(file) : file;
  const box = findFigures(img)[0][0];
  const neck = neckRow(img, box);
  const y0 = part === 'head' ? box.y0 : neck;
  const y1 = part === 'head' ? neck : box.y0 + Math.round((box.y1 - box.y0) * 0.72);
  const w = box.x1 - box.x0;
  const h = y1 - y0;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.data.copy(buf, y * w * 4, ((y0 + y) * img.w + box.x0) * 4, ((y0 + y) * img.w + box.x1) * 4);
  const trimmed = await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const tw = 56;
  const th = Math.min(48, Math.round(((meta.height ?? 1) / (meta.width ?? 1)) * tw));
  const { data, info } = await sharp(trimmed)
    .resize(tw, th, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png({ palette: true, colors: 32, dither: 0 })
    .toBuffer()
    .then((b) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] > 127 ? 255 : 0;
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(join(OUT_ITEMS, `${id}.png`));
  console.log(`  ✓ item ${id} (recortado da figura)`);
}

/** Ícones do inventário: 6 painéis azuis separados por linhas escuras. O azul vira transparente. */
async function items() {
  mkdirSync(OUT_ITEMS, { recursive: true });
  const img = await load('icones_roupas.png');
  const isDark = (x: number, y: number) => {
    const i = (y * img.w + x) * 4;
    return img.data[i] + img.data[i + 1] + img.data[i + 2] < 120;
  };
  const panelRows = runs(Array.from({ length: img.h }, (_, y) => !Array.from({ length: img.w }, (_, x) => x).every((x) => isDark(x, y))), 100);
  const panelCols = runs(Array.from({ length: img.w }, (_, x) => !Array.from({ length: img.h }, (_, y) => y).every((y) => isDark(x, y))), 100);
  const ids = [...HEADS, ...BODIES];
  const inset = 14;
  let k = 0;
  for (const [y0, y1] of panelRows) {
    for (const [x0, x1] of panelCols) {
      const id = ids[k++];
      if (!id) break;
      const w = x1 - x0 - inset * 2;
      const h = y1 - y0 - inset * 2;
      const buf = Buffer.alloc(w * h * 4);
      const bg = (() => {
        const i = ((y0 + inset) * img.w + x0 + inset) * 4;
        return [img.data[i], img.data[i + 1], img.data[i + 2]];
      })();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = ((y0 + inset + y) * img.w + x0 + inset + x) * 4;
          const o = (y * w + x) * 4;
          const d = Math.abs(img.data[i] - bg[0]) + Math.abs(img.data[i + 1] - bg[1]) + Math.abs(img.data[i + 2] - bg[2]);
          if (d < 70) continue; // fundo azul
          buf[o] = img.data[i];
          buf[o + 1] = img.data[i + 1];
          buf[o + 2] = img.data[i + 2];
          buf[o + 3] = 255;
        }
      // Recorta o que sobrou e reduz para 56 px de largura.
      const trimmed = await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
      const meta = await sharp(trimmed).metadata();
      const tw = 56;
      const th = Math.round(((meta.height ?? 1) / (meta.width ?? 1)) * tw);
      await sharp(trimmed)
        .resize(tw, th, { kernel: 'lanczos3' })
        .png({ palette: true, colors: 32, dither: 0 })
        .toBuffer()
        .then((b) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }))
        .then(({ data, info }) => {
          for (let i = 3; i < data.length; i += 4) data[i] = data[i] > 127 ? 255 : 0;
          return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(join(OUT_ITEMS, `${id}.png`));
        });
      console.log(`  ✓ item ${id}`);
    }
  }
}

async function main() {
  console.log('Figuras do personagem…');
  await figures();
  console.log('Ícones das roupas…');
  await items();
  await iconFromFigure('mascara_hollow.png', 'head', MASK);
  await iconFromFigure('uniforme_naruto.png', 'body', NARUTO);
  console.log('Roupa do Luffy…');
  await luffyOutfit();
  console.log('Scouter…');
  await scouterLayer();
  await scouterOutfits();
  await scouterFromReady();
  await scouterSheet();
  await soloIcons();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Scouter: vem desenhado no boneco cinza (art/raw/character/scouter.jpg, fundo preto).
 * Pegamos só os pixels do aparelho (verde, vermelho, branco e o contorno em volta) e
 * reamostramos para a escala das figuras, na mesma posição relativa à cabeça.
 * Medidas da cabeça (em pixels): na imagem original e na figura final de 64×80.
 */
const SCOUTER_SRC = { headCenterX: 143.5, headTop: 36, headHeight: 122 };
const FIG_HEAD = { centerX: 31.5, top: 16, height: 20 };
const SCOUTER_ZOOM = 1.3; // um pouco maior que a escala real, para aparecer melhor

export async function scouterLayer() {
  const { data, info } = await sharp(join(RAW, 'scouter.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const px = (x: number, y: number) => [data[(y * W + x) * 3], data[(y * W + x) * 3 + 1], data[(y * W + x) * 3 + 2]];
  const isCore = (x: number, y: number) => {
    const [r, g, b] = px(x, y);
    return (g > r + 30 && g > b + 30) || (r > g + 60 && r > b + 60) || Math.min(r, g, b) > 222;
  };
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  const core = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (isCore(x, y)) {
        core[y * W + x] = 1;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
  // Contorno escuro perto do aparelho também faz parte dele.
  const keep = (x: number, y: number) => {
    if (core[y * W + x]) return true;
    if (Math.max(...px(x, y)) >= 70) return false;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && core[yy * W + xx]) return true;
      }
    return false;
  };
  const scale = (FIG_HEAD.height / SCOUTER_SRC.headHeight) * SCOUTER_ZOOM;
  const u = ((x0 + x1) / 2 - SCOUTER_SRC.headCenterX) / SCOUTER_SRC.headHeight;
  const v = ((y0 + y1) / 2 - SCOUTER_SRC.headTop) / SCOUTER_SRC.headHeight;
  const cx = FIG_HEAD.centerX + u * FIG_HEAD.height;
  const cy = FIG_HEAD.top + v * FIG_HEAD.height;
  const sx0 = x0 - 6, sy0 = y0 - 6, sx1 = x1 + 7, sy1 = y1 + 7;
  const ox = cx - ((sx1 - sx0) * scale) / 2;
  const oy = cy - ((sy1 - sy0) * scale) / 2;

  // Cada pixel final = média dos pixels originais que caem nele (só se a maioria for scouter).
  const sum = new Float64Array(CANVAS_W * CANVAS_H * 3);
  const hit = new Float64Array(CANVAS_W * CANVAS_H);
  const all = new Float64Array(CANVAS_W * CANVAS_H);
  for (let y = sy0; y < sy1; y++)
    for (let x = sx0; x < sx1; x++) {
      const X = Math.floor(ox + (x - sx0) * scale);
      const Y = Math.floor(oy + (y - sy0) * scale);
      if (X < 0 || Y < 0 || X >= CANVAS_W || Y >= CANVAS_H) continue;
      const i = Y * CANVAS_W + X;
      all[i]++;
      if (keep(x, y)) {
        hit[i]++;
        const [r, g, b] = px(x, y);
        sum[i * 3] += r; sum[i * 3 + 1] += g; sum[i * 3 + 2] += b;
      }
    }
  const out = Buffer.alloc(CANVAS_W * CANVAS_H * 4);
  for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
    if (!all[i] || hit[i] / all[i] < 0.45) continue;
    out[i * 4] = sum[i * 3] / hit[i];
    out[i * 4 + 1] = sum[i * 3 + 1] / hit[i];
    out[i * 4 + 2] = sum[i * 3 + 2] / hit[i];
    out[i * 4 + 3] = 255;
  }
  // O Scouter é uma peça de cabeça: a figura é o boneco sem nada na cabeça + o aparelho.
  for (const body of ['none', ...BODIES, NARUTO, LUFFY]) {
    const base = await sharp(join(OUT_FIG, `fig_none_${body}.png`)).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < CANVAS_W * CANVAS_H; i++) if (out[i * 4 + 3]) out.copy(base, i * 4, i * 4, i * 4 + 4);
    await save(base, CANVAS_W, CANVAS_H, join(OUT_FIG, `fig_scouter_${body}.png`));
    console.log(`  ✓ fig_scouter_${body}`);
  }

  // Ícone do inventário: o aparelho recortado, ampliado sem suavizar.
  const iw = sx1 - sx0, ih = sy1 - sy0;
  const icon = Buffer.alloc(iw * ih * 4);
  for (let y = 0; y < ih; y++)
    for (let x = 0; x < iw; x++) {
      if (!keep(sx0 + x, sy0 + y)) continue;
      const [r, g, b] = px(sx0 + x, sy0 + y);
      const o = (y * iw + x) * 4;
      icon[o] = r; icon[o + 1] = g; icon[o + 2] = b; icon[o + 3] = 255;
    }
  await sharp(icon, { raw: { width: iw, height: ih, channels: 4 } })
    .resize(56, Math.round((ih / iw) * 56), { kernel: 'lanczos3' })
    .png({ palette: true, colors: 24, dither: 0 })
    .toFile(join(OUT_ITEMS, 'scouter.png'));
  console.log('  ✓ item scouter');
}

/**
 * Figuras prontas do Scouter com Gi, Shihakusho e Uniforme Jujutsu (art/raw/character/scouter_roupas.png,
 * grade 3×3 em fundo preto; usamos a 1ª linha). O fundo preto vira transparente por preenchimento a partir
 * das bordas, e a borda clara fina em volta do contorno é removida.
 * Substituem as versões montadas (boneco + aparelho) para esses corpos.
 */
/**
 * Recorta figuras desenhadas em fundo preto (com uma borda clara fina em volta do contorno):
 * o fundo vira transparente e a borda clara é retirada.
 */
async function cutoutOnBlack(file: string, barrierMin = 60): Promise<Img> {
  const { data, info } = await sharp(join(RAW, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const sum = (i: number) => data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2];
  // A borda clara em volta de cada figura serve de barreira. Ela tem falhas, então é engrossada
  // em 3 px antes de preencher o fundo (senão o preenchimento vaza pelo contorno preto).
  const barrier = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (sum(y * W + x) < barrierMin) continue;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) barrier[yy * W + xx] = 1;
        }
    }
  const bg = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (bg[i] || barrier[i]) continue;
    bg[i] = 1;
    const x = i % W;
    const y = (i - x) / W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  // Tira a faixa externa (borda clara + o engrossamento): tudo a até 9 px do fundo que não seja
  // contorno preto; o contorno preto a até 4 px do fundo também sai (era a margem engrossada).
  const distToBg = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) return true;
      }
    return false;
  };
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (bg[i]) continue;
      const s = sum(i);
      // A borda clara é cinza neutro; tons escuros coloridos (ex.: o roxo do uniforme) ficam.
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 24;
      if (s < 60 ? distToBg(x, y, 4) : s <= 450 && neutral && distToBg(x, y, 9)) continue;
      rgba[i * 4] = data[i * 3];
      rgba[i * 4 + 1] = data[i * 3 + 1];
      rgba[i * 4 + 2] = data[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
  return { w: W, h: H, data: rgba };
}

export async function scouterOutfits() {
  const img = await cutoutOnBlack('scouter_roupas.png');
  const rows = findFigures(img);
  if (rows.length < 1 || rows[0].length !== 3) throw new Error('scouter_roupas: esperava 3 figuras na 1ª linha');
  for (let c = 0; c < 3; c++) {
    const box = rows[0][c];
    // O scouter não passa do topo da cabeça: a figura inteira é a altura do corpo.
    const buf = await normalize(img, box, BODY_H / (box.y1 - box.y0));
    addOutline(buf);
    await save(buf, CANVAS_W, CANVAS_H, join(OUT_FIG, `fig_scouter_${BODIES[c]}.png`));
    console.log(`  ✓ fig_scouter_${BODIES[c]} (figura pronta)`);
  }
}

/** Contorno escuro de 1 px em volta da figura (igual ao das outras figuras). */
function addOutline(buf: Buffer) {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < CANVAS_W && y < CANVAS_H && buf[(y * CANVAS_W + x) * 4 + 3] > 0;
  const edge: number[] = [];
  for (let y = 0; y < CANVAS_H; y++)
    for (let x = 0; x < CANVAS_W; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push(y * CANVAS_W + x);
  for (const i of edge) {
    buf[i * 4] = 0x1a;
    buf[i * 4 + 1] = 0x14;
    buf[i * 4 + 2] = 0x20;
    buf[i * 4 + 3] = 255;
  }
}

/**
 * Roupa do Luffy (corpo), em fundo preto:
 *  - roupa_luffy.jpg          corpo sozinho + com Chapéu de Palha (mesma escala)
 *  - roupa_luffy_cabecas.jpg  com Chapéu, Cabelo e Venda, Bandana e Máscara Hollow
 * Escala: na 1ª imagem, a figura sem nada na cabeça; na 2ª, a figura com a máscara
 * (a máscara não aumenta a altura).
 */
export async function luffyOutfit() {
  // Nestas imagens a borda em volta do contorno é mais escura: barreira mais baixa.
  const solo = await cutoutOnBlack('roupa_luffy.jpg', 25);
  const soloFigs = findFigures(solo).flat().sort((a, b) => a.x0 - b.x0);
  if (soloFigs.length !== 2) throw new Error(`roupa_luffy: esperava 2 figuras, achei ${soloFigs.length}`);
  const soloBody = soloFigs[0].y1 - soloFigs[0].y0;
  const write = async (img: Img, box: Box, bodyH: number, head: string) => {
    const buf = await normalize(img, box, BODY_H / bodyH);
    addOutline(buf);
    await save(buf, CANVAS_W, CANVAS_H, join(OUT_FIG, `fig_${head}_${LUFFY}.png`));
    console.log(`  ✓ fig_${head}_${LUFFY}`);
  };
  await write(solo, soloFigs[0], soloBody, 'none');

  const heads = await cutoutOnBlack('roupa_luffy_cabecas.jpg', 25);
  const figs = findFigures(heads).flat().sort((a, b) => a.x0 - b.x0);
  if (figs.length !== 4) throw new Error(`roupa_luffy_cabecas: esperava 4 figuras, achei ${figs.length}`);
  const order = ['chapeu_palha', 'venda_olhos', 'bandana_ninja', MASK];
  const headsBody = figs[3].y1 - figs[3].y0;
  for (let i = 0; i < 4; i++) await write(heads, figs[i], headsBody, order[i]);

  await iconFromFigure(solo, 'body', LUFFY);
}

/**
 * Scouter nas figuras que não vieram prontas (sem corpo, Uniforme Ninja, Colete do Pirata):
 * o aparelho é extraído da figura pronta com Gi (diferença com a figura sem Scouter, na região
 * do rosto) e colado em cada figura, alinhado pela cabeça.
 */
export async function scouterFromReady() {
  const read = async (n: string) => sharp(join(OUT_FIG, `${n}.png`)).ensureAlpha().raw().toBuffer();
  const ready = await read('fig_scouter_gi_laranja');
  const plain = await read('fig_none_gi_laranja');
  const px = (b: Buffer, x: number, y: number) => {
    if (x < 0 || y < 0 || x >= CANVAS_W || y >= CANVAS_H) return [0, 0, 0, 0];
    const i = (y * CANVAS_W + x) * 4;
    return [b[i], b[i + 1], b[i + 2], b[i + 3]];
  };
  const diffAt = (a: Buffer, b: Buffer, dx: number, dy: number, x0: number, x1: number, y0: number, y1: number) => {
    let d = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const p = px(a, x, y), q = px(b, x - dx, y - dy);
        d += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) + Math.abs(p[3] - q[3]);
      }
    return d;
  };
  /** Deslocamento que alinha a cabeça de `b` com a de `a` (parte esquerda/alta, sem o aparelho). */
  const align = (a: Buffer, b: Buffer) => {
    let best = { d: Infinity, dx: 0, dy: 0 };
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = diffAt(a, b, dx, dy, 15, 34, 10, 24);
        if (d < best.d) best = { d, dx, dy };
      }
    return best;
  };
  // Camada do aparelho: o que difere entre a figura pronta e a sem Scouter, na região do rosto.
  const a0 = align(ready, plain);
  const layer = Buffer.alloc(CANVAS_W * CANVAS_H * 4);
  for (let y = 18; y < 37; y++)
    for (let x = 30; x < 56; x++) {
      const p = px(ready, x, y), q = px(plain, x - a0.dx, y - a0.dy);
      if (p[3] === 0) continue;
      if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) + Math.abs(p[3] - q[3]) <= 60) continue;
      layer.set(p, (y * CANVAS_W + x) * 4);
    }
  // O Uniforme Jujutsu também: a figura pronta veio com o pé direito falhado no recorte.
  // Todas as roupas: o mesmo aparelho colado na cabeça da figura limpa (fica igual em todas).
  for (const body of ['none', ...BODIES, NARUTO, LUFFY]) {
    const target = await read(`fig_none_${body}`);
    const { dx, dy } = align(plain, target); // cabeça do alvo em relação à figura de referência
    const out = Buffer.from(target);
    for (let y = 0; y < CANVAS_H; y++)
      for (let x = 0; x < CANVAS_W; x++) {
        const i = (y * CANVAS_W + x) * 4;
        if (!layer[i + 3]) continue;
        // posição na figura de referência sem Scouter → na figura alvo
        const tx = x - a0.dx - dx, ty = y - a0.dy - dy;
        if (tx < 0 || ty < 0 || tx >= CANVAS_W || ty >= CANVAS_H) continue;
        out.set(layer.subarray(i, i + 4), (ty * CANVAS_W + tx) * 4);
      }
    await save(out, CANVAS_W, CANVAS_H, join(OUT_FIG, `fig_scouter_${body}.png`));
    console.log(`  ✓ fig_scouter_${body} (aparelho da figura pronta)`);
  }
  // Ícone do inventário: cabeça com o Scouter, recortada da arte pronta.
  await iconFromFigure(await cutoutOnBlack('scouter_roupas.png'), 'head', 'scouter');
}

/**
 * Ícones avulsos de roupa (art/raw/character/icones/<id>.png, fundo de cor lisa): o fundo vira
 * transparente e o ícone é reduzido para 56 px de largura. Substituem os ícones recortados.
 */
export async function soloIcons() {
  const dir = join(RAW, 'icones');
  const { readdirSync, existsSync } = await import('node:fs');
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.png'))) {
    const id = f.replace(/\.png$/, '');
    const { data, info } = await sharp(join(dir, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bg = [data[0], data[1], data[2]];
    for (let i = 0; i < info.width * info.height; i++) {
      const d = Math.abs(data[i * 4] - bg[0]) + Math.abs(data[i * 4 + 1] - bg[1]) + Math.abs(data[i * 4 + 2] - bg[2]);
      if (d < 70) data[i * 4 + 3] = 0;
    }
    const trimmed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const tw = 56;
    const th = Math.round(((meta.height ?? 1) / (meta.width ?? 1)) * tw);
    const out = await sharp(trimmed).resize(tw, th, { kernel: 'lanczos3' }).png({ palette: true, colors: 32, dither: 0 }).toBuffer();
    const r = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < r.data.length; i += 4) r.data[i] = r.data[i] > 127 ? 255 : 0;
    await sharp(r.data, { raw: { width: r.info.width, height: r.info.height, channels: 4 } }).png().toFile(join(OUT_ITEMS, `${id}.png`));
    console.log(`  ✓ item ${id} (ícone avulso)`);
  }
}

/**
 * Scouter novo (art/raw/character/scouter_novo.png): as 6 figuras prontas em fundo verde,
 * na ordem sem corpo, Gi, Shihakusho, Uniforme Jujutsu, Uniforme Ninja, Colete do Pirata.
 * O verde é removido só a partir das bordas (as lentes do aparelho também são verdes, mas ficam
 * fechadas pelo contorno). Substitui as figuras do Scouter montadas antes.
 */
export async function scouterSheet() {
  const file = join(RAW, 'scouter_novo.png');
  const { existsSync } = await import('node:fs');
  if (!existsSync(file)) return;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const bg = [data[0], data[1], data[2]];
  const near = (i: number, t: number) => Math.abs(data[i * 4] - bg[0]) + Math.abs(data[i * 4 + 1] - bg[1]) + Math.abs(data[i * 4 + 2] - bg[2]) < t;
  const greenish = (i: number) => data[i * 4 + 1] > 140 && data[i * 4 + 1] > data[i * 4] + 50 && data[i * 4 + 1] > data[i * 4 + 2] + 50;
  const seen = new Uint8Array(W * H);
  const st: number[] = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) {
    const i = st.pop()!;
    if (seen[i] || !near(i, 150)) continue;
    seen[i] = 1;
    data[i * 4 + 3] = 0;
    const x = i % W, y = (i - x) / W;
    if (x > 0) st.push(i - 1);
    if (x < W - 1) st.push(i + 1);
    if (y > 0) st.push(i - W);
    if (y < H - 1) st.push(i + W);
  }
  // Borda esverdeada que sobra encostada no fundo.
  for (let pass = 0; pass < 3; pass++) {
    const kill: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (!data[i * 4 + 3] || !greenish(i)) continue;
      const x = i % W;
      if ([x > 0 ? i - 1 : i, x < W - 1 ? i + 1 : i, i - W, i + W].some((j) => j >= 0 && j < W * H && data[j * 4 + 3] === 0)) kill.push(i);
    }
    for (const i of kill) data[i * 4 + 3] = 0;
  }
  const img: Img = { w: W, h: H, data };
  const figs = findFigures(img).flat().sort((a, b) => a.x0 - b.x0);
  if (figs.length !== 6) throw new Error(`scouter_novo: esperava 6 figuras, achei ${figs.length}`);
  const bodies = ['none', ...BODIES, NARUTO, LUFFY];
  // O aparelho não passa do topo da cabeça: a figura sem corpo dá a altura de referência.
  const ref = figs[0].y1 - figs[0].y0;
  for (let k = 0; k < 6; k++) {
    const buf = await normalize(img, figs[k], BODY_H / ref);
    await save(buf, CANVAS_W, CANVAS_H, join(OUT_FIG, `fig_scouter_${bodies[k]}.png`));
    console.log(`  ✓ fig_scouter_${bodies[k]} (scouter novo)`);
  }
}
