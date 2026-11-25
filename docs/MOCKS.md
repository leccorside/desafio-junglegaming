# Mocks com MSW

A API REST é simulada na camada de rede com MSW 2. Componentes, hooks e o cliente Axios não sabem que falam com um mock: as requisições saem pelo `fetch`/XHR normal e o service worker as intercepta. Respostas fictícias e regras de negócio simuladas existem só em `src/mocks`. O Socket.IO simulado entra no Passo 8 ([REALTIME.md](REALTIME.md)).

## Ativação

- Ligados quando `VITE_ENABLE_MOCKS=true` ou no modo `mocks` do Vite (`npm run dev:mocks`, testes, deploy), que carrega o `.env.mocks` versionado.
- `src/mocks/enable.ts` registra o worker (`public/mockServiceWorker.js`) **antes** da primeira renderização, então nenhuma requisição escapa.
- O build de demonstração na Vercel já sai com os mocks ligados.

## Arquitetura

```text
src/mocks/
  config.ts          base das rotas, taxas por rede, prazos (sessão, cotação, pagamento), latências
  random.ts          gerador pseudoaleatório com semente (mulberry32)
  errors.ts          MockApiError: código do contrato + mensagem + fields + details
  http.ts            route(): cenário de rede → liquidação de pagamentos → serviço → JSON ou erro padrão
  db/
    state.ts         formato do banco (DbState)
    store.ts         getDb, mutate, resetDb, onDbChange, persistência no localStorage
  fixtures/          catálogo, usuários, carteiras, cupons e pedidos anteriores (createSeed)
  services/          regras de negócio puras: auth, catalog, favorites, cart, coupons, quotes, orders, account
  handlers/          rotas MSW: validam o corpo com o schema do contrato e chamam o serviço
  scenarios/         cenários de rede e de negócio
  panel/             painel de desenvolvimento (cenários e reset)
```

Os handlers só traduzem HTTP: leem o corpo com o schema Zod do contrato (`readBody`), chamam o serviço e devolvem o resultado. Toda regra (estoque, cupom, cotação, idempotência) fica nos serviços, que os testes chamam pela API HTTP real via `msw/node`.

## Banco dos mocks

- Estado único (`DbState`) com usuários, sessões, NFTs, favoritos, carrinhos, cupons, cotações, pedidos, chaves de idempotência e carteiras. REST e Socket.IO (Passo 8) leem e escrevem no mesmo estado, e `onDbChange` avisa o socket a cada mudança.
- Persistido no `localStorage` em `kurio:mocks:db`, com `schemaVersion` (hoje 2). Versão diferente ou JSON corrompido fazem o banco voltar às fixtures.
- `mutate` persiste e avisa os interessados mesmo quando a regra termina em erro. Algumas regras alteram o banco de propósito antes de recusar (o cenário de preço alterado sobe o preço e guarda a cotação nova, e só então devolve `QUOTE_OUTDATED`). Regra que não deve deixar rastro valida antes de alterar.
- Sem `localStorage` (Node, navegação privada bloqueada), fica só em memória.
- IDs de pedido, cotação e carteira são sequenciais (`ord-0003`), então os testes são previsíveis.

## Fixtures

