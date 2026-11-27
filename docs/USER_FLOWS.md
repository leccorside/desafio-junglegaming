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

Rotas com arquivos em `src/routes`. As privadas ficam no layout `_authenticated` e as de entrada no `_guest`.

"Lista de interesse" é o nome que o Figma dá aos favoritos, no menu do perfil e no footer. O coração da barra inferior mobile leva a essa rota.

Os parâmetros de `/login` e `/register` são `redirect` (destino depois de entrar, só caminho interno) e `reason=expired` (mostra o aviso de sessão expirada).

## 1. Descoberta

1. O visitante abre o início e vê destaques e catálogo (skeleton durante o carregamento).
2. Busca, filtra, ordena e pagina. A URL muda a cada ação (`/?q=ape&category=["music"]&sort=price_asc&page=2`).
3. Recarregar ou usar voltar e avançar restaura o mesmo estado.
4. Sem resultados: estado vazio com opção de limpar filtros. Falha: mensagem com botão de tentar de novo.
5. Clica num NFT e vai para o detalhe.

Detalhes:

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
- Filtros: sidebar no desktop (Coleções, Faixa de preço com "Aplicar", Rede). No mobile, o botão ao lado da busca abre um menu lateral com ordenação e filtros; o foco fica preso nele e volta ao botão ao fechar. Com busca, aba ou filtro ativo, o botão ganha um ponto coral e passa a se chamar "Filtros e ordenação (filtros aplicados)".
- Os links de Coleções do footer abrem o catálogo filtrado pela categoria. As promoções abrem "Novos lançamentos" e "Arte digital".

## 2. Detalhe e favoritos

1. Abre o detalhe (também por link direto). NFT inexistente mostra página própria de não encontrado.
2. Navega pela galeria, escolhe a edição e a quantidade. Edição esgotada ou indisponível não pode ser escolhida; a quantidade para no limite disponível.
3. Favoritar como visitante leva ao login e volta ao detalhe. Logado, o coração muda na hora; se a API falhar, volta ao estado anterior com aviso.
4. Adiciona ao carrinho e recebe confirmação.

Detalhes:

- `/nft/$nftId?edition=<id>`: o loader inicia a busca do NFT e a tela mostra o esqueleto até ele chegar (acesso direto e refresh). 404 da API mostra "NFT não encontrado" com "Explorar o catálogo"; outras falhas mostram a página de erro com "Tentar de novo".
- Edição padrão: a mais barata disponível (o preço do card), fixada enquanto a página está aberta: uma mudança de preço que torne outra edição mais barata não troca a seleção (ao recarregar, vale a mais barata do momento). Se a edição da tela esgota ou fica indisponível, a página cai na padrão com o mesmo aviso da URL. A escolha vai para a URL com `replace`, sem encher o histórico. Edição esgotada ou indisponível aparece riscada e não pode ser escolhida; na URL, cai na padrão com o aviso "A edição 1/1 está esgotada. Mostrando a edição …". NFT sem nenhuma edição à venda mostra o aviso e desabilita a compra.
- Quantidade de 1 até a disponibilidade da edição, com aviso "Máximo disponível: N unidades."; trocar de edição volta para 1.
- Desktop: "COMPRAR" adiciona ao carrinho e leva a `/cart`. Mobile: a barra de compra fixa ("Comprar NFT" e o botão do carrinho) substitui a barra de navegação; o botão do carrinho só adiciona e oferece "Ver carrinho" no toast. Voltar (mobile) usa o histórico do app ou vai ao início.
- Favoritar como visitante leva a `/login?redirect=...` e volta à mesma tela (detalhe ou catálogo, com filtros e página). O pedido fica guardado: depois de entrar, o favorito é concluído com o toast "Golden Signal #160 adicionado à lista de interesse." (ou "… já está na sua lista de interesse."), a tela rola até o NFT e o foco vai para o coração. Desistir do login (fechar o modal, voltar ao início) descarta o pedido. Logado, o coração muda na hora; se a API falhar, volta ao estado anterior com toast de erro. O coração aparece no detalhe e nos cards do catálogo no mobile (Figma).
- `/favorites` ("Lista de interesse"): grade com os NFTs favoritados, estado vazio com "Explorar o catálogo" e erro com nova tentativa.
- "Mais desta coleção": até 5 NFTs da mesma coleção (`/nfts?collection=`); some se a coleção não tiver outros.

## 3. Carrinho

1. Vê os itens, altera quantidades e remove itens. O resumo vem da cotação da API.
2. Aplica cupom. Código inválido ou expirado mostra erro no campo e não muda o carrinho.
3. Se o preço ou a disponibilidade de um item mudar com a tela aberta, o item é destacado, o aviso é anunciado e o resumo é atualizado.
4. Visitante que faz login mantém os itens, juntados ao carrinho da conta.
5. Segue para o pagamento (visitante passa pelo login antes).

Detalhes:

