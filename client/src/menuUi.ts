import Phaser from 'phaser';
import { sfx } from './sfx.ts';
import { centerInk, fitText, txt } from './ui.ts';

export type Box = readonly [string, number, number, number, number];

/** Imagem do pacote de menu ocupando exatamente a caixa [chave, x, y, w, h]. */
/** Escala da HUD do login e do menu (o título e os fundos não encolhem). */
export const MENU_HUD = 0.85;

/** Caixa encolhida em volta do centro da tela (640, 360). */
export function shrink([k, x, y, w, h]: Box, f = MENU_HUD): Box {
  const cx = x + w / 2, cy = y + h / 2;
  const nw = w * f, nh = h * f;
  return [k, 640 + (cx - 640) * f - nw / 2, 360 + (cy - 360) * f - nh / 2, nw, nh];
}

export function placeImage(scene: Phaser.Scene, [k, x, y, w, h]: Box) {
  return scene.add.image(x + w / 2, y + h / 2, k).setDisplaySize(w, h);
}

/**
 * Botão com a arte do pacote em 4 estados (<base>_normal/_hover/_pressionado/_desativado).
 * `base` é, por exemplo, "botoes_botao_principal".
 */
/**
 * Centro vertical da "face" de cada botão (fração da altura): a parte de baixo da arte é a base 3D,
 * então o texto centralizado na caixa inteira fica baixo. Medido na arte do pacote.
 */
const FACE_CENTER: Record<string, number> = {
  botoes_botao_principal: 0.36,
  botoes_botao_login: 0.36,
  botoes_botao_secundario: 0.34,
};

export function menuButton(
  scene: Phaser.Scene,
  base: string,
  box: Box,
  label: string,
  onClick: () => void,
  size = 22,
) {
  const [, x, y, w, h] = box;
  const img = scene.add.image(x + w / 2, y + h / 2, `${base}_normal`).setDisplaySize(w, h);
  const faceY = y + h * (FACE_CENTER[base] ?? 0.5);
  // Ao pressionar, a face desce um pouco; o texto acompanha.
  const pressDy = h * 0.06;
  const t = fitText(txt(scene, 0, 0, label, size, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }), w * 0.82);
  const place = (dy = 0) => centerInk(t, x + w / 2, faceY + dy);
  place();
  let enabled = true;
  const set = (state: string) => img.setTexture(`${base}_${state}`).setDisplaySize(w, h);
  img.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 10 });
  img.on('pointerover', () => enabled && set('hover'));
  img.on('pointerout', () => {
    if (!enabled) return;
    set('normal');
    place();
  });
  img.on('pointerdown', () => {
    if (!enabled) return;
    set('pressionado');
    place(pressDy);
  });
  img.on('pointerup', () => {
    if (!enabled) return;
    set('hover');
    place();
    sfx('click');
    onClick();
  });
  return {
    img,
    text: t,
    setEnabled(v: boolean) {
      enabled = v;
      set(v ? 'normal' : 'desativado');
      t.setAlpha(v ? 1 : 0.5);
    },
    setLabel(s: string) {
      t.setText(s);
      place();
    },
  };
}
