package br.com.andreg.karaoke.app.service;

import me.walkerknapp.devolay.Devolay;
import me.walkerknapp.devolay.DevolayFrameFourCCType;
import me.walkerknapp.devolay.DevolaySender;
import me.walkerknapp.devolay.DevolayVideoFrame;

import uk.co.caprica.vlcj.player.embedded.videosurface.callback.RenderCallback;
import uk.co.caprica.vlcj.player.embedded.videosurface.callback.BufferFormat;
import uk.co.caprica.vlcj.player.embedded.videosurface.callback.BufferFormatCallbackAdapter;
import uk.co.caprica.vlcj.player.base.MediaPlayer;

import java.nio.ByteBuffer;

import me.walkerknapp.devolay.DevolayAudioFrameInterleaved16s;
import uk.co.caprica.vlcj.player.base.callback.AudioCallbackAdapter;
import com.sun.jna.Pointer;

import br.com.andreg.karaoke.app.config.ConfigManager;
import br.com.andreg.karaoke.app.model.AppConfig;
import br.com.andreg.karaoke.app.model.Musica;
import uk.co.caprica.vlcj.factory.MediaPlayerFactory;
import uk.co.caprica.vlcj.player.base.AudioDevice;
import uk.co.caprica.vlcj.player.base.MediaPlayerEventAdapter;
import uk.co.caprica.vlcj.player.component.EmbeddedMediaPlayerComponent;
import uk.co.caprica.vlcj.player.base.MarqueePosition;

import javax.swing.*;
import java.awt.*;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.InputStream;
import java.util.*;
import java.util.List;
import java.util.Queue;

public class PlayerService {

    private final WebSocketService webSocketService;

    private MediaPlayerFactory factory;
    private MediaPlayer mediaPlayer;
    private EmbeddedMediaPlayerComponent mediaPlayerComponent;
    
    private JFrame videoFrame;
    private JPanel painelPrincipal;
    private CardLayout cardLayout;
    
    private TvPanel painelTv;

    private final ConfigManager configManager;

    private final Queue<Musica> fila = new LinkedList<>();
    private Musica musicaAtual = null;
    private String estadoAtual = "PARADO";
    private int ultimaPontuacao = 0;

    // --- NOVO --- : Variáveis globais para o NDI assumir a tela de descanso
    private boolean isNdiMode = false;
    private boolean vlcTocando = false;
    private DevolaySender ndiSender;
    private DevolayVideoFrame ndiVideoFrame;
    private ByteBuffer bufferGraficosJava;

    public PlayerService(ConfigManager configManager, WebSocketService webSocketService) {
        this.configManager = configManager;
        this.webSocketService = webSocketService;
        inicializarMotor();
    }

