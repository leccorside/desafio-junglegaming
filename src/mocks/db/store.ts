import { createSeed, SCHEMA_VERSION } from '../fixtures'
import type { DbState } from './state'

/**
 * Banco da API simulada: estado em memória, persistido no localStorage para
 * sobreviver a refresh. Sem localStorage (Vitest em Node, modo privado), fica
 * só em memória. `resetDb` volta exatamente às fixtures.
 */

export const DB_STORAGE_KEY = 'kurio:mocks:db'

type Listener = (db: DbState) => void

let db: DbState | null = null
const listeners = new Set<Listener>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function load(): DbState {
  const raw = storage()?.getItem(DB_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed
    } catch {
      // JSON corrompido: volta às fixtures.
    }
  }
  return createSeed()
}

function persist(state: DbState) {
  try {
    storage()?.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Cota estourada ou storage bloqueado: segue em memória.
  }
}

/** Estado atual (somente leitura por convenção: alterações passam por `mutate`). */
export function getDb(): DbState {
  db ??= load()
  return db
}

/** Aplica uma alteração, persiste e avisa os interessados (socket simulado, Passo 8). */
export function mutate<T>(change: (state: DbState) => T): T {
  const state = getDb()
  const result = change(state)
  persist(state)
  for (const listener of listeners) listener(state)
  return result
}

/** Restaura as fixtures. */
export function resetDb(): DbState {
  db = createSeed()
  persist(db)
  for (const listener of listeners) listener(db)
  return db
}

export function onDbChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Próximo número de uma sequência (`order` → 3, 4...), para IDs determinísticos. */
export function nextId(state: DbState, sequence: string, prefix: string): string {
  const value = (state.counters[sequence] ?? 0) + 1
  state.counters[sequence] = value
  return `${prefix}-${String(value).padStart(4, '0')}`
}
