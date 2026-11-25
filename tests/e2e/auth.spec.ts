import { expect, test } from '@playwright/test'

import {
  isMobileViewport,
  loginViaUi,
  logoutViaUi,
  PASSWORD,
  storedSession,
  submitLogin,
} from '../fixtures/auth'
import { resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForApp(page)
  await resetMocks(page)
  await page.evaluate(() => localStorage.removeItem('kurio:session'))
})

test.describe('cadastro', () => {
  test('cria a conta, entra e mantém a sessão depois do refresh', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nome de usuário').fill('carla.arte')
    await page.getByLabel('E-mail', { exact: true }).fill('carla@example.com')
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirmar senha').fill(PASSWORD)
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('Conta criada. Boas-vindas à Kurio!')).toBeVisible()
    expect((await storedSession(page))?.user.email).toBe('carla@example.com')

    await page.reload()
    await waitForApp(page)
    expect((await storedSession(page))?.user.email).toBe('carla@example.com')
    if (!isMobileViewport(page)) {
      await expect(page.getByRole('button', { name: 'Conta de carla.arte' })).toBeVisible()
    }
  })

  test('mostra o conflito de e-mail no campo', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nome de usuário').fill('ana.nova')
    await page.getByLabel('E-mail', { exact: true }).fill('ana@example.com')
    await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirmar senha').fill(PASSWORD)
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    await expect(page.getByText('Já existe uma conta com este e-mail.')).toBeVisible()
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused()
  })

  test('valida no cliente antes de enviar', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nome de usuário').fill('a')
    await page.getByLabel('E-mail', { exact: true }).fill('nao-e-email')
    await page.getByLabel('Senha', { exact: true }).fill('fraca')
    await page.getByLabel('Confirmar senha').fill('outra')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    await expect(page.getByText('Use pelo menos 3 caracteres.')).toBeVisible()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })
})

test.describe('login', () => {
  test('recusa credenciais erradas sem dizer qual campo', async ({ page }) => {
    await page.goto('/login')
    await submitLogin(page, 'ana@example.com', 'Errada@123')
    await expect(
      page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' }),
    ).toBeVisible()
  })

  test('rota privada leva ao login e volta para ela depois', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL('/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('ignora redirect para fora da aplicação', async ({ page }) => {
    await page.goto('/login?redirect=https://site-malicioso.example')
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL('/')
  })

  test('quem já entrou não vê mais a tela de login', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/login')
    await expect(page).toHaveURL('/')
  })

  test('modal no desktop com foco no e-mail e fechamento por Esc', async ({ page }) => {
    test.skip(isMobileViewport(page), 'no mobile o login é tela cheia')
    await page.goto('/login')
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('E-mail', { exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })

  test('tela cheia no mobile, sem barra inferior', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'só no mobile')
    await page.goto('/login')
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toHaveCount(0)
  })
})

test.describe('expiração da sessão', () => {
  test('ao abrir rota privada, leva ao login com aviso e retoma o destino', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await setScenario(page, ['session-expired'])

    await page.goto('/wallets')
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Fwallets.*reason=expired/)
    await expect(
      page.getByText('Sua sessão expirou. Entre de novo para continuar de onde parou.'),
    ).toBeVisible()
    expect(await storedSession(page)).toBeNull()

    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL('/wallets')
  })

  test('durante a navegação dentro da aplicação', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await setScenario(page, ['session-expired'])

    // Navegação pelo próprio app (sem recarregar): o link do footer.
    await page.getByRole('contentinfo').getByRole('link', { name: 'Lista de interesse' }).click()
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Ffavorites.*reason=expired/)
  })
})

test.describe('logout e troca de usuário', () => {
  test('sair limpa a sessão e entrar com outra conta não mostra a anterior', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    expect((await storedSession(page))?.user.displayName).toBe('Ana Ribeiro')

    await logoutViaUi(page)
    expect(await storedSession(page)).toBeNull()
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)

    await submitLogin(page, 'bruno@example.com')
    await expect(page).toHaveURL('/profile')
    expect((await storedSession(page))?.user.displayName).toBe('Bruno Lima')
    if (!isMobileViewport(page)) {
      await expect(page.getByRole('button', { name: 'Conta de Bruno Lima' })).toBeVisible()
      await expect(page.getByText('Ana Ribeiro')).toHaveCount(0)
    }
  })
})
