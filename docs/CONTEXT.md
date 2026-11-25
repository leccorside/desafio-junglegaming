# Contexto do projeto

## O que é

Um marketplace de NFTs em que o colecionador descobre peças, escolhe edição e quantidade, monta um carrinho, paga com uma carteira cadastrada e acompanha o pedido até o recibo. O projeto responde ao desafio frontend descrito em [README-DESAFIO.md](../README-DESAFIO.md), com layout definido no [Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1).

## O que está sendo avaliado

Fidelidade visual, qualidade das interações, integração com APIs, estado assíncrono, tempo real, acessibilidade e performance. A pontuação de cada critério está na seção 11 do [README-DESAFIO.md](../README-DESAFIO.md).

## Objetivos

1. Entregar todos os fluxos do enunciado funcionando de verdade contra uma API simulada, sem atalho na interface.
2. Reproduzir o Figma em desktop e mobile, inclusive nos estados que ele não desenha.
3. Tratar falhas reais de rede e de negócio: lentidão, timeout, resposta fora de ordem, sessão expirada, preço alterado, estoque esgotado, pagamento recusado.
4. Manter tempo real coerente com a API REST, sem duplicar efeitos nem vazar dados entre usuários.
5. Provar tudo isso com testes Playwright e auditorias Lighthouse.
6. Publicar a aplicação com mocks e tempo real funcionando.

## Escopo

### Dentro

| Tela | Funcionalidades |
| --- | --- |
| Início | Destaques, catálogo, busca, filtros, ordenação, paginação e navegação para o NFT |
| Detalhes do NFT | Galeria, informações, edição, quantidade, favoritos e compra |
| Carrinho | Quantidades, remoção, cupom e resumo de valores |
| Pagamento | Dados do colecionador, carteira, rede, revisão e envio |
| Confirmação | Resultado, transação, itens, taxas e total |
| Login | Autenticação, validação e retorno ao fluxo anterior |
| Cadastro | Criação de conta, validação e conflito |
| Perfil | Dados, avatar e senha |
| Carteiras | Carteiras principal e secundária |

Todas as telas em desktop e mobile. Perfil, carteiras e confirmação funcionam em mobile mesmo sem frame no Figma.

### Fora

- Integração real com blockchain, extensões de carteira e gateways de pagamento.
- Páginas editoriais, suporte, atividade, ofertas e downloads. Os links dessas áreas precisam ter comportamento coerente e não podem parecer que funcionam.
- Backend real. Toda a API e os eventos vivem no MSW.

## Visão geral da solução

SPA em React e TypeScript com TanStack Router, TanStack Query e Axios. O MSW intercepta REST e Socket.IO e guarda o estado no navegador. Detalhes em [ARCHITECTURE.md](../ARCHITECTURE.md).

## Onde está cada coisa

- Requisitos: [REQUIREMENTS.md](REQUIREMENTS.md)
- Regras de negócio: [BUSINESS_RULES.md](BUSINESS_RULES.md)
- Andamento: [CHANGELOG.md](../CHANGELOG.md)
