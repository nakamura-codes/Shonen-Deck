import { MENU_MUSIC, MUSIC, type Track } from './music.generated.ts';

/**
 * Música do jogo (usa <audio>, em streaming).
 *  - Menu (login, menu principal, inventário, coleção, fila): a música do menu repete sem parar.
 *  - Batalha: cada partida começa numa faixa sorteada; dali segue a lista e, ao acabar a última,
 *    volta para a primeira.
 * O volume é baixo de propósito: na batalha, os sons dos ataques têm que se destacar.
 */
const KEY = 'shonen.music';
/** Volumes (0 a 1) sobre faixas já equalizadas em -20 LUFS. */
const VOLUME = { menu: 0.1152, battle: 0.08 };

type Mode = 'menu' | 'battle' | null;
let audio: HTMLAudioElement | null = null;
let mode: Mode = null;
let battleIndex = 0;
let onTitle: ((t: string) => void) | null = null;

function loadMuted(): boolean {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}').muted === true;
  } catch {
    return false;
  }
}
let muted = loadMuted();

export const hasMusic = () => MUSIC.length > 0 || MENU_MUSIC.length > 0;
export const isMusicMuted = () => muted;

export function toggleMusic(): boolean {
  muted = !muted;
  if (audio) audio.muted = muted;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ muted }));
  } catch {
    /* ignora */
  }
  return muted;
}

function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume;
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/** Troca para uma faixa, com fade de saída da anterior e de entrada da nova. */
function play(track: Track, loop: boolean, volume: number, onEnd?: () => void) {
  const old = audio;
  if (old) fade(old, 0, 600, () => old.pause());
  const a = new Audio(`assets/music/${track.file}`);
  a.loop = loop;
  a.volume = 0;
  a.muted = muted;
  if (onEnd) a.addEventListener('ended', onEnd);
  audio = a;
  const start = () => a.play().then(() => fade(a, volume, 1200));
  start().catch(() => {
    // O navegador só libera áudio depois de uma interação: tenta de novo no primeiro clique/tecla.
    const retry = () => {
      if (audio === a) void start().catch(() => {});
    };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  });
}

/** Música do menu (se já estiver tocando, continua). */
export function startMenuMusic() {
  if (mode === 'menu' || !MENU_MUSIC.length) return;
  mode = 'menu';
  play(MENU_MUSIC[0], true, VOLUME.menu);
}

function playBattleTrack() {
  const t = MUSIC[battleIndex % MUSIC.length];
  play(t, false, VOLUME.battle, () => {
    battleIndex = (battleIndex + 1) % MUSIC.length;
    if (mode === 'battle') playBattleTrack();
  });
  onTitle?.(t.title);
}

/** Música da batalha: continua a lista de onde parou. */
export function startBattleMusic(titleCb?: (t: string) => void) {
  onTitle = titleCb ?? null;
  if (mode === 'battle' || !MUSIC.length) return;
  mode = 'battle';
  battleIndex = Math.floor(Math.random() * MUSIC.length);
  playBattleTrack();
}

/** Fim da batalha (a próxima sorteia de novo). */
export function stopBattleMusic() {
  if (mode !== 'battle') return;
  mode = null;
  const a = audio;
  if (a) fade(a, 0, 800, () => a.pause());
  audio = null;
}
