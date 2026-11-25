package br.com.andreg.karaoke.app.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Conhece a sala: qual IP o celular do convidado precisa alcançar e como desenhar o QR
 * code dessa URL na hora.
 *
 * Substitui o {@code qrcode.png} parado dentro dos resources, que apontava sempre para o
 * mesmo endereço e quebrava quando o DHCP do ponto de acesso da festa mudava o IP.
 *
 * Depende só de existir uma interface com endereço privado — exatamente o caso de uma
 * rede isolada sem internet.
 */
public class SalaService {

    /** Interfaces que nunca são a rede dos convidados. */
    private static final String[] IGNORAR = {
            "lo", "docker", "veth", "br-", "virbr", "vmnet", "vboxnet", "tailscale", "tun", "tap", "wg", "utun", "zt"
    };

    private record Candidato(int pontuacao, String interfaceNome, String ip) {}

    private final int porta;
    private String ipDetectado;
    private String urlForcada;
    // A tela de descanso (Swing) e o /api/qrcode.png (Jetty) chamam qr() ao mesmo tempo.
    private final Map<String, BufferedImage> cacheQr = new ConcurrentHashMap<>();

    public SalaService(int porta) {
        this.porta = porta;
    }

    /** Porta do servidor, para o painel montar o link sem adivinhar. */
    public int porta() {
        return porta;
    }

    /** true quando alguém fixou o endereço na tela de Configurações (nada foi autodetectado). */
    public boolean urlForcadaAtiva() {
        return urlForcada != null && !urlForcada.isBlank();
    }

    /** Mesmo tratamento que {@link #setUrlForcada} faz, exposto para guardar a forma canônica. */
    public String normalizarEndereco(String digitado) {
        return normalizar(digitado);
    }

