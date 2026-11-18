import Phaser from 'phaser';
import {
  COMBOS,
  getCard,
  previewCardDamage,
  type BattleEvent,
  type BattleView,
  type FighterPublicView,
  type PlayerIndex,
  type PowerId,
  type ServerMessage,
} from '@oficina/shared';
import { session } from '../session.ts';
import { attackSound, isMuted, sfx, toggleMute } from '../sfx.ts';
import { HUD } from '../hud.generated.ts';
import { mergeRepeats } from '../events.ts';
import {
  CARD_H,
  CARD_W,
  COLORS,
  floatText,
  makeButton,
  makeCard,
  makeCharacter,
  makeArtButton,
  makeMiniIcon,
  NUM_FONT,
  playFx,
  centerInk,
  tweenPromise,
  txt,
  wait,
  type Button,
} from '../ui.ts';

type Side = 0 | 1; // 0 = eu (esquerda), 1 = oponente (direita)

const CHAR_X: Record<Side, number> = { 0: 260, 1: 1020 };
const FEET_Y = 416;
const CHAR_SCALE = 3;
const BODY_Y = FEET_Y - 100;

const POWER_CARD: Record<PowerId, string> = { bankai: 'bankai', gearSecond: 'gear_second', domain: 'domain_expansion', hollow: 'hollowficacao' };

export class BattleScene extends Phaser.Scene {
  private view: BattleView | null = null;
  private deadline = 0;
  private animating = false;
  private ended = false;

  private chars: Partial<Record<Side, Phaser.GameObjects.Container>> = {};
  private hud!: Phaser.GameObjects.Container;
  private hand!: Phaser.GameObjects.Container;
  private hpBars: Partial<Record<Side, { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; max: number }>> = {};
  private timerText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private readyBtn!: Button;
  private undoBtn!: Button;
  private starterText!: Phaser.GameObjects.Text;
  private hasHudArt = false;
  private arenaImage?: Phaser.GameObjects.Image;

  constructor() {
    super('Battle');
  }

  create() {
    this.view = null;
    this.animating = false;
    this.ended = false;
    this.chars = {};
    this.hpBars = {};

    this.arenaImage = undefined;
    // Faixa de baixo (mão e botões); a arena entra em cima quando chega o primeiro estado.
    const panel = this.add.graphics().setDepth(-9);
    panel.fillGradientStyle(0x232a36, 0x232a36, 0x141820, 0x141820).fillRect(0, 427, 1280, 293);
    // HUD com arte (assets/ui/hud.png): as áreas vazadas recebem barras de HP, Ki, contadores e botões.
    this.hasHudArt = this.textures.exists('hud');
    if (this.hasHudArt) this.add.image(HUD.panel.x, HUD.panel.y, 'hud').setOrigin(0).setDepth(-8);
    this.hud = this.add.container(0, 0).setDepth(5);
    this.hand = this.add.container(0, 0).setDepth(20);

    const top = this.add.graphics().setDepth(4);
    top.fillStyle(COLORS.outline, 0.85).fillRect(0, 0, 1280, 52);
    top.fillStyle(COLORS.gold).fillRect(0, 52, 1280, 3);
    this.turnText = txt(this, 90, 27, 'Turno 1', 22, '#ffe28a', { fontStyle: 'bold' }).setDepth(6);
    this.timerText = txt(this, 640, 27, '', 36, '#ffffff', { fontFamily: NUM_FONT }).setDepth(6);
    this.starterText = txt(this, 1110, 27, '', 16, '#ffe28a').setDepth(6);
    // Som ligado/desligado.
    const muteBtn = txt(this, 1250, 27, isMuted() ? '🔇' : '🔊', 22, '#ffffff').setDepth(7).setInteractive({ useHandCursor: true });
    muteBtn.on('pointerdown', () => muteBtn.setText(toggleMute() ? '🔇' : '🔊'));
    this.banner = txt(this, 640, 82, '', 18, '#ffb0b0', { stroke: '#0d0a14', strokeThickness: 4 }).setDepth(30);

    if (this.hasHudArt) {
      this.readyBtn = makeArtButton(this, HUD.readyBtn, 'Confirmar', () => this.sendReady(), 0x2f6fb0, 22).setDepth(25);
      this.undoBtn = makeArtButton(this, HUD.undoBtn, 'Desfazer', () => this.sendUndo(), 0x3a4558, 19).setDepth(25);
    } else {
      this.readyBtn = makeButton(this, 1165, 560, 190, 60, 'Confirmar', () => this.sendReady(), COLORS.gold, 22).setDepth(25);
      this.undoBtn = makeButton(this, 1165, 636, 190, 46, 'Desfazer', () => this.sendUndo(), 0xb0a0c8, 18).setDepth(25);
    }

    // Ki
    if (this.hasHudArt) {
      // Bola de Ki por baixo da HUD: o anel é da própria arte.
      const k = HUD.ki;
      const kr = Math.max(k.w, k.h) / 2 + 3;
      const ki = this.add.graphics().setDepth(-8.5);
      ki.fillStyle(0x1f4f8a).fillCircle(k.x + k.w / 2, k.y + k.h / 2, kr);
      ki.fillStyle(COLORS.ki).fillCircle(k.x + k.w / 2, k.y + k.h / 2, kr - 6);
      ki.fillStyle(0x8fd0ff, 0.8).fillCircle(k.x + k.w * 0.3, k.y + k.h * 0.28, 7);
    } else {
      const ki = this.add.graphics().setDepth(4);
      ki.fillStyle(COLORS.outline).fillCircle(90, 590, 52);
      ki.fillStyle(0x1f4f8a).fillCircle(90, 590, 47);
      ki.fillStyle(COLORS.ki).fillCircle(90, 590, 42);
      ki.fillStyle(0x8fd0ff, 0.8).fillCircle(70, 570, 7);
    }

    const off = session.net.on((msg) => this.onMessage(msg));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    if (session.lastView) {
      this.deadline = session.lastView.deadline;
      this.render(session.lastView.view);
      this.maybeCoinFlip(session.lastView.view);
    } else {
      this.banner.setText('Esperando o servidor…');
    }
  }

  update() {
    if (!this.view || this.view.phase === 'over' || !this.deadline) {
      this.timerText.setText('');
      return;
    }
    const secs = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    this.timerText.setText(this.animating ? '' : `${secs}s`);
    this.timerText.setColor(secs <= 5 ? '#ff6060' : '#ffffff');
  }

  private side(p: PlayerIndex): Side {
    return this.view && p === this.view.you ? 0 : 1;
  }

  private onMessage(msg: ServerMessage) {
    switch (msg.t) {
      case 'state':
        this.deadline = Date.now() + msg.remainingMs;
        if (!this.animating) this.render(msg.view);
        else this.view = { ...msg.view };
        this.maybeCoinFlip(msg.view);
        break;
      case 'resolved':
        this.deadline = Date.now() + msg.remainingMs;
        this.playResolution(msg.events, msg.view);
        break;
      case 'opponentStatus':
        this.banner.setText(msg.connected ? '' : 'Oponente desconectou. Esperando ele voltar (30s)…');
        break;
      case 'error':
        this.toast(msg.message);
        break;
    }
  }

  private toast(s: string) {
    sfx('error');
    floatText(this, 640, 400, s, '#ffb0b0', 20);
  }

  private sendReady() {
    if (this.animating || !this.view || this.view.me.ready) return;
    sfx('confirm');
    session.net.send({ t: 'ready' });
  }

  private sendUndo() {
    if (this.animating || !this.view || this.view.me.ready) return;
    sfx('undo');
    session.net.send({ t: 'undo' });
  }

  // ───────────────────────── Desenho do estado ─────────────────────────

