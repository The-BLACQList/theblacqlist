export function buildPageUrl(params: Record<string, string | undefined>, page: number): string {
  const p = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val && key !== 'page') p.set(key, val)
  }
  if (page > 1) p.set('page', String(page))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}
