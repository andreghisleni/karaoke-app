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

    // Adicionado o campo 'inicio' na classe auxiliar
    private static class Metadado {
        String artista;
        String musica;
        String inicio;
        
        Metadado(String artista, String musica, String inicio) {
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
                            
                            // Extrai o código tirando o ".mp4"
                            String codigo = nomeArquivo;
                            if (codigo.toLowerCase().endsWith(".mp4")) {
                                codigo = codigo.substring(0, codigo.length() - 4);
                            }

                            // Cria a nova música
                            Musica m = new Musica();
                            m.id = UUID.randomUUID().toString(); // Gera um ID único para o React usar como "key"
                            m.codigo = codigo;
                            m.caminho = caminhoCompleto;

                            Metadado meta = bdMetadados.get(nomeArquivo.toLowerCase());
                            
                            if (meta != null) {
                                // Se achou no BD.ini, preenche tudo separado!
                                m.titulo = capitalizar(meta.musica);
                                m.artista = capitalizar(meta.artista);
                                m.inicio = capitalizar(meta.inicio);
                            } else {
                                // Se for um vídeo solto fora do catálogo, usa o código/nome do arquivo
                                m.titulo = codigo;
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
            String currentArquivo = null;
            String currentArtista = "Desconhecido";
            String currentMusica = "Desconhecida";
            String currentInicio = ""; // Nova variável para guardar o início

            while ((linha = br.readLine()) != null) {
                linha = linha.trim();
                
                if (linha.startsWith("[")) {
                    if (currentArquivo != null) {
                        bdMetadados.put(currentArquivo.toLowerCase(), new Metadado(currentArtista, currentMusica, currentInicio));
                    }
                    currentArquivo = null;
                    currentArtista = "Desconhecido";
                    currentMusica = "Desconhecida";
                    currentInicio = ""; // Reseta para a próxima música
                } else if (linha.toLowerCase().startsWith("arquivo=")) {
                    currentArquivo = linha.substring(8).trim();
                } else if (linha.toLowerCase().startsWith("artista=")) {
                    currentArtista = linha.substring(8).trim();
                } else if (linha.toLowerCase().startsWith("musica=")) {
                    currentMusica = linha.substring(7).trim();
                } else if (linha.toLowerCase().startsWith("inicio=")) {
                    currentInicio = linha.substring(7).trim(); // Captura a linha de início
                }
            }
            if (currentArquivo != null) {
                bdMetadados.put(currentArquivo.toLowerCase(), new Metadado(currentArtista, currentMusica, currentInicio));
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
            filtradas = catalogo; // Sem pesquisa, devolve tudo (mas será paginado abaixo)
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

        // --- Lógica de Paginação ---
        int total = filtradas.size();
        int totalPaginas = (int) Math.ceil((double) total / limit);
        
        // Garante que a página solicitada não ultrapassa os limites
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
        
        // Procura diretamente na lista completa (rápido e sem paginação)
        return catalogo.stream()
                .filter(m -> id.equals(m.id))
                .findFirst();
    }
}