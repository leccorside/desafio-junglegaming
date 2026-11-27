# Arquitetura

Visão técnica da solução. Os detalhes de cada área ficam nos documentos de `docs/`, referenciados ao longo do texto.

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
  hooks/                 hooks genéricos (useMediaQuery, useIdle, useDebouncedValue)
  features/
    auth/                sessão (store, ciclo de vida), login, cadastro, logout, redirect seguro
    catalog/             início, destaques, busca e filtros
    nft-detail/          detalhe, galeria, edição, quantidade
    favorites/           lista de interesse e favoritar (inclusive como visitante)
    cart/                carrinho, cupom, cotação, merge no login
    checkout/            pagamento, revisão, idempotência
    orders/              estado do pedido, recibo
    account/             perfil, avatar, senha e carteiras
    realtime/            cliente Socket.IO, porteiro de eventos e reconciliação com o cache
  routes/                rotas do TanStack Router (por arquivo); _authenticated/ privadas, _guest/ entrada
  assets/                formas SVG exportadas do Figma
  components/
    ui/                  componentes shadcn adaptados
    layout/              header, footer, menu lateral, barra inferior mobile
    icons/               ícones do Figma (figma-icons.tsx é gerado)
    feedback/            páginas de 404 e de erro de rota, região de carregamento
  lib/                   ETH (big.js), query client, foco, título da página, imagens, utilitários
  mocks/
    db/                  banco em memória, persistência, reset
    fixtures/            NFTs, usuários, cupons, carteiras, pedidos anteriores
    services/            regras de negócio da API simulada
    handlers/            rotas MSW (validação com os contratos → serviço)
    socket/              servidor Socket.IO simulado
    scenarios/           cenários de rede e de negócio
    panel/               painel de desenvolvimento (cenários, estoque e reset)
    shims/               stub do tough-cookie para o MSW no navegador
    http.ts              envelope das rotas: cenários, erros, liquidação de pagamentos
    browser.ts           setup do worker
    enable.ts            liga o MSW antes da primeira renderização
public/
  images/nfts/           imagens do Figma em WebP (480, 720 e 960 px)
  robots.txt             libera catálogo e detalhe; bloqueia carrinho, pagamento, pedidos e conta
  mockServiceWorker.js   service worker do MSW
scripts/
  export-figma-assets.mjs  exporta ícones, formas e imagens pela API do Figma
tests/
  e2e/                   specs Playwright e baselines da regressão visual (__screenshots__)
  fixtures/              helpers de sessão (auth.ts), API e cenários (mocks.ts) e esperas (wait.ts)
build/
  preload-hints.ts       plugin do Vite: modulepreload do chunk do MSW no modo mocks
