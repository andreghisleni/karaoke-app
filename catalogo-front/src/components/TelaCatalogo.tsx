import { useCallback, useMemo } from 'react'
import { BarraBusca } from './BarraBusca'
import { ListaMusicas, type AcoesLinha } from './ListaMusicas'
import { ErroCarregamento, EsqueletoLista, SemResultado } from './Estados'
import type { AcoesBusca, EstadoBusca } from '@/App'
import { buscar, sugerirTermos } from '@/lib/busca'
import type { Catalogo, Musica } from '@/lib/tipos'
import { termosDe } from '@/lib/texto'

interface Props {
  catalogo: Catalogo | null
  erro: string | null
  aoTentarDeNovo: () => void
  busca: EstadoBusca
  controles: AcoesBusca
  naFila: Set<string>
  aoCopiar: (musica: Musica) => void
  aoAlternarFila: (musica: Musica) => void
  recentes: string[]
  aoLimparRecentes: () => void
  /** Só existe quando o catálogo roda dentro do app do karaokê. */
  aoPedir?: (musica: Musica) => void
  /** código → posição na fila da festa, para a linha mostrar "Nº 3" no lugar do botão. */
  minhaPosicao?: Map<string, number>
  pedindoCodigo?: string | null
}
export function TelaCatalogo({
  catalogo,
  erro,
  aoTentarDeNovo,
  busca,
  controles,
  naFila,
  aoCopiar,
  aoAlternarFila,
  recentes,
  aoLimparRecentes,
  aoPedir,
  minhaPosicao,
  pedindoCodigo,
}: Props) {
  const { buscaAdiada, artista, artistaSelecionado, ordenacao } = busca

  const resultado = useMemo(
    () =>
      catalogo
        ? buscar(catalogo, buscaAdiada, { artista: artistaSelecionado, ordenacao })
        : { itens: [], total: 0, facetas: [], aproximada: false },
    [catalogo, buscaAdiada, artistaSelecionado, ordenacao],
  )

  const termos = useMemo(() => termosDe(buscaAdiada), [buscaAdiada])

  const aoFiltrarArtista = useCallback(
    (nome: string) => {
      controles.selecionarArtista(nome)
    },
    [controles],
  )

  // função estável por mapa: recriar a cada render derrubaria o memo das 11 mil linhas
  const posicaoNaFesta = useCallback(
    (id: string) => minhaPosicao?.get(id) ?? 0,
    [minhaPosicao],
  )

  const acoes: AcoesLinha = useMemo(
    () => ({
      termos,
      naFila: (id) => naFila.has(id),
      aoCopiar,
      aoAlternarFila,
      aoFiltrarArtista,
      aoPedir,
      posicaoNaFesta: minhaPosicao ? posicaoNaFesta : undefined,
      pedindoCodigo,
    }),
    [termos, naFila, aoCopiar, aoAlternarFila, aoFiltrarArtista, aoPedir, posicaoNaFesta, minhaPosicao, pedindoCodigo],
  )

  const sugestoes = useMemo(
    () => (catalogo && resultado.total === 0 ? sugerirTermos(catalogo, buscaAdiada) : []),
    [catalogo, resultado.total, buscaAdiada],
  )

  const mostrarLetras = !buscaAdiada.trim() && !artistaSelecionado && ordenacao === 'titulo'

  return (
    <>
      <BarraBusca
        busca={busca.busca}
        aoMudarBusca={controles.mudarBusca}
        aoConfirmarBusca={() => controles.registrarBusca(busca.busca)}
        aoLimpar={controles.limparBusca}
        focoRef={controles.focoBusca}
        resultado={resultado.total}
        totalAcervo={catalogo?.total ?? 0}
        aproximada={resultado.aproximada}
        ordenacao={ordenacao}
        aoMudarOrdenacao={controles.definirOrdenacao}
        artistaSelecionado={artista}
        facetas={resultado.facetas}
        topArtistas={catalogo?.topArtistas ?? []}
        aoSelecionarArtista={controles.selecionarArtista}
        recentes={recentes}
        aoUsarRecente={controles.definirBuscaDireta}
        aoLimparRecentes={aoLimparRecentes}
      />

      <main id="conteudo" className="flex min-h-0 flex-1 flex-col">
        {erro ? (
          <div className="flex-1 overflow-y-auto p-4">
            <ErroCarregamento mensagem={erro} aoTentarDeNovo={aoTentarDeNovo} />
          </div>
        ) : !catalogo ? (
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            <EsqueletoLista />
          </div>
        ) : resultado.itens.length === 0 ? (
          <div className="flex-1 overflow-y-auto">
            <SemResultado
              busca={buscaAdiada}
              aproximada={resultado.aproximada}
              sugestoes={sugestoes}
              aoUsarSugestao={controles.definirBuscaDireta}
              aoLimpar={controles.limparBusca}
            />
          </div>
        ) : (
          <ListaMusicas musicas={resultado.itens} acoes={acoes} mostrarLetras={mostrarLetras} />
        )}
      </main>
    </>
  )
}
