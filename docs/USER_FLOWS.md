# Fluxos de uso

## Mapa de rotas

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/` | Início (destaques e catálogo) | Público |
| `/nft/$nftId` | Detalhe do NFT | Público |
| `/cart` | Carrinho | Público |
| `/checkout` | Pagamento | Autenticado |
| `/orders/$orderId` | Confirmação e recibo | Autenticado (dono) |
| `/login` | Login | Visitante |
| `/register` | Cadastro | Visitante |
| `/profile` | Perfil | Autenticado |
| `/wallets` | Carteiras | Autenticado |
| `*` | Página não encontrada | Público |

Os nomes finais das rotas podem seguir a nomenclatura do Figma.

## 1. Descoberta

1. O visitante abre o início e vê destaques e catálogo (skeleton durante o carregamento).
2. Busca, filtra, ordena e pagina. A URL muda a cada ação (`/?q=ape&category=art&sort=price_asc&page=2`).
3. Recarregar ou usar voltar e avançar restaura o mesmo estado.
4. Sem resultados: estado vazio com opção de limpar filtros. Falha: mensagem com botão de tentar de novo.
5. Clica num NFT e vai para o detalhe.

## 2. Detalhe e favoritos

1. Abre o detalhe (também por link direto). NFT inexistente mostra página própria de não encontrado.
2. Navega pela galeria, escolhe a edição e a quantidade. Edição esgotada ou indisponível não pode ser escolhida; a quantidade para no limite disponível.
3. Favoritar como visitante leva ao login e volta ao detalhe. Logado, o coração muda na hora; se a API falhar, volta ao estado anterior com aviso.
4. Adiciona ao carrinho e recebe confirmação.

## 3. Carrinho

1. Vê os itens, altera quantidades e remove itens. O resumo vem da cotação da API.
2. Aplica cupom. Código inválido ou expirado mostra erro no campo e não muda o carrinho.
3. Se o preço ou a disponibilidade de um item mudar com a tela aberta, o item é destacado, o aviso é anunciado e o resumo é atualizado.
4. Visitante que faz login mantém os itens, juntados ao carrinho da conta.
5. Segue para o pagamento (visitante passa pelo login antes).

## 4. Pagamento

1. Preenche os dados do colecionador, com validação.
2. Escolhe a carteira cadastrada e a rede. Sem carteira cadastrada, o fluxo oferece cadastrar.
3. Conecta a carteira (simulado): conectada, recusada ou desconectada no meio.
4. Revisa itens, taxas e total.
5. Confirma. Antes de enviar, a cotação é revalidada; se algo mudou, a diferença aparece e o usuário confirma de novo.
6. O botão fica bloqueado enquanto o pedido é enviado. Timeout reenvia com a mesma chave e recupera o mesmo pedido.
7. Pedido pendente: tela de aguardando. Atualiza por `order.updated`, e se a conexão cair ou a página recarregar, o pedido é recuperado sem criar outro.
8. Recusado: mensagem com motivo, carrinho intacto, opção de tentar de novo.
9. Confirmado: segue para o recibo.

## 5. Confirmação e recibo

1. Mostra o resultado, a referência da transação simulada com link de explorador simulado, itens, taxas e total.
2. Os valores vêm do snapshot do pedido.
3. O carrinho mantém o que não foi comprado.

## 6. Cadastro e login

1. Cadastro valida os campos. E-mail já usado mostra erro no campo.
2. Login valida e mostra erro de credenciais sem dizer qual campo está errado.
3. Depois do login, volta à rota de origem (`redirect`).
4. A sessão sobrevive ao refresh.
5. Sessão expirada na navegação leva ao login e depois de volta. No checkout, os dados preenchidos são preservados.
6. Logout limpa os dados privados. Outro usuário que entrar em seguida não vê nada do anterior.

## 7. Perfil e carteiras

1. Edita nome e outros dados do layout, com validação e erros da API.
2. Troca o avatar com preview, validando tipo e tamanho.
3. Altera a senha informando a atual.
4. Cadastra e edita as carteiras principal e secundária.
5. Tudo persiste depois do refresh.

## Ações fora do escopo

Links de páginas editoriais, suporte, atividade, ofertas e downloads ficam desabilitados com explicação ou indicados como indisponíveis. Nenhum deles mostra mensagem de sucesso.
