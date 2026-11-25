import { expect, test } from '@playwright/test'

import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

test.describe('API simulada no navegador', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('o service worker responde a API com as fixtures', async ({ page }) => {
    const { status, json } = await apiFetch(page, 'GET', '/nfts')
    expect(status).toBe(200)
    expect((json as Json).total).toBe(60)
    expect((json as Json).items[0].name).toBe('Emerald Ape #042')
  })

  test('o estado sobrevive ao refresh e o reset volta às fixtures', async ({ page }) => {
    const login = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const token = (login.json as Json).token as string
    await apiFetch(page, 'PUT', '/me/favorites/nft-009', { token })

    await page.reload()
    await waitForApp(page)
    const after = await apiFetch(page, 'GET', '/me/favorites', { token })
    expect((after.json as Json).nftIds).toEqual(['nft-009', 'nft-042', 'nft-118'])

    await resetMocks(page)
    const relogin = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const reset = await apiFetch(page, 'GET', '/me/favorites', {
      token: (relogin.json as Json).token as string,
    })
    expect((reset.json as Json).nftIds).toEqual(['nft-042', 'nft-118'])
  })

  test('ativa cenário pela URL e mantém depois do refresh', async ({ page }) => {
    await page.goto('/?scenario=server-error&scenarioRoutes=/nfts')
    await waitForApp(page)
    expect((await apiFetch(page, 'GET', '/nfts')).status).toBe(503)
    expect((await apiFetch(page, 'GET', '/auth/session')).status).toBe(401)

    await page.goto('/')
    await waitForApp(page)
    expect((await apiFetch(page, 'GET', '/nfts')).status).toBe(503)
  })

  test('aplica latência variável com respostas fora de ordem', async ({ page }) => {
    await setScenario(page, ['jitter'], { seed: 3 })
    const order = await page.evaluate(async () => {
      const done: number[] = []
      await Promise.all(
        [1, 2, 3, 4, 5, 6].map((n) => fetch(`/api/nfts?page=${n}`).then(() => done.push(n))),
      )
      return done
    })
    expect(order).toHaveLength(6)
    expect(order).not.toEqual([1, 2, 3, 4, 5, 6])
  })

  test('o painel de cenários fica escondido em navegador automatizado', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Cenários de teste/ })).toHaveCount(0)
  })
})
