// =============================================================================
// readReceiptPhoto (ticket 163): the checks, the audit row, the silent fallback
// =============================================================================
// The flags, the session, both Supabase clients, the provider choice, the
// spend checks and the Anthropic SDK are mocked. Nothing here reaches the real
// API or a database. The photos are real images made with sharp, so the
// signature check and the resize run for real.
// =============================================================================

import sharp from 'sharp'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = { receiptRead: true, collectiveOpen: true }
const state = {
  user: { id: '55555555-5555-4555-8555-555555555555' } as { id: string } | null,
  killSwitch: false,
  provider: 'mock' as 'mock' | 'anthropic',
  readsToday: 0 as number | null,
  withinCeiling: true,
  ceiling: 30 as number | null,
  monthAttempts: 0,
  insertError: false,
  listings: [] as Array<Record<string, unknown>>,
}
const inserts: Array<Record<string, unknown>> = []
const updates: Array<Record<string, unknown>> = []
const orFilters: string[] = []

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))

vi.mock('@/lib/env', () => ({
  isFeatureEnabled: (name: keyof typeof flags) => flags[name] ?? false,
}))

vi.mock('@/lib/ai/provider', () => ({
  aiKillSwitchOn: () => state.killSwitch,
  resolveProvider: () =>
    state.provider === 'anthropic'
      ? { provider: 'anthropic', model: 'claude-haiku-5-5' }
      : { provider: 'mock', model: 'mock' },
}))

vi.mock('@/lib/ai/spend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/spend')>()),
  withinMonthlyCeiling: async () => state.withinCeiling,
  monthlyCeilingUsd: () => state.ceiling,
  countAgentAttemptsThisMonth: async () => state.monthAttempts,
}))

/** A chainable query that resolves to `result` when awaited. */
function query(result: () => unknown, onOr?: (filter: string) => void): Record<string, unknown> {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'not', 'gte', 'limit']) builder[m] = () => builder
  builder.or = (filter: string) => {
    onOr?.(filter)
    return builder
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result())
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table !== 'listings') throw new Error(`unexpected table ${table}`)
      return query(() => ({ data: state.listings, error: null }), (f) => orFilters.push(f))
    },
  }),
  createServiceClient: () => ({
    from: (table: string) => {
      if (table !== 'ai_generation_requests') throw new Error(`unexpected table ${table}`)
      return {
        select: () =>
          query(() =>
            state.readsToday === null
              ? { count: null, error: { message: 'down' } }
              : { count: state.readsToday, error: null }
          ),
        insert: (row: Record<string, unknown>) => {
          inserts.push(row)
          return {
            select: () => ({
              single: async () =>
                state.insertError ? { data: null, error: { message: 'down' } } : { data: { id: 'req-1' }, error: null },
            }),
          }
        },
        update: (patch: Record<string, unknown>) => {
          updates.push(patch)
          return { eq: async () => ({ error: null }) }
        },
      }
    },
  }),
}))

import { readReceiptPhoto } from '@/lib/actions/spend/readReceiptPhoto'

let PNG: Buffer
let JPEG: Buffer
const HEIC = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypheic', 'ascii'),
  Buffer.alloc(64),
])
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n', 'ascii'), Buffer.alloc(64)])

beforeAll(async () => {
  const blank = { create: { width: 40, height: 60, channels: 3 as const, background: '#ffffff' } }
  PNG = await sharp(blank).png().toBuffer()
  JPEG = await sharp(blank).jpeg().toBuffer()
})

function form(bytes: Buffer, type: string, name = 'receipt'): FormData {
  const fd = new FormData()
  fd.set('receipt_file', new File([new Uint8Array(bytes)], name, { type }))
  return fd
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function modelAnswer(patch: Record<string, string | null> = {}) {
  return {
    stop_reason: 'end_turn',
    usage: { input_tokens: 1800, output_tokens: 60 },
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          business_name: 'Sweet Spot Bakery',
          phone: '404-555-0134',
          street_address: null,
          zip: '30303',
          total: '23.45',
          date: today(),
          ...patch,
        }),
      },
    ],
  }
}

beforeEach(() => {
  flags.receiptRead = true
  flags.collectiveOpen = true
  Object.assign(state, {
    user: { id: '55555555-5555-4555-8555-555555555555' },
    killSwitch: false,
    provider: 'mock',
    readsToday: 0,
    withinCeiling: true,
    ceiling: 30,
    monthAttempts: 0,
    insertError: false,
    listings: [],
  })
  inserts.length = 0
  updates.length = 0
  orFilters.length = 0
  create.mockReset()
})

describe('readReceiptPhoto refuses quietly', () => {
  it.each([
    ['the flag is off', () => (flags.receiptRead = false)],
    ['The Collective is closed', () => (flags.collectiveOpen = false)],
    ['the shopper is signed out', () => (state.user = null)],
    ['the kill switch is on', () => (state.killSwitch = true)],
    ['the shopper has used today\'s reads', () => (state.readsToday = 10)],
    ['the daily count cannot be read', () => (state.readsToday = null)],
    ['the audit row cannot be written', () => (state.insertError = true)],
  ])('when %s', async (_label, arrange) => {
    arrange()
    expect(await readReceiptPhoto(form(PNG, 'image/png'))).toEqual({ ok: false })
    expect(create).not.toHaveBeenCalled()
  })

  it('when no photo is sent', async () => {
    expect(await readReceiptPhoto(new FormData())).toEqual({ ok: false })
    expect(inserts).toHaveLength(0)
  })

  it.each([
    ['a HEIC photo', HEIC, 'image/heic'],
    ['a PDF', PDF, 'application/pdf'],
    ['bytes that are not an image', Buffer.from('hello, not an image at all'), 'image/jpeg'],
  ])('for %s, without a model call or audit row', async (_label, bytes, type) => {
    expect(await readReceiptPhoto(form(bytes, type))).toEqual({ ok: false })
    expect(inserts).toHaveLength(0)
    expect(create).not.toHaveBeenCalled()
  })

  it('for a photo over 10 MB', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)])
    expect(await readReceiptPhoto(form(big, 'image/jpeg'))).toEqual({ ok: false })
    expect(inserts).toHaveLength(0)
  })
})

