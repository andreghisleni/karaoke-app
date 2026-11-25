import { type FormEvent, type RefObject, memo } from 'react'
import { Search, X } from 'lucide-react'
import type { FacetaArtista, Ordenacao } from '@/lib/tipos'
import { numeroLocale } from '@/lib/texto'
import { cn } from '@/lib/utils'

interface Props {
  busca: string
  aoMudarBusca: (valor: string) => void
  aoLimpar: () => void
  /** Enter: grava o termo em "buscas recentes" (só então sabemos a intenção). */
  aoConfirmarBusca: () => void
  focoRef: RefObject<HTMLInputElement | null>

  /** Total de correspondências da busca atual (não o recorte exibido). */
  resultado: number
  totalAcervo: number
  aproximada: boolean

  ordenacao: Ordenacao
  aoMudarOrdenacao: (valor: Ordenacao) => void

  artistaSelecionado: string | null
  facetas: FacetaArtista[]
  topArtistas: FacetaArtista[]
  aoSelecionarArtista: (nome: string | null) => void

  recentes: string[]
  aoUsarRecente: (termo: string) => void
  aoLimparRecentes: () => void
}

const ROTULOS_ORDEM: Record<Ordenacao, string> = {
  titulo: 'A–Z',
  artista: 'Por artista',
  codigo: 'Por código',
}

function Chip({
  rotulo,
  quantidade,
  ativo,
  onClick,
  rotuloAcessivel,
}: {
  rotulo: string
  quantidade?: number
  ativo: boolean
  onClick: () => void
  /** O texto do chip é só o nome; a intenção ("ver todos", "limpar filtro") precisa ser dita. */
  rotuloAcessivel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={
        rotuloAcessivel ??
        (quantidade !== undefined ? `Ver os ${quantidade} títulos de ${rotulo}` : undefined)
      }
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors sm:h-8',
        ativo
          ? 'border-primary bg-primary/10 font-semibold text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground',
      )}
    >
      <span className="max-w-[16ch] truncate">{rotulo}</span>
      {quantidade !== undefined && (
        <span className={cn('tabular-nums', ativo ? 'text-primary/80' : 'text-muted-foreground/70')}>
          {quantidade}
        </span>
      )}
    </button>
  )
}

function BarraBuscaBase(props: Props) {
  const {
    busca,
    aoMudarBusca,
    aoLimpar,
    aoConfirmarBusca,
    focoRef,
    resultado,
    totalAcervo,
    aproximada,
    ordenacao,
    aoMudarOrdenacao,
    artistaSelecionado,
    facetas,
    topArtistas,
    aoSelecionarArtista,
    recentes,
    aoUsarRecente,
    aoLimparRecentes,
  } = props

  function enviar(evento: FormEvent) {
    // Sem servidor: Enter só garante que o termo está aplicado e registrado.
    evento.preventDefault()
    aoConfirmarBusca()
    focoRef.current?.blur()
  }

  const buscando = busca.trim().length > 0
  const chipsArtista = buscando || artistaSelecionado ? facetas : []
  const mostrandoDicas = !buscando && !artistaSelecionado

  return (
    <div className="border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <form role="search" onSubmit={enviar} className="flex items-center gap-2 px-3 pt-2.5 md:px-4">
        <label htmlFor="busca" className="sr-only">
          Buscar música por artista, título, trecho da letra ou código
        </label>
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <input
            id="busca"
            ref={focoRef}
            type="search"
            value={busca}
            onChange={(e) => aoMudarBusca(e.target.value)}
            placeholder="Artista, título, verso ou código…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
            className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-16 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {busca ? (
            <button
              type="button"
              onClick={aoLimpar}
              aria-label="Limpar busca"
              className="absolute right-2 grid size-7 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2.5 hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 md:block"
            >
              /
            </kbd>
          )}
        </div>
      </form>

      {/* Estado da busca em texto: é o que faltava para saber se a lista cortou. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 md:px-4" aria-live="polite">
        <p className="text-xs text-muted-foreground">
          {buscando || artistaSelecionado ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {numeroLocale(resultado)}
              </span>{' '}
              {resultado === 1 ? 'música' : 'músicas'}
              {aproximada ? (resultado === 1 ? ' parecida' : ' parecidas') : ''}
              <span className="text-muted-foreground/70"> de {numeroLocale(totalAcervo)}</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground tabular-nums">
                {numeroLocale(totalAcervo)}
              </span>{' '}
              músicas no acervo
            </>
          )}
          {artistaSelecionado && (
            <>
              {' · '}
              <span className="text-foreground">{artistaSelecionado}</span>
            </>
          )}
        </p>

        <div
          className="ml-auto flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
          role="group"
          aria-label="Ordenar o acervo"
        >
          {(Object.keys(ROTULOS_ORDEM) as Ordenacao[]).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => aoMudarOrdenacao(valor)}
              aria-pressed={ordenacao === valor}
              className={cn(
                /* h-9 (36 px) no celular: esses três são o controle mais tocado da tela e, com
                   h-8, o dedo do meio da lista acertava o vizinho. No desktop segue discreto. */
                'flex h-9 items-center rounded-full px-3 text-[12px] transition-colors whitespace-nowrap sm:h-7 sm:px-2 sm:text-[11px]',
                ordenacao === valor
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {ROTULOS_ORDEM[valor]}
            </button>
          ))}
        </div>
      </div>

      {/* Facetas: navegar sem digitar é a porta de quem não sabe o nome. */}
      {(chipsArtista.length > 1 || mostrandoDicas || artistaSelecionado) && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pt-2 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-4">
          {artistaSelecionado && (
            <Chip
              rotulo={`✕ ${artistaSelecionado}`}
              ativo
              rotuloAcessivel={`Remover o filtro por ${artistaSelecionado}`}
              onClick={() => aoSelecionarArtista(null)}
            />
          )}
          {mostrandoDicas ? (
            <>
              {recentes.length > 0 && (
                <>
                  <span className="flex h-9 shrink-0 items-center text-[10px] sm:h-8 font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase">
                    Recentes
                  </span>
                  {recentes.slice(0, 4).map((termo) => (
                    <Chip
                      key={termo}
                      rotulo={termo}
                      ativo={false}
                      rotuloAcessivel={`Buscar de novo por ${termo}`}
                      onClick={() => aoUsarRecente(termo)}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={aoLimparRecentes}
                    className="h-9 shrink-0 px-1.5 text-[11px] sm:h-8 text-muted-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                  >
                    limpar
                  </button>
                </>
              )}
              <span className="flex h-9 shrink-0 items-center text-[10px] sm:h-8 font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase">
                Mais pedidos
              </span>
              {topArtistas.slice(0, 10).map((f) => (
                <Chip
                  key={f.nome}
                  rotulo={f.nome}
                  quantidade={f.quantidade}
                  ativo={artistaSelecionado === f.nome}
                  onClick={() => aoSelecionarArtista(f.nome)}
                />
              ))}
            </>
          ) : (
            chipsArtista.map((f) => (
              <Chip
                key={f.nome}
                rotulo={f.nome}
                quantidade={f.quantidade}
                ativo={artistaSelecionado === f.nome}
                onClick={() => aoSelecionarArtista(f.nome)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export const BarraBusca = memo(BarraBuscaBase)
