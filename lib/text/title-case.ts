// Ticket 205. The BLACQList house style: titles, headings, buttons, nav, tabs,
// badges and form field labels are written in Title Case ("Add a Listing",
// "Claim a Business", "Where Else to Find Us"). Running sentences, placeholders
// and anything an owner, reviewer or the database supplies are never rewritten.
// The rule lives in docs/blacqlist/design/title-case.md; this module is its one
// implementation, used by the scanner in scripts/title-case/ and its guard test.
//
// The helper is for authoring and checking literal UI strings in source. Pages
// do not call it at runtime: the strings are written in Title Case in the code.

/** Short words kept lowercase unless they come first or last. */
export const MINOR_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'but',
  'or',
  'nor',
  'for',
  'so',
  'yet',
  'as',
  'at',
  'by',
  'in',
  'of',
  'off',
  'on',
  'per',
  'to',
  'up',
  'via',
  'with',
  'from',
  'into',
  'over',
  'vs',
  'vs.',
])

/**
 * Phrasal verbs whose particle is part of the verb ("Sign In", "Set Up",
 * "Show Up"). Keyed by verb, so "Show on Map" and "Open in Maps" keep their
 * prepositions lowercase while "How You Show Up on Google" capitalizes "Up".
 */
const PHRASAL: Readonly<Record<string, readonly string[]>> = {
  sign: ['in', 'up', 'on', 'off'],
  log: ['in', 'on', 'off'],
  set: ['up'],
  check: ['in'],
  opt: ['in'],
  turn: ['on', 'off'],
  switch: ['on', 'off'],
  follow: ['up'],
  look: ['up'],
  pick: ['up'],
  fill: ['in'],
  show: ['up'],
  clean: ['up'],
  top: ['up'],
  back: ['up'],
  drop: ['off'],
  lock: ['in'],
  bring: ['in'],
  start: ['over'],
  hand: ['over'],
  sum: ['up'],
  mix: ['up'],
}

/**
 * Spellings that never change, matched case-insensitively. A word that already
 * carries a capital past its first letter (BLACQList, iOS, AI, URL) is left as
 * written, so this list only needs words that could be typed all lowercase.
 */
export const PRESERVE: Readonly<Record<string, string>> = {
  blacqlist: 'BLACQList',
  blacqlight: 'BLACQLight',
  ios: 'iOS',
  iphone: 'iPhone',
  ipad: 'iPad',
  faq: 'FAQ',
  faqs: 'FAQs',
  url: 'URL',
  ein: 'EIN',
  pdf: 'PDF',
  csv: 'CSV',
  ai: 'AI',
  qr: 'QR',
  sms: 'SMS',
  'e.g.': 'e.g.',
  'i.e.': 'i.e.',
  'etc.': 'etc.',
  // Units after a number stay lowercase ("5 mi", "10 min").
  mi: 'mi',
  km: 'km',
  min: 'min',
  mins: 'mins',
  hr: 'hr',
  hrs: 'hrs',
}

/** Names that include "The": the word stays capitalized before them. */
const THE_NAMES: ReadonlySet<string> = new Set(['blacqlist', 'collective', 'blacqlight'])

// Punctuation that starts a new title segment, so the next word is "first".
const SEGMENT_BREAK = /[:—–|·?!]$/

