/**
 * Substituto do `tough-cookie` no build do navegador (alias em `vite.config.ts`).
 *
 * O MSW 2.15 importa o `tough-cookie` só para o cookie store dele
 * (`msw/lib/core/utils/cookieStore.mjs`): guarda os cookies das respostas
 * simuladas (`Set-Cookie`) e os devolve nas requisições seguintes. O pacote
 * real traz junto o `tldts`, a lista de sufixos públicos da internet: cerca de
 * 300 KB de fonte e 50 KB gzip no caminho crítico, para regras (cookie de
 * domínio "co.uk", por exemplo) que uma API simulada na mesma origem nunca usa.
 *
 * Este módulo implementa só o que o MSW chama: `Cookie.fromJSON`/`toJSON`,
 * `MemoryCookieStore` (o índice `idx` que o MSW preenche e persiste no
 * `localStorage`) e `CookieJar.getCookiesSync`/`setCookie`. Mantém domínio,
 * caminho, validade e `Secure`; não valida sufixo público nem `SameSite`.
 * Lê também o formato JSON gravado pelo `tough-cookie` real, para quem já
 * tinha cookies salvos antes da troca.
 */

type CookieJson = {
  key?: unknown
  value?: unknown
  domain?: unknown
  path?: unknown
  expires?: unknown
  hostOnly?: unknown
  secure?: unknown
  httpOnly?: unknown
}

export class Cookie {
  key: string
  value: string
  domain: string | null
  path: string | null
  /** Instante de expiração em ms; `null` para cookie de sessão. */
  expires: number | null
  hostOnly: boolean
  secure: boolean
  httpOnly: boolean

  constructor(init: Partial<Cookie> & { key: string; value?: string }) {
    this.key = init.key
    this.value = init.value ?? ''
    this.domain = init.domain ?? null
    this.path = init.path ?? null
    this.expires = init.expires ?? null
    this.hostOnly = init.hostOnly ?? true
    this.secure = init.secure ?? false
    this.httpOnly = init.httpOnly ?? false
  }

  static fromJSON(input: unknown): Cookie | null {
    let json: CookieJson
    try {
      json = (typeof input === 'string' ? JSON.parse(input) : input) as CookieJson
    } catch {
      return null
    }
    if (!json || typeof json.key !== 'string') return null
    const expires =
      typeof json.expires === 'string' && json.expires !== 'Infinity'
        ? Date.parse(json.expires)
        : typeof json.expires === 'number'
          ? json.expires
          : null
    return new Cookie({
      key: json.key,
      value: typeof json.value === 'string' ? json.value : '',
      domain: typeof json.domain === 'string' ? json.domain : null,
      path: typeof json.path === 'string' ? json.path : null,
      expires: expires !== null && Number.isFinite(expires) ? expires : null,
      hostOnly: json.hostOnly !== false,
      secure: json.secure === true,
      httpOnly: json.httpOnly === true,
    })
  }

  /** Mesmos nomes de campo do `tough-cookie`, para o `localStorage` continuar legível pelos dois. */
  toJSON() {
    return {
      key: this.key,
      value: this.value,
      domain: this.domain,
      path: this.path,
      ...(this.expires === null ? {} : { expires: new Date(this.expires).toISOString() }),
      hostOnly: this.hostOnly,
      secure: this.secure,
      httpOnly: this.httpOnly,
    }
  }

  /** Par `chave=valor`, do jeito que vai no cabeçalho `Cookie`. */
  toString() {
    return `${this.key}=${this.value}`
  }

  expired(now = Date.now()) {
    return this.expires !== null && this.expires <= now
  }
}

/** `idx[domínio][caminho][chave]`, o formato que o MSW lê e grava. */
export type CookieIndex = Record<string, Record<string, Record<string, Cookie>>>

export class MemoryCookieStore {
  idx: CookieIndex = {}
}

/** Caminho padrão (RFC 6265, 5.1.4): o diretório do caminho da URL. */
function defaultPath(pathname: string) {
  if (!pathname.startsWith('/') || pathname === '/') return '/'
  const last = pathname.lastIndexOf('/')
  return last <= 0 ? '/' : pathname.slice(0, last)
}

