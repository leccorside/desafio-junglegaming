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
| `/favorites` | Lista de interesse (favoritos) | Autenticado |
| `*` | Página não encontrada | Público |

Rotas criadas no Passo 4, com arquivos em `src/routes`. As privadas ficam no layout `_authenticated` e as de entrada no `_guest`. Telas ainda sem conteúdo mostram "Esta tela está em construção" até o passo delas.

"Lista de interesse" é o nome que o Figma dá aos favoritos, no menu do perfil e no footer. O coração da barra inferior mobile leva a essa rota.

Os parâmetros de `/login` e `/register` são `redirect` (destino depois de entrar, só caminho interno) e `reason=expired` (mostra o aviso de sessão expirada).

## 1. Descoberta

1. O visitante abre o início e vê destaques e catálogo (skeleton durante o carregamento).
2. Busca, filtra, ordena e pagina. A URL muda a cada ação (`/?q=ape&category=["music"]&sort=price_asc&page=2`).
3. Recarregar ou usar voltar e avançar restaura o mesmo estado.
4. Sem resultados: estado vazio com opção de limpar filtros. Falha: mensagem com botão de tentar de novo.
5. Clica num NFT e vai para o detalhe.

Detalhes implementados no Passo 5:

| Parâmetro | Valores | Padrão (fora da URL) |
| --- | --- | --- |
| `q` | texto, até 80 caracteres | vazio |
| `feed` | `all`, `new`, `trending` (abas "Todos os NFTs", "Novos lançamentos", "Em alta") | `all` |
| `category` | lista JSON das 9 coleções | todas |
| `network` | lista JSON de `ethereum`, `polygon`, `solana` | todas |
| `minPrice`, `maxPrice` | ETH em string decimal | sem limite |
| `sort` | `recent`, `price_asc`, `price_desc`, `popular` | `recent` |
| `page` | inteiro a partir de 1 (9 NFTs por página) | 1 |

- Valor inválido na URL volta ao padrão sem quebrar a tela. Faixa de preço invertida é corrigida.
- Busca: no mobile, campo "Explorar coleções" com debounce de 400 ms (substitui a entrada no histórico em vez de criar uma por letra). No desktop, a lupa do header abre um diálogo de busca que leva ao catálogo com `?q=`.
- Qualquer mudança de busca, aba, filtro ou ordenação volta para a página 1. A paginação são links (abrir em nova aba funciona).
- Filtros: sidebar no desktop (Coleções, Faixa de preço com "Aplicar", Rede). No mobile, o botão ao lado da busca abre um menu lateral com ordenação e filtros; o foco fica preso nele e volta ao botão ao fechar.
- Os links de Coleções do footer abrem o catálogo filtrado pela categoria. As promoções abrem "Novos lançamentos" e "Arte digital".

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

Implementado no Passo 4.

1. **Formato:** no desktop, entrar e criar conta abrem em modal sobre a tela inicial, com abas "Entrar | Criar conta". Fechar (X, Esc ou clique fora) volta ao início. No mobile, são telas cheias com o logo grande, sem barra inferior nem footer. O link "Novo na Kurio? Crie uma conta" alterna entre as duas.
2. **Cadastro:** pede nome de usuário, e-mail, senha e confirmação. A validação no cliente usa as regras do contrato. Um e-mail ou nome de usuário já usado mostra o erro no campo, que recebe o foco.
3. **Login:** valida os campos e mostra "E-mail ou senha incorretos." sem dizer qual campo está errado.
4. **Depois de entrar:** a pessoa volta à rota de origem (`redirect`), ou ao início, e recebe uma mensagem de boas-vindas.
5. **Refresh:** a sessão sobrevive a ele.
6. **Sessão expirada:** em rota privada, leva ao login com o aviso "Sua sessão expirou..." e depois volta. Em rota pública, mostra só um aviso. Preservar os dados do checkout entra no Passo 10.
7. **Logout:** fica no menu da conta (header) ou no menu lateral (mobile) e limpa todos os dados em cache. Outro usuário que entrar em seguida não vê nada do anterior.
8. **Fora do escopo:** "Esqueceu a senha?" e "Continuar com Google/Facebook" mostram um aviso de indisponível.
9. **Já com sessão:** abrir `/login` ou `/register` leva ao destino ou ao início.

## 7. Perfil e carteiras

1. Edita nome e outros dados do layout, com validação e erros da API.
2. Troca o avatar com preview, validando tipo e tamanho.
3. Altera a senha informando a atual.
4. Cadastra e edita as carteiras principal e secundária.
5. Tudo persiste depois do refresh.

## Ações fora do escopo

Links de páginas editoriais, suporte, atividade, ofertas e downloads ficam desabilitados com explicação ou indicados como indisponíveis. Nenhum deles mostra mensagem de sucesso.