| Conjunto | Conteúdo |
| --- | --- |
| NFTs | 60, gerados com semente fixa. Os 10 primeiros são os do Figma, com os mesmos nomes e preços: Emerald Ape #042 (1.19 ETH), Cosmic Bloom #118 (1.29), Golden Beat #207 (0.99), Sage Nomad #009 (1.69), Violet Nomad #314 (1.39), Golden Frequency #071 (0.59), Neon Vessel #552 (1.99), Ivory Baron #088 (1.79), Golden Signal #160 (0.39) e Amber Monarch #231 (2.29). As 9 categorias e as 3 redes aparecem. |
| Edições | Cada NFT tem "1/1" (10× o preço base), "1/10" (3×), "1/50" (1,5×) e "Aberta" (preço base, estoque 999). |
| Casos fixos (`SPECIAL_NFTS`) | `nft-042`: tudo disponível (1/10 com 8). `nft-552`: 1/1 esgotada e 1/10 indisponível. `nft-610`: tudo esgotado. `nft-088`: 1/10 com só 2 unidades. |
| Usuários | `ana@example.com` e `bruno@example.com`, senha `Senha@123`. Só o hash fica guardado (SHA-256 de `salt:senha`, via Web Crypto). |
| Favoritos | Ana: `nft-042` e `nft-118`. Bruno: `nft-207`. |
| Carteiras | Ana: principal Ethereum (MetaMask, ENS `ana-coleciona`) e secundária Polygon (Coinbase). Bruno: só a principal, Solana (WalletConnect). |
| Pedidos | Um pedido confirmado anterior para cada um (`ord-0001` da Ana, `ord-0002` do Bruno). |
| Cupons | `BEMVINDO10` (10% do subtotal), `FIXO005` (0.05 ETH, a partir de 0.5 ETH) e `EXPIRADO` (vencido). Qualquer outro código é inválido. O código é normalizado para maiúsculas. |
| Imagens | As 4 imagens do Figma em `public/images/nfts`, reaproveitadas pelo catálogo. |

## Regras simuladas

- **Sessão:** token opaco válido por 30 minutos, uma sessão ativa por usuário. Token inválido gera `UNAUTHENTICATED` e token vencido gera `SESSION_EXPIRED`, inclusive nas rotas públicas que aceitam token, como o carrinho.
- **Carrinho:** o visitante é identificado pelo `X-Cart-Id`, e o carrinho é calculado contra o catálogo atual (preço alterado, estoque insuficiente, esgotado). Alterar a quantidade conta como ciência do preço novo.
- **Cotação:** guarda uma assinatura do que foi cotado (itens, preços, quantidades, cupom, taxa). No `POST /orders`, assinatura diferente, versão diferente ou cotação vencida (10 minutos) geram `QUOTE_OUTDATED`, com a cotação nova e a lista de mudanças.
- **Pedido:** reserva o estoque na criação. O pagamento é decidido 3 segundos depois (`settleAt`). Essa decisão roda antes de cada requisição, então o resultado aparece mesmo depois de refresh. Confirmado: gera hash e link de explorador simulados e tira do carrinho só o que foi comprado. Recusado: devolve o estoque e mantém o carrinho. A edição volta à venda só se foi a própria reserva que a esgotou (`soldOutByReservation`). Esgotada por outro motivo depois, continua esgotada.
- **Merge do carrinho:** item do visitante cujo NFT saiu do catálogo vai para `adjustments` com `added: 0`. A versão do carrinho do usuário só muda se algo entrou.
- **Ajuste de NFT (`/__mocks/nfts/:id/update`):** sem `status` no corpo, o status só é recalculado quando `available` é informado, e uma edição `unavailable` continua indisponível.
- **Idempotência:** a mesma `Idempotency-Key` com o mesmo corpo devolve o mesmo pedido (200). Com corpo diferente ou de outro usuário, devolve `IDEMPOTENCY_CONFLICT`.
- **Avatar:** guardado como data URL, porque não há servidor de arquivos.

## Cenários

Ativados de três formas, combináveis. Ficam salvos (`kurio:mocks:scenario`) até o reset.

1. URL: `?scenario=slow,payment-rejected`, com `&scenarioRoutes=/nfts,/cart` opcional para limitar os cenários de rede a algumas rotas. Os dois parâmetros são aplicados uma vez e saem da barra de endereço (`history.replaceState`), e os outros parâmetros ficam. Assim o reload usa o estado salvo, sem desfazer o que foi escolhido no painel nem redisparar cenários de uso único.
2. Painel de desenvolvimento: botão com ícone de frasco no canto inferior esquerdo. No mobile é uma aba estreita colada à borda esquerda, na margem vazia da barra inferior (antes do ícone Início), para não cobrir conteúdo. O nome acessível traz quantos cenários estão ativos ("Cenários de teste (1 ativo)"). Escondido em navegador automatizado (`navigator.webdriver`); os testes do próprio painel desligam essa marca com `addInitScript`.
3. API: `PUT /api/__mocks/scenario` com `{ "names": [...], "options": {...} }`.

