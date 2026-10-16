/**
 * Sanitization on the way in, validation on the way out.
 *
 * Both directions exist because a language model sits between two things we care
 * about: the community's personal data, and the copy that ends up on a public
 * business page. Neither check is about the model behaving badly — they are about
 * what happens when it behaves normally on input we did not intend to send.
 *
 * ── Inbound: the allowlist is the real defence, this is the second one ───────
 * `docs/blacqlist/ai/ai-safety-and-approval-plan.md` names exactly which columns
 * may appear in a prompt, and `buildPromptVars` in provider.ts only ever reads
 * those. So in principle nothing here has anything to remove. It runs anyway
 * because the allowlisted fields are themselves free text an owner typed: a
 * business description with "call me on 555-0100" in it carries a phone number
 * into a prompt through a column that is on the allowlist. The allowlist governs
 * which fields; this governs what is inside them.
 *
 * What comes out of owner text before any prompt: email addresses, phone
 * numbers, street addresses and P.O. boxes, and the signed-in owner's own name
 * (redact.ts). That list is the Privacy Policy's promise, so shrinking it is a
 * policy change, not a refactor.
 *
 * ── Outbound: the model can hand back PII it was never given ─────────────────
 * A model asked for a call to action will sometimes invent a phone number. If
 * that reaches `listings.meta_description` it is published, wrong, and looks
 * authoritative. Anything with a contact pattern in it is refused rather than
 * cleaned, because a description with the phone number silently deleted reads as
 * a complete sentence that no longer says what the model meant.
 *
 * ── Refusals are failures, not empty suggestions ─────────────────────────────
 * Every rejection here returns a reason and the caller writes
 * `ai_generation_requests.status = 'failed'` with **no** `ai_suggestions` row.
 * A rejected generation must never become a pending suggestion an owner can
 * approve — that would put the thing we refused in front of the person least
 * equipped to know why it was refused.
 *
 * There is no `console.log` in this file and there must not be one: the strings
 * passing through are exactly the prompt and response text the safety plan
 * forbids logging.
 */

import {
  PromptRedactionError,
  REDACTED,
  redactOwnerName,
  redactStreetAddresses,
} from './redact'

export { ownerNameTerms, PromptRedactionError, REDACTED } from './redact'

/** Longest description excerpt that may enter a prompt. */
export const MAX_DESCRIPTION_CHARS = 500
/** Longest review text that may enter a prompt (Review Response agent only). */
export const MAX_REVIEW_CHARS = 1000
/** Absolute output ceiling regardless of agent. Longer than this is a hallucination signal. */
export const MAX_OUTPUT_CHARS = 2000

// Deliberately loose. A false positive costs one refused generation the owner can
// retry; a false negative publishes a contact detail. The asymmetry decides the
// tuning.
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
// Ten-or-more-digit runs allowing the usual separators: 555-555-0100,
// (555) 555 0100, +1.555.555.0100. Deliberately does not match a bare 4-digit
// year or a price.
const PHONE_PATTERN = /(?:\+?\d[\s().-]{0,2}){9,}\d/
// Global copies for redaction, so every match is replaced and not just the
// first. Kept separate because `.test()` on a global pattern carries state
// between calls, which would make validateOutput skip matches.
const EMAIL_PATTERN_ALL = new RegExp(EMAIL_PATTERN.source, 'gi')
const PHONE_PATTERN_ALL = new RegExp(PHONE_PATTERN.source, 'g')

/**
 * Refusal phrases. Matched at the start only — a description that discusses what
 * a business cannot do is legitimate copy; a response that opens by declining is
 * the model talking to us, not to the owner's customers.
 */
const REFUSAL_PREFIXES = [
  'i cannot',
  "i can't",
  'i am unable',
  "i'm unable",
  'i apologize',
  'as an ai',
  'sorry, i',
  "i'm sorry",
  'i am sorry',
] as const

/**
 * Removes tags and decodes nothing — the output is used as plain text only.
 *
 * Script and style bodies go with their tags rather than surviving as text.
 * Nothing here is rendered as HTML, so this is not an XSS defense; it is to keep
 * a stray pasted `<script>` block from arriving in a prompt as instructions.
 */