    /**
     * Escolhe a interface mais provável de ser a rede da festa: Wi-Fi primeiro, depois
     * cabo, e nunca uma ponte de virtualização.
     */
    public synchronized String detectarIpLocal() {
        if (ipDetectado != null) return ipDetectado;

        List<Candidato> candidatos = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                String nome = ni.getName();

                if (ni.isLoopback() || !ni.isUp() || ignorar(nome)) continue;

                for (Enumeration<InetAddress> ads = ni.getInetAddresses(); ads.hasMoreElements(); ) {
                    InetAddress a = ads.nextElement();
                    if (!(a instanceof Inet4Address)) continue;
                    if (a.isAnyLocalAddress() || a.isLoopbackAddress() || !a.isSiteLocalAddress()) continue;
                    candidatos.add(new Candidato(pontuar(nome), nome, a.getHostAddress()));
                }
            }
        } catch (Exception e) {
            System.err.println("Erro ao varrer as interfaces de rede: " + e.getMessage());
        }

        if (!candidatos.isEmpty()) {
            Candidato melhor = candidatos.stream().max(Comparator.comparingInt(Candidato::pontuacao)).get();
            ipDetectado = melhor.ip();
            System.out.println("📡 Rede dos convidados: " + melhor.interfaceNome() + " -> " + ipDetectado
                    + (candidatos.size() > 1 ? " (outras " + (candidatos.size() - 1) + " candidatas)" : ""));
            return ipDetectado;
        }

        try {
            ipDetectado = InetAddress.getLocalHost().getHostAddress();
            System.out.println("⚠️ Nenhuma rede privada óbvia; usando " + ipDetectado
                    + ". Se o celular não abrir, defina \"urlConvidado\" no config.json.");
        } catch (Exception e) {
            ipDetectado = "127.0.0.1";
        }
        return ipDetectado;
    }

    private boolean ignorar(String nome) {
        String n = nome.toLowerCase();
        for (String prefixo : IGNORAR) {
            if (n.equals(prefixo) || n.startsWith(prefixo)) return true;
        }
        return false;
    }

    /** Quem tem a pontuação maior é a rede da festa. */
    private int pontuar(String nome) {
        String n = nome.toLowerCase();
        if (n.startsWith("wlan")) return 100;
        if (n.startsWith("ap")) return 90;
        if (n.startsWith("wl")) return 80;
        if (n.startsWith("eth")) return 60;
        if (n.startsWith("enp") || n.startsWith("eno") || n.startsWith("ens")) return 55;
        return 10;
    }

    /** URL curta que vai dentro do QR code. */
    public String urlConvidado() {
        if (urlForcada != null && !urlForcada.isBlank()) return urlForcada.strip();
        return "http://" + detectarIpLocal() + ":" + porta + "/p";
    }

    /**
     * Endereço base do servidor ({@code http://ip:porta}), sem caminho. Usado pelo painel
     * administrativo para montar o link com token sem repetir a lógica de detecção de IP.
     */
    public String urlBase() {
        if (urlForcada != null && !urlForcada.isBlank()) {
            String forcada = urlForcada.strip();
            int ate = forcada.indexOf("://");
            int inicio = ate < 0 ? 0 : ate + 3;
            int corte = forcada.indexOf('/', inicio);
            return (corte < 0 ? forcada : forcada.substring(0, corte));
        }
        return "http://" + detectarIpLocal() + ":" + porta;
    }

    public Map<String, Object> info() {
        Map<String, Object> m = new HashMap<>();
        m.put("ip", detectarIpLocal());
        m.put("porta", porta);
        m.put("url", urlConvidado());
        m.put("forçada", urlForcada != null && !urlForcada.isBlank());
        return m;
    }

    /** QR code em memória, cacheado por texto+tamanho (a tela de descanso pede a cada frame). */
    public BufferedImage qr(String texto, int tamanho) {
        String chave = texto + "@" + tamanho;
        BufferedImage pronto = cacheQr.get(chave);
        if (pronto != null) return pronto;

        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 2);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

            // width/height menores que o número de módulos faz o zxing devolver a matriz
            // nativa (1 px por módulo); ampliamos depois em escala inteira para ficar nítido
            BitMatrix matriz = new QRCodeWriter().encode(texto, BarcodeFormat.QR_CODE, 1, 1, hints);
            BufferedImage img = ampliar(matriz, tamanho);
            cacheQr.put(chave, img);
            return img;
        } catch (Exception e) {
            System.err.println("Falha ao gerar o QR code: " + e.getMessage());
            return null;
        }
    }

    /** Escala inteira: meio-módulo borrado é o que faz a câmera demorar para ler. */
    private BufferedImage ampliar(BitMatrix matriz, int tamanhoDesejado) {
        int modulos = matriz.getWidth();
        int escala = Math.max(1, tamanhoDesejado / modulos);
        int lado = modulos * escala;

        BufferedImage img = new BufferedImage(lado, lado, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, lado, lado);
        g.setColor(Color.BLACK);
        for (int y = 0; y < modulos; y++) {
            for (int x = 0; x < modulos; x++) {
                if (matriz.get(x, y)) g.fillRect(x * escala, y * escala, escala, escala);
            }
        }
        g.dispose();
        return img;
    }

    public byte[] pngDoQr(String texto, int tamanho) {
        BufferedImage img = qr(texto, tamanho);
        if (img == null) return new byte[0];
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", bos);
            return bos.toByteArray();
        } catch (Exception e) {
            System.err.println("Falha ao codificar o PNG do QR: " + e.getMessage());
            return new byte[0];
        }
    }

    /**
     * Permite fixar o endereço dos convidados sem recompilar nada — e é isso que a tela de
     * Configurações do painel usa.
     *
     * Aceita o que um operador digita de verdade, não só a URL canônica:
     * {@code 192.168.4.1} · {@code 192.168.4.1:7000} · {@code http://192.168.4.1} ·
     * {@code http://meu-notebook.local:7000/p}. O que faltando (esquema, porta, caminho) é
     * completado aqui, então o QR da TV e o link do painel nunca saem quebrados por causa de
     * um typo de "http://".
     */
    public void setUrlForcada(String digitado) {
        this.urlForcada = normalizar(digitado);
    }

    String normalizar(String digitado) {
        if (digitado == null) return "";
        String v = digitado.strip();
        if (v.isEmpty() || v.isBlank()) return "";

        int corte = v.indexOf("://");
        String esquema = "http";
        if (corte >= 0) {
            esquema = v.substring(0, corte);
            v = v.substring(corte + 3);
        }

        int barra = v.indexOf('/');
        String autorida = barra < 0 ? v : v.substring(0, barra);
        String caminho = barra < 0 ? "" : v.substring(barra);

        if (autorida.isEmpty()) return "";
        if (!autorida.contains(":")) autorida = autorida + ":" + porta;

        if (caminho.isEmpty() || caminho.equals("/")) caminho = "/p";
        return esquema + "://" + autorida + caminho;
    }
}
