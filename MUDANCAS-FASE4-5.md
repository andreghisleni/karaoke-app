# Fase 4 + 5 — token no painel, três QRs com switch, e o catálogo como `catalogo-front/`

Documento de handoff. A Fase 3 (tela de convidado + fila em dois andares) está em
[`MUDANCAS-FASE3.md`](MUDANCAS-FASE3.md); aqui é só o que mudou depois dela.

Tudo abaixo foi **validado contra o app Java rodando de verdade** (11.470 músicas no `BD.ini`,
porta 7000), com navegador real, QR decodificado por zxing e screenshot da tela de descanso no Xvfb.

---

## 1. O pedido, e como ele foi atendido

| Você pediu | Foi implementado como |
| --- | --- |
| "o IP deve ser digitado na tela de config no web que já tinha" | Campo **Endereço dos convidados** na aba Configurações (`urlConvidado`). Vazio = auto-detecção de interface; preenchido = manda no `/api/sala`, no QR e no botão "Abrir". |
| "adicionar um 'token' na URL do painel administrativo, não precisa ser algo fixo" | `tokenPainel` de 8 caracteres gerado com `SecureRandom` no primeiro boot e gravado no `config.json`. O link é sempre `http://IP:7000/dashboard?token=XXXXXXXX`. |
| "daí abre a tela e salva no localStorage" | Se a URL tem `?token=`, o front grava em `localStorage` (`karaoke:painel-token`) e limpa a query da barra. Daí em diante todo `fetch` sai com o header `X-Painel-Token` (patch único em `frontend/src/lib/painel-token.ts`). |
| "printa no console, e gera um QR code no console também" | No boot, o `TokenPainelService.bannerDoConsole()` imprime o link e um **QR ASCII** (módulos ANSI, 2 por caractere) que abre o painel direto no celular. |
| "daí o catálogo não pediria esse token nem nada" | `/p`, `/api/acervo`, `/api/fila`, `/api/pedidos`, `/api/sala`, `/api/musicas`, `/api/qrcode.png` seguem 100% abertos. Só as rotas do painel exigem token. |
| "mantermos os 3 QR codes na tela: Wi-Fi, IP do catálogo, catálogo online" | `QrSalaService` monta três cartões (Wi-Fi com `WIFI:S:..;T:WPA;P:..;H:false;;`, catálogo local `http://IP:7000/p`, catálogo online) e o `TvPanel` desenha a fileira dinâmica. |
| "na tela de config termos os 3 switches para mostrar/ocultar cada QR" | `mostrarQrWifi`, `mostrarQrCatalogoLocal`, `mostrarQrCatalogoOnline` + três `Switch` na Configurações, **cada um com o preview do próprio QR**. Desligar tira o cartão da tela na hora, sem reiniciar. |
| "o catálogo deveria ser uma segunda pasta tipo `catalogo-front`, o mesmo front que tu tinha modificado" | `catalogo-front/` no repo (o `catalogo-karaoke-pro` modificado das Fases 1–2), build vai para `src/main/resources/convidado/` e é servido em `/p`. |

---

## 2. Segurança do token: o que ele é e o que ele **não** é

Protege **só o painel** (as rotas que mudam estado do app) contra dedo de convidado na mesma rede.
Não é segurança contra rede hostil: a festa é LAN isolada, HTTP puro, sem TLS. Quem estiver na
mesma rede e farejar o tráfego vê o token. Para o seu caso (Wi-Fi fechado, convidados querendo
pedir música) isso é suficiente; se um dia expuser para fora, precisa de HTTPS.

O filtro fica em `ApiController`:

- `before("/api/*")` → `precisaDeToken(caminho)`.
- `ROTAS_PAINEL` é lista fechada (`/api/config`, `/api/catalogo/recarregar`, `/api/nota/teste`, …)
  **mais** qualquer caminho começando com `/api/painel/`, com uma exceção: `/api/painel/acesso`,
  que é a porta aberta para digitar o token pela primeira vez.
