package br.com.andreg.karaoke.app.service;

import br.com.andreg.karaoke.app.model.AppConfig;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Encaminha <em>as saídas desta aplicação</em> para canais específicos da mesa quando o
 * computador fala com a XR18 por <strong>JACK</strong> ou por <strong>PipeWire</strong>.
 *
 * <p>Por que linha de comando e não API? Porque o som deste app sai pelo libVLC: ele escolhe o
 * <em>dispositivo</em> de saída, mas não sabe em qual par de canais da mesa o sinal deve cair. Quem
 * mexe nesse grafo de plugues virtuais são as ferramentas que já vêm com o servidor de áudio —
 * {@code pw-link} no PipeWire, {@code jack_connect}/{@code jack_lsp} no JACK puro. Elas só ligam e
 * desligam cabo, então funcionam com qualquer player (inclusive o VLC) e não quebram nada se não
 * houver JACK nenhum: a rota devolve um aviso e o som continua no dispositivo normal.</p>
 *
 * <p><strong>Escopo:</strong> só as saídas do karaokê são mexidas. O Mixxx (e qualquer outro
 * programa) já faz o roteamento dele por dentro, e religar o plugue de outro app por fora
 * brigaria com a tela daquele app.</p>
 *
 * <p>Nos campos de canal ele pode escrever só o número ({@code 5,6} → os canais 5 e 6 da mesa) ou
 * colar o nome do porto que aparecer na lista ("Atualizar lista"), com os dois pontos mesmo.</p>
 */
public final class RoteamentoAudioService {

    private RoteamentoAudioService() {
    }

    /** Ferramenta desta máquina: "pw-link" (PipeWire), "jack" ou "" quando não tem nenhuma. */
    public static String ferramenta() {
        if (noPath("pw-link") != null) return "pw-link";
        if (noPath("jack_connect") != null) return "jack";
        return "";
    }

    /** O que o botão "Atualizar lista" da Configurações devolve: portas, plugues ligados e aviso. */
    public static Map<String, Object> inventario() {
        String ferramenta = ferramenta();
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("ferramenta", ferramenta);
        if (ferramenta.isEmpty()) {
            corpo.put("portas", List.of());
            corpo.put("conexoes", List.of());
            corpo.put("aviso", "Não achei pw-link nem jack_connect no PATH. No PipeWire que já vem "
                    + "no Ubuntu/Debian moderno eles já estão; em JACK puro, instale jack-tools "
                    + "ou rode pelo qjackctl.");
            return corpo;
        }
        corpo.put("portas", portas(ferramenta));
        corpo.put("conexoes", conexoes(ferramenta));
        corpo.put("aviso", "");
        return corpo;
    }

    /**
     * Aplica as rotas salvas na config. Devolve linhas para o console e para o painel — nunca lança,
     * porque isto roda no meio da troca de música e um pw-link ausente não pode derrubar a festa.
     */
    public static List<String> aplicar(AppConfig c) {
        List<String> log = new ArrayList<>();
        if (!c.jackRotearCanais) {
            log.add("🔌 Roteio de canais desligado nas Configurações — não mexi em nada.");
            return log;
        }

        String ferramenta = ferramenta();
        if (ferramenta.isEmpty()) {
            log.add("🔌 Sem pw-link e sem jack_connect no PATH: o áudio fica no dispositivo escolhido.");
            return log;
        }

        List<String> portas = portas(ferramenta);
        if (portas.isEmpty()) {
            log.add("🔌 O " + ferramenta + " respondeu vazio. Ou o servidor de áudio não está rodando, "
                    + "ou ainda ninguém tocou som (o porto do karaokê só aparece na primeira música).");
            return log;
        }
        log.add("🔌 Roteando com " + ferramenta + " (" + portas.size() + " portas na lista).");

        rota(ferramenta, portas, log, "Karaokê", c.jackClienteKaraoke, c.jackCanaisKaraoke);
        return log;
    }

