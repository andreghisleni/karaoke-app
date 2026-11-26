# Fase 6 — scroll na fila, nome de quem pediu, aviso na TV e pausa entre músicas

Rodada pedida em 25/11, depois do `632be68` (o squash que você subiu com as Fases 4/5).
Quatro ajustes, todos atrás do mesmo `origin/main`, sem tocar em nada que já estava pronto:

| # | Pedido | Onde ficou |
|---|--------|-----------|
| 1 | Scroll na fila do painel de controle | `frontend/src/pages/_app/dashboard.tsx` |
| 2 | Mostrar o nome de quem pediu, quando não foi o operador | `dashboard.tsx` (e o payload já vinha do backend) |
| 3 | "O próximo a brilhar vai ser: **nome**" na TV por ~5 s antes do vídeo | `PlayerService.java` (estado `ANUNCIO`) + `TvPanel` |
| 4 | Botão de pausa entre músicas, com a TV voltando para os QR codes | `ApiController.java` (`POST /api/player/pausa`) + `dashboard.tsx` + `PlayerService.java` |

---

## 1. Scroll da fila: o culpado era o `min-h-0`

O card da direita tem `flex h-[85vh] flex-col`, o `CardContent` era `flex flex-1 flex-col
overflow-hidden` e dentro dele ficavam o bloco do player e o `ScrollArea` da fila. Um *flex item*
sem `min-h-0` tem `min-height: auto`, ou seja: **ele se recusa a ficar menor que o próprio
conteúdo**. Com a fila crescendo, o `CardContent` empurrava para fora da altura dos 85 vh e o
`overflow-hidden` cortava o resto — a lista simplesmente parava de existir visualmente antes de
qualquer barra de rolagem aparecer, e o `ScrollArea` nunca ficava menor que os itens dele, então
ele também não criava barra.

A correção são duas classes: `min-h-0` no `CardContent` (e no `Card` da esquerda, pelo mesmo
motivo) e `min-h-0 flex-1 pr-4` no `ScrollArea` da fila. Medido no navegador com a fila cheia
(20 itens):

```
viewport da fila: clientHeight = 618, scrollHeight = 1856, overflow-y = scroll
scrollTop aceitou 500 e o fundo é 1238  →  rola até o último item
```

A lista de músicas à esquerda (busca) é o mesmo `ScrollArea` e já rolava; agora os dois têm o
mesmo comportamento, e o título passou a mostrar a contagem — `Próximos a cantar (20)` — para dar
referência de quantos ainda faltam.

## 2. Nome de quem pediu (e o "Operador" que não aparece)

O backend já devolvia o nome: `FilaService` grava `nome = "Operador"` em tudo que entra pelo
painel, e o `/api/fila` / `/ws` já mandavam `nome` em cada item e `quemCanta` para a música do ar.
O que faltava era exibição. No painel:

```tsx
function quemPediu(nome?: string): string | null {
  const limpo = (nome ?? '').trim();
  if (!limpo || limpo.toLowerCase() === 'operador') return null;
  return limpo.length > 42 ? `${limpo.slice(0, 41)}…` : limpo;
}
```

* nome vazio ou `Operador` (comparação sem caixa) → linha alguma é desenhada;
* mais de 42 caracteres → corta com reticências, para o card não quebrar a coluna;
* nos itens da fila aparece `🙋 pedida por Fulano`, e ` · 2ª música dela` quando o item é do
  segundo andar (`tier === 2`) — assim dá para ver quem está esperando bis sem abrir o celular;
* no bloco "Tocando agora" aparece `🙋 pedida por Fulano` usando o mesmo filtro.

Nada novo no wire: nem IP, nem caminho de disco saem no payload público (a regressão confere
`"origem" not in json` e `"caminho" not in json`).

## 3. "O próximo a brilhar vai ser: X"

### O fluxo

`tocarProxima()` era o corpo que puxava o pedido e dava `play()`. Ela virou um **despachante**, e o
corpo antigo virou `iniciarReproducao(proximo)`:

```
tocarProxima()
  ├─ turnoEmAndamento? → só loga "tem um aviso no ar" e sai (nunca dois turnos juntos)
  ├─ pausado?          → mostrarDescanso()  (a tela dos QR codes)
  ├─ fila vazia?       → mostrarDescanso()
  ├─ segundos == 0?    → iniciarReproducao() direto (comportamento antigo)
  └─ anunciarNaTv(pedido, segundos) + thread "aviso-proximo" dorme `segundos`
       → ao acordar, se a geração do aviso não mudou: iniciarReproducao(pedido)
```

