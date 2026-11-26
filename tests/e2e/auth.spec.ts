import { expect, test } from '@playwright/test'

import {
  expectNoPublicExpiryToast,
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
    await expect(
      page.getByText(
        'A senha precisa de: pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo.',
      ),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/register/)
  })

  test('mostra de uma vez todas as regras que faltam na senha e no nome de usuário', async ({
    page,
  }) => {
    await page.goto('/register')
    const user = page.getByLabel('Nome de usuário')
    const password = page.getByLabel('Senha', { exact: true })
    await user.fill('a!')
    await page.getByLabel('E-mail', { exact: true }).fill('nova@example.com')
    await password.fill('abc')
    await page.getByLabel('Confirmar senha').fill('abc')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    // Uma mensagem por campo, com tudo o que falta, ligada ao campo.
    await expect(user).toHaveAccessibleDescription(
      'Use pelo menos 3 caracteres e só letras, números, ponto, hífen e sublinhado ("!" não vale).',
    )
    await expect(password).toHaveAccessibleDescription(
      'A senha precisa de: pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo.',
    )
    await expect(user).toBeFocused()

    // Corrigindo parte, a lista encolhe para o que ainda falta.
    await user.fill('ana maria')
    await password.fill('abcdefgh1')
    await page.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()
    await expect(user).toHaveAccessibleDescription(
      'Use só letras, números, ponto, hífen e sublinhado (espaço não vale).',
    )
    await expect(password).toHaveAccessibleDescription(
      'A senha precisa de: uma letra maiúscula e um símbolo.',
    )
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
    // Um aviso só: o do login. O toast é só para quem fica em rota pública.
    await expectNoPublicExpiryToast(page)

    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL('/wallets')
  })

  test('durante a navegação dentro da aplicação', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await setScenario(page, ['session-expired'])

    // Navegação pelo próprio app (sem recarregar): o link do footer.
    await page.getByRole('contentinfo').getByRole('link', { name: 'Lista de interesse' }).click()
    await expect(page).toHaveURL(/\/login\?.*redirect=%2Ffavorites.*reason=expired/)
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    await expectNoPublicExpiryToast(page)
  })

  test('passar o mouse num link privado não consulta nem expira a sessão', async ({ page }) => {
    test.skip(isMobileViewport(page), 'hover é do desktop')
    await loginViaUi(page, 'ana@example.com')
    await setScenario(page, ['session-expired'])

    const sessionCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/session')) sessionCalls.push(req.url())
    })
    await page.getByRole('contentinfo').getByRole('link', { name: 'Meu perfil' }).hover()
    await page.waitForTimeout(600)
    expect(sessionCalls).toEqual([])
    expect(await storedSession(page)).not.toBeNull()

    // O cenário continua guardado para o clique de verdade.
    await page.getByRole('contentinfo').getByRole('link', { name: 'Meu perfil' }).click()
    await expect(page).toHaveURL(/reason=expired/)
  })

  test('o aviso de expiração não volta depois de fechado', async ({ page }) => {
    test.skip(isMobileViewport(page), 'o modal é do desktop')
    await loginViaUi(page, 'ana@example.com')
    await setScenario(page, ['session-expired'])
    await page.goto('/wallets')
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()

    // Fecha o modal e segue como visitante; mais tarde tenta uma rota privada.
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Meu perfil' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile$/)
    await expect(page.getByRole('dialog', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toHaveCount(0)
  })
})

test.describe('logout e troca de usuário', () => {
  test('os toasts da conta anterior fecham no fim da sessão', async ({ page }) => {
    await page.goto('/login')
    await submitLogin(page, 'ana@example.com')
    const anaToast = page.getByText('Que bom ver você, Ana Ribeiro.')
    await expect(anaToast).toBeVisible()
    const shownAt = Date.now()

    await logoutViaUi(page)
    // Some logo depois do logout, e não pelo fechamento automático do Sonner (4 s).
    await expect(anaToast).toHaveCount(0, { timeout: 1000 })
    expect(Date.now() - shownAt).toBeLessThan(3500)

    await page.goto('/login')
    await submitLogin(page, 'bruno@example.com')
    await expect(page.getByText('Que bom ver você, Bruno Lima.')).toBeVisible()
    // Leitura única: nada da Ana em lugar nenhum da página do Bruno.
    expect(await page.evaluate(() => document.body.innerText.includes('Ana Ribeiro'))).toBe(false)
  })

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
