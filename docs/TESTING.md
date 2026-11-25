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

| `src/mocks/scenarios/scenarios.test.ts` | Cenários: leitura da URL, opções mantidas pelo painel, sequência reproduzível do `jitter` (`planNetwork`), plano de cada cenário de rede e storage corrompido |
| `src/mocks/api.test.ts` | 43 testes de integração da API simulada: `fetch` real contra os handlers via `msw/node`, com cada resposta validada pelo schema do contrato. Cobrem sessão, cadastro, catálogo (filtros, facetas, busca, abas, paginação), favoritos, carrinho, cupons, cotação, merge, pedidos (idempotência, confirmação, recusa, `QUOTE_OUTDATED`, timeout), perfil, avatar, senha, carteiras, cenários de rede e reset |
| `src/mocks/fixtures/fixtures.test.ts` | Fixtures determinísticas, válidas pelos contratos, com os NFTs do Figma e os casos fixos |
| `src/mocks/db/store.test.ts` | Persistência no `localStorage` entre carregamentos e quando a regra termina em erro, fallback para as fixtures e reset |

O `setupMockServer()` de `src/mocks/test-utils.ts` sobe o MSW em Node e reinicia banco e cenário antes de cada teste.

O `vitest.config.ts` é separado do `vite.config.ts`, para os testes não carregarem o plugin de rotas nem o Tailwind.

## Projetos do Playwright

| Projeto | Viewport |
| --- | --- |
| `desktop` | 1440 × 900 |
| `mobile` | 390 × 844 (perfil de dispositivo móvel do Chromium) |

Os fluxos principais rodam nos dois. Verificações de layout pontuais usam também 768 px.

O `webServer` do Playwright gera o build com `--mode mocks` e serve com `vite preview` na porta 4173. Assim os testes rodam contra o mesmo bundle que vai para a Vercel, com o service worker do MSW de verdade. Fora do CI, um servidor já aberto nessa porta é reaproveitado.

## Isolamento

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
| 12 | Skeletons com carregamento lento, feedback de falha e recuperação | `loading-states.spec.ts` |

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
