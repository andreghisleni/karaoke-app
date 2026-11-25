/**
 * Copiar código é a ação primária do catálogo, então não pode depender de a
 * página estar em HTTPS: o `navigator.clipboard` só existe em contexto seguro,
 * e muitos salões servem o app por HTTP em uma máquina local na rede.
 * O fallback com textarea + execCommand cobre esse caso (e file://).
 */
export async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Sem limite aqui, uma escrita sem foco/gesto fica pendente para sempre e
      // o usuário não recebe nenhuma confirmação de que algo aconteceu.
      const prazo = new Promise<'expirou'>((resolver) =>
        setTimeout(() => resolver('expirou'), 1200),
      )
      const resultado = await Promise.race([navigator.clipboard.writeText(texto).then(() => 'ok'), prazo])
      if (resultado === 'ok') return true
    }
  } catch {
    /* cai no caminho antigo */
  }

  try {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, texto.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** Compartilhamento nativo quando existir; senão, copia e avisa como proceder. */
export async function compartilhar(titulo: string, texto: string): Promise<'nativo' | 'copiado' | 'falhou'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titulo, text: texto })
      return 'nativo'
    } catch {
      /* usuário cancelou: não insistimos */
      return 'falhou'
    }
  }
  return (await copiar(texto)) ? 'copiado' : 'falhou'
}
