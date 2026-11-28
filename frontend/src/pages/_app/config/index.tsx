/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <explanation> */
/** biome-ignore-all lint/correctness/noUndeclaredVariables: <explanation> */
/** biome-ignore-all lint/performance/useTopLevelRegex: <explanation> */
/** biome-ignore-all lint/style/noUnusedTemplateLiteral: <explanation> */
/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { lerToken } from '@/lib/painel-token';

export const Route = createFileRoute('/_app/config/')({
  component: ConfigPage,
});

type AudioDevice = { id: string; nome: string };
type Screen = { id: string; nome: string };

/** Um dos três QRs da tela de descanso, como o servidor descreve o estado dele. */
type PlanoQr = {
  chave: 'wifi' | 'catalogo' | 'online';
  rotulo: string;
  dica: string;
  ligado: boolean;
  visivel: boolean;
  motivo?: string;
};

type Config = {
  pastas: string[];
  audioDeviceId: string;
  videoOutputMode: string;
  displayId: string;
  urlConvidado: string;
  maxPedidosPorPessoa: number;
  anunciarProximoSegundos: number;
  zoomTelaEspera: number;
  zoomProxCantar: number;
  jackRotearCanais: boolean;
  jackClienteKaraoke: string;
  jackCanaisKaraoke: string;
  pinAdmin: string;
  pinDefinido: boolean;
  tokenPainel: string;
  urlPainel: string;
  wifiSsid: string;
  wifiSenha: string;
  wifiSeguranca: string;
  urlCatalogoOnline: string;
  mostrarQrWifi: boolean;
  mostrarQrCatalogoLocal: boolean;
  mostrarQrCatalogoOnline: boolean;
  qr: PlanoQr[];
};

const PADRAO: Config = {
  pastas: [],
  audioDeviceId: '',
  videoOutputMode: 'Monitor',
  displayId: '0',
  urlConvidado: '',
  maxPedidosPorPessoa: 2,
  anunciarProximoSegundos: 5,
  zoomTelaEspera: 100,
  zoomProxCantar: 100,
  jackRotearCanais: false,
  jackClienteKaraoke: '',
  jackCanaisKaraoke: '',
  pinAdmin: '',
  pinDefinido: false,
  tokenPainel: '',
  urlPainel: '',
  wifiSsid: '',
  wifiSenha: '',
  wifiSeguranca: 'WPA',
  urlCatalogoOnline: '',
  mostrarQrWifi: true,
  mostrarQrCatalogoLocal: true,
  mostrarQrCatalogoOnline: true,
  qr: [],
};

