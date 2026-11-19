import { describe, expect, it } from 'vitest';
import { MemoryStore, type Account, type RecordedMatch } from '../src/store.ts';
describe('histórico PvP',()=>{
  it('preserva resultados antigos e registra o set sem duplicar vitórias',async()=>{
    const store=new MemoryStore();
    const acc:Account={key:'a',name:'A',salt:'x',hash:'x',outfit:'{}',wins:7,losses:3,botWins:0,botLosses:0,createdAt:123};
    await store.createAccount(acc);
    const row:RecordedMatch={id:'m1',account:'a',opponent:'B',result:'win',at:1000,durationMs:30000,arena:'arena',turns:3,outfit:{head:'scouter',body:null,hand:null}};
    await store.recordMatch(row);await store.recordMatch(row);await store.recordMatch({...row,id:'m2',result:'draw'});
    expect(await store.getAccount('a')).toMatchObject({wins:8,losses:3,createdAt:123});
    expect(await store.matchHistory('a')).toHaveLength(2);
    expect((await store.matchHistory('a'))[0].outfit.head).toBe('scouter');
    expect(await store.matchHistory('b')).toEqual([]);
  });
});
