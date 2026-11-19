# Balanceamento PvP — 200 HP

Objetivo: partidas estratégicas de aproximadamente 10–15 min com jogadores usando a maior parte do tempo de escolha. Partidas agressivas ou rápidas podem acabar antes; não é uma duração mínima garantida.

- 200 HP; 3 Ki inicial/por rodada, máximo 5, compra 5 cartas, 30 s de escolha. Limite 24 rodadas; no fim vence o maior HP, empate se igual. O limite teórico com buffers de animação de até 8 s é perto de 15 min, sem contar latência.
- Genki Dama: 5 Ki, 100 dano base, disparo na quarta rodada contando a rodada de lançamento (3 ticks posteriores); cancelamento ao sofrer 25+ HP de dano em uma rodada antes de disparar; exaurida. O custo impede duplicação com Kage Bunshin (5+1 Ki > máximo 5). Bloqueio, esquiva, reflexão e modificadores continuam válidos.
- Ataques, curas, bloqueio e força revistos; controladores qualitativos (Kage Bunshin, Infinity, Leitura de Poder, Haki do Rei, Blue, Boogie Woogie, Kawarimi, Domain Expansion aposentada) mantidos para preservar contrajogo.
- Danos de combo Hollow Purple e Big Bang Attack: 50 fixos, condições originais. O bot desconta o valor de cargas mais distantes.
- Validação necessária: npm test, npm run typecheck, npm run build, e partidas PvP reais para calibrar duração mediana e taxa de vitória por equipamento. Não altera saves ou branch social.
