# Design system

Valores extraídos em 25/11/2026 do arquivo [Frontend Challenge](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1), página "Marketplace de NFTs GreenMint", pela API REST do Figma. As contagens ("usos") indicam quantos elementos aplicam cada valor e servem para separar o padrão das exceções.

## Frames do arquivo

| Desktop (1440 px) | Altura | Mobile (414 px) |
| --- | ---: | --- |
| Início | 3668 | Início |
| Detalhes do NFT | 2246 | Detalhes do NFT |
| Carrinho de NFTs | 1754 | Carrinho de NFTs |
| Pagamento | 1657 | Pagamento |
| Confirmação de Pedido | 1657 | sem frame |
| Login | 1981 | Login |
| Cadastro | 1981 | Cadastro |
| Perfil do Colecionador | 1080 | sem frame |
| Carteiras | 1080 | sem frame |

Os frames mobile têm 896 px de altura e mostram só a primeira dobra de cada tela.

## Tema

O layout tem um tema único, escuro, em tons de marrom e cobre. Todos os 15 frames usam o fundo `Color/Ink` (`#140d0a`). Não existe versão clara no Figma, então a aplicação não terá alternância de tema.

## Cores

### Estilos de cor do Figma

| Estilo no Figma | Hex | Usos | Papel |
| --- | --- | ---: | --- |
| `Color/Ink` | `#140d0a` | 157 | Fundo da página, texto sobre botões primários |
| `Color/Surface Card` | `#241612` | 145 | Fundo de cards e painéis |
| `Color/Surface Raised` | `#2f1d15` | 32 | Superfície elevada (menus, campos em destaque) |
| `Color/Surface Dark` | `#38220f` | 34 | Superfície de contraste (faixas, blocos promocionais) |
| `Color/Foreground` | `#f5f1eb` | 433 | Texto principal |
| `Text/Primary` | `#f7f3ec` | 0 | Texto principal (estilo definido, sem uso) |
| `Text/Secondary` | `#cfb28c` | 161 | Texto de apoio |
| `Text/Accent` | `#e89b55` | 140 | Texto em destaque, preços, links |
| `Text/Coral` | `#f0805f` | 40 | Texto de destaque secundário |
| `Color/Primary` | `#d28a4c` | 337 | Ações principais, ícones ativos, bordas de foco |
| `Color/Primary Light` | `#dd9a5f` | 0 | Hover do primário (definido, sem uso) |
| `Color/Primary Dark` | `#c47b3e` | 0 | Pressionado do primário (definido, sem uso) |
| `Color/Secondary` | `#b39463` | 125 | Ações e bordas secundárias |
| `Color/Amber` | `#e3a44e` | 16 | Avaliações, avisos |
| `Color/Border` | `#3f2319` | 107 | Borda padrão de cards e campos |
| `Color/Border Soft` | `#55321f` | 27 | Divisórias e bordas de destaque leve |
| `Color/Success` | `#00a66c` | 4 | Confirmação |
| `Color/Error` | `#ed1b2e` | 2 | Erro |
| `Color/White` | `#ffffff` | 29 | Ícones e logos |
| `Color/Black` | `#000000` | 21 | Ícones e logos |
| `Color/Background Elevated` | `#fbfbfb` | 2 | Fundo claro pontual |
| `Color/Gray Light` | `#ededed` | 1 | Fundo claro pontual |

Os estilos `Logo/*` (`Orange #ff641a`, `Facebook #3b5999`, `Google Blue #4086f4`, `Google Green #59c36a`, `Google Yellow #ffda2d`, `Blue #4175df`, `Light Blue #03a9f4`, `Indigo #283593`) pertencem às marcas dos botões de login social e das redes. Ficam nos SVGs exportados e não viram tokens.

### Mapeamento para os tokens do projeto

Os tokens seguem os nomes do shadcn/ui, para que os componentes funcionem sem ajuste de classe.

