/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <explanation> */
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export const Route = createFileRoute('/_app/dashboard')({
  component: KaraokeDashboard,
});

// 1. Atualizamos a Tipagem para receber os novos dados
type Musica = {
  id: string;
  codigo: string;
  titulo: string;
  artista: string;
  inicio: string;
};

/**
 * A fila que chega do `/ws` é a lista de pedidos do Java (`Pedido`), não a de `Musica`: além de
 * título/artista/código vem `nome` (quem pediu), `tier` (1 = primeira da pessoa, 2 = repeteco no
 * fim da fila) e `posicao`. Os campos antigos continuam os mesmos, então nada aqui quebra.
 */
type ItemDaFila = Musica & {
  nome?: string | null;
  tier?: number;
  posicao?: number;
};

type AnuncioDaTv = {
  nome: string;
  titulo: string;
  artista?: string;
  codigo?: string;
};

type PlayerStatus = {
  estado: 'PARADO' | 'TOCANDO' | 'PONTUACAO' | 'ANUNCIO';
  musicaAtual: Musica | null;
  pontuacao: number;
  fila: ItemDaFila[];
  /** Quem está no microfone agora. */
  quemCanta?: string | null;
  /** O "O próximo a brilhar vai ser…" que a TV está mostrando neste instante. */
  anuncio?: AnuncioDaTv | null;
  /** Fila pausada entre músicas pelo botão abaixo. */
  pausado?: boolean;
};

/**
 * Nome de quem pediu, quando não foi o operador.
 *
 * O Java grava "Operador" nos pedidos que saem desta tela (`FilaService.pedirPeloPainel`), e
 * repetir isso em cada linha só polui: quem olha a fila quer saber das pessoas do salão.
 */
function quemPediu(nome?: string | null): string | null {
  const limpo = (nome ?? '').trim();
  if (!limpo) return null;
  if (limpo.toLowerCase() === 'operador') return null;
  return limpo.length > 42 ? `${limpo.slice(0, 41)}…` : limpo;
}

