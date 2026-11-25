# Changelog

Mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/). Cada etapa da implementação gera uma entrada.

## [Não publicado]

### Adicionado

- Setup do projeto: Vite 8, React 19, TypeScript 6 (`strict`), Tailwind CSS 4, shadcn/ui (Radix), TanStack Router com rotas por arquivo, TanStack Query, Axios, Socket.IO client, MSW 2 com `@mswjs/socket.io-binding`, Zod, React Hook Form, ESLint, Prettier, Playwright e Lighthouse CI.
- Modo `mocks` do Vite e inicialização do MSW antes da primeira renderização.
- Testes de fumaça em Chromium, desktop e mobile.
- `vercel.json` com fallback de SPA e cabeçalhos de cache.
- Design system com os valores do Figma.
- Estrutura de documentação: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` e os documentos de `docs/` (contexto, requisitos, regras de negócio, API, mocks, tempo real, estado, segurança, design system, acessibilidade, fluxos, testes, performance e deploy).
