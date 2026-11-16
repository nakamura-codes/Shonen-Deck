import Phaser from 'phaser';
import { figureKey, getCard, getItem, type CardDef, type Outfit } from '@oficina/shared';

export const FONT = '"Pixelify Sans", monospace';

export const COLORS = {
  bg: 0x16121f,
  panel: 0x231c33,
  panelLight: 0x30264a,
  outline: 0x0d0a14,
  text: '#f4ecd8',
  textDim: '#a89cc0',
  gold: 0xf0a830,
  goldLight: 0xffe28a,
  ki: 0x2f8fe0,
  hp: 0xd8414a,
  block: 0x4aa8e8,
  attack: 0x8e2b33,
  skill: 0x2b7a52,
  power: 0x6a34a8,
};

export const TYPE_COLOR: Record<CardDef['type'], number> = {
  attack: COLORS.attack,
  skill: COLORS.skill,
  power: COLORS.power,
};

export const TYPE_LABEL: Record<CardDef['type'], string> = {
  attack: 'Ataque',
  skill: 'Técnica',
  power: 'Poder',
};

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  s: string,
  size = 16,
  color = COLORS.text,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
) {
  return scene.add
    .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, ...style })
    .setOrigin(0.5);
}

/** Texto que diminui até caber na largura. */
export function fitText(t: Phaser.GameObjects.Text, maxWidth: number) {
  let size = parseInt(String(t.style.fontSize), 10);
  while (t.width > maxWidth && size > 9) {
    size -= 1;
    t.setFontSize(size);
  }
  return t;
}

export interface Button extends Phaser.GameObjects.Container {
  setEnabled(v: boolean): Button;
  setLabel(s: string): Button;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  color = COLORS.gold,
  size = 20,
): Button {
  const c = scene.add.container(x, y) as Button;
  const g = scene.add.graphics();
  const t = txt(scene, 0, -1, label, size, '#1a1420', { fontStyle: 'bold' });
  let enabled = true;
  let hover = false;
  const draw = () => {
    g.clear();
    const base = enabled ? color : 0x5a5168;
    g.fillStyle(COLORS.outline).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 8);
    g.fillStyle(Phaser.Display.Color.ValueToColor(base).darken(30).color).fillRoundedRect(-w / 2, -h / 2 + 4, w, h - 4, 6);
    g.fillStyle(hover && enabled ? Phaser.Display.Color.ValueToColor(base).lighten(12).color : base).fillRoundedRect(-w / 2, -h / 2, w, h - 5, 6);
    t.setColor(enabled ? '#1a1420' : '#2e2838');
  };
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => ((hover = true), draw()));
  c.on('pointerout', () => ((hover = false), draw()));
  c.on('pointerdown', () => enabled && onClick());
  c.setEnabled = (v: boolean) => {
    enabled = v;
    draw();
    return c;
  };
  c.setLabel = (s: string) => {
    t.setText(s);
    return c;
  };
  draw();
  return c;
}

export const CARD_W = 156;
export const CARD_H = 226;

