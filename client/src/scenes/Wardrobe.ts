import Phaser from 'phaser';
import {
  OUTFIT_SLOTS,
  SLOT_LABELS,
  buildDeck,
  getCard,
  getItem,
  itemsForSlot,
  type OutfitSlot,
  type ServerMessage,
} from '@oficina/shared';
import { session } from '../session.ts';
import { COLORS, drawArena, makeButton, makeCard, makeCharacter, makeMiniIcon, txt } from '../ui.ts';

/** Tela do guarda-roupa: escolher roupas = escolher as cartas do baralho. */
export class WardrobeScene extends Phaser.Scene {
  private preview?: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private deckLabel?: Phaser.GameObjects.Text;
  private tooltip?: Phaser.GameObjects.Container;

  constructor() {
    super('Wardrobe');
  }

  create() {
    drawArena(this);
    this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.45);

    txt(this, 640, 44, 'Guarda-Roupa', 40, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 6 });
    txt(this, 640, 84, 'Cada peça de roupa coloca 2 poderes no seu baralho.', 18, COLORS.textDim);

    // Pedestal + personagem.
    const g = this.add.graphics();
    g.fillStyle(COLORS.outline).fillEllipse(300, 520, 260, 60);
    g.fillStyle(0x3a2f55).fillEllipse(300, 514, 250, 52);
    this.refreshPreview();

    // Nome.
    txt(this, 300, 590, 'Seu nome', 16, COLORS.textDim);
    const input = this.add.dom(300, 625, 'input').setOrigin(0.5);
    const el = input.node as HTMLInputElement;
    el.className = 'name-input';
    el.maxLength = 16;
    el.value = session.name;
    el.addEventListener('input', () => {
      session.name = el.value.trim() || session.name;
      session.savePrefs();
    });

    this.drawSlots();

    this.deckLabel = txt(this, 870, 560, '', 18, COLORS.textDim);
    this.updateDeckLabel();

    makeButton(this, 760, 630, 250, 60, 'Procurar oponente', () => this.go(false), COLORS.gold, 22);
    makeButton(this, 1030, 630, 250, 60, 'Treinar com bot', () => this.go(true), 0x7fc8a9, 22);

    // Se a página recarregou no meio de uma partida, o servidor manda "match" e voltamos para ela.
    const off = session.net.on((msg: ServerMessage) => {
      if (msg.t === 'match') {
        session.match = { you: msg.you, opponentName: msg.opponentName };
        this.scene.start('Battle');
      } else if (msg.t === 'error' && msg.message === 'Partida não encontrada.') {
        session.net.token = null;
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private go(vsBot: boolean) {
    session.savePrefs();
    this.scene.start('Lobby', { vsBot });
  }

  private refreshPreview() {
    this.preview?.destroy();
    this.preview = makeCharacter(this, session.outfit, 9).setPosition(300, 525);
    this.tweens.add({ targets: this.preview, y: 519, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
  }

  private drawSlots() {
    for (const o of this.rows) o.destroy();
    this.rows = [];
    const x0 = 560;
    OUTFIT_SLOTS.forEach((slot, i) => {
      const y = 150 + i * 96;
      const item = getItem(session.outfit[slot])!;
      const panel = this.add.graphics();
      panel.fillStyle(COLORS.outline).fillRoundedRect(x0 - 3, y - 3, 626, 86, 10);
      panel.fillStyle(COLORS.panel).fillRoundedRect(x0, y, 620, 80, 8);
      this.rows.push(panel);
      this.rows.push(txt(this, x0 + 70, y + 22, SLOT_LABELS[slot], 15, COLORS.textDim));
      this.rows.push(txt(this, x0 + 70, y + 50, item.name, 19, '#ffffff', { fontStyle: 'bold' }));
      this.rows.push(makeButton(this, x0 + 175, y + 40, 40, 40, '<', () => this.cycle(slot, -1), COLORS.gold, 22));
      this.rows.push(makeButton(this, x0 + 585, y + 40, 40, 40, '>', () => this.cycle(slot, 1), COLORS.gold, 22));
      item.cards.forEach((cardId, k) => {
        const cx = x0 + 250 + k * 165;
        const icon = makeMiniIcon(this, cardId, 0.85).setPosition(cx, y + 40);
        const name = txt(this, cx + 38, y + 40, getCard(cardId).name, 14, '#ffffff', {
          wordWrap: { width: 100 },
        }).setOrigin(0, 0.5);
        const hit = this.add.zone(cx + 40, y + 40, 160, 80).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => this.showTooltip(cardId, cx + 40, y));
        hit.on('pointerout', () => this.hideTooltip());
        this.rows.push(icon, name, hit);
      });
    });
  }

  private showTooltip(cardId: string, x: number, y: number) {
    this.hideTooltip();
    const card = makeCard(this, cardId).setDepth(100);
    card.setPosition(Phaser.Math.Clamp(x, 100, 1180), y > 360 ? y - 130 : y + 200);
    this.tooltip = card;
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = undefined;
  }

  private cycle(slot: OutfitSlot, dir: number) {
    const items = itemsForSlot(slot);
    const idx = items.findIndex((i) => i.id === session.outfit[slot]);
    session.outfit = { ...session.outfit, [slot]: items[(idx + dir + items.length) % items.length].id };
    session.savePrefs();
    this.hideTooltip();
    this.refreshPreview();
    this.drawSlots();
    this.updateDeckLabel();
  }

  private updateDeckLabel() {
    const deck = buildDeck(session.outfit);
    this.deckLabel?.setText(`Baralho: ${deck.length} cartas (8 básicas + 8 das roupas)`);
  }
}
