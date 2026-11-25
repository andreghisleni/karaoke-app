package br.com.andreg.karaoke.app.controller;

import br.com.andreg.karaoke.app.config.ConfigManager;
import br.com.andreg.karaoke.app.model.AdicionarFilaRequest;
import br.com.andreg.karaoke.app.model.AppConfig;
import br.com.andreg.karaoke.app.model.Musica;
import br.com.andreg.karaoke.app.model.Pedido;
import br.com.andreg.karaoke.app.model.PedidoRequest;
import br.com.andreg.karaoke.app.model.ResultadoPedido;
import br.com.andreg.karaoke.app.service.CatalogoService;
import br.com.andreg.karaoke.app.service.FilaService;
import br.com.andreg.karaoke.app.service.PlayerService;
import br.com.andreg.karaoke.app.service.SalaService;
import br.com.andreg.karaoke.app.service.TokenPainelService;
import br.com.andreg.karaoke.app.service.QrSalaService;
import br.com.andreg.karaoke.app.service.WebSocketService;
import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.http.HttpResponseException;
import io.javalin.http.Cookie;
import io.javalin.http.SameSite;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;

public class ApiController {

    /** Usado apenas para mesclar o POST de /api/config campo a campo (ver comentário na rota). */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ConfigManager configManager;
    private final CatalogoService catalogoService;
    private final PlayerService playerService;
    private final WebSocketService webSocketService;
    private final FilaService filaService;
    private final SalaService salaService;
    private final TokenPainelService tokenService;
    private final QrSalaService qrService;

    private String htmlConvidado;

    public ApiController(ConfigManager configManager,
                         CatalogoService catalogoService,
                         PlayerService playerService,
                         WebSocketService webSocketService,
                         FilaService filaService,
                         SalaService salaService,
                         TokenPainelService tokenService,
                         QrSalaService qrService) {
        this.configManager = configManager;
        this.catalogoService = catalogoService;
        this.playerService = playerService;
        this.webSocketService = webSocketService;
        this.filaService = filaService;
        this.salaService = salaService;
        this.tokenService = tokenService;
        this.qrService = qrService;
    }

    public void registrarRotas(Javalin app) {
        // ==========================================
        // PORTA DO PAINEL (token)
        // ==========================================
        // Tudo que muda alguma coisa no sistema está atrás do token impresso no console:
        // configuração, dispositivos, fila pelo painel, pular música e as rotas de admin.
        // O convite continua de porta aberta: /p, /api/pedidos, /api/fila, /api/musicas,
        // /api/acervo, /api/sala, /api/player/status e /ws não passam por aqui.
        app.before("/api/*", ctx -> {
            if (!precisaDeToken(ctx.path())) return;
            if (tokenService.autorizado(ctx)) return;
            throw new HttpResponseException(401, "Preciso do token do painel. Abra o link que "
                    + "saiu no console da máquina do karaokê, ou digite o token na tela.");
        });

        app.exception(HttpResponseException.class, (e, ctx) ->
                ctx.status(e.getStatus()).json(Map.of(
                        "erro", "token_necessario", "mensagem", e.getMessage())));

        // ==========================================
        // PAINEL: QUEM SOU, ENTRADA E QR DO LINK COM TOKEN
        // ==========================================

        // Aberto de propósito: é por aqui que ele cola o token uma vez. Resposta é sempre a mesma
        // (200 + ok/false) para a tela não descobrir por tempo/estados se um token existe.
        app.post("/api/painel/acesso", ctx -> {
            JsonNode corpo;
            try {
                corpo = MAPPER.readTree(ctx.body());
            } catch (Exception ruim) {
                corpo = null;
            }
            String tentativa = corpo == null ? "" : corpo.path("token").asText("");
            boolean valeu = tokenService.confere(tentativa);
            if (valeu) {
                ctx.cookie(cookieDoPainel(tokenService.token()));
            }
            ctx.status(valeu ? 200 : 401).json(Map.of(
                    "ok", valeu,
                    "urlPainel", valeu ? tokenService.urlPainel() : "",
                    "mensagem", valeu ? "Pronto, essa máquina está liberada."
                            : "Token não bate. Ele está no console da máquina do karaokê."));
        });

        // O que a tela de Configurações mostra no bloco do token. Atrás do token, evidentemente.
        app.get("/api/painel/info", ctx -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("token", tokenService.token());
            m.put("urlPainel", tokenService.urlPainel());
            m.put("urlPainelSemToken", tokenService.urlPainelSemToken());
            m.put("ip", salaService.detectarIpLocal());
            m.put("porta", salaService.porta());
            m.put("urlConvidado", salaService.urlConvidado());
            m.put("forcada", salaService.urlForcadaAtiva());
            m.put("qr", qrService.planos());
            ctx.json(m);
        });

