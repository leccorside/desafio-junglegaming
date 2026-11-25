/**
 * Configuração lida das variáveis de ambiente do Vite.
 * O modo `mocks` (`npm run dev:mocks`) liga os mocks mesmo sem a variável.
 */
export const env = {
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === 'true' || import.meta.env.MODE === 'mocks',
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'ws://localhost/socket',
} as const
