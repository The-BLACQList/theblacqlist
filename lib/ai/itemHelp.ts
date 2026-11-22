/**
 * Ticket 242: AI help on one thing at a time (a review reply, a Happening Now
 * post, a product or service, an event, a job). Shared by the server pages that
 * decide whether to show the help and the client card that asks for it, so
 * nothing here imports server code or the prompt registry.
 *
 * Which plan each one needs is the agent's own gate in `lib/ai/agents.ts`;
 * `ITEM_AGENT_GATE` repeats it here for the client, and a test keeps the two
 * the same (tests/ai-help-by-plan.test.ts).
 */

import { canAccess, type GatedFeature } from '@/lib/stripe/features'
import type { ItemInput } from './itemFacts'

export type ItemAgentType =
  | 'review_response'
  | 'happening_now_post'
  | 'offering_description'
  | 'event_description'
  | 'job_description'

export const ITEM_AGENT_GATE: Record<ItemAgentType, Extract<GatedFeature, 'ai_suggestions' | 'ai_item_writeups'>> = {
  review_response: 'ai_suggestions',
  happening_now_post: 'ai_suggestions',
  offering_description: 'ai_item_writeups',
  event_description: 'ai_item_writeups',
  job_description: 'ai_item_writeups',
}

/** The button. Never says "AI" (tests/ai-writing-help.test.ts). */
export const ITEM_WRITE_BUTTON: Record<ItemAgentType, string> = {
  review_response: 'Write a reply for me',
  happening_now_post: 'Write a post for me',
  offering_description: 'Write a description for me',
  event_description: 'Write a description for me',
  job_description: 'Write a description for me',
}

/**
 * What the card shows: the button, a locked note naming the plan it comes
 * with, or nothing. Nothing when AI help is off, or when the plan it comes with
 * can't be bought right now (a closed plan is never offered).
 */
export type ItemHelp = { state: 'on' } | { state: 'locked'; plan: 'Starter' | 'Growth' } | null

/**
 * The plan rule without the availability read. `growthOpen` says whether
 * Growth can be bought; Starter always can.
 */
export function itemHelpFor(
  tier: string | null,
  agentType: ItemAgentType,
  opts: { aiOn: boolean; growthOpen: boolean }
): ItemHelp {
  if (!opts.aiOn) return null
  if (!canAccess(tier, 'ai_suggestions')) return { state: 'locked', plan: 'Starter' }
  if (canAccess(tier, ITEM_AGENT_GATE[agentType])) return { state: 'on' }
  return opts.growthOpen ? { state: 'locked', plan: 'Growth' } : null
}

/**
 * A Happening Now suggestion is two lines: the headline, then one more line.
 * Each is trimmed to the form's own limit so Use this never overfills a box.
 */
export function splitPostText(
  text: string,
  limits: { headline: number; body: number }
): { headline: string; body: string } {
  const [first, ...rest] = text.split('\n')
  return {
    headline: (first ?? '').trim().slice(0, limits.headline),
    body: rest.join(' ').replace(/\s+/g, ' ').trim().slice(0, limits.body),
  }
}

/**
 * A service form's name, description and price as an offering to write about.
 * Both offering forms (add and edit) use the same field names. Null with no
 * name yet. The checked copy is made on the server (parseItemInput).
 */
export function offeringFromForm(form: HTMLFormElement | null): ItemInput | null {
  if (!form) return null
  const data = new FormData(form)
  const read = (key: string) => data.get(key)?.toString().trim() ?? ''
  const name = read('name')
  if (!name) return null
  return {
    kind: 'offering',
    offeringType: 'service',
    name,
    notes: read('description') || null,
    price: read('price_display') || null,
  }
}

/** The post form's two fields as one text, for Put mine back. */
export function joinPostText(headline: string, body: string): string {
  return body ? `${headline}\n${body}` : headline
}
