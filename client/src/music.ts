import { MUSIC } from './music.generated.ts';

/**
 * Música de batalha: sorteia uma faixa de assets/music e, quando acaba, toca outra (sem repetir a
 * anterior). Usa <audio> (streaming), então não precisa baixar a faixa inteira antes de tocar.
 */
const KEY = 'shonen.music';
let audio: HTMLAudioElement | null = null;
let last = -1;
let onTitle: ((t: string) => void) | null = null;

function prefs(): { muted: boolean; volume: number } {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return { muted: p.muted === true, volume: typeof p.volume === 'number' ? p.volume : 0.25 };
  } catch {
    return { muted: false, volume: 0.25 };
  }
}
let state = prefs();
const save = () => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignora */
  }
};

export const hasMusic = () => MUSIC.length > 0;
export const isMusicMuted = () => state.muted;

function next() {
  if (!MUSIC.length) return;
  let i = Math.floor(Math.random() * MUSIC.length);
  if (MUSIC.length > 1 && i === last) i = (i + 1) % MUSIC.length;
  last = i;
  const t = MUSIC[i];
  audio?.pause();
  audio = new Audio(`assets/music/${t.file}`);
  audio.volume = 0;
  audio.muted = state.muted;
  audio.addEventListener('ended', next);
  void audio.play().catch(() => {
    /* sem interação ainda: tenta de novo no próximo clique */
    window.addEventListener('pointerdown', () => void audio?.play().catch(() => {}), { once: true });
  });
  fade(state.volume, 1200);
  onTitle?.(t.title);
}

function fade(to: number, ms: number, done?: () => void) {
  const a = audio;
  if (!a) return done?.();
  const from = a.volume;
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / ms);
    a.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/** Começa a música da batalha (se já estiver tocando, continua). */
export function startBattleMusic(titleCb?: (t: string) => void) {
  onTitle = titleCb ?? null;
  if (audio && !audio.paused) return onTitle?.(MUSIC[last]?.title ?? '');
  next();
}

/** Para com fade (fim da partida ou saída da batalha). */
export function stopBattleMusic() {
  const a = audio;
  if (!a) return;
  fade(0, 800, () => {
    a.pause();
    if (audio === a) audio = null;
  });
}

export function toggleMusic(): boolean {
  state.muted = !state.muted;
  if (audio) audio.muted = state.muted;
  save();
  return state.muted;
}
