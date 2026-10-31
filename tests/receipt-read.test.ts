// =============================================================================
// Read my receipt for me (ticket 163): the pure half
// =============================================================================
// The business-name normalizer, the checks on the model's answer, listing
// matching, the cost bound and the image call. The SDK is mocked: nothing here
// reaches the real API.
// =============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const clientOptions: Array<Record<string, unknown>> = []
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
    constructor(options: Record<string, unknown>) {
      clientOptions.push(options)
    }
  },
}))

import { callAnthropicImage, ProviderCallError } from '@/lib/ai/anthropic'
import {
  mockReceiptReadAnswer,
  readFitsCeilingBound,
  RECEIPT_READ_BUDGET_SHARE,
  RECEIPT_READ_JSON_SCHEMA,
  receiptReadCallBudget,
  worstCaseUsdPerRead,
} from '@/lib/ai/receipt-read'
import { worstCaseUsdAnyAgent } from '@/lib/ai/spend'
import { nameTokens, normalizeBusinessName } from '@/lib/spend/business-name'
import {
  checkReadDate,
  isReadablePhoto,
  MAX_MATCHES,
  parseReceiptRead,
  parseTotalToCents,
  pickMatches,
  scoreListingMatch,
  searchWords,
  type MatchCandidate,
} from '@/lib/spend/receipt-read'

const TODAY = new Date('2026-10-31T12:00:00Z')

function answer(patch: Record<string, string | null> = {}): string {
  return JSON.stringify({
    business_name: 'Sweet Spot Bakery',
    phone: '(404) 555-0134',
    street_address: '12 Peach St, Atlanta, GA 30303',
    zip: '30303',
    total: '23.45',
    date: '2026-10-30',
    ...patch,
  })
}

function candidate(patch: Partial<MatchCandidate> & { id: string; name: string }): MatchCandidate {
  return { cityName: 'Atlanta', phone: null, zip: null, ...patch }
}

describe('normalizeBusinessName', () => {
  it.each([
    ['The Sweet Spot Bakery, LLC', 'sweet spot bakery'],
    ['SWEET SPOT BAKERY', 'sweet spot bakery'],
    ['sweet-spot bakery #2', 'sweet spot bakery'],
    ['Sweet Spot Bakery Store 0031', 'sweet spot bakery'],
    ['Mama’s Kitchen & Grill Inc.', 'mamas kitchen and grill'],
    ['Café Olé', 'cafe ole'],
    ['  Two   Spaces  ', 'two spaces'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeBusinessName(raw)).toBe(expected)
  })

  it('keeps a name that is only "The" or only a company word', () => {
    expect(normalizeBusinessName('The')).toBe('the')
    expect(normalizeBusinessName('Co')).toBe('co')
  })

  it('splits into words', () => {
    expect(nameTokens('The Sweet Spot, LLC')).toEqual(['sweet', 'spot'])
  })
})

describe('parseTotalToCents', () => {
  it.each([
    ['23.45', 2345],
    ['$1,234.50', 123450],
    ['23', 2300],
    ['7.5', 750],
  ])('%s -> %i cents', (raw, cents) => {
    expect(parseTotalToCents(raw)).toBe(cents)
  })

  it.each([null, '', '0', '0.00', '-5.00', 'twelve', '12.345', '10000.01'])('refuses %s', (raw) => {
    expect(parseTotalToCents(raw)).toBeNull()
  })

  it('takes the $10,000 cap exactly', () => {
    expect(parseTotalToCents('10000.00')).toBe(1_000_000)
  })
})

describe('checkReadDate', () => {
  it('takes today and a recent day', () => {
    expect(checkReadDate('2026-10-31', TODAY)).toBe('2026-10-31')
    expect(checkReadDate('2026-09-01', TODAY)).toBe('2026-09-01')
  })

  it('allows a day either side of the UTC window', () => {
    expect(checkReadDate('2026-11-01', TODAY)).toBe('2026-11-01')
  })

  it.each(['2026-11-03', '2026-07-01', '2026-02-30', '10/30/2026', 'yesterday'])('refuses %s', (raw) => {
    expect(checkReadDate(raw, TODAY)).toBeNull()
  })
})

