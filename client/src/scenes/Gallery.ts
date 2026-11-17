import Phaser from 'phaser';
import { CARDS } from '@oficina/shared';
import { makeCard, txt } from '../ui.ts';

/** Galeria de todas as cartas em tamanho de leitura. Abra com ?galeria na URL; clique para trocar de página. */
export class GalleryScene extends Phaser.Scene {
  private page = 0;
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Gallery');
  }

  create() {
    this.cameras.main.setBackgroundColor('#16121f');
    this.input.on('pointerdown', () => this.show(this.page + 1));
    this.input.keyboard?.on('keydown', () => this.show(this.page + 1));
    this.show(0);
  }

  private show(page: number) {
    const ids = Object.keys(CARDS);
    const perPage = 16;
    const pages = Math.ceil(ids.length / perPage);
    this.page = page % pages;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const cols = 8;
    const cw = 158;
    const x0 = 640 - ((cols - 1) * cw) / 2;
    ids.slice(this.page * perPage, (this.page + 1) * perPage).forEach((id, i) => {
      const x = x0 + (i % cols) * cw;
      const y = 160 + Math.floor(i / cols) * 245;
      this.objs.push(makeCard(this, id).setPosition(x, y));
    });
    this.objs.push(txt(this, 640, 18, `Cartas — página ${this.page + 1} de ${pages} (clique para a próxima)`, 16, '#ffe28a', { fontStyle: 'bold' }));
  }
}
