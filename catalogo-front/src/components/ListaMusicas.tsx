import { memo, useMemo } from 'react'
import { ALTURA_LETRA, gruposDeLetras, letraNoTopo, montarItensDaLista } from '@/lib/alturas'
import { useListaVirtual } from '@/hooks/useListaVirtual'
import { cn } from '@/lib/utils'
import type { Musica } from '@/lib/tipos'
import { LinhaMusica, type AcoesLinha } from './LinhaMusica'

export type { AcoesLinha }

interface Props {
  musicas: Musica[]
  acoes: AcoesLinha
  /** Cabeçalhos A–Z só fazem sentido na ordenação alfabética sem busca ativa. */
  mostrarLetras: boolean
}

function ListaMusicasBase({ musicas, acoes, mostrarLetras }: Props) {
  const itens = useMemo(
    () => montarItensDaLista(musicas, { mostrarLetras }),
    [musicas, mostrarLetras],
  )
  const { containerRef, visiveis, alturaAntes, alturaDepois, alturaTotal, scrollTop } =
    useListaVirtual(itens)

  const grupos = useMemo(() => (mostrarLetras ? gruposDeLetras(itens) : []), [itens, mostrarLetras])
  const letraAtiva = useMemo(() => letraNoTopo(grupos, scrollTop), [grupos, scrollTop])

  function irParaLetra(letra: string) {
    const grupo = grupos.find((g) => g.texto === letra)
    if (!grupo) return
    // Deixa o cabeçalho encostado no topo; com sticky, ele é o rótulo da tela.
    containerRef.current?.scrollTo({ top: grupo.topo, behavior: 'smooth' })
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ol
          className="mx-auto w-full border-y border-border/60 bg-card"
          style={{ height: alturaTotal }}
        >
          {alturaAntes > 0 && <li aria-hidden style={{ height: alturaAntes }} />}
          {visiveis.map((item, i) =>
            item.tipo === 'letra' ? (
              <li
                key={`letra-${item.texto}-${i}`}
                style={{ height: ALTURA_LETRA }}
                className="sticky top-0 z-[1] flex items-center border-b border-border/60 bg-muted px-3 text-[11px] font-bold tracking-[0.18em] text-muted-foreground"
              >
                {item.texto}
              </li>
            ) : (
              <li key={item.musica.id} className="list-none">
                <LinhaMusica musica={item.musica} acoes={acoes} />
              </li>
            ),
          )}
          {alturaDepois > 0 && <li aria-hidden style={{ height: alturaDepois }} />}
        </ol>
      </div>

      {grupos.length > 3 && (
        <nav
          aria-label="Índice alfabético"
          className="pointer-events-none absolute right-1 top-0 hidden h-full w-6 flex-col items-center justify-center gap-px py-3 md:flex"
        >
          {grupos.map((grupo) => (
            <button
              key={grupo.texto}
              type="button"
              onClick={() => irParaLetra(grupo.texto)}
              aria-label={`Ir para ${grupo.texto === '#' ? 'os títulos que começam com número' : `a letra ${grupo.texto}`}`}
              aria-current={grupo.texto === letraAtiva ? 'true' : undefined}
              className={cn(
                'pointer-events-auto grid h-4 w-4 place-items-center rounded text-[10px] font-semibold tabular-nums transition-colors focus-visible:ring-1 focus-visible:ring-ring',
                grupo.texto === letraAtiva
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-primary/15 hover:text-primary',
              )}
            >
              {grupo.texto}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export const ListaMusicas = memo(ListaMusicasBase)
