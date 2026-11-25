#!/usr/bin/env node
/**
 * Exporta do Figma os ícones (SVG → componentes React) e as imagens (WebP).
 *
 * Uso: node scripts/export-figma-assets.mjs
 * Requer FIGMA_TOKEN no .env (token pessoal com leitura de conteúdo de arquivo).
 * O token nunca é impresso.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE_KEY = 'Ff0SksUi7UFtPWUO8kyNtw'

/** Ícone no código → nó do Figma. Os nomes seguem o pacote Iconly quando é o caso. */
const ICONS = {
  Search: 'I70522:3240;70504:3015;70486:519',
  Cart: 'I70522:3240;70504:3015;70486:521',
  Logout: 'I70522:3240;70504:3015;70486:527',
  Facebook: 'I70492:696;70491:1270',
  Instagram: 'I70492:696;70491:1272',
  Twitter: 'I70492:696;70491:1274',
  Linkedin: 'I70492:696;70491:1276',
  Youtube: 'I70492:696;70491:1278',
  Home: '15:5519',
  Heart: '15:5642',
  Scan: '15:5529',
  Shop: '15:5524',
  User: '70420:4541',
  ArrowLeft: '15:5745',
  ArrowRight: '5:99',
  ArrowRightCircle: '4:392',
  ChevronDown: '4:152',
  Star: '11:1195',
  Activity: '70420:4555',
  Danger: '70420:4561',
  Delete: '16:463',
  Download: '70420:4558',
  Filter: '15:5488',
  Hide: '9:963',
  Image: '9:1560',
  Wallet: '23:1379',
  Location: '70420:4544',
}

/** Formas exportadas como SVG cru (com cor própria) para src/assets. */
const SHAPES = {
  'tab-bar-background': '15:5504',
}

/**
 * Formas montadas a partir da geometria vetorial (`/files/:key/nodes?geometry=paths`),
 * sem passar pelo endpoint de renderização `/images`, que tem cota baixa no plano.
 */
const GEOMETRY_SHAPES = {
  'google-logo': 'I70484:260;70483:242',
  'facebook-logo': 'I70484:240;70483:259',
}

/** Formas que esticam na horizontal (as outras mantêm a proporção). */
const STRETCH = new Set(['tab-bar-background'])

/** imageRef do Figma → nome do arquivo. São as 4 imagens usadas no layout. */
const IMAGES = {
  84592047: 'nft-01',
  '2986a7cb': 'nft-02',
  '9df2ff42': 'nft-03',
  '87580f2d': 'nft-04',
}
const IMAGE_WIDTHS = [480, 960]

async function readToken() {
  const env = await readFile(resolve(ROOT, '.env'), 'utf8').catch(() => '')
  const line = env.split(/\r?\n/).find((l) => l.startsWith('FIGMA_TOKEN='))
  const token = line
    ?.slice('FIGMA_TOKEN='.length)
    .trim()
    .replace(/^["']|["']$/g, '')
  if (!token) throw new Error('FIGMA_TOKEN ausente no .env')
  return token
}

async function figma(token, path) {
  const res = await fetch(`https://api.figma.com/v1/${path}`, {
    headers: { 'X-Figma-Token': token },
  })
  if (!res.ok) throw new Error(`Figma ${res.status} em ${path.split('?')[0]}`)
  return res.json()
}

/** Troca as cores fixas por currentColor e devolve só o conteúdo do <svg>. */
function toIconBody(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/(fill|stroke)="(?!none)[^"]*"/g, '$1="currentColor"')
    .replace(/\s(id|clip-path|mask|filter)="[^"]*"/g, '')
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    // Máscaras do Iconly ficam sem uso depois de remover o atributo `mask`.
    .replace(/<mask[\s\S]*?<\/mask>/g, '')
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/stroke-miterlimit=/g, 'strokeMiterlimit=')
    .replace(/fill-opacity=/g, 'fillOpacity=')
    .replace(/stroke-opacity=/g, 'strokeOpacity=')
    .replace(/<g>([\s\S]*?)<\/g>/g, '$1')
    .trim()
  return { viewBox, inner }
}

