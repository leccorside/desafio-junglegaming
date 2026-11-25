# Mocks com MSW

A API e os eventos são simulados na camada de rede com MSW. Componentes, hooks e o cliente Axios não sabem que estão falando com um mock.

## Ativação

- Controlada por `VITE_ENABLE_MOCKS`. Fica ligada no desenvolvimento, nos testes e no build de demonstração publicado.
- O worker (`public/mockServiceWorker.js`) é registrado antes da primeira renderização, para nenhuma requisição escapar.
- REST: handlers `http` do MSW em `src/mocks/handlers`.
- Socket.IO: `@mswjs/socket.io-binding` em `src/mocks/socket`. Detalhes em [REALTIME.md](REALTIME.md).

## Banco dos mocks

- Banco em memória em `src/mocks/db`, com coleções de usuários, sessões, NFTs, favoritos, carrinhos, cupons, cotações, pedidos e carteiras.
- Persistido no `localStorage` com chave versionada. Se a versão do schema mudar, o banco volta às fixtures.
- REST e Socket.IO leem e escrevem no mesmo banco, o que mantém as duas pontas consistentes.

## Fixtures

| Conjunto | Conteúdo |
| --- | --- |
| NFTs | Por volta de 60 NFTs com categorias, coleções, faixas de preço e disponibilidades variadas, suficiente para filtros e várias páginas. Inclui NFT com edição esgotada e com edição indisponível. |
| Usuários | `ana@example.com` e `bruno@example.com`, senha `Senha@123` (hash). Cada um com favoritos, carteiras e um pedido anterior. |
| Cupons | `BEMVINDO10` (10%), `FIXO005` (0.05 ETH), `EXPIRADO` (vencido). Qualquer outro código é inválido. |
| Carteiras | Principal e secundária por usuário, em redes diferentes. |

As imagens das fixtures ficam em `public/` para funcionar offline.

## Reset

- `POST /__mocks/reset` ou o botão do painel de desenvolvimento.
- Restaura todas as coleções às fixtures, encerra sessões, limpa a fila de eventos e volta ao cenário padrão.
- Os testes chamam o reset antes de cada caso.

## Cenários

Selecionados por `?scenario=<nome>`, pelo painel de desenvolvimento ou por `PUT /__mocks/scenario`. Cenários de rede e de negócio podem ser combinados.

### Rede

| Cenário | Efeito |
| --- | --- |
| `default` | Latência curta e estável |
| `slow` | Latência alta fixa (para ver skeletons) |
| `jitter` | Latência variável com semente fixa, gerando respostas fora de ordem |
| `timeout` | A requisição não responde até estourar o timeout do Axios |
| `offline` | Erro de rede |
| `server-error` | Respostas 500/503 nas rotas escolhidas |
| `flaky` | Falha na primeira tentativa e sucesso na seguinte |

### Negócio

| Cenário | Efeito |
| --- | --- |
| `empty-catalog` | Catálogo sem resultados |
| `session-expired` | Sessão expira na próxima chamada autenticada |
| `forbidden` | Acesso negado a recurso de outro usuário |
| `register-conflict` | Cadastro devolve `EMAIL_TAKEN` |
| `validation-error` | Formulários devolvem erro por campo |
| `favorite-fails` | Mutation de favorito falha (para testar rollback) |
| `price-changed-on-checkout` | Preço muda entre a revisão e a confirmação |
| `sold-out-on-checkout` | Edição esgota durante a compra |
| `order-timeout` | O pedido é criado, mas a resposta não chega |
| `payment-confirmed` | Pedido confirmado depois de um atraso |
| `payment-rejected` | Pedido recusado |
| `wallet-rejected` | Usuário recusa a conexão da carteira |
| `wallet-disconnected` | Carteira desconecta durante o checkout |

A lista final é confirmada no Passo 3.

## Como reproduzir as falhas

A preencher no Passo 3, com o passo a passo de cada cenário (URL, ação na tela e resultado esperado).

## Regras

- Nenhuma resposta fictícia fora de `src/mocks`.
- Cenários são determinísticos: latência variável usa gerador com semente.
- Os mesmos handlers e fixtures servem ao desenvolvimento, à demonstração e aos testes.
