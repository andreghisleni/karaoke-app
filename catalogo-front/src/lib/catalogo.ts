import type { Catalogo, FacetaArtista, Musica } from './tipos'
import { baseOrdenacao, inicialParaIndice, normalizar } from './texto'

/**
 * Dentro do app de karaokê, o acervo não é mais um arquivo gerado no build: ele é a biblioteca
 * real da máquina, lida do `BD.ini` pelo Java e servida em `GET /api/acervo` no mesmo formato do
 * JSON antigo — `{ total, carimboFonte, musicas: [[id, titulo, artista, trecho, duplicada]],
 * artistas: [[nome, quantidade]] }`. Trocar uma linha aqui foi o suficiente para o resto do app
 * (busca aproximada, A–Z, chips de artista) continuar igual.
 *
 * Continua sendo carregado fora do primeiro paint: o shell (busca, abas, tema) aparece na hora e
 * os ~180 KB comprimidos chegam logo atrás. Em uma rede de festa isolada, isso é tudo o que cada
 * celular baixa — não existe CDN, nem nuvem, nem segunda requisição de lista.
 */

interface LinhaJson {
  id: string
  t: string
  a: string
  s: string
  d: number
}

async function montar() {
  const resposta = await fetch('/api/acervo', { headers: { Accept: 'application/json' } })
  if (!resposta.ok) {
    throw new Error(`O servidor respondeu ${resposta.status} ao pedir o acervo.`)
  }
  const bruto = (await resposta.json()) as {
    total: number
    carimboFonte: string
    musicas: [string, string, string, string, number][]
    artistas?: [string, number][]
  }
  if (!Array.isArray(bruto.musicas)) {
    throw new Error('Resposta do /api/acervo sem a lista de músicas.')
  }

  const musicas: Musica[] = bruto.musicas.map(([id, t, a, s, d]) => {
    const linha = { id, t, a, s, d } as unknown as LinhaJson
    const titulo = linha.t
    const artista = linha.a
    const trecho = linha.s
    return {
      id,
      titulo,
      artista,
      trecho,
      duplicada: linha.d === 1,
      chave: [normalizar(titulo), normalizar(artista), normalizar(trecho), id].join(' '),
      ordemTitulo: baseOrdenacao(normalizar(titulo)),
      ordemArtista: normalizar(artista || '~'),
      letra: inicialParaIndice(titulo),
    }
  })

  const porTitulo = [...musicas].sort(
    (x, y) =>
      x.ordemTitulo.localeCompare(y.ordemTitulo, 'pt-BR', { numeric: true }) ||
      x.id.localeCompare(y.id),
  )
  const porArtista = [...musicas].sort(
    (x, y) =>
      x.ordemArtista.localeCompare(y.ordemArtista, 'pt-BR', { numeric: true }) ||
      x.ordemTitulo.localeCompare(y.ordemTitulo, 'pt-BR', { numeric: true }) ||
      x.id.localeCompare(y.id),
  )
  const porCodigo = [...musicas].sort(
    (x, y) => Number(x.id) - Number(y.id) || x.id.localeCompare(y.id),
  )

  const topArtistas: FacetaArtista[] = (bruto.artistas ?? [])
    .slice(0, 24)
    .map(([nome, quantidade]) => ({ nome, quantidade }))

  return {
    total: bruto.total,
    porTitulo,
    porArtista,
    porCodigo,
    topArtistas,
    carimboFonte: bruto.carimboFonte,
  }
}

let promissa: Promise<Catalogo> | null = null

/**
 * Carrega uma única vez e devolve o catálogo indexado. Montar os índices custa
 * ~100 ms em um celular médio (14,5 mil músicas), por isso acontece fora do
 * primeiro paint e nunca se repete entre trocas de aba.
 */
export function carregarCatalogo(): Promise<Catalogo> {
  if (!promissa) {
    promissa = montar().catch((erro: unknown) => {
      promissa = null
      throw erro
    })
  }
  return promissa
}

const mapasPorId = new WeakMap<Catalogo, Map<string, Musica>>()

function indicePorId(catalogo: Catalogo): Map<string, Musica> {
  let mapa = mapasPorId.get(catalogo)
  if (!mapa) {
    mapa = new Map(catalogo.porTitulo.map((m) => [m.id, m]))
    mapasPorId.set(catalogo, mapa)
  }
  return mapa
}

export function buscarPorId(catalogo: Catalogo, id: string): Musica | undefined {
  return indicePorId(catalogo).get(id.trim())
}

/** Preserva a ordem da fila; ids que sumiram do catálogo são ignorados. */
export function musicasPorId(catalogo: Catalogo, ids: string[]): Musica[] {
  const mapa = indicePorId(catalogo)
  return ids.map((id) => mapa.get(id)).filter((m): m is Musica => Boolean(m))
}