| Variável CSS | Estilo do Figma | Hex |
| --- | --- | --- |
| `--background` | `Color/Ink` | `#140d0a` |
| `--foreground` | `Color/Foreground` | `#f5f1eb` |
| `--card` | `Color/Surface Card` | `#241612` |
| `--card-foreground` | `Color/Foreground` | `#f5f1eb` |
| `--popover` | `Color/Surface Raised` | `#2f1d15` |
| `--popover-foreground` | `Color/Foreground` | `#f5f1eb` |
| `--primary` | `Color/Primary` | `#d28a4c` |
| `--primary-hover` | `Color/Primary Light` | `#dd9a5f` |
| `--primary-active` | `Color/Primary Dark` | `#c47b3e` |
| `--primary-foreground` | `Color/Ink` | `#140d0a` |
| `--secondary` | `Color/Secondary` | `#b39463` |
| `--secondary-foreground` | `Color/Ink` | `#140d0a` |
| `--muted` | `Color/Surface Raised` | `#2f1d15` |
| `--muted-foreground` | `Text/Secondary` | `#cfb28c` |
| `--accent` | `Color/Surface Dark` | `#38220f` |
| `--accent-foreground` | `Text/Accent` | `#e89b55` |
| `--highlight` | `Text/Coral` | `#f0805f` |
| `--warning` | `Color/Amber` | `#e3a44e` |
| `--success` | `Color/Success` | `#00a66c` |
| `--destructive` | `Color/Error` | `#ed1b2e` |
| `--border` | `Color/Border` | `#3f2319` |
| `--border-soft` | `Color/Border Soft` | `#55321f` |
| `--input` | `Color/Border` | `#3f2319` |
| `--ring` | `Color/Primary` | `#d28a4c` |

## Tipografia

O arquivo usa uma única família: **Roboto Mono**, nos pesos 400 (441 textos), 700 (320) e 500 (64). A fonte vai ser hospedada no projeto (por exemplo com `@fontsource/roboto-mono`), só com esses três pesos e `font-display: swap`.

O Figma tem 61 estilos de texto, muitos variando apenas a altura de linha. A tabela abaixo reúne os que aparecem nas telas, do maior para o menor.

| Estilo no Figma | Tamanho | Peso | Altura de linha | Espaçamento | Usos |
| --- | ---: | ---: | --- | --- | ---: |
| `Display/43 Bold` | 43 px | 700 | 70 px | 0 | 3 |
| `Display/32 Bold` | 32 px | 700 | automática (≈42 px) | 3,2 px (10%) | 2 |
| `Heading/28 Bold` | 28 px | 700 | automática (≈37 px) | 0 | 1 |
| `Heading/24 Bold` | 24 px | 700 | automática (≈32 px) | 0 | 15 |
| `Title/22 Regular` | 22 px | 400 | 29 px | 0 | 32 |
| `Title/22 Bold` | 22 px | 700 | 16 px | 0 | 1 |
| `Title/21 Regular` | 21 px | 400 | 16 px | 0 | 4 |
| `Title/20 Bold`, `Medium`, `Regular` | 20 px | 700 / 500 / 400 | 16 px (28 px no Regular) | 0 | 10 |
| `Body Large/18 Bold · lh 16` | 18 px | 700 | 16 px | 0 | 94 |
| `Body Large/18 Regular`, `Medium`, `Bold · lh 24` | 18 px | 400 / 500 / 700 | 16, 25 ou 24 px | 0 | 13 |
| `Body Large/17 Bold`, `Regular` | 17 px | 700 / 400 | 16 ou 24 px | 0 | 30 |
| `Body Large/16 *` | 16 px | 400 / 500 / 700 | 16, 20, 22 px ou automática (≈21 px) | 0 | 156 |
| `Body/15 *` | 15 px | 400 / 500 / 700 | 15, 16, 40, 45 px ou automática (≈20 px) | 0 | 219 |
| `Body/14 *` | 14 px | 400 / 500 / 700 | 15, 16, 20, 22, 24, 30 px ou automática (≈18,5 px) | 0 ou 1,4 px (10%) | 176 |
| `Caption/13 *` | 13 px | 400 / 500 | 16 ou 22 px | 0 | 21 |
| `Caption/12 *` | 12 px | 400 / 700 | 14, 16 ou 18 px | 0 | 11 |
| `Tiny/10 Medium` | 10 px | 500 | automática (≈13 px) | 0 | 9 |
| `Tiny/9 Bold` | 9 px | 700 | automática (≈12 px) | 0,1 px | 7 |