- `/api/admin/*` ficou **de fora** da lista: ele continua sendo guardado pelo `negarSemPin()` que
  já existia, que agora aceita **PIN *ou* token**. (Estava quebrando o operador do celular:
  `X-PIN` sozinho dava 401.)

Aceita credencial em três transportes, para cobrir os casos reais de uso:

1. header `X-Painel-Token` — o front do painel, sempre;
2. query `?token=` — link do console e QR impresso;
3. cookie `painel_token` — depois do `POST /api/painel/acesso`.

### A armadilha do cookie (custou caro)

`new io.javalin.http.Cookie(nome, valor, path, maxAge, boolean)` — o quinto argumento é
**`secure`**, não `httpOnly`. O código anterior marcava `Secure` numa LAN sem HTTPS (o navegador
descartava o cookie e a tela de acesso voltava em loop) e deixava o cookie sem `HttpOnly`.
Agora existe um helper:

```java
private static Cookie cookieDoPainel(String valor) {
    return new Cookie("painel_token", valor, "/", 60 * 60 * 24 * 30,
            false, 1, true, null, null, SameSite.LAX);
}
```

Header resultante: `painel_token=U2F55PAW; Path=/; Expires=…; Max-Age=2592000; HttpOnly; SameSite=Lax`.

### Trocar / recuperar o token

| Situação | O que fazer |
| --- | --- |
| Esqueci o token | Olhe o console no boot (link + QR). Ou `grep tokenPainel config.json`. |
| Quero um novo | Configurações → **Gerar novo** (rotação na hora, o link velho para de funcionar). |
| Celular meu | Use o **QR do painel** impresso no console ou `GET /api/painel/qrcode.png?token=…` — mas **o QR da tela de descanso nunca é o do painel**, senão convidado escaneia e cai na tela de acesso. |
| Convidado com o link do painel | Não tem token → tela de acesso (`painel-acesso.tsx`) pedindo os 8 caracteres. |

---

## 3. Os três QRs

`QrSalaService.planos()` devolve, nesta ordem, `wifi`, `catalogo`, `online`. Cada plano tem
`chave`, `rotulo`, `dica`, `legenda`, `conteudo`, `ligado` (switch) e `visivel` (switch **e** dado
necessário presente). Aparecem em `GET /api/config` → `qr[]`, em `GET /api/sala` → `qr` e
`GET /api/painel/info` → `qr`.

