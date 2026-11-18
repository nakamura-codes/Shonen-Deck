/**
 * Prepara o login e o menu principal (pacote "shonen_deck_ui_separada").
 *
 *   npm run art:menus
 *
 * Entrada: art/raw/menu/ (fundos, logo, molduras, campos, botões em 4 estados e posicoes_sugeridas.json,
 * tudo pensado em 2560×1440).
 * Saída: client/public/assets/menu/<pasta>_<nome>.png e client/src/menu.generated.ts, com a posição de
 * cada camada convertida para a tela do jogo (1280×720).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/menu');
const OUT = join(ROOT, 'client/public/assets/menu');
const LAYOUT = join(ROOT, 'client/src/menu.generated.ts');

/** "botoes/botao_login_normal.png" → "botoes_botao_login_normal" (chave da textura e do arquivo). */
const key = (rel: string) => rel.replace(/\.png$/, '').replace(/\//g, '_');

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const dir of ['botoes', 'campos', 'fundos', 'logo', 'molduras']) {
    for (const f of readdirSync(join(RAW, dir)).filter((n) => n.endsWith('.png'))) {
      const rel = `${dir}/${f}`;
      let img = sharp(join(RAW, rel));
      if (dir === 'fundos') img = img.resize(2560, 1440, { fit: 'cover' }).png({ palette: true, colors: 256, dither: 0.3 });
      else if (dir === 'logo') img = img.resize(1100, undefined, { kernel: 'lanczos3' }).png();
      else img = img.png({ palette: true, colors: 128, dither: 0 });
      await img.toFile(join(OUT, `${key(rel)}.png`));
      console.log(`  ✓ ${key(rel)}`);
    }
  }
  // Posições sugeridas (2560×1440) → tela do jogo (1280×720): [chave, x, y, w, h].
  const pos = JSON.parse(readFileSync(join(RAW, 'posicoes_sugeridas.json'), 'utf8'));
  const screens: Record<string, [string, number, number, number, number][]> = {};
  for (const [name, t] of Object.entries(pos.telas as Record<string, { camadas: [string, number, number, number, number][] }>)) {
    screens[name] = t.camadas.map(([rel, x, y, w, h]) => [key(rel), x / 2, y / 2, w / 2, h / 2]);
  }
  writeFileSync(
    LAYOUT,
    `// Gerado por tools/process-menus.ts — não edite à mão.\n// Camadas de cada tela: [textura, x, y, w, h] na tela do jogo (1280×720), na ordem de desenho.\n` +
      `export const MENU_KEYS = ${JSON.stringify(readdirSync(OUT).filter((n) => n.endsWith('.png')).map((n) => n.replace(/\.png$/, '')))} as const;\n` +
      `export const SCREENS = ${JSON.stringify(screens, null, 2)} as const;\n`,
  );
  console.log('  ✓ layout');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
