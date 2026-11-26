import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'
import { socketHandlers } from './socket/server'

// REST pelo service worker; o Socket.IO (WebSocket) é interceptado na própria página.
export const worker = setupWorker(...handlers, ...socketHandlers)
