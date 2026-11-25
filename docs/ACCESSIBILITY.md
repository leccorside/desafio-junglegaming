# Acessibilidade

Meta: WCAG 2.2 nível AA nas telas da entrega e Lighthouse Accessibility ≥ 95.

## Requisitos do enunciado

| Requisito | Como atender |
| --- | --- |
| Navegação por teclado e foco visível | Ordem de tabulação lógica, nada operável só com mouse, anel de foco visível em todos os elementos interativos (`:focus-visible`), link "pular para o conteúdo". |
| Foco em diálogos e drawers | Componentes Radix (base do shadcn) prendem o foco, fecham com Esc e devolvem o foco ao gatilho. |
| Semântica, labels e erros associados | Landmarks (`header`, `nav`, `main`, `footer`), um `h1` por página, hierarquia de títulos sem saltos, `label` em todo campo, erro ligado por `aria-describedby` e `aria-invalid`. |
| Alternativas textuais | `alt` descritivo nas imagens de NFT e de produto, `alt=""` nas decorativas, `aria-label` em botões só com ícone. |
| Contraste e estados além da cor | Contraste AA. Status (esgotado, erro, preço alterado, pedido recusado) sempre com texto ou ícone, não só cor. |
| Feedback de mutations e tempo real | Toasts em região `aria-live="polite"`. Erros críticos e recusa de pagamento em `role="alert"`. Mudança de preço no carrinho anunciada. |
| Sem overflow e sem perda com zoom | Layout fluido sem rolagem horizontal em 390 px e com zoom de 200%. Texto em `rem`. |

## Padrões por componente

- Galeria: miniaturas como botões com `aria-label` e `aria-current` na imagem ativa, setas do teclado para navegar.
- Seletor de quantidade: botões com rótulo, campo numérico com `min` e `max`, aviso quando chega ao limite.
- Filtros: grupos com `fieldset` e `legend`, contagem de resultados anunciada depois da busca.
- Paginação: `nav` com `aria-label`, página atual com `aria-current="page"`.
- Formulários: foco vai para o primeiro campo com erro depois do envio.
- Skeletons: `aria-busy="true"` no contêiner e texto oculto de carregamento.
- Mudança de rota: foco vai para o `h1` da nova página e o título da aba é atualizado.

## Movimento

- `prefers-reduced-motion: reduce` desliga shimmer e transições não essenciais.

## Verificação

- `@axe-core/playwright` nas telas principais, sem violações sérias ou críticas.
- Testes E2E de teclado e foco (item 11 de [TESTING.md](TESTING.md)).
- Revisão manual com leitor de tela (NVDA) nos fluxos de compra e de conta.
- Lighthouse Accessibility ([PERFORMANCE.md](PERFORMANCE.md)).

## Ajustes em relação ao Figma

A preencher. Todo ajuste de contraste, tamanho de alvo de toque ou texto adicionado por acessibilidade é registrado aqui e em [ARCHITECTURE.md](../ARCHITECTURE.md).
