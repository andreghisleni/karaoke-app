import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PADRAO,
  carregarEstado,
  lerFilaSincrona,
  salvarFila,
  salvarPreferencias,
  salvarRecentes,
  type EstadoLocal,
} from '@/lib/armazenamento'
import type { FilaItem, Preferencias } from '@/lib/tipos'

const MAX_RECENTES = 8

/**
 * Fonte única de verdade do que é local. O boot usa o espelho síncrono de
 * localStorage para a fila já aparecer no primeiro paint; a leitura completa do
 * IndexedDB chega em seguida e só então as gravações são liberadas (para não
 * sobrescrever o banco com o estado vazio inicial).
 */
export function useArmazenamentoLocal() {
  const [estado, setEstado] = useState<EstadoLocal>(() => ({
    ...PADRAO,
    fila: lerFilaSincrona(),
  }))
  const [pronto, setPronto] = useState(false)
  const ultimaSerieRecentes = useRef<string>('')

  useEffect(() => {
    let vivo = true
    carregarEstado().then((carregado) => {
      if (!vivo) return
      setEstado(carregado)
      setPronto(true)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (pronto) void salvarFila(estado.fila)
  }, [estado.fila, pronto])

  useEffect(() => {
    if (pronto) void salvarPreferencias(estado.preferencias)
  }, [estado.preferencias, pronto])

  useEffect(() => {
    if (pronto) void salvarRecentes(estado.recentes)
  }, [estado.recentes, pronto])

  // Os updaters abaixo são todos puros: o React pode invocá-los mais de uma vez
  // (StrictMode), então "entrou/saiu da fila" nunca é calculado aqui dentro —
  // quem precisa dessa informação consulta o conjunto `naFila` antes de chamar.
  const alternarNaFila = useCallback((id: string) => {
    setEstado((atual) => {
      if (atual.fila.some((i) => i.id === id)) {
        return { ...atual, fila: atual.fila.filter((i) => i.id !== id) }
      }
      return { ...atual, fila: [...atual.fila, { id, desde: Date.now() }] }
    })
  }, [])

  const removerDaFila = useCallback((id: string) => {
    setEstado((atual) => ({ ...atual, fila: atual.fila.filter((i) => i.id !== id) }))
  }, [])

  const limparFila = useCallback(() => {
    setEstado((atual) => ({ ...atual, fila: [] }))
  }, [])

  const definirFila = useCallback((itens: FilaItem[]) => {
    setEstado((atual) => ({ ...atual, fila: itens }))
  }, [])

  const moverNaFila = useCallback((id: string, destino: number) => {
    setEstado((atual) => {
      const index = atual.fila.findIndex((i) => i.id === id)
      if (index < 0) return atual
      const alvo = Math.max(0, Math.min(atual.fila.length - 1, destino))
      if (alvo === index) return atual
      const fila = [...atual.fila]
      const [movido] = fila.splice(index, 1)
      fila.splice(alvo, 0, movido)
      return { ...atual, fila }
    })
  }, [])

  const definirPreferencia = useCallback(
    <K extends keyof Preferencias>(chave: K, valor: Preferencias[K]) => {
      setEstado((atual) => ({
        ...atual,
        preferencias: { ...atual.preferencias, [chave]: valor },
      }))
    },
    [],
  )

  const registrarBusca = useCallback((termo: string) => {
    const limpo = termo.trim()
    if (limpo.length < 2) return
    setEstado((atual) => {
      const recentes = [
        limpo,
        ...atual.recentes.filter((r) => r.toLowerCase() !== limpo.toLowerCase()),
      ].slice(0, MAX_RECENTES)
      const serie = recentes.join('|')
      if (serie === ultimaSerieRecentes.current) return atual
      ultimaSerieRecentes.current = serie
      return { ...atual, recentes }
    })
  }, [])

  const limparRecentes = useCallback(() => {
    ultimaSerieRecentes.current = ''
    setEstado((atual) => ({ ...atual, recentes: [] }))
  }, [])

  const naFila = useMemo(() => new Set(estado.fila.map((i) => i.id)), [estado.fila])

  return {
    pronto,
    fila: estado.fila,
    naFila,
    recentes: estado.recentes,
    preferencias: estado.preferencias,
    alternarNaFila,
    removerDaFila,
    limparFila,
    definirFila,
    moverNaFila,
    definirPreferencia,
    registrarBusca,
    limparRecentes,
  }
}

export type ArmazenamentoLocal = ReturnType<typeof useArmazenamentoLocal>
