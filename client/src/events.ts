import type { BattleEvent } from '@oficina/shared';

/**
 * Junta efeitos repetidos em sequência numa animação só: vários Bloqueios seguidos do mesmo jogador
 * (ex.: 3 Defesas Básicas) viram "+15 Bloqueio" de uma vez; o mesmo para Força/Fraco/Vulnerável e cura.
 */
export function mergeRepeats(events: BattleEvent[]): BattleEvent[] {
  const out: BattleEvent[] = [];
  for (const ev of events) {
    // Procura um evento igual no trecho atual de eventos "acumuláveis" (sem golpe no meio).
    if (ev.type === 'block' || ev.type === 'status' || ev.type === 'heal') {
      let k = out.length - 1;
      while (k >= 0 && (out[k].type === 'block' || out[k].type === 'status' || out[k].type === 'heal' || out[k].type === 'play')) {
        const prev = out[k];
        if (prev.type === ev.type && prev.player === ev.player && (ev.type !== 'status' || (prev as typeof ev).status === ev.status)) {
          out[k] = { ...prev, amount: (prev as typeof ev).amount + ev.amount } as BattleEvent;
          break;
        }
        k--;
      }
      if (k >= 0 && out[k].type === ev.type && (out[k] as typeof ev).player === ev.player) continue;
    }
    out.push(ev);
  }
  return out;
}

