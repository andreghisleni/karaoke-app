package br.com.andreg.karaoke.app.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

public class Musica {
    public String id;
    public String codigo;
    public String titulo;
    public String artista; // Novo!
    public String inicio;  // Novo! Primeira frase

    // --- NOVO: o caminho absoluto do .mp4 sai do JSON. Ele não serve para nada no
    // navegador (o painel só mostra título/artista) e entregava a estrutura do disco do
    // PC para qualquer celular conectado na rede da festa.
    @JsonIgnore public String caminho;

    // --- NOVO: índices de busca, calculados uma vez na varredura e NUNCA enviados ao
    // navegador (o /api/musicas já devolve caminho absoluto; não queremos crescer isso).
    // minúsculos e sem acento, para "Zezé" achar "zeze".
    @JsonIgnore public String busca;        // código + título + artista + início
    @JsonIgnore public String buscaCodigo;
    @JsonIgnore public String buscaTitulo;
    @JsonIgnore public String buscaArtista;

    public Musica() {} // Construtor vazio para o Jackson (JSON) não reclamar

    public Musica(String id, String codigo, String titulo, String artista, String inicio, String caminho) {
        this.id = id;
        this.codigo = codigo;
        this.titulo = titulo;
        this.artista = artista;
        this.inicio = inicio;
        this.caminho = caminho;
    }
}
