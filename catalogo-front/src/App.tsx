import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Cabecalho } from './components/Cabecalho'
import { TelaCatalogo } from './components/TelaCatalogo'
import { TelaFila } from './components/TelaFila'
import { FilaDaFesta } from './components/FilaDaFesta'
import { PedirNome } from './components/PedirNome'
import { useToast } from './hooks/useToast'
import { useArmazenamentoLocal } from './hooks/useArmazenamentoLocal'
import { useFilaDaFesta } from './hooks/useFilaDaFesta'
import { useAtualizacaoServiceWorker, useRede, useTema } from './hooks/useAmbiente'
import { useBuscaComUrl, type Aba } from './hooks/useBuscaComUrl'
import { useCatalogo } from './hooks/useCatalogo'
import { copiar } from './lib/area'
import { lerNome, salvarNome } from './lib/sala'
import type { Pedido } from './lib/sala'
import type { Catalogo, Musica, Ordenacao } from './lib/tipos'

export interface EstadoBusca {
  busca: string
  buscaAdiada: string
  artista: string | null
  artistaSelecionado: string | null
  ordenacao: Ordenacao
}

export interface AcoesBusca {
  mudarBusca: (valor: string) => void
  definirBuscaDireta: (valor: string) => void
  limparBusca: () => void
  selecionarArtista: (nome: string | null) => void
  definirOrdenacao: (valor: Ordenacao) => void
  registrarBusca: (valor: string) => void
  focoBusca: RefObject<HTMLInputElement | null>
}

/**
 * Casca do app. Layout em coluna com altura fixa (100dvh): cabeçalho de 1 linha,
 * busca, e a lista rolável ocupando o resto. Na versão anterior eram 212 px de
 * cabeçalho + subtítulo antes do primeiro card; sobra agora o dobro de música
 * na tela, e a busca fica sempre ao alcance sem depender de sticky translúcido.
 *
 * Tudo aqui é destruturado de propósito: `local` e `url` são objetos novos a
 * cada render, e colocá-los nas dependências recriaria as ações a cada tecla,
 * derrubando o memo das 14 mil linhas virtuais.
 */
