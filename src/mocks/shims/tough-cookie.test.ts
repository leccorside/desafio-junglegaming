import * as real from 'tough-cookie'
import { describe, expect, it } from 'vitest'

import { Cookie, CookieJar, MemoryCookieStore } from './tough-cookie'

const ORIGIN = 'http://localhost:4173'

/** Cookies que cada implementação devolve para a URL, como `chave=valor`. */
async function compare(setCookies: [string, string][], reads: string[]) {
  const shim = new CookieJar(new MemoryCookieStore())
  const original = new real.CookieJar(new real.MemoryCookieStore())
  for (const [header, url] of setCookies) {
    await shim.setCookie(header, url)
    await original.setCookie(header, url, { ignoreError: true })
  }
  return reads.map((url) => ({
    url,
    shim: shim.getCookiesSync(url).map(String).sort(),
    real: original
      .getCookiesSync(url)
      .map((cookie) => cookie.cookieString())
      .sort(),
  }))
}

describe('stub do tough-cookie usado pelo MSW no navegador', () => {
  it('devolve os mesmos cookies que o tough-cookie real nos casos de uma API na mesma origem', async () => {
    const results = await compare(
      [
        ['sessao=abc; Path=/', `${ORIGIN}/api/auth/login`],
        ['tema=escuro', `${ORIGIN}/api/me/profile`],
        ['carrinho=1; Path=/api/cart', `${ORIGIN}/api/cart`],
        ['vencido=x; Max-Age=0', `${ORIGIN}/api/x`],
        ['passado=x; Expires=Thu, 01 Jan 2015 00:00:00 GMT', `${ORIGIN}/api/x`],
        ['seguro=1; Secure; Path=/', `${ORIGIN}/api/x`],
        ['outro=1; Domain=exemplo.com', `${ORIGIN}/api/x`],
        ['sessao=def; Path=/', `${ORIGIN}/api/auth/login`],
      ],
      [
        `${ORIGIN}/api/nfts`,
        `${ORIGIN}/api/me/settings`,
        `${ORIGIN}/api/cart`,
        `${ORIGIN}/api/cart/items`,
        `${ORIGIN}/api/carts`,
        'https://localhost:4173/api/nfts',
        'http://outro.host/api/nfts',
      ],
    )
    for (const { url, shim, real: expected } of results) expect(shim, url).toEqual(expected)
    // Conferência de que o caso foi exercitado de verdade.
    expect(results[0]!.shim).toEqual(['seguro=1', 'sessao=def'])
    expect(results[1]!.shim).toEqual(['seguro=1', 'sessao=def', 'tema=escuro'])
    expect(results[2]!.shim).toContain('carrinho=1')
  })

  it('cookie Secure só fora de localhost exige HTTPS', async () => {
    const results = await compare(
      [['seguro=1; Secure; Path=/', 'https://kurio.test/api']],
      ['https://kurio.test/api/nfts', 'http://kurio.test/api/nfts'],
    )
    for (const { url, shim, real: expected } of results) expect(shim, url).toEqual(expected)
    expect(results.map((r) => r.shim)).toEqual([['seguro=1'], []])
  })

  it('subdomínio: Domain vale para os subdomínios, cookie sem Domain só para o host', async () => {
    const results = await compare(
      [
        ['amplo=1; Domain=kurio.test; Path=/', 'https://app.kurio.test/api'],
        ['restrito=1; Path=/', 'https://app.kurio.test/api'],
      ],
      ['https://app.kurio.test/x', 'https://loja.app.kurio.test/x', 'https://kurio.test/x'],
    )
    for (const { url, shim, real: expected } of results) expect(shim, url).toEqual(expected)
  })

  it('lê o JSON gravado pelo tough-cookie real e grava no mesmo formato', async () => {
    const jar = new real.CookieJar()
    await jar.setCookie('legado=1; Path=/; Max-Age=3600', `${ORIGIN}/api`)
    const [saved] = jar.getCookiesSync(`${ORIGIN}/api`)
    const json = JSON.parse(JSON.stringify(saved!.toJSON()))

    const cookie = Cookie.fromJSON(json)!
    expect(cookie).not.toBeNull()
    expect(cookie.toString()).toBe('legado=1')
    expect(cookie.domain).toBe('localhost')
    expect(cookie.path).toBe('/')
    expect(cookie.expired()).toBe(false)

    // Ida e volta pelo formato do próprio stub, e leitura pelo tough-cookie real.
    const again = Cookie.fromJSON(JSON.parse(JSON.stringify(cookie.toJSON())))!
    expect(again.toJSON()).toEqual(cookie.toJSON())
    expect(real.Cookie.fromJSON(JSON.stringify(cookie.toJSON()))?.cookieString()).toBe('legado=1')

    expect(Cookie.fromJSON('não é json')).toBeNull()
    expect(Cookie.fromJSON({ value: 'sem chave' })).toBeNull()
  })

  it('usa o índice do MemoryCookieStore que o MSW preenche e persiste', async () => {
    const store = new MemoryCookieStore()
    store.idx = {
      localhost: {
        '/': { salvo: new Cookie({ key: 'salvo', value: 'sim', domain: 'localhost', path: '/' }) },
      },
    }
    const jar = new CookieJar(store)
    expect(jar.getCookiesSync(`${ORIGIN}/api/nfts`).map(String)).toEqual(['salvo=sim'])
    await jar.setCookie('novo=1; Path=/', `${ORIGIN}/api`)
    expect(Object.keys(store.idx.localhost!['/']!)).toEqual(['salvo', 'novo'])
  })
})