    /**
     * Uma rota: achar as saídas do cliente, achar os destinos, desligar as conexões <em>destas
     * mesmas saídas</em> em outros canais e ligar no pedido. Conexão de outro cliente não passa
     * nem perto daqui: o filtro compara a origem com a nossa própria lista de saídas.
     */
    private static void rota(String ferramenta, List<String> portas, List<String> log,
                             String rotulo, String clienteConfig, String canaisConfig) {
        List<String> canais = listarCanais(canaisConfig);
        if (canais.isEmpty()) {
            log.add("• " + rotulo + ": sem canal informado, deixo as saídas onde já estão.");
            return;
        }

        String cliente = clienteConfig == null ? "" : clienteConfig.strip();
        if (cliente.isEmpty()) cliente = adivinharCliente(portas);
        if (cliente.isEmpty()) {
            log.add("• " + rotulo + ": o campo do cliente está vazio e eu não achei ninguém óbvio no "
                    + "grafo. Abra \"Atualizar lista\" e cole o nome (ex.: VLC, mpv).");
            return;
        }

        List<String> saidas = saidasDoCliente(portas, cliente);
        if (saidas.isEmpty()) {
            log.add("• " + rotulo + ": nenhuma saída batendo com \"" + cliente + "\". Se é esta "
                    + "aplicação, comece uma música antes: o porto só aparece quando há stream no ar.");
            return;
        }

        List<String> destinos = new ArrayList<>();
        for (String canal : canais) {
            String alvo = acharDestino(portas, canal);
            if (alvo == null) {
                log.add("• " + rotulo + ": canal \"" + canal + "\" não está na lista do " + ferramenta
                        + ". Confira o número ou cole o nome inteiro do porto.");
                return;
            }
            destinos.add(alvo);
        }

        int pares = Math.min(saidas.size(), destinos.size());
        if (saidas.size() != destinos.size()) {
            log.add("• " + rotulo + ": " + saidas.size() + " saída(s) para " + destinos.size()
                    + " canal(is) — ligo só os " + pares + " primeiros.");
        }

        List<List<String>> ligadas = conexoes(ferramenta);
        for (int i = 0; i < pares; i++) {
            String origem = saidas.get(i);
            String destino = destinos.get(i);

            // Primeiro desliga o que ESTA MESMA saída mandava para outro canal da mesa; sem isso o
            // som continuaria duplicado nos dois pares da XR18. Repare no `de.equals(origem)`:
            // nada de outro programa (Mixxx, navegador) é desligado aqui.
            for (List<String> par : ligadas) {
                String de = par.get(0);
                String para = par.get(1);
                if (de.equals(origem) && !para.equals(destino)
                        && para.toLowerCase(Locale.ROOT).contains("playback")) {
                    executar(desconectar(ferramenta, de, para));
                    log.add("   ↳ desliguei " + de + " de " + para);
                }
            }

            Executado liga = executar(comandoConectar(ferramenta, origem, destino));
            if (liga.ok()) {
                log.add("✓ " + rotulo + ": " + origem + " → " + destino);
            } else if (liga.texto().toLowerCase(Locale.ROOT).contains("already")) {
                // porta já ligada exatamente aí não é erro: as ferramentas reclamam mesmo assim.
                log.add("✓ " + rotulo + ": " + origem + " já estava em " + destino);
            } else {
                log.add("✗ " + rotulo + ": " + origem + " → " + destino + " falhou (" + liga.texto() + ")");
            }
        }
    }

    // -------------------------------------------------------------------- parse/decisão

    /** "5,6", "5 6", "5;6" ou nomes de porta separados por vírgula → lista de tokens. */
    static List<String> listarCanais(String texto) {
        List<String> canais = new ArrayList<>();
        if (texto == null || texto.isBlank()) return canais;
        for (String pedaco : texto.split("[,;]")) {
            String token = pedaco.strip();
            if (token.isEmpty()) continue;
            if (token.contains(":")) {
                canais.add(token); // nome de porta: não é para picar nos espaços de dentro
            } else {
                for (String parte : token.split("\\s+")) {
                    if (!parte.isBlank()) canais.add(parte.strip());
                }
            }
        }
        return canais;
    }