Os estilos `Heading/26 Bold`, `Title/23 Bold` e `Body Large/19 Bold` existem no arquivo, mas nenhum elemento os usa.

### Escala adotada no código

Para não levar 61 estilos para o Tailwind, a escala fica com os tamanhos e pesos do Figma, e a altura de linha passa a depender do uso: valor fixo do Figma em textos de uma linha (rótulos, botões, preços) e altura proporcional em textos corridos.

| Classe | Tamanho | Altura de linha | Origem |
| --- | ---: | ---: | --- |
| `text-display` | 43 px | 70 px | `Display/43` |
| `text-display-sm` | 32 px | 1,32 + `tracking-[0.1em]` | `Display/32` |
| `text-h1` | 28 px | 1,32 | `Heading/28` |
| `text-h2` | 24 px | 1,32 | `Heading/24` |
| `text-title` | 22 px | 29 px | `Title/22` |
| `text-title-sm` | 20 px | 28 px | `Title/20` |
| `text-lead` | 18 px | 24 px | `Body Large/18` |
| `text-body-lg` | 16 px | 22 px | `Body Large/16` |
| `text-body` | 15 px | 20 px | `Body/15` |
| `text-body-sm` | 14 px | 22 px | `Body/14` |
| `text-caption` | 13 px | 16 px | `Caption/13` |
| `text-caption-sm` | 12 px | 16 px | `Caption/12` |
| `text-tiny` | 10 px | 13 px | `Tiny/10` |

As alturas de 40 e 45 px em `Body/15` vêm de linhas de tabela e de lista no Figma. No código, essa altura vira `min-height` da linha, e não `line-height`, para o texto não quebrar mal quando crescer com zoom. Os textos em caixa alta com espaçamento de 10% (`Display/32` e parte de `Body/14 Bold`) usam `tracking-[0.1em]`.

## Espaçamento

O arquivo segue uma grade de 4 px, com o 10 e o 6 como exceções frequentes. A escala padrão do Tailwind (múltiplos de 4 px, mais `1.5` = 6 px e `2.5` = 10 px) cobre todos os valores, sem tokens extras.

| Valor | Usos como gap | Classe Tailwind |
| ---: | ---: | --- |
| 4 px | 28 | `1` |
| 6 px | 29 | `1.5` |
| 8 px | 57 | `2` |
| 10 px | 269 | `2.5` |
| 12 px | 161 | `3` |
| 16 px | 30 | `4` |
| 20 px | 16 | `5` |
| 24 px | 24 | `6` |
| 28 px | 20 | `7` |
| 32 px | 28 | `8` |
| 40 px | 19 | `10` |
| 48 px | 6 | `12` |
| 96 px | 9 | `24` |

Paddings internos mais comuns: `16 px` horizontal (44 usos), `8 px` em todos os lados (17), `32 px` em todos os lados (15), `12 × 16 px` em campos (8) e `8 × 12 px` em botões compactos (8).

## Layout e grade

### Desktop (1440 px)

- Margem lateral de 120 px e topo/rodapé de 24 px: o conteúdo ocupa um contêiner de **1200 px** centralizado (`max-w-[1200px] mx-auto`).
- Distância entre as seções da página: **96 px**.
- Início:
  - topo com header (45 px) e hero (450 px), separados por 32 px;
  - catálogo com sidebar de filtros de 310 px, gap de 48 px e grade de produtos de 842 px;
  - dois cards promocionais de 586 × 250 px, com gap de 28 px;
  - bloco de blog com cards de 369 px de altura, gap de 24 px;
  - footer de 610 px.
- O arquivo não define layout grid. As colunas saem das medidas acima.

### Mobile (414 px)

- Margem lateral de **24 px** e topo de 40 px: conteúdo de 366 px.
- Gap vertical entre blocos: 16 px.
- Barra de busca de 45 px de altura (campo de 313 px e botão de filtro de 45 × 45 px).
- Banner hero de 366 × 190 px.
- Grade de produtos em duas colunas de 175 px, gap de 16 px, com a coluna direita deslocada 32 px para baixo.
- Barra de navegação inferior fixa de 126 px, com botão central circular de 65 px.

