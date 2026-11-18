import Phaser from 'phaser';
import { BASE_DECK, CARDS, COMBOS, OUTFIT_ITEMS, getCard, type CardDef } from '@oficina/shared';
import { COLORS, NUM_FONT, TYPE_COLOR, centerInk, fitText, makeButton, makeCard, txt } from '../ui.ts';
import { auth } from '../session.ts';
import { sfx } from '../sfx.ts';
import { COLLECTION } from '../collection.generated.ts';

/** De onde vem cada carta (aparece embaixo da carta ampliada). */
function origins(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const id of new Set(BASE_DECK)) o[id] = 'Carta básica';
  for (const item of OUTFIT_ITEMS) for (const id of item.cards) o[id] = o[id] ? `${o[id]} · ${item.name}` : item.name;
  for (const c of COMBOS) o[c.creates] = `Combo: ${c.requires.map((r) => getCard(r).name).join(' + ')}`;
  for (const def of Object.values(CARDS)) if (def.evolve) o[def.evolve.into] = `Evolução do ${def.name}`;
  return o;
}

/** Ordem da coleção: básicas, depois as cartas de cada peça, depois combos/evoluções e o resto. */
function collectionOrder(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (id: string) => {
    if (!seen.has(id) && CARDS[id]) {
      seen.add(id);
      out.push(id);
    }
  };
  [...new Set(BASE_DECK)].forEach(add);
  for (const item of OUTFIT_ITEMS) item.cards.forEach(add);
  COMBOS.forEach((c) => add(c.creates));
  Object.values(CARDS).forEach((d) => d.evolve && add(d.evolve.into));
  Object.keys(CARDS).forEach(add);
  return out;
}

/** Coleção de cartas: painel com 32 espaços por página; passar o mouse mostra a carta inteira. */
export class GalleryScene extends Phaser.Scene {
  private page = 0;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private preview?: Phaser.GameObjects.Container;
  private ids: string[] = [];
  private from: Record<string, string> = {};

  constructor() {
    super('Gallery');
  }