lighthouse/
  run.mjs                auditoria (npm run lighthouse e lighthouse:prod)
  reports/               relatórios HTML/JSON e summary.json (local e produção)
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
| Cache reiniciado no fim de toda sessão (`resetCache`) | Cancela as buscas em andamento, remove o que não está na tela, reinicia o que está (busca de novo já com a sessão nova) e limpa as mutations. Nenhum dado do usuário anterior sobrevive, sem depender de lembrar quais chaves são privadas. Só `clear()` deixaria as telas montadas presas aos dados antigos. |
| Login e cadastro no desktop como modal sobre a tela inicial | É como o Figma desenha (frames "Sign In/Up Modal" sobre a "Marketplace Page"). As rotas `/login` e `/register` continuam existindo, então acesso direto e refresh funcionam. |
| `apiRequest` valida toda resposta com o schema | Uma resposta de sucesso fora do contrato vira `INVALID_RESPONSE` em vez de dado errado no cache; um erro 5xx fora do envelope vira `INTERNAL_ERROR` com nova tentativa. |
| Mocks em camadas: handlers → serviços → banco (`src/mocks`) | Os handlers só traduzem HTTP e validam com os contratos. As regras ficam em serviços testados pela API HTTP real (`msw/node`). Separar isso evita regra de negócio duplicada entre REST e Socket.IO. |
| Pagamento decidido por prazo (`settleAt`) e liquidado antes de cada requisição | O resultado do pedido sobrevive a refresh e funciona com relógio controlado nos testes, sem depender de `setTimeout` vivo. |
| Cotação com assinatura do conteúdo | A API percebe qualquer mudança de preço, estoque, cupom ou taxa entre a revisão e a confirmação e devolve `QUOTE_OUTDATED` com o que mudou. |
| Painel de cenários no build de demonstração | O avaliador consegue reproduzir as falhas na URL publicada, sem rodar nada local. Ele fica escondido em navegador automatizado, para não entrar nas regressões visuais. |
| Estado do catálogo na URL, validado pelo `catalogSearchSchema` (Zod) | Refresh, voltar, avançar e links compartilhados reproduzem a mesma lista. O `stripSearchParams` tira os valores padrão, então `/` continua limpo. |
| Query key do catálogo com todos os parâmetros, `signal` e `keepPreviousData` | A troca de filtro cancela a requisição anterior, e uma resposta atrasada nunca ocupa o lugar da consulta atual (testado com o cenário `jitter`). |
| 9 NFTs por página | É a grade 3 × 3 do Figma desktop. No mobile, as mesmas 9 em duas colunas. |
| Slider de preço em `number`, convertido para string com `ethRound` ao aplicar | O Radix Slider só trabalha com número. O valor vai para a URL e para a API como string decimal com 2 casas, e nenhuma conta de dinheiro usa o número. |
| Vitest para regras puras e para a API simulada | Aritmética, contratos, cache e reconciliação de eventos se testam melhor isolados; os handlers e serviços dos mocks são testados por HTTP real via `msw/node`. Os fluxos da interface ficam no Playwright. |
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
| Router carregado antes da montagem (`router.load()`) e árvore montada numa transição | A primeira renderização é fatiada pelo React, sem uma tarefa longa só (Lighthouse mobile; ver [docs/PERFORMANCE.md](docs/PERFORMANCE.md)). |
| Detalhe do NFT com Suspense, sem esperar no loader | A tela entra com o esqueleto e a renderização com os dados também é fatiada; a imagem principal começa a baixar com a resposta da API. |
| Header, barra inferior e destaque renderizados por tamanho de tela (`useMediaQuery`) | A versão escondida por CSS entrava no DOM e, no celular, baixava a imagem de 450 px do destaque do desktop. |
| Menus, busca e painel de cenários sob demanda | Radix Menu, Popper, floating-ui e `Dialog` ficam fora do bundle inicial; o painel carrega com o navegador ocioso. |
| Stub do `tough-cookie` no build do navegador | O MSW 2.15 usa o pacote só no cookie store, e ele traz o `tldts`: 124 kB gzip a menos no caminho crítico. O stub cobre o que o MSW usa e é comparado com o pacote real nos testes unitários. |
| Fontes do Tailwind fixas em `src/` e `index.html` (`source(none)` no `src/index.css`) | A detecção automática lia o projeto inteiro, inclusive a documentação, que cita classes. Como o upload da Vercel e o disco local não têm os mesmos arquivos, o CSS publicado saía diferente do local. Com as fontes fixas, os dois builds geram os mesmos arquivos. |

## Contratos, sessão, carrinho, cache e tempo real

Resumo de cada área; os detalhes ficam nos documentos citados.

### Contratos REST e eventos

- Os contratos são schemas Zod em `src/api/contracts`: o mesmo schema gera o tipo, valida a resposta no cliente (`apiRequest`), valida a requisição no handler do MSW e serve aos formulários. Valores em ETH trafegam como string decimal.
- Erros seguem um envelope único `{ error: { code, message, fields?, retryable } }`, com códigos estáveis (`SESSION_EXPIRED`, `QUOTE_OUTDATED`, `IDEMPOTENCY_CONFLICT`, `WALLET_REJECTED`...). Rotas, corpos e erros em [docs/API.md](docs/API.md).
- Eventos Socket.IO com envelope comum (`eventId`, `type`, `resource`, `version`, `occurredAt`, `data`): `nft.updated` (preço, estoque e status das edições), `order.updated` (resultado do pagamento, só para o dono) e `realtime.sync` (versões do servidor na conexão, na reconexão e no reset). Detalhes em [docs/REALTIME.md](docs/REALTIME.md).

