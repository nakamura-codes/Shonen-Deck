/** Gera apenas os fundos Full HD para dev e build; preserva as artes originais. */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const source = fileURLToPath(new URL('../client/public/assets/menu/', import.meta.url));
const target = join(source, 'fullhd');
const names = ['fundos_fundo_login', 'fundos_fundo_menu_principal'];
async function main() {
  await mkdir(target, { recursive: true });
  for (const name of names) {
    const input = join(source, name + '_2560x1440.png');
    const output = join(target, name + '_1920x1080.png');
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height || meta.width * 9 !== meta.height * 16) {
      throw new Error('Fundo fora da proporção 16:9: ' + input);
    }
    const result = await sharp(input)
      .resize(1920, 1080, { fit: 'fill', kernel: 'nearest' })
      .png({ palette: true, colors: 256, dither: 0 })
      .toFile(output);
    if (result.width !== 1920 || result.height !== 1080) throw new Error('Resolução inválida: ' + output);
    console.log('Full HD: ' + name + ' (1920×1080)');
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
