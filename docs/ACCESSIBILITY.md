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
| Foco em erro de formulário | O primeiro campo com erro (do cliente ou da API) recebe o foco e é centralizado na tela (`centerFocusedField`, rolagem instantânea), para não ficar atrás dos toasts do mobile. |
| Feedback de mutations e tempo real | Toasts em região `aria-live="polite"`. Erros críticos e recusa de pagamento em `role="alert"`. Mudança de preço ou estoque anunciada: no pagamento, num `role="status"` acima dos totais (com a revisão aberta, pela lista da própria revisão, em `role="alert"`); na página do carrinho, num aviso `role="status"` acima da lista, com "Fechar aviso" (não cobre o item); nas outras telas, por toast. O mesmo vale para o que mudou durante uma queda (anunciado na reconexão) e para "Os dados de demonstração foram restaurados.". Queda do tempo real anunciada em `role="status"` ("Atualizações em tempo real pausadas. Reconectando… Os preços podem ter mudado.", por cima do topo da página, sem deslocar o conteúdo) e a volta também ("Atualizações em tempo real retomadas."). |
| Sem overflow e sem perda com zoom | Layout fluido sem rolagem horizontal em 390 px e com zoom de 200%. Texto em `rem`. |

## Padrões por componente

- Galeria: miniaturas como botões com `aria-label` ("Imagem 2 de 3") e `aria-current` na imagem ativa. Só a ativa entra no Tab (tabindex móvel); setas, Home e End trocam a imagem e levam o foco junto. No mobile, os pontos são botões com o mesmo rótulo. A imagem principal usa o `alt` da API.
- Edição: `radiogroup` com rótulo "Edição:"; cada opção diz nome, preço e, quando for o caso, "esgotada" ou "indisponível" (`aria-disabled`). As setas andam só entre as disponíveis.
- Seletor de quantidade: botões "Diminuir quantidade" e "Aumentar quantidade", campo numérico com `min` e `max` e aviso em `aria-live` quando chega ao limite ("Máximo disponível: 2 unidades."; na barra de compra do mobile, a versão curta "Máximo: 2 disponíveis.", para caber numa linha).
- Carrinho: cada seletor de quantidade tem o nome do NFT nos rótulos ("Aumentar quantidade de Emerald Ape #042"). Enquanto a API confirma uma mudança, os botões ficam com `aria-disabled` (não `disabled`), para o foco do teclado não sair do botão. A lixeira diz o que remove ("Remover Emerald Ape #042 (edição 1/50) do carrinho"). O resumo tem região de status oculta ("Calculando o resumo…", "Total: …"). O erro do cupom fica no campo (`aria-invalid`, `aria-describedby`, `role="alert"`). O link do carrinho diz a quantidade ("Carrinho, 3 unidades").
- Favoritar: botão toggle (`aria-pressed`) com o nome do NFT no rótulo ("Adicionar Sage Nomad #009 à lista de interesse"); para visitante, "Entre para favoritar …", sem `aria-pressed`. No card, o botão fica fora do link (botão dentro de link não é válido).
- Abas do detalhe ("Detalhes do NFT", "Avaliações de colecionadores"): Radix Tabs, com setas entre as abas.
- Destaque de "Mercado" no header do detalhe é só visual: sem `aria-current`, porque a página atual é o NFT.
- Filtros: grupos com `fieldset` e `legend`, contagem de resultados anunciada depois da busca.
- Paginação: `nav` com `aria-label`, página atual com `aria-current="page"`.
- Formulários: foco vai para o primeiro campo com erro depois do envio.
- Skeletons: `aria-busy="true"` no contêiner e texto oculto de carregamento.
- Mudança de rota (`RouteFocus`, em `components/layout/route-focus.tsx`): ao mudar o caminho, o título da aba vira "<título da tela> | KURIO" (a tela inicial fica com "KURIO | Marketplace de NFTs"; com diálogo aberto, vale o título dele) e o foco vai para o `h1` visível (`tabindex=-1`, sem anel e sem rolar). O `h1` pode chegar depois dos dados: espera até 4 s. O foco não muda no primeiro carregamento (o primeiro Tab continua sendo o "Pular para o conteúdo"), com âncora na URL, com diálogo aberto ou com o foco num campo.
- Pedido: quando pendente vira confirmado, o título é outro elemento (o do recibo); se o foco estava no título que saiu, vai para o novo.
- Revisão da compra: abre pelo código (depois de validar e conectar a carteira), então devolve o foco ao "Confirmar compra" ao fechar (`returnFocusTo`).
- Listas de valores (`dl`): cada par fica num `div` com `dt` e `dd` como filhos diretos; a dica de uma linha ("Taxa estimada", "Valores do momento da compra") é um segundo `dd` do mesmo termo.

## Movimento

- `prefers-reduced-motion: reduce` desliga shimmer e transições não essenciais.

## Verificação

