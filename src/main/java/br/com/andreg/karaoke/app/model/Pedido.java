package br.com.andreg.karaoke.app.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * Um pedido de música na fila.
 *
 * A chave de identidade de quem pediu é o {@link #chave} (o {@link #nome} normalizado),
 * nunca o IP: na mesma rede Wi-Fi vários celulares podem sair pelo mesmo endereço e
 * isso não pode virar "uma pessoa só".
 *
 * {@link #codigo} é o código do BD.ini e é estável entre reinicializações do app
 * (diferente do {@code Musica.id}, que antes era um UUID gerado a cada varredura).
 */
public class Pedido {

    public String id;

    /** Código no BD.ini (ex.: "18483"). Chave boa para comparar músicas. */
    public String codigo;

    public String titulo;
    public String artista;
    public String inicio;

    /** Nome exatamente como a pessoa digitou. */
    public String nome;

    /** Nome normalizado (minúsculo, sem acento, espaços colapsados) = identidade da pessoa. */
    public String chave;

    /** 1 = primeira música dessa pessoa; 2 = repeteco (vai para o fim da fila). */
    public int tier;

    /** Epoch ms em que o pedido foi aceito. */
    public long recebidoEm;

    /**
     * Posição na fila (1-based) no momento da leitura. Preenchido pelo {@link br.com.andreg.karaoke.app.service.FilaService}
     * ao devolver a fila; 0 quando o pedido ainda não está enfileirado.
     */
    public int posicao;

    /** Referência ao arquivo no disco. Não vai para o JSON (o caminho do .mp4 não interessa ao convidado). */
    @JsonIgnore
    public Musica musica;

    /** IP de origem, usado só para rate-limit/auditoria. Não vai para o JSON. */
    @JsonIgnore
    public String origem;
}
