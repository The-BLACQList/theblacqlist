import { describe, it, expect } from 'vitest'
import { resolveFacetParams } from '@/lib/listings/facets'

// resolveFacetParams only touches supabase when category/city/attrs are present.
// With none supplied it uses Promise.resolve fallbacks, so a bare stub is safe.
const stub = {} as unknown as Parameters<typeof resolveFacetParams>[0]

describe('resolveFacetParams — ownership', () => {
  it('maps ownership="ally" to p_ownership_label', async () => {
    const r = await resolveFacetParams(stub, { ownership: 'ally' })
    expect(r.p_ownership_label).toBe('ally')
  })

  it('maps ownership="black_owned" to p_ownership_label', async () => {
    const r = await resolveFacetParams(stub, { ownership: 'black_owned' })
    expect(r.p_ownership_label).toBe('black_owned')
  })

  it('is null when ownership is absent', async () => {
    const r = await resolveFacetParams(stub, {})
    expect(r.p_ownership_label).toBeNull()
  })

  it('is null when ownership is an empty string', async () => {
    const r = await resolveFacetParams(stub, { ownership: '' })
    expect(r.p_ownership_label).toBeNull()
  })
})