Conteúdo do Wi-Fi (escapando `\`, `;`, `,`, `:` conforme o padrão):

```
WIFI:S:Festa-Karaoke 5G;T:WPA;P:s3nh@\;com\:virgula;H:false;;
```

`conteudoDaChave()` respeita o switch: QR desligado → `GET /api/qrcode.png?tipo=online` devolve
**404**, o preview da Configurações mostra a caixa tracejada "QR vazio" e o cartão some da TV sem
reiniciar o app. Rede sem SSID também gera 404 (motivo `rede sem nome`), e é por isso que a
Configurações pede o nome da rede antes de desenhar o cartão Wi-Fi.

Lista de redes detectadas (você comentou que prefere **escolher** a digitar):
`GET /api/painel/redes-wifi` → `{"redes":["MinhaRede", …]}`, alimentando um `<datalist>` no campo
SSID. Usa `iwgetid -r` e `nmcli -t -f active,ssid dev wifi` com **teto de 2 s por comando**
(`ProcessBuilder` + `waitFor(timeout)`) e no máximo 12 nomes — se a máquina não tem placa Wi-Fi
(foi o caso do ambiente de teste) volta lista vazia e o campo degrada para digitação normal.

### A fileira na tela de descanso (dois bugs visuais que só apareceram com foto)

`PlayerService.TvPanel.desenhaFileiraDeQrs()` foi reescrito:

- **com 3 QRs a fileira fixa media 1304 px numa tela de 1280** — os cartões sangravam para fora
  (o da esquerda ficava com `x` negativo). Agora as medidas base (244/268/300 px de lado, folgas
  56/64, topo 58/66, rodapé 110) **só encolhem** para caber em largura *e* altura reais, com
  margem lateral `max(80, w*0.06)`.
- com **1 QR** o rótulo "Pedir música" colava no subtítulo "Escolha uma música pelo celular!"; o
  rótulo agora é desenhado acima do quadro (`qrY - moldura - 8`) e a dica cabe na largura do
  cartão (`cortar()` com limite `largel*0.72` quando há 1 QR, `lado` quando há mais) — com 1 QR a
  URL sai inteira, com 3 sai truncada por `…` dentro do próprio cartão.

Verificado com screenshot real do display Xvfb do app (`tirar-cenas-tv.sh`): 3, 2 e 1 QR.

---

## 4. `catalogo-front/` — a segunda pasta de front

```
catalogo-front/            <- 51 arquivos versionados (node_modules ignorado)
  src/lib/sala.ts          <- URLs (/api/acervo, /api/pedidos, /api/fila, /api/sala) + parse do shape
  src/hooks/useFilaDaFesta <- nome no localStorage, fila, pedido, cancelamento, polling 4 s
  src/components/PedirNome <- bottom sheet pedindo o nome uma vez
  src/components/FilaDaFesta <- aba "Minha fila": tocando agora, posição, meus pedidos, depois de você
  vite.config.ts           <- base '/p/', outDir '../src/main/resources/convidado', emptyOutDir
```

Build (bun 1.4.5; `npm run build` funciona igual, o `package-lock.json` está lá):

```bash
cd catalogo-front
bun install --frozen-lockfile
bun run build      # escreve direto em ../src/main/resources/convidado
cd .. && mvn -o -DskipTests process-resources   # copia para target/classes sem reiniciar o app
```

> O `vite.config.ts` usa `emptyOutDir`, então a **fonte** `src/main/resources/convidado/` fica com
> um par limpo de assets. `target/` não: sem `mvn clean`, o `process-resources` só acrescenta — no
> build de teste o JAR saiu com `index-aSr3CbFs.js` (correto, é o que o `index.html` referencia) e
> mais um par órfão de 335 KB de um rebuild anterior. Nada quebra, mas **empacote com
> `mvn clean package`** para o JAR da festa não carregar bundle morto.

O build **vai commitado** (`src/main/resources/convidado/`, 588 KB / 12 arquivos) para o
`mvn package` funcionar sem Node — mas o fonte é a verdade. Peso real no fio: JS 284,50 KB
(88,77 KB gzip), CSS 50,44 KB (9,23 KB gzip), `index.html` 1.228 B.

Coisas que ele ganha sobre o `convidado.html` de arquivo único:

- busca instantânea no acervo inteiro já no celular (`/api/acervo`), sem ida ao servidor por tecla;
- faceta por artista e chips de ordenação A–Z / por artista / por código (chips de 36 px no
  celular, medido em iframe 390×844 — zero overflow horizontal, zero alvo < 24 px);
- favoritos e histórico **locais** (IndexedDB/localStorage) das Fases 1–2;
- a fila em dois andares com a sua posição, "trocar nome" e cancelar.

`src/main/resources/convidado.html` continua no repo como **fallback** de arquivo único (serve se
alguém apontar o static handler antigo) e foi atualizado para ler o shape novo
(`r.dados || r` → `musicas` ou `itens`).

---

## 5. Configurações do painel — o que tem agora

Ordem na tela: Endereço dos convidados (IP) → Wi-Fi do evento (SSID com datalist, senha,
segurança) → os **3 switches com preview** → token do painel (link, copiar, aplicar, gerar novo,
QR) → PIN do operador (mascarado).

`POST /api/config` faz merge campo a campo (herança da Fase 3), então mandar o payload com o PIN
`"***"` não grava a máscara no disco — testado de ponta a ponta, incluindo `wifiSenha`.

---

## 6. O que foi testado e com o quê

| Bateria | Comando | Resultado |
| --- | --- | --- |
| Regressão completa (9 blocos, ~55 checagens) | `python3 testar_regressao.py` | **FALHAS: nenhuma** |
| QR Wi-Fi escape + decode + switch a quente | `bash testar_qr_wifi.sh` | `[WIFI:S:Festa-Karaoke 5G;T:WPA;P:s3nh@\;com\:virgula;H:false;;]` |
| Fila em dois andares, cancelamento, 409, origens | `python3 testar_fila.py` | ok (item 11 atualizado: `/api/config` agora exige token) |
| Tela de descanso 3/2/1 QR | `bash tirar-cenas-tv.sh` | screenshots conferidos, nada sangrando |
| Navegador real | URL de forwarding `/p`, `/dashboard?token=…`, `/config`, tela de acesso | render, busca "coracao" → 269, modal de nome → toast "Nº 2", aba Minha fila, IP/token/switches |
| Layout mobile | `medidor.html` em iframe 390×844 | overflow 0 px, 53 alvos ≥ 36 px, nenhum < 24 px intencional, 0 imagem quebrada |

Os scripts ficam **fora do repo** (no diretório de execução, junto de `BD.ini` e `config.json`),
porque dependem do caminho do catálogo de teste.

Números de referência: `/api/acervo` 918 KB raw → **328.728 B gzip** no fio; `/api/qrcode.png`
10–12 KB; 11.470 músicas, 513 duplicadas, top artista Roberto Carlos (120).

---

## 7. Limites e escolha consciente

- **Sem HTTPS**: LAN isolada. O token é freio de dedo, não criptografia.
- **Uma única senha/token compartilhado**: todo convidado usa o mesmo catálogo; só o painel é
  fechado. Não há usuário por pessoa.
- **QR do catálogo aponta para o IP detectado**; em dual-stack/VPN o `InetAddress.getLocalHost()`
  pode escolher a interface errada — por isso existe o campo de IP e o "Endereço detectado" na
  tela. Confirme o endereço na Configurações **antes** de abrir os QRs na TV da festa.
- **`iwgetid`/`nmcli` opcionais**: sem eles o datalist fica vazio e você digita o SSID.
- **Fila em memória**: caiu o Java, caiu a fila. Não persistimos de propósito (fila de festa é
  efêmera, e persistir traria problema de "nome fantasma").
- **2 pedidos por pessoa** (`maxPedidosPorPessoa`), e o segundo só anda atrás de quem tem um.

## 8. Como aplicar no seu PC (a atualização local que não subiu)

> **Atualização (2025-11-25 à noite):** você subiu `33c525b` + `e434dcb`, então o cenário descrito
> aqui aconteceu de verdade — a branch entregue agora nasce em `e434dcb` e o rebase está
> documentado na seção 9. Deixei o roteiro porque ele vale para qualquer patch futuro.

O patch nascia do commit `013cc64` (sua base no GitHub na época) e da `feat/tela-convidado`
(`e1a5b86`). Quando o seu PC tem mudanças locais **não commitadas**, o `git am` limpo costuma
falhar em `ApiController`, `Main`, `AppConfig`, `CatalogoService`, `PlayerService`, `SalaService`
e `frontend/.../config/index.tsx`. Roteiro seguro:

```bash
git status && git diff > /tmp/minhas-mudancas.patch   # antes de qualquer coisa
git stash                                             # ou commite numa branch
git checkout -b feat/tela-convidado e434dcb           # (era 013cc64; hoje você já está no e434dcb)
git am --3way /caminho/0001-*.patch                   # conflitos aparecem como conflito de merge
# se preferir não usar git am:
git apply --3way --reject /caminho/karaoke-fase4-5.patch && find . -name '*.rej'
```

---

## 9. Rebase sobre o `e434dcb` (a atualização que ele finalmente subiu)

A base deste trabalho era `013cc64` (tag 1.0.2). Ele subiu dois commits depois disso, e a branch
`feat/tela-convidado-v2` é o resultado de reaplicar tudo em cima deles:

| Commit dele | O que faz |
| --- | --- |
| `33c525b` | keepalive do WebSocket: `iniciarKeepAlive()`/`pararKeepAlive()` no `WebSocketService`, chamado no `Main` e no shutdown hook; no front, reconexão com backoff exponencial em `dashboard.tsx` |
| `e434dcb` | remove a página `/tv` do painel (88 linhas) + `route-tree.gen.ts`, toasts de erro na Configurações e no `carregarTudo`, `SelectTrigger className="w-full"` |

Conflitos e como ficaram:

- **`WebSocketService.java`** — o keepalive dele foi mantido, mas troquei o `stream().filter(isOpen)`
  por uma passada com faxina, igual ao meu `fazerBroadcast`: sessão fechada que ninguém remove
  pesa para sempre no broadcast da noite. `Main.java` mesclou sozinho (keepalive + abrir o
  navegador já com o `?token=`).
- **`README.md`** — mantive a nota dele de "Problemas a ver no catálogo" (é a origem da seção
  abaixo) e acrescentei o status de cada item.
- **`frontend/src/pages/_app/config/index.tsx`** — meu loader (que lê o shape novo do
  `/api/config`, com `qr[]`, token e Wi-Fi) ficou no lugar do dele, **preservando as três
  intenções do commit dele**: `toast.error` quando áudio/telas falham, `toast.error` no
  `catch`, e o `SelectTrigger className="w-full"`. O `else if (status === 401)` meu avisa
  especificamente da falta de token, que é o caso real da festa.
- **`src/main/resources/public/*` (bundle do painel)** — conflito de rename/delete nos assets
  com hash. Resolvido do jeito certo: **rebuidei o painel** com o fonte mesclado
  (`cd frontend && bun run build`, que roda `tsc --noEmit` antes) em vez de escolher um lado.
  Bundle novo: `index-M4lH8BIX.js` 478,34 KB (151,22 KB gzip) / `index-DI53CVlM.css` 132,38 KB.
- **`tv.tsx` removida** — nenhum código meu referenciava a rota; só um comentário em
  `layout.tsx` falava dela, e foi atualizado (a tela da festa é o Swing do Java, não o painel).

Validação depois do rebase (tudo contra o app rodando do build mesclado):
`testar_regressao.py` 9 blocos **sem falha**, `testar_fila.py` ok, QRs decodificados de novo,
`/p` servindo o bundle certo, tela de Configurações conferida no navegador real (o loader com os
toasts mesclados carrega tudo), e a fileira de 3 QRs da TV fotografada de novo.

### Tela de TV: não existe (e não deve existir) no front

Você foi explícito: **"não é para ter tela TV no front, no react/vite"**. Estado conferido no build
mesclado:

- as páginas do painel são só `__root.tsx`, `index.tsx` (um `<Navigate replace to="/dashboard">` de
  9 linhas), `_app/layout.tsx`, `_app/dashboard.tsx` e `_app/config/index.tsx`;
- `frontend/src/pages/tv.tsx` **não existe mais** (você a removeu no `e434dcb`) e nada do meu código
  a reintroduziu — `route-tree.gen.ts` não tem a rota e o bundle compilado não contém a string
  `"/tv"`;
- não sobrou `*.html`/`*.js` de TV em `src/main/resources/`;
- quem desenha a tela da festa é o **Swing do Java** (`PlayerService.TvPanel`, ~linha 516), com a
  fileira de QR da seção 3. Ou seja: na TV da festa não se abre navegador — o painel é coisa do
  celular/PC do operador, e por isso o `PainelGuard` só envolve `/_app/*`.

### As duas armadilhas que só aparecem no `git am` (e como contornar)

1. **`pom.xml` e `dependency-reduced-pom.xml` do seu repo estão com CRLF.** O parser de mbox do
   `git am` remove o `\r` ao ler o patch, aí o contexto não bate e ele cospe
   `error: patch failed: pom.xml:44` / `patch does not apply`. O comando que funciona:

   ```bash
   git am --3way --keep-cr 0001-*.patch 0002-*.patch    # validado: aplica e o clone compila
   ```

   Alternativa sem mistério: `git apply --3way karaoke-fase3-4-5-sobre-e434dcb.patch` (esse não
   passa pelo parser de e-mail) — ou ainda `git fetch` do bundle:

   ```bash
   git fetch feat-tela-convidado-v2.bundle feat/tela-convidado-v2:feat/tela-convidado-v2
   git checkout feat/tela-convidado-v2
   ```

2. **A linha `-- ` do formato mbox.** Dois traços + espaço é o separador que encerra a *mensagem*
   do commit num patch. Ela aparece nos meus dois `format-patch`, porque o seu bullet
   "- para o futuro, uma busca inteligente" vira `-- para o futuro...` quando o diff o move — e ele
   é movido porque o seu README **não termina com newline**, então tocar na cauda remove e recria a
   última linha. Não quebrou nada: o `git am` já estava em modo-diff a essa altura. Mas não confie
   na minha palavra, **compare a árvore**, que é o teste que fecha a questão:

   ```bash
   git am --3way --keep-cr 0001-*.patch 0002-*.patch
   git diff --stat HEAD <hash-do-ultimo-commit-do-patch>   # nao pode imprimir nada
   git rev-parse HEAD^{tree}                               # tem que ser a mesma árvore
   ```

   Foi exatamente assim que validei: o clone que passou pelo `git am` parou na **mesma árvore** do
   meu commit. E por cuidado a sua nota "Problemas a ver no catalogo" ficou **byte a byte no fim do
   arquivo** (os 80 últimos bytes do `README.md` são idênticos aos do `e434dcb`, conferido com
   `cmp`) e o texto de triagem foi para dentro da seção da Fase 4.

### E os três pontos que ele anotou no README

1. **"filtrar, remover os espaços no final"** → já coberto em três camadas: `pesquisar()` faz
   `query.strip()` + `semAcento`; `lib/texto.ts` normaliza (`\s+`→espaço único, `trim`) e
   `termosDe()` descarta termos vazios. Conferido no acervo real: **zero** títulos/artistas com
   espaço sobrando nos campos que saem do `/api/acervo`.
2. **"aceitar o ENTER para fechar o teclado"** → no `catalogo-front` já acontecia (a busca é um
   `<form>` e `enviar()` faz `focoRef.current?.blur()`, com `enterKeyHint="search"`). O que
   faltava era o **painel**: a caixa de busca do `dashboard.tsx` agora tem
   `enterKeyHint="search"`, `inputMode="search"`, `aria-label` e Enter → `blur()`.
3. **"para o futuro, uma busca inteligente"** → o que existe é *ranking por relevância*
   (`CatalogoService.relevancia`: código exato > código começando > título começando > artista >
   resto) e busca multi-termo sem acento. O próximo passo real seria tolerância a erro de
   digitação (Levenshtein em ~11.470 títulos tem custo de CPU e de índice) — deixei como
   pendência consciente, não fiz de uma hora para outra.

## 10. O que veio depois disto (Fase 6)

Depois que este trabalho foi ao `main` como `632be68`, pediram quatro ajustes curtos na mesma
base: **rolar a fila do painel**, **mostrar o nome de quem pediu** (sem mostrar o do operador),
**"O próximo a brilhar vai ser: fulano" na TV por uns 5 s antes de largar o vídeo** e um
**botão de pausa entre músicas** que devolve a TV para a tela dos QR codes.

Tudo que muda, por quê, o que foi medido e as decisões conscientes estão em
[`MUDANCAS-FASE6.md`](MUDANCAS-FASE6.md). Nada do que está escrito aqui foi reescrito por causa
disso — as seções 1 a 9 continuam valendo, inclusive as do token e dos três QRs.
