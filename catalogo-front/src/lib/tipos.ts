/** Tipos do domínio. Nada aqui depende de React para poder ser testado à parte. */

export interface Musica {
  /** Código exibido e ditado no karaokê, ex.: "01018". */
  id: string
  titulo: string
  artista: string
  /** Primeiro verso, quando existe e é aproveitável. String vazia caso contrário. */
  trecho: string
  /** Segunda gravação da mesma música (mesmo artista + título) no acervo. */
  duplicada: boolean

  // ---- campos derivados, calculados uma vez no carregamento ----
  /** Texto de busca: minúsculo, sem acento, "&" → "e", com o código embutido. */
  chave: string
  /** Título normalizado sem pontuação inicial, para ordenar e indexar A–Z. */
  ordemTitulo: string
  /** Artista normalizado, para a visão "por artista". */
  ordemArtista: string
  /** Inicial Maiúscula usada nos cabeçalhos do índice A–Z. */
  letra: string
}

export type Ordenacao = 'titulo' | 'artista' | 'codigo'

export interface FacetaArtista {
  nome: string
  quantidade: number
}

export interface Catalogo {
  total: number
  /** Três índices pré-ordenados do mesmo conjunto. Filtrar preserva a ordem,
   *  então a tela nunca ordena 14 mil itens em um keystroke. */
  porTitulo: Musica[]
  porArtista: Musica[]
  porCodigo: Musica[]
  /** Artistas mais frequentes, para a tela inicial e os chips. */
  topArtistas: FacetaArtista[]
  /** Hash do TXT de origem: reprodutível, diz de qual arquivo o acervo veio. */
  carimboFonte: string
}

export interface FilaItem {
  id: string
  /** Momento em que a música entrou na fila; define a ordem inicial. */
  desde: number
}

/** 'sistema' segue prefers-color-scheme; é o padrão na primeira visita. */
export type Tema = 'claro' | 'escuro' | 'sistema'

export interface Preferencias {
  tema: Tema
  ordenacao: Ordenacao
}

/** Item da lista virtualizada: cabeçalho de letra ou música. */
export type ItemLista =
  | { tipo: 'letra'; texto: string; altura: number }
  | { tipo: 'musica'; musica: Musica; altura: number }
