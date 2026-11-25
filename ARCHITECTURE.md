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
  assets/                formas SVG exportadas do Figma
  components/
    ui/                  componentes shadcn adaptados
    layout/              header, footer, menu lateral, barra inferior mobile
    icons/               ícones do Figma (figma-icons.tsx é gerado)
    feedback/            páginas de 404 e de erro de rota
  lib/                   decimal, formatação, utilitários
  mocks/
    db/                  banco em memória, persistência, reset
    fixtures/            NFTs, usuários, cupons, carteiras
    handlers/            handlers REST por recurso
    socket/              servidor Socket.IO simulado
    scenarios/           cenários de rede e de negócio
    browser.ts           setup do worker
public/
  images/nfts/           imagens do Figma em WebP (480 e 960 px)
scripts/
  export-figma-assets.mjs  exporta ícones, formas e imagens pela API do Figma
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
| Valores em ETH como string + big.js (`src/lib/eth.ts`) | Evita erro de ponto flutuante e segue o enunciado. O big.js (cerca de 6 kB) cobre soma, multiplicação, comparação e arredondamento. O decimal.js seria 5 vezes maior, com funções que o projeto não usa. |
| Contratos em `src/api/contracts` como schemas Zod | Um schema gera o tipo e valida a resposta. O mesmo schema serve aos handlers do MSW, aos formulários (React Hook Form) e aos search params da URL do catálogo. |
| Vitest para regras puras | Aritmética, contratos e reconciliação de eventos se testam melhor isolados. Os fluxos da interface ficam no Playwright. |
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

Comportamentos definidos por nós em estados que o Figma não desenhou.

| Situação | Decisão |
| --- | --- |
| Navegação no tablet (768 a 1023 px) | O Figma só tem desktop e mobile. O header fica com logo, busca e carrinho, e a navegação vai para um menu lateral (Sheet). |
| Navegação no mobile | O Figma não tem header no mobile, só a barra inferior. O botão central da barra (ícone de leitura, sem função no escopo) abre o menu lateral, para a navegação principal continuar acessível. |
| Itens fora do escopo (Criadores, Aprenda, Atividade, Central de ajuda...) | Aparecem como texto com 60% de opacidade e aviso "(indisponível nesta demonstração)" para leitores de tela. Não são links, para não parecer que funcionam. |
| Newsletter do footer | O envio mostra um toast informativo dizendo que a newsletter não está disponível. Não simula cadastro. |
| Redes sociais | Abrem a página inicial de cada rede em nova aba (`rel="noopener noreferrer"`), com o aviso no nome acessível. |
| Contador do carrinho | O Figma mostra "6". O badge só vai aparecer no Passo 7, com a quantidade real do carrinho. |
| Página 404 e erro de rota | Mesmo layout das outras telas, com o código em `Primary`, texto e botão "Voltar ao início". O erro de rota oferece "Tentar de novo" sem recarregar a página. |

## Desvios do Figma

| Desvio | Motivo |
| --- | --- |
| Texto de erro em `#ff5c66` em vez de `#ed1b2e` | `#ed1b2e` tem 4,39:1 sobre o fundo, abaixo dos 4,5:1 da WCAG AA. A cor original continua em ícones e bordas. |
| Borda dos campos em `#8a5c40` em vez de `#3f2319` | `#3f2319` tem 1,34:1 e a WCAG pede 3:1 para componentes de interface. Cards e divisórias mantêm a cor original. |
| Botões em 3 tamanhos (36, 40 e 48 px) com raio de 5 px | O Figma usa 5 alturas e 3 raios para o mesmo papel. Onde a medida exata importa, a tela passa a classe (o "Entrar" do header continua com 35 px e raio de 6 px). |
| Campos com raio de 5 px em todas as telas | O Figma alterna entre 3 e 5 px. |
| Altura de linha mínima igual ao tamanho da fonte | Vários estilos do Figma têm altura de linha menor que a fonte (18 px com 16 px), o que corta acentos quando o texto quebra. |
| Marca KURIO no título da página | O nome da página no Figma é "GreenMint", mas o wordmark em todas as telas é KURIO. |
| Ícone de menu (`MenuIcon` do lucide) no header do tablet | O Figma não tem ícone de menu, porque não desenha o tablet. |

Nenhum asset foi substituído. Ícones, a forma da barra inferior e as imagens vêm do arquivo do Figma (ver [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)).

## Limitações

- Não há blockchain, extensão de carteira nem gateway de pagamento. Conexão, assinatura, hash de transação e link de explorador são simulados.
- A sessão é simulada: o token é opaco, emitido pelo MSW e guardado no navegador. Ver [docs/SECURITY.md](docs/SECURITY.md).
- O transporte Socket.IO é interceptado pelo MSW. As limitações do binding ficam registradas em [docs/REALTIME.md](docs/REALTIME.md).
- Os dados vivem no navegador de quem acessa. Dois navegadores não compartilham estado.
- O pacote `shadcn`, que fornece o `shadcn/tailwind.css`, traz um `minimatch` antigo (via `ts-morph`) com alerta moderado de DoS no `npm audit`. Ele só roda no build e não chega ao navegador. O `npm audit fix --force` trocaria a versão do shadcn por uma incompatível.
- Até o Passo 4, os links do layout usam `<a href>` e recarregam a página. Com as rotas criadas, passam a `<Link>` tipado do TanStack Router.
