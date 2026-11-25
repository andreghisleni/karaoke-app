import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ordenacao } from '@/lib/tipos'
import { normalizar } from '@/lib/texto'

/**
 * Busca e filtro vivem na query string (`?q=&artista=`), então qualquer tela é
 * um link compartilhável — alguém pode mandar "olha essa" no grupo do salão.
 * A aba fica no hash, porque o site é estático e não tem rewrite no servidor.
 */
export type Aba = 'catalogo' | 'fila'

interface Inicial {
  busca: string
  artista: string | null
  ordenacao: Ordenacao
  aba: Aba
}

const ORDENS: Ordenacao[] = ['titulo', 'artista', 'codigo']

function lerUrl(): Inicial {
  const params = new URLSearchParams(location.search)
  const aba: Aba = location.hash.replace(/^#\/?/, '') === 'fila' ? 'fila' : 'catalogo'
  const ordenacaoParam = params.get('ordem') as Ordenacao | null
  return {
    busca: params.get('q') ?? '',
    artista: params.get('artista'),
    ordenacao: ordenacaoParam && ORDENS.includes(ordenacaoParam) ? ordenacaoParam : 'titulo',
    aba,
  }
}

export function useBuscaComUrl(preferenciaOrdenacao: Ordenacao) {
  const [{ busca: b0, artista: a0, ordenacao: o0, aba: aba0 }] = useState(lerUrl)
  const [busca, setBusca] = useState(b0)
  const [buscaAdiada, setBuscaAdiada] = useState(b0)
  const [artista, setArtista] = useState<string | null>(a0 ?? null)
  const [aba, setAba] = useState<Aba>(aba0)

  const artistaSelecionado = artista ? normalizar(artista) : null
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(o0 === 'titulo' ? preferenciaOrdenacao : o0)

  const atraso = useRef<number | undefined>(undefined)

  /** 110 ms: o suficiente para não filtrar 14 mil itens a cada tecla no celular. */
  const mudarBusca = useCallback((valor: string) => {
    setBusca(valor)
    window.clearTimeout(atraso.current)
    atraso.current = window.setTimeout(() => setBuscaAdiada(valor), 110)
  }, [])

  /** Atalho (chip, sugestão, recente): aplica na hora, sem esperar o debounce. */
  const definirBusca = useCallback((valor: string) => {
    window.clearTimeout(atraso.current)
    setBusca(valor)
    setBuscaAdiada(valor)
  }, [])

  useEffect(() => () => window.clearTimeout(atraso.current), [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (buscaAdiada.trim()) params.set('q', buscaAdiada.trim())
    if (artista) params.set('artista', artista)
    if (ordenacao !== 'titulo') params.set('ordem', ordenacao)
    const consulta = params.toString()
    history.replaceState(null, '', `${location.pathname}${consulta ? `?${consulta}` : ''}${aba === 'fila' ? '#/fila' : ''}`)
  }, [buscaAdiada, artista, ordenacao, aba])

  /** O botão voltar do navegador passa a fazer sentido dentro do app. */
  useEffect(() => {
    const aoMudarHash = () => setAba(location.hash.replace(/^#\/?/, '') === 'fila' ? 'fila' : 'catalogo')
    window.addEventListener('hashchange', aoMudarHash)
    return () => window.removeEventListener('hashchange', aoMudarHash)
  }, [])

  const irParaAba = useCallback((proxima: Aba) => {
    setAba(proxima)
    history.replaceState(null, '', `${location.pathname}${location.search}${proxima === 'fila' ? '#/fila' : ''}`)
  }, [])

  return {
    busca,
    buscaAdiada,
    mudarBusca,
    definirBusca,
    artista,
    artistaSelecionado,
    setArtista,
    ordenacao,
    setOrdenacao,
    aba,
    irParaAba,
  }
}