### Breakpoints

| Nome | Faixa | Referência |
| --- | --- | --- |
| Mobile | até 767 px | Frame de 414 px, validado também em 390 px (exigência do desafio) |
| Tablet | 768 px a 1279 px | Sem frame. Mantém a navegação desktop e passa os filtros para drawer |
| Desktop | a partir de 1280 px | Frame de 1440 px |

Em 390 px a margem lateral continua 24 px, e as colunas da grade mobile ficam com 163 px.

## Raios

| Valor | Usos | Onde aparece | Token |
| ---: | ---: | --- | --- |
| 3 px | 53 | Botão "Salvar", campo de cupom, inputs de senha | `rounded-xs` |
| 4 px | 38 | Elementos internos de cards, botões das redes sociais | `rounded-sm` |
| 5 px | 17 | Inputs de login e cadastro, botões de entrar, login social, botão Etherscan | `rounded-control` |
| 6 px | 48 | Botão de login do header, botão "Aplicar", newsletter | `rounded-md` |
| 8 px | 22 | Cards de blog e promocionais | `rounded-lg` |
| 10 px | 13 | Campo de busca mobile | `rounded-[10px]` |
| 12 px | | Banner hero mobile | `rounded-xl` |
| 14 px | 12 | Botão de filtro mobile | `rounded-[14px]` |
| 16 px | 29 | Imagens e cards de produto | `rounded-2xl` |
| 20 px ou mais | 45 | Botões de adicionar (pílula), avatares, chips | `rounded-full` |

Os tokens estão em `src/index.css` (`--radius-*`). Como o projeto define tokens próprios de raio e de texto, o `cn` (`src/lib/utils.ts`) estende o `tailwind-merge` com esses nomes. Sem isso, `text-body-sm` seria confundido com cor de texto e descartado ao lado de `text-foreground`.

## Bordas

| Espessura e cor | Usos | Uso |
| --- | ---: | --- |
| 1 px `Color/Border` | 112 | Padrão de cards, campos e botões sociais |
| 1 px `Color/Primary` | 42 | Campo ativo ou com foco |
| 1,5 px `Color/Secondary` | 39 | Botões e controles secundários |
| 1,5 px `Color/Ink` | 35 | Contorno sobre fundo primário |
| 1,5 px `Color/Primary` | 19 | Seleção (edição, carteira, rede) |
| 1,5 px `Color/Border Soft` | 15 | Divisórias de destaque |
| 3 a 4 px `Color/Primary` | 16 | Item selecionado em destaque (miniatura ativa da galeria) |
| 2 px `Color/Ink` | 9 | Contorno do badge de contagem do carrinho |

## Sombras

| Token | Valor CSS | Usos |
| --- | --- | ---: |
| `shadow-sm` | `0 4px 12px -2px rgb(20 13 10 / 0.15)` | 10 |
| `shadow-md` | `0 0 20px 0 rgb(10 6 4 / 0.45)` | 8 |
| `shadow-lg` | `0 6px 20px 0 rgb(10 6 4 / 0.45)` | 5 |
| `shadow-xl` | `0 0 40px 0 rgb(10 6 4 / 0.45)` | 1 |
| `shadow-top` | `0 -10px 30px 0 rgb(10 6 4 / 0.45)` | 1 (barra inferior mobile) |

## Componentes medidos no Figma

| Componente | Altura | Raio | Visual |
| --- | ---: | ---: | --- |
| Botão de login (header) | 35 px | 6 px | Fundo `Primary` |
| Botão "Aplicar" (cupom) | 36 px | 6 px | Fundo `Primary`, padding 8 × 12 px |
| Botão "Salvar" (perfil) | 40 px | 3 px | Fundo `Primary` |
| Botões "Entrar" e "Criar conta" | 45 px | 5 px | Fundo `Primary` |
| Botão "Ver no Etherscan" | 48 px | 5 px | Fundo `Primary`, padding 16 px |
| Botão de adicionar (pílula) | 30 px (50 px no detalhe) | 20 px (33 px) | Fundo `Primary`, borda 1 px `Ink` |
| Botão de login social | 40 px | 5 px | Transparente, borda 1 px `Border` |
| Campo de texto | 40 px | 5 px (3 px no perfil) | Transparente, borda 1 px `Border`, padding 12 × 16 px; borda `Primary` no foco |
| Campo de cupom | 40 px | 3 px | Borda 1 px `Primary` |
| Linha de formulário (rótulo + campo) | 65 a 79 px | | Rótulo acima do campo |
| Card de produto | 307 px | 16 px na imagem | |
| Card de blog | 369 px | 8 px | Fundo `Surface Card` |
| Card promocional | 250 px | 8 px | Imagem de fundo |
| Badge de contagem do carrinho | 16 px | | Fundo `Primary`, borda 2 px `Ink`, texto `Tiny/9 Bold` |

