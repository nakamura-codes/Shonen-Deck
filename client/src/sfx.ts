/**
 * Efeitos sonoros gerados na hora (Web Audio), estilo retrô 8/16-bit.
 * Nenhum arquivo de áudio: cada som é uma receita de osciladores, ruído e envelopes.
 * Para ajustar um som, mude a receita em SOUNDS.
 */

const PREFS_KEY = 'oficina.sfx';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function loadPrefs(): { muted: boolean; volume: number } {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { muted: p.muted === true, volume: typeof p.volume === 'number' ? p.volume : 0.5 };
    }
  } catch {
    /* sem armazenamento */
  }
  return { muted: false, volume: 0.5 };
}

const prefs = loadPrefs();

function savePrefs() {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignora */
  }
}

/** O navegador só libera áudio depois de um clique; chamamos isto no primeiro clique. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = prefs.muted ? 0 : prefs.volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted() {
  return prefs.muted;
}

export function toggleMute(): boolean {
  prefs.muted = !prefs.muted;
  if (master) master.gain.value = prefs.muted ? 0 : prefs.volume;
  savePrefs();
  return prefs.muted;
}

// ───────────────────────── blocos de construção ─────────────────────────

/** Tom com envelope de volume e (opcional) varredura de frequência. */
function tone(
  type: OscillatorType,
  freq: number,
  dur: number,
  opts: { to?: number; vol?: number; delay?: number; attack?: number } = {},
) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
  const vol = opts.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Ruído filtrado (pancadas, cortes, explosões, vento). */
function noise(
  dur: number,
  opts: { type?: BiquadFilterType; freq?: number; to?: number; q?: number; vol?: number; delay?: number; attack?: number } = {},
) {
  if (!ctx || !master || !noiseBuf) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'lowpass';
  f.frequency.setValueAtTime(opts.freq ?? 2000, t0);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  const vol = opts.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

const notes = (freqs: number[], step: number, type: OscillatorType, dur: number, vol = 0.18) =>
  freqs.forEach((f, i) => tone(type, f, dur, { delay: i * step, vol }));

// ───────────────────────── receitas ─────────────────────────

const SOUNDS = {
  click: () => tone('square', 880, 0.05, { to: 660, vol: 0.12 }),
  card: () => tone('triangle', 320, 0.09, { to: 640, vol: 0.2 }),
  undo: () => tone('triangle', 600, 0.09, { to: 280, vol: 0.18 }),
  confirm: () => notes([523, 784], 0.07, 'square', 0.1, 0.13),
  error: () => tone('sawtooth', 140, 0.18, { to: 110, vol: 0.15 }),
  equip: () => notes([392, 523, 659], 0.05, 'triangle', 0.1, 0.16),
  reveal: () => notes([392, 494, 587, 784], 0.06, 'square', 0.12, 0.12),
  coin: () => tone('square', 1600, 0.04, { to: 2200, vol: 0.08 }),
  coinLand: () => {
    tone('square', 1320, 0.25, { vol: 0.12 });
    tone('square', 1980, 0.3, { vol: 0.08, delay: 0.06 });
  },
  hit: () => {
    noise(0.12, { freq: 1800, to: 300, vol: 0.35 });
    tone('sine', 160, 0.14, { to: 60, vol: 0.35 });
  },
  hitHeavy: () => {
    noise(0.3, { freq: 2500, to: 150, vol: 0.45 });
    tone('sine', 120, 0.32, { to: 40, vol: 0.5 });
  },
  block: () => {
    tone('square', 1250, 0.12, { vol: 0.1 });
    tone('square', 1870, 0.16, { vol: 0.07 });
    noise(0.08, { type: 'bandpass', freq: 3000, q: 6, vol: 0.2 });
  },
  heal: () => notes([523, 659, 784, 1047], 0.06, 'sine', 0.22, 0.16),
  buff: () => notes([330, 440, 554], 0.05, 'triangle', 0.14, 0.15),
  debuff: () => notes([440, 370, 294], 0.06, 'triangle', 0.16, 0.15),
  powerUp: () => {
    tone('sawtooth', 110, 0.7, { to: 440, vol: 0.12, attack: 0.1 });
    notes([440, 554, 659, 880], 0.1, 'square', 0.2, 0.1);
  },
  charge: () => {
    tone('sawtooth', 180, 0.6, { to: 900, vol: 0.1, attack: 0.15 });
    tone('sine', 360, 0.6, { to: 1800, vol: 0.06, attack: 0.15 });
  },
  beam: () => {
    noise(0.55, { freq: 1200, to: 400, vol: 0.25, attack: 0.03 });
    tone('sawtooth', 140, 0.55, { to: 90, vol: 0.18, attack: 0.03 });
  },
  explosion: () => {
    noise(0.9, { freq: 1500, to: 60, vol: 0.55, attack: 0.01 });
    tone('sine', 80, 0.9, { to: 30, vol: 0.55 });
  },
  slash: () => noise(0.14, { type: 'highpass', freq: 1500, to: 6000, vol: 0.3 }),
  zap: () => {
    for (let i = 0; i < 5; i++) tone('square', 400 + Math.random() * 1400, 0.05, { delay: i * 0.035, vol: 0.12 });
    noise(0.2, { type: 'highpass', freq: 3000, vol: 0.15 });
  },
  whoosh: () => noise(0.3, { type: 'bandpass', freq: 400, to: 3000, q: 2, vol: 0.3, attack: 0.05 }),
  swap: () => {
    tone('square', 660, 0.06, { vol: 0.12 });
    tone('square', 990, 0.06, { vol: 0.12, delay: 0.12 });
    noise(0.2, { type: 'bandpass', freq: 800, to: 2500, q: 2, vol: 0.2 });
  },
  stun: () => {
    tone('sawtooth', 90, 0.6, { to: 45, vol: 0.25 });
    notes([880, 740, 880, 740], 0.08, 'square', 0.08, 0.06);
  },
  combo: () => {
    tone('sawtooth', 220, 0.5, { to: 880, vol: 0.12, attack: 0.1 });
    notes([523, 659, 784, 1047, 1319], 0.07, 'square', 0.18, 0.11);
  },
  victory: () => notes([523, 659, 784, 1047, 784, 1047], 0.12, 'square', 0.22, 0.14),
  defeat: () => notes([392, 330, 262, 196], 0.18, 'triangle', 0.35, 0.18),
} as const;

export type SoundName = keyof typeof SOUNDS;

export function sfx(name: SoundName) {
  if (!ctx || prefs.muted) return;
  try {
    SOUNDS[name]();
  } catch {
    /* som nunca derruba o jogo */
  }
}

/** Som do golpe saindo, por carta. */
export function attackSound(cardId: string): SoundName {
  switch (cardId) {
    case 'kamehameha':
    case 'cero':
    case 'final_flash':
    case 'red':
    case 'ki_blast':
      return 'beam';
    case 'genki_dama':
    case 'hollow_purple':
      return 'explosion';
    case 'getsuga':
    case 'kunai':
    case 'gatling':
      return 'slash';
    case 'chidori':
    case 'black_flash':
      return 'zap';
    default:
      return 'whoosh';
  }
}
