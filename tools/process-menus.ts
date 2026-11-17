/**
 * Prepara o login e o menu principal.
 *
 *   npm run art:menus
 *
 * Entrada (art/raw/menu/): menu_bg.png, logo.png, botao_{principal,normal,hover,pressionado,desativado}.png,
 * login_bg.png e login_painel.png (painel 16:9 com título, dois campos, botão principal e dois botões
 * pequenos em magenta).
 *
 * Saída: client/public/assets/menu/* e client/src/menu.generated.ts (áreas do painel de login, em 1280×720).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/menu');
const OUT = join(ROOT, 'client/public/assets/menu');
const LAYOUT = join(ROOT, 'client/src/menu.generated.ts');

interface Rect { x: number; y: number; w: number; h: number }

async function main() {
  mkdirSync(OUT, { recursive: true });
  // Fundos em 2560×1440 (o jogo é desenhado em 2x).
  for (const n of ['menu_bg', 'login_bg']) {
    await sharp(join(RAW, `${n}.png`)).resize(2560, 1440, { fit: 'cover', kernel: 'lanczos3' }).png({ palette: true, colors: 256, dither: 0.3 }).toFile(join(OUT, `${n}.png`));
    console.log(`  ✓ ${n}`);
  }
  await sharp(join(RAW, 'logo.png')).trim({ threshold: 1 }).resize(1600, undefined, { kernel: 'lanczos3' }).png().toFile(join(OUT, 'logo.png'));
  console.log('  ✓ logo');
  for (const n of ['principal', 'normal', 'hover', 'pressionado', 'desativado']) {
    await sharp(join(RAW, `botao_${n}.png`)).trim({ threshold: 1 }).png().toFile(join(OUT, `botao_${n}.png`));
    console.log(`  ✓ botao_${n}`);
  }

  // Painel de login: magenta vira transparente; as áreas são medidas na tela de 1280×720.
  const { data, info } = await sharp(join(RAW, 'login_painel.png')).ensureAlpha().resize(2560, 1440, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const mag = (i: number) => data[i * 4] > 190 && data[i * 4 + 2] > 190 && data[i * 4 + 1] < 120 && data[i * 4 + 3] > 0;
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
    if (n > 1500) holes.push({ x: Math.round(x0 / 2), y: Math.round(y0 / 2), w: Math.round((x1 - x0 + 1) / 2), h: Math.round((y1 - y0 + 1) / 2) });
  }
  // Borda rosada que a redução cria também vira buraco.
  for (let pass = 0; pass < 3; pass++) {
    const grow: number[] = [];
    for (let i = 0; i < W * H; i++) {
      if (!data[i * 4 + 3]) continue;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (!(r > 140 && b > 120 && g < 150 && r - g > 60)) continue;
      const x = i % W;
      if ([x > 0 ? i - 1 : i, x < W - 1 ? i + 1 : i, i - W, i + W].some((j) => j >= 0 && j < W * H && (mag(j) || data[j * 4 + 3] === 0))) grow.push(i);
    }
    for (const i of grow) data[i * 4 + 3] = 0;
  }
  for (let i = 0; i < W * H; i++) if (mag(i)) data[i * 4 + 3] = 0;
  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ palette: true, colors: 192, dither: 0 }).toFile(join(OUT, 'login_painel.png'));
  console.log('  ✓ login_painel');

  holes.sort((a, b) => a.y - b.y || a.x - b.x);
  if (holes.length !== 6) throw new Error(`login_painel: esperava 6 áreas magenta, achei ${holes.length}: ${JSON.stringify(holes)}`);
  const [title, user, pass, enter, small1, small2] = holes;
  const layout = { title, user, pass, enter, small: [small1, small2].sort((a, b) => a.x - b.x) };
  writeFileSync(LAYOUT, `// Gerado por tools/process-menus.ts — não edite à mão.\n// Áreas do painel de login, em pixels da tela (1280×720).\nexport const LOGIN = ${JSON.stringify(layout, null, 2)} as const;\n`);
  console.log('  ✓ layout', JSON.stringify(layout));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
