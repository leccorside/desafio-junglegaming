# Gerenciamento de estado

## Divisão do estado

| Tipo | Onde fica |
| --- | --- |
| Dados do servidor (catálogo, carrinho, pedidos, perfil...) | TanStack Query |
| Busca, filtros, ordenação e paginação | Search params do TanStack Router |
| Sessão (token e usuário) | Store fora do React (`session-store.ts`, lido com `useSyncExternalStore`) + query `session` para a revalidação |
| Estado de formulário | React Hook Form |
| Edição exibida no detalhe | Search param `?edition=`; sem ele, a página fixa num `useState` a edição que mostrou primeiro (`useShownEdition`), para uma mudança de preço não trocar a seleção com a página aberta |
| Estado visual local (drawer aberto, aba ativa) | `useState` no componente |

Fora do React há só stores pequenos e específicos: a sessão, o estado da conexão em tempo real (`realtime/connection-status.ts`), os avisos de mudança no carrinho (`cart/cart-notices.ts`) e a edição exibida no detalhe, lida pelo painel de cenários (`nft-detail/shown-edition.ts`). Dado do servidor não é copiado para estado local.

## Query keys

Cada feature exporta uma fábrica de chaves. Chaves privadas incluem o ID do usuário, para que dois usuários nunca compartilhem cache.

```ts
nftKeys.list(params)          // ['nfts', 'list', params]
nftKeys.detail(id)            // ['nfts', 'detail', id]
nftKeys.featured()            // ['nfts', 'featured']
cartKeys.current(owner)       // ['cart', owner]  (owner = 'user:<id>' ou 'guest:<X-Cart-Id>')
quoteKeys.current(owner, network, cartVersion) // ['quote', owner, network, cartVersion]
favoriteKeys.all(userId)      // ['favorites', userId]
orderKeys.detail(userId, id)  // ['orders', userId, id]
orderKeys.list(userId, status) // ['orders', userId, 'list', status]
profileKeys.me(userId)        // ['profile', userId]
walletKeys.all(userId)        // ['wallets', userId]
```

## Política de cache

| Recurso | `staleTime` | Observação |
| --- | --- | --- |
| Catálogo e destaques | 60 s | Atualizado também por `nft.updated` |
| Detalhe do NFT | 30 s | Atualizado por `nft.updated` |
| Carrinho | 0 na tela do carrinho, 30 s no contador | A tela sempre confere estoque e preço ao montar |
| Cotação | 0 | Invalidada por qualquer mudança no carrinho, cupom, rede ou evento |
| Favoritos, perfil, carteiras | 5 min | Invalidados pelas próprias mutations |
| Pedido pendente | 0 | Polling leve como reserva enquanto `pending`, além do `order.updated` |

`gcTime` padrão de 5 minutos. No catálogo, `placeholderData: keepPreviousData` mantém a página anterior visível durante a troca de filtro, com indicador de atualização.

Padrões globais em `src/lib/query-client.ts`: `staleTime` 30 s, `gcTime` 5 min, sem refetch ao focar a janela. Cada feature ajusta o `staleTime` conforme a tabela acima.

| Query | Chave | Política |
| --- | --- | --- |
| Detalhe do NFT | `['nfts', 'detail', id]` | `staleTime` 30 s. O loader só inicia a busca (`prefetchQuery`, sem esperar) e pré-carrega a imagem principal quando a resposta chega; a página usa `useSuspenseQuery`, com o esqueleto como `pendingComponent`, e o `NOT_FOUND` vira "NFT não encontrado" no `errorComponent` |
| Mais desta coleção | `['nfts', 'list', { collection, sort: 'popular', pageSize: 6 }]` | Mesma query da listagem, com `select` que tira o próprio NFT e corta em 5 |
| Lista de interesse | `['favorites', userId]` | `staleTime` 5 min; desligada para visitante |
| Sessão | `['session', token]` | `staleTime: Infinity` no carregamento; `0` ao entrar em rota privada (revalida a cada entrada); sem retry |
| Perfil | `['profile', userId]` | `staleTime` 5 min; as mutations gravam a resposta da API direto no cache |
| Carteiras | `['wallets', userId]` | `staleTime` 5 min; criar ou editar troca a carteira na lista em cache (ordem: principal, secundária) |

## Retries

Implementados em `shouldRetry` e `retryDelay` (`src/lib/query-client.ts`):

