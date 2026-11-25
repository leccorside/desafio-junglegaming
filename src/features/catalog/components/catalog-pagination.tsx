import { Link } from '@tanstack/react-router'

import { ArrowLeftIcon, ArrowRightCircleIcon } from '@/components/icons/figma-icons'
import { cn } from '@/lib/utils'

import { pageWindow } from '../pagination'
import type { CatalogSearch } from '../search'

const boxClass =
  'flex size-[35px] items-center justify-center rounded-sm border text-lead leading-4 transition-colors'

/**
 * Paginação do Figma (frame "Pagination"): quadrados de 35 px, a página atual
 * em Primary. Cada página é um link (o estado vive na URL).
 */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null

  const to = (target: number) => ({
    to: '/' as const,
    search: (prev: Partial<CatalogSearch>) => ({ ...prev, page: target }),
    hash: 'catalogo',
    resetScroll: false,
  })

  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 ? (
          <li>
            <Link
              {...to(page - 1)}
              aria-label="Página anterior"
              className={cn(boxClass, 'border-border text-foreground hover:border-primary')}
            >
              <ArrowLeftIcon size={18} />
            </Link>
          </li>
        ) : null}
        {pageWindow(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                {...to(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  boxClass,
                  item === page
                    ? 'border-primary bg-primary font-bold text-primary-foreground'
                    : 'border-border text-foreground hover:border-primary',
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {page < totalPages ? (
          <li>
            <Link
              {...to(page + 1)}
              aria-label="Próxima página"
              className={cn(boxClass, 'border-border text-foreground hover:border-primary')}
            >
              <ArrowRightCircleIcon size={18} />
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
