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
    client.ts            instância Axios, interceptors e apiRequest (valida com o schema)
    errors.ts            ApiError e normalizeError
    contracts/           schemas Zod e tipos compartilhados (REST e eventos)
  hooks/                 hooks genéricos (useMediaQuery)
  features/
    auth/                sessão (store, ciclo de vida), login, cadastro, logout, redirect seguro
    catalog/             início, destaques, busca e filtros
    nft/                 detalhe, galeria, edição, quantidade
    favorites/
    cart/                carrinho, cupom, cotação
    checkout/            pagamento, revisão, idempotência
    orders/              estado do pedido, recibo
    profile/
    wallets/
    realtime/            cliente Socket.IO e aplicação de eventos no cache
  routes/                rotas do TanStack Router (por arquivo); _authenticated/ privadas, _guest/ entrada
  assets/                formas SVG exportadas do Figma
  components/
    ui/                  componentes shadcn adaptados
    layout/              header, footer, menu lateral, barra inferior mobile
    icons/               ícones do Figma (figma-icons.tsx é gerado)
    feedback/            páginas de 404 e de erro de rota
  lib/                   decimal, formatação, utilitários
  mocks/
    db/                  banco em memória, persistência, reset
    fixtures/            NFTs, usuários, cupons, carteiras, pedidos anteriores
    services/            regras de negócio da API simulada
    handlers/            rotas MSW (validação com os contratos → serviço)
    socket/              servidor Socket.IO simulado (Passo 8)
    scenarios/           cenários de rede e de negócio
    panel/               painel de desenvolvimento (cenários e reset)
    http.ts              envelope das rotas: cenários, erros, liquidação de pagamentos
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
| Sessão fora do React (`session-store.ts`) com `useSyncExternalStore` | O interceptor do Axios precisa do token sem depender de componente. O Axios recebe as funções da sessão por `configureApiClient`, sem import circular. |
| Rotas privadas num layout `_authenticated` com `beforeLoad` | Uma proteção só, que revalida a sessão na API e guarda o `redirect`. A expiração chama `router.invalidate()`, que reexecuta a proteção. |
| `queryClient.clear()` no fim de toda sessão | Garante que nenhum dado do usuário anterior sobreviva, sem depender de lembrar quais chaves são privadas. Os dados públicos são buscados de novo. |
| Login e cadastro no desktop como modal sobre a tela inicial | É como o Figma desenha (frames "Sign In/Up Modal" sobre a "Marketplace Page"). As rotas `/login` e `/register` continuam existindo, então acesso direto e refresh funcionam. |
| `apiRequest` valida toda resposta com o schema | Uma resposta fora do contrato vira `INVALID_RESPONSE` em vez de dado errado no cache. |
| Mocks em camadas: handlers → serviços → banco (`src/mocks`) | Os handlers só traduzem HTTP e validam com os contratos. As regras ficam em serviços testados pela API HTTP real (`msw/node`). Separar isso evita regra de negócio duplicada entre REST e Socket.IO. |
| Pagamento decidido por prazo (`settleAt`) e liquidado antes de cada requisição | O resultado do pedido sobrevive a refresh e funciona com relógio controlado nos testes, sem depender de `setTimeout` vivo. |
| Cotação com assinatura do conteúdo | A API percebe qualquer mudança de preço, estoque, cupom ou taxa entre a revisão e a confirmação e devolve `QUOTE_OUTDATED` com o que mudou. |
| Painel de cenários no build de demonstração | O avaliador consegue reproduzir as falhas na URL publicada, sem rodar nada local. Ele fica escondido em navegador automatizado, para não entrar nas regressões visuais. |
| Estado do catálogo na URL, validado pelo `catalogSearchSchema` (Zod) | Refresh, voltar, avançar e links compartilhados reproduzem a mesma lista. O `stripSearchParams` tira os valores padrão, então `/` continua limpo. |
| Query key do catálogo com todos os parâmetros, `signal` e `keepPreviousData` | A troca de filtro cancela a requisição anterior, e uma resposta atrasada nunca ocupa o lugar da consulta atual (testado com o cenário `jitter`). |
| 9 NFTs por página | É a grade 3 × 3 do Figma desktop. No mobile, as mesmas 9 em duas colunas. |
| Slider de preço em `number`, convertido para string com `ethRound` ao aplicar | O Radix Slider só trabalha com número. O valor vai para a URL e para a API como string decimal com 2 casas, e nenhuma conta de dinheiro usa o número. |
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
| Login social e "Esqueceu a senha?" | Fora do escopo. Os botões aparecem como no Figma, mas mostram um aviso de indisponível, sem simular sucesso. |
| Sessão expirada | Em rota privada, vai ao login com o aviso "Sua sessão expirou. Entre de novo para continuar de onde parou." e volta depois. Em rota pública, fica na página e recebe um aviso. |
| Fechar o modal de login | X, Esc ou clique fora voltam ao início (a rota de origem pode ser privada, e não dá para voltar a ela sem sessão). |
| Menu da conta | O Figma só desenha o botão "Entrar". Com sessão, o header mostra avatar (iniciais) e nome, com menu: Meu perfil, Carteiras, Lista de interesse e Sair. |
| Favoritos | Ganham a rota `/favorites`, com o nome "Lista de interesse" do Figma (menu do perfil e footer). O coração da barra inferior leva a ela. |
| Catálogo carregando | Skeleton com shimmer nas proporções do card (9 itens), sem deslocar o layout. A contagem "Carregando NFTs…" fica numa região `aria-live`. |
| Troca de filtro com resultado na tela | A página anterior continua visível com 60% de opacidade, `aria-busy` e "Atualizando…" até a resposta nova (`placeholderData`). |
| Catálogo vazio | "Nenhum NFT encontrado." com "Limpar filtros" quando há filtro. Página além da última mostra "Voltar à primeira página". |
| Falha do catálogo | Sem dados: cartão de erro com a mensagem da API e "Tentar de novo". Com dados antigos na tela: aviso curto acima da grade, sem apagar o que já aparece. |
| Busca no desktop | O Figma desktop não tem campo de busca, só a lupa do header. Ela abre um diálogo com o campo, que leva ao catálogo com `?q=`. |
| Diário da Cunhagem (blog) | Fora do escopo. Os cartões aparecem com o texto do Figma, e o "Ler mais" fica como indisponível. |
| Carrossel do hero | Troca só pelos pontos (sem rotação automática, que atrapalharia a leitura e o leitor de tela). As imagens vêm de `GET /nfts/featured`. |
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
| Rótulos dos campos de login e cadastro só para leitor de tela | O Figma só tem placeholder. Os campos ganharam `<label>` visualmente oculto e mensagens de erro ligadas por `aria-describedby`. |
| Sem footer nas telas de entrada no mobile | O Figma mobile de login e cadastro é tela cheia. |
| Imagens das promoções e do blog | O Figma usa fotos que não estão entre os assets exportáveis. Os cartões usam as 4 imagens de NFT do projeto. |
| Coração e contagem de favoritos fora dos cards | Entram no Passo 6, com os favoritos. |
| Ícone de menu (`MenuIcon` do lucide) no header do tablet | O Figma não tem ícone de menu, porque não desenha o tablet. |

