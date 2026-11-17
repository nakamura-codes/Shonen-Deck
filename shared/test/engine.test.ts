import { describe, expect, it } from 'vitest';
import {
  CARDS,
  EMPTY_OUTFIT,
  figureKey,
  OUTFIT_ITEMS,
  RETIRED_CARDS,
  RULES,
  buildDeck,
  createBattle,
  moveToFront,
  playCard,
  previewCardDamage,
  resolveTurn,
  sanitizeOutfit,
  setReady,
  shuffle,
  undoLastCard,
  viewFor,
  type BattleState,
  type PlayerIndex,
} from '../src/index.ts';

const FULL = { head: 'chapeu_palha', body: 'gi_laranja' };

/** Batalha de teste: o jogador 0 começa o turno 1 (a moeda é fixada). */
function newBattle(seed = 1): BattleState {
  const s = createBattle(seed, [
    { name: 'A', outfit: FULL },
    { name: 'B', outfit: FULL },
  ]);
  s.firstPlayer = 0;
  return s;
}

/** Troca a mão de um jogador por cartas específicas (só para os testes). */
function giveHand(state: BattleState, p: PlayerIndex, ids: string[]) {
  state.fighters[p].hand = ids.map((id, i) => ({ uid: `t${p}_${i}_${id}`, id }));
}

