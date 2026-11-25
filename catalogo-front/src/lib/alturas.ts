import type { ItemLista, Musica } from './tipos'

/**
 * Fonte única das alturas. A virtualização soma esses números e o componente
 * aplica o mesmo valor inline; se divergirem, a barra de rolagem e o clique
 * saem do lugar. Manter os dois no mesmo arquivo é o acordo.
 */
export const ALTURA_LETRA = 30
export const ALTURA_LINHA = 64
export const ALTURA_LINHA_COM_TRECHO = 84

export function alturaDaMusica(musica: Musica): number {
  return musica.trecho ? ALTURA_LINHA_COM_TRECHO : ALTURA_LINHA
}

/** Monta a lista com cabeçalhos de letra apenas quando a ordem é A–Z e não há busca. */
export function montarItensDaLista(
  musicas: Musica[],
  opcoes: { mostrarLetras: boolean },
): ItemLista[] {
  const itens: ItemLista[] = []
  let ultima = ''
  for (const musica of musicas) {
    if (opcoes.mostrarLetras && musica.letra !== ultima) {
      ultima = musica.letra
      itens.push({ tipo: 'letra', texto: ultima, altura: ALTURA_LETRA })
    }
    itens.push({ tipo: 'musica', musica, altura: alturaDaMusica(musica) })
  }
  return itens
}

export interface GrupoLetra {
  texto: string
  /** Topo do cabeçalho em px dentro da lista inteira. */
  topo: number
  /** Base do último item do grupo em px. */
  fim: number
}

/**
 * Índice A–Z em pixels. Serve para duas coisas: o trilho lateral (rolar até a
 * letra) e a letra ativa, que é o que diz ao usuário onde ele está depois de um
 * swipe rápido — sem isso a lista de 1,1 milhão de px vira um túnel sem sinal.
 */
export function gruposDeLetras(itens: ItemLista[]): GrupoLetra[] {
  const grupos: GrupoLetra[] = []
  let topo = 0
  for (const item of itens) {
    if (item.tipo === 'letra') {
      const anterior = grupos[grupos.length - 1]
      if (anterior) anterior.fim = topo
      grupos.push({ texto: item.texto, topo, fim: Number.MAX_SAFE_INTEGER })
    }
    topo += item.altura
  }
  const ultimo = grupos[grupos.length - 1]
  if (ultimo) ultimo.fim = topo
  return grupos
}

/** Letra do grupo que está encostando no topo da área visível. */
export function letraNoTopo(grupos: GrupoLetra[], scrollTop: number): string | null {
  if (grupos.length === 0) return null
  let atual = grupos[0]
  for (const grupo of grupos) {
    if (grupo.topo <= scrollTop + 1) atual = grupo
    else break
  }
  return atual.texto
}
