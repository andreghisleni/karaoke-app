export const formatToBRL = (value = 0): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
