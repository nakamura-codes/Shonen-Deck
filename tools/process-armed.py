"""
Bonecos com arma na mão (slot Mão).

    python3 tools/process-armed.py

Entrada: art/raw/armas/bonecos/<arma>.png — os 6 corpos (sem acessório de cabeça) segurando a arma,
lado a lado em fundo verde, na mesma ordem de docs/referencia_corpos.png.

Cada boneco é alinhado ao sprite original (64×80) e reduzido para a grade de pixels do jogo.
Depois recebe a cabeça dos sprites atuais: tudo acima do pescoço vem do sprite original
(chapéu, máscara, scouter, cabelo), então a cabeça fica idêntica à de sempre.

Saída: client/public/assets/character/fig_<cabeça>_<corpo>_<arma>.png
Precisa de numpy e Pillow.
"""
import glob, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
CHAR = os.path.join(ROOT, 'client/public/assets/character')
RAW = os.path.join(ROOT, 'art/raw/armas/bonecos')
HEADS = ['none', 'chapeu_palha', 'venda_olhos', 'bandana_ninja', 'mascara_hollow', 'scouter']
BODIES = ['none', 'gi_laranja', 'shihakusho', 'uniforme_jujutsu', 'uniforme_naruto', 'roupa_luffy']
WEAPONS = ['espada_trunks', 'pistola_pirata', 'kunai_ninja', 'zanpakuto', 'cutelo_nanami']
NECK_Y = 36  # linhas acima disso vêm sempre do sprite original
# Tela maior que a do boneco (64×80) para lâminas compridas não serem cortadas.
# Os pés continuam na linha 78 e o boneco no centro (o jogo lê a altura da imagem).
PAD_X, PAD_B = 10, 14
OUT_W, OUT_H = 64 + 2 * PAD_X, 80 + PAD_B


def load_sheet(path):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    # Verde do fundo e a franja esverdeada da borda viram transparente.
    green = (a[:, :, 1] > 110) & (a[:, :, 1] > a[:, :, 0] + 35) & (a[:, :, 1] > a[:, :, 2] + 35)
    return a, ~green


def figures(mask):
    cols = mask.sum(0) > 0
    runs, start = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and start is None:
            start = x
        if not c and start is not None:
            if x - start > 40:
                runs.append((start, x))
            start = None
    return runs


def sample(a, m, x0, y0, s, w=64, h=80):
    xi = (x0 + (np.arange(w) + 0.5) * s).astype(int)
    yi = (y0 + (np.arange(h) + 0.5) * s).astype(int)
    inside = ((xi >= 0) & (xi < a.shape[1]))[None, :] & ((yi >= 0) & (yi < a.shape[0]))[:, None]
    xs = np.clip(xi, 0, a.shape[1] - 1)
    ys = np.clip(yi, 0, a.shape[0] - 1)
    return a[ys][:, xs], m[ys][:, xs] & inside


def fit(a, m, xa, xb, orig_mask):
    """Escala e posição que melhor casam a silhueta (cabeça e tronco) com o sprite original."""
    top = np.where(m[:, xa:xb].any(1))[0][0]
    otop = np.where(orig_mask.any(1))[0][0]
    region = np.zeros_like(orig_mask)
    region[:44, :] = True
    best = None
    for s in np.arange(4.4, 6.2, 0.05):
        for dy in np.arange(-1.0, 1.01, 0.25):
            y0 = top - otop * s + dy * s
            for x0 in np.arange(xa - 20 * s, xa + 2 * s, s / 4):
                _, sm = sample(a, m, x0, y0, s)
                score = ((sm == orig_mask) & region).sum()
                if best is None or score > best[0]:
                    best = (score, x0, y0, s)
    return best[1:]


def main():
    import sys
    only = sys.argv[1:]  # opcional: só algumas armas
    for weapon in WEAPONS:
        if only and weapon not in only:
            continue
        path = os.path.join(RAW, f'{weapon}.png')
        if not os.path.exists(path):
            print(f'  – {weapon}: sem imagem')
            continue
        a, m = load_sheet(path)
        runs = figures(m)
        if len(runs) != 6:
            raise SystemExit(f'{weapon}: esperava 6 bonecos, achei {len(runs)}')
        for (xa, xb), body in zip(runs, BODIES):
            base = np.array(Image.open(os.path.join(CHAR, f'fig_none_{body}.png')).convert('RGBA'))
            x0, y0, s = fit(a, m, xa, xb, base[:, :, 3] > 0)
            col, sm = sample(a, m, x0 - PAD_X * s, y0, s, OUT_W, OUT_H)
            armed = np.zeros((OUT_H, OUT_W, 4), np.uint8)
            armed[:, :, :3] = col
            armed[:, :, 3] = sm * 255
            for head in HEADS:
                fig = np.array(Image.open(os.path.join(CHAR, f'fig_{head}_{body}.png')).convert('RGBA'))
                out = armed.copy()
                # Cabeça inteira do sprite original.
                out[:NECK_Y, PAD_X:PAD_X + 64] = fig[:NECK_Y]
                out[:NECK_Y, :PAD_X] = 0
                out[:NECK_Y, PAD_X + 64:] = 0
                Image.fromarray(out).save(os.path.join(CHAR, f'fig_{head}_{body}_{weapon}.png'))
            print(f'  ✓ {weapon} / {body} (escala {s:.2f})')


if __name__ == '__main__':
    main()
