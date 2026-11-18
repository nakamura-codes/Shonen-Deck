/**
 * Área segura 16:9 (1280×720), renderizada em Full HD (1920×1080).
 * Scale.EXPAND amplia a área visível conforme a janela, sem reiniciar cenas.
 * Coordenadas de layout permanecem fixas; os fundos e faixas usam viewportBounds.
 */
export const ASPECT = 16 / 9;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const MARGIN_X = 0;
export const MARGIN_Y = 0;
export const RENDER_SCALE = 1.5;

export function viewportBounds(scale: { gameSize: { width: number; height: number } }) {
  const w = Math.max(VIEW_W, scale.gameSize.width / RENDER_SCALE);
  const h = Math.max(VIEW_H, scale.gameSize.height / RENDER_SCALE);
  return { w, h, mx: (w - VIEW_W) / 2, my: (h - VIEW_H) / 2 };
}
