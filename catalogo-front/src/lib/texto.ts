/**
 * Utilitários de texto.
 *
 * A comparação de busca é sempre feita sobre uma forma canônica: minúscula, sem
 * acentos e com "&" trocado por "e". Assim "Jorge e Mateus" encontra
 * "Jorge & Mateus" e "amarcao" encontra "Amaração".
 */

export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Chave canônica usada para comparar e ordenar. */
export function normalizar(texto: string): string {
  return removerAcentos(texto)
    .toLowerCase()
    .replace(/\s*&\s*/g, ' e ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Desconsidera pontuação inicial na ordenação: "(I've Had)..." vai no "I". */
export function baseOrdenacao(texto: string): string {
  const limpo = texto.replace(/^[\s\p{P}\p{S}]+/u, '')
  return limpo || texto
}

export function inicialParaIndice(texto: string): string {
  // baseOrdenacao devolve o título como ele é escrito ("A Viagem"), então a
  // comparação precisa ser em minúsculo: o teste original deixava TODAS as
  // 14.531 músicas dentro do grupo "#", sem cabeçalhos A-Z e sem índice lateral.
  const primeiro = baseOrdenacao(normalizar(texto)).charAt(0)
  return /[a-z]/.test(primeiro) ? primeiro.toUpperCase() : '#'
}

/** Divide o que o usuário digitou em termos pesquisáveis. */
export function termosDe(busca: string): string[] {
  return normalizar(busca).split(' ').filter(Boolean)
}

export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Formata contagem em pt-BR ("14.531"). */
export function numeroLocale(n: number): string {
  return n.toLocaleString('pt-BR')
}
