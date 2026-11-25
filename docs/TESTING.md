# Testes

## Ferramentas

- Playwright para E2E e regressão visual, em Chromium.
- `@axe-core/playwright` para checagens automáticas de acessibilidade.
- Vitest para testes unitários de utilitários (decimal, formatação, aplicação de eventos), se necessário.

## Projetos do Playwright

| Projeto | Viewport |
| --- | --- |
| `desktop` | 1440 × 900 |
| `mobile` | 390 × 844 (perfil de dispositivo móvel do Chromium) |

Os fluxos principais rodam nos dois. Verificações de layout pontuais usam também 768 px.

## Isolamento

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
