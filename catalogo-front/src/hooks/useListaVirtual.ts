import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { ItemLista } from '@/lib/tipos'

/**
 * Virtualização própria, sem dependência nova.
 *
 * Por que: "Mostrar mais" de 50 em 50 para percorrer 14.531 músicas dá ~291
 * cliques e, sobretudo, mantém tudo no DOM. Aqui só existem no documento os
 * itens visíveis + uma margem.
 *
 * As alturas vêm do próprio item (`ItemLista.altura`) e são aplicadas inline no
 * componente, então a soma acumulada bate com o DOM sem medir nada. Isso é o
 * que permite ter cabeçalho de letra e linha de música com alturas diferentes.
 */
const OVERSCAN = 6

export interface JanelaVirtual {
  /** Ref para o container com overflow-y-auto. */
  containerRef: RefObject<HTMLDivElement | null>
  inicio: number
  fim: number
  /** Posição do topo visível em px. Usada para destacar a letra atual. */
  scrollTop: number
  /** Espaço vazio acima e abaixo da janela, para a barra de rolagem mentir o mínimo possível. */
  alturaAntes: number
  alturaDepois: number
  alturaTotal: number
  visiveis: ItemLista[]
}

export function useListaVirtual(itens: ItemLista[]): JanelaVirtual {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [alturaViewport, setAlturaViewport] = useState(0)

  useEffect(() => {
    const nodo = containerRef.current
    if (!nodo) return
    let quadro = 0
    const aoRolar = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => setScrollTop(nodo.scrollTop))
    }
    nodo.addEventListener('scroll', aoRolar, { passive: true })

    const redimensionar = new ResizeObserver(() => setAlturaViewport(nodo.clientHeight))
    redimensionar.observe(nodo)
    setAlturaViewport(nodo.clientHeight)

    return () => {
      cancelAnimationFrame(quadro)
      nodo.removeEventListener('scroll', aoRolar)
      redimensionar.disconnect()
    }
  }, [])

  // acumulados[i] = altura somada dos itens 0..i-1
  const acumulados = useMemo(() => {
    const soma = new Float64Array(itens.length + 1)
    for (let i = 0; i < itens.length; i++) soma[i + 1] = soma[i] + itens[i].altura
    return soma
  }, [itens])

  const alturaTotal = acumulados[acumulados.length - 1] ?? 0

  const { inicio, fim } = useMemo(() => {
    if (itens.length === 0) return { inicio: 0, fim: 0 }
    const limiteInferior = scrollTop
    const limiteSuperior = scrollTop + Math.max(alturaViewport, 480)

    // busca binária do primeiro item cujo fim passa do topo visível
    let baixo = 0
    let alto = itens.length
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1
      if (acumulados[meio + 1] <= limiteInferior) baixo = meio + 1
      else alto = meio
    }
    const comOverscan = Math.max(0, baixo - OVERSCAN)

    let fimIdx = baixo
    while (fimIdx < itens.length && acumulados[fimIdx] < limiteSuperior) fimIdx += 1
    return { inicio: comOverscan, fim: Math.min(itens.length, fimIdx + OVERSCAN) }
  }, [acumulados, itens.length, scrollTop, alturaViewport])

  const rolarParaTopo = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    // Busca nova => volta para o começo. Sem isso, quem rolou até o item 400 e
    // depois digita fica olhando para uma área vazia.
    rolarParaTopo()
  }, [itens, rolarParaTopo])

  return {
    containerRef,
    inicio,
    fim,
    scrollTop,
    alturaAntes: acumulados[inicio] ?? 0,
    alturaDepois: Math.max(0, alturaTotal - (acumulados[fim] ?? 0)),
    alturaTotal,
    visiveis: itens.slice(inicio, fim),
  }
}
