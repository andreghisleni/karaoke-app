package br.com.andreg.karaoke.app.model;

import java.util.List;

public class RespostaPaginada<T> {
    public List<T> data;
    public int total;
    public int paginaAtual;
    public int totalPaginas;

    public RespostaPaginada(List<T> data, int total, int paginaAtual, int totalPaginas) {
        this.data = data;
        this.total = total;
        this.paginaAtual = paginaAtual;
        this.totalPaginas = totalPaginas;
    }
}