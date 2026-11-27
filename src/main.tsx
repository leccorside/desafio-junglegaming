import './index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { startTransition, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { queryClient } from '@/lib/query-client'
import { warmUpClassMerge } from '@/lib/utils'
import { enableMocking } from '@/mocks/enable'

import { router } from './router'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Elemento #root não encontrado')

// A primeira chamada do tailwind-merge monta a configuração dele (cerca de
// 40 ms com a CPU do Lighthouse mobile). Numa tarefa à parte, enquanto o MSW
// inicia, ela sai da primeira renderização, que é a maior tarefa da página.
window.setTimeout(warmUpClassMerge)

void enableMocking()
  // O router resolve a rota (beforeLoad, loaders e o chunk da tela) antes da
  // montagem. Sem isso, ele atualizava o próprio estado no meio da montagem, e
  // o React renderizava a página inteira de uma vez, de forma síncrona.
  .then(() => router.load())
  .then(() => {
    // Numa transição, o React monta a árvore em fatias pequenas e devolve a
    // thread ao navegador entre elas, sem uma tarefa longa só.
    const root = createRoot(rootElement)
    startTransition(() => {
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </StrictMode>,
      )
    })
  })
