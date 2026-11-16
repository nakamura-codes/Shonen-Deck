import { DEFAULT_OUTFIT, sanitizeOutfit, type BattleView, type Outfit, type PlayerIndex } from '@oficina/shared';
import { Net, defaultServerUrl } from './net.ts';

const PREFS_KEY = 'oficina.prefs';

function loadPrefs(): { name: string; outfit: Outfit } {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { name: typeof p.name === 'string' ? p.name : '', outfit: sanitizeOutfit(p.outfit) };
    }
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return { name: '', outfit: { ...DEFAULT_OUTFIT } };
}

const prefs = loadPrefs();

/** Estado compartilhado entre as cenas. */
export const session = {
  net: new Net(defaultServerUrl()),
  name: prefs.name || `Jogador${Math.floor(Math.random() * 900 + 100)}`,
  outfit: prefs.outfit,
  match: null as null | { you: PlayerIndex; opponentName: string },
  /** Último estado recebido (a cena de batalha pode abrir depois da primeira mensagem chegar). */
  lastView: null as null | { view: BattleView; deadline: number },
  savePrefs() {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ name: this.name, outfit: this.outfit }));
    } catch {
      /* ignora */
    }
  },
};

session.net.on((msg) => {
  if (msg.t === 'match') session.lastView = null;
  if (msg.t === 'state' || msg.t === 'resolved') {
    session.lastView = { view: msg.view, deadline: Date.now() + msg.remainingMs };
  }
});
