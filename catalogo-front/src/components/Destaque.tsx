import { Fragment, memo } from 'react'
import { escaparRegex } from '@/lib/texto'

interface Props {
  texto: string
  termos: string[]
}

/**
 * Sublinha o que casou. Em uma lista de 14 mil títulos, saber *por que* o
 * resultado apareceu é metade do trabalho — hoje o site só corta a lista.
 */
function DestaqueBase({ texto, termos }: Props) {
  if (!texto) return null

  const efetivos = termos.filter((t) => t.length >= 2).map(escaparRegex)
  if (efetivos.length === 0) return <>{texto}</>

  const expressao = new RegExp(`(${efetivos.join('|')})`, 'gi')
  const pedacos = texto.split(expressao)

  return (
    <>
      {pedacos.map((pedaco, i) =>
        i % 2 === 1 ? (
          <Fragment key={i}>
            <mark className="rounded-sm bg-primary/20 px-0.5 text-primary">{pedaco}</mark>
          </Fragment>
        ) : (
          <Fragment key={i}>{pedaco}</Fragment>
        ),
      )}
    </>
  )
}

export const Destaque = memo(DestaqueBase)
