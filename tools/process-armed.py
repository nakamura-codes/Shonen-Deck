"""
Bonecos com arma na mão (slot Mão).

    python3 tools/process-armed.py

Entrada: art/raw/armas/grades/<arma>.png — grade 6×6 com as 36 combinações segurando a arma, em fundo
verde, na mesma ordem de docs/referencia_roupas.png (colunas = cabeça, linhas = corpo).

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
RAW = os.path.join(ROOT, 'art/raw/armas/grades')
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


def bands(profile, n, min_len=20):
    """Faixas contínuas com conteúdo; junta as mais próximas até sobrarem n."""
    runs, start = [], None
    for i, c in enumerate(list(profile) + [False]):
        if c and start is None:
            start = i
        if not c and start is not None:
            if i - start >= min_len:
                runs.append([start, i])
            start = None
    while len(runs) > n:
        gaps = [runs[k + 1][0] - runs[k][1] for k in range(len(runs) - 1)]
        k = gaps.index(min(gaps))
        runs[k] = [runs[k][0], runs[k + 1][1]]
        del runs[k + 1]
    return runs


def cells(mask):
    """As 36 células da grade: 6 linhas e, em cada linha, 6 bonecos."""
    rows = bands(mask.sum(1) > 2, 6)
    if len(rows) != 6:
        raise SystemExit(f'esperava 6 linhas, achei {len(rows)}')
    out = []
    for y0, y1 in rows:
        cols = bands(mask[y0:y1].sum(0) > 0, 6, 10)
        if len(cols) != 6:
            raise SystemExit(f'esperava 6 bonecos na linha {y0}-{y1}, achei {len(cols)}')
        out.append([(x0, x1, y0, y1) for x0, x1 in cols])
    return out


def sample(a, m, x0, y0, s, w=64, h=80):
    xi = (x0 + (np.arange(w) + 0.5) * s).astype(int)
    yi = (y0 + (np.arange(h) + 0.5) * s).astype(int)
    inside = ((xi >= 0) & (xi < a.shape[1]))[None, :] & ((yi >= 0) & (yi < a.shape[0]))[:, None]
    xs = np.clip(xi, 0, a.shape[1] - 1)
    ys = np.clip(yi, 0, a.shape[0] - 1)
    return a[ys][:, xs], m[ys][:, xs] & inside


def fit(a, m, cell, orig_mask):
    """Escala e posição que melhor casam a silhueta (cabeça e tronco) com o sprite original."""
    x0c, x1c, y0c, y1c = cell
    sub = m[y0c:y1c, x0c:x1c]
    top = y0c + np.where(sub.any(1))[0][0]
    otop = np.where(orig_mask.any(1))[0][0]
    region = np.zeros_like(orig_mask)
    region[:44, :] = True
    est = (y1c - y0c) / 66
    best = None
    for s in np.arange(est * 0.85, est * 1.15, est * 0.01):
        for dy in np.arange(-1.0, 1.01, 0.25):
            y0 = top - otop * s + dy * s
            for x0 in np.arange(x0c - 24 * s, x0c + 4 * s, s / 4):
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
        grid = cells(m)
        for body, row in zip(BODIES, grid):
            for head, cell in zip(HEADS, row):
                fig = np.array(Image.open(os.path.join(CHAR, f'fig_{head}_{body}.png')).convert('RGBA'))
                x0, y0, s = fit(a, m, cell, fig[:, :, 3] > 0)
                # Só a própria célula (sem pedaços dos vizinhos).
                cm = np.zeros_like(m)
                cx0, cx1, cy0, cy1 = cell
                cm[cy0:cy1, cx0:cx1] = m[cy0:cy1, cx0:cx1]
                col, sm = sample(a, cm, x0 - PAD_X * s, y0, s, OUT_W, OUT_H)
                out = np.zeros((OUT_H, OUT_W, 4), np.uint8)
                out[:, :, :3] = col
                out[:, :, 3] = sm * 255
                # Franja esverdeada que sobra do fundo (nenhuma roupa ou arma tem verde abaixo do pescoço).
                rgb = out[:, :, :3].astype(int)
                fringe = (rgb[:, :, 1] > rgb[:, :, 0] + 18) & (rgb[:, :, 1] > rgb[:, :, 2] + 18)
                out[fringe, 3] = 0
                # Cabeça inteira do sprite original (chapéu, máscara, cabelo idênticos aos de sempre).
                out[:NECK_Y] = 0
                out[:NECK_Y, PAD_X:PAD_X + 64] = fig[:NECK_Y]
                Image.fromarray(out).save(os.path.join(CHAR, f'fig_{head}_{body}_{weapon}.png'))
            print(f'  ✓ {weapon} / {body}')


if __name__ == '__main__':
    main()
