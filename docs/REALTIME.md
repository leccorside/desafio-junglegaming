# Tempo real com Socket.IO

## Transporte

- Cliente: `socket.io-client` (`src/features/realtime/socket.ts`), conectado a `VITE_SOCKET_URL` (`ws://localhost/socket`). A URL vira origem `ws://localhost` e caminho `/socket/`, que o Socket.IO completa com `?EIO=4&transport=websocket`.
- Servidor simulado: `src/mocks/socket/server.ts`, com `@mswjs/socket.io-binding` sobre o `ws.link` do MSW, registrado no mesmo worker da API REST. Ele lê o banco dos mocks: a cada `onDbChange`, compara as versões e emite `nft.updated` (para todos) quando a `version` de um NFT sobe, e `order.updated` (só para o dono) quando a de um pedido sobe. O `eventId` é `<recurso>-<id>-v<version>-e<época>`: a época sobe a cada reset dos mocks, porque as versões voltam às das fixtures e o mesmo `eventId` se repetiria.
- O reset dos mocks (`onDbReset`) não emite nada: zera o último evento guardado e o log, ressincroniza as versões e manda um `realtime.sync` novo para cada conexão aberta. A aba aberta volta ao dado inicial sem recarregar.
- Um timer (500 ms) decide os pagamentos vencidos (`settleDueOrders`). Antes só a próxima requisição REST decidia, e sem tráfego o `order.updated` não saía.
- O usuário da conexão vem do `auth.token` do handshake (pacote `40{...}` do cliente), com as mesmas regras da API REST: sessão existente, não revogada e dentro da validade (`sessionUserId`). Token vencido vale como visitante, e a sessão é conferida de novo a cada envio com dono.
- O binding confirma o CONNECT sozinho, mas a conexão só entra na lista de envio depois de o servidor ler o pacote do cliente (com o token). Em seguida recebe o `realtime.sync`.
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
- Aviso de queda (`RealtimeStatusBanner`, no `RootLayout`, num contêiner de altura zero fixo no topo: fica por cima do começo da página, a trilha no desktop, sem empurrar o conteúdo e sem receber cliques, e continua à vista com a página rolada): estado `idle` (conectando, sem aviso), `online` (recebeu o `realtime.sync`) ou `offline` (`disconnect` que não foi pedido pelo cliente, ou `connect_error`). Fora do ar, mostra "Atualizações em tempo real pausadas. Reconectando… Os preços podem ter mudado." numa região `role="status"`; na volta, o texto some e o leitor de tela ouve "Atualizações em tempo real retomadas.". Só a conexão mais recente mexe no estado, então logout e troca de sessão não contam como queda.

## Sincronização (`realtime.sync`)

Mensagem de controle, fora do envelope dos eventos (schema `realtimeSyncSchema`):

```ts
type RealtimeSync = {
  reason: 'connect' | 'reset'     // conexão nova ou reconexão; reset dos dados de demonstração
  nfts: Record<string, number>    // versão atual de cada NFT
  orders: Record<string, number>  // versão atual dos pedidos do usuário da conexão
}
```

O servidor manda a cada conexão (a primeira, a de uma sessão nova, cada reconexão) e no reset dos mocks. O cliente:

1. Passa a usar essas versões como referência do porteiro (`gate.sync`): evento com versão menor ou igual é antigo, mesmo que esta conexão nunca o tenha visto. As versões são substituídas, não somadas, porque no reset elas voltam para trás.
2. Compara com as cópias em cache (`reconcileWithServer`): detalhe, catálogo, destaques, lista de interesse e itens do carrinho (`nftVersion`). Busca de novo só o que tem versão diferente. Sem diferença, nada é buscado, e abrir a página não duplica requisições.
3. Marca `['orders']` como velho (os pedidos ganham tela no Passo 10).
4. Com `reason: 'connect'`, compara o carrinho da sessão antes e depois da busca (`describeCartDiff`) e mostra o que mudou no mesmo aviso dos eventos ("… o preço mudou de 1.59 ETH para 1.79 ETH. O resumo do carrinho foi atualizado."). Sem isso, uma mudança perdida durante a queda mudava linha e resumo calada.
5. Com `reason: 'reset'` (só nos mocks), busca de novo tudo (NFTs, lista de interesse, carrinho, cotação e pedidos), porque carrinho e favoritos voltam às fixtures sem mudar a versão dos NFTs, e mostra "Os dados de demonstração foram restaurados.". Não compara o carrinho: o do visitante some com os dados iniciais.

Assim volta pela API o que mudou antes de a conexão abrir (página carregando, troca de sessão, handshake lento) ou durante uma queda.

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
- Se algum carrinho em cache tem o NFT numa versão mais antiga que a do evento (`nftVersion`), invalida carrinho e cotação. Evento atrasado em relação ao carrinho não avisa nem invalida nada. A invalidação cancela antes a primeira busca em andamento: sem isso o TanStack reaproveitava essa busca, calculada antes da mudança, e o resumo ficava com a cotação antiga.
- O aviso diz o que mudou no carrinho da sessão atual (não soma o do visitante durante o merge do login): "Violet Nomad #314 (edição aberta): o preço mudou de 1.39 ETH para 1.59 ETH. O resumo do carrinho foi atualizado.", "… esgotou.", "… ficou indisponível." ou "… só N disponíveis.". Com a página do carrinho aberta, ele aparece no fluxo, acima da lista, numa região `role="status"` com o botão "Fechar aviso" (um toast no topo cobria o nome do primeiro item no mobile). Em outras telas, vira toast do Sonner. O carrinho buscado de novo traz `previousUnitPrice`, e a linha do item mostra a mudança. Item esgotado não mostra total na linha, porque fica fora da cotação.
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
- O evento só é registrado depois de aplicado. Se a aplicação falhar, uma reentrega tenta de novo. Cada listener de `order.updated` roda isolado: a falha de um não impede os seguintes.

## Isolamento por usuário

- Evento com `userId` diferente do usuário da sessão atual é descartado.
- O registro de eventos processados é zerado na troca de sessão.
- O servidor não entrega evento de pedido a token vencido ou revogado, nem a uma conexão que ainda não se autenticou.

## Reconexão

Ao reconectar, pelo `realtime.sync` da nova conexão:

1. Buscar de novo o que tem versão diferente da do servidor: NFTs, lista de interesse, carrinho e cotação. Pedidos são sempre marcados como velhos.
2. Buscar os pedidos pendentes do usuário (`GET /orders?status=pending`) e atualizar o cache (Passo 10, junto com o fluxo de pedido).
3. A versão vinda da API passa a ser a referência para os próximos eventos.

O evento perdido durante a queda não é reenviado; quem traz o dado novo é a API.

Ao recarregar a página com pedido pendente, a tela de pagamento ou de pedido consulta o pedido pela chave de idempotência guardada, sem criar outro.

## Cenário obrigatório

1. Um NFT está no carrinho.
2. O preço ou a disponibilidade muda (`nft.updated`).
3. A interface avisa e atualiza o resumo.
4. O checkout não confirma com a cotação antiga.
