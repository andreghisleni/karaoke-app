package br.com.andreg.karaoke.app.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Corpo de {@code POST /api/pedidos} e {@code DELETE /api/pedidos} vindos da tela do convidado:
 *
 * <pre>{ "codigo": "18483", "nome": "Ana" }</pre>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class PedidoRequest {
    public String codigo;
    public String nome;
}
