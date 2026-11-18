import Phaser from 'phaser';
import { startMenuMusic } from '../music.ts';
import { OUTFIT_SLOTS, SLOT_LABELS, buildDeck, getItem, itemsForSlot, type BotLevel, type OutfitSlot, type ServerMessage } from '@oficina/shared';
import { VIEW_H, VIEW_W } from '../render.ts';
import { session } from '../session.ts';
import { sfx } from '../sfx.ts';
import { COLORS, fitText, makeButton, makeCard, makeCharacter, makeItemIcon, makeMiniIcon, txt, fullBackground } from '../ui.ts';
import { menuButton, placeImage } from '../menuUi.ts';

const LABELS: Record<OutfitSlot, string> = { head: 'Acessórios', body: 'Roupas', hand: 'Armas' };
const LEFT = { x: 54, y: 96, w: 334, h: 556 };
const RIGHT = { x: 404, y: 96, w: 822, h: 556 };
const GRID = { x: 424, y: 142, stepY: 151, w: 146, h: 119, gap: 10, cols: 5 };
const SECONDARY = 'botoes_botao_secundario';
const PRIMARY = 'botoes_botao_principal';

/** Bordas chanfradas em camadas, usando as cores do título Shonen Deck. */
function bevel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, cut: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x + cut, y);
  g.lineTo(x + w - cut, y);
  g.lineTo(x + w, y + cut);
  g.lineTo(x + w, y + h - cut);
  g.lineTo(x + w - cut, y + h);
  g.lineTo(x + cut, y + h);
  g.lineTo(x, y + h - cut);
  g.lineTo(x, y + cut);
  g.closePath();
  g.fillPath();
}

function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  const g = scene.add.graphics();
  bevel(g, x - 3, y + 3, w + 6, h + 6, 16, 0x180e1e, 0.95);
  bevel(g, x, y, w, h, 14, 0x9e2610);
  bevel(g, x, y, w, h - 7, 14, 0xff9b18);
  bevel(g, x + 4, y + 3, w - 8, h - 13, 10, 0xffdb54);
  bevel(g, x + 8, y + 8, w - 16, h - 20, 8, 0x1c132a, 0.98);
  bevel(g, x + 11, y + 11, w - 22, h - 26, 6, 0x302342, 0.98);
  return g;
}

export class WardrobeScene extends Phaser.Scene {
  private preview?: Phaser.GameObjects.Container;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private tooltip?: Phaser.GameObjects.Container;
  private deckLabel!: Phaser.GameObjects.Text;
  private pages: Record<OutfitSlot, number> = { head: 0, body: 0, hand: 0 };

  constructor() { super('Wardrobe'); }

