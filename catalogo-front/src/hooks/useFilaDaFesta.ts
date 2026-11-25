import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  assinarFila,
  buscarFila,
  cancelarPedido as cancelarNoServidor,
  normalizarNome,
  pedirMusica,
} from '@/lib/sala'
import type { Pedido, ResultadoPedido, StatusDaFila } from '@/lib/sala'

/**
 * A fila de verdade da festa, ao vivo.
 *
 * "Ao vivo" aqui é push, não poll: o Java broadcasteia o status do player no `/ws` toda vez que a
 * fila muda (pediu, cantou, pulou), então 20 celulares acompanham a mesma posição com uma
 * connection cada, sem o servidor varrer a biblioteca a cada 2 segundos.
 *
 * O snapshot inicial vem de `GET /api/fila` porque o websocket entrega só as mudanças seguintes —
 * sem isso a tela ficaria em branco até alguém pedir uma música.
 */
export interface FilaDaFesta {
  status: StatusDaFila | null
  /** Pedidos desta pessoa, já com posição e andar. */
  meus: Pedido[]
  conectado: boolean
  carregando: boolean
  pedir: (codigo: string, nome?: string) => Promise<ResultadoPedido>
  cancelar: (codigo: string, nome?: string) => Promise<ResultadoPedido>
  recarregar: () => void
}

export function useFilaDaFesta(nome: string): FilaDaFesta {
  const [status, setStatus] = useState<StatusDaFila | null>(null)
  const [conectado, setConectado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [carimbo, setCarimbo] = useState(0)
  const meuNome = useRef(nome)
  meuNome.current = nome

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    buscarFila(nome)
      .then((s) => vivo && setStatus(s))
      .catch(() => vivo && setStatus(null))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [nome, carimbo])

  useEffect(() => assinarFila(setStatus, setConectado), [])

  const meus = useMemo(() => {
    const chave = normalizarNome(nome)
    if (!chave || !status) return []
    return status.fila.filter((p) => normalizarNome(p.nome) === chave)
  }, [status, nome])

  /**
   * `nome` por parâmetro porque o fluxo "pedir sem ter nome salvo" abre o campo e pede na mesma
   * hora: o estado do nome ainda não passou pelo render quando a promessa é disparada.
   */
  const pedir = useCallback(
    async (codigo: string, nome?: string): Promise<ResultadoPedido> => {
      const quem = nome ?? meuNome.current
      const resultado = await pedirMusica(codigo, quem)
      // o broadcast já cuida de quem está com o socket de pé; isto aqui cobre a janela curta
      // entre a resposta e o próximo push, e o caso do Wi-Fi que caiu sem ninguém notar
      if (resultado.aceito) void buscarFila(quem).then(setStatus).catch(() => {})
      return resultado
    },
    [],
  )

  const cancelar = useCallback(
    async (codigo: string, nome?: string): Promise<ResultadoPedido> => {
      const quem = nome ?? meuNome.current
      const resultado = await cancelarNoServidor(codigo, quem)
      if (resultado.aceito) void buscarFila(quem).then(setStatus).catch(() => {})
      return resultado
    },
    [],
  )

  const recarregar = useCallback(() => setCarimbo((n) => n + 1), [])

  return { status, meus, conectado, carregando, pedir, cancelar, recarregar }
}
