/** Páginas a mostrar: primeira, última e vizinhas da atual, com reticências. */
export function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  for (const page of sorted) {
    const last = result[result.length - 1]
    if (typeof last === 'number' && page - last > 1) result.push('gap')
    result.push(page)
  }
  return result
}