describe('parseReceiptRead', () => {
  it('reads every field', () => {
    expect(parseReceiptRead(answer(), { today: TODAY })).toEqual({
      businessName: 'Sweet Spot Bakery',
      phone: '4045550134',
      zip: '30303',
      amountCents: 2345,
      purchaseDate: '2026-10-30',
    })
  })

  it('takes the ZIP from the street line when the zip field is empty', () => {
    expect(parseReceiptRead(answer({ zip: null }), { today: TODAY })?.zip).toBe('30303')
  })

  it('drops a short phone and an unreadable zip', () => {
    const read = parseReceiptRead(answer({ phone: '555-0134', zip: 'n/a', street_address: null }), { today: TODAY })
    expect(read?.phone).toBeNull()
    expect(read?.zip).toBeNull()
  })

  it('leaves a field blank rather than filling a bad value', () => {
    const read = parseReceiptRead(answer({ total: '0.00', date: '2025-01-01' }), { today: TODAY })
    expect(read?.amountCents).toBeNull()
    expect(read?.purchaseDate).toBeNull()
    expect(read?.businessName).toBe('Sweet Spot Bakery')
  })

  it('collapses spaces and caps the name length', () => {
    const read = parseReceiptRead(answer({ business_name: `  Sweet\n Spot ${'x'.repeat(200)}` }), { today: TODAY })
    expect(read?.businessName?.startsWith('Sweet Spot x')).toBe(true)
    expect(read?.businessName?.length).toBe(120)
  })

  it.each([
    ['not JSON', 'Sweet Spot Bakery, $23.45'],
    ['a missing key', JSON.stringify({ business_name: 'Sweet Spot' })],
    ['a wrong type', answer({ total: 23.45 as unknown as string })],
    ['nothing usable', answer({ business_name: null, total: null, date: null })],
  ])('returns null for %s', (_label, text) => {
    expect(parseReceiptRead(text, { today: TODAY })).toBeNull()
  })

  it('reads the mock answer', () => {
    expect(parseReceiptRead(mockReceiptReadAnswer('2026-10-31'), { today: TODAY })).toMatchObject({
      businessName: 'Sample Market',
      amountCents: 1234,
      purchaseDate: '2026-10-31',
    })
  })
})

describe('matching', () => {
  const read = { businessName: 'Sweet Spot Bakery', phone: '4045550134', zip: '30303' }

  it('scores an exact name at 1, plus phone and ZIP', () => {
    expect(scoreListingMatch({ ...read, phone: null, zip: null }, candidate({ id: 'a', name: 'The Sweet Spot Bakery LLC' }))).toBe(1)
    expect(
      scoreListingMatch(read, candidate({ id: 'a', name: 'Sweet Spot Bakery', phone: '+1 404-555-0134', zip: '30303-1234' }))
    ).toBe(2.25)
  })

  it('picks a clear winner for the shopper', () => {
    const pick = pickMatches(read, [
      candidate({ id: 'a', name: 'Sweet Spot Bakery' }),
      candidate({ id: 'b', name: 'Sweet Treats' }),
    ])
    expect(pick).toEqual({ strong: { id: 'a', name: 'Sweet Spot Bakery', cityName: 'Atlanta' }, matches: [] })
  })

  it('offers choices when two listings are too close to call', () => {
    const pick = pickMatches(read, [
      candidate({ id: 'a', name: 'Sweet Spot Bakery', cityName: 'Atlanta' }),
      candidate({ id: 'b', name: 'Sweet Spot Bakery', cityName: 'Decatur' }),
    ])
    expect(pick.strong).toBeNull()
    expect(pick.matches.map((m) => m.id).sort()).toEqual(['a', 'b'])
  })

  it('lets the phone settle a tie', () => {
    const pick = pickMatches(read, [
      candidate({ id: 'a', name: 'Sweet Spot Bakery', cityName: 'Atlanta', phone: '404-555-0134' }),
      candidate({ id: 'b', name: 'Sweet Spot Bakery', cityName: 'Decatur', phone: '470-555-0199' }),
    ])
    expect(pick.strong?.id).toBe('a')
  })

  it(`offers at most ${MAX_MATCHES}, and none below the floor`, () => {
    const pick = pickMatches({ businessName: 'Sweet Spot Bakery', phone: null, zip: null }, [
      candidate({ id: 'a', name: 'Sweet Spot Cafe' }),
      candidate({ id: 'b', name: 'Sweet Spot Deli' }),
      candidate({ id: 'c', name: 'Sweet Spot Grill' }),
      candidate({ id: 'd', name: 'Sweet Spot Bar' }),
      candidate({ id: 'e', name: 'Hardware Barn' }),
    ])
    expect(pick.strong).toBeNull()
    expect(pick.matches).toHaveLength(MAX_MATCHES)
    expect(pick.matches.map((m) => m.id)).not.toContain('e')
  })

  it('counts a listing once', () => {
    const pick = pickMatches(read, [
      candidate({ id: 'a', name: 'Sweet Spot Bakery' }),
      candidate({ id: 'a', name: 'Sweet Spot Bakery' }),
    ])
    expect(pick.strong?.id).toBe('a')
  })

  it('never sends phone or ZIP to the browser', () => {
    const pick = pickMatches(read, [
      candidate({ id: 'a', name: 'Sweet Spot Bakery', phone: '404-555-0134', zip: '30303' }),
      candidate({ id: 'b', name: 'Sweet Spot Bakery', phone: '404-555-0134', zip: '30303' }),
    ])
    for (const m of [...pick.matches, ...(pick.strong ? [pick.strong] : [])]) {
      expect(Object.keys(m).sort()).toEqual(['cityName', 'id', 'name'])
    }
  })

  it('searches the two longest words', () => {
    expect(searchWords('The Sweet Spot Bakery')).toEqual(['bakery', 'sweet'])
    expect(searchWords('Bread & Co')).toEqual(['bread'])
    expect(searchWords('A1')).toEqual([])
  })
})

