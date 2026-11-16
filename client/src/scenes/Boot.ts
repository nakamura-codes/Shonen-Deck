import Phaser from 'phaser';
import { CARDS } from '@oficina/shared';
import { BASE, LAYERS, SPRITE_H, SPRITE_W, paintLayer } from '../sprites.ts';
import { txt } from '../ui.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const label = txt(this, 640, 360, 'Carregando…', 24);
    this.load.on('progress', (v: number) => label.setText(`Carregando… ${Math.round(v * 100)}%`));
    // Carta sem arte não quebra o jogo: usa o ícone provisório.
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('Arte não encontrada:', file.src));
    for (const id of Object.keys(CARDS)) this.load.image(`card_${id}`, `assets/cards/${id}.png`);
  }

  create() {
    this.makeLayerTexture('char_base', BASE);
    for (const [id, layer] of Object.entries(LAYERS)) this.makeLayerTexture(`char_${id}`, layer);
    this.scene.start('Wardrobe');
  }

  private makeLayerTexture(key: string, layer: Record<number, string>) {
    const tex = this.textures.createCanvas(key, SPRITE_W, SPRITE_H);
    if (!tex) return;
    paintLayer(tex.getContext(), layer);
    tex.refresh();
  }
}
