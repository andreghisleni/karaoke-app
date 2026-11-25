import type { Catalogo, FacetaArtista, Musica, Ordenacao } from './tipos'
import { normalizar, termosDe } from './texto'

/**
 * Regras de busca, em ordem de precedência:
 *
 * 1. TODOS os termos precisam aparecer em algum lugar do registro (AND). Isso
 *    resolve "jorge mateus" achar "Jorge & Mateus" sem exigir a ordem exata da
 *    substring, que era o comportamento antigo.
 * 2. Cada registro é pontuado pelo campo onde os termos caíram: código exato
 *    vence título exato, que vence "título começa com", que vence artista, que
 *    vence trecho da letra. Antes não havia ranking nenhum, e "1" casava com
 *    8.575 códigos — o que afogava qualquer resultado bom.
 * 3. Se nada passar, cada termo é comparado palavra por palavra com distância
 *    de edição ≤ 1-2 ("kumolizora" acha "Kumorizora", "legio urbna" acha
 *    Legião Urbana). Essa varredura só roda no caso raro de resultado vazio.
*/

const PONTOS = {
  codigoExato: 200,
  codigoPrefixo: 150,
  tituloExato: 130,
  tituloComeca: 110,
  artistaComeca: 100,
  tituloContem: 80,
  artistaContem: 70,
  trechoContem: 30,
  outro: 10,
} as const

interface Candidato {
  musica: Musica
  pontos: number
}

/** Pontos de um único termo, segundo o campo em que ele caiu. 0 = não caiu. */
function pontuarTermo(musica: Musica, termo: string): number {
  if (!musica.chave.includes(termo)) return 0
  if (musica.id === termo) return PONTOS.codigoExato
  if (musica.id.startsWith(termo)) return PONTOS.codigoPrefixo

  const titulo = normalizar(musica.titulo)
  const artista = normalizar(musica.artista)
  const trecho = normalizar(musica.trecho)
  if (titulo === termo) return PONTOS.tituloExato
  if (titulo.startsWith(termo)) return PONTOS.tituloComeca
  if (artista.startsWith(termo)) return PONTOS.artistaComeca
  if (titulo.includes(termo)) return PONTOS.tituloContem
  if (artista.includes(termo)) return PONTOS.artistaContem
  if (trecho.includes(termo)) return PONTOS.trechoContem
  return PONTOS.outro
}

function pontuar(musica: Musica, termos: string[]): number {
  let total = 0
  for (const termo of termos) {
    if (!musica.chave.includes(termo)) return 0
    total += pontuarTermo(musica, termo)
  }
  return total
}

/** Levenshtein com corte prematuro: acima de `limite` o número não interessa. */
function distancia(a: string, b: string, limite: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limite) return limite + 1
  let anterior = new Uint16Array(b.length + 1)
  let atual = new Uint16Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) anterior[j] = j
  for (let i = 1; i <= a.length; i++) {
    atual[0] = i
    let menor = atual[0]
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      const valor = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo)
      atual[j] = valor
      if (valor < menor) menor = valor
    }
    if (menor > limite) return limite + 1
    const troca = anterior
    anterior = atual
    atual = troca
  }
  return anterior[b.length]
}

/**
 * Nota do caminho aproximado: AND com tolerância. Cada termo precisa ter ao
 * menos um vizinho na chave do registro (erro de teclado, letra a mais ou a
 * menos, acento esquecido). Um termo sem vizinho derruba o registro — é o que
 * impede "roxte carlos" de virar uma lista de 165 qualquer.
 *
 * Só roda quando a busca rígida não devolveu nada, então a varredura completa
 * das 14.531 chaves é aceitável (medido: ~15 ms no notebook, ~60 ms no celular).
 */
function pontuarAproximado(musica: Musica, termos: string[]): number {
  const palavras = musica.chave.split(' ')
  let total = 0

  for (const termo of termos) {
    const exato = pontuarTermo(musica, termo)
    if (exato > 0) {
      total += exato
      continue
    }
    // 3 letras ou menos não há o que aproximar sem chamar ruído.
    if (termo.length < 4) return 0

    const limite = termo.length >= 8 ? 2 : 1
    let melhor = limite + 1
    for (const palavra of palavras) {
      // Palavras com parêntese/aspas teriam distância 1 só pela pontuação.
      if (!/^[a-z0-9]+$/.test(palavra)) continue
      if (Math.abs(palavra.length - termo.length) > limite) continue
      const d = distancia(termo, palavra, limite)
      if (d < melhor) {
        melhor = d
        if (d === 1) break
      }
    }
    if (melhor > limite) return 0
    total += melhor === 1 ? 45 : 30
  }

  return total
}

