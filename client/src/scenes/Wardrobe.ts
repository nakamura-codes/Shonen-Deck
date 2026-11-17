import Phaser from 'phaser';
import { OUTFIT_ITEMS, OUTFIT_SLOTS, SLOT_LABELS, buildDeck, getItem, type OutfitSlot, type ServerMessage } from '@oficina/shared';
import { session } from '../session.ts';
import { COLORS, drawArena, makeButton, makeCard, makeCharacter, makeItemIcon, makeItemTile, makeMiniIcon, txt } from '../ui.ts';

/** Inventário: vestir e tirar peças. As peças vestidas definem o baralho. */
export class WardrobeScene extends Phaser.Scene {
  private preview?: Phaser.GameObjects.Container;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private tooltip?: Phaser.GameObjects.Container;
  private deckLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Wardrobe');
  }

  create() {
    drawArena(this);
    this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.5);

    txt(this, 640, 40, 'Inventário', 40, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 6 });

    const g = this.add.graphics();
    g.fillStyle(COLORS.outline).fillEllipse(220, 540, 240, 54);
    g.fillStyle(0x3a2f55).fillEllipse(220, 534, 230, 46);
    txt(this, 220, 110, session.name, 26, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 });

    this.deckLabel = txt(this, 220, 590, '', 16, COLORS.textDim);
    makeButton(this, 760, 650, 260, 60, 'Procurar oponente', () => this.go(false), COLORS.gold, 22);
    makeButton(this, 1040, 650, 240, 60, 'Treinar com bot', () => this.go(true), 0x7fc8a9, 22);
    makeButton(this, 220, 650, 220, 40, 'Novo personagem', () => {
      session.reset();
      this.scene.start('Create');
    }, 0xb0a0c8, 16);

    this.refresh();

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
    session.save();
    this.scene.start('Lobby', { vsBot });
  }

  private refresh() {
    this.preview?.destroy();
    this.preview = makeCharacter(this, session.outfit, 5).setPosition(220, 540);
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.hideTooltip();

    // Peças vestidas.
    this.dynamic.push(txt(this, 460, 92, 'Vestindo', 20, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5));
    OUTFIT_SLOTS.forEach((slot, i) => this.drawEquipped(slot, 460, 110 + i * 84));

    // Peças guardadas.
    const stored = OUTFIT_ITEMS.filter((it) => session.outfit[it.slot] !== it.id);
    this.dynamic.push(txt(this, 460, 300, 'Guardado no inventário', 20, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5));
    this.dynamic.push(txt(this, 1240, 300, 'Clique para vestir', 14, COLORS.textDim).setOrigin(1, 0.5));
    stored.forEach((item, i) => {
      const tile = makeItemTile(this, item.id, {
        width: 108,
        tag: SLOT_LABELS[item.slot],
        onClick: () => this.equip(item.slot, item.id),
        onHover: (cardId, x, y) => this.showTooltip(cardId, x, y),
      }).setPosition(513 + (i % 6) * 112, 388 + Math.floor(i / 6) * 156);
      this.dynamic.push(tile);
    });

    const deck = buildDeck(session.outfit);
    this.deckLabel.setText(`Baralho: ${deck.length} cartas (8 básicas + ${deck.length - 8} das roupas)`);
  }

  private drawEquipped(slot: OutfitSlot, x: number, y: number) {
    const item = getItem(session.outfit[slot]);
    const w = 780;
    const h = 76;
    const mid = y + h / 2;
    const g = this.add.graphics();
    g.fillStyle(COLORS.outline).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 10);
    g.fillStyle(COLORS.panel).fillRoundedRect(x, y, w, h, 8);
    g.fillStyle(item ? 0x1f5bb8 : 0x2a2238).fillRoundedRect(x + 8, y + 8, 110, h - 16, 6);
    this.dynamic.push(g);
    this.dynamic.push(txt(this, x + 140, y + 20, SLOT_LABELS[slot], 14, COLORS.textDim).setOrigin(0, 0.5));
    if (!item) {
      this.dynamic.push(txt(this, x + 63, mid, 'vazio', 14, COLORS.textDim));
      this.dynamic.push(txt(this, x + 140, y + 48, 'Nada vestido. Escolha uma peça guardada abaixo.', 16, COLORS.textDim).setOrigin(0, 0.5));
      return;
    }
    this.dynamic.push(makeItemIcon(this, item.id, 100, 54).setPosition(x + 63, mid));
    this.dynamic.push(txt(this, x + 140, y + 48, item.name, 20, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5));
    item.cards.forEach((cardId, i) => {
      const cx = x + 420 + i * 70;
      const icon = makeMiniIcon(this, cardId, 0.55).setPosition(cx, mid);
      const zone = this.add.zone(cx, mid, 50, 50).setInteractive();
      zone.on('pointerover', () => this.showTooltip(cardId, cx, mid));
      zone.on('pointerout', () => this.hideTooltip());
      this.dynamic.push(icon, zone);
    });
    this.dynamic.push(makeButton(this, x + w - 70, mid, 100, 40, 'Tirar', () => this.equip(slot, null), 0xb0a0c8, 16));
  }

  private equip(slot: OutfitSlot, id: string | null) {
    session.outfit = { ...session.outfit, [slot]: id };
    session.save();
    this.refresh();
  }

  private showTooltip(cardId: string | null, x: number, y: number) {
    this.hideTooltip();
    if (!cardId) return;
    this.tooltip = makeCard(this, cardId)
      .setDepth(100)
      .setPosition(Phaser.Math.Clamp(x, 100, 1180), y > 360 ? y - 150 : y + 140);
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = undefined;
  }
}