export default function KaraokeDashboard() {
  const [busca, setBusca] = useState('');
  const [catalogo, setCatalogo] = useState<Musica[]>([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>({
    estado: 'PARADO',
    musicaAtual: null,
    pontuacao: 0,
    fila: [],
  });

  // 2. O Fetch agora suporta paginação e lê a propriedade "data" do JSON
  const carregarCatalogo = async (query = '', page = 1) => {
    try {
      const res = await fetch(
        `/api/musicas?q=${encodeURIComponent(query)}&page=${page}&limit=50`
      );
      if (res.ok) {
        const json = await res.json();

        // Se for a página 1 (nova pesquisa), substitui a lista. Senão, anexa ao final.
        if (page === 1) {
          setCatalogo(json.data);
        } else {
          setCatalogo((prev) => [...prev, ...json.data]);
        }

        // Verifica se ainda há mais páginas para mostrar o botão "Carregar Mais"
        setTemMais(json.paginaAtual < json.totalPaginas);
      }
    } catch (error) {
      console.error('Erro ao buscar catálogo', error);
    }
  };

  // Efeito para buscar ao digitar (sempre reseta para a página 1 ao pesquisar)
  useEffect(() => {
    setPagina(1);
    const timeout = setTimeout(() => carregarCatalogo(busca, 1), 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  useEffect(() => {
    const wsUrl =
      import.meta.env.MODE === 'development'
        ? 'ws://localhost:7000/ws'
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let unmounted = false;

    const connect = () => {
      if (unmounted) {
        return;
      }

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Conectado ao Servidor do Karaokê');
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        if (event.data === 'ping') {
          return;
        }
        const data = JSON.parse(event.data);
        setStatus(data);
      };

      ws.onclose = () => {
        if (unmounted) {
          return;
        }
        console.log('Desconectado do servidor. Reconectando...');
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
        reconnectAttempts += 1;
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error('Erro no WebSocket:', err);
        ws?.close();
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimeout){ clearTimeout(reconnectTimeout);}
      ws?.close();
    };
  }, []);

  const adicionarFila = async (musicaId: string) => {
    try {
      const res = await fetch('/api/player/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicaId }),
      });
      if (res.ok) {
        toast.success('Música adicionada à fila!');
      } else {
        // O botão era mudo: 409 (cota da fila) e 404 (ID velho) passavam sem nenhum aviso.
        // O servidor já devolve a frase certa em português no corpo da resposta.
        const motivo = await res.text().catch(() => '');
        toast.error(motivo || 'Erro ao adicionar música.');
      }
    } catch {
      toast.error('Erro ao adicionar música.');
    }
  };

  const pularMusica = async () => {
    if (status.estado === 'ANUNCIO') {
      // A pessoa já foi chamada na TV e já saiu da fila: pular agora deixaria um vazio no ar.
      toast.info('Essa pessoa já foi chamada na TV; o vídeo larga daqui a pouco.');
      return;
    }
    try {
      await fetch('/api/player/next', { method: 'POST' });
      toast.info('Pulando para a próxima...');
    } catch {
      toast.error('Erro ao pular música.');
    }
  };

  /** Pausa ENTRE músicas: o que está no ar termina, a próxima espera, a TV volta para os QRs. */
  const alternarPausa = async () => {
    try {
      const res = await fetch('/api/player/pausa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = (await res.json().catch(() => ({}))) as {
        pausado?: boolean;
        mensagem?: string;
      };
      if (res.ok && typeof json.pausado === 'boolean') {
        // O broadcast chega em seguida, mas o botão responde na hora (no celular isso importa).
        setStatus((atual) => ({ ...atual, pausado: json.pausado }));
        if (json.pausado) toast.info('Fila pausada: a TV voltou para os QR codes.');
        else toast.success(json.mensagem || 'Fila retomada.');
      } else {
        toast.error(json.mensagem || 'Erro ao pausar a fila.');
      }
    } catch {
      toast.error('Erro de ligação com o servidor.');
    }
  };

  const carregarMais = () => {
    const proximaPagina = pagina + 1;
    setPagina(proximaPagina);
    carregarCatalogo(busca, proximaPagina);
  };

  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LADO ESQUERDO: Catálogo */}
        <Card className="flex h-[85vh] flex-col">
          <CardHeader>
            <CardTitle>Escolha sua Música</CardTitle>
            <Input
              className="mt-2"
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, artista, música ou trecho..."
              value={busca}
              enterKeyHint="search"
              inputMode="search"
              aria-label="Buscar música"
              onKeyDown={(e) => {
                // Anotação dele no README: "aceitar o ENTER para fechar o teclado".
                // Aqui o filtro já roda a cada tecla (debounce 300 ms), então Enter
                // não precisa buscar de novo: só fecha o teclado do celular.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3 pb-4">
                {catalogo.length === 0 ? (
                  <p className="mt-10 text-center text-muted-foreground">
                    Nenhuma música encontrada.
                  </p>
                ) : (
                  catalogo.map((musica) => (
                    <div
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      key={musica.id}
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          {musica.codigo && (
                            <Badge className="text-xs" variant="secondary">
                              {musica.codigo}
                            </Badge>
                          )}
                          <p className="font-semibold">{musica.titulo}</p>
                        </div>

                        {/* 3. Renderização do Artista e Início da Música */}
                        <div className="mt-1 flex flex-col gap-0.5 text-muted-foreground text-sm">
                          {musica.artista &&
                            musica.artista !== 'Desconhecido' && (
                              <p className="flex items-center gap-1">
                                🎤{' '}
                                <span className="font-medium">
                                  {musica.artista}
                                </span>
                              </p>
                            )}
                          {musica.inicio && (
                            <p className="mt-0.5 line-clamp-1 text-xs italic opacity-80">
                              🎵 Começa com: "{musica.inicio}"
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        className="shrink-0"
                        onClick={() => adicionarFila(musica.id)}
                        size="sm"
                      >
                        Cantar
                      </Button>
                    </div>
                  ))
                )}

                {/* Botão de Paginação */}
                {temMais && (
                  <Button
                    className="mt-2 w-full border border-dashed"
                    onClick={carregarMais}
                    variant="ghost"
                  >
                    Carregar mais músicas...
                  </Button>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* LADO DIREITO: Fila e Player Atual */}
        <Card className="flex h-[85vh] flex-col bg-slate-50 dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Fila de Reprodução</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Status do Player */}
            <div className="relative mb-6 overflow-hidden rounded-lg bg-primary p-5 text-primary-foreground shadow">
              <div className="relative z-10">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-primary-foreground/70 text-xs uppercase tracking-wider">
                    {status.estado === 'TOCANDO'
                      ? '▶ Tocando Agora'
                      : status.estado === 'PONTUACAO'
                        ? '🏆 Pontuação na tela!'
                        : status.estado === 'ANUNCIO'
                          ? '🎙 Chamando na TV'
                          : status.pausado
                            ? '⏸ Fila pausada'
                            : '⏸ Karaokê Livre'}
                  </h3>
                  {/* Pausar não corta a música do ar: o selo deixa isso claro no meio da festa. */}
                  {status.pausado && status.estado !== 'PARADO' && (
                    <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 font-semibold text-[11px] text-primary-foreground/90">
                      fila pausada: a próxima só sai ao retomar
                    </span>
                  )}
                </div>
                {status.estado === 'ANUNCIO' && status.anuncio ? (
                  <>
                    <p className="mb-1 line-clamp-1 font-bold text-3xl">
                      {status.anuncio.nome || 'alguém'}
                    </p>
                    <p className="font-medium text-lg text-primary-foreground/90">
                      vai cantar “{status.anuncio.titulo}”
                    </p>
                  </>
                ) : status.musicaAtual ? (
                  <>
                    <p className="mb-1 line-clamp-1 font-bold text-3xl">
                      {status.musicaAtual.titulo}
                    </p>
                    {/* Exibe o artista no Player Principal */}
                    {status.musicaAtual.artista &&
                      status.musicaAtual.artista !== 'Desconhecido' && (
                        <p className="font-medium text-lg text-primary-foreground/90">
                          {status.musicaAtual.artista}
                        </p>
                      )}
                    {status.musicaAtual.codigo && (
                      <Badge
                        className="mt-3 border-transparent bg-primary-foreground/10 text-primary-foreground"
                        variant="outline"
                      >
                        Cód: {status.musicaAtual.codigo}
                      </Badge>
                    )}
                    {quemPediu(status.quemCanta) && (
                      <p className="mt-2 text-primary-foreground/85 text-sm">
                        🙋 pedida por {quemPediu(status.quemCanta)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 font-medium text-xl">
                    {status.pausado
                      ? 'Pausado — a TV está nos QR codes.'
                      : 'Aguardando o próximo talento...'}
                  </p>
                )}
              </div>

              <div className="relative z-10 mt-5 flex flex-wrap gap-2">
                <Button
                  className="font-semibold"
                  disabled={status.estado === 'PARADO' || status.estado === 'ANUNCIO'}
                  onClick={pularMusica}
                  size="sm"
                  variant="secondary"
                >
                  ⏭ Pular Música
                </Button>
                <Button
                  aria-pressed={Boolean(status.pausado)}
                  className="font-semibold"
                  onClick={alternarPausa}
                  size="sm"
                  variant={status.pausado ? 'default' : 'outline'}
                >
                  {status.pausado ? '▶ Retomar fila' : '⏸ Pausar entre músicas'}
                </Button>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Lista da Fila */}
            <h4 className="mb-3 font-semibold">
              Próximos a cantar{' '}
              <span className="font-normal text-muted-foreground text-sm">
                ({status.fila.length})
              </span>
            </h4>
            {/* min-h-0 é o que falta para um flex item de fato rolar: sem ele o ScrollArea cresce
                com a lista, o overflow-hidden do CardContent corta o resto e a fila fica
                sem alcance depois de umas 10 músicas. */}
            <ScrollArea className="min-h-0 flex-1 pr-4">
              <div className="space-y-2 pb-4">
                {status.fila.length === 0 ? (
                  <p className="mt-8 text-center text-muted-foreground text-sm">
                    A fila está vazia. Adicione músicas na lista ao lado!
                  </p>
                ) : (
                  status.fila.map((musica, index) => (
                    <div
                      className="flex items-center gap-4 rounded-lg border bg-background p-3"
                      key={`${musica.codigo}-${index}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-semibold">
                          {musica.titulo}
                        </p>
                        {/* Exibe o artista na Fila também */}
                        {musica.artista &&
                          musica.artista !== 'Desconhecido' && (
                            <p className="truncate text-muted-foreground text-sm">
                              {musica.artista}
                            </p>
                          )}
                        {/* Quem pediu (some quando foi o próprio operador que adicionou). */}
                        {quemPediu(musica.nome) && (
                          <p className="truncate text-muted-foreground/90 text-xs">
                            🙋 pedida por {quemPediu(musica.nome)}
                            {musica.tier === 2 ? ' · 2ª música dela' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
