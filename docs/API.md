# Contratos REST

Contratos da API simulada pelo MSW. A fonte da verdade são os schemas Zod em `src/api/contracts/`. Cada schema valida a resposta no limite da rede e gera o tipo TypeScript usado pelo cache e pela interface. Este documento descreve esses schemas e precisa mudar junto com eles.

| Arquivo | Conteúdo |
| --- | --- |
| `common.ts` | Valor em ETH, IDs, datas, versão, paginação, cabeçalhos e formato de erro |
| `network.ts` | Redes e validação de endereço por rede |
| `auth.ts` | Sessão, cadastro, login, regras de senha, e-mail e nome de usuário |
| `nft.ts` | NFT, edições, categorias, parâmetros e resposta da listagem |
| `favorites.ts` | Favoritos |
| `cart.ts` | Carrinho, itens, merge e cupom |
| `quote.ts` | Cotação e detalhes de `QUOTE_OUTDATED` |
| `order.ts` | Pedido, snapshot, comprador e chave de idempotência |
| `profile.ts` | Perfil, avatar e troca de senha |
| `wallet.ts` | Carteiras, tipos de carteira e ENS |
| `events.ts` | Eventos Socket.IO (ver [REALTIME.md](REALTIME.md)) |

## Convenções

- Base: `VITE_API_URL` (padrão `/api`).
- JSON em `camelCase`. Datas em ISO 8601 com fuso (`2026-11-25T15:00:00.000Z`).
- **Valores em ETH são strings decimais** (`"1.19"`), com até 18 casas, sem sinal e sem notação exponencial. Nunca `number`. A aritmética usa `src/lib/eth.ts` (big.js).
- Quantidades são inteiros positivos.
- Todo recurso que muda tem `version` (inteiro crescente), base da ordenação de eventos.
- Cabeçalhos (`HEADERS` em `common.ts`):

| Cabeçalho | Uso |
| --- | --- |
| `Authorization: Bearer <token>` | Rotas autenticadas |
| `X-Cart-Id: <uuid>` | Carrinho do visitante |
| `Idempotency-Key: <uuid>` | Obrigatório em `POST /orders`, um por tentativa de compra |

## Formato de erro

Toda resposta 4xx/5xx tem o corpo:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Alguns campos estão inválidos.",
    "fields": { "email": "Informe um e-mail válido." },
    "retryable": false,
    "details": {}
  }
}
```

- `fields`: erros por campo (nome do campo → mensagem), mostrados no formulário.
- `retryable`: se repetir a mesma requisição pode dar certo. Só é `true` em falha transitória.
- `details`: dados extras do código, descritos na tabela.

| Status | Código | Quando | `details` |
| --- | --- | --- | --- |
| 400 | `BAD_REQUEST` | Parâmetro malformado | |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido | |
| 401 | `SESSION_EXPIRED` | Token vencido | |
| 401 | `INVALID_CREDENTIALS` | E-mail ou senha errados no login | |
| 403 | `FORBIDDEN` | Recurso de outro usuário | |
| 404 | `NOT_FOUND` | Recurso inexistente | |
| 409 | `EMAIL_TAKEN` | Cadastro com e-mail existente | |
| 409 | `USERNAME_TAKEN` | Nome de usuário em uso | |
| 409 | `AVAILABILITY_CONFLICT` | Quantidade acima do estoque | `{ maxQuantity }` |
| 409 | `QUOTE_OUTDATED` | Cotação desatualizada ao criar o pedido | `{ quote, changes[] }` |
| 409 | `IDEMPOTENCY_CONFLICT` | Mesma chave com conteúdo diferente | |
| 422 | `VALIDATION_ERROR` | Campos inválidos | |
| 422 | `INVALID_PASSWORD` | Senha atual incorreta na troca | |
| 422 | `COUPON_INVALID` | Cupom inexistente | |
| 422 | `COUPON_EXPIRED` | Cupom fora da validade | |
| 500 | `INTERNAL_ERROR` | Erro inesperado | |
| 503 | `SERVICE_UNAVAILABLE` | Falha transitória (`retryable: true`) | |

O status de cada código está em `API_ERROR_STATUS`. Quando não há resposta, o cliente normaliza o erro com códigos próprios (`ClientErrorCode`): `NETWORK_ERROR`, `TIMEOUT`, `CANCELED` e `INVALID_RESPONSE` (resposta que não passa no schema).

## Sessão e conta

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| POST | `/auth/register` | `RegisterRequest` | `201 Session` |
| POST | `/auth/login` | `LoginRequest` | `200 Session` |
| GET | `/auth/session` | | `200 Session` |
| POST | `/auth/logout` | | `204` |

```ts
type User = { id: string; username: string; displayName: string; email: string; avatarUrl: string | null }
type Session = { token: string; expiresAt: string; user: User }
type RegisterRequest = { username: string; email: string; password: string }
type LoginRequest = { email: string; password: string }
```

Regras de validação (iguais no cliente e nos handlers):

- `username`: 3 a 30 caracteres, letras, números, `.`, `-` e `_`.
- `email`: normalizado (sem espaços, minúsculas).
- `password`: 8 a 72 caracteres, com minúscula, maiúscula, número e símbolo.
- O formulário de cadastro usa `registerFormSchema`, que acrescenta `confirmPassword`.

## NFTs

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/nfts` | `200 NftListResponse` |
| GET | `/nfts/featured` | `200 { items: Nft[] }` |
| GET | `/nfts/:id` | `200 Nft` ou `404 NOT_FOUND` |