/** HTTPS ou localhost: contexto seguro para cookie `Secure`, como no Chrome e no tough-cookie. */
function secureContext(url: URL) {
  if (url.protocol === 'https:' || url.protocol === 'wss:') return true
  const host = url.hostname.replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1'
  )
}

function domainMatches(host: string, cookie: Cookie) {
  if (!cookie.domain) return false
  if (host === cookie.domain) return true
  return !cookie.hostOnly && host.endsWith(`.${cookie.domain}`)
}

function pathMatches(pathname: string, cookiePath: string) {
  if (pathname === cookiePath) return true
  if (!pathname.startsWith(cookiePath)) return false
  return cookiePath.endsWith('/') || pathname[cookiePath.length] === '/'
}

/** Lê um cabeçalho `Set-Cookie` (um cookie) no contexto da URL que o recebeu. */
export function parseSetCookie(header: string, url: URL, now = Date.now()): Cookie | null {
  const [pair = '', ...attributes] = header.split(';')
  const separator = pair.indexOf('=')
  const key = (separator === -1 ? '' : pair.slice(0, separator)).trim()
  const value = (separator === -1 ? pair : pair.slice(separator + 1)).trim()
  if (!key) return null

  const cookie = new Cookie({ key, value, domain: url.hostname, path: defaultPath(url.pathname) })
  let maxAge: number | null = null
  for (const attribute of attributes) {
    const [rawName = '', ...rest] = attribute.split('=')
    const name = rawName.trim().toLowerCase()
    const attrValue = rest.join('=').trim()
    if (name === 'domain' && attrValue) {
      const domain = attrValue.replace(/^\./, '').toLowerCase()
      // Domínio de fora da URL: o navegador ignora o cookie inteiro.
      if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) return null
      cookie.domain = domain
      cookie.hostOnly = false
    } else if (name === 'path' && attrValue.startsWith('/')) {
      cookie.path = attrValue
    } else if (name === 'max-age' && /^-?\d+$/.test(attrValue)) {
      maxAge = Number(attrValue)
    } else if (name === 'expires') {
      const time = Date.parse(attrValue)
      if (Number.isFinite(time)) cookie.expires = time
    } else if (name === 'secure') {
      cookie.secure = true
    } else if (name === 'httponly') {
      cookie.httpOnly = true
    }
  }
  // Max-Age vale mais que Expires (RFC 6265, 5.3).
  if (maxAge !== null) cookie.expires = now + maxAge * 1000
  return cookie
}

export class CookieJar {
  private readonly store: MemoryCookieStore

  constructor(store: MemoryCookieStore = new MemoryCookieStore()) {
    this.store = store
  }

  getCookiesSync(url: string): Cookie[] {
    const target = new URL(url)
    const now = Date.now()
    const found: Cookie[] = []
    for (const paths of Object.values(this.store.idx)) {
      for (const cookies of Object.values(paths)) {
        for (const cookie of Object.values(cookies)) {
          if (cookie.expired(now)) continue
          if (cookie.secure && !secureContext(target)) continue
          if (!domainMatches(target.hostname, cookie)) continue
          if (!pathMatches(target.pathname, cookie.path ?? '/')) continue
          found.push(cookie)
        }
      }
    }
    // Caminho mais específico primeiro, como no navegador.
    return found.sort((a, b) => (b.path ?? '/').length - (a.path ?? '/').length)
  }

  async setCookie(header: string, url: string): Promise<Cookie | undefined> {
    const cookie = parseSetCookie(header, new URL(url))
    if (!cookie?.domain) return undefined
    const path = cookie.path ?? '/'
    const byPath = (this.store.idx[cookie.domain] ??= {})
    const byKey = (byPath[path] ??= {})
    // Cookie já vencido (Max-Age=0, Expires no passado) apaga o anterior.
    if (cookie.expired()) {
      delete byKey[cookie.key]
      return undefined
    }
    byKey[cookie.key] = cookie
    return cookie
  }
}