async function exportIcons(token) {
  const ids = Object.values(ICONS).join(',')
  const { images } = await figma(
    token,
    `images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg&svg_outline_text=false`,
  )

  const entries = []
  for (const [name, id] of Object.entries(ICONS)) {
    const url = images[id]
    if (!url) throw new Error(`Ícone ${name} (${id}) não exportado`)
    const svg = await (await fetch(url)).text()
    const { viewBox, inner } = toIconBody(svg)
    entries.push(
      `export const ${name}Icon = createIcon('${name}', '${viewBox}', (\n  <>\n    ${inner.replace(/\n/g, '\n    ')}\n  </>\n))`,
    )
  }

  const file = `// Gerado por scripts/export-figma-assets.mjs a partir do Figma. Não editar à mão.
import { createIcon } from './create-icon'

${entries.join('\n\n')}
`
  const out = resolve(ROOT, 'src/components/icons/figma-icons.tsx')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, file)
  console.log(`ícones: ${entries.length} → src/components/icons/figma-icons.tsx`)
}

async function exportShapes(token) {
  const ids = Object.values(SHAPES).join(',')
  const { images } = await figma(
    token,
    `images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg`,
  )
  const outDir = resolve(ROOT, 'src/assets')
  await mkdir(outDir, { recursive: true })
  for (const [name, id] of Object.entries(SHAPES)) {
    const svg = (await (await fetch(images[id])).text())
      // Escala livre na horizontal: a forma acompanha a largura da tela.
      .replace('<svg ', STRETCH.has(name) ? '<svg preserveAspectRatio="none" ' : '<svg ')
    await writeFile(resolve(outDir, `${name}.svg`), svg)
    console.log(`forma: src/assets/${name}.svg`)
  }
}

const toHex = (c) =>
  '#' +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

async function exportGeometryShapes(token) {
  const ids = Object.values(GEOMETRY_SHAPES).join(',')
  const { nodes } = await figma(
    token,
    `files/${FILE_KEY}/nodes?ids=${encodeURIComponent(ids)}&geometry=paths`,
  )
  const outDir = resolve(ROOT, 'src/assets')
  await mkdir(outDir, { recursive: true })

  for (const [name, id] of Object.entries(GEOMETRY_SHAPES)) {
    const root = nodes[id]?.document
    if (!root) throw new Error(`Forma ${name} (${id}) não encontrada`)
    const origin = root.absoluteBoundingBox
    const paths = []
    const walk = (node) => {
      if (node.visible === false) return
      const fill = (node.fills ?? []).find((f) => f.visible !== false && f.type === 'SOLID')
      if (node.type !== 'FRAME' && fill && node.fillGeometry?.length) {
        const box = node.absoluteBoundingBox
        const dx = +(box.x - origin.x).toFixed(3)
        const dy = +(box.y - origin.y).toFixed(3)
        for (const geometry of node.fillGeometry) {
          const rule = geometry.windingRule === 'EVENODD' ? ' fill-rule="evenodd"' : ''
          paths.push(
            `<path transform="translate(${dx} ${dy})" d="${geometry.path}" fill="${toHex(fill.color)}"${rule}/>`,
          )
        }
      }
      for (const child of node.children ?? []) walk(child)
    }
    walk(root)
    const { width, height } = origin
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join('')}</svg>\n`
    await writeFile(resolve(outDir, `${name}.svg`), svg)
    console.log(`forma: src/assets/${name}.svg (${paths.length} caminhos)`)
  }
}

async function exportImages(token) {
  const { meta } = await figma(token, `files/${FILE_KEY}/images`)
  const outDir = resolve(ROOT, 'public/images/nfts')
  await mkdir(outDir, { recursive: true })

  for (const [prefix, name] of Object.entries(IMAGES)) {
    const ref = Object.keys(meta.images).find((r) => r.startsWith(prefix))
    if (!ref) throw new Error(`Imagem ${prefix} não encontrada`)
    const buffer = Buffer.from(await (await fetch(meta.images[ref])).arrayBuffer())
    for (const width of IMAGE_WIDTHS) {
      const target = resolve(outDir, `${name}-${width}.webp`)
      const info = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(target)
      console.log(
        `imagem: ${name}-${width}.webp ${info.width}x${info.height} ${Math.round(info.size / 1024)} kB`,
      )
    }
  }
}

// `--only=icons,shapes,images` exporta só parte (a API do Figma limita requisições).
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',')
const wants = (part) => !only || only.includes(part)

const token = await readToken()
if (wants('icons')) await exportIcons(token)
if (wants('shapes')) await exportShapes(token)
if (wants('logos')) await exportGeometryShapes(token)
if (wants('images')) await exportImages(token)