function isSkippable(core: string): boolean {
  // Handles, links, emails, hashtags, code-ish tokens and numbers stay as written.
  return (
    core.length === 0 ||
    /[@/\\_#=<>{}]/.test(core) ||
    /^www\./i.test(core) ||
    /\.(com|org|net|io|co)$/i.test(core) ||
    !/[a-z]/i.test(core)
  )
}

function hasInnerCapital(core: string): boolean {
  return /[A-Z]/.test(core.slice(1))
}

function capitalize(part: string): string {
  const i = part.search(/[a-z]/i)
  if (i < 0) return part
  return part.slice(0, i) + part.charAt(i).toUpperCase() + part.slice(i + 1)
}

function caseWord(core: string, mode: 'cap' | 'lower'): string {
  const preserved = PRESERVE[core.toLowerCase()]
  // An all-caps word that only looks like a unit is an acronym ("HR & Staffing").
  if (preserved && !(/^[A-Z]{2,}$/.test(core) && preserved === preserved.toLowerCase())) {
    return preserved
  }
  // A brand-style spelling (BLACQList, iOS) is checked per hyphen part, so
  // "Link-In-Bio" can still be corrected while "Wi-Fi" keeps its capitals.
  if (!core.includes('-') && hasInnerCapital(core)) return core
  if (mode === 'lower') return core.toLowerCase()
  // Hyphenated words capitalize each part ("Black-Owned", "Sign-In") except a
  // minor word in the middle ("Link-in-Bio", "Up-to-Date").
  const parts = core.split('-')
  return parts
    .map((p, i) => {
      const pre = PRESERVE[p.toLowerCase()]
      if (pre) return pre
      if (i > 0 && i < parts.length - 1 && MINOR_WORDS.has(p.toLowerCase())) return p.toLowerCase()
      return hasInnerCapital(p) ? p : capitalize(p)
    })
    .join('-')
}

export interface TitleCaseOptions {
  /** The text continues a label that started before it (after a `{value}`). */
  continuesBefore?: boolean
  /** The label continues after this text (a `{value}` or element follows). */
  continuesAfter?: boolean
}

// HTML entities in JSX text (&apos; &amp; &rsquo;) are swapped for private-use
// characters while casing, so "&amp;" never turns into "&Amp;".
const ENTITY = /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g

/** Converts a short label to Title Case without touching brand spellings. */
export function toTitleCase(raw: string, opts: TitleCaseOptions = {}): string {
  const entities: string[] = []
  const input = raw.replace(ENTITY, (e) => {
    entities.push(e)
    return String.fromCharCode(0xe000 + entities.length - 1)
  })
  // Keep the exact whitespace so JSX text and indentation survive a rewrite.
  const tokens = input.split(/(\s+)/)
  const wordIdx: number[] = []
  tokens.forEach((t, i) => {
    if (t && !/^\s+$/.test(t)) wordIdx.push(i)
  })

  // Splits a word into leading punctuation, the word itself and trailing
  // punctuation: '“Add' → ['“', 'Add', ''], 'page?' → ['', 'page', '?'].
  const splitWord = (token: string): [string, string, string] => {
    const m = token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9.]*)$/)
    return m ? [m[1] ?? '', m[2] ?? '', m[3] ?? ''] : ['', token, '']
  }
  const nextCore = (n: number) => {
    const ti = wordIdx[n + 1]
    return ti === undefined ? '' : splitWord(tokens[ti] ?? '')[1]
  }

  let prevCore = ''
  let segmentStart = !opts.continuesBefore
  wordIdx.forEach((ti, n) => {
    const token = tokens[ti] ?? ''
    const [lead, coreRaw, trailRaw] = splitWord(token)
    let core = coreRaw
    let trail = trailRaw
    // A trailing full stop on an abbreviation stays with the core ("e.g."),
    // anything else goes back to the trailing punctuation.
    if (core.endsWith('.') && !PRESERVE[core.toLowerCase()]) {
      trail = '.' + trail
      core = core.slice(0, -1)
    }

    const isFirst = segmentStart || /^[("'“‘[]/.test(lead)
    const isLast = n === wordIdx.length - 1 && !opts.continuesAfter
    const lower = core.toLowerCase()

    let out = core
    if (!isSkippable(core) && !/[@#]/.test(lead)) {
      const minor =
        MINOR_WORDS.has(lower) &&
        !isFirst &&
        !isLast &&
        !(PHRASAL[prevCore.toLowerCase()] ?? []).includes(lower) &&
        // "The" in "The BLACQList" and "The Collective" is part of the name.
        !(lower === 'the' && THE_NAMES.has(nextCore(n).toLowerCase()))
      out = caseWord(core, minor ? 'lower' : 'cap')
    }

    tokens[ti] = lead + out + trail
    prevCore = core
    segmentStart = SEGMENT_BREAK.test(token)
  })

  return tokens.join('').replace(/[\ue000-\uf8ff]/g, (c) => entities[c.charCodeAt(0) - 0xe000] ?? c)
}

/** True when the label already follows the house Title Case rule. */
export function isTitleCase(input: string, opts?: TitleCaseOptions): boolean {
  return toTitleCase(input, opts) === input
}