## Ícones e assets exportados

Os ícones do layout vêm do pacote Iconly (variantes Bold, Curved, Two-tone e Light-Outline), além dos ícones de redes sociais, busca e carrinho desenhados no arquivo. O script `scripts/export-figma-assets.mjs` exporta tudo pela API do Figma, usando o `FIGMA_TOKEN` do `.env`:

| Saída | Conteúdo |
| --- | --- |
| `src/components/icons/figma-icons.tsx` | 27 ícones como componentes React (`SearchIcon`, `CartIcon`, `HomeIcon`, `YoutubeIcon`...), com `currentColor`. Arquivo gerado, não editar à mão. |
| `src/assets/tab-bar-background.svg` | Forma curva da barra inferior mobile, com a sombra do Figma |
| `public/images/nfts/nft-0{1..4}-{480,960}.webp` | As 4 imagens do arquivo, em WebP (16 a 69 kB cada) |

Cada ícone aceita `size` (padrão 20) e `title`. Sem `title` ele é decorativo (`aria-hidden`), que é o caso quando o botão ou link já tem nome acessível. Os componentes do shadcn mantêm os ícones internos do `lucide-react` (fechar, setas do select), e o botão de menu do header usa o `MenuIcon` do lucide, porque o Figma não tem ícone de menu.

O arquivo só tem 4 imagens, reaproveitadas em 81 lugares. As fixtures do catálogo (Passo 3) vão repetir essas imagens.

## Layout implementado

| Faixa | Header | Navegação | Footer |
| --- | --- | --- | --- |
| Desktop (≥ 1024 px) | Logo, navegação com item ativo sublinhado, busca, carrinho e botão "Entrar", com divisória `Primary` a 30% | No header | Três faixas do Figma, em 4 colunas |
| Tablet (768 a 1023 px) | Logo, busca, carrinho e botão de menu | Menu lateral (Sheet) com os itens e o "Entrar" | 2 colunas |
| Mobile (< 768 px) | Não há, como no Figma | Barra inferior fixa: Início, Favoritos, botão central (abre o menu), Carrinho e Perfil | 1 coluna, com espaço livre para a barra |

Toasts (Sonner, `src/components/ui/sonner.tsx`): no canto inferior direito, a 24 px da base, a partir de 768 px. Abaixo disso ficam a `calc(142px + env(safe-area-inset-bottom))` da base, com 16 px nas laterais: acima da barra inferior (126 px) e do botão "Sair" do menu lateral (cerca de 81 px). A regra segue a media query do projeto (768 px), e não a do Sonner (600 px).

### Tela inicial (Passo 5)

