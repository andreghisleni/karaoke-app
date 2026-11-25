import { memo } from 'react'
import { Copy, Mic, Star } from 'lucide-react'
import { Destaque } from './Destaque'
import { alturaDaMusica } from '@/lib/alturas'
import type { Musica } from '@/lib/tipos'
import { cn } from '@/lib/utils'

export interface AcoesLinha {
  termos: string[]
  naFila: (id: string) => boolean
  aoCopiar: (musica: Musica) => void
  aoAlternarFila: (musica: Musica) => void
  aoFiltrarArtista: (artista: string) => void
  /**
   * Presente só quando o catálogo é servido pelo app do karaokê (tem fila de verdade).
   * No site sozinho o botão não aparece: não há para onde mandar o pedido.
   */
  aoPedir?: (musica: Musica) => void
  /** Posição do pedido na fila da festa, quando esta música já foi pedida por esta pessoa. */
  posicaoNaFesta?: (id: string) => number
  /** Código do pedido em trânsito, para a linha não deixar tocar duas vezes. */
  pedindoCodigo?: string | null
}

/**
 * Texto à esquerda: título, artista (que filtra) e o primeiro verso.
 * Reaproveitado na tela "Minha fila" para as duas telas não divergirem.
 */
export function InfoMusica({
  musica,
  termos,
  aoFiltrarArtista,
}: {
  musica: Musica
  termos: string[]
  aoFiltrarArtista?: (artista: string) => void
}) {
  const artista = (
    <Destaque texto={musica.artista} termos={termos} />
  )

  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] leading-tight font-semibold text-foreground">
        <Destaque texto={musica.titulo} termos={termos} />
        {musica.duplicada && (
          <span
            className="ml-2 align-middle rounded border border-border px-1 py-px text-[10px] font-medium text-muted-foreground"
            title="Existe outra gravação desta música no acervo"
          >
            2ª versão
          </span>
        )}
      </p>

      <p className="truncate text-xs leading-snug text-muted-foreground">
        {aoFiltrarArtista && musica.artista ? (
          <button
            type="button"
            onClick={() => aoFiltrarArtista(musica.artista)}
            /* py-1/px-1.5: sem padding o alvo tinha 17 px de altura — abaixo dos
               24 px mínimos de WCAG 2.2. O padding entra na linha, e a altura da
               linha (64/84 px) já comporta isso. */
            className="mt-px -ml-1.5 rounded-md px-1.5 py-1 underline-offset-2 transition-colors hover:bg-muted hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            title={`Ver tudo de ${musica.artista}`}
            aria-label={`Ver todos os títulos de ${musica.artista}`}
          >
            {artista}
          </button>
        ) : (
          artista
        )}
      </p>

      {musica.trecho ? (
        <p className="truncate text-xs leading-snug text-muted-foreground/70 italic">
          “<Destaque texto={musica.trecho} termos={termos} />”
        </p>
      ) : null}
    </div>
  )
}

/**
 * Linha de resultado.
 *
 * Densidade é decisão de projeto: 64/84 px por item em vez dos cards de ~200 px
 * da versão atual, porque achar música em catálogo é varredura — e varredura
 * precisa de ritmo. São 7 linhas por tela num celular de 390×844 contra 2.
 *
 * Alturas vêm de `alturaDaMusica`, o mesmo número que a virtualização soma, para
 * o scroll nunca desandar. Nomes já chegam prontos do build, então não existe
 * `capitalize` aqui (era o que gerava "Paralamas Do Sucesso").
 */
function LinhaMusicaBase({ musica, acoes }: { musica: Musica; acoes: AcoesLinha }) {
  const salva = acoes.naFila(musica.id)
  const posicao = acoes.posicaoNaFesta?.(musica.id) ?? 0
  const pedindo = acoes.pedindoCodigo === musica.id

  return (
    <div
      style={{ height: alturaDaMusica(musica) }}
      className="group flex items-center gap-2 border-b border-border/60 px-2.5 last:border-b-0 hover:bg-muted/40 md:gap-3 md:px-4"
    >
      <InfoMusica musica={musica} termos={acoes.termos} aoFiltrarArtista={acoes.aoFiltrarArtista} />

      {acoes.aoPedir &&
        (posicao > 0 ? (
          <span
            className="shrink-0 rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-bold tabular-nums text-primary"
            title="Esta música já está na fila da festa"
          >
            Nº {posicao}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => acoes.aoPedir?.(musica)}
            disabled={pedindo}
            aria-label={`Pedir ${musica.titulo}, de ${musica.artista}, na fila da festa`}
            className={cn(
              'flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]',
              'disabled:opacity-60',
            )}
          >
            <Mic className="size-3.5" aria-hidden />
            {pedindo ? '…' : 'Pedir'}
          </button>
        ))}

      <button
        type="button"
        onClick={() => acoes.aoCopiar(musica)}
        aria-label={`Copiar código ${musica.id} de ${musica.titulo}, ${musica.artista}`}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
      >
        <Copy
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          aria-hidden
        />
        <span className="text-lg leading-none font-black tracking-wide tabular-nums">
          {musica.id}
        </span>
      </button>

      <button
        type="button"
        onClick={() => acoes.aoAlternarFila(musica)}
        aria-pressed={salva}
        aria-label={
          salva
            ? `Remover ${musica.titulo} da minha fila`
            : `Adicionar ${musica.titulo} à minha fila`
        }
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg transition-colors',
          'hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring active:scale-95',
          salva ? 'text-primary' : 'text-muted-foreground/50',
        )}
      >
        <Star className={cn('size-[18px]', salva && 'fill-current')} aria-hidden />
      </button>
    </div>
  )
}

export const LinhaMusica = memo(LinhaMusicaBase)
