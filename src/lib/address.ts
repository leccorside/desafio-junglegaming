/** Endereço de contrato ou carteira encurtado ("0x7A42...19E8"), como no Figma. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address
}
