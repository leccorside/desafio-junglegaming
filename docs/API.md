# Contratos REST

Contratos da API simulada pelo MSW. Os schemas Zod correspondentes ficam em `src/api/contracts`. Este documento é a proposta inicial do Passo 2 e deve ser atualizado quando a implementação mudar algum contrato.

## Convenções

- Base: `VITE_API_URL` (padrão `/api`).
- JSON em `camelCase`. Datas em ISO 8601 UTC.
- Valores em ETH como string decimal. Quantidades como inteiro.
- Autenticação por `Authorization: Bearer <token>`.
- Carrinho de visitante identificado por `X-Cart-Id: <uuid>`.
- Criação de pedido exige `Idempotency-Key: <uuid>`.

## Formato de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Alguns campos estão inválidos.",
    "fields": { "email": "E-mail inválido." },
    "retryable": false,
    "details": {}
  }
}
```

| Status | Código | Quando |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Parâmetro malformado |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 401 | `SESSION_EXPIRED` | Token expirado |
| 403 | `FORBIDDEN` | Recurso de outro usuário |
| 404 | `NOT_FOUND` | Recurso inexistente |
| 409 | `EMAIL_TAKEN` | Cadastro com e-mail existente |
| 409 | `AVAILABILITY_CONFLICT` | Quantidade acima da disponibilidade (`details.maxQuantity`) |
| 409 | `QUOTE_OUTDATED` | Cotação desatualizada (`details.quote` com a nova) |
| 409 | `IDEMPOTENCY_CONFLICT` | Mesma chave com conteúdo diferente |
| 422 | `VALIDATION_ERROR` | Campos inválidos (`fields`) |
| 422 | `COUPON_INVALID` | Cupom inexistente |
| 422 | `COUPON_EXPIRED` | Cupom fora da validade |
| 422 | `INVALID_PASSWORD` | Senha atual incorreta |
| 503 | `SERVICE_UNAVAILABLE` | Falha transitória (`retryable: true`) |

## Sessão e conta

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/auth/register` | Cria conta e devolve sessão |
| POST | `/auth/login` | Autentica e devolve sessão |
| GET | `/auth/session` | Sessão atual |
| POST | `/auth/logout` | Encerra a sessão |

```ts
type RegisterRequest = { name: string; email: string; password: string }
type LoginRequest = { email: string; password: string }
type Session = {
  token: string
  expiresAt: string
  user: { id: string; name: string; email: string; avatarUrl: string | null }
}
```

## NFTs

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/nfts` | Listagem com busca, filtros, ordenação e paginação |
| GET | `/nfts/featured` | Destaques da tela inicial |
| GET | `/nfts/:id` | Detalhe |

Parâmetros de `/nfts`:

| Parâmetro | Tipo | Exemplo |
| --- | --- | --- |
| `q` | string | `ape` |
| `category` | string[] | `art,music` |
| `collection` | string[] | `genesis` |
| `minPrice` / `maxPrice` | string decimal | `0.1` |
| `availability` | `available` \| `sold_out` | `available` |
| `sort` | `recent` \| `price_asc` \| `price_desc` \| `popular` | `price_asc` |
| `page` | inteiro, a partir de 1 | `2` |
| `pageSize` | inteiro | `12` |

Os filtros finais seguem o Figma e serão confirmados no Passo 5.

```ts
type NftEdition = {
  id: string
  name: string
  price: string
  available: number
  status: 'available' | 'sold_out' | 'unavailable'
}
type Nft = {
  id: string
  name: string
  description: string
  creator: { id: string; name: string; avatarUrl: string }
  collection: { id: string; name: string }
  category: string
  images: { url: string; alt: string; width: number; height: number }[]
  editions: NftEdition[]
  version: number
  updatedAt: string
}
type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
```

## Favoritos (autenticado)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/me/favorites` | Lista os IDs e os NFTs favoritos |
| PUT | `/me/favorites/:nftId` | Inclui (idempotente) |
| DELETE | `/me/favorites/:nftId` | Remove (idempotente) |

## Carrinho

Aceita visitante (`X-Cart-Id`) ou usuário autenticado.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/cart` | Carrinho atual |
| POST | `/cart/items` | Inclui item `{ nftId, editionId, quantity }` |
| PATCH | `/cart/items/:itemId` | Altera quantidade `{ quantity }` |
| DELETE | `/cart/items/:itemId` | Remove item |
| POST | `/cart/merge` | Junta o carrinho do visitante ao do usuário `{ guestCartId }` |
| PUT | `/cart/coupon` | Aplica cupom `{ code }` |
| DELETE | `/cart/coupon` | Remove cupom |

```ts
type CartItem = {
  id: string
  nftId: string
  editionId: string
  name: string
  imageUrl: string
  unitPrice: string
  quantity: number
  available: number
  status: 'ok' | 'price_changed' | 'insufficient' | 'sold_out'
  version: number
}
type Cart = { id: string; items: CartItem[]; couponCode: string | null; updatedAt: string }
```

## Cotação

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/quotes` | Calcula a cotação do carrinho para a rede `{ network }` |

```ts
type Quote = {
  id: string
  version: number
  network: string
  lines: { itemId: string; unitPrice: string; quantity: number; lineTotal: string }[]
  subtotal: string
  discount: string
  networkFee: string
  total: string
  coupon: { code: string; description: string } | null
  expiresAt: string
}
```

## Pedidos (autenticado)

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/orders` | Cria pedido (exige `Idempotency-Key`) |
| GET | `/orders/:id` | Estado e recibo |
| GET | `/orders?status=pending` | Pedidos pendentes, para retomada |

```ts
type CreateOrderRequest = {
  quoteId: string
  quoteVersion: number
  walletId: string
  network: string
  buyer: { name: string; email: string }
}
type Order = {
  id: string
  status: 'pending' | 'confirmed' | 'rejected'
  rejectionReason: string | null
  transaction: { hash: string; explorerUrl: string } | null
  snapshot: {
    items: { nftId: string; editionId: string; name: string; imageUrl: string; unitPrice: string; quantity: number; lineTotal: string }[]
    subtotal: string
    discount: string
    networkFee: string
    total: string
    couponCode: string | null
    network: string
    walletAddress: string
  }
  version: number
  createdAt: string
  updatedAt: string
}
```

Resposta: `201` na primeira criação e `200` quando a mesma chave recupera o pedido existente.

## Perfil (autenticado)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/me/profile` | Dados do perfil |
| PATCH | `/me/profile` | Atualiza dados |
| PUT | `/me/avatar` | Envia avatar (`multipart/form-data`) |
| POST | `/me/password` | Altera senha `{ currentPassword, newPassword }` |

## Carteiras (autenticado)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/me/wallets` | Lista carteiras |
| POST | `/me/wallets` | Cadastra `{ label, address, network, role }` |
| PATCH | `/me/wallets/:id` | Atualiza |

```ts
type Wallet = {
  id: string
  label: string
  address: string
  network: string
  role: 'primary' | 'secondary'
  updatedAt: string
}
```

## Mocks

Utilitários disponíveis só com `VITE_ENABLE_MOCKS=true`, usados pelo painel de desenvolvimento e pelos testes. Ver [MOCKS.md](MOCKS.md).

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/__mocks/reset` | Restaura as fixtures |
| PUT | `/__mocks/scenario` | Ativa um cenário `{ name, options }` |
| POST | `/__mocks/nfts/:id/update` | Altera preço ou disponibilidade e emite `nft.updated` |
