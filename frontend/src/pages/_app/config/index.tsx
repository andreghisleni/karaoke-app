/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <explanation> */
/** biome-ignore-all lint/correctness/noUndeclaredVariables: <explanation> */
/** biome-ignore-all lint/performance/useTopLevelRegex: <explanation> */
/** biome-ignore-all lint/style/noUnusedTemplateLiteral: <explanation> */
/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export const Route = createFileRoute('/_app/config/')({
  component: ConfigPage,
});

type AudioDevice = { id: string; nome: string };
type Screen = { id: string; nome: string };

export default function ConfigPage() {
  const [pastas, setPastas] = useState<string>('');
  const [audioDeviceId, setAudioDeviceId] = useState<string>('');
  const [videoOutputMode, setVideoOutputMode] = useState<string>('Monitor');
  const [displayId, setDisplayId] = useState<string>('0');

  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar dados iniciais da API do Java
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Dispara todos os pedidos AO MESMO TEMPO
        const [audioRes, screensRes, configRes] = await Promise.all([
          fetch('/api/audio-devices'),
          fetch('/api/screens'),
          fetch('/api/config')
        ]);

        // Processa as respostas (também pode fazer o .json() em paralelo, mas assim já fica super rápido)
        if (audioRes.ok) {
          setAudioDevices(await audioRes.json());
        }

        if (screensRes.ok) {
          setScreens(await screensRes.json());
        }

        if (configRes.ok) {
          const config = await configRes.json();
          setPastas(config.pastas ? config.pastas.join('\n') : '');
          if (config.audioDeviceId) { setAudioDeviceId(config.audioDeviceId); }
          if (config.videoOutputMode) { setVideoOutputMode(config.videoOutputMode); }
          if (config.displayId) { setDisplayId(config.displayId); }
        }

      } catch (error) {
        toast.error('Erro ao carregar configurações do servidor Java.');
        console.error(error);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Separar as pastas por quebra de linha para enviar como array
      const pastasList = pastas.split(/\r?\n/).filter((p) => p.trim() !== '');

      const payload = {
        pastas: pastasList,
        audioDeviceId,
        videoOutputMode,
        displayId,
      };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Configurações guardadas com sucesso!');
      } else {
        toast.error('Erro ao guardar as configurações.');
      }
    } catch (error) {
      toast.error('Erro de ligação com o servidor.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='container mx-auto max-w-3xl p-6'>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Configurações do Karaokê</CardTitle>
          <CardDescription>
            Configure as saídas de áudio, vídeo e onde as suas músicas estão
            guardadas.
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

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {/* Dispositivo de Áudio */}
            <div className="space-y-2">
              <Label>Saída de Áudio (Isolada)</Label>
              <Select onValueChange={setAudioDeviceId} value={audioDeviceId}>
                <SelectTrigger>
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
                onValueChange={setVideoOutputMode}
                value={videoOutputMode}
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
            {videoOutputMode === 'Monitor' && (
              <div className="space-y-2">
                <Label>Ecrã / Monitor Físico</Label>
                <Select onValueChange={setDisplayId} value={displayId}>
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

          <div className='flex justify-end pt-4'>
            <Button disabled={isLoading} onClick={handleSave}>
              {isLoading ? 'A Guardar...' : 'Guardar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}