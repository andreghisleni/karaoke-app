# Fase 3 — tela de convidado + fila justa, dentro do Java

Entregue como mudanças no repo `karaoke-app` (branch `feat/tela-convidado`). **Nada foi enviado ao
GitHub.** O patch e o zip estão em `entrega/codigo/`.

## 1. Decisão de arquitetura (com números medidos)

**Um processo só: o próprio Java serve a tela do convidado e a API.** Base:
`/home/ubuntu/work/bench/RESULTADOS.md` (Javalin 6.1.3, BD.ini real de 14.526 entradas, 11.470
arquivos no disco, 20 clientes simultâneos).

- 607 requisições de API em 32 s = 18,8 req/s, **0 erros**; busca mediana **5,3 ms**, p95 6,2 ms;
  pedido **1,1 ms**.
- Pior caso artificial (600 buscas "a" em 0,7 s): **852 req/s** sustentados com ~14% de um núcleo.
- Processo Java sob carga: **0,19 núcleo** e **169 MB de RSS** — num sandbox ARM de 6 núcleos, ou
  seja, pior que o i5 de 12ª geração / 20 GB da máquina dele. Folga enorme para rodar junto com
  QLC+ e Mixxx.
- Javalin já traz `GzipHandler` ligado: nada precisa ser "otimizado para rede".

**Tráfego real medido contra o app rodando** (rota a rota, com gzip ativo):

| Recurso | No fio (gzip) | Cru | Quando o celular baixa |
| --- | --- | --- | --- |
| `/p` (tela do convidado) | **9.072 B** | 29.864 B | uma vez, ao abrir o QR |
| `/api/musicas?q=coracao&limit=30` | 2.071 B | 6.302 B | a cada busca (debounce 220 ms) |
| `/api/fila` | 722 B | 722 B | só no fallback, a cada 5 s (o normal é WebSocket) |
| `/api/sala` | 80 B | 80 B | uma vez |
| `/api/acervo` (11.470 músicas) | 179.421 B | 511.692 B | **opcional**: só depois da 1ª busca, com atraso aleatório de 6–30 s |

20 celulares abrindo o app = **~180 KB** de rede. Se todos baixarem o acervo (para buscar sem
perguntar nada ao servidor), uns 3,5 MB — e mesmo assim o Java não faz esforço, porque a busca
passa a ser dentro do navegador. Um segundo processo local (Node/Python servindo o catálogo)
economizaria **zero** mensurável e custaria CORS, segunda porta, segunda config e mais um processo
para manter vivo na noite.

Armadilha medida no caminho: **não ligar `precompress=true` junto com `spaRoot`.** Nessa combinação
o Javalin responde `Content-Encoding: gzip` com o `Content-Length` do arquivo original (2.797)
entregando 1.257 B do `.gz` → o navegador morre com `ERR_CONTENT_LENGTH_MISMATCH`. A tela do
convidado é servida por rota própria (`/p`), que comprime por conta própria e acerta o comprimento.

## 2. O que mudou no código

| Arquivo | Mudança |
| --- | --- |
| `model/Pedido.java` (novo) | pedido com `codigo`, `nome`, `chave` (nome normalizado), `tier`, `posicao`; `musica` e `origem` são `@JsonIgnore` para não vazar disco nem IP |
| `model/ResultadoPedido.java` (novo) | `{aceito, codigoErro, mensagem, posicao, meusPendentes, naFrente, totalFila}` |
| `model/PedidoRequest.java` (novo) | `{codigo, nome}` |
| `model/AdicionarFilaRequest.java` | ganhou `codigo` e `nome` (opcional; o painel continua mandando só `musicaId`) |
| `model/AppConfig.java` | `pinAdmin`, `urlConvidado`, `maxPedidosPorPessoa`; `@JsonIgnoreProperties(ignoreUnknown = true)` |
| `model/Musica.java` | `caminho` agora `@JsonIgnore` (a API devolvia o caminho do disco para qualquer celular da rede) + campos de índice `@JsonIgnore` |
| `service/FilaService.java` (novo) | regra dos dois andares, cota, duplicata, rate-limit por IP (30 pedidos/min), cancelar, admin, `emCena` |
| `service/CatalogoService.java` | `id` = código do BD.ini (sobrevive a restart; antes era um `UUID` novo a cada varredura), índice `porCodigo`, blob de busca minúsculo sem acento, ranking por relevância, A-Z na busca vazia, `acervo()`, `buscarPorCodigo()`; **leitura do BD.ini com charset explícito** |
| `service/SalaService.java` (novo) | detecta o IP da festa, monta a URL `/p`, gera o QR com zxing em escala inteira de pixel, cacheia o PNG, aceita URL forçada |
| `service/PlayerService.java` | a fila passou a vir da `FilaService` (acabou o `Queue<Musica>` interno); `verificarInicioAutomatico()`; status com `quemCanta` e `maxPorPessoa`; QR gerado em runtime na tela de descanso com a URL escrita embaixo |
| `service/WebSocketService.java` | sessões mortas saem do conjunto no broadcast (antes ficavam acumulando) |
| `controller/ApiController.java` | rotas novas (`/p`, `/convidado`, `/api/fila`, `/api/pedidos` POST/DELETE, `/api/acervo`, `/api/sala`, `/api/qrcode.png`, `/api/catalogo/info`, `/api/admin/*` com PIN); o PIN nunca volta no claro; **`POST /api/config` reescrito** |
| `Main.java` | constante `PORTA`, fiação dos serviços novos, log com a URL dos convidados |
| `pom.xml` | `com.google.zxing:core:3.5.3` (só o núcleo, sem o artefato `javase`, para não puxar dependência de CLI) |
| `resources/public/convidado.html` (novo) | a tela: um arquivo, sem build, sem framework |

