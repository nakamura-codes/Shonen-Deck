import Phaser from 'phaser';
import { auth, session } from '../session.ts';
import { sfx } from '../sfx.ts';
import { txt } from '../ui.ts';

/** Menu principal: logo e as opções do jogo. */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    if (this.textures.exists('menu_bg')) this.add.image(0, 0, 'menu_bg').setOrigin(0).setDisplaySize(1280, 720);
    this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.15);

    if (this.textures.exists('logo')) {
      const logo = this.add.image(640, 150, 'logo');
      logo.setScale(560 / logo.width);
      this.tweens.add({ targets: logo, y: 158, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    } else {
      txt(this, 640, 150, 'Shonen Deck', 64, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 8 });
    }

    txt(this, 24, 24, `Jogador: ${session.name}`, 16, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }).setOrigin(0, 0.5);

    const items: [string, boolean, () => void][] = [
      ['Jogar', true, () => this.scene.start('Wardrobe')],
      ['Coleção de cartas', false, () => this.scene.start('Gallery')],
      ['Sair', false, () => {
        auth.logout();
        this.scene.start('Login');
      }],
    ];
    items.forEach(([label, main], i) => this.menuButton(640, 350 + i * 92, label, main, items[i][2]));
  }

  /** Botão com a arte do menu (normal / hover / pressionado; o principal é dourado). */
  private menuButton(x: number, y: number, label: string, main: boolean, onClick: () => void) {
    const base = main ? 'botao_principal' : 'botao_normal';
    const img = this.add.image(x, y, base);
    const w = 330;
    img.setScale(w / img.width);
    const t = txt(this, x, y - 4, label, 24, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 });
    const setTex = (k: string) => this.textures.exists(k) && img.setTexture(k).setScale(w / img.width);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerover', () => !main && setTex('botao_hover'));
    img.on('pointerout', () => setTex(base));
    img.on('pointerdown', () => {
      setTex('botao_pressionado');
      t.setY(y - 1);
    });
    img.on('pointerup', () => {
      sfx('click');
      onClick();
    });
  }
}
