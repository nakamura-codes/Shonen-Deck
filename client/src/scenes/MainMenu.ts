import Phaser from 'phaser';
import { MARGIN_X, MARGIN_Y, VIEW_H, VIEW_W } from '../render.ts';
import { auth, session } from '../session.ts';
import { isMuted, sfx, toggleMute } from '../sfx.ts';
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

    // Ranking: troféu no canto superior direito.
    if (this.textures.exists('trofeu')) {
      const size = 96;
      const tx = 1280 + MARGIN_X - 16 - size / 2, ty = -MARGIN_Y + 16 + size / 2;
      const trophy = this.add.image(tx, ty, 'trofeu').setDisplaySize(size, size * (196 / 192)).setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 10 });
      const base = trophy.scale;
      trophy.on('pointerover', () => this.tweens.add({ targets: trophy, scale: base * 1.08, duration: 100 }));
      trophy.on('pointerout', () => this.tweens.add({ targets: trophy, scale: base, duration: 100 }));
      trophy.on('pointerup', () => {
        sfx('click');
        this.showRanking();
      });
      txt(this, tx, ty + size / 2 + 10, 'Ranking', 16, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 });
    }

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

  /** Top 20 de vitórias contra outros jogadores (o treino contra o bot não conta). */
  private showRanking() {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const close = () => {
      off();
      objs.forEach((o) => o.destroy());
    };
    const shade = this.add.rectangle(640, 360, VIEW_W + 4, VIEW_H + 4, 0x0d0a14, 0.75).setDepth(200).setInteractive();
    shade.on('pointerdown', close);
    const W = 560, H = 600, x0 = 640 - W / 2, y0 = 360 - H / 2;
    const g = this.add.graphics().setDepth(201);
    g.fillStyle(0xf0a830).fillRoundedRect(x0 - 4, y0 - 4, W + 8, H + 8, 14);
    g.fillStyle(0x1c1a3a).fillRoundedRect(x0, y0, W, H, 12);
    g.fillStyle(0x2a2650).fillRect(x0 + 16, y0 + 74, W - 32, 30);
    objs.push(shade, g);
    if (this.textures.exists('trofeu')) objs.push(this.add.image(x0 + 44, y0 + 38, 'trofeu').setDisplaySize(52, 53).setDepth(202));
    objs.push(txt(this, 640, y0 + 38, 'Ranking', 30, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }).setDepth(202));
    const closeBtn = txt(this, x0 + W - 28, y0 + 30, '✕', 24, '#c8d0e8').setDepth(202).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', close);
    objs.push(closeBtn);
    const col = { pos: x0 + 46, name: x0 + 84, wins: x0 + W - 190, losses: x0 + W - 110, rate: x0 + W - 40 };
    const head = (x: number, s: string, origin = 0.5) => objs.push(txt(this, x, y0 + 89, s, 14, '#a8b4d0').setOrigin(origin, 0.5).setDepth(202));
    head(col.pos, '#');
    head(col.name, 'Jogador', 0);
    head(col.wins, 'Vitórias');
    head(col.losses, 'Derrotas');
    head(col.rate, '%');
    const status = txt(this, 640, 360, 'Carregando…', 16, '#c8d0e8').setDepth(202);
    objs.push(status);
    const rows: Phaser.GameObjects.GameObject[] = [];
    const off = session.net.on((m) => {
      if (m.t !== 'leaderboard') return;
      rows.forEach((r) => r.destroy());
      status.setText(m.rows.length ? '' : 'Ninguém jogou contra outros jogadores ainda.\nSeja o primeiro!').setAlign('center');
      m.rows.forEach((r, i) => {
        const y = y0 + 124 + i * 23;
        const mine = r.name === session.name;
        const color = i === 0 ? '#ffd040' : i === 1 ? '#e0e6f0' : i === 2 ? '#e0a070' : mine ? '#7fe0a0' : '#ffffff';
        if (mine) rows.push(this.add.rectangle(640, y, W - 32, 21, 0x2c5aa0, 0.6).setDepth(202));
        const total = r.wins + r.losses;
        const cells: [number, string, number][] = [
          [col.pos, String(i + 1), 0.5],
          [col.name, r.name, 0],
          [col.wins, String(r.wins), 0.5],
          [col.losses, String(r.losses), 0.5],
          [col.rate, total ? `${Math.round((r.wins / total) * 100)}` : '-', 0.5],
        ];
        for (const [x, s, o] of cells) rows.push(txt(this, x, y, s, 16, color, { stroke: '#0d0a14', strokeThickness: 3 }).setOrigin(o, 0.5).setDepth(203));
      });
      objs.push(...rows);
    });
    session.net.send({ t: 'leaderboard' });
  }
}
