/**
 * The provider seam. Everything that turns an owner's click into a pending
 * suggestion runs through `generate()`.
 *
 * ── This file makes no network call, and today it cannot ─────────────────────
 * `MODEL_BY_TIER` resolves every tier to `null` until the founder picks models
 * at GATE-SPEND, and `ANTHROPIC_API_KEY` is set in no environment. When either
 * is missing, `generate()` runs the mock path and logs `provider = 'mock'`. No
 * SDK is installed and no HTTP client is imported here — the paid path is a
 * documented hole at `callRealProvider`, not a code path one env var away from
 * billing. That is the same shape the paid job postings already use: refuse
 * rather than improvise.
 *
 * ── The audit row is written before the suggestion, always ───────────────────
 * `docs/blacqlist/ai/ai-safety-and-approval-plan.md` requires that every
 * generation attempt — mock included — leaves a row in `ai_generation_requests`
 * *before* any suggestion exists. The order matters for the case that actually
 * goes wrong: a provider call that costs money and then fails. If the audit row
 * were written after success, the failures would be the invisible half of the
 * bill. So the row is inserted first with `status = 'pending'` and closed out as
 * `completed` or `failed`. A crash between the two leaves a `pending` row, which
 * reads honestly as "we started something and cannot prove how it ended".
 *
 * ── Rejected output never becomes a suggestion ───────────────────────────────
 * Validation failures close the audit row as `failed` and return. There is no
 * branch that writes a suggestion row on a rejected response, because a pending
 * suggestion is a thing an owner can approve, and we would be asking them to
 * approve exactly what we refused.
 *
 * ── Writes use the service role, and the caller owns authorization ───────────
 * The RLS on `ai_suggestions` grants owners SELECT and nothing else, and
 * `ai_generation_requests` has no public policy at all — by design, per the
 * migration's own comment. So every write here goes through the service client,
 * which means **RLS is not protecting these writes and the caller's ownership
 * check is**. Every caller of `generate()` must have already proved the
 * signed-in user owns `listingId`. The safety plan states this explicitly for
 * apply ("verifies `listing.owner_user_id = auth.uid()` at the service layer,
 * not just in RLS") and it is equally true here. Do not add a caller that skips
 * it.
 *
 * ── Nothing in this file logs prompt or response text ────────────────────────
 * No `console.*`. The strings moving through here are the two things the safety
 * plan names as never-logged. An error path that printed the response for
 * debugging would undo the whole privacy argument in one line.
 */

import { createServiceClient } from '@/lib/supabase/server'
import {
  MOCK_MODEL,
  MODEL_BY_TIER,
  promptVersionOf,
  type AgentDefinition,
} from './agents'
import { mockResponseFor, type MockContext } from './mock-responses'
import { PROMPT_TEMPLATES } from './prompts'
import {
  MAX_DESCRIPTION_CHARS,
  rejectionCode,
  sanitizeForPrompt,
  validateOutput,
} from './sanitize'

/** Requests per listing per rolling 24 hours. */
export const RATE_LIMIT_PER_LISTING_24H = 10

/**
 * Everything a prompt is allowed to see.
 *
 * This interface is the allowlist, expressed as a type. The safety plan lists
 * the permitted columns in prose; this is the same list in a form the compiler
 * enforces. Adding a field here is the moment to re-read that list — it is not a
 * neutral convenience. There is deliberately no `phone`, `email`, `address`,
 * `owner`, `user_id`, or `social_*` member, and no index signature that would
 * let one arrive by accident.
 */
export interface GenerateContext {
  listingName: string
  categoryName: string
  cityName: string
  tagline: string | null
  /** Raw owner-typed description. Sanitized and truncated before use. */
  description: string | null
  /** Aggregate counts only. Never individual analytics_events rows. */
  pageViews30d: number
  ctaClicks30d: number
  saves30d: number
  shares30d: number
  pageViews7d: number
}

export interface GenerateInput {
  agent: AgentDefinition
  listingId: string
  /** The user who triggered it. Logged for audit; never placed in a prompt. */
  triggeredBy: string
  context: GenerateContext
}

export type GenerateResult =
  | { ok: true; suggestionId: string; provider: 'mock' | 'anthropic' }
  | { ok: false; code: 'rate_limited'; retryAfterHours: number }
  | { ok: false; code: 'rejected'; reason: string }
  | { ok: false; code: 'failed' }

/**
 * Fills `{{placeholders}}`. Any placeholder without a supplied value becomes an
 * empty string rather than being left as `{{tagline}}` — a literal template
 * marker reaching a model is an instruction to talk about the marker.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? '')
}

/**
 * The only function that turns listing data into prompt variables.
 *
 * Every value is either a name, a city, a category, an aggregate count, or a
 * sanitized excerpt. This is where the privacy audit (V2-Mock gate 2) should
 * look, and it is short on purpose so that audit is possible in one reading.
 */
export function buildPromptVars(ctx: GenerateContext): Record<string, string> {
  return {
    listing_name: sanitizeForPrompt(ctx.listingName, 200),
    category_name: sanitizeForPrompt(ctx.categoryName, 100),
    city_name: sanitizeForPrompt(ctx.cityName, 100),
    tagline: sanitizeForPrompt(ctx.tagline, 200),
    description_excerpt: sanitizeForPrompt(ctx.description, MAX_DESCRIPTION_CHARS),
    page_views_30d: String(ctx.pageViews30d),
    cta_clicks_30d: String(ctx.ctaClicks30d),
    saves_30d: String(ctx.saves30d),
    shares_30d: String(ctx.shares30d),
    page_views_7d: String(ctx.pageViews7d),
  }
}

