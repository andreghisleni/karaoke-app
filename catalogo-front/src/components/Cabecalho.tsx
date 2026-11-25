import { CloudOff, ListMusic, Mic, Moon, Sun } from 'lucide-react'
import type { Aba } from '@/hooks/useBuscaComUrl'
import type { Tema } from '@/lib/tipos'
import { cn } from '@/lib/utils'

interface Props {
  aba: Aba
  aoTrocarAba: (aba: Aba) => void
  quantidadeNaFila: number
  tema: Tema
  temaResolvido: 'claro' | 'escuro'
  aoAlternarTema: () => void
  estaOffline: boolean
  temAtualizacao: boolean
  aoAtualizar: () => void
  /** Músicas na fila do salão; mostra um ponto vivo na aba mesmo sem lista local. */
  quantidadeNaFesta?: number
}

/**
 * O cabeçalho atual gastava 212 px com ícone grande + título + frase de
 * explicação, e empurrava a busca para y=284. Aqui a marca passa a ser uma
 * linha só: o subtítulo era redundante com a própria busca logo abaixo, e o
 * ícone de microfone prometia busca por voz que não existe.
 */
export function Cabecalho({
  aba,
  aoTrocarAba,
  quantidadeNaFila,
  tema,
  temaResolvido,
  aoAlternarTema,
  estaOffline,
  temAtualizacao,
  aoAtualizar,
  quantidadeNaFesta = 0,
}: Props) {
  return (
    <header className="flex items-center gap-2 px-3 py-1.5 sm:py-2 md:px-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
        <Mic className="size-4" aria-hidden />
      </span>
      <h1 className="text-[15px] leading-none font-bold tracking-tight">Karaokê</h1>

      <nav aria-label="Seções" className="ml-1 flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
        {(
          [
            { valor: 'catalogo' as Aba, rotulo: 'Catálogo', icone: Mic },
            { valor: 'fila' as Aba, rotulo: 'Minha fila', icone: ListMusic },
          ]
        ).map(({ valor, rotulo, icone: Icone }) => (
          <button
            key={valor}
            type="button"
            onClick={() => aoTrocarAba(valor)}
            aria-current={aba === valor ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors sm:h-7 sm:px-2.5 sm:text-xs',
              aba === valor
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icone className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{rotulo}</span>
            {valor === 'fila' && quantidadeNaFila > 0 && (
              <span
                className={cn(
                  'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                  aba === valor ? 'bg-primary-foreground/25' : 'bg-primary text-primary-foreground',
                )}
              >
                {quantidadeNaFila}
              </span>
            )}
            {valor === 'fila' && quantidadeNaFila === 0 && quantidadeNaFesta > 0 && (
              <span
                className="size-1.5 rounded-full bg-primary"
                title={`${quantidadeNaFesta} ${quantidadeNaFesta === 1 ? 'música' : 'músicas'} na fila da festa`}
                aria-label={`Fila da festa com ${quantidadeNaFesta} pedidos`}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        {temAtualizacao && (
          <button
            type="button"
            onClick={aoAtualizar}
            className="h-7 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground"
          >
            Atualizar
          </button>
        )}
        {estaOffline && (
          <span
            className="flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] text-muted-foreground"
            title="Sem internet: dentro da festa isso é normal — o catálogo vem do computador do karaokê, não da nuvem"
          >
            <CloudOff className="size-3" aria-hidden />
            offline
          </span>
        )}
        <button
          type="button"
          onClick={aoAlternarTema}
          aria-label={temaResolvido === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          title={tema === 'sistema' ? 'Tema automático, igual ao do aparelho' : `Tema fixado em ${tema}`}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-8"
        >
          {temaResolvido === 'escuro' ? (
            <Sun className="size-4" aria-hidden />
          ) : (
            <Moon className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </header>
  )
}
