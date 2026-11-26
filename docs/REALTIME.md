# Tempo real com Socket.IO

## Transporte

- Cliente: `socket.io-client` (`src/features/realtime/socket.ts`), conectado a `VITE_SOCKET_URL` (`ws://localhost/socket`). A URL vira origem `ws://localhost` e caminho `/socket/`, que o Socket.IO completa com `?EIO=4&transport=websocket`.
- Servidor simulado: `src/mocks/socket/server.ts`, com `@mswjs/socket.io-binding` sobre o `ws.link` do MSW, registrado no mesmo worker da API REST. Ele lê o banco dos mocks: a cada `onDbChange`, compara as versões e emite `nft.updated` (para todos) quando a `version` de um NFT sobe, e `order.updated` (só para o dono) quando a de um pedido sobe. O reset do banco só ressincroniza as versões, sem emitir nada.
- O usuário da conexão vem do `auth.token` do handshake (pacote `40{...}` do cliente), procurado nas sessões do banco. Sem token, ou com token revogado, a conexão é de visitante.
- Os testes disparam eventos pelo servidor simulado (rotas `/__mocks/...`, ver [MOCKS.md](MOCKS.md)). Nunca chamam setter, callback ou o cache direto.

### Limitações do transporte

Encontradas ao integrar o binding (versões `msw` 2.15 e `@mswjs/socket.io-binding` 0.2):

- **Só WebSocket.** O MSW intercepta WebSocket, não o long-polling do Engine.IO. O cliente usa `transports: ['websocket']`.
- **Importação dinâmica obrigatória.** O `engine.io-client` guarda o `WebSocket` global quando o módulo carrega. Importado no começo do app, antes de `worker.start()`, ele fica com o WebSocket nativo e a conexão é recusada (não há servidor de verdade). Por isso `connectRealtime` faz `import('socket.io-client')` na hora de conectar.
- **Caminho exato no `ws.link`.** O MSW compara só o caminho (`ws://localhost/socket/`), sem a query do Engine.IO. Um padrão com curinga (`/socket/*`) não pegou a conexão.
- **Pings.** O binding responde ao handshake (pacotes `0` e `40`), mas não manda os pings do Engine.IO. Sem eles o cliente desconecta por tempo esgotado. O servidor simulado manda `2` a cada 20 s.
- **Sem salas nem namespaces.** O binding não implementa salas; o servidor guarda as conexões com o `userId` de cada uma e filtra o envio (`broadcast`). Só o namespace padrão (`/`).
- **Queda simulada.** `POST /__mocks/realtime/disconnect` fecha as conexões e recusa novas por `downMs`. A recusa dispara `error` e depois `close` no WebSocket simulado: enquanto abre, o Engine.IO só reage a `error`, e um `close` sozinho o deixava parado até o tempo limite de 20 s, sem nova tentativa.
- **Quadros invisíveis no Playwright.** O WebSocket é simulado dentro da página, então `page.on('websocket')` não vê nada. Os testes provam a entrega pela tela (mudou sem nenhuma requisição REST do recurso) e pela lista de conexões (`GET /__mocks/realtime/peers`).

## Ciclo de vida

- `useRealtime()` (no `RootLayout`) abre uma conexão por sessão: de visitante sem token e, depois do login, autenticada com o token. Trocar o token fecha a conexão anterior e abre outra.
- No logout, na expiração e na troca de conta, a conexão fecha no início do `endSession` (`onSessionEnd`), antes de apagar a sessão e reiniciar o cache. O fechamento remove todos os listeners (`socket.off()`, `socket.io.off()`) antes do `disconnect()`.
- Cada conexão tem o próprio registro de eventos (`createEventGate`), então nada da sessão anterior passa para a seguinte.
- O visitante recebe só eventos públicos (`nft.updated`).
- Reconexão automática do Socket.IO com espera de 500 ms a 3 s.

## Envelope dos eventos

