'use server'

/**
 * The home page visitor guide (ticket 146).
 *
 * Checks, in order. Every one sends the visitor to plain search on a "no":
 *   1. the input is 1 to 200 characters after trimming
 *   2. FEATURE_AI_GUIDE is on (read again here, at request time)
 *   3. the AI kill switch is off
 *   4. Turnstile: skipped in v1. It needs a widget, a single-use token per ask
 *      and a Cloudflare script on the busiest page. Checks 5 to 7 bound the
 *      cost instead.
 *   5. rate limit per IP: 5 a minute, 30 a day (bucket 'ai_guide')
 *   6. paid calls only: the monthly AI ceiling (withinMonthlyCeiling)
 *   7. paid calls only: the guide's own share, under 40% of the monthly budget
 *
 * Mock mode (no key, no ceiling) skips 6 and 7 the way generate() does: it
 * costs nothing. It still writes the audit row, with provider 'mock'.
 *
 * Nothing the visitor typed is stored or logged. The audit row keeps the
 * agent, the model and the outcome code only. There is no console call here on
 * purpose; please keep it that way.
 */

import { headers } from 'next/headers'

import { isFeatureEnabled } from '@/lib/env'
import { GUIDE_AGENT, GUIDE_PROMPT_VERSION } from '@/lib/ai/agents'
import { callAnthropic, ProviderCallError, type TokenUsage } from '@/lib/ai/anthropic'
import {
  GUIDE_MAX_RESULTS,
  GUIDE_PAGES,
  GUIDE_PER_DAY,
  GUIDE_PER_MINUTE,
  GUIDE_SYSTEM_PROMPT,
  buildGuidePrompt,
  buildSeeAllHref,
  buildSummary,
  fallbackHref,
  guideInputSchema,
  hasSearchFilters,
  isEmptyGuide,
  mockGuideAnswer,
  parseGuideAnswer,
  stripLinks,
  withinGuideBudget,
  type GuideAllowList,
  type GuideFilters,
} from '@/lib/ai/guide'
import { aiKillSwitchOn, resolveProvider } from '@/lib/ai/provider'
import { sanitizeForPrompt, rejectionCode } from '@/lib/ai/sanitize'
import {
  countAgentAttemptsThisMonth,
  monthlyCallBudget,
  monthlyCeilingUsd,
  withinMonthlyCeiling,
} from '@/lib/ai/spend'
import { queryListings } from '@/lib/listings/query'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { DiscoveryEntity } from '@/types'

export type GuideResponse =
  | {
      kind: 'results'
      summary: string
      results: DiscoveryEntity[]
      seeAllHref: string
      page: { label: string; href: string } | null
    }
  | { kind: 'fallback'; href: string }

function fallback(text: string): GuideResponse {
  return { kind: 'fallback', href: fallbackHref(text) }
}

function tokenColumns(usage: TokenUsage | null): { request_tokens?: number; response_tokens?: number } {
  return usage ? { request_tokens: usage.inputTokens, response_tokens: usage.outputTokens } : {}
}

async function loadAllowList(): Promise<GuideAllowList | null> {
  const supabase = await createClient()
  const [categories, cities] = await Promise.all([
    supabase.from('categories').select('name, slug, parent_id').eq('is_active', true),
    supabase.from('cities').select('name, slug').eq('is_active', true),
  ])
  if (categories.error || cities.error) return null
  return {
    categories: (categories.data ?? []).map((c) => ({
      slug: c.slug,
      name: c.name,
      parentId: c.parent_id ?? null,
    })),
    cities: (cities.data ?? []).map((c) => ({ slug: c.slug, name: c.name })),
  }
}

/**
 * Runs the checked filters through the same query /discover uses. If a keyword
 * plus a filter finds nothing, it tries once more without the keywords, so
 * "braids in Atlanta" still shows Atlanta hair salons.
 */
async function findListings(filters: GuideFilters): Promise<{ filters: GuideFilters; results: DiscoveryEntity[] }> {
  async function run(f: GuideFilters): Promise<DiscoveryEntity[]> {
    const { entities } = await queryListings({
      q: f.keywords.join(' ') || undefined,
      category: f.category?.slug,
      city: f.city?.slug,
      open_now: f.openNow || undefined,
      page: 1,
    })
    // Sponsored cards are dropped so the guide never counts an impression.
    return entities.filter((e) => !e.sponsored_placement_id).slice(0, GUIDE_MAX_RESULTS)
  }

  const first = await run(filters)
  if (first.length > 0 || filters.keywords.length === 0 || !(filters.category || filters.city)) {
    return { filters, results: first }
  }
  const wider: GuideFilters = { ...filters, keywords: [] }
  return { filters: wider, results: await run(wider) }
}

