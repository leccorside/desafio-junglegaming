import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { SearchIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { searchTriggerClass } from './search-dialog'

/**
 * Busca do header (ícone de lupa). Abre um diálogo com o campo; enviar leva
 * ao catálogo com `?q=` e rola até ele. O foco volta à lupa ao fechar.
 * Carregada sob demanda por `SearchDialog`; `defaultOpen` monta já aberta.
 */
export function SearchDialogPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(defaultOpen)
  const [text, setText] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = text.trim() || undefined
    setOpen(false)
    void navigate({
      to: '/',
      search: (prev: Record<string, unknown>) => ({ ...prev, q, page: 1 }),
      hash: 'catalogo',
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setText('')
      }}
    >
      <DialogTrigger aria-label="Buscar NFTs" className={searchTriggerClass}>
        <SearchIcon size={20} />
      </DialogTrigger>
      <DialogContent className="top-24 translate-y-0 gap-4 border-border-soft bg-card sm:max-w-[560px]">
        <DialogTitle className="text-title-sm">Buscar NFTs</DialogTitle>
        <DialogDescription className="text-body-sm text-muted-foreground">
          Procure por nome, criador ou coleção.
        </DialogDescription>
        <form role="search" onSubmit={handleSubmit} className="flex gap-2">
          <label htmlFor="header-search" className="sr-only">
            Buscar NFTs
          </label>
          <input
            id="header-search"
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Explorar coleções"
            autoComplete="off"
            maxLength={80}
            className="h-11 min-w-0 flex-1 rounded-control bg-accent px-3 text-body-sm text-foreground placeholder:text-secondary focus-visible:outline-2 focus-visible:outline-primary"
          />
          <Button type="submit" className="h-11 px-5 font-bold">
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
