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

Para testar com embaralhamento e moeda fixos: `SEED=13 npm run dev`.

## Regras

- 60 de HP e 5 cartas por turno.
- **Ki:** recebe 3 por turno. O que sobra passa para o próximo turno, até o máximo de 5.
- **Turnos simultâneos com 30s:** os dois escolhem as cartas em segredo, clicam em **Confirmar** e tudo é revelado junto.
- **Moeda:** no início da partida, uma moeda sorteia quem começa. Depois os dois se alternam a cada turno.
- Ordem da resolução:
  1. **Armadura:** cartas com Bloqueio e sem dano, para a defesa sempre funcionar.
  2. **Golpes carregados** que disparam no turno.
  3. **O resto, na ordem em que cada um jogou**, alternando: 1ª de quem começa, 1ª do outro, depois as 2ªs… Buff e debuff só valem para o que vem *depois* deles.
- A partida acaba na hora em que alguém chega a 0 HP; as cartas restantes não resolvem.
- **Bloqueio** some no início do turno.
- **Força** soma dano em cada golpe.
- **Fraco** reduz o dano em 25%.
- **Vulnerável** faz o alvo receber 25% a mais de dano.
- **Golpes carregados** (Kamehameha, Genki Dama) ficam visíveis para o oponente enquanto carregam.
- **Sharingan** mostra as cartas que o oponente escolheu no turno.
- **Poderes** (Bankai, Gear Second, Domain Expansion) ficam ativos até o fim da partida.
- Se um jogador desconectar e não voltar em 30s, perde a partida.

### Combo: Red + Blue → Hollow Purple
- **Red** (3 Ki): 14 de dano. **Blue** (2 Ki): 1 de Fraco e 1 de Vulnerável. Os dois vêm do Cabelo e Venda.
- Jogar os dois no mesmo turno, em qualquer ordem, usa os 5 Ki e trava o turno: nenhuma outra carta.
  - Blue → Red causa 17 com o Vulnerável.
  - Red → Blue causa 14.
- No turno seguinte, o **Hollow Purple** chega na mão:
  - é a única carta que pode ser jogada e custa 0;
  - causa exatamente 30 de dano, ignorando Bloqueio e modificadores;
  - é Etéreo: se não for usado, some;
  - o Ki desse turno não acumula.
- Os combos ficam em `COMBOS`, em `shared/src/cards.ts`, para criar outros depois.

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
