package br.com.andreg.karaoke.app.controller;

import br.com.andreg.karaoke.app.Main;
import br.com.andreg.karaoke.app.config.ConfigManager;
import br.com.andreg.karaoke.app.model.AdicionarFilaRequest;
import br.com.andreg.karaoke.app.model.AppConfig;
import br.com.andreg.karaoke.app.model.Musica;
import br.com.andreg.karaoke.app.service.CatalogoService;
import br.com.andreg.karaoke.app.service.PlayerService;
import br.com.andreg.karaoke.app.service.WebSocketService;
import io.javalin.Javalin;

import java.util.Optional;
import java.util.stream.Collectors;

public class ApiController {

    private final ConfigManager configManager;
    private final CatalogoService catalogoService;
    private final PlayerService playerService;
    private final WebSocketService webSocketService;

    public ApiController(ConfigManager configManager, CatalogoService catalogoService, PlayerService playerService, WebSocketService webSocketService) {
        this.configManager = configManager;
        this.catalogoService = catalogoService;
        this.playerService = playerService;
        this.webSocketService = webSocketService;
    }

    public void registrarRotas(Javalin app) {
        // ==========================================
        // WEBSOCKETS (NOVO)
        // ==========================================
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
        });
        
        // ==========================================
        // ROTAS DE CONFIGURAÇÃO
        // ==========================================
        
        // Retorna as configurações atuais para preencher o formulário do frontend
        app.get("/api/config", ctx -> {
            ctx.json(configManager.getConfig());
        });

        // Recebe o JSON completo do frontend, salva no HD e recarrega as pastas
        app.post("/api/config", ctx -> {
            AppConfig payload = ctx.bodyAsClass(AppConfig.class);
            AppConfig configAtual = configManager.getConfig();
            
            // Atualiza os dados removendo eventuais linhas em branco nas pastas
            configAtual.pastas = payload.pastas.stream()
                    .filter(p -> p != null && !p.trim().isEmpty())
                    .collect(Collectors.toList());
            
            configAtual.audioDeviceId = payload.audioDeviceId;
            configAtual.displayId = payload.displayId;
            configAtual.videoOutputMode = payload.videoOutputMode;

            // Salva no config.json
            configManager.salvar();
            
            // Recarrega o catálogo imediatamente com as novas pastas
            catalogoService.carregar(configAtual.pastas);
            
            ctx.json(configAtual);
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

            // Chama o serviço com os novos parâmetros e o Javalin converte automaticamente a RespostaPaginada para JSON
            ctx.json(catalogoService.pesquisar(termoBusca, page, limit));
        });

        app.get("/api/audio-devices", ctx -> {
            ctx.json(playerService.listarDispositivosAudio());
        });

        app.get("/api/screens", ctx -> {
            ctx.json(playerService.listarTelas());
        });

        // ==========================================
        // ROTAS DE CONTROLE DA FILA E PLAYER
        // ==========================================

        // 1. Retorna o status atual (o que tá tocando, a fila e a pontuação)
        app.get("/api/player/status", ctx -> {
            ctx.json(playerService.obterStatus());
        });

        // 2. Adiciona uma música na fila (recebe o ID da música no corpo)
        app.post("/api/player/add", ctx -> {
            AdicionarFilaRequest req = ctx.bodyAsClass(AdicionarFilaRequest.class);
            
            // Busca a música instantaneamente pelo ID
            Optional<Musica> musicaOpt = catalogoService.buscarPorId(req.musicaId);
            
            if (musicaOpt.isPresent()) {
                playerService.adicionarNaFila(musicaOpt.get());
                ctx.status(200).result("Música adicionada à fila com sucesso!");
            } else {
                // Se alguém enviar um ID velho ou errado
                ctx.status(404).result("Erro: Música não encontrada no catálogo.");
            }
        });

        // 3. Pula a música atual
        app.post("/api/player/next", ctx -> {
            playerService.pularMusica();
            ctx.result("Pulando para a próxima...");
        });
    }
}