import Phaser from 'phaser';
import { BootScene } from './scenes/Boot.ts';
import { RENDER_SCALE, VIEW_H, VIEW_W } from './render.ts';
import { LoginScene } from './scenes/Login.ts';
import { MainMenuScene } from './scenes/MainMenu.ts';
import { WardrobeScene } from './scenes/Wardrobe.ts';
import { LobbyScene } from './scenes/Lobby.ts';
import { BattleScene } from './scenes/Battle.ts';
import { GalleryScene } from './scenes/Gallery.ts';
import { unlockAudio } from './sfx.ts';

// O navegador só libera som depois de uma interação.
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const FULL_SIZE_SCENES = ['Battle', 'Wardrobe', 'Lobby'];

async function start() {
  // Espera a fonte pixelada carregar (se a internet falhar, segue com a fonte padrão).
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "GameFont"', 'Aa'),
        document.fonts.load('bold 16px "GameFont"', 'Aa'),
        document.fonts.load('16px "GameFont"', '0123456789'),
        document.fonts.load('16px "GameNum"', '0123456789'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* ignora */
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    // O jogo é pensado em 1280×720 e desenhado com RENDER_SCALE (1× a 2×, conforme a tela),
    // com o mesmo zoom nas câmeras: nítido sem pesar à toa em telas menores.
    width: Math.round(VIEW_W * RENDER_SCALE),
    height: Math.round(VIEW_H * RENDER_SCALE),
    backgroundColor: '#16121f',
    pixelArt: true,
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, LoginScene, MainMenuScene, WardrobeScene, LobbyScene, BattleScene, GalleryScene],
  });
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      // Batalha, inventário e fila ficam no tamanho original (1280×720 preenchendo a tela);
      // os menus usam a escala de interface menor.
      const full = FULL_SIZE_SCENES.includes(scene.sys.settings.key);
      const zoom = full ? RENDER_SCALE * Math.min(VIEW_W / 1280, VIEW_H / 720) : RENDER_SCALE;
      scene.sys.events.on(Phaser.Scenes.Events.START, () => scene.cameras.main.setZoom(zoom).centerOn(640, 360));
    }
  });
}

start();
