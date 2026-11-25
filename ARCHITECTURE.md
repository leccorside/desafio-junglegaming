# Arquitetura

Visão técnica da solução. Os detalhes de cada área ficam nos documentos de `docs/`, referenciados ao longo do texto.

> Este documento descreve a arquitetura planejada e é corrigido à medida que a implementação avança.

## Visão geral

A aplicação é uma SPA servida estaticamente. Não existe backend real: o MSW intercepta as chamadas REST e a conexão Socket.IO no navegador, e mantém um banco em memória persistido no `localStorage`.

```text
Componentes (React + shadcn/ui + Tailwind)
        │  hooks de feature
        ▼
TanStack Query  ◄────── eventos ──────  socket.io-client
        │                                     │
        ▼                                     │
Axios (src/api/client.ts)                     │
        │                                     │
════════╪═══════════ rede ════════════════════╪══════
        ▼                                     ▼
MSW handlers REST              MSW socket.io-binding
        └──────────────► banco dos mocks ◄────┘
                         (localStorage)
```

Os dois lados do MSW leem e escrevem no mesmo banco. Uma mudança de preço feita por um cenário aparece tanto na resposta REST quanto no evento `nft.updated`.

## Estrutura de pastas

```text
src/
  api/
    client.ts            instância Axios, interceptors, normalização de erros
    contracts/           schemas Zod e tipos compartilhados (REST e eventos)
  features/
    auth/                sessão, login, cadastro, logout
    catalog/             início, destaques, busca e filtros
    nft/                 detalhe, galeria, edição, quantidade
    favorites/
    cart/                carrinho, cupom, cotação
    checkout/            pagamento, revisão, idempotência
    orders/              estado do pedido, recibo
    profile/
    wallets/
    realtime/            cliente Socket.IO e aplicação de eventos no cache
  routes/                rotas do TanStack Router (por arquivo)
  components/
    ui/                  componentes shadcn adaptados
    layout/              header, footer, menu mobile
  lib/                   decimal, formatação, utilitários
  mocks/
    db/                  banco em memória, persistência, reset
    fixtures/            NFTs, usuários, cupons, carteiras
    handlers/            handlers REST por recurso
    socket/              servidor Socket.IO simulado
    scenarios/           cenários de rede e de negócio
    browser.ts           setup do worker
tests/
  e2e/                   specs Playwright
  fixtures/              helpers de cenário, relógio e socket
lighthouse/              configuração e relatórios
docs/
```

Cada pasta em `features/` concentra os hooks de query e mutation, as query keys, os componentes e os schemas de formulário do domínio.

## Decisões técnicas

| Decisão | Motivo |
| --- | --- |
| Vite como build | Build rápido, suporte direto do TanStack Router e da Vercel. |
| Rotas por arquivo no TanStack Router | Search params tipados e validados, e `beforeLoad` para proteger rotas. |
| Zod nos contratos | Um schema gera o tipo e valida a resposta no limite da rede. |
| Valores em ETH como string + biblioteca decimal | Evita erro de ponto flutuante e segue o enunciado. |
| Banco dos mocks no `localStorage` | Sustenta refresh sem backend, e o reset volta às fixtures. |
| Carrinho do visitante com `X-Cart-Id` | Permite persistir e depois juntar ao carrinho do usuário no login. |
| `Idempotency-Key` persistida por tentativa | Recupera o mesmo pedido depois de timeout ou refresh. |
| Eventos com `eventId` e `version` | Descarta duplicados e eventos antigos sem regredir o cache. |
| TypeScript 6.0, e não o 7 | O `typescript-eslint` aceita até a 6.0. |
| MSW 2.x, e não o 3 | O `@mswjs/socket.io-binding` declara dependência do `msw` 2. |
| shadcn/ui sobre Radix | Diálogos e drawers do Radix prendem e devolvem o foco, como pede a acessibilidade. |
| Modo `mocks` do Vite (`.env.mocks`) | Liga o MSW no `dev:mocks`, nos testes e no deploy sem variável no painel da Vercel. |
| Playwright contra o build de produção | Os testes exercitam o mesmo bundle publicado, com o service worker real. |
| Devtools do Router e do Query carregadas sob demanda só em desenvolvimento | Ficam fora do bundle de produção. |

Os detalhes estão em [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md), [docs/REALTIME.md](docs/REALTIME.md), [docs/SECURITY.md](docs/SECURITY.md) e [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).

## Decisões de UX

A preencher durante a implementação. Registrar aqui comportamentos definidos por nós em estados que o Figma não desenhou (erros, vazios, pedido pendente, aviso de preço alterado).

## Desvios do Figma

A preencher. Registrar asset substituído, ajuste de contraste, tamanho de alvo de toque ou qualquer outra diferença em relação ao layout, com o motivo.

## Limitações

- Não há blockchain, extensão de carteira nem gateway de pagamento. Conexão, assinatura, hash de transação e link de explorador são simulados.
- A sessão é simulada: o token é opaco, emitido pelo MSW e guardado no navegador. Ver [docs/SECURITY.md](docs/SECURITY.md).
- O transporte Socket.IO é interceptado pelo MSW. As limitações do binding ficam registradas em [docs/REALTIME.md](docs/REALTIME.md).
- Os dados vivem no navegador de quem acessa. Dois navegadores não compartilham estado.
