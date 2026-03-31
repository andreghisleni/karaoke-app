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

type PlayerStatus = {
  estado: 'PARADO' | 'TOCANDO' | 'PONTUACAO';
  musicaAtual: Musica | null;
  pontuacao: number;
  fila: Musica[];
};

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

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus(data);
    };

    ws.onopen = () => console.log('✅ Conectado ao Servidor do Karaokê');
    ws.onclose = () => console.log('❌ Desconectado do servidor');

    return () => ws.close();
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
      }
    } catch {
      toast.error('Erro ao adicionar música.');
    }
  };

  const pularMusica = async () => {
    try {
      await fetch('/api/player/next', { method: 'POST' });
      toast.info('Pulando para a próxima...');
    } catch {
      toast.error('Erro ao pular música.');
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
            />
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
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
                        <div className='mt-1 flex flex-col gap-0.5 text-muted-foreground text-sm'>
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
                            <p className='mt-0.5 line-clamp-1 text-xs italic opacity-80'>
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
                    className='mt-2 w-full border border-dashed'
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
          <CardContent className="flex flex-1 flex-col overflow-hidden">
            {/* Status do Player */}
            <div className="relative mb-6 overflow-hidden rounded-lg bg-primary p-5 text-primary-foreground shadow">
              <div className="relative z-10">
                <h3 className='mb-2 font-bold text-primary-foreground/70 text-xs uppercase tracking-wider'>
                  {status.estado === 'TOCANDO'
                    ? '▶ Tocando Agora'
                    : status.estado === 'PONTUACAO'
                      ? '🏆 Pontuação na tela!'
                      : '⏸ Karaokê Livre'}
                </h3>
                {status.musicaAtual ? (
                  <>
                    <p className='mb-1 line-clamp-1 font-bold text-3xl'>
                      {status.musicaAtual.titulo}
                    </p>
                    {/* Exibe o artista no Player Principal */}
                    {status.musicaAtual.artista &&
                      status.musicaAtual.artista !== 'Desconhecido' && (
                        <p className='font-medium text-lg text-primary-foreground/90'>
                          {status.musicaAtual.artista}
                        </p>
                      )}
                    {status.musicaAtual.codigo && (
                      <Badge
                        className='mt-3 border-transparent bg-primary-foreground/10 text-primary-foreground'
                        variant="outline"
                      >
                        Cód: {status.musicaAtual.codigo}
                      </Badge>
                    )}
                  </>
                ) : (
                  <p className='mt-2 font-medium text-xl'>
                    Aguardando o próximo talento...
                  </p>
                )}
              </div>

              <div className="relative z-10 mt-5 flex gap-2">
                <Button
                  className="font-semibold"
                  disabled={status.estado === 'PARADO'}
                  onClick={pularMusica}
                  size="sm"
                  variant="secondary"
                >
                  ⏭ Pular Música
                </Button>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Lista da Fila */}
            <h4 className="mb-3 font-semibold">Próximos a cantar:</h4>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2 pb-4">
                {status.fila.length === 0 ? (
                  <p className='mt-8 text-center text-muted-foreground text-sm'>
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
                        <p className='truncate font-semibold'>
                          {musica.titulo}
                        </p>
                        {/* Exibe o artista na Fila também */}
                        {musica.artista &&
                          musica.artista !== 'Desconhecido' && (
                            <p className='truncate text-muted-foreground text-sm'>
                              {musica.artista}
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
