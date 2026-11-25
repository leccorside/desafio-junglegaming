# Segurança e sessão

Toda a autenticação é simulada pelo MSW. O objetivo é reproduzir o comportamento de uma sessão real (expiração, isolamento, proteção de rotas), não oferecer segurança de produção.

## Autenticação

- Login e cadastro devolvem um token opaco e `expiresAt`, emitidos pelo MSW.
- O token vai no cabeçalho `Authorization: Bearer` pelo interceptor do Axios.
- O token fica no `localStorage` para recuperar a sessão depois do refresh. Num backend real seria um cookie `HttpOnly`; essa diferença está registrada nas limitações de [ARCHITECTURE.md](../ARCHITECTURE.md).
- No carregamento, a aplicação consulta `GET /auth/session` antes de liberar rotas privadas.

## Senhas

- O banco dos mocks guarda só o hash da senha (SHA-256 com salt, via Web Crypto).
- Senhas nunca aparecem em log, cache do Query, `localStorage` nem URL.
- As credenciais das fixtures são fictícias.

## Expiração de sessão

- A API responde `401 SESSION_EXPIRED` quando o token vence.
- O interceptor dispara o fluxo de expiração uma única vez, mesmo com várias requisições falhando juntas.
- Durante a navegação: limpa os dados privados e leva ao login com `redirect` para a rota atual.
- Durante o checkout: guarda o rascunho do formulário (sem dados sensíveis) e a chave de idempotência em `sessionStorage`, abre o login e devolve o usuário ao ponto em que estava.

## Rotas protegidas

| Rota | Acesso |
| --- | --- |
| Início, detalhe, carrinho | Público |
| Login, cadastro | Só visitante (logado vai para o início) |
| Pagamento, confirmação, perfil, carteiras | Autenticado |
| Favoritar | Autenticado (visitante vai ao login e volta) |

A proteção acontece no `beforeLoad` do TanStack Router, que redireciona para `/login?redirect=<rota>`. O `redirect` só aceita caminhos internos, para evitar open redirect.

## Isolamento entre usuários

- Toda query key privada inclui o ID do usuário.
- No logout e na troca de usuário: desconectar o socket, cancelar requisições, remover queries privadas e limpar o registro de eventos.
- Eventos com `userId` diferente do usuário atual são descartados.
- A API responde `403 FORBIDDEN` para pedido ou carteira de outro usuário, e a interface mostra a tela de acesso negado.
- O carrinho do visitante é juntado ao do usuário no login e depois deixa de ser usado.

## Outros cuidados

- Sem `dangerouslySetInnerHTML` com dado vindo da API.
- Upload de avatar validado por tipo e tamanho antes do envio.
- Links externos simulados abrem com `rel="noopener noreferrer"`.
