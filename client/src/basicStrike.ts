import Phaser from 'phaser';
import { tweenPromise, wait } from './ui.ts';

type Reaction = 'hit' | 'guard' | 'evade';

// Rotate the existing sprite pixels around the shoulder, keeping the equipped palette.
function posedTexture(scene: Phaser.Scene, image: Phaser.GameObjects.Image, guard: boolean) {
  const source = image.texture.getSourceImage() as HTMLImageElement;
  const key = image.texture.key + (guard ? '_guard_pose' : '_punch_pose');
  if (scene.textures.exists(key)) return key;
  const w = source.width, h = source.height, pad = 36;
  const texture = scene.textures.createCanvas(key, w + pad * 2, h);
  if (!texture) return image.texture.key;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  const arm = (left: boolean) => {
    const sign = left ? -1 : 1;
    const edge = w / 2;
    ctx.beginPath();
    for (const [i, [dx, y]] of [[8, 38], [11, 44], [10, 57], [13, 59], [w / 2, 59], [w / 2, 38]].entries()) {
      const x = edge + sign * dx;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.clip();
  };
  ctx.translate(pad, 0);
  ctx.drawImage(source, 0, 0);
  for (const left of guard ? [false, true] : [false]) {
    ctx.save();
    arm(left);
    ctx.clearRect(0, 0, w, h);
    ctx.restore();
  }
  for (const left of guard ? [true, false] : [false]) {
    ctx.save();
    const pivot = w / 2 + (left ? -8 : 8);
    ctx.translate(pivot, 39);
    ctx.rotate(guard ? (left ? -2.12 : -2.55) : -Math.PI / 2);
    ctx.translate(-pivot, -39);
    arm(left);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  }
  texture.refresh();
  return key;
}

export async function basicStrike(scene: Phaser.Scene, attacker: Phaser.GameObjects.Container,
  defender: Phaser.GameObjects.Container, reaction: Reaction, contact: () => void) {
  const fighter = attacker.list.find(obj => obj instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image;
  const rival = defender.list.find(obj => obj instanceof Phaser.GameObjects.Image) as Phaser.GameObjects.Image;
  const normal = fighter.texture.key, rivalNormal = rival.texture.key;
  const start = attacker.x, end = defender.x, dir = Math.sign(end - start);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    contact();
    await wait(scene, 170);
    return;
  }
  await tweenPromise(scene, {targets: attacker, x: start - dir * 18, duration: 150, ease: 'Sine.easeOut'});
  if (reaction === 'guard') rival.setTexture(posedTexture(scene, rival, true));
  if (reaction === 'evade') scene.tweens.add({targets: rival, x: dir * 35, angle: dir * 24, duration: 175, ease: 'Sine.easeOut'});
  const destination = end - dir * (reaction === 'guard' ? 120 : 106);
  await tweenPromise(scene, {targets: attacker, x: Phaser.Math.Linear(start, destination, 0.55), duration: 145, ease: 'Quad.easeIn'});
  fighter.setTexture(posedTexture(scene, fighter, false));
  await tweenPromise(scene, {targets: attacker, x: destination, duration: 65});
  contact();
  if (reaction === 'hit') scene.tweens.add({targets: rival, x: dir * 16, angle: dir * 6, duration: 80, yoyo: true});
  await wait(scene, 155);
  fighter.setTexture(normal);
  await Promise.all([
    tweenPromise(scene, {targets: attacker, x: start, duration: 310, ease: 'Sine.easeOut'}),
    tweenPromise(scene, {targets: rival, x: 0, angle: 0, duration: 225, ease: 'Sine.easeOut'}),
  ]);
  rival.setTexture(rivalNormal);
}
