import Phaser from 'phaser';
import { auth, session } from '../session.ts';
import { isMuted, toggleMute } from '../sfx.ts';
import { centerInk, fitText, txt } from '../ui.ts';
import { SCREENS } from '../menu.generated.ts';
import { menuButton, placeImage, type Box } from '../menuUi.ts';

const M = SCREENS.menu_principal;
const find = (k: string, n = 0) => M.filter((b) => b[0] === k)[n] as Box;

/** Menu principal: perfil, logo e as opções do jogo. */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    this.add.image(0, 0, 'fundos_fundo_menu_principal_2560x1440').setOrigin(0).setDisplaySize(1280, 720);

    // Perfil com o nome da conta.
    const prof = find('molduras_painel_perfil');
    placeImage(this, prof);
    const [, px, py, pw, ph] = prof;
    centerInk(fitText(txt(this, 0, 0, session.name, 26, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }), pw * 0.55), px + pw * 0.6, py + ph * 0.36);

    const logo = placeImage(this, find('logo_shonen_deck_transparente'));
    this.tweens.add({ targets: logo, y: logo.y + 6, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });

    menuButton(this, 'botoes_botao_principal', find('botoes_botao_principal_normal'), 'Jogar', () => this.scene.start('Wardrobe'), 32);
    menuButton(this, 'botoes_botao_secundario', find('botoes_botao_secundario_normal', 0), 'Coleção de cartas', () => this.scene.start('Gallery'), 24);
    const som = menuButton(this, 'botoes_botao_secundario', find('botoes_botao_secundario_normal', 1), isMuted() ? 'Som: desligado' : 'Som: ligado', () => {
      som.setLabel(toggleMute() ? 'Som: desligado' : 'Som: ligado');
    }, 24);
    menuButton(this, 'botoes_botao_secundario', find('botoes_botao_secundario_normal', 2), 'Sair da conta', () => {
      auth.logout();
      this.scene.start('Login');
    }, 24);
  }
}
