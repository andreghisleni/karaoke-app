import { createContext, useContext } from 'react'

export type MostrarAviso = (texto: string) => void

/**
 * O contexto mora em um arquivo próprio porque o provedor/visualização é um
 * componente: misturar os dois no mesmo módulo quebra o fast refresh do Vite.
 */
export const ContextoToast = createContext<MostrarAviso | null>(null)

export function useToast(): MostrarAviso {
  const contexto = useContext(ContextoToast)
  if (!contexto) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return contexto
}
