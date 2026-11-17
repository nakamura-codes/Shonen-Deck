import Phaser from 'phaser';
import { OUTFIT_SLOTS, SLOT_LABELS, itemsForSlot, type OutfitSlot } from '@oficina/shared';
import { session } from '../session.ts';
import { COLORS, drawArena, makeButton, makeCard, makeCharacter, makeItemTile, txt, type Button } from '../ui.ts';

/**
 * Criação do personagem: começa totalmente cinza e o jogador escolhe a roupa inicial.
 * As outras peças vão para o inventário.
 */
export class CreateScene extends Phaser.Scene {
  private preview?: Phaser.GameObjects.Container;
  private tiles: Phaser.GameObjects.GameObject[] = [];
  private tooltip?: Phaser.GameObjects.Container;
  private createBtn!: Button;
  private hint!: Phaser.GameObjects.Text;
  private nameInput!: HTMLInputElement;

  constructor() {
    super('Create');
  }

  create() {
    drawArena(this);
    this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.5);
    session.outfit = { head: null, body: null, accessory: null };

    txt(this, 640, 44, 'Crie seu personagem', 40, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 6 });
    txt(this, 640, 84, 'Escolha a roupa inicial. As outras peças ficam no seu inventário.', 18, COLORS.textDim);

    const g = this.add.graphics();
    g.fillStyle(COLORS.outline).fillEllipse(260, 520, 240, 54);
    g.fillStyle(0x3a2f55).fillEllipse(260, 514, 230, 46);
    this.refreshPreview();

    txt(this, 260, 576, 'Nome do personagem', 16, COLORS.textDim);
    const input = this.add.dom(260, 612, 'input').setOrigin(0.5);
    this.nameInput = input.node as HTMLInputElement;
    this.nameInput.className = 'name-input';
    this.nameInput.maxLength = 16;
    this.nameInput.placeholder = 'Seu nome';
    this.nameInput.value = session.name;
    this.nameInput.addEventListener('input', () => this.updateButton());

    this.hint = txt(this, 860, 600, '', 16, COLORS.textDim);
    this.createBtn = makeButton(this, 860, 652, 300, 60, 'Criar personagem', () => this.finish(), COLORS.gold, 22);
    this.drawTiles();
    this.updateButton();
  }

  private refreshPreview() {
    this.preview?.destroy();
    this.preview = makeCharacter(this, session.outfit, 5).setPosition(260, 520);
  }

  private drawTiles() {
    for (const o of this.tiles) o.destroy();
    this.tiles = [];
    OUTFIT_SLOTS.forEach((slot, row) => {
      const y = 182 + row * 150;
      this.tiles.push(txt(this, 520, y - 72, SLOT_LABELS[slot], 18, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5));
      itemsForSlot(slot).forEach((item, col) => {
        const selected = session.outfit[slot] === item.id;
        const tile = makeItemTile(this, item.id, {
          width: 160,
          selected,
          tag: selected ? 'Vestindo' : undefined,
          onClick: () => this.toggle(slot, item.id),
          onHover: (cardId, x, yy) => this.showTooltip(cardId, x, yy),
        })
          .setScale(0.82)
          .setPosition(590 + col * 148, y);
        this.tiles.push(tile);
      });
    });
  }

  private toggle(slot: OutfitSlot, id: string) {
    session.outfit = { ...session.outfit, [slot]: session.outfit[slot] === id ? null : id };
    this.refreshPreview();
    this.drawTiles();
    this.updateButton();
  }

  private showTooltip(cardId: string | null, x: number, y: number) {
    this.tooltip?.destroy();
    this.tooltip = undefined;
    if (!cardId) return;
    this.tooltip = makeCard(this, cardId).setDepth(100).setPosition(Phaser.Math.Clamp(x, 100, 1180), y > 360 ? y - 150 : y + 140);
  }

  private updateButton() {
    const hasName = this.nameInput.value.trim().length > 0;
    const hasPiece = OUTFIT_SLOTS.some((s) => session.outfit[s]);
    this.createBtn.setEnabled(hasName && hasPiece);
    this.hint.setText(!hasPiece ? 'Escolha pelo menos uma peça de roupa.' : !hasName ? 'Dê um nome ao personagem.' : 'Pronto para lutar!');
  }

  private finish() {
    const name = this.nameInput.value.trim();
    if (!name || !OUTFIT_SLOTS.some((s) => session.outfit[s])) return;
    session.name = name;
    session.created = true;
    session.save();
    this.scene.start('Wardrobe');
  }
}
