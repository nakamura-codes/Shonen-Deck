import { describe, expect, it } from 'vitest';
import { EMPTY_OUTFIT } from '@oficina/shared';
import { MemoryStore, type Account } from '../src/store.ts';

const account = (key: string, wins = 0, losses = 0): Account => ({
  key, name: key, wins, losses, botWins: 0, botLosses: 0, createdAt: 123, salt: '', hash: '', outfit: '{}',
});

describe('perfil público', () => {
  it('usa todas as partidas para favoritos e tempo, mas só devolve os últimos 20 sets', async () => {
    const store = new MemoryStore();
    await store.createAccount(account('ana', 3, 1));
    await store.createAccount(account('bia', 40));
    await store.createAccount(account('leo'));
    for (let i = 0; i < 24; i++) {
      await store.recordMatch({ id: String(i), account: 'ana', opponent: 'bia', result: i % 2 ? 'win' : 'draw',
        at: 100 + i, durationMs: 30000, arena: 'dojo', turns: 3,
        outfit: { ...EMPTY_OUTFIT, head: i < 15 ? 'scouter' : 'bandana_ninja' } });
    }
    const profile = await store.profileSummary('ana');
    expect(profile).toMatchObject({ rank: 2, recordedMatches: 24, draws: 12, playMs: 720000,
      favorites: { head: { id: 'scouter', count: 15 }, body: null, hand: null } });
    expect(profile.history).toHaveLength(20);
    expect(profile.history[0]).toEqual({ opponent: 'bia', result: 'win', at: 123,
      outfit: { ...EMPTY_OUTFIT, head: 'bandana_ninja' } });
    expect((await store.profileSummary('leo')).rank).toBeNull();
  });
  it('mantém bloqueios independentes e pedidos na direção correta', async () => {
    const store = new MemoryStore();
    await store.createAccount(account('ana'));
    await store.createAccount(account('bia'));
    const pair = store.pair('bia', 'ana');
    pair.requested = 'bia';
    store.savePair(pair);
    expect(store.contacts('ana')).toEqual([{ name: 'bia', state: 'incoming' }]);
    expect(store.contacts('bia')).toEqual([{ name: 'ana', state: 'outgoing' }]);
    store.savePair({ ...pair, requested: null, blockFirst: true, blockSecond: true });
    store.savePair({ ...store.pair('ana','bia'), blockFirst: false });
    expect(store.contacts('ana')).toEqual([]);
    expect(store.contacts('bia')).toEqual([{ name: 'ana', state: 'blocked' }]);
  });
});
