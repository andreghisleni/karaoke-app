import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Skeleton com o mesmo ritmo da lista real, para não haver salto de layout. */
export function EsqueletoLista({ linhas = 9 }: { linhas?: number }) {
  return (
    <div className="border-y border-border/60 bg-card" aria-hidden>
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border/60 px-3 last:border-b-0"
          style={{ height: i % 3 === 2 ? 64 : 84 }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-2/5 rounded bg-muted/70 motion-safe:animate-pulse" />
            <div className="h-3 w-3/5 rounded bg-muted/50 motion-safe:animate-pulse" />
          </div>
          <div className="h-5 w-14 rounded bg-muted motion-safe:animate-pulse" />
          <div className="size-5 rounded bg-muted/60 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function Carregando() {
  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-muted-foreground" role="status">
        Abrindo o acervo…
      </p>
      <EsqueletoLista />
    </div>
  )
}

/**
 * Erro com estado próprio. Antes, uma falha de rede caía no "nenhuma música
 * encontrada", culpando a busca do usuário por um problema do aparelho.
 */
export function ErroCarregamento({
  mensagem,
  aoTentarDeNovo,
}: {
  mensagem: string
  aoTentarDeNovo: () => void
}) {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-border bg-card p-5 text-center">
      <AlertTriangle className="mx-auto mb-3 size-7 text-primary" aria-hidden />
      <h2 className="text-base font-semibold">O acervo não abriu</h2>
      <p className="mt-1 text-sm text-muted-foreground">{mensagem}</p>
      <p className="mt-2 text-xs text-muted-foreground/80">
        Depois da primeira visita o catálogo fica no aparelho e funciona sem
        internet. Se foi a primeira vez, é o Wi-Fi da casa.
      </p>
      <Button className="mt-4" onClick={aoTentarDeNovo}>
        <RefreshCw className="size-4" aria-hidden />
        Tentar de novo
      </Button>
    </div>
  )
}

export function SemResultado({
  busca,
  aproximada,
  sugestoes,
  aoUsarSugestao,
  aoLimpar,
}: {
  busca: string
  aproximada: boolean
  sugestoes: string[]
  aoUsarSugestao: (sugestao: string) => void
  aoLimpar: () => void
}) {
  return (
    <div className="px-4 py-12 text-center">
      <SearchX className="mx-auto mb-3 size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-base font-semibold">Nada com “{busca}”</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {aproximada
          ? 'Também não achamos nada parecido. Tente só o primeiro nome do artista ou uma palavra do verso.'
          : 'Tente uma palavra só, ou busque pelo código impresso na lista do salão.'}
      </p>

      {sugestoes.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground/80 uppercase">
            Você quis dizer
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => aoUsarSugestao(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={aoLimpar}
        className="mt-5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Limpar busca
      </button>
    </div>
  )
}
