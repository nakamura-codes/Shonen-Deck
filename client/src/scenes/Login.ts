import Phaser from 'phaser';
import { auth } from '../session.ts';
import { sfx } from '../sfx.ts';
import { txt } from '../ui.ts';
import { SCREENS } from '../menu.generated.ts';
import { menuButton, placeImage, type Box } from '../menuUi.ts';

const L = SCREENS.login;
const find = (k: string, n = 0) => L.filter((b) => b[0] === k)[n] as Box;

/** Tela de login: nome + senha, criar conta ou entrar como convidado. */
export class LoginScene extends Phaser.Scene {
  private errorText!: Phaser.GameObjects.Text;
  private userEl!: HTMLInputElement;
  private passEl!: HTMLInputElement;
  private busy = false;

  constructor() {
    super('Login');
  }

  create() {
    this.busy = false;
    this.add.image(0, 0, 'fundos_fundo_login_2560x1440').setOrigin(0).setDisplaySize(1280, 720);
    const logo = placeImage(this, find('logo_shonen_deck_transparente'));
    this.tweens.add({ targets: logo, y: logo.y + 6, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    const panel = find('molduras_painel_login');
    placeImage(this, panel);

    this.userEl = this.field(find('campos_campo_login_normal', 0), 'Nome de jogador', 'text');
    this.passEl = this.field(find('campos_campo_login_normal', 1), 'Senha', 'password');

    menuButton(this, 'botoes_botao_login', find('botoes_botao_login_normal'), 'Entrar', () => this.submit(false), 24);
    menuButton(this, 'botoes_botao_secundario', find('botoes_botao_secundario_normal', 0), 'Criar conta', () => this.submit(true), 20);
    menuButton(this, 'botoes_botao_secundario', find('botoes_botao_secundario_normal', 1), 'Entrar como convidado', () => {
      auth.guest();
      this.scene.start('MainMenu');
    }, 20);

    // Mensagens de erro no topo do painel, acima dos campos.
    const [, , py] = panel;
    this.errorText = txt(this, 640, py + 52, '', 15, '#ffb0b0', { stroke: '#0d0a14', strokeThickness: 4 });
    txt(this, 640, 706, 'Por enquanto as contas ficam salvas só neste navegador.', 12, '#ffffff', { stroke: '#0d0a14', strokeThickness: 3 });
    setTimeout(() => this.userEl.focus(), 50);
  }

  /** Campo de texto sobre a arte do campo (troca para a versão "foco" ao digitar). */
  private field(box: Box, placeholder: string, type: string) {
    const [, x, y, w, h] = box;
    const bg = placeImage(this, box);
    const el = document.createElement('input');
    el.className = 'field-input';
    el.type = type;
    el.placeholder = placeholder;
    el.maxLength = type === 'password' ? 64 : 16;
    el.style.width = `${w - 70}px`;
    el.style.height = `${h - 22}px`;
    this.add.dom(x + w / 2, y + h / 2, el).setOrigin(0.5);
    el.addEventListener('focus', () => bg.setTexture('campos_campo_login_foco').setDisplaySize(w, h));
    el.addEventListener('blur', () => bg.setTexture('campos_campo_login_normal').setDisplaySize(w, h));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.submit(false);
    });
    return el;
  }

  private async submit(create: boolean) {
    if (this.busy) return;
    this.busy = true;
    const err = await auth.login(this.userEl.value, this.passEl.value, create);
    this.busy = false;
    if (err) {
      sfx('error');
      this.errorText.setText(err);
      return;
    }
    sfx('confirm');
    this.scene.start('MainMenu');
  }
}