function mockContextOf(ctx: GenerateContext): MockContext {
  return {
    listingName: ctx.listingName,
    categoryName: ctx.categoryName,
    cityName: ctx.cityName,
    tagline: ctx.tagline,
    descriptionExcerpt: sanitizeForPrompt(ctx.description, MAX_DESCRIPTION_CHARS),
    pageViews30d: ctx.pageViews30d,
    ctaClicks30d: ctx.ctaClicks30d,
    saves30d: ctx.saves30d,
  }
}

/**
 * Resolves which provider would run. Exported so a test can assert that the
 * repository in its current state cannot reach a paid provider.
 */
export function resolveProvider(agent: AgentDefinition): {
  provider: 'mock' | 'anthropic'
  model: string
} {
  const model = MODEL_BY_TIER[agent.modelTier]
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY)
  if (model && hasKey) return { provider: 'anthropic', model }
  return { provider: 'mock', model: MOCK_MODEL }
}

/**
 * Counts this listing's generation attempts in the last 24 hours.
 *
 * Counts attempts, not successes: a listing that burned ten requests on
 * responses the validator refused has still cost ten calls, and a limiter that
 * only counted the good ones would let a badly-behaving prompt loop forever at
 * full price. Failures count.
 *
 * Deliberately not routed through `lib/security/rate-limit.ts`. That module is
 * the durable counter for anonymous surfaces and it depends on a migration that
 * has not been applied to any hosted database yet. This is one indexed count
 * against a table that already exists, so it works today and adds no schema.
 */
export async function countRecentRequests(listingId: string): Promise<number> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('ai_generation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .gte('created_at', since)

  // A limiter that cannot read its own counter fails closed: returning the limit
  // blocks the request. The alternative — assume zero — turns a database blip
  // into unmetered spend.
  if (error) return RATE_LIMIT_PER_LISTING_24H
  return count ?? 0
}

/**
 * The paid path. Intentionally not implemented.
 *
 * Wiring this means: an SDK dependency, a resolved model id in `MODEL_BY_TIER`,
 * `ANTHROPIC_API_KEY` in the environment, and the six V2-Mock gates cleared. All
 * four are founder decisions or founder actions, and three of them cost money.
 * Throwing here rather than leaving a plausible stub means no future edit can
 * accidentally turn this into a live call.
 */
async function callRealProvider(): Promise<never> {
  throw new Error('provider_not_wired')
}

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const { agent, listingId, triggeredBy, context } = input

  const used = await countRecentRequests(listingId)
  if (used >= RATE_LIMIT_PER_LISTING_24H) {
    return { ok: false, code: 'rate_limited', retryAfterHours: 24 }
  }

  const { provider, model } = resolveProvider(agent)
  const supabase = createServiceClient()

  // Audit row first — see the header. `pending` until we know how it ended.
  const { data: requestRow, error: requestError } = await supabase
    .from('ai_generation_requests')
    .insert({
      listing_id: listingId,
      agent_type: agent.agentType,
      prompt_version: promptVersionOf(agent),
      model,
      provider,
      status: 'pending',
      created_by: triggeredBy,
    })
    .select('id')
    .single()

  if (requestError || !requestRow) return { ok: false, code: 'failed' }
  const requestId = requestRow.id

  async function closeFailed(errorCode: string): Promise<void> {
    await supabase
      .from('ai_generation_requests')
      .update({ status: 'failed', error_message: errorCode })
      .eq('id', requestId)
  }

  // Assembled even on the mock path. The mock does not read it, but assembling it
  // is what keeps `buildPromptVars` exercised by the same code that will feed the
  // real provider — a prompt bug that only appears once billing is on is the
  // worst possible place to find one.
  const prompt = fillTemplate(PROMPT_TEMPLATES[agent.templateKey], buildPromptVars(context))
  if (!prompt.trim()) {
    await closeFailed('prompt_empty')
    return { ok: false, code: 'failed' }
  }

  let raw: string
  try {
    raw = provider === 'mock' ? mockResponseFor(agent, mockContextOf(context)) : await callRealProvider()
  } catch {
    // No error detail is stored: a provider exception can carry request content.
    await closeFailed('provider_error')
    return { ok: false, code: 'failed' }
  }

  const validated = validateOutput(raw, agent.maxOutputChars)
  if (!validated.ok) {
    await closeFailed(rejectionCode(validated.reason))
    return { ok: false, code: 'rejected', reason: validated.reason }
  }

  const { data: suggestionRow, error: suggestionError } = await supabase
    .from('ai_suggestions')
    .insert({
      listing_id: listingId,
      suggestion_type: agent.suggestionType,
      agent_type: agent.agentType,
      prompt_version: promptVersionOf(agent),
      suggestion_text: validated.text,
      status: 'pending',
      metadata: { provider },
    })
    .select('id')
    .single()

  if (suggestionError || !suggestionRow) {
    await closeFailed('suggestion_insert_failed')
    return { ok: false, code: 'failed' }
  }

  await supabase
    .from('ai_generation_requests')
    .update({ status: 'completed', suggestion_id: suggestionRow.id })
    .eq('id', requestId)

  return { ok: true, suggestionId: suggestionRow.id, provider }
}
