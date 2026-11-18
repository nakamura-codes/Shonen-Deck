import Phaser from 'phaser';
import { MARGIN_X, MARGIN_Y } from '../render.ts';
import { auth, session } from '../session.ts';
import { isMuted, toggleMute } from '../sfx.ts';
import { isMusicMuted, startMenuMusic, toggleMusic } from '../music.ts';
import { centerInk, fitText, txt, fullBackground } from '../ui.ts';
import { SCREENS } from '../menu.generated.ts';
import { menuButton, placeImage, shrink, type Box } from '../menuUi.ts';

const M = SCREENS.menu_principal;
const find = (k: string, n = 0) => M.filter((b) => b[0] === k)[n] as Box;

/** Menu principal: perfil, logo e as opções do jogo. */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    startMenuMusic();
    fullBackground(this, 'fundos_fundo_menu_principal_2560x1440');

    // Perfil com o nome da conta.
    const prof = find('molduras_painel_perfil');
    // No canto superior esquerdo da tela (inclusive nas bordas extras).
    const [pk, , , pw, ph] = shrink(prof);
    const px = -MARGIN_X + 16, py = -MARGIN_Y + 16;
    placeImage(this, [pk, px, py, pw, ph]);
    centerInk(fitText(txt(this, 0, 0, session.name, 22, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }), pw * 0.5), px + pw * 0.63, py + ph * 0.36);

    // Vitórias e derrotas da conta (contra jogadores), logo abaixo do perfil.
    const record = txt(this, px + 12, py + ph + 14, '', 15, '#ffe28a', { stroke: '#0d0a14', strokeThickness: 4 }).setOrigin(0, 0.5);
    const showStats = () => {
      const st = auth.stats;
      record.setText(auth.isGuest ? 'Convidado: crie uma conta para o ranking' : st ? `Vitórias ${st.wins}  ·  Derrotas ${st.losses}` : '');
      fitText(record, 380);
    };
    showStats();
    const offStats = session.net.on((m) => {
      if (m.t === 'stats' || m.t === 'authOk') showStats();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offStats);
    session.net.send({ t: 'stats' });

    const logo = placeImage(this, find('logo_shonen_deck_transparente'));
    // O título fica 10% menor que o original, um pouco mais para cima.
    logo.setScale(logo.scaleX * 0.9, logo.scaleY * 0.9);
    logo.y -= 30;
    this.tweens.add({ targets: logo, y: logo.y + 6, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });

    menuButton(this, 'botoes_botao_principal', shrink(find('botoes_botao_principal_normal')), 'Jogar', () => this.scene.start('Wardrobe'), 27);
    menuButton(this, 'botoes_botao_secundario', shrink(find('botoes_botao_secundario_normal', 0)), 'Coleção de cartas', () => this.scene.start('Gallery'), 20);
    const som = menuButton(this, 'botoes_botao_secundario', shrink(find('botoes_botao_secundario_normal', 1)), isMuted() ? 'Som: desligado' : 'Som: ligado', () => {
      // No menu, um botão só para efeitos e música (na batalha há botões separados).
      const off = toggleMute();
      if (isMusicMuted() !== off) toggleMusic();
      som.setLabel(off ? 'Som: desligado' : 'Som: ligado');
    }, 20);
    menuButton(this, 'botoes_botao_secundario', shrink(find('botoes_botao_secundario_normal', 2)), 'Sair da conta', () => {
      auth.logout();
      this.scene.start('Login');
    }, 20);
  }
}
