/**
 * Tamanho da tela do jogo.
 *
 * O layout é pensado em 1280×720 (todas as posições usam essas coordenadas). UI_SCALE < 1 mostra mais
 * espaço em volta desse layout, deixando tudo menor na tela; as bordas extras são preenchidas pelos
 * fundos (ver extendBackground). RENDER_SCALE é quantos pixels reais cada unidade do layout ocupa.
 */
const UI_KEY = 'shonen.uiScale';

function loadUiScale(): number {
  try {
    const v = Number(window.localStorage.getItem(UI_KEY));
    if (v >= 0.7 && v <= 1) return v;
  } catch {
    /* ignora */
  }
  return 0.85;
}

export const UI_SCALE = loadUiScale();
/** Área visível, em coordenadas do layout (centrada em 640, 360). */
export const VIEW_W = Math.round(1280 / UI_SCALE);
export const VIEW_H = Math.round(720 / UI_SCALE);
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

export function setUiScale(v: number) {
  try {
    window.localStorage.setItem(UI_KEY, String(v));
  } catch {
    /* ignora */
  }
}
