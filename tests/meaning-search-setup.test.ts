// =============================================================================
// Meaning search setup (ticket 259)
// =============================================================================
//   * the Voyage client: the request it sends, and that every failure is a
//     quiet null (no key, bad status, timeout, wrong shape)
//   * the query cache: one call per repeated search
//   * the sync run: dry runs send nothing, batches, a failed batch is left for
//     the next run, prune first
//   * the cron: auth, the flag, the key, dry mode
//   * the migration: service role only, the search filter, the vector size
//   * the privacy page names Voyage only while the flag is on
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  flags: { semanticSearch: false } as Record<string, boolean>,
  rpc: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/lib/env', async (orig) => ({
  ...(await orig<typeof import('@/lib/env')>()),
  isFeatureEnabled: (flag: string) => h.flags[flag] ?? false,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    rpc: h.rpc,
    from: () => ({ upsert: h.upsert }),
  }),
}))

import {
  clearVoyageQueryCache,
  toPgVector,
  VOYAGE_DIMENSIONS,
  VOYAGE_ENDPOINT,
  VOYAGE_MODEL,
  voyageEmbed,
  voyageEmbedQuery,
  type FetchLike,
} from '@/lib/search/voyage'
import {
  estimateTokens,
  syncListingEmbeddings,
  type EmbeddingRow,
  type EmbeddingStore,
  type PendingListing,
} from '@/lib/services/listingEmbeddings'
import { GET } from '@/app/api/cron/embeddings/route'
import { PrivacyPolicy } from '@/app/(public)/privacy/PrivacyPolicy'
import { NextRequest } from 'next/server'

const vec = (seed = 0.1) => Array.from({ length: VOYAGE_DIMENSIONS }, () => seed)

function okReply(n: number, tokens = 42) {
  return new Response(
    JSON.stringify({
      object: 'list',
      data: Array.from({ length: n }, (_, i) => ({ object: 'embedding', embedding: vec(i / 10), index: i })),
      model: VOYAGE_MODEL,
      usage: { total_tokens: tokens },
    }),
    { status: 200 }
  )
}

// ─── The Voyage client ────────────────────────────────────────────────────────