    /**
     * Saídas de um cliente. Ficam de fora o barramento da mesa ({@code system}, {@code alsa_*}), os
     * ports de monitor e os de eventos/controle do PipeWire — nada disso é por onde sai o nosso som.
     */
    static List<String> saidasDoCliente(List<String> portas, String cliente) {
        String padrao = cliente.strip().toLowerCase(Locale.ROOT);
        if (padrao.isEmpty()) return List.of();

        Set<String> achadas = new LinkedHashSet<>();
        for (String porta : portas) {
            int doisPontos = porta.indexOf(':');
            if (doisPontos <= 0) continue;
            String dono = porta.substring(0, doisPontos).toLowerCase(Locale.ROOT);
            String nome = porta.substring(doisPontos + 1).toLowerCase(Locale.ROOT);
            if (!dono.contains(padrao)) continue;
            if (dono.equals("system") || dono.startsWith("alsa_output") || dono.startsWith("alsa_input")) continue;
            if (nome.contains("monitor") || nome.contains("event") || nome.contains("control")) continue;
            achadas.add(porta);
        }

        List<String> ordem = new ArrayList<>(achadas);
        Collections.sort(ordem); // output_FL/output_FR, playback_1/playback_2, out_1/out_2: a ordem sai certa
        return ordem;
    }

    /** Nosso próprio player quando o campo ficou vazio: procuramos VLC/mpv/ffmpeg antes de desistir. */
    static String adivinharCliente(List<String> portas) {
        for (String dica : List.of("vlc", "karaoke", "mpv", "ffmpeg", "java")) {
            for (String porta : portas) {
                int doisPontos = porta.indexOf(':');
                if (doisPontos <= 0) continue;
                String dono = porta.substring(0, doisPontos);
                if (dono.toLowerCase(Locale.ROOT).contains(dica)) return dono;
            }
        }
        return "";
    }

    /** Canal (número ou nome) → porto real de destino na mesa. */
    static String acharDestino(List<String> portas, String canal) {
        String alvo = canal.strip();
        if (alvo.isEmpty()) return null;

        if (alvo.contains(":")) { // nome quase completo: batemos pelo nome do porto, tolerando o cliente
            for (String porta : portas) {
                if (porta.equalsIgnoreCase(alvo)) return porta;
            }
            String sufixo = parteFinal(alvo);
            for (String porta : portas) {
                if (parteFinal(porta).equalsIgnoreCase(sufixo)) return porta;
            }
            return null;
        }

        // O jeito que o JACK chama (system:playback_5), o que o PipeWire com camada jack usa, e os
        // apelidos de algumas mesas (out_5, ch5).
        for (String modelo : List.of("playback_", "out_", "ch", "")) {
            String sufixo = ":" + modelo + alvo;
            for (String porta : portas) {
                if (porta.toLowerCase(Locale.ROOT).endsWith(sufixo)) return porta;
            }
        }
        return null;
    }

    /** "system:playback_5" → "playback_5". */
    private static String parteFinal(String nome) {
        int doisPontos = nome.lastIndexOf(':');
        return doisPontos < 0 ? nome : nome.substring(doisPontos + 1);
    }

    // ---------------------------------------------------------------------- ferramentas

    /** Lista de portas no formato "cliente:porto", sem duplicata e sem linha de status. */
    private static List<String> portas(String ferramenta) {
        List<String> saida = new ArrayList<>();
        if ("pw-link".equals(ferramenta)) {
            Executado tudo = executar("pw-link", "-l");
            if (tudo.ok() && !tudo.linhas.isEmpty()) {
                for (String linha : tudo.linhas) if (!linha.isBlank()) saida.add(linha.strip());
            } else {
                // Algumas versões só respondem a -o (saídas) e -i (entradas).
                for (String bandeira : List.of("-o", "-i")) {
                    for (String linha : executar("pw-link", bandeira).linhas) {
                        if (!linha.isBlank()) saida.add(linha.strip());
                    }
                }
            }
        } else {
            // jack_lsp imprime o cliente e, recuado com dois espaços, cada porto dele.
            String clienteAtual = "";
            for (String linha : executar("jack_lsp").linhas) {
                if (linha.isBlank()) continue;
                if (Character.isWhitespace(linha.charAt(0))) {
                    String nome = linha.strip();
                    if (!nome.contains(":") && !clienteAtual.isEmpty()) {
                        saida.add(clienteAtual + ":" + nome);
                    } else {
                        saida.add(nome);
                    }
                } else {
                    clienteAtual = linha.strip();
                }
            }
        }
        saida.removeIf(l -> !l.contains(":")); // "N ports" e afins não são porto nenhum
        return new ArrayList<>(new LinkedHashSet<>(saida));
    }