  create() {
    // O cenário é independente de todos os componentes da HUD.
    this.dynamic = [];
    this.preview = undefined;
    this.tooltip = undefined;
    this.pages = { head: 0, body: 0, hand: 0 };
    startMenuMusic();
    // Nunca amplia uma miniatura de 192×108 para tela cheia.
    // Até o dojo Full HD ser enviado, usa o cenário de login em 2560×1440.
    const dojo = this.textures.exists('fundo_preparacao')
      ? this.textures.get('fundo_preparacao').getSourceImage() as { width: number; height: number }
      : null;
    const background = dojo && dojo.width >= 1920 && dojo.height >= 1080
      ? 'fundo_preparacao'
      : 'fundos_fundo_login_2560x1440';
    fullBackground(this, background, -11);
    this.add.rectangle(640, 360, VIEW_W + 4, VIEW_H + 4, 0x170d23, 0.22).setDepth(-10);

    panel(this, LEFT.x, LEFT.y, LEFT.w, LEFT.h);
    panel(this, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h);
    placeImage(this, ['molduras_moldura_titulo', 440, 13, 400, 73]);
    fitText(txt(this, 640, 44, 'Preparação', 32, '#ffffff', { fontStyle: 'bold', stroke: '#21101d', strokeThickness: 5 }), 335);
    menuButton(this, SECONDARY, ['', 54, 24, 145, 53], 'Menu', () => this.scene.start('MainMenu'), 19);

    const plaque = this.add.graphics();
    bevel(plaque, 77, 116, 288, 47, 8, 0x110e1c);
    bevel(plaque, 80, 119, 282, 39, 6, 0xb77d33);
    bevel(plaque, 84, 122, 274, 32, 4, 0x3e2e50);
    fitText(txt(this, 221, 139, session.name, 24, '#fff1cb', { fontStyle: 'bold' }), 256);

    // Pedestal independente da arte de fundo e do sprite do personagem.
    this.add.ellipse(221, 452, 232, 36, 0x110d18, 0.55);
    const base = this.add.graphics();
    bevel(base, 119, 420, 204, 46, 12, 0x170f23);
    bevel(base, 123, 421, 196, 39, 10, 0x63516f);
    bevel(base, 123, 421, 196, 24, 10, 0xa99ab7);
    bevel(base, 137, 425, 168, 14, 5, 0x8c799d);
    this.deckLabel = txt(this, 221, 489, '', 21, '#ffe28a', { fontStyle: 'bold', stroke: '#1a1025', strokeThickness: 3 });
    txt(this, 221, 519, 'Equipamento atual', 16, '#e4d4f1', { fontStyle: 'bold' });
    txt(this, 815, 115, 'Clique para vestir ou trocar a peça', 15, '#e4d4f1');

    menuButton(this, PRIMARY, ['', 430, 580, 371, 60], 'Procurar oponente', () => this.go(false), 22);
    menuButton(this, SECONDARY, ['', 816, 580, 384, 60], 'Treinar com bot', () => this.chooseBot(), 22);
    this.refresh();

    const off = session.net.on((msg: ServerMessage) => {
      if (msg.t === 'match') {
        session.match = { you: msg.you, opponentName: msg.opponentName };
        this.scene.start('Battle');
      } else if (msg.t === 'error' && msg.message === 'Partida não encontrada.') {
        session.net.token = null;
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.dynamic = [];
      this.preview = undefined;
      this.tooltip = undefined;
    });
  }

  /** Janela para escolher o nível do bot de treino. */
  private chooseBot() {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const close = () => objs.forEach((o) => o.destroy());
    const shade = this.add.rectangle(640, 360, VIEW_W + 4, VIEW_H + 4, 0x0d0a14, 0.7).setDepth(200).setInteractive();
    shade.on('pointerdown', close);
    objs.push(shade);
    const g = this.add.graphics().setDepth(201);
    g.fillStyle(0xf0a830).fillRoundedRect(640 - 304, 360 - 194, 608, 388, 14);
    g.fillStyle(0x1c1a3a).fillRoundedRect(640 - 300, 360 - 190, 600, 380, 12);
    objs.push(g);
    objs.push(txt(this, 640, 205, 'Escolha o nível do bot', 26, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }).setDepth(202));
    const levels: [BotLevel, string, string, number][] = [
      ['iniciante', 'Iniciante', 'Joga sem estratégia. Bom para aprender as cartas.', 0x7fc8a9],
      ['competitivo', 'Competitivo', 'Calcula as melhores jogadas e usa combos. Um bom desafio.', COLORS.gold],
      ['deus', 'Deus das Cartas', 'Conhece todas as combinações e se adapta a cada jogada sua. Quase invencível.', 0xc04848],
    ];
    levels.forEach(([lvl, label, desc, color], i) => {
      const y = 270 + i * 88;
      objs.push(makeButton(this, 640, y, 300, 46, label, () => (close(), this.go(true, lvl)), color, 20).setDepth(202));
      objs.push(txt(this, 640, y + 34, desc, 13, '#c8d0e8', { stroke: '#0d0a14', strokeThickness: 3 }).setDepth(202));
    });
  }

  private go(vsBot: boolean, botLevel?: BotLevel) {
    session.save();
    this.scene.start('Lobby', { vsBot, botLevel });
  }