  private render(view: BattleView) {
    this.view = view;
    if (!this.arenaImage) {
      const key = `arena_${view.arena}`;
      if (this.textures.exists(key)) this.arenaImage = this.add.image(0, 0, key).setOrigin(0).setDisplaySize(1280, 427).setDepth(-10);
    }
    this.turnText.setText(`Turno ${view.turn}`);
    const starterName = view.turnStarter === view.you ? 'Você' : view.opponent.name;
    this.starterText.setText(view.phase === 'planning' ? `Começa: ${starterName}` : '');
    if (this.banner.text === 'Esperando o servidor…') this.banner.setText('');
    this.hud.removeAll(true);
    this.hand.removeAll(true);

    this.ensureChar(0, view.me);
    this.ensureChar(1, view.opponent);
    this.drawSide(0, view.me);
    this.drawSide(1, view.opponent);
    this.drawQueues(view);
    this.drawHand(view);

    // Só o Ki que o jogador tem agora, no centro da bola.
    const kc = this.hasHudArt ? { x: HUD.ki.x + HUD.ki.w / 2, y: HUD.ki.y + HUD.ki.h / 2 } : { x: 90, y: 590 };
    this.hud.add(centerInk(txt(this, 0, 0, String(view.me.ki), this.hasHudArt ? 56 : 44, '#ffffff', { fontFamily: NUM_FONT, stroke: '#0d0a14', strokeThickness: 5 }), kc.x, kc.y));
    if (this.hasHudArt) {
      // Contadores: monte de compra e descarte nas duas caixinhas abaixo do Ki.
      for (const [r, n, label] of [[HUD.drawPile, view.me.drawCount, 'Compra'], [HUD.discardPile, view.me.discardCount, 'Descarte']] as const) {
        // Mini carta (compra = verso, descarte = carta virada) + número.
        const g = this.add.graphics();
        const ix = r.x + 12, iy = r.y + r.h / 2;
        g.fillStyle(0x0d0a14).fillRect(ix - 7, iy - 9, 14, 18);
        g.fillStyle(label === 'Compra' ? 0x3a2a5a : 0xd8d2c8).fillRect(ix - 6, iy - 8, 12, 16);
        g.fillStyle(label === 'Compra' ? 0xf0a830 : 0x8a8f9a).fillRect(ix - 3, iy - 4, 6, 8);
        this.hud.add(g);
        this.hud.add(centerInk(txt(this, 0, 0, String(n), 22, '#ffffff', { fontFamily: NUM_FONT, stroke: '#0d0a14', strokeThickness: 3 }), r.x + r.w / 2 + 8, r.y + r.h / 2));
      }
    } else {
      this.hud.add(txt(this, 90, 670, `Compra ${view.me.drawCount}  ·  Descarte ${view.me.discardCount}`, 13, COLORS.textDim));
    }

    const canAct = view.phase === 'planning' && !view.me.ready && !this.animating;
    this.readyBtn.setEnabled(canAct).setLabel(view.me.ready ? 'Pronto ✓' : 'Confirmar');
    this.undoBtn.setEnabled(canAct && view.me.queue.length > 0);

    if (view.phase === 'over') this.showGameOver(view);
  }

