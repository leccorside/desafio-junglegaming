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

Valores finais confirmados no Passo 4.

## Retries

- Queries: até 2 novas tentativas com backoff exponencial, só para erro de rede e `retryable: true` (503). Nunca para 4xx.
- Mutations: sem retry automático, exceto a criação de pedido, que pode ser reenviada com a mesma `Idempotency-Key`.
- Erros 401 não são repetidos: disparam o fluxo de expiração de sessão.

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

O carrinho pode usar o mesmo padrão para quantidade, se o resultado for bom nos testes.

## Eventos em tempo real

Eventos atualizam o cache por `setQueryData` quando trazem o dado completo, ou por `invalidateQueries` quando não trazem. Regras de versão e duplicados em [REALTIME.md](REALTIME.md).

## Sessão e troca de usuário

No logout ou troca de usuário: desconectar o socket, cancelar queries em andamento, remover as queries privadas e limpar o registro de eventos. Ver [SECURITY.md](SECURITY.md).