Opções: `routes` (limita os cenários de rede), `latencyMs` (do `slow`), `seed` (do `jitter`) e `settleMs` (prazo do pagamento). O "Aplicar" do painel troca só os cenários e mantém as opções em vigor. Um valor corrompido no `localStorage` é ignorado: a aplicação sobe sem cenário.

### Rede

| Cenário | Efeito |
| --- | --- |
| (nenhum) | Latência curta variável (80 a 220 ms) no navegador |
| `slow` | 2,5 s em cada requisição |
| `jitter` | 100 a 1800 ms com semente fixa: requisições paralelas voltam fora de ordem, sempre na mesma ordem para a mesma semente. A latência padrão das outras rotas usa outro gerador, então não desloca a sequência |
| `timeout` | A requisição nunca responde (testa o timeout do Axios) |
| `offline` | Erro de rede (`fetch` rejeita) |
| `server-error` | `503 SERVICE_UNAVAILABLE` com `retryable: true` |
| `flaky` | Cada rota falha (503) na primeira chamada e responde na seguinte |

### Negócio

| Cenário | Efeito | Uso único |
| --- | --- | --- |
| `empty-catalog` | Catálogo e destaques vazios | |
| `session-expired` | A próxima chamada autenticada recebe `SESSION_EXPIRED` | sim |
| `forbidden` | Pedidos e carteiras respondem `403 FORBIDDEN` | |
| `register-conflict` | Cadastro recebe `EMAIL_TAKEN` | |
| `validation-error` | Cadastro, perfil e carteiras recebem erro por campo | |
| `favorite-fails` | Favoritar e desfavoritar recebem 503 (rollback da atualização otimista) | |
| `price-changed-on-checkout` | Ao confirmar, o preço do primeiro item sobe 10% e a resposta é `QUOTE_OUTDATED` | sim |
| `sold-out-on-checkout` | Ao confirmar, a edição do primeiro item esgota e a resposta é `QUOTE_OUTDATED` | sim |
| `order-timeout` | O pedido é criado, mas a primeira resposta nunca chega. A nova tentativa com a mesma chave recupera o pedido | sim |
| `payment-confirmed` | Pagamento confirmado (é o padrão; serve para usar com `settleMs`) | |
| `payment-rejected` | Pagamento recusado | |
| `wallet-rejected` | A conexão da carteira recebe `WALLET_REJECTED` | sim |
| `wallet-disconnected` | A criação do pedido recebe `WALLET_DISCONNECTED` | sim |

Cenários de uso único disparam uma vez e ficam marcados como consumidos. Para repetir, reative o cenário.

## Rotas utilitárias

