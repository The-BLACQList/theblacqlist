'use server'

/**
 * Read my receipt for me (ticket 163).
 *
 * The shopper ticks the box on the receipt form and picks a photo; this reads
 * the business name, total and date off it and finds the business in our
 * listings. Every filled field is marked "From your photo" and stays editable.
 *
 * Checks, in order. Every "no" returns `{ ok: false }` and the form stays as
 * the shopper left it, with no message: they fill it in by hand as before.
 *   1. FEATURE_RECEIPT_READ is on (closed by default everywhere) and The
 *      Collective is open
 *   2. the shopper is signed in
 *   3. the AI kill switch is off
 *   4. the photo is a JPEG, PNG or WebP of 10 MB or less. HEIC and PDF are
 *      not read; they upload as before.
 *   5. the shopper's own cap: RECEIPT_READ_PER_DAY reads in 24 hours
 *   6. paid calls only: a read costs no more than every attempt is charged at,
 *      the monthly ceiling has room, and receipt reads are under their share
 *
 * Mock mode (no key, no ceiling) skips 6 the way generate() does: it costs
 * nothing, and answers with a fixed sample so Preview shows the flow.
 *
 * The photo goes to the model scaled down and with its EXIF dropped, and is
 * kept nowhere by this action: the form still uploads the original with the
 * receipt, as before. The audit row keeps the agent, the model, the shopper's
 * id (for the cap) and an outcome code only, never what was read. There is no
 * console call here on purpose; please keep it that way.
 */

import sharp from 'sharp'

import { isFeatureEnabled } from '@/lib/env'
import { callAnthropicImage, ProviderCallError, type TokenUsage } from '@/lib/ai/anthropic'
import { aiKillSwitchOn, resolveProvider } from '@/lib/ai/provider'
import {
  mockReceiptReadAnswer,
  readFitsCeilingBound,
  RECEIPT_READ_AGENT_TYPE,
  RECEIPT_READ_JSON_SCHEMA,
  RECEIPT_READ_MAX_EDGE,
  RECEIPT_READ_MAX_TOKENS,
  RECEIPT_READ_PER_DAY,
  RECEIPT_READ_PROMPT,
  RECEIPT_READ_PROMPT_VERSION,
  RECEIPT_READ_SYSTEM_PROMPT,
  RECEIPT_READ_TIMEOUT_MS,
  receiptReadCallBudget,
} from '@/lib/ai/receipt-read'
import {
  countAgentAttemptsThisMonth,
  monthlyCallBudget,
  monthlyCeilingUsd,
  withinMonthlyCeiling,
} from '@/lib/ai/spend'
import { escapeLikePattern } from '@/lib/db/like'
import { sniffImageType } from '@/lib/media/prepareImage'
import { SIGNATURE_HEADER_BYTES } from '@/lib/security/file-signature'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hasReceiptPhoto, isoDay, MAX_RECEIPT_BYTES } from '@/lib/spend/receipt-input'
import { NON_SHOPPABLE_ENTITY_TYPES } from '@/lib/spend/receipt-prefill'
import {
  parseReceiptRead,
  pickMatches,
  searchWords,
  type MatchCandidate,
  type MatchedListing,
  type ReceiptRead,
} from '@/lib/spend/receipt-read'

export type ReceiptReadResult =
  | {
      ok: true
      businessName: string | null
      amountCents: number | null
      purchaseDate: string | null
      /** The listing to select for the shopper, when one clearly fits. */
      strong: MatchedListing | null
      /** Up to three listings to offer when none clearly fits. */
      matches: MatchedListing[]
    }
  | { ok: false }

const NO: ReceiptReadResult = { ok: false }

/** Below this many decoded pixels, there is nothing on the photo to read. */
const MAX_INPUT_PIXELS = 50_000_000
const CANDIDATE_LIMIT = 25

function tokenColumns(usage: TokenUsage | null): { request_tokens?: number; response_tokens?: number } {
  return usage ? { request_tokens: usage.inputTokens, response_tokens: usage.outputTokens } : {}
}

