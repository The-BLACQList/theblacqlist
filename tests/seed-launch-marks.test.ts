// Ticket 284: the launch seed leaves out a business marked do-not-re-add, and
// stops before its first write when the marks can't be read. Runs the real
// script against a fake Supabase client.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED_CITIES } from '../scripts/data/cities'

const city = SEED_CITIES[0]!
const corpus = JSON.parse(
  readFileSync(join(__dirname, '..', 'scripts', 'data', city.file), 'utf8')
) as { name: string; slug: string; city_slug: string; category_slug: string }[]

const h = vi.hoisted(() => ({
  marks: { data: [] as unknown[] | null, error: null as { message: string } | null },
  lookups: {} as Record<string, unknown>,
  upserts: [] as string[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      const builder = {
        select: () => builder,
        order: () => builder,
        range: async () => h.marks,
        maybeSingle: async () => ({ data: null, error: null }), // "already exists"
        upsert: (row: { slug: string }) => {
          if (table === 'listings') h.upserts.push(row.slug)
          return builder
        },
        then: (resolve: (v: unknown) => void) => resolve({ data: h.lookups[table], error: null }),
      }
      return builder
    },
  }),
}))

const argv = process.argv

async function runSeed() {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  vi.resetModules()
  await import('../scripts/seed-launch-listings')
  await vi.waitFor(() => {
    const done = log.mock.calls.some((c) => String(c[0]).includes('Seed complete'))
    expect(done || exit.mock.calls.length > 0).toBe(true)
  })
  return { exit, warnings: warn.mock.calls.map((c) => String(c[0])) }
}

beforeEach(() => {
  process.env['SUPABASE_URL'] = 'http://127.0.0.1:1'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'not-a-key'
  process.argv = ['node', 'seed', `--only=${city.slug}`]
  h.upserts.length = 0
  const ids = (key: 'city_slug' | 'category_slug') =>
    [...new Set(corpus.map((l) => l[key]))].map((slug) => ({ id: slug, slug }))
  h.lookups = { cities: ids('city_slug'), categories: ids('category_slug') }
})

afterEach(() => {
  process.argv = argv
  delete process.env['SUPABASE_URL']
  delete process.env['SUPABASE_SERVICE_ROLE_KEY']
  vi.restoreAllMocks()
})

describe('seed-launch-listings and the do-not-re-add marks', () => {
  it('seeds every row when nothing is marked', async () => {
    h.marks = { data: [], error: null }
    await runSeed()
    expect(h.upserts).toEqual(corpus.map((l) => l.slug))
  })

  it('skips a marked slug, or the same name and city under another slug, and lists them', async () => {
    const [a, b] = [corpus[0]!, corpus[1]!]
    h.marks = {
      data: [
        { page_id: '1', slug: a.slug, name: 'Old Name', city_slug: null, city_name: null, reason: 'closed' },
        { page_id: '2', slug: 'gone', name: b.name.toUpperCase(), city_slug: b.city_slug, city_name: null, reason: 'owner_asked' },
      ],
      error: null,
    }
    const { warnings } = await runSeed()
    expect(h.upserts).not.toContain(a.slug)
    expect(h.upserts).not.toContain(b.slug)
    expect(h.upserts).toHaveLength(corpus.length - 2)
    expect(warnings.filter((w) => w.includes('Marked do-not-re-add'))).toHaveLength(2)
  })

  it('stops before any write when the marks cannot be read', async () => {
    h.marks = { data: null, error: { message: 'down' } }
    const { exit } = await runSeed()
    expect(exit).toHaveBeenCalledWith(1)
    expect(h.upserts).toEqual([])
  })
})