```ts
type NftEdition = {
  id: string
  name: string               // "1/1", "1/10", "1/50", "Aberta"
  supply: number | null      // null em edição aberta
  price: string              // ETH
  available: number
  status: 'available' | 'sold_out' | 'unavailable'
}

type Nft = {
  id: string
  tokenId: string            // "0042"
  name: string
  description: string
  creator: { id: string; name: string; avatarUrl: string | null }
  collection: { id: string; name: string }
  category: NftCategory
  network: 'ethereum' | 'polygon' | 'solana'
  rarity: 'common' | 'rare' | 'legendary'
  attributes: string[]
  contract: { address: string; standard: 'ERC-721' | 'ERC-1155' | 'SPL' }
  royaltyPercent: number
  rating: { average: number; count: number }
  images: { url: string; alt: string; width: number; height: number }[]
  editions: NftEdition[]
  priceFrom: string          // menor preço entre as edições disponíveis
  listedAt: string
  version: number
  updatedAt: string
}
```

Categorias (`NFT_CATEGORY_LABELS`): `digital-art` (Arte digital), `photography` (Fotografia), `music` (Música), `3d-art` (Arte 3D), `collectibles` (Colecionáveis), `generative` (Generativa), `gaming` (Jogos), `memberships` (Assinaturas), `utility` (Utilidade).

### Parâmetros de `/nfts`

O mesmo schema (`nftListParamsSchema`) valida os search params da URL do catálogo. `toNftListQuery` serializa os parâmetros e omite os valores padrão. `parseNftListQuery` faz a leitura nos handlers.

| Parâmetro | Tipo | Padrão | Exemplo |
| --- | --- | --- | --- |
| `q` | texto (até 80) | | `ape` |
| `feed` | `all` \| `new` \| `trending` (abas do catálogo) | `all` | `new` |
| `category` | lista separada por vírgula | | `digital-art,music` |
| `network` | lista separada por vírgula | | `ethereum,solana` |
| `minPrice` / `maxPrice` | ETH (`minPrice ≤ maxPrice`) | | `0.02` |
| `availability` | `available` \| `sold_out` | | `available` |
| `sort` | `recent` \| `price_asc` \| `price_desc` \| `popular` | `recent` | `price_asc` |
| `page` | inteiro ≥ 1 | `1` | `2` |
| `pageSize` | inteiro de 1 a 48 | `12` | `24` |

### Resposta de `/nfts`

```ts
type NftListResponse = {
  items: Nft[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    categories: Record<NftCategory, number>   // "Arte digital (33)"
    networks: Record<Network, number>         // "Ethereum (119)"
    priceRange: { min: string; max: string }  // "0,02 - 12,30 ETH"
  }
}
```

## Favoritos (autenticado)

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/me/favorites` | `200 { nftIds: string[]; items: Nft[] }` |
| PUT | `/me/favorites/:nftId` | `200 { nftIds: string[] }` (idempotente) |
| DELETE | `/me/favorites/:nftId` | `200 { nftIds: string[] }` (idempotente) |

## Carrinho

Aceita visitante (`X-Cart-Id`) ou usuário autenticado.

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/cart` | | `200 Cart` |
| POST | `/cart/items` | `{ nftId, editionId, quantity }` | `200 Cart` ou `409 AVAILABILITY_CONFLICT` |
| PATCH | `/cart/items/:itemId` | `{ quantity }` | `200 Cart` ou `409 AVAILABILITY_CONFLICT` |
| DELETE | `/cart/items/:itemId` | | `200 Cart` |
| POST | `/cart/merge` | `{ guestCartId }` | `200 { cart, adjustments[] }` |
| PUT | `/cart/coupon` | `{ code }` | `200 Cart` ou `422 COUPON_INVALID` / `COUPON_EXPIRED` |
| DELETE | `/cart/coupon` | | `200 Cart` |

```ts
type CartItem = {
  id: string
  nftId: string
  editionId: string
  name: string
  editionName: string
  tokenId: string
  imageUrl: string
  unitPrice: string                 // ETH, preço atual
  previousUnitPrice: string | null  // preço anterior, quando mudou
  quantity: number
  available: number
  status: 'ok' | 'price_changed' | 'insufficient' | 'sold_out'
  nftVersion: number
}
type Cart = {
  id: string
  owner: 'user' | 'guest'
  items: CartItem[]
  couponCode: string | null
  version: number
  updatedAt: string
}
```

