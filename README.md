# 🎤 Professional Karaoke System

![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![VLC](https://img.shields.io/badge/VLC-FF8800?style=for-the-badge&logo=vlc&logoColor=white)
![NDI](https://img.shields.io/badge/NDI-FF0000?style=for-the-badge&logo=ndi&logoColor=white)

Sistema de Karaokê de alta performance desenvolvido para ambientes Linux, focado em estabilidade, fidelidade visual e integração com hardware de áudio e vídeo profissional. O sistema permite o controlo total via dispositivos móveis e transmissão de sinal via rede.

## 🚀 Diferenciais Técnicos

* **Motor Híbrido de Vídeo:** Utiliza a robustez da `libVLC` para descodificação de hardware, com interceção de frames em tempo real para transmissão via protocolo NDI.
* **Interface Web Responsiva:** Dashboard moderno para smartphones e tablets (React + TanStack Router), permitindo que os convidados busquem músicas e acompanhem a fila sem interromper o ecrã principal.
* **Sistema de Notas Dinâmico:** Animações Java 2D com efeito de "roleta" de números, sincronizadas milimetricamente com efeitos sonoros de suspense extraídos automaticamente do pacote da aplicação.
* **Gestão de Áudio Avançada:** Roteamento direto para dispositivos ALSA/USB (como mixers digitais), permitindo isolar o som do karaokê de outros sons do sistema.
* **Fidelidade de Cores:** Processamento manual de buffers de imagem para garantir a transição perfeita entre vídeos (BGRA) e gráficos gerados pelo Java (RGBA) no sinal de saída NDI.

---

## 🛠️ Arquitetura do Sistema

* **Backend:** Java 22 + Javalin (Web Server & WebSockets para atualizações em tempo real).
* **Video Engine:** `vlcj` para controlo fino do reprodutor e renderização de tempo (Marquee).
* **Stream de Vídeo:** `Devolay` (NDI SDK) para integração com softwares como Resolume Arena ou OBS Studio.
* **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI.
* **Build System:** Maven para geração de Fat JAR autossuficiente.

---

## 📋 Pré-requisitos (Linux)

Para o correto funcionamento das bibliotecas nativas, é necessário:

```bash
# Instalação do motor VLC e dependências de desenvolvimento
sudo apt install libvlc-dev vlc

```

## Certifica-te de que o NDI Runtime (libndi) está instalado no diretório de bibliotecas do sistema

# 📦 Empacotamento e Distribuição
O projeto é consolidado em um Fat JAR único, facilitando a portabilidade.

1. Preparação do Frontend
Bash
cd frontend
npm run build
# Os arquivos gerados em /dist devem ser movidos para src/main/resources/public

> Há **dois** fronts. O acima é o **painel de controle** (React + TanStack Router).
> O **catálogo do convidado** é a pasta `catalogo-front/` e o build dela já cai no lugar certo
> (`src/main/resources/convidado/`, servido em `/p`) — o resultado commitado permite gerar o JAR
> sem Node instalado:
>
> ```bash
> cd catalogo-front && bun install --frozen-lockfile && bun run build
> # npm ci && npm run build também funciona
> ```
>
> Se você mexer em `src/main/resources/public` pelo `frontend/`, **não** rode `mvn clean` antes de
> copiar: o `emptyOutDir` do `frontend/vite.config.ts` apaga a pasta, e o `convidado.html` de
> fallback mora um nível acima (`src/main/resources/`) justamente por causa disso.

2. Geração do Executável
Bash
mvn clean package
3. Estrutura de Execução
Ao rodar o .jar, o sistema organiza automaticamente os recursos necessários:

Plaintext
.
├── sistema-karaoke.jar
├── BD.ini             # Catálogo de músicas
├── audios/            # Pasta criada automaticamente com os efeitos das notas
└── config.json        # Persistência de configurações de áudio/vídeo
🎨 Funcionalidades de Interface
Dashboard (Mobile/Web)
Busca inteligente: pesquisa por código, título, artista ou trecho da letra.

Gerenciamento de Fila: visualização em tempo real de quem são os próximos cantores.

Configurações: seleção dinâmica de placas de som e monitores físicos.

Saída de Vídeo
Modo NDI: Transmissão via rede para integração em mesas de corte ou softwares de VJ.

Modo Monitor: Execução em tela cheia (Full HD) com suporte a múltiplos monitores.

Suspense: Roleta animada que para exatamente no momento em que a nota é anunciada pelo áudio.

---

## 📱 Tela do convidado (`/p`) — sem instalar nada

A porta 7000 do próprio Java serve agora uma página feita para o celular de quem chega na festa:
digitar o nome, buscar no acervo, pedir música e ver a posição na fila. Não é PWA, não precisa de
instalação, não precisa de internet e não tem login. O endereço aparece **no QR da tela de descanso**
e no log de inicialização.

```
📱 Convidados pedem música em http://192.168.4.1:7000/p
```

### Como o convidado entra na fila

1. Abre o QR (ou o endereço) → digita o nome uma única vez. Fica no `localStorage` (`karaoke:nome`).
2. Busca por título, artista, trecho da letra **ou pelo código do BD.ini** ("zeze" acha "Zezé",
   "1848" acha o código `01848` na primeira linha).
3. Aperta **Pedir** → vira um `Nº` na fila. Pode ter **2 músicas pendentes**, e a segunda entra
   **depois de todo mundo que pediu uma só** (fila em dois andares). Quem está com a música no ar
   também conta como pendente, então ninguém "zera a cota" enquanto canta.
4. Pode cancelar a própria música; a de outro convidado não.
5. Quando é a vez dele, a tela avisa (toast + vibração + selo "TOCANDO AGORA").

### Chaves novas no `config.json`

| Chave | Padrão | Para que serve |
| --- | --- | --- |
| `pinAdmin` | `""` | PIN das rotas de operador (pular música, tirar da fila, limpar fila, ver IP de origem). Vazio = aberto, como era antes. |
| `urlConvidado` | `""` | URL fixa do QR e do link, ex.: `http://192.168.4.1:7000/p`. Vazio = o app escolhe o IP da interface de rede (privilegia `wlan`/`ap` > `wl` > `eth`/`enp`, ignora docker/virtualbox/tailscale). |
| `maxPedidosPorPessoa` | `2` | Quantas músicas uma pessoa pode ter na fila ao mesmo tempo (1 a 10). |

### Rotas

| Rota | Método | Quem usa | Observação |
| --- | --- | --- | --- |
| `/p`, `/convidado` | GET | celular | HTML único, 9 KB gzip |
| `/api/musicas?q=&limit=&page=` | GET | celular | `limit` capped em 100; nunca devolve `caminho` |
| `/api/acervo` | GET | celular | `[[código, título, artista]]` de tudo que tem arquivo no disco (179 KB gzip, baixado só depois da 1ª busca, com atraso de 6–30 s) |
| `/api/fila?nome=` | GET | celular | fila pública: sem IP, sem caminho de disco |
| `/api/pedidos` | POST | celular | `{codigo, nome}` → 201 aceito / 409 com motivo |
| `/api/pedidos` | DELETE | celular | cancela o próprio pedido |
| `/api/sala` | GET | painel | IP detectado, URL dos convidados e se ela foi forçada |
| `/api/qrcode.png?tamanho=` | GET | tela de descanso | PNG gerado na hora (zxing), com cache |
| `/api/catalogo/info` | GET | painel | total de músicas e tamanho da fila |
| `/api/admin/pular` | POST | operador | exige `X-PIN` quando `pinAdmin` está preenchido |
| `/api/admin/pedido/remover` | POST | operador | `{codigo}` + `X-PIN` |
| `/api/admin/fila/limpar` | POST | operador | `X-PIN` |
| `/api/admin/fila` | GET | operador | fila com IP de origem e resumo por pessoa |

Detalhes de comportamento, números medidos e as duas armadilhas que encontramos estão em
[`MUDANCAS-FASE3.md`](MUDANCAS-FASE3.md).

---

## 🔐 Painel com token + 🖼️ três QRs na TV (Fase 4)

No primeiro boot o app gera um **token de 8 caracteres**, grava em `config.json`
(`tokenPainel`) e imprime no console o link do painel com um **QR ASCII** para abrir no celular.
Abrindo o link, o token vai para o `localStorage` do navegador e passa a acompanhar cada
requisição do painel. **O catálogo (`/p`) continua sem pedir nada.**

```
🔑 Painel:  http://192.168.4.1:7000/dashboard?token=U2F55PAW
          [ QR ASCII aqui, no console ]
📱 Convidados pedem música em http://192.168.4.1:7000/p   (sem token)
```

A tela de descanso mostra até **três QR codes**, cada um ligado/desligado na Configurações:
**Wi-Fi do evento** (SSID + senha informados na tela, com lista de redes detectadas),
**catálogo local** (`http://IP:7000/p`) e **catálogo online**.

| Chave nova em `config.json` | Padrão | Para que serve |
| --- | --- | --- |
| `tokenPainel` | gerado no boot | protege `/api/config` e as rotas do painel; rotaciona na Configurações |
| `wifiSsid` / `wifiSenha` / `wifiSeguranca` | `""` / `""` / `WPA` | conteúdo do QR de Wi-Fi (`WIFI:S:..;T:WPA;P:..;H:false;;`) |
| `urlCatalogoOnline` | `https://short.andreg.com.br/qxxteq` | terceiro QR |
| `mostrarQrWifi` / `mostrarQrCatalogoLocal` / `mostrarQrCatalogoOnline` | `true` | os três switches da tela (e o `/api/qrcode.png?tipo=` correspondente vira 404) |

| Rota nova | Método | Quem usa | Observação |
| --- | --- | --- | --- |
| `/api/painel/acesso` | POST | painel | a **única aberta**: confere o token digitado e grava o cookie `painel_token` (HttpOnly, SameSite=Lax, **sem** `Secure` — a LAN é HTTP puro) |
| `/api/painel/info` | GET | painel | token atual, `urlPainel`, `urlConvidado`, planos de QR |
| `/api/painel/qrcode.png` | GET | painel | PNG do link do painel (só para você, nunca vai para a TV) |
| `/api/painel/token` | POST | painel | rotação do token |
| `/api/painel/redes-wifi` | GET | painel | `{"redes":[…]}` via `iwgetid`/`nmcli`, teto de 2 s; alimenta o `<datalist>` do SSID |
| `/api/qrcode.png?tipo=catalogo\|wifi\|online` | GET | TV | público por natureza (o convidado escaneia); respeita os switches |
| `/api/acervo` | GET | celular | shape compacto `[[código, título, artista, início, duplicada]]` + `artistas` (contrato do `catalogo-front`) |

O catálogo agora é **build do `catalogo-front/`** servido em `/p` (React + Tailwind, 88 KB gzip de
JS), com favoritos locais, faceta por artista e a fila em dois andares na aba **Minha fila**.

As três anotações no fim deste arquivo ("Problemas a ver no catalogo") foram triadas na seção 9
de [`MUDANCAS-FASE4-5.md`](MUDANCAS-FASE4-5.md): espaços sobrando já eram tratados, o Enter que
fecha o teclado agora vale também para a busca do painel, e "busca inteligente" segue pendente.

⚠️ O token é um freio de dedo para a LAN da festa, não criptografia: sem HTTPS, quem estiver na
mesma rede pode farejar. Roteiro de aplicação e as armadilhas do `Cookie` do Javalin estão em
[`MUDANCAS-FASE4-5.md`](MUDANCAS-FASE4-5.md).

### Testar antes da festa

```bash
mvn -DskipTests package
java -jar target/*.jar           # ou mvn exec:java
# no mesmo Wi-Fi: http://IP-DO-APARTAMENTO:7000/p
```

🤝 Autor
Desenvolvido por Andre G. – Estudante de Engenharia de Controle e Automação no IFSC.

Problemas a ver no catalogo:
- filtrar, remover os espaços no final
- aCEITAR O ENTER PARA FECHAR O TECLADO
- para o futuro, uma busca inteligente