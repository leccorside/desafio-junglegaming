import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { errorMessage } from '@/api/errors'
import { FilterIcon, SearchIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { isTimeoutError } from '@/lib/query-client'
import { cn } from '@/lib/utils'

import { useNftList } from '../queries'
import { hasActiveFilters, toListParams, type CatalogSearch } from '../search'
import { useCatalogNavigation } from '../use-catalog-navigation'
import { CatalogFilters } from './catalog-filters'
import { CatalogPagination } from './catalog-pagination'
import { ActiveSearch, CatalogSort, CatalogTabs } from './catalog-toolbar'
import { FeaturedBanner } from './featured-banner'
import { NftCard, NftCardSkeleton } from './nft-card'

const SEARCH_DEBOUNCE_MS = 400

/** Campo "Explorar coleções" do mobile (frame "Search Bar"), com busca enquanto digita. */
function MobileSearchBar({
  search,
  onSearch,
  filters,
}: {
  search: CatalogSearch
  onSearch: (q: string | undefined) => void
  filters: React.ReactNode
}) {
  const [text, setText] = useState(search.q ?? '')
  const debounced = useDebouncedValue(text, SEARCH_DEBOUNCE_MS)
  const lastSent = useRef(search.q ?? '')

  // A URL manda (voltar/avançar, limpar busca): o campo acompanha, ajustado
  // durante a renderização. `lastSent` é atualizado no efeito abaixo.
  const urlQuery = search.q ?? ''
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setText(urlQuery)
  }
  useEffect(() => {
    lastSent.current = urlQuery
  }, [urlQuery])

  useEffect(() => {
    // Só depois de a digitação assentar: logo após a URL mudar o campo, o valor
    // atrasado ainda é o antigo e não pode voltar para a URL.
    if (debounced !== text) return
    const value = debounced.trim()
    if (value === lastSent.current) return
    lastSent.current = value
    onSearch(value || undefined)
  }, [debounced, text, onSearch])

  return (
    <div className="flex h-[45px] gap-2 lg:hidden">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          lastSent.current = text.trim()
          onSearch(text.trim() || undefined)
        }}
        // O anel de foco fica na caixa inteira (o campo não tem borda própria).
        className="flex flex-1 items-center gap-2 rounded-[10px] bg-card px-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring"
      >
        <SearchIcon size={20} className="shrink-0 text-secondary" />
        <label htmlFor="catalog-search" className="sr-only">
          Buscar NFTs
        </label>
        <input
          id="catalog-search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Explorar coleções"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-body-sm font-bold text-foreground placeholder:text-secondary focus-visible:outline-none"
        />
      </form>
      {filters}
    </div>
  )
}

const SLOW_SERVER_NOTICE = 'O servidor está demorando para responder. Ainda estamos tentando…'

function ResultsStatus({
  total,
  fetching,
  failed,
  slow,
}: {
  total: number | undefined
  fetching: boolean
  /** Falhou sem nada na tela: não pode continuar anunciando "Carregando". */
  failed: boolean
  /** Uma tentativa estourou o tempo e a nova tentativa está em andamento. */
  slow: boolean
}) {
  return (
    <p className="text-body-sm text-muted-foreground" role="status" aria-live="polite">
      {total === undefined ? (
        failed ? (
          'Não foi possível carregar os NFTs.'
        ) : slow ? (
          <span className="text-warning">{SLOW_SERVER_NOTICE}</span>
        ) : (
          'Carregando NFTs…'
        )
      ) : (
        `${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`
      )}
      {fetching && total !== undefined ? (
        <span className={cn('ml-2', slow ? 'text-warning' : 'text-accent-foreground')}>
          {slow ? SLOW_SERVER_NOTICE : 'Atualizando…'}
        </span>
      ) : null}
    </p>
  )
}

/**
 * Catálogo da tela inicial: busca, abas, filtros combináveis, ordenação e
 * paginação, todos na URL. Trata carregamento (skeleton), atualização em
 * segundo plano, resultado vazio e erro com nova tentativa.
 */