function coletar(
  fonte: Musica[],
  termos: string[],
  artista: string | null,
): Musica[] {
  if (termos.length === 0) {
    return artista ? fonte.filter((m) => m.ordemArtista === normalizar(artista)) : fonte
  }
  const base = artista ? fonte.filter((m) => m.ordemArtista === normalizar(artista)) : fonte
  return base.filter((m) => termos.every((t) => m.chave.includes(t)))
}

export interface ResultadoBusca {
  itens: Musica[]
  /** Sempre o total real de correspondências, mesmo quando a tela corta. */
  total: number
  /** Artistas presentes no resultado, mais frequentes primeiro. */
  facetas: FacetaArtista[]
  /** Usado só quando a busca rígida não devolve nada. */
  aproximada: boolean
}

export function buscar(
  catalogo: Catalogo,
  busca: string,
  opcoes: { artista?: string | null; ordenacao?: Ordenacao } = {},
): ResultadoBusca {
  const ordenacao = opcoes.ordenacao ?? 'titulo'
  const artista = opcoes.artista ?? null
  const fonte =
    ordenacao === 'artista'
      ? catalogo.porArtista
      : ordenacao === 'codigo'
        ? catalogo.porCodigo
        : catalogo.porTitulo

  const termos = termosDe(busca)
  const candidatos = coletar(fonte, termos, artista)

  let itens: Musica[]
  let aproximada = false

  if (termos.length === 0) {
    itens = candidatos
  } else {
    // Na visão "por artista" a ordem estrutural já vem do índice; rankear por
    // relevância só faz sentido em A–Z e por código.
    const rankear = ordenacao !== 'artista'
    if (rankear) {
      itens = candidatos
        .map<Candidato>((musica) => ({ musica, pontos: pontuar(musica, termos) }))
        .filter((c) => c.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos || a.musica.ordemTitulo.localeCompare(b.musica.ordemTitulo, 'pt-BR'))
        .map((c) => c.musica)
    } else {
      itens = candidatos.filter((m) => termos.every((t) => m.chave.includes(t)))
    }

    if (itens.length === 0) {
      aproximada = true
      const alvo = normalizar(artista ?? '')
      itens = fonte
        .filter((m) => !artista || m.ordemArtista === alvo)
        .map<Candidato>((musica) => ({ musica, pontos: pontuarAproximado(musica, termos) }))
        .filter((c) => c.pontos > 0)
        .sort(
          (a, b) =>
            b.pontos - a.pontos || a.musica.ordemTitulo.localeCompare(b.musica.ordemTitulo, 'pt-BR'),
        )
        .map((c) => c.musica)
    }
  }

  return { itens, total: itens.length, facetas: facetasDe(itens), aproximada }
}

/** Facetas de artista do conjunto de resultados (top 12). */
export function facetasDe(itens: Musica[]): FacetaArtista[] {
  if (itens.length === 0) return []
  const contagem = new Map<string, { nome: string; quantidade: number }>()
  for (const m of itens) {
    if (!m.artista) continue
    const chave = m.ordemArtista
    const atual = contagem.get(chave)
    if (atual) atual.quantidade += 1
    else contagem.set(chave, { nome: m.artista, quantidade: 1 })
  }
  return [...contagem.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 12)
}

/** Número de correspondências por campo, para explicar um resultado vazio. */
export function sugerirTermos(catalogo: Catalogo, busca: string): string[] {
  const termos = termosDe(busca)
  if (termos.length === 0) return []
  const alvo = termos[termos.length - 1]
  if (alvo.length < 3) return []
  const sug: string[] = []
  for (const m of catalogo.porTitulo) {
    if (m.ordemTitulo.startsWith(alvo) || m.ordemArtista.startsWith(alvo)) {
      const nome = m.ordemTitulo.startsWith(alvo) ? m.titulo : m.artista
      if (!sug.includes(nome)) sug.push(nome)
      if (sug.length >= 4) break
    }
  }
  return sug
}
