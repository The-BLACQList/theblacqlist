/**
 * Checks on what Cue writes (ticket 169).
 *
 * Cue writes its own replies now, so two things guard them on the way out:
 *
 * - While the reply streams, `TextGuard` passes on whole words only and holds
 *   back anything that could still turn into a phone number or a link, then
 *   takes out links, emails and phone numbers. A visitor never sees half a
 *   phone number flash up and vanish.
 * - When the reply ends, `checkReply` looks for the name of a listed business
 *   that no tool returned this turn (a made-up recommendation), and for an
 *   ownership label anywhere in the reply. Either one swaps the whole reply
 *   for a plain fixed line. The cards stay, because the tools chose them.
 *
 * Plain functions with no server imports, so the tests run them directly.
 * Nothing here logs.
 */

/** One published listing, for the name check. */
export interface CueName {
  id: string
  name: string
}

/** The line a swapped reply becomes when there are cards. */
export const SWAP_WITH_CARDS = "Here's what I found."
/** The line a swapped reply becomes when there are none. */
export const SWAP_NO_CARDS = "Sorry, I couldn't answer that one. Try a search for it instead."
/** The line an ownership label becomes when there are no cards (founder, 2026-10-31). */
export const SWAP_SAME_TERMS = "Every business here is listed on the same terms. Tell me what you need and I'll help you find it."

/** A finished reply is cut to about this many characters. */
export const CUE_REPLY_MAX_CHARS = 1200

/** Longest a held-back tail can get before it is let through anyway. */
const HOLD_MAX = 300

const MD_LINK = /\[([^\]\n]{1,200})\]\([^)\n]*\)/g
const URL = /\b(?:https?:\/\/|www\.)\S+/gi
const BARE_DOMAIN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co|io|biz|us|info|shop|app)\b(?:\/\S*)?/gi
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// Same shape as the prompt-side pattern in lib/ai/sanitize.ts: ten or more
// digits with the usual separators. A year or a price never matches.
const PHONE = /(?:\+?\d[\s().-]{0,2}){9,}\d/g
const PHONE_TAIL = /[\d(+][\d\s().-]*$/
const EM_DASH = /\s*—\s*/g
const REMOVED = /\[removed\]/gi

/** Links, emails and phone numbers out; em dashes become commas. */
export function redactReply(text: string): string {
  return text
    .replace(MD_LINK, '$1')
    .replace(URL, '')
    .replace(EMAIL, '')
    .replace(BARE_DOMAIN, '')
    .replace(PHONE, '')
    .replace(REMOVED, '')
    .replace(EM_DASH, ', ')
}

/** Where the safe part of a streaming buffer ends. */
function safeCut(buf: string): number {
  let cut = Math.max(buf.lastIndexOf(' '), buf.lastIndexOf('\n')) + 1
  const tail = PHONE_TAIL.exec(buf)
  if (tail && /\d/.test(tail[0])) cut = Math.min(cut, tail.index)
  const open = buf.lastIndexOf('[')
  if (open >= 0 && buf.indexOf(')', open) < 0) cut = Math.min(cut, open)
  return cut
}

/**
 * Streams the reply on in safe pieces. Push each text delta as it arrives and
 * call `end()` once the reply is over.
 */
export class TextGuard {
  private held = ''

  constructor(private readonly emit: (text: string) => void) {}

  push(delta: string): void {
    this.held += delta
    let cut = safeCut(this.held)
    if (cut === 0 && this.held.length > HOLD_MAX) cut = this.held.length
    if (cut === 0) return
    const out = redactReply(this.held.slice(0, cut))
    this.held = this.held.slice(cut)
    if (out) this.emit(out)
  }

  end(): void {
    const out = redactReply(this.held)
    this.held = ''
    if (out) this.emit(out)
  }
}

/** Cuts at the last sentence end inside the limit, or at a word. */
function capLength(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (sentence > max / 2) return head.slice(0, sentence + 1)
  const word = head.lastIndexOf(' ')
  return `${head.slice(0, word > 0 ? word : max).trimEnd()}...`
}

/** The finished reply as the visitor keeps it. */
export function cleanReply(text: string, max = CUE_REPLY_MAX_CHARS): string {
  const out = redactReply(text)
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim()
  return capLength(out, max)
}

/** A reply cut off by the token cap ends at its last full sentence. */
export function lastFullSentence(text: string): string {
  const end = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'))
  return end > 0 ? text.slice(0, end + 1) : ''
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when the word at `index` starts a sentence, where any word is capitalized. */
function startsSentence(text: string, index: number): boolean {
  const before = text.slice(0, index).trimEnd()
  return before === '' || /[.!?:\n*-]$/.test(before)
}

/**
 * True when the reply names a listed business that no tool returned this turn
 * and that wasn't on the cards from last turn.
 *
 * Case-sensitive, whole words. A name of two or more words must appear as the
 * phrase. A one-word name counts only when it is six letters or longer and
 * not the first word of a sentence, so a business called "Fresh" or "Nourish"
 * doesn't swap an honest reply that opens with the word.
 */
export function namesUnreturned(args: {
  text: string
  names: readonly CueName[]
  allowedIds: ReadonlySet<string>
  /** Names that are fine to say: returned businesses, the page, categories, cities. */
  skipNames: readonly string[]
}): boolean {
  const skip = new Set(args.skipNames.map((n) => n.trim().toLowerCase()))
  for (const { id, name } of args.names) {
    if (args.allowedIds.has(id)) continue
    const trimmed = name.trim()
    if (!trimmed || skip.has(trimmed.toLowerCase())) continue
    const multi = /\s/.test(trimmed)
    if (!multi && trimmed.length < 6) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(trimmed)}(?![\\p{L}\\p{N}])`, 'gu')
    for (const m of args.text.matchAll(re)) {
      if (multi || !startsSentence(args.text, m.index)) return true
    }
  }
  return false
}

const IDENTITY = /\b(?:black|minority)[- ](?:owned|led)\b|\bally\b/i

/** True when the reply carries an ownership label. */
export function hasIdentityLabel(text: string): boolean {
  return IDENTITY.test(text)
}

/**
 * The final check. Returns the text to keep and whether it was swapped.
 * An ownership label swaps every reply, with or without cards. With no cards
 * it becomes the fixed same-terms line, so Cue never says a label itself.
 */
export function checkReply(args: {
  text: string
  hasCards: boolean
  names: readonly CueName[]
  allowedIds: ReadonlySet<string>
  skipNames: readonly string[]
}): { text: string; swapped: boolean } {
  const swapLine = args.hasCards ? SWAP_WITH_CARDS : SWAP_NO_CARDS
  if (namesUnreturned(args)) return { text: swapLine, swapped: true }
  if (hasIdentityLabel(args.text)) {
    return { text: args.hasCards ? SWAP_WITH_CARDS : SWAP_SAME_TERMS, swapped: true }
  }
  return { text: args.text, swapped: false }
}
