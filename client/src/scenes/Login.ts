import Phaser from 'phaser';
import { auth } from '../session.ts';
import { sfx } from '../sfx.ts';
import { txt } from '../ui.ts';
import { LOGIN } from '../menu.generated.ts';

type R = { x: number; y: number; w: number; h: number };

/** Tela de login: nome + senha, criar conta ou entrar como convidado. */
export class LoginScene extends Phaser.Scene {
  private errorText!: Phaser.GameObjects.Text;
  private busy = false;

  constructor() {
    super('Login');
  }

  create() {
    this.busy = false;
    if (this.textures.exists('login_bg')) this.add.image(0, 0, 'login_bg').setOrigin(0).setDisplaySize(1280, 720);
    else this.cameras.main.setBackgroundColor('#2a6fd0');

    // Cores dentro das áreas vazadas do painel (desenhadas por baixo dele).
    const g = this.add.graphics();
    const fillR = (r: R, color: number) => g.fillStyle(color).fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    fillR(LOGIN.title, 0x1b2438);
    fillR(LOGIN.user, 0x111a2e);
    fillR(LOGIN.pass, 0x111a2e);
    fillR(LOGIN.enter, 0x2f6fb0);
    LOGIN.small.forEach((r) => fillR(r, 0x3a4a66));
    if (this.textures.exists('login_painel')) this.add.image(0, 0, 'login_painel').setOrigin(0).setDisplaySize(1280, 720);

    const center = (r: R) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const t = center(LOGIN.title);
    txt(this, t.x, t.y, 'Shonen Deck', 26, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 });

    const field = (r: R, placeholder: string, type: string) => {
      const el = document.createElement('input');
      el.className = 'field-input';
      el.type = type;
      el.placeholder = placeholder;
      el.maxLength = type === 'password' ? 64 : 16;
      el.style.width = `${r.w - 24}px`;
      el.style.height = `${r.h - 8}px`;
      const c = center(r);
      this.add.dom(c.x, c.y, el).setOrigin(0.5);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') void this.submit(false);
      });
      return el;
    };
    this.userEl = field(LOGIN.user, 'Nome de jogador', 'text');
    this.passEl = field(LOGIN.pass, 'Senha', 'password');

    this.areaButton(LOGIN.enter, 'Entrar', 20, () => this.submit(false));
    this.areaButton(LOGIN.small[0], 'Criar conta', 14, () => this.submit(true));
    this.areaButton(LOGIN.small[1], 'Convidado', 14, () => {
      auth.guest();
      this.scene.start('MainMenu');
    });

    this.errorText = txt(this, 640, (LOGIN.enter.y + LOGIN.enter.h + LOGIN.small[0].y) / 2, '', 13, '#ffb0b0', { stroke: '#0d0a14', strokeThickness: 3 });
    txt(this, 640, 700, 'Por enquanto as contas ficam salvas só neste navegador.', 12, '#ffffff', { stroke: '#0d0a14', strokeThickness: 3 });
    setTimeout(() => this.userEl.focus(), 50);
  }

  private userEl!: HTMLInputElement;
  private passEl!: HTMLInputElement;

  /** Botão invisível sobre uma área do painel, com o texto e um brilho ao passar o mouse. */
  private areaButton(r: R, label: string, size: number, onClick: () => void) {
    const glow = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0xffffff, 0);
    txt(this, r.x + r.w / 2, r.y + r.h / 2 - 1, label, size, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 });
    const z = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => glow.setFillStyle(0xffffff, 0.12));
    z.on('pointerout', () => glow.setFillStyle(0xffffff, 0));
    z.on('pointerdown', () => {
      sfx('click');
      onClick();
    });
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