describe('isReadablePhoto', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('reads %s', (type) => {
    expect(isReadablePhoto({ type })).toBe(true)
  })

  it.each(['image/heic', 'image/heif', 'application/pdf', ''])('does not read %s', (type) => {
    expect(isReadablePhoto({ type })).toBe(false)
  })
})

describe('cost', () => {
  it('a read never costs more than every attempt is charged at', () => {
    expect(readFitsCeilingBound()).toBe(true)
    expect(worstCaseUsdPerRead()).toBeLessThanOrEqual(worstCaseUsdAnyAgent())
  })

  it('takes a fifth of the monthly budget', () => {
    expect(RECEIPT_READ_BUDGET_SHARE).toBe(0.2)
    expect(receiptReadCallBudget(1000)).toBe(200)
    expect(receiptReadCallBudget(4)).toBe(0)
  })
})

describe('callAnthropicImage', () => {
  const INPUT = {
    model: 'claude-haiku-5-5',
    system: 'system',
    prompt: 'Read this receipt.',
    image: { mediaType: 'image/jpeg' as const, base64: 'AAAA' },
    jsonSchema: RECEIPT_READ_JSON_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 300,
    timeoutMs: 8000,
  }

  beforeEach(() => {
    create.mockReset()
    clientOptions.length = 0
  })

  it('sends the image with structured output, no retry and the caller timeout', async () => {
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      usage: { input_tokens: 1500, output_tokens: 40 },
      content: [{ type: 'text', text: '{"ok":1}' }],
    })
    await expect(callAnthropicImage(INPUT)).resolves.toEqual({ text: '{"ok":1}', inputTokens: 1500, outputTokens: 40 })
    expect(clientOptions[0]).toMatchObject({ timeout: 8000, maxRetries: 0 })
    const body = create.mock.calls[0]![0]
    expect(body).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    })
    expect(body.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
    })
  })

  it.each([
    ['refusal', 'provider_refusal'],
    ['max_tokens', 'provider_truncated'],
    ['pause_turn', 'provider_error'],
  ])('turns a %s stop into %s with the tokens', async (stop, code) => {
    create.mockResolvedValue({ stop_reason: stop, usage: { input_tokens: 10, output_tokens: 2 }, content: [] })
    const err = await callAnthropicImage(INPUT).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderCallError)
    expect(err).toMatchObject({ code, usage: { inputTokens: 10, outputTokens: 2 } })
  })

  it('drops the SDK error message', async () => {
    create.mockRejectedValue(new Error('request body quoted here'))
    const err = await callAnthropicImage(INPUT).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProviderCallError)
    expect((err as Error).message).not.toContain('quoted')
  })
})

describe('no logging', () => {
  it.each([
    'lib/actions/spend/readReceiptPhoto.ts',
    'lib/ai/receipt-read.ts',
    'lib/spend/receipt-read.ts',
    'lib/spend/business-name.ts',
  ])('%s has no console call', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    expect(source).not.toMatch(/\bconsole\./)
  })
})