- Queries: até 2 novas tentativas (`MAX_QUERY_RETRIES`), só quando o `ApiError` tem `retryable: true`. Isso vale para rede (`NETWORK_ERROR`), 5xx e 503 (`SERVICE_UNAVAILABLE`). Nunca para 4xx.
- Timeout (`TIMEOUT`, 15 s no Axios): só 1 nova tentativa (`MAX_TIMEOUT_RETRIES`). Cada tentativa já custa os 15 s inteiros; com 2 repetições, o erro levava cerca de 47 s para aparecer, e agora leva cerca de 31 s. Enquanto a nova tentativa roda, o catálogo troca "Carregando NFTs…" por "O servidor está demorando para responder. Ainda estamos tentando…" (`isTimeoutError(query.failureReason)`, que o TanStack Query zera a cada busca nova).
- Backoff exponencial: 0,5 s, 1 s, 2 s, com teto de 4 s.
- Mutations: sem retry automático (`retry: false`). A criação de pedido (`usePlaceOrder`) repete por conta própria até 2 vezes, com a mesma `Idempotency-Key`, em `TIMEOUT`, `NETWORK_ERROR` ou `SERVICE_UNAVAILABLE`; se o pedido já tinha sido criado, a API devolve o mesmo (200). Sem resposta em 5 s (`ORDER_SLOW_MS`), a fase vira `slow` e a revisão mostra "Ainda enviando…".
- `SESSION_EXPIRED` e `UNAUTHENTICATED` não se repetem: disparam o fluxo de expiração de sessão ([SECURITY.md](SECURITY.md)).

## Erros

Todo erro de requisição vira `ApiError` (`src/api/errors.ts`), com `code`, `status`, `fields`, `details` e `retryable`. A interface decide só pelo `code`. `apiRequest` (`src/api/client.ts`) valida toda resposta com o schema do contrato, e uma resposta fora dele vira `INVALID_RESPONSE`, sem chegar ao cache. Nos formulários, `applyApiError` coloca cada `fields[campo]` no campo certo do React Hook Form (o primeiro recebe o foco e vai para o meio da tela, `centerFocusedField`), e o resto vira mensagem geral.

## Respostas obsoletas

- Toda query repassa o `signal` do TanStack Query ao Axios. Mudar parâmetros cancela a requisição anterior.
- Como a chave inclui os parâmetros, uma resposta atrasada nunca sobrescreve a consulta atual.

## Mutations e invalidação

| Mutation | Invalida ou atualiza |
| --- | --- |
| Favoritar / desfavoritar | `favorites` (otimista) |
| Adicionar, alterar, remover item | `cart`, `quote` |
| Aplicar / remover cupom | `cart`, `quote` |
| Criar pedido | o pedido devolvido vai para `['orders', userId, id]`; o carrinho e a cotação são buscados de novo quando o pedido chega a um estado terminal, pelo `order.updated` ou pela consulta (`refreshAfterSettle`) |
| Atualizar perfil / avatar | `profile` (resposta gravada no cache) e o usuário da sessão: `updateSessionUser` no store (header na hora) e no cache `['session', token]`, senão a próxima conferência da raiz gravaria o nome antigo de volta |
| Trocar senha | nada (a sessão continua válida) |
| Cadastrar / editar carteira | `wallets` (resposta gravada no cache, sem nova busca) |
| Login / cadastro | `session`, `cart` (merge), `favorites` |
| Logout | `resetCache` (ver "Sessão e troca de usuário") |

## Atualização otimista

Favoritos usam atualização otimista:

1. `onMutate`: cancela queries de favoritos, guarda o estado anterior e aplica a mudança.
2. `onError`: restaura o estado anterior e mostra o erro.
3. `onSettled`: invalida `favorites` para alinhar com a API.

Em `src/features/favorites/queries.ts` (`useToggleFavorite`). A query `favoriteKeys.all(userId)` guarda `{ nftIds, items }`; o toggle muda os dois. Com cliques seguidos, só a última mutação em andamento (`isMutating` com a `mutationKey` do usuário igual a 1) invalida, para um estado intermediário não voltar à tela. Visitante não chama a API: guarda o pedido (`savePendingFavorite`) e vai ao login com `redirect`. O `PendingFavoriteRunner` (montado na raiz) consome o pedido quando há sessão fora das telas de entrada: `ensureQueryData` dos favoritos e do NFT (repetindo se o `resetCache` do login cancelar a busca), a mesma mutation otimista e a rolagem até `[data-nft-id]`. A rolagem espera o `onRendered` do router (mais um quadro), é cancelada por `onBeforeNavigate` e não acontece se a URL já não é a de destino. O pedido só é apagado no sucesso, no "já está" ou na falha da gravação; na falha dos dados fica guardado (nova tentativa pelo toast ou na próxima navegação), com uma execução por vez.

Carrinho (`src/features/cart/queries.ts`):

