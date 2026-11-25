package br.com.andreg.karaoke.app.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Corpo de {@code POST /api/player/add}.
 *
 * Aceita {@code musicaId} (como sempre) ou {@code codigo} — hoje os dois são o código do
 * BD.ini. {@code nome} é opcional: quando vem, a música entra na fila como pedido daquela
 * pessoa; quando não vem (o caso do painel de controle), entra como pedido do operador.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdicionarFilaRequest {
    public String musicaId;
    public String codigo;
    public String nome;
}
