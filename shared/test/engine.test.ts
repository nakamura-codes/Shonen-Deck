import { describe, expect, it } from 'vitest';
import {
  CARDS,
  EMPTY_OUTFIT,
  figureKey,
  OUTFIT_ITEMS,
  RULES,
  buildDeck,
  createBattle,
  playCard,
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

function newBattle(seed = 1): BattleState {
  return createBattle(seed, [
    { name: 'A', outfit: FULL },
    { name: 'B', outfit: FULL },
  ]);
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
    for (const id of Object.keys(CARDS)) if (!id.endsWith('_basico') && id !== 'defesa_basica') expect(fromItems.has(id), id).toBe(true);
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

  it('Rasengan aplica Vulnerável e o próximo golpe causa 50% a mais', () => {
    let s = newBattle();
    giveHand(s, 0, ['rasengan']);
    s = play(s, 0, 'rasengan');
    let r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(48);
    s = r.state;
    giveHand(s, 0, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    r = readyAndResolve(s);
    expect(r.state.fighters[1].hp).toBe(48 - 9);
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
    expect(r.state.fighters[0].ki).toBe(4);
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

  it('empate se os dois caem no mesmo turno', () => {
    let s = newBattle();
    s.fighters[0].hp = 5;
    s.fighters[1].hp = 5;
    giveHand(s, 0, ['golpe_basico']);
    giveHand(s, 1, ['golpe_basico']);
    s = play(s, 0, 'golpe_basico');
    s = play(s, 1, 'golpe_basico');
    const { state } = readyAndResolve(s);
    // Os ataques da mesma fase são simultâneos: os dois caem.
    expect(state.winner).toBe('draw');
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
