import { FlaskConicalIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import { resetDb } from '../db/store'
import {
  BUSINESS_SCENARIOS,
  getScenario,
  NETWORK_SCENARIOS,
  resetScenario,
  SCENARIO_DESCRIPTIONS,
  updateScenarioNames,
  type ScenarioName,
} from '../scenarios'
import { StockControl } from './stock-control'

/**
 * Painel de desenvolvimento dos mocks: escolhe cenários e restaura as fixtures.
 * Disponível no build de demonstração, para o avaliador reproduzir as falhas.
 * Escondido em navegador automatizado (Playwright), que usa as rotas /__mocks.
 */
export default function MockPanel() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ScenarioName[]>(() => getScenario().names)
  const baseId = useId()

  if (typeof navigator !== 'undefined' && navigator.webdriver) return null

  const toggle = (name: ScenarioName, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, name] : current.filter((item) => item !== name),
    )

  const apply = () => {
    // Mantém as opções em vigor (rotas, latência, semente), como as vindas da URL.
    updateScenarioNames(selected)
    window.location.reload()
  }

  const reset = () => {
    resetDb()
    resetScenario()
    try {
      // Limpa também a sessão e o carrinho guardados pelo cliente.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('kurio:') && !key.startsWith('kurio:mocks:'))
          localStorage.removeItem(key)
      }
      sessionStorage.clear()
    } catch {
      // Sem storage: o reload resolve.
    }
    window.location.assign('/')
  }

  const group = (title: string, names: readonly ScenarioName[]) => (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-body-sm font-bold text-foreground">{title}</legend>
      {names.map((name) => {
        const id = `${baseId}-${name}`
        return (
          <div key={name} className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={selected.includes(name)}
              onCheckedChange={(checked) => toggle(name, checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor={id} className="flex flex-col items-start gap-0.5 font-normal">
              <span className="font-mono text-caption text-accent-foreground">{name}</span>
              <span className="text-caption text-muted-foreground">
                {SCENARIO_DESCRIPTIONS[name]}
              </span>
            </Label>
          </div>
        )
      })}
    </fieldset>
  )

  const activeCount = getScenario().names.length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/*
        Com um diálogo aberto (a revisão da compra, por exemplo), o Radix marca o
        resto da página com aria-hidden e desliga os cliques fora dele. O
        aria-live="off" faz o botão escapar do aria-hidden (a biblioteca preserva
        regiões aria-live), e o data-dev-overlay impede que o clique feche o
        diálogo (ver DialogContent). O painel abre por cima e o diálogo continua.
      */}
      <div data-dev-overlay="" aria-live="off" className="contents">
        <SheetTrigger asChild>
          <button
            type="button"
            data-mock-panel-trigger=""
            aria-label={`Cenários de teste${activeCount ? ` (${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'})` : ''}`}
            className={cn(
              // Mobile: aba estreita colada à esquerda, na margem vazia da barra
              // inferior (antes do ícone Início). Ali não cobre conteúdo da página
              // em nenhuma posição de rolagem; z acima da barra (z-40) e abaixo
              // das camadas de diálogo (z-50), menus laterais inclusive.
              'pointer-events-auto fixed bottom-[calc(14px+env(safe-area-inset-bottom))] left-0 z-[45] flex h-10 w-6 items-center justify-center rounded-r-lg border border-l-0 border-border-soft bg-card text-muted-foreground opacity-90 shadow-md transition-opacity hover:opacity-100',
              // Com um diálogo central aberto (não os menus laterais), sobe acima do
              // véu escuro para continuar clicável. Fechado o painel, volta a z-45.
              !open && '[body:has([data-slot=dialog-content][data-state=open])_&]:z-[60]',
              // Tablet e desktop: sem barra inferior, botão redondo no canto.
              'md:bottom-4 md:left-3 md:size-10 md:rounded-full md:border-l md:opacity-80',
            )}
          >
            <FlaskConicalIcon className="size-4 md:size-5" />
            {activeCount ? (
              <span className="pointer-events-none absolute -top-2 right-[5px] flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground md:-top-1 md:-right-1 md:size-4 md:text-tiny">
                {activeCount}
              </span>
            ) : null}
          </button>
        </SheetTrigger>
      </div>
      <SheetContent
        side="left"
        data-dev-overlay=""
        className="w-80 overflow-y-auto border-border bg-card"
      >
        <SheetHeader>
          <SheetTitle>Cenários de teste</SheetTitle>
          <SheetDescription>
            Simulação da API (MSW). Os cenários ficam ativos até o reset. Também funcionam pela URL:
            <code className="ml-1 text-accent-foreground">?scenario=slow,payment-rejected</code>
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          {group('Rede', NETWORK_SCENARIOS)}
          {group('Negócio', BUSINESS_SCENARIOS)}
          {/* Vale na hora, sem o "Aplicar e recarregar" dos cenários. */}
          <StockControl />
        </div>
        <SheetFooter>
          <Button onClick={apply}>Aplicar e recarregar</Button>
          <Button variant="secondary" onClick={reset}>
            Restaurar dados iniciais
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
