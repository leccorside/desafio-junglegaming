import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = !!process.env.CI

/**
 * Os testes rodam contra o build de produção (`vite preview`), com os mocks
 * ligados pelo modo `mocks`. Detalhes em docs/TESTING.md.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Uma baseline por sistema operacional: a renderização de fontes muda entre Windows e Linux.
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  // As baselines versionadas são do Windows (win32). Num checkout limpo em
  // Linux ou macOS, a primeira execução grava as do sistema em vez de falhar;
  // as seguintes comparam com elas. Na CI a baseline tem de existir.
  updateSnapshots: isCI ? 'none' : 'missing',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run build -- --mode mocks && npm run preview -- --mode mocks --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
})
