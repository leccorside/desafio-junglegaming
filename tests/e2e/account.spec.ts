import { expect, test, type Page } from '@playwright/test'

import {
  PASSWORD,
  isMobileViewport,
  loginViaUi,
  logoutViaUi,
  storedSession,
  submitLogin,
} from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/**
 * Item 8 do enunciado: perfil, avatar, senha e carteiras, com erros de
 * validação (do cliente e da API) e persistência depois do refresh.
 */

/** PNG 1 × 1 válido. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const token = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

async function openAs(page: Page, email: string, path: '/profile' | '/wallets') {
  await loginViaUi(page, email)
  await page.goto(path)
  await waitForApp(page)
  await expect(
    page.getByRole('heading', {
      name: path === '/profile' ? 'Perfil do colecionador' : 'Carteira principal',
    }),
  ).toBeVisible()
}

const field = (page: Page, label: RegExp) => page.getByLabel(label)
const save = (page: Page) => page.getByRole('button', { name: 'Salvar', exact: true }).click()

test.describe('perfil e carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('edita o perfil, mostra no header e mantém depois do refresh', async ({ page }) => {
    await openAs(page, 'ana@example.com', '/profile')
    await expect(field(page, /^Nome de exibição/)).toHaveValue('Ana Ribeiro')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('readonly', '')

    await field(page, /^Nome de exibição/).fill('Ana R. Colecionadora')
    await field(page, /^Nome de usuário/).fill('ana.r')
    await field(page, /^Nome ENS/).fill('Ana-Arte')
    await save(page)
    await expect(page.getByText('Dados do perfil salvos.')).toBeVisible()
    // O nome da sessão muda na hora (header), sem nova busca.
    expect((await storedSession(page))?.user.displayName).toBe('Ana R. Colecionadora')
    if (!isMobileViewport(page)) {
      await expect(
        page.getByRole('button', { name: 'Conta de Ana R. Colecionadora' }),
      ).toBeVisible()
    }

    // Outra rota pública e volta: o nome não reverte (cache da sessão atualizado).
    await page
      .getByRole('link', { name: 'Carteiras', exact: true })
      .filter({ visible: true })
      .click()
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
    await page.reload()
    await waitForApp(page)
    expect((await storedSession(page))?.user.displayName).toBe('Ana R. Colecionadora')

    await page.goto('/profile')
    await expect(field(page, /^Nome de exibição/)).toHaveValue('Ana R. Colecionadora')
    await expect(field(page, /^Nome de usuário/)).toHaveValue('ana.r')
    // ENS em minúsculas, sem o ".eth".
    await expect(field(page, /^Nome ENS/)).toHaveValue('ana-arte')
    const api = (await apiFetch(page, 'GET', '/me/profile', { token: await token(page) })).json as {
      displayName: string
      ensName: string
    }
    expect(api).toMatchObject({ displayName: 'Ana R. Colecionadora', ensName: 'ana-arte' })
  })

  test('erros de validação: do cliente, nome de usuário em uso e cenário validation-error', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/profile')

    // Cliente: regras do contrato, antes de qualquer requisição.
    await field(page, /^Nome de exibição/).fill('A')
    await field(page, /^Nome ENS/).fill('x!')
    await save(page)
    await expect(page.getByText('Informe o nome de exibição.')).toBeVisible()
    await expect(page.getByText('Use de 3 a 63 letras, números ou hífen.')).toBeVisible()
    await expect(field(page, /^Nome de exibição/)).toBeFocused()
    await expect(field(page, /^Nome de exibição/)).toHaveAttribute('aria-invalid', 'true')

    // API: nome de usuário de outra conta, erro no próprio campo, que recebe o foco.
    await field(page, /^Nome de exibição/).fill('Ana Ribeiro')
    await field(page, /^Nome ENS/).fill('')
    await field(page, /^Nome de usuário/).fill('bruno.nft')
    await save(page)
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()
    await expect(field(page, /^Nome de usuário/)).toBeFocused()

    // Cenário validation-error: a API recusa o nome de exibição.
    await setScenario(page, ['validation-error'])
    await field(page, /^Nome de usuário/).fill('ana.colecionadora')
    await field(page, /^Nome de exibição/).fill('Ana Outra')
    await save(page)
    await expect(page.getByText('Este nome de exibição não é permitido.')).toBeVisible()

    // Nada foi salvo.
    const api = (await apiFetch(page, 'GET', '/me/profile', { token: await token(page) })).json as {
      displayName: string
      username: string
    }
    expect(api).toMatchObject({ displayName: 'Ana Ribeiro', username: 'ana.colecionadora' })
  })

  test('avatar: tipo e tamanho conferidos, prévia, envio, persistência e remoção', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/profile')
    const input = page.locator('[data-avatar-input]')

    await input.setInputFiles({
      name: 'nota.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('oi'),
    })
    await expect(
      page.getByRole('alert').filter({ hasText: 'Use uma imagem PNG, JPEG ou WebP.' }),
    ).toBeVisible()
    await input.setInputFiles({
      name: 'grande.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    })
    await expect(
      page.getByRole('alert').filter({ hasText: 'A imagem pode ter no máximo 2 MB.' }),
    ).toBeVisible()

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(page.getByRole('img', { name: 'Prévia do novo avatar' })).toBeVisible()
    await expect(page.getByText('Nova imagem escolhida: será enviada ao salvar.')).toBeVisible()
    // Só a prévia: ainda nada na API.
    let api = (await apiFetch(page, 'GET', '/me/profile', { token: await token(page) })).json as {
      avatarUrl: string | null
    }
    expect(api.avatarUrl).toBeNull()

    await save(page)
    await expect(page.getByText('Avatar atualizado.')).toBeVisible()
    expect((await storedSession(page)) as unknown as { user: { avatarUrl: string } }).toMatchObject(
      {
        user: { avatarUrl: expect.stringMatching(/^data:image\/png;base64,/) },
      },
    )

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('img', { name: 'Avatar atual' })).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    )

    await page.getByRole('button', { name: 'Remover avatar' }).click()
    await expect(page.getByText('O avatar será removido ao salvar.')).toBeVisible()
    await save(page)
    await expect(page.getByText('Avatar removido.')).toBeVisible()
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    expect(await page.getByRole('img', { name: 'Avatar atual' }).count()).toBe(0)
    api = (await apiFetch(page, 'GET', '/me/profile', { token: await token(page) })).json as {
      avatarUrl: string | null
    }
    expect(api.avatarUrl).toBeNull()
  })

  test('senha: confirmação, nova igual à atual, senha atual errada e troca que vale no login', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/profile')
    const current = field(page, /^Senha atual/)
    const next = field(page, /^Nova senha/)
    const confirm = field(page, /^Confirmar nova senha/)

    await current.fill(PASSWORD)
    await next.fill('Nova@Senha1')
    await confirm.fill('Outra@Senha1')
    await save(page)
    await expect(page.getByText('As senhas não conferem.')).toBeVisible()

    await next.fill(PASSWORD)
    await confirm.fill(PASSWORD)
    await save(page)
    await expect(page.getByText('A nova senha precisa ser diferente da atual.')).toBeVisible()

    // Senha atual errada: a API recusa no campo certo; os dados do perfil, que
    // vão antes no mesmo "Salvar", ficam salvos.
    await field(page, /^Nome de exibição/).fill('Ana Senha')
    await current.fill('Errada@123')
    await next.fill('Nova@Senha1')
    await confirm.fill('Nova@Senha1')
    await save(page)
    await expect(page.getByText('A senha atual está incorreta.')).toBeVisible()
    await expect(page.getByText('Dados do perfil salvos.')).toBeVisible()
    await expect(current).toBeFocused()

    await current.fill(PASSWORD)
    await save(page)
    await expect(page.getByText('Senha alterada.')).toBeVisible()
    await expect(current).toHaveValue('')
    await expect(next).toHaveValue('')

    await logoutViaUi(page)
    await page.goto('/login')
    await submitLogin(page, 'ana@example.com', PASSWORD)
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
    await submitLogin(page, 'ana@example.com', 'Nova@Senha1')
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('carteira principal: endereço conforme a rede, erro da API e persistência', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/wallets')
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await expect(primary.getByLabel(/^Apelido da carteira/)).toHaveValue('Carteira principal')
    await expect(primary.getByLabel(/^Rede/)).toHaveValue('ethereum')

    // Solana com endereço 0x: regra de endereço da rede escolhida.
    await primary.getByLabel(/^Apelido da carteira/).fill('')
    await primary.getByLabel(/^Rede/).selectOption('solana')
    await expect(primary.getByLabel(/^Endereço da carteira/)).toHaveAttribute(
      'placeholder',
      'Endereço Solana (base58)',
    )
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Informe um apelido.')).toBeVisible()
    await expect(
      primary.getByText('Use um endereço Solana em base58, com 32 a 44 caracteres.'),
    ).toBeVisible()

    // Erro da API (cenário validation-error) no campo do endereço.
    await primary.getByLabel(/^Apelido da carteira/).fill('Phantom')
    await primary
      .getByLabel(/^Endereço da carteira/)
      .fill('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin')
    await setScenario(page, ['validation-error'])
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Este endereço não pôde ser verificado na rede.')).toBeVisible()

    await setScenario(page, [])
    await primary.getByLabel(/^Tipo de carteira/).selectOption('walletconnect')
    await primary.getByLabel(/^Nome ENS/).fill('')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.')).toBeVisible()

    await page.reload()
    await waitForApp(page)
    const reloaded = page.getByRole('form', { name: 'Carteira principal' })
    await expect(reloaded.getByLabel(/^Apelido da carteira/)).toHaveValue('Phantom')
    await expect(reloaded.getByLabel(/^Rede/)).toHaveValue('solana')
    await expect(reloaded.getByLabel(/^Tipo de carteira/)).toHaveValue('walletconnect')
    const wallets = (await apiFetch(page, 'GET', '/me/wallets', { token: await token(page) }))
      .json as { items: { role: string; network: string; ensName: string | null }[] }
    expect(wallets.items.find((w) => w.role === 'primary')).toMatchObject({
      network: 'solana',
      ensName: null,
    })
  })

  test('carteira secundária: campos obrigatórios, "Igual à carteira principal" e persistência', async ({
    page,
  }) => {
    await openAs(page, 'bruno@example.com', '/wallets')
    await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar carteira secundária' }).click()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(secondary.getByLabel(/^Apelido da carteira/)).toBeFocused()
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    for (const message of [
      'Informe um apelido.',
      'Selecione uma rede.',
      'Selecione uma carteira.',
      'Informe o endereço da carteira.',
    ]) {
      await expect(secondary.getByText(message)).toBeVisible()
    }
    await secondary.getByRole('button', { name: 'Cancelar' }).click()
    await expect(secondary).toHaveCount(0)

    await page.getByLabel('Igual à carteira principal').check()
    const copy = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(copy.getByLabel(/^Apelido da carteira/)).toHaveValue(
      'Phantom via WalletConnect (secundária)',
    )
    await expect(copy.getByLabel(/^Rede/)).toHaveValue('solana')
    await expect(copy.getByLabel(/^Endereço da carteira/)).toHaveValue(
      '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    )
    await copy.getByLabel(/^Apelido da carteira/).fill('Reserva Solana')
    await copy.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()
    await expect(copy).toHaveCount(0)
    await expect(page.getByText('Reserva Solana')).toBeVisible()

    await page.reload()
    await waitForApp(page)
    await expect(page.getByText('Reserva Solana')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Editar carteira secundária' })).toBeVisible()
    const wallets = (await apiFetch(page, 'GET', '/me/wallets', { token: await token(page) }))
      .json as { items: { role: string; label: string }[] }
    expect(wallets.items.map((w) => [w.role, w.label])).toEqual([
      ['primary', 'Phantom via WalletConnect'],
      ['secondary', 'Reserva Solana'],
    ])
  })

  test('cada conta vê só os próprios dados depois da troca', async ({ page }) => {
    await openAs(page, 'ana@example.com', '/profile')
    await expect(field(page, /^Nome de exibição/)).toHaveValue('Ana Ribeiro')
    await logoutViaUi(page)

    await openAs(page, 'bruno@example.com', '/profile')
    await expect(field(page, /^Nome de exibição/)).toHaveValue('Bruno Lima')
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('bruno@example.com')
    await page.goto('/wallets')
    await expect(
      page.getByRole('form', { name: 'Carteira principal' }).getByLabel(/^Apelido da carteira/),
    ).toHaveValue('Phantom via WalletConnect')
    await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()
  })

  test('menu da conta: seção atual, itens fora do escopo e layout sem rolagem lateral', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/profile')
    const nav = page.getByRole('navigation', { name: 'Minha conta' }).filter({ visible: true })
    await expect(nav.getByRole('link', { name: 'Dados do perfil' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    if (isMobileViewport(page)) {
      // Sem frame no Figma: abas das seções no topo e uma coluna.
      await expect(nav.getByRole('link', { name: 'Carteiras' })).toBeVisible()
      expect(await nav.getByText('Atividade').count()).toBe(0)
      const [a, b] = [
        await field(page, /^Nome de exibição/).boundingBox(),
        await field(page, /^Nome de usuário/).boundingBox(),
      ]
      expect(b!.y).toBeGreaterThan(a!.y)
    } else {
      await expect(nav.getByText('Atividade')).toHaveAttribute('aria-disabled', 'true')
      await expect(nav.getByText('Suporte')).toContainText('indisponível nesta demonstração')
      const [a, b] = [
        await field(page, /^Nome de exibição/).boundingBox(),
        await field(page, /^Nome de usuário/).boundingBox(),
      ]
      expect(b!.y).toBe(a!.y)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    )

    await nav.getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL(/\/wallets$/)
    await expect(
      page
        .getByRole('navigation', { name: 'Minha conta' })
        .filter({ visible: true })
        .getByRole('link', { name: 'Carteiras' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    )

    if (!isMobileViewport(page)) {
      await nav.getByRole('button', { name: 'Sair' }).click()
      await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
      await expect(page).toHaveURL(/\/$/)
    }
  })
})

/** O retângulo de `a` cruza o de `b`? */
const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test.describe('perfil: avisos do avatar e foco nos erros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('recusa de arquivo diz o que continua valendo e some quando a imagem é salva', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/profile')
    const input = page.locator('[data-avatar-input]')
    const refusal = page.getByRole('alert').filter({ hasText: 'não foi usado' })

    // Sem avatar e sem escolha: só o motivo.
    await input.setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('oi'),
    })
    await expect(refusal).toHaveText('notas.txt não foi usado. Use uma imagem PNG, JPEG ou WebP.')

    // Com uma imagem escolhida: a recusa avisa que ela continua.
    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX })
    await expect(refusal).toHaveCount(0)
    await input.setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('oi'),
    })
    await expect(refusal).toHaveText(
      'notas.txt não foi usado. Use uma imagem PNG, JPEG ou WebP. A imagem escolhida antes continua.',
    )
    await expect(page.getByRole('img', { name: 'Prévia do novo avatar' })).toBeVisible()

    await save(page)
    await expect(page.getByText('Avatar atualizado.')).toBeVisible()
    // Salvo: o erro da recusa não vale mais.
    expect(await refusal.count()).toBe(0)
    await expect(page.getByText('PNG, JPEG ou WebP, até 2 MB.')).toBeVisible()

    // Com o avatar salvo: a recusa avisa que o atual continua.
    await input.setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('oi'),
    })
    await expect(refusal).toHaveText(
      'notas.txt não foi usado. Use uma imagem PNG, JPEG ou WebP. O avatar atual continua.',
    )
    await expect(page.getByRole('img', { name: 'Avatar atual' })).toBeVisible()
  })

  test('campo com erro fica no meio da tela, fora do toast (erro da API e do cliente)', async ({
    page,
  }) => {
    await openAs(page, 'ana@example.com', '/profile')
    const viewport = page.viewportSize()!
    const current = field(page, /^Senha atual/)

    // Erro da API depois de uma parte salva: toast de sucesso + foco no campo.
    await field(page, /^Nome de exibição/).fill('Ana Foco')
    await current.fill('Errada@123')
    await field(page, /^Nova senha/).fill('Nova@Senha1')
    await field(page, /^Confirmar nova senha/).fill('Nova@Senha1')
    await save(page)
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Dados do perfil salvos.' })
    await expect(toast).toBeVisible()
    await expect(page.getByText('A senha atual está incorreta.')).toBeVisible()
    await expect(current).toBeFocused()
    await expect
      .poll(async () => {
        const box = (await current.boundingBox())!
        return Math.abs(box.y + box.height / 2 - viewport.height / 2)
      })
      .toBeLessThan(viewport.height * 0.15)
    expect(overlaps((await current.boundingBox())!, (await toast.boundingBox())!)).toBe(false)

    // Erro do cliente: o campo também é centralizado.
    await page.evaluate(() => window.scrollTo(0, 0))
    await current.fill('Senha@123')
    await field(page, /^Confirmar nova senha/).fill('Outra@Senha1')
    await save(page)
    const confirm = field(page, /^Confirmar nova senha/)
    await expect(page.getByText('As senhas não conferem.')).toBeVisible()
    await expect(confirm).toBeFocused()
    await expect
      .poll(async () => {
        const box = (await confirm.boundingBox())!
        return Math.abs(box.y + box.height / 2 - viewport.height / 2)
      })
      .toBeLessThan(viewport.height * 0.15)
  })
})
