import { useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lerNome } from '@/lib/sala'
import type { Musica } from '@/lib/tipos'

/**
 * Pede o nome uma única vez, no momento em que a pessoa aperta "Pedir" — não na abertura da
 * página. Quem só quer folhear o catálogo nunca vê esta tela, e quem vai pedir digita uma vez só:
 * o nome volta salvo no aparelho nas próximas festas deste mesmo servidor.
 *
 * O pedido que estava na mão continua guardado (`musica`): confirmar já dispara o POST, então o
 * toque não se perde.
 */
export function PedirNome({
  musica,
  onConfirmar,
  onCancelar,
}: {
  musica: Musica
  onConfirmar: (nome: string) => void
  onCancelar: () => void
}) {
  const campo = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    campo.current?.focus()
    const aoEsc = (e: KeyboardEvent) => e.key === 'Escape' && onCancelar()
    window.addEventListener('keydown', aoEsc)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', aoEsc)
    }
  }, [onCancelar])

  const submeter = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const valor = (new FormData(evento.currentTarget).get('nome') as string) || ''
    const limpo = valor.replace(/\s+/g, ' ').trim().slice(0, 24)
    if (!limpo) {
      campo.current?.focus()
      return
    }
    onConfirmar(limpo)
  }

  const jaTinha = lerNome()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-pedir-nome"
    >
      <form
        onSubmit={submeter}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl"
      >
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Mic className="size-3.5" aria-hidden />
          Pedir na fila da festa
        </p>
        <h2 id="titulo-pedir-nome" className="text-base leading-snug font-semibold text-foreground">
          {musica.titulo}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">{musica.artista || 'Artista não informado'}</p>

        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="nome-pedir">
          Com que nome você aparece na fila?
        </label>
        <Input
          id="nome-pedir"
          name="nome"
          ref={campo}
          autoComplete="name"
          maxLength={24}
          defaultValue={jaTinha}
          placeholder="Seu nome ou apelido"
          className="h-11"
        />
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Fica salvo só neste celular. É o nome que o apresentador lê na tela, então vale apelido.
        </p>

        <div className="mt-4 flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancelar} className="h-11 flex-1">
            Agora não
          </Button>
          <Button type="submit" className="h-11 flex-1">
            Pedir
          </Button>
        </div>
      </form>
    </div>
  )
}
