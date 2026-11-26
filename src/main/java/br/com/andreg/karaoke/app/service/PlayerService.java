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
import br.com.andreg.karaoke.app.model.Pedido;
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

    /** Fila com a regra de dois andares; é a única fonte de verdade das próximas músicas. */
    private final FilaService filaService;

    /** Sala: IP local + QR code do link de convidado. */
    private SalaService salaService;

    /** Os três QRs da tela de descanso (Wi-Fi, catálogo local, catálogo online). */
    private QrSalaService qrSalaService;

    private Musica musicaAtual = null;
    private Pedido pedidoAtual = null;
    /**
     * Pedido que a TV está chamando agora ("o próximo a brilhar vai ser X"). Ele já saiu da fila
     * (proxima() tira), então precisa ficar guardado aqui para o painel e para a página do
     * convidado mostrarem a mesma coisa que a TV mostra durante os segundos do aviso.
     */
    private volatile Pedido pedidoAnunciado = null;
    /** true enquanto o aviso está no ar: dois turnores não podem puxar a fila ao mesmo tempo. */
    private volatile boolean turnoEmAndamento = false;
    /**
     * Carimbo do aviso em andamento. Aumentar este número é o jeito de dizer "aquele aviso já era":
     * a thread que dorme os segundos do aviso confere ao acordar e não faz nada se ela foi cancelada
     * (é o que acontece quando alguém aperta pausar durante os segundos do aviso).
     */
    private volatile int avisoGeracao = 0;
    /** Pausa ENTRE músicas (botão do painel): a do ar termina, a próxima espera, a TV mostra os QRs. */
    private volatile boolean pausado = false;
    private String estadoAtual = "PARADO";
    private int ultimaPontuacao = 0;

    // --- NOVO --- : Variáveis globais para o NDI assumir a tela de descanso
    private boolean isNdiMode = false;
    private boolean vlcTocando = false;
    private DevolaySender ndiSender;
    private DevolayVideoFrame ndiVideoFrame;
    private ByteBuffer bufferGraficosJava;

    public PlayerService(ConfigManager configManager,
                         WebSocketService webSocketService,
                         FilaService filaService,
                         SalaService salaService,
                         QrSalaService qrSalaService) {
        this.configManager = configManager;
        this.webSocketService = webSocketService;
        this.filaService = filaService;
        this.salaService = salaService;
        this.qrSalaService = qrSalaService;
        inicializarMotor();
    }

    private void inicializarMotor() {
        AppConfig config = configManager.getConfig();
        isNdiMode = "NDI".equals(config.videoOutputMode);

        // --- NOVO --- : Criamos o painel animado INDEPENDENTE do modo. 
        // Se for janela, ele vai pra janela. Se for NDI, ele renderiza na memória.
        painelTv = new TvPanel(salaService, qrSalaService);
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

            java.net.URL urlIconeJanela = getClass().getResource("/icon.png");
            if (urlIconeJanela != null) {
                Image iconeApp = Toolkit.getDefaultToolkit().getImage(urlIconeJanela);
                
                // Substitua 'frame' pelo nome da variável da sua janela (ex: janelaPrincipal, window, etc.)
                this.videoFrame.setIconImage(iconeApp); 
            } else {
                System.err.println("Ícone da janela não encontrado nos recursos.");
            }
            
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
                        pedidoAtual = null;
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

    /**
     * Substitui o antigo "encafileirar aqui dentro": a ordem agora é decisão da
     * {@link FilaService} (regra dos dois andares), e o player só consome.
     *
     * Alguém entrou na fila: se estamos parados, já puxa a próxima.
     */
    public void verificarInicioAutomatico() {
        if ("PARADO".equals(estadoAtual) && musicaAtual == null && !pausado && !filaService.estaVazia()) {
            tocarProxima();
        }
    }

    /**
     * Decide o próximo turno: pausa, tela de descanso, aviso na TV ou entrar direto no vídeo.
     *
     * O aviso não pode ser atropelado: quem chama é o {@link #filaService#proxima()}, que já tirou
     * a pessoa da fila, e requisições do celular, o botão "Pular" e a nota de pontuação chamam este
     * método em threads diferentes. {@link #turnoEmAndamento} garante um turno por vez; quem chega
     * no meio espera o próximo turno (o aviso dura poucos segundos).
     */
    public void tocarProxima() {
        if (turnoEmAndamento) {
            System.out.println("⏳ Tem um aviso no ar; este pedido espera o próximo turno.");
            return;
        }

        if (pausado) {
            mostrarDescanso();
            return;
        }

        Pedido proximo = filaService.proxima();

        if (proximo == null || proximo.musica == null) {
            mostrarDescanso();
            return;
        }

        int segundos = segundosDoAviso();
        if (segundos <= 0) {
            iniciarReproducao(proximo);
            return;
        }

        turnoEmAndamento = true;
        anunciarNaTv(proximo, segundos);

        final Pedido chamado = proximo;
        final int duracao = segundos;
        final int geracao = avisoGeracao;
        new Thread(() -> {
            try {
                Thread.sleep(duracao * 1000L);
                if (geracao != avisoGeracao) {
                    // A pausa no meio do aviso já devolveu esta pessoa para a fila; turno expirou.
                    return;
                }
                pedidoAnunciado = null;
                if (pausado) {
                    // Pausaram justo nesses segundos: devolve o lugar da pessoa e mostra os QRs.
                    filaService.devolverNoTopo(chamado);
                    mostrarDescanso();
                    return;
                }
                iniciarReproducao(chamado);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                // Se o VLC recusar o arquivo depois do aviso, a fila não pode travar: o turno é
                // liberado no finally e a pessoa continua na condição em que ficou.
                System.err.println("Erro ao largar a música depois do aviso: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (geracao == avisoGeracao) {
                    turnoEmAndamento = false;
                }
            }
        }, "aviso-proximo").start();
    }

    /**
     * Interrompe um aviso que está contando na TV: a pessoa volta para o topo da fila (não perdeu a
     * vez) e a thread adormecida é desautorizada pelo carimbo. Chamado quando alguém pausa durante
     * os segundos do aviso, para que o "retomar" repita a chamada inteira em vez de emendar no vídeo.
     */
    private void cancelarAvisoEmAndamento() {
        Pedido emAviso = pedidoAnunciado;
        avisoGeracao++;
        pedidoAnunciado = null;
        turnoEmAndamento = false;
        if (emAviso != null) {
            filaService.devolverNoTopo(emAviso);
            System.out.println("↩ " + (emAviso.nome == null ? "O pedido" : emAviso.nome)
                    + " volta para o topo da fila (pausa no meio do aviso na TV)");
        }
    }

    /** Quantos segundos a TV mostra o aviso. 0 (ou negativo) = entra direto, como antes. */
    private int segundosDoAviso() {
        int configurado = configManager.getConfig().anunciarProximoSegundos;
        if (configurado <= 0) return 0;
        return Math.min(configurado, 30);
    }

    /** A tela de descanso (os QR codes) de volta, com a fila intacta. */
    private void mostrarDescanso() {
        estadoAtual = "PARADO";
        musicaAtual = null;
        pedidoAtual = null;
        pedidoAnunciado = null;
        vlcTocando = false; // --- NOVO --- : Liberta o NDI para a tela inicial!

        SwingUtilities.invokeLater(() -> {
            painelTv.setEstado("PARADO", 0, 0);
            if (!isNdiMode && videoFrame != null) {
                cardLayout.show(painelPrincipal, "TELA_TV");
            }
        });
        webSocketService.fazerBroadcast(obterStatus());
    }

    /**
     * Desenha "O próximo a brilhar vai ser: {@code <nome>}" na TV e conta para o painel/convidado
     * pelo mesmo broadcast. Ainda não há som: o vídeo larga depois dos {@code segundos}.
     */
    private void anunciarNaTv(Pedido proximo, int segundos) {
        pedidoAnunciado = proximo;
        estadoAtual = "ANUNCIO";
        musicaAtual = null;
        vlcTocando = false;

        final String quem = proximo.nome == null ? "" : proximo.nome;
        final String oQue = proximo.titulo == null ? "" : proximo.titulo;

        SwingUtilities.invokeLater(() -> {
            painelTv.setAnuncio(quem, oQue, segundos * 1000L);
            if (!isNdiMode && videoFrame != null) {
                cardLayout.show(painelPrincipal, "TELA_TV");
            }
        });
        System.out.println("🎙 Na TV: o próximo a brilhar vai ser " + quem + " — " + oQue);
        webSocketService.fazerBroadcast(obterStatus());
    }

    /** Larga o vídeo do pedido que já foi chamado. É o corpo antigo do tocarProxima(). */
    private void iniciarReproducao(Pedido proximo) {
        pedidoAtual = proximo;
        musicaAtual = proximo.musica;
        estadoAtual = "TOCANDO";

        if (!isNdiMode && videoFrame != null) {
            SwingUtilities.invokeLater(() -> {
                painelTv.setEstado("TOCANDO", 0, 0);
                cardLayout.show(painelPrincipal, "TELA_VIDEO");
            });
        }

        System.out.println("A reproduzir: " + musicaAtual.titulo + "  (pedido de " + proximo.nome + ")");
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
        if (turnoEmAndamento) {
            // Tem alguém sendo chamado na TV e nada no ar: não há o que pular, e parar aqui
            // atropelaria a pessoa que o aviso acabou de anunciar. O painel já desabilita o botão;
            // esta guarda vale para quem chega pela rota de PIN (a tela de operador do celular).
            System.out.println("⏳ Aviso na TV em andamento: 'pular' ignorado (nada no ar ainda).");
            return;
        }
        mediaPlayer.controls().stop();
        tocarProxima();
    }

    /**
     * Pausa ENTRE músicas: não corta o que está no ar, só impede que a próxima comece. A TV volta
     * para a tela dos QR codes e a fila continua igual — quem já pediu não perde o lugar.
     */
    public synchronized boolean definirPausa(boolean agora) {
        if (pausado == agora) {
            // idempotente: o painel pode reenviar o mesmo estado sem causar broadcast duplicado
            return pausado;
        }
        pausado = agora;
        if (pausado) {
            if (pedidoAnunciado != null) {
                cancelarAvisoEmAndamento();
            }
            System.out.println("⏸ Fila pausada"
                    + (musicaAtual == null ? " (TV na tela dos QRs)" : " (a música do ar vai terminar)"));
            if (musicaAtual == null) {
                mostrarDescanso();
            } else {
                webSocketService.fazerBroadcast(obterStatus());
            }
        } else {
            System.out.println("▶ Fila retomada.");
            if (musicaAtual == null) {
                webSocketService.fazerBroadcast(obterStatus());
                verificarInicioAutomatico();
            } else {
                webSocketService.fazerBroadcast(obterStatus());
            }
        }
        return pausado;
    }

    public boolean alternarPausa() {
        return definirPausa(!pausado);
    }

    public boolean estaPausado() {
        return pausado;
    }

    /** Tem música no ar agora (usado na mensagem do botão de pausa). */
    public boolean estaTocando() {
        return "TOCANDO".equals(estadoAtual);
    }

    public Map<String, Object> obterStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("estado", estadoAtual);
        status.put("musicaAtual", musicaAtual);
        status.put("pontuacao", ultimaPontuacao);
        // A fila agora carrega quem pediu e em que andar — o painel usa titulo/artista/codigo
        // exatamente como antes, e a tela do convidado lê nome/posicao/tier do mesmo payload.
        status.put("fila", filaService.fila());
        status.put("quemCanta", pedidoAtual == null ? null : pedidoAtual.nome);
        // O que a TV está mostrando agora no aviso, e se a fila está pausada. O painel e a página
        // do convidado leem daqui, então os três aparelhos contam a mesma história.
        status.put("anuncio", pedidoAnunciado == null ? null : avisoParaJson(pedidoAnunciado));
        status.put("pausado", pausado);
        status.put("maxPorPessoa", filaService.getMaxPendentes());
        return status;
    }

    /** Payload do aviso da TV: nome + o que a pessoa vai cantar, sem vazar nada de disco/IP. */
    private static Map<String, Object> avisoParaJson(Pedido p) {
        Map<String, Object> aviso = new HashMap<>();
        aviso.put("nome", p.nome == null ? "" : p.nome);
        aviso.put("titulo", p.titulo == null ? "" : p.titulo);
        aviso.put("artista", p.artista == null ? "" : p.artista);
        aviso.put("codigo", p.codigo == null ? "" : p.codigo);
        return aviso;
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
    // =========================================================================
    // CLASSE INTERNA: PAINEL CUSTOMIZADO COM RENDERIZAÇÃO 2D E ANIMAÇÕES
    // =========================================================================
    private static class TvPanel extends JPanel {
        private String estado = "PARADO";
        private int pontuacao = 0;
        // --- NOVO --- : o "O próximo a brilhar vai ser:" que entra antes do vídeo
        private String nomeAnunciado = "";
        private String tituloAnunciado = "";
        private long duracaoAnuncioMs = 5000;
        private long fimAnuncio = 0;
        
        private final javax.swing.Timer animTimer;
        private float tick = 0;

        private long tempoInicioPontuacao = 0;
        private int numeroRoleta = 0;
        private final Random random = new Random();
        private int tempoSuspenseAtual = 3500; 

        // --- NOVO --- : Variável para guardar a imagem do QR Code
        private Image imgQrCode;

        /** URL curta que vai dentro do QR, para escrever embaixo (quem está longe não escaneia). */
        private String urlDoQr = "";

        /** QR code service: a tela mostra Wi-Fi, catálogo local e catálogo online, cada um com seu
         *  interruptor na tela de Configurações. */
        private final QrSalaService qrService;

        /** Cartões desenhados agora, e a assinatura do config que os gerou. */
        private java.util.List<QrSalaService.Cartao> cartoes = java.util.List.of();
        private String assinaturaQr = "";
        private long ultimaChecagemQr = 0;

        public TvPanel(SalaService sala, QrSalaService qrService) {
            setBackground(Color.BLACK);
            this.qrService = qrService;

            // --- NOVO --- : O QR é gerado em runtime com o IP real desta máquina.
            // Antes era um qrcode.png fixo no jar: trocava a rede da festa, o link morria.
            try {
                if (qrService != null) {
                    atualizarCartoes(true);
                }
                if (cartoes.isEmpty() && sala != null) {
                    urlDoQr = sala.urlConvidado();
                    imgQrCode = sala.qr(urlDoQr, 600);
                }
                if (imgQrCode == null) {
                    System.err.println("⚠️ Não consegui gerar o QR; caindo no qrcode.png do jar.");
                    java.net.URL urlQr = getClass().getResource("/qrcode.png");
                    if (urlQr != null) imgQrCode = javax.imageio.ImageIO.read(urlQr);
                }
            } catch (Exception e) {
                System.err.println("Erro ao carregar o QR Code: " + e.getMessage());
            }

            animTimer = new javax.swing.Timer(16, e -> {
                tick += 0.05f;
                repaint();
            });
            animTimer.start();
        }

    public void setEstado(String estado, int pontuacao, int tempoSuspenseMs) {
            if (!"ANUNCIO".equals(estado)) {
                this.nomeAnunciado = "";
                this.tituloAnunciado = "";
            }
            this.estado = estado;
            this.pontuacao = pontuacao;
            this.tempoSuspenseAtual = tempoSuspenseMs;
            this.tick = 0; 
            
            if ("PONTUACAO".equals(estado)) {
                this.tempoInicioPontuacao = System.currentTimeMillis();
            }
            
            repaint();
        }

        /** Mostra quem a festa vai chamar, com a barra do tempo que falta para o vídeo largar. */
        public void setAnuncio(String nome, String titulo, long duracaoMs) {
            this.nomeAnunciado = nome == null ? "" : nome;
            this.tituloAnunciado = titulo == null ? "" : titulo;
            this.duracaoAnuncioMs = Math.max(500L, duracaoMs);
            this.fimAnuncio = System.currentTimeMillis() + this.duracaoAnuncioMs;
            this.estado = "ANUNCIO";
            this.tick = 0;
            repaint();
        }

        public void pararAnimacao() {
            if (animTimer != null) animTimer.stop();
        }

        /**
         * Se o config mudou (ligou/desligou um QR, digitou outro IP, trocou a senha do Wi-Fi), a
         * tela de descanso acompanha sem reiniciar o app. Compara a assinatura no máximo uma vez
         * por segundo: o timer de animação roda a 60 Hz e gerar QR não é coisa de frame.
         */
        private void atualizarCartoes(boolean forcado) {
            if (qrService == null) return;
            long agora = System.currentTimeMillis();
            if (!forcado && agora - ultimaChecagemQr < 1000) return;
            ultimaChecagemQr = agora;
            try {
                String novaAssinatura = qrService.assinatura();
                if (forcado || !novaAssinatura.equals(assinaturaQr)) {
                    assinaturaQr = novaAssinatura;
                    cartoes = qrService.cartoes(600);
                }
            } catch (Exception e) {
                System.err.println("Falha ao montar os QRs da tela: " + e.getMessage());
            }
        }

        /**
         * A fileira de QRs da tela de descanso.
         *
         * Duas coisas que já pegaram a TV no fundo: (1) a largura era fixa, e com os três QRs
         * ligados {@code 3*244 + 2*286 = 1304} px numa tela de 1280 jogava o cartão da esquerda
         * para fora do monitor; (2) o rótulo ficava tão alto que encostava no "Escolha uma música
         * pelo celular". Agora a fileira só encolhe (nunca cresce) para caber na largura E na
         * altura reais, com as mesmas medidas de sempre quando há espaço.
         */
        private void desenhaFileiraDeQrs(Graphics2D g2d, int centerX, int centerY) {
            int n = cartoes.size();
            if (n == 0) return;

            final int ladoBase = n == 1 ? 300 : (n == 2 ? 268 : 244);
            final int folgaBase = n == 1 ? 0 : (n == 2 ? 64 : 56); // respiro p/ câmera não pegar o vizinho
            final int topoBase = n == 1 ? 58 : 66;                  // folga acima do QR p/ o rótulo
            final int baseBase = 110;                               // dica + rodapé embaixo do QR

            int largel = getWidth() > 200 ? getWidth() : 1280;
            int altural = getHeight() > 200 ? getHeight() : 1024;
            double margem = Math.max(80, largel * 0.06);
            double larguraFileira = ladoBase * n + folgaBase * (n - 1);

            double escala = 1.0;
            if (larguraFileira > largel - margem) {
                escala = (largel - margem) / larguraFileira;
            }
            double espacoVertical = altural - (centerY + topoBase + baseBase);
            if (ladoBase * escala > espacoVertical) {
                escala = Math.max(0.3, espacoVertical / ladoBase);
            }

            int lado = (int) Math.round(ladoBase * escala);
            int intervalo = (int) Math.round(folgaBase * escala);
            int moldura = (int) Math.max(8, Math.round(15 * escala));
            int qrY = centerY + (int) Math.round(topoBase * Math.max(0.6, escala));
            int larguraTotal = lado * n + intervalo * (n - 1);
            int x0 = centerX - larguraTotal / 2;

            int tamRotulo = Math.max(14, (int) Math.round((n == 1 ? 32 : 26) * escala));
            int tamDica = Math.max(12, (int) Math.round((n == 1 ? 26 : 20) * escala));
            int tamRodape = Math.max(13, (int) Math.round(24 * escala));

            for (int i = 0; i < n; i++) {
                QrSalaService.Cartao c = cartoes.get(i);
                int qrX = n == 1 ? centerX - lado / 2 : x0 + i * (lado + intervalo);
                int meioX = qrX + lado / 2;

                // rótulo em cima: diz o que aquele QR faz, antes de apontar a câmera
                g2d.setFont(new Font("SansSerif", Font.BOLD, tamRotulo));
                g2d.setPaint(new Color(226, 232, 240));
                String rotulo = cortar(c.rotulo(), lado + intervalo, g2d);
                g2d.drawString(rotulo, meioX - g2d.getFontMetrics().stringWidth(rotulo) / 2,
                        qrY - moldura - 8);

                // fundo branco com borda: contraste é o que faz a câmera ler de longe
                g2d.setColor(Color.WHITE);
                g2d.fillRoundRect(qrX - moldura, qrY - moldura, lado + moldura * 2, lado + moldura * 2, 30, 30);
                g2d.drawImage(c.imagem(), qrX, qrY, lado, lado, null);

                // endereço/red rede escrito: nem todo mundo consegue escanear de longe
                String dica = c.dica() == null ? "" : c.dica();
                if (!dica.isEmpty()) {
                    g2d.setFont(new Font("Monospaced", Font.BOLD, tamDica));
                    g2d.setPaint(new Color(96, 165, 250));
                    // com um QR só a URL inteira cabe na tela; com vários o teto é o próprio cartão,
                    // senão o endereço do catálogo encosta no QR do catálogo online
                    int limiteDica = n == 1 ? Math.min(largel - 80, (int) (largel * 0.72)) : lado;
                    dica = cortar(dica, limiteDica, g2d);
                    g2d.drawString(dica, meioX - g2d.getFontMetrics().stringWidth(dica) / 2,
                            qrY + lado + moldura + (int) Math.round(30 * escala));
                }
            }

            g2d.setFont(new Font("SansSerif", Font.BOLD, tamRodape));
            g2d.setPaint(new Color(156, 163, 175));
            String scanText = n == 1
                    ? "Aponte a câmera e abra o catálogo"
                    : "Aponte a câmera para o QR que você quer";
            scanText = cortar(scanText, largel - 80, g2d);
            int scanW = g2d.getFontMetrics().stringWidth(scanText);
            g2d.drawString(scanText, centerX - scanW / 2,
                    qrY + lado + moldura + (int) Math.round(72 * escala));
        }

        /** Corta o texto na largura disponível e fecha com reticências (URL grande na TV). */
        private static String cortar(String texto, int larguraMax, Graphics2D g2d) {
            if (larguraMax <= 20) return texto;
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < texto.length(); i++) {
                sb.append(texto.charAt(i));
                if (g2d.getFontMetrics().stringWidth(sb + "…") > larguraMax) {
                    return sb.substring(0, sb.length() - 1) + "…";
                }
            }
            return texto;
        }

        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2d = (Graphics2D) g.create();
            
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            // --- NOVO --- : Suavização de imagem para o QR Code não ficar serrilhado
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

            int w = getWidth();
            int h = getHeight();
            int centerX = w / 2;
            int centerY = h / 2;

            if ("PARADO".equals(estado)) {
                // Fundo animado
                float alpha = (float) ((Math.sin(tick) + 1) / 4); 
                Color[] colorsBg = {new Color(59, 130, 246, (int)(alpha * 100)), new Color(0, 0, 0, 0)};
                RadialGradientPaint rgp = new RadialGradientPaint(new Point2D.Float(centerX, centerY), 600, new float[]{0.0f, 1.0f}, colorsBg);
                g2d.setPaint(rgp);
                g2d.fillRect(0, 0, w, h);

                // Título
                Font fontTitle = new Font("SansSerif", Font.BOLD, 120);
                g2d.setFont(fontTitle);
                String text = "KARAOKÊ LIVRE";
                int textW = g2d.getFontMetrics().stringWidth(text);
                int textX = centerX - (textW / 2);
                int textY = centerY - 150; // Subi o texto um pouco para dar espaço pro QR Code

                GradientPaint gpText = new GradientPaint(textX, textY - 100, new Color(96, 165, 250), textX + textW, textY, new Color(168, 85, 247));
                g2d.setPaint(gpText);
                g2d.drawString(text, textX, textY);

                // Subtítulo
                g2d.setFont(new Font("SansSerif", Font.PLAIN, 45));
                g2d.setPaint(new Color(156, 163, 175));
                String sub = "Escolha uma música pelo celular!";
                int subW = g2d.getFontMetrics().stringWidth(sub);
                g2d.drawString(sub, centerX - (subW / 2), centerY - 40);

                // --- NOVO --- : Um, dois ou três QR Code lado a lado, conforme os interruptores.
                atualizarCartoes(false);
                if (!cartoes.isEmpty()) {
                    desenhaFileiraDeQrs(g2d, centerX, centerY);
                } else if (imgQrCode != null) {
                    // fallback: config quebrado / QR desligado em tudo, menos a imagem do jar
                    int qrSize = 300; // Tamanho do QR Code (metade do gerado: desce 2x limpo)
                    int qrX = centerX - (qrSize / 2);
                    int qrY = centerY + 30; // Posição vertical logo abaixo do subtítulo

                    g2d.setColor(Color.WHITE);
                    g2d.fillRoundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 30, 30);
                    g2d.drawImage(imgQrCode, qrX, qrY, qrSize, qrSize, null);

                    g2d.setFont(new Font("SansSerif", Font.BOLD, 24));
                    g2d.setPaint(new Color(156, 163, 175));
                    String scanText = "Aponte a câmera e abra o catálogo";
                    int scanW = g2d.getFontMetrics().stringWidth(scanText);
                    g2d.drawString(scanText, centerX - (scanW / 2), qrY + qrSize + 60);

                    if (!urlDoQr.isEmpty()) {
                        g2d.setFont(new Font("Monospaced", Font.BOLD, 30));
                        g2d.setPaint(new Color(96, 165, 250));
                        int urlW = g2d.getFontMetrics().stringWidth(urlDoQr);
                        g2d.drawString(urlDoQr, centerX - (urlW / 2), qrY + qrSize + 112);
                    }
                }

            } else if ("PONTUACAO".equals(estado)) {
                // ... (O código da PONTUAÇÃO continua exatamente igual ao que estava aqui)
                long tempoDecorrido = System.currentTimeMillis() - tempoInicioPontuacao;
                boolean isRoletaGirando = tempoDecorrido < tempoSuspenseAtual;
                
                if (isRoletaGirando) {
                    if (Math.random() < 0.2) {
                        numeroRoleta = random.nextInt(90) + 10; 
                    }
                }

                int offsetY = isRoletaGirando ? 0 : (int) (Math.sin(tick * 2) * 20); 

                Color[] colorsGlow = {new Color(234, 179, 8, 80), new Color(0, 0, 0, 0)};
                RadialGradientPaint rgp = new RadialGradientPaint(new Point2D.Float(centerX, centerY + offsetY), 500, new float[]{0.0f, 1.0f}, colorsGlow);
                g2d.setPaint(rgp);
                g2d.fillRect(0, 0, w, h);

                g2d.setFont(new Font("SansSerif", Font.BOLD, 70));
                g2d.setPaint(new Color(250, 204, 21)); 
                String title = isRoletaGirando ? "CALCULANDO..." : "SUA NOTA";
                g2d.drawString(title, centerX - (g2d.getFontMetrics().stringWidth(title) / 2), centerY - 250 + offsetY);

                Font scoreFont = new Font("SansSerif", Font.BOLD, 350);
                g2d.setFont(scoreFont);
                String scoreStr = isRoletaGirando ? String.valueOf(numeroRoleta) : String.valueOf(pontuacao);
                int scoreW = g2d.getFontMetrics().stringWidth(scoreStr);
                int scoreY = centerY + 100 + offsetY;

                int tremorX = isRoletaGirando ? (random.nextInt(10) - 5) : 0;
                int tremorY = isRoletaGirando ? (random.nextInt(10) - 5) : 0;

                GradientPaint gpScore = new GradientPaint(0, scoreY - 300, new Color(254, 240, 138), 0, scoreY, new Color(202, 138, 4));
                g2d.setPaint(gpScore);
                g2d.drawString(scoreStr, centerX - (scoreW / 2) + tremorX, scoreY + tremorY);

                g2d.setPaint(new Color(0, 0, 0, 150));
                g2d.drawString(scoreStr, centerX - (scoreW / 2) + 10 + tremorX, scoreY + 10 + tremorY);
                g2d.setPaint(gpScore); 
                g2d.drawString(scoreStr, centerX - (scoreW / 2) + tremorX, scoreY + tremorY);

                if (!isRoletaGirando) {
                    g2d.setFont(new Font("SansSerif", Font.BOLD, 55));
                    g2d.setPaint(Color.WHITE);
                    String msg = pontuacao >= 95 ? "🎙️ NASCEU UMA ESTRELA!" : (pontuacao >= 85 ? "👏 MUITO BEM!" : "😅 VALEU A INTENÇÃO!");
                    g2d.drawString(msg, centerX - (g2d.getFontMetrics().stringWidth(msg) / 2), centerY + 280 + offsetY);
                }
            } else if ("ANUNCIO".equals(estado)) {
                desenhaAvisoDoProximo(g2d, w, centerX, centerY);
            }
            g2d.dispose();
        }

        /**
         * O "chamando a pessoa" antes do vídeo: o mesmo fundo animado da tela de descanso, o nome
         * em tamanho grande (encolhendo até caber, porque nome de 40 caracteres não pode vazar da
         * TV) e a barra do tempo que falta para o videoclipe começar.
         */
        private void desenhaAvisoDoProximo(Graphics2D g2d, int w, int centerX, int centerY) {
            float alpha = (float) ((Math.sin(tick) + 1) / 4);
            Color[] coresFundo = {new Color(59, 130, 246, (int) (alpha * 110)), new Color(0, 0, 0, 0)};
            g2d.setPaint(new RadialGradientPaint(new Point2D.Float(centerX, centerY), 620,
                    new float[]{0.0f, 1.0f}, coresFundo));
            g2d.fillRect(0, 0, w, getHeight());

            int disponivel = (int) (w * 0.88);

            g2d.setFont(new Font("SansSerif", Font.PLAIN, 42));
            g2d.setPaint(new Color(156, 163, 175));
            String chamada = "O próximo a brilhar vai ser:";
            g2d.drawString(chamada, centerX - g2d.getFontMetrics().stringWidth(chamada) / 2, centerY - 170);

            String nome = nomeAnunciado.isEmpty() ? "alguém" : nomeAnunciado;
            int tamanho = 132;
            g2d.setFont(new Font("SansSerif", Font.BOLD, tamanho));
            while (g2d.getFontMetrics().stringWidth(nome) > disponivel && tamanho > 44) {
                tamanho -= 4;
                g2d.setFont(new Font("SansSerif", Font.BOLD, tamanho));
            }
            int larguraNome = g2d.getFontMetrics().stringWidth(nome);
            int xNome = centerX - larguraNome / 2;
            int yNome = centerY + 10;
            g2d.setPaint(new GradientPaint(xNome, yNome - tamanho, new Color(96, 165, 250),
                    xNome + larguraNome, yNome, new Color(168, 85, 247)));
            g2d.drawString(nome, xNome, yNome);

            if (!tituloAnunciado.isEmpty()) {
                String titulo = encurtarNaLargura(g2d, "vai cantar: " + tituloAnunciado,
                        new Font("SansSerif", Font.ITALIC, 46), disponivel);
                int larguraTitulo = g2d.getFontMetrics().stringWidth(titulo);
                g2d.setPaint(new Color(226, 232, 240));
                g2d.drawString(titulo, centerX - larguraTitulo / 2, centerY + 110);
            }

            // Barra do tempo que falta: a festa vê o aviso acabar junto com o operador.
            long restante = fimAnuncio - System.currentTimeMillis();
            double fraccao = duracaoAnuncioMs <= 0 ? 0d
                    : Math.max(0d, Math.min(1d, restante / (double) duracaoAnuncioMs));
            int barraW = Math.min(560, (int) (w * 0.5));
            int barraH = 12;
            int xBarra = centerX - barraW / 2;
            int yBarra = centerY + 180;
            g2d.setColor(new Color(255, 255, 255, 40));
            g2d.fillRoundRect(xBarra, yBarra, barraW, barraH, 12, 12);
            g2d.setColor(new Color(168, 85, 247));
            g2d.fillRoundRect(xBarra, yBarra, (int) (barraW * fraccao), barraH, 12, 12);
        }

        /** Encolhe o texto com reticências até caber na largura da TV (nome/título comprido). */
        private String encurtarNaLargura(Graphics2D g2d, String texto, Font fonte, int larguraMaxima) {
            g2d.setFont(fonte);
            if (g2d.getFontMetrics().stringWidth(texto) <= larguraMaxima) return texto;
            String curto = texto;
            while (!curto.isEmpty() && g2d.getFontMetrics().stringWidth(curto + "…") > larguraMaxima) {
                curto = curto.substring(0, curto.length() - 1);
            }
            return curto + "…";
        }
    }
}
