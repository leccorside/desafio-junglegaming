# Gerenciamento de estado

## Divisão do estado

| Tipo | Onde fica |
| --- | --- |
| Dados do servidor (catálogo, carrinho, pedidos, perfil...) | TanStack Query |
| Busca, filtros, ordenação e paginação | Search params do TanStack Router |
| Sessão (token e usuário) | Contexto de sessão + query `session` |
| Estado de formulário | React Hook Form |
| Estado visual local (drawer aberto, aba ativa) | `useState` no componente |

Não há store global além disso. Dado do servidor não é copiado para estado local.

## Query keys

Cada feature exporta uma fábrica de chaves. Chaves privadas incluem o ID do usuário, para que dois usuários nunca compartilhem cache.

```ts
nftKeys.list(params)          // ['nfts', 'list', params]
nftKeys.detail(id)            // ['nfts', 'detail', id]
nftKeys.featured()            // ['nfts', 'featured']
cartKeys.current(owner)       // ['cart', owner]  (owner = userId ou guestCartId)
quoteKeys.current(owner, net) // ['quote', owner, net]
favoriteKeys.all(userId)      // ['favorites', userId]
orderKeys.detail(userId, id)  // ['orders', userId, id]
profileKeys.me(userId)        // ['profile', userId]
walletKeys.all(userId)        // ['wallets', userId]
```

## Política de cache

| Recurso | `staleTime` | Observação |
| --- | --- | --- |
| Catálogo e destaques | 60 s | Atualizado também por `nft.updated` |
| Detalhe do NFT | 30 s | Atualizado por `nft.updated` |
| Carrinho | 0 | Sempre refetch ao montar |
| Cotação | 0 | Invalidada por qualquer mudança no carrinho, cupom, rede ou evento |
| Favoritos, perfil, carteiras | 5 min | Invalidados pelas próprias mutations |
| Pedido pendente | 0 | Polling leve como reserva enquanto `pending`, além do `order.updated` |

`gcTime` padrão de 5 minutos. No catálogo, `placeholderData: keepPreviousData` mantém a página anterior visível durante a troca de filtro, com indicador de atualização.

Padrões globais em `src/lib/query-client.ts` (Passo 4): `staleTime` 30 s, `gcTime` 5 min, sem refetch ao focar a janela. Cada feature ajusta o `staleTime` conforme a tabela acima.

| Query | Chave | Política |
| --- | --- | --- |
| Detalhe do NFT | `['nfts', 'detail', id]` | `staleTime` 30 s; o loader da rota usa `ensureQueryData` |
| Mais desta coleção | `['nfts', 'list', { collection, sort: 'popular', pageSize: 6 }]` | Mesma query da listagem, com `select` que tira o próprio NFT e corta em 5 |
| Lista de interesse | `['favorites', userId]` | `staleTime` 5 min; desligada para visitante |
| Sessão | `['session', token]` | `staleTime: Infinity` no carregamento; `0` ao entrar em rota privada (revalida a cada entrada); sem retry |

## Retries

Implementados em `shouldRetry` e `retryDelay` (`src/lib/query-client.ts`):

- Queries: até 2 novas tentativas (`MAX_QUERY_RETRIES`), só quando o `ApiError` tem `retryable: true`. Isso vale para rede (`NETWORK_ERROR`), 5xx e 503 (`SERVICE_UNAVAILABLE`). Nunca para 4xx.
- Timeout (`TIMEOUT`, 15 s no Axios): só 1 nova tentativa (`MAX_TIMEOUT_RETRIES`). Cada tentativa já custa os 15 s inteiros; com 2 repetições, o erro levava cerca de 47 s para aparecer, e agora leva cerca de 31 s. Enquanto a nova tentativa roda, o catálogo troca "Carregando NFTs…" por "O servidor está demorando para responder. Ainda estamos tentando…" (`isTimeoutError(query.failureReason)`, que o TanStack Query zera a cada busca nova).
- Backoff exponencial: 0,5 s, 1 s, 2 s, com teto de 4 s.
- Mutations: sem retry automático (`retry: false`). A criação de pedido repete por conta própria, com a mesma `Idempotency-Key` (Passo 10).
- `SESSION_EXPIRED` e `UNAUTHENTICATED` não se repetem: disparam o fluxo de expiração de sessão ([SECURITY.md](SECURITY.md)).

