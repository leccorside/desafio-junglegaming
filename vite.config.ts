import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { preloadHints } from './build/preload-hints'

export default defineConfig(({ mode }) => ({
  plugins: [
    // O plugin do router precisa vir antes do plugin do React.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadHints(mode),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // O MSW só usa o tough-cookie para o cookie store dele; o pacote real traz
      // junto o tldts (lista de sufixos públicos), uns 50 KB gzip no caminho
      // crítico. Os testes unitários (vitest.config.ts) seguem com o real.
      {
        find: /^tough-cookie$/,
        replacement: fileURLToPath(new URL('./src/mocks/shims/tough-cookie.ts', import.meta.url)),
      },
    ],
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
}))
