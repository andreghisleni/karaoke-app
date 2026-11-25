import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  Copy,
  Download,
  Share2,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { InfoMusica } from './LinhaMusica'
import { Button } from '@/components/ui/button'
import { musicasPorId } from '@/lib/catalogo'
import { compartilhar, copiar } from '@/lib/area'
import { exportarFila, interpretarFila } from '@/lib/armazenamento'
import type { Catalogo, FilaItem, Musica } from '@/lib/tipos'
import { alturaDaMusica } from '@/lib/alturas'

interface Props {
  catalogo: Catalogo | null
  fila: FilaItem[]
  aoRemover: (id: string) => void
  aoMover: (id: string, destino: number) => void
  aoLimpar: () => void
  aoDefinirFila: (itens: FilaItem[]) => void
  aoCopiar: (musica: Musica) => void
  aoIrParaCatalogo: () => void
  mostrarAviso: (texto: string) => void
}

/**
 * "Minha fila" é o motivo pelo qual o catálogo existe: o cliente procura várias
 * músicas, quer os códigos juntos e manda aquilo para o apresentador.
 * Tudo aqui é local (IndexedDB + espelho em localStorage) — sem conta, sem
 * servidor, sem instalar nada.
 */
export function TelaFila({
  catalogo,
  fila,
  aoRemover,
  aoMover,
  aoLimpar,
  aoDefinirFila,
  aoCopiar,
  aoIrParaCatalogo,
  mostrarAviso,
}: Props) {
  const [confirmado, setConfirmado] = useState(false)
  const [painelBackup, setPainelBackup] = useState<'nenhum' | 'exportar' | 'importar'>('nenhum')
  const [textoImportacao, setTextoImportacao] = useState('')

  const itens = useMemo(
    () => (catalogo ? musicasPorId(catalogo, fila.map((f) => f.id)) : []),
    [catalogo, fila],
  )

  const perdidas = fila.length - itens.length

  const codigos = useMemo(() => itens.map((m) => m.id).join(', '), [itens])

  const textoParaEnviar = useMemo(
    () =>
      [
        `Minha fila de karaokê (${itens.length} ${itens.length === 1 ? 'música' : 'músicas'})`,
        ...itens.map((m) => `${m.id} — ${m.titulo} (${m.artista})`),
      ].join('\n'),
    [itens],
  )

  async function enviar() {
    const resultado = await compartilhar('Minha fila de karaokê', textoParaEnviar)
    if (resultado === 'copiado') mostrarAviso('Lista copiada — cole na conversa')
    else if (resultado === 'falhou') mostrarAviso('Não foi possível compartilhar')
  }

  async function copiarCodigos() {
    const ok = await copiar(codigos)
    mostrarAviso(ok ? 'Códigos copiados' : 'Seu navegador bloqueou a cópia')
  }

  function importar() {
    if (!catalogo) return
    const idsValidos = new Set(catalogo.porTitulo.map((m) => m.id))
    const nova = interpretarFila(textoImportacao, idsValidos)
    if (nova.length === 0) {
      mostrarAviso('Nenhum código reconhecido')
      return
    }
    aoDefinirFila(nova)
    setTextoImportacao('')
    setPainelBackup('nenhum')
    mostrarAviso(`${nova.length} músicas na fila`)
  }

  if (itens.length === 0) {
    return (
      <main id="conteudo" className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <Star className="mb-3 size-8 text-muted-foreground/50" aria-hidden />
          <h2 className="text-base font-semibold">Sua fila está vazia</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Toque na estrela de qualquer música do catálogo para guardar o código
            aqui. A lista fica salva neste aparelho e continua disponível sem
            internet.
          </p>
          <Button size="sm" className="mt-4" onClick={aoIrParaCatalogo}>
            Procurar músicas
          </Button>
          {fila.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground/70">
              Havia {fila.length} {fila.length === 1 ? 'código salvo' : 'códigos salvos'} que não
              existem mais nesta versão do catálogo.
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main id="conteudo" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2 md:px-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{itens.length}</span>{' '}
          {itens.length === 1 ? 'música' : 'músicas'} na ordem do pedido
        </p>
        {perdidas > 0 && (
          <p className="text-[11px] text-muted-foreground/70">
            {perdidas} {perdidas === 1 ? 'código não existe' : 'códigos não existem'} na versão atual do
            catálogo
          </p>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={copiarCodigos}>
            <Copy className="size-3.5" aria-hidden />
            Códigos
          </Button>
          <Button size="sm" onClick={enviar}>
            <Share2 className="size-3.5" aria-hidden />
            Enviar
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ol className="border-y border-border/60 bg-card">
          {itens.map((musica, indice) => (
            <li
              key={musica.id}
              style={{ height: alturaDaMusica(musica) }}
              className="flex items-center gap-2 border-b border-border/60 px-2.5 last:border-b-0 md:px-4"
            >
              <span className="w-5 shrink-0 text-center text-[11px] font-bold text-muted-foreground/60 tabular-nums">
                {indice + 1}
              </span>

              <InfoMusica musica={musica} termos={[]} />

              <span className="hidden text-lg leading-none font-black tracking-wide tabular-nums md:block">
                {musica.id}
              </span>

              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  disabled={indice === 0}
                  onClick={() => aoMover(musica.id, indice - 1)}
                  aria-label={`Subir ${musica.titulo} na fila`}
                  className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                >
                  <ArrowUp className="size-3" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={indice === itens.length - 1}
                  onClick={() => aoMover(musica.id, indice + 1)}
                  aria-label={`Descer ${musica.titulo} na fila`}
                  className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                >
                  <ArrowDown className="size-3" aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={() => aoCopiar(musica)}
                className="h-10 shrink-0 rounded-lg px-2 text-base leading-none font-black tabular-nums transition-colors hover:bg-primary/10 md:hidden"
                aria-label={`Copiar código ${musica.id}`}
              >
                {musica.id}
              </button>

              <button
                type="button"
                onClick={() => aoRemover(musica.id)}
                aria-label={`Remover ${musica.titulo} da fila`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>

        <p className="px-3 py-2 text-[11px] text-muted-foreground/70">
          Códigos: <span className="font-medium text-foreground/80 tabular-nums">{codigos}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 px-3 py-2 md:px-4">
        <Button size="sm" variant="ghost" onClick={() => setPainelBackup('exportar')}>
          <Download className="size-3.5" aria-hidden />
          Backup
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPainelBackup('importar')}>
          <Upload className="size-3.5" aria-hidden />
          Restaurar
        </Button>

        {confirmado ? (
          <span className="ml-auto flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Apagar a fila inteira?</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                aoLimpar()
                setConfirmado(false)
                mostrarAviso('Fila esvaziada')
              }}
            >
              <Check className="size-3.5" aria-hidden />
              Apagar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmado(false)}>
              <X className="size-3.5" aria-hidden />
              Não
            </Button>
          </span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground hover:text-primary"
            onClick={() => setConfirmado(true)}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Limpar
          </Button>
        )}
      </div>

      {painelBackup !== 'nenhum' && (
        <div className="border-t border-border/70 bg-muted/30 px-3 py-3 md:px-4">
          <div className="mb-2 flex items-center gap-2">
            <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-xs font-semibold">
              {painelBackup === 'exportar' ? 'Copie e guarde sua fila' : 'Colar códigos ou backup'}
            </p>
            <button
              type="button"
              onClick={() => setPainelBackup('nenhum')}
              aria-label="Fechar"
              className="ml-auto grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>

          {painelBackup === 'exportar' ? (
            <>
              <textarea
                readOnly
                value={exportarFila(fila)}
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-card p-2 font-mono text-[11px]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={async () => {
                  const ok = await copiar(exportarFila(fila))
                  mostrarAviso(ok ? 'Backup copiado' : 'Seu navegador bloqueou a cópia')
                }}
              >
                <Copy className="size-3.5" aria-hidden />
                Copiar backup
              </Button>
            </>
          ) : (
            <>
              <textarea
                value={textoImportacao}
                onChange={(e) => setTextoImportacao(e.target.value)}
                rows={3}
                placeholder={'01018, 01088, 01393\nou cole o backup exportado'}
                className="w-full resize-none rounded-lg border border-border bg-card p-2 text-[12px] placeholder:text-muted-foreground/60"
              />
              <Button
                size="sm"
                className="mt-2"
                disabled={!textoImportacao.trim()}
                onClick={importar}
              >
                <Check className="size-3.5" aria-hidden />
                Importar
              </Button>
            </>
          )}
        </div>
      )}
    </main>
  )
}