Sempre sem cenários de rede, para o painel e os testes funcionarem mesmo com `offline` ativo.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/__mocks/reset` | Restaura as fixtures e o cenário padrão |
| GET | `/api/__mocks/scenario` | Cenário ativo |
| PUT | `/api/__mocks/scenario` | Ativa cenários `{ names, options }` |
| POST | `/api/__mocks/nfts/:id/update` | Altera preço, estoque ou status de uma edição (`{ editionId?, price?, available?, status? }`), incrementa a `version` do NFT. No Passo 8 também emite `nft.updated` |

## Reset

`POST /api/__mocks/reset` ou o botão "Restaurar dados iniciais" do painel. O botão também apaga a sessão e o carrinho guardados pelo cliente e volta para o início. Os testes E2E chamam o reset no `beforeEach` (`tests/fixtures/mocks.ts`).

## Como reproduzir as falhas

As telas chegam a partir do Passo 4. Até lá, os cenários podem ser conferidos pelo console do navegador com `fetch('/api/...')`.

| Falha | Como reproduzir | Resultado esperado |
| --- | --- | --- |
| Carregamento lento | `/?scenario=slow` | Skeletons por 2,5 s em cada tela com dados |
| Respostas fora de ordem | `/?scenario=jitter` e mudar filtros rápido | A lista mostra sempre o resultado do último filtro |
| Falha transitória | `/?scenario=server-error` | Mensagem de erro com "Tentar de novo" |
| Recuperação após nova tentativa | `/?scenario=flaky` | A primeira carga falha e o "Tentar de novo" funciona |
| Sem conexão | `/?scenario=offline` | Aviso de conexão e nova tentativa |
| Timeout | `/?scenario=timeout` | Aviso de tempo esgotado depois do timeout do cliente |
| Catálogo vazio | `/?scenario=empty-catalog` | Estado vazio com opção de limpar filtros |
| Sessão expirada | Entrar e ativar `session-expired` | Volta ao login e retoma o fluxo depois |
| Conflito de cadastro | `/register?scenario=register-conflict` | Erro no campo e-mail |
| Erro de validação | `?scenario=validation-error` no cadastro, perfil ou carteiras | Erro no campo apontado pela API |
| Falha ao favoritar | `?scenario=favorite-fails` e clicar no coração (com `slow` e `scenarioRoutes=/me/favorites` dá para ver o coração mudar antes de voltar) | O coração volta ao estado anterior, com aviso |
| Cupom inválido ou expirado | Aplicar `NADA` ou `EXPIRADO` no carrinho | Erro no campo do cupom |
| Preço alterado no checkout | `?scenario=price-changed-on-checkout` e confirmar a compra | A diferença aparece e é preciso confirmar de novo |
| Edição esgotada no checkout | `?scenario=sold-out-on-checkout` e confirmar | Item bloqueado e nova confirmação |
| Timeout após criar o pedido | `?scenario=order-timeout` e confirmar | Nova tentativa recupera o mesmo pedido, sem duplicar |
| Pagamento recusado | `?scenario=payment-rejected` e confirmar | Recusa com motivo, carrinho intacto |
| Carteira recusada | `?scenario=wallet-rejected` e conectar a carteira | Aviso de recusa e nova tentativa |
| Carteira desconectada | `?scenario=wallet-disconnected` e confirmar | Aviso para reconectar |

## Testes

- `src/mocks/api.test.ts`: 43 testes de integração que fazem `fetch` real contra os handlers via `msw/node` e validam cada resposta com o schema do contrato.
- `src/mocks/fixtures/fixtures.test.ts`: determinismo, conformidade com os contratos, NFTs do Figma, casos fixos e hash das senhas.
- `src/mocks/db/store.test.ts`: persistência entre carregamentos, persistência quando a regra termina em erro, fallback para as fixtures e reset.
- `src/mocks/scenarios/scenarios.test.ts`: leitura da URL, opções mantidas pelo painel, sequência reproduzível do `jitter`, plano de cada cenário de rede e valor corrompido no storage.
- `tests/e2e/mocks.spec.ts`: service worker no navegador, persistência no refresh, reset, cenário pela URL, latência fora de ordem, painel escondido em navegador automatizado e, com o painel visível, plural do contador e posição no mobile (na margem da barra, sem cobrir nada clicável em nenhuma rolagem, com o "Tentar de novo" na tela).

## Regras

- Nenhuma resposta fictícia fora de `src/mocks`.
- Cenários determinísticos: latência variável usa gerador com semente.
- Os mesmos handlers e fixtures servem ao desenvolvimento, à demonstração e aos testes.
- Toda mudança de contrato atualiza junto o schema (`src/api/contracts`), o serviço e o [API.md](API.md).
