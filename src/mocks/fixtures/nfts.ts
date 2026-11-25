import type { EditionStatus, Network, Nft, NftCategory, NftEdition, Rarity } from '@/api/contracts'
import { ethMin, ethPercent, ethRound, toEthString } from '@/lib/eth'

import { FIXTURE_NOW } from '../config'
import { createRandom, type Random } from '../random'

/**
 * Catálogo das fixtures: 60 NFTs gerados com semente fixa. Os 10 primeiros são
 * os do Figma, com os mesmos nomes e preços. Alguns têm estados fixos usados
 * nos testes (ver SPECIAL_NFTS).
 */

const IMAGES = [1, 2, 3, 4].map((n) => `/images/nfts/nft-0${n}-960.webp`)

const FIGMA_NFTS: { token: string; name: string; price: string; category: NftCategory }[] = [
  { token: '042', name: 'Emerald Ape', price: '1.19', category: 'digital-art' },
  { token: '118', name: 'Cosmic Bloom', price: '1.29', category: 'generative' },
  { token: '207', name: 'Golden Beat', price: '0.99', category: 'music' },
  { token: '009', name: 'Sage Nomad', price: '1.69', category: 'collectibles' },
  { token: '314', name: 'Violet Nomad', price: '1.39', category: 'collectibles' },
  { token: '071', name: 'Golden Frequency', price: '0.59', category: 'music' },
  { token: '552', name: 'Neon Vessel', price: '1.99', category: '3d-art' },
  { token: '088', name: 'Ivory Baron', price: '1.79', category: 'digital-art' },
  { token: '160', name: 'Golden Signal', price: '0.39', category: 'photography' },
  { token: '231', name: 'Amber Monarch', price: '2.29', category: 'digital-art' },
]

/** NFTs com estado fixo, referenciados pelos testes e pelos cenários. */
export const SPECIAL_NFTS = {
  /** Todas as edições disponíveis, estoque alto. */
  available: 'nft-042',
  /** Edição 1/1 esgotada e 1/10 indisponível. */
  partiallyUnavailable: 'nft-552',
  /** Todas as edições esgotadas. */
  soldOut: 'nft-610',
  /** Edição 1/10 com só 2 unidades. */
  lowStock: 'nft-088',
} as const

const ADJECTIVES = [
  'Amber',
  'Azure',
  'Crimson',
  'Silent',
  'Lunar',
  'Solar',
  'Velvet',
  'Copper',
  'Obsidian',
  'Coral',
  'Electric',
  'Hidden',
  'Rusty',
  'Pale',
  'Wild',
  'Quiet',
  'Saffron',
  'Indigo',
]
const NOUNS = [
  'Ape',
  'Bloom',
  'Beat',
  'Nomad',
  'Vessel',
  'Baron',
  'Signal',
  'Frequency',
  'Monarch',
  'Echo',
  'Orbit',
  'Garden',
  'Pilot',
  'Mirage',
  'Tide',
  'Relic',
  'Atlas',
  'Lantern',
]
const CATEGORIES: NftCategory[] = [
  'digital-art',
  'photography',
  'music',
  '3d-art',
  'collectibles',
  'generative',
  'gaming',
  'memberships',
  'utility',
]
const COLLECTIONS = [
  { id: 'col-kurio-apes', name: 'Kurio Apes' },
  { id: 'col-kurio-editions', name: 'Kurio Editions' },
  { id: 'col-cosmic-garden', name: 'Cosmic Garden' },
  { id: 'col-golden-sound', name: 'Golden Sound' },
  { id: 'col-nomad-society', name: 'Nomad Society' },
  { id: 'col-neon-vessels', name: 'Neon Vessels' },
]
const CREATORS = [
  { id: 'cr-nova-sato', name: 'Nova Sato' },
  { id: 'cr-ravi-okafor', name: 'Ravi Okafor' },
  { id: 'cr-lia-montenegro', name: 'Lia Montenegro' },
  { id: 'cr-theo-brandt', name: 'Theo Brandt' },
  { id: 'cr-mika-tanaka', name: 'Mika Tanaka' },
]
const ATTRIBUTES = [
  'Óculos',
  'Esmeralda',
  'Neon',
  'Dourado',
  'Holográfico',
  'Animado',
  'Áudio',
  'Raro',
  'Desbloqueável',
  'Edição de lançamento',
  'Pixel',
  'Aquarela',
]
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function pickNetwork(random: Random): Network {
  const roll = random.next()
  return roll < 0.45 ? 'ethereum' : roll < 0.7 ? 'polygon' : 'solana'
}

function pickRarity(random: Random): Rarity {
  const roll = random.next()
  return roll < 0.1 ? 'legendary' : roll < 0.4 ? 'rare' : 'common'
}

function contractAddress(network: Network, random: Random): string {
  if (network === 'solana') {
    return Array.from({ length: 44 }, () => random.pick(BASE58.split(''))).join('')
  }
  return `0x${random.hex(40)}`
}

/** Preço de cada edição a partir do preço base (o da edição aberta, o mais barato). */
function editionPrice(base: string, multiplier: number): string {
  return ethRound(ethPercent(base, multiplier * 100), 2)
}

