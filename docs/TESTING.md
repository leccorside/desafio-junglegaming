# Testes

## Ferramentas

- Playwright para E2E e regressão visual, em Chromium.
- `@axe-core/playwright` para checagens automáticas de acessibilidade.
- Vitest para testes unitários de regras puras, em `src/**/*.test.ts` (`npm run test:unit`).

## Testes unitários

| Arquivo | O que cobre |
| --- | --- |
| `src/lib/eth.test.ts` | Soma, subtração, multiplicação e porcentagem sem ponto flutuante; 18 casas (1 wei); resumo do carrinho do Figma (26.83 + 0.016 = 26.846 ETH); erros com valor inválido, quantidade fracionária e resultado negativo; `formatEth` com 2 a 4 casas e "< 0.0001 ETH" |
| `src/api/contracts/contracts.test.ts` | Formato de valor em ETH, status HTTP de todo código de erro, corpo de erro, regras de cadastro e senha, padrões e ida e volta da query string do catálogo, endereço por rede, pedido, estados terminais e envelope dos eventos |

| `src/api/client.test.ts` | `normalizeError` (corpo do contrato, timeout, rede, cancelamento, resposta HTML), `apiRequest` contra os handlers reais (validação pelo schema, `INVALID_RESPONSE`, erros viram `ApiError`), envio do token e do `X-Cart-Id`, aviso de sessão expirada só quando havia token, e política de retry |
| `src/features/auth/session.test.ts` | Sessão contra os handlers reais: telas montadas buscam de novo no fim da sessão, login cancela buscas de visitante, revalidação cancelada devolve `null`, 401 com o token atual expira uma vez, 401 atrasado com token antigo não derruba a sessão nova, 401 durante o logout não vira expiração |
| `src/lib/random-id.test.ts` | UUID v4 com `randomUUID`, sem ele (fora de contexto seguro) e sem Web Crypto |
| `src/features/auth/auth.test.ts` | `safeRedirect` (aceita caminhos internos, recusa URL externa, `//`, `/\`, `javascript:` e as telas de entrada), validade local da sessão e iniciais do avatar |
| `src/mocks/scenarios/scenarios.test.ts` | Cenários: leitura da URL, opções mantidas pelo painel, sequência reproduzível do `jitter` (`planNetwork`), plano de cada cenário de rede e storage corrompido |
| `src/mocks/api.test.ts` | 43 testes de integração da API simulada: `fetch` real contra os handlers via `msw/node`, com cada resposta validada pelo schema do contrato. Cobrem sessão, cadastro, catálogo (filtros, facetas, busca, abas, paginação), favoritos, carrinho, cupons, cotação, merge, pedidos (idempotência, confirmação, recusa, `QUOTE_OUTDATED`, timeout), perfil, avatar, senha, carteiras, cenários de rede e reset |
| `src/features/catalog/search.test.ts` | Estado do catálogo na URL: padrões, valores inválidos trocados pelo padrão, parâmetros da API com 9 por página, faixa de preço invertida, `hasActiveFilters`, `toggleValue` e a janela de páginas com reticências |
| `src/mocks/fixtures/fixtures.test.ts` | Fixtures determinísticas, válidas pelos contratos, com os NFTs do Figma e os casos fixos |
| `src/mocks/db/store.test.ts` | Persistência no `localStorage` entre carregamentos e quando a regra termina em erro, fallback para as fixtures e reset |

O `setupMockServer()` de `src/mocks/test-utils.ts` sobe o MSW em Node, reinicia banco e cenário antes de cada teste e desfaz os overrides de `server.use()` depois de cada um.

O `vitest.config.ts` é separado do `vite.config.ts`, para os testes não carregarem o plugin de rotas nem o Tailwind.

## Projetos do Playwright

| Projeto | Viewport |
| --- | --- |
| `desktop` | 1440 × 900 |
| `mobile` | 390 × 844 (perfil de dispositivo móvel do Chromium) |

Os fluxos principais rodam nos dois. Verificações de layout pontuais usam também 768 px.

O `webServer` do Playwright gera o build com `--mode mocks` e serve com `vite preview` na porta 4173. Assim os testes rodam contra o mesmo bundle que vai para a Vercel, com o service worker do MSW de verdade. Fora do CI, um servidor já aberto nessa porta é reaproveitado.

## Isolamento

- `tests/fixtures/auth.ts` tem os helpers de sessão: `submitLogin`, `loginViaUi`, `logoutViaUi` (menu do header no desktop, menu lateral no mobile), `storedSession` e `isMobileViewport`. Os campos são buscados pelo rótulo exato (`getByLabel('E-mail', { exact: true })`), porque o footer tem "E-mail para a newsletter".
- Para conferir que algo **não** aparece (ex.: o toast duplicado de expiração), espere o tempo de aparecer e use leitura única (`expect(await locator.count()).toBe(0)`). O `toHaveCount(0)` tenta de novo por 5 s e passa quando o toast some sozinho, então não prova nada. Ver `expectNoPublicExpiryToast`.
- `tests/e2e/auth.spec.ts` cobre o item 3 do enunciado: cadastro com sessão mantida no refresh, conflito de e-mail no campo, validação no cliente, credenciais erradas, rota privada → login → volta, open redirect recusado, visitante logado fora do login, modal com foco no e-mail e Esc (desktop), tela cheia sem barra inferior (mobile), expiração ao abrir rota privada e durante a navegação no app, logout e troca de usuário, e toasts da conta anterior fechando no fim da sessão (some em até 1 s depois do logout, antes do fechamento automático de 4 s do Sonner, e o texto da página do Bruno não tem nada da Ana).
- `tests/e2e/toasts.spec.ts` mede a posição real dos toasts: em 390 px, acima da barra inferior e, com o menu lateral aberto, acima do botão "Sair"; em 700 px (Sonner em layout de desktop, mas com barra), acima da barra; no desktop, a 24 px da base.
- `tests/e2e/catalog.spec.ts` cobre o item 1 e a parte do catálogo do item 12: primeira página com 9 NFTs, busca (lupa do header no desktop, campo com debounce no mobile) voltando à página 1, filtros combinados e ordenação na URL e depois do refresh, paginação com voltar e avançar, abas, card que leva ao detalhe, URL inválida, busca sem resultado com "Limpar filtros", catálogo vazio (`empty-catalog`), skeleton com `slow`, erro com `server-error` e recuperação por "Tentar de novo", respostas fora de ordem com `jitter` (o resultado final é sempre o do último filtro), links de Coleções do footer e ausência de rolagem horizontal. Os totais esperados vêm da própria API simulada (`apiFetch`), não de números fixos.
- `tests/fixtures/mocks.ts` tem os helpers prontos: `apiFetch` (chamada à API de dentro da página, passando pelo service worker, o que o `page.request` não faz), `resetMocks`, `setScenario` e `waitForApp`. A spec `tests/e2e/mocks.spec.ts` usa esses helpers para conferir a API simulada no navegador.
- Cada teste começa com o reset do banco dos mocks, `localStorage` e `sessionStorage` limpos e o cenário escolhido.
- Fixtures do Playwright em `tests/fixtures` expõem helpers: `scenario(name)`, `resetMocks()`, `login(user)`, `emitNftUpdated(...)`, `emitOrderUpdated(...)`, `dropSocket()`.
- Relógio controlado com `page.clock` nos cenários de expiração, timeout e pedido pendente.
- Latência e disparo de eventos controlados pelos cenários, nunca por espera fixa.

## Regras

- As asserções olham a interface e o resultado das operações (texto visível, URL, estado da API simulada).
- Testes de REST passam pelos handlers MSW. Testes de tempo real passam pelo cliente Socket.IO.
- Sem `waitForTimeout` para sincronizar. Usar asserções com espera automática.
- Seletores por papel e nome acessível (`getByRole`, `getByLabel`), o que também valida a semântica.

## Cobertura exigida

| # | Cenário | Spec |
| --- | --- | --- |
| 1 | Busca, filtros combinados, ordenação, paginação e restauração pelo histórico | `catalog.spec.ts` |
| 2 | Acesso direto ao detalhe e recurso inexistente | `nft-detail.spec.ts` |
| 3 | Cadastro, login, expiração de sessão, logout e troca de usuário | `auth.spec.ts` |
| 4 | Favoritos, falha de mutation e recuperação do estado | `favorites.spec.ts` |
| 5 | Carrinho, quantidades, remoção, cupom e persistência depois de refresh e login | `cart.spec.ts` |
| 6 | Compra completa, do catálogo ao recibo confirmado | `purchase.spec.ts` |
| 7 | Falha de pagamento, clique repetido e timeout com recuperação do mesmo pedido | `payment-failures.spec.ts` |
| 8 | Perfil, avatar, senha e carteiras, com erros de validação | `account.spec.ts` |
| 9 | Alteração de preço ou disponibilidade via Socket.IO durante o checkout | `realtime-checkout.spec.ts` |
| 10 | Eventos duplicados ou antigos, desconexão e retomada de pedido pendente | `realtime-resilience.spec.ts` |
| 11 | Navegação por teclado, foco em diálogos e validação de formulários | `a11y.spec.ts` |
| 12 | Skeletons com carregamento lento, feedback de falha e recuperação | `catalog.spec.ts` (catálogo); `loading-states.spec.ts` (demais telas) |

## Regressão visual

- Telas: início, detalhe, carrinho e pagamento, em desktop e mobile.
- Baselines versionadas em `tests/e2e/__screenshots__`.
- Dados estáveis (fixtures fixas, relógio congelado), animações desligadas e fontes carregadas antes da captura.
- Atualização com `npm run test:e2e:update`, sempre revisando a diferença antes de versionar.

## Relatórios

- Relatório HTML do Playwright em `playwright-report/`.
- Trace, screenshot e vídeo guardados nas falhas (`trace: 'retain-on-failure'`).

## Comandos

```bash
npm run test:e2e                 # suíte completa
npx playwright test --project=mobile
npx playwright test cart.spec.ts
npm run test:e2e:update          # atualiza baselines visuais
npx playwright show-report
```
