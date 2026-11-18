/**
 * Tamanho da tela do jogo.
 *
 * O layout é pensado em 1280×720 (todas as posições usam essas coordenadas) e aparece sempre no
 * mesmo tamanho em todas as telas. Se a janela não for 16:9, a área visível cresce para os lados
 * (ou para cima e para baixo) e essas bordas extras são preenchidas pelos fundos: sem barras pretas.
 * RENDER_SCALE é quantos pixels reais cada unidade do layout ocupa.
 */
function aspect(): number {
  try {
    const a = window.innerWidth / window.innerHeight;
    if (Number.isFinite(a) && a > 0) return Math.min(2.6, Math.max(1, a));
  } catch {
    /* ignora */
  }
  return 16 / 9;
}

export const ASPECT = aspect();
/** Área visível, em coordenadas do layout (centrada em 640, 360). */
export const VIEW_W = ASPECT >= 16 / 9 ? Math.round(720 * ASPECT) : 1280;
export const VIEW_H = ASPECT >= 16 / 9 ? 720 : Math.round(1280 / ASPECT);
/** Margens visíveis além do layout 1280×720, de cada lado. */
export const MARGIN_X = (VIEW_W - 1280) / 2;
export const MARGIN_Y = (VIEW_H - 720) / 2;

function pick(): number {
  try {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H) * dpr;
    return Math.min(2.5, Math.max(1, Math.ceil(fit * 4) / 4));
  } catch {
    return 2;
  }
}

export const RENDER_SCALE = pick();
