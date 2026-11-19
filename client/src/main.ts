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
import { session } from './session.ts';
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
    // Full HD como área segura; EXPAND aumenta a área visível sem distorcer a HUD.
    // A cena, câmera, conexão e estado da partida sobrevivem ao resize.
    width: Math.round(VIEW_W * RENDER_SCALE),
    height: Math.round(VIEW_H * RENDER_SCALE),
    backgroundColor: '#16121f',
    pixelArt: true,
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, LoginScene, MainMenuScene, WardrobeScene, LobbyScene, BattleScene, GalleryScene],
  });
  // Um convite ou reconexão pode iniciar o combate diretamente em qualquer menu.
  const enterMatch = () => {
    if (!session.net.token || !session.match) return;
    const active = game.scene.getScenes(true).find(s => ['MainMenu','Gallery','Login'].includes(s.scene.key));
    if (active) active.scene.start('Battle');
  };
  const offMatch = session.net.on(msg => { if (msg.t === 'match') enterMatch(); });
  game.events.once(Phaser.Core.Events.DESTROY, offMatch);
  const centerScene = (scene: Phaser.Scene) => {
    const { width, height } = game.scale.gameSize;
    const camera = scene.cameras.main;
    // EXPAND preserva a escala base e acrescenta pixels ao eixo excedente.
    if (camera && width > 0 && height > 0) {
      camera.setViewport(0, 0, width, height).setZoom(RENDER_SCALE).centerOn(640, 360);
    }
  };
  const recenter = () => {
    for (const scene of game.scene.getScenes(true)) centerScene(scene);
  };
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      scene.sys.events.on(Phaser.Scenes.Events.START, () => {
        centerScene(scene);
        setChatVisible(CHAT_SCENES.includes(scene.sys.settings.key));
        if (scene.scene.key === 'MainMenu') queueMicrotask(enterMatch);
      });
    }
    game.scale.on(Phaser.Scale.Events.RESIZE, recenter);
  });
  // EXPAND reage a resize sem destruir cenas ou recarregar a página.
  // Também atualiza o canvas ao entrar/sair de fullscreen pela API do navegador.
  const refreshFullscreen = () => game.scale.refresh();
  document.addEventListener('fullscreenchange', refreshFullscreen);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    document.removeEventListener('fullscreenchange', refreshFullscreen);
    game.scale.off(Phaser.Scale.Events.RESIZE, recenter);
  });
}

start();
