# Performance e Lighthouse

## Metas

| Categoria | Meta |
| --- | ---: |
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 90 |

## Protocolo da auditoria

- Páginas: início e detalhe de um NFT fixo das fixtures.
- Perfis: mobile (padrão do Lighthouse, com throttling simulado) e desktop (preset desktop).
- Build de produção (`npm run build` + `npm run preview`) com o cenário padrão dos mocks.
- Três medições por página e perfil. O relatório usa a mediana de cada categoria.
- A auditoria carrega as mesmas imagens, fontes e funcionalidades da entrega, sem versão simplificada.
- Configuração versionada em `lighthouse/` e executada por `npm run lighthouse`.
- Relatórios HTML e JSON salvos em `lighthouse/reports/`.

## Resultados

A preencher no Passo 15.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | | | | | | | |
| Início | Desktop | | | | | | | |
| Detalhe | Mobile | | | | | | | |
| Detalhe | Desktop | | | | | | | |

### Ambiente de execução

| Item | Valor |
| --- | --- |
| Versão do Lighthouse | |
| Versão do Chrome | |
| Versão do Node.js | |
| Sistema operacional e máquina | |
| Data | |

## Estratégias de otimização

- Code splitting por rota (lazy routes do TanStack Router).
- Imagem do LCP com `fetchpriority="high"` e sem lazy loading. Demais imagens com `loading="lazy"`.
- Imagens em WebP ou AVIF, com `srcset`, `sizes`, largura e altura declaradas.
- Fontes locais com preload e `font-display: swap`.
- Skeletons com as dimensões do conteúdo final, para manter o CLS baixo.
- Devtools do Query só em desenvolvimento.
- Inicialização do MSW sem bloquear além do necessário (medir o custo e documentar).
- Metadados por rota (título, descrição), `lang="pt-BR"`, `robots.txt` e links rastreáveis para SEO.

## Resultados abaixo da meta

A preencher. Para cada métrica abaixo da meta: valor, causa identificada e o que foi tentado.

Um ponto já conhecido: o MSW roda no navegador e o service worker precisa ser registrado antes das requisições, o que pode afetar o LCP no perfil mobile.
