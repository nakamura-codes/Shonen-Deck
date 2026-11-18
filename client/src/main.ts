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
import { setChatVisible } from './chat.ts';

/** Telas com o chat global no canto (fora do login e da batalha). */
const CHAT_SCENES = ['MainMenu', 'Wardrobe', 'Lobby', 'Gallery'];

// O navegador só libera som depois de uma interação.
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

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
    // Canvas fixo em Full HD: o FIT do Phaser ajusta somente a apresentação.
    // A cena, câmera, conexão e estado da partida sobrevivem ao resize.
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
      scene.sys.events.on(Phaser.Scenes.Events.START, () => {
        scene.cameras.main.setZoom(RENDER_SCALE).centerOn(640, 360);
        setChatVisible(CHAT_SCENES.includes(scene.sys.settings.key));
      });
    }
  });
  // O Scale Manager (FIT) reage a resize sem destruir cenas ou recarregar a página.
  // Também atualiza o canvas ao entrar/sair de fullscreen pela API do navegador.
  const refreshFullscreen = () => game.scale.refresh();
  document.addEventListener('fullscreenchange', refreshFullscreen);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    document.removeEventListener('fullscreenchange', refreshFullscreen);
  });
}

start();
