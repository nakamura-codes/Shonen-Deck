import Phaser from 'phaser';
import { sfx } from './sfx.ts';
import { fitText, txt } from './ui.ts';

export type Box = readonly [string, number, number, number, number];

/** Imagem do pacote de menu ocupando exatamente a caixa [chave, x, y, w, h]. */
export function placeImage(scene: Phaser.Scene, [k, x, y, w, h]: Box) {
  return scene.add.image(x + w / 2, y + h / 2, k).setDisplaySize(w, h);
}

/**
 * Botão com a arte do pacote em 4 estados (<base>_normal/_hover/_pressionado/_desativado).
 * `base` é, por exemplo, "botoes_botao_principal".
 */
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
  const t = fitText(txt(scene, x + w / 2, y + h / 2 - 3, label, size, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }), w * 0.82);
  let enabled = true;
  const set = (state: string) => img.setTexture(`${base}_${state}`).setDisplaySize(w, h);
  img.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 10 });
  img.on('pointerover', () => enabled && set('hover'));
  img.on('pointerout', () => {
    if (!enabled) return;
    set('normal');
    t.setY(y + h / 2 - 3);
  });
  img.on('pointerdown', () => {
    if (!enabled) return;
    set('pressionado');
    t.setY(y + h / 2);
  });
  img.on('pointerup', () => {
    if (!enabled) return;
    set('hover');
    t.setY(y + h / 2 - 3);
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
    },
  };
}
