import { EMPTY_OUTFIT, sanitizeOutfit, type BattleView, type Outfit, type PlayerIndex } from '@oficina/shared';
import { Net, defaultServerUrl } from './net.ts';

const PROFILE_KEY = 'oficina.profile';

interface Profile {
  created: boolean;
  name: string;
  outfit: Outfit;
}

function loadProfile(): Profile {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { created: p.created === true, name: typeof p.name === 'string' ? p.name : '', outfit: sanitizeOutfit(p.outfit) };
    }
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return { created: false, name: '', outfit: { ...EMPTY_OUTFIT } };
}

const profile = loadProfile();

/** Estado compartilhado entre as cenas. O personagem fica salvo neste navegador. */
export const session = {
  net: new Net(defaultServerUrl()),
  created: profile.created,
  name: profile.name || `Jogador${Math.floor(Math.random() * 900 + 100)}`,
  outfit: profile.outfit,
  match: null as null | { you: PlayerIndex; opponentName: string },
  /** Último estado recebido (a cena de batalha pode abrir depois da primeira mensagem chegar). */
  lastView: null as null | { view: BattleView; deadline: number },
  save() {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ created: this.created, name: this.name, outfit: this.outfit }));
    } catch {
      /* ignora: o personagem só não fica salvo */
    }
  },
  reset() {
    this.created = false;
    this.name = '';
    this.outfit = { ...EMPTY_OUTFIT };
    this.save();
  },
};

session.net.on((msg) => {
  if (msg.t === 'match') session.lastView = null;
  if (msg.t === 'state' || msg.t === 'resolved') {
    session.lastView = { view: msg.view, deadline: Date.now() + msg.remainingMs };
  }
});
