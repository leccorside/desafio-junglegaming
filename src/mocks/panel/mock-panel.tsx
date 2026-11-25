import { FlaskConicalIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Cenários de teste${activeCount ? ` (${activeCount} ativos)` : ''}`}
          className="fixed bottom-[140px] left-3 z-30 flex size-10 items-center justify-center rounded-full border border-border-soft bg-card text-muted-foreground opacity-80 shadow-md transition-opacity hover:opacity-100 md:bottom-4"
        >
          <FlaskConicalIcon className="size-5" />
          {activeCount ? (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-tiny font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto border-border bg-card">
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
