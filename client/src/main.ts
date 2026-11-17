import Phaser from 'phaser';
import { BootScene } from './scenes/Boot.ts';
import { CreateScene } from './scenes/Create.ts';
import { WardrobeScene } from './scenes/Wardrobe.ts';
import { LobbyScene } from './scenes/Lobby.ts';
import { BattleScene } from './scenes/Battle.ts';
import { unlockAudio } from './sfx.ts';

// O navegador só libera som depois de uma interação.
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

async function start() {
  // Espera a fonte pixelada carregar (se a internet falhar, segue com a fonte padrão).
  try {
    await Promise.race([
      Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('bold 16px "Pixelify Sans"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* ignora */
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: '#16121f',
    pixelArt: true,
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, CreateScene, WardrobeScene, LobbyScene, BattleScene],
  });
}

start();