    /** Cada conexão como um par [de, para]. Aceito "a -> b" (pw-link e jack_lsp) e "a b". */
    private static List<List<String>> conexoes(String ferramenta) {
        List<String> linhas;
        if ("pw-link".equals(ferramenta)) {
            Executado comBandeira = executar("pw-link", "-lc");
            linhas = comBandeira.ok() && !comBandeira.linhas.isEmpty()
                    ? comBandeira.linhas
                    : executar("pw-link", "-c").linhas;
        } else {
            linhas = executar("jack_lsp", "-c").linhas;
        }

        List<List<String>> pares = new ArrayList<>();
        for (String linha : linhas) {
            String texto = linha.strip();
            if (texto.isEmpty()) continue;
            String[] pedacos = texto.contains("->") ? texto.split("->") : texto.split("\\s+");
            if (pedacos.length != 2) continue;
            String de = pedacos[0].strip();
            String para = pedacos[1].strip();
            if (!de.contains(":") || !para.contains(":")) continue;
            pares.add(List.of(de, para));
        }
        return pares;
    }

    private static String[] comandoConectar(String ferramenta, String de, String para) {
        return "pw-link".equals(ferramenta)
                ? new String[]{"pw-link", de, para}
                : new String[]{"jack_connect", de, para};
    }

    private static String[] desconectar(String ferramenta, String de, String para) {
        return "pw-link".equals(ferramenta)
                ? new String[]{"pw-link", "-d", de, para}
                : new String[]{"jack_disconnect", de, para};
    }

    // ------------------------------------------------------------------------ processo

    private static final class Executado {
        int codigo;
        final List<String> linhas = new ArrayList<>();

        Executado(int codigo) {
            this.codigo = codigo;
        }

        boolean ok() {
            return codigo == 0;
        }

        String texto() {
            return linhas.isEmpty() ? "sem saída" : String.join(" / ", linhas);
        }
    }

    /** Roda o comando com stdout e stderr juntos. Sem a ferramenta instalada isto só falha suave. */
    private static Executado executar(String... comando) {
        Executado resultado = new Executado(127);
        try {
            ProcessBuilder pb = new ProcessBuilder(comando);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            try (BufferedReader leitor = new BufferedReader(
                    new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String linha;
                while ((linha = leitor.readLine()) != null) resultado.linhas.add(linha);
            }
            resultado.codigo = p.waitFor();
        } catch (Exception erro) {
            resultado.linhas.add(erro.getClass().getSimpleName() + ": " + erro.getMessage());
        }
        return resultado;
    }

    private static File noPath(String binario) {
        String caminho = System.getenv("PATH");
        if (caminho == null) return null;
        for (String pedaco : caminho.split(File.pathSeparator)) {
            File candidato = new File(pedaco, binario);
            if (candidato.canExecute()) return candidato;
        }
        return null;
    }

    /**
     * Para testar do terminal sem abrir o painel:
     * {@code java -cp target/classes:$(cat cp.txt) br.com.andreg.karaoke.app.service.RoteamentoAudioService listar}
     * e, depois de encher a config na mão, {@code ... rotear}.
     */
    public static void main(String[] args) {
        if (args.length > 0 && "rotear".equals(args[0])) {
            AppConfig c = new AppConfig();
            c.jackRotearCanais = true;
            c.jackClienteKaraoke = System.getProperty("cliente", "");
            c.jackCanaisKaraoke = System.getProperty("canais", "");
            for (String linha : aplicar(c)) System.out.println(linha);
        } else {
            System.out.println(inventario());
        }
    }
}