        // Redes que o Wi-Fi desta máquina vê: sugestão para o campo SSID, nunca exigência.
        app.get("/api/painel/redes-wifi", ctx -> {
            ctx.json(Map.of("redes", qrService.redesVisiveis()));
        });

        // QR do link do painel: é o mesmo texto do console, mas pronto para imprimir/projetar.
        app.get("/api/painel/qrcode.png", ctx -> {
            int tamanho = clampTamanho(ctx.queryParamAsClass("tamanho", Integer.class).getOrDefault(400));
            byte[] png = salaService.pngDoQr(tokenService.urlPainel(), tamanho);
            if (png.length == 0) {
                ctx.status(500).json(Map.of("erro", "nao_foi_possivel_gerar_o_qr_code"));
                return;
            }
            ctx.contentType("image/png").header("Cache-Control", "no-store").result(png);
        });

        // Girar (sem corpo) ou definir ({"token":"..."}) o token do painel.
        app.post("/api/painel/token", ctx -> {
            JsonNode corpo;
            try {
                corpo = MAPPER.readTree(ctx.body());
            } catch (Exception ruim) {
                corpo = null;
            }
            String pedido = corpo == null ? "" : corpo.path("token").asText("");
            boolean trocado;
            if (pedido.isBlank()) {
                tokenService.regenerar(); // sem corpo = "gerar um novo aleatório"
                trocado = true;
            } else {
                trocado = tokenService.definir(pedido);
            }
            if (!trocado) {
                ctx.status(400).json(Map.of("erro", "token_invalido",
                        "mensagem", "Use de 4 a 32 caracteres, sem espaço nem hífen."));
                return;
            }
            // derruba o cookie velho na resposta: o próximo fetch usa o valor novo da tela
            ctx.cookie(cookieDoPainel(tokenService.token()));
            ctx.json(Map.of("token", tokenService.token(), "urlPainel", tokenService.urlPainel()));
        });

        // ==========================================
        // WEBSOCKETS
        // ==========================================
        // A mesma conexão serve o painel e a tela do convidado: qualquer mudança na fila é
        // broadcasteada como status do player, então ninguém precisa ficar perguntando.
        app.ws("/ws", ws -> {
            ws.onConnect(ctx -> {
                webSocketService.adicionarSessao(ctx);
                // Verifica se o React não fechou a porta na nossa cara antes de enviar
                if (ctx.session.isOpen()) {
                    ctx.send(playerService.obterStatus());
                }
            });
            ws.onClose(ctx -> {
                webSocketService.removerSessao(ctx);
            });
            ws.onError(ctx -> {
                webSocketService.removerSessao(ctx);
            });
        });

        // ==========================================
        // ROTAS DE CONFIGURAÇÃO
        // ==========================================

        // Retorna as configurações atuais para preencher o formulário do frontend.
        // O PIN nunca volta no claro: qualquer celular da rede lê esta rota.
        app.get("/api/config", ctx -> {
            ctx.json(configParaExibir(configManager.getConfig()));
        });