### Sessão

- Token opaco emitido pela API simulada, válido por 30 minutos, uma sessão ativa por usuário (um novo login invalida o anterior). Fica no `localStorage` (`kurio:session`) e num store fora do React (`session-store.ts`), lido pelo interceptor do Axios.
- A raiz valida a sessão salva uma vez por carregamento (`beforeLoad` → `ensureSession`), antes da montagem. Rotas privadas ficam no layout `_authenticated`, que leva ao login com `redirect`.
- `401 UNAUTHENTICATED` ou `SESSION_EXPIRED` em qualquer requisição, ou a validade local vencida, encerram a sessão: aviso, cache reiniciado, socket reconectado como visitante e, em rota privada, login com volta à tela de origem.
- Logout e expiração passam por `endSession`, que reinicia o cache e limpa as mutations. Detalhes em [docs/SECURITY.md](docs/SECURITY.md).

### Estado do carrinho

- O carrinho mora na API simulada, por dono: `user:<id>` com sessão, ou `guest:<X-Cart-Id>` para visitante (UUID gerado no navegador e guardado no `localStorage`). Toda resposta traz a `version` do carrinho.
- No login, `POST /cart/merge` junta o carrinho do visitante ao da conta, respeitando o estoque, e avisa o que não coube. Depois do merge, o visitante recebe um carrinho novo; se o merge falha, o carrinho do visitante fica guardado para o próximo login.
- A linha guarda a versão do NFT e o preço da edição; o carrinho é recalculado contra o catálogo atual (preço alterado, estoque insuficiente, esgotado).
- A cotação (`POST /quotes`) fica em cache por dono, rede e versão do carrinho, vale 10 minutos e carrega a assinatura do conteúdo. Na confirmação, qualquer diferença volta como `QUOTE_OUTDATED` com a cotação nova e a lista do que mudou. Regras em [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).

### Cache, retries e sincronização

- TanStack Query com `staleTime` de 30 s, `gcTime` de 5 min e sem nova busca ao voltar à janela. As query keys incluem o usuário (ou o dono do carrinho) e todos os parâmetros. O catálogo mantém a página anterior na tela durante a troca de filtro e cancela a busca antiga (`signal`).
- Retries só para erros com `retryable` (rede, 503, timeout): até 2 novas tentativas, ou 1 para timeout (cada tentativa custa os 15 s do Axios), com backoff de 0,5 s a 4 s. 4xx e sessão inválida nunca repetem. Mutations não repetem sozinhas; a criação de pedido reenvia com a mesma `Idempotency-Key` depois de timeout.
- Mutations otimistas (favoritos) guardam o estado anterior e voltam atrás em caso de erro. Detalhes em [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md).

### Reconciliação entre REST e Socket.IO

- **Porteiro de eventos** (`event-gate.ts`): descarta evento repetido (`eventId` já visto), antigo (`version` menor ou igual à última do recurso) e de outro usuário. O `realtime.sync` vira a referência de versões de cada conexão.
- **Aplicação no cache** (`apply-nft-updated.ts`): o `nft.updated` corrige detalhe, páginas do catálogo, destaques e favoritos, cada cópia só se for mais antiga que o evento. Se um carrinho em cache tem o NFT em versão anterior, carrinho e cotação são buscados de novo e a tela avisa o que mudou. Consulta ainda na primeira busca (sem dado) é buscada de novo quando essa busca termina, porque a resposta pode ter sido calculada antes da mudança.
- **Reconexão** (`reconcile.ts`): o `realtime.sync` traz as versões do servidor; o cliente busca pela API só as queries cujas cópias têm versão diferente, compara o carrinho antes e depois (para avisar o que mudou com a conexão fora) e sempre busca de novo os pedidos, porque um pendente pode ter sido decidido nesse intervalo. Durante a queda, uma faixa avisa que os preços podem ter mudado.
- **Pedido pendente:** atualiza pelo `order.updated` e, como reserva, por consulta a cada 5 s. Refresh ou queda não criam outro pedido (`Idempotency-Key` no `sessionStorage`).