export function CatalogSection({ search }: { search: CatalogSearch }) {
  const params = toListParams(search)
  const query = useNftList(params)
  const { update, reset } = useCatalogNavigation()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const searchText = useCallback(
    (q: string | undefined) => void update({ q }, { replace: true }),
    [update],
  )

  const data = query.data
  const facets = data?.facets
  const showSkeleton = query.isPending
  const updating = query.isFetching && query.isPlaceholderData
  const filtered = hasActiveFilters(search)
  // Falhou e não há página anterior para mostrar (a nova tentativa volta a "pending").
  const failed = query.isError && !data
  // A tentativa anterior estourou o tempo e a nova ainda roda (o motivo zera a cada busca nova).
  const slow = query.isFetching && isTimeoutError(query.failureReason)

  const filtersButton = (
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          // O ponto coral só é visual: o nome acessível diz o mesmo.
          aria-label={filtered ? 'Filtros e ordenação (filtros aplicados)' : 'Filtros e ordenação'}
          className="relative flex size-[45px] shrink-0 cursor-pointer items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--primary-hover),var(--primary))] text-foreground"
        >
          <FilterIcon size={22} />
          {filtered ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-background bg-highlight"
            />
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] overflow-y-auto border-border bg-card">
        <SheetHeader>
          <SheetTitle className="text-title-sm">Filtros</SheetTitle>
          <SheetDescription className="sr-only">
            Coleções, faixa de preço, rede e ordenação do catálogo
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-10 px-4 pb-8">
          <CatalogSort value={search.sort} onChange={(sort) => update({ sort })} />
          <CatalogFilters search={search} facets={facets} onChange={update} unavailable={failed} />
          {filtered ? (
            <Button variant="secondary" onClick={() => reset()}>
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )

  return (
    <section
      id="catalogo"
      aria-labelledby="catalogo-titulo"
      className="flex scroll-mt-6 flex-col gap-6 lg:flex-row lg:gap-12"
    >
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>

      <aside aria-label="Filtros" className="hidden w-[310px] shrink-0 flex-col gap-6 lg:flex">
        <div className="bg-card p-5">
          <CatalogFilters search={search} facets={facets} onChange={update} unavailable={failed} />
        </div>
        <FeaturedBanner />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-8">
        <MobileSearchBar search={search} onSearch={searchText} filters={filtersButton} />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CatalogTabs search={search} />
          <CatalogSort
            value={search.sort}
            onChange={(sort) => update({ sort })}
            className="hidden md:flex"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ResultsStatus total={data?.total} fetching={updating} failed={failed} slow={slow} />
          {search.q ? (
            <ActiveSearch query={search.q} onClear={() => update({ q: undefined })} />
          ) : null}
        </div>

        {failed ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
          >
            <p className="text-body-lg font-bold text-foreground">
              Não foi possível carregar o catálogo.
            </p>
            <p className="text-body-sm text-destructive-foreground">{errorMessage(query.error)}</p>
            <Button onClick={() => void query.refetch()}>Tentar de novo</Button>
          </div>
        ) : showSkeleton ? (
          <ul
            className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-x-8 md:gap-y-10"
            aria-hidden="true"
          >
            {Array.from({ length: params.pageSize }, (_, i) => (
              <li key={i} className="max-md:even:mt-8">
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
            <p className="text-body-lg font-bold text-foreground">Nenhum NFT encontrado.</p>
            <p className="text-body-sm text-muted-foreground">
              {search.page > 1 && data.total > 0
                ? 'Esta página não existe mais para estes filtros.'
                : 'Tente outra busca ou remova alguns filtros.'}
            </p>
            {search.page > 1 && data.total > 0 ? (
              <Button asChild variant="secondary">
                <Link to="/" search={(prev: Partial<CatalogSearch>) => ({ ...prev, page: 1 })}>
                  Voltar à primeira página
                </Link>
              </Button>
            ) : filtered ? (
              <Button variant="secondary" onClick={() => reset()}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : data ? (
          <>
            {query.isError ? (
              <p role="alert" className="text-body-sm text-destructive-foreground">
                Não foi possível atualizar o catálogo.{' '}
                <button type="button" className="underline" onClick={() => void query.refetch()}>
                  Tentar de novo
                </button>
              </p>
            ) : null}
            <ul
              aria-busy={updating}
              className={cn(
                'grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 md:gap-x-8 md:gap-y-10',
                updating && 'opacity-60',
              )}
            >
              {data.items.map((nft, index) => (
                <li key={nft.id} className="max-md:even:mt-8">
                  <NftCard nft={nft} priority={index < 3} />
                </li>
              ))}
            </ul>
            <CatalogPagination page={data.page} totalPages={data.totalPages} />
          </>
        ) : (
          <Skeleton className="h-96" />
        )}
      </div>
    </section>
  )
}
