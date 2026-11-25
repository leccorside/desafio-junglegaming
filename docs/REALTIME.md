# Tempo real com Socket.IO

## Transporte

- Cliente: `socket.io-client`, conectado a `VITE_SOCKET_URL`.
- Servidor simulado: `@mswjs/socket.io-binding` sobre o suporte a WebSocket do MSW. O servidor lê o banco dos mocks e emite eventos quando os dados mudam.
- Os testes disparam eventos pelo servidor simulado (por `/__mocks/...` ou helper do Playwright). Nunca chamam setter, callback ou o cache direto.

### Limitações do transporte

A preencher no Passo 8 depois de testar o binding. Pontos a verificar: suporte só ao transporte WebSocket (sem long-polling), comportamento de reconexão automática, salas e namespaces, e como simular queda de conexão.

## Ciclo de vida

- O socket conecta depois que a sessão é estabelecida, autenticado com o token.
- Logout ou troca de usuário desconectam o socket e removem todos os listeners antes de qualquer outra coisa.
- Cada hook que assina eventos remove seus listeners no cleanup do `useEffect`.
- O visitante recebe só eventos públicos (`nft.updated`).

## Envelope dos eventos

```ts
type RealtimeEvent<T> = {
  eventId: string           // identidade estável, para descartar duplicados
  type: 'nft.updated' | 'order.updated'
  resource: { type: 'nft' | 'order'; id: string }
  version: number           // versão do recurso depois da mudança
  occurredAt: string
  userId: string | null     // dono do recurso, null para eventos públicos
  data: unknown
}
```

## Eventos

### `nft.updated`

```ts
type NftUpdatedData = {
  nftId: string
  editions: { id: string; price: string; available: number; status: 'available' | 'sold_out' | 'unavailable' }[]
}
```

Efeito no cliente:

- Atualiza o NFT no cache do detalhe e nas páginas do catálogo que o contêm.
- Se o NFT está no carrinho, marca o item como alterado, invalida o carrinho e a cotação, e anuncia a mudança em região `aria-live`.
- No checkout, invalida a cotação atual. A confirmação fica bloqueada até o usuário revisar a nova cotação.

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

Ao reconectar:

1. Invalidar as queries ativas de NFTs, carrinho e cotação.
2. Buscar os pedidos pendentes do usuário (`GET /orders?status=pending`) e atualizar o cache.
3. A versão vinda da API passa a ser a referência para os próximos eventos.

Ao recarregar a página com pedido pendente, a tela de pagamento ou de pedido consulta o pedido pela chave de idempotência guardada, sem criar outro.

## Cenário obrigatório

1. Um NFT está no carrinho.
2. O preço ou a disponibilidade muda (`nft.updated`).
3. A interface avisa e atualiza o resumo.
4. O checkout não confirma com a cotação antiga.
