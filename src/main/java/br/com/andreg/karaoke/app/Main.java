package br.com.andreg.karaoke.app;

import java.awt.AWTException;
import java.awt.Desktop;
import java.awt.Image;
import java.awt.MenuItem;
import java.awt.PopupMenu;
import java.awt.SystemTray;
import java.awt.Toolkit;
import java.awt.TrayIcon;
import java.net.URI;

import javax.swing.UIManager;

import br.com.andreg.karaoke.app.config.ConfigManager;
import br.com.andreg.karaoke.app.controller.ApiController;
import br.com.andreg.karaoke.app.service.CatalogoService;
import br.com.andreg.karaoke.app.service.FilaService;
import br.com.andreg.karaoke.app.service.PlayerService;
import br.com.andreg.karaoke.app.service.SalaService;
import br.com.andreg.karaoke.app.service.TokenPainelService;
import br.com.andreg.karaoke.app.service.QrSalaService;
import br.com.andreg.karaoke.app.service.WebSocketService;
import io.javalin.Javalin;

public class Main {

    /** Porta única da festa: painel, tela de convidado e API moram aqui. */
    public static final int PORTA = 7000;

    public static void main(String[] args) {
        // --- 1. MÁGICA DO VISUAL NATIVO ---
        // Força o Java a abandonar o visual "Windows 95" e usar o tema atual do teu Linux/Windows
        com.formdev.flatlaf.FlatDarkLaf.setup();

        // --- 2. O resto do teu código continua a partir daqui ---
        // Javalin.create()...
        // if (SystemTray.isSupported()) { ... }
        // etc...

        // CORREÇÃO DO DELAY NO LINUX: Desativa o AT-SPI para evitar o timeout de 120s do D-Bus
        System.setProperty("javax.accessibility.assistive_technologies", "");
        System.setProperty("java.awt.headless", "false"); // Garante que o Java sabe que temos um monitor

        System.out.println("Iniciando Karaokê Server...");


        ConfigManager configManager = new ConfigManager();
        CatalogoService catalogoService = new CatalogoService();
        catalogoService.carregar(configManager.getConfig().pastas);

        // A sala (IP + QR) e a fila (regra dos dois andares) nascem antes do player:
        // a tela de descanso precisa do QR no instante em que é criada.
        SalaService salaService = new SalaService(PORTA);
        salaService.setUrlForcada(configManager.getConfig().urlConvidado);

        // Token do painel: nasce (ou revive do config.json) antes do navegador, porque é a URL que
        // vamos abrir. A tela do convidado nunca passa por aqui.
        TokenPainelService tokenService = new TokenPainelService(configManager, salaService);
        QrSalaService qrService = new QrSalaService(configManager, salaService);

        FilaService filaService = new FilaService();
        filaService.definirMaxPendentes(configManager.getConfig().maxPedidosPorPessoa);

        WebSocketService wsService = new WebSocketService(); // 1. Cria o WS
        PlayerService playerService = new PlayerService(configManager, wsService, filaService, salaService, qrService); // 2. Passa para o Player

        ApiController apiController = new ApiController(configManager, catalogoService, playerService, wsService, filaService, salaService, tokenService, qrService); // 3. Passa para a API

        // 4. Sobe o servidor Javalin
        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()));
            
            // Serve os arquivos estáticos (CSS, JS do Vite)
            config.staticFiles.add("/public", io.javalin.http.staticfiles.Location.CLASSPATH);

            // Segunda frente: o catálogo do convidado (catalogo-front), servido em /p/.
            // O index é servido por rota (ApiController), os assets com hash no nome vêm aqui e
            // podem ficar cacheados uma semana — numa festa Wi-Fi isso é o que salva a rede.
            if (ApiController.frontConvidadoCompilado()) {
                config.staticFiles.add(arquivos -> {
                    arquivos.hostedPath = "/p";
                    arquivos.directory = "/convidado";
                    arquivos.location = io.javalin.http.staticfiles.Location.CLASSPATH;
                    arquivos.headers.put("Cache-Control", "public, max-age=604800");
                });
            }

            // ========================================================
            // A MÁGICA DO SPA: Se não achar a rota, devolve o index do React
            // ========================================================
            config.spaRoot.addFile("/", "/public/index.html", io.javalin.http.staticfiles.Location.CLASSPATH);
            
        }).start(PORTA);

        apiController.registrarRotas(app);
        apiController.aplicarConfiguracoes();

        // Inicia o keepalive do WebSocket
        wsService.iniciarKeepAlive();

        // Registra um "hook" para fechar o VLC limpinho quando derrubarmos o servidor no terminal (Ctrl+C)
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            wsService.pararKeepAlive();
            playerService.desligar();
        }));

        // --- NOVO: Abrir o navegador automaticamente ---
        // No endereço local do próprio computador, com o token: ele não precisa digitar nada.
        abrirNavegador("http://localhost:" + PORTA + "/dashboard?token=" + tokenService.token());

        System.out.println("🚀 Servidor rodando em http://localhost:" + PORTA);
        System.out.println("🎤 O controle do Karaokê foi aberto no seu navegador.");
        System.out.println("📱 Convidados pedem música em " + salaService.urlConvidado());
        System.out.println("🖼  Cada QR da tela de descanso vem de /api/qrcode.png?tipo=wifi|catalogo|online");
        // O QR do painel sai aqui, em ASCII: é o jeito mais rápido de abrir o controle no celular.
        System.out.println(tokenService.bannerDoConsole());

        if (SystemTray.isSupported()) {
            try {
                SystemTray tray = SystemTray.getSystemTray();
                java.net.URL urlDoIcone = Main.class.getResource("/icon.png");
                Image image = Toolkit.getDefaultToolkit().getImage(urlDoIcone);

                // 2. Criar o Menu
                PopupMenu menu = new PopupMenu();
            
            MenuItem statusItem = new MenuItem("🎤 Karaokê NDI - A Correr");
            statusItem.setEnabled(false); // Apenas informativo (fica a cinzento)
            menu.add(statusItem);
            
            menu.addSeparator(); // Linha divisória

            // Opção 1: Abrir o navegador
            MenuItem itemPainel = new MenuItem("Abrir Painel de Controlo");
            itemPainel.addActionListener(e -> {
                try {
                    java.awt.Desktop.getDesktop().browse(
                            new java.net.URI(tokenService.urlPainel()));
                } catch (Exception ex) {
                    System.err.println("Erro ao abrir navegador: " + ex.getMessage());
                }
            });
            menu.add(itemPainel);

            // Opção 2: Janela de Sobre
            MenuItem itemSobre = new MenuItem("Sobre...");
            itemSobre.addActionListener(e -> {
                // Abre uma caixinha de aviso simples mesmo sem ter a janela de vídeo aberta
                javax.swing.JOptionPane.showMessageDialog(null, 
                    "Sistema de Karaokê Profissional v1.0\nMotor: VLC + NDI\n\nDesenvolvido por Andre G.", 
                    "Sobre o Sistema", 
                    javax.swing.JOptionPane.INFORMATION_MESSAGE);
            });
            menu.add(itemSobre);

            menu.addSeparator(); // Outra linha divisória

            // Opção 3: Sair (O que já tínhamos)
            MenuItem exitItem = new MenuItem("Encerrar Sistema");
            exitItem.addActionListener(e -> {
                System.out.println("A encerrar pelo menu da bandeja do sistema...");
                // Se tiveres acesso ao teu playerService aqui, podes chamar playerService.desligar()
                System.exit(0); 
            });
            menu.add(exitItem);

            // 3. Adicionar o Menu ao Ícone
            TrayIcon trayIcon = new TrayIcon(image, "Karaokê NDI", menu);
            trayIcon.setImageAutoSize(true);
            
            tray.add(trayIcon);
                
            } catch (AWTException e) {
                System.err.println("Não foi possível adicionar o ícone à bandeja do sistema.");
            }
        }
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