| Bloco | Desktop (≥ 1024 px) | Mobile (< 768 px) |
| --- | --- | --- |
| Hero | 1200 × 450: texto `display` (43 px) à esquerda, imagem do destaque de 450 px com raio 24 à direita, botão "EXPLORAR" de 140 × 40 e pontos do carrossel | Cartão de 190 px de altura, raio 12, gradiente `Primary` de 20% a 10%, duas imagens (138 e 58 px) e "EXPLORAR →" em `Text/Accent` |
| Filtros | Sidebar de 310 px em `Surface Card` com padding 20: Coleções, Faixa de preço (slider de trilho 4 px e pontos de 15 px, botão "Aplicar" de 92 px) e Rede | Botão de 45 × 45 com raio 14 e gradiente `Primary`, ao lado da busca de 45 px com raio 10; abre um menu lateral de 320 px |
| NFT em destaque | 310 × 470 abaixo dos filtros: "NFT EM DESTAQUE" (24 px, `Text/Accent`), "OFERTA LIMITADA" (22 px) e imagem de 368 px com raio 22 | Não aparece (o Figma mobile não tem) |
| Grade | 3 colunas de 258 px com 32 px de espaço; card em `Surface Card` de 258 × 300 com imagem de raio 15 | 2 colunas com 16 px, a da direita 32 px mais baixa; card em gradiente com raio 20 e imagem de raio 16 |
| Abas e ordenação | Abas de 15 px com sublinhado `Primary` de 2 px; "Ordenar por:" à direita | Abas de 14 px; ordenação dentro do menu de filtros |
| Paginação | Quadrados de 35 px alinhados à direita, página atual em `Primary` | Igual |
| Promoções | 2 cartões de 586 × 250 com raio 8 | Empilhados |
| Diário da Cunhagem | 4 cartões com imagem de 195 px | 1 coluna (2 a partir de 640 px) |

O selo de raridade ("RARO", "LENDÁRIO") aparece em `Primary` no canto do card; NFTs comuns não têm selo. NFT esgotado mostra o preço em `Secondary` com "ESGOTADO".

### Detalhe do NFT (Passo 6)

| Bloco | Desktop | Mobile |
| --- | --- | --- |
| Trilha | "Início / Mercado / nome do NFT" (15/700); "Mercado" destacado no header | Não há (botão de voltar sobre a imagem) |
| Galeria | Miniaturas de 100 px (raio 8, borda `Primary` na ativa) em coluna e imagem de 444 px em `Surface Card` com padding 16 e imagem de raio 24 | Imagem na largura da tela, raio 24, pontos de 7 px (o ativo com 28 px); voltar e coração em círculos de 35 px (`Surface Raised`, borda `Border`) |
| Título e preço | Nome 28/700, preço 22/700 `Text/Accent`, 5 estrelas de 15 px (`Primary` cheias, `Text/Secondary` vazias) e "N avaliações de colecionadores" | Nome 20/700 e pílula da nota (borda `Primary`, "4,8 (19)") |
| Edição | Pílulas de 28 px, borda `Border`; escolhida com borda `Primary` e texto `Text/Accent`; esgotada ou indisponível riscada com 50% de opacidade | Igual |
| Quantidade | Botões `Primary` de 33 × 50 (raio cheio) com o número 20 px no meio | Na barra de compra: "Qtd." e botões de 20 × 30 |
| Ações | "COMPRAR" 130 × 40 `Primary` e "Favoritar" 130 × 40 com borda `Primary` | Barra de compra em `Surface Card` (raio 28 em cima): "Comprar NFT" em pílula de 60 px com gradiente `Primary` e botão do carrinho de 60 px |
| Informações | "ID do token", "Coleção", "Atributos" em 15/400 `Secondary`; "Compartilhar este NFT:" com LinkedIn, copiar link e X | Igual |
| Abas | "Detalhes do NFT" 17/700 `Text/Accent` com traço de 3 px; "Avaliações de colecionadores (N)" 17/400; linha `Primary` 30% | Abas de 15 px, roláveis |
| Mais desta coleção | Título 17/700 `Text/Accent` com linha, 5 cards em linha | Cards de 175 px em rolagem horizontal |

O botão central da barra inferior usa o ícone de leitura (scan) do Figma, que não tem função definida no escopo. Ele abre o menu lateral, para que a navegação principal fique acessível no mobile.

## Contraste

Razão de contraste WCAG de cada cor de texto sobre cada superfície. O mínimo AA é 4,5:1 para texto normal e 3:1 para texto grande e componentes de interface.

| Texto \ fundo | Ink | Surface Card | Surface Raised | Surface Dark |
| --- | ---: | ---: | ---: | ---: |
| Foreground | 17,10 | 15,57 | 14,28 | 13,29 |
| Text/Secondary | 9,53 | 8,68 | 7,95 | 7,41 |
| Text/Accent | 8,47 | 7,72 | 7,08 | 6,59 |
| Amber | 8,87 | 8,08 | 7,41 | 6,90 |
| Text/Coral | 7,29 | 6,64 | 6,09 | 5,67 |
| Primary | 6,85 | 6,24 | 5,72 | 5,33 |
| Secondary | 6,72 | 6,12 | 5,61 | 5,22 |
| Success | 6,11 | 5,57 | 5,10 | 4,75 |
| **Error** | **4,39** | **4,00** | **3,67** | **3,42** |

