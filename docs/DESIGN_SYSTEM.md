# Design system

A identidade visual vem do [Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1). Os valores abaixo são preenchidos no Passo 1, depois do levantamento do arquivo.

## Tokens

Os tokens viram variáveis CSS e alimentam o tema do Tailwind e o tema do shadcn/ui.

### Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | a levantar | Fundo da página |
| `--foreground` | a levantar | Texto principal |
| `--primary` | a levantar | Ações principais |
| `--secondary` | a levantar | Ações secundárias |
| `--muted` | a levantar | Fundos e textos de apoio |
| `--border` | a levantar | Bordas e divisórias |
| `--destructive` | a levantar | Erros e ações destrutivas |
| `--success` | a levantar | Confirmações |
| `--warning` | a levantar | Avisos (preço alterado) |

Todo par de texto e fundo precisa de contraste mínimo de 4.5:1 (3:1 para texto grande).

### Tipografia

| Estilo | Fonte | Tamanho / altura de linha | Peso |
| --- | --- | --- | --- |
| Display | a levantar | | |
| H1 | a levantar | | |
| H2 | a levantar | | |
| H3 | a levantar | | |
| Corpo | a levantar | | |
| Legenda | a levantar | | |

As fontes ficam hospedadas no projeto com `font-display: swap` e preload das usadas acima da dobra.

### Espaçamento, raios e sombras

A levantar no Passo 1 e mapear para a escala do Tailwind.

## Breakpoints

| Nome | Largura | Referência |
| --- | --- | --- |
| Mobile | até 767 px | Frame mobile, validado em 390 px |
| Tablet | 768 px a 1279 px | Validado em 768 px |
| Desktop | a partir de 1280 px | Frame desktop, validado em 1440 px |

O tablet não tem frame no Figma e combina os dois layouts.

## Componentes

Componentes shadcn/ui ficam em `src/components/ui`, adaptados aos tokens.

| Componente | Uso |
| --- | --- |
| Button | Ações em todas as telas |
| Input, Label, Form | Formulários |
| Select, Checkbox, RadioGroup, Slider | Filtros, rede, carteira |
| Dialog | Confirmação, revisão de cotação |
| Sheet / Drawer | Filtros e menu no mobile, carrinho lateral se houver no Figma |
| Tabs | Detalhe do NFT e perfil, se houver no Figma |
| Badge | Status de edição e de pedido |
| Skeleton | Carregamento com shimmer |
| Toast (Sonner) | Feedback de mutations e eventos |
| Pagination | Catálogo |
| Avatar | Perfil e criador |

Componentes de produto (card de NFT, galeria, resumo do carrinho, seletor de quantidade) ficam nas pastas de cada feature.

## Estados não desenhados

Estados que o Figma não mostra (vazio, erro, pendente, preço alterado, esgotado, foco) usam os mesmos tokens e padrões do restante. Cada decisão fica registrada em [ARCHITECTURE.md](../ARCHITECTURE.md), na seção de decisões de UX.

## Skeletons

- Mesmas dimensões do conteúdo final, para não deslocar o layout.
- Shimmer em CSS, desligado com `prefers-reduced-motion: reduce`.
- Usados no catálogo, nos destaques, no detalhe, no resumo do carrinho e no perfil.

## Assets

- Exportados do Figma para `public/` ou `src/assets`.
- Imagens em WebP ou AVIF com dimensões declaradas.
- Qualquer substituição de asset é registrada em [ARCHITECTURE.md](../ARCHITECTURE.md).
