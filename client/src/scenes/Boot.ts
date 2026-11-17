import Phaser from 'phaser';
import { ARENAS, CARDS, OUTFIT_ITEMS, itemsForSlot } from '@oficina/shared';
import { session } from '../session.ts';
import { txt } from '../ui.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const label = txt(this, 640, 360, 'Carregando…', 24);
    this.load.on('progress', (v: number) => label.setText(`Carregando… ${Math.round(v * 100)}%`));
    // Arte que faltar não quebra o jogo: cartas usam ícone provisório.
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('Arte não encontrada:', file.src));
    for (const id of Object.keys(CARDS)) this.load.image(`card_${id}`, `assets/cards/${id}.png`);
    for (const t of ['attack', 'skill', 'power']) this.load.image(`frame_${t}`, `assets/cards/frames/${t}.png`);
    this.load.image('card_back', 'assets/cards/frames/back.png');
    for (const a of ARENAS) this.load.image(`arena_${a.id}`, `assets/arenas/${a.id}.png`);
    for (const item of OUTFIT_ITEMS) this.load.image(`item_${item.id}`, `assets/items/${item.id}.png`);
    const heads = ['none', ...itemsForSlot('head').map((i) => i.id)];
    const bodies = ['none', ...itemsForSlot('body').map((i) => i.id)];
    for (const h of heads) for (const b of bodies) this.load.image(`fig_${h}_${b}`, `assets/character/fig_${h}_${b}.png`);
  }

  create() {
    this.scene.start(session.created ? 'Wardrobe' : 'Create');
  }
}
