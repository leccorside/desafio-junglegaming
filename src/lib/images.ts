/**
 * As imagens dos NFTs existem em 480 e 960 px de largura (public/images/nfts,
 * exportadas do Figma). A API devolve a versão de 960; daqui sai o `srcset`
 * para o navegador escolher pelo tamanho exibido.
 */
export function nftImageSources(url: string, sizes: string) {
  const small = url.replace(/-960\.webp$/, '-480.webp')
  if (small === url) return { src: url }
  return { src: small, srcSet: `${small} 480w, ${url} 960w`, sizes }
}
