# Changelog

Mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/). Cada etapa da implementação gera uma entrada.

## [Não publicado]

### Adicionado

- Performance e Lighthouse (Passo 15):
  - `lighthouse/run.mjs` (`npm run lighthouse`) audita início e detalhe, mobile e desktop, três vezes cada, no build com mocks; relatórios HTML/JSON da medição mediana e `summary.json` em `lighthouse/reports/`. Substitui o `lhci autorun` (`@lhci/cli` saiu; `lighthouse` e `chrome-launcher` entraram como dependências de desenvolvimento);
  - `build/preload-hints.ts`, plugin do Vite que injeta `preload` das fontes e, no modo mocks, `modulepreload` do chunk do MSW;
  - descrição da página (`<meta name="description">`) por rota, com o nome do NFT no detalhe;
  - `public/robots.txt`;
  - `seo-performance.spec.ts` confere o `robots.txt`, as dicas de carregamento, o download único das fontes e a descrição por rota.
  - Resultado: Accessibility, Best Practices e SEO em 100 nos quatro casos; Performance 98/99 no desktop e 78/70 no mobile, abaixo da meta por causa do MSW no caminho crítico (docs/PERFORMANCE.md).
- Fechamento da suíte Playwright (Passo 14):
  - `loading-states.spec.ts` completa o item 12 (skeleton, falha e recuperação no detalhe, carrinho, pagamento, perfil, carteiras, lista de interesse e pedido);
  - `visual.spec.ts` faz a regressão visual de início, detalhe, carrinho e pagamento em desktop e mobile, com baselines versionadas por sistema operacional;
  - `infra.spec.ts` prova que o REST passa pelo service worker do MSW e o tempo real pelo `socket.io-client`;
  - helpers de espera por condição em `tests/fixtures/wait.ts`.

- Links e ações fora do escopo (Passo 13): Criadores, Aprenda, áreas do rodapé, menu "Meu perfil" e "Ler mais" do blog viraram botões desabilitados que, ao serem acionados (clique, toque ou teclado), explicam com um aviso informativo ("Criadores: indisponível nesta demonstração."). Redes sociais do rodapé deixaram de abrir a página inicial genérica de cada rede, e o contato de exemplo deixou de ser `mailto:`/`tel:`.
- Testes E2E `out-of-scope.spec.ts`: cada área avisa sem sucesso e sem navegar, varredura de todos os itens desabilitados das telas e todos os links internos abrindo páginas que existem.

- Acessibilidade (Passo 12): título da aba por tela ("Emerald Ape #042 | KURIO") e foco no título ao trocar de página, sem mexer no foco do primeiro carregamento.
- Auditoria com `@axe-core/playwright` em todas as telas e diálogos, em desktop e mobile, e testes E2E de teclado (compra inteira só pelo teclado), foco em diálogos, validação de formulários e largura (390, 768 e 1440 px e zoom de 200%) em `a11y.spec.ts` (item 11 do enunciado).

