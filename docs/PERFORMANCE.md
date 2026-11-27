# Performance e Lighthouse

## Metas

| Categoria | Meta |
| --- | ---: |
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 90 |

## Protocolo da auditoria

- Páginas: início (`/`) e detalhe de um NFT fixo das fixtures (`/nft/nft-042`).
- Perfis: mobile (padrão do Lighthouse, com throttling simulado) e desktop (preset desktop).
- Build otimizado com o cenário padrão dos mocks (`npm run build -- --mode mocks`), o mesmo que vai para a Vercel.
- Três medições por página e perfil. O relatório usa a mediana de cada categoria e de cada métrica.
- A auditoria carrega as mesmas imagens, fontes e funcionalidades da entrega, sem versão simplificada.
- Configuração versionada em `lighthouse/run.mjs`, com a API do Lighthouse e o Chromium do Playwright. Cada medição roda num Chrome novo, com perfil limpo: começa no banco das fixtures e registra o service worker do MSW do zero, como numa primeira visita. Uma medição que passa de 120 s ou perde a conexão com o Chrome é repetida (até duas vezes).
- **Medição oficial: a produção** (`npm run lighthouse:prod`, que audita <https://desafio-junglegaming-two.vercel.app>). É o build entregue, servido como quem avalia vai acessá-lo. Relatórios em `lighthouse/reports/desafio-junglegaming-two.vercel.app/`.
- **Referência local:** `npm run lighthouse` gera o build e audita o `vite preview` na porta 4174 (`node lighthouse/run.mjs --skip-build` reaproveita o `dist/`). Relatórios em `lighthouse/reports/`.
- Em cada pasta: `<página>-<perfil>.report.{html,json}` (a medição com a Performance mediana) e `summary.json` (as três medições, as medianas e o ambiente).

## Resultados

### Produção (oficial)

Medianas de três medições por página e perfil, em 27/11/2026.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 92 | 100 | 100 | 100 | 2,49 s | 0 | 255 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 0,62 s | 0,002 | 1 ms |
| Detalhe | Mobile | 95 | 100 | 100 | 100 | 2,48 s | 0 | 185 ms |
| Detalhe | Desktop | 100 | 100 | 100 | 100 | 0,56 s | 0 | 0 ms |

Todas as metas foram atingidas, em todas as medições: a menor Performance foi 91 (início mobile; as três deram 91, 92 e 93; no detalhe, 95, 95 e 96).

### `vite preview` local (referência)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 86 | 100 | 100 | 100 | 3,69 s | 0 | 209 ms |
| Início | Desktop | 99 | 100 | 100 | 100 | 0,92 s | 0,002 | 0 ms |
| Detalhe | Mobile | 85 | 100 | 100 | 100 | 3,96 s | 0 | 171 ms |
| Detalhe | Desktop | 99 | 100 | 100 | 100 | 0,86 s | 0 | 0 ms |

**Por que a produção pontua mais.** O JavaScript é o mesmo (36 arquivos, 298 KB transferidos no local e 302 KB na produção, 1.045 KB sem compressão). Muda o transporte. O `vite preview` serve por HTTP/1.1: na simulação do Lighthouse, o navegador abre no máximo 6 conexões por origem, cada uma começando devagar, e os 36 arquivos esperam em fila. A Vercel serve por HTTP/2, com todos os arquivos na mesma conexão. No 4G lento simulado, isso dá 1,2 a 1,5 s de LCP a menos. O TBT é parecido nas duas, porque depende da CPU.

### Evolução

Medianas do perfil mobile, no `vite preview` (a coluna de produção só existe a partir da medição oficial):

| Etapa | Início | Detalhe |
| --- | ---: | ---: |
| Antes do Passo 15 | 78 | 65 |
| Preload das fontes, `modulepreload` do MSW, `robots.txt` | 78 | 70 |
| Detalhe em duas renderizações, menus sob demanda | 80 | 71 |
| Stub do `tough-cookie` (chunk do MSW: 170 → 46 KB gzip) | 83 | 73 |
| Painel ocioso, montagem em transição, detalhe com Suspense, fontes sem preload, busca sob demanda, router carregado antes da montagem, renderização por tamanho de tela | 86 | 85 |
| **Produção (oficial), mesma versão** | **92** | **95** |

### Ambiente de execução

| Item | Valor |
| --- | --- |
| Versão do Lighthouse | 13.6.0 (API Node, `lighthouse` + `chrome-launcher` 1.2) |
| Versão do Chrome | HeadlessChrome 159 (Chromium do Playwright 1.65), `--headless=new` |
| Versão do Node.js | 24.13.1 |
| Sistema operacional e máquina | Windows 11 Pro (10.0.26200), Intel Core i7-10700F, 32 GB; `benchmarkIndex` cerca de 1650 |
| Throttling | Mobile: padrão do Lighthouse (Moto G Power emulado, 4G lento simulado: 150 ms de RTT, 1,6 Mbps, CPU 4×). Desktop: preset `desktop` (40 ms, 10 Mbps, CPU 1×) |
| Servidor | Produção: Vercel (CDN, HTTP/2). Referência: `vite preview` local (HTTP/1.1, gzip) |
| Data | 27/11/2026 |

## Estratégias de otimização

### Carregamento inicial

- Code splitting por rota (`autoCodeSplitting` do plugin do TanStack Router).
- `modulepreload` do chunk do MSW e das dependências dele, injetado no build por `build/preload-hints.ts`: antes, o chunk só começava a baixar depois que o bundle principal executava o `import()` do `enableMocking`.
- Stub do `tough-cookie` no build do navegador (alias no `vite.config.ts`, `src/mocks/shims/tough-cookie.ts`). O MSW 2.15 usa o pacote só no cookie store dele, e o pacote traz o `tldts` (lista de sufixos públicos): o chunk do MSW foi de 457 kB (170 kB gzip) para 157 kB (46 kB gzip). O stub cobre domínio, caminho, validade, `Secure` (localhost como contexto seguro) e lê o formato que o pacote real deixava no `localStorage`; os testes unitários comparam os dois. Diferença conhecida: um cookie vencido some do `localStorage` na hora, em vez de esperar a próxima leitura.
- Menu da conta, menu lateral e busca do header carregados sob demanda (`lib/lazy-module.ts`): até o primeiro uso só existe o botão; o módulo baixa quando o ponteiro passa ou o foco chega a ele, e o componente monta já aberto na ativação, com o mesmo foco de antes. Radix Menu, Popper, floating-ui e o `Dialog` saíram do bundle inicial.
- Painel de cenários (ferramenta da demonstração) carregado só depois do `load`, com o navegador ocioso (`hooks/use-idle.ts`).
- Fontes sem preload: no 4G lento, os 39 KB delas disputavam banda com o JavaScript (0,3 s de LCP). No lugar, uma fonte reserva com as mesmas medidas (`Roboto Mono Fallback`, sobre Courier New, Liberation Mono ou Cousine, com `ascent-override` e `descent-override`): enquanto a Roboto Mono não chega, o texto já ocupa o espaço final, e a troca não desloca nada. A reserva anterior (Consolas, 0,55 em contra 0,6 em) deslocava o texto: CLS de até 0,25.

### Primeira renderização

- O router resolve a rota (`router.load()`) antes da montagem, e a árvore é montada numa transição do React: a renderização é fatiada em pedaços pequenos. Antes, o router atualizava o próprio estado no meio da montagem e o React renderizava a página inteira de uma vez (344 ms com a CPU 4× na tela inicial; depois, a maior tarefa caiu para cerca de 150 ms).
- Primeira chamada do `tailwind-merge` (monta a configuração, cerca de 40 ms com CPU 4×) numa tarefa à parte, enquanto o MSW inicia.
- Detalhe: o loader só inicia a busca do NFT; a página suspende até ele chegar, e a renderização com os dados vira uma retentativa de Suspense, que o React também fatia. A imagem principal começa a baixar assim que a resposta da API chega, sem esperar a renderização. O esqueleto ocupa a altura da tela, para o rodapé não descer à vista quando a página entra.
- Detalhe em duas renderizações: abas e "Mais desta coleção" entram depois da primeira pintura (`lib/use-after-first-paint.ts`), com uma reserva de 600 px para o rodapé.
- Header, barra inferior e destaque da tela inicial são renderizados só no tamanho de tela em que aparecem. Antes, a versão escondida entrava no DOM, e no celular a versão desktop do destaque ainda baixava a imagem de 450 px com prioridade alta.

### Imagens, layout e SEO

- Imagem do LCP com `fetchpriority="high"` e sem lazy loading; demais com `loading="lazy"` e `decoding="async"`.
- WebP em 480, 720 e 960 px com `srcset` e `sizes`, largura e altura declaradas. A de 720 atende o detalhe no celular, que antes baixava a de 960.
- Skeletons com as dimensões do conteúdo final.
- Devtools do Query só em desenvolvimento.
- Título e `<meta name="description">` por rota (`lib/page-title.ts`, aplicados pelo `RouteFocus`), `lang="pt-BR"` e links rastreáveis.
- `public/robots.txt` libera o catálogo e o detalhe e bloqueia as telas da conta. Sem ele, o rewrite da Vercel devolvia o `index.html` em `/robots.txt` (SEO 92).

## O que foi medido e desfeito

- **Juntar os chunks iniciais em poucos arquivos** (grupos `vendor` e `mocks` no Rolldown): menos idas e voltas, mas um arquivo grande vira uma tarefa longa de execução. O TBT subiu (289 e 346 ms) e a Performance caiu.
- **Renderizar antes de o MSW ficar pronto, segurando as requisições à API** (como o `waitUntilReady` do MSW 1): o LCP piorou (início 82, detalhe 81). A simulação é dominada pelo volume de bytes, e mudar a ordem do trabalho não ajuda.
- **Tirar a página do detalhe do bundle principal:** baixou o chunk principal para 94 KB, mas a página passou a depender de mais uma leva de requisições depois do MSW (LCP do detalhe a 4,93 s, Performance 67).
- **Adiar promoções e blog na tela inicial:** a entrada tardia virou uma tarefa grande de estilo e layout (TBT de 168 para 250 ms).
- **Procurar o título da tela (`RouteFocus`) depois da pintura**, para evitar o `checkVisibility` no commit: o TBT piorou (291 ms).
- **Segurar a parte de baixo do detalhe até a imagem carregar:** LCP igual, e as abas esperariam a imagem numa rede lenta.

## Pontos de atenção

- O stub do `tough-cookie` é um alias de build sobre o funcionamento interno do MSW 2.15. Ao atualizar o MSW, conferir se o `msw/lib/core/utils/cookieStore.mjs` ainda usa só `Cookie`, `CookieJar` e `MemoryCookieStore`; o `msw-cookie-shim.spec.ts` e os testes unitários do stub pegam a quebra.
- Como o layout aparece antes dos dados no detalhe, um `nft.updated` pode chegar com a primeira busca do NFT ainda em andamento. O app trata isso (busca de novo quando a primeira termina, `apply-nft-updated.ts`), e os testes de tempo real esperam o NFT na tela antes de mudar o preço.
- Na medição local (HTTP/1.1) o mobile fica abaixo de 90 (85 e 86). A meta vale para o build entregue, medido na produção.
