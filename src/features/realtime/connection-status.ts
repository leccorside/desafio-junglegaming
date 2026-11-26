import { useSyncExternalStore } from 'react'

/**
 * Situação do tempo real para a interface:
 * - `idle`: ainda conectando pela primeira vez (ou trocando de sessão), sem aviso;
 * - `online`: conectado e sincronizado (recebeu o `realtime.sync`);
 * - `offline`: a conexão caiu ou foi recusada; o Socket.IO está tentando de novo.
 */
export type RealtimeStatus = 'idle' | 'online' | 'offline'

let status: RealtimeStatus = 'idle'
const listeners = new Set<() => void>()

export function setRealtimeStatus(next: RealtimeStatus) {
  if (next === status) return
  status = next
  for (const listener of listeners) listener()
}

export function getRealtimeStatus(): RealtimeStatus {
  return status
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribe, getRealtimeStatus, getRealtimeStatus)
}
