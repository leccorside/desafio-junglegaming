import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'Senha@123'

/** Preenche e envia o formulário de login (modal no desktop, tela cheia no mobile). */
export async function submitLogin(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/**
 * Conta as requisições à API em andamento a partir de agora. `idle()` espera
 * não haver nenhuma por `quietMs`. Diferente de `waitForLoadState('networkidle')`,
 * que num app de página única retorna na hora (o estado já foi atingido no
 * carregamento do documento, e o login não recarrega a página).
 */
export function trackApi(page: Page) {
  const pending = new Set<unknown>()
  const isApi = (url: string) => new URL(url).pathname.startsWith('/api/')
  page.on('request', (r) => {
    if (isApi(r.url())) pending.add(r)
  })
  const done = (r: { url: () => string }) => pending.delete(r)
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  return {
    async idle(quietMs = 400, timeoutMs = 10_000) {
      const start = Date.now()
      let quietSince = Date.now()
      while (Date.now() - start < timeoutMs) {
        if (pending.size > 0) quietSince = Date.now()
        else if (Date.now() - quietSince >= quietMs) return
        await page.waitForTimeout(50)
      }
      throw new Error(`API ainda ocupada depois de ${timeoutMs} ms (${pending.size} em andamento)`)
    },
  }
}

/**
 * Entra pela interface a partir de /login. Espera as buscas que o login
 * dispara terminarem (merge do carrinho, carrinho e lista de interesse da
 * conta), para um cenário ativado logo depois (como `session-expired`) não
 * pegar uma busca ainda em andamento.
 */
export async function loginViaUi(page: Page, email: string) {
  await page.goto('/login')
  const api = trackApi(page)
  await submitLogin(page, email)
  await expect(page).not.toHaveURL(/\/login/)
  await api.idle()
}

/** Sessão salva no navegador (o que a aplicação usa para o token). */
export async function storedSession(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('kurio:session')
    return raw ? (JSON.parse(raw) as { user: { email: string; displayName: string } }) : null
  })
}

export const isMobileViewport = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

/** Sai da conta pelo menu do header (desktop) ou pelo menu lateral (mobile). */
export async function logoutViaUi(page: Page) {
  if (isMobileViewport(page)) {
    await page
      .getByRole('navigation', { name: 'Navegação inferior' })
      .getByRole('button', { name: 'Abrir menu' })
      .click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sair' }).click()
  } else {
    await page.getByRole('button', { name: /^Conta de / }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
  }
  await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
}

/**
 * Garante que o toast de expiração "de rota pública" não apareceu. O toast
 * surge alguns milissegundos depois do aviso do login, então espera esse
 * intervalo e confere uma vez só: um `toHaveCount(0)` repetiria a checagem
 * por 5 s e passaria quando o toast sumisse sozinho (o Sonner fecha em 4 s).
 */
export async function expectNoPublicExpiryToast(page: Page) {
  await page.waitForTimeout(1000)
  expect(await page.getByText('Entre de novo para ver seus dados.').count()).toBe(0)
}
