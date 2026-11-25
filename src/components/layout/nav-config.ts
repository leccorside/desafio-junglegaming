/**
 * Itens de navegação do layout. `href` ausente indica área fora do escopo do
 * desafio (páginas editoriais, suporte, atividade): o item aparece, mas não
 * finge funcionar (ver README-DESAFIO.md, seção 3).
 *
 * Os destinos usam `<a href>` enquanto as rotas não existem. No Passo 4 eles
 * passam para `<Link>` tipado do TanStack Router.
 */
export interface NavItem {
  label: string
  href?: string
}

export const mainNav: NavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Mercado', href: '/#catalogo' },
  { label: 'Criadores' },
  { label: 'Aprenda' },
]

export interface FooterColumn {
  title: string
  links: NavItem[]
}

export const footerColumns: FooterColumn[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', href: '/profile' },
      { label: 'Minha coleção' },
      { label: 'Atividade' },
      { label: 'Estúdio do criador' },
      { label: 'Lista de interesse' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda' },
      { label: 'Como comprar NFTs' },
      { label: 'Carteira e segurança' },
      { label: 'Política do mercado' },
      { label: 'Denunciar item' },
    ],
  },
  {
    title: 'Coleções',
    // Viram filtros de categoria do catálogo no Passo 5.
    links: [
      { label: 'Arte digital' },
      { label: 'Fotografia' },
      { label: 'Música' },
      { label: 'Arte 3D' },
      { label: 'Utilidade' },
    ],
  },
]

export const footerFeatures = [
  {
    mark: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    mark: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    mark: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
] as const

export const socialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/' },
  { label: 'Instagram', href: 'https://www.instagram.com/' },
  { label: 'Twitter', href: 'https://x.com/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  { label: 'YouTube', href: 'https://www.youtube.com/' },
] as const
