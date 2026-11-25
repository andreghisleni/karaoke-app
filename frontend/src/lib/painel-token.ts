/**
 * Token do painel administrativo.
 *
 * O endereço chega com `?token=...` (aberto pelo link do console ou pelo QR no celular). A gente
 * guarda no localStorage e **limpa a URL**: histórico do navegador e print de tela ficam sem a
 * senha, e o cookie escrito pelo `/api/painel/acesso` cuida dos cliques com link direto.
 *
 * Daqui para frente todo `/api/` sai com o cabeçalho `X-Painel-Token`. Patch no `window.fetch`
 * porque as páginas do painel chamam `fetch('/api/...')` espalhadas em quatro arquivos; um
 * interceptor por página esqueceria o próximo botão.
 *
 * A tela do convidado (`/p`) não passa por nada daqui: é HTML puro, servido por outra rota.
 */

const CHAVE = 'karaoke:painelToken'

/** Cabeçalho lido pelo Java (TokenPainelService.CABECALHO). */
export const CABECALHO_TOKEN = 'X-Painel-Token'

/** Disparado em `window` quando a API respondeu 401: é o que abre a tela de acesso. */
export const EVENTO_SEM_TOKEN = 'karaoke:sem-token-painel'

export function lerToken(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? ''
  } catch {
    return '' // aba privada / storage bloqueado: seguimos sem token
  }
}

export function salvarToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(CHAVE, token)
    else window.localStorage.removeItem(CHAVE)
  } catch {
    /* sem storage, sem memória: o ?token= da URL ainda funciona nesta aba */
  }
}

export function limparToken(): void {
  salvarToken('')
}

/**
 * Lê o `?token=` da URL, guarda e tira o parâmetro do endereço.
 * Roda antes do React montar, para a primeira chamada já sair autenticada.
 */
export function capturarTokenDaUrl(): string {
  try {
    const url = new URL(window.location.href)
    const bruto = url.searchParams.get('token')
    if (bruto && bruto.trim()) {
      const token = bruto.trim().toUpperCase().replace(/[\s-]/g, '')
      salvarToken(token)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      return token
    }
  } catch {
    /* URL esquisita ou history bloqueado: o token salvo continua valendo */
  }
  return lerToken()
}

function caminhoDaChamada(input: RequestInfo | URL): string {
  try {
    let bruto: string
    if (typeof input === 'string') bruto = input
    else if (input instanceof URL) bruto = input.href
    else bruto = (input as Request).url ?? String(input)
    return new URL(bruto, window.location.origin).pathname
  } catch {
    return ''
  }
}

let instalado = false

/**
 * Embeleza o `fetch` da página: injeta o header nas chamas de API e avisa o app quando o token
 * não vale mais (401), para a tela de acesso aparecer sozinha.
 */
export function instalarFetchDoPainel(): void {
  if (instalado || typeof window === 'undefined') return
  instalado = true

  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const caminho = caminhoDaChamada(input)

    // só mexemos na API do próprio servidor; o resto (assets, imagens externas) passa ileso
    if (!caminho.startsWith('/api/')) return original(input as RequestInfo, init)

    let novaInit = init
    const token = lerToken()
    if (token) {
      const cabecalhos = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      if (!cabecalhos.has(CABECALHO_TOKEN)) cabecalhos.set(CABECALHO_TOKEN, token)
      novaInit = { ...(init ?? {}), headers: cabecalhos }
    }

    const resposta = await original(input as RequestInfo, novaInit)

    // /api/painel/acesso devolve 401 quando o token digitado está errado: ali quem decide é o form
    if (resposta.status === 401 && caminho !== '/api/painel/acesso') {
      window.dispatchEvent(new CustomEvent(EVENTO_SEM_TOKEN, { detail: { caminho } }))
    }
    return resposta
  }
}

/** URL do painel sem a senha, para mostrar na tela sem vazar token em print. */
export function urlPainelSemToken(): string {
  try {
    return `${window.location.origin}/dashboard`
  } catch {
    return '/dashboard'
  }
}
