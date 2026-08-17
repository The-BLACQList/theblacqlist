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
  return input.replace(EMAIL_PATTERN, '[removed]').replace(PHONE_PATTERN, '[removed]')
}

/**
 * Prepares one free-text field for prompt assembly: tags out, contact details
 * out, length capped.
 *
 * Truncation happens last so the cap is on what actually gets sent, and it cuts
 * on a word boundary — a prompt ending mid-word invites the model to complete
 * the word rather than the task.
 */
export function sanitizeForPrompt(input: string | null | undefined, maxChars: number): string {
  if (!input) return ''
  const cleaned = redactContactPatterns(stripHtml(input))
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
