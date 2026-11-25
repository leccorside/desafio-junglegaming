# Changelog

Mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/). Cada etapa da implementação gera uma entrada.

## [Não publicado]

### Adicionado

- Detalhe do NFT do Figma (desktop e mobile): galeria com miniaturas navegáveis pelo teclado, nota, edições em grupo de rádio (esgotada e indisponível riscadas), quantidade limitada pela disponibilidade, "COMPRAR", compartilhamento, abas "Detalhes do NFT" e "Avaliações de colecionadores" e "Mais desta coleção". Acesso direto e refresh pelo loader da rota, 404 próprio para NFT inexistente e edição escolhida na URL (`?edition=`).
- Barra de compra fixa no mobile, no lugar da barra de navegação, com "Comprar NFT" e o botão do carrinho; toasts e footer sobem acima dela.
- Adicionar ao carrinho (visitante ou conta) pelo detalhe, com confirmação e atalho "Ver carrinho".
- Favoritos: coração no detalhe e nos cards do mobile, visitante vai ao login e volta, atualização otimista com rollback e aviso quando a API falha, e a tela "Lista de interesse" (`/favorites`).
- Filtro `collection` em `GET /nfts`.
- Testes: 5 unitários das regras de edição e quantidade, 2 de API (filtro de coleção) e 12 cenários E2E de detalhe e favoritos (itens 2 e 4 do enunciado).
- Tela inicial do Figma: hero com os destaques da API e pontos do carrossel (banner compacto no mobile), "NFT em destaque" na sidebar, promoções que abrem o catálogo filtrado e o "Diário da Cunhagem" com o "Ler mais" indisponível.
- Catálogo com estado na URL validado por schema: busca, abas (Todos, Novos lançamentos, Em alta), coleções e redes combináveis, faixa de preço, ordenação e paginação de 9 em 9. Refresh, voltar e avançar restauram a lista, e valores inválidos na URL voltam ao padrão.
- Busca com debounce no mobile e diálogo de busca pela lupa do header no desktop. Filtros em menu lateral no mobile, com ordenação e foco preso.
- Estados do catálogo: skeleton do card, atualização em segundo plano com a página anterior visível, vazio com "Limpar filtros", erro com "Tentar de novo". Requisições antigas são canceladas e respostas fora de ordem não trocam o resultado.
- Links de Coleções do footer abrem o catálogo filtrado.
- 15 testes unitários do estado do catálogo e 13 cenários E2E do catálogo (itens 1 e 12 do enunciado), em desktop e mobile.
- Sessão completa: cadastro, login e logout integrados à API simulada, sessão recuperada depois do refresh, revalidação a cada rota privada, expiração tratada na navegação (login com aviso e volta ao destino) e limpeza de todo o cache no fim da sessão e na troca de usuário.
- Telas de entrada como no Figma: modal sobre a tela inicial no desktop (abas Entrar e Criar conta) e tela cheia no mobile, com React Hook Form, validação pelos contratos, erros da API por campo, mostrar e ocultar senha, login social e recuperação de senha como indisponíveis.
- Camada de dados: Axios com token, `X-Cart-Id` do visitante, timeout de 15 s e erros normalizados em `ApiError`; `apiRequest` valida toda resposta com o schema; TanStack Query repete só falhas transitórias, com backoff.
- Árvore de rotas: início, detalhe, carrinho, login, cadastro e as privadas (pagamento, pedido, perfil, carteiras, lista de interesse) num layout protegido, com `redirect` seguro contra open redirect.
- Menu da conta no header e no menu lateral (Meu perfil, Carteiras, Lista de interesse, Sair) e links do layout como `Link` tipado do TanStack Router.
- 23 testes unitários (cliente HTTP, erros, retry, redirect) e 12 cenários E2E de sessão (item 3 do enunciado), além do teste de cor do item de navegação ativo.
- API simulada completa com MSW: sessão e conta, catálogo com filtros e facetas, favoritos, carrinho do visitante e do usuário com merge, cupons, cotação com detecção de mudanças, pedidos com idempotência, reserva de estoque e pagamento simulado, perfil, avatar, senha e carteiras com conexão simulada.
- Banco dos mocks persistido no `localStorage` e fixtures determinísticas: 60 NFTs (os 10 do Figma incluídos), 2 usuários, carteiras, cupons e pedidos anteriores.
- 19 cenários de rede e de negócio, ativados pela URL, pelo painel de desenvolvimento ou por `/__mocks/scenario`, e reset completo.
- Erros `WALLET_REJECTED` e `WALLET_DISCONNECTED` e a rota `POST /me/wallets/:id/connect`.
- 48 testes de integração e de fixtures dos mocks (Vitest + `msw/node`) e testes E2E da API simulada no navegador.
- Contratos tipados em `src/api/contracts` (Zod): sessão e conta, NFT com edições, categorias, rede e raridade, listagem com facetas, favoritos, carrinho, cotação, pedido com snapshot e idempotência, perfil, carteiras e eventos `nft.updated` e `order.updated`. Formato padrão de erro com status por código.
- Helpers de valores em ETH em `src/lib/eth.ts` (big.js, 18 casas) e `formatEth` no padrão do Figma.
- Vitest com 46 testes unitários dos helpers e dos contratos (`npm run test:unit`).
- Identidade visual do Figma: tokens de cor, tipografia (Roboto Mono local), raios, sombras e contêiner de 1200 px em `src/index.css`.
- Componentes shadcn/ui adaptados: button, input, label, select, dialog, sheet, tabs, badge, skeleton com shimmer, sonner, form, pagination, checkbox, radio-group, slider, separator e avatar.
- Layout base: header desktop, header compacto com menu lateral no tablet, barra inferior no mobile, footer, link para pular ao conteúdo, página 404 e página de erro de rota.
- Script `scripts/export-figma-assets.mjs` e os assets exportados: 27 ícones, forma da barra inferior e 4 imagens em WebP.
- Testes E2E de layout: navegação por viewport, itens fora do escopo, footer, newsletter, foco no menu lateral, link para pular, 404 e ausência de rolagem horizontal.
- Setup do projeto: Vite 8, React 19, TypeScript 6 (`strict`), Tailwind CSS 4, shadcn/ui (Radix), TanStack Router com rotas por arquivo, TanStack Query, Axios, Socket.IO client, MSW 2 com `@mswjs/socket.io-binding`, Zod, React Hook Form, ESLint, Prettier, Playwright e Lighthouse CI.
- Modo `mocks` do Vite e inicialização do MSW antes da primeira renderização.
- Testes de fumaça em Chromium, desktop e mobile.
- `vercel.json` com fallback de SPA e cabeçalhos de cache.
- Design system com os valores do Figma.
- Estrutura de documentação: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` e os documentos de `docs/` (contexto, requisitos, regras de negócio, API, mocks, tempo real, estado, segurança, design system, acessibilidade, fluxos, testes, performance e deploy).

### Alterado

- Página do catálogo com 9 NFTs (grade 3 × 3 do Figma), em vez de 12.
- Botão do painel de cenários mais alto no mobile, acima da área dos toasts.

### Corrigido

- Catálogo com o servidor sem responder: eram 47 s de skeleton sem nenhum aviso (3 tentativas de 15 s) até o erro. Depois da primeira tentativa que estoura o tempo, o status passa a dizer "O servidor está demorando para responder. Ainda estamos tentando…", e timeout se repete só uma vez: o erro aparece em cerca de 31 s. Rede e 503 continuam com 2 repetições.
- Painel de cenários no mobile: o botão flutuante ficava sobre o conteúdo e cobria o "Tentar de novo" do catálogo. Agora é uma aba estreita colada à esquerda, na margem vazia da barra inferior (antes do ícone Início), com o contador dentro dela; não cobre nada clicável em nenhuma rolagem. No tablet e no desktop continua no canto inferior esquerdo.
- Painel de cenários: o nome do botão dizia "1 ativos". Agora concorda com o número ("1 ativo", "2 ativos").
- Catálogo vazio: a faixa de preço mostrava "Preço: 0,00 - 0,00 ETH" com os dois pontos do slider sobrepostos e o botão "Aplicar". Sem faixa para escolher (catálogo vazio, um único preço ou API fora do ar), aparece "Faixa de preço indisponível no momento.", sem slider e sem "Aplicar"; "Limpar preço" continua quando há preço na URL.
- Hero: sem destaques na API (catálogo vazio ou falha), a metade direita ficava vazia no desktop e o banner mobile ficava sem imagem. Agora entra uma imagem fixa do projeto, sem link.
- Catálogo: quando a API falhava, o status acima da grade continuava em "Carregando NFTs…" (anunciado pelo leitor de tela), e as contagens dos filtros e o slider de preço ficavam em skeleton para sempre. Agora o status diz "Não foi possível carregar os NFTs.", os filtros aparecem sem contagem e a faixa de preço mostra "Faixa de preço indisponível no momento." até a nova tentativa dar certo.
- Catálogo no mobile: o ponto coral que indica filtro aplicado no botão de filtros não era anunciado. Com busca, aba ou filtro ativo, o botão se chama "Filtros e ordenação (filtros aplicados)". Só a ordenação não muda o nome.
- Catálogo: na página 2, os links "Página anterior" e "Página 1" também eram anunciados como página atual (`aria-current="page"`), junto com a página 2. Os links "EXPLORAR" do hero também recebiam essa marca. Agora só a página e a aba atuais têm a marca.
- Toasts: no mobile, cobriam a barra inferior e o botão "Sair" do menu lateral. Abaixo de 768 px (onde a barra existe) ficam a 142 px da base, mais a área segura do aparelho. A faixa de 600 a 767 px também foi corrigida: nela o Sonner já usava a posição de desktop.
- Sessão: o toast de boas-vindas da conta anterior ("Que bom ver você, Ana Ribeiro.") continuava na página depois do logout e da entrada de outra conta. Agora todos os toasts fecham no fim da sessão.
- Sessão: um 401 atrasado de requisição feita com token antigo derrubava a sessão nova. Agora só o token atual conta.
- Sessão: o fim da sessão e o login usavam `clear()`, que deixava as telas montadas com os dados antigos. Agora o cache é reiniciado (cancela, remove o que não está na tela, refaz as buscas do que está), e respostas de visitante atrasadas não aparecem na conta.
- Sessão: a revalidação cancelada pelo fim da sessão devolvia a sessão já apagada e liberava a rota privada.
- Sessão: passar o mouse num link privado consultava `/auth/session` (preload) e podia expirar a sessão. Agora o preload só confere a sessão salva.
- Sessão: a expiração com destino privado mostrava dois avisos (toast e aviso do login). Agora só o do login.
- Sessão: o aviso de expiração reaparecia muito depois. Ele vale até uma navegação terminar fora das telas de entrada.
- Sessão: o logout com token já vencido virava "sessão expirou".
- Carrinho do visitante: fora de contexto seguro (`http://` num IP da rede) não havia `crypto.randomUUID` e toda requisição de visitante falhava. Novo `randomId()` com alternativa.
- Navegação: "Início" e "Mercado" ficavam ativos juntos em `/#catalogo`.
- Testes: o reset do cliente HTTP não restaurava o `getGuestCartId`, e o comentário do `--only` do script do Figma não citava `logos`.
- Item ativo da navegação ficava branco: o `Link` concatenava `text-foreground` e `text-accent-foreground`. As cores de estado foram para `activeClassName`/`inactiveClassName`.
- `setupMockServer` não desfazia os overrides de `server.use()` entre testes.
- Mocks: `mutate` passou a persistir e avisar os interessados mesmo quando a regra termina em erro. Antes, a cotação nova e o preço alterado do `QUOTE_OUTDATED` se perdiam no refresh.
- Mocks: um cenário corrompido no `localStorage` impedia a aplicação de subir.
- Mocks: o `?scenario=` da URL era reaplicado a cada reload, desfazendo a escolha do painel e redisparando cenários de uso único. Agora ele é aplicado uma vez e removido da URL.
- Mocks: o "Aplicar" do painel apagava as opções do cenário (rotas, latência, semente, prazo).
- Mocks: a latência padrão deslocava a sequência do `jitter`, que deixava de ser reproduzível.
- Mocks: o ajuste de NFT dos testes trocava o status de edições indisponíveis num ajuste só de preço.
- Mocks: a recusa do pagamento reabria edições esgotadas por outro motivo depois da reserva.
- Mocks: o merge do carrinho descartava sem aviso itens fora do catálogo e mudava a versão mesmo sem mudança.
- `.gitattributes` com `eol=lf`: com `core.autocrlf=true` (padrão do Git no Windows), o checkout entregava arquivos com CRLF e o `format:check` falhava.
