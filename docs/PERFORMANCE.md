# Performance e Lighthouse

## Metas

| Categoria | Meta |
| --- | ---: |
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 90 |

## Protocolo da auditoria

- Páginas: início e detalhe de um NFT fixo das fixtures.
- Perfis: mobile (padrão do Lighthouse, com throttling simulado) e desktop (preset desktop).
- Build de produção (`npm run build` + `npm run preview`) com o cenário padrão dos mocks.
- Três medições por página e perfil. O relatório usa a mediana de cada categoria.
- A auditoria carrega as mesmas imagens, fontes e funcionalidades da entrega, sem versão simplificada.
- Configuração versionada em `lighthouse/run.mjs` e executada por `npm run lighthouse` (gera o build `--mode mocks` antes; `node lighthouse/run.mjs --skip-build` reaproveita o `dist/`).
- O script usa a API do Lighthouse com o Chromium do Playwright, sobe o `vite preview` na porta 4174 e audita `/` e `/nft/nft-042`. Cada medição roda num Chrome novo, com perfil limpo: começa no banco das fixtures e registra o service worker do MSW do zero, como numa primeira visita. Uma medição que passa de 120 s ou perde a conexão com o Chrome é repetida (até duas vezes); isso aconteceu em execuções longas com um Chrome só para todas as medições.
- Relatórios HTML e JSON salvos em `lighthouse/reports/`: `<página>-<perfil>.report.{html,json}` (a medição com a Performance mediana) e `summary.json` (as três medições de cada página e perfil, as medianas e o ambiente).

## Resultados

Medianas de três medições por página e perfil, em 26/11/2026.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 83 | 100 | 100 | 100 | 4,03 s | 0 | 227 ms |
| Início | Desktop | 99 | 100 | 100 | 100 | 0,95 s | 0,002 | 0 ms |
| Detalhe | Mobile | 73 | 100 | 100 | 100 | 4,27 s | 0 | 466 ms |
| Detalhe | Desktop | 99 | 100 | 100 | 100 | 0,93 s | 0 | 26 ms |

As três medições de cada linha variaram no máximo 1 ponto de Performance (`summary.json`).

### Stub do tough-cookie no MSW

O MSW 2.15 importa o `tough-cookie` só para o cookie store dele, e o `tough-cookie` traz o `tldts` (lista de sufixos públicos da internet). No build do navegador, um alias no `vite.config.ts` troca o pacote por `src/mocks/shims/tough-cookie.ts`, que implementa o que o MSW usa (domínio, caminho, validade, `Secure`, localhost como contexto seguro) e lê o formato que o pacote real deixava no `localStorage`. Os testes unitários seguem com o pacote real e comparam os dois.

O chunk do MSW foi de 457 kB (170 kB gzip) para 157 kB (46 kB gzip). Mesmo script, uma medição logo depois da outra:

| Página | Perfil | Performance antes → depois | LCP antes → depois | TBT antes → depois |
| --- | --- | ---: | ---: | ---: |
| Início | Mobile | 80 → 83 | 4,32 → 4,03 s | 280 → 227 ms |
| Início | Desktop | 98 → 99 | 1,05 → 0,95 s | 0 → 0 ms |
| Detalhe | Mobile | 71 → 73 | 4,66 → 4,27 s | 475 → 466 ms |
| Detalhe | Desktop | 99 → 99 | 0,95 → 0,93 s | 26 → 26 ms |

Diferença conhecida: um `Set-Cookie` vencido (`Max-Age=0`) some do `localStorage` na hora; o `tough-cookie` real deixa o registro até a próxima leitura. Nos dois casos o cookie deixa de ir na requisição.

### Detalhe em duas renderizações e menus sob demanda

Medição de 26/11/2026 depois da primeira versão desta página. A primeira renderização do detalhe montava a página inteira numa tarefa só (368 ms na produção, 379 ms no `vite preview`), e o Radix Menu, o Popper e o floating-ui do menu da conta vinham no bundle inicial de todas as páginas. As duas colunas foram medidas com o mesmo script (Chrome novo por medição), uma logo depois da outra:

| Página | Perfil | Performance antes → depois | LCP antes → depois | TBT antes → depois |
| --- | --- | ---: | ---: | ---: |
| Início | Mobile | 79 → 80 | 4,32 → 4,32 s | 300 → 280 ms |
| Início | Desktop | 99 → 98 | 1,01 → 1,05 s | 0 → 0 ms |
| Detalhe | Mobile | 70 → 71 | 4,51 → 4,66 s | 535 → 475 ms |
| Detalhe | Desktop | 99 → 99 | 0,94 → 0,95 s | 38 → 26 ms |

