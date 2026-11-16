import Phaser from 'phaser';
import {
  getCard,
  type BattleEvent,
  type BattleView,
  type FighterPublicView,
  type PlayerIndex,
  type PowerId,
  type ServerMessage,
} from '@oficina/shared';
import { session } from '../session.ts';
import {
  CARD_H,
  COLORS,
  drawArena,
  floatText,
  makeButton,
  makeCard,
  makeCardBack,
  makeCharacter,
  makeMiniIcon,
  tweenPromise,
  txt,
  wait,
  type Button,
} from '../ui.ts';

type Side = 0 | 1; // 0 = eu (esquerda), 1 = oponente (direita)

const CHAR_X: Record<Side, number> = { 0: 260, 1: 1020 };
const FEET_Y = 420;
const CHAR_SCALE = 3;
const BODY_Y = FEET_Y - 100;

const POWER_CARD: Record<PowerId, string> = { bankai: 'bankai', gearSecond: 'gear_second', domain: 'domain_expansion' };

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

  constructor() {
    super('Battle');
  }

  create() {
    this.view = null;
    this.animating = false;
    this.ended = false;
    this.chars = {};
    this.hpBars = {};

    drawArena(this);
    this.hud = this.add.container(0, 0).setDepth(5);
    this.hand = this.add.container(0, 0).setDepth(20);

    const top = this.add.graphics().setDepth(4);
    top.fillStyle(COLORS.outline, 0.85).fillRect(0, 0, 1280, 52);
    top.fillStyle(COLORS.gold).fillRect(0, 52, 1280, 3);
    this.turnText = txt(this, 90, 27, 'Turno 1', 22, '#ffe28a', { fontStyle: 'bold' }).setDepth(6);
    this.timerText = txt(this, 640, 27, '', 30, '#ffffff', { fontStyle: 'bold' }).setDepth(6);
    this.banner = txt(this, 640, 82, '', 18, '#ffb0b0', { stroke: '#0d0a14', strokeThickness: 4 }).setDepth(30);

    this.readyBtn = makeButton(this, 1165, 560, 190, 60, 'Confirmar', () => this.sendReady(), COLORS.gold, 22).setDepth(25);
    this.undoBtn = makeButton(this, 1165, 636, 190, 46, 'Desfazer', () => this.sendUndo(), 0xb0a0c8, 18).setDepth(25);

    // Ki
    const ki = this.add.graphics().setDepth(4);
    ki.fillStyle(COLORS.outline).fillCircle(90, 590, 52);
    ki.fillStyle(0x1f4f8a).fillCircle(90, 590, 47);
    ki.fillStyle(COLORS.ki).fillCircle(90, 586, 42);
    ki.fillStyle(0x8fd0ff, 0.8).fillCircle(76, 570, 9);

    const off = session.net.on((msg) => this.onMessage(msg));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    if (session.lastView) {
      this.deadline = session.lastView.deadline;
      this.render(session.lastView.view);
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
    floatText(this, 640, 400, s, '#ffb0b0', 20);
  }

  private sendReady() {
    if (this.animating || !this.view || this.view.me.ready) return;
    session.net.send({ t: 'ready' });
  }

  private sendUndo() {
    if (this.animating || !this.view || this.view.me.ready) return;
    session.net.send({ t: 'undo' });
  }

  // ───────────────────────── Desenho do estado ─────────────────────────

  private render(view: BattleView) {
    this.view = view;
    this.turnText.setText(`Turno ${view.turn}`);
    if (this.banner.text === 'Esperando o servidor…') this.banner.setText('');
    this.hud.removeAll(true);
    this.hand.removeAll(true);

    this.ensureChar(0, view.me);
    this.ensureChar(1, view.opponent);
    this.drawSide(0, view.me);
    this.drawSide(1, view.opponent);
    this.drawQueues(view);
    this.drawHand(view);

    this.hud.add(txt(this, 90, 588, String(view.me.ki), 40, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }));
    this.hud.add(txt(this, 90, 625, 'Ki', 14, '#d8ecff'));
    this.hud.add(txt(this, 90, 670, `Compra ${view.me.drawCount}  ·  Descarte ${view.me.discardCount}`, 13, COLORS.textDim));

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
      bar = { g: this.add.graphics().setDepth(6), t: txt(this, CHAR_X[side], 449, '', 15, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }).setDepth(7), max };
      this.hpBars[side] = bar;
    }
    bar.max = max;
    const x = CHAR_X[side] - 100;
    const w = 200;
    const ratio = Phaser.Math.Clamp(hp / max, 0, 1);
    bar.g.clear();
    bar.g.fillStyle(COLORS.outline).fillRect(x - 3, 437, w + 6, 24);
    bar.g.fillStyle(0x3a1a22).fillRect(x, 440, w, 18);
    bar.g.fillStyle(COLORS.hp).fillRect(x, 440, Math.round(w * ratio), 18);
    bar.g.fillStyle(0xff8a8a).fillRect(x, 440, Math.round(w * ratio), 4);
    bar.t.setText(`${Math.max(0, hp)}/${max}`);
  }

  private drawSide(side: Side, f: FighterPublicView) {
    const x = CHAR_X[side];
    this.drawHpBar(side, f.hp, f.maxHp);

    if (f.block > 0) {
      const g = this.add.graphics();
      const bx = x - 122;
      g.fillStyle(COLORS.outline).fillCircle(bx, 449, 19);
      g.fillStyle(COLORS.block).fillCircle(bx, 449, 16);
      this.hud.add(g);
      this.hud.add(txt(this, bx, 448, String(f.block), 16, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 3 }));
    }

    const chips: [string, string][] = [];
    const str = f.strength + f.tempStrength;
    if (str) chips.push([`Força ${str}`, '#ffb070']);
    if (f.weak) chips.push([`Fraco ${f.weak}`, '#b0e070']);
    if (f.vulnerable) chips.push([`Vulnerável ${f.vulnerable}`, '#ff8080']);
    chips.forEach(([label, color], i) => {
      this.hud.add(txt(this, x - (chips.length - 1) * 55 + i * 110, 146, label, 14, color, { stroke: '#0d0a14', strokeThickness: 4 }));
    });

    // Poderes ativos.
    f.powers.forEach((p, i) => {
      const icon = makeMiniIcon(this, POWER_CARD[p], 0.42).setPosition(x + 128 + i * 34, 449);
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
    // Fila do oponente: escondida, a não ser com Sharingan.
    const oq = view.opponent.queue;
    const oppCount = oq ? oq.length : view.opponent.queueCount;
    this.hud.add(
      txt(this, 640, 112, oq ? 'Sharingan: você vê as cartas do oponente!' : `Oponente escolheu ${oppCount} carta${oppCount === 1 ? '' : 's'}`, 15, oq ? '#ff8080' : COLORS.textDim),
    );
    for (let i = 0; i < oppCount; i++) {
      const x = 640 - (oppCount - 1) * 34 + i * 68;
      const obj = oq ? makeMiniIcon(this, oq[i].card.id, 0.75) : makeCardBack(this, 0.36);
      obj.setPosition(x, 170);
      this.hud.add(obj);
    }

    // Minha fila.
    const mq = view.me.queue;
    this.hud.add(txt(this, 640, 262, mq.length ? 'Sua jogada' : 'Clique nas cartas da mão para jogar', 15, COLORS.textDim));
    mq.forEach((q, i) => {
      const x = 640 - (mq.length - 1) * 40 + i * 80;
      this.hud.add(makeMiniIcon(this, q.card.id, 0.85).setPosition(x, 330));
      if (q.doubled) this.hud.add(txt(this, x + 24, 300, 'x2', 18, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }));
    });
    if (view.me.cloneNext) this.hud.add(txt(this, 640, 390, 'Kage Bunshin: a próxima carta acontece 2 vezes', 14, '#ffe28a'));
  }

  private drawHand(view: BattleView) {
    const cards = view.me.hand;
    const n = cards.length;
    const spacing = Math.min(166, 860 / Math.max(1, n));
    const y = 720 - CARD_H / 2 - 8;
    const canAct = view.phase === 'planning' && !view.me.ready && !this.animating;
    cards.forEach((c, i) => {
      const def = getCard(c.id);
      const x = 620 - ((n - 1) * spacing) / 2 + i * spacing;
      const card = makeCard(this, c.id).setPosition(x, y);
      const playable = canAct && def.cost <= view.me.ki;
      card.setAlpha(playable ? 1 : 0.55);
      card.setInteractive({ useHandCursor: playable });
      card.on('pointerover', () => {
        this.hand.bringToTop(card);
        this.tweens.add({ targets: card, y: y - 40, scale: 1.08, duration: 120 });
      });
      card.on('pointerout', () => this.tweens.add({ targets: card, y, scale: 1, duration: 120 }));
      card.on('pointerdown', () => {
        if (!playable) {
          if (canAct) this.toast('Ki insuficiente.');
          return;
        }
        session.net.send({ t: 'play', uid: c.uid });
      });
      this.hand.add(card);
    });
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
    const max: Record<Side, number> = { 0: this.view.me.maxHp, 1: this.view.opponent.maxHp };

    this.hud.removeAll(true);
    const plays = events.filter((e): e is Extract<BattleEvent, { type: 'play' }> => e.type === 'play');
    if (plays.length) await this.showReveal(plays);

    let lastCard = '';
    for (const ev of events) {
      switch (ev.type) {
        case 'damage': {
          const fast = lastCard === `${ev.source}:${ev.cardId}`;
          await this.attackAnim(this.side(ev.source), ev.cardId, fast);
          const t = this.side(ev.target);
          hp[t] -= ev.amount;
          this.drawHpBar(t, hp[t], max[t]);
          this.hitAnim(t, ev.amount, ev.blocked);
          await wait(this, fast ? 60 : 220);
          lastCard = `${ev.source}:${ev.cardId}`;
          break;
        }
        case 'block':
          this.flashAura(this.side(ev.player), COLORS.block);
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 60, `+${ev.amount} Bloqueio`, '#8fd0ff', 22);
          await wait(this, 320);
          break;
        case 'status': {
          const label = { strength: `Força +${ev.amount}`, weak: 'Fraco!', vulnerable: 'Vulnerável!' }[ev.status];
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 90, label, ev.status === 'strength' ? '#ffb070' : '#d0a0ff', 22);
          await wait(this, 320);
          break;
        }
        case 'hpLoss': {
          const s = this.side(ev.player);
          hp[s] -= ev.amount;
          this.drawHpBar(s, hp[s], max[s]);
          floatText(this, CHAR_X[s], BODY_Y - 30, `-${ev.amount} (${ev.reason})`, '#e080ff', 20);
          await wait(this, 350);
          break;
        }
        case 'power':
          await this.bigShout(this.side(ev.player), getCard(POWER_CARD[ev.power]).name.toUpperCase() + '!', 0xb070ff);
          break;
        case 'chargeStart':
          this.flashAura(this.side(ev.player), 0x6fd0ff);
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 110, `Carregando ${getCard(ev.cardId).name}…`, '#8fd0ff', 20);
          await wait(this, 600);
          break;
        case 'chargeFire':
          await this.bigShout(this.side(ev.player), getCard(ev.cardId).name.toUpperCase() + '!', 0x6fd0ff);
          lastCard = '';
          break;
        case 'chargeCancel':
          floatText(this, CHAR_X[this.side(ev.player)], BODY_Y - 110, `${getCard(ev.cardId).name} cancelada!`, '#ff8080', 22);
          await wait(this, 700);
          break;
        case 'gameOver':
        case 'play':
          break;
      }
      if (ev.type !== 'damage') lastCard = '';
    }

    await wait(this, 300);
    this.animating = false;
    // Usa a visão mais nova (pode ter chegado um "state" durante a animação).
    const latest = session.lastView?.view ?? finalView;
    this.render(latest.turn >= finalView.turn ? latest : finalView);
  }

  private async showReveal(plays: Extract<BattleEvent, { type: 'play' }>[]) {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const title = txt(this, 640, 150, 'REVELAÇÃO!', 40, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 7 }).setDepth(40);
    objs.push(title);
    for (const side of [0, 1] as Side[]) {
      const mine = plays.filter((p) => this.side(p.player) === side);
      mine.forEach((p, i) => {
        const x = (side === 0 ? 470 : 810) + (side === 0 ? -1 : 1) * i * 0 + (i - (mine.length - 1) / 2) * 70 * (side === 0 ? 1 : 1);
        const icon = makeMiniIcon(this, p.cardId, 0.8).setPosition(x, 250).setDepth(40).setScale(0, 0.8);
        objs.push(icon);
        this.tweens.add({ targets: icon, scaleX: 0.8, duration: 180, delay: 80 * i });
        if (p.doubled) objs.push(txt(this, x + 24, 222, 'x2', 18, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 }).setDepth(41));
      });
    }
    await wait(this, 1100);
    await tweenPromise(this, { targets: objs, alpha: 0, duration: 200 });
    objs.forEach((o) => o.destroy());
  }

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

    switch (cardId) {
      case 'kamehameha': {
        const orb = this.add.circle(sx, y, 18, 0xbfefff).setDepth(depth);
        const beam = this.add.rectangle(sx, y, 0, 34, 0x4fb8ff).setOrigin(from === 0 ? 0 : 1, 0.5).setDepth(depth);
        const core = this.add.rectangle(sx, y, 0, 14, 0xffffff).setOrigin(from === 0 ? 0 : 1, 0.5).setDepth(depth);
        await tweenPromise(this, { targets: orb, scale: 1.6, duration: 200 });
        await tweenPromise(this, { targets: [beam, core], width: dist, duration: 240, ease: 'Cubic.easeOut' });
        this.cameras.main.shake(200, 0.008);
        await tweenPromise(this, { targets: [beam, core, orb], alpha: 0, scaleY: 0.2, duration: 260 });
        [orb, beam, core].forEach((o) => o.destroy());
        return;
      }
      case 'genki_dama': {
        const ball = this.add.circle(CHAR_X[from], 90, 30, 0xe8f8ff).setDepth(depth).setStrokeStyle(8, 0x6fd0ff);
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
        g.lineStyle(26, 0xc8323a).beginPath().arc(0, 0, 70, -1.1, 1.1).strokePath();
        g.lineStyle(16, 0x0d0a14).beginPath().arc(-4, 0, 70, -1.0, 1.0).strokePath();
        g.setScale(dir, 1);
        await tweenPromise(this, { targets: g, x: tx, duration: 300, ease: 'Quad.easeIn' });
        this.cameras.main.shake(180, 0.01);
        await tweenPromise(this, { targets: g, alpha: 0, scaleY: 1.4, duration: 160 });
        g.destroy();
        return;
      }
      case 'pistol': {
        const arm = this.add.rectangle(sx, y, 0, 16, 0xf5c9a0).setOrigin(from === 0 ? 0 : 1, 0.5).setDepth(depth).setStrokeStyle(3, 0x1a1420);
        const fist = this.add.circle(sx, y, 18, 0xf5c9a0).setDepth(depth).setStrokeStyle(3, 0x1a1420);
        await Promise.all([
          tweenPromise(this, { targets: arm, width: dist, duration: 170, ease: 'Quad.easeOut' }),
          tweenPromise(this, { targets: fist, x: tx, duration: 170, ease: 'Quad.easeOut' }),
        ]);
        await Promise.all([
          tweenPromise(this, { targets: arm, width: 0, duration: 140 }),
          tweenPromise(this, { targets: fist, x: sx, duration: 140 }),
        ]);
        arm.destroy();
        fist.destroy();
        return;
      }
      case 'gatling': {
        const fists = Array.from({ length: fast ? 2 : 4 }, () => {
          const yy = y + Phaser.Math.Between(-60, 60);
          return this.add.circle(sx, yy, 15, 0xf5c9a0).setDepth(depth).setStrokeStyle(3, 0x1a1420);
        });
        await tweenPromise(this, { targets: fists, x: tx, duration: fast ? 90 : 140, delay: this.tweens.stagger(25, {}) });
        fists.forEach((f) => f.destroy());
        return;
      }
      case 'rasengan': {
        const ball = this.add.circle(sx, y, 22, 0x6fc8ff).setDepth(depth).setStrokeStyle(5, 0xffffff);
        const swirl = this.add.arc(sx, y, 14, 0, 270, false, 0xffffff, 0).setDepth(depth).setStrokeStyle(3, 0xffffff);
        this.tweens.add({ targets: swirl, angle: 720, duration: 400 });
        await tweenPromise(this, { targets: [ball, swirl], x: tx, duration: 360, ease: 'Quad.easeIn' });
        this.cameras.main.shake(150, 0.01);
        await tweenPromise(this, { targets: [ball, swirl], scale: 2.2, alpha: 0, duration: 200 });
        ball.destroy();
        swirl.destroy();
        return;
      }
      case 'chidori': {
        const g = this.add.graphics().setDepth(depth);
        for (let k = 0; k < 3; k++) {
          g.clear();
          g.lineStyle(5, 0xe0f4ff);
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
    const label = view.winner === 'draw' ? 'Empate!' : won ? 'Vitória!' : 'Derrota…';
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.75).setDepth(90).setInteractive();
    const t = txt(this, 640, 280, label, 72, won ? '#ffe28a' : '#ff9090', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 10 }).setDepth(91);
    t.setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.easeOut' });
    makeButton(this, 640, 420, 300, 60, 'Voltar ao guarda-roupa', () => this.scene.start('Wardrobe'), COLORS.gold, 22).setDepth(92);
    void shade;
  }
}
