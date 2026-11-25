# Segurança e sessão

Toda a autenticação é simulada pelo MSW. O objetivo é reproduzir o comportamento de uma sessão real (expiração, isolamento, proteção de rotas), não oferecer segurança de produção.

## Onde está no código

| Arquivo | Papel |
| --- | --- |
| `src/features/auth/session-store.ts` | Sessão atual (token, validade, usuário) fora do React, persistida em `kurio:session`. `useSession()` para os componentes. |
| `src/features/auth/session.ts` | Ciclo de vida: `ensureSession`, `startSession`, `logout`, `expireSession`, `endSession` e `onSessionEnd` (registro para o socket do Passo 8). |
| `src/api/client.ts` | Axios: envia o token, ou o `X-Cart-Id` do visitante, e avisa a sessão quando a API responde `SESSION_EXPIRED` ou `UNAUTHENTICATED` para uma requisição que levava token. |
| `src/features/auth/redirect.ts` | `safeRedirect`: só aceita destino interno depois do login. |
| `src/routes/_authenticated.tsx` e `src/routes/_guest.tsx` | Proteção das rotas privadas e das telas só para visitante. |

## Autenticação

- Login e cadastro devolvem um token opaco e `expiresAt` (30 minutos), emitidos pelo MSW. Só há uma sessão ativa por usuário.
- O token vai no cabeçalho `Authorization: Bearer` pelo interceptor do Axios. Sem sessão, o interceptor envia o `X-Cart-Id` do carrinho do visitante (`kurio:guest-cart-id`).
- O token fica no `localStorage` (`kurio:session`) para recuperar a sessão depois do refresh. Num backend real seria um cookie `HttpOnly`; essa diferença está registrada nas limitações de [ARCHITECTURE.md](../ARCHITECTURE.md). O valor salvo é validado pelo `sessionSchema` na leitura, e um valor corrompido é ignorado.
- No carregamento, o `beforeLoad` da rota raiz chama `ensureSession()`, que consulta `GET /auth/session` uma vez e guarda no cache.
- Cada entrada em rota privada revalida a sessão na API (`ensureSession({ revalidate: true })`).
- Um token com `expiresAt` vencido expira localmente, sem requisição.

## Senhas

- O banco dos mocks guarda só o hash da senha (SHA-256 com salt, via Web Crypto).
- Senhas nunca aparecem em log, cache do Query, `localStorage` nem URL. A sessão salva tem só token, validade e dados públicos do usuário.
- Login com credencial errada devolve `INVALID_CREDENTIALS`, e a tela mostra "E-mail ou senha incorretos." sem dizer qual campo errou.
- As credenciais das fixtures são fictícias.

## Expiração de sessão

- A API responde `401 SESSION_EXPIRED` quando o token vence (ou no cenário `session-expired`).
- O interceptor chama `expireSession()`, que roda uma vez por sessão, mesmo com várias requisições falhando juntas: avisa os interessados (`onSessionEnd`), apaga a sessão, cancela as requisições e limpa o cache.
- **Em rota privada:** o `router.invalidate()` reexecuta a proteção, que leva a `/login?redirect=<rota atual>&reason=expired`. A tela de login mostra "Sua sessão expirou. Entre de novo para continuar de onde parou." e, depois de entrar, volta à rota de origem.
- **Em rota pública:** a pessoa fica onde está, sem sessão, e recebe um aviso (toast).
- **Durante o checkout:** o `redirect` devolve à tela de pagamento. Guardar o rascunho do formulário e a chave de idempotência em `sessionStorage` entra com o checkout, no Passo 10.

## Rotas protegidas

| Rota | Acesso |
| --- | --- |
| `/`, `/nft/$nftId`, `/cart` | Público |
| `/login`, `/register` | Só visitante. Com sessão, vai para o `redirect` ou para o início |
| `/checkout`, `/orders/$orderId`, `/profile`, `/wallets`, `/favorites` | Autenticado |
| Favoritar | Autenticado (visitante vai ao login e volta), no Passo 6 |

A proteção acontece no `beforeLoad` do layout `_authenticated`, que redireciona para `/login?redirect=<rota>`. O `redirect` passa por `safeRedirect`, que recusa URL absoluta, `//`, `/\`, caminho sem barra e as próprias telas de entrada, para evitar open redirect e laço de redirecionamento.

## Isolamento entre usuários

- Toda query key privada inclui o ID do usuário. A da sessão inclui o token.
- No logout e na troca de usuário, `endSession` faz, nesta ordem:
  1. avisa os registrados em `onSessionEnd` (o socket desconecta no Passo 8);
  2. apaga a sessão;
  3. cancela as requisições em andamento;
  4. limpa **todo** o cache (`queryClient.clear()`). Os dados públicos são buscados de novo, e isso é mais simples e seguro do que escolher quais chaves apagar.
- Entrar com outra conta sem sair (`startSession` com outro usuário) passa pelo mesmo `endSession('switch')`.
- Eventos com `userId` diferente do usuário atual são descartados (Passo 8).
- A API responde `403 FORBIDDEN` para pedido ou carteira de outro usuário.
- O carrinho do visitante é juntado ao do usuário no login (Passo 7) e depois deixa de ser usado.

## Outros cuidados

- Sem `dangerouslySetInnerHTML` com dado vindo da API.
- Toda resposta passa pelo schema do contrato (`apiRequest`). Resposta fora do contrato vira `INVALID_RESPONSE` e não chega ao cache.
- Upload de avatar validado por tipo e tamanho antes do envio.
- Links externos abrem com `rel="noopener noreferrer"`.
- Login social e recuperação de senha estão fora do escopo: os botões avisam que não estão disponíveis e não simulam sucesso.