- A maior tarefa do detalhe mobile caiu de 379 para 306 ms. O que sobrou nela é a primeira renderização do layout e do topo do detalhe: o router entrega a tela pronta num `useSyncExternalStore`, que o React renderiza de forma síncrona, sem como fatiar.
- O chunk principal passou de 116 para 110 KB (gzip). O ganho é pequeno porque o floating-ui e o Popper continuam no carregamento do início (filtros e ordenação do catálogo) e o `Dialog` do Radix continua no header (busca).
- O LCP do detalhe mobile subiu 0,15 s: a segunda renderização roda enquanto a imagem do NFT ainda chega. Segurar a parte de baixo até a imagem carregar não mudou o LCP medido e deixaria as abas esperando até a imagem numa rede lenta, então ficou de fora. Na soma, a Performance subiu 1 ponto.
- Avaliado e desfeito: tirar a página do detalhe do bundle principal (esqueleto em arquivo próprio) baixou o chunk principal para 94 KB, mas a página passou a depender de mais uma leva de requisições depois do MSW e o LCP do detalhe mobile foi a 4,93 s (Performance 67). Aquecer o `tailwind-merge` enquanto o MSW inicia também não mudou o resultado.

Antes das otimizações deste passo, com o mesmo protocolo (um Chrome só para todas as medições):

| Página | Perfil | Performance | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 78 | 92 | 4,51 s | 0,001 | 308 ms |
| Início | Desktop | 98 | 92 | 1,08 s | 0,004 | 0 ms |
| Detalhe | Mobile | 65 | 92 | 4,84 s | 0,001 | 666 ms |
| Detalhe | Desktop | 85 | 92 | 1,09 s | 0,256 | 43 ms |

Accessibility e Best Practices já estavam em 100.

Medição informativa, fora do protocolo: uma execução mobile contra a produção na Vercel (CDN com HTTP/2 e brotli), na mesma máquina, deu Performance 86 no início (LCP 3,20 s, TBT 329 ms) e 76 no detalhe (LCP 3,46 s, TBT 566 ms), com 100 nas outras três categorias. A diferença para o `vite preview` vem da compressão e do transporte, que reduzem o custo de rede simulado.

### Ambiente de execução

| Item | Valor |
| --- | --- |
| Versão do Lighthouse | 13.6.0 (API Node, `lighthouse` + `chrome-launcher` 1.2) |
| Versão do Chrome | HeadlessChrome 159 (Chromium do Playwright 1.65), `--headless=new` |
| Versão do Node.js | 24.13.1 |
| Sistema operacional e máquina | Windows 11 Pro (10.0.26200), Intel Core i7-10700F, 32 GB; `benchmarkIndex` 1653 |
| Throttling | Mobile: padrão do Lighthouse (Moto G Power emulado, 4G lento simulado: 150 ms de RTT, 1,6 Mbps, CPU 4×). Desktop: preset `desktop` (40 ms, 10 Mbps, CPU 1×) |
| Servidor | `vite preview` local (sem CDN; a compressão é do próprio preview) |
| Data | 26/11/2026 |

## Estratégias de otimização

- Code splitting por rota (`autoCodeSplitting` do plugin do TanStack Router): cada tela é um chunk carregado na navegação.
- Imagem do LCP com `fetchpriority="high"` e sem lazy loading. Demais imagens com `loading="lazy"` e `decoding="async"`.
- Imagens em WebP com `srcset` (480 e 960 px), `sizes`, largura e altura declaradas.
- Fontes locais (`@fontsource/roboto-mono`, só latin 400/500/700) com `font-display: swap` e `preload` no `index.html`, injetado no build por `build/preload-hints.ts` (o nome do arquivo tem hash). Sem o preload, as fontes só eram descobertas depois do CSS e chegavam depois da primeira pintura: a troca de fonte deslocava as abas do detalhe (CLS 0,256 no desktop).
- No modo `mocks`, o mesmo plugin põe `modulepreload` no chunk do MSW e nas dependências dele. Antes, o chunk (o maior do build) só começava a baixar depois que o bundle principal executava o `import()` do `enableMocking`.
- Detalhe em duas renderizações: o topo (galeria, preço, compra) primeiro; as abas e "Mais desta coleção" depois da primeira pintura, numa transição do React (`lib/use-after-first-paint.ts`). Até lá, uma reserva de 600 px segura o rodapé fora da tela do desktop (sem ela, o rodapé descia à vista: CLS de 0,097).
- Menu da conta e menu lateral carregados sob demanda (`lib/lazy-module.ts`): até o primeiro uso só existe o botão; o módulo baixa quando o ponteiro passa ou o foco chega a ele, e o menu monta já aberto na ativação, com o mesmo foco do Radix (no teclado, o primeiro item do menu da conta e "Início" no menu lateral).
- Skeletons com as dimensões do conteúdo final, para manter o CLS baixo.
- Devtools do Query só em desenvolvimento.
- Metadados por rota: título (do `h1` da tela) e `<meta name="description">` por rota, com o nome do NFT no detalhe (`lib/page-title.ts`, aplicados pelo `RouteFocus`), `lang="pt-BR"` e links rastreáveis.
- `public/robots.txt` libera o catálogo e o detalhe e bloqueia as telas da conta (carrinho, pagamento, pedidos, perfil, carteiras, lista de interesse). Sem ele, o rewrite da Vercel devolvia o `index.html` em `/robots.txt` e o Lighthouse acusava 38 erros de sintaxe (SEO 92).