- Recibo do pedido confirmado (`/orders/$orderId`) no layout do Figma: ícone de agradecimento, faixa com ID da transação, data, total e carteira, itens com ID do token e edição, desconto (se houve cupom), taxa de rede e total, nota da transação simulada e "Ver no Etherscan" (Polygonscan ou Solscan, conforme a rede). Tudo vem do snapshot do pedido; layout próprio no mobile.
- Pendente e recusado não mostram recibo nem transação; pedido de outra conta aparece como "Pedido não encontrado.".
- Ícone "thank-you" exportado do Figma pela geometria (`scripts/export-figma-assets.mjs`).
- Testes: 3 unitários do formato do recibo e 6 cenários E2E de compra completa e recibo em desktop e mobile (item 6 do enunciado).
- Pagamento: "Ainda enviando…" na revisão quando o pedido fica 5 s sem resposta, antes da nova tentativa automática dos 15 s.
- Pagamento (`/checkout`) do Figma: dados do colecionador, "Seus NFTs" com a cotação na rede da carteira, "Carteira e rede" com as carteiras cadastradas e conexão simulada (conectada, recusada, desconectada), e revisão "Revise sua compra" antes de pagar, com a cotação revalidada e as mudanças listadas para nova confirmação.
- Envio do pedido sem duplicar: `Idempotency-Key` por tentativa guardada no `sessionStorage`, botão travado, reenvio automático com a mesma chave em timeout e "Verificar compra" depois de um refresh no meio do envio.
- Tela do pedido (`/orders/$orderId`): pendente, confirmado (transação simulada) e recusado (motivo, carrinho intacto, "Tentar de novo"), atualizada pelo `order.updated` e por consulta a cada 5 s; estados terminais não voltam a pendente. Toast do resultado em qualquer tela.
- Rascunho do pagamento preservado quando a sessão expira no meio (volta do login com os dados).
- Testes: 6 unitários das regras do pedido e 11 cenários E2E de pagamento em desktop e mobile (itens 7, 9 e 10 do enunciado).
- Perfil do colecionador (`/profile`) do Figma: nome de exibição, nome de usuário, e-mail só para leitura, nome ENS, avatar com prévia e conferência de tipo e tamanho, e troca de senha, num único "Salvar" que grava em sequência o que mudou e põe cada erro no campo certo. Nome e avatar mudam no header na hora.
- Carteiras (`/wallets`) do Figma: carteira principal sempre aberta (cria ou edita) e secundária com "Adicionar"/"Editar", "Igual à carteira principal", resumo e "Cancelar". Endereço conferido pela rede escolhida.
- Menu "Meu perfil" do Figma no desktop (com as áreas fora do escopo como indisponíveis e "Sair") e, no mobile, voltar, título e abas das seções em uma coluna.
- Testes: 6 unitários das regras dos formulários e 8 cenários E2E de perfil e carteiras em desktop e mobile (item 8 do enunciado).
- Aviso de queda do tempo real ("Atualizações em tempo real pausadas. Reconectando… Os preços podem ter mudado.") por cima do topo da página, sem empurrar o conteúdo e à vista com a página rolada, com anúncio para leitor de tela quando a conexão volta.
- Na reconexão, o aviso do carrinho mostra o que mudou durante a queda (preço, esgotado, estoque menor).
- Reset dos dados de demonstração sem recarregar: aviso "Os dados de demonstração foram restaurados." e a tela busca tudo de novo (o carrinho do visitante volta vazio).
- Painel de cenários: campo "Novo preço (ETH)" com "Alterar preço" na seção "Estoque".
- Sincronização a cada conexão (`realtime.sync`): o servidor manda as versões atuais e o cliente busca de novo só o que está diferente no cache. Cobre página carregando, troca de sessão, reconexão e reset dos mocks.
- Rotas de teste `/__mocks/realtime/auth-delay` (handshake lento) e `/__mocks/realtime/log` (envios recentes).
- Tempo real com Socket.IO: servidor simulado com `@mswjs/socket.io-binding` que emite `nft.updated` quando um NFT muda no banco dos mocks e `order.updated` só para o dono do pedido. O cliente (`socket.io-client`) conecta por sessão (visitante ou conta), fecha no logout e na troca de conta antes de reiniciar o cache, e ignora eventos duplicados, antigos e de outro usuário.
- Preço e estoque mudam na hora no catálogo, no detalhe, nos destaques e na lista de interesse, sem nova requisição. Com o NFT no carrinho, um aviso conta o que mudou e o carrinho e o resumo são buscados de novo.
- Reconexão automática que busca pela API o que mudou com a conexão fora.
- Rotas de teste `/__mocks/realtime/{replay,stale,disconnect,peers}` para evento duplicado, evento antigo, queda de conexão e conexões abertas.
- Testes: 4 unitários das regras de eventos e 6 cenários E2E de tempo real em desktop e mobile (parte dos itens 9 e 10 do enunciado).
- Painel de cenários: seção "Estoque" para escolher um NFT e uma edição e marcar como esgotada, na hora e sem recarregar a página.
- Carrinho do Figma (desktop e mobile): itens com quantidade limitada pelo estoque, remoção com "Desfazer", cupom com erro no campo (inválido, expirado, valor mínimo) e remoção, resumo da cotação da API (subtotal, desconto, taxa de rede estimada e total) com skeleton e indicador de atualização, aviso de preço alterado, item esgotado ou acima do estoque bloqueando a finalização, "Conectar e finalizar", "Continuar explorando", estados vazio e de erro e "Colecionadores também viram".
- Carrinho do visitante persistido (refresh) e juntado ao da conta no login, com aviso do que não coube no estoque; o `X-Cart-Id` é trocado depois do merge.
- Contador do carrinho no header e na barra inferior, com o total de unidades no nome do link.
- No mobile, o resumo do carrinho fica preso na base no lugar da barra de navegação, e os avisos dessa tela aparecem no topo.
- 20 cenários E2E do carrinho (item 5 do enunciado) e o helper `trackApi` para esperar a API ficar ociosa nos testes.
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