describe('readReceiptPhoto in mock mode', () => {
  it('answers with the sample and picks a clear listing', async () => {
    state.listings = [
      { id: 'l-1', name: 'Sample Market', cities: { name: 'Atlanta' }, listing_details_business: { phone: null, zip: null } },
      { id: 'l-2', name: 'Market Street Deli', cities: { name: 'Atlanta' }, listing_details_business: [] },
    ]
    const result = await readReceiptPhoto(form(PNG, 'image/png'))
    expect(result).toEqual({
      ok: true,
      businessName: 'Sample Market',
      amountCents: 1234,
      purchaseDate: today(),
      strong: { id: 'l-1', name: 'Sample Market', cityName: 'Atlanta' },
      matches: [],
    })
    expect(create).not.toHaveBeenCalled()
    expect(orFilters[0]).toBe('name.ilike.%sample%,name.ilike.%market%')
    expect(updates).toEqual([{ status: 'completed' }])
  })

  it('still fills the fields when no listing fits', async () => {
    const result = await readReceiptPhoto(form(JPEG, 'image/jpeg'))
    expect(result).toMatchObject({ ok: true, businessName: 'Sample Market', strong: null, matches: [] })
  })

  it('skips the paid checks', async () => {
    state.ceiling = null
    state.withinCeiling = false
    expect(await readReceiptPhoto(form(PNG, 'image/png'))).toMatchObject({ ok: true })
  })
})

describe('readReceiptPhoto with Anthropic', () => {
  beforeEach(() => {
    state.provider = 'anthropic'
  })

  it('reads the photo and returns no phone or ZIP', async () => {
    create.mockResolvedValue(modelAnswer())
    state.listings = [
      {
        id: 'l-1',
        name: 'The Sweet Spot Bakery LLC',
        cities: { name: 'Atlanta' },
        listing_details_business: { phone: '(404) 555-0134', zip: '30303' },
      },
    ]
    const result = await readReceiptPhoto(form(PNG, 'image/png'))
    expect(result).toEqual({
      ok: true,
      businessName: 'Sweet Spot Bakery',
      amountCents: 2345,
      purchaseDate: today(),
      strong: { id: 'l-1', name: 'The Sweet Spot Bakery LLC', cityName: 'Atlanta' },
      matches: [],
    })
    expect(JSON.stringify(result)).not.toMatch(/30303|555/)
    expect(updates).toEqual([{ status: 'completed', request_tokens: 1800, response_tokens: 60 }])
  })

  it('sends a JPEG no larger than the read size', async () => {
    create.mockResolvedValue(modelAnswer())
    const tall = await sharp({ create: { width: 800, height: 3200, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer()
    await readReceiptPhoto(form(tall, 'image/png'))
    const image = create.mock.calls[0]![0].messages[0].content[0]
    expect(image.source.media_type).toBe('image/jpeg')
    const meta = await sharp(Buffer.from(image.source.data, 'base64')).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.height).toBe(1568)
  })

  it('keeps only ids and an outcome on the audit row', async () => {
    create.mockResolvedValue(modelAnswer())
    await readReceiptPhoto(form(PNG, 'image/png'))
    expect(inserts[0]).toEqual({
      listing_id: null,
      agent_type: 'receipt_read',
      prompt_version: 'RECEIPT_READ@1',
      model: 'claude-haiku-5-5',
      provider: 'anthropic',
      status: 'pending',
      created_by: '55555555-5555-4555-8555-555555555555',
    })
    expect(JSON.stringify(updates)).not.toMatch(/Sweet|23\.45/)
  })

  it.each([
    ['the ceiling is reached', () => (state.withinCeiling = false)],
    ['no ceiling is set', () => (state.ceiling = null)],
    ['receipt reads have used their share', () => (state.monthAttempts = 1_000_000)],
  ])('makes no call when %s', async (_label, arrange) => {
    arrange()
    expect(await readReceiptPhoto(form(PNG, 'image/png'))).toEqual({ ok: false })
    expect(create).not.toHaveBeenCalled()
    expect(inserts).toHaveLength(0)
  })

  it('falls back when the call fails, and closes the row', async () => {
    create.mockRejectedValue(new Error('timeout'))
    expect(await readReceiptPhoto(form(PNG, 'image/png'))).toEqual({ ok: false })
    expect(updates).toEqual([{ status: 'failed', error_message: 'provider_error' }])
  })

  it('falls back on a refusal, keeping the tokens', async () => {
    create.mockResolvedValue({ stop_reason: 'refusal', usage: { input_tokens: 1700, output_tokens: 5 }, content: [] })
    expect(await readReceiptPhoto(form(PNG, 'image/png'))).toEqual({ ok: false })
    expect(updates).toEqual([
      { status: 'failed', error_message: 'provider_refusal', request_tokens: 1700, response_tokens: 5 },
    ])
  })

  it('falls back when the answer is unusable', async () => {
    create.mockResolvedValue(modelAnswer({ business_name: null, total: null, date: null }))
    expect(await readReceiptPhoto(form(PNG, 'image/png'))).toEqual({ ok: false })
    expect(updates[0]).toMatchObject({ status: 'failed', error_message: 'invalid_output' })
  })
})
