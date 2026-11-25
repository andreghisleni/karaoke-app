import type { FilaItem, Preferencias } from './tipos'

/**
 * Persistência 100% local. Nada sai do aparelho.
 *
 * IndexedDB é o armazenamento primário: é assíncrono, aguenta arquivos maiores
 * e não é limpo tão rápido quanto localStorage quando a aba fica em segundo
 * plano. Como ele falha silenciosamente em janela anônima e no WebKit com
 * bastante frequência, toda gravação espelha no localStorage — que também serve
 * de cache de leitura síncrona, para a fila aparecer já no primeiro paint.
 */

const NOME_BANCO = 'karaoke-local'
const VERSAO_BANCO = 1
const REPOSITORIO = 'valores'

const CHAVES = {
  fila: 'fila',
  preferencias: 'preferencias',
  recentes: 'buscas-recentes',
} as const

const ESPELHO = (chave: string) => `karaoke:${chave}`

export interface EstadoLocal {
  fila: FilaItem[]
  preferencias: Preferencias
  recentes: string[]
}

export const PADRAO: EstadoLocal = {
  fila: [],
  preferencias: { tema: 'sistema', ordenacao: 'titulo' },
  recentes: [],
}

// ------------------------------------------------------------------ IndexedDB
let promissaBanco: Promise<IDBDatabase | null> | null = null

function abrirBanco(): Promise<IDBDatabase | null> {
  if (promissaBanco) return promissaBanco
  promissaBanco = new Promise((resolver) => {
    if (typeof indexedDB === 'undefined') return resolver(null)
    try {
      const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO)
      pedido.onupgradeneeded = () => {
        const banco = pedido.result
        if (!banco.objectStoreNames.contains(REPOSITORIO)) {
          banco.createObjectStore(REPOSITORIO, { keyPath: 'chave' })
        }
      }
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => resolver(null)
      pedido.onblocked = () => resolver(null)
    } catch {
      resolver(null)
    }
  })
  return promissaBanco
}

async function idbLer<T>(chave: string): Promise<T | undefined> {
  const banco = await abrirBanco()
  if (!banco) return undefined
  return new Promise((resolver) => {
    try {
      const transacao = banco.transaction(REPOSITORIO, 'readonly')
      const pedido = transacao.objectStore(REPOSITORIO).get(chave)
      pedido.onsuccess = () => resolver(pedido.result?.valor as T | undefined)
      pedido.onerror = () => resolver(undefined)
    } catch {
      resolver(undefined)
    }
  })
}

async function idbGravar<T>(chave: string, valor: T): Promise<void> {
  const banco = await abrirBanco()
  if (!banco) return
  await new Promise<void>((resolver) => {
    try {
      const transacao = banco.transaction(REPOSITORIO, 'readwrite')
      transacao.objectStore(REPOSITORIO).put({ chave, valor })
      transacao.oncomplete = () => resolver()
      transacao.onerror = () => resolver()
      transacao.onabort = () => resolver()
    } catch {
      resolver()
    }
  })
}

// ------------------------------------------------------------------ espelho
function espelharLer<T>(chave: string): T | undefined {
  try {
    const bruto = localStorage.getItem(ESPELHO(chave))
    return bruto ? (JSON.parse(bruto) as T) : undefined
  } catch {
    return undefined
  }
}

function espelharGravar<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(ESPELHO(chave), JSON.stringify(valor))
  } catch {
    /* cota cheia ou modo privado: o IndexedDB ainda segura o dado */
  }
}

// ------------------------------------------------------------------ API
async function ler<T>(chave: string, padrao: T): Promise<T> {
  const [viaIdb, viaEspelho] = await Promise.all([idbLer<T>(chave), Promise.resolve(espelharLer<T>(chave))])
  const candidato = viaIdb ?? viaEspelho
  if (candidato === undefined) return padrao
  return candidato
}

async function gravar<T>(chave: string, valor: T): Promise<void> {
  espelharGravar(chave, valor)
  await idbGravar(chave, valor)
}

/** Leitura síncrona do espelho: usada no boot para não piscar fila vazia. */
export function lerFilaSincrona(): FilaItem[] {
  return espelharLer<FilaItem[]>(CHAVES.fila) ?? []
}

export async function carregarEstado(): Promise<EstadoLocal> {
  const [fila, preferencias, recentes] = await Promise.all([
    ler<FilaItem[]>(CHAVES.fila, PADRAO.fila),
    ler<Preferencias>(CHAVES.preferencias, PADRAO.preferencias),
    ler<string[]>(CHAVES.recentes, PADRAO.recentes),
  ])
  return {
    fila: Array.isArray(fila) ? fila.filter((i) => i && typeof i.id === 'string') : [],
    preferencias: { ...PADRAO.preferencias, ...preferencias },
    recentes: Array.isArray(recentes) ? recentes : [],
  }
}

export const salvarFila = (fila: FilaItem[]) => gravar(CHAVES.fila, fila)
export const salvarPreferencias = (p: Preferencias) => gravar(CHAVES.preferencias, p)
export const salvarRecentes = (r: string[]) => gravar(CHAVES.recentes, r)

/**
 * Importa um backup textual colado pelo usuário. Aceita tanto o JSON exportado
 * por este app quanto uma lista crua de códigos ("01018, 01088" / uma por linha),
 * que é o que alguém manda no grupo do WhatsApp.
 */
export function interpretarFila(texto: string, catalogoIds: Set<string>): FilaItem[] {
  const bruto = texto.trim()
  if (!bruto) return []

  try {
    const dados = JSON.parse(bruto)
    const lista = Array.isArray(dados) ? dados : Array.isArray(dados?.fila) ? dados.fila : []
    return lista
      .map((item: unknown) => (typeof item === 'string' ? item : (item as FilaItem)?.id))
      .filter((id: unknown): id is string => typeof id === 'string' && catalogoIds.has(id))
      .map((id: string) => ({ id, desde: Date.now() }))
  } catch {
    /* segue para o formato texto */
  }

  const ids = bruto
    .split(/[^0-9A-Za-z]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && catalogoIds.has(t))

  const vistos = new Set<string>()
  const saida: FilaItem[] = []
  for (const id of ids) {
    if (vistos.has(id)) continue
    vistos.add(id)
    saida.push({ id, desde: Date.now() + saida.length })
  }
  return saida
}

export function exportarFila(itens: FilaItem[]): string {
  return JSON.stringify({ app: 'catalogo-karaoke', v: 1, fila: itens.map((i) => i.id) })
}