export function stripHtml(input: string): string {
  return input
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function redactContactPatterns(input: string): string {
  return input.replace(EMAIL_PATTERN_ALL, REDACTED).replace(PHONE_PATTERN_ALL, REDACTED)
}

/** Per-request redaction settings for {@link sanitizeForPrompt}. */
export interface PromptRedaction {
  /**
   * From `ownerNameTerms(names, businessName)`. Empty when the owner has no name
   * on file. Leave it empty for the business name field itself: the owner's
   * name is never removed from the name of their own business.
   */
  ownerNameTerms: readonly string[]
}

export const NO_NAME_REDACTION: PromptRedaction = { ownerNameTerms: [] }

/**
 * Prepares one field for prompt assembly: tags out, email and phone out, street
 * addresses out, the owner's own name out, length capped.
 *
 * Fails closed. If any redaction step throws, this throws
 * {@link PromptRedactionError} (a fixed code, no text) instead of returning the
 * text half-cleaned, and the caller must not send the prompt.
 *
 * Truncation happens last so the cap is on what actually gets sent, and it cuts
 * on a word boundary — a prompt ending mid-word invites the model to complete
 * the word rather than the task.
 */
export function sanitizeForPrompt(
  input: string | null | undefined,
  maxChars: number,
  redaction: PromptRedaction = NO_NAME_REDACTION
): string {
  if (!input) return ''
  let cleaned: string
  try {
    cleaned = redactOwnerName(
      redactStreetAddresses(redactContactPatterns(stripHtml(input))),
      redaction.ownerNameTerms
    )
  } catch {
    // Deliberately drops the error: it could quote the text being cleaned.
    throw new PromptRedactionError()
  }
  if (cleaned.length <= maxChars) return cleaned
  const cut = cleaned.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

export type OutputRejection =
  | 'empty'
  | 'too_long'
  | 'refusal'
  | 'contains_email'
  | 'contains_phone'

export type OutputValidation =
  | { ok: true; text: string }
  | { ok: false; reason: OutputRejection }

/**
 * Decides whether a generated response may become a pending suggestion.
 *
 * `maxChars` is the agent's own ceiling from the registry, capped by
 * MAX_OUTPUT_CHARS. An SEO title is meant to be under 60 characters; accepting
 * 1,900 of them because the global ceiling allows it would mean the owner's
 * review step is the only thing between a wall of text and their page title.
 */
export function validateOutput(raw: string, maxChars: number): OutputValidation {
  const text = raw.trim()
  if (!text) return { ok: false, reason: 'empty' }

  const ceiling = Math.min(maxChars, MAX_OUTPUT_CHARS)
  if (text.length > ceiling) return { ok: false, reason: 'too_long' }

  const opening = text.toLowerCase()
  if (REFUSAL_PREFIXES.some((p) => opening.startsWith(p))) {
    return { ok: false, reason: 'refusal' }
  }

  if (EMAIL_PATTERN.test(text)) return { ok: false, reason: 'contains_email' }
  if (PHONE_PATTERN.test(text)) return { ok: false, reason: 'contains_phone' }

  return { ok: true, text }
}

/**
 * The short, data-free string written to `ai_generation_requests.error_message`.
 *
 * The safety plan allows an error *type* in that column and forbids anything
 * carrying data. These constants are the whole vocabulary — the offending text
 * is never stored, so there is no path from a failed generation back to the
 * content that failed.
 */
export function rejectionCode(reason: OutputRejection): string {
  return `output_rejected:${reason}`
}

/**
 * What the owner reads when a suggestion is rejected.
 *
 * Most reasons stay vague on purpose: "contains_phone" is meaningful to us and
 * alarming to an owner who did nothing wrong, and the audit row keeps the code.
 * A refusal is the exception. It almost always means the page has too little
 * for the model to work from, so "try again" would only spend another request.
 */
export function ownerRejectionMessage(reason: OutputRejection): string {
  if (reason === 'refusal') {
    return "There isn't enough on your page yet to write this. Add a few lines about your business, then try again."
  }
  return "That suggestion didn't pass our checks. Try requesting it again."
}