- `/cart` (público): lista com imagem, nome (link para o detalhe na mesma edição), ID do token e edição, preço, quantidade, total da linha (da cotação) e lixeira. Vazio: "Seu carrinho está vazio." com "Explorar o catálogo". Erro: mensagem com "Tentar de novo".
- Quantidade de 1 até o estoque da edição; digitar além volta ao máximo. Cada mudança vai à API e o resumo é recalculado pela cotação nova.
- Remover mostra "Emerald Ape #042 (edição 1/50) saiu do carrinho." com "Desfazer".
- Cupom: erro no campo ("Código promocional inválido.", "Este código promocional expirou.", valor mínimo). Aplicado, aparece o código com "Remover cupom", e o desconto mostra o código e a descrição da API.
- Resumo da cotação (Ethereum): subtotal, desconto, taxa de rede ("Taxa estimada") e total, com skeleton no carregamento e indicador na atualização. Item esgotado ou acima do estoque fica marcado e bloqueia "Conectar e finalizar".
- "Conectar e finalizar" leva a `/checkout` (visitante passa pelo login e volta); "Continuar explorando" volta ao catálogo. Abaixo, "Colecionadores também viram" com os NFTs mais populares fora do carrinho.
- Mobile: título com voltar, cartões em gradiente e o resumo preso na base no lugar da barra de navegação; os avisos aparecem no topo.
- Login: o carrinho do visitante entra no da conta, com aviso do que não coube no estoque. O contador do header e da barra inferior mostra o total de unidades.

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

Como ficou:

- `/checkout`: "Perfil do colecionador" (nome de exibição e e-mail, preenchidos com o perfil, e "Observação do colecionador (opcional)"), "Seus NFTs" com os totais da cotação na rede da carteira, e "Carteira e rede" com as carteiras cadastradas (a rede é a da carteira). Sem carteira, o atalho "Cadastrar carteira" leva a `/wallets`.
- "Confirmar compra" valida os dados, conecta a carteira (simulado: conectada, recusada com "Tentar conectar de novo"), busca a cotação de novo e abre a revisão "Revise sua compra" (itens, totais, carteira, rede e colecionador). Se algo mudou desde a tela anterior, a revisão lista o que mudou e o botão vira "Confirmar com os novos valores".
- "Confirmar e pagar" envia com `Idempotency-Key`. O botão trava durante o envio; sem resposta em 5 s, a revisão avisa "Ainda enviando…"; timeout (15 s) reenvia sozinho com a mesma chave. `QUOTE_OUTDATED` mostra as mudanças da API e pede nova confirmação; `WALLET_DISCONNECTED` pede "Reconectar carteira".
- `/orders/$orderId`: "Aguardando a confirmação do pagamento" (atualiza pelo `order.updated` e por consulta a cada 5 s), "Pagamento confirmado" (transação simulada e link do explorador) ou "Pagamento recusado" (motivo, carrinho intacto e "Tentar de novo"). No pendente e no recusado, a linha da carteira diz "Carteira usada:". Confirmado vira o recibo (fluxo 5).
- Pedido pendente aparece no pagamento ("Acompanhar pedido"). Refresh no meio do envio: "Verificar compra" recupera o mesmo pedido.
- Sessão expirada no meio: login com volta ao pagamento e os dados preenchidos.

## 5. Confirmação e recibo

1. Mostra o resultado, a referência da transação simulada com link de explorador simulado, itens, taxas e total.
2. Os valores vêm do snapshot do pedido.
3. O carrinho mantém o que não foi comprado.

Como ficou:

- `/orders/$orderId` confirmado mostra o recibo do Figma num cartão: ícone de agradecimento, "Pagamento confirmado", "Seus NFTs agora estão na sua carteira" e o número do pedido; a faixa com ID da transação (abreviado, `0xA91F…E82C`, inteiro no `title`), data, total e tipo de carteira; "Detalhes da transação" com cada item (imagem, nome, ID do token e, na linha de baixo, a edição, quantidade, subtotal), subtotal e desconto quando houve cupom, taxa de rede e total com "Valores do momento da compra"; a nota "Transação confirmada na Ethereum (simulada)…" (com a rede do pedido) e "Ver no Etherscan" (Polygonscan ou Solscan, conforme a rede), em nova aba.
- Tudo vem do `Order.snapshot`. Preço ou nome mudados depois no catálogo, pelo tempo real ou com refresh, não mexem no recibo.
- Pendente e recusado não têm recibo nem transação. Pedido de outra conta volta 404 da API e aparece como "Pedido não encontrado."; visitante vai para o login.
- Abaixo do cartão, "Ver carrinho" (com o que sobrou) e "Continuar explorando". O X do cartão volta ao início.
- Mobile: cartão na largura da tela, faixa da transação em 2 × 2, quantidade e subtotal abaixo do nome.

## 6. Cadastro e login