function play(state: BattleState, p: PlayerIndex, id: string): BattleState {
  const card = state.fighters[p].hand.find((c) => c.id === id);
  if (!card) throw new Error(`sem ${id} na mão`);
  const r = playCard(state, p, card.uid);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function readyAndResolve(state: BattleState) {
  let s = state;
  for (const p of [0, 1] as PlayerIndex[]) {
    const r = setReady(s, p);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return resolveTurn(s);
}

describe('dados', () => {
  it('toda carta das roupas existe', () => {
    for (const item of OUTFIT_ITEMS) for (const id of item.cards) expect(CARDS[id], id).toBeDefined();
  });

  it('baralho inicial = 8 básicas + 3 por peça vestida', () => {
    expect(buildDeck(FULL)).toHaveLength(14);
    expect(buildDeck({ head: 'bandana_ninja', body: null })).toHaveLength(11);
    expect(buildDeck(EMPTY_OUTFIT)).toHaveLength(8);
  });

  it('toda carta aparece em alguma peça', () => {
    const fromItems = new Set(OUTFIT_ITEMS.flatMap((i) => i.cards));
    for (const id of Object.keys(CARDS)) if (!CARDS[id].token && !RETIRED_CARDS.includes(id) && !id.endsWith('_basico') && id !== 'defesa_basica') expect(fromItems.has(id), id).toBe(true);
  });

  it('peça inválida ou no espaço errado vira espaço vazio', () => {
    expect(sanitizeOutfit({ head: 'gi_laranja', body: 'xxx' })).toEqual(EMPTY_OUTFIT);
    expect(sanitizeOutfit({ head: 'bandana_ninja' })).toEqual({ head: 'bandana_ninja', body: null });
    expect(sanitizeOutfit(null)).toEqual(EMPTY_OUTFIT);
  });

  it('nome da figura do personagem', () => {
    expect(figureKey(EMPTY_OUTFIT)).toBe('fig_none_none');
    expect(figureKey(FULL)).toBe('fig_chapeu_palha_gi_laranja');
  });
});

describe('embaralhamento', () => {
  it('é determinístico com a mesma seed', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42)[0];
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42)[0];
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('mesma seed gera a mesma batalha', () => {
    expect(newBattle(7).fighters[0].hand).toEqual(newBattle(7).fighters[0].hand);
  });
});

describe('início', () => {
  it('cada jogador começa com 5 cartas, 3 de Ki e 60 de HP', () => {
    const s = newBattle();
    for (const f of s.fighters) {
      expect(f.hand).toHaveLength(RULES.drawPerTurn);
      expect(f.ki).toBe(RULES.kiPerTurn);
      expect(f.hp).toBe(RULES.maxHp);
    }
  });
});

describe('jogar cartas', () => {
  it('recusa carta que não está na mão', () => {
    const s = newBattle();
    const r = playCard(s, 0, 'nao-existe');
    expect(r.ok).toBe(false);
  });

  it('recusa quando falta Ki', () => {
    const s = newBattle();
    giveHand(s, 0, ['genki_dama', 'getsuga']);
    const s2 = play(s, 0, 'genki_dama');
    const card = s2.fighters[0].hand.find((c) => c.id === 'getsuga')!;
    const r = playCard(s2, 0, card.uid);
    expect(r).toEqual({ ok: false, error: 'Ki insuficiente.' });
  });

  it('recusa depois de confirmar', () => {
    let s = newBattle();
    giveHand(s, 0, ['golpe_basico']);
    const r = setReady(s, 0);
    if (!r.ok) throw new Error();
    s = r.state;
    expect(playCard(s, 0, s.fighters[0].hand[0].uid).ok).toBe(false);
  });

  it('desfazer devolve a carta e o Ki', () => {
    let s = newBattle();
    giveHand(s, 0, ['getsuga']);
    s = play(s, 0, 'getsuga');
    expect(s.fighters[0].ki).toBe(1);
    const r = undoLastCard(s, 0);
    if (!r.ok) throw new Error();
    expect(r.state.fighters[0].ki).toBe(3);
    expect(r.state.fighters[0].hand.map((c) => c.id)).toEqual(['getsuga']);
  });

  it('não altera o estado original', () => {
    const s = newBattle();
    giveHand(s, 0, ['golpe_basico']);
    play(s, 0, 'golpe_basico');
    expect(s.fighters[0].hand).toHaveLength(1);
  });
});

describe('resolução', () => {
  it('bloqueio acontece antes dos ataques', () => {
    let s = newBattle();
    giveHand(s, 0, ['golpe_basico']);
    giveHand(s, 1, ['defesa_basica']);
    s = play(s, 0, 'golpe_basico');
    s = play(s, 1, 'defesa_basica');
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].hp).toBe(59); // 6 de dano - 5 de bloqueio
  });

  it('o bloqueio zera no início do turno', () => {
    let s = newBattle();
    giveHand(s, 1, ['haki']);
    s = play(s, 1, 'haki');
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].block).toBe(0);
    expect(state.fighters[1].strength).toBe(1);
  });

  it('Chidori ignora o bloqueio', () => {
    let s = newBattle();
    giveHand(s, 0, ['chidori']);
    giveHand(s, 1, ['haki']);
    s = play(s, 0, 'chidori');
    s = play(s, 1, 'haki');
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].hp).toBe(50);
  });

  it('Gatling acerta 4 vezes e a Força conta em cada golpe', () => {
    let s = newBattle();
    giveHand(s, 0, ['kaioken', 'gatling']);
    s = play(s, 0, 'kaioken');
    s = play(s, 0, 'gatling');
    const { state, events } = readyAndResolve(s);
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(4);
    expect(state.fighters[1].hp).toBe(60 - 4 * 6);
    expect(state.fighters[0].hp).toBe(55); // custo do Kaioken
    expect(state.fighters[0].tempStrength).toBe(0); // Força temporária some
  });

  it('Rasengan aplica Vulnerável e o próximo golpe causa 25% a mais', () => {
    let s = newBattle();
    giveHand(s, 0, ['rasengan']);
    s = play(s, 0, 'rasengan');
    let r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(48);
    s = r.state;
    giveHand(s, 0, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(48 - 7);
    expect(r.state.fighters[1].vulnerable).toBe(0);
  });

  it('Fraco reduz o dano em 25%', () => {
    let s = newBattle();
    s.fighters[0].weak = 1;
    giveHand(s, 0, ['getsuga']);
    s = play(s, 0, 'getsuga');
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].hp).toBe(60 - 10);
  });

  it('Getsuga é exaurida', () => {
    let s = newBattle();
    giveHand(s, 0, ['getsuga']);
    s = play(s, 0, 'getsuga');
    const { state } = readyAndResolve(s);
    expect(state.fighters[0].exhausted.map((c) => c.id)).toEqual(['getsuga']);
  });

  it('Kage Bunshin faz a próxima carta acontecer 2 vezes', () => {
    let s = newBattle();
    giveHand(s, 0, ['kage_bunshin', 'pistol']);
    s = play(s, 0, 'kage_bunshin');
    s = play(s, 0, 'pistol');
    expect(s.fighters[0].queue[1].doubled).toBe(true);
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].hp).toBe(60 - 14);
  });

  it('Sharingan revela a fila do oponente', () => {
    let s = newBattle();
    giveHand(s, 0, ['sharingan']);
    giveHand(s, 1, ['pistol']);
    s = play(s, 1, 'pistol');
    expect(viewFor(s, 0).opponent.queue).toBeNull();
    s = play(s, 0, 'sharingan');
    expect(viewFor(s, 0).opponent.queue?.map((q) => q.card.id)).toEqual(['pistol']);
    expect(viewFor(s, 1).opponent.queue).toBeNull();
  });
});

