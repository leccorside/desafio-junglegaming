# Regras de negócio

Regras aplicadas pela API simulada e respeitadas pela interface. A fonte da verdade é sempre a API: a interface antecipa validações para dar feedback rápido, mas nunca decide sozinha preço, estoque ou estado de pedido.

## Valores

- Valores em ETH trafegam como string decimal (exemplo: `"0.125"`) e são calculados com big.js pelos helpers de `src/lib/eth.ts` (`ethAdd`, `ethSub`, `ethMul`, `ethPercent`, `ethCompare`).
- A precisão de cálculo é de 18 casas (1 wei), com arredondamento meio para cima. Subtração com resultado negativo é tratada como erro de regra.
- A exibição (`formatEth`) usa de 2 a 4 casas, como no Figma ("1.19 ETH", "0.016 ETH", "26.846 ETH"), sem alterar o valor guardado. Valor positivo que arredondaria para zero aparece como "< 0.0001 ETH".
- Quantidades são inteiras e maiores que zero.
- A cotação da API é a referência para fechar o pedido. Valores calculados na interface servem só para exibição provisória.

## Catálogo

- Cada NFT tem uma ou mais edições ("1/1", "1/10", "1/50" ou "Aberta"), cada uma com preço e estoque próprios. A edição aberta não tem tiragem (`supply: null`).
- Uma edição pode estar disponível, esgotada ou indisponível para venda.
- O preço do card (`priceFrom`) é o menor preço entre as edições disponíveis.
- Cada NFT pertence a uma categoria e a uma rede (Ethereum, Polygon ou Solana), usadas nos filtros do catálogo.
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
- Redes do Figma: Ethereum, Polygon e Solana.
- O endereço é validado conforme a rede: `0x` seguido de 40 caracteres hexadecimais em Ethereum e Polygon, base58 com 32 a 44 caracteres em Solana.
- Tipos de carteira: MetaMask, WalletConnect e Coinbase Wallet.
- Cada carteira tem apelido e pode ter um nome ENS, digitado sem o ".eth".
- A conexão da carteira no checkout é simulada e pode terminar em conectada, recusada pelo usuário ou desconectada no meio do fluxo.

## Pedidos

- O pedido é criado com `Idempotency-Key`. A mesma chave com o mesmo conteúdo devolve o mesmo pedido; a mesma chave com conteúdo diferente devolve `409 IDEMPOTENCY_CONFLICT`.
- Estados: `pending`, `confirmed` e `rejected`. `confirmed` e `rejected` são terminais.
- O pedido guarda um snapshot de itens, preços, cupom, taxas e total no momento da criação. O recibo usa só esse snapshot.
- A disponibilidade é reservada quando o pedido é criado e liberada se ele for recusado.
- Pedido confirmado remove do carrinho apenas os itens e quantidades comprados. Pedido recusado ou com falha não mexe no carrinho.
- Referência de transação e link de explorador são simulados.

## Conta

- E-mail e nome de usuário são únicos. Conflito devolve `409 EMAIL_TAKEN` ou `409 USERNAME_TAKEN`, apontando o campo.
- O cadastro pede nome de usuário, e-mail, senha e confirmação, como no Figma. O nome de exibição começa igual ao nome de usuário e pode ser alterado no perfil.
- Nome de usuário: 3 a 30 caracteres, com letras, números, ponto, hífen e sublinhado.
- Senha com 8 a 72 caracteres, uma letra maiúscula, uma minúscula, um número e um símbolo.
- Troca de senha exige a senha atual, e a nova precisa ser diferente dela.
- O e-mail não é editável no perfil.
- Login com credenciais erradas devolve `401 INVALID_CREDENTIALS`, sem dizer qual campo está errado.
- Avatar: PNG, JPEG ou WebP, até 2 MB.
- Senhas ficam guardadas como hash no banco dos mocks.
