/**
 * Prepara as músicas do jogo.
 *
 *   npm run art:music
 *
 *  - art/raw/music/batalha/  músicas das batalhas (tocam em sequência, em ordem alfabética; ao acabar a
 *                            última, volta para a primeira). O nome do arquivo vira o título no jogo.
 *  - art/raw/music/menu/     música do menu principal (repete sem parar).
 *
 * Tudo é convertido para MP3 estéreo 128 kbps com volume equalizado (loudnorm, -20 LUFS), para nenhuma
 * faixa ficar mais alta que outra. Saída: client/public/assets/music/ e client/src/music.generated.ts.
 * Precisa do ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/music');
const OUT = join(ROOT, 'client/public/assets/music');
const LIST = join(ROOT, 'client/src/music.generated.ts');

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

function convert(dir: string, prefix: string) {
  const src = join(RAW, dir);
  if (!existsSync(src)) return [];
  const out: { file: string; title: string }[] = [];
  for (const f of readdirSync(src).sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }))) {
    if (!/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f)) continue;
    const title = f.slice(0, -extname(f).length);
    const file = `${prefix}_${slug(title)}.mp3`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(src, f), '-map', '0:a:0', '-map_metadata', '-1', '-af', 'loudnorm=I=-20:TP=-2:LRA=11', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', join(OUT, file)]);
    out.push({ file, title });
    console.log(`  ✓ ${dir}: ${title}`);
  }
  return out;
}

const battle = convert('batalha', 'batalha');
const menu = convert('menu', 'menu');
writeFileSync(
  LIST,
  `// Gerado por tools/process-music.ts — não edite à mão.\nexport interface Track { file: string; title: string }\n` +
    `/** Batalha: tocam em sequência e voltam para a primeira. */\nexport const MUSIC: Track[] = ${JSON.stringify(battle, null, 2)};\n` +
    `/** Menu principal: repete sem parar (usa a primeira). */\nexport const MENU_MUSIC: Track[] = ${JSON.stringify(menu, null, 2)};\n`,
);
console.log(`  ${battle.length} de batalha, ${menu.length} de menu`);