- CLS de 0,256 no detalhe do NFT (desktop): as fontes só eram descobertas depois do CSS e a troca de fonte deslocava as abas. Agora têm `preload` no `index.html`.
- `/robots.txt` devolvia o `index.html` (SEO 92 no Lighthouse). Agora existe um `robots.txt` que libera o catálogo e bloqueia as telas da conta.

- Os pedidos de exemplo (`ord-0001` e `ord-0002`) tinham um hash de transação que não era hexadecimal (`0xORD0…AAAA`), e o link do explorador apontava para um hash inválido. Agora usam o mesmo gerador das compras feitas na demo (`src/mocks/transaction.ts`); o `schemaVersion` do banco simulado subiu para 3, então quem já tinha o banco salvo volta às fixtures.

- Perfil, carteiras, carrinho, pagamento e pedido não avisavam o leitor de tela enquanto carregavam (skeleton escondido, sem `aria-busy` nem texto). Agora usam `LoadingRegion`, com `aria-busy` na área e "Carregando…" só para leitor de tela; no detalhe e na lista de interesse o aviso saiu de dentro da área ocupada.
- O contador do botão do painel de cenários só mudava ao recarregar; agora acompanha o cenário trocado pela rota de teste.

- Lista de interesse sem `aria-busy` enquanto carregava (as outras telas tinham).
- Teste de compra intermitente: com a máquina carregada, o pagamento (1 a 1,5 s) era decidido antes de a tela do pedido abrir, e o teste não via "Aguardando". Os testes do estado pendente passaram a 3 s.

- "Esqueceu a senha?" sem "(indisponível nesta demonstração)" no nome acessível, ao contrário dos outros itens fora do escopo. Os avisos dele, do login social e da newsletter também deixaram de se empilhar em cliques repetidos.

- Menu lateral do mobile abria com o foco no "Sair" (um Enter a mais saía da conta); agora abre no "Início".

- Senha e nome de usuário mostravam uma regra por vez a cada tentativa. Agora o erro lista de uma vez tudo o que falta ("A senha precisa de: uma letra maiúscula e um símbolo.", "Use pelo menos 3 caracteres e só letras, números, ponto, hífen e sublinhado ("!" não vale).") no cadastro, na troca de senha e na API simulada.

- Cadastro e login pelo teclado (demonstração no desktop):
  - depois de "Sair", o foco caía no início da página e eram 65 Shift+Tab até o "Entrar" (agora o foco vai ao "Entrar" do header; no mobile, ao título da tela);
  - os itens do menu da conta quase não mostravam o foco (agora têm fundo de destaque e anel).

- Carteiras pelo teclado (demonstração no mobile):
  - o foco caía no topo depois de salvar a principal (o formulário era remontado e o botão ficava `disabled`);
  - depois de salvar a secundária, o foco se perdia e a tela ficava no rodapé (agora vai ao "Editar carteira secundária", também ao cancelar);
  - o aviso "Carteira principal salva." cobria o erro de um campo da secundária (os avisos de sucesso saem quando um formulário mostra erros).

- Cupom pelo teclado (demonstração no desktop):
  - o campo do cupom não mostrava foco;
  - ao aplicar, o foco caía no topo da página (agora vai para "Remover cupom", e ao remover volta ao campo);
  - no carrinho, o "·" da edição começava a segunda linha (agora token e edição ficam em linhas próprias).