O código do cupom é normalizado para maiúsculas. `adjustments` no merge lista os itens que não couberam por estoque (`requested` × `added`).

## Cotação

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| POST | `/quotes` | `{ network }` | `200 Quote` |

```ts
type Quote = {
  id: string
  version: number
  network: Network
  lines: { itemId: string; nftId: string; editionId: string; unitPrice: string; quantity: number; lineTotal: string }[]
  subtotal: string
  discount: string
  networkFee: string
  total: string
  coupon: { code: string; description: string } | null
  blockedItemIds: string[]   // itens esgotados ou acima do estoque, fora da cotação
  expiresAt: string
}
```

No erro `QUOTE_OUTDATED`, `details` traz a cotação nova e a lista do que mudou:

```ts
type QuoteOutdatedDetails = {
  quote: Quote
  changes: { kind: 'price' | 'availability' | 'coupon' | 'fee'; message: string }[]
}
```

## Pedidos (autenticado)

| Método | Rota | Resposta |
| --- | --- | --- |
| POST | `/orders` (exige `Idempotency-Key`) | `201 Order` na criação, `200 Order` quando a mesma chave recupera o pedido |
| GET | `/orders/:id` | `200 Order`, `403 FORBIDDEN` ou `404 NOT_FOUND` |
| GET | `/orders?status=pending` | `200 { items: Order[] }`, para retomar pedidos pendentes |

```ts
type Buyer = { displayName: string; email: string; note?: string }  // "Observação do colecionador (opcional)"
type CreateOrderRequest = {
  quoteId: string
  quoteVersion: number
  walletId: string
  network: Network
  buyer: Buyer
}
type Order = {
  id: string
  status: 'pending' | 'confirmed' | 'rejected'
  rejectionReason: string | null
  transaction: { hash: string; explorerUrl: string } | null   // só em pedido confirmado
  snapshot: {
    items: { nftId; editionId; name; editionName; tokenId; imageUrl; unitPrice; quantity; lineTotal }[]
    subtotal: string
    discount: string
    networkFee: string
    total: string
    couponCode: string | null
    network: Network
    wallet: { address: string; type: WalletType; label: string }
    buyer: Buyer
  }
  version: number
  createdAt: string
  updatedAt: string
}
```

`confirmed` e `rejected` são terminais (`isTerminalOrderStatus`). A mesma `Idempotency-Key` com o mesmo corpo devolve o mesmo pedido. Com corpo diferente, a resposta é `409 IDEMPOTENCY_CONFLICT`.

## Perfil (autenticado)

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/me/profile` | | `200 Profile` |
| PATCH | `/me/profile` | `{ displayName, username, ensName }` | `200 Profile` ou `409 USERNAME_TAKEN` |
| PUT | `/me/avatar` | `multipart/form-data` (`avatar`) | `200 Profile` |
| DELETE | `/me/avatar` | | `200 Profile` |
| POST | `/me/password` | `{ currentPassword, newPassword }` | `204` ou `422 INVALID_PASSWORD` |

```ts
type Profile = {
  id: string
  displayName: string
  username: string
  email: string          // só leitura no perfil
  ensName: string | null // sem o sufixo ".eth"
  avatarUrl: string | null
  updatedAt: string
}
```

Avatar: PNG, JPEG ou WebP, até 2 MB (`avatarFileSchema`). O formulário de senha usa `changePasswordFormSchema`, que acrescenta `confirmPassword` e recusa a nova senha igual à atual.

## Carteiras (autenticado)

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/me/wallets` | | `200 { items: Wallet[] }` |
| POST | `/me/wallets` | `CreateWalletRequest` | `201 Wallet` |
| PATCH | `/me/wallets/:id` | `UpdateWalletRequest` | `200 Wallet` |

```ts
type Wallet = {
  id: string
  role: 'primary' | 'secondary'
  label: string                                   // "Apelido da carteira"
  network: Network
  type: 'metamask' | 'walletconnect' | 'coinbase'
  address: string
  ensName: string | null
  updatedAt: string
}
type CreateWalletRequest = Omit<Wallet, 'id' | 'updatedAt'>
type UpdateWalletRequest = Omit<Wallet, 'id' | 'role' | 'updatedAt'>
```

O endereço é validado conforme a rede: `0x` + 40 hexadecimais em Ethereum e Polygon, base58 com 32 a 44 caracteres em Solana.

## Mocks

Utilitários disponíveis só com os mocks ligados, usados pelo painel de desenvolvimento e pelos testes. Ver [MOCKS.md](MOCKS.md).

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/__mocks/reset` | Restaura as fixtures |
| PUT | `/__mocks/scenario` | Ativa um cenário `{ name, options }` |
| POST | `/__mocks/nfts/:id/update` | Altera preço ou disponibilidade e emite `nft.updated` |
