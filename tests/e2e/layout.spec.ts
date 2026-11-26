import { expect, test, type Page } from '@playwright/test'

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

test.describe('layout base', () => {
  test('não há rolagem horizontal', async ({ page }) => {
    await page.goto('/')
    expect(await horizontalOverflow(page)).toBe(0)
  })

  test('header no desktop e barra inferior no mobile', async ({ page }) => {
    await page.goto('/')

    const principal = page.getByRole('navigation', { name: 'Principal' })
    const inferior = page.getByRole('navigation', { name: 'Navegação inferior' })

    if (isMobile(page)) {
      await expect(principal).toBeHidden()
      await expect(inferior).toBeVisible()
      await expect(inferior.getByRole('link', { name: 'Início' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    } else {
      await expect(principal).toBeVisible()
      await expect(inferior).toBeHidden()
      await expect(principal.getByRole('link', { name: 'Início' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    }
  })

  test('o item ativo usa a cor de destaque e os inativos a cor de texto', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', {
      name: isMobile(page) ? 'Navegação inferior' : 'Principal',
    })
    // Text/Accent (#e89b55) no ativo. Inativo: Foreground (#f5f1eb) no header,
    // Text/Secondary (#cfb28c) na barra inferior.
    await expect(nav.getByRole('link', { name: 'Início' })).toHaveCSS('color', 'rgb(232, 155, 85)')
    const inactive = isMobile(page) ? 'Carrinho' : 'Mercado'
    await expect(nav.getByRole('link', { name: inactive })).toHaveCSS(
      'color',
      isMobile(page) ? 'rgb(207, 178, 140)' : 'rgb(245, 241, 235)',
    )
  })

  test('em /#catalogo só o Mercado fica ativo', async ({ page }) => {
    test.skip(isMobile(page), 'a navegação principal é do desktop')
    await page.goto('/#catalogo')
    const principal = page.getByRole('navigation', { name: 'Principal' })
    await expect(principal.getByRole('link', { name: 'Mercado' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(principal.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('itens fora do escopo não são links', async ({ page }) => {
    test.skip(isMobile(page), 'a navegação principal fica no menu lateral no mobile')
    await page.goto('/')

    const principal = page.getByRole('navigation', { name: 'Principal' })
    await expect(principal.getByRole('link', { name: 'Criadores' })).toHaveCount(0)
    await expect(principal.getByText('Criadores')).toHaveAttribute('aria-disabled', 'true')
  })

  test('footer com links e redes sociais indisponíveis (a Kurio não tem perfis)', async ({
    page,
  }) => {
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute(
      'href',
      '/profile',
    )
    await expect(footer.getByRole('link', { name: 'Minha coleção' })).toHaveCount(0)

    // Sem link para a página inicial genérica da rede (Passo 13).
    await expect(footer.getByRole('link', { name: /Instagram/ })).toHaveCount(0)
    await expect(
      footer.getByRole('button', { name: 'Instagram (indisponível nesta demonstração)' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  test('newsletter avisa que está indisponível, sem simular sucesso', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('E-mail para a newsletter').fill('ana@example.com')
    await page.getByRole('button', { name: 'Enviar' }).click()

    await expect(
      page.getByText('A newsletter não está disponível nesta demonstração.'),
    ).toBeVisible()
  })

  test('link para pular ao conteúdo leva o foco ao main', async ({ page }) => {
    test.skip(isMobile(page), 'navegação por teclado físico')
    await page.goto('/')
    // A aplicação monta depois que o MSW inicia: espera o conteúdo antes do Tab.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#conteudo')).toBeFocused()
  })
})

test.describe('menu lateral', () => {
  test('abre pelo botão central da barra inferior, prende e devolve o foco', async ({ page }) => {
    test.skip(!isMobile(page), 'só no mobile')
    await page.goto('/')

    const trigger = page
      .getByRole('navigation', { name: 'Navegação inferior' })
      .getByRole('button', { name: 'Abrir menu' })
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Mercado' })).toBeVisible()
    await expect(dialog.locator(':focus')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test.describe('tablet', () => {
    test.use({ viewport: { width: 768, height: 1024 } })

    test('header compacto com menu lateral e sem rolagem horizontal', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden()
      await page.getByRole('banner').getByRole('button', { name: 'Abrir menu' }).click()
      await expect(page.getByRole('dialog').getByRole('link', { name: 'Entrar' })).toBeVisible()
      await page.keyboard.press('Escape')
      expect(await horizontalOverflow(page)).toBe(0)
    })
  })
})

test.describe('página não encontrada', () => {
  test('rota inexistente mostra o 404 do projeto', async ({ page }) => {
    await page.goto('/rota-que-nao-existe')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL('/')
  })
})
