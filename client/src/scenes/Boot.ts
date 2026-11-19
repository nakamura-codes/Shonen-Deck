import Phaser from 'phaser';
import { AVATARS, ARENAS, CARDS, OUTFIT_ITEMS, itemsForSlot } from '@oficina/shared';
import { auth } from '../session.ts';
import { txt } from '../ui.ts';
import { FX } from '../fx.generated.ts';
import { MENU_KEYS } from '../menu.generated.ts';

const ARMED_FIGURES = true;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const label = txt(this, 640, 360, 'Carregando…', 24);
    this.load.on('progress', (v: number) => label.setText(`Carregando… ${Math.round(v * 100)}%`));
    // Arte que faltar não quebra o jogo: cartas usam ícone provisório.
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('Arte não encontrada:', file.src));
    for (const id of Object.keys(CARDS)) {
      this.load.image(`card_${id}`, `assets/cards/${id}.png`);
      this.load.image(`cardart_${id}`, `assets/cards/art/${id}.png`);
    }
    for (const t of ['attack', 'skill', 'power']) this.load.image(`frame_${t}`, `assets/cards/frames/${t}.png`);
    this.load.image('card_back', 'assets/cards/frames/back.png');
    for (const [name, f] of Object.entries(FX)) this.load.spritesheet(`fx_${name}`, `assets/fx/${name}.png`, { frameWidth: f.w, frameHeight: f.h });
    for (const k of ['hud', 'btn_normal', 'btn_hover', 'btn_disabled', 'inventario', 'slot_normal', 'slot_selected', 'colecao', 'trofeu']) this.load.image(k, `assets/ui/${k}.png`);
    for (const id of ['padrao', ...Object.keys(AVATARS)]) this.load.image('avatar_' + id, 'assets/avatars/' + id + '.png');
    this.load.image('fundo_preparacao', 'assets/ui/fundo_preparacao.webp');
    this.load.image('coin_blue', 'assets/ui/coin_blue.png');
    this.load.image('coin_red', 'assets/ui/coin_red.png');
    for (const k of MENU_KEYS) {
      // Os fundos originais são 2560×1440; o build prepara versões 1920×1080.
      // Mantemos as chaves existentes para não alterar as coordenadas das cenas.
      const path = k === 'fundos_fundo_login_2560x1440' || k === 'fundos_fundo_menu_principal_2560x1440'
        ? `assets/menu/fullhd/${k.replace('_2560x1440', '_1920x1080')}.png`
        : `assets/menu/${k}.png`;
      this.load.image(k, path);
    }
    for (const a of ARENAS) this.load.image(`arena_${a.id}`, `assets/arenas/${a.id}.png`);
    for (const item of OUTFIT_ITEMS) this.load.image(`item_${item.id}`, `assets/items/${item.id}.png`);
    const heads = ['none', ...itemsForSlot('head').map((i) => i.id)];
    const bodies = ['none', ...itemsForSlot('body').map((i) => i.id)];
    // Bonecos segurando a arma: desligados até chegarem os desenhos definitivos (tools/process-armed.py).
    // Sem eles, o personagem aparece sem a arma (as cartas da arma funcionam normalmente).
    const hands = ['', ...(ARMED_FIGURES ? itemsForSlot('hand').map((i) => `_${i.id}`) : [])];
    for (const h of heads) for (const b of bodies) for (const w of hands) this.load.image(`fig_${h}_${b}${w}`, `assets/character/fig_${h}_${b}${w}.png`);
  }

  create() {
    // Animações dos efeitos visuais (uma por efeito, tocadas uma vez).
    for (const [name, f] of Object.entries(FX)) {
      if (!this.textures.exists(`fx_${name}`)) continue;
      this.anims.create({
        key: `fx_${name}`,
        frames: this.anims.generateFrameNumbers(`fx_${name}`, { start: 0, end: f.frames - 1 }),
        frameRate: f.frames / (f.durationMs / 1000),
        repeat: 0,
      });
    }
    if (new URLSearchParams(location.search).has('galeria')) this.scene.start('Gallery');
    else this.scene.start(auth.loggedIn ? 'MainMenu' : 'Login');
  }
}