/** Reads in the last 24 hours by this shopper. Fails closed: an unreadable count is over the cap. */
async function countReadsToday(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('ai_generation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('agent_type', RECEIPT_READ_AGENT_TYPE)
    .eq('created_by', userId)
    .gte('created_at', since)
  if (error || count === null) return Number.POSITIVE_INFINITY
  return count
}

interface CandidateRow {
  id: string
  name: string
  cities: { name: string } | null
  listing_details_business:
    | { phone: string | null; zip: string | null }
    | { phone: string | null; zip: string | null }[]
    | null
}

/**
 * Published, shoppable listings whose name holds one of the read name's
 * longest words. Phone and ZIP come along for scoring and stop there.
 */
async function findCandidates(read: ReceiptRead): Promise<MatchCandidate[]> {
  if (!read.businessName) return []
  const words = searchWords(read.businessName)
  if (words.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('listings')
    .select('id, name, cities!listings_city_id_fkey(name), listing_details_business(phone, zip)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .not('entity_type', 'in', `(${NON_SHOPPABLE_ENTITY_TYPES.join(',')})`)
    .or(words.map((w) => `name.ilike.%${escapeLikePattern(w)}%`).join(','))
    .limit(CANDIDATE_LIMIT)
  if (error || !data) return []

  return (data as unknown as CandidateRow[]).map((row) => {
    const details = Array.isArray(row.listing_details_business)
      ? (row.listing_details_business[0] ?? null)
      : row.listing_details_business
    return {
      id: row.id,
      name: row.name,
      cityName: row.cities?.name ?? null,
      phone: details?.phone ?? null,
      zip: details?.zip ?? null,
    }
  })
}

export async function readReceiptPhoto(formData: FormData): Promise<ReceiptReadResult> {
  try {
    // 1. Flags.
    if (!isFeatureEnabled('receiptRead') || !isFeatureEnabled('collectiveOpen')) return NO

    // 2. Signed in.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NO

    // 3. Kill switch.
    if (aiKillSwitchOn()) return NO

    // 4. The photo.
    const file = formData.get('receipt_file')
    if (!hasReceiptPhoto(file) || file.size > MAX_RECEIPT_BYTES) return NO
    const bytes = Buffer.from(await file.arrayBuffer())
    if (!sniffImageType(bytes.subarray(0, SIGNATURE_HEADER_BYTES))) return NO

    // 5. The shopper's own cap.
    if ((await countReadsToday(user.id)) >= RECEIPT_READ_PER_DAY) return NO

    // 6. Paid calls only.
    const { provider, model } = resolveProvider({ modelTier: 'fast' })
    if (provider === 'anthropic') {
      if (!readFitsCeilingBound()) return NO
      if (!(await withinMonthlyCeiling())) return NO
      const ceiling = monthlyCeilingUsd()
      if (ceiling === null) return NO
      const used = await countAgentAttemptsThisMonth(RECEIPT_READ_AGENT_TYPE)
      if (used >= receiptReadCallBudget(monthlyCallBudget(ceiling))) return NO
    }

    // Upright, no EXIF, no larger than the model reads anyway.
    let scaled: Buffer
    try {
      scaled = await sharp(bytes, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({
          width: RECEIPT_READ_MAX_EDGE,
          height: RECEIPT_READ_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer()
    } catch {
      return NO
    }

    const service = createServiceClient()
    const { data: row, error: rowError } = await service
      .from('ai_generation_requests')
      .insert({
        listing_id: null,
        agent_type: RECEIPT_READ_AGENT_TYPE,
        prompt_version: RECEIPT_READ_PROMPT_VERSION,
        model,
        provider,
        status: 'pending',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (rowError || !row) return NO
    const requestId = row.id

    async function close(errorCode: string | null, usage: TokenUsage | null = null): Promise<void> {
      await service
        .from('ai_generation_requests')
        .update(
          errorCode
            ? { status: 'failed', error_message: errorCode, ...tokenColumns(usage) }
            : { status: 'completed', ...tokenColumns(usage) }
        )
        .eq('id', requestId)
    }

    let answer: string
    let usage: TokenUsage | null = null
    try {
      if (provider === 'mock') {
        answer = mockReceiptReadAnswer(isoDay(new Date()))
      } else {
        const result = await callAnthropicImage({
          model,
          system: RECEIPT_READ_SYSTEM_PROMPT,
          prompt: RECEIPT_READ_PROMPT,
          image: { mediaType: 'image/jpeg', base64: scaled.toString('base64') },
          jsonSchema: RECEIPT_READ_JSON_SCHEMA,
          maxTokens: RECEIPT_READ_MAX_TOKENS,
          timeoutMs: RECEIPT_READ_TIMEOUT_MS,
        })
        answer = result.text
        usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens }
      }
    } catch (err) {
      await close(
        err instanceof ProviderCallError ? err.code : 'provider_error',
        err instanceof ProviderCallError ? err.usage : null
      )
      return NO
    }

    const read = parseReceiptRead(answer)
    if (!read) {
      await close('invalid_output', usage)
      return NO
    }
    await close(null, usage)

    // A failed lookup still leaves the name, total and date to fill.
    const picked = pickMatches(read, await findCandidates(read).catch(() => []))
    return {
      ok: true,
      businessName: read.businessName,
      amountCents: read.amountCents,
      purchaseDate: read.purchaseDate,
      strong: picked.strong,
      matches: picked.matches,
    }
  } catch {
    // Any other failure: the shopper fills the form in by hand, as before.
    return NO
  }
}
