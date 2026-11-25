import { useId, useState } from 'react'

import {
  NETWORK_LABELS,
  networkSchema,
  NFT_CATEGORY_LABELS,
  nftCategorySchema,
  type NftFacets,
} from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { ethRound } from '@/lib/eth'
import { cn } from '@/lib/utils'

import { toggleValue, type CatalogSearch } from '../search'

interface CatalogFiltersProps {
  search: CatalogSearch
  facets: NftFacets | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  className?: string
}

/** "0,02" como no Figma ("Preço: 0,02 - 12,30 ETH"). */
const formatPrice = (value: number) => value.toFixed(2).replace('.', ',')

function FilterOption({
  label,
  count,
  selected,
  onToggle,
}: {
  label: string
  count: number | undefined
  selected: boolean
  onToggle: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className={cn(
          'flex h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 text-left text-body transition-colors hover:bg-accent',
          selected ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'size-3 rounded-xs border',
              selected ? 'border-primary bg-primary' : 'border-input',
            )}
          />
          {label}
        </span>
        {count === undefined ? (
          <Skeleton className="h-4 w-8" />
        ) : (
          <span className={cn(selected && 'font-bold')}>({count})</span>
        )}
      </button>
    </li>
  )
}

/**
 * Filtros do catálogo (frame "Filters" do Figma): Coleções, Faixa de preço e
 * Rede. Usado na sidebar (desktop) e no menu de filtros (mobile). Coleções e
 * redes se combinam; a faixa de preço só vale ao clicar em "Aplicar".
 */
export function CatalogFilters({ search, facets, onChange, className }: CatalogFiltersProps) {
  const priceId = useId()
  const min = facets ? Number(facets.priceRange.min) : 0
  const max = facets ? Number(facets.priceRange.max) : 0
  const fromUrl = (): [number, number] => [
    search.minPrice ? Number(search.minPrice) : min,
    search.maxPrice ? Number(search.maxPrice) : max,
  ]
  const [range, setRange] = useState<[number, number]>(fromUrl)

  // Acompanha a URL (voltar/avançar, limpar filtros) e a faixa vinda da API,
  // ajustando o estado durante a renderização (sem efeito em cascata).
  const source = `${search.minPrice}|${search.maxPrice}|${min}|${max}`
  const [lastSource, setLastSource] = useState(source)
  if (source !== lastSource) {
    setLastSource(source)
    setRange(fromUrl())
  }

  const applyPrice = () => {
    // O slider trabalha em número; o valor vai para a URL como string decimal.
    const [low, high] = range
    onChange({
      minPrice: low > min ? ethRound(String(low), 2) : undefined,
      maxPrice: high < max ? ethRound(String(high), 2) : undefined,
    })
  }

  const priceChanged =
    facets !== undefined && (range[0] !== fromUrl()[0] || range[1] !== fromUrl()[1])

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lead leading-4 font-bold text-foreground">Coleções</legend>
        <ul className="flex flex-col px-1">
          {nftCategorySchema.options.map((category) => (
            <FilterOption
              key={category}
              label={NFT_CATEGORY_LABELS[category]}
              count={facets?.categories[category]}
              selected={search.category?.includes(category) ?? false}
              onToggle={() => onChange({ category: toggleValue(search.category, category) })}
            />
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lead leading-4 font-bold text-foreground">
          Faixa de preço
        </legend>
        <div className="flex flex-col gap-3 pl-3">
          {facets ? (
            <Slider
              min={min}
              max={max}
              step={0.01}
              value={range}
              minStepsBetweenThumbs={1}
              onValueChange={(value) => setRange([value[0] ?? min, value[1] ?? max])}
              thumbLabels={['Preço mínimo', 'Preço máximo']}
              aria-describedby={priceId}
            />
          ) : (
            <Skeleton className="h-[21px] w-full" />
          )}
          <p id={priceId} className="text-body text-foreground" aria-live="polite">
            Preço: {facets ? `${formatPrice(range[0])} - ${formatPrice(range[1])}` : '…'} ETH
          </p>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={applyPrice} disabled={!priceChanged} className="w-[92px]">
              Aplicar
            </Button>
            {search.minPrice || search.maxPrice ? (
              <Button
                size="sm"
                variant="link"
                onClick={() => onChange({ minPrice: undefined, maxPrice: undefined })}
              >
                Limpar preço
              </Button>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lead leading-4 font-bold text-foreground">Rede</legend>
        <ul className="flex flex-col pl-1">
          {networkSchema.options.map((network) => (
            <FilterOption
              key={network}
              label={NETWORK_LABELS[network]}
              count={facets?.networks[network]}
              selected={search.network?.includes(network) ?? false}
              onToggle={() => onChange({ network: toggleValue(search.network, network) })}
            />
          ))}
        </ul>
      </fieldset>
    </div>
  )
}