export default function ConfigPage() {
  const [pastas, setPastas] = useState<string>('');
  const [config, setConfig] = useState<Config>(PADRAO);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenDigitado, setTokenDigitado] = useState('');
  const [redes, setRedes] = useState<string[]>([]);
  // Grafo de áudio da mesa (pw-link / jack_lsp): só interessa quando o roteio está ligado.
  const [portasAudio, setPortasAudio] = useState<string[]>([]);
  const [conexoesAudio, setConexoesAudio] = useState<string[]>([]);
  const [ferramentaAudio, setFerramentaAudio] = useState('');
  const [avisoAudio, setAvisoAudio] = useState('');
  const [buscandoPortas, setBuscandoPortas] = useState(false);
  const [aplicandoRotas, setAplicandoRotas] = useState(false);

  const trocar = <K extends keyof Config>(campo: K, valor: Config[K]) =>
    setConfig((atual) => ({ ...atual, [campo]: valor }));

  // Carregar dados iniciais da API do Java
  const carregarTudo = useCallback(async () => {
    try {
      // Dispara todos os pedidos AO MESMO TEMPO
      const [audioRes, screensRes, configRes] = await Promise.all([
        fetch('/api/audio-devices'),
        fetch('/api/screens'),
        fetch('/api/config'),
      ]);

      if (audioRes.ok) {
        setAudioDevices(await audioRes.json());
      } else {
        toast.error('Erro ao carregar os dispositivos de áudio.');
      }

      if (screensRes.ok) {
        setScreens(await screensRes.json());
      } else {
        toast.error('Erro ao carregar as telas detectadas.');
      }

      if (configRes.ok) {
        const json = (await configRes.json()) as Partial<Config>;
        const novo: Config = { ...PADRAO, ...json, qr: json.qr ?? [] };
        setConfig(novo);
        setPastas(novo.pastas ? novo.pastas.join('\n') : '');
        setTokenDigitado(novo.tokenPainel);
      } else if (configRes.status === 401) {
        toast.error('Falta o token do painel para ler as configurações.');
      }
    } catch (error) {
      toast.error('Erro ao carregar configurações do servidor Java.');
      console.error(error);
    }
  }, []);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Separar as pastas por quebra de linha para enviar como array
      const pastasList = pastas.split(/\r?\n/).filter((p) => p.trim() !== '');

      // Mandamos só o que esta tela edita. O POST do Java é mescla campo a campo: o que não
      // vier aqui fica como está no config.json.
      const payload = {
        pastas: pastasList,
        audioDeviceId: config.audioDeviceId,
        videoOutputMode: config.videoOutputMode,
        displayId: config.displayId,
        urlConvidado: config.urlConvidado,
        maxPedidosPorPessoa: Number(config.maxPedidosPorPessoa) || 1,
        anunciarProximoSegundos: Math.max(
          0,
          Math.min(30, Number(config.anunciarProximoSegundos) || 0),
        ),
        // Zoom sem teto de propósito; o Java refaz a mesma conta e rejeita 0/negativo.
        zoomTelaEspera: Math.max(1, Math.min(1000, Number(config.zoomTelaEspera) || 100)),
        zoomProxCantar: Math.max(1, Math.min(1000, Number(config.zoomProxCantar) || 100)),
        jackRotearCanais: config.jackRotearCanais,
        jackClienteKaraoke: config.jackClienteKaraoke,
        jackCanaisKaraoke: config.jackCanaisKaraoke,
        pinAdmin: config.pinAdmin,
        wifiSsid: config.wifiSsid,
        wifiSenha: config.wifiSenha,
        wifiSeguranca: config.wifiSeguranca,
        urlCatalogoOnline: config.urlCatalogoOnline,
        mostrarQrWifi: config.mostrarQrWifi,
        mostrarQrCatalogoLocal: config.mostrarQrCatalogoLocal,
        mostrarQrCatalogoOnline: config.mostrarQrCatalogoOnline,
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const salvo = (await res.json()) as Partial<Config>;
        setConfig((atual) => ({ ...atual, ...salvo, qr: salvo.qr ?? atual.qr }));
        // o servidor devolve o endereço já normalizado (http://ip:7000/p), mostro ele de volta
        setTokenDigitado(salvo.tokenPainel ?? atual.tokenPainel);
        toast.success('Configurações guardadas com sucesso!');
      } else {
        const erro = await res.json().catch(() => ({}));
        toast.error(erro.mensagem ?? 'Erro ao guardar as configurações.');
      }
    } catch (error) {
      toast.error('Erro de ligação com o servidor.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Lê o grafo de áudio da mesa. Não é obrigatório usar: os campos aceitam número de canal e o
   * Java completa "system:playback_N". Serve para conferir o nome exato do nosso cliente (VLC…)
   * antes de gravar, porque um nome errado simplesmente não liga nada.
   */
  const carregarPortas = async () => {
    setBuscandoPortas(true);
    try {
      const res = await fetch('/api/painel/audio/portas');
      const json = await res.json();
      const lista: string[] = json.portas ?? [];
      setFerramentaAudio(json.ferramenta ?? '');
      setPortasAudio(lista);
      setConexoesAudio(
        ((json.conexoes ?? []) as string[][]).map((par) => par.join(' → ')),
      );
      setAvisoAudio(json.aviso ?? '');
      if (json.aviso) toast.error(String(json.aviso));
      else toast.success(`${lista.length} portas no grafo de áudio.`);
    } catch {
      toast.error('Não consegui ler as portas de áudio.');
    } finally {
      setBuscandoPortas(false);
    }
  };

  /**
   * Testa o par de canais ANTES de gravar: o POST aceita o que está na tela e só religa, sem
   * tocar no config.json. Assim dá para ouvir em qual canal da XR18 o karaokê caiu.
   */
  const aplicarRotas = async () => {
    setAplicandoRotas(true);
    try {
      const res = await fetch('/api/painel/audio/rotear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jackClienteKaraoke: config.jackClienteKaraoke,
          jackCanaisKaraoke: config.jackCanaisKaraoke,
        }),
      });
      const json = await res.json();
      const acoes: string[] = json.acoes ?? [];
      acoes.forEach((linha) => console.info(linha));
      const erros = acoes.filter((linha) => linha.startsWith('✗'));
      if (erros.length) toast.error(erros.join(' · '));
      else toast.success(acoes[acoes.length - 1] ?? 'Rotas aplicadas.');
    } catch {
      toast.error('Falha ao aplicar as rotas.');
    } finally {
      setAplicandoRotas(false);
    }
  };

  /** Girar (vazio) ou definir (digitado) o token. Depois disso os links antigos param de funcionar. */
  const trocarToken = async (novo?: string) => {
    try {
      const res = await fetch('/api/painel/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novo ? { token: novo } : {}),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        toast.error(erro.mensagem ?? 'Não consegui trocar o token.');
        return;
      }
      const corpo = (await res.json()) as { token: string; urlPainel: string };
      setConfig((atual) => ({
        ...atual,
        tokenPainel: corpo.token,
        urlPainel: corpo.urlPainel,
      }));
      setTokenDigitado(corpo.token);
      toast.success(
        novo
          ? 'Token atualizado. Use o novo link daqui em diante.'
          : 'Novo token gerado. Os links antigos não abrem mais.',
      );
    } catch {
      toast.error('Erro de ligação com o servidor.');
    }
  };

  const copiar = async (texto: string, oQue: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${oQue} copiado.`);
    } catch {
      toast.error('Seu navegador não deixou copiar; selecione o texto e use Ctrl+C.');
    }
  };

  /** QR público (catálogo/Wi-Fi) por tipo; o do painel leva o token na URL porque <img> não manda header. */
  /* As sugestões de SSID chegam depois do formulário: sem Wi-Fi na máquina, nada muda. */
  useEffect(() => {
    let vivo = true;
    fetch('/api/painel/redes-wifi')
      .then((r) => (r.ok ? r.json() : { redes: [] }))
      .then((d) => {
        if (vivo && Array.isArray(d.redes)) setRedes(d.redes);
      })
      .catch(() => setRedes([]));
    return () => {
      vivo = false;
    };
  }, []);

  const srcDoQr = (tipo: string, tamanho = 190) =>
    tipo === 'painel'
      ? `/api/painel/qrcode.png?tamanho=${tamanho}&token=${encodeURIComponent(lerToken() || config.tokenPainel)}`
      : `/api/qrcode.png?tipo=${tipo}&tamanho=${tamanho}`;

  /** Nomes de cliente deduzidos das portas lidas, para o datalist de cima. */
  const clientesJack = Array.from(
    new Set(portasAudio.map((porta) => porta.split(':')[0]).filter(Boolean)),
  ).sort();

  return (
    <div className='container mx-auto max-w-3xl space-y-6 p-6'>
      <Tabs className="space-y-6" defaultValue="karaoke">
        <TabsList className="flex w-full justify-start gap-1">
          <TabsTrigger value="karaoke">Karaokê</TabsTrigger>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="convites">Convites e QR</TabsTrigger>
          <TabsTrigger value="operador">Operador</TabsTrigger>
        </TabsList>

        {/* =============================================================
            ABA 1 — KARAOKÊ: onde as músicas moram + regra de pedidos
            ============================================================= */}
        <TabsContent className="space-y-6" value="karaoke">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Configurações do Karaokê</CardTitle>
              <CardDescription>
                As pastas que o app varre para montar o acervo e quantas músicas cada pessoa pode
                ter pendentes. Som e imagem ficam na aba “Saídas”; os QR da TV, em “Convites e QR”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pastas de Músicas */}
              <div className="space-y-2">
                <Label htmlFor="pastas">Pastas de Músicas (Uma por linha)</Label>
                <Textarea
                  className="min-h-[120px] font-mono"
                  id="pastas"
                  onChange={(e) => setPastas(e.target.value)}
                  placeholder="/home/andre/Musicas/Karaoke&#10;/home/andre/Musicas/Rock"
                  value={pastas}
                />
                <p className='text-muted-foreground text-xs'>
                  Coloque o caminho completo do seu sistema operativo.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-pedidos">Músicas pendentes por pessoa</Label>
                <Input
                  id="max-pedidos"
                  max={10}
                  min={1}
                  onChange={(e) =>
                    trocar('maxPedidosPorPessoa', Number(e.target.value) as Config['maxPedidosPorPessoa'])
                  }
                  type="number"
                  value={config.maxPedidosPorPessoa}
                />
                <p className='text-muted-foreground text-xs'>
                  A fila é em dois andares: a primeira música de cada pessoa fica na ordem de chegada
                  e as extras vão para trás de todo mundo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =============================================================
            ABA 2 — SAÍDAS: áudio, vídeo/NDI, tamanho do desenho e canais da mesa
            ============================================================= */}
        <TabsContent className="space-y-6" value="saidas">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Saídas de áudio e vídeo</CardTitle>
              <CardDescription>
                Para onde o som e a imagem vão: a placa de saída, o monitor do telão (ou NDI) e o
                tamanho do que é desenhado na TV.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                {/* Dispositivo de Áudio */}
                <div className="space-y-2">
                  <Label>Saída de Áudio (Isolada)</Label>
                  <Select
                    onValueChange={(v) => trocar('audioDeviceId', v)}
                    value={config.audioDeviceId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a placa de som" />
                    </SelectTrigger>
                    <SelectContent>
                      {audioDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modo de Vídeo (Monitor ou NDI) */}
                <div className="space-y-2">
                  <Label>Modo de Saída de Vídeo</Label>
                  <Select
                    onValueChange={(v) => trocar('videoOutputMode', v)}
                    value={config.videoOutputMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monitor">Monitor Nativo</SelectItem>
                      <SelectItem value="NDI">Rede NDI (Resolume)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ecrã (Só faz sentido se for Monitor) */}
                {config.videoOutputMode === 'Monitor' && (
                  <div className="space-y-2">
                    <Label>Ecrã / Monitor Físico</Label>
                    <Select
                      onValueChange={(v) => trocar('displayId', v)}
                      value={config.displayId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ecrã" />
                      </SelectTrigger>
                      <SelectContent>
                        {screens.map((screen) => (
                          <SelectItem key={screen.id} value={screen.id}>
                            {screen.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <p className='text-muted-foreground text-xs'>
                Aviso e zoom são o que a TV desenha: 100% é exatamente como sempre foi,
                e todo valor é aplicado em volta do centro da tela.
              </p>

              <div className="space-y-2">
                <Label htmlFor="aviso-tv">Aviso na TV (segundos)</Label>
                <Input
                  id="aviso-tv"
                  max={30}
                  min={0}
                  onChange={(e) =>
                    trocar(
                      'anunciarProximoSegundos',
                      Number(e.target.value) as Config['anunciarProximoSegundos'],
                    )
                  }
                  type="number"
                  value={config.anunciarProximoSegundos}
                />
                <p className='text-muted-foreground text-xs'>
                  Antes de largar o vídeo, a TV mostra “O próximo a brilhar vai ser:
                  {' '}<span className="font-semibold">o nome de quem pediu</span>” por esse tempo.
                  Zere para a música entrar direto, como antes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoom-espera">Zoom da tela de espera (%)</Label>
                <Input
                  id="zoom-espera"
                  min={1}
                  onChange={(e) =>
                    trocar('zoomTelaEspera', Number(e.target.value) as Config['zoomTelaEspera'])
                  }
                  type="number"
                  value={config.zoomTelaEspera}
                />
                <p className='text-muted-foreground text-xs'>
                  100% é exatamente como sempre foi. Não tem teto: 150% entra meia vez maior, 60%
                  encolhe. É para caber bem tanto no projetor grande quanto no monitor do operador.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoom-prox">Zoom do “próximo a cantar” (%)</Label>
                <Input
                  id="zoom-prox"
                  min={1}
                  onChange={(e) =>
                    trocar('zoomProxCantar', Number(e.target.value) as Config['zoomProxCantar'])
                  }
                  type="number"
                  value={config.zoomProxCantar}
                />
                <p className='text-muted-foreground text-xs'>
                  Vale para a tela “O próximo a brilhar vai ser: <span className="font-semibold">nome</span>”.
                  Nome comprido continua sendo encolhido para não vazar da tela, mesmo com zoom alto.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Canais de saída na mesa</CardTitle>
              <CardDescription>
                Para quem liga a mesa por JACK ou PipeWire e quer o karaokê caindo num par de canais
                específico da XR18. Aqui o app religa <em>somente as saídas dele</em>: o Mixxx e qualquer
                outro programa seguem roteando por conta própria. Desligado, o som continua no
                dispositivo escolhido na aba “Saídas” — nada é mexido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">Rotear canais do Jack</p>
                  <p className="text-muted-foreground text-sm">
                    O app usa o <span className="font-mono">pw-link</span> (PipeWire) ou o{' '}
                    <span className="font-mono">jack_connect</span> para ligar as saídas nos canais
                    pedidos, igual a mexer no cabo dentro do qjackctl.
                  </p>
                </div>
                <Switch
                  aria-label="Rotear canais do Jack"
                  checked={config.jackRotearCanais}
                  onCheckedChange={(v) => trocar('jackRotearCanais', v)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="jack-cli-kara">Karaokê — nome no Jack</Label>
                  <Input
                    className="font-mono text-sm"
                    id="jack-cli-kara"
                    list="jack-nomes-detectados"
                    onChange={(e) => trocar('jackClienteKaraoke', e.target.value)}
                    placeholder="deixe vazio: o app se procura (VLC)"
                    value={config.jackClienteKaraoke}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jack-can-kara">Karaokê — canais</Label>
                  <Input
                    className="font-mono text-sm"
                    id="jack-can-kara"
                    onChange={(e) => trocar('jackCanaisKaraoke', e.target.value)}
                    placeholder="5,6"
                    value={config.jackCanaisKaraoke}
                  />
                  <p className='text-muted-foreground text-xs'>
                    Um número por canal da mesa, separados por vírgula. Vazio = deixo onde já está.
                  </p>
                </div>

              </div>

              <datalist id="jack-nomes-detectados">
                {clientesJack.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={buscandoPortas}
                  onClick={carregarPortas}
                  size="sm"
                  variant="outline"
                >
                  {buscandoPortas ? 'Procurando…' : 'Atualizar lista'}
                </Button>
                <Button
                  disabled={aplicandoRotas || !config.jackRotearCanais}
                  onClick={aplicarRotas}
                  size="sm"
                  variant="outline"
                >
                  {aplicandoRotas ? 'Aplicando…' : 'Aplicar rotas agora'}
                </Button>
                <p className='text-muted-foreground text-xs'>
                  {ferramentaAudio
                    ? `ferramenta: ${ferramentaAudio} · ${portasAudio.length} portas`
                    : 'ainda não procurei as portas desta máquina'}
                </p>
              </div>

              {portasAudio.length > 0 && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    O que está no grafo agora ({portasAudio.length} portas, {conexoesAudio.length}{' '}
                    ligações) — clique para copiar o nome
                  </summary>
                  <div className="mt-3 grid gap-1 sm:grid-cols-2">
                    {portasAudio.map((porta) => (
                      <button
                        className="font-mono text-muted-foreground hover:text-foreground truncate text-left text-xs hover:underline"
                        key={porta}
                        onClick={() => copiar(porta, 'Porto')}
                        title={porta}
                        type="button"
                      >
                        {porta}
                      </button>
                    ))}
                  </div>
                  {conexoesAudio.length > 0 && (
                    <p className="font-mono text-muted-foreground mt-3 text-xs break-all">
                      {conexoesAudio.join('  |  ')}
                    </p>
                  )}
                </details>
              )}

              {avisoAudio && <p className='text-muted-foreground text-xs'>{avisoAudio}</p>}

              <p className='text-muted-foreground text-xs'>
                Salvando, o app religa na hora — e toda música que começa passa pelos mesmos canais,
                porque o Porto do player só existe quando há stream no ar. O “Aplicar rotas agora” testa
                o que está digitado aqui sem gravar nada.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =============================================================
            ABA 3 — CONVITES E QR CODES DA TELA
            ============================================================= */}
        <TabsContent className="space-y-6" value="convites">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Convites e QR codes da tela</CardTitle>
              <CardDescription>
                O endereço abaixo é o que o celular do convidado precisa alcançar. Se ficar vazio, o
                app descobre o IP sozinho; numa festa com ponto de acesso, digite o IP da rede da festa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="url-convidado">Endereço dos convidados (IP ou URL)</Label>
                <Input
                  className="font-mono"
                  id="url-convidado"
                  onChange={(e) => trocar('urlConvidado', e.target.value)}
                  placeholder="192.168.4.1"
                  value={config.urlConvidado}
                />
                <p className='text-muted-foreground text-xs'>
                  Vale só o IP (‘192.168.4.1’), com porta (‘:7000’) ou a URL inteira. O app completa
                  o resto e grava assim:
                  <span className="font-mono"> {config.qr.find((q) => q.chave === 'catalogo')?.dica || '—'}</span>
                </p>
              </div>

              {/* --- Wi-Fi da festa (QR 1) --- */}
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">QR do Wi-Fi</p>
                    <p className="text-muted-foreground text-sm">
                      A câmera do celular lê e conecta sozinho, sem digitar senha.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar o QR do Wi-Fi na tela"
                    checked={config.mostrarQrWifi}
                    onCheckedChange={(v) => trocar('mostrarQrWifi', v)}
                  />
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                  <div className="space-y-2">
                    <Label htmlFor="wifi-ssid">Nome da rede (SSID)</Label>
                    <Input
                      autoComplete="off"
                      id="wifi-ssid"
                      list="redes-wifi-detectadas"
                      onChange={(e) => trocar('wifiSsid', e.target.value)}
                      placeholder={redes.length ? 'escolha na lista ou digite' : 'Karaoke da Festa'}
                      value={config.wifiSsid}
                    />
                    {/*
                     * Ninguém deveria digitar o nome de uma rede que o próprio computador enxerga: a
                     * lista vem de /api/painel/redes-wifi. Num desktop ligado no cabo (o caso mais
                     * comum em festa) ela chega vazia e o campo continua sendo um campo digitável.
                     */}
                    <datalist id="redes-wifi-detectadas">
                      {redes.map((nome) => (
                        <option key={nome} value={nome} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wifi-senha">Senha da rede</Label>
                    <Input
                      autoComplete="off"
                      id="wifi-senha"
                      onChange={(e) => trocar('wifiSenha', e.target.value)}
                      placeholder="deixe vazio se a rede for aberta"
                      value={config.wifiSenha}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Segurança</Label>
                    <Select
                      onValueChange={(v) => trocar('wifiSeguranca', v)}
                      value={config.wifiSeguranca}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WPA">WPA2 / WPA3</SelectItem>
                        <SelectItem value="WEP">WEP</SelectItem>
                        <SelectItem value="nopass">Rede aberta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {config.mostrarQrWifi && (
                  <PreviewQr
                    chave="wifi"
                    config={config}
                    src={srcDoQr('wifi')}
                    texto={config.wifiSsid ? `Rede: ${config.wifiSsid}` : 'Preencha o nome da rede para o QR aparecer.'}
                  />
                )}
              </div>

              {/* --- Catálogo local (QR 2) e online (QR 3) --- */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">QR do catálogo local</p>
                      <p className="text-muted-foreground text-sm">
                        Abre a tela de pedido servida por este app.
                      </p>
                    </div>
                    <Switch
                      aria-label="Mostrar o QR do catálogo local"
                      checked={config.mostrarQrCatalogoLocal}
                      onCheckedChange={(v) => trocar('mostrarQrCatalogoLocal', v)}
                    />
                  </div>
                  {config.mostrarQrCatalogoLocal && (
                    <PreviewQr
                      chave="catalogo"
                      config={config}
                      src={srcDoQr('catalogo')}
                      texto={config.qr.find((q) => q.chave === 'catalogo')?.dica || ''}
                    />
                  )}
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">QR do catálogo online</p>
                      <p className="text-muted-foreground text-sm">
                        O mesmo que estava no arquivo fixo do programa.
                      </p>
                    </div>
                    <Switch
                      aria-label="Mostrar o QR do catálogo online"
                      checked={config.mostrarQrCatalogoOnline}
                      onCheckedChange={(v) => trocar('mostrarQrCatalogoOnline', v)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url-online">Endereço do catálogo online</Label>
                    <Input
                      className="font-mono text-sm"
                      id="url-online"
                      onChange={(e) => trocar('urlCatalogoOnline', e.target.value)}
                      placeholder="https://catalogo.seudominio.com.br"
                      value={config.urlCatalogoOnline}
                    />
                  </div>
                  {config.mostrarQrCatalogoOnline && (
                    <PreviewQr
                      chave="online"
                      config={config}
                      src={srcDoQr('online')}
                      texto={config.urlCatalogoOnline || 'https://short.andreg.com.br/qxxteq'}
                    />
                  )}
                </div>
              </div>

              <p className='text-muted-foreground text-xs'>
                Desligue um QR e ele sai da tela de descanso na hora — sem reiniciar o app. A ordem na
                TV é sempre Wi-Fi, catálogo da festa, catálogo online.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =============================================================
            ABA 4 — ACESSO DO OPERADOR
            ============================================================= */}
        <TabsContent className="space-y-6" value="operador">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Acesso do operador</CardTitle>
              <CardDescription>
                O token protege só o painel (configuração, fila, pular música). O catálogo dos
                convidados continua aberto — quem escaneia não tem nada para lembrar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="token-painel">Token do painel</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="font-mono text-lg tracking-[0.2em] uppercase"
                    id="token-painel"
                    onChange={(e) => setTokenDigitado(e.target.value.toUpperCase())}
                    value={tokenDigitado}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copiar(config.urlPainel || '', 'Link do painel')}
                      size="sm"
                      variant="outline"
                    >
                      Copiar link
                    </Button>
                    <Button
                      disabled={!tokenDigitado || tokenDigitado === config.tokenPainel}
                      onClick={() => trocarToken(tokenDigitado)}
                      size="sm"
                      variant="outline"
                    >
                      Aplicar
                    </Button>
                    <Button onClick={() => trocarToken()} size="sm">
                      Gerar novo
                    </Button>
                  </div>
                </div>
                <p className='text-muted-foreground text-xs'>
                  O link completo é
                  <span className="font-mono"> {config.urlPainel || '—'}</span>
                  . Ele também sai impresso no console, com QR, toda vez que o app inicia. Girar o
                  token derruba na hora os links e telas já abertos.
                </p>
              </div>

              <div className="flex flex-wrap items-start gap-6">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">QR do painel (só aparece aqui)</p>
                  <img
                    alt="QR code do link do painel administrativo"
                    className="h-[190px] w-[190px] rounded-md bg-white p-2"
                    height={190}
                    src={srcDoQr('painel')}
                    width={190}
                  />
                  <p className='text-muted-foreground max-w-[190px] text-xs'>
                    Aponte a câmera para abrir o controle no celular.
                  </p>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pin">PIN de operador</Label>
                    <Input
                      className="font-mono"
                      id="pin"
                      onChange={(e) => trocar('pinAdmin', e.target.value)}
                      placeholder={config.pinDefinido ? '*** (já definido)' : '4 números'}
                      type="password"
                      value={config.pinAdmin}
                    />
                    <p className='text-muted-foreground text-xs'>
                      Usado nas telas sem link do painel (a fila da administração, por exemplo). Vazio =
                      sem PIN, como era antes.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço detectado</Label>
                    <p className="font-mono text-sm">{config.urlPainel ? new URL(config.urlPainel).host : '—'}</p>
                    <p className='text-muted-foreground text-xs'>
                      Se o IP da festa for outro, digite lá em cima — o QR da TV e este link mudam junto.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* o salvar fica fora das abas: alcança a aba que estiver aberta */}
      <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
        <p className='text-muted-foreground text-xs'>
          As quatro abas são a mesma configuração: um clique guarda o que estiver digitado
          em todas elas.
        </p>
        <Button disabled={isLoading} onClick={handleSave}>
          {isLoading ? 'A Guardar...' : 'Guardar Configurações'}
        </Button>
      </div>
    </div>
  );
}

/** Miniatura do QR + o endereço por extenso, para conferir antes de deixar a TV sozinha. */
function PreviewQr({
  src,
  texto,
  chave,
  config,
}: {
  src: string;
  texto: string;
  chave: string;
  config: Config;
}) {
  const plano = config.qr.find((q) => q.chave === chave);
  /*
   * visivel = false é o servidor dizendo que não há conteúdo (Wi-Fi sem SSID, ou switch
   * desligado): o /api/qrcode.png devolve 404 e a <img> viraria o quadrado rasgado do navegador.
   * E o Wi-Fi nunca tem link para testar, porque o que o QR carrega é a senha da rede - que de
   * propósito não volta na API.
   */
  const temQr = Boolean(plano?.visivel);
  const aviso = !plano
    ? ''
    : plano.visivel
      ? ''
      : plano.motivo || (plano.ligado ? '' : 'QR desligado nas Configurações.');
  const link = plano?.conteudo && plano.conteudo.startsWith('http') ? plano.conteudo : '';

  return (
    <div className="flex items-center gap-4">
      {temQr ? (
        <img
          alt={`QR ${chave}`}
          className="h-[130px] w-[130px] shrink-0 rounded-md bg-white p-1.5"
          height={130}
          src={src}
          width={130}
        />
      ) : (
        <div
          aria-hidden
          className="text-muted-foreground grid h-[130px] w-[130px] shrink-0 place-items-center rounded-md border border-dashed text-center text-xs"
        >
          QR vazio
        </div>
      )}
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground break-all font-mono text-xs">{texto || '—'}</p>
        {aviso ? (
          <p className="text-destructive text-xs">{aviso}</p>
        ) : !temQr ? (
          <p className="text-muted-foreground text-xs">
            {chave === 'wifi' ? 'Preencha o nome da rede para o QR nascer.' : 'Este QR está sem endereço.'}
          </p>
        ) : link ? (
          <a
            className="text-primary text-xs underline underline-offset-2"
            href={link}
            rel="noreferrer"
            target="_blank"
          >
            Testar este link
          </a>
        ) : (
          <p className="text-muted-foreground text-xs">
            A câmera do celular lê e conecta sozinho: não há link para abrir aqui.
          </p>
        )}
      </div>
    </div>
  );
}
