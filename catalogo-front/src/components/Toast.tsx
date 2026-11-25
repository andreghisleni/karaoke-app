import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { ContextoToast, type MostrarAviso } from '@/hooks/useToast'

interface Aviso {
  id: number
  texto: string
}

/**
 * Feedback curto de "copiei o código" / "adicionei à fila". Em um catálogo com
 * um único botão de cópia por linha, sem confirmação o usuário repete o toque
 * sem saber se o primeiro funcionou.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const proximoId = useRef(0)

  const mostrar = useCallback<MostrarAviso>((texto) => {
    const id = ++proximoId.current
    setAvisos((atual) => [...atual.slice(-1), { id, texto }])
  }, [])

  useEffect(() => {
    if (avisos.length === 0) return
    const tempo = window.setTimeout(() => setAvisos((atual) => atual.slice(1)), 1900)
    return () => window.clearTimeout(tempo)
  }, [avisos])

  return (
    <ContextoToast.Provider value={mostrar}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        <div className="flex flex-col items-center gap-2">
          {avisos.map((aviso) => (
            <div
              key={aviso.id}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/25 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
            >
              <Check className="size-4 shrink-0" aria-hidden />
              {aviso.texto}
            </div>
          ))}
        </div>
      </div>
    </ContextoToast.Provider>
  )
}
