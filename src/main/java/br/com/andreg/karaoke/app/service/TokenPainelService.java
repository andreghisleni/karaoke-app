package br.com.andreg.karaoke.app.service;

import br.com.andreg.karaoke.app.model.AppConfig;
import br.com.andreg.karaoke.app.config.ConfigManager;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import io.javalin.http.Context;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

/**
 * Senha curta do painel administrativo. Não é credencial de convidado: a tela /p, a fila e a
 * busca continuam abertas, porque quem escaneia o QR na festa não tem nada para lembrar.
 *
 * O token existe para uma coisa só: ninguém mais (nem o celular de um convidado que ficou com o
 * link salvo, nem qualquer máquina no Wi-Fi) consegue mexer na configuração, empurrar música para
 * a fila, pular faixa ou limpar a fila sem o link que saiu impresso no console da máquina do
 * operador.
 *
 * Ele é aleatório na primeira execução e sobrevive em config.json — o link que ele abriu no
 * celular na sexta continua na segunda. "Regenerar" gira o token e derruba os links antigos.
 */
public class TokenPainelService {

    /** Sem 0/O/1/I/L: token é ditado por telefone e copiado à mão, uma hora. */
    private static final char[] ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int TAMANHO = 8;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    /** Cabeçalho que o painel manda em cada chamada; o nome do parâmetro na URL é "token". */
    public static final String CABECALHO = "X-Painel-Token";

    /** Cookie gravado pela tela de acesso: é o que faz o navegador mandar o token de novo. */
    public static final String COOKIE = "painel_token";

    private final ConfigManager configManager;
    private final SalaService sala;
    private String token;

    public TokenPainelService(ConfigManager configManager, SalaService sala) {
        this.configManager = configManager;
        this.sala = sala;
        // ConfigManager.carregar() troca a instância de AppConfig: trabalhamos sempre na atual.
        AppConfig config = configManager.getConfig();
        this.token = normalizar(config.tokenPainel);
        if (this.token.isEmpty()) {
            this.token = gerar();
        }
        if (!this.token.equals(config.tokenPainel)) {
            config.tokenPainel = this.token;
            // primeiro boot: o link impresso no console tem que continuar válido no restart
            configManager.salvar();
        }
    }

    private static String normalizar(String bruto) {
        if (bruto == null) return "";
        return bruto.strip().toUpperCase().replace(" ", "").replace("-", "");
    }

    public static String gerar() {
        StringBuilder sb = new StringBuilder(TAMANHO);
        for (int i = 0; i < TAMANHO; i++) {
            sb.append(ALFABETO[ALEATORIO.nextInt(ALFABETO.length)]);
        }
        return sb.toString();
    }

    public String token() {
        return token;
    }

    /** Config.json editado na mão? Relê sem precisar reiniciar o app. */
    public synchronized void recarregar() {
        String salvo = normalizar(configManager.getConfig().tokenPainel);
        if (!salvo.isEmpty() && !salvo.equals(token)) token = salvo;
    }

    /** Troca o token e devolve o novo. Chamar isso derruba todos os links/telas já abertas. */
    public synchronized String regenerar() {
        token = gerar();
        configManager.getConfig().tokenPainel = token;
        configManager.salvar();
        return token;
    }

    /** Token escolhido à mão pelo operador (a tela de Configurações deixa digitar). */
    public synchronized boolean definir(String novo) {
        String n = normalizar(novo);
        if (n.length() < 4 || n.length() > 32) return false;
        token = n;
        configManager.getConfig().tokenPainel = token;
        configManager.salvar();
        return true;
    }

    /** Token no claro vindo de um header/param, ou null. Comparação sem timing trap. */
    public boolean confere(String candidato) {
        String c = normalizar(candidato);
        if (c.isEmpty()) return false;
        return messageDigestEquals(c, token);
    }

    /**
     * A chamada veio do dono do painel? Aceitamos os três caminhos que existem na prática:
     * o header que o wrapper de {@code fetch} do React manda em toda chamada, o {@code ?token=}
     * do link aberto pelo QR (primeira vez, antes de existir localStorage) e o cookie escrito
     * pela tela de acesso — é o cookie que faz o navegador mandar a credencial depois de a URL
     * ter sido limpa.
     */
    public boolean autorizado(Context ctx) {
        if (confere(ctx.header(CABECALHO))) return true;
        if (confere(ctx.queryParam("token"))) return true;
        return confere(ctx.cookie(COOKIE));
    }

    /**
     * Comparação em tempo constante. É um servidor de festa numa rede aberta: se um dia sobrar
     * alguém curioso o bastante para medir o tempo de resposta, não queremos revelar o prefixo
     * que já bateu.
     */
    private static boolean messageDigestEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int dif = 0;
        for (int i = 0; i < a.length(); i++) {
            dif |= a.charAt(i) ^ b.charAt(i);
        }
        return dif == 0;
    }

    /** URL que o operador abre no navegador/celular, já com o token embutido. */
    public String urlPainel() {
        return sala.urlBase() + "/dashboard?token=" + token;
    }

    /** O mesmo link, sem token: serve para a tela de acesso não deixar o valor no histórico. */
    public String urlPainelSemToken() {
        return sala.urlBase() + "/dashboard";
    }

    /**
     * QR em texto, para o console. Cada módulo vira dois caracteres (o terminal é mais alto que
     * largo) e a linha inteira sai com fundo branco para ter contraste real na câmera do celular.
     */
    public static String qrAscii(String texto) {
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 2);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

            BitMatrix m = new QRCodeWriter().encode(texto, BarcodeFormat.QR_CODE, 0, 0, hints);
            int lado = m.getWidth();
            StringBuilder sb = new StringBuilder((lado * 2 + 8) * (lado + 5));

            for (int y = -2; y < lado + 2; y++) {
                sb.append("\u001B[47m");            // fundo branco: linha legível em console escuro
                for (int x = -2; x < lado + 2; x++) {
                    boolean dentro = x >= 0 && y >= 0 && x < lado && y < lado;
                    boolean escuro = dentro && m.get(x, y);
                    sb.append(escuro ? "\u001B[40m  \u001B[47m" : "  ");
                }
                sb.append("\u001B[0m\n");
            }
            sb.append("\u001B[0m");
            return sb.toString();
        } catch (Exception e) {
            return "(não consegui desenhar o QR aqui: " + e.getMessage() + ")";
        }
    }

    /** Banner do console: o link do painel, o token escrito e o QR para apontar a câmera. */
    public String bannerDoConsole() {
        String url = urlPainel();
        StringBuilder sb = new StringBuilder();
        sb.append("\n════════════════════ PAINEL DO OPERADOR ════════════════════\n");
        sb.append("  ").append(url).append('\n');
        sb.append("  token: ").append(token).append("   (sem ele nenhuma mudança é aceita)\n");
        sb.append("  para o celular, aponte a câmera para o QR abaixo:\n");
        sb.append(qrAscii(url));
        sb.append("\n  o token fica salvo em config.json (\"tokenPainel\"); para trocar, use o botão\n");
        sb.append("  \"Gerar novo token\" na tela de Configurações do painel.\n");
        sb.append("══════════════════════════════════════════════════════════════\n");
        return sb.toString();
    }
}
