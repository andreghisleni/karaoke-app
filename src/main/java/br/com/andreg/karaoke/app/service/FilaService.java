package br.com.andreg.karaoke.app.service;

import br.com.andreg.karaoke.app.model.Musica;
import br.com.andreg.karaoke.app.model.Pedido;
import br.com.andreg.karaoke.app.model.ResultadoPedido;

import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * A fila do karaokê com a regra de "dois andares" combinada:
 *
 * <ol>
 *   <li>cada pessoa pode ter no máximo {@value #MAX_PENDENTES} pedidos pendentes;</li>
 *   <li>a <b>primeira</b> música de uma pessoa entra no fim do bloco de primeiras músicas;</li>
 *   <li>a <b>segunda</b> dela vai para o fim da fila toda;</li>
 *   <li>quem chega novo entra <b>na frente</b> das segundas músicas já pendentes — assim
 *       ninguém fica preso atrás do repeteco de outra pessoa;</li>
 *   <li>a mesma música não pode entrar duas vezes enquanto estiver na fila;</li>
 *   <li>identidade é o nome normalizado ("Ana", "ana ", "ANA" = mesma pessoa), nunca o IP.</li>
 * </ol>
 *
 * A política foi validada antes da integração em {@code proto-fila/FilaJusta.java}.
 * Todos os métodos são sincronizados: as chamadas chegam das threads do Jetty e da
 * thread de evento do VLC ao mesmo tempo.
 */
public class FilaService {

    /** Quantos pedidos uma pessoa pode ter aguardando. */
    public static final int MAX_PENDENTES = 2;

    /** Versão ajustável pelo config.json ("maxPedidosPorPessoa"). */
    private volatile int maxPendentes = MAX_PENDENTES;

    /** Proteção contra dedo nervoso: pedidos aceitos por IP dentro de 1 minuto. */
    public static final int MAX_PEDIDOS_POR_MINUTO_POR_IP = 30;

    /** Trava de segurança absurda (alguém abrindo 500 abas). */
    public static final int MAX_FILA = 500;

    private final List<Pedido> fila = new ArrayList<>();
    private final Map<String, Deque<Long>> carimbosPorIp = new HashMap<>();

    /**
     * O pedido que está no ar agora. Continua contando para a cota e para o andar de quem
     * pediu: sem isso, a pessoa que está cantando a primeira entrava com a segunda "na
     * frente de todo mundo" no instante em que a primeira saía da fila.
     */
    private Pedido emCena;

    /** Nome -> chave de identidade. "Zezé Di Camargo" e "zeze di camargo" são a mesma pessoa. */
    public static String chavePessoa(String nome) {
        if (nome == null) return "";
        return Normalizer.normalize(nome.strip().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("\\s+", " ")
                .strip();
    }

    // ------------------------------------------------------------------ pedir

    /**
     * Tenta colocar uma música na fila em nome de alguém.
     *
     * @param musica   música já resolvida no catálogo (com caminho no disco)
     * @param nome     nome digitado pelo convidado
     * @param ip       IP de origem, usado apenas para rate-limit
     */
    public synchronized ResultadoPedido pedir(Musica musica, String nome, String ip) {
        ResultadoPedido validacao = validar(musica, nome);
        if (validacao != null) return validacao;

        if (!liberadoPorIp(ip)) {
            return ResultadoPedido.bloqueado("rapido_demaiss",
                    "Muitos pedidos seguidos daqui. Espera um pouquinho e tenta de novo.");
        }

        String chave = chavePessoa(nome);

        Optional<Pedido> duplicada = fila.stream().filter(p -> p.codigo.equals(musica.codigo)).findFirst();
        if (duplicada.isPresent()) {
            ResultadoPedido r = ResultadoPedido.bloqueado("duplicada",
                    "Essa já está na fila, pedida por " + duplicada.get().nome + ".");
            r.pedido = duplicada.get();
            r.posicao = fila.indexOf(duplicada.get()) + 1;
            return r;
        }

        // quem está no palco ainda não gastou a vez: conta como pendente
        final Pedido noAr = emCena;
        boolean noArEQuemPede = noAr != null && noAr.chave.equals(chave);
        long meus = fila.stream().filter(p -> p.chave.equals(chave)).count() + (noArEQuemPede ? 1 : 0);

        if (meus >= maxPendentes) {
            return ResultadoPedido.bloqueado("cota",
                    noArEQuemPede && meus == 1
                            ? "Você está cantando agora. Espera a música acabar para pedir a próxima."
                            : "Você já tem " + meus + " na fila. Assim que a primeira sair, pede outra!");
        }

        if (fila.size() >= MAX_FILA) {
            return ResultadoPedido.bloqueado("fila_cheia", "A fila está grande demais por enquanto.");
        }

        Pedido p = new Pedido();
        p.id = UUID.randomUUID().toString();
        p.codigo = musica.codigo;
        p.titulo = musica.titulo;
        p.artista = musica.artista;
        p.inicio = musica.inicio;
        p.nome = nome.strip();
        p.chave = chave;
        p.tier = meus == 0 ? 1 : 2;
        p.recebidoEm = System.currentTimeMillis();
        p.musica = musica;
        p.origem = ip;

        fila.add(posicaoDeInsercao(p.tier), p);

        ResultadoPedido r = new ResultadoPedido();
        r.aceito = true;
        r.codigoErro = "aceito";
        r.pedido = p;
        r.posicao = fila.indexOf(p) + 1;
        r.meusPendentes = (int) (meus + 1);
        r.naFrente = r.posicao - 1;
        r.totalFila = fila.size();
        r.mensagem = "Você é o Nº " + r.posicao + " da fila ("
                + (p.tier == 1 ? "sua primeira" : "sua segunda") + " música).";
        registrarCarimbo(ip);
        return r;
    }

    /** Pedido vindo do painel de controle: sem nome, sem cota, sem rate-limit por IP. */
    public synchronized ResultadoPedido pedirPeloPainel(Musica musica) {
        ResultadoPedido validacao = validar(musica, "Operador");
        if (validacao != null) return validacao;

        Optional<Pedido> duplicada = fila.stream().filter(p -> p.codigo.equals(musica.codigo)).findFirst();
        if (duplicada.isPresent()) {
            ResultadoPedido r = ResultadoPedido.bloqueado("duplicada",
                    "Essa música já está na fila (pedida por " + duplicada.get().nome + ").");
            r.pedido = duplicada.get();
            r.posicao = fila.indexOf(duplicada.get()) + 1;
            return r;
        }

        Pedido p = new Pedido();
        p.id = UUID.randomUUID().toString();
        p.codigo = musica.codigo;
        p.titulo = musica.titulo;
        p.artista = musica.artista;
        p.inicio = musica.inicio;
        p.nome = "Operador";
        p.chave = "operador";
        p.tier = 1;
        p.recebidoEm = System.currentTimeMillis();
        p.musica = musica;

        fila.add(posicaoDeInsercao(1), p);

        ResultadoPedido r = new ResultadoPedido();
        r.aceito = true;
        r.codigoErro = "aceito";
        r.pedido = p;
        r.posicao = fila.indexOf(p) + 1;
        r.naFrente = r.posicao - 1;
        r.totalFila = fila.size();
        r.mensagem = "Enviada para a posição " + r.posicao + ".";
        return r;
    }

    private ResultadoPedido validar(Musica musica, String nome) {
        if (nome == null || nome.strip().isEmpty()) {
            return ResultadoPedido.bloqueado("sem_nome", "Escreva seu nome para pedir música.");
        }
        if (nome.strip().length() > 40) {
            return ResultadoPedido.bloqueado("nome_longos", "Nome muito longo (máximo 40 caracteres).");
        }
        if (musica == null) {
            return ResultadoPedido.bloqueado("inexistente", "Música não encontrada no catálogo.");
        }
        if (musica.caminho == null || musica.caminho.isEmpty()) {
            return ResultadoPedido.bloqueado("sem_arquivo",
                    "Essa música está no catálogo mas o arquivo não está no disco.");
        }
        return null;
    }

    /**
     * tier 1 entra logo antes da primeira segunda-música (ou no fim, se ainda não há
     * repetecos); tier 2 sempre vai para o fim da fila.
     */
    private int posicaoDeInsercao(int tier) {
        if (tier == 2) return fila.size();
        for (int i = 0; i < fila.size(); i++) {
            if (fila.get(i).tier == 2) return i;
        }
        return fila.size();
    }

    // ------------------------------------------------------------- consumo/contra

    /**
     * Chamado pelo Player quando pode tocar a próxima. Remove da fila e passa a contar
     * como "no ar" (ainda ocupa a cota da pessoa até a música acabar).
     */
    public synchronized Pedido proxima() {
        if (fila.isEmpty()) {
            emCena = null;
            return null;
        }
        emCena = fila.remove(0);
        return emCena;
    }

    /** O pedido que está tocando agora (pode ser null). */
    public synchronized Pedido noAr() {
        return emCena;
    }
    /**
     * Devolve para a FRENTE da fila um pedido que já tinha saído dela.
     *
     * Caso de uso: a TV chamou a pessoa ("o próximo a brilhar vai ser X") e o operador apertou
     * pausa nesses segundos. A pessoa não pode perder o lugar que já era dela por causa de um
     * clique, então o pedido volta exatamente de onde saiu e {@code emCena} é desfeito.
     */
    public synchronized void devolverNoTopo(Pedido p) {
        if (p == null) return;
        fila.remove(p);
        fila.add(0, p);
        if (emCena == p) emCena = null;
    }

    /** Devolve a música para o fim do seu andar (usada em "tirar do ar"/reordenar). */
    public synchronized void reenfileirarFim(Pedido p) {
        if (p == null) return;
        fila.remove(p);
        fila.add(posicaoDeInsercao(p.tier), p);
    }

    /** Convidado cancela o próprio pedido. */
    public synchronized ResultadoPedido cancelar(String codigo, String nome) {
        String chave = chavePessoa(nome);
        if (chave.isEmpty()) {
            return ResultadoPedido.bloqueado("sem_nome", "Escreva seu nome para cancelar.");
        }
        Iterator<Pedido> it = fila.iterator();
        while (it.hasNext()) {
            Pedido p = it.next();
            if (p.codigo.equalsIgnoreCase(codigo == null ? "" : codigo.strip()) && p.chave.equals(chave)) {
                int posicao = fila.indexOf(p);
                it.remove();
                ResultadoPedido r = new ResultadoPedido();
                r.aceito = true;
                r.codigoErro = "aceito";
                r.pedido = p;
                r.posicao = posicao + 1;
                r.totalFila = fila.size();
                r.mensagem = "Tirei \"" + p.titulo + "\" da fila.";
                return r;
            }
        }
        return ResultadoPedido.bloqueado("inexistente", "Você não tem essa música na fila.");
    }

    /** Admin remove qualquer pedido pelo código. */
    public synchronized boolean removerPeloCodigo(String codigo) {
        return fila.removeIf(p -> p.codigo.equalsIgnoreCase(codigo == null ? "" : codigo.strip()));
    }

    public synchronized void limpar() {
        fila.clear();
    }

    // -------------------------------------------------------------------- leitura

    public synchronized List<Pedido> fila() {
        // A ordem da lista já É a posição; marcamos cada pedido com seu índice para o
        // convidado enxergar "você é o Nº 4" sem precisar contar no JavaScript.
        for (int i = 0; i < fila.size(); i++) {
            fila.get(i).posicao = i + 1;
        }
        return new ArrayList<>(fila);
    }

    /** Posição (1-based) de um código na fila, ou 0 se não está. */
    public synchronized int posicaoDe(String codigo) {
        for (int i = 0; i < fila.size(); i++) {
            if (fila.get(i).codigo.equalsIgnoreCase(codigo)) return i + 1;
        }
        return 0;
    }

    public synchronized List<Pedido> pedidosDe(String nome) {
        String chave = chavePessoa(nome);
        List<Pedido> meus = new ArrayList<>();
        for (int i = 0; i < fila.size(); i++) {
            Pedido p = fila.get(i);
            if (p.chave.equals(chave)) meus.add(p);
        }
        return meus;
    }

    public synchronized boolean estaVazia() {
        return fila.isEmpty();
    }

    public synchronized int tamanho() {
        return fila.size();
    }

    /** Cota de pedidos pendentes por pessoa (ajustável pelo config.json). */
    public int getMaxPendentes() {
        return maxPendentes;
    }

    public void definirMaxPendentes(int n) {
        if (n >= 1 && n <= 10) this.maxPendentes = n;
    }

    public synchronized Map<String, Object> resumo() {
        Map<String, Object> m = new HashMap<>();
        m.put("total", fila.size());
        Map<String, Integer> pessoas = new HashMap<>();
        fila.forEach(p -> pessoas.merge(p.nome, 1, Integer::sum));
        m.put("pessoas", pessoas);
        return m;
    }

    // ---------------------------------------------------------------- rate-limit

    private boolean liberadoPorIp(String ip) {
        if (ip == null || ip.isEmpty()) return true; // chamadas locais do próprio app
        long agora = System.currentTimeMillis();
        Deque<Long> j = carimbosPorIp.computeIfAbsent(ip, k -> new ArrayDeque<>());
        while (!j.isEmpty() && agora - j.peekFirst() > 60_000) j.pollFirst();
        return j.size() < MAX_PEDIDOS_POR_MINUTO_POR_IP;
    }

    private void registrarCarimbo(String ip) {
        if (ip == null || ip.isEmpty()) return;
        carimbosPorIp.computeIfAbsent(ip, k -> new ArrayDeque<>()).addLast(System.currentTimeMillis());
        // limpeza para a mapa não crescer a noite inteira
        if (carimbosPorIp.size() > 200) {
            long agora = System.currentTimeMillis();
            Iterator<Map.Entry<String, Deque<Long>>> it = carimbosPorIp.entrySet().iterator();
            while (it.hasNext()) {
                Deque<Long> j = it.next().getValue();
                while (!j.isEmpty() && agora - j.peekFirst() > 60_000) j.pollFirst();
                if (j.isEmpty()) it.remove();
            }
        }
    }
}
