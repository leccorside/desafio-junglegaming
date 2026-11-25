/** Nome acessível do link do carrinho, com a quantidade de unidades. */
export function cartLabel(count: number): string {
  if (count === 0) return 'Carrinho, vazio'
  return `Carrinho, ${count} ${count === 1 ? 'unidade' : 'unidades'}`
}