## Erros

Todo erro de requisição vira `ApiError` (`src/api/errors.ts`), com `code`, `status`, `fields`, `details` e `retryable`. A interface decide só pelo `code`. `apiRequest` (`src/api/client.ts`) valida toda resposta com o schema do contrato, e uma resposta fora dele vira `INVALID_RESPONSE`, sem chegar ao cache. Nos formulários, `applyApiError` coloca cada `fields[campo]` no campo certo do React Hook Form, e o resto vira mensagem geral.

## Respostas obsoletas

- Toda query repassa o `signal` do TanStack Query ao Axios. Mudar parâmetros cancela a requisição anterior.
- Como a chave inclui os parâmetros, uma resposta atrasada nunca sobrescreve a consulta atual.

## Mutations e invalidação

| Mutation | Invalida ou atualiza |
| --- | --- |
| Favoritar / desfavoritar | `favorites` (otimista) |
| Adicionar, alterar, remover item | `cart`, `quote` |
| Aplicar / remover cupom | `cart`, `quote` |
| Criar pedido | `orders`; o carrinho só depois da confirmação |
| Atualizar perfil / avatar | `profile`, `session` |
| Cadastrar / editar carteira | `wallets` |
| Login / cadastro | `session`, `cart` (merge), `favorites` |
| Logout | `queryClient.clear()` dos dados privados |

## Atualização otimista

Favoritos usam atualização otimista:

1. `onMutate`: cancela queries de favoritos, guarda o estado anterior e aplica a mudança.
2. `onError`: restaura o estado anterior e mostra o erro.
3. `onSettled`: invalida `favorites` para alinhar com a API.

Implementado no Passo 6 em `src/features/favorites/queries.ts` (`useToggleFavorite`). A query `favoriteKeys.all(userId)` guarda `{ nftIds, items }`; o toggle muda os dois. Com cliques seguidos, só a última mutação em andamento (`isMutating` com a `mutationKey` do usuário igual a 1) invalida, para um estado intermediário não voltar à tela. Visitante não chama a API: guarda o pedido (`savePendingFavorite`) e vai ao login com `redirect`. O `PendingFavoriteRunner` (montado na raiz) consome o pedido quando há sessão fora das telas de entrada: `ensureQueryData` dos favoritos e do NFT (repetindo se o `resetCache` do login cancelar a busca), a mesma mutation otimista e a rolagem até `[data-nft-id]`.

O carrinho ganhou `cartKeys.current(owner)` (`user:<id>` ou `guest:<X-Cart-Id>`) e `useAddToCart`, que grava o carrinho devolvido pela API direto no cache e invalida `quote`. O restante do carrinho entra no Passo 7.

O carrinho pode usar o mesmo padrão para quantidade, se o resultado for bom nos testes.

## Eventos em tempo real

Eventos atualizam o cache por `setQueryData` quando trazem o dado completo, ou por `invalidateQueries` quando não trazem. Regras de versão e duplicados em [REALTIME.md](REALTIME.md).

## Sessão e troca de usuário

No logout, na expiração ou na troca de usuário (`endSession`), na ordem: avisa os registrados em `onSessionEnd` (o socket desconecta e limpa o registro de eventos no Passo 8), apaga a sessão e reinicia o cache (`resetCache`): `cancelQueries()`, `removeQueries({ type: "inactive" })` e `resetQueries({ type: "active" })`. As queries na tela voltam ao estado inicial e buscam de novo já sem a sessão, e as que não estão na tela somem. Só `clear()` não basta: os observers montados ficariam presos às queries removidas e continuariam mostrando os dados do usuário anterior. O login (`startSession`) faz o mesmo reinício antes de gravar a sessão nova no cache, para respostas de visitante atrasadas não aparecerem na conta. Ver [SECURITY.md](SECURITY.md).

A sessão em si não vive no cache do Query: fica em `session-store.ts`, porque o Axios precisa ler o token fora do React. Os componentes leem com `useSession()` (`useSyncExternalStore`).