  private ensureChar(side: Side, f: FighterPublicView) {
    if (this.chars[side]) return;
    const c = makeCharacter(this, f.outfit, CHAR_SCALE, side === 1).setPosition(CHAR_X[side], FEET_Y).setDepth(3);
    this.tweens.add({ targets: c, scaleY: 1.02, yoyo: true, repeat: -1, duration: 1100 + side * 150, ease: 'Sine.easeInOut' });
    this.chars[side] = c;
    txt(this, CHAR_X[side], 172, f.name, 20, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }).setDepth(4);
  }

  private drawHpBar(side: Side, hp: number, max: number) {
    let bar = this.hpBars[side];
    if (!bar) {
      bar = { g: this.add.graphics().setDepth(6), t: txt(this, CHAR_X[side], 448, '', 19, '#ffffff', { fontFamily: NUM_FONT, stroke: '#0d0a14', strokeThickness: 4 }).setDepth(7), max };
      this.hpBars[side] = bar;
    }
    bar.max = max;
    const slot = this.hasHudArt ? (side === 0 ? HUD.hpLeft : HUD.hpRight) : null;
    const x = slot ? slot.x : CHAR_X[side] - 100;
    const w = 200;
    const ratio = Phaser.Math.Clamp(hp / max, 0, 1);
    bar.g.clear();
    if (slot) {
      // Barra dentro da abertura da HUD (a moldura é da própria arte).
      bar.g.fillStyle(0x3a1a22).fillRect(slot.x - 1, slot.y - 1, slot.w + 2, slot.h + 2);
      bar.g.fillStyle(COLORS.hp).fillRect(slot.x - 1, slot.y - 1, Math.round((slot.w + 2) * ratio), slot.h + 2);
      bar.g.fillStyle(0xff8a8a).fillRect(slot.x - 1, slot.y - 1, Math.round((slot.w + 2) * ratio), 4);
    } else {
      bar.g.fillStyle(COLORS.outline).fillRect(x - 3, 437, w + 6, 24);
      bar.g.fillStyle(0x3a1a22).fillRect(x, 440, w, 18);
      bar.g.fillStyle(COLORS.hp).fillRect(x, 440, Math.round(w * ratio), 18);
      bar.g.fillStyle(0xff8a8a).fillRect(x, 440, Math.round(w * ratio), 4);
    }
    bar.t.setText(`${Math.max(0, hp)}/${max}`);
    if (slot) centerInk(bar.t, slot.x + slot.w / 2, slot.y + slot.h / 2);
    else centerInk(bar.t, CHAR_X[side], 449);
  }

  private drawSide(side: Side, f: FighterPublicView) {
    const x = CHAR_X[side];
    this.drawHpBar(side, f.hp, f.maxHp);

    if (f.block > 0) this.hud.add(this.makeShield(side, f.block));

    const chips: [string, string][] = [];
    const str = f.strength + f.tempStrength;
    if (str) chips.push([`Força ${str}`, '#ffb070']);
    if (f.weak) chips.push([`Fraco ${f.weak}`, '#b0e070']);
    if (f.vulnerable) chips.push([`Vulnerável ${f.vulnerable}`, '#ff8080']);
    if (f.stunned) chips.push(['Atordoado', '#ffd060']);
    if (f.sageTurns > 0) chips.push([`Modo Sábio ${f.sageTurns}`, '#ffb040']);
    if (f.maxKi < 5) chips.push([`Ki máx ${f.maxKi}`, '#8fd0ff']);
    chips.forEach(([label, color], i) => {
      this.hud.add(txt(this, x - (chips.length - 1) * 55 + i * 110, 146, label, 14, color, { stroke: '#0d0a14', strokeThickness: 4 }));
    });

    // Poderes ativos.
    f.powers.forEach((p, i) => {
      const slot = this.hasHudArt ? (side === 0 ? HUD.hpLeft : HUD.hpRight) : null;
      const px = slot ? (side === 0 ? slot.x + slot.w + 58 + i * 34 : slot.x - 58 - i * 34) : x + 128 + i * 34;
      const icon = makeMiniIcon(this, POWER_CARD[p], 0.42).setPosition(px, slot ? slot.y + slot.h / 2 : 449);
      this.hud.add(icon);
    });

    // Golpes carregando (o oponente vê!).
    f.charges.forEach((ch, i) => {
      const cx = x + (side === 0 ? 115 : -115);
      const cy = 250 + i * 70;
      const icon = makeMiniIcon(this, ch.cardId, 0.6).setPosition(cx, cy);
      this.tweens.add({ targets: icon, scale: 0.66, yoyo: true, repeat: -1, duration: 400 });
      this.hud.add(icon);
      this.hud.add(txt(this, cx, cy + 34, ch.turnsLeft === 1 ? 'dispara no próximo turno!' : `${ch.turnsLeft} turnos`, 12, '#ffe28a', { stroke: '#0d0a14', strokeThickness: 4 }));
    });

    if (f.ready && this.view?.phase === 'planning') {
      this.hud.add(txt(this, x, 120, 'Pronto!', 16, '#7fe0a0', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }));
    }
  }

  private drawQueues(view: BattleView) {
    // Fila do oponente: nada é mostrado (nem quantas cartas), a não ser com Sharingan.
    const oq = view.opponent.queue;
    const status = oq
      ? 'Sharingan: você vê as cartas do oponente!'
      : view.opponent.ready
        ? 'Oponente pronto.'
        : 'Oponente está escolhendo suas cartas…';
    this.hud.add(txt(this, 640, 112, status, 16, oq ? '#ff8080' : '#ffffff', { stroke: '#0d0a14', strokeThickness: 4 }));
    (oq ?? []).forEach((q, i) => {
      const x = 640 - (oq!.length - 1) * 34 + i * 68;
      this.hud.add(makeMiniIcon(this, q.card.id, 0.75).setPosition(x, 170));
    });

    // Minha fila.
    const mq = view.me.queue;
    this.hud.add(txt(this, 640, 262, mq.length ? 'Sua jogada' : 'Clique nas cartas da mão para jogar · o cadeado guarda 1 carta para o próximo turno', 16, '#ffffff', { stroke: '#0d0a14', strokeThickness: 4 }));
    mq.forEach((q, i) => {
      const x = 640 - (mq.length - 1) * 40 + i * 80;
      const icon = makeMiniIcon(this, q.card.id, 0.85).setPosition(x, 330);
      this.hud.add(icon);
      // Leitura de Poder: clicar numa carta da jogada a coloca para resolver primeiro.
      if (view.me.canReorder && !view.me.ready && i > 0) {
        icon.setInteractive({ useHandCursor: true });
        icon.on('pointerdown', () => session.net.send({ t: 'moveFirst', uid: q.card.uid }));
        icon.on('pointerover', () => icon.setScale(0.95));
        icon.on('pointerout', () => icon.setScale(0.85));
      }
      this.hud.add(this.orderBadge(x - 26, 300, i + 1, COLORS.ki));
      if (q.doubled) this.hud.add(txt(this, x + 24, 300, 'x2', 18, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }));
    });
    if (view.me.comboLock) this.hud.add(txt(this, 640, 410, 'Combo! Nenhuma outra carta neste turno. Hollow Purple na próxima rodada.', 15, '#e9b8ff', { stroke: '#0d0a14', strokeThickness: 4 }));
    if (view.me.canReorder && !view.me.ready && mq.length > 1) this.hud.add(txt(this, 640, 372, 'Scouter: clique numa carta da sua jogada para ela resolver primeiro', 15, '#9dff8a', { stroke: '#0d0a14', strokeThickness: 4 }));
    if (view.me.stunned) this.hud.add(txt(this, 640, 390, 'Atordoado pelo Haki do Rei: você não pode jogar cartas neste turno.', 15, '#ffd060', { stroke: '#0d0a14', strokeThickness: 4 }));
    if (view.me.lockedTo) this.hud.add(txt(this, 640, 410, `Turno travado: só ${getCard(view.me.lockedTo).name} (custo 0). O Ki deste turno não acumula.`, 15, '#e9b8ff', { stroke: '#0d0a14', strokeThickness: 4 }));
    if (view.me.cloneNext) this.hud.add(txt(this, 640, 390, 'Kage Bunshin: a próxima carta acontece 2 vezes', 15, '#ffe28a', { stroke: '#0d0a14', strokeThickness: 4 }));
  }

  private drawHand(view: BattleView) {
    const cards = view.me.hand;
    const n = cards.length;
    // Com a HUD, as cartas ficam a 70% dentro da área escura do meio e ampliam ao passar o mouse.
    const handScale = this.hasHudArt ? 0.8 : 1;
    const area = this.hasHudArt ? { x0: HUD.ki.x + HUD.ki.w + 30, x1: HUD.readyBtn.x - 14 } : { x0: 190, x1: 1050 };
    const spacing = Math.min(166 * handScale + 8, (area.x1 - area.x0 - CARD_W * handScale) / Math.max(1, n - 1));
    const y = this.hasHudArt ? HUD.panel.y + 177 : 720 - CARD_H / 2 - 8;
    const midX = (area.x0 + area.x1) / 2;
    const canAct = view.phase === 'planning' && !view.me.ready && !this.animating;
    cards.forEach((c, i) => {
      const def = getCard(c.id);
      const x = midX - ((n - 1) * spacing) / 2 + i * spacing;
      const card = makeCard(this, c.id, { preview: previewCardDamage(view, c.id) }).setPosition(x, y).setScale(handScale);
      const locked = view.me.lockedTo !== null && c.id !== view.me.lockedTo;
      const cost = view.me.lockedTo === c.id ? 0 : def.cost;
      const blockedReason = view.me.stunned
        ? 'Atordoado'
        : locked
        ? `Só ${getCard(view.me.lockedTo!).name}`
        : view.me.comboLock
          ? 'Combo usado'
          : cost > view.me.ki
            ? 'Ki insuficiente.'
            : null;
      const playable = canAct && !blockedReason;
      card.setAlpha(playable ? 1 : 0.55);
      if (canAct && (view.me.stunned || locked || view.me.comboLock)) {
        const band = this.add.rectangle(0, -10, 150, 26, 0x2a1040, 0.9).setStrokeStyle(2, 0xa858e8);
        card.add([band, txt(this, 0, -10, blockedReason!, 13, '#e9b8ff', { fontStyle: 'bold' })]);
      }
      card.setInteractive({ useHandCursor: playable });
      card.on('pointerover', () => {
        this.hand.bringToTop(card);
        // Amplia para ler, sem sair da tela.
        this.tweens.add({ targets: card, y: 720 - (CARD_H * 1.5) / 2 - 4, scale: 1.5, duration: 120 });
      });
      card.on('pointerout', () => this.tweens.add({ targets: card, y, scale: handScale, duration: 120 }));
      card.on('pointerdown', () => {
        if (!playable) {
          if (canAct && blockedReason) this.toast(blockedReason);
          return;
        }
        sfx('card');
        session.net.send({ t: 'play', uid: c.uid });
      });
      if (c.uid === view.me.keepUid) {
        card.add(this.add.rectangle(0, 0, CARD_W + 10, CARD_H + 10).setStrokeStyle(5, 0xffd040));
      }
      this.hand.add(card);
      this.hand.add(this.lockButton(view, c.uid, c.id, x, y - (CARD_H * handScale) / 2 - 12, canAct));
    });
  }

  /** Escudo no fim da barra de HP com o dano que ainda vai segurar. */
  private makeShield(side: Side, amount: number) {
    const slot = this.hasHudArt ? (side === 0 ? HUD.hpLeft : HUD.hpRight) : null;
    const x = slot ? (side === 0 ? slot.x + slot.w + 4 : slot.x - 4) : CHAR_X[side] + (side === 0 ? 122 : -122);
    const y = slot ? slot.y + slot.h / 2 : 449;
    const c = this.add.container(x, y).setScale(1.3);
    const g = this.add.graphics();
    const shape = (k: number) => [
      new Phaser.Math.Vector2(-15 * k, -16 * k),
      new Phaser.Math.Vector2(15 * k, -16 * k),
      new Phaser.Math.Vector2(15 * k, 2 * k),
      new Phaser.Math.Vector2(0, 18 * k),
      new Phaser.Math.Vector2(-15 * k, 2 * k),
    ];
    g.fillStyle(COLORS.outline).fillPoints(shape(1.18), true);
    g.fillStyle(0x2a6fb8).fillPoints(shape(1), true);
    g.fillStyle(COLORS.block).fillPoints(shape(0.78), true);
    g.fillStyle(0xcfe8ff, 0.7).fillRect(-11, -14, 8, 3);
    c.add(g);
    c.add(centerInk(txt(this, 0, 0, String(amount), 20, '#ffffff', { fontFamily: NUM_FONT, stroke: '#0d0a14', strokeThickness: 4 }), 0, -2));
    return c;
  }

  /**
   * Cadeado acima da carta: trava a carta para ela não ser descartada no fim do turno (1 por turno).
   * Dourado = travada; apagado = foi travada no turno passado e não pode de novo.
   */
  private lockButton(view: BattleView, uid: string, cardId: string, x: number, y: number, canAct: boolean) {
    const c = this.add.container(x, y);
    const kept = view.me.keepUid === uid;
    const blocked = view.me.lastKeptUid === uid;
    const def = getCard(cardId);
    const unavailable = blocked || !!def.ethereal || !!def.retain;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      const body = kept ? 0xffd040 : unavailable ? 0x4a4f5c : hover ? 0xe8ecf4 : 0xb8c0d0;
      g.fillStyle(0x0d0a14).fillRoundedRect(-13, -12, 26, 26, 6);
      g.lineStyle(3, body).beginPath().arc(0, -2, 6, Math.PI, kept ? 0 : -0.3).strokePath();
      g.fillStyle(body).fillRoundedRect(-8, -2, 16, 12, 2);
      g.fillStyle(0x0d0a14).fillRect(-1, 2, 2, 4);
    };
    draw(false);
    c.add(g);
    if (!canAct || unavailable) {
      c.setAlpha(canAct ? 0.55 : kept ? 1 : 0.4);
      if (blocked && canAct) {
        const z = this.add.zone(0, 0, 28, 28).setInteractive();
        z.on('pointerdown', () => this.toast('Essa carta já ficou travada no turno passado.'));
        c.add(z);
      }
      return c;
    }
    const z = this.add.zone(0, 0, 30, 30).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerdown', () => {
      sfx('click');
      session.net.send({ t: 'keep', uid });
    });
    c.add(z);
    return c;
  }

  // ───────────────────────── Animações da revelação ─────────────────────────

  private async playResolution(events: BattleEvent[], finalView: BattleView) {
    if (!this.view) {
      this.render(finalView);
      return;
    }
    this.animating = true;
    this.hand.removeAll(true);
    this.readyBtn.setEnabled(false);
    this.undoBtn.setEnabled(false);
    this.view = { ...this.view };

    const hp: Record<Side, number> = { 0: this.view.me.hp, 1: this.view.opponent.hp };
    // Escudo no fim da barra de HP: soma os Bloqueios e desconta o que cada golpe absorve.
    const block: Record<Side, number> = { 0: 0, 1: 0 };
    const shields: Partial<Record<Side, Phaser.GameObjects.Container>> = {};
    const setShield = (sd: Side, value: number, pulse: boolean) => {
      block[sd] = Math.max(0, value);
      shields[sd]?.destroy();
      shields[sd] = undefined;
      if (block[sd] <= 0) return;
      const sh = this.makeShield(sd, block[sd]).setDepth(8);
      shields[sd] = sh;
      if (pulse) this.tweens.add({ targets: sh, scale: { from: 1.4, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    };
    const max: Record<Side, number> = { 0: this.view.me.maxHp, 1: this.view.opponent.maxHp };

    this.hud.removeAll(true);
    const plays = events.filter((e): e is Extract<BattleEvent, { type: 'play' }> => e.type === 'play');
    if (plays.length) await this.showReveal(plays);

    let lastCard = '';
    for (const ev of mergeRepeats(events)) {
      switch (ev.type) {
        case 'damage': {
          const fast = lastCard === `${ev.source}:${ev.cardId}`;
          // Golpe devolvido pelo Boogie Woogie: a animação sai de quem devolveu.
          const reflected = ev.source === ev.target;
          const from: Side = reflected ? (this.side(ev.target) === 0 ? 1 : 0) : this.side(ev.source);
          if (!fast) sfx(attackSound(ev.cardId));
          await this.attackAnim(from, ev.cardId, fast);
          const t = this.side(ev.target);
          hp[t] -= ev.amount;
          this.drawHpBar(t, hp[t], max[t]);
          sfx(ev.amount >= 25 ? 'explosionBig' : ev.amount >= 15 ? 'hitHeavy' : ev.amount > 0 ? 'hit' : 'block');
          if (ev.blocked > 0 && ev.amount > 0) sfx('block');
          this.impactFx(t, ev.cardId, ev.amount, ev.blocked);
          if (ev.blocked > 0) setShield(t, block[t] - ev.blocked, true);
          this.hitAnim(t, ev.amount, ev.blocked);
          await wait(this, fast ? 60 : 220);
          lastCard = `${ev.source}:${ev.cardId}`;
          break;
        }
        case 'block':
          setShield(this.side(ev.player), block[this.side(ev.player)] + ev.amount, true);
          sfx('block');
          playFx(this, 'barrier-block', CHAR_X[this.side(ev.player)] + (this.side(ev.player) === 0 ? 50 : -50), BODY_Y, { scale: 2.5 });
          this.flashAura(this.side(ev.player), COLORS.block);
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 60, `+${ev.amount} Bloqueio`, '#8fd0ff', 22);
          await wait(this, 320);
          break;
        case 'status': {
          sfx(ev.status === 'strength' ? 'buff' : 'debuff');
          if (ev.status === 'strength') playFx(this, 'power-up-aura', CHAR_X[this.side(ev.player)], FEET_Y, { scale: 3 });
          else playFx(this, 'curse', CHAR_X[this.side(ev.player)], BODY_Y + 10, { scale: 2, speed: 1.6 });
          if (ev.cardId === 'blue' && ev.status === 'weak') await this.attackAnim(this.side(ev.player) === 0 ? 1 : 0, 'blue', false);
          const label = { strength: `Força +${ev.amount}`, weak: 'Fraco!', vulnerable: 'Vulnerável!' }[ev.status];
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 90, label, ev.status === 'strength' ? '#ffb070' : '#d0a0ff', 22);
          await wait(this, 320);
          break;
        }
        case 'hpLoss': {
          sfx('debuff');
          const s = this.side(ev.player);
          hp[s] -= ev.amount;
          this.drawHpBar(s, hp[s], max[s]);
          floatText(this, CHAR_X[s], BODY_Y - 30, `-${ev.amount} (${ev.reason})`, '#e080ff', 20);
          await wait(this, 350);
          break;
        }
        case 'power':
          sfx('powerUp');
          playFx(this, 'power-up-aura', CHAR_X[this.side(ev.player)], FEET_Y, { scale: 4 });
          await this.bigShout(this.side(ev.player), getCard(POWER_CARD[ev.power]).name.toUpperCase() + '!', 0xb070ff);
          break;
        case 'chargeStart':
          sfx('charge');
          playFx(this, 'arcane-cast', CHAR_X[this.side(ev.player)], BODY_Y, { scale: 3 });
          this.flashAura(this.side(ev.player), 0x6fd0ff);
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 110, `Carregando ${getCard(ev.cardId).name}…`, '#8fd0ff', 20);
          await wait(this, 600);
          break;
        case 'chargeFire':
          sfx('chargeBig');
          await this.bigShout(this.side(ev.player), getCard(ev.cardId).name.toUpperCase() + '!', 0x6fd0ff);
          lastCard = '';
          break;
        case 'chargeCancel':
          sfx('debuff');
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 110, `${getCard(ev.cardId).name} cancelada!`, '#ff8080', 22);
          await wait(this, 700);
          break;
        case 'evade': {
          sfx('dodge');
          playFx(this, 'fumaca', CHAR_X[this.side(ev.player)], BODY_Y, { scale: 3, tint: 0xd8c8ff });
          playFx(this, 'blink-dash', CHAR_X[this.side(ev.player)], BODY_Y, { scale: 2, flipX: this.side(ev.player) === 1 });
          const s2 = this.side(ev.player);
          const c = this.chars[s2];
          if (c) {
            this.tweens.add({ targets: c, alpha: 0.25, yoyo: true, duration: 120, repeat: 2 });
            this.tweens.add({ targets: c, y: FEET_Y - 30, yoyo: true, duration: 180 });
          }
          this.flashAura(s2, 0xb070ff);
          floatText(this, CHAR_X[s2], BODY_Y - 120, `Infinity! Desviou de ${getCard(ev.cardId).name}`, '#e9b8ff', 20);
          await wait(this, 650);
          break;
        }
        case 'reflect':
          sfx('swap');
          playFx(this, 'teleport-in', CHAR_X[0], FEET_Y, { scale: 3 });
          playFx(this, 'teleport-in', CHAR_X[1], FEET_Y, { scale: 3 });
          await this.swapAnim();
          floatText(this, 640, BODY_Y - 140, `Boogie Woogie! ${getCard(ev.cardId).name} voltou!`, '#e9b8ff', 22);
          await wait(this, 250);
          break;
        case 'heal': {
          sfx('heal');
          playFx(this, 'holy-heal', CHAR_X[this.side(ev.player)], FEET_Y, { scale: 2.5 });
          const s2 = this.side(ev.player);
          hp[s2] += ev.amount;
          this.drawHpBar(s2, hp[s2], max[s2]);
          this.flashAura(s2, 0x7fe0a0);
          floatText(this, CHAR_X[s2], BODY_Y - 60, `+${ev.amount} HP`, '#7fe0a0', 26);
          await wait(this, 500);
          break;
        }
        case 'stun': {
          sfx('stun');
          playFx(this, 'stun-stars', CHAR_X[this.side(ev.player)], BODY_Y - 110, { scale: 3 });
          const target = this.side(ev.player);
          const caster: Side = target === 0 ? 1 : 0;
          const ring = this.add.circle(CHAR_X[caster], BODY_Y, 30, 0x000000, 0).setStrokeStyle(10, 0x2a0a3a).setDepth(30);
          const ring2 = this.add.circle(CHAR_X[caster], BODY_Y, 30, 0x000000, 0).setStrokeStyle(4, 0xff3050).setDepth(30);
          this.cameras.main.shake(400, 0.012);
          await tweenPromise(this, { targets: [ring, ring2], scale: 14, alpha: 0, duration: 650, ease: 'Cubic.easeOut' });
          ring.destroy();
          ring2.destroy();
          floatText(this, CHAR_X[target], BODY_Y - 110, 'Atordoado!', '#ffd060', 26);
          floatText(this, CHAR_X[target], BODY_Y - 70, `Ki máximo -${ev.kiPenalty}`, '#8fd0ff', 18);
          await wait(this, 600);
          break;
        }
        case 'evolve':
          await this.evolveAnim(this.side(ev.player), ev.from, ev.into);
          break;
        case 'combo':
          await this.comboAnim(this.side(ev.player), ev.cardId);
          break;
        case 'gameOver':
        case 'play':
          break;
      }
      if (ev.type !== 'damage') lastCard = '';
    }

    await wait(this, 300);
    // O Bloqueio zera no início do turno: o escudo some junto.
    for (const sd of [0, 1] as Side[]) shields[sd]?.destroy();
    this.animating = false;
    // Usa a visão mais nova (pode ter chegado um "state" durante a animação).
    const latest = session.lastView?.view ?? finalView;
    this.render(latest.turn >= finalView.turn ? latest : finalView);
  }

  /** Mostra as cartas na ordem real de resolução, com número e cor do dono (azul = você, vermelho = oponente). */
  private async showReveal(plays: Extract<BattleEvent, { type: 'play' }>[]) {
    const objs: Phaser.GameObjects.GameObject[] = [];
    sfx('reveal');
    const title = txt(this, 640, 150, 'REVELAÇÃO!', 40, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 7 }).setDepth(40);
    objs.push(title);
    const spacing = Math.min(78, 640 / Math.max(1, plays.length));
    plays.forEach((p, i) => {
      const x = 640 - ((plays.length - 1) * spacing) / 2 + i * spacing;
      const mine = this.side(p.player) === 0;
      const icon = makeMiniIcon(this, p.cardId, 0.8).setPosition(x, 250).setDepth(40).setScale(0, 0.8);
      objs.push(icon);
      this.tweens.add({ targets: icon, scaleX: 0.8, duration: 180, delay: 90 * i });
      objs.push(this.orderBadge(x - 24, 220, i + 1, mine ? COLORS.ki : COLORS.hp).setDepth(41));
      if (p.doubled) objs.push(txt(this, x + 24, 222, 'x2', 18, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }).setDepth(41));
    });
    objs.push(txt(this, 640, 300, 'Azul = você · Vermelho = oponente', 13, COLORS.textDim).setDepth(40));
    await wait(this, 900 + plays.length * 90);
    await tweenPromise(this, { targets: objs, alpha: 0, duration: 200 });
    objs.forEach((o) => o.destroy());
  }

  private orderBadge(x: number, y: number, n: number, color: number) {
    const c = this.add.container(x, y);
    c.add(this.add.circle(0, 0, 11, color).setStrokeStyle(2, COLORS.outline));
    c.add(centerInk(txt(this, 0, 0, String(n), 16, '#ffffff', { fontFamily: NUM_FONT }), 0, 0));
    return c;
  }

  /** Efeito no alvo quando um golpe acerta, escolhido pelo tipo de golpe. */
  private impactFx(target: Side, cardId: string, amount: number, blocked: number) {
    const x = CHAR_X[target];
    const flipX = target === 0;
    const at = (name: string, y = BODY_Y, scale = 2.5) => playFx(this, name, x, y, { scale, flipX });
    switch (cardId) {
      case 'golpe_basico':
      case 'pistol':
      case 'gatling':
        at('punch-hit', BODY_Y, 3);
        break;
      case 'black_flash':
        at('shadow-claw', BODY_Y, 3);
        at('crit-hit', BODY_Y, 2.5);
        break;
      case 'getsuga':
        at('sword-combo', BODY_Y, 2.5);
        break;
      case 'kunai':
        at('dagger-slash', BODY_Y, 3);
        break;
      case 'chidori':
        at('lightning-strike', FEET_Y, 2.2);
        break;
      case 'rasengan':
        at('whirlwind', FEET_Y, 3);
        break;
      case 'cero':
        at('fireball-impact', BODY_Y, 2.5);
        break;
      case 'genki_dama':
      case 'big_bang_attack':
        at('explosao_fogo', BODY_Y, 4.5);
        at('big-explosion', FEET_Y + 10, 2.2);
        break;
      case 'hollow_purple':
        at('void-explosion', FEET_Y + 10, 2.4);
        break;
      case 'kamehameha':
      case 'ki_blast':
      case 'red':
      case 'galick_gun':
        at('small-explosion', FEET_Y - 20, 3);
        break;
      default:
        at('hit-spark', BODY_Y, 2.5);
    }
    // Golpe pesado ganha a explosão de fogo por cima; golpe todo bloqueado só faz faísca.
    if (amount >= 15 && cardId !== 'genki_dama' && cardId !== 'big_bang_attack' && cardId !== 'hollow_purple') at('explosao_fogo', BODY_Y, 3);
    if (amount === 0 && blocked > 0) at('hit-spark', BODY_Y, 2);
  }

  /** Boogie Woogie: os dois trocam de lugar num piscar e voltam. */
  private async swapAnim() {
    const a = this.chars[0];
    const b = this.chars[1];
    if (!a || !b) return;
    this.cameras.main.flash(120, 255, 255, 255);
    a.setX(CHAR_X[1]);
    b.setX(CHAR_X[0]);
    await wait(this, 220);
    this.cameras.main.flash(120, 255, 255, 255);
    a.setX(CHAR_X[0]);
    b.setX(CHAR_X[1]);
  }

  /**
   * Evolução de carta: aparece no meio da tela, treme e pisca, "troca de pele" (vira de lado
   * e volta como a carta nova) e depois cai na mão de quem evoluiu.
   */
  private async evolveAnim(side: Side, from: string, into: string) {
    const x = 640;
    const y = 300;
    const glow = this.add.circle(x, y, 90, 0xffe28a, 0).setDepth(59);
    const card = makeCard(this, from).setPosition(x, y).setScale(0).setDepth(60);
    await tweenPromise(this, { targets: card, scale: 1.1, duration: 300, ease: 'Back.easeOut' });
    sfx('charge');
    // Tremida crescente com brilho pulsando por trás.
    this.tweens.add({ targets: glow, fillAlpha: 0.55, scale: 1.6, yoyo: true, repeat: 2, duration: 160 });
    for (let k = 0; k < 8; k++) {
      card.setX(x + (k % 2 ? 1 : -1) * (2 + k));
      await wait(this, 45);
    }
    card.setX(x);
    // Troca de pele.
    await tweenPromise(this, { targets: card, scaleX: 0, duration: 130, ease: 'Sine.easeIn' });
    card.destroy();
    this.cameras.main.flash(220, 255, 240, 200);
    sfx('combo');
    const next = makeCard(this, into).setPosition(x, y).setScale(0, 1.1).setDepth(60);
    await tweenPromise(this, { targets: next, scaleX: 1.1, duration: 160, ease: 'Sine.easeOut' });
    const ring = this.add.circle(x, y, 60, 0x000000, 0).setStrokeStyle(6, 0xffe28a).setDepth(58);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    const label = txt(this, x, y - 150, 'EVOLUIU!', 32, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 7 }).setDepth(61);
    await wait(this, 700);
    // Cai na mão (sua) ou vai para o lado do oponente.
    const target = side === 0 ? { x: 620, y: 650, scale: 0.45 } : { x: CHAR_X[1], y: BODY_Y - 60, scale: 0.2 };
    await Promise.all([
      tweenPromise(this, { targets: next, x: target.x, y: target.y, scale: target.scale, alpha: 0.2, duration: 450, ease: 'Quad.easeIn' }),
      tweenPromise(this, { targets: [label, glow], alpha: 0, duration: 300 }),
    ]);
    [next, label, glow].forEach((o) => o.destroy());
  }

  /**
   * Combo (Red + Blue → Hollow Purple): as duas cartas sobem dos cantos de baixo, se encontram
   * no centro, "trocam de pele" juntas e viram a carta do combo, que cai na mão de quem fez.
   */
  private async comboAnim(side: Side, cardId: string) {
    const combo = COMBOS.find((c) => c.creates === cardId);
    const [leftId, rightId] = combo ? combo.requires : ['red', 'blue'];
    const x = 640;
    const y = 300;
    const left = makeCard(this, leftId).setPosition(140, 820).setScale(0.8).setAngle(-12).setDepth(60);
    const right = makeCard(this, rightId).setPosition(1140, 820).setScale(0.8).setAngle(12).setDepth(60);
    sfx('charge');
    await Promise.all([
      tweenPromise(this, { targets: left, x: x - 90, y, angle: -6, duration: 520, ease: 'Cubic.easeOut' }),
      tweenPromise(this, { targets: right, x: x + 90, y, angle: 6, duration: 520, ease: 'Cubic.easeOut' }),
    ]);
    await wait(this, 180);
    // Encontro no centro.
    await tweenPromise(this, { targets: [left, right], x, angle: 0, duration: 220, ease: 'Quad.easeIn' });
    this.cameras.main.shake(160, 0.008);
    // Troca de pele: as duas viram de lado e volta a carta do combo.
    await tweenPromise(this, { targets: [left, right], scaleX: 0, duration: 130, ease: 'Sine.easeIn' });
    left.destroy();
    right.destroy();
    this.cameras.main.flash(260, 200, 120, 255);
    sfx('combo');
    const glow = this.add.circle(x, y, 100, 0xa040ff, 0.4).setDepth(59);
    const next = makeCard(this, cardId).setPosition(x, y).setScale(0, 1.1).setDepth(60);
    await tweenPromise(this, { targets: next, scaleX: 1.1, duration: 170, ease: 'Sine.easeOut' });
    const ring = this.add.circle(x, y, 60, 0x000000, 0).setStrokeStyle(6, 0xe9b8ff).setDepth(58);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 550, onComplete: () => ring.destroy() });
    const label = txt(this, x, y - 150, `${getCard(cardId).name.toUpperCase()}!`, 32, '#ffffff', {
      fontStyle: 'bold',
      stroke: '#6a2aa8',
      strokeThickness: 8,
    }).setDepth(61);
    const sub = txt(this, x, y + 150, 'chega na mão na próxima rodada', 16, '#e9b8ff', { stroke: '#0d0a14', strokeThickness: 4 }).setDepth(61);
    await wait(this, 800);
    const target = side === 0 ? { x: 620, y: 650, scale: 0.45 } : { x: CHAR_X[1], y: BODY_Y - 60, scale: 0.2 };
    await Promise.all([
      tweenPromise(this, { targets: next, x: target.x, y: target.y, scale: target.scale, alpha: 0.2, duration: 450, ease: 'Quad.easeIn' }),
      tweenPromise(this, { targets: [label, sub, glow], alpha: 0, duration: 300 }),
    ]);
    [next, label, sub, glow].forEach((o) => o.destroy());
  }

  /** Moeda estilo Legends of Runeterra: decide quem começa a partida. */
  private async maybeCoinFlip(view: BattleView) {
    const key = `${session.net.token}:coin`;
    if (view.turn !== 1 || view.phase !== 'planning' || BattleScene.coinShown.has(key)) return;
    BattleScene.coinShown.add(key);
    const names: Record<PlayerIndex, string> = { [view.you]: 'Você', [view.you === 0 ? 1 : 0]: view.opponent.name } as Record<PlayerIndex, string>;
    const winner = view.firstPlayer;
    this.animating = true;
    this.hand.setVisible(false);
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.6).setDepth(80);
    const coin = this.add.container(640, 330).setDepth(81);
    const g = this.add.graphics();
    g.fillStyle(0x7a4a10).fillCircle(0, 6, 92);
    g.fillStyle(COLORS.gold).fillCircle(0, 0, 92);
    g.fillStyle(COLORS.goldLight).fillCircle(0, 0, 78);
    g.lineStyle(4, 0xb8561a).strokeCircle(0, 0, 70);
    const face = txt(this, 0, 0, names[winner === 0 ? 1 : 0], 22, '#3a1a08', { fontStyle: 'bold', align: 'center', wordWrap: { width: 130 } });
    coin.add([g, face]);
    const flips = 9;
    for (let i = 0; i < flips; i++) {
      const d = 70 + i * 22;
      sfx('coin');
      await tweenPromise(this, { targets: coin, scaleX: 0, y: 330 - Math.sin(((i + 0.5) / flips) * Math.PI) * 140, duration: d, ease: 'Sine.easeIn' });
      // A face troca a cada meia volta; na última, para no nome de quem começa.
      face.setText(i === flips - 1 ? names[winner] : names[(i % 2) as PlayerIndex]);
      await tweenPromise(this, { targets: coin, scaleX: 1, duration: d, ease: 'Sine.easeOut' });
    }
    sfx('coinLand');
    this.cameras.main.shake(120, 0.004);
    const label = txt(this, 640, 470, `${names[winner]} começa!`, 34, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 7 }).setDepth(82);
    label.setScale(0.4);
    await tweenPromise(this, { targets: label, scale: 1, duration: 250, ease: 'Back.easeOut' });
    await wait(this, 700);
    await tweenPromise(this, { targets: [shade, coin, label], alpha: 0, duration: 250 });
    [shade, coin, label].forEach((o) => o.destroy());
    this.hand.setVisible(true);
    this.animating = false;
    if (this.view) this.render(session.lastView?.view ?? this.view);
  }

  private static coinShown = new Set<string>();

  private async bigShout(side: Side, text: string, color: number) {
    this.flashAura(side, color);
    const t = txt(this, CHAR_X[side], BODY_Y - 140, text, 30, '#ffffff', {
      fontStyle: 'bold',
      stroke: Phaser.Display.Color.ValueToColor(color).rgba,
      strokeThickness: 8,
    })
      .setDepth(45)
      .setScale(0.3);
    await tweenPromise(this, { targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    await wait(this, 450);
    await tweenPromise(this, { targets: t, alpha: 0, duration: 200 });
    t.destroy();
  }

  private flashAura(side: Side, color: number) {
    const ring = this.add.ellipse(CHAR_X[side], BODY_Y, 140, 200, color, 0.35).setDepth(2);
    this.tweens.add({ targets: ring, scale: 1.4, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
  }

  private hitAnim(side: Side, amount: number, blocked: number) {
    const c = this.chars[side];
    if (c) {
      const x0 = CHAR_X[side];
      this.tweens.add({ targets: c, x: x0 + (side === 0 ? -10 : 10), yoyo: true, duration: 50, repeat: 2, onComplete: () => c.setX(x0) });
      c.list.forEach((o) => o instanceof Phaser.GameObjects.Image && o.setTintFill(0xffffff));
      this.time.delayedCall(90, () => c.list.forEach((o) => o instanceof Phaser.GameObjects.Image && o.clearTint()));
    }
    const jitter = Phaser.Math.Between(-30, 30);
    if (amount > 0) floatText(this, CHAR_X[side] + jitter, BODY_Y - 40, `-${amount}`, '#ff5050', 32);
    if (blocked > 0) floatText(this, CHAR_X[side] + jitter + 50, BODY_Y - 10, `🛡${blocked}`, '#8fd0ff', 22);
    if (amount === 0 && blocked === 0) floatText(this, CHAR_X[side], BODY_Y - 40, '0', '#cccccc', 24);
  }

  /** Animação de cada poder. Só o efeito aparece, sem o personagem original. */
  private async attackAnim(from: Side, cardId: string, fast: boolean) {
    const dir = from === 0 ? 1 : -1;
    const sx = CHAR_X[from] + dir * 60;
    const tx = CHAR_X[from === 0 ? 1 : 0] - dir * 50;
    const y = BODY_Y;
    const dist = Math.abs(tx - sx);
    const depth = 30;
    /**
     * Feixe que sai de quem ataca e vai até o alvo. Criado já com o tamanho final e esticado com
     * scaleX (crescer a largura de 0 ignora a origem e fazia o feixe sair sempre para a direita).
     */
    const beam = (yy: number, length: number, thick: number, color: number, alpha = 1) =>
      this.add.rectangle(sx, yy, length, thick, color, alpha).setOrigin(from === 0 ? 0 : 1, 0.5).setScale(0, 1).setDepth(depth);

    switch (cardId) {
      case 'cero': {
        // Rajada vermelha (efeito genérico de energia).
        const orb = this.add.circle(sx, y, 30, 0xffd0d0).setDepth(depth + 1).setStrokeStyle(6, 0xe0203a);
        const glow = beam(y, dist + 40, 78, 0xff6070, 0.35);
        const ray = beam(y, dist + 40, 54, 0xe0203a);
        const core = beam(y, dist + 40, 18, 0xffffff);
        await tweenPromise(this, { targets: orb, scale: 1.8, duration: 200 });
        await tweenPromise(this, { targets: [glow, ray, core], scaleX: 1, duration: 220, ease: 'Cubic.easeOut' });
        this.cameras.main.shake(220, 0.012);
        await tweenPromise(this, { targets: [glow, ray, core, orb], alpha: 0, scaleY: 0.2, duration: 260 });
        [orb, glow, ray, core].forEach((o) => o.destroy());
        return;
      }
      case 'big_bang_attack':
      case 'kamehameha': {
        const big = cardId === 'big_bang_attack';
        const orb = this.add.circle(sx, y, big ? 40 : 32, 0xbfefff).setDepth(depth + 1).setStrokeStyle(6, 0x4fb8ff);
        const glow = beam(y, dist + 40, big ? 110 : 84, 0x8fd0ff, 0.35);
        const ray = beam(y, dist + 40, big ? 80 : 60, 0x4fb8ff);
        const core = beam(y, dist + 40, big ? 30 : 22, 0xffffff);
        await tweenPromise(this, { targets: orb, scale: 1.6, duration: 220 });
        await tweenPromise(this, { targets: [glow, ray, core], scaleX: 1, duration: 260, ease: 'Cubic.easeOut' });
        this.cameras.main.shake(big ? 380 : 220, big ? 0.02 : 0.01);
        await tweenPromise(this, { targets: [glow, ray, core, orb], alpha: 0, scaleY: 0.2, duration: 280 });
        [orb, glow, ray, core].forEach((o) => o.destroy());
        return;
      }
      case 'genki_dama': {
        const ball = this.add.circle(CHAR_X[from], 90, 44, 0xe8f8ff).setDepth(depth).setStrokeStyle(8, 0x6fd0ff);
        await tweenPromise(this, { targets: ball, scale: 2.6, duration: 450, ease: 'Sine.easeOut' });
        await tweenPromise(this, { targets: ball, x: tx, y, duration: 420, ease: 'Quad.easeIn' });
        this.cameras.main.flash(250, 220, 240, 255);
        this.cameras.main.shake(400, 0.02);
        await tweenPromise(this, { targets: ball, alpha: 0, scale: 4, duration: 250 });
        ball.destroy();
        return;
      }
      case 'getsuga': {
        const g = this.add.graphics().setDepth(depth).setPosition(sx, y);
        g.lineStyle(44, 0xc8323a).beginPath().arc(0, 0, 120, -1.1, 1.1).strokePath();
        g.lineStyle(26, 0x0d0a14).beginPath().arc(-8, 0, 120, -1.0, 1.0).strokePath();
        g.setScale(dir, 1);
        await tweenPromise(this, { targets: g, x: tx, duration: 300, ease: 'Quad.easeIn' });
        this.cameras.main.shake(180, 0.01);
        await tweenPromise(this, { targets: g, alpha: 0, scaleY: 1.4, duration: 160 });
        g.destroy();
        return;
      }
      case 'pistol': {
        const arm = beam(y, dist, 26, 0xf5c9a0).setStrokeStyle(3, 0x1a1420);
        const fist = this.add.circle(sx, y, 30, 0xf5c9a0).setDepth(depth + 1).setStrokeStyle(4, 0x1a1420);
        await Promise.all([
          tweenPromise(this, { targets: arm, scaleX: 1, duration: 170, ease: 'Quad.easeOut' }),
          tweenPromise(this, { targets: fist, x: tx, duration: 170, ease: 'Quad.easeOut' }),
        ]);
        await Promise.all([
          tweenPromise(this, { targets: arm, scaleX: 0, duration: 140 }),
          tweenPromise(this, { targets: fist, x: sx, duration: 140 }),
        ]);
        arm.destroy();
        fist.destroy();
        return;
      }
      case 'gatling': {
        const fists = Array.from({ length: fast ? 2 : 4 }, () => {
          const yy = y + Phaser.Math.Between(-60, 60);
          return this.add.circle(sx, yy, 26, 0xf5c9a0).setDepth(depth).setStrokeStyle(3, 0x1a1420);
        });
        await tweenPromise(this, { targets: fists, x: tx, duration: fast ? 90 : 140, delay: this.tweens.stagger(25, {}) });
        fists.forEach((f) => f.destroy());
        return;
      }
      case 'rasengan': {
        const ball = this.add.circle(sx, y, 38, 0x6fc8ff).setDepth(depth).setStrokeStyle(7, 0xffffff);
        const swirl = this.add.arc(sx, y, 24, 0, 270, false, 0xffffff, 0).setDepth(depth).setStrokeStyle(5, 0xffffff);
        this.tweens.add({ targets: swirl, angle: 720, duration: 400 });
        await tweenPromise(this, { targets: [ball, swirl], x: tx, duration: 360, ease: 'Quad.easeIn' });
        this.cameras.main.shake(150, 0.01);
        await tweenPromise(this, { targets: [ball, swirl], scale: 2.2, alpha: 0, duration: 200 });
        ball.destroy();
        swirl.destroy();
        return;
      }
      case 'black_flash': {
        const c = this.chars[from];
        if (c) await tweenPromise(this, { targets: c, x: CHAR_X[from] + dir * 140, duration: 120, ease: 'Quad.easeIn' });
        const g = this.add.graphics().setDepth(depth);
        for (let k = 0; k < 3; k++) {
          g.clear();
          for (const [w, color] of [[9, 0x0d0a14], [4, 0xff2030]] as const) {
            g.lineStyle(w, color);
            g.beginPath();
            g.moveTo(tx - dir * 60, y - 70);
            for (let s2 = 1; s2 <= 6; s2++) g.lineTo(tx - dir * 60 + dir * s2 * 20 + Phaser.Math.Between(-12, 12), y - 70 + s2 * 24);
            g.strokePath();
          }
          if (k === 0) this.cameras.main.flash(140, 255, 40, 60);
          await wait(this, 70);
        }
        this.cameras.main.shake(220, 0.015);
        g.destroy();
        if (c) await tweenPromise(this, { targets: c, x: CHAR_X[from], duration: 160 });
        return;
      }
      case 'kunai': {
        // Lâmina arremessada girando.
        const blade = this.add.triangle(sx, y, 0, 0, 46, 9, 0, 18, 0xb8c0d0).setDepth(depth).setStrokeStyle(3, 0x1a1420);
        blade.setScale(dir, 1);
        this.tweens.add({ targets: blade, angle: 720 * dir, duration: 260 });
        await tweenPromise(this, { targets: blade, x: tx, duration: 260, ease: 'Quad.easeIn' });
        blade.destroy();
        return;
      }
      case 'ki_blast': {
        const orb = this.add.circle(sx, y + Phaser.Math.Between(-20, 20), 18, 0x8fe0ff).setDepth(depth).setStrokeStyle(4, 0xffffff);
        await tweenPromise(this, { targets: orb, x: tx, duration: fast ? 140 : 220, ease: 'Quad.easeIn' });
        await tweenPromise(this, { targets: orb, scale: 2, alpha: 0, duration: 120 });
        orb.destroy();
        return;
      }
      case 'red': {
        const orb = this.add.circle(sx, y, 30, 0xff3040).setDepth(depth).setStrokeStyle(6, 0xffd0d0);
        await tweenPromise(this, { targets: orb, scale: 1.5, duration: 160 });
        await tweenPromise(this, { targets: orb, x: tx, duration: 220, ease: 'Quad.easeIn' });
        const target = this.chars[from === 0 ? 1 : 0];
        if (target) this.tweens.add({ targets: target, x: target.x + dir * 30, yoyo: true, duration: 120 });
        this.cameras.main.shake(160, 0.01);
        await tweenPromise(this, { targets: orb, scale: 3, alpha: 0, duration: 200 });
        orb.destroy();
        return;
      }
      case 'blue': {
        // Atração: a esfera aparece no oponente e puxa partículas para dentro.
        const orb = this.add.circle(tx, y, 18, 0x2f7fff).setDepth(depth).setStrokeStyle(6, 0xbfe0ff);
        const bits = Array.from({ length: 8 }, (_, k) => {
          const a = (k / 8) * Math.PI * 2;
          return this.add.rectangle(tx + Math.cos(a) * 90, y + Math.sin(a) * 90, 6, 6, 0x8fd0ff).setDepth(depth);
        });
        await Promise.all([
          tweenPromise(this, { targets: orb, scale: 2.4, duration: 450 }),
          tweenPromise(this, { targets: bits, x: tx, y, duration: 450, ease: 'Quad.easeIn' }),
        ]);
        await tweenPromise(this, { targets: [orb, ...bits], alpha: 0, duration: 180 });
        [orb, ...bits].forEach((o) => o.destroy());
        return;
      }
      case 'hollow_purple': {
        const ball = this.add.circle(sx, y - 20, 56, 0x9a30ff).setDepth(depth + 1).setStrokeStyle(12, 0xe9b8ff);
        const core = this.add.circle(sx, y - 20, 26, 0xffffff).setDepth(depth + 1);
        await tweenPromise(this, { targets: [ball, core], scale: 1.6, duration: 300 });
        const trail = beam(y - 20, Math.abs(tx + dir * 200 - sx), 160, 0x6a2aa8, 0.5);
        await Promise.all([
          tweenPromise(this, { targets: [ball, core], x: tx + dir * 200, duration: 420, ease: 'Quad.easeIn' }),
          tweenPromise(this, { targets: trail, scaleX: 1, duration: 420, ease: 'Quad.easeIn' }),
        ]);
        this.cameras.main.flash(300, 210, 150, 255);
        this.cameras.main.shake(450, 0.025);
        await tweenPromise(this, { targets: [ball, core, trail], alpha: 0, duration: 300 });
        [ball, core, trail].forEach((o) => o.destroy());
        return;
      }
      case 'chidori': {
        const g = this.add.graphics().setDepth(depth);
        for (let k = 0; k < 3; k++) {
          g.clear();
          g.lineStyle(10, 0xe0f4ff);
          g.beginPath();
          g.moveTo(sx, y);
          const steps = 8;
          for (let s = 1; s <= steps; s++) g.lineTo(sx + ((tx - sx) * s) / steps, y + (s === steps ? 0 : Phaser.Math.Between(-30, 30)));
          g.strokePath();
          await wait(this, 70);
        }
        g.destroy();
        return;
      }
      default: {
        // Golpe corpo a corpo: avança e volta.
        const c = this.chars[from];
        if (!c) return;
        const x0 = CHAR_X[from];
        await tweenPromise(this, { targets: c, x: x0 + dir * 120, duration: 140, ease: 'Quad.easeIn' });
        await tweenPromise(this, { targets: c, x: x0, duration: 160 });
      }
    }
  }

  private showGameOver(view: BattleView) {
    if (this.ended) return;
    this.ended = true;
    session.net.token = null;
    const won = view.winner === view.you;
    sfx(view.winner === 'draw' ? 'confirm' : won ? 'victory' : 'defeat');
    const label = view.winner === 'draw' ? 'Empate!' : won ? 'Vitória!' : 'Derrota…';
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.75).setDepth(90).setInteractive();
    const t = txt(this, 640, 280, label, 72, won ? '#ffe28a' : '#ff9090', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 10 }).setDepth(91);
    t.setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.easeOut' });
    makeButton(this, 640, 420, 300, 60, 'Voltar ao guarda-roupa', () => this.scene.start('Wardrobe'), COLORS.gold, 22).setDepth(92);
    void shade;
  }
}
