import type { LinkProps } from '@tanstack/react-router'

import { NFT_CATEGORY_LABELS, type NftCategory } from '@/api/contracts'

/**
 * Itens de navegação do layout. Sem `to`, o item é uma área fora do escopo do
 * desafio (páginas editoriais, suporte, atividade): aparece, mas não finge
 * funcionar (ver README-DESAFIO.md, seção 3).
 */
export interface NavItem {
  label: string
  to?: LinkProps['to']
  hash?: string
  /** Estado do catálogo na URL (links de Coleções do footer). */
  search?: { category?: NftCategory[] }
  /** Ativo só na rota exata (o Início não fica ativo em /nft/...). */
  exact?: boolean
}

export const mainNav: NavItem[] = [
  { label: 'Início', to: '/', exact: true },
  { label: 'Mercado', to: '/', hash: 'catalogo', exact: true },
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
      { label: 'Meu perfil', to: '/profile' },
      { label: 'Minha coleção' },
      { label: 'Atividade' },
      { label: 'Estúdio do criador' },
      { label: 'Lista de interesse', to: '/favorites' },
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
    // Abrem o catálogo filtrado pela categoria.
    links: (['digital-art', 'photography', 'music', '3d-art', 'utility'] as const).map(
      (category) => ({
        label: NFT_CATEGORY_LABELS[category],
        to: '/' as const,
        hash: 'catalogo',
        search: { category: [category] },
      }),
    ),
  },
]

/** Itens do menu da conta (header e menu lateral). */
export const accountNav: NavItem[] = [
  { label: 'Meu perfil', to: '/profile' },
  { label: 'Carteiras', to: '/wallets' },
  { label: 'Lista de interesse', to: '/favorites' },
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
