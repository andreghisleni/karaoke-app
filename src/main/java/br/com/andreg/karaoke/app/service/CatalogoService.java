package br.com.andreg.karaoke.app.service;

import br.com.andreg.karaoke.app.model.Musica;
import br.com.andreg.karaoke.app.model.RespostaPaginada;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class CatalogoService {

    private final List<Musica> catalogo = new ArrayList<>();
    private final Map<String, Metadado> bdMetadados = new HashMap<>();

    // --- MUDANÇA 1: Adicionado o campo 'codigo' para guardar o [99000] ---
    private static class Metadado {
        String codigo;
        String artista;
        String musica;
        String inicio;
        
        Metadado(String codigo, String artista, String musica, String inicio) {
            this.codigo = codigo;
            this.artista = artista;
            this.musica = musica;
            this.inicio = inicio;
        }
    }

    public void carregar(List<String> pastas) {
        catalogo.clear();
        carregarBDIni(); 

        for (String pastaStr : pastas) {
            Path pasta = Paths.get(pastaStr);
            if (!Files.exists(pasta) || !Files.isDirectory(pasta)) continue;

            try (Stream<Path> caminhos = Files.walk(pasta)) {
                caminhos.filter(Files::isRegularFile)
                        .filter(path -> path.toString().toLowerCase().endsWith(".mp4"))
                        .forEach(path -> {
                            String nomeArquivo = path.getFileName().toString();
                            String caminhoCompleto = path.toAbsolutePath().toString();
                            
                            // Extrai o código padrão (caso não exista no BD.ini)
                            String codigoFallback = nomeArquivo;
                            if (codigoFallback.toLowerCase().endsWith(".mp4")) {
                                codigoFallback = codigoFallback.substring(0, codigoFallback.length() - 4);
                            }

                            Musica m = new Musica();
                            m.id = UUID.randomUUID().toString(); 
                            m.caminho = caminhoCompleto;

                            Metadado meta = bdMetadados.get(nomeArquivo.toLowerCase());
                            
                            if (meta != null) {
                                // --- MUDANÇA 2: Agora usamos o código do BD.ini (ex: 99000) ---
                                m.codigo = meta.codigo; 
                                m.titulo = capitalizar(meta.musica);
                                m.artista = capitalizar(meta.artista);
                                m.inicio = capitalizar(meta.inicio);
                            } else {
                                // Se for um vídeo numerado antigo (ex: 01001.mp4) que não tá no INI
                                m.codigo = codigoFallback;
                                m.titulo = codigoFallback;
                                m.artista = "Desconhecido";
                                m.inicio = "";
                            }

                            catalogo.add(m);
                        });
            } catch (Exception e) {
                System.err.println("Erro ao ler pasta: " + pastaStr);
            }
        }
        System.out.println("Catálogo atualizado: " + catalogo.size() + " músicas disponíveis.");
    }

    private void carregarBDIni() {
        bdMetadados.clear();
        File arquivoBd = new File("BD.ini"); 
        
        if (!arquivoBd.exists()) {
            System.out.println("ℹ️ Arquivo BD.ini não encontrado.");
            return;
        }

        System.out.println("📂 Lendo BD.ini...");
        try (BufferedReader br = new BufferedReader(new FileReader(arquivoBd))) {
            String linha;
            String currentCodigo = null; // Variável para segurar o ID numérico
            String currentArquivo = null;
            String currentArtista = "Desconhecido";
            String currentMusica = "Desconhecida";
            String currentInicio = ""; 

            while ((linha = br.readLine()) != null) {
                linha = linha.trim();
                
                // --- MUDANÇA 3: Capturando o bloco do ID [99000] ---
                if (linha.startsWith("[") && linha.endsWith("]")) {
                    // Salva a música anterior antes de começar a ler a próxima
                    if (currentArquivo != null && currentCodigo != null) {
                        bdMetadados.put(currentArquivo.toLowerCase(), new Metadado(currentCodigo, currentArtista, currentMusica, currentInicio));
                    }
                    
                    // Extrai o número removendo os colchetes
                    currentCodigo = linha.substring(1, linha.length() - 1).trim();
                    
                    // Reseta os outros campos para a nova música
                    currentArquivo = null;
                    currentArtista = "Desconhecido";
                    currentMusica = "Desconhecida";
                    currentInicio = ""; 
                    
                } else if (linha.toLowerCase().startsWith("arquivo=")) {
                    currentArquivo = linha.substring(8).trim();
                } else if (linha.toLowerCase().startsWith("artista=")) {
                    currentArtista = linha.substring(8).trim();
                } else if (linha.toLowerCase().startsWith("musica=")) {
                    currentMusica = linha.substring(7).trim();
                } else if (linha.toLowerCase().startsWith("inicio=")) {
                    currentInicio = linha.substring(7).trim(); 
                }
            }
            
            // Grava a última música lida ao final do arquivo
            if (currentArquivo != null && currentCodigo != null) {
                bdMetadados.put(currentArquivo.toLowerCase(), new Metadado(currentCodigo, currentArtista, currentMusica, currentInicio));
            }
            System.out.println("✅ " + bdMetadados.size() + " músicas lidas do BD.ini.");
        } catch (Exception e) {
            System.err.println("❌ Erro ao ler o BD.ini: " + e.getMessage());
        }
    }

    private String capitalizar(String texto) {
        if (texto == null || texto.isEmpty()) return texto;
        return Arrays.stream(texto.split("\\s+"))
                     .map(word -> word.isEmpty() ? word : Character.toUpperCase(word.charAt(0)) + word.substring(1).toLowerCase())
                     .collect(Collectors.joining(" "));
    }

    public List<Musica> getCatalogo() {
        return catalogo;
    }

    public RespostaPaginada<Musica> pesquisar(String query, int page, int limit) {
        List<Musica> filtradas;

        if (query == null || query.trim().isEmpty()) {
            filtradas = catalogo; 
        } else {
            String lowerQuery = query.toLowerCase();
            filtradas = catalogo.stream()
                    .filter(m -> 
                        (m.titulo != null && m.titulo.toLowerCase().contains(lowerQuery)) || 
                        (m.codigo != null && m.codigo.toLowerCase().contains(lowerQuery)) ||
                        (m.artista != null && m.artista.toLowerCase().contains(lowerQuery)) ||
                        (m.inicio != null && m.inicio.toLowerCase().contains(lowerQuery))
                    )
                    .collect(Collectors.toList());
        }

        int total = filtradas.size();
        int totalPaginas = (int) Math.ceil((double) total / limit);
        
        if (page < 1) page = 1;
        if (page > totalPaginas && totalPaginas > 0) page = totalPaginas;

        int fromIndex = Math.min((page - 1) * limit, total);
        int toIndex = Math.min(fromIndex + limit, total);
        
        List<Musica> paginaDeResultados = filtradas.subList(fromIndex, toIndex);

        return new RespostaPaginada<>(paginaDeResultados, total, page, totalPaginas);
    }
    
    public Optional<Musica> buscarPorId(String id) {
        if (id == null || id.trim().isEmpty()) {
            return Optional.empty();
        }
        
        return catalogo.stream()
                .filter(m -> id.equals(m.id))
                .findFirst();
    }
}