# CONTEXTO

Resumo vivo do projeto, para retomar o trabalho em outra sessão. O plano completo está em `docs/private/PASSOS.md` (fora do repositório).

## Estado atual

- **Passo atual:** Passo 0 concluído, exceto o primeiro deploy na Vercel, que aguarda o login do usuário. Próximo: Passo 1 (identidade visual e layout base), aguardando autorização.
- A aplicação sobe com uma página provisória em `/`, com o MSW ativo no modo `mocks` e ainda sem handlers.
- Comandos verdes: `typecheck`, `lint`, `format:check`, `build -- --mode mocks`, `dev`, `preview` e `test:e2e` (4 testes de fumaça).
- A documentação de `docs/` descreve o planejado. O `DESIGN_SYSTEM.md` já tem os valores reais do Figma.

## Histórico de implementações

### 25/11/2026: documentação e design system

- Plano em 17 passos e estrutura de documentação (README, ARCHITECTURE, CHANGELOG e `docs/`).
- `PASSOS.md`, `AGENTS.md` e `CHECKLIST.md` foram movidos pelo usuário para `docs/private/`, que está no `.gitignore`. Os documentos públicos não apontam para eles.
- `DESIGN_SYSTEM.md` preenchido pela API REST do Figma, com token em `FIGMA_TOKEN` no `.env`. O JSON completo do arquivo ficou no scratchpad da sessão e pode ser baixado de novo com o mesmo token.

### 25/11/2026: Passo 0, setup

- Projeto criado à mão, sem o `create vite`, porque a pasta já tinha arquivos.
- Versões: Vite 8.3, React 19.3, TypeScript 6.0, Tailwind 4.3, TanStack Router 1.170, TanStack Query 5.108, Axios 1.21, socket.io-client 4.8, MSW 2.15, `@mswjs/socket.io-binding` 0.2, Zod 4.6, React Hook Form 7.92, Playwright 1.65, ESLint 10, Lighthouse CI 0.16.
- shadcn/ui iniciado com `init -t vite -b radix` e o componente `button`. O tema no `src/index.css` ainda é o padrão do shadcn e será trocado pelos tokens no Passo 1.
- MSW: `src/mocks/enable.ts` inicia o worker antes de renderizar quando `VITE_ENABLE_MOCKS=true` ou no modo `mocks`. `.env.mocks` é versionado (exceção no `.gitignore`).
- Playwright roda contra `vite preview` do build em modo `mocks`, nos projetos `desktop` (1440 × 900) e `mobile` (390 × 844).
- `vercel.json` com build em modo `mocks`, rewrite de SPA que preserva `assets/`, `mockServiceWorker.js` e `favicon.svg`, e cabeçalhos de cache.
- `lighthouserc.json` inicial (três execuções, relatórios em `lighthouse/reports`). A configuração completa entra no Passo 15.

## Decisões e por quê

- **TypeScript 6.0 em vez do 7:** o `typescript-eslint` 8.74 aceita até `<6.1`.
- **MSW 2.x em vez do 3:** o `@mswjs/socket.io-binding` 0.2 declara `msw ^2.10.2`.
- **Sem `baseUrl` no tsconfig:** o TypeScript 6 depreciou a opção. O alias `@/*` usa só `paths`.
- **Prettier fora dos `.md`:** reformataria as tabelas da documentação. Vale só para o código.
- **Regra `react-refresh/only-export-components` desligada** em `src/routes` e `src/components/ui`, porque exportar `Route` e as variantes do shadcn é padrão das bibliotecas.
- **`main.tsx` sem top-level await:** usa `enableMocking().then(render)` para não depender do target de build.

## Erros e correções

- `tsc` acusou `navigator.serviceWorker` inexistente no teste de fumaça: o `tsconfig.node.json` não tinha a lib `DOM`, que os callbacks de `page.evaluate` precisam. Adicionada.
- Em Git Bash, argumentos começando com `/v1/...` são convertidos em caminho do Windows (conversão do MSYS). O script do Figma passou a aceitar o caminho sem a barra inicial.

## Pendências

1. **Primeiro deploy na Vercel:** o CLI está deslogado nesta máquina. É preciso `npx vercel login`, ou importar o repositório `leccorside/desafio-junglegaming` no painel da Vercel. Depois, conferir acesso direto e refresh em uma rota qualquer.
2. Passo 1 em diante, conforme `docs/private/PASSOS.md`, um por vez e com autorização.

## Limitações conhecidas

- O chunk do MSW (`browser-*.js`, cerca de 157 kB gzip) vai junto no build de demonstração. É carregado sob demanda, mas atrasa a primeira renderização. Medir no Passo 15.
- O `npm run lighthouse` ainda não foi executado. Precisa do Chrome, que pode vir do Playwright via `CHROME_PATH`, a definir no Passo 15.
