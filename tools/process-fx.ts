/**
 * Prepara os efeitos visuais (golpes, buffs, explosões…).
 *
 *   npm run art:fx
 *
 * Entrada (art/raw/fx/):
 *  - pvfx/<nome>/sprite-sheet.png + manifest.json  — pacote PVFX Foundry (CC0), formato "grid"
 *  - outros/explosao_fogo.png — explosão de fogo (grade 4×4 de 64 px)
 *  - outros/fumaca.png        — fumaça branca (linhas de 8 quadros de 64 px; usamos a 1ª)
 *
 * Saída:
 *  - client/public/assets/fx/<nome>.png   tira horizontal de quadros do mesmo tamanho
 *  - client/src/fx.generated.ts           tamanho do quadro, nº de quadros, duração e pivô de cada efeito
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/fx');
const OUT = join(ROOT, 'client/public/assets/fx');
const LIST = join(ROOT, 'client/src/fx.generated.ts');

interface FxInfo {
  w: number;
  h: number;
  frames: number;
  durationMs: number;
  /** Ponto do efeito que fica sobre o alvo (0..1). */
  pivotX: number;
  pivotY: number;
}

const list: Record<string, FxInfo> = {};

async function strip(name: string, src: string, rects: { x: number; y: number }[], w: number, h: number, info: Omit<FxInfo, 'w' | 'h' | 'frames'>) {
  const composites = await Promise.all(
    rects.map(async (r, i) => ({
      input: await sharp(src).extract({ left: r.x, top: r.y, width: w, height: h }).png().toBuffer(),
      left: i * w,
      top: 0,
    })),
  );
  await sharp({ create: { width: w * rects.length, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toFile(join(OUT, `${name}.png`));
  list[name] = { w, h, frames: rects.length, ...info };
  console.log(`  ✓ ${name} (${rects.length} quadros de ${w}×${h})`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // PVFX Foundry: cada quadro está numa posição do sprite-sheet, indicada no manifest.
  for (const name of readdirSync(join(RAW, 'pvfx'))) {
    const dir = join(RAW, 'pvfx', name);
    if (!existsSync(join(dir, 'manifest.json'))) continue;
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    const [w, h] = m.source_size as [number, number];
    const frames = m.frames as { duration: { numerator_ms: number; denominator: number }; sheet: { x: number; y: number } }[];
    const durationMs = frames.reduce((s, f) => s + f.duration.numerator_ms / f.duration.denominator, 0);
    const pivot = (m.pivot as [number, number]) ?? [w / 2, h / 2];
    await strip(name, join(dir, 'sprite-sheet.png'), frames.map((f) => f.sheet), w, h, {
      durationMs,
      pivotX: pivot[0] / w || 0.5,
      pivotY: pivot[1] / h || 0.5,
    });
  }

  // Explosão de fogo: grade 4×4 de 64 px.
  const fire = join(RAW, 'outros/explosao_fogo.png');
  if (existsSync(fire)) {
    const rects = Array.from({ length: 16 }, (_, i) => ({ x: (i % 4) * 64, y: Math.floor(i / 4) * 64 }));
    await strip('explosao_fogo', fire, rects, 64, 64, { durationMs: 900, pivotX: 0.5, pivotY: 0.55 });
  }

  // Fumaça: 1ª linha (8 quadros de 64 px). É branca, o jogo pinta na cor desejada.
  const smoke = join(RAW, 'outros/fumaca.png');
  if (existsSync(smoke)) {
    const rects = Array.from({ length: 8 }, (_, i) => ({ x: i * 64, y: 0 }));
    await strip('fumaca', smoke, rects, 64, 64, { durationMs: 640, pivotX: 0.5, pivotY: 0.5 });
  }

  writeFileSync(
    LIST,
    `// Gerado por tools/process-fx.ts — não edite à mão.\n` +
      `export interface FxInfo { w: number; h: number; frames: number; durationMs: number; pivotX: number; pivotY: number }\n` +
      `export const FX: Record<string, FxInfo> = ${JSON.stringify(list, null, 2)};\n`,
  );
  console.log('  ✓ lista de efeitos');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
