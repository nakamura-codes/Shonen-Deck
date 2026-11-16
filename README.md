# Oficina Duel

Deckbuilder PvP em pixel art, no estilo Slay the Spire, com poderes de anime: Kamehameha, Getsuga Tenshou, Gomu Gomu no Gatling, Rasengan e outros.

O personagem começa totalmente cinza. Na criação, o jogador escolhe a roupa inicial e as outras peças ficam no inventário para vestir depois. As peças vestidas (cabeça e corpo) definem o baralho: cada uma coloca 3 poderes nele.

O personagem e o inventário ficam salvos no navegador, já que ainda não há contas.

Projeto pessoal, ainda em protótipo.

## Como rodar

Precisa do Node 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:5173.

- **Treinar com bot:** joga sozinho contra a IA.
- **Procurar oponente:** abra o jogo em duas abas (ou em dois computadores na mesma rede) para jogar PvP de verdade.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Testes do motor de batalha |
| `npm run typecheck` | Checa os tipos de todo o projeto |
| `npm run art` | Processa a arte das cartas (veja abaixo) |
| `npm run art:character` | Processa as figuras do personagem e os ícones das roupas |
| `npm run build` | Gera a versão de produção do cliente em `client/dist` |

## Regras

- 60 de HP, 3 de **Ki** por turno, 5 cartas por turno.
- **Turnos simultâneos com 30s:** os dois escolhem as cartas em segredo, clicam em **Confirmar** e tudo é revelado junto.
- Ordem da resolução:
  1. Bloqueio.
  2. Buffs, debuffs e poderes.
  3. Golpes carregados.
  4. Ataques.
- Ataques da mesma fase são simultâneos. Se os dois caírem no mesmo turno, dá empate.
- **Bloqueio** some no início do turno.
- **Força** soma dano em cada golpe.
- **Fraco** reduz o dano em 25%.
- **Vulnerável** faz o alvo receber 50% a mais de dano.
- **Golpes carregados** (Kamehameha, Genki Dama) ficam visíveis para o oponente enquanto carregam.
- **Sharingan** mostra as cartas que o oponente escolheu no turno.
- **Poderes** (Bankai, Gear Second, Domain Expansion) ficam ativos até o fim da partida.
- Se um jogador desconectar e não voltar em 30s, perde a partida.

## Estrutura

```
shared/   motor de batalha puro (regras, cartas, roupas, protocolo), usado pelo servidor e pelo cliente
server/   servidor WebSocket autoritativo: pareamento, timer de turno, bot, validação das jogadas
client/   jogo em Phaser 3: guarda-roupa, fila e batalha
tools/    script que processa a arte das cartas
art/raw/  imagens originais das cartas (geradas no ChatGPT)
docs/     prompts usados para gerar a arte
```

O servidor é a fonte da verdade. O cliente só envia intenções ("jogar a carta X"), e o servidor valida a jogada:
- a carta precisa estar na mão;
- precisa ter Ki suficiente;
- o turno não pode estar confirmado ainda.

## Balanceamento

- **Cartas:** os números e textos ficam em `shared/src/cards.ts`.
- **Roupas:** quais cartas cada peça dá fica em `shared/src/outfits.ts`.
- **Regras gerais:** HP, Ki e cartas por turno ficam em `RULES`, em `shared/src/engine.ts`.

## Arte das cartas

1. Gere a imagem com os prompts de `docs/prompts-cartas.md`.
2. Salve em `art/raw/<id>.png`. O `<id>` é a chave da carta em `cards.ts`, por exemplo `gatling.png`.
3. Rode `npm run art`. O script:
   - reduz a imagem para 64×64 com paleta limpa;
   - recorta em hexágono;
   - aplica a moldura da raridade (prata = comum, ouro = rara, roxo = poder);
   - grava em `client/public/assets/cards/`.

Carta sem arte aparece com um ícone provisório.

## Personagem e roupas

As imagens originais ficam em `art/raw/character/`:

| Arquivo | Conteúdo |
|---|---|
| `humanoide_cinza.png` | Boneco cinza sem roupa |
| `seis_visuais.png` | Cada peça de cabeça e de corpo sozinha |
| `nove_combinacoes.png` | As 3×3 combinações de cabeça + corpo |
| `icones_roupas.png` | Ícones do inventário |

`npm run art:character` processa essas imagens:
- recorta as 16 figuras (cada combinação, incluindo espaço vazio);
- coloca todas na mesma escala;
- alinha pelos pés;
- grava em `client/public/assets/character/` e `client/public/assets/items/`.

Quais cartas cada peça dá fica em `shared/src/outfits.ts`.

**Para adicionar uma peça nova:**
1. Gere a figura dela com cada peça do outro espaço.
2. Gere o ícone.
3. Atualize o script e o `outfits.ts`.