- O teste de anel de foco passou a cobrir carrinho, pagamento, perfil e carteiras e achou mais dois casos sem anel: "Observação do colecionador" e os seletores de rede e tipo das carteiras.

- Compra pelo teclado (demonstração no mobile):
  - o foco caía no topo depois de "Adicionar ao carrinho" (o botão agora fica com `aria-disabled` durante o envio);
  - o "Ver carrinho" do toast não mostrava foco;
  - o carrinho aberto pelo toast ficava com o foco no rodapé (o título agora segura o foco);
  - a aba continuava "Aguardando a confirmação do pagamento" no recibo;
  - a edição saía cortada ("Edição a…") no pagamento e na revisão.

- Acessibilidade apontada pelo axe e pelos testes de teclado:
  - listas de valores (`dl`) com `div` aninhado, no carrinho, no pagamento, na revisão e no recibo;
  - nome do link "NFT em destaque" e do menu da conta diferente do texto visível;
  - pontos do destaque e da galeria menores que 24 px;
  - links "Crie uma conta" e "Entre" distinguidos só pela cor;
  - "Aplicar" do cupom no mobile com 2,2:1 de contraste;
  - painéis das abas do detalhe e busca do catálogo sem anel de foco;
  - revisão da compra que não devolvia o foco ao "Confirmar compra";
  - recibo que deixava o foco cair no topo da página ao sair de "aguardando".
- Detalhe do NFT no tablet (768 px): os botões "COMPRAR" e "Favoritar" passavam da tela; agora a página empilha galeria e informações até 1023 px.

- Recibo com cupom: faltava o subtotal (a conta não fechava à vista) e "Desconto (BEMVINDO10)" quebrava em duas linhas. Agora o subtotal aparece quando há desconto e o rótulo fica numa linha só.
- Hash da transação simulada: dependia só do número do pedido, e compras diferentes depois de um reset (as duas como ord-0003) saíam com o mesmo ID. Agora a semente inclui itens, quantidades, preços e total.

- Recibo: a linha "ID do token · Edição aberta" quebrava no meio e deixava "aberta" ou o "·" sozinhos; agora o token e a edição ficam em linhas próprias. Abaixo do total entrou "Valores do momento da compra".

- Painel de cenários com a revisão da compra (ou outro diálogo) aberta: o botão ficava sob o véu do modal e não abria. Agora abre por cima, o "Alterar preço" funciona e fechar o painel não fecha a revisão.
- Pedido: a linha da carteira dizia "Pago com" também no pendente e no recusado; agora é "Carteira usada:" nesses dois e "Pago com" só no confirmado.
- Pedido confirmado pela consulta à API (evento perdido numa queda): o contador do carrinho ficava com os itens comprados; agora carrinho e cotação são buscados de novo.
- Aviso de queda em uma linha no mobile ("Reconectando… Os preços podem ter mudado."), sem cobrir o título da página.
- Pagamento: a revisão no mobile ficava mais larga que a tela e cortava preços, totais e botões.
- Pagamento: a mudança de preço em tempo real não vira mais toast; aparece acima dos totais, ou só na revisão, quando ela está aberta.
- Pagamento mobile: quantidade e preço de cada item passaram para a linha de baixo do nome.
- Perfil: o aviso de arquivo recusado no avatar continuava na tela depois de a imagem ser salva; agora some ao salvar, e a recusa diz qual arquivo não foi usado e que a imagem escolhida antes (ou o avatar atual) continua.
- Formulários: o campo com erro que recebe o foco vai para o meio da tela; no mobile, o toast de sucesso de outra parte do "Salvar" cobria o campo.
- Depois do reset dos mocks sem recarregar, a aba deixava de receber eventos (`eventId` e versões repetidos).
- O socket simulado aceitava token vencido e continuava entregando eventos de pedido a ele.
- O reset não limpava o servidor simulado: o reenvio de teste devolvia um evento de antes do reset.
- Um evento atrasado gerava aviso de preço falso no carrinho e buscava o carrinho à toa.
- A lista de interesse não era reconciliada depois de uma queda de conexão.
- Pagamento vencido só era decidido na próxima requisição REST; agora o servidor decide sozinho e o `order.updated` sai na hora.
- Mudança feita antes de a conexão abrir (troca de sessão, handshake lento) se perdia sem aviso.
- Evento emitido antes de a conexão se autenticar podia não chegar ao dono.
- Edição indisponível era anunciada como "esgotou".
- Evento marcado como aplicado antes de aplicar, e a falha de um listener de pedido impedia os seguintes.
- O aviso podia repetir a mesma frase quando o carrinho do visitante e o da conta estavam em cache.
- O resumo do carrinho podia ficar com a cotação antiga quando a mudança chegava durante a primeira busca da cotação.
- No carrinho, o aviso de mudança fica acima da lista, em vez de um toast por cima do nome do item no mobile.
- Item esgotado não mostra mais total na linha (o resumo já o deixava de fora).
- Carrinho (achados do code review do Passo 7):
  - resposta mais antiga de uma mudança não sobrescreve mais a mais nova no cache (`writeCart` compara a `version`);
  - o "Desfazer" da remoção avisa se o item voltou ou se não dá para devolver (antes rodava num componente já desmontado e não mostrava nada), e o toast com ele fica 10 s na tela (o padrão de 4 s era pouco para decidir);
  - o campo de quantidade não envia um valor digitado enquanto a mudança anterior está pendente;
  - as cotações antigas são marcadas como velhas sem nova busca (a da versão nova vem pela chave);
  - o carrinho juntado no login é gravado depois do reinício do cache, sem voltar ao skeleton;
  - "Conectar e finalizar" espera as mudanças pendentes terminarem;
  - no mobile, o carrinho vazio, carregando ou com erro mantém a barra de navegação;
  - o aviso de máximo da quantidade quebra linha na largura dos botões, sem cortar o nome do NFT;
  - os avisos do carrinho no mobile aparecem abaixo do título e do voltar.
