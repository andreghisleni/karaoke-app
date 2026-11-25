package br.com.andreg.karaoke.app.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Persistido em config.json. {@code ignoreUnknown} protege o POST /api/config: o painel
 * devolve o objeto inteiro que recebeu, e nós escondemos/moscamos campos ao exibir.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AppConfig {
    public List<String> pastas = new ArrayList<>();
    public String audioDeviceId = ""; 
    public String videoOutputMode = "Monitor"; // "Monitor" ou "NDI"
    public String displayId = "0"; // "0" para Monitor 1, "1" para Monitor 2, etc.

    /**
     * PIN para as rotas de admin (pular música, tirar alguém da fila, limpar a fila).
     * Vazio = sem proteção, exatamente como é hoje em uma rede isolada de festa.
     */
    public String pinAdmin = "";

    /**
     * URL fixa do QR dos convidados, ex.: "http://192.168.4.1:7000/p".
     * Vazio = o app descobre o IP da máquina ao iniciar.
     */
    public String urlConvidado = "";

    /** Quantas músicas uma mesma pessoa pode ter pendentes na fila. */
    public int maxPedidosPorPessoa = 2;

    /**
     * Senha curta do <em>painel administrativo</em> (o dashboard React), usada na URL como
     * {@code /dashboard?token=...}. Vazio = o app gera uma ao iniciar e grava aqui, para o
     * link continuar válido depois de reiniciar. A tela do convidado ({@code /p}) nunca
     * precisa de token.
     */
    public String tokenPainel = "";

    /**
     * Rede Wi-Fi da festa. Com a senha vira o QR "conectar no Wi-Fi" da tela de descanso, no
     * formato que Android e iPhone escaneiam sem digitar nada ({@code WIFI:S:..;T:WPA;P:..;}).
     * Vazio = o card do Wi-Fi não aparece na tela.
     */
    public String wifiSsid = "";
    /** Senha do QR do Wi-Fi. Quem escaneia recebe a senha junto: é escolha do operador. */
    public String wifiSenha = "";
    /** "WPA" (WPA2/WPA3, o comum), "WEP" ou "nopass" (rede aberta). */
    public String wifiSeguranca = "WPA";

    /**
     * Link do catálogo online — era o {@code qrcode.png} parado dentro do jar, que apontava
     * sempre para o mesmo endereço. Vazio = a tela de descanso volta a usar a imagem embarcada.
     */
    public String urlCatalogoOnline = "https://short.andreg.com.br/qxxteq";

    // --- três interruptores: a tela de descanso mostra cada QR só se estiver ligado ---
    /** Mostrar o QR para entrar no Wi-Fi da festa. */
    public boolean mostrarQrWifi = true;
    /** Mostrar o QR do catálogo servido por este app (o endereço digitado na Configurações). */
    public boolean mostrarQrCatalogoLocal = true;
    /** Mostrar o QR do catálogo online. */
    public boolean mostrarQrCatalogoOnline = true;
}
