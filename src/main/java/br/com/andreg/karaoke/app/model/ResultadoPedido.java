package br.com.andreg.karaoke.app.model;

/**
 * Resposta de uma tentativa de pedido. Vai crua para o navegador do convidado,
 * que só precisa mostrar {@link #mensagem} e usar {@link #codigoErro} para cor.
 */
public class ResultadoPedido {

    public boolean aceito;

    /** Texto pronto em português para mostrar na tela. */
    public String mensagem;

    /**
     * Máquina: "aceito" | "sem_nome" | "nome_longos" | "cota" | "duplicada"
     * | "inexistente" | "sem_arquivo" | "fila_cheia" | "rapido_demaiss"
     */
    public String codigoErro;

    /** Pedido criado (null quando bloqueado). */
    public Pedido pedido;

    /** Posição na fila, 1-based (0 quando bloqueado). */
    public int posicao;

    /** Quantos pedidos essa pessoa tem pendentes agora. */
    public int meusPendentes;

    /** Quantas músicas ainda tocam antes dessa (== posicao - 1). */
    public int naFrente;

    /** Tamanho total da fila no momento. */
    public int totalFila;

    public static ResultadoPedido bloqueado(String codigoErro, String mensagem) {
        ResultadoPedido r = new ResultadoPedido();
        r.aceito = false;
        r.codigoErro = codigoErro;
        r.mensagem = mensagem;
        return r;
    }
}