Durante o aviso o `estadoAtual` é `"ANUNCIO"` — um estado novo, tratado em três lugares (painel,
página do convidado e a TV). O `pedidoAnunciado` fica guardado porque `proxima()` já tirou a pessoa
da fila: sem isso, painel e celular mostrariam uma lista onde o nome sumiu e a TV chamando alguém
que "não está mais na fila".

### A TV

`TvPanel` ganhou `setAnuncio(nome, titulo, ms)` e um ramo `else if ("ANUNCIO")` no
`paintComponent`, com `desenhaAvisoDoProximo()`: fundo com o mesmo radial animado das outras
telas, o rótulo "O próximo a brilhar vai ser:", o **nome** grande (132 px, encolhendo até caber em
88% da largura, mínimo 44 px), `vai cantar: <título>` em itálico 46 px (cortado com reticências
pelo `encurtarNaLargura`, mesma técnica usada nos títulos longos da fila) e uma barra de tempo que
se esvazia conforme os segundos passam — para a festa saber que falta pouco sem ter que ler
cronômetro. O `setEstado()` limpa o aviso quando a TV entra em qualquer outro estado.

Captura real (1280×1024, `printar-tv.sh` durante a janela): `capturas/tv-aviso-proximo.png`.

### O tempo é configurável

`AppConfig.anunciarProximoSegundos = 5`. Aparece nas Configurações como **"Aviso na TV
(segundos)"**, com 0–30 aceito no `POST` (clamp no servidor, não só no `input`) e a regra:
**0 desliga o aviso** e a música entra direto, exatamente como era antes desta rodada.

## 4. Pausa entre músicas

* Backend: `PlayerService.definirPausa(boolean)` / `alternarPausa()` / `estaPausado()`;
  `verificarInicioAutomatico()` agora exige `!pausado`; o despachante, se estiver pausado, mostra o
  descanso em vez de chamar alguém.
* API: `POST /api/player/pausa`, no `ROTAS_PAINEL` (precisa do token do painel). Corpo `{}`
  **alterna**; corpo `{"pausado": true|false}` **fixa** — o painel usa o alternativo e responde na
  hora com `{"pausado": ..., "mensagem": ...}`, que vira o toast.
* A pausa **não corta o que está no ar**: a música do ar termina normalmente, a próxima não entra,
  e a TV volta para a tela dos QR codes (`mostrarDescanso()`) — sem perder a fila, sem perder nome,
  sem reiniciar nada.
* Botão no painel: `⏸ Pausar entre músicas` ↔ `▶ Retomar fila` (`aria-pressed`, variante
  preenchida quando pausado). Quando a pausa é apertada **durante o aviso**, o aviso é cancelado na
  hora, `filaService.devolverNoTopo(pedido)` coloca a pessoa de volta **no topo** — ela não perde a
  vez — e o retomar repete a chamada inteira em vez de emendar o vídeo no meio. Isso é feito com
  um carimbo (`avisoGeracao`): a thread do aviso acorda, vê que a geração mudou e não faz nada.
* O `/api/fila` e o `/ws` passaram a levar `pausado` e `anuncio {nome, titulo, artista, codigo}`,
  então a página do convidado (`FilaDaFesta.tsx`) e o arquivo único `convidado.html` também contam
  a mesma história: "Na TV agora · O próximo a brilhar vai ser: X" e "A fila está pausada: é só o
  anfitrião retomar."
* Detalhe de segurança operacional: durante `ANUNCIO` o botão **Pular Música fica desabilitado** no
  painel, com toast explicando. Pular durante o aviso puxaria outro turno por cima da pessoa que
  está sendo chamada.
  A guarda não é só de tela: `pularMusica()` também verifica `turnoEmAndamento` e sai sem tocar no
  `mediaPlayer`, porque a rota por PIN (a tela de operador do celular) continua alcançável com o
  botão desabilitado noutra aba. Testado: `pular` durante o aviso devolve 200, o aviso continua no
  ar, a pessoa é chamada e canta a vez dela; com música no ar o `pular` funciona como sempre.
* A thread do aviso agora liberava `turnoEmAndamento` *antes* de dar `play()`. Se o VLC recusasse o
  arquivo, a trava ficaria no ar para sempre e a fila não andaria mais. Ela foi reescrita com
  `try/catch/finally`: o carimbo é conferido, o `pedidoAnunciado` é limpo antes de largar o vídeo
  (para o status não mostrar "anúncio" e "tocando" ao mesmo tempo) e `turnoEmAndamento` é liberado
  no `finally` — só se a geração ainda for a mesma, para não derrubar a trava de um aviso novo.

## 5. Arquivos tocados