- `@axe-core/playwright` (regras WCAG 2.0, 2.1 e 2.2, A e AA) em `tests/e2e/a11y.spec.ts`, desktop e mobile: telas públicas (início, página 2, detalhe, detalhe com edições indisponíveis, carrinho, login, cadastro, 404, NFT inexistente), da conta (carrinho, pagamento, perfil, carteiras, lista de interesse, recibo, pedido de outra conta), pedido pendente e diálogos abertos (busca, menu lateral, revisão). O teste falha com qualquer violação séria ou crítica. Na publicação do Passo 12, o axe não apontou nenhuma violação, de nenhum nível, nem de boas práticas.
- Contraste sobre gradiente, que o axe não calcula: conferido medindo o fundo real atrás do texto. Só o "Aplicar" do cupom no mobile ficava abaixo (2,2:1) e foi corrigido; o teste confere o texto dos botões com gradiente contra as duas pontas do gradiente.
- Teclado e foco no mesmo arquivo: "Pular para o conteúdo" como primeiro Tab, anel visível em tudo que o Tab alcança, foco e título na troca de página, foco preso e devolvido na busca, no menu lateral e na revisão, e uma compra inteira só pelo teclado (edição pelas setas, quantidade, carrinho, pagamento, revisão e recibo).
- Formulários: o primeiro campo com erro recebe o foco, fica com `aria-invalid` e anuncia a mensagem por `aria-describedby` (login, pagamento e perfil); o erro geral do login sai em `role="alert"`.
- Largura: sem rolagem horizontal em 390, 768 e 1440 px nas telas principais, e com zoom de 200% (janela de 640 px CSS), com as ações ao alcance.
- Revisão manual com leitor de tela (NVDA) nos fluxos de compra e de conta: ainda não feita (precisa de uma pessoa com o leitor; os testes automáticos cobrem nomes, papéis, foco e anúncios).
- Lighthouse Accessibility ([PERFORMANCE.md](PERFORMANCE.md)).

## Ajustes em relação ao Figma

Todo ajuste de contraste, tamanho de alvo de toque ou texto adicionado por acessibilidade é registrado aqui e em [ARCHITECTURE.md](../ARCHITECTURE.md).

| Ajuste | Onde | Motivo |
| --- | --- | --- |
| Texto de erro em `#ff5c66` (`--destructive-foreground`) | Mensagens de erro | `#ed1b2e` do Figma tem 4,39:1, abaixo de AA |
| Borda de campo em `#8a5c40` (`--input`) | `Input` e campos de formulário | `#3f2319` do Figma tem 1,34:1, abaixo dos 3:1 de componente de interface |
| Anel de foco de 2 px `Primary` com afastamento de 2 px | Todos os elementos focáveis (`:focus-visible` global) | O Figma não desenha foco |
| Link "Pular para o conteúdo" | Primeiro item do Tab, leva o foco ao `<main id="conteudo">` | Pular o header em toda página |
| Alvos de toque de 44 × 44 px | Itens da barra inferior mobile | O ícone do Figma tem 20 px |
| Nomes acessíveis em botões só com ícone | Busca, carrinho, menu, itens da barra inferior, redes sociais ("abre em nova aba") | Os ícones não têm texto visível |
| Itens fora do escopo como texto com `aria-disabled` e aviso oculto "(indisponível nesta demonstração)" | Header, menu lateral e footer | Não anunciar como link algo que não funciona |
| `prefers-reduced-motion` desliga animações e transições | Global, incluindo o shimmer do skeleton | Preferência do sistema |
| Rótulo oculto (`sr-only`) em cada campo de login e cadastro | Formulários de entrada | O Figma só tem placeholder, que some ao digitar e não é rótulo |
| Erro de campo ligado por `aria-describedby`, `aria-invalid` e foco no primeiro campo com erro da API | Formulários (shadcn `Form` + `applyApiError`) | Leitor de tela anuncia o erro junto com o campo |
| Erro geral do formulário com `role="alert"` | Login e cadastro (ex.: credenciais erradas) | Anúncio imediato sem mover o foco |
| Foco inicial no primeiro campo do modal de login | Modal desktop (`onOpenAutoFocus`) | O Radix focaria o botão de fechar |
| Botão de mostrar senha com `aria-label` e `aria-pressed` | Campos de senha | O ícone "Hide" não tem texto |
| Aviso de sessão expirada com `role="status"` | Tela de login | Explica por que a pessoa voltou ao login |
| Botões de login social e "Esqueceu a senha?" com `aria-disabled` e aviso oculto | Entrar e criar conta | Fora do escopo: focáveis, mas anunciados como indisponíveis |
| Texto escuro (`Primary foreground`) no "Aplicar" do cupom no mobile | Carrinho, mobile | O texto claro do Figma sobre o gradiente cobre dava 2,2:1 |
| Links dentro de texto sublinhados | "Crie uma conta" e "Entre" (login e cadastro) | Só pela cor, o link tinha 1,12:1 contra o texto em volta (precisa de 3:1 ou outro sinal) |
| Área de toque de 24 × 24 px nos pontos | Pontos do destaque da tela inicial e da galeria do detalhe (mobile) | O ponto do Figma tem 10 px e 7 px; o desenho fica igual, mas o espaço entre os pontos cresce |
| Nome do link e do botão começando pelo texto visível | "NFT em destaque" (link da barra lateral) e menu da conta ("Conta de Ana Ribeiro") | O `aria-label` trocava o texto à vista (WCAG 2.5.3) |
| Anel de foco nos painéis das abas do detalhe e na caixa da busca do catálogo | Detalhe e catálogo | Os painéis entram no Tab e estavam com `outline-none`; o campo de busca não tem borda, então o anel fica na caixa |
| Título da aba por tela e foco no `h1` ao trocar de página | Todas as rotas | O Figma não trata navegação; leitor de tela anuncia a tela nova |
| Detalhe empilhado no tablet | Detalhe do NFT, 768 a 1023 px | Em duas colunas, os botões "COMPRAR" e "Favoritar" passavam da tela |
