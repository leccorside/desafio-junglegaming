# Requisitos

Requisitos extraídos de [README-DESAFIO.md](../README-DESAFIO.md). Os identificadores servem de referência nos testes e no [CHANGELOG.md](../CHANGELOG.md).

## Requisitos funcionais

### Catálogo e início

| ID | Requisito |
| --- | --- |
| RF-01 | Exibir destaques e catálogo conforme o Figma. |
| RF-02 | Busca, filtros, ordenação e paginação compõem o estado da URL e sobrevivem a refresh e à navegação pelo histórico. |
| RF-03 | Filtros são combináveis, e mudar um filtro reinicia a paginação. |
| RF-04 | As consultas refletem os parâmetros enviados à API e tratam resultado vazio, falha e resposta fora de ordem. |
| RF-05 | Cada item do catálogo navega para o detalhe do NFT. |

### Detalhe do NFT

| ID | Requisito |
| --- | --- |
| RF-06 | Galeria, informações, seleção de edição e quantidade. |
| RF-07 | Funciona por acesso direto e trata NFT inexistente, edição indisponível e limite de quantidade. |
| RF-08 | Favoritos persistem para o usuário autenticado. |
| RF-09 | Adicionar ao carrinho. |

### Carrinho

| ID | Requisito |
| --- | --- |
| RF-10 | Adicionar, alterar e remover itens, respeitando a disponibilidade por NFT e edição. |
| RF-11 | Manter o carrinho depois do refresh e preservar os itens do visitante ao autenticar. |
| RF-12 | Aplicar e remover cupom, tratando código inválido ou expirado. |
| RF-13 | Exibir subtotal, desconto, taxa de rede e total coerentes com a resposta da API. |
| RF-14 | Refletir mudanças de preço e disponibilidade recebidas com o carrinho aberto. |

### Pagamento e confirmação

| ID | Requisito |
| --- | --- |
| RF-15 | Validar os campos do layout e permitir revisão antes do envio. |
| RF-16 | Usar as carteiras cadastradas, com seleção de rede e simulação de conexão, recusa e desconexão. |
| RF-17 | Revalidar preço, disponibilidade, cupom e taxas antes de confirmar. Mudanças exigem nova confirmação. |
| RF-18 | Impedir pedido duplicado em clique repetido ou reenvio depois de timeout. |
| RF-19 | Representar pedido pendente, confirmado e recusado, com recuperação depois de refresh ou reconexão. |
| RF-20 | Exibir a confirmação somente para pedido confirmado pela simulação. |
| RF-21 | Preservar os itens em caso de falha. Depois da confirmação, remover do carrinho só os itens e quantidades comprados. |
| RF-22 | O recibo reproduz o snapshot do pedido, sem ser afetado por mudanças posteriores no catálogo. |

### Conta e sessão

| ID | Requisito |
| --- | --- |
| RF-23 | Cadastro com validação e tratamento de conflito. |
| RF-24 | Login com validação e retorno ao fluxo anterior. |
| RF-25 | Logout. |
| RF-26 | Sessão recuperável depois do refresh. |
| RF-27 | Expiração tratada durante a navegação e durante o checkout, preservando o contexto. |
| RF-28 | Logout e troca de usuário limpam dados privados em cache e subscriptions da sessão anterior. |
| RF-29 | Checkout, perfil, carteiras, favoritos e pedidos exigem autenticação. |
| RF-30 | Perfil: edição dos dados, avatar e alteração de senha. |
| RF-31 | Carteiras: cadastro e edição da principal e da secundária. |
| RF-32 | Formulários validam no cliente e mostram erros da API. Alterações confirmadas persistem depois do refresh. |

### Tempo real

| ID | Requisito |
| --- | --- |
| RF-33 | `nft.updated` atualiza preço e disponibilidade no catálogo, no detalhe e no carrinho. |
| RF-34 | `order.updated` atualiza o estado do pedido e apresenta confirmação ou recusa. |
| RF-35 | Eventos duplicados ou antigos não regridem estado nem reaplicam efeitos. |
| RF-36 | Depois de reconectar, os recursos ativos são reconciliados com a API REST. |
| RF-37 | Eventos de uma sessão anterior não atualizam dados de outro usuário. |
| RF-38 | Queda de conexão com pedido pendente: depois de reconectar ou recarregar, o usuário recupera o pedido sem criar outra compra. |

### Fora do escopo

| ID | Requisito |
| --- | --- |
| RF-39 | Links e ações fora do escopo têm comportamento coerente e não aparentam sucesso. |
| RF-40 | Rotas inexistentes têm tratamento próprio, e toda tela prevista funciona por acesso direto. |

## Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Stack obrigatória usada de forma efetiva (ver [README.md](../README.md)). |
| RNF-02 | Contratos tipados entre transporte, estado e interface. |
| RNF-03 | Estados de carregamento, vazio, erro, sucesso e atualização em segundo plano. |
| RNF-04 | Invalidação coerente depois de mutations e eventos. |
| RNF-05 | Cancelamento ou descarte de respostas obsoletas. |
| RNF-06 | Isolamento dos dados por usuário e por parâmetros da consulta. |
| RNF-07 | Recuperação de falhas sem duplicar operações. |
| RNF-08 | Pelo menos uma atualização otimista com rollback. |
| RNF-09 | Política de cache, retries e sincronização documentada. |
| RNF-10 | Valores em ETH como string decimal, com precisão no cálculo e na exibição. Quantidades inteiras. |
| RNF-11 | Mocks na camada de rede, sem respostas fictícias em componentes, hooks ou cliente Axios. |
| RNF-12 | Cenários de rede e de negócio configuráveis e reproduzíveis, com reset completo. |
| RNF-13 | Fidelidade ao Figma em 390, 768 e 1440 px. |
| RNF-14 | Skeletons com shimmer, sem deslocamento de layout, respeitando movimento reduzido. |
| RNF-15 | Acessibilidade conforme [ACCESSIBILITY.md](ACCESSIBILITY.md). |
| RNF-16 | Testes E2E conforme [TESTING.md](TESTING.md). |
| RNF-17 | Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. |
| RNF-18 | Deploy público com mocks e tempo real, acesso direto e refresh em todas as rotas. |
| RNF-19 | Execução a partir de checkout limpo, sem serviços privados. |
| RNF-20 | Senhas nunca guardadas em claro. |