## 3. Três bugs reais encontrados durante a implementação

1. **Cota quebrada enquanto a pessoa cantava.** Com a 1ª música da Ana no ar, ela contava zero
   pendentes, então a 2ª dela entrava como *tier 1* — na frente de todo mundo. Agora `emCena` (o que
   está tocando) conta para cota e para andar, e a mensagem diz "Você está cantando agora, assim
   que terminar pode pedir a próxima."
2. **`POST /api/config` apagava as pastas de mídia.** O handler desserializava o corpo num
   `AppConfig` novo; campos ausentes chegavam com o valor padrão da classe (`pastas = []`), o
   config.json era reescrito sem pasta nenhuma e o catálogo recarregava **vazio** — no meio da
   festa, com alguém só abrindo e salvando a tela de configurações. Reprodutível:
   `POST /api/config {"videoOutputMode":"Monitor"}` zerava as 11.470 músicas. Agora o corpo é lido
   como `JsonNode` e **só o campo presente no JSON é alterado**; corpo inválido devolve 400 sem
   tocar em nada.
3. **Charset do BD.ini dependia de como o Java foi iniciado.** `new FileReader` usa o charset
   padrão da JVM; num ambiente com locale diferente, "Zezé" virava "ZezÃ©" e a busca por acento
   quebrava silenciosamente. Agora o arquivo é lido como UTF-8 estrito, com fallback para
   Windows-1252 (comum em BD exportado por ferramenta de karaokê no Windows), decidido uma vez pelo
   conteúdo dos bytes.

## 4. Validado contra o app rodando de verdade

App real (vlcj + VLC + Xvfb + BD.ini real + 11.470 arquivos, modo "Monitor"), porta 7000.

**Regra da fila** (`karaoke-run/testar_fila.py`): Ana(1) toca → Beto → Carla; a 2ª da Ana vira tier
2 no fim; a 3ª da Ana cai em 409 `cota`; duplicata cai em 409 `duplicada` dizendo quem pediu;
`"  ANA  "` é a mesma pessoa que `ana`; nome vazio cai em 409 `sem_nome`; código inexistente cai em
409; cancelar o próprio passa, cancelar o do outro cai em 409; admin sem PIN cai em 401 e com PIN
passa.

**Regressões** (`karaoke-run/testar_regressao.py`, 30 checagens, todas `ok`): `GET /` continua
servindo o index do React (1.527 B) e `/dashboard` responde; o round-trip do `/api/config` mascarado
não limpa o PIN; `pastas`, `audioDeviceId`, `videoOutputMode` e `urlConvidado` sobrevivem a um POST
parcial; `urlConvidado` forçada entra em vigor sem reiniciar (`forçada: true` no `/api/sala`) e volta
para a auto-detecção; QR de 400 px = 12.017 B válido; a fila pública não expõe `ip`/`origem`, o
`/api/admin/fila` expõe; `/api/musicas` não devolve `caminho`.

**QR**: o PNG de `/api/qrcode.png` foi decodificado de volta para a URL exata em 260, 400, 600 e
1000 px (`karaoke-run/DecodificaQr.java`), inclusive com a URL forçada.

**Browser** (Chromium real): nome salvo no `localStorage`; digitar "coracao" → "269 músicas com
'coracao'", 30 linhas com botão Pedir; clique → toast "Você é o Nº 2 da fila", "Minhas músicas 1/2",
selo `2ª` na segunda música do mesmo convidado em "Próximos", e o botão de quem já pediu vira
"Nº 2" desabilitado.

**Layout 390×844** com a pior fila possível (títulos de 30–101 caracteres, nome de 26 caracteres,
cota 2/2): **overflow horizontal 0**, nenhum alvo de toque menor que 36 px, um único toast. Duas
correções foram necessárias: `grid-template-columns: minmax(0, 1fr)` + `min-width: 0` nos itens de
lista (grid item com `min-width: auto` ignorava o ellipsis e estourava 12 px) e `max-width: 72px`
no badge de código (arquivos fora do BD.ini têm o nome inteiro como código).

## 5. Escolhas deliberadas (para você rever)

- **`/api/config` não exige PIN.** Se exigisse, a tela de configurações do painel React pararia de
  salvar, porque ela não sabe mandar PIN. Numa rede isolada de festa isso é igual ao que já existia.
  Para fechar: chamar `negarSemPin(ctx)` na rota e mandar o PIN no formulário.
- **O botão "Cantar" do painel ignora o 409.** Hoje ele mostra "sucesso" mesmo quando a música já
  estava na fila, porque lê só o texto da resposta. São 2 linhas em
  `frontend/src/pages/_app/dashboard.tsx` para respeitar o status HTTP — **não mexi** porque isso
  exigiria rodar `npm run build` e trocar o bundle do painel. O servidor já responde certo.
- **Nenhum arquivo do frontend React foi rebuildado.** As mudanças de servidor são retrocompatíveis
  com o bundle que já está em `src/main/resources/public`.
- `pinAdmin` vazio = rotas abertas (como hoje). Ele só passa a valer se você preencher.
- `target/` continua com os `.class` antigos commitados no repositório. Como em todo build, rode
  `mvn clean package` para regenerar; não incluí binários no patch.
