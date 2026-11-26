import type { Plugin, Rollup } from 'vite'

/**
 * Dicas de carregamento no `index.html` do build:
 *
 * - `preload` das fontes Roboto Mono (400, 500 e 700). Sem isso o navegador só
 *   descobre as fontes depois de baixar e aplicar o CSS, o texto aparece com a
 *   fonte reserva e muda de largura quando elas chegam (CLS de 0,256 no
 *   detalhe, medido pelo Lighthouse).
 * - No modo `mocks`, `modulepreload` do chunk do MSW e das dependências dele.
 *   O `enableMocking` importa esse chunk dinamicamente, então ele só começava
 *   a baixar depois que o bundle principal executava; com a dica, os dois
 *   baixam juntos. Fora do modo `mocks` o chunk nem existe.
 */
export function preloadHints(mode: string): Plugin {
  return {
    name: 'kurio:preload-hints',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle as Rollup.OutputBundle | undefined
        if (!bundle) return []

        const fonts = Object.keys(bundle)
          .filter((file) => /roboto-mono-latin-(400|500|700)-normal-[\w-]+\.woff2$/.test(file))
          .sort()
          .map((file) => ({
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `/${file}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head-prepend' as const,
          }))

        const mocks: string[] = []
        if (mode === 'mocks') {
          const entry = Object.values(bundle).find(
            (item) =>
              item.type === 'chunk' &&
              item.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/mocks/browser.ts'),
          )
          const visit = (file: string) => {
            const chunk = bundle[file]
            if (!chunk || chunk.type !== 'chunk' || mocks.includes(file)) return
            mocks.push(file)
            chunk.imports.forEach(visit)
          }
          if (entry) visit(entry.fileName)
        }
        // O Vite já põe `modulepreload` nas dependências estáticas do bundle principal.
        const scripts = mocks
          .filter((file) => !html.includes(`/${file}"`))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: '', href: `/${file}` },
            injectTo: 'head' as const,
          }))

        return [...fonts, ...scripts]
      },
    },
  }
}
