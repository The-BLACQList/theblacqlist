/**
 * The monthly spending ceiling. The last thing between an owner's click and a
 * paid model call.
 *
 * ── Why a count and not a sum ────────────────────────────────────────────────
 * `ai_generation_requests` has token columns, so summing real spend looks like
 * the obvious design. It undercounts in exactly the cases that matter: a call
 * that timed out after the provider started work, a crash between the call and
 * the audit update, a row still `pending`. Those rows have no token counts, and
 * each one may still be on the bill. So instead every paid attempt this month is
 * charged at the **worst case a single call can cost**, and the ceiling is a
 * number of attempts. Real spend is always at or below what this module thinks
 * it is. That is the right direction to be wrong in.
 *
 * ── The worst case is a real bound, not an estimate ──────────────────────────
 * Output is bounded by `max_tokens`, which we set from each agent's
 * `maxOutputChars`. Input is bounded by `MAX_PROMPT_CHARS`, which `generate()`
 * enforces before any call, and the fixed system prompt. Tokens per character is
 * taken as 2, well above what English text costs on the current tokenizer, so a
 * prompt full of unusual characters still fits under it.
 *
 * ── It fails closed ──────────────────────────────────────────────────────────
 * No ceiling set, a ceiling that does not parse, or a counter that cannot be
 * read all mean "no paid call". The first two route to the mock provider (see
 * `resolveProvider`); the third refuses the request outright.
 *
 * This is our ceiling, not Anthropic's. The console spend limit on the Anthropic
 * account is the second line, and it should be set at or just above this one.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { AI_AGENTS, ASSISTANT_AGENT, GUIDE_AGENT, ONBOARDING_AGENT } from './agents'
import { maxTokensFor, SYSTEM_PROMPT } from './anthropic'

/** Longest filled template `generate()` will send. Longer prompts are refused. */
export const MAX_PROMPT_CHARS = 4000

/**
 * Claude Haiku 5.5 list price, USD per million tokens, for prompts of 100K
 * tokens or fewer (ours are a few thousand at most). Re-check against
 * Anthropic's pricing page whenever the model in `MODEL_BY_TIER` changes.
 */
export const PRICE_PER_MTOK = { input: 0.1, output: 0.5 } as const

/** Deliberately generous; see the header. */
const TOKENS_PER_CHAR_BOUND = 2

/** The most one call by this agent can cost, in USD. */
export function worstCaseUsdPerCall(maxOutputChars: number): number {
  const inputTokens = (MAX_PROMPT_CHARS + SYSTEM_PROMPT.length) * TOKENS_PER_CHAR_BOUND
  const outputTokens = maxTokensFor(maxOutputChars)
  return (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000
}

/**
 * One bound for every agent: the costliest agent's worst case. Cheaper agents
 * are charged as if they were the dearest, which wastes some headroom and keeps
 * the arithmetic one line long.
 */
export function worstCaseUsdAnyAgent(): number {
  return Math.max(
    ...[...AI_AGENTS, ONBOARDING_AGENT, GUIDE_AGENT, ASSISTANT_AGENT].map((a) => worstCaseUsdPerCall(a.maxOutputChars))
  )
}

/** `AI_MONTHLY_CEILING_USD` as a positive number, or null when unset or invalid. */
export function monthlyCeilingUsd(): number | null {
  const raw = process.env.AI_MONTHLY_CEILING_USD
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Paid attempts allowed per calendar month (UTC) under the ceiling. */
export function monthlyCallBudget(ceilingUsd: number): number {
  return Math.floor(ceilingUsd / worstCaseUsdAnyAgent())
}

export function startOfMonthUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/**
 * True when one more paid call fits under this month's ceiling.
 *
 * Counts every `provider = 'anthropic'` attempt since the first of the month,
 * whatever its status. Two requests racing past the check together can go one
 * call over; at a fraction of a cent per call that is accepted rather than
 * locked against.
 */
export async function withinMonthlyCeiling(now: Date = new Date()): Promise<boolean> {
  const ceiling = monthlyCeilingUsd()
  if (ceiling === null) return false

  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('ai_generation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'anthropic')
    .gte('created_at', startOfMonthUtc(now))

  if (error || count === null) return false
  return count < monthlyCallBudget(ceiling)
}

/**
 * Paid attempts by one agent since the first of the month (UTC), whatever their
 * status. The home page visitor guide (ticket 146) uses it for its own share of
 * the budget. Fails closed: an unreadable counter returns `Infinity`, which is
 * over every share.
 */
export async function countAgentAttemptsThisMonth(agentType: string, now: Date = new Date()): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('ai_generation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'anthropic')
    .eq('agent_type', agentType)
    .gte('created_at', startOfMonthUtc(now))

  if (error || count === null) return Number.POSITIVE_INFINITY
  return count
}