/** Desenha uma carta completa: moldura, custo, ícone hexagonal, nome e texto. */
export function makeCard(scene: Phaser.Scene, cardId: string, opts: { cost?: number } = {}) {
  const def = getCard(cardId);
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const w = CARD_W;
  const h = CARD_H;
  const color = TYPE_COLOR[def.type];
  const dark = Phaser.Display.Color.ValueToColor(color).darken(25).color;

  g.fillStyle(COLORS.outline).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 10);
  g.fillStyle(dark).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
  g.fillStyle(color).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 6);
  // Painel do texto.
  g.fillStyle(0xf1e6cf).fillRoundedRect(-w / 2 + 8, 30, w - 16, h / 2 - 50, 4);
  g.lineStyle(2, COLORS.outline).strokeRoundedRect(-w / 2 + 8, 30, w - 16, h / 2 - 50, 4);
  c.add(g);

  const key = `card_${cardId}`;
  const icon = scene.textures.exists(key)
    ? scene.add.image(0, -52, key).setScale(1.5)
    : placeholderIcon(scene, def).setPosition(0, -52);
  c.add(icon);

  // Faixa com o nome.
  const ribbon = scene.add.graphics();
  ribbon.fillStyle(COLORS.outline).fillRect(-w / 2 + 2, 6, w - 4, 24);
  ribbon.fillStyle(0x2a2238).fillRect(-w / 2 + 4, 8, w - 8, 20);
  c.add(ribbon);
  c.add(fitText(txt(scene, 0, 18, def.name, 15, '#ffffff', { fontStyle: 'bold' }), w - 14));

  const panelH = h / 2 - 50;
  const body = txt(scene, 0, 30 + panelH / 2, def.text, 13, '#2a2030', {
    align: 'center',
    wordWrap: { width: w - 24 },
    lineSpacing: -2,
  });
  if (body.height > panelH - 4) body.setFontSize(11);
  c.add(body);

  c.add(txt(scene, 0, h / 2 - 12, TYPE_LABEL[def.type], 12, '#f4ecd8'));

  // Custo de Ki.
  const cost = opts.cost ?? def.cost;
  const orb = scene.add.graphics();
  orb.fillStyle(COLORS.outline).fillCircle(-w / 2 + 14, -h / 2 + 14, 17);
  orb.fillStyle(COLORS.ki).fillCircle(-w / 2 + 14, -h / 2 + 14, 14);
  orb.fillStyle(0x8fd0ff).fillCircle(-w / 2 + 10, -h / 2 + 9, 4);
  c.add(orb);
  c.add(txt(scene, -w / 2 + 14, -h / 2 + 13, String(cost), 18, '#ffffff', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 3 }));

  c.setSize(w, h);
  return c;
}

/** Verso da carta (cartas escondidas do oponente). */
export function makeCardBack(scene: Phaser.Scene, scale = 0.5) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const w = CARD_W * scale;
  const h = CARD_H * scale;
  g.fillStyle(COLORS.outline).fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 6);
  g.fillStyle(0x3a2a5a).fillRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.lineStyle(2, COLORS.gold).strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4);
  c.add(g);
  c.add(txt(scene, 0, 0, '?', 28 * scale * 2, '#f0a830', { fontStyle: 'bold' }));
  return c;
}

/** Ícone provisório para cartas que ainda não têm arte. */
export function placeholderIcon(scene: Phaser.Scene, def: CardDef) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const pts = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = Phaser.Math.DegToRad(60 * i - 90);
    return new Phaser.Math.Vector2(Math.cos(a) * 58, Math.sin(a) * 58);
  });
  g.fillStyle(COLORS.outline).fillPoints(pts, true);
  g.fillStyle(TYPE_COLOR[def.type]).fillPoints(pts.map((p) => p.clone().scale(0.88)), true);
  c.add(g);
  c.add(txt(scene, 0, 0, def.name.slice(0, 1), 40, '#ffffff', { fontStyle: 'bold' }));
  return c;
}

/** Ícone pequeno (só o hexágono) para filas, poderes e golpes carregados. */
export function makeMiniIcon(scene: Phaser.Scene, cardId: string, scale = 0.6) {
  const key = `card_${cardId}`;
  if (scene.textures.exists(key)) return scene.add.image(0, 0, key).setScale(scale);
  return placeholderIcon(scene, getCard(cardId)).setScale(scale * 0.6);
}

/** Tamanho das figuras do personagem (assets/character) e linha dos pés. */
export const FIG_W = 64;
export const FIG_H = 80;
const FIG_FEET = 78;

/** Personagem com as roupas vestidas. Origem nos pés. */
export function makeCharacter(scene: Phaser.Scene, outfit: Outfit, scale: number, flip = false) {
  const c = scene.add.container(0, 0);
  c.add(scene.add.ellipse(0, -scale, 34 * scale, 6 * scale, 0x000000, 0.35));
  const key = scene.textures.exists(figureKey(outfit)) ? figureKey(outfit) : 'fig_none_none';
  c.add(
    scene.add
      .image(0, 0, key)
      .setOrigin(0.5, FIG_FEET / FIG_H)
      .setScale(scale)
      .setFlipX(flip),
  );
  c.setSize(FIG_W * scale, FIG_H * scale);
  return c;
}

/** Ícone de uma peça de roupa, cabendo numa caixa de tamanho máximo. */
export function makeItemIcon(scene: Phaser.Scene, itemId: string, maxW: number, maxH: number) {
  const key = `item_${itemId}`;
  if (!scene.textures.exists(key)) return txt(scene, 0, 0, getItem(itemId)?.name ?? '?', 12);
  const img = scene.add.image(0, 0, key);
  const scale = Math.max(1, Math.floor(Math.min(maxW / img.width, maxH / img.height)));
  return img.setScale(scale);
}

