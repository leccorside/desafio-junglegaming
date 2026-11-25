# NFT Marketplace

Marketplace de NFTs em React e TypeScript, feito para o desafio frontend descrito em [README-DESAFIO.md](README-DESAFIO.md). Tem catálogo, detalhe, carrinho, checkout com carteira simulada, conta do colecionador e atualizações em tempo real. Todo o backend é simulado com MSW, inclusive os eventos Socket.IO.

> Status: em planejamento. Os comandos e links abaixo passam a valer à medida que a implementação avançar.

## Links

| Item | Endereço |
| --- | --- |
| Aplicação publicada | [desafio-junglegaming-two.vercel.app](https://desafio-junglegaming-two.vercel.app) |
| Repositório | [github.com/leccorside/desafio-junglegaming](https://github.com/leccorside/desafio-junglegaming) |
| Layout no Figma (marca KURIO) | [Frontend Challenge](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1) |

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React |
| Linguagem | TypeScript |
| Build | Vite 8 |
| Roteamento | TanStack Router |
| Estado remoto | TanStack Query |
| Cliente HTTP | Axios |
| Tempo real | Socket.IO (`socket.io-client`) |
| Estilização | Tailwind CSS |
| Componentes | shadcn/ui |
| Mocking | MSW + `@mswjs/socket.io-binding` |
| Formulários e validação | React Hook Form + Zod |
| Valores em ETH | big.js (string decimal, 18 casas) |
| Testes unitários | Vitest |
| Testes E2E e regressão visual | Playwright |
| Auditoria | Lighthouse |

## Requisitos

- Node.js 22 ou 24 (`engines: ">=22 <25"`). O projeto é desenvolvido e publicado no 24, e o `.nvmrc` aponta para ele (`nvm use`).
- npm 10 ou superior (o lockfile versionado é o `package-lock.json`)

## Instalação

```bash
git clone <url-do-repositorio>
cd desafio-junglegaming
npm ci
cp .env.example .env
npx playwright install chromium
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST e Socket.IO). Fica ligado também no build de demonstração. |
| `VITE_API_URL` | `/api` | Base das chamadas REST feitas pelo Axios. |
| `VITE_SOCKET_URL` | `ws://localhost/socket` | Endereço do Socket.IO interceptado pelo MSW. |

| `FIGMA_TOKEN` | (vazio) | Opcional. Token pessoal do Figma, só para `node scripts/export-figma-assets.mjs`, que reexporta ícones e imagens do layout. Os arquivos gerados já estão versionados. |

O arquivo `.env.mocks`, versionado, liga os mocks no modo `mocks`, usado pelo `dev:mocks`, pelos testes e pelo deploy.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173`. Os mocks seguem `VITE_ENABLE_MOCKS` do `.env`. |
| `npm run dev:mocks` | Servidor de desenvolvimento com os mocks sempre ligados (modo `mocks`). |
| `npm run build` | Typecheck e build de produção em `dist/`. Para o build de demonstração, com mocks: `npm run build -- --mode mocks`. |
| `npm run preview` | Serve o build em `http://localhost:4173`. |
| `npm run typecheck` | Verificação de tipos. |
| `npm run lint` | ESLint. |
| `npm run format` / `format:check` | Formata ou confere o código com Prettier. |
| `npm run test:unit` | Testes unitários (Vitest) das regras puras: aritmética em ETH e contratos. `test:unit:watch` roda em modo observação. |
| `npm run test:e2e` | Testes Playwright (gera o build com mocks e roda contra o `preview`), com relatório HTML. |
| `npm run test:e2e:update` | Atualiza as baselines de regressão visual. |
| `npm run lighthouse` | Auditoria Lighthouse (três medições por página e perfil). |

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Colecionador A | `ana@example.com` | `Senha@123` |
| Colecionador B | `bruno@example.com` | `Senha@123` |

As senhas ficam guardadas como hash no banco dos mocks.

## Cenários simulados

O cenário ativo é escolhido pela query string `?scenario=<nome>` ou pelo painel de desenvolvimento. O reset volta ao estado inicial das fixtures. A lista completa e como reproduzir cada falha está em [docs/MOCKS.md](docs/MOCKS.md).

## Documentação

| Arquivo | Conteúdo |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitetura, pastas, decisões técnicas e limitações |
| [CHANGELOG.md](CHANGELOG.md) | Histórico de versões |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Contexto, objetivos e escopo |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Requisitos funcionais e não funcionais |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Regras de compra, carrinho, cupom, pagamento, carteira e pedido |
| [docs/API.md](docs/API.md) | Contratos REST |
| [docs/MOCKS.md](docs/MOCKS.md) | MSW, fixtures, cenários e persistência |
| [docs/REALTIME.md](docs/REALTIME.md) | Eventos Socket.IO |
| [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) | Cache, mutations, invalidação e rollback |
| [docs/SECURITY.md](docs/SECURITY.md) | Sessão, rotas protegidas e isolamento entre usuários |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Identidade visual e componentes |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Acessibilidade |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Fluxos de uso |
| [docs/TESTING.md](docs/TESTING.md) | Testes Playwright |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Lighthouse e otimizações |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Build e publicação |