Os schemas ficam em `src/api/contracts/events.ts`. Os nomes dos eventos estão em `REALTIME_EVENTS`, e todo evento recebido passa por `realtimeEventSchema` (união discriminada por `type`) antes de tocar o cache. Evento que não passa no schema é descartado.

```ts
type RealtimeEvent<T> = {
  eventId: string           // identidade estável, para descartar duplicados
  type: 'nft.updated' | 'order.updated'
  resource: { type: 'nft' | 'order'; id: string }
  version: number           // versão do recurso depois da mudança
  occurredAt: string        // ISO 8601 com fuso
  userId: string | null     // dono do recurso
  data: T
}
```

| Evento | `resource.type` | `userId` |
| --- | --- | --- |
| `nft.updated` | `nft` | sempre `null` (catálogo é público) |
| `order.updated` | `order` | sempre o dono do pedido |

## Eventos

### `nft.updated`

```ts
type NftUpdatedData = {
  nftId: string
  priceFrom: string   // ETH, novo menor preço entre as edições disponíveis
  editions: { id: string; price: string; available: number; status: 'available' | 'sold_out' | 'unavailable' }[]
}
```

Efeito no cliente (`applyNftUpdated`):

- Atualiza o NFT no cache do detalhe, das páginas do catálogo, dos destaques e da lista de interesse, só onde a cópia tem `version` menor que a do evento.
- Se o NFT está no carrinho, invalida o carrinho e a cotação e mostra um toast (região `aria-live` do Sonner) com o que mudou: "Violet Nomad #314 (edição aberta): o preço mudou de 1.39 ETH para 1.59 ETH. O resumo do carrinho foi atualizado.", "… esgotou." ou "… só N disponíveis.". O carrinho buscado de novo traz `previousUnitPrice`, e a linha do item mostra a mudança.
- No checkout (Passo 9), invalida a cotação atual. A confirmação fica bloqueada até o usuário revisar a nova cotação.

### `order.updated`

```ts
type OrderUpdatedData = {
  orderId: string
  status: 'pending' | 'confirmed' | 'rejected'
  rejectionReason: string | null
  transaction: { hash: string; explorerUrl: string } | null
}
```

Efeito no cliente:

- Atualiza o pedido no cache.
- `confirmed`: remove do carrinho os itens comprados (invalidando o carrinho) e mostra o recibo.
- `rejected`: mostra a recusa com o motivo e mantém o carrinho.

## Ordenação e duplicados

- O cliente guarda os `eventId` já processados (janela limitada) e ignora repetidos.
- Para cada recurso, guarda a última `version` aplicada. Evento com versão menor ou igual é descartado.
- Pedido em estado terminal (`confirmed` ou `rejected`) nunca volta para `pending`.
- Efeitos colaterais (aviso, limpeza do carrinho) só rodam na primeira aplicação de um evento.

## Isolamento por usuário

- Evento com `userId` diferente do usuário da sessão atual é descartado.
- O registro de eventos processados é zerado na troca de sessão.

## Reconexão

Ao reconectar (`socket.io.on('reconnect')`):

1. Invalidar as queries de NFTs, carrinho, cotação e pedidos (`['orders']`). As que estão na tela buscam de novo na hora.
2. Buscar os pedidos pendentes do usuário (`GET /orders?status=pending`) e atualizar o cache (Passo 10, junto com o fluxo de pedido).
3. A versão vinda da API passa a ser a referência para os próximos eventos.

O evento perdido durante a queda não é reenviado; quem traz o dado novo é a API.

Ao recarregar a página com pedido pendente, a tela de pagamento ou de pedido consulta o pedido pela chave de idempotência guardada, sem criar outro.

## Cenário obrigatório

1. Um NFT está no carrinho.
2. O preço ou a disponibilidade muda (`nft.updated`).
3. A interface avisa e atualiza o resumo.
4. O checkout não confirma com a cotação antiga.