    private void inicializarMotor() {
        AppConfig config = configManager.getConfig();
        isNdiMode = "NDI".equals(config.videoOutputMode);

        // --- NOVO --- : Criamos o painel animado INDEPENDENTE do modo. 
        // Se for janela, ele vai pra janela. Se for NDI, ele renderiza na memória.
        painelTv = new TvPanel();
        painelTv.setSize(1920, 1080); // Forçamos o tamanho Full HD na memória

        if (isNdiMode) {
            System.out.println("A iniciar motor em modo NDI DIRETO (Devolay)...");
            
            try {
                Devolay.loadLibraries();
                System.out.println("✅ NDI Runtime encontrado!");
            } catch (UnsatisfiedLinkError | Exception e) {
                System.err.println("❌ ERRO CRÍTICO: NDI SDK não encontrado neste Linux!");
                return;
            }
            
            // Instancia os transmissores globais
            ndiSender = new DevolaySender("Karaoke_Java");
            ndiVideoFrame = new DevolayVideoFrame();
            
            DevolayAudioFrameInterleaved16s ndiAudioFrame = new DevolayAudioFrameInterleaved16s();
            ndiAudioFrame.setSampleRate(48000); 
            ndiAudioFrame.setChannels(2);     
            
            this.factory = new MediaPlayerFactory("--avcodec-hw=none");
            uk.co.caprica.vlcj.player.embedded.EmbeddedMediaPlayer embeddedPlayer = factory.mediaPlayers().newEmbeddedMediaPlayer();
            this.mediaPlayer = embeddedPlayer;
            
            embeddedPlayer.videoSurface().set(factory.videoSurfaces().newVideoSurface(
                new BufferFormatCallbackAdapter() {
                    @Override
                    public BufferFormat getBufferFormat(int sourceWidth, int sourceHeight) {
                        int targetWidth = 1920;
                        int targetHeight = 1080;
                        
                        ndiVideoFrame.setResolution(targetWidth, targetHeight);
                        ndiVideoFrame.setFourCCType(DevolayFrameFourCCType.BGRA);
                        ndiVideoFrame.setFrameRate(60000, 1000); 
                        ndiVideoFrame.setLineStride(targetWidth * 4); 
                        
                        return new BufferFormat("RV32", targetWidth, targetHeight, new int[]{targetWidth * 4}, new int[]{targetHeight});
                    }
                },
                new RenderCallback() {
                    @Override
                    public void display(MediaPlayer mediaPlayer, ByteBuffer[] nativeBuffers, BufferFormat bufferFormat) {
                        vlcTocando = true; // O VLC avisa que assumiu o vídeo!
                        
                        // FORÇA o frame de volta para o padrão de cores do VLC antes de enviar!
                        ndiVideoFrame.setFourCCType(DevolayFrameFourCCType.BGRA);
                        
                        ndiVideoFrame.setData(nativeBuffers[0]);
                        ndiSender.sendVideoFrame(ndiVideoFrame);
                    }
                },
                true
            ));

            embeddedPlayer.audio().callback("S16N", 48000, 2, new AudioCallbackAdapter() {
                @Override
                public void play(MediaPlayer mediaPlayer, Pointer samples, int sampleCount, long pts) {
                    int tamanhoBytes = sampleCount * 2 * 2;
                    ByteBuffer bufferDeAudio = samples.getByteBuffer(0, tamanhoBytes);
                    
                    ndiAudioFrame.setSamples(sampleCount);
                    ndiAudioFrame.setData(bufferDeAudio);
                    
                    ndiSender.sendAudioFrameInterleaved16s(ndiAudioFrame); 
                }
            });

            // --- NOVO --- : Inicia a Thread que vai desenhar o TvPanel no NDI quando o VLC parar
            iniciarLoopDeGraficosNDI();

        } else {
            System.out.println("A iniciar motor em modo Janela Autônoma...");
            this.factory = new MediaPlayerFactory("--avcodec-hw=none");
            this.mediaPlayerComponent = new EmbeddedMediaPlayerComponent();
            this.mediaPlayer = mediaPlayerComponent.mediaPlayer();
            
            this.videoFrame = new JFrame();
            this.videoFrame.setUndecorated(true);
            this.videoFrame.setBackground(Color.BLACK);
            
            cardLayout = new CardLayout();
            painelPrincipal = new JPanel(cardLayout);
            painelPrincipal.setBackground(Color.BLACK);

            painelPrincipal.add(painelTv, "TELA_TV");
            painelPrincipal.add(mediaPlayerComponent, "TELA_VIDEO");

            this.videoFrame.setContentPane(painelPrincipal);
            
            try {
                int displayIndex = Integer.parseInt(config.displayId);
                GraphicsDevice[] screens = GraphicsEnvironment.getLocalGraphicsEnvironment().getScreenDevices();
                if (displayIndex >= 0 && displayIndex < screens.length) {
                    videoFrame.setBounds(screens[displayIndex].getDefaultConfiguration().getBounds());
                } else {
                    videoFrame.setExtendedState(JFrame.MAXIMIZED_BOTH);
                }
            } catch (Exception e) {
                videoFrame.setExtendedState(JFrame.MAXIMIZED_BOTH);
            }

            this.videoFrame.setVisible(true);
            cardLayout.show(painelPrincipal, "TELA_TV");
        }

        // Configura o visual do letreiro, mas deixa o texto vazio por enquanto
        this.mediaPlayer.marquee().setSize(20); 
        this.mediaPlayer.marquee().setColour(0xFFFFFF); 
        this.mediaPlayer.marquee().setPosition(MarqueePosition.BOTTOM_LEFT); 
        this.mediaPlayer.marquee().setOpacity(200); 
        this.mediaPlayer.marquee().setTimeout(0); 
        this.mediaPlayer.marquee().enable(true);

        this.mediaPlayer.events().addMediaPlayerEventListener(new MediaPlayerEventAdapter() {
            @Override
            public void timeChanged(MediaPlayer mediaPlayer, long newTime) {
                if ("TOCANDO".equals(estadoAtual)) {
                    long totalTime = mediaPlayer.media().info().duration();
                    
                    if (totalTime > 0) {
                        String textoTempo = " " + formatarTempo(newTime) + " / " + formatarTempo(totalTime) + " ";
                        
                        // Atualiza o texto do Marquee instantaneamente!
                        mediaPlayer.marquee().setText(textoTempo);
                    }
                }
            }

            @Override
            public void finished(MediaPlayer mediaPlayer) {
                // A REGRA DE OURO: Executar as ações numa Thread separada para não engasgar o VLC nativo!
                new Thread(() -> {
                    if ("TOCANDO".equals(estadoAtual)) {
                        // 1. O vídeo do cantor acabou. Prepara a pontuação!
                        estadoAtual = "PONTUACAO";
                        musicaAtual = null;
                        vlcTocando = false; 
                        
                        ultimaPontuacao = new Random().nextInt(31) + 70; 
                        webSocketService.fazerBroadcast(obterStatus()); 
                        
                        // Pega a configuração com o tempo exato para esta nota!
                        AudioNotaConfig configAudio = obterConfigAudioNota(ultimaPontuacao);

                        // Atualiza a interface gráfica passando o tempo de suspense
                        SwingUtilities.invokeLater(() -> {
                            painelTv.setEstado("PONTUACAO", ultimaPontuacao, configAudio.tempoSuspenseMs);
                            if (!isNdiMode && videoFrame != null) {
                                cardLayout.show(painelPrincipal, "TELA_TV");
                            }
                        });

                        if (configAudio.caminho != null) {
                            // Deixa o VLC tocar o .wav
                            mediaPlayer.media().play(configAudio.caminho);
                        } else {
                            // Fallback de segurança: Se você apagar o .wav sem querer, ele espera 7s e pula
                            try { Thread.sleep(7000); } catch (InterruptedException ignored) {}
                            if ("PONTUACAO".equals(estadoAtual)) {
                                tocarProxima();
                            }
                        }
                        
                    } else if ("PONTUACAO".equals(estadoAtual)) {
                        // 2. MÁGICA: O áudio da nota (.wav) acabou de tocar!
                        // Vamos automaticamente para a próxima música na fila.
                        tocarProxima();
                    }
                }).start();
            }
        });
    }