  private refresh() {
    this.preview?.destroy();
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.hideTooltip();

    // Pés ancorados no pedestal, escala idêntica para todas as combinações.
    this.preview = makeCharacter(this, session.outfit, 3.6).setPosition(221, 433);
    this.deckLabel.setText('Baralho: ' + buildDeck(session.outfit).length + ' cartas');

    OUTFIT_SLOTS.forEach((slot, row) => {
      const entries = itemsForSlot(slot);
      const pageCount = Math.max(1, Math.ceil(entries.length / GRID.cols));
      const page = this.pages[slot] = Phaser.Math.Clamp(this.pages[slot], 0, pageCount - 1);
      const y = GRID.y + row * GRID.stepY;
      const label = txt(this, GRID.x, y - 10, LABELS[slot], 19, '#ffd369', { fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.dynamic.push(label);
      if (pageCount > 1) {
        const prev = makeButton(this, 1070, y - 10, 32, 20, '‹', () => { this.pages[slot] = Math.max(0, page - 1); this.refresh(); }, COLORS.gold, 15);
        const next = makeButton(this, 1180, y - 10, 32, 20, '›', () => { this.pages[slot] = Math.min(pageCount - 1, page + 1); this.refresh(); }, COLORS.gold, 15);
        prev.setEnabled(page > 0);
        next.setEnabled(page + 1 < pageCount);
        this.dynamic.push(prev, next, txt(this, 1125, y - 10, (page + 1) + '/' + pageCount, 13, '#e4d4f1'));
      }
      entries.slice(page * GRID.cols, (page + 1) * GRID.cols).forEach((item, i) => {
        this.dynamic.push(this.itemSlot(item.id, GRID.x + GRID.w / 2 + i * (GRID.w + GRID.gap), y + GRID.h / 2));
      });
      this.dynamic.push(this.equippedSlot(slot, 125 + row * 96, 575));
    });
  }

  private itemSlot(itemId: string, x: number, y: number) {
    const item = getItem(itemId)!;
    const worn = session.outfit[item.slot] === item.id;
    const { w, h } = GRID;
    const c = this.add.container(x, y);
    const frame = this.add.graphics();
    const paint = (hover: boolean) => {
      frame.clear();
      bevel(frame, -w / 2, -h / 2 + 3, w, h, 9, 0x120e20);
      bevel(frame, -w / 2, -h / 2, w, h, 9, worn ? 0xffb821 : hover ? 0xe9c788 : 0x9d82be);
      bevel(frame, -w / 2 + 3, -h / 2 + 3, w - 6, h - 7, 7, worn ? 0xb35519 : 0x4f3b69);
      bevel(frame, -w / 2 + 6, -h / 2 + 6, w - 12, h - 13, 5, hover || worn ? 0x514069 : 0x382b50);
    };
    paint(false);
    c.add(frame);
    const hit = this.add.zone(0, -15, w - 4, h - 38).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => paint(true));
    hit.on('pointerout', () => paint(false));
    hit.on('pointerdown', () => this.equip(item.slot, worn ? null : item.id));
    c.add(hit);
    const icon = makeItemIcon(this, itemId, 102, 49);
    if (icon instanceof Phaser.GameObjects.Image) icon.setScale(Math.min(102 / icon.width, 49 / icon.height));
    icon.setPosition(0, -26);
    c.add(icon);
    c.add(fitText(txt(this, 0, 8, item.name, 18, '#fff5df', { fontStyle: 'bold', stroke: '#1b1428', strokeThickness: 3 }), w - 14));
    item.cards.forEach((cardId, i) => {
      const cx = (i - (item.cards.length - 1) / 2) * 34;
      const cy = 37;
      const mini = makeMiniIcon(this, cardId, 0.36).setPosition(cx, cy);
      const zone = this.add.zone(cx, cy, 32, 32).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.showTooltip(cardId, x + cx, y + cy));
      zone.on('pointerout', () => this.hideTooltip());
      zone.on('pointerdown', () => this.showTooltip(cardId, x + cx, y + cy));
      c.add([mini, zone]);
    });
    if (worn) {
      const badge = this.add.graphics();
      bevel(badge, w / 2 - 23, -h / 2 + 5, 17, 17, 3, 0xffc34a);
      c.add(badge);
      c.add(txt(this, w / 2 - 14, -h / 2 + 13, '✓', 13, '#432012', { fontStyle: 'bold' }));
    }
    return c;
  }

  private equippedSlot(slot: OutfitSlot, x: number, y: number) {
    const item = getItem(session.outfit[slot]);
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    bevel(g, -44, -36, 88, 76, 7, item ? 0xe6a12f : 0x80669d);
    bevel(g, -41, -33, 82, 70, 5, 0x241a35);
    c.add(g);
    c.add(txt(this, 0, -25, slot === 'hand' ? 'Arma' : SLOT_LABELS[slot], 13, '#ffe3af'));
    if (item) {
      const icon = makeItemIcon(this, item.id, 62, 36);
      if (icon instanceof Phaser.GameObjects.Image) icon.setScale(Math.min(62 / icon.width, 36 / icon.height));
      c.add(icon.setPosition(0, 1));
      c.add(txt(this, 0, 29, 'Tirar', 12, '#f6d5aa'));
      const zone = this.add.zone(0, 6, 84, 62).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.equip(slot, null));
      c.add(zone);
    } else {
      c.add(txt(this, 0, 4, '—', 22, '#b39fc7'));
      c.add(txt(this, 0, 29, 'Vazio', 12, '#b39fc7'));
    }
    return c;
  }

  private equip(slot: OutfitSlot, id: string | null) {
    // Troca direta apenas de interface: mesma validação de slot e mesma montagem do baralho.
    if (id !== null && getItem(id)?.slot !== slot) return;
    sfx(id ? 'equip' : 'undo');
    session.outfit = { ...session.outfit, [slot]: id };
    session.save();
    this.refresh();
  }

  private showTooltip(cardId: string, x: number, y: number) {
    this.hideTooltip();
    this.tooltip = makeCard(this, cardId)
      .setDepth(100)
      .setPosition(Phaser.Math.Clamp(x, 130, 1150), y > 360 ? y - 150 : y + 140);
  }

  private hideTooltip() {
    this.tooltip?.destroy();
    this.tooltip = undefined;
  }
}