Nenhum asset foi substituído. Ícones, a forma da barra inferior e as imagens vêm do arquivo do Figma (ver [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)).

## Limitações

- Não há blockchain, extensão de carteira nem gateway de pagamento. Conexão, assinatura, hash de transação e link de explorador são simulados.
- A sessão é simulada: o token é opaco, emitido pelo MSW e guardado no navegador. Ver [docs/SECURITY.md](docs/SECURITY.md).
- O transporte Socket.IO é interceptado pelo MSW. As limitações do binding ficam registradas em [docs/REALTIME.md](docs/REALTIME.md).
- Os dados vivem no navegador de quem acessa. Dois navegadores não compartilham estado.
- O pacote `shadcn`, que fornece o `shadcn/tailwind.css`, traz um `minimatch` antigo (via `ts-morph`) com alerta moderado de DoS no `npm audit`. Ele só roda no build e não chega ao navegador. O `npm audit fix --force` trocaria a versão do shadcn por uma incompatível.
- O chunk principal passou de 500 kB (cerca de 225 kB gzip) com Zod, Axios, Radix e os formulários. O Vite avisa no build. A divisão de código entra no Passo 15.
- O `Link` do TanStack Router põe `aria-current="page"` em todo link ativo e, por padrão, compara a busca de forma parcial: o link `/` sem `page` fica ativo em qualquer página do catálogo. Links que mudam só a busca (paginação, abas, atalhos para `#catalogo`) usam `activeOptions={{ exact: true }}`.
- O `Link` do TanStack Router concatena `className` com `activeProps` sem tailwind-merge. Cores que mudam com o estado vão só em `activeClassName`/`inactiveClassName` (ver `NavLink`).