    // --- NOVO --- : O motor que desenha a sua arte linda no NDI com CORES PERFEITAS!
    private void iniciarLoopDeGraficosNDI() {
        bufferGraficosJava = ByteBuffer.allocateDirect(1920 * 1080 * 4);
        
        new Thread(() -> {
            while (true) {
                try {
                    // Se a música estiver tocando, a thread dorme
                    if (vlcTocando) {
                        Thread.sleep(33);
                        continue;
                    }

                    // 1. Cria uma imagem invisível usando BGR (3 bytes, sem canal Alpha para não confundir)
                    BufferedImage img = new BufferedImage(1920, 1080, BufferedImage.TYPE_3BYTE_BGR);
                    Graphics2D g2 = img.createGraphics();

                    // 2. MÁGICA: Pede para o seu TvPanel se desenhar
                    painelTv.paint(g2);
                    g2.dispose();

                    // 3. Extrai os bytes da imagem (Estão exatamente na ordem Azul, Verde, Vermelho)
                    byte[] pixels = ((java.awt.image.DataBufferByte) img.getRaster().getDataBuffer()).getData();
                    
                    // 4. Mapeamento Manual (Força Bruta): Injeta B-G-R e crava o Alpha (Transparência) no máximo
                    bufferGraficosJava.clear();
                    for (int i = 0; i < pixels.length; i += 3) {
                        bufferGraficosJava.put(pixels[i]);     // Blue (Azul)
                        bufferGraficosJava.put(pixels[i + 1]); // Green (Verde)
                        bufferGraficosJava.put(pixels[i + 2]); // Red (Vermelho)
                        bufferGraficosJava.put((byte) 255);    // Alpha (Opaco total)
                    }
                    bufferGraficosJava.flip();

                    // 5. Transmite o frame CRAVADO em BGRA (O mesmo do VLC)
                    ndiVideoFrame.setData(bufferGraficosJava);
                    ndiVideoFrame.setResolution(1920, 1080);
                    ndiVideoFrame.setFourCCType(DevolayFrameFourCCType.BGRA); 
                    ndiVideoFrame.setLineStride(1920 * 4);
                    ndiSender.sendVideoFrame(ndiVideoFrame);

                    // ~30 FPS de animação
                    Thread.sleep(33);

                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    public void adicionarNaFila(Musica musica) {
        fila.offer(musica);
        if (estadoAtual.equals("PARADO") && musicaAtual == null) {
            tocarProxima();
        }
        webSocketService.fazerBroadcast(obterStatus());
    }

    public void tocarProxima() {
        if (fila.isEmpty()) {
            estadoAtual = "PARADO";
            musicaAtual = null;
            vlcTocando = false; // --- NOVO --- : Liberta o NDI para a tela inicial!
            
            SwingUtilities.invokeLater(() -> {
                painelTv.setEstado("PARADO", 0, 0);
                if (!isNdiMode && videoFrame != null) {
                    cardLayout.show(painelPrincipal, "TELA_TV");
                }
            });
            return;
        }

        musicaAtual = fila.poll();
        estadoAtual = "TOCANDO";
        
        if (!isNdiMode && videoFrame != null) {
            SwingUtilities.invokeLater(() -> cardLayout.show(painelPrincipal, "TELA_VIDEO"));
        }

        System.out.println("A reproduzir: " + musicaAtual.titulo);
        mediaPlayer.media().play(musicaAtual.caminho);
        // O vlcTocando será setado para 'true' automaticamente no RenderCallback do VLC!

        String audioId = configManager.getConfig().audioDeviceId;
        if (audioId != null && !audioId.isEmpty()) {
            new Thread(() -> {
                try {
                    Thread.sleep(500); 
                    mediaPlayer.audio().setOutputDevice("alsa", audioId);
                    System.out.println("Comando de roteamento de áudio enviado para o dispositivo: " + audioId);
                } catch (Exception e) {
                    System.err.println("Erro ao tentar mudar o áudio: " + e.getMessage());
                }
            }).start();
        }

        webSocketService.fazerBroadcast(obterStatus());
    }

    public void pularMusica() {
        mediaPlayer.controls().stop();
        tocarProxima();
    }

    public Map<String, Object> obterStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("estado", estadoAtual);
        status.put("musicaAtual", musicaAtual);
        status.put("pontuacao", ultimaPontuacao);
        status.put("fila", new ArrayList<>(fila));
        return status;
    }

    public List<Map<String, String>> listarDispositivosAudio() {
        List<Map<String, String>> lista = new ArrayList<>();
        List<AudioDevice> devices = mediaPlayer.audio().outputDevices();
        if (devices != null) {
            for (AudioDevice device : devices) {
                Map<String, String> map = new HashMap<>();
                map.put("id", device.getDeviceId());
                map.put("nome", device.getLongName());
                lista.add(map);
            }
        }
        return lista;
    }

    public List<Map<String, String>> listarTelas() {
        List<Map<String, String>> lista = new ArrayList<>();
        try {
            GraphicsEnvironment ge = GraphicsEnvironment.getLocalGraphicsEnvironment();
            GraphicsDevice[] telas = ge.getScreenDevices();
            for (int i = 0; i < telas.length; i++) {
                Map<String, String> map = new HashMap<>();
                map.put("id", String.valueOf(i));
                map.put("nome", "Monitor " + (i + 1) + " (" + telas[i].getDisplayMode().getWidth() + "x" + telas[i].getDisplayMode().getHeight() + ")");
                lista.add(map);
            }
        } catch (Exception e) {}
        return lista;
    }

    public void desligar() {
        if (painelTv != null) painelTv.pararAnimacao();
        if (mediaPlayer != null) mediaPlayer.release();
        if (mediaPlayerComponent != null) mediaPlayerComponent.release();
        if (factory != null) factory.release();
        if (videoFrame != null) videoFrame.dispose();
    }

   // Classe auxiliar para mapear o arquivo e o tempo de suspense (em milissegundos)
    private static class AudioNotaConfig {
        String caminho;
        int tempoSuspenseMs;

        AudioNotaConfig(String caminho, int tempoSuspenseMs) {
            this.caminho = caminho;
            this.tempoSuspenseMs = tempoSuspenseMs;
        }
    }

    private AudioNotaConfig obterConfigAudioNota(int nota) {
        String nomeArquivo;
        int tempoMs;
        
        // Mapeamento (mesmo de antes)
        if (nota == 100) { nomeArquivo = "nota 100.wav"; tempoMs = 1900; }
        else if (nota >= 95) { nomeArquivo = "nota 99-95.wav"; tempoMs = 1700; }
        else if (nota >= 90) { nomeArquivo = "nota 94-90.wav"; tempoMs = 1700; }
        else if (nota >= 85) { nomeArquivo = "nota 89-85.wav"; tempoMs = 1600; }
        else if (nota >= 80) { nomeArquivo = "nota 84-80.wav"; tempoMs = 1600; }
        else if (nota >= 75) { nomeArquivo = "nota 79-75.wav"; tempoMs = 1500; }
        else { nomeArquivo = "nota 74-70.wav"; tempoMs = 1500; }

        // Tenta carregar o arquivo externo
        File pastaExterna = new File("audios");
        if (!pastaExterna.exists()) pastaExterna.mkdir();

        File arquivoNoDisco = new File(pastaExterna, nomeArquivo);

        // Se o arquivo não estiver no disco, vamos "parir" ele de dentro do JAR
        if (!arquivoNoDisco.exists()) {
            try (InputStream is = getClass().getResourceAsStream("/audios/" + nomeArquivo)) {
                if (is != null) {
                    java.nio.file.Files.copy(is, arquivoNoDisco.toPath());
                    System.out.println("📦 Extraído do JAR: " + nomeArquivo);
                }
            } catch (Exception e) {
                System.err.println("Erro ao extrair áudio: " + e.getMessage());
            }
        }

        if (arquivoNoDisco.exists()) {
            return new AudioNotaConfig(arquivoNoDisco.getAbsolutePath(), tempoMs);
        }

        return new AudioNotaConfig(null, 0);
    }

    // --- NOVO --- : Converte milissegundos para MM:SS
    private String formatarTempo(long millis) {
        if (millis < 0) return "00:00";
        long segundos = (millis / 1000) % 60;
        long minutos = (millis / (1000 * 60)) % 60;
        long horas = (millis / (1000 * 60 * 60));
        
        if (horas > 0) {
            return String.format("%02d:%02d:%02d", horas, minutos, segundos);
        }
        return String.format("%02d:%02d", minutos, segundos);
    }

    // =========================================================================
    // CLASSE INTERNA MANTIDA INTACTA!
    // =========================================================================
    // =========================================================================
    // CLASSE INTERNA: PAINEL CUSTOMIZADO COM RENDERIZAÇÃO 2D E ANIMAÇÕES
    // =========================================================================
    private static class TvPanel extends JPanel {
        private String estado = "PARADO";
        private int pontuacao = 0;
        
        private final javax.swing.Timer animTimer;
        private float tick = 0;

        // --- NOVO --- : Variáveis para o suspense da Roleta
        private long tempoInicioPontuacao = 0;
        private int numeroRoleta = 0;
        private final Random random = new Random();

        // Adicione esta variável junto com as outras
        private int tempoSuspenseAtual = 3500; 

        public TvPanel() {
            setBackground(Color.BLACK);
            // Timer que roda a ~60 FPS
            animTimer = new javax.swing.Timer(16, e -> {
                tick += 0.05f;
                repaint();
            });
            animTimer.start();
        }

        // Altere o método setEstado para receber o tempo
        public void setEstado(String estado, int pontuacao, int tempoSuspenseMs) {
            this.estado = estado;
            this.pontuacao = pontuacao;
            this.tempoSuspenseAtual = tempoSuspenseMs; // Guarda o tempo específico desta nota!
            this.tick = 0; 
            
            if ("PONTUACAO".equals(estado)) {
                this.tempoInicioPontuacao = System.currentTimeMillis();
            }
            
            repaint();
        }

        public void pararAnimacao() {
            if (animTimer != null) animTimer.stop();
        }

        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2d = (Graphics2D) g.create();
            
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            int w = getWidth();
            int h = getHeight();
            int centerX = w / 2;
            int centerY = h / 2;

            if ("PARADO".equals(estado)) {
                // (O código do estado PARADO continua igualzinho...)
                float alpha = (float) ((Math.sin(tick) + 1) / 4); 
                Color[] colorsBg = {new Color(59, 130, 246, (int)(alpha * 100)), new Color(0, 0, 0, 0)};
                RadialGradientPaint rgp = new RadialGradientPaint(new Point2D.Float(centerX, centerY), 600, new float[]{0.0f, 1.0f}, colorsBg);
                g2d.setPaint(rgp);
                g2d.fillRect(0, 0, w, h);

                Font fontTitle = new Font("SansSerif", Font.BOLD, 120);
                g2d.setFont(fontTitle);
                String text = "KARAOKÊ LIVRE";
                int textW = g2d.getFontMetrics().stringWidth(text);
                int textX = centerX - (textW / 2);
                int textY = centerY - 50;

                GradientPaint gpText = new GradientPaint(textX, textY - 100, new Color(96, 165, 250), textX + textW, textY, new Color(168, 85, 247));
                g2d.setPaint(gpText);
                g2d.drawString(text, textX, textY);

                g2d.setFont(new Font("SansSerif", Font.PLAIN, 45));
                g2d.setPaint(new Color(156, 163, 175));
                String sub = "Escolha uma música pelo celular!";
                int subW = g2d.getFontMetrics().stringWidth(sub);
                g2d.drawString(sub, centerX - (subW / 2), centerY + 60);

            } else if ("PONTUACAO".equals(estado)) {
                
                // --- NOVO --- : Lógica do Cronômetro da Roleta
                long tempoDecorrido = System.currentTimeMillis() - tempoInicioPontuacao;
                boolean isRoletaGirando = tempoDecorrido < tempoSuspenseAtual;
                
                if (isRoletaGirando) {
                    // Atualiza o número a cada pouco para não ser um borrão ilegível
                    if (Math.random() < 0.2) {
                        numeroRoleta = random.nextInt(90) + 10; // Gera números entre 10 e 99
                    }
                }

                // Efeito de pulo (só faz o pulo depois que a roleta parar)
                int offsetY = isRoletaGirando ? 0 : (int) (Math.sin(tick * 2) * 20); 

                // Brilho no fundo
                Color[] colorsGlow = {new Color(234, 179, 8, 80), new Color(0, 0, 0, 0)};
                RadialGradientPaint rgp = new RadialGradientPaint(new Point2D.Float(centerX, centerY + offsetY), 500, new float[]{0.0f, 1.0f}, colorsGlow);
                g2d.setPaint(rgp);
                g2d.fillRect(0, 0, w, h);

                // Título: Muda de "CALCULANDO..." para "SUA NOTA"
                g2d.setFont(new Font("SansSerif", Font.BOLD, 70));
                g2d.setPaint(new Color(250, 204, 21)); 
                String title = isRoletaGirando ? "CALCULANDO..." : "SUA NOTA";
                g2d.drawString(title, centerX - (g2d.getFontMetrics().stringWidth(title) / 2), centerY - 250 + offsetY);

                // A NOTA GIGANTE: Mostra a roleta louca, ou a nota final cravada
                Font scoreFont = new Font("SansSerif", Font.BOLD, 350);
                g2d.setFont(scoreFont);
                String scoreStr = isRoletaGirando ? String.valueOf(numeroRoleta) : String.valueOf(pontuacao);
                int scoreW = g2d.getFontMetrics().stringWidth(scoreStr);
                int scoreY = centerY + 100 + offsetY;

                // Efeito de tremer (Jitter) na roleta para dar mais emoção
                int tremorX = isRoletaGirando ? (random.nextInt(10) - 5) : 0;
                int tremorY = isRoletaGirando ? (random.nextInt(10) - 5) : 0;

                GradientPaint gpScore = new GradientPaint(0, scoreY - 300, new Color(254, 240, 138), 0, scoreY, new Color(202, 138, 4));
                g2d.setPaint(gpScore);
                g2d.drawString(scoreStr, centerX - (scoreW / 2) + tremorX, scoreY + tremorY);

                g2d.setPaint(new Color(0, 0, 0, 150));
                g2d.drawString(scoreStr, centerX - (scoreW / 2) + 10 + tremorX, scoreY + 10 + tremorY);
                g2d.setPaint(gpScore); 
                g2d.drawString(scoreStr, centerX - (scoreW / 2) + tremorX, scoreY + tremorY);

                // Mensagem de Feedback: Só aparece quando o suspense acaba!
                if (!isRoletaGirando) {
                    g2d.setFont(new Font("SansSerif", Font.BOLD, 55));
                    g2d.setPaint(Color.WHITE);
                    String msg = pontuacao >= 95 ? "🎙️ NASCEU UMA ESTRELA!" : (pontuacao >= 85 ? "👏 MUITO BEM!" : "😅 VALEU A INTENÇÃO!");
                    g2d.drawString(msg, centerX - (g2d.getFontMetrics().stringWidth(msg) / 2), centerY + 280 + offsetY);
                }
            }

            g2d.dispose();
        }
    }
}