Os detalhes estão em [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md), [docs/REALTIME.md](docs/REALTIME.md), [docs/SECURITY.md](docs/SECURITY.md) e [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).

## Decisões de UX

Comportamentos definidos por nós em estados que o Figma não desenhou.

| Situação | Decisão |
| --- | --- |
| Navegação no tablet (768 a 1023 px) | O Figma só tem desktop e mobile. O header fica com logo, busca e carrinho, e a navegação vai para um menu lateral (Sheet). |
| Navegação no mobile | O Figma não tem header no mobile, só a barra inferior. O botão central da barra (ícone de leitura, sem função no escopo) abre o menu lateral, para a navegação principal continuar acessível. |
| Itens fora do escopo (Criadores, Aprenda, Atividade, Central de ajuda, Ofertas, Suporte, "Ler mais"...) | Botão com `aria-disabled`, 60% de opacidade, `title` e "(indisponível nesta demonstração)" no nome acessível (`UnavailableAction`). Não são links, para não parecer que funcionam. Ao acionar (clique, toque ou teclado), um aviso `info` explica ("Criadores: indisponível nesta demonstração."); antes eram texto, e a explicação só aparecia no passar do mouse. Mesmo padrão de "Esqueceu a senha?", do login social e da newsletter. |
| Redes sociais do rodapé | A Kurio da demonstração não tem perfis. Os ícones do Figma ficam e avisam "Perfil da Kurio no Instagram: indisponível nesta demonstração."; levar à página inicial genérica de cada rede pareceria funcionar. |
| Contato do rodapé | `contato@email.com` e `+55 11 4002 8922` são dados de exemplo do Figma: texto, sem `mailto:`/`tel:`, que abririam o e-mail ou o discador para um contato que não existe. |
| Links externos que ficam | Compartilhar o NFT no LinkedIn e no X (compartilham o endereço real) e "Ver no Etherscan" do recibo (transação simulada, dita na nota do recibo). |
| Newsletter do footer | O envio mostra um toast informativo dizendo que a newsletter não está disponível. Não simula cadastro. |
| Login social e "Esqueceu a senha?" | Fora do escopo. Os botões aparecem como no Figma, mas mostram um aviso de indisponível, sem simular sucesso. |
| Sessão expirada | Em rota privada, vai ao login com o aviso "Sua sessão expirou. Entre de novo para continuar de onde parou." e volta depois. Em rota pública, fica na página e recebe um aviso. |
| Fechar o modal de login | X, Esc ou clique fora voltam ao início (a rota de origem pode ser privada, e não dá para voltar a ela sem sessão). |
| Menu da conta | O Figma só desenha o botão "Entrar". Com sessão, o header mostra avatar (iniciais) e nome, com menu: Meu perfil, Carteiras, Lista de interesse e Sair. |
| Perfil e carteiras no mobile | Sem frame no Figma. Voltar e título no topo (como o carrinho), as seções disponíveis da conta em abas roláveis (Dados do perfil, Carteiras, Lista de interesse) e os campos em uma coluna, com os botões na largura toda. "Sair" e as áreas fora do escopo ficam no menu lateral, para a tela começar no formulário. |
| Um "Salvar" no perfil | Como no Figma. Grava em sequência o que mudou (dados, avatar, senha), cada parte com seu aviso; se uma falha, o erro vai para o campo dela e as já salvas não voltam atrás. O avatar escolhido só é enviado no "Salvar" (prévia antes). |
| Selects nativos nas carteiras | Rede e tipo usam `<select>` com a seta do Figma: teclado, leitor de tela e celular funcionam sem código extra. |
| Revisão antes de pagar | O Figma só tem "Confirmar compra". O botão valida, conecta a carteira, revalida a cotação e abre um diálogo "Revise sua compra"; o pedido só sai pelo "Confirmar e pagar" dele. Mudança de valores (revalidação, evento em tempo real ou `QUOTE_OUTDATED`) aparece em lista no diálogo e troca o botão por "Confirmar com os novos valores". |
| Pedido pendente | Tela própria (`/orders/$orderId`) com "Aguardando a confirmação do pagamento", que muda sozinha pelo `order.updated` (com consulta a cada 5 s como reserva). Pode-se sair dela: um toast avisa o resultado em qualquer tela, e o pagamento mostra "Acompanhar pedido" enquanto houver pendente. |
| Envio sem duplicar | Uma `Idempotency-Key` por tentativa, gravada no `sessionStorage` antes do envio. Clique repetido devolve a mesma promessa e, depois do sucesso, o mesmo pedido. Timeout reenvia sozinho com a mesma chave; refresh no meio oferece "Verificar compra". |
| Favoritos | Ganham a rota `/favorites`, com o nome "Lista de interesse" do Figma (menu do perfil e footer). O coração da barra inferior leva a ela. |
| Catálogo carregando | Skeleton com shimmer nas proporções do card (9 itens), sem deslocar o layout. A contagem "Carregando NFTs…" fica numa região `aria-live`. |
| Troca de filtro com resultado na tela | A página anterior continua visível com 60% de opacidade, `aria-busy` e "Atualizando…" até a resposta nova (`placeholderData`). |
| Catálogo vazio | "Nenhum NFT encontrado." com "Limpar filtros" quando há filtro. Página além da última mostra "Voltar à primeira página". |
| Falha do catálogo | Sem dados: cartão de erro com a mensagem da API e "Tentar de novo"; o status diz "Não foi possível carregar os NFTs.", os filtros ficam sem contagem (sem skeleton) e a faixa de preço aparece como indisponível. A nova tentativa volta ao skeleton. Com dados antigos na tela: aviso curto acima da grade, sem apagar o que já aparece. |
| Busca no desktop | O Figma desktop não tem campo de busca, só a lupa do header. Ela abre um diálogo com o campo, que leva ao catálogo com `?q=`. |
| Diário da Cunhagem (blog) | Fora do escopo. Os cartões aparecem com o texto do Figma, e o "Ler mais" fica como indisponível. |
| Carrossel do hero | Troca só pelos pontos (sem rotação automática, que atrapalharia a leitura e o leitor de tela). As imagens vêm de `GET /nfts/featured`. Sem destaques (lista vazia ou falha), entra a imagem fixa `nft-01` do Figma, sem link, para o hero não ficar com metade vazia. |
| NFT inexistente | Quando a API devolve `NOT_FOUND`, o `errorComponent` da rota mostra a página "NFT não encontrado" (código 404) com "Explorar o catálogo" e "Voltar ao início", com a barra de navegação do celular. Outras falhas usam a página de erro com "Tentar de novo". |
| Edição padrão e edição indisponível | Abre na edição mais barata disponível (o preço do card) e fica nela com a página aberta: se o preço muda e outra edição passa a ser a mais barata, a seleção não troca. Esgotada e indisponível aparecem riscadas e não podem ser escolhidas. Link com uma delas (`?edition=`), ou a edição da tela esgotando com a página aberta, cai na padrão com aviso; sem nenhuma à venda, aviso e compra desabilitada. |
| Quantidade | Limite = disponibilidade da edição, a mesma regra da API (sem teto próprio da interface). Trocar de edição volta para 1. |
| "COMPRAR" e o botão do carrinho | O Figma não desenha o resultado. "COMPRAR" adiciona e leva ao carrinho; o botão do carrinho do mobile só adiciona e mostra "Ver carrinho" no toast. |
| Barra de compra no mobile | No detalhe, a barra do Figma ("Buy Bar") substitui a barra de navegação; toasts e o fim do footer sobem acima dela (`useBottomBar`). O botão de voltar usa o histórico do app ou vai ao início. |
| Avaliações | A API só traz média e total. A aba "Avaliações de colecionadores" mostra a nota e avisa que os comentários não estão disponíveis na demonstração. |
| "Mais desta coleção" | Até 5 NFTs da mesma coleção pelo novo filtro `collection` da API; some se a coleção não tiver outros ou a busca falhar (conteúdo complementar). |
| Favoritar como visitante | O pedido é guardado e concluído depois do login (`PendingFavoriteRunner`), com toast, rolagem até o NFT (só se ele estiver fora da tela, e depois do `onRendered` do router) e foco no coração. Mudar de tela cancela a rolagem. O pedido só é apagado depois do sucesso: se os dados falham, fica guardado, o toast oferece "Tentar de novo" e nada rola; se a gravação falha, o coração volta com o aviso de sempre e fica em foco. Desistir do login descarta o pedido. A busca dos dados repete quando é só cancelada pelo reinício do cache do login (`resetCache`). |
| Lista de interesse (`/favorites`) | O Figma não desenha a tela: título, contagem e a grade do catálogo, com vazio e erro. |
| Taxa de rede no carrinho | A rede é escolhida no pagamento. O resumo do carrinho usa a cotação da Ethereum, com "Taxa estimada" (como o Figma, 0.016 ETH). |
| Resumo do carrinho no mobile | Preso na base (`sticky`) enquanto a lista rola, no lugar da barra de navegação (Figma "Payment Summary"), só quando o carrinho tem itens; vazio, carregando ou com erro, a barra de navegação continua. Os toasts dessa tela vão para o topo, abaixo do título e do voltar, para não cobrir "Conectar e finalizar". |
| Item esgotado ou acima do estoque | Fica marcado na linha ("Esgotado: remova…", "Só N disponíveis: ajuste…") e bloqueia "Conectar e finalizar" com aviso. Preço alterado só é avisado ("O preço mudou de X para Y"). |
| Remover item | Sem confirmação: o toast (10 s na tela) oferece "Desfazer", que adiciona a mesma edição e quantidade de novo e avisa se deu certo ou se a edição não tem mais estoque. |
| Merge no login | Aviso do que não coube no estoque (10 s na tela). Falha do merge não bloqueia o login: o carrinho do visitante fica guardado para a próxima entrada. |
| Contador do carrinho | O Figma mostra "6". O badge mostra o total real de unidades, no header e na barra inferior; só aparece com itens, e o número vai no nome do link ("Carrinho, 3 unidades"). |
| Servidor demorando (timeout) | Depois da primeira tentativa que estoura os 15 s, o status (`aria-live`) troca "Carregando NFTs…" por "O servidor está demorando para responder. Ainda estamos tentando…", em âmbar. Com a página anterior na tela, o mesmo texto substitui o "Atualizando…". Timeout se repete só uma vez, então o erro aparece em cerca de 31 s. |
| Faixa de preço sem faixa | Catálogo vazio, um único preço ou API fora do ar: "Faixa de preço indisponível no momento.", sem slider e sem "Aplicar" (um slider de 0,00 a 0,00 não deixa escolher nada). |
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
| Carrinho: rótulos "Desconto do lançamento" e "(-) 00.00" | Sem cupom, o rótulo do Figma fica; o valor segue o formato do resto ("(-) 0.00 ETH"). Com cupom, vira "Desconto (CÓDIGO)" com a descrição da API embaixo. |
| Carrinho: coluna "Edições" | O Figma usa "Edições" no cabeçalho da coluna de quantidade. O cabeçalho ficou, e cada linha mostra também a edição ao lado do ID do token; o seletor se chama "Quantidade de Emerald Ape #042" (nome do NFT) para leitores de tela. |
| Imagens das promoções e do blog | O Figma usa fotos que não estão entre os assets exportáveis. Os cartões usam as 4 imagens de NFT do projeto. |
| Coração nos cards só no mobile | É onde o Figma desenha ("Column L/R"); no desktop o favorito fica no detalhe. |
| Rótulos "Contrato" e "Direitos autorais" do detalhe | No Figma, cada rótulo está com o texto do outro. Aqui cada um fica com o seu valor. |
| Ícone de círculo sobre a imagem do detalhe (desktop) | Sem função identificável no Figma; não foi implementado. O favorito usa o botão "Favoritar". |
| Coração preenchido | O Figma só tem o contorno. O estado "favoritado" usa o contorno externo do mesmo ícone, preenchido em `Text/Coral`. |
| Ícone de menu (`MenuIcon` do lucide) no header do tablet | O Figma não tem ícone de menu, porque não desenha o tablet. |
| Perfil sem "Apelido da carteira" | O frame do perfil repete um campo da carteira. O apelido é da carteira (contrato `Wallet.label`) e fica na tela de carteiras; o lugar dele no perfil passou para o avatar. |
| Carteiras sem "Nome de exibição", "Nome do perfil", "Código de indicação", "E-mail" e "ENS ou carteira secundária" | O frame parece reaproveitar campos de outro formulário: nenhum deles existe numa carteira. Ficaram os do contrato: apelido, rede, endereço, tipo e nome ENS. |
| Asterisco só nos campos obrigatórios | O Figma põe asterisco em todos, inclusive no nome ENS, que é opcional. |
| Caixa ".eth" sem seta | No Figma ela parece um seletor, mas só existe ".eth": vira um sufixo fixo, para não parecer que abre opções. |
| Campos de senha em branco no perfil | O Figma desenha os três campos sem dizer quando são obrigatórios. Em branco, a senha não muda; preenchido um, os três são pedidos. |
| Pagamento sem "Nome de usuário", "Rede", "Endereço da carteira", "Tipo de carteira", "Nome do perfil", "Código de indicação", "ENS ou carteira secundária" e "Nome ENS" | O contrato do pedido só leva nome de exibição, e-mail e observação do colecionador, mais a carteira e a rede. Os dados da carteira vêm da carteira cadastrada, escolhida em "Carteira e rede"; editar fica em `/wallets` ("Trocar carteira", "Usar outra carteira?"). |
| "Carteira e rede" lista as carteiras cadastradas | No Figma, as opções são marcas (MetaMask, Coinbase Wallet). Aqui cada opção é uma carteira da conta (apelido, tipo, rede, endereço), e a rede vem dela. |
| Itens do pagamento no mobile | No mobile, quantidade e preço ficam na linha de baixo do nome, para o nome caber inteiro; no desktop, tudo numa linha, como no Figma. |
| Pagamento mobile com os dados do colecionador | O frame mobile só tem carteiras e total. Os campos do colecionador (obrigatórios no contrato) entram entre as carteiras e o resumo. |
| Cupom no pagamento | "Tem um código promocional? Aplique aqui" leva ao carrinho, onde o cupom é aplicado. |
| Recibo como página, não como modal | No Figma, "Order Confirmation Modal" abre sobre o pagamento. Aqui é o conteúdo de `/orders/$orderId` com o mesmo cartão (578 px, faixa de transação, tabela, totais, nota e "Ver no Etherscan"): tem endereço próprio, sobrevive a refresh e não deixa atrás um pagamento cujo carrinho já foi esvaziado. O X do Figma volta ao início; abaixo do cartão ficam "Ver carrinho" e "Continuar explorando". |
| Título "Pagamento confirmado" e número do pedido no recibo | O Figma só tem "Seus NFTs agora estão na sua carteira". O título diz o resultado (exigido pelo enunciado) e é o mesmo nome das outras situações do pedido ("Aguardando…", "Pagamento recusado"). |
| Recibo: edição abaixo do ID do token, "Valores do momento da compra", desconto e explorador por rede | Duas edições do mesmo NFT seriam linhas iguais sem a edição; numa linha só, a coluna estreita partia o texto. O aviso abaixo do total explica por que o recibo não acompanha o preço atual do catálogo. Com cupom, entram o subtotal (base do desconto) e "Desconto (CÓDIGO)" numa linha só, com a coluna dos totais em 360 px em vez de 321; no mobile, se faltar espaço, o valor desce. Sem cupom, só taxa e total, como no Figma. O botão segue a rede do pedido (Etherscan, Polygonscan ou Solscan), e a nota diz que a transação é simulada. |
| Recibo no mobile | Não há frame. O cartão ocupa a largura, a faixa da transação vira 2 × 2 e quantidade e subtotal descem para a linha de baixo do nome, como no pagamento. A coluna "Edições" do cabeçalho some. |
| Detalhe do NFT empilhado no tablet (768 a 1023 px) | Não há frame de tablet. Em duas colunas, a galeria (cerca de 550 px) deixava uns 140 px para as informações, e "COMPRAR" e "Favoritar" passavam da tela. As duas colunas começam em 1024 px. |
| "Aplicar" do cupom com texto escuro no mobile | O texto claro do Figma sobre o gradiente cobre tinha 2,2:1 (AA pede 4,5:1). Igual ao desktop. |
| Pontos do destaque e da galeria mais espaçados | Cada ponto é um botão de 24 × 24 px (WCAG 2.5.8) com o desenho do Figma (10 e 7 px) no centro. |
| Links "Crie uma conta" e "Entre" sublinhados | Dentro do texto, a cor do link tinha 1,12:1 contra o texto em volta. |
| Título da aba por tela e foco no título ao trocar de página | O Figma não define; ver [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md). |
| Carteira secundária com resumo, "Editar" e "Cancelar" | O Figma só desenha o estado vazio ("Você ainda não adicionou..."). "Igual à carteira principal" vira uma caixa de seleção que abre o formulário já preenchido. |

