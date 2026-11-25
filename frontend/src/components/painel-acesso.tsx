/**
 * Porta de entrada do painel administrativo.
 *
 * O caminho normal é o link que sai no console (ou no QR do celular) já com `?token=`: nesse caso
 * nada aqui aparece. Esta tela é o plano B — alguém abriu `/dashboard` limpo, o token foi girado,
 * ou o localStorage foi limpo junto com o histórico.
 *
 * Antes de mostrar o formulário checamos `/api/painel/info`: se o token salvo ainda vale, o
 * painel abre direto sem pedir nada.
 */
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EVENTO_SEM_TOKEN,
  capturarTokenDaUrl,
  lerToken,
  salvarToken,
} from '@/lib/painel-token'

type Estado = 'checando' | 'livre' | 'negado'

export function PainelGuard({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() =>
    capturarTokenDaUrl() ? 'checando' : 'negado',
  )
  const [erro, setErro] = useState('')

  // 401 em qualquer chamada de API derruba o acesso, sem recarregar a página
  useEffect(() => {
    const caiu = () => setEstado((atual) => (atual === 'negado' ? atual : 'negado'))
    window.addEventListener(EVENTO_SEM_TOKEN, caiu)
    return () => window.removeEventListener(EVENTO_SEM_TOKEN, caiu)
  }, [])

  useEffect(() => {
    if (estado !== 'checando') return
    let vivo = true
    fetch('/api/painel/info')
      .then((res) => {
        if (!vivo) return
        // 404 = servidor antigo, sem a rota de token: não travamos o painel dele
        setEstado(res.status === 401 ? 'negado' : 'livre')
      })
      .catch(() => vivo && setEstado('livre')) // servidor mudo não pode trancar o operador
    return () => {
      vivo = false
    }
  }, [estado])

  if (estado === 'negado') {
    return (
      <TelaDeAcesso
        erro={erro}
        onLiberado={(token) => {
          salvarToken(token)
          setErro('')
          setEstado('checando')
        }}
      />
    )
  }

  if (estado === 'checando') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Conferindo o acesso…</p>
      </div>
    )
  }

  return <>{children}</>
}

export function TelaDeAcesso({
  erro,
  onLiberado,
}: {
  erro: string
  onLiberado: (token: string) => void
}) {
  const [token, setToken] = useState(lerToken())
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(erro)

  const enviar = useCallback(
    async (valor: string) => {
      const limpo = valor.trim().toUpperCase().replace(/[\s-]/g, '')
      if (!limpo) {
        setAviso('Digite o token que apareceu no console.')
        return
      }
      setEnviando(true)
      setAviso('')
      try {
        const res = await fetch('/api/painel/acesso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: limpo }),
        })
        const corpo = await res.json().catch(() => ({}))
        if (res.ok && corpo.ok) {
          onLiberado(limpo)
        } else {
          setAviso(corpo.mensagem ?? 'Token não confere com o do console.')
        }
      } catch {
        setAviso('Não consegui falar com o servidor do karaokê.')
      } finally {
        setEnviando(false)
      }
    },
    [onLiberado],
  )

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Acesso do operador</CardTitle>
          <CardDescription>
            O painel mexe na configuração e na fila da festa, então pede o token que saiu no
            console da máquina do karaokê. O catálogo dos convidados não pede nada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              enviar(token)
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="token-painel">Token do painel</Label>
              <Input
                id="token-painel"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                className="font-mono text-lg tracking-[0.3em] uppercase"
                maxLength={32}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="EX.: K7P2M9Q4"
                value={token}
              />
            </div>
            {aviso && <p className="text-destructive text-sm">{aviso}</p>}
            <Button className="w-full" disabled={enviando} type="submit">
              {enviando ? 'Confirmando…' : 'Entrar no painel'}
            </Button>
          </form>
          <p className="text-muted-foreground text-xs">
            O token fica salvo neste navegador. Se você girar o token nas Configurações, esta tela
            volta a pedir o valor novo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
