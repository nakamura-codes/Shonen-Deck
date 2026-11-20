import Phaser from 'phaser';
import { tweenPromise } from './ui.ts';

/** Display the most advanced sphere above its owner. Doubled cards can charge together. */
export class GenkiCharge {
  private stages: number[] = [];
  private orb?: Phaser.GameObjects.Graphics;
  private marks?: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private x: number) {}

  sync(turnsLeft: number[]) {
    const stages = turnsLeft.map(left => Phaser.Math.Clamp(5 - left, 1, 4));
    if (stages.length === this.stages.length && stages.every((v, i) => v === this.stages[i])) return;
    this.stages = stages;
    this.draw();
  }

  start() {
    this.stages.push(1);
    this.draw();
  }

  prime() {
    this.stages[0] = 4;
    this.draw();
  }

  cancel() {
    // Only a charge started this turn can be cancelled.
    this.stages.pop();
    const glow = this.orb;
    if (glow && !this.stages.length) {
      this.orb = undefined;
      this.scene.tweens.add({targets: glow, alpha: 0, scale: 0.25, duration: 220, onComplete: () => glow.destroy()});
    }
    this.draw();
  }

  async fire(tx: number, ty: number, reflected: boolean) {
    if (!this.orb) this.prime();
    const ball = this.orb!;
    this.orb = undefined;
    this.stages.shift();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      if (reflected) {
        await tweenPromise(this.scene, {targets: ball, x: 1280 - this.x, y: ty, duration: 360, ease: 'Quad.easeIn'});
      }
      await tweenPromise(this.scene, {targets: ball, x: tx, y: ty, duration: 460, ease: 'Quad.easeIn'});
    }
    ball.destroy();
    this.draw();
  }

  private draw() {
    this.orb?.destroy();
    this.marks?.destroy();
    this.orb = undefined;
    this.marks = undefined;
    if (!this.stages.length) return;
    const stage = Math.max(...this.stages);
    const radius = [0, 15, 28, 44, 60][stage];
    const orb = this.orb = this.scene.add.graphics().setPosition(this.x, 84).setDepth(6);
    const disk = (x: number, y: number, r: number, color: number, alpha = 1) => {
      orb.fillStyle(color, alpha);
      for (let dy = -r; dy < r; dy += 3) {
        const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) / 2) * 2;
        orb.fillRect(x - w, y + dy, 2 * w, 3);
      }
    };
    disk(0, 0, radius + 6, 0x66deff, 0.36);
    disk(0, 0, radius + 2, 0x165b86);
    disk(0, 0, radius, 0x43caff);
    disk(-2, -2, Math.round(radius * 0.8), 0xabf6ff);
    disk(-radius * 0.14, -radius * 0.18, Math.round(radius * 0.5), 0xf3ffff);
    const marks = this.marks = this.scene.add.graphics().setPosition(this.x, 153).setDepth(6);
    for (let i = 0; i < 4; i++) {
      const x = -36 + i * 19;
      marks.fillStyle(0x162537).fillRect(x, -3, 17, 7);
      marks.fillStyle(i < stage ? 0x81e6ff : 0x506276).fillRect(x + 1, -2, 15, 5);
    }
  }
}
