import { beforeEach, describe, expect, it, vi } from 'vitest'

// Records every builder call per table so the test can see the filters the
// sitemap asked for. Every query resolves to an empty list.
const calls: Record<string, Array<[string, unknown[]]>> = {}

function builder(table: string) {
  const chain: Record<string, unknown> = {}
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      ;(calls[table] ??= []).push([method, args])
      return chain
    }
  for (const m of [
    'select',
    'eq',
    'is',
    'in',
    'neq',
    'not',
    'order',
    'limit',
    'gte',
    'lte',
    'or',
  ]) {
    chain[m] = record(m)
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (table: string) => builder(table) }),
}))

describe('sitemap', () => {
  beforeEach(() => {
    for (const k of Object.keys(calls)) delete calls[k]
  })

  it('leaves out listings the owner hid from search engines', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    await sitemap()
    expect(calls.listings).toContainEqual(['eq', ['noindex', false]])
    expect(calls.listings).toContainEqual(['eq', ['status', 'published']])
  })
})
