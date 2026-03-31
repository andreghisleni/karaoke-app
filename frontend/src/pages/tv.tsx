
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/tv')({
  component: TvScreen,
});

export default function TvScreen() {
  const [estado, setEstado] = useState<'PARADO' | 'TOCANDO' | 'PONTUACAO'>(
    'PARADO'
  );
  const [pontuacao, setPontuacao] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/player/status');
        if (res.ok) {
          const data = await res.json();
          setEstado(data.estado);
          setPontuacao(data.pontuacao);
        }
      } catch (error) {
        // Silencioso
      }
    };

    // Polling rápido para a TV responder imediatamente
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Se o VLC estiver a tocar, mantemos a tela preta (ou com uma logo)
  // pois o VLC geralmente sobrepõe ou manda via NDI
  if (estado === 'TOCANDO') {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black p-8 text-white'>
      {/* TELA DE ESPERA */}
      {estado === 'PARADO' && (
        <div className='animate-pulse text-center'>
          <h1 className='mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text font-black text-6xl text-transparent'>
            KARAOKÊ LIVRE
          </h1>
          <p className="text-3xl text-gray-400">
            Escolha uma música pelo celular!
          </p>
        </div>
      )}

      {/* TELA DE PONTUAÇÃO (O Show!) */}
      {estado === 'PONTUACAO' && (
        <div className='zoom-in z-10 animate-in text-center duration-500'>
          <h2 className='mb-8 animate-bounce font-bold text-5xl text-yellow-400 uppercase tracking-widest'>
            Sua Nota
          </h2>

          <div className="relative">
            {/* Efeito de brilho atrás da nota */}
            <div className='absolute inset-0 rounded-full bg-yellow-500 opacity-50 blur-[100px]' />

            <span className='relative bg-gradient-to-b from-yellow-200 to-yellow-600 bg-clip-text font-black text-[15rem] text-transparent leading-none drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]'>
              {pontuacao}
            </span>
          </div>

          <p className='mt-8 font-bold text-4xl text-white'>
            {pontuacao >= 95
              ? '🎙️ NASCEU UMA ESTRELA!'
              : pontuacao >= 85
                ? '👏 MUITO BEM!'
                : '😅 VALEU A INTENÇÃO!'}
          </p>
        </div>
      )}

      {/* Background animado para a pontuação */}
      {estado === 'PONTUACAO' && (
        <div className='pointer-events-none absolute inset-0 opacity-30'>
          <div className='-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 h-[200vw] w-[200vw] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#fbbf24_100%)]' />
        </div>
      )}
    </div>
  );
}