- Testes: o helper `trackApi` remove os listeners depois do login e não depende de `new URL`.
- Testes: `loginViaUi` esperava `networkidle`, que num app de página única retorna na hora depois do login. Uma busca autenticada ainda em andamento era pega pelo cenário `session-expired` ativado em seguida, e o teste de expiração durante a navegação falhava de vez em quando sob carga. Agora o helper espera as requisições `/api` terminarem de fato.
- Favorito pendente do visitante (achados do code review):
  - a busca do NFT para rolar até ele continuava por até 6 s depois de a pessoa mudar de tela e podia rolar e tirar o foco na tela nova; agora qualquer navegação cancela, e nada acontece se a pessoa já saiu da tela de destino;
  - a rolagem até o NFT espera o router desenhar a tela e aplicar a própria rolagem (`onRendered`), para não ser desfeita;
  - o pedido só sai do armazenamento depois do sucesso; se os dados não carregam, ele fica guardado, o toast oferece "Tentar de novo" e a tela não rola nem foca;
  - um `createdAt` no futuro fazia o pedido nunca vencer; agora conta como inválido;
  - no detalhe, a volta do login rolava a página (102 px no desktop, 16 px no mobile) mesmo com o coração já na tela; agora só rola quando o NFT está fora da tela.
- Favoritar como visitante: depois do login a pessoa voltava à tela, mas precisava achar o NFT e tocar de novo, e um card abaixo da dobra ficava fora da tela (a volta caía no topo). Agora o pedido fica guardado (sessionStorage da aba, 10 minutos): depois do login o favorito é concluído com o toast "Golden Signal #160 adicionado à lista de interesse." (ou "já está na sua lista de interesse."), a tela rola até o card ou o detalhe do NFT e o foco vai para o coração. Quem desiste do login e sai das telas de entrada perde o pedido, e ele não passa para um login feito depois.
- Barra de compra do detalhe no mobile: no limite da quantidade, o aviso "Máximo disponível: 50 unidades." quebrava em duas linhas e empurrava o preço para duas linhas também; a barra crescia de 162 para 178 px e o toast de confirmação encostava nela (2 px). Agora o preço não quebra e o aviso da barra é curto ("Máximo: 50 disponíveis."), numa linha; a barra fica em 162 px e o toast, 18 px acima dela.
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