Nenhum asset foi substituído. Ícones, a forma da barra inferior e as imagens vêm do arquivo do Figma (ver [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)).

## Limitações

- Não há blockchain, extensão de carteira nem gateway de pagamento. Conexão, assinatura, hash de transação e link de explorador são simulados.
- A sessão é simulada: o token é opaco, emitido pelo MSW e guardado no navegador. Ver [docs/SECURITY.md](docs/SECURITY.md).
- O transporte Socket.IO é interceptado pelo MSW, só por WebSocket (sem long-polling), sem salas e com o `socket.io-client` importado sob demanda depois de o MSW iniciar. As limitações do binding e como foram contornadas estão em [docs/REALTIME.md](docs/REALTIME.md).
- Os eventos saem do navegador de quem acessa: só a própria aba recebe a mudança feita nela (painel ou rota `/__mocks`). Duas abas não trocam eventos.
- Os dados vivem no navegador de quem acessa. Dois navegadores não compartilham estado.
- O pacote `shadcn`, que fornece o `shadcn/tailwind.css`, traz um `minimatch` antigo (via `ts-morph`) com alerta moderado de DoS no `npm audit`. Ele só roda no build e não chega ao navegador. O `npm audit fix --force` trocaria a versão do shadcn por uma incompatível.
- Nada renderiza antes de o MSW estar ativo (nenhuma requisição pode sair dos mocks), e o chunk dele (157 kB, 46 kB gzip) entra no carregamento inicial. Na produção (HTTP/2), o Lighthouse mobile fica em 92 e 95; no `vite preview` local (HTTP/1.1), em 85 a 87. Medições e motivo da diferença em [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
- O stub do `tough-cookie` cobre só o que o cookie store do MSW 2.15 usa. Atualizar o MSW pede conferir isso; os testes do stub e o `msw-cookie-shim.spec.ts` pegam a quebra.
- As baselines da regressão visual versionadas são do Windows. Em outro sistema, a primeira execução grava as do sistema (ver o README).
- O `Link` do TanStack Router põe `aria-current="page"` em todo link ativo e, por padrão, compara a busca de forma parcial: o link `/` sem `page` fica ativo em qualquer página do catálogo. Links que mudam só a busca (paginação, abas, atalhos para `#catalogo`) usam `activeOptions={{ exact: true }}`.
- O `Link` do TanStack Router concatena `className` com `activeProps` sem tailwind-merge. Cores que mudam com o estado vão só em `activeClassName`/`inactiveClassName` (ver `NavLink`).