/** Painel de uma peça: ícone, nome e os 3 poderes que ela dá. */
export function makeItemTile(
  scene: Phaser.Scene,
  itemId: string,
  opts: { width?: number; selected?: boolean; tag?: string; onClick?: () => void; onHover?: (cardId: string | null, x: number, y: number) => void } = {},
) {
  const item = getItem(itemId)!;
  const w = opts.width ?? 190;
  const h = 150;
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(opts.selected ? COLORS.gold : COLORS.outline).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 10);
    g.fillStyle(hover ? COLORS.panelLight : 0x1f5bb8).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(0x16121f, 0.55).fillRoundedRect(-w / 2, h / 2 - 66, w, 66, { tl: 0, tr: 0, bl: 8, br: 8 });
  };
  draw(false);
  c.add(g);
  c.add(makeItemIcon(scene, itemId, w - 16, 82).setPosition(0, -h / 2 + 42));
  c.add(fitText(txt(scene, 0, h / 2 - 52, item.name, 16, '#ffffff', { fontStyle: 'bold' }), w - 12));
  item.cards.forEach((cardId, i) => {
    const x = (i - 1) * 46;
    const icon = makeMiniIcon(scene, cardId, 0.48).setPosition(x, h / 2 - 22);
    c.add(icon);
    if (opts.onHover) {
      const zone = scene.add.zone(x, h / 2 - 22, 40, 40).setInteractive();
      zone.on('pointerover', () => opts.onHover!(cardId, c.x + x, c.y + h / 2 - 22));
      zone.on('pointerout', () => opts.onHover!(null, 0, 0));
      c.add(zone);
    }
  });
  if (opts.tag) c.add(txt(scene, w / 2 - 8, -h / 2 + 12, opts.tag, 12, '#ffe28a', { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 3 }).setOrigin(1, 0.5));
  if (opts.onClick) {
    const hit = scene.add.zone(0, -24, w, h - 50).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => opts.onClick!());
    c.addAt(hit, 1);
  }
  c.setSize(w, h);
  return c;
}

export function tweenPromise(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

/** Texto que sobe e some (dano, bloqueio, status). */
export function floatText(scene: Phaser.Scene, x: number, y: number, s: string, color: string, size = 28) {
  const t = txt(scene, x, y, s, size, color, { fontStyle: 'bold', stroke: '#0d0a14', strokeThickness: 5 }).setDepth(50);
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

/** Fundo pixelado de arena. */
export function drawArena(scene: Phaser.Scene) {
  const { width: W, height: H } = scene.scale;
  const g = scene.add.graphics().setDepth(-10);
  g.fillGradientStyle(0x1d2340, 0x1d2340, 0x2a1d3a, 0x2a1d3a).fillRect(0, 0, W, H);
  // Pilares.
  for (const x of [120, 400, 880, 1160]) {
    g.fillStyle(0x161a30).fillRect(x - 40, 60, 80, 400);
    g.fillStyle(0x222846).fillRect(x - 34, 60, 8, 400);
  }
  // Chão.
  g.fillStyle(0x2a2440).fillRect(0, 430, W, H - 430);
  for (let x = 0; x < W; x += 64) {
    for (let y = 430; y < H; y += 32) {
      g.fillStyle(((x + y) / 32) % 2 ? 0x2f2848 : 0x272139).fillRect(x + ((y / 32) % 2) * 32, y, 62, 30);
    }
  }
  g.fillStyle(0x0d0a14, 0.5).fillRect(0, 430, W, 6);
  // Tochas.
  for (const x of [120, 1160]) {
    g.fillStyle(0x3a2a20).fillRect(x - 4, 150, 8, 30);
    const flame = scene.add.ellipse(x, 140, 18, 26, 0xffa030).setDepth(-9);
    const core = scene.add.ellipse(x, 144, 8, 14, 0xffe28a).setDepth(-9);
    scene.tweens.add({ targets: [flame, core], scaleY: 1.15, scaleX: 0.9, yoyo: true, repeat: -1, duration: 260, ease: 'Sine.easeInOut' });
  }
  return g;
}
