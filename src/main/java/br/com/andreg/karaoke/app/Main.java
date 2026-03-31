package br.com.andreg.karaoke.app;

import java.awt.Desktop;
import java.net.URI;

import br.com.andreg.karaoke.app.config.ConfigManager;
import br.com.andreg.karaoke.app.controller.ApiController;
import br.com.andreg.karaoke.app.service.CatalogoService;
import br.com.andreg.karaoke.app.service.PlayerService;
import br.com.andreg.karaoke.app.service.WebSocketService;
import io.javalin.Javalin;

public class Main {

    public static void main(String[] args) {
        // CORREÇÃO DO DELAY NO LINUX: Desativa o AT-SPI para evitar o timeout de 120s do D-Bus
        System.setProperty("javax.accessibility.assistive_technologies", "");
        System.setProperty("java.awt.headless", "false"); // Garante que o Java sabe que temos um monitor

        System.out.println("Iniciando Karaokê Server...");


        ConfigManager configManager = new ConfigManager();
        CatalogoService catalogoService = new CatalogoService();
        catalogoService.carregar(configManager.getConfig().pastas);

        WebSocketService wsService = new WebSocketService(); // 1. Cria o WS
        PlayerService playerService = new PlayerService(configManager, wsService); // 2. Passa para o Player

        ApiController apiController = new ApiController(configManager, catalogoService, playerService, wsService); // 3. Passa para a API

        // 4. Sobe o servidor Javalin
        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()));
            
            // Serve os arquivos estáticos (CSS, JS do Vite)
            config.staticFiles.add("/public", io.javalin.http.staticfiles.Location.CLASSPATH);
            
            // ========================================================
            // A MÁGICA DO SPA: Se não achar a rota, devolve o index do React
            // ========================================================
            config.spaRoot.addFile("/", "/public/index.html", io.javalin.http.staticfiles.Location.CLASSPATH);
            
        }).start(7000);

        apiController.registrarRotas(app);

        // Registra um "hook" para fechar o VLC limpinho quando derrubarmos o servidor no terminal (Ctrl+C)
        Runtime.getRuntime().addShutdownHook(new Thread(playerService::desligar));

        // --- NOVO: Abrir o navegador automaticamente ---
        abrirNavegador("http://localhost:7000/dashboard");

        System.out.println("🚀 Servidor rodando em http://localhost:7000");
        System.out.println("🎤 O controle do Karaokê foi aberto no seu navegador.");
    }

    private static void abrirNavegador(String url) {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                // Método padrão Java
                Desktop.getDesktop().browse(new URI(url));
            } else {
                // Fallback para Linux (caso o Desktop precise de ajuda)
                Runtime runtime = Runtime.getRuntime();
                runtime.exec("xdg-open " + url);
            }
        } catch (Exception e) {
            System.err.println("Não foi possível abrir o navegador automaticamente: " + e.getMessage());
        }
    }
}