  create() {
    this.ids = collectionOrder();
    this.from = origins();
    if (this.textures.exists('fundos_fundo_menu_principal_2560x1440')) {
      this.add.image(0, 0, 'fundos_fundo_menu_principal_2560x1440').setOrigin(0).setDisplaySize(1280, 720);
      this.add.rectangle(640, 360, 1280, 720, 0x0d0a14, 0.35);
    } else this.cameras.main.setBackgroundColor('#16121f');

    // Fundo das áreas vazadas (embaixo do painel).
    const g = this.add.graphics();
    const t = COLLECTION.title;
    g.fillStyle(0xf0a830).fillRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
    for (const s of COLLECTION.slots) g.fillStyle(0x221a38).fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
    for (const a of [COLLECTION.prev, COLLECTION.next]) g.fillStyle(0xf0a830).fillRect(a.x - 2, a.y - 2, a.w + 4, a.h + 4);
    this.add.image(0, 0, 'colecao').setOrigin(0).setDisplaySize(1280, 720);

    this.arrow(COLLECTION.prev, -1);
    this.arrow(COLLECTION.next, 1);
    makeButton(this, 70, 30, 110, 34, '◀ Menu', () => this.scene.start(auth.loggedIn ? 'MainMenu' : 'Login'), 0xb0a0c8, 15).setDepth(10);
    this.input.keyboard?.on('keydown-LEFT', () => this.show(this.page - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.show(this.page + 1));
    this.show(0);
  }

  private get pages() {
    return Math.max(1, Math.ceil(this.ids.length / COLLECTION.slots.length));
  }

  /** Botão de página: placa dourada maior que a arte do painel, centrada no mesmo ponto, com a seta no meio. */
  private arrow(r: { x: number; y: number; w: number; h: number }, dir: number) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const w = 112, h = 46, cut = 12;
    const g = this.add.graphics().setPosition(cx, cy).setDepth(5);
    const plate = (k: number) => [
      new Phaser.Math.Vector2(-w / 2 * k + cut, -h / 2 * k),
      new Phaser.Math.Vector2(w / 2 * k - cut, -h / 2 * k),
      new Phaser.Math.Vector2(w / 2 * k, 0),
      new Phaser.Math.Vector2(w / 2 * k - cut, h / 2 * k),
      new Phaser.Math.Vector2(-w / 2 * k + cut, h / 2 * k),
      new Phaser.Math.Vector2(-w / 2 * k, 0),
    ];
    const s = 13;
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(0x2a1a08).fillPoints(plate(1.08), true);
      g.fillStyle(0xc85a14).fillPoints(plate(1), true);
      g.fillStyle(hover ? 0xffd060 : 0xf0a830).fillPoints(plate(0.84), true);
      g.fillStyle(hover ? 0xffffff : 0x2a1a08).fillTriangle(-dir * s * 0.75, -s, -dir * s * 0.75, s, dir * s * 0.95, 0);
    };
    draw(false);
    const z = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(6);
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerdown', () => {
      sfx('click');
      this.show(this.page + dir);
    });
  }

  private show(page: number) {
    const per = COLLECTION.slots.length;
    this.page = ((page % this.pages) + this.pages) % this.pages;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.hidePreview();
    const t = COLLECTION.title;
    this.objs.push(fitText(centerInk(txt(this, 0, 0, `Coleção de cartas  ${this.page + 1}/${this.pages}`, 28, '#ffffff', { fontStyle: 'bold', stroke: '#5a2a08', strokeThickness: 6 }), t.x + t.w / 2, t.y + t.h / 2), t.w - 16));
    this.ids.slice(this.page * per, (this.page + 1) * per).forEach((id, i) => this.slot(id, COLLECTION.slots[i]));
  }

  /** Um espaço: arte da habilidade, custo e nome. */
  private slot(id: string, r: { x: number; y: number; w: number; h: number }) {
    const def = getCard(id);
    const cx = r.x + r.w / 2;
    const c = this.add.container(0, 0);
    // Só a arte, dentro do espaço (sem nome: a carta inteira aparece ao passar o mouse).
    const pad = 6;
    const art = this.textures.exists(`cardart_${id}`) ? `cardart_${id}` : this.textures.exists(`card_${id}`) ? `card_${id}` : null;
    if (art) {
      const img = this.add.image(cx, r.y + r.h / 2, art);
      img.setScale(Math.min((r.w - pad * 2) / img.width, (r.h - pad * 2) / img.height));
      c.add(img);
    }
    // Linha fina na base com a cor do tipo (ataque/técnica/poder), dentro do espaço.
    c.add(this.add.rectangle(cx, r.y + r.h - 4, r.w - pad * 2, 4, TYPE_COLOR[def.type]));
    // Custo.
    const k = this.add.graphics();
    k.fillStyle(COLORS.outline).fillCircle(r.x + 17, r.y + 17, 13);
    k.fillStyle(COLORS.ki).fillCircle(r.x + 17, r.y + 17, 11);
    c.add(k);
    c.add(centerInk(txt(this, 0, 0, String(def.cost), 18, '#ffffff', { fontFamily: NUM_FONT, stroke: '#0d0a14', strokeThickness: 3 }), r.x + 17, r.y + 17));
    const hover = this.add.rectangle(cx, r.y + r.h / 2, r.w, r.h, 0xffffff, 0);
    c.add(hover);
    const z = this.add.zone(cx, r.y + r.h / 2, r.w, r.h).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => {
      hover.setFillStyle(0xffffff, 0.12);
      this.showPreview(def, r);
    });
    z.on('pointerout', () => {
      hover.setFillStyle(0xffffff, 0);
      this.hidePreview();
    });
    this.objs.push(c, z);
  }

  /** Carta inteira ampliada ao lado do espaço, com a origem embaixo. */
  private showPreview(def: CardDef, r: { x: number; y: number; w: number; h: number }) {
    this.hidePreview();
    const scale = 1.35;
    const cw = 156 * scale, ch = 234 * scale;
    const right = r.x + r.w / 2 < 640;
    const x = right ? r.x + r.w + cw / 2 + 8 : r.x - cw / 2 - 8;
    const y = Phaser.Math.Clamp(r.y + r.h / 2, ch / 2 + 10, 720 - ch / 2 - 34);
    const c = this.add.container(0, 0).setDepth(50);
    c.add(makeCard(this, def.id).setScale(scale).setPosition(x, y));
    const origin = this.from[def.id] ?? 'Fora das peças por enquanto';
    const label = txt(this, x, y + ch / 2 + 18, origin, 14, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 4, align: 'center', wordWrap: { width: cw + 40 } });
    c.add(this.add.rectangle(x, label.y, label.width + 18, label.height + 8, 0x0d0a14, 0.85).setStrokeStyle(2, 0xf0a830));
    c.add(label);
    this.preview = c;
  }

  private hidePreview() {
    this.preview?.destroy();
    this.preview = undefined;
  }
}
