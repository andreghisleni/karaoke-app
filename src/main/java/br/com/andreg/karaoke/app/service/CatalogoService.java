package br.com.andreg.karaoke.app.service;

import br.com.andreg.karaoke.app.model.Musica;
import br.com.andreg.karaoke.app.model.RespostaPaginada;

import java.text.Normalizer;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class CatalogoService {

    private final List<Musica> catalogo = new ArrayList<>();
    private final Map<String, Metadado> bdMetadados = new HashMap<>();

    /**
     * Índice por código do BD.ini. O código é a chave estável: diferente do {@code id},
     * que era um {@code UUID.randomUUID()} criado a cada varredura, ele sobrevive a um
     * reinício do app — essencial para a fila e para o pedido por nome.
     */
    private final Map<String, Musica> porCodigo = new HashMap<>();

    /**
     * Acervo compacto (a lista inteira que o celular baixa) e as facetas de artista, montados uma
     * vez por varredura. São ~11 mil linhas: refazer isso a cada aparelho que abre a página
     * custaria CPU à toa no meio da festa.
     */
    private List<Object[]> acervoCache;
    private List<Object[]> artistasCache;
    private String carimboCache;

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
        porCodigo.clear();
        acervoCache = null;
        artistasCache = null;
        carimboCache = null;
        carregarBDIni();

        int[] repetidas = { 0 }; // contador dentro do lambda

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
                            m.caminho = caminhoCompleto;

                            Metadado meta = bdMetadados.get(nomeArquivo.toLowerCase());

                            if (meta != null) {
                                // --- MUDANÇA 2: Agora usamos o código do BD.ini (ex: 99000) ---
                                m.codigo = meta.codigo == null ? codigoFallback : meta.codigo.strip();
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

                            // id = código: passa a ser o mesmo endereço depois de reiniciar o app
                            m.id = m.codigo;
                            indexar(m);

                            if (porCodigo.putIfAbsent(m.codigo.toLowerCase(), m) != null) {
                                repetidas[0]++; // dois arquivos com o mesmo código: fica o primeiro
                                return;
                            }
                            catalogo.add(m);
                        });
            } catch (Exception e) {
                System.err.println("Erro ao ler pasta: " + pastaStr);
            }
        }

        // ordem A-Z é o padrão quando o convidado abre a busca vazia
        catalogo.sort((a, b) -> a.titulo.equalsIgnoreCase(b.titulo)
                ? a.codigo.compareTo(b.codigo)
                : a.titulo.compareToIgnoreCase(b.titulo));

        System.out.println("Catálogo atualizado: " + catalogo.size() + " músicas disponíveis."
                + (repetidas[0] > 0 ? " (" + repetidas[0] + " arquivos duplicados ignorados)" : ""));
    }

    /**
     * Blob pré-computado, minúsculo e sem acento, para a busca não refazer o trabalho a
     * cada tecla de cada celular ("Zezé" e "zeze" viram a mesma coisa).
     */
    private static void indexar(Musica m) {
        m.buscaCodigo = semAcento(m.codigo);
        m.buscaTitulo = semAcento(m.titulo);
        m.buscaArtista = semAcento(m.artista);
        m.busca = m.buscaCodigo + " " + m.buscaTitulo + " " + m.buscaArtista + " " + semAcento(m.inicio);
    }

    static String semAcento(String texto) {
        if (texto == null) return "";
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase();
    }

    /**
     * Lê o BD.ini sempre no mesmo idioma de bytes, não no charset padrão da JVM.
     * <p>
     * Do jeito antigo ({@code new FileReader}) o resultado dependia de como o Java foi
     * iniciado: num servidor com locale diferente, "Zezé" virava "ZezÃ©" e a busca por
     * acento quebrava. Aqui tentamos UTF-8 estrito; se algum byte for inválido, o arquivo
     * é ANSI (Windows-1252), comum em BDs exportados por ferramentas de karaokê.
     */
    private static BufferedReader novoLeitor(File arquivo) throws Exception {
        byte[] bruto = Files.readAllBytes(arquivo.toPath());
        return new BufferedReader(new InputStreamReader(new ByteArrayInputStream(bruto), detectarCharset(bruto)));
    }

    static Charset detectarCharset(byte[] bruto) {
        CharsetDecoder utf8 = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        try {
            utf8.decode(java.nio.ByteBuffer.wrap(bruto));
            return StandardCharsets.UTF_8;
        } catch (CharacterCodingException esperada) {
            return Charset.forName("Windows-1252");
        }
    }

    private void carregarBDIni() {
        bdMetadados.clear();
        File arquivoBd = new File("BD.ini"); 
        
        if (!arquivoBd.exists()) {
            System.out.println("ℹ️ Arquivo BD.ini não encontrado.");
            return;
        }

        System.out.println("📂 Lendo BD.ini...");
        try (BufferedReader br = novoLeitor(arquivoBd)) {
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

        String q = semAcento(query == null ? "" : query.strip());

        if (q.isEmpty()) {
            filtradas = catalogo;  // já ordenado A-Z no carregar()
        } else {
            filtradas = catalogo.stream()
                    .filter(m -> m.busca.contains(q))
                    .collect(Collectors.toList());

            // sem isto, digitar "1848" no celular mostra os "1848x" perdidos no meio do A-Z
            filtradas.sort(java.util.Comparator.comparingInt(m -> relevancia(m, q)));
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

        // hoje id e código são a mesma coisa; o caminho antigo fica como rede de segurança
        Optional<Musica> peloCodigo = buscarPorCodigo(id);
        if (peloCodigo.isPresent()) return peloCodigo;

        return catalogo.stream()
                .filter(m -> id.equals(m.id))
                .findFirst();
    }

    /** Busca direta pelo código do BD.ini — é por aqui que o convidado pede música. */
    public Optional<Musica> buscarPorCodigo(String codigo) {
        if (codigo == null || codigo.strip().isEmpty()) return Optional.empty();
        return Optional.ofNullable(porCodigo.get(codigo.strip().toLowerCase()));
    }

    /** Menor vence: código exato, código começando, título começando, artista, resto. */
    private static int relevancia(Musica m, String q) {
        if (m.buscaCodigo.equals(q)) return 0;
        if (m.buscaCodigo.startsWith(q)) return 1;
        if (m.buscaTitulo.startsWith(q)) return 2;
        if (m.buscaArtista.startsWith(q)) return 3;
        if (m.buscaTitulo.contains(q)) return 4;
        return 5;
    }

    /**
     * Lista enxuta de tudo que tem arquivo no disco, em linhas {@code [codigo, titulo, artista]}.
     * Serve para o navegador do convidado baixar uma vez e digitar sem perguntar ao servidor.
     * Vazio de propósito nos nomes das chaves: 14 mil entradas custam ~34 KB compactas.
     */
    public List<Object[]> acervo() {
        return acervoCompilado();
    }

    /**
     * O acervo inteiro no formato que o {@code catalogo-front} lê:
     * {@code [id, titulo, artista, trecho, duplicada]} — os mesmos nomes de campo do JSON que o
     * front gerava no build, só que agora vindos do acervo real da máquina.
     *
     * O {@code inicio} entra truncado (90 caracteres, uma linha): é o que faz a busca por trecho
     * funcionar no aparelho; o verso inteiro vezes 11 mil músicas triplicaria o download no
     * Wi-Fi da festa. {@code duplicada} marca a segunda gravação do mesmo par artista+título.
     */
    public synchronized List<Object[]> acervoCompilado() {
        if (acervoCache != null) return acervoCache;

        List<Object[]> linhas = new ArrayList<>(catalogo.size());
        Set<String> vistas = new HashSet<>();
        Map<String, Integer> porArtista = new HashMap<>();
        int hash = 1;

        for (Musica m : catalogo) {
            String trecho = truncar(unaEmLinha(m.inicio), 90);
            String chaveDup = semAcento(m.artista) + "@" + semAcento(m.titulo);
            int duplicada = vistas.add(chaveDup) ? 0 : 1;
            // o 5º campo é número de propósito: o front testa `d === 1`
            linhas.add(new Object[] { m.codigo, nv(m.titulo), nv(m.artista), trecho, duplicada });
            porArtista.merge(nv(m.artista), 1, Integer::sum);
            hash = 31 * hash + nv(m.codigo).hashCode();
        }

        acervoCache = Collections.unmodifiableList(linhas);
        carimboCache = acervoCache.size() + "-" + Integer.toHexString(hash);

        List<Map.Entry<String, Integer>> ordenadas = new ArrayList<>(porArtista.entrySet());
        ordenadas.sort((a, b) -> {
            int porQuantidade = Integer.compare(b.getValue(), a.getValue());
            return porQuantidade != 0 ? porQuantidade : a.getKey().compareToIgnoreCase(b.getKey());
        });
        List<Object[]> facetas = new ArrayList<>();
        for (Map.Entry<String, Integer> e : ordenadas) {
            facetas.add(new Object[] { e.getKey(), e.getValue() });
        }
        artistasCache = Collections.unmodifiableList(facetas);
        return acervoCache;
    }

    /** Artistas mais frequentes, para os chips e a tela inicial do catálogo. */
    public synchronized List<Object[]> artistasFacetas(int topo) {
        acervoCompilado(); // garante o cache preenchido
        if (artistasCache.size() <= topo) return artistasCache;
        return artistasCache.subList(0, topo);
    }

    /** Identidade do acervo em memória: muda quando a varredura muda. */
    public synchronized String carimboAcervo() {
        acervoCompilado();
        return carimboCache;
    }

    private static String nv(String v) {
        return v == null ? "" : v;
    }

    private static String unaEmLinha(String v) {
        return nv(v).replace('\n', ' ').replace('\r', ' ').replaceAll(" {2,}", " ").strip();
    }

    private static String truncar(String v, int limite) {
        if (v.length() <= limite) return v;
        return v.substring(0, limite - 1).strip() + "…";
    }

    public int totalMusicas() {
        return catalogo.size();
    }
}
