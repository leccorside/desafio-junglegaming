/**
 * Auditoria Lighthouse do protocolo de docs/PERFORMANCE.md.
 *
 * - Build de produção com os mocks (`npm run build -- --mode mocks`) servido
 *   pelo `vite preview`, no cenário padrão (o Lighthouse limpa o armazenamento
 *   a cada medição, então cada uma começa com o banco das fixtures e registra
 *   o service worker do MSW do zero, como numa primeira visita).
 * - Páginas: início e detalhe do Emerald Ape #042. Perfis: mobile (padrão do
 *   Lighthouse, throttling simulado) e desktop (preset desktop).
 * - Três medições por página e perfil; o resumo usa a mediana de cada
 *   categoria e de cada métrica. Os relatórios HTML e JSON salvos são os da
 *   medição mediana de Performance.
 *
 * Uso: `npm run lighthouse` (gera o build antes) ou
 * `node lighthouse/run.mjs --skip-build`.
 */
import { spawn } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPORTS = path.join(ROOT, 'lighthouse', 'reports')
const PORT = 4174
const BASE = `http://localhost:${PORT}`
const RUNS = 3
// Uma medição leva de 15 a 30 s; acima disso o Chrome travou (já aconteceu).
const AUDIT_TIMEOUT_MS = 120_000

const PAGES = [
  { key: 'inicio', label: 'Início', path: '/' },
  { key: 'detalhe', label: 'Detalhe', path: '/nft/nft-042' },
]
const PROFILES = [
  { key: 'mobile', label: 'Mobile', config: undefined },
  { key: 'desktop', label: 'Desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const METRICS = {
  lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbt: 'total-blocking-time',
  fcp: 'first-contentful-paint',
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: 'inherit', shell: true })
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} saiu com ${code}`)),
    )
  })
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['vite', 'preview', '--mode', 'mocks', '--port', String(PORT), '--strictPort'],
      { cwd: ROOT, shell: true },
    )
    const timer = setTimeout(() => reject(new Error('vite preview não subiu em 30 s')), 30_000)
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes(`localhost:${PORT}`)) {
        clearTimeout(timer)
        resolve(child)
      }
    })
    child.on('exit', (code) => reject(new Error(`vite preview saiu com ${code}`)))
  })
}

function stopPreview(child) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
  else child.kill('SIGTERM')
}

function summarize(lhr) {
  const scores = Object.fromEntries(
    CATEGORIES.map((id) => [id, Math.round(lhr.categories[id].score * 100)]),
  )
  const metrics = Object.fromEntries(
    Object.entries(METRICS).map(([key, audit]) => [key, lhr.audits[audit].numericValue]),
  )
  return { scores, metrics }
}

/**
 * Uma medição num Chrome novo: perfil limpo (sem IndexedDB nem cache de outra
 * medição) e sem herdar um navegador instável. Se a conexão com o Chrome cair
 * ou a medição passar de `AUDIT_TIMEOUT_MS` (as duas coisas aconteceram em
 * execuções longas), repete até duas vezes.
 */
async function audit(url, config) {
  for (let attempt = 1; ; attempt += 1) {
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless=new', '--disable-gpu'],
    })
    let timer
    try {
      const running = lighthouse(
        url,
        { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
        config,
      )
      // Abandonada no tempo limite: a rejeição tardia (Chrome fechado) não importa.
      running.catch(() => {})
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`sem resposta em ${AUDIT_TIMEOUT_MS / 1000} s`)),
          AUDIT_TIMEOUT_MS,
        )
      })
      const result = await Promise.race([running, timeout])
      if (!result) throw new Error('Lighthouse não devolveu resultado')
      return result
    } catch (error) {
      if (attempt >= 3) throw error
      console.warn(`Medição de ${url} falhou (${error.message}); nova tentativa.`)
    } finally {
      clearTimeout(timer)
      await chrome.kill()
    }
  }
}

async function main() {
  if (!process.argv.includes('--skip-build'))
    await run('npm', ['run', 'build', '--', '--mode', 'mocks'])

  await mkdir(REPORTS, { recursive: true })
  for (const file of await readdir(REPORTS)) {
    if (file !== '.gitkeep') await rm(path.join(REPORTS, file))
  }

  const preview = await startPreview()

  const results = []
  let environment = null
  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs = []
        for (let i = 1; i <= RUNS; i += 1) {
          const result = await audit(`${BASE}${page.path}`, profile.config)
          const summary = summarize(result.lhr)
          runs.push({ ...summary, report: result.report, lhr: result.lhr })
          environment ??= {
            lighthouse: result.lhr.lighthouseVersion,
            userAgent: result.lhr.environment.hostUserAgent,
            benchmarkIndex: result.lhr.environment.benchmarkIndex,
          }
          console.log(
            `${page.label} ${profile.label} #${i}: ${CATEGORIES.map((c) => summary.scores[c]).join(' / ')}`,
            `LCP ${Math.round(summary.metrics.lcp)} ms, CLS ${summary.metrics.cls.toFixed(3)}, TBT ${Math.round(summary.metrics.tbt)} ms`,
          )
        }

        // Relatório salvo: a medição com a Performance mediana.
        const byPerformance = [...runs].sort((a, b) => a.scores.performance - b.scores.performance)
        const chosen = byPerformance[Math.floor(byPerformance.length / 2)]
        const base = path.join(REPORTS, `${page.key}-${profile.key}`)
        await writeFile(`${base}.report.html`, chosen.report[0])
        await writeFile(`${base}.report.json`, chosen.report[1])

        results.push({
          page: page.label,
          path: page.path,
          profile: profile.label,
          median: {
            scores: Object.fromEntries(
              CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))]),
            ),
            metrics: Object.fromEntries(
              Object.keys(METRICS).map((m) => [m, median(runs.map((r) => r.metrics[m]))]),
            ),
          },
          runs: runs.map(({ scores, metrics }) => ({ scores, metrics })),
        })
      }
    }
  } finally {
    stopPreview(preview)
  }

  const summary = {
    date: new Date().toISOString(),
    environment: {
      ...environment,
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model.trim(),
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      runsPerPage: RUNS,
      build: 'npm run build -- --mode mocks + vite preview, cenário padrão dos mocks',
    },
    results,
  }
  await writeFile(path.join(REPORTS, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

  const rows = results.map(({ page, profile, median: m }) =>
    [
      page,
      profile,
      ...CATEGORIES.map((c) => m.scores[c]),
      `${(m.metrics.lcp / 1000).toFixed(2)} s`,
      m.metrics.cls.toFixed(3),
      `${Math.round(m.metrics.tbt)} ms`,
    ].join(' | '),
  )
  console.log(
    '\nMedianas\nPágina | Perfil | Perf | A11y | BP | SEO | LCP | CLS | TBT\n' + rows.join('\n'),
  )
}

// Fechar o Chrome ao fim de cada medição pode deixar uma chamada pendente do
// Puppeteer interno do Lighthouse rejeitar sem ninguém esperando por ela.
// Qualquer outra rejeição solta encerra a auditoria.
process.on('unhandledRejection', (error) => {
  if (/Target closed|Connection closed/i.test(String(error?.message ?? error))) {
    console.warn(`Aviso do Chrome já fechado: ${error.message}`)
    return
  }
  console.error(error)
  process.exit(1)
})

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
