package br.com.andreg.karaoke.app.model;

import java.util.UUID;

public class Musica {
    public String id;
    public String codigo;
    public String titulo;
    public String artista; // Novo!
    public String inicio;  // Novo! Primeira frase
    public String caminho;

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