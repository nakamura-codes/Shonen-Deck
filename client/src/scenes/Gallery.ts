import Phaser from 'phaser';
import { CARDS } from '@oficina/shared';
import { makeCard, txt } from '../ui.ts';

/** Galeria de todas as cartas, como aparecem na batalha. Abra com ?galeria na URL. */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }

  create() {
    this.cameras.main.setBackgroundColor('#16121f');
    const ids = Object.keys(CARDS);
    const cols = 9;
    const scale = 0.7;
    const cw = 136;
    const ch = 172;
    const x0 = 640 - ((cols - 1) * cw) / 2;
    ids.forEach((id, i) => {
      const x = x0 + (i % cols) * cw;
      const y = 92 + Math.floor(i / cols) * ch;
      makeCard(this, id).setScale(scale).setPosition(x, y);
    });
    txt(this, 640, 14, `Todas as cartas (${ids.length})`, 16, '#ffe28a', { fontStyle: 'bold' });
  }
}
