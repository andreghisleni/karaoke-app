package br.com.andreg.karaoke.app.service;

import br.com.andreg.karaoke.app.config.ConfigManager;
import br.com.andreg.karaoke.app.model.AppConfig;

import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Monta os QR codes da tela de descanso: <b>Wi-Fi</b>, <b>catálogo local</b> (este app) e
 * <b>catálogo online</b>. Cada um tem um interruptor na tela de Configurações do painel, então
 * a TV pode mostrar os três, um ou nenhum.
 *
 * A ordem é a da fila do celular na festa: primeiro entrar na rede, depois abrir o catálogo.
 *
 * Nada aqui é gerado no boot: {@link #cartoes()} lê o config atual, então virar um interruptor
 * ou digitar o IP muda a TV na hora, sem reiniciar. A {@link #assinatura()} deixa o painel da TV
 * comparar barato a cada frame e só redesenhar quando algo realmente mudou.
 */
public class QrSalaService {

    /** Mesma URL do qrcode.png que vinha parado no jar (decodificada: short.andreg.com.br). */
    public static final String ONLINE_PADRAO = "https://short.andreg.com.br/qxxteq";

    /** Um QR na tela: chave estável (vem do config), rótulo grande e a dica embaixo. */
    public record Cartao(String chave, String rotulo, String dica, String conteudo,
                         BufferedImage imagem) {}

    private final ConfigManager configManager;
    private final SalaService sala;

    public QrSalaService(ConfigManager configManager, SalaService sala) {
        this.configManager = configManager;
        this.sala = sala;
    }

    /**
     * Resumo do que deveria aparecer agora. Não gera imagem: é o que a tela de Configurações e o
     * {@code /api/sala} consultam para saber se o card está ligado e por que ele está vazio.
     */
    public List<Map<String, Object>> planos() {
        AppConfig c = configManager.getConfig();
        List<Map<String, Object>> saida = new ArrayList<>();

        String ssid = txt(c.wifiSsid);
        saida.add(estado("wifi", "Conectar no Wi-Fi", ssid,
                "rede " + (ssid.isEmpty() ? "sem nome" : ssid),
                c.mostrarQrWifi, conteudoWifi(c),
                ssid.isEmpty() ? "informe o nome da rede nas Configurações" : ""));

        String urlLocal = sala.urlConvidado();
        saida.add(estado("catalogo", "Pedir música", urlLocal, urlLocal,
                c.mostrarQrCatalogoLocal, urlLocal, ""));

        String urlOnline = txt(c.urlCatalogoOnline).isEmpty() ? ONLINE_PADRAO : txt(c.urlCatalogoOnline);
        saida.add(estado("online", "Catálogo online", urlOnline, urlOnline,
                c.mostrarQrCatalogoOnline, urlOnline, ""));

        return saida;
    }

    private Map<String, Object> estado(String chave, String rotulo, String dica, String legenda,
                                       boolean ligado, String conteudo, String motivo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("chave", chave);
        m.put("rotulo", rotulo);
        m.put("dica", dica);
        m.put("legenda", legenda);
        m.put("ligado", ligado);
        // ligado mas sem conteúdo = card não aparece na TV: o motivo explica na tela de config
        m.put("visivel", ligado && !txt(conteudo).isEmpty());
        m.put("conteudo", chave.equals("wifi") ? "" : txt(conteudo)); // senha do Wi-Fi não volta na API
        m.put("motivo", motivo);
        return m;
    }

    /** Os cartões que de fato vão para a tela, com a imagem já ampliada. */
    public List<Cartao> cartoes(int ladoPx) {
        List<Cartao> lista = new ArrayList<>();
        for (Map<String, Object> p : planos()) {
            if (!Boolean.TRUE.equals(p.get("visivel"))) continue;
            String chave = (String) p.get("chave");
            String conteudo = conteudoDaChave(chave);
            if (conteudo.isEmpty()) continue;
            BufferedImage img = sala.qr(conteudo, ladoPx);
            if (img == null) continue;
            lista.add(new Cartao(chave, (String) p.get("rotulo"), (String) p.get("dica"),
                    conteudo, img));
        }
        return lista;
    }

    /** Conteúdo real do QR de uma chave (o \"conteudo\" público omite a senha do Wi-Fi). */
    public String conteudoDaChave(String chave) {
        AppConfig c = configManager.getConfig();
        switch (chave == null ? "" : chave) {
            case "wifi":
                // switch desligado = não existe: nem na TV, nem na API
                return (!c.mostrarQrWifi || txt(c.wifiSsid).isEmpty()) ? "" : conteudoWifi(c);
            case "online":
                if (!c.mostrarQrCatalogoOnline) return "";
                return txt(c.urlCatalogoOnline).isEmpty() ? ONLINE_PADRAO : txt(c.urlCatalogoOnline);
            case "catalogo":
            default:
                return c.mostrarQrCatalogoLocal ? sala.urlConvidado() : "";
        }
    }

    /** PNG de um dos QRs, para as rotas da API. */
    public byte[] png(String chave, int tamanho) {
        String conteudo = conteudoDaChave(chave);
        if (conteudo.isEmpty()) return new byte[0];
        return sala.pngDoQr(conteudo, tamanho);
    }

    /**
     * Formato padrão de QR de Wi-Fi (MECARD), lido pela câmera do Android e do iPhone sem
     * instalar nada: {@code WIFI:S:rede;T:WPA;P:senha;H:false;;}
     */
    static String conteudoWifi(AppConfig c) {
        String rede = escabar(txt(c.wifiSsid));
        if (rede.isEmpty()) return "";
        String tipo = txt(c.wifiSeguranca).isEmpty() ? "WPA" : c.wifiSeguranca.strip();
        if (!tipo.equals("nopass") && !tipo.equals("WEP") && !tipo.equals("WPA")) tipo = "WPA";
        String senha = escabar(txt(c.wifiSenha));
        StringBuilder sb = new StringBuilder("WIFI:").append("S:").append(rede).append(';');
        sb.append("T:").append(tipo).append(';');
        if (!tipo.equals("nopass") && !senha.isEmpty()) sb.append("P:").append(senha).append(';');
        sb.append("H:false;;");
        return sb.toString();
    }

    /** O formato escapando ; , : " e \ — nome de rede com ponto-e-vírgula existe de verdade. */
    private static String escabar(String v) {
        if (v == null) return "";
        StringBuilder sb = new StringBuilder(v.length());
        for (int i = 0; i < v.length(); i++) {
            char ch = v.charAt(i);
            if (ch == ';' || ch == ',' || ch == ':' || ch == '"' || ch == '\\') sb.append('\\');
            sb.append(ch);
        }
        return sb.toString();
    }

    /**
     * Muda quando qualquer coisa que afeta a tela muda. O painel da TV chama isso a cada frame e
     * compara com o último valor: é mais barato do que regenerar QR "por precaução".
     */
    public String assinatura() {
        AppConfig c = configManager.getConfig();
        return String.join("|",
                txt(c.wifiSsid), txt(c.wifiSenha), txt(c.wifiSeguranca),
                txt(c.urlCatalogoOnline), sala.urlConvidado(),
                String.valueOf(c.mostrarQrWifi), String.valueOf(c.mostrarQrCatalogoLocal),
                String.valueOf(c.mostrarQrCatalogoOnline));
    }

    /**
     * Nomes de rede que esta máquina enxerga, para a tela de Configurações sugerir em vez de
     * fazer alguém digitar um SSID de cabeça. {@code iwgetid} e {@code nmcli} são o caminho do
     * Kubuntu (NetworkManager). Sem placa de Wi-Fi — desktop no cabo, o caso mais comum em festa
     * — a lista chega vazia e o campo continua digitável: sugestão nunca é pré-requisito.
     */
    public List<String> redesVisiveis() {
        List<String> saida = new ArrayList<>();
        String atual = executaRapido(List.of("iwgetid", "-r")).strip();
        if (!atual.isEmpty()) saida.add(atual);

        String varredura = executaRapido(List.of("nmcli", "-t", "-f", "active,ssid", "dev", "wifi"));
        for (String linha : varredura.split("\n")) {
            int sep = linha.indexOf(':');
            if (sep < 0) continue;
            String ssid = linha.substring(sep + 1).strip();
            if (ssid.isEmpty() || saida.contains(ssid)) continue;
            saida.add(ssid);
            if (saida.size() >= 12) break;
        }
        return saida;
    }

    /** Comando de diagnóstico com teto de 2 s: qualquer falha devolve string vazia. */
    private static String executaRapido(List<String> comando) {
        try {
            Process processo = new ProcessBuilder(comando).redirectErrorStream(true).start();
            String saida;
            try (java.io.InputStream in = processo.getInputStream()) {
                saida = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            if (!processo.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)) {
                processo.destroyForcibly();
                return "";
            }
            return saida;
        } catch (Exception algum) {
            return ""; // sem nmcli, sem iwgetid, sem permissão: segue sem sugestão
        }
    }

    private static String txt(String v) {
        return v == null ? "" : v.strip();
    }
}