        // Recebe o JSON completo do frontend, salva no HD e recarrega as pastas
        app.post("/api/config", ctx -> {
            AppConfig configAtual = configManager.getConfig();
            JsonNode payload;
            try {
                payload = MAPPER.readTree(ctx.body());
            } catch (Exception corpoInvalido) {
                payload = null;
            }
            if (payload == null || !payload.isObject()) {
                // Nada foi tocado: nem o disco, nem o catálogo em memória.
                ctx.status(400).json(Map.of("erro", "json_invalido",
                        "mensagem", "O corpo precisa ser um objeto JSON. Nada foi alterado."));
                return;
            }

            // Só mexemos no que VEIO no corpo. Antes, o Jackson montava um AppConfig zero a
            // partir do texto e os campos ausentes chegavam com o valor padrão da classe: um
            // POST parcial (o painel salvando só a tela, por exemplo) gravava pastas = [],
            // o catálogo recarregava vazio e a festa inteira ficava sem música.
            // Presença = intenção; ausência = deixa como está.
            JsonNode nodePastas = payload.get("pastas");
            if (nodePastas != null && nodePastas.isArray()) {
                List<String> novasPastas = new ArrayList<>();
                for (JsonNode p : nodePastas) {
                    String pasta = p.asText("");
                    if (!pasta.isBlank()) novasPastas.add(pasta.strip());
                }
                configAtual.pastas = novasPastas;
            }

            if (payload.hasNonNull("audioDeviceId")) configAtual.audioDeviceId = payload.get("audioDeviceId").asText("");
            if (payload.hasNonNull("displayId")) configAtual.displayId = payload.get("displayId").asText("");
            if (payload.hasNonNull("videoOutputMode")) {
                String modo = payload.get("videoOutputMode").asText("");
                if (!modo.isBlank()) configAtual.videoOutputMode = modo;
            }

            // Só mexemos no PIN se veio um valor novo (a tela nunca recebe o valor real)
            if (payload.hasNonNull("pinAdmin")) {
                String pin = payload.get("pinAdmin").asText("").strip();
                if (!pin.isEmpty() && !pin.equals("***")) configAtual.pinAdmin = pin;
            }
            if (payload.hasNonNull("urlConvidado")) {
                // Guardamos a forma canônica (http://host:porta/p): o que ele digita pode ser só
                // "192.168.4.1", e o config.json tem que ficar legível para quem abrir na mão.
                String digitado = payload.get("urlConvidado").asText("");
                configAtual.urlConvidado = salaService.normalizarEndereco(digitado);
            }
            int maximo = payload.path("maxPedidosPorPessoa").asInt(0);
            if (maximo >= 1 && maximo <= 10) configAtual.maxPedidosPorPessoa = maximo;

            // --- Wi-Fi da festa (QR 1) ---
            if (payload.hasNonNull("wifiSsid")) configAtual.wifiSsid = payload.get("wifiSsid").asText("").strip();
            if (payload.hasNonNull("wifiSenha")) configAtual.wifiSenha = payload.get("wifiSenha").asText("");
            if (payload.hasNonNull("wifiSeguranca")) {
                String tipo = payload.get("wifiSeguranca").asText("");
                if (tipo.equals("WPA") || tipo.equals("WEP") || tipo.equals("nopass")) {
                    configAtual.wifiSeguranca = tipo;
                }
            }
            // --- catálogo online (QR 3) e os três interruptores ---
            if (payload.hasNonNull("urlCatalogoOnline")) {
                configAtual.urlCatalogoOnline = payload.get("urlCatalogoOnline").asText("").strip();
            }
            if (payload.hasNonNull("mostrarQrWifi")) {
                configAtual.mostrarQrWifi = payload.get("mostrarQrWifi").asBoolean(true);
            }
            if (payload.hasNonNull("mostrarQrCatalogoLocal")) {
                configAtual.mostrarQrCatalogoLocal = payload.get("mostrarQrCatalogoLocal").asBoolean(true);
            }
            if (payload.hasNonNull("mostrarQrCatalogoOnline")) {
                configAtual.mostrarQrCatalogoOnline = payload.get("mostrarQrCatalogoOnline").asBoolean(true);
            }

            // Salva no config.json
            configManager.salvar();

            // Recarrega o catálogo imediatamente com as novas pastas
            catalogoService.carregar(configAtual.pastas);
            aplicarConfiguracoes();

            ctx.json(configParaExibir(configAtual));
        });