function buildEditions(nftId: string, base: string, random: Random): NftEdition[] {
  const edition = (
    key: string,
    name: string,
    supply: number | null,
    price: string,
    available: number,
    status: EditionStatus = available > 0 ? 'available' : 'sold_out',
  ): NftEdition => ({ id: `${nftId}-${key}`, name, supply, price, available, status })

  return [
    edition('1-1', '1/1', 1, editionPrice(base, 10), random.next() < 0.6 ? 1 : 0),
    edition('1-10', '1/10', 10, editionPrice(base, 3), random.int(0, 10)),
    edition('1-50', '1/50', 50, editionPrice(base, 1.5), random.int(5, 50)),
    edition('open', 'Aberta', null, base, 999),
  ]
}

function applySpecialStates(nft: Nft): Nft {
  const set = (editionKey: string, patch: Partial<NftEdition>) => {
    const edition = nft.editions.find((e) => e.id === `${nft.id}-${editionKey}`)
    if (edition) Object.assign(edition, patch)
  }

  switch (nft.id) {
    case SPECIAL_NFTS.available:
      set('1-1', { available: 1, status: 'available' })
      set('1-10', { available: 8, status: 'available' })
      set('1-50', { available: 37, status: 'available' })
      break
    case SPECIAL_NFTS.partiallyUnavailable:
      set('1-1', { available: 0, status: 'sold_out' })
      set('1-10', { available: 0, status: 'unavailable' })
      break
    case SPECIAL_NFTS.soldOut:
      for (const edition of nft.editions)
        Object.assign(edition, { available: 0, status: 'sold_out' })
      break
    case SPECIAL_NFTS.lowStock:
      set('1-10', { available: 2, status: 'available' })
      break
  }
  return nft
}

/** Menor preço entre as edições disponíveis (ou entre todas, se nenhuma estiver). */
export function computePriceFrom(editions: NftEdition[]): string {
  const available = editions.filter((e) => e.status === 'available' && e.available > 0)
  const pool = available.length ? available : editions
  return pool.map((e) => e.price).reduce((min, price) => ethMin(min, price))
}

export function createNftFixtures(): Nft[] {
  const random = createRandom(20261120)
  const nfts: Nft[] = []
  const usedTokens = new Set(FIGMA_NFTS.map((n) => n.token))
  usedTokens.add('610')

  for (let i = 0; i < 60; i++) {
    const figma = FIGMA_NFTS[i]
    let token = figma?.token
    if (!token) {
      token = i === 10 ? '610' : String(random.int(100, 999))
      while (i !== 10 && usedTokens.has(token)) token = String(random.int(100, 999))
      usedTokens.add(token)
    }

    const name = figma?.name ?? `${random.pick(ADJECTIVES)} ${random.pick(NOUNS)}`
    const base = figma?.price ?? toEthString((random.int(2, 1230) / 100).toFixed(2))
    const id = `nft-${token}`
    const network = i === 0 ? 'ethereum' : pickNetwork(random)
    const collection = i === 0 ? COLLECTIONS[0]! : random.pick(COLLECTIONS)
    const creator = i === 0 ? CREATORS[0]! : random.pick(CREATORS)
    const category = figma?.category ?? random.pick(CATEGORIES)
    const imageCount = random.int(1, 3)
    const firstImage = i % IMAGES.length
    const fullName = `${name} #${token}`
    const editions = buildEditions(id, base, random)

    const nft: Nft = {
      id,
      tokenId: token.padStart(4, '0'),
      name: fullName,
      description:
        i === 0
          ? 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.'
          : `${fullName} é uma obra da coleção ${collection.name}, criada por ${creator.name}. Cada atributo fica registrado nos metadados do token.`,
      creator: { ...creator, avatarUrl: null },
      collection,
      category,
      network,
      rarity: i === 0 ? 'rare' : pickRarity(random),
      attributes:
        i === 0
          ? ['Óculos', 'Esmeralda', 'Raro']
          : Array.from(new Set([random.pick(ATTRIBUTES), random.pick(ATTRIBUTES)])),
      contract: {
        address: contractAddress(network, random),
        standard: network === 'solana' ? 'SPL' : 'ERC-721',
      },
      royaltyPercent: i === 0 ? 5 : random.int(2, 10),
      rating:
        i === 0
          ? { average: 4.8, count: 19 }
          : { average: random.int(30, 50) / 10, count: random.int(0, 60) },
      images: Array.from({ length: imageCount }, (_, k) => ({
        url: IMAGES[(firstImage + k) % IMAGES.length]!,
        alt: `Arte do NFT ${fullName}${k ? `, vista ${k + 1}` : ''}`,
        width: 960,
        height: 960,
      })),
      editions,
      priceFrom: base,
      // Os primeiros são os mais recentes: um a cada 36 horas antes da data de referência.
      listedAt: new Date(FIXTURE_NOW - i * 36 * 60 * 60 * 1000).toISOString(),
      version: 1,
      updatedAt: new Date(FIXTURE_NOW).toISOString(),
    }

    applySpecialStates(nft)
    nft.priceFrom = computePriceFrom(nft.editions)
    nfts.push(nft)
  }

  return nfts
}
