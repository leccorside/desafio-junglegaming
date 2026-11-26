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
- O script usa a API do Lighthouse com o Chromium do Playwright, sobe o `vite preview` na porta 4174 e audita `/` e `/nft/nft-042`. O Lighthouse limpa o armazenamento a cada medição, então cada uma começa no banco das fixtures e registra o service worker do MSW do zero, como numa primeira visita.
- Relatórios HTML e JSON salvos em `lighthouse/reports/`: `<página>-<perfil>.report.{html,json}` (a medição com a Performance mediana) e `summary.json` (as três medições de cada página e perfil, as medianas e o ambiente).

## Resultados

Medianas de três medições por página e perfil, em 26/11/2026.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 78 | 100 | 100 | 100 | 4,33 s | 0 | 316 ms |
| Início | Desktop | 98 | 100 | 100 | 100 | 1,06 s | 0,002 | 0 ms |
| Detalhe | Mobile | 70 | 100 | 100 | 100 | 4,51 s | 0 | 553 ms |
| Detalhe | Desktop | 99 | 100 | 100 | 100 | 0,95 s | 0 | 40 ms |

As três medições de cada linha variaram no máximo 1 ponto de Performance (`summary.json`).

Antes das otimizações deste passo, com o mesmo protocolo:

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
- Skeletons com as dimensões do conteúdo final, para manter o CLS baixo.
- Devtools do Query só em desenvolvimento.
- Metadados por rota: título (do `h1` da tela) e `<meta name="description">` por rota, com o nome do NFT no detalhe (`lib/page-title.ts`, aplicados pelo `RouteFocus`), `lang="pt-BR"` e links rastreáveis.
- `public/robots.txt` libera o catálogo e o detalhe e bloqueia as telas da conta (carrinho, pagamento, pedidos, perfil, carteiras, lista de interesse). Sem ele, o rewrite da Vercel devolvia o `index.html` em `/robots.txt` e o Lighthouse acusava 38 erros de sintaxe (SEO 92).

## Resultados abaixo da meta

### Performance mobile: início 78 e detalhe 70 (meta 90)

Accessibility, Best Practices e SEO ficaram em 100 nos quatro casos, e Performance desktop ficou em 98 e 99. Abaixo da meta só a Performance no perfil mobile, puxada pelo LCP (4,3 a 4,5 s) e, no detalhe, pelo TBT (553 ms).

**Causa.** Sem throttling, o LCP observado nas mesmas medições é de 0,4 s no início e 0,5 s no detalhe. A diferença vem da simulação de 4G lento (1,6 Mbps) com CPU 4× mais lenta, que cobra cada byte e cada milissegundo de JavaScript do caminho até a primeira renderização. Nada aparece antes de o MSW estar ativo, porque nenhuma requisição pode sair dos mocks. Por isso o caminho crítico tem cerca de 430 KB de JavaScript (gzip):

| Parte | gzip | Observação |
| --- | ---: | --- |
| MSW e a API simulada (`browser`, `scenarios`, `store` e dependências) | ~187 KB | 43% do total. O `msw` sozinho traz `tough-cookie` e `tldts` (lista de sufixos públicos), quase 300 KB de fonte que o app não usa (a sessão não usa cookie). Só a execução desse chunk leva 430 a 470 ms no mobile simulado. |
| React DOM, TanStack Router e Query, Axios, Radix do layout | ~180 KB | Base da aplicação. |
| Zod e os contratos (`env`) | ~33 KB | Validação das respostas. |
| Ícones do Figma, CSS e o restante | ~30 KB | |

No detalhe, o elemento do LCP é a imagem do NFT, cuja URL vem da API: ela só pode ser pedida depois do MSW e da resposta de `GET /nfts/nft-042`. O TBT maior do detalhe vem da renderização da tela com dados (tarefa de 380 ms) somada à execução do MSW.

**O que foi feito e o efeito.** O preload das fontes zerou o CLS. O `modulepreload` do MSW baixa o chunk junto com o bundle principal e tirou 0,2 a 0,3 s do LCP mobile (detalhe: 65 → 70). O `robots.txt` levou o SEO a 100.

**O que foi avaliado e não feito.**

- *Renderizar o layout antes do MSW ficar pronto e segurar as requisições até lá.* Exigiria uma barreira no cliente Axios e no socket só por causa dos mocks, contra a regra de não ter caminho de mock fora de `src/mocks`, e não ajudaria o detalhe, cujo LCP depende da API.
- *Trocar o `tough-cookie` do MSW por um stub (alias no Vite).* Tiraria cerca de 50 KB, mas mexe no funcionamento interno de uma dependência obrigatória da stack. O ganho estimado (0,3 s) não leva a 90 sozinho.
- *Montar uma versão mais leve só para a auditoria.* O protocolo exige auditar as mesmas imagens, fontes e funcionalidades da entrega.

Numa implantação com backend real, o chunk do MSW e o registro do service worker não existem. O caminho crítico cai para cerca de 240 KB, e a imagem do detalhe sai na primeira resposta da API.
