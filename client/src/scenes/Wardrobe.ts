import Phaser from 'phaser';
import { OUTFIT_ITEMS, OUTFIT_SLOTS, SLOT_LABELS, buildDeck, getItem, type OutfitSlot, type ServerMessage } from '@oficina/shared';
import { session } from '../session.ts';
import { sfx } from '../sfx.ts';
import { COLORS, drawArena, fitText, makeButton, makeCard, makeCharacter, makeItemIcon, makeMiniIcon, txt } from '../ui.ts';
import { INV } from '../inventory.generated.ts';

/**
 * Posições da tela (1280×720), casadas com o fundo art/raw/ui/inventario.png.
 * Título e plaquinha do nome vêm medidos do magenta (INV); o resto foi medido no desenho do fundo.
 */
const L = {
  pedestal: { x: 217, y: 528 },
  deckLabel: { x: 217, y: 624 },
  // Centro da aba (depois do losango).
  equippedTab: { x: 503, y: 147 },
  // Caixa do "Vestindo" no fundo: x 406–1197, y 148–281 (a aba ocupa o topo até ~162).
  equipped: { x: 412, y: 166, w: 780, h: 53, gap: 5 },
  storedTab: { x: 503, y: 309 },
  storedHint: { x: 1196, y: 294 },
  stored: { x0: 404, y0: 334, cols: 9, w: 84, gapX: 5, gapY: 6 },
  buttonsY: 610,
};

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
    if (this.textures.exists('inventario')) {
      this.add.image(0, 0, 'inventario').setOrigin(0).setDisplaySize(1280, 720).setDepth(-10);
    } else {
      drawArena(this);
      this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.5);
    }

    const t = INV.title;
    txt(this, t.x + t.w / 2, t.y + t.h / 2, 'Inventário', 32, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 6 });

    // Nome editável na plaquinha do painel do personagem.
    const n = INV.name;
    // O elemento é configurado antes de ir para a cena, para o Phaser centralizar pelo tamanho certo.
    const el = document.createElement('input');
    el.className = 'plate-input';
    el.style.width = `${n.w - 24}px`;
    this.add.dom(n.x + n.w / 2, n.y + n.h / 2, el).setOrigin(0.5);
    el.maxLength = 16;
    el.value = session.name;
    el.addEventListener('input', () => {
      session.name = el.value.trim() || session.name;
      session.save();
    });

    this.deckLabel = txt(this, L.deckLabel.x, L.deckLabel.y, '', 17, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4 });
    makeButton(this, 690, L.buttonsY, 250, 46, 'Procurar oponente', () => this.go(false), COLORS.gold, 20);
    makeButton(this, 960, L.buttonsY, 230, 46, 'Treinar com bot', () => this.go(true), 0x7fc8a9, 20);

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
    this.preview = makeCharacter(this, session.outfit, 4.5).setPosition(L.pedestal.x, L.pedestal.y);
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.hideTooltip();

    this.dynamic.push(txt(this, L.equippedTab.x, L.equippedTab.y, 'Vestindo', 17, '#ffffff', { fontStyle: 'bold' }));
    OUTFIT_SLOTS.forEach((slot, i) => this.drawEquipped(slot, L.equipped.y + i * (L.equipped.h + L.equipped.gap)));

    const stored = OUTFIT_ITEMS.filter((it) => session.outfit[it.slot] !== it.id);
    this.dynamic.push(txt(this, L.storedTab.x, L.storedTab.y, 'Deck', 17, '#ffffff', { fontStyle: 'bold' }));
    this.dynamic.push(txt(this, L.storedHint.x, L.storedHint.y, 'Clique para vestir', 13, '#a8b4d0').setOrigin(1, 0.5));
    const S = L.stored;
    const h = Math.round(S.w / INV.slots.slot_normal.aspect);
    stored.forEach((item, i) => {
      const x = S.x0 + S.w / 2 + (i % S.cols) * (S.w + S.gapX);
      const y = S.y0 + h / 2 + Math.floor(i / S.cols) * (h + S.gapY);
      this.dynamic.push(this.itemSlot(item.id, x, y, S.w, h));
    });

    const deck = buildDeck(session.outfit);
    this.deckLabel.setText(`Baralho: ${deck.length} cartas`);
  }

  /** Peça guardada dentro da moldura (assets/ui/slot_*.png); clique veste. */
  private itemSlot(itemId: string, x: number, y: number, w: number, h: number) {
    const item = getItem(itemId)!;
    const c = this.add.container(x, y);
    const fr = INV.slots.slot_normal.inner;
    const ix = -w / 2 + fr.x * w, iy = -h / 2 + fr.y * h, iw = fr.w * w, ih = fr.h * h;
    const fill = this.add.graphics();
    const paint = (hover: boolean) => fill.clear().fillStyle(hover ? 0x2c4f8f : 0x1f3a6e).fillRect(ix, iy, iw, ih);
    paint(false);
    const frame = this.add.image(0, 0, this.textures.exists('slot_normal') ? 'slot_normal' : '__DEFAULT').setDisplaySize(w, h);
    c.add([fill, frame]);
    // Faixa de cima da moldura: Cabeça / Corpo.
    c.add(txt(this, 0, -h / 2 + h * 0.075, SLOT_LABELS[item.slot], 10, '#ffe28a', { fontStyle: 'bold' }));
    // Ícone limitado à área entre a faixa de cima e o nome (não invade "Cabeça"/"Corpo").
    const ic = makeItemIcon(this, itemId, iw - 6, ih * 0.4).setPosition(0, iy + ih * 0.28);
    if (ic instanceof Phaser.GameObjects.Image) {
      const k = Math.min((iw - 8) / ic.width, (ih * 0.4) / ic.height);
      ic.setScale(k >= 1 ? Math.floor(k) : k);
    }
    c.add(ic);
    c.add(fitText(txt(this, 0, iy + ih * 0.58, item.name, 11, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 3 }), iw - 4));
    item.cards.forEach((cardId, k) => {
      const cx = (k - 1) * (iw / 3);
      const cy = iy + ih * 0.82;
      const icon = makeMiniIcon(this, cardId, 0.33).setPosition(cx, cy);
      const zone = this.add.zone(cx, cy, iw / 3, ih * 0.3).setInteractive();
      zone.on('pointerover', () => this.showTooltip(cardId, x + cx, y + cy));
      zone.on('pointerout', () => this.hideTooltip());
      c.add([icon, zone]);
    });
    const hit = this.add.zone(0, -h * 0.12, w, h * 0.72).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      paint(true);
      if (this.textures.exists('slot_selected')) frame.setTexture('slot_selected').setDisplaySize(w * 1.04, h * 1.04);
    });
    hit.on('pointerout', () => {
      paint(false);
      if (this.textures.exists('slot_normal')) frame.setTexture('slot_normal').setDisplaySize(w, h);
    });
    hit.on('pointerdown', () => this.equip(item.slot, item.id));
    c.addAt(hit, 2);
    return c;
  }

  private drawEquipped(slot: OutfitSlot, y: number) {
    const item = getItem(session.outfit[slot]);
    const { x, w, h } = L.equipped;
    const mid = y + h / 2;
    const g = this.add.graphics();
    g.fillStyle(0x0d1328, 0.55).fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, 0x5a6a98, 0.8).strokeRoundedRect(x, y, w, h, 6);
    g.fillStyle(item ? 0x1f3a6e : 0x161d38).fillRoundedRect(x + 6, y + 5, 96, h - 10, 5);
    this.dynamic.push(g);
    this.dynamic.push(txt(this, x + 116, y + 14, SLOT_LABELS[slot], 12, '#a8b4d0').setOrigin(0, 0.5));
    if (!item) {
      this.dynamic.push(txt(this, x + 54, mid, 'vazio', 12, '#7a86a8'));
      this.dynamic.push(txt(this, x + 116, y + 35, 'Nada vestido. Escolha uma peça do deck abaixo.', 14, '#a8b4d0').setOrigin(0, 0.5));
      return;
    }
    this.dynamic.push(makeItemIcon(this, item.id, 86, h - 14).setPosition(x + 54, mid));
    this.dynamic.push(txt(this, x + 116, y + 35, item.name, 18, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5));
    item.cards.forEach((cardId, i) => {
      const cx = x + 430 + i * 62;
      const icon = makeMiniIcon(this, cardId, 0.46).setPosition(cx, mid);
      const zone = this.add.zone(cx, mid, 46, 46).setInteractive();
      zone.on('pointerover', () => this.showTooltip(cardId, cx, mid));
      zone.on('pointerout', () => this.hideTooltip());
      this.dynamic.push(icon, zone);
    });
    this.dynamic.push(makeButton(this, x + w - 60, mid, 96, 32, 'Tirar', () => this.equip(slot, null), 0xb0a0c8, 15));
  }

  private equip(slot: OutfitSlot, id: string | null) {
    sfx(id ? 'equip' : 'undo');
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
