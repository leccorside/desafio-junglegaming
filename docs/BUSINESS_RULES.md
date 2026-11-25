# Regras de negócio

Regras aplicadas pela API simulada e respeitadas pela interface. A fonte da verdade é sempre a API: a interface antecipa validações para dar feedback rápido, mas nunca decide sozinha preço, estoque ou estado de pedido.

## Valores

- Valores em ETH trafegam como string decimal (exemplo: `"0.125"`) e são calculados com biblioteca decimal.
- A precisão de cálculo é de 18 casas. A exibição usa até 4 casas, sem arredondar o valor guardado.
- Quantidades são inteiras e maiores que zero.
- A cotação da API é a referência para fechar o pedido. Valores calculados na interface servem só para exibição provisória.

## Catálogo

- Cada NFT tem uma ou mais edições. A disponibilidade é controlada por edição.
- Uma edição pode estar disponível, esgotada ou indisponível para venda.
- Preço e disponibilidade têm `version`, incrementada a cada mudança.

## Carrinho

- Um item é a combinação de NFT e edição. Adicionar a mesma combinação soma à quantidade existente.
- A quantidade de um item não passa da disponibilidade da edição. A API responde `409 AVAILABILITY_CONFLICT` com a quantidade máxima permitida.
- O visitante tem carrinho identificado pelo cabeçalho `X-Cart-Id`, gerado no navegador.
- No login, o carrinho do visitante é juntado ao do usuário. Itens iguais somam quantidade, limitada à disponibilidade; o que não couber é informado ao usuário.
- Quando `nft.updated` muda o preço ou a disponibilidade de um item no carrinho, a interface avisa e pede nova cotação. Se a edição esgotar, o item fica marcado e não entra no pedido até ser removido ou ajustado.

## Cupons

- Um carrinho aceita um cupom por vez.
- Tipos: percentual sobre o subtotal ou valor fixo em ETH, nunca deixando o total negativo.
- Um cupom pode ter validade, valor mínimo de subtotal e limite de uso.
- Erros: `COUPON_INVALID` (código não existe) e `COUPON_EXPIRED` (fora da validade). Cupom recusado não altera o carrinho.
- Cupons das fixtures: ver [MOCKS.md](MOCKS.md).

## Cotação

- A cotação calcula subtotal, desconto, taxa de rede e total a partir do carrinho, do cupom e da rede escolhida.
- Cada cotação tem `id`, `version` e validade (`expiresAt`).
- O pedido só é criado com uma cotação válida e atual. Se preço, disponibilidade, cupom ou taxa mudarem, a API responde `409 QUOTE_OUTDATED` com a cotação nova, e a interface pede nova confirmação ao usuário.

## Carteiras

- O usuário pode ter uma carteira principal e uma secundária.
- O endereço segue o formato EVM (`0x` seguido de 40 caracteres hexadecimais).
- Redes aceitas nas fixtures: Ethereum, Polygon e Arbitrum (nomes finais conforme o Figma).
- A conexão da carteira no checkout é simulada e pode terminar em conectada, recusada pelo usuário ou desconectada no meio do fluxo.

## Pedidos

- O pedido é criado com `Idempotency-Key`. A mesma chave com o mesmo conteúdo devolve o mesmo pedido; a mesma chave com conteúdo diferente devolve `409 IDEMPOTENCY_CONFLICT`.
- Estados: `pending`, `confirmed` e `rejected`. `confirmed` e `rejected` são terminais.
- O pedido guarda um snapshot de itens, preços, cupom, taxas e total no momento da criação. O recibo usa só esse snapshot.
- A disponibilidade é reservada quando o pedido é criado e liberada se ele for recusado.
- Pedido confirmado remove do carrinho apenas os itens e quantidades comprados. Pedido recusado ou com falha não mexe no carrinho.
- Referência de transação e link de explorador são simulados.

## Conta

- E-mail é único. Cadastro com e-mail existente devolve `409 EMAIL_TAKEN`.
- Senha com no mínimo 8 caracteres, uma letra maiúscula, uma minúscula, um número e um símbolo.
- Troca de senha exige a senha atual.
- Avatar: PNG, JPEG ou WebP, até 2 MB.
- Senhas ficam guardadas como hash no banco dos mocks.