describe('voyageEmbed', () => {
  beforeEach(() => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('sends the texts, the model, the input type and 1024 dimensions', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => okReply(2))
    const result = await voyageEmbed(['soap', 'lotion'], 'document', { fetchImpl })
    expect(result?.vectors).toHaveLength(2)
    expect(result?.tokens).toBe(42)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(VOYAGE_ENDPOINT)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    expect(JSON.parse(init.body as string)).toEqual({
      input: ['soap', 'lotion'],
      model: 'voyage-4-lite',
      input_type: 'document',
      output_dimension: 1024,
      truncation: true,
    })
  })

  it('puts vectors back in input order by index', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          data: [
            { embedding: vec(0.2), index: 1 },
            { embedding: vec(0.1), index: 0 },
          ],
          usage: { total_tokens: 3 },
        })
      )
    const result = await voyageEmbed(['a', 'b'], 'document', { fetchImpl })
    expect(result?.vectors[0]?.[0]).toBe(0.1)
    expect(result?.vectors[1]?.[0]).toBe(0.2)
  })

  it('returns null with no key, and never calls out', async () => {
    vi.stubEnv('VOYAGE_API_KEY', '')
    const fetchImpl = vi.fn<FetchLike>()
    expect(await voyageEmbed(['soap'], 'query', { fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns null on a bad status, and logs only the status', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl: FetchLike = async () => new Response('{"detail":"echo of soap"}', { status: 429 })
    expect(await voyageEmbed(['soap'], 'query', { fetchImpl })).toBeNull()
    expect(log.mock.calls.flat().join(' ')).toContain('429')
    expect(log.mock.calls.flat().join(' ')).not.toContain('soap')
  })

  it('returns null when the reply is the wrong shape', async () => {
    const short: FetchLike = async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2], index: 0 }] }))
    expect(await voyageEmbed(['soap'], 'query', { fetchImpl: short })).toBeNull()
    const missing: FetchLike = async () => okReply(1)
    expect(await voyageEmbed(['soap', 'lotion'], 'query', { fetchImpl: missing })).toBeNull()
    const junk: FetchLike = async () => new Response('not json')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await voyageEmbed(['soap'], 'query', { fetchImpl: junk })).toBeNull()
  })

  it('gives up after the timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    expect(await voyageEmbed(['soap'], 'query', { fetchImpl, timeoutMs: 10 })).toBeNull()
  })

  it('refuses more than one batch at once', async () => {
    const fetchImpl = vi.fn<FetchLike>()
    expect(await voyageEmbed(Array(129).fill('x'), 'document', { fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('writes the pgvector text form', () => {
    expect(toPgVector([0.5, -1, 2])).toBe('[0.5,-1,2]')
  })
})

describe('voyageEmbedQuery', () => {
  beforeEach(() => {
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    clearVoyageQueryCache()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('asks once for the same search, however it is spaced or cased', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => okReply(1))
    expect(await voyageEmbedQuery('Bathroom  products', { fetchImpl })).toHaveLength(VOYAGE_DIMENSIONS)
    expect(await voyageEmbedQuery(' bathroom products ', { fetchImpl })).toHaveLength(VOYAGE_DIMENSIONS)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchImpl.mock.calls[0]![1].body as string).input_type).toBe('query')
  })

  it('does not remember a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(okReply(1))
    expect(await voyageEmbedQuery('soap', { fetchImpl })).toBeNull()
    expect(await voyageEmbedQuery('soap', { fetchImpl })).not.toBeNull()
  })

  it('skips a blank search', async () => {
    const fetchImpl = vi.fn<FetchLike>()
    expect(await voyageEmbedQuery('   ', { fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

// ─── The sync run ─────────────────────────────────────────────────────────────

function memoryStore(pending: PendingListing[], pruned = 0) {
  const saved: EmbeddingRow[] = []
  const calls: string[] = []
  const store: EmbeddingStore = {
    async pending(model, limit) {
      calls.push(`pending:${model}:${limit}`)
      return pending.slice(0, limit)
    },
    async save(rows) {
      calls.push(`save:${rows.length}`)
      saved.push(...rows)
    },
    async prune() {
      calls.push('prune')
      return pruned
    },
  }
  return { store, saved, calls }
}

const listings = (n: number): PendingListing[] =>
  Array.from({ length: n }, (_, i) => ({ listing_id: `l${i}`, content: `Listing ${i} soap`, content_hash: `h${i}` }))

describe('syncListingEmbeddings', () => {
  it('a dry run counts and estimates, and sends and writes nothing', async () => {
    const { store, saved, calls } = memoryStore(listings(3), 5)
    const embed = vi.fn()
    const summary = await syncListingEmbeddings(store, embed, { dry: true })
    expect(embed).not.toHaveBeenCalled()
    expect(saved).toEqual([])
    expect(calls).not.toContain('prune')
    expect(summary).toMatchObject({ dry: true, pending: 3, embedded: 0, pruned: 0 })
    expect(summary.estimatedTokens).toBe(estimateTokens(listings(3).map((l) => l.content)))
  })

  it('prunes first, then embeds in batches and saves each with its hash and model', async () => {
    const { store, saved, calls } = memoryStore(listings(5), 2)
    const embed = vi.fn(async (texts: string[]) => ({ vectors: texts.map(() => [0.1, 0.2]), tokens: texts.length * 10 }))
    const now = new Date('2026-11-22T07:00:00Z')
    const summary = await syncListingEmbeddings(store, embed, { batchSize: 2, now })
    expect(calls[0]).toBe('prune')
    expect(embed).toHaveBeenCalledTimes(3)
    expect(summary).toMatchObject({ pending: 5, embedded: 5, failedBatches: 0, pruned: 2, tokens: 50, model: VOYAGE_MODEL })
    expect(saved[4]).toEqual({
      listing_id: 'l4',
      embedding: '[0.1,0.2]',
      model: VOYAGE_MODEL,
      content_hash: 'h4',
      embedded_at: '2026-11-22T07:00:00.000Z',
    })
  })

  it('leaves a failed batch for the next run and carries on', async () => {
    const { store, saved } = memoryStore(listings(4))
    const embed = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ vectors: [[1], [2]], tokens: 4 })
    const summary = await syncListingEmbeddings(store, embed, { batchSize: 2 })
    expect(summary).toMatchObject({ embedded: 2, failedBatches: 1 })
    expect(saved.map((r) => r.listing_id)).toEqual(['l2', 'l3'])
  })

  it('treats a reply with the wrong count as failed', async () => {
    const { store, saved } = memoryStore(listings(2))
    const summary = await syncListingEmbeddings(store, async () => ({ vectors: [[1]], tokens: 1 }))
    expect(summary.failedBatches).toBe(1)
    expect(saved).toEqual([])
  })

  it('keeps limit and batch size in bounds', async () => {
    const { store, calls } = memoryStore([])
    await syncListingEmbeddings(store, vi.fn(), { limit: 99999, batchSize: 9999 })
    expect(calls).toContain(`pending:${VOYAGE_MODEL}:2000`)
  })
})

// ─── The cron ─────────────────────────────────────────────────────────────────

function cronRequest(query = '', auth = 'Bearer s3cret') {
  return new NextRequest(`https://example.test/api/cron/embeddings${query}`, {
    headers: auth ? { authorization: auth } : {},
  })
}

describe('GET /api/cron/embeddings', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    vi.stubEnv('VOYAGE_API_KEY', 'test-key')
    h.flags.semanticSearch = false
    h.rpc.mockReset()
    h.upsert.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('refuses a caller without the secret', async () => {
    expect((await GET(cronRequest('', 'Bearer nope'))).status).toBe(401)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('does nothing while the flag is off', async () => {
    const res = await GET(cronRequest())
    expect(res.status).toBe(200)
    expect((await res.json()).skipped).toMatch(/flag is off/)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('counts in dry mode even with the flag off, and sends nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    h.rpc.mockResolvedValue({ data: listings(3), error: null })
    const res = await GET(cronRequest('?dry=1'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ dry: true, pending: 3, embedded: 0 })
    expect(h.rpc).toHaveBeenCalledWith('listing_embeddings_pending', { p_model: VOYAGE_MODEL, p_limit: 1000 })
    expect(h.rpc).not.toHaveBeenCalledWith('listing_embeddings_prune')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(h.upsert).not.toHaveBeenCalled()
  })

  it('says so when the flag is on but the key is missing', async () => {
    h.flags.semanticSearch = true
    vi.stubEnv('VOYAGE_API_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(cronRequest())
    expect(res.status).toBe(503)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('embeds and saves with the flag on', async () => {
    h.flags.semanticSearch = true
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okReply(2, 20))
    h.rpc.mockImplementation(async (fn: string) =>
      fn === 'listing_embeddings_prune' ? { data: 1, error: null } : { data: listings(2), error: null }
    )
    h.upsert.mockResolvedValue({ error: null })
    const res = await GET(cronRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ dry: false, pending: 2, embedded: 2, pruned: 1, tokens: 20 })
    expect(h.upsert).toHaveBeenCalledTimes(1)
    expect(h.upsert.mock.calls[0]?.[1]).toEqual({ onConflict: 'listing_id' })
  })

  it('is a red run when every batch failed', async () => {
    h.flags.semanticSearch = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))
    h.rpc.mockImplementation(async (fn: string) =>
      fn === 'listing_embeddings_prune' ? { data: 0, error: null } : { data: listings(2), error: null }
    )
    const res = await GET(cronRequest())
    expect(res.status).toBe(500)
    expect((await res.json()).failedBatches).toBe(1)
  })

  it('is scheduled daily', () => {
    const config = readFileSync(path.resolve(process.cwd(), 'vercel.ts'), 'utf8')
    expect(config).toContain("{ path: '/api/cron/embeddings', schedule: '0 7 * * *' }")
  })
})

// ─── The migration ────────────────────────────────────────────────────────────

describe('listing embeddings migration', () => {
  const sql = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20261206000000_listing_embeddings.sql'),
    'utf8'
  )

  it('stores 1024 numbers, the size the client asks for', () => {
    expect(sql).toContain(`extensions.vector(${VOYAGE_DIMENSIONS})`)
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions')
    expect(sql).toMatch(/USING hnsw \(embedding extensions\.vector_cosine_ops\)/)
  })

  it('is service role only', () => {
    expect(sql).toContain('ALTER TABLE public.listing_embeddings ENABLE ROW LEVEL SECURITY')
    expect(sql).not.toMatch(/CREATE POLICY/i)
    expect(sql).not.toMatch(/SECURITY DEFINER/i)
    for (const fn of ['listing_embedding_text', 'listing_embeddings_pending', 'listing_embeddings_prune', 'search_listings_semantic']) {
      expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\)\\s+FROM PUBLIC, anon, authenticated`))
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\)\\s+TO service_role`))
    }
    expect(sql).not.toMatch(/GRANT[^;]*TO (anon|authenticated)/)
  })

  it('only ever embeds and returns listings search shows', () => {
    const visible = /l\.status = 'published'\s+AND l\.deleted_at IS NULL\s+AND l\.flag_status = 'none'/g
    // listing_embeddings_pending and search_listings_semantic.
    expect(sql.match(visible)).toHaveLength(2)
  })

  it('embeds public page text only', () => {
    const fn = sql.slice(sql.indexOf('FUNCTION public.listing_embedding_text'), sql.indexOf('FUNCTION public.listing_embeddings_pending'))
    for (const field of ['email', 'phone', 'owner', 'review', 'address_line', 'profiles']) {
      expect(fn.toLowerCase()).not.toContain(field)
    }
  })
})

// ─── The privacy page ─────────────────────────────────────────────────────────

describe('Privacy Policy and Voyage', () => {
  it('names Voyage only while meaning search is on', () => {
    const off = renderToStaticMarkup(createElement(PrivacyPolicy, { version: 'next' }))
    expect(off).not.toContain('Voyage')
    expect(off).not.toContain('id="meaning-search"')

    const on = renderToStaticMarkup(createElement(PrivacyPolicy, { version: 'next', meaningSearch: true }))
    expect(on).toContain('id="meaning-search"')
    expect(on).toContain('Voyage AI')
    expect(on).toContain('no account, location or IP address')
  })

  it('reads the flag on both policy pages', () => {
    for (const page of ['app/(public)/privacy/page.tsx', 'app/(public)/privacy/upcoming/page.tsx']) {
      const src = readFileSync(path.resolve(process.cwd(), page), 'utf8')
      expect(src).toContain("meaningSearch={isFeatureEnabled('semanticSearch')}")
    }
  })
})