## Resultados abaixo da meta

### Performance mobile: início 83 e detalhe 73 (meta 90)

Accessibility, Best Practices e SEO ficaram em 100 nos quatro casos, e Performance desktop ficou em 99 nas duas páginas. Abaixo da meta só a Performance no perfil mobile, puxada pelo LCP (4,0 a 4,3 s) e, no detalhe, pelo TBT (466 ms).

**Causa.** Sem throttling, o LCP observado nas mesmas medições é de 0,4 s no início e 0,5 s no detalhe. A diferença vem da simulação de 4G lento (1,6 Mbps) com CPU 4× mais lenta, que cobra cada byte e cada milissegundo de JavaScript do caminho até a primeira renderização. Nada aparece antes de o MSW estar ativo, porque nenhuma requisição pode sair dos mocks. Com o stub do `tough-cookie`, o caminho crítico tem cerca de 300 KB de JavaScript (gzip):

| Parte | gzip | Observação |
| --- | ---: | --- |
| MSW e a API simulada (`browser`, `scenarios`, `store` e dependências) | ~63 KB | Antes do stub, ~187 KB (`tough-cookie` e `tldts`). |
| React DOM, TanStack Router e Query, Axios, Radix do layout | ~175 KB | Base da aplicação. |
| Zod e os contratos (`env`) | ~33 KB | Validação das respostas. |
| Ícones do Figma, CSS e o restante | ~30 KB | |

O que pesa agora é a própria aplicação: React DOM, o router e a primeira renderização síncrona da tela, que no detalhe ainda é uma tarefa de cerca de 300 ms com a CPU 4× mais lenta.

No detalhe, o elemento do LCP é a imagem do NFT, cuja URL vem da API: ela só pode ser pedida depois do MSW e da resposta de `GET /nfts/nft-042`. O TBT maior do detalhe vem da primeira renderização da tela com dados (tarefa de 306 ms depois de adiar as abas e "Mais desta coleção"; antes, 380 ms) somada à execução do MSW.

**O que foi feito e o efeito.** O preload das fontes zerou o CLS. O `modulepreload` do MSW baixa o chunk junto com o bundle principal e tirou 0,2 a 0,3 s do LCP mobile (detalhe: 65 → 70). O `robots.txt` levou o SEO a 100. Depois, adiar a parte de baixo do detalhe e carregar os menus sob demanda tirou 60 ms do TBT do detalhe mobile e 20 ms do início. O stub do `tough-cookie` tirou 124 KB gzip do chunk do MSW e 0,3 a 0,4 s do LCP mobile (início 80 → 83, detalhe 71 → 73). Detalhes nas seções acima.

**O que foi avaliado e não feito.**

- *Renderizar o layout antes do MSW ficar pronto e segurar as requisições até lá.* Exigiria uma barreira no cliente Axios e no socket só por causa dos mocks, contra a regra de não ter caminho de mock fora de `src/mocks`, e não ajudaria o detalhe, cujo LCP depende da API.
- *Montar uma versão mais leve só para a auditoria.* O protocolo exige auditar as mesmas imagens, fontes e funcionalidades da entrega.

Numa implantação com backend real, o chunk do MSW e o registro do service worker não existem. O caminho crítico cai para cerca de 240 KB, e a imagem do detalhe sai na primeira resposta da API.

Observação: o stub do `tough-cookie` é um alias de build sobre o funcionamento interno do MSW 2.15. Ao atualizar o MSW, conferir se o `msw/lib/core/utils/cookieStore.mjs` ainda usa só `Cookie`, `CookieJar` e `MemoryCookieStore`; o `msw-cookie-shim.spec.ts` e os testes unitários do stub pegam a quebra.