`Ink` sobre `Primary` (texto dos botões) dá 6,85:1.

Dois pontos não passam. Os ajustes foram aplicados no Passo 1 e estão registrados como desvio em [ARCHITECTURE.md](../ARCHITECTURE.md):

1. **Texto de erro.** `Color/Error` (`#ed1b2e`) fica abaixo de 4,5:1 em todas as superfícies. Aplicado: `#ed1b2e` continua em ícones e bordas de erro (`--destructive`), e o texto da mensagem usa `#ff5c66` (`--destructive-foreground`: 6,39:1 sobre Ink, 5,82:1 sobre Surface Card, 4,97:1 sobre Surface Dark).
2. **Borda dos campos.** `Color/Border` (`#3f2319`) tem 1,34:1 sobre o fundo, e o critério 1.4.11 da WCAG pede 3:1 para identificar um campo. Aplicado: borda dos inputs em `#8a5c40` (`--input`: 3,38:1 sobre Ink, 3,08:1 sobre Surface Card). `Color/Border` continua nos cards e divisórias, que são decorativos.

## Inconsistências do arquivo

Diferenças que o código vai normalizar. A decisão final de cada uma fica em [ARCHITECTURE.md](../ARCHITECTURE.md).

- Botões primários com cinco alturas (35, 36, 40, 45 e 48 px) e três raios (3, 5 e 6 px). Aplicado no `Button`: tamanhos `sm` 36 px, `default` 40 px e `lg` 48 px, raio de 5 px (`rounded-control`). Onde o Figma pede outra medida, a tela passa a classe (o "Entrar" do header usa 35 px e raio de 6 px).
- Campos com raio de 5 px no login e no cadastro e de 3 px no perfil e no cupom. Aplicado no `Input`: 5 px em todos.
- Vários estilos de texto têm altura de linha menor que o tamanho da fonte (por exemplo 18 px com 16 px de altura), o que corta acentos e descendentes quando o texto quebra. No código a altura mínima é o tamanho da fonte.
- `Text/Primary` (`#f7f3ec`) e `Color/Foreground` (`#f5f1eb`) são quase iguais. O código usa só `Foreground`.
- `Color/Border` aparece aplicado também com `#2f1d15` e `#241612` em 6 elementos, o que indica estilo desvinculado. O código usa sempre `#3f2319`.

## Estados não desenhados

Estados que o Figma não mostra (vazio, erro, carregando, pendente, preço alterado, esgotado, hover, foco, desabilitado) usam os tokens acima:

- hover do primário: `Primary Light`; pressionado: `Primary Dark`;
- foco: anel de 2 px `Primary` com afastamento de 2 px sobre `Ink`;
- desabilitado: opacidade de 50% e cursor bloqueado;
- aviso de preço alterado: texto e ícone `Amber` sobre `Surface Dark`;
- esgotado: badge `Surface Raised` com texto `Text/Secondary`.

Cada decisão nova fica registrada em [ARCHITECTURE.md](../ARCHITECTURE.md), na seção de decisões de UX.

## Skeletons

- Mesmas dimensões do conteúdo final, para não deslocar o layout.
- Base `Surface Card` com faixa de brilho em `Surface Raised`, animada em CSS.
- Animação desligada com `prefers-reduced-motion: reduce`.
- Usados no catálogo, nos destaques, no detalhe, no resumo do carrinho e no perfil.
- Catálogo (Passo 5): `NftCardSkeleton` com as proporções do card (175/200 no mobile, 258/300 no desktop), 9 por página, e contagens dos filtros em skeleton até as facetas chegarem.

## Assets

- Imagens dos NFTs, banners, ícones Iconly e logos exportados do Figma no Passo 1, para `public/` ou `src/assets`.
- Imagens em WebP ou AVIF com largura e altura declaradas.
- Qualquer substituição de asset é registrada em [ARCHITECTURE.md](../ARCHITECTURE.md).
