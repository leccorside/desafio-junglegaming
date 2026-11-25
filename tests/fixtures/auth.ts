import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'Senha@123'

/** Preenche e envia o formulário de login (modal no desktop, tela cheia no mobile). */
export async function submitLogin(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Entra pela interface a partir de /login. */
export async function loginViaUi(page: Page, email: string) {
  await page.goto('/login')
  await submitLogin(page, email)
  await expect(page).not.toHaveURL(/\/login/)
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
