import { useCallback, useEffect, useRef, useState } from 'react'
import { carregarCatalogo } from '@/lib/catalogo'
import type { Catalogo } from '@/lib/tipos'

export type EstadoCatalogo =
  | { status: 'carregando'; tentativa: number }
  | { status: 'erro'; mensagem: string; tentativa: number }
  | { status: 'pronto'; catalogo: Catalogo }

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof TypeError) {
    // Falha de rede/chunk: o caso real do salão com Wi-Fi saturado.
    return 'O acervo não chegou até este aparelho. Se você já abriu o catálogo aqui antes, dá para continuar offline.'
  }
  if (erro instanceof Error && erro.message) return erro.message
  return 'O acervo não pôde ser carregado neste aparelho.'
}

/**
 * O app antigo tratava falha de carregamento como "nenhuma música encontrada",
 * o que fazia o usuário culpar a própria busca. Aqui o erro tem estado e
 * retry próprios, e o carregamento tem tentativa para o texto do esqueleto.
 */
export function useCatalogo(): [EstadoCatalogo, () => void] {
  const [estado, setEstado] = useState<EstadoCatalogo>({ status: 'carregando', tentativa: 1 })
  const tentativa = useRef(1)
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true
    carregarCatalogo()
      .then((catalogo) => {
        if (vivo.current) setEstado({ status: 'pronto', catalogo })
      })
      .catch((erro: unknown) => {
        if (vivo.current) {
          setEstado({ status: 'erro', tentativa: tentativa.current, mensagem: mensagemDeErro(erro) })
        }
      })
    return () => {
      vivo.current = false
    }
  }, [])

  /** Chamado pelo botão "Tentar de novo": evento, não efeito, então pode pintar o estado já. */
  const recarregar = useCallback(() => {
    const atual = ++tentativa.current
    setEstado({ status: 'carregando', tentativa: atual })
    carregarCatalogo()
      .then((catalogo) => {
        if (vivo.current) setEstado({ status: 'pronto', catalogo })
      })
      .catch((erro: unknown) => {
        setEstado({ status: 'erro', tentativa: atual, mensagem: mensagemDeErro(erro) })
      })
  }, [])

  return [estado, recarregar]
}