- `cartKeys.current(owner)` com `owner` = `user:<id>` ou `guest:<X-Cart-Id>`; `staleTime` 0 na tela do carrinho (sempre confere estoque e preço) e 30 s no contador do header e da barra.
- `quoteKeys.current(owner, network, cartVersion)`: a versão do carrinho está na chave, então qualquer mudança (quantidade, item, cupom) gera uma cotação nova da API; `placeholderData: keepPreviousData` mantém o resumo anterior com indicador ("Atualizando o resumo…") durante a troca.
- Mutations (adicionar, quantidade, remover, aplicar e remover cupom) têm a `mutationKey` `['cart', 'mutation']` e gravam o carrinho devolvido pela API com `writeCart` (`cart-cache.ts`): só grava se a `version` for igual ou maior que a do cache (resposta fora de ordem não desfaz a mais nova; nesse caso o carrinho é conferido de novo) e marca as cotações como velhas com `refetchType: 'none'` (a cotação da versão nova vem pela chave; antes a antiga também era pedida). "Conectar e finalizar" espera `useIsMutating` zerar. Sem atualização otimista: quantidade e estoque são decididos pela API, e o seletor fica ocupado (`aria-disabled`, sem perder o foco) até a resposta. Remover oferece "Desfazer" no toast, que chama a API direto (`cartApi.addItem` + `writeCart`) e avisa o resultado: a linha já saiu da tela, e os callbacks do `mutate` de um componente desmontado não rodam. O campo de quantidade descarta o digitado enquanto a mudança anterior está pendente.
- Merge no login: `setupSession({ onStart })` chama `mergeGuestCart` depois de gravar a sessão e antes do `resetCache`; o `onStart` devolve uma função que grava o carrinho juntado depois do reinício (gravado antes, o reinício o apagaria e a tela voltaria ao skeleton).

O carrinho não usa atualização otimista: o limite de quantidade e o preço vêm da API, e uma mudança otimista mostraria por instantes um total que a cotação depois desmente.

## Eventos em tempo real

Eventos atualizam o cache por `setQueryData` quando trazem o dado completo, ou por `invalidateQueries` quando não trazem. Regras de versão e duplicados em [REALTIME.md](REALTIME.md).

- `nft.updated` traz preço e estoque das edições: `applyNftUpdated` grava direto no detalhe (`nftKeys.detail`), nas páginas da listagem (`['nfts','list']`), nos destaques e na lista de interesse, só onde a cópia tem `version` menor. Assim o preço muda na tela sem nova requisição. Uma consulta de NFT ou de favoritos ainda na primeira busca (sem dado) não tem onde receber o evento: `refetchAfterFirstFetch` a busca de novo quando essa busca termina, sem cancelar, porque o detalhe está suspenso esperando exatamente ela.
- O carrinho e a cotação não são recalculados no cliente: se algum carrinho do cache tem o NFT numa versão mais antiga que a do evento, os dois são buscados de novo e a API devolve o preço novo (com `previousUnitPrice`) e a cotação nova. O aviso compara o carrinho da sessão atual com o evento; se o carrinho ainda não carregou, não há aviso.
- `refreshQueries` cancela a primeira busca em andamento (query sem dado) antes de invalidar. O `invalidateQueries` sozinho reaproveita essa busca em vez de refazer: a resposta, calculada antes da mudança, chegava e apagava a marca de "velho", e o resumo ficava com a cotação antiga.
- A cada conexão, o `realtime.sync` traz as versões do servidor, e só as queries com cópias de versão diferente são buscadas de novo (`nfts`, `favorites`, `cart`, `quote`); `orders` é sempre marcado como velho. Isso cobre reconexão, sessão nova, handshake lento e reset dos mocks sem duplicar requisições ao abrir a página.

## Barra inferior do celular

`useBottomBar` escolhe entre a barra de navegação e a de compra do detalhe pelo estado da consulta do NFT no cache: observa `nftDetailQuery` com `enabled: false` (só lê, não busca) e mostra a barra de compra só com `status === "success"`. No carregamento, no NFT inexistente e no erro, a barra de navegação continua.

## Sessão e troca de usuário

No logout, na expiração ou na troca de usuário (`endSession`), na ordem: avisa os registrados em `onSessionEnd` (o socket da conta fecha, e a conexão seguinte começa com o registro de eventos vazio), apaga a sessão e reinicia o cache (`resetCache`): `cancelQueries()`, `removeQueries({ type: "inactive" })`, `getMutationCache().clear()` e `resetQueries({ type: "active" })`. As queries na tela voltam ao estado inicial e buscam de novo já sem a sessão, e as que não estão na tela somem. Só `clear()` não basta: os observers montados ficariam presos às queries removidas e continuariam mostrando os dados do usuário anterior. O login (`startSession`) faz o mesmo reinício antes de gravar a sessão nova no cache, para respostas de visitante atrasadas não aparecerem na conta. Ver [SECURITY.md](SECURITY.md).

A sessão em si não vive no cache do Query: fica em `session-store.ts`, porque o Axios precisa ler o token fora do React. Os componentes leem com `useSession()` (`useSyncExternalStore`).
