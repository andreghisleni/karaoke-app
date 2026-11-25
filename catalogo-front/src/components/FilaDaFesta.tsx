import { useEffect, useRef, useState } from 'react'
import { Mic, Radio, Undo2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Pedido, StatusDaFila } from '@/lib/sala'
import { cn } from '@/lib/utils'

/**
 * A fila de verdade, a do salão — não a lista guardada no aparelho.
 *
 * Responde a única pergunta que importa para quem pediu do celular: "quando é a minha vez?".
 * Por isso o número da posição vem grande, e o resto (quem está no mic, os próximos) aparece
 * em volta como confirmação.
 *
 * Nome é a identidade. Não usamos IP porque num Wi-Fi de festa dez celulares saem pelo mesmo
 * endereço, e "a mesma pessoa" seria sorteio.
 */
interface Props {
  nome: string
  aoConfirmarNome: (nome: string) => void
  status: StatusDaFila | null
  meus: Pedido[]
  conectado: boolean
  aoCancelar: (pedido: Pedido) => void
  aoIrParaCatalogo: () => void
}

const FORMATO = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function FilaDaFesta({
  nome,
  aoConfirmarNome,
  status,
  meus,
  conectado,
  aoCancelar,
  aoIrParaCatalogo,
}: Props) {
  const [digitando, setDigitando] = useState(!nome)
  const [rascunho, setRascunho] = useState(nome)
  const campo = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setRascunho(nome)
    setDigitando(!nome)
  }, [nome])

  const confirmar = () => {
    const limpo = rascunho.replace(/\s+/g, ' ').trim().slice(0, 24)
    if (!limpo) {
      campo.current?.focus()
      return
    }
    aoConfirmarNome(limpo)
    setDigitando(false)
  }

  const primeira = meus[0]
  const tocandoAgora = status?.tocando ?? null
  const depoisDeMim = status
    ? status.fila.filter((p) => primeira ? p.posicao > primeira.posicao : true).slice(0, 4)
    : []
  const quantasAntes = primeira ? primeira.posicao - 1 : 0

  return (
    <section className="rounded-xl border border-border bg-card p-3.5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mic className="size-4 text-primary" aria-hidden />
          Fila da festa
        </h2>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
            conectado
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
          title={
            conectado
              ? 'Conectado ao servidor da sala: a posição atualiza sozinha.'
              : 'Sem conexão com o servidor da sala no momento.'
          }
        >
          <Radio className="size-3" aria-hidden />
          {conectado ? 'ao vivo' : 'reconectando'}
        </span>
      </header>

      {/* Quem está no microfone agora: é o relógio da festa */}
      <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2">
        {tocandoAgora ? (
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tocando agora {status?.quemCanta ? `· ${status.quemCanta}` : ''}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{tocandoAgora.titulo}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ninguém no microfone agora.</p>
        )}
      </div>

      {digitando ? (
        <div className="mb-3 space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="nome-festa">
            Como você quer aparecer na fila?
          </label>
          <div className="flex gap-2">
            <Input
              ref={campo}
              id="nome-festa"
              autoComplete="name"
              maxLength={24}
              onChange={(e) => setRascunho(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmar()}
              placeholder="Seu nome ou apelido"
              value={rascunho}
              className="h-11"
            />
            <Button className="h-11 shrink-0" onClick={confirmar} size="sm">
              Entrar
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Fica salvo só neste aparelho. O nome é o que separa a sua fila da fila de quem está do
            seu lado no mesmo Wi-Fi.
          </p>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Você está na fila como{' '}
            <span className="font-semibold text-foreground">{nome}</span>
          </p>
          <button
            type="button"
            onClick={() => setDigitando(true)}
            className="shrink-0 rounded-md px-1.5 py-1 text-xs text-primary underline underline-offset-2 hover:bg-primary/10"
          >
            trocar
          </button>
        </div>
      )}

      {/* A resposta grande: quantas músicas faltam para você */}
      {primeira && (
        <div className="mb-3 flex items-baseline gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <p className="text-3xl leading-none font-black tabular-nums text-primary">
            {primeira.posicao}
            <span className="ml-1 text-xs font-semibold uppercase">º</span>
          </p>
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">{primeira.titulo}</span>
            <br />
            {quantasAntes === 0
              ? 'É o próximo pedido da fila.'
              : `Tocam ${quantasAntes} ${quantasAntes === 1 ? 'música antes' : 'músicas antes'} de você.`}
            {meus.length > 1 && ` · você tem ${meus.length} na fila`}
          </p>
        </div>
      )}

      {meus.length === 0 && !digitando && (
        <div className="mb-3 rounded-lg border border-dashed border-border px-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não pediu nada.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={aoIrParaCatalogo}>
            Procurar música
          </Button>
        </div>
      )}

      {meus.length > 0 && (
        <ul className="mb-3 space-y-px overflow-hidden rounded-lg border border-border/60">
          {meus.map((p) => (
            <li
              key={p.id || p.codigo}
              className="flex items-center gap-2 bg-muted/30 px-2.5 py-2"
            >
              <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-primary">
                {p.posicao}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{p.titulo}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {p.artista}
                  {p.tier === 2 && ' · repeteco, vai para o fim'}
                </span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {FORMATO.format(new Date(p.recebidoEm))}
              </span>
              <button
                type="button"
                onClick={() => aoCancelar(p)}
                aria-label={`Cancelar ${p.titulo} da fila`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
              >
                <Undo2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {depoisDeMim.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Depois de você
          </p>
          <ul className="space-y-1">
            {depoisDeMim.map((p) => (
              <li key={p.id || `${p.codigo}-${p.posicao}`} className="flex items-center gap-2 text-xs">
                <span className="w-7 shrink-0 text-center tabular-nums text-muted-foreground">
                  {p.posicao}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{p.titulo}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  <UserRound className="size-3" aria-hidden />
                  {p.nome}
                  {p.tier === 2 && (
                    <span className="rounded border border-border px-1 text-[10px]">2ª</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {status && status.total === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          A fila da festa está vazia. Quem pedir primeiro abre o show.
        </p>
      )}
    </section>
  )
}
