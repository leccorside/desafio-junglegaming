import { Link } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import { useId } from 'react'

import { NFT_SORT_LABELS, nftSortSchema, type NftFeed, type NftSort } from '@/api/contracts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { CatalogSearch } from '../search'

const FEEDS: { value: NftFeed; label: string }[] = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

/**
 * Abas do catálogo (frame "Tabs"). São links: cada aba é um estado da URL,
 * então voltar/avançar e abrir em nova aba funcionam.
 */
export function CatalogTabs({ search }: { search: CatalogSearch }) {
  return (
    <nav aria-label="Vitrines do catálogo">
      <ul className="flex gap-4 md:gap-5">
        {FEEDS.map((feed) => {
          const active = search.feed === feed.value
          return (
            <li key={feed.value}>
              <Link
                to="/"
                search={(prev: Partial<CatalogSearch>) => ({ ...prev, feed: feed.value, page: 1 })}
                resetScroll={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative block pb-1.5 text-body-sm whitespace-nowrap md:text-body',
                  active
                    ? 'font-bold text-accent-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary md:font-medium'
                    : 'text-foreground hover:text-accent-foreground md:font-medium',
                )}
              >
                {feed.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** "Ordenar por: Listados recentemente" (frame "Sort"). */
export function CatalogSort({
  value,
  onChange,
  className,
}: {
  value: NftSort
  onChange: (sort: NftSort) => void
  className?: string
}) {
  const labelId = useId()
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span id={labelId} className="text-body whitespace-nowrap text-foreground">
        Ordenar por:
      </span>
      <Select value={value} onValueChange={(next) => onChange(nftSortSchema.parse(next))}>
        <SelectTrigger
          aria-labelledby={labelId}
          className="h-auto gap-2 border-none bg-transparent p-0 text-body text-foreground shadow-none hover:text-accent-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="border-border-soft bg-popover">
          {nftSortSchema.options.map((sort) => (
            <SelectItem key={sort} value={sort} className="text-body-sm">
              {NFT_SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Busca ativa, com botão para limpar. */
export function ActiveSearch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
      Resultados para <strong className="text-foreground">“{query}”</strong>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Limpar a busca por ${query}`}
        className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-accent hover:text-foreground"
      >
        <XIcon className="size-4" />
      </button>
    </p>
  )
}
