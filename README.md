# Efeito Manada

Um jogo de festa em tempo real para 2 a 6 jogadores. A cada rodada, todos
respondem à mesma pergunta; você ganha um ponto se ficar com **a manada** (o
maior grupo de respostas iguais). Dê uma resposta que ninguém mais deu e você
recebe a **Vaca Rosa** — e quem está com a Vaca Rosa não pode vencer até passá-la
adiante. O primeiro a chegar a 8 pontos vence.

Antes de começar, o anfitrião escolhe de onde vêm as perguntas:

- **Do baralho** — cada rodada sorteia uma pergunta pronta.
- **Dos jogadores** — os jogadores se revezam (na ordem de entrada); na sua vez,
  você escreve a pergunta da rodada ou sorteia uma do baralho.

Também no lobby: **pontos para vencer** (5, 8 ou 12), **categorias** do baralho e
um **tempo para responder** opcional (30/45/60s — quem não responder a tempo fica
de fora da rodada). Se dois ou mais jogadores empatarem no alvo, o jogo segue em
**desempate** até alguém ficar na frente sozinho.

Regras opcionais da Vaca Rosa (lobby):

- **Rodadas da Vaca** — a cada 4 rodadas ou de surpresa, o objetivo se inverte:
  quem responde **sozinho** ganha 1 ponto e a manada não pontua (a vaca não muda
  de dono nessas rodadas).
- **Leite azedo** — quem passar uma rodada inteira com a Vaca Rosa perde 1 ponto
  (nunca abaixo de zero).

- **Backend** — FastAPI + SQLModel (SQLite), jogo via WebSockets
- **Frontend** — Next.js 16 (App Router) + React 19 + Tailwind v4

## Rodando localmente

### Backend (porta 8000)

```bash
cd backend
uv sync
cp .env.example .env          # opcional; os padrões já funcionam
uv run uvicorn app.main:app --reload
```

### Frontend (porta 3000)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # aponta para http://localhost:8000
npm run dev
```

Abra http://localhost:3000, crie um jogo e compartilhe o código de sala de 4 letras.

## Rodando com Docker (uma porta só, para ngrok)

Frontend, API e WebSocket ficam atrás de um proxy reverso (Caddy) numa **única
porta**, então dá para expor tudo com um único túnel.

```bash
docker compose up --build          # abre http://localhost:3000
ngrok http 3000                    # compartilhe a URL do ngrok com os amigos
```

- Só o serviço `proxy` publica uma porta. Ele roteia `/api/*` e `/ws/*` para a
  API e todo o resto para o Next.js.
- O front usa caminhos relativos (`/api`, `/ws`), então funciona em qualquer
  host — `localhost`, LAN ou a URL do ngrok — sem rebuild.
- Para usar outra porta no host: `PORT=8080 docker compose up` (o contêiner e o
  Caddyfile continuam em 3000; é a porta 3000 do contêiner que você tuneliza).
- O SQLite fica no volume `herd-data`, então os jogos sobrevivem a um restart.
- No **ngrok grátis** aparece uma tela de aviso na primeira visita de cada
  navegador — basta clicar em "Visit Site" uma vez.
- O `docker build` do front baixa as fontes do Google (`next/font`), então
  precisa de internet na hora de buildar.

## Testes

```bash
cd backend && uv run pytest
```

Cobrem o motor de pontuação, a normalização de respostas e um fluxo de jogo
completo via REST + WebSocket.

## Como uma rodada funciona

`lobby → question → reveal → scoring → (question | game_over)`

- **question** – os jogadores enviam as respostas; a rodada avança sozinha quando
  todos os jogadores conectados responderam.
- **reveal** – as respostas são agrupadas automaticamente por uma comparação de
  texto tolerante; o anfitrião pode juntar/separar grupos antes de pontuar (ex.:
  "SP" em "São Paulo").
- **scoring** – a manada ganha +1 cada (empate no maior grupo = ninguém pontua);
  quem respondeu sozinho leva a Vaca Rosa.
- **game_over** – o primeiro jogador elegível a alcançar `WIN_TARGET` (padrão 8).

## Estrutura

```
backend/app/
  api/          endpoints REST (rooms) + WebSocket (ws)
  game/         engine (pontuação/vaca/vitória), normalize, questions, room_service, manager
  models.py     tabelas SQLModel
  data/questions.json
frontend/
  app/          página inicial + tela de jogo room/[code]
  components/   Lobby, QuestionCard, RevealBoard, ResultsBoard, GameOver, Scoreboard
  lib/          api, useGameSocket, session, types
```
