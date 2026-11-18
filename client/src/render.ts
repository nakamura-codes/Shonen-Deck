/**
 * Escala de desenho: o jogo é pensado em 1280×720 e desenhado com mais pixels conforme a tela.
 * Numa tela 1080p sai ~1.5× (1920×1080); em telas maiores ou de alta densidade, até 2×.
 * Antes era sempre 2× (2560×1440), o que pesava em telas menores sem ganho de nitidez.
 */
function pick(): number {
  try {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(window.innerWidth / 1280, window.innerHeight / 720) * dpr;
    return Math.min(2, Math.max(1, Math.ceil(fit * 4) / 4));
  } catch {
    return 2;
  }
}

export const RENDER_SCALE = pick();
