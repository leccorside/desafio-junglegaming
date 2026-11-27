/**
 * As imagens dos NFTs existem em 480, 720 e 960 px de largura
 * (public/images/nfts, exportadas do Figma). A API devolve a versão de 960;
 * daqui sai o `srcset` para o navegador escolher pelo tamanho exibido. A de
 * 720 atende o detalhe no celular (cerca de 380 px CSS em tela de densidade 2),
 * que sem ela baixava a de 960: 55 a 69 kB contra 26 a 36 kB.
 */
export function nftImageSources(url: string, sizes: string) {
  const small = url.replace(/-960\.webp$/, '-480.webp')
  if (small === url) return { src: url }
  const medium = url.replace(/-960\.webp$/, '-720.webp')
  return { src: small, srcSet: `${small} 480w, ${medium} 720w, ${url} 960w`, sizes }
}

/** `sizes` da imagem principal do detalhe (galeria). */
export const GALLERY_IMAGE_SIZES = '(min-width: 768px) 412px, 100vw'

/**
 * Começa a baixar uma imagem com o mesmo `srcset`/`sizes` que a tela vai usar,
 * para o navegador escolher a mesma versão e reaproveitar o download quando o
 * `<img>` aparecer. Serve para a imagem do LCP não esperar a renderização.
 */
export function preloadNftImage(url: string, sizes: string) {
  if (typeof Image === 'undefined') return
  const { src, srcSet } = nftImageSources(url, sizes)
  const image = new Image()
  image.fetchPriority = 'high'
  if (srcSet) {
    image.sizes = sizes
    image.srcset = srcSet
  }
  image.src = src
}