describe('golpes carregados', () => {
  it('Kamehameha dispara no turno seguinte', () => {
    let s = newBattle();
    giveHand(s, 0, ['kamehameha']);
    s = play(s, 0, 'kamehameha');
    let r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(60);
    expect(r.state.fighters[0].charges).toHaveLength(1);
    r = readyAndResolve(r.state);
    expect(r.state.fighters[1].hp).toBe(42);
    expect(r.state.fighters[0].charges).toHaveLength(0);
    expect(r.events.some((e) => e.type === 'chargeFire')).toBe(true);
  });

  it('Genki Dama dispara depois de 2 turnos', () => {
    let s = newBattle();
    giveHand(s, 0, ['genki_dama']);
    s = play(s, 0, 'genki_dama');
    let r = readyAndResolve(s);
    r = readyAndResolve(r.state);
    expect(r.state.fighters[1].hp).toBe(60);
    r = readyAndResolve(r.state);
    expect(r.state.fighters[1].hp).toBe(20);
  });

  it('Genki Dama é cancelada se o dono sofrer 15+ de dano num turno', () => {
    let s = newBattle();
    giveHand(s, 0, ['genki_dama']);
    s = play(s, 0, 'genki_dama');
    let r = readyAndResolve(s);
    s = r.state;
    giveHand(s, 1, ['getsuga', 'kaioken']);
    s = play(s, 1, 'kaioken');
    s = play(s, 1, 'getsuga');
    r = readyAndResolve(s);
    expect(r.state.fighters[0].charges).toHaveLength(0);
    expect(r.events.some((e) => e.type === 'chargeCancel')).toBe(true);
  });
});