1. **Formato:** no desktop, entrar e criar conta abrem em modal sobre a tela inicial, com abas "Entrar | Criar conta". Fechar (X, Esc ou clique fora) volta ao início. No mobile, são telas cheias com o logo grande, sem barra inferior nem footer. O link "Novo na Kurio? Crie uma conta" alterna entre as duas.
2. **Cadastro:** pede nome de usuário, e-mail, senha e confirmação. A validação no cliente usa as regras do contrato. Um e-mail ou nome de usuário já usado mostra o erro no campo, que recebe o foco.
3. **Login:** valida os campos e mostra "E-mail ou senha incorretos." sem dizer qual campo está errado.
4. **Depois de entrar:** a pessoa volta à rota de origem (`redirect`), ou ao início, e recebe uma mensagem de boas-vindas.
5. **Refresh:** a sessão sobrevive a ele.
6. **Sessão expirada:** em rota privada, leva ao login com o aviso "Sua sessão expirou..." e depois volta. Em rota pública, mostra só um aviso. Os dados do checkout ficam preservados.
7. **Logout:** fica no menu da conta (header) ou no menu lateral (mobile) e limpa todos os dados em cache. Outro usuário que entrar em seguida não vê nada do anterior.
8. **Fora do escopo:** "Esqueceu a senha?" e "Continuar com Google/Facebook" mostram um aviso de indisponível.
9. **Já com sessão:** abrir `/login` ou `/register` leva ao destino ou ao início.

## 7. Perfil e carteiras

1. Edita nome de exibição, nome de usuário e nome ENS, com validação e erros da API no campo certo (o campo com erro recebe o foco). O e-mail aparece só para leitura.
2. Troca o avatar: "Alterar" abre o seletor de arquivo, a imagem aparece na hora (prévia) e tipo e tamanho são conferidos antes do envio. Um arquivo recusado é nomeado no aviso, que diz o que continua valendo ("A imagem escolhida antes continua." ou "O avatar atual continua."), e o aviso some ao salvar. "Remover" tira o avatar.
3. Altera a senha informando a atual, a nova e a confirmação.
4. Um "Salvar", como no Figma, grava em sequência o que mudou: dados, avatar e senha. Cada parte salva avisa ("Dados do perfil salvos.", "Avatar atualizado.", "Senha alterada."); se uma falha, o erro vai para o campo dela, que recebe o foco no meio da tela (longe do toast de sucesso no mobile), e o resto que já foi salvo continua salvo. Nome e avatar mudam no header na hora.
5. Cadastra e edita as carteiras principal (sempre aberta) e secundária ("Adicionar" ou "Editar", com "Igual à carteira principal" e "Cancelar"). A secundária salva aparece num resumo.
6. Tudo persiste depois do refresh, e as carteiras ficam disponíveis para o pagamento.

Telas: `/profile` e `/wallets`, com o menu "Meu perfil" do Figma no desktop (Dados do perfil, Carteiras, Lista de interesse e Sair; Atividade, Ofertas, Arquivos baixados e Suporte aparecem como indisponíveis). No mobile, sem frame, voltar e título no topo, abas das seções e uma coluna.

## Ações fora do escopo

Links de páginas editoriais, suporte, atividade, ofertas e downloads ficam desabilitados com explicação ou indicados como indisponíveis. Nenhum deles mostra mensagem de sucesso.

Como ficou:

| Onde | Itens | Comportamento |
| --- | --- | --- |
| Header (desktop) e menu lateral (mobile) | Criadores, Aprenda | Botão desabilitado (`aria-disabled`, apagado, `title`). Ao acionar (clique, toque ou Enter): aviso informativo "Criadores: indisponível nesta demonstração." |
| Rodapé, "Meu perfil" e "Central de ajuda" | Minha coleção, Atividade, Estúdio do criador, Central de ajuda, Como comprar NFTs, Carteira e segurança, Política do mercado, Denunciar item | Igual: botão desabilitado com o aviso do item |
| Rodapé, redes sociais | Facebook, Instagram, Twitter, LinkedIn, YouTube | A Kurio da demonstração não tem perfis. Os ícones ficam (Figma) e avisam "Perfil da Kurio no Instagram: indisponível nesta demonstração."; não abrem a página inicial genérica da rede |
| Rodapé, contato | `contato@email.com`, `+55 11 4002 8922` | Texto (contato de exemplo do Figma), sem `mailto:`/`tel:` |
| Rodapé, newsletter | "Enviar" | Aviso informativo "A newsletter não está disponível nesta demonstração."; nada de "inscrito" |
| Tela inicial, blog | "Ler mais" | Botão desabilitado: "O artigo completo: indisponível nesta demonstração." |
| Menu "Meu perfil" (desktop) | Atividade, Ofertas, Arquivos baixados, Suporte | Botão desabilitado com o aviso do item |
| Entrar e criar conta | "Esqueceu a senha?", "Continuar com Google/Facebook" | Botão desabilitado com "(indisponível nesta demonstração)" no nome acessível e aviso informativo; a pessoa continua na tela, sem sessão |

Os avisos são sempre `info` (nunca `success`), não mudam de página e não se empilham em cliques repetidos. Links externos que ficam: compartilhar o NFT no LinkedIn e no X (compartilham o endereço real da página) e "Ver no Etherscan" do recibo (transação simulada, avisado na nota do recibo).
