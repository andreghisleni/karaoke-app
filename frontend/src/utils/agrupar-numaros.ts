export function agruparNumbers(numeros: number[]): string[] {
  if (numeros.length === 0) {
    return []
  }

  numeros.sort((a, b) => a - b) // Ordena os números em ordem crescente

  const resultado: string[] = []
  let inicioIntervalo: number = numeros[0]
  let fimIntervalo: number = numeros[0]

  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === fimIntervalo + 1) {
      fimIntervalo = numeros[i]
    } else {
      resultado.push(`${inicioIntervalo}-${fimIntervalo}`)
      inicioIntervalo = numeros[i]
      fimIntervalo = numeros[i]
    }
  }

  resultado.push(`${inicioIntervalo}-${fimIntervalo}`) // Adiciona o último intervalo

  return resultado
}