describe('poderes', () => {
  it('Bankai soma +3 por golpe', () => {
    let s = newBattle();
    giveHand(s, 0, ['bankai']);
    s = play(s, 0, 'bankai');
    let r = readyAndResolve(s);
    s = r.state;
    giveHand(s, 0, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(60 - 9);
  });

  it('Gear Second dá +1 Ki e custa 2 HP por turno', () => {
    let s = newBattle();
    giveHand(s, 0, ['gear_second']);
    s = play(s, 0, 'gear_second');
    const r = readyAndResolve(s);
    // Sobrou 2 + 3 do turno + 1 do Gear Second = 6, limitado a 5.
    expect(r.state.fighters[0].ki).toBe(5);
    expect(r.state.fighters[0].hp).toBe(58);
  });

  it('Domain Expansion aplica Fraco no oponente a cada turno', () => {
    let s = newBattle();
    giveHand(s, 0, ['domain_expansion']);
    s = play(s, 0, 'domain_expansion');
    const r = readyAndResolve(s);
    expect(r.state.fighters[1].weak).toBe(1);
  });
});

describe('fim de jogo', () => {
  it('termina quando o HP chega a 0', () => {
    let s = newBattle();
    s.fighters[1].hp = 5;
    giveHand(s, 0, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    const { state, events } = readyAndResolve(s);
    expect(state.phase).toBe('over');
    expect(state.winner).toBe(0);
    expect(events.at(-1)).toEqual({ type: 'gameOver', winner: 0 });
  });

  it('quem resolve primeiro derruba e as cartas restantes não acontecem', () => {
    let s = newBattle();
    s.fighters[0].hp = 5;
    s.fighters[1].hp = 5;
    giveHand(s, 0, ['golpe_basico']);
    giveHand(s, 1, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    s = play(s, 1, 'golpe_basico');
    const { state, events } = readyAndResolve(s);
    expect(state.winner).toBe(0);
    expect(state.fighters[0].hp).toBe(5);
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(1);
  });

  it('uma partida inteira entre dois bots termina', () => {
    let s = newBattle(123);
    for (let i = 0; i < 100 && s.phase === 'planning'; i++) {
      for (const p of [0, 1] as PlayerIndex[]) {
        for (const c of [...s.fighters[p].hand]) {
          const r = playCard(s, p, c.uid);
          if (r.ok) s = r.state;
        }
      }
      s = readyAndResolve(s).state;
    }
    expect(s.phase).toBe('over');
  });
});

describe('ordem de resolução e moeda', () => {
  it('a moeda é determinística pela seed e quem começa alterna', () => {
    const a = createBattle(99, [{ name: 'A', outfit: FULL }, { name: 'B', outfit: FULL }]);
    const b = createBattle(99, [{ name: 'A', outfit: FULL }, { name: 'B', outfit: FULL }]);
    expect(a.firstPlayer).toBe(b.firstPlayer);
    const seen = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((seed) => createBattle(seed, [{ name: 'A', outfit: FULL }, { name: 'B', outfit: FULL }]).firstPlayer));
    expect(seen.size).toBe(2);
    expect(viewFor(a, 0).turnStarter).toBe(a.firstPlayer);
    const r = readyAndResolve(a);
    expect(viewFor(r.state, 0).turnStarter).toBe(a.firstPlayer === 0 ? 1 : 0);
  });

  it('armadura protege mesmo jogada depois do ataque de quem começa', () => {
    let s = newBattle();
    giveHand(s, 0, ['getsuga']);
    giveHand(s, 1, ['golpe_basico', 'defesa_basica']);
    s = play(s, 0, 'getsuga');
    s = play(s, 1, 'golpe_basico');
    s = play(s, 1, 'defesa_basica');
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].hp).toBe(60 - 9);
  });

  it('as cartas se alternam: o ataque de quem começa vem antes do buff do outro', () => {
    let s = newBattle();
    giveHand(s, 0, ['golpe_basico']);
    giveHand(s, 1, ['kaioken', 'golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    s = play(s, 1, 'kaioken');
    s = play(s, 1, 'golpe_basico');
    const { events } = readyAndResolve(s);
    const order = events.filter((e) => e.type === 'play').map((e) => (e as { cardId: string }).cardId);
    expect(order).toEqual(['golpe_basico', 'kaioken', 'golpe_basico']);
  });

  it('Blue antes do Red reforça o Red; Red antes do Blue não', () => {
    let s = newBattle();
    giveHand(s, 0, ['blue', 'red']);
    s.fighters[0].ki = 5;
    s = play(s, 0, 'blue');
    s = play(s, 0, 'red');
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(60 - 17);

    s = newBattle();
    giveHand(s, 0, ['blue', 'red']);
    s.fighters[0].ki = 5;
    s = play(s, 0, 'red');
    s = play(s, 0, 'blue');
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(60 - 14);
  });
});

describe('Ki acumulável', () => {
  it('o Ki que sobra passa para o próximo turno, até 5', () => {
    let s = newBattle();
    let r = readyAndResolve(s);
    expect(r.state.fighters[0].ki).toBe(5);
    s = r.state;
    giveHand(s, 0, ['getsuga']);
    s = play(s, 0, 'getsuga');
    r = readyAndResolve(s);
    expect(r.state.fighters[0].ki).toBe(5); // 3 + 3 = 6 → 5
  });
});

describe('combo Red + Blue → Hollow Purple', () => {
  function comboTurn(order: ['red', 'blue'] | ['blue', 'red'] = ['blue', 'red']) {
    let s = newBattle();
    s.fighters[0].ki = 5;
    giveHand(s, 0, ['blue', 'red', 'golpe_basico', 'shunpo']);
    s = play(s, 0, order[0]);
    s = play(s, 0, order[1]);
    return s;
  }

  it('depois de Red + Blue nenhuma outra carta pode ser jogada; desfazer libera', () => {
    let s = comboTurn();
    expect(viewFor(s, 0).me.comboLock).toBe(true);
    const shunpo = s.fighters[0].hand.find((c) => c.id === 'shunpo')!;
    expect(playCard(s, 0, shunpo.uid).ok).toBe(false);
    const u = undoLastCard(s, 0);
    if (!u.ok) throw new Error(u.error);
    expect(viewFor(u.state, 0).me.comboLock).toBe(false);
    expect(playCard(u.state, 0, shunpo.uid).ok).toBe(true);
  });

  it('funciona em qualquer ordem e cria o Hollow Purple no turno seguinte', () => {
    for (const order of [['blue', 'red'], ['red', 'blue']] as const) {
      const { state, events } = readyAndResolve(comboTurn([...order]));
      expect(events.some((e) => e.type === 'combo' && e.player === 0)).toBe(true);
      const hand = state.fighters[0].hand.map((c) => c.id);
      expect(hand).toContain('hollow_purple');
      expect(hand).toHaveLength(RULES.drawPerTurn + 1);
      expect(state.fighters[0].lockedTo).toBe('hollow_purple');
    }
  });

  it('no turno travado só o Hollow Purple pode ser jogado, de graça, e causa exatamente 30', () => {
    let s = readyAndResolve(comboTurn()).state;
    const other = s.fighters[0].hand.find((c) => c.id !== 'hollow_purple')!;
    expect(playCard(s, 0, other.uid).ok).toBe(false);
    s.fighters[1].block = 0;
    const hp = s.fighters[1].hp;
    giveHand(s, 1, ['haki']);
    s = play(s, 1, 'haki');
    const kiBefore = s.fighters[0].ki;
    s = play(s, 0, 'hollow_purple');
    expect(s.fighters[0].ki).toBe(kiBefore);
    const { state } = readyAndResolve(s);
    // Ignora o Bloqueio do Haki e o Vulnerável do Blue.
    expect(state.fighters[1].hp).toBe(hp - 30);
    expect(state.fighters[0].exhausted.map((c) => c.id)).toContain('hollow_purple');
    // O Ki do turno travado não acumula.
    expect(state.fighters[0].ki).toBe(RULES.kiPerTurn);
    expect(state.fighters[0].lockedTo).toBeNull();
  });

  it('Hollow Purple não jogado some no fim do turno', () => {
    const s = readyAndResolve(comboTurn()).state;
    const { state } = readyAndResolve(s);
    const all = [...state.fighters[0].hand, ...state.fighters[0].drawPile, ...state.fighters[0].discard];
    expect(all.some((c) => c.id === 'hollow_purple')).toBe(false);
    expect(state.fighters[0].exhausted.map((c) => c.id)).toContain('hollow_purple');
  });

  it('Kage Bunshin no meio gera só 1 Hollow Purple', () => {
    let s = newBattle();
    s.fighters[0].ki = 5;
    giveHand(s, 0, ['kage_bunshin', 'blue', 'red']);
    s.fighters[0].ki = 6; // forçado só para caber as 3 cartas no teste
    s = play(s, 0, 'kage_bunshin');
    s = play(s, 0, 'blue');
    s = play(s, 0, 'red');
    const { state } = readyAndResolve(s);
    expect(state.fighters[0].hand.filter((c) => c.id === 'hollow_purple')).toHaveLength(1);
  });

  it('sem combo se a partida acabou no turno', () => {
    let s = comboTurn();
    s.fighters[1].hp = 5;
    const { state, events } = readyAndResolve(s);
    expect(state.phase).toBe('over');
    expect(events.some((e) => e.type === 'combo')).toBe(false);
  });
});

describe('novas habilidades', () => {
  it('Infinity desvia da próxima habilidade inteira (todos os golpes), mesmo jogado depois', () => {
    let s = newBattle();
    giveHand(s, 0, ['gatling', 'golpe_basico']);
    giveHand(s, 1, ['infinity']);
    s.fighters[0].ki = 5;
    s = play(s, 0, 'gatling');
    s = play(s, 0, 'golpe_basico');
    s = play(s, 1, 'infinity');
    const { state, events } = readyAndResolve(s);
    expect(events.some((e) => e.type === 'evade' && e.cardId === 'gatling')).toBe(true);
    expect(state.fighters[1].hp).toBe(60 - 6); // só o Golpe Básico acerta
  });

  it('Infinity desvia do Hollow Purple', () => {
    let s = newBattle();
    s.fighters[0].lockedTo = 'hollow_purple';
    s.fighters[0].hand = [{ uid: 'hp', id: 'hollow_purple' }];
    giveHand(s, 1, ['infinity']);
    s = play(s, 0, 'hollow_purple');
    s = play(s, 1, 'infinity');
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(60);
  });

  it('Boogie Woogie devolve a próxima habilidade no atacante', () => {
    let s = newBattle();
    giveHand(s, 0, ['getsuga']);
    giveHand(s, 1, ['boogie_woogie']);
    s = play(s, 0, 'getsuga');
    s = play(s, 1, 'boogie_woogie');
    const { state, events } = readyAndResolve(s);
    expect(events.some((e) => e.type === 'reflect')).toBe(true);
    expect(state.fighters[1].hp).toBe(60);
    expect(state.fighters[0].hp).toBe(60 - 14);
  });

  it('Boogie Woogie também devolve golpe carregado', () => {
    let s = newBattle();
    giveHand(s, 0, ['kamehameha']);
    s = play(s, 0, 'kamehameha');
    s = readyAndResolve(s).state;
    giveHand(s, 1, ['boogie_woogie']);
    s = play(s, 1, 'boogie_woogie');
    const { state } = readyAndResolve(s);
    expect(state.fighters[0].hp).toBe(60 - 18);
    expect(state.fighters[1].hp).toBe(60);
  });

  it('Técnica Reversa cura 10 sem passar do máximo e é exaurida', () => {
    let s = newBattle();
    s.fighters[0].hp = 45;
    giveHand(s, 0, ['tecnica_reversa']);
    s = play(s, 0, 'tecnica_reversa');
    let r = readyAndResolve(s);
    expect(r.state.fighters[0].hp).toBe(55);
    expect(r.state.fighters[0].exhausted.map((c) => c.id)).toContain('tecnica_reversa');
    s = newBattle();
    s.fighters[0].hp = 56;
    giveHand(s, 0, ['tecnica_reversa']);
    s = play(s, 0, 'tecnica_reversa');
    r = readyAndResolve(s);
    expect(r.state.fighters[0].hp).toBe(60);
  });

  it('Black Flash causa 20 como primeira carta e 8 depois', () => {
    let s = newBattle();
    giveHand(s, 0, ['black_flash']);
    s = play(s, 0, 'black_flash');
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(40);
    s = newBattle();
    giveHand(s, 0, ['shunpo', 'black_flash']);
    s = play(s, 0, 'shunpo');
    s = play(s, 0, 'black_flash');
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(52);
  });

  it('Ki Blast custa 1 e causa 3 duas vezes', () => {
    let s = newBattle();
    giveHand(s, 0, ['ki_blast']);
    s = play(s, 0, 'ki_blast');
    expect(s.fighters[0].ki).toBe(2);
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(54);
  });

  it('Haki do Rei atordoa 1 turno e reduz o Ki máximo do oponente em 2 por 2 turnos', () => {
    let s = newBattle();
    s.fighters[1].ki = 5;
    giveHand(s, 0, ['haki_do_rei']);
    s = play(s, 0, 'haki_do_rei');
    let r = readyAndResolve(s);
    s = r.state;
    // Turno 2: atordoado e com Ki máximo 3.
    expect(s.fighters[1].stunnedNow).toBe(true);
    expect(viewFor(s, 1).me.maxKi).toBe(3);
    expect(s.fighters[1].ki).toBe(3);
    expect(playCard(s, 1, s.fighters[1].hand[0].uid)).toEqual({ ok: false, error: 'Você está atordoado neste turno.' });
    s = readyAndResolve(s).state;
    // Turno 3: já pode jogar, mas o Ki máximo ainda é 3.
    expect(s.fighters[1].stunnedNow).toBe(false);
    expect(viewFor(s, 1).me.maxKi).toBe(3);
    s = readyAndResolve(s).state;
    // Turno 4: volta ao normal.
    expect(viewFor(s, 1).me.maxKi).toBe(5);
  });
});

describe('Máscara Hollow', () => {
  it('Cero carrega 1 turno e causa 16', () => {
    let s = newBattle();
    giveHand(s, 0, ['cero']);
    s = play(s, 0, 'cero');
    let r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(60);
    r = readyAndResolve(r.state);
    expect(r.state.fighters[1].hp).toBe(44);
  });

  it('Hollowficação dá +2 de Força e custa 2 HP por turno', () => {
    let s = newBattle();
    giveHand(s, 0, ['hollowficacao']);
    s = play(s, 0, 'hollowficacao');
    let r = readyAndResolve(s);
    expect(r.state.fighters[0].strength).toBe(2);
    expect(r.state.fighters[0].hp).toBe(58);
    s = r.state;
    giveHand(s, 0, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(60 - 8);
    expect(r.state.fighters[0].hp).toBe(56);
  });

  it('Sonído dá 4 de Bloqueio e +3 só no próximo ataque, em todos os golpes dele', () => {
    let s = newBattle();
    giveHand(s, 0, ['sonido', 'ki_blast', 'golpe_basico']);
    s = play(s, 0, 'sonido');
    s = play(s, 0, 'ki_blast');
    s = play(s, 0, 'golpe_basico');
    giveHand(s, 1, ['golpe_basico']);
    s = play(s, 1, 'golpe_basico');
    const { state } = readyAndResolve(s);
    // Ki Blast: (3+3)×2 = 12; Golpe Básico: 6 sem bônus.
    expect(state.fighters[1].hp).toBe(60 - 12 - 6);
    // Bloqueio de 4 absorve parte do golpe de 6.
    expect(state.fighters[0].hp).toBe(58);
  });
});

describe('prévia de dano na carta', () => {
  it('soma Força, Vulnerável do oponente e cartas já na fila', () => {
    let s = newBattle();
    s.fighters[0].strength = 2;
    giveHand(s, 0, ['kaioken', 'golpe_basico', 'chidori']);
    expect(previewCardDamage(viewFor(s, 0), 'golpe_basico')).toEqual({ base: 6, value: 8 });
    s = play(s, 0, 'kaioken');
    expect(previewCardDamage(viewFor(s, 0), 'golpe_basico')).toEqual({ base: 6, value: 11 });
    s.fighters[1].vulnerable = 1;
    expect(previewCardDamage(viewFor(s, 0), 'golpe_basico')).toEqual({ base: 6, value: 13 });
  });

  it('Fraco reduz; golpe carregado e dano fixo não têm prévia', () => {
    const s = newBattle();
    s.fighters[0].weak = 1;
    expect(previewCardDamage(viewFor(s, 0), 'golpe_basico')).toEqual({ base: 6, value: 4 });
    expect(previewCardDamage(viewFor(s, 0), 'kamehameha')).toBeNull();
    expect(previewCardDamage(viewFor(s, 0), 'hollow_purple')).toBeNull();
    expect(previewCardDamage(viewFor(s, 0), 'defesa_basica')).toBeNull();
  });

  it('Black Flash mostra 20 como primeira carta; Sonído vai para o primeiro ataque', () => {
    let s = newBattle();
    giveHand(s, 0, ['black_flash', 'sonido', 'ki_blast', 'golpe_basico']);
    expect(previewCardDamage(viewFor(s, 0), 'black_flash')).toEqual({ base: 20, value: 20 });
    s = play(s, 0, 'sonido');
    expect(previewCardDamage(viewFor(s, 0), 'ki_blast')).toEqual({ base: 3, value: 6 });
    s = play(s, 0, 'ki_blast');
    expect(previewCardDamage(viewFor(s, 0), 'golpe_basico')).toEqual({ base: 6, value: 6 });
  });
});

describe('Scouter', () => {
  it('Leitura de Poder revela o oponente e permite pôr uma carta na frente', () => {
    let s = newBattle();
    s.fighters[0].ki = 5;
    giveHand(s, 0, ['golpe_basico', 'black_flash', 'leitura_de_poder']);
    giveHand(s, 1, ['pistol']);
    s = play(s, 1, 'pistol');
    s = play(s, 0, 'golpe_basico');
    s = play(s, 0, 'black_flash');
    const bf = s.fighters[0].queue[1].card.uid;
    expect(moveToFront(s, 0, bf).ok).toBe(false); // ainda sem Leitura de Poder
    s = play(s, 0, 'leitura_de_poder');
    expect(viewFor(s, 0).opponent.queue?.map((q) => q.card.id)).toEqual(['pistol']);
    expect(viewFor(s, 0).me.canReorder).toBe(true);
    const r = moveToFront(s, 0, bf);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.fighters[0].queue.map((q) => q.card.id)).toEqual(['black_flash', 'golpe_basico', 'leitura_de_poder']);
    // Black Flash agora é a primeira carta: 20 + Golpe Básico 6.
    expect(readyAndResolve(r.state).state.fighters[1].hp).toBe(60 - 26);
  });

  it('Big Bang Attack ganha +6 contra Bloqueio', () => {
    let s = newBattle();
    giveHand(s, 0, ['big_bang_attack']);
    giveHand(s, 1, ['defesa_basica']);
    s = play(s, 0, 'big_bang_attack');
    s = play(s, 1, 'defesa_basica');
    // 12 + 6 = 18, 5 bloqueados.
    expect(readyAndResolve(s).state.fighters[1].hp).toBe(60 - 13);
  });

  it('Final Flash carrega 1 turno e causa 28', () => {
    let s = newBattle();
    giveHand(s, 0, ['final_flash']);
    s = play(s, 0, 'final_flash');
    const r = readyAndResolve(readyAndResolve(s).state);
    expect(r.state.fighters[1].hp).toBe(32);
  });
});

describe('Kunai e Saquê', () => {
  it('Kunai custa 0 e causa 4; Saquê cura 6 e é exaurido', () => {
    let s = newBattle();
    s.fighters[0].hp = 50;
    giveHand(s, 0, ['kunai', 'saque']);
    s = play(s, 0, 'kunai');
    expect(s.fighters[0].ki).toBe(3);
    s = play(s, 0, 'saque');
    const { state } = readyAndResolve(s);
    expect(state.fighters[1].hp).toBe(56);
    expect(state.fighters[0].hp).toBe(56);
    expect(state.fighters[0].exhausted.map((c) => c.id)).toContain('saque');
  });
});

describe('Modo Sábio', () => {
  it('dá +1 de Força e +1 carta nos 2 turnos seguintes e depois acaba', () => {
    let s = newBattle();
    giveHand(s, 0, ['modo_sabio']);
    s = play(s, 0, 'modo_sabio');
    s = readyAndResolve(s).state;
    // Turno 2
    expect(s.fighters[0].tempStrength).toBe(1);
    expect(s.fighters[0].hand).toHaveLength(RULES.drawPerTurn + 1);
    giveHand(s, 0, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    s = readyAndResolve(s).state;
    expect(s.fighters[1].hp).toBe(60 - 7);
    // Turno 3: ainda ativo
    expect(s.fighters[0].tempStrength).toBe(1);
    s = readyAndResolve(s).state;
    // Turno 4: acabou
    expect(s.fighters[0].tempStrength).toBe(0);
    expect(s.fighters[0].hand).toHaveLength(RULES.drawPerTurn);
  });
});
