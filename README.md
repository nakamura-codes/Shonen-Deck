# Oficina Duel

Deckbuilder PvP em pixel art, no estilo Slay the Spire, com poderes de anime: Kamehameha, Getsuga Tenshou, Gomu Gomu no Gatling, Rasengan e outros.

O personagem começa totalmente cinza. Na criação, o jogador escolhe a roupa inicial e as outras peças ficam no inventário para vestir depois. As peças vestidas (cabeça, corpo e acessório) definem o baralho: cada uma coloca 3 poderes nele.

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
| `npm run art:arenas` | Processa as arenas |
| `npm run art:frames` | Processa as molduras das cartas (ataque, técnica, poder e verso) |
| `npm run build` | Gera a versão de produção do cliente em `client/dist` |

Para testar com embaralhamento e moeda fixos: `SEED=13 npm run dev`.

## Regras

- 60 de HP e 5 cartas por turno.
- **Ki:** recebe 3 por turno. O que sobra passa para o próximo turno, até o máximo de 5.
- **Turnos simultâneos com 30s:** os dois escolhem as cartas em segredo, clicam em **Confirmar** e tudo é revelado junto.
- **Moeda:** no início da partida, uma moeda sorteia quem começa. Depois os dois se alternam a cada turno.
- Ordem da resolução:
  1. **Armadura:** cartas de defesa sem dano (Bloqueio, Infinity, Boogie Woogie), para a defesa sempre funcionar.
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

### Habilidades especiais
- **Infinity** (2 Ki): desvia da próxima habilidade de dano do oponente no turno, com todos os golpes dela. Funciona também contra golpes carregados e contra o Hollow Purple.
- **Boogie Woogie** (2 Ki): troca de lugar com o oponente na hora do golpe; a próxima habilidade de dano dele no turno acerta ele mesmo.
- **Técnica Reversa** (2 Ki): recupera 10 HP. Exaurir.
- **Black Flash** (2 Ki): 8 de dano, ou 20 se for a primeira carta que você joga no turno.
- **Ki Blast** (1 Ki): 3 de dano duas vezes.
- **Cero** (2 Ki): carrega 1 turno e depois causa 16 de dano.
- **Hollowficação** (2 Ki, Poder): +2 de Força até o fim da partida; perde 2 HP no início de cada turno.
- **Sonído** (0 Ki): 4 de Bloqueio, e o próximo ataque do turno causa +3 em cada golpe.
- **Leitura de Poder** (1 Ki, Scouter): vê as cartas do oponente neste turno, e você pode clicar numa carta da sua jogada para ela resolver primeiro.
- **Big Bang Attack** (2 Ki, Scouter): 12 de dano; +6 se o oponente estiver com Bloqueio.
- **Final Flash** (3 Ki, Scouter): carrega 1 turno e depois causa 28 de dano.
- **Haki do Rei** (3 Ki):
  - o oponente fica atordoado no turno seguinte e não pode jogar cartas;
  - o Ki máximo dele cai 2 por 2 turnos;
  - Exaurir.

### Arenas
Cada partida sorteia uma arena pela seed, então os dois jogadores veem a mesma. As imagens originais ficam em `art/raw/arenas/`, e `npm run art:arenas` as prepara. A lista de arenas fica em `shared/src/arenas.ts`.

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
| `combinacoes_naruto_hollow.png` | Cada cabeça com o uniforme ninja, e a máscara Hollow com cada corpo |
| `mascara_hollow.png` / `uniforme_naruto.png` | As duas peças novas sozinhas (os ícones delas são recortados daqui) |
| `icones_roupas.png` | Ícones do inventário |

`npm run art:character` processa essas imagens:
- recorta as 25 figuras (cada combinação, incluindo espaço vazio);
- coloca todas na mesma escala;
- alinha pelos pés;
- grava em `client/public/assets/character/` e `client/public/assets/items/`.

Quais cartas cada peça dá fica em `shared/src/outfits.ts`.

**Para adicionar uma peça nova:**
1. Gere a figura dela com cada peça do outro espaço.
2. Gere o ícone.
3. Atualize o script e o `outfits.ts`.

### Acessórios
O acessório é uma camada desenhada por cima da figura (`client/public/assets/character/acc_<id>.png`, 64×80). O Scouter vem de `art/raw/character/scouter.jpg`, que é o boneco cinza usando o aparelho. O `npm run art:character` recorta só o aparelho e o coloca na posição da cabeça.

### Molduras das cartas
As imagens ficam em `art/raw/cards_frames/`, com as áreas de conteúdo pintadas de magenta (#FF00FF). O `npm run art:frames`:
- reduz as molduras para 156×234;
- troca o magenta por transparente;
- gera `client/src/cardFrames.generated.ts` com a posição de cada área (custo, arte, nome, texto e tipo).

Para trocar uma moldura, basta substituir a imagem e rodar o comando de novo.