```
src/main/java/.../model/AppConfig.java              + anunciarProximoSegundos
src/main/java/.../service/FilaService.java          + devolverNoTopo()
src/main/java/.../service/PlayerService.java        + ANUNCIO, pausa, avisoGeracao, TvPanel
src/main/java/.../controller/ApiController.java     + POST /api/player/pausa, anuncio/pausado no /api/fila, campo novo no config
frontend/src/pages/_app/dashboard.tsx               scroll (min-h-0), nomes, anúncio, selo e botão de pausa
frontend/src/pages/_app/config/index.tsx            campo "Aviso na TV (segundos)"
catalogo-front/src/lib/sala.ts                      tipos anuncio/pausado
catalogo-front/src/components/FilaDaFesta.tsx       bloco "na TV agora" + aviso de fila pausada
src/main/resources/convidado.html                   fallback de arquivo único, mesma informação
src/main/resources/public/** e convidado/**         bundles rebuildados
```

Build usado (mesmo de antes): `bun run build` no `frontend` (sai direto em
`src/main/resources/public`, com `emptyOutDir`), `bun run build` no `catalogo-front` (sai em
`src/main/resources/convidado`), `mvn -o -DskipTests compile` + `process-resources`. O
`tsc --noEmit` que roda junto com o build do painel passou sem nenhum erro novo.

## 6. O que foi testado

`testar_regressao.py` ganhou o **bloco 10** (pausa exige token; alternar inverte; `/api/fila`
público expõe `pausado` e `anuncio`; pedido de convidado aceito com a fila pausada e **sem** puxar
música; nomes no payload; `Operador` presente; sem IP e sem caminho de disco; round-trip e clamp de
`anunciarProximoSegundos`). Resultado: **FALHAS: nenhuma**, com os outros 9 blocos continuando
verdes.

Além disso, dois scripts específicos desta rodada (ficaram em `entrega/codigo/v3-*/testes/`):

* `testar_aviso_pausa.py` — 9 grupos: 401 sem token, alternância, mensagem, `anuncio` com nome e
  título, `0 s` não passa por `ANUNCIO`, nomes vindos do servidor, `Operador` presente no payload,
  ausência de IP/disco.
* `testar_aviso_pausa2.py` — a máquina de estados com o player parado de verdade: pausa no meio do
  aviso devolve ao topo e limpa o aviso; retomar **reavisa a mesma pessoa** e depois toca; aviso de
  2 s larga o vídeo em ~2,1 s; `0` vai direto; screenshots da TV nos dois estados.
  Resultado: **FALHAS: nenhuma** (23 verificações).

No navegador (URL pública, fila com 20 pessoas): scroll medido e visto rolando até o item 20, `🙋
pedida por …` em 18 itens e nenhum nos 2 adicionados pelo painel, `Próximos a cantar (20)` → `(19)`
quando a pessoa é chamada, bloco "🎙 Chamando na TV / Ana Beatriz / vai cantar "'o Surdato
'nnammurato"", botão trocando de rótulo com o toast correspondente, e Pular durante o aviso
desabilitado.

## 7. Decisões e limites conscientes

* **Nome é o que a pessoa digitou.** Não existe validação de identidade, e é assim de propósito: a
  TV mostra o que o convidado escreveu. Se a festa quiser "só entra na TV quem o operador
  aprovar", o lugar certo é a tela de pedidos (aprovar antes de por na fila), não o aviso.
* **Não há áudio no aviso.** É só tela; nenhum `mediaPlayer` é tocado, e o volume/roteamento de
  áudio continua sendo decisão exclusiva do `iniciarReproducao()`.
* **Pausar nunca interrompe a música do ar.** Se você quiser "cortar na hora", é outra função
  (`pularMusica` já existe e faz isso); a pausa foi desenhada para o intervalo, que é o pedido.
* `turnoEmAndamento` é uma trava simples, não uma fila de turnos: se algo chamar `tocarProxima()`
  durante os 5 s do aviso, o pedido só é considerado no turno seguinte. Como o aviso dura segundos
  e a fila é persistida em memória por `FilaService`, nada se perde.
* O bundle novo do painel (`index-sLSCtQjk.js`) inclui um selo discreto "fila pausada: a próxima só
  sai ao retomar" que aparece ao lado de "Tocando agora" quando a pausa foi apertada no meio de uma
  música — é o único item desta rodada que eu não consegui fotografar no navegador porque o proxy
  de teste da sandbox serve o `index.html` em cache; o código compila (`tsc --noEmit`), a string
  está no bundle servido, e na sua máquina (acesso direto ao `localhost:7000`) não há esse cache.
