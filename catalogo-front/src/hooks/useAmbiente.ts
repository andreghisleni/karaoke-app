import { useCallback, useEffect, useState } from 'react'
import type { Tema } from '@/lib/tipos'

/** Resolve 'sistema' contra prefers-color-scheme e aplica a classe no <html>. */
export function useTema(tema: Tema) {
  const [resolvido, setResolvido] = useState<'claro' | 'escuro'>('escuro')

  useEffect(() => {
    const midia = window.matchMedia('(prefers-color-scheme: light)')
    const aplicar = () => {
      const claro = tema === 'claro' || (tema === 'sistema' && midia.matches)
      setResolvido(claro ? 'claro' : 'escuro')
      const raiz = document.documentElement
      raiz.classList.toggle('dark', !claro)
      raiz.style.colorScheme = claro ? 'light' : 'dark'
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', claro ? '#fafafd' : '#0e0d15')
    }
    aplicar()
    if (tema === 'sistema') {
      midia.addEventListener('change', aplicar)
      return () => midia.removeEventListener('change', aplicar)
    }
  }, [tema])

  return resolvido
}

/**
 * O Wi-Fi de salão cai o tempo todo. Avisar que está offline (e que o catálogo
 * continua funcionando) evita o pânico de "quebrou".
 */
export function useRede() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const irParaCima = () => setOnline(true)
    const irParaBaixo = () => setOnline(false)
    window.addEventListener('online', irParaCima)
    window.addEventListener('offline', irParaBaixo)
    return () => {
      window.removeEventListener('online', irParaCima)
      window.removeEventListener('offline', irParaBaixo)
    }
  }, [])
  return { online, offline: !online }
}

/**
 * Service worker é o que faz o site funcionar sem internet sem precisar de
 * "instalar" nada: é cache, não app. Por isso não há manifest nem prompt de
 * instalação — só uma chamada discreta para aplicar uma versão nova.
 */
export function useAtualizacaoServiceWorker() {
  const [pendente, setPendente] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
    if (!/^https?:$/.test(location.protocol)) return

    const aoCarregar = async () => {
      try {
        const registro = await navigator.serviceWorker.register('./sw.js', { scope: './' })
        if (registro.waiting) setPendente(registro.waiting)
        registro.addEventListener('updatefound', () => {
          const novo = registro.installing
          if (!novo) return
          novo.addEventListener('statechange', () => {
            // 'installed' com controller já ativo = versão nova esperando
            if (novo.state === 'installed' && navigator.serviceWorker.controller) {
              setPendente(novo)
            }
          })
        })
      } catch {
        /* offline é melhoria, não requisito do app */
      }
    }

    // React pode montar depois do evento 'load' (chunk de dados grande, ou
    // recarga com cache): nesse caso o listener nunca dispararia.
    if (document.readyState === 'complete') void aoCarregar()
    else {
      window.addEventListener('load', aoCarregar, { once: true })
      return () => window.removeEventListener('load', aoCarregar)
    }
  }, [])

  const aplicar = useCallback(() => {
    pendente?.postMessage({ tipo: 'pular-espera' })
  }, [pendente])

  return { temAtualizacao: Boolean(pendente), aplicarAtualizacao: aplicar }
}
