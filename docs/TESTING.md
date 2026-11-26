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

| `src/api/client.test.ts` | `normalizeError` (corpo do contrato, timeout, rede, cancelamento, resposta HTML), `apiRequest` contra os handlers reais (validação pelo schema, `INVALID_RESPONSE`, erros viram `ApiError`), envio do token e do `X-Cart-Id`, aviso de sessão expirada só quando havia token, e política de retry (2 repetições para rede e 503, 1 para timeout) |
| `src/features/auth/session.test.ts` | Sessão contra os handlers reais: telas montadas buscam de novo no fim da sessão, login cancela buscas de visitante, revalidação cancelada devolve `null`, 401 com o token atual expira uma vez, 401 atrasado com token antigo não derruba a sessão nova, 401 durante o logout não vira expiração |
| `src/lib/random-id.test.ts` | UUID v4 com `randomUUID`, sem ele (fora de contexto seguro) e sem Web Crypto |
| `src/features/auth/auth.test.ts` | `safeRedirect` (aceita caminhos internos, recusa URL externa, `//`, `/\`, `javascript:` e as telas de entrada), validade local da sessão e iniciais do avatar |
| `src/mocks/scenarios/scenarios.test.ts` | Cenários: leitura da URL, opções mantidas pelo painel, sequência reproduzível do `jitter` (`planNetwork`), plano de cada cenário de rede e storage corrompido |
| `src/mocks/api.test.ts` | 43 testes de integração da API simulada: `fetch` real contra os handlers via `msw/node`, com cada resposta validada pelo schema do contrato. Cobrem sessão, cadastro, catálogo (filtros, facetas, busca, abas, paginação), favoritos, carrinho, cupons, cotação, merge, pedidos (idempotência, confirmação, recusa, `QUOTE_OUTDATED`, timeout), perfil, avatar, senha, carteiras, cenários de rede e reset |
| `src/features/catalog/search.test.ts` | Estado do catálogo na URL: padrões, valores inválidos trocados pelo padrão, parâmetros da API com 9 por página, faixa de preço invertida, `hasActiveFilters`, `toggleValue` e a janela de páginas com reticências |
| `src/features/favorites/pending-favorite.test.ts` | Pedido de favoritar do visitante: guarda, lê, consome uma vez, vence em 10 minutos, descarta data no futuro, ignora valor corrompido e limpa (`sessionStorage` em memória, `src/test/memory-storage.ts`) |
| `src/features/cart/cart-cache.test.ts` | `writeCart`: resposta de versão menor não sobrescreve a maior, versão igual ou outro carrinho (merge) gravam, cotações marcadas como velhas sem nova busca |
| `src/features/nft-detail/editions.test.ts` | Edição escolhível, rótulo de esgotada/indisponível, edição padrão (mais barata disponível), edição da URL indisponível ou desconhecida, limite e ajuste da quantidade |
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
- `tests/e2e/catalog.spec.ts` cobre o item 1 e a parte do catálogo do item 12: primeira página com 9 NFTs, busca (lupa do header no desktop, campo com debounce no mobile) voltando à página 1, filtros combinados e ordenação na URL e depois do refresh, paginação com voltar e avançar, abas, card que leva ao detalhe, URL inválida, busca sem resultado com "Limpar filtros", catálogo vazio (`empty-catalog`, com a faixa de preço indisponível em vez de "0,00 - 0,00", sem slider nem "Aplicar", e o hero com a imagem fixa carregada e sem link no lugar do destaque), skeleton com `slow`, timeout com `page.clock` (aviso de demora depois dos primeiros 15 s, só 2 requisições até o erro, recuperação), erro com `server-error` e recuperação por "Tentar de novo" (com o status e os filtros sem nenhum "carregando" durante o erro, e as contagens de volta depois), respostas fora de ordem com `jitter` (o resultado final é sempre o do último filtro), links de Coleções do footer, nome do botão de filtros do mobile com e sem filtro aplicado (ordenar não conta; busca e filtro contam; "Limpar filtros" volta ao nome simples; o foco volta ao botão) e ausência de rolagem horizontal. Os totais esperados vêm da própria API simulada (`apiFetch`), não de números fixos.
- `tests/e2e/nft-detail.spec.ts` (item 2): acesso direto e refresh, NFT inexistente, edições esgotada e indisponível (não escolhíveis, setas só entre as disponíveis, edição na URL, link para edição esgotada com aviso), limite de quantidade (botão e digitação), NFT todo esgotado, miniaturas pelo teclado (desktop), comprar adicionando a edição ao carrinho do visitante (conferido na API) barra de compra no lugar da de navegação (mobile) e, no limite de 999 unidades, preço numa linha, barra com até 164 px e toast pelo menos 8 px acima dela (mobile).
- `tests/e2e/cart.spec.ts` (item 5): carrinho vazio, quantidades com os totais da tela iguais à cotação da API (`POST /quotes`, formatados com o mesmo `formatEth`), contador do header, persistência no refresh, limite de estoque (botão e digitação), remover com "Desfazer", cupom inválido e expirado no campo (sem mudar o carrinho), cupom válido no desconto e no total, remoção do cupom, merge no login com aviso do que não coube e troca do `X-Cart-Id`, item esgotado bloqueando a finalização, finalizar como visitante passando pelo login, resumo preso na base com avisos no topo (mobile) e isolamento entre contas.
- `tests/e2e/cart-review.spec.ts`: um teste por achado do code review do Passo 7 ("Desfazer" com sucesso e falha, campo ocupado sem segundo PATCH, uma cotação por mudança, finalizar esperando a mudança pendente, merge sem skeleton, tela igual à API com `jitter`, navegação no carrinho vazio, aviso de máximo sem cortar o nome, toast abaixo do título e login sem sobrar listeners). A troca de ordem das respostas e a cotação dupla não se reproduzem com a API simulada (a latência vem antes do processamento, e o React troca a chave antes da invalidação); essas regras são provadas em `src/features/cart/cart-cache.test.ts`.
- `trackApi(page).idle()` (em `tests/fixtures/auth.ts`) espera não haver requisições `/api` em andamento. `loginViaUi` usa esse helper: o `waitForLoadState('networkidle')` de antes retornava na hora (num app de página única o login não recarrega o documento), e uma busca autenticada do login ainda em andamento era pega pelo `session-expired` ativado em seguida.
- `tests/e2e/favorites.spec.ts` (item 4): visitante vai ao login e volta com o favorito concluído (no detalhe, com foco no coração e persistência no refresh; no card abaixo da dobra no mobile, com o card de volta à tela), NFT que já estava na lista só recebe o aviso, desistência do login descarta o pedido (conferido na API depois da rede parar), mudança de tela antes da conclusão não rola nem tira o foco (mobile, com `slow`), volta ao detalhe sem rolagem à toa e com foco no coração, falha dos dados (`server-error` em `/me/favorites`) mantém o pedido e o "Tentar de novo" do toast conclui, favorito persistido no refresh e listado em `/favorites`, isolamento entre Ana e Bruno, falha (`favorite-fails` + `slow` só em `/me/favorites`) com mudança otimista visível e rollback com aviso ao favoritar e ao desfavoritar, recuperação depois da falha, e o coração do card no mobile. Antes de um reload, o teste espera a resposta do `PUT` (o reload cancelaria a gravação).
- `tests/e2e/account.spec.ts` (item 8): edição do perfil com o nome novo no header e depois do refresh (e sem voltar ao antigo ao navegar), erros do cliente (regras do contrato), "nome de usuário em uso" e cenário `validation-error` no campo certo e com foco, sem salvar nada; avatar com tipo e tamanho recusados, prévia sem envio, envio no "Salvar", persistência e remoção; senha com confirmação diferente, nova igual à atual, senha atual errada (com os dados do perfil do mesmo "Salvar" já salvos) e troca que vale no login seguinte; carteira principal com endereço conferido pela rede, erro da API no endereço e persistência; carteira secundária com campos obrigatórios, "Igual à carteira principal", resumo e persistência; isolamento entre Ana e Bruno; menu da conta (seção atual, itens indisponíveis, "Sair") e uma coluna sem rolagem lateral no mobile. O bloco "avisos do avatar e foco nos erros" confere a recusa do arquivo com o nome e o que continua valendo, o aviso sumindo ao salvar e o campo com erro (da API e do cliente) no meio da tela, sem cruzar o toast. Regras dos formulários também em `src/features/account/account.test.ts`.
- `tests/e2e/realtime.spec.ts` (parte dos itens 9 e 10): preço novo no detalhe e no card do catálogo sem nenhuma requisição REST do NFT, NFT no carrinho com o toast do que mudou, a linha do item marcada e o resumo igual ao `POST /quotes`, evento duplicado (`/__mocks/realtime/replay`) e antigo (`/__mocks/realtime/stale`) sem efeito na tela nem nova busca do carrinho, queda (`/__mocks/realtime/disconnect`) com a mudança feita durante ela trazida pela API depois da reconexão, e uma conexão só por sessão (visitante, Ana depois do login e visitante de novo no logout, conferido em `/__mocks/realtime/peers`). A parte do checkout e do pedido pendente entra nos Passos 9 e 10. O bloco "correções do review" tem um teste por achado: reset dos mocks sem recarregar (a tela volta ao inicial e segue recebendo eventos), reset sem reenvio nem emissão (`/__mocks/realtime/log`), evento atrasado numa conexão nova sem aviso falso nem busca do carrinho, lista de interesse reconciliada depois da queda, pagamento vencido decidido e anunciado sem nenhuma requisição REST (status lido do `localStorage` do banco), troca de sessão com handshake lento (`/__mocks/realtime/auth-delay`: nada entregue antes da autenticação e o que mudou buscado pelo sync), "Novo preço" do painel e item esgotado sem total na linha. O teste do carrinho confere que o aviso fica no fluxo, acima da lista, sem toast. O bloco "avisos de queda, reconexão e reset" confere o aviso de queda por cima do topo da página sem mover o título (antes descia 52 px no desktop e 96 px no mobile), à vista com a página rolada e sem travar cliques, o anúncio da volta (e nenhum aviso no login), o aviso do que mudou durante a queda (1.39 → 1.79, resumo 3.596 ETH) e o reset sem recarregar (aviso no carrinho, que volta vazio, e toast em outra tela).
- `src/features/realtime/realtime.test.ts` (unitário): porteiro (duplicado, antigo, outro usuário, versões do sync inclusive depois do reset, `eventId` com época), aplicação no cache (guarda de versão, aviso só do carrinho atual, evento atrasado em relação ao carrinho, edição indisponível, cotação ainda na primeira busca refeita), tratamento do evento (registro depois de aplicar, listener de pedido isolado), reconciliação pelo sync e sessão do socket (token vencido ou revogado vale como visitante).
- `tests/fixtures/mocks.ts` tem os helpers prontos: `apiFetch` (chamada à API de dentro da página, passando pelo service worker, o que o `page.request` não faz), `resetMocks`, `setScenario` e `waitForApp`. A spec `tests/e2e/mocks.spec.ts` usa esses helpers para conferir a API simulada no navegador.
- Cada teste começa com o reset do banco dos mocks, `localStorage` e `sessionStorage` limpos e o cenário escolhido.
- Os eventos de tempo real saem do servidor simulado, disparados pelas rotas `/__mocks` com `apiFetch` (mudar um NFT, reenviar, mandar evento antigo, derrubar a conexão). O WebSocket é simulado dentro da página e o Playwright não vê os quadros.
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
| 9 | Alteração de preço ou disponibilidade via Socket.IO durante o checkout | `realtime.spec.ts` (catálogo, detalhe e carrinho); checkout no Passo 9 |
| 10 | Eventos duplicados ou antigos, desconexão e retomada de pedido pendente | `realtime.spec.ts` (duplicado, antigo e reconexão); pedido pendente no Passo 10 |
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
