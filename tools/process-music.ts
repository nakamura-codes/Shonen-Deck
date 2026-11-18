/**
 * Prepara as músicas de batalha.
 *
 *   npm run art:music
 *
 * Coloque os arquivos de áudio (mp3, wav, ogg, m4a, flac) em art/raw/music/. O nome do arquivo vira o
 * título mostrado no jogo (ex.: "One Piece - We Are.mp3"). Cada um é convertido para MP3 estéreo
 * 128 kbps em client/public/assets/music/ e listado em client/src/music.generated.ts.
 * Precisa do ffmpeg instalado.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'art/raw/music');
const OUT = join(ROOT, 'client/public/assets/music');
const LIST = join(ROOT, 'client/src/music.generated.ts');

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

mkdirSync(RAW, { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const tracks: { file: string; title: string }[] = [];
for (const f of readdirSync(RAW).sort()) {
  if (!/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f)) continue;
  const title = f.slice(0, -extname(f).length);
  const file = `${slug(title)}.mp3`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(RAW, f), '-map', '0:a:0', '-map_metadata', '-1', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', join(OUT, file)]);
  tracks.push({ file, title });
  console.log(`  ✓ ${title}`);
}
writeFileSync(LIST, `// Gerado por tools/process-music.ts — não edite à mão.\nexport const MUSIC: { file: string; title: string }[] = ${JSON.stringify(tracks, null, 2)};\n`);
console.log(`  ${tracks.length} música(s)`);
