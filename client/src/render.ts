/**
 * Layout fixo 16:9 (1280×720) renderizado em Full HD (1920×1080).
 * O Phaser Scale.FIT ajusta o canvas ao espaço disponível sem recarregar o jogo.
 * Mantém as posições, hitboxes e zoom de câmera estáveis em todas as cenas.
 * Telas não 16:9 podem ter margens externas, sem cortar conteúdo.
 */
export const ASPECT = 16 / 9;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const MARGIN_X = 0;
export const MARGIN_Y = 0;
export const RENDER_SCALE = 1.5;
