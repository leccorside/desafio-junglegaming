# Changelog

Mudanças relevantes do projeto. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/). Cada etapa da implementação gera uma entrada.

## [Não publicado]

### Adicionado

- Contratos tipados em `src/api/contracts` (Zod): sessão e conta, NFT com edições, categorias, rede e raridade, listagem com facetas, favoritos, carrinho, cotação, pedido com snapshot e idempotência, perfil, carteiras e eventos `nft.updated` e `order.updated`. Formato padrão de erro com status por código.
- Helpers de valores em ETH em `src/lib/eth.ts` (big.js, 18 casas) e `formatEth` no padrão do Figma.
- Vitest com 46 testes unitários dos helpers e dos contratos (`npm run test:unit`).
- Identidade visual do Figma: tokens de cor, tipografia (Roboto Mono local), raios, sombras e contêiner de 1200 px em `src/index.css`.
- Componentes shadcn/ui adaptados: button, input, label, select, dialog, sheet, tabs, badge, skeleton com shimmer, sonner, form, pagination, checkbox, radio-group, slider, separator e avatar.
- Layout base: header desktop, header compacto com menu lateral no tablet, barra inferior no mobile, footer, link para pular ao conteúdo, página 404 e página de erro de rota.
- Script `scripts/export-figma-assets.mjs` e os assets exportados: 27 ícones, forma da barra inferior e 4 imagens em WebP.
- Testes E2E de layout: navegação por viewport, itens fora do escopo, footer, newsletter, foco no menu lateral, link para pular, 404 e ausência de rolagem horizontal.
- Setup do projeto: Vite 8, React 19, TypeScript 6 (`strict`), Tailwind CSS 4, shadcn/ui (Radix), TanStack Router com rotas por arquivo, TanStack Query, Axios, Socket.IO client, MSW 2 com `@mswjs/socket.io-binding`, Zod, React Hook Form, ESLint, Prettier, Playwright e Lighthouse CI.
- Modo `mocks` do Vite e inicialização do MSW antes da primeira renderização.
- Testes de fumaça em Chromium, desktop e mobile.
- `vercel.json` com fallback de SPA e cabeçalhos de cache.
- Design system com os valores do Figma.
- Estrutura de documentação: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` e os documentos de `docs/` (contexto, requisitos, regras de negócio, API, mocks, tempo real, estado, segurança, design system, acessibilidade, fluxos, testes, performance e deploy).