export async function askGuide(input: unknown): Promise<GuideResponse> {
  // 1. Input.
  const parsed = guideInputSchema.safeParse(input)
  const raw = typeof input === 'string' ? input : ''
  if (!parsed.success) return fallback(raw)
  const text = parsed.data

  // 2. Flag. 3. Kill switch.
  if (!isFeatureEnabled('aiGuide')) return fallback(text)
  if (aiKillSwitchOn()) return fallback(text)

  // 4. Turnstile: skipped in v1, see the header.

  // 5. Rate limit per IP. Both windows are charged on every ask.
  const ip = getClientIp(await headers())
  const [minuteOk, dayOk] = await Promise.all([
    checkRateLimit({ bucket: 'ai_guide', identifier: `min:${ip}`, limit: GUIDE_PER_MINUTE, windowSeconds: 60 }),
    checkRateLimit({ bucket: 'ai_guide', identifier: `day:${ip}`, limit: GUIDE_PER_DAY, windowSeconds: 86_400 }),
  ])
  if (!minuteOk || !dayOk) return fallback(text)

  // 6. and 7. Paid calls only.
  const { provider, model } = resolveProvider(GUIDE_AGENT)
  if (provider === 'anthropic') {
    if (!(await withinMonthlyCeiling())) return fallback(text)
    const ceiling = monthlyCeilingUsd()
    if (ceiling === null) return fallback(text)
    const used = await countAgentAttemptsThisMonth(GUIDE_AGENT.agentType)
    if (!withinGuideBudget(used, monthlyCallBudget(ceiling))) return fallback(text)
  }

  try {
    const allow = await loadAllowList()
    if (!allow) return fallback(text)

    // Emails, phone numbers, street addresses and links never reach the model.
    let words: string
    try {
      words = stripLinks(sanitizeForPrompt(text, 200))
    } catch {
      return fallback(text)
    }
    if (!words.trim()) return fallback(text)

    const built = buildGuidePrompt(words, allow)
    if (!built) return fallback(text)

    const supabase = createServiceClient()
    const { data: row, error: rowError } = await supabase
      .from('ai_generation_requests')
      .insert({
        listing_id: null,
        agent_type: GUIDE_AGENT.agentType,
        prompt_version: GUIDE_PROMPT_VERSION,
        model,
        provider,
        status: 'pending',
        created_by: null,
      })
      .select('id')
      .single()
    if (rowError || !row) return fallback(text)
    const requestId = row.id

    async function close(errorCode: string | null, usage: TokenUsage | null = null): Promise<void> {
      await supabase
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
        answer = mockGuideAnswer(words, built.offered)
      } else {
        const result = await callAnthropic({
          model,
          prompt: built.prompt,
          maxOutputChars: GUIDE_AGENT.maxOutputChars,
          system: GUIDE_SYSTEM_PROMPT,
        })
        answer = result.text
        usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens }
      }
    } catch (err) {
      await close(err instanceof ProviderCallError ? err.code : 'provider_error', err instanceof ProviderCallError ? err.usage : null)
      return fallback(text)
    }

    const checked = parseGuideAnswer(answer, built.offered, words)
    if (!checked.ok) {
      await close(rejectionCode(checked.reason), usage)
      return fallback(text)
    }
    await close(null, usage)

    const filters = checked.filters
    if (isEmptyGuide(filters)) return fallback(text)

    const page = filters.page ? { ...GUIDE_PAGES[filters.page] } : null
    if (!hasSearchFilters(filters)) {
      return { kind: 'results', summary: buildSummary(filters, 0), results: [], seeAllHref: fallbackHref(text), page }
    }

    const found = await findListings(filters)
    return {
      kind: 'results',
      summary: buildSummary(found.filters, found.results.length),
      results: found.results,
      seeAllHref: buildSeeAllHref(found.filters),
      page,
    }
  } catch {
    // A database or search outage. Deliberately drops the error: it could
    // carry the query.
    return fallback(text)
  }
}