        // ==========================================
        // ROTA DO CATÁLOGO
        // ==========================================

        // Retorna músicas. Suporta filtro: /api/musicas?q=termo
        app.get("/api/musicas", ctx -> {
            String termoBusca = ctx.queryParam("q");

            // Pega a página e o limite da URL, com valores padrão seguros
            int page = ctx.queryParamAsClass("page", Integer.class).getOrDefault(1);
            int limit = ctx.queryParamAsClass("limit", Integer.class).getOrDefault(50);

            // o convidado não precisa de mais que isso e cada linha custa bytes na rede
            if (limit > 100) limit = 100;

            // Chama o serviço com os novos parâmetros e o Javalin converte automaticamente a RespostaPaginada para JSON
            ctx.json(catalogoService.pesquisar(termoBusca, page, limit));
        });

        // Lista enxuta [[codigo, titulo, artista], ...] de tudo que tem arquivo no disco.
        // O navegador do convidado baixa uma vez e digita sem perguntar ao servidor.
        app.get("/api/acervo", ctx -> {
            ctx.json(salaDeAcervo());
        });

        app.get("/api/catalogo/info", ctx -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("total", catalogoService.totalMusicas());
            m.put("fila", filaService.tamanho());
            ctx.json(m);
        });

        app.get("/api/audio-devices", ctx -> {
            ctx.json(playerService.listarDispositivosAudio());
        });

        app.get("/api/screens", ctx -> {
            ctx.json(playerService.listarTelas());
        });

        // ==========================================
        // TELA DO CONVIDADO (o que abre no celular)
        // ==========================================

        app.get("/p", this::servirTelaConvidado);
        app.get("/convidado", this::servirTelaConvidado);

        // A fila em si: quem está tocando + ordem completa + posição de quem perguntar
        app.get("/api/fila", ctx -> {
            Map<String, Object> status = playerService.obterStatus();
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("estado", status.get("estado"));
            corpo.put("tocando", status.get("musicaAtual"));
            corpo.put("quemCanta", status.get("quemCanta"));
            corpo.put("fila", filaService.fila());
            corpo.put("total", filaService.tamanho());
            corpo.put("maxPorPessoa", filaService.getMaxPendentes());

            String nome = ctx.queryParam("nome");
            if (nome != null && !nome.isBlank()) {
                corpo.put("meus", filaService.pedidosDe(nome));
            }
            ctx.json(corpo);
        });

        // Pedir música: { "codigo": "18483", "nome": "Ana" }
        app.post("/api/pedidos", ctx -> {
            PedidoRequest req = ctx.bodyAsClass(PedidoRequest.class);
            Musica musica = catalogoService.buscarPorCodigo(req.codigo).orElse(null);

            ResultadoPedido resultado = filaService.pedir(musica, req.nome, ctx.ip());
            ctx.status(resultado.aceito ? 201 : 409).json(resultado);

            if (resultado.aceito) {
                // Se o player está parado, isso já puxa a música e faz o broadcast.
                playerService.verificarInicioAutomatico();
                webSocketService.fazerBroadcast(playerService.obterStatus());
            }
        });

        // Cancelar o próprio pedido: same corpo. Só sai se o nome bater com quem pediu.
        app.delete("/api/pedidos", ctx -> {
            PedidoRequest req = ctx.bodyAsClass(PedidoRequest.class);
            ResultadoPedido resultado = filaService.cancelar(req.codigo, req.nome);
            ctx.status(resultado.aceito ? 200 : 409).json(resultado);

            if (resultado.aceito) {
                webSocketService.fazerBroadcast(playerService.obterStatus());
            }
        });

        // ==========================================
        // SALA: IP, URL e QR code gerados na hora
        // ==========================================

        app.get("/api/sala", ctx -> {
            Map<String, Object> sala = new LinkedHashMap<>(salaService.info());
            // sem a senha do Wi-Fi: esta rota é lida pelo celular de qualquer convidado
            sala.put("qr", qrService.planos());
            ctx.json(sala);
        });

        // Um endereço só para os três QRs da tela: ?tipo=catalogo (padrão) | wifi | online.
        // Não existe "painel" aqui de propósito: este endpoint é público, o QR com token é o
        // /api/painel/qrcode.png, que está atrás do token.
        app.get("/api/qrcode.png", ctx -> {
            int tamanho = clampTamanho(ctx.queryParamAsClass("tamanho", Integer.class).getOrDefault(400));
            String tipo = ctx.queryParam("tipo");
            if (tipo == null || tipo.isBlank()) tipo = "catalogo";
            if (tipo.equals("painel")) tipo = "catalogo";

            byte[] png = qrService.png(tipo, tamanho);
            if (png.length == 0) {
                ctx.status(404).json(Map.of("erro", "qr_indisponivel",
                        "mensagem", "Este QR está desligado ou sem conteúdo nas Configurações."));
                return;
            }
            ctx.contentType("image/png").header("Cache-Control", "no-store").result(png);
        });

        // ==========================================
        // ROTAS DE CONTROLE DA FILA E PLAYER
        // ==========================================

        // 1. Retorna o status atual (o que tá tocando, a fila e a pontuação)
        app.get("/api/player/status", ctx -> {
            ctx.json(playerService.obterStatus());
        });

        // 2. Adiciona uma música na fila (recebe o código/ID da música no corpo)
        app.post("/api/player/add", ctx -> {
            AdicionarFilaRequest req = ctx.bodyAsClass(AdicionarFilaRequest.class);

            String chave = req.codigo != null && !req.codigo.isBlank() ? req.codigo : req.musicaId;
            Optional<Musica> musicaOpt = catalogoService.buscarPorCodigo(chave);
            if (musicaOpt.isEmpty()) musicaOpt = catalogoService.buscarPorId(chave);

            if (musicaOpt.isEmpty()) {
                // Se alguém enviar um ID velho ou errado
                ctx.status(404).result("Erro: Música não encontrada no catálogo.");
                return;
            }

            ResultadoPedido r = req.nome == null || req.nome.isBlank()
                    ? filaService.pedirPeloPainel(musicaOpt.get())
                    : filaService.pedir(musicaOpt.get(), req.nome, ctx.ip());

            if (r.aceito) {
                playerService.verificarInicioAutomatico();
                webSocketService.fazerBroadcast(playerService.obterStatus());
                ctx.status(200).result("Música adicionada à fila com sucesso!");
            } else {
                ctx.status(409).result(r.mensagem);
            }
        });

        // 3. Pula a música atual
        app.post("/api/player/next", ctx -> {
            playerService.pularMusica();
            ctx.result("Pulando para a próxima...");
        });

        // ==========================================
        // ADMIN (protegido por PIN quando config.pinAdmin estiver preenchido)
        // ==========================================

        app.post("/api/admin/pular", ctx -> {
            if (negarSemPin(ctx)) return;
            playerService.pularMusica();
            ctx.json(Map.of("ok", true, "mensagem", "Pulando para a próxima..."));
        });

        app.post("/api/admin/pedido/remover", ctx -> {
            if (negarSemPin(ctx)) return;
            PedidoRequest req = ctx.bodyAsClass(PedidoRequest.class);
            boolean saiu = filaService.removerPeloCodigo(req.codigo);
            if (saiu) webSocketService.fazerBroadcast(playerService.obterStatus());
            ctx.status(saiu ? 200 : 404).json(Map.of("ok", saiu));
        });

        app.post("/api/admin/fila/limpar", ctx -> {
            if (negarSemPin(ctx)) return;
            filaService.limpar();
            webSocketService.fazerBroadcast(playerService.obterStatus());
            ctx.json(Map.of("ok", true));
        });

        // Detalhe com IP de origem — coisa que a fila pública não mostra
        app.get("/api/admin/fila", ctx -> {
            if (negarSemPin(ctx)) return;
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("fila", filaService.fila());
            corpo.put("resumo", filaService.resumo());
            Map<String, String> origens = new HashMap<>();
            for (Pedido p : filaService.fila()) {
                origens.put(p.codigo, p.origem == null ? "-" : p.origem);
            }
            corpo.put("origens", origens);
            ctx.json(corpo);
        });
    }

    // ==================================================================
    // AUXILIARES
    // ==================================================================

    /**
     * Rotas que mexem no sistema: só entram com o token do painel.
     *
     * A lista é por padrão fechado no que é escrita. Ficam <b>abertas</b> de propósito, porque o
     * celular do convidado não tem como saber token nenhum: {@code /p}, {@code /api/pedidos},
     * {@code /api/fila}, {@code /api/musicas}, {@code /api/acervo}, {@code /api/sala},
     * {@code /api/qrcode.png}, {@code /api/player/status}, {@code /api/catalogo/info} e
    * {@code /ws} — mais {@code /api/painel/acesso}, que é justamente a porta de entrada.
     *
     * {@code /api/admin/*} fica fora da lista de propósito: é o botão de operador na tela do
     * celular (a mesma que abre pelo QR do catálogo), onde quem está no salão digita o PIN na
     * hora. A guarda dessas rotas é {@link #negarSemPin}, que aceita o PIN <em>ou</em> o token.
    */
    private static final Set<String> ROTAS_PAINEL = Set.of(
            "/api/config",
            "/api/audio-devices",
            "/api/screens",
            "/api/player/add",
            "/api/player/next",
            "/api/painel/info",
            "/api/painel/qrcode.png",
            "/api/painel/token");

    static boolean precisaDeToken(String path) {
        if (ROTAS_PAINEL.contains(path)) return true;
        // qualquer coisa em /api/painel/ exige token, menos a porta de entrada
        return path.startsWith("/api/painel/") && !path.equals("/api/painel/acesso");
    }

    private static int clampTamanho(int tamanho) {
        if (tamanho < 80) return 80;
        return Math.min(tamanho, 1200);
    }

    /**
     * Cookie de 30 dias que libera o link direto do painel.
     *
     * O construtor de cinco argumentos do Javalin é {@code (nome, valor, path, maxAge,
     * SECURE)} — não httpOnly. Passar {@code true} ali marca Secure, e num servidor http puro
     * da LAN o navegador descarta o cookie na hora: a tela de acesso voltaria a pedir o token a
     * cada recarga. Por isso o construtor completo, com Secure falso, HttpOnly verdadeiro e
     * SameSite=Lax (chegamos por QR/link de outro app, mas nunca de um site externo).
     */
    private static Cookie cookieDoPainel(String valor) {
        return new Cookie(TokenPainelService.COOKIE, valor, "/", 60 * 60 * 24 * 30,
                false, 1, true, null, null, SameSite.LAX);
    }

    /**
     * A tela do convidado é o {@code catalogo-front} compilado (pasta {@code /convidado} no jar,
     * com os assets servidos por arquivo estático em {@code /p/}). Se aquela pasta não está no
     * jar — alguém compilou só o Java, sem rodar o build do front — cai no {@code convidado.html}
     * de arquivo único, que faz a mesma coisa sem depender de bundler.
     *
     * Servimos por rota em vez de deixar o spaRoot cuidar: o {@code /} já devolve o painel React
     * da administração, e as duas frentes precisam conviver no mesmo servidor.
     */
    private void servirTelaConvidado(Context ctx) {
        String pagina = recurso("/convidado/index.html");
        if (pagina != null) {
            ctx.contentType("text/html; charset=utf-8")
                    .header("Cache-Control", "no-cache")
                    .result(pagina);
            return;
        }
        ctx.contentType("text/html; charset=utf-8")
                .header("Cache-Control", "no-cache")
                .result(htmlConvidado());
    }

    /** true quando o build do catalogo-front está dentro do jar. */
    public static boolean frontConvidadoCompilado() {
        return ApiController.class.getResource("/convidado/index.html") != null;
    }

    private static String recurso(String caminho) {
        try (InputStream is = ApiController.class.getResourceAsStream(caminho)) {
            return is == null ? null : new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private String htmlConvidado() {
        if (htmlConvidado == null) {
            String lido = recurso("/convidado.html");
            // Fora de /public de propósito: o build do painel escreve em
            // src/main/resources/public com emptyOutDir=true e apagaria este arquivo.
            htmlConvidado = lido != null ? lido
                    : "<h1>convidado.html não encontrado em src/main/resources</h1>";
        }
        return htmlConvidado;
    }

    /**
     * O acervo inteiro, no formato exato do JSON que o {@code catalogo-front} gerava no build:
     * {@code {total, carimboFonte, musicas:[[id,titulo,artista,trecho,duplicada]], artistas:[[nome,qtd]]}}.
     * Assim a troca de "arquivo no bundle" por "API do Java" foi de uma linha no front.
     */
    private Map<String, Object> salaDeAcervo() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", catalogoService.totalMusicas());
        m.put("carimboFonte", catalogoService.carimboAcervo());
        m.put("musicas", catalogoService.acervoCompilado());
        m.put("artistas", catalogoService.artistasFacetas(40));
        return m;
    }

    /** Mesmo formato que o painel já espera, mas com o PIN mascarado e as chaves novas. */
    private Map<String, Object> configParaExibir(AppConfig c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pastas", c.pastas);
        m.put("audioDeviceId", c.audioDeviceId);
        m.put("videoOutputMode", c.videoOutputMode);
        m.put("displayId", c.displayId);
        m.put("urlConvidado", c.urlConvidado == null ? "" : c.urlConvidado);
        m.put("maxPedidosPorPessoa", c.maxPedidosPorPessoa);
        m.put("pinAdmin", c.pinAdmin == null || c.pinAdmin.isBlank() ? "" : "***");
        m.put("pinDefinido", c.pinAdmin != null && !c.pinAdmin.isBlank());
        // /api/config só é lida com o token do painel, então o token pode voltar no claro: a tela
        // precisa mostrar/copiar o valor. Sem token, a rota devolve 401 antes de chegar aqui.
        m.put("tokenPainel", tokenService.token());
        m.put("urlPainel", tokenService.urlPainel());
        m.put("wifiSsid", c.wifiSsid == null ? "" : c.wifiSsid);
        m.put("wifiSenha", c.wifiSenha == null ? "" : c.wifiSenha);
        m.put("wifiSeguranca", c.wifiSeguranca == null || c.wifiSeguranca.isBlank() ? "WPA" : c.wifiSeguranca);
        m.put("urlCatalogoOnline", c.urlCatalogoOnline == null ? "" : c.urlCatalogoOnline);
        m.put("mostrarQrWifi", c.mostrarQrWifi);
        m.put("mostrarQrCatalogoLocal", c.mostrarQrCatalogoLocal);
        m.put("mostrarQrCatalogoOnline", c.mostrarQrCatalogoOnline);
        m.put("qr", qrService.planos());
        return m;
    }

    /** Aplica no runtime o que acabou de ser salvo. */
    public void aplicarConfiguracoes() {
        AppConfig c = configManager.getConfig();
        filaService.definirMaxPendentes(c.maxPedidosPorPessoa);
        salaService.setUrlForcada(c.urlConvidado);
        // pode ter vindo editado no config.json junto com o POST
        tokenService.recarregar();
    }

    /**
     * As rotas de admin aceitam o token do painel <em>ou</em> o PIN digitado na hora. O token já
     * veio pelo filtro {@code before("/api/*")}; o PIN continua servindo para quem está com o
     * console aberto e quer só tirar alguém da fila sem link nenhum.
     */
    private boolean negarSemPin(Context ctx) {
        if (tokenService.autorizado(ctx)) return false;

        String pin = configManager.getConfig().pinAdmin;
        if (pin == null || pin.isBlank()) return false; // sem PIN configurado = como é hoje

        String informado = ctx.header("X-PIN");
        if (informado == null) informado = ctx.queryParam("pin");

        if (informado != null && pin.strip().equals(informado.strip())) return false;

        ctx.status(401).json(Map.of("erro", "pin_necessario", "mensagem", "Precisa do PIN de operador."));
        return true;
    }
}
