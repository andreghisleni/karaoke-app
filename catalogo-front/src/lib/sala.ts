/**
 * Fala com o servidor do karaokê que está na sala.
 *
 * Nada de nuvem: o mesmo Java que toca a música responde aqui, na rede Wi-Fi da festa. A
 * identidade de quem pede é o **nome** digitado no celular (guardado no localStorage deste
 * aparelho), nunca o IP — na mesma rede várias pessoas saem pelo mesmo endereço.
 *
 * As chaves de storage são as mesmas da tela de reserva em arquivo único (`karaoke:nome`), então
 * trocar de uma página para a outra não faz ninguém digitar o nome de novo.
 */

const CHAVE_NOME = 'karaoke:nome'

export interface Pedido {
  id: string
  codigo: string
  titulo: string
  artista: string
  inicio: string
  nome: string
  chave: string
  /** 1 = primeira música da pessoa; 2 = repeteco, que vai para trás de todo mundo. */
  tier: number
  recebidoEm: number
  /** Posição na fila, 1-based. 0 quando ainda não entrou. */
  posicao: number
}

/** O aviso que a TV está mostrando agora ("O próximo a brilhar vai ser…"). */
export interface AnuncioDaTv {
  nome: string
  titulo: string
  artista?: string
  codigo?: string
}
export interface StatusDaFila {
  estado: 'PARADO' | 'TOCANDO' | 'PONTUACAO' | 'ANUNCIO'
  tocando: Pedido | null
  quemCanta: string | null
  fila: Pedido[]
  total: number
  maxPorPessoa: number
  /** A TV chamando alguém: o celular mostra o mesmo que a TV. */
  anuncio: AnuncioDaTv | null
  /** Fila pausada pelo operador entre uma música e outra. */
  pausado: boolean
}

export interface ResultadoPedido {
  aceito: boolean
  mensagem: string
  codigoErro?: string
  posicao?: number
  naFrente?: number
  meusPendentes?: number
  totalFila?: number
}

export interface SalaInfo {
  ip: string
  porta: number
  url: string
  forçada: boolean
  qr?: { chave: string; rotulo: string; dica: string; visivel: boolean }[]
}

/**
 * O `/api/fila` chama a música atual de `tocando`; o broadcast do `/ws` manda o status do player,
 * que chama a mesma coisa de `musicaAtual` (e é um `Musica`, sem nome/posição). Um único ponto faz
 * as duas fontes virarem o mesmo objeto para a tela.
 */
export function normalizarStatus(bruto: Record<string, unknown>): StatusDaFila {
  const fila = Array.isArray(bruto.fila) ? (bruto.fila as Pedido[]) : []
  return {
    estado: (bruto.estado as StatusDaFila['estado']) ?? 'PARADO',
    tocando: ((bruto.tocando ?? bruto.musicaAtual) as Pedido | null) ?? null,
    quemCanta: (bruto.quemCanta as string | null) ?? null,
    anuncio: (bruto.anuncio as AnuncioDaTv | null) ?? null,
    pausado: Boolean(bruto.pausado),
    fila,
    total: typeof bruto.total === 'number' ? bruto.total : fila.length,
    maxPorPessoa: typeof bruto.maxPorPessoa === 'number' ? bruto.maxPorPessoa : 2,
  }
}

/** Mesma normalização do Java (FilaService.chavePessoa): "Zezé" e "zeze " são a mesma pessoa. */
export function normalizarNome(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function lerNome(): string {
  try {
    return localStorage.getItem(CHAVE_NOME) ?? ''
  } catch {
    return ''
  }
}

export function salvarNome(nome: string): void {
  try {
    const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, 24)
    if (limpo) localStorage.setItem(CHAVE_NOME, limpo)
    else localStorage.removeItem(CHAVE_NOME)
  } catch {
    /* sem storage: o nome vale só para esta visita */
  }
}

async function json<T>(caminho: string, inicio?: RequestInit): Promise<T> {
  const res = await fetch(caminho, {
    ...inicio,
    headers: { 'Content-Type': 'application/json', ...(inicio?.headers ?? {}) },
  })
  // os endpoints de pedido devolvem o motivo em português mesmo em 409: não descartamos o corpo
  const corpo = await res.json().catch(() => null)
  if (corpo === null) throw new Error(`O servidor não respondeu JSON em ${caminho}.`)
  return corpo as T
}

export async function buscarFila(nome: string): Promise<StatusDaFila> {
  const alvo = nome ? `?nome=${encodeURIComponent(nome)}` : ''
  const corpo = await json<Record<string, unknown>>(`/api/fila${alvo}`)
  return normalizarStatus(corpo)
}

export function pedirMusica(codigo: string, nome: string): Promise<ResultadoPedido> {
  return json<ResultadoPedido>('/api/pedidos', {
    method: 'POST',
    body: JSON.stringify({ codigo, nome }),
  })
}

export function cancelarPedido(codigo: string, nome: string): Promise<ResultadoPedido> {
  return json<ResultadoPedido>('/api/pedidos', {
    method: 'DELETE',
    body: JSON.stringify({ codigo, nome }),
  })
}

export function buscarSala(): Promise<SalaInfo> {
  return json<SalaInfo>('/api/sala')
}

/**
 * O Java broadcasteia o status do player em `/ws` a cada mudança de fila — é o que faz 20 celulares
 * verem a mesma posição sem nenhum deles perguntar. Reconectamos com volta progressiva porque em
 * festa o Wi-Fi cai mais do que a gente gostaria, e `onLine/offLine` do navegador atrasa.
 */
export function assinarFila(
  aoAtualizar: (status: StatusDaFila) => void,
  aoEstado?: (conectado: boolean) => void,
): () => void {
  let vivo = true
  let socket: WebSocket | null = null
  let espera = 1000
  let reagenda: ReturnType<typeof setTimeout> | null = null

  const url = () =>
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

  const abrir = () => {
    if (!vivo) return
    try {
      socket = new WebSocket(url())
    } catch {
      reagenda = setTimeout(abrir, espera)
      return
    }

    socket.onopen = () => {
      espera = 1000
      aoEstado?.(true)
    }
    socket.onmessage = (evento) => {
      try {
        aoAtualizar(normalizarStatus(JSON.parse(evento.data) as Record<string, unknown>))
      } catch {
        /* mensagem que não é status: ignoramos, a fila continua do último snapshot bom */
      }
    }
    socket.onclose = () => {
      aoEstado?.(false)
      if (vivo) {
        reagenda = setTimeout(abrir, espera)
        espera = Math.min(espera * 2, 15000)
      }
    }
    socket.onerror = () => socket?.close()
  }

  abrir()

  return () => {
    vivo = false
    if (reagenda) clearTimeout(reagenda)
    socket?.close()
  }
}