export function App() {
  const mostrarAviso = useToast()

  const {
    fila,
    naFila,
    recentes,
    preferencias,
    alternarNaFila,
    removerDaFila,
    limparFila,
    definirFila,
    moverNaFila,
    definirPreferencia,
    registrarBusca,
    limparRecentes,
  } = useArmazenamentoLocal()

  const {
    busca: termoBusca,
    buscaAdiada,
    artista,
    artistaSelecionado,
    ordenacao,
    aba,
    mudarBusca,
    definirBusca,
    setArtista,
    setOrdenacao,
    irParaAba,
  } = useBuscaComUrl(preferencias.ordenacao)

  const [estadoCatalogo, recarregar] = useCatalogo()
  const temaResolvido = useTema(preferencias.tema)
  const { offline } = useRede()
  const { temAtualizacao, aplicarAtualizacao } = useAtualizacaoServiceWorker()

  // --- fila da festa ---
  // O nome é a identidade do pedido (nunca o IP: num Wi-Fi de festa dez celulares saem pelo mesmo
  // endereço) e mora no localStorage deste aparelho, a mesma chave usada pela tela de reserva em
  // arquivo único, para ninguém digitar duas vezes.
  const [nome, setNome] = useState(() => lerNome())
  const [pedindoCodigo, setPedindoCodigo] = useState<string | null>(null)
  /** Música que a pessoa quis pedir antes de ter nome salvo: o campo abre e o pedido continua. */
  const [aguardandoNome, setAguardandoNome] = useState<Musica | null>(null)
  const festa = useFilaDaFesta(nome)

  const minhaPosicao = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of festa.meus) mapa.set(p.codigo, p.posicao)
    return mapa
  }, [festa.meus])

  const dispararPedido = useCallback(
    async (musica: Musica, quem: string) => {
      setPedindoCodigo(musica.id)
      try {
        const r = await festa.pedir(musica.id, quem)
        mostrarAviso(
          r.aceito
            ? `“${musica.titulo}” na fila · você é o Nº ${r.posicao}`
            : r.mensagem || 'Não deu para pedir agora.',
        )
      } catch {
        mostrarAviso('O servidor da sala não respondeu. Tente de novo.')
      } finally {
        setPedindoCodigo(null)
      }
    },
    [festa, mostrarAviso],
  )

  const aoPedir = useCallback(
    (musica: Musica) => {
      if (!nome) {
        setAguardandoNome(musica)
        return
      }
      void dispararPedido(musica, nome)
    },
    [nome, dispararPedido],
  )

  const aoConfirmarNome = useCallback(
    (valor: string) => {
      const limpo = valor.replace(/\s+/g, ' ').trim().slice(0, 24)
      if (!limpo) return
      salvarNome(limpo)
      setNome(limpo)
      if (aguardandoNome) {
        const musica = aguardandoNome
        setAguardandoNome(null)
        void dispararPedido(musica, limpo)
      }
    },
    [aguardandoNome, dispararPedido],
  )

  const aoCancelarPedido = useCallback(
    async (pedido: Pedido) => {
      try {
        const r = await festa.cancelar(pedido.codigo, nome)
        mostrarAviso(r.aceito ? `“${pedido.titulo}” saiu da fila` : r.mensagem)
      } catch {
        mostrarAviso('O servidor da sala não respondeu.')
      }
    },
    [festa, nome, mostrarAviso],
  )

  const focoBusca = useRef<HTMLInputElement | null>(null)

  const catalogo: Catalogo | null =
    estadoCatalogo.status === 'pronto' ? estadoCatalogo.catalogo : null
  const erro = estadoCatalogo.status === 'erro' ? estadoCatalogo.mensagem : null

  const busca: EstadoBusca = useMemo(
    () => ({
      busca: termoBusca,
      buscaAdiada,
      artista,
      artistaSelecionado,
      ordenacao,
    }),
    [termoBusca, buscaAdiada, artista, artistaSelecionado, ordenacao],
  )

  const definirOrdenacao = useCallback(
    (valor: Ordenacao) => {
      setOrdenacao(valor)
      definirPreferencia('ordenacao', valor)
    },
    [setOrdenacao, definirPreferencia],
  )

  const limparBusca = useCallback(() => {
    definirBusca('')
    focoBusca.current?.focus()
  }, [definirBusca])

  /** Chip, sugestão e "recentes": aplica já e registra a intenção na história. */
  const definirBuscaRegistrada = useCallback(
    (valor: string) => {
      definirBusca(valor)
      registrarBusca(valor)
    },
    [definirBusca, registrarBusca],
  )

  const controles: AcoesBusca = useMemo(
    () => ({
      mudarBusca,
      definirBuscaDireta: definirBuscaRegistrada,
      limparBusca,
      selecionarArtista: setArtista,
      definirOrdenacao,
      registrarBusca,
      focoBusca,
    }),
    [mudarBusca, definirBuscaRegistrada, limparBusca, setArtista, definirOrdenacao, registrarBusca],
  )

  const aoCopiar = useCallback(
    async (musica: Musica) => {
      const ok = await copiar(musica.id)
      mostrarAviso(ok ? `Código ${musica.id} copiado` : `Anote o código ${musica.id}`)
    },
    [mostrarAviso],
  )

  const aoAlternarFila = useCallback(
    (musica: Musica) => {
      // Consulta antes de alterar: o updater do estado precisa permanecer puro.
      const iaSair = naFila.has(musica.id)
      alternarNaFila(musica.id)
      mostrarAviso(iaSair ? 'Fora da sua fila' : `${musica.titulo} na sua fila`)
    },
    [naFila, alternarNaFila, mostrarAviso],
  )

  const aoTrocarAba = useCallback((nova: Aba) => irParaAba(nova), [irParaAba])

  const aoIrParaCatalogo = useCallback(() => irParaAba('catalogo'), [irParaAba])

  /** "/" foca a busca; Esc limpa. Em um catálogo gigante é o atalho mais usado. */
  useEffect(() => {
    const aoDigitar = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null
      const digitando =
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLTextAreaElement ||
        alvo?.isContentEditable

      if (evento.key === '/' && !digitando) {
        evento.preventDefault()
        irParaAba('catalogo')
        focoBusca.current?.focus()
      } else if (evento.key === 'Escape' && document.activeElement === focoBusca.current) {
        if (termoBusca) limparBusca()
        else focoBusca.current?.blur()
      }
    }
    window.addEventListener('keydown', aoDigitar)
    return () => window.removeEventListener('keydown', aoDigitar)
  }, [limparBusca, irParaAba, termoBusca])

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Pular para a lista
      </a>

      <Cabecalho
        aba={aba}
        aoTrocarAba={aoTrocarAba}
        quantidadeNaFila={fila.length}
        tema={preferencias.tema}
        temaResolvido={temaResolvido}
        aoAlternarTema={() =>
          definirPreferencia('tema', temaResolvido === 'escuro' ? 'claro' : 'escuro')
        }
        estaOffline={offline}
        temAtualizacao={temAtualizacao}
        aoAtualizar={aplicarAtualizacao}
        quantidadeNaFesta={festa.status?.total ?? 0}
      />

      {aba === 'catalogo' ? (
        <TelaCatalogo
          catalogo={catalogo}
          erro={erro}
          aoTentarDeNovo={recarregar}
          busca={busca}
          controles={controles}
          naFila={naFila}
          aoCopiar={aoCopiar}
          aoAlternarFila={aoAlternarFila}
          recentes={recentes}
          aoLimparRecentes={limparRecentes}
          aoPedir={aoPedir}
          minhaPosicao={minhaPosicao}
          pedindoCodigo={pedindoCodigo}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-3 pt-3 md:px-4">
            <FilaDaFesta
              nome={nome}
              aoConfirmarNome={aoConfirmarNome}
              status={festa.status}
              meus={festa.meus}
              conectado={festa.conectado}
              aoCancelar={aoCancelarPedido}
              aoIrParaCatalogo={aoIrParaCatalogo}
            />
          </div>
          <TelaFila
            catalogo={catalogo}
            fila={fila}
            aoRemover={removerDaFila}
            aoMover={moverNaFila}
            aoLimpar={limparFila}
            aoDefinirFila={definirFila}
            aoCopiar={aoCopiar}
            aoIrParaCatalogo={aoIrParaCatalogo}
            mostrarAviso={mostrarAviso}
          />
        </div>
      )}

      {aguardandoNome && (
        <PedirNome
          musica={aguardandoNome}
          onConfirmar={aoConfirmarNome}
          onCancelar={() => setAguardandoNome(null)}
        />
      )}
    </div>
  )
}
