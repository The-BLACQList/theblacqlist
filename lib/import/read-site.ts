import { parse, type HTMLElement } from 'node-html-parser'
import { WEEK_DAYS, type WeekDay } from '@/lib/listings/hours'
import { MAX_PHOTO_CANDIDATES } from '@/lib/import/limits'
import type { DayHours, SocialLinks, WeeklyHours } from '@/types'
import { pickBannerPhoto } from '@/lib/media/banner'

// =============================================================================
// Reading an owner's public page into draft fields (ticket 127)
// =============================================================================
// Pure: HTML and the page's URL in, suggestions out. No network, no database,
// so every rule here is tested on saved fixtures.
//
// Sources, most trusted first:
//   1. JSON-LD LocalBusiness or Organization (name, description, phone, email,
//      address, hours, logo, images, sameAs)
//   2. Open Graph and meta tags
//   3. Page links: tel:, mailto:, and known social hosts
//   4. <img> tags at least 400px wide (attributes, srcset, data dimensions or
//      a width in the image host's URL), 24 candidates at most
//   5. Images that are not <img>: lazy-load data-src attributes and CSS
//      background images, which website builders use for gallery photos
//   6. Website builder data (the `window._site` object of Web.com, FatCow and
//      similar): name, address and opening hours when nothing better said
//   7. Link-in-bio pages (Linktree and similar): outbound links become the
//      website and socials
//
// It also keeps the page's visible text (`siteText`), which the writing help
// may use to draft an About from the owner's own words.
//
// Nothing here is saved. The owner confirms or edits every field, and only the
// photos they pick are ever downloaded.
// =============================================================================

export type SocialKey = keyof SocialLinks

export interface FoundAddress {
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export interface PhotoCandidate {
  url: string
  kind: 'logo' | 'photo'
  /** Known pixel width, when the page said. */
  width: number | null
  alt: string | null
}

export interface SiteFindings {
  /** Host the page came from, e.g. `glowsalon.com`. */
  sourceHost: string
  isLinkInBio: boolean
  name: string | null
  /**
   * Every plausible name on the page, best guess first: the parts of the
   * title, the site name, the logo text, the main heading. Sites write their
   * titles every which way, so the owner picks. Empty when none was found.
   */
  nameOptions: string[]
  about: string | null
  /** Every distinct phone found, most trusted first. Two or more means "Which is right?". */
  phones: string[]
  emails: string[]
  address: FoundAddress | null
  hours: WeeklyHours | null
  socials: Partial<SocialLinks>
  website: string | null
  photos: PhotoCandidate[]
  suggestedLogo: string | null
  suggestedCover: string | null
  /**
   * The page's visible headings, paragraphs and list items, deduped, without
   * menus, headers, footers or forms. For drafting an About; never saved as is.
   */
  siteText: string | null
}

export { MAX_PHOTO_CANDIDATES }
export const MIN_PHOTO_WIDTH = 400
export const MAX_SITE_TEXT = 4000

// ── Hosts ───────────────────────────────────────────────────────────────────

const SOCIAL_HOSTS: Record<string, SocialKey> = {
  'instagram.com': 'instagram',
  'instagr.am': 'instagram',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'fb.me': 'facebook',
  'linkedin.com': 'linkedin',
  'tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
}

/** Paths on social hosts that are share buttons, posts or tracking, not a profile. */
const SOCIAL_JUNK_PATH =
  /^\/(sharer|share|sharing|shareArticle|intent|dialog|plugins|hashtag|tr|p|reel|reels|explore|watch|embed|shorts|login|signup|home)(\/|\.php|$)/i

const LINK_IN_BIO_HOSTS = new Set([
  'linktr.ee',
  'beacons.ai',
  'lnk.bio',
  'linkin.bio',
  'bio.link',
  'campsite.bio',
  'tap.bio',
  'stan.store',
  'solo.to',
  'msha.ke',
  'linkpop.com',
  'hoo.be',
])

/** Outbound links on link-in-bio pages that are never the owner's website. */
const NOT_A_WEBSITE_HOSTS = new Set([
  'apps.apple.com',
  'play.google.com',
  'linktree.com',
  'help.linktr.ee',
  'cookiepedia.co.uk',
])

/** Addresses that show up in page code but are never the business. */
const JUNK_EMAIL_DOMAINS = /(^|\.)(example\.(com|org)|sentry\.io|wixpress\.com|sentry-next\.wixpress\.com|domain\.com|email\.com)$/i

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '')
}

function toUrl(raw: string | null | undefined, base: string): URL | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim(), base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

// ── Text ────────────────────────────────────────────────────────────────────

/** Strips tags and entities and collapses whitespace. */
function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null
  const text = parse(value).text.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max).trimEnd() : text
}

/** Title segments that name the page, not the business. */
const GENERIC_SEGMENT = /^(home|home ?page|welcome|index|main|official (web)?site|official page)$/i

/**
 * Where a title splits into parts: " | ", " - ", " – ", " » ", " / ", " ~ ",
 * " : ", " :: ", and a bare "|". A hyphen inside a word ("Jean-Paul") doesn't.
 */
const TITLE_SEPARATOR = /\s+(?:[|–—·•:»›~\/]|::)\s+|\s+-\s+|\s*\|\s*/

/** The parts of a title, trimmed, in order. */
export function titleParts(title: string): string[] {
  return title
    .split(TITLE_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean)
}

const squash = (v: string): string => v.toLowerCase().replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/**
 * The business name in a page title. "Glow Salon | Atlanta Hair" becomes
 * "Glow Salon", and "Home - Cakes & Treats" becomes "Cakes & Treats": words
 * like "Home" name the page, not the business. A segment that matches one of
 * `hints` (the site name, a logo title, a heading) wins. Hyphenated names
 * survive, and so does a name that only starts with a generic word.
 */
export function titleName(title: string, hints: readonly (string | null | undefined)[] = []): string {
  const segments = titleParts(title)
  const real = segments.filter((p) => !GENERIC_SEGMENT.test(p))
  const wanted = new Set(hints.filter((h): h is string => Boolean(h && h.trim())).map(squash))
  return real.find((p) => wanted.has(squash(p))) ?? real[0] ?? segments[0] ?? title.trim()
}

const MAX_NAME_OPTIONS = 6
/** Longer than this is a sentence or a tagline, not a name. */
const MAX_NAME_OPTION = 80

/**
 * The names to offer, `best` first: every part of every source, without
 * page words ("Home"), repeats, or anything sentence-long.
 */
export function nameChoices(
  best: string | null,
  sources: readonly (string | null | undefined)[],
  isLinkInBio = false
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: string | null | undefined) => {
    let text = cleanText(raw, 200)
    if (!text) return
    if (isLinkInBio) text = text.replace(/^@/, '')
    if (text.length < 2 || text.length > MAX_NAME_OPTION || GENERIC_SEGMENT.test(text)) return
    const key = squash(text)
    if (seen.has(key)) return
    seen.add(key)
    out.push(text)
  }
  add(best)
  for (const source of sources) {
    if (!source) continue
    for (const part of titleParts(source)) add(part)
  }
  return out.slice(0, MAX_NAME_OPTIONS)
}

const JUNK_ABOUT = /\blinktree\b|make your link do more|link in bio|\bbeacons\b/i

/** Decodes a fetched page, honoring a `<meta charset>` near the top. */
export function decodeHtml(body: Buffer): string {
  const head = body.subarray(0, 4096).toString('latin1')
  const match = /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head)
  const label = match?.[1]?.toLowerCase() ?? 'utf-8'
  try {
    return new TextDecoder(label).decode(body)
  } catch {
    return new TextDecoder('utf-8').decode(body)
  }
}

// ── Phones and emails ───────────────────────────────────────────────────────

function phoneKey(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  return digits.length >= 7 && digits.length <= 15 ? digits : null
}

/** Some sites list several numbers in one field: "(773) 555-0100, (708) 555-0101". */
function splitPhones(raw: string): string[] {
  return raw.split(/[,;\/|]|\s+or\s+/i).map((p) => p.trim()).filter(Boolean)
}

function formatPhone(raw: string): string | null {
  const key = phoneKey(raw)
  if (!key) return null
  if (key.length === 10) return `(${key.slice(0, 3)}) ${key.slice(3, 6)}-${key.slice(6)}`
  return raw.trim()
}

function cleanEmail(raw: string): string | null {
  const email = decodeURIComponent(raw.replace(/^mailto:/i, '').split('?')[0] ?? '')
    .trim()
    .toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (JUNK_EMAIL_DOMAINS.test(email.split('@')[1] ?? '')) return null
  return email
}

function pushUnique<T>(list: T[], value: T | null, key: (v: T) => string): void {
  if (value === null) return
  const k = key(value)
  if (!list.some((v) => key(v) === k)) list.push(value)
}

// ── JSON-LD ─────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>

const BUSINESS_TYPE =
  /(LocalBusiness|Organization|Store|Restaurant|Salon|Shop|Cafe|CafeOrCoffeeShop|Bakery|BarOrPub|Dentist|Physician|MedicalBusiness|HealthAndBeautyBusiness|BeautySalon|HairSalon|NailSalon|DaySpa|ExerciseGym|SportsActivityLocation|ProfessionalService|LegalService|Attorney|AccountingService|FinancialService|RealEstateAgent|AutomotiveBusiness|AutoRepair|HomeAndConstructionBusiness|FoodEstablishment|LodgingBusiness|EntertainmentBusiness|ChildCare|Corporation|NGO)$/

function typesOf(node: Json): string[] {
  const t = node['@type']
  const list = Array.isArray(t) ? t : [t]
  return list
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.replace(/^https?:\/\/schema\.org\//, ''))
}

function flattenLd(value: unknown, out: Json[]): void {
  if (Array.isArray(value)) {
    for (const v of value) flattenLd(v, out)
    return
  }
  if (!value || typeof value !== 'object') return
  const node = value as Json
  out.push(node)
  if (node['@graph']) flattenLd(node['@graph'], out)
}

function readJsonLd(root: HTMLElement): Json | null {
  const nodes: Json[] = []
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      flattenLd(JSON.parse(script.rawText.trim()), nodes)
    } catch {
      // A broken block on someone's site is not our error. Skip it.
    }
  }
  const scored = nodes
    .map((node) => {
      const types = typesOf(node)
      const isBusiness = types.some((t) => BUSINESS_TYPE.test(t))
      const fields = ['telephone', 'address', 'openingHoursSpecification', 'openingHours', 'email']
      const filled = fields.filter((f) => node[f] !== undefined).length
      const local = types.some((t) => t !== 'Organization' && t !== 'Corporation')
      return { node, score: isBusiness ? 10 + filled + (local ? 1 : 0) : 0 }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.node ?? null
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') {
    const url = (value as Json).url ?? (value as Json).contentUrl
    return typeof url === 'string' ? [url] : []
  }
  return []
}

function readAddress(value: unknown): FoundAddress | null {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first === 'string') return readAddressText(first)
  if (!first || typeof first !== 'object') return null
  const a = first as Json
  const found: FoundAddress = {
    street: cleanText(a.streetAddress, 200),
    city: cleanText(a.addressLocality, 120),
    state: cleanText(a.addressRegion, 60),
    zip: cleanText(typeof a.postalCode === 'number' ? String(a.postalCode) : a.postalCode, 20),
  }
  return found.street || found.city || found.state || found.zip ? found : null
}

const COUNTRY = /^(united states( of america)?|usa|us)$/i

/**
 * Squarespace and others write the address as one string, usually
 * "436 E 47th St\nChicago, IL, 60653\nUnited States". Splits out the US
 * city, state and zip when they are there; otherwise keeps it all as street.
 */
function readAddressText(raw: string): FoundAddress | null {
  const parts = raw
    .split(/\n|,/)
    .map((p) => cleanText(p, 200))
    .filter((p): p is string => Boolean(p))
  if (parts.length === 0) return null
  if (parts.length > 1 && COUNTRY.test(parts[parts.length - 1]!)) parts.pop()

  let state: string | null = null
  let zip: string | null = null
  const last = parts[parts.length - 1] ?? ''
  const stateZip = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(last)
  if (stateZip) {
    state = stateZip[1]!.toUpperCase()
    zip = stateZip[2]!
    parts.pop()
  } else if (/^\d{5}(?:-\d{4})?$/.test(last)) {
    zip = last
    parts.pop()
  }
  if (!state && parts.length > 1 && /^[A-Za-z]{2}$/.test(parts[parts.length - 1]!)) {
    state = parts.pop()!.toUpperCase()
  }

  // Without a state we can't tell the city from the street, so keep the text whole.
  if (!state || parts.length < 2) {
    const street = cleanText(raw.replace(/\n/g, ', '), 200)
    return street ? { street, city: null, state: null, zip: null } : null
  }
  const city = parts.pop()!
  return { street: parts.join(', ').slice(0, 200), city: city.slice(0, 120), state, zip }
}

// ── Hours ───────────────────────────────────────────────────────────────────

const DAY_NAMES: Record<string, WeekDay> = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
  mo: 'monday',
  tu: 'tuesday',
  we: 'wednesday',
  th: 'thursday',
  fr: 'friday',
  sa: 'saturday',
  su: 'sunday',
}

/** "9:00", "09:00:00", "9:00 PM" become 24-hour "HH:MM". */
function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?\s*$/i.exec(raw)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const meridiem = m[3]?.toLowerCase().replace(/\./g, '')
  if (meridiem === 'pm' && h < 12) h += 12
  if (meridiem === 'am' && h === 12) h = 0
  if (h === 24 && min === 0) return '24:00'
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

type DaySpans = Partial<Record<WeekDay, { open: string; close: string }[]>>

function addSpan(spans: DaySpans, day: WeekDay, opens: string, closes: string): void {
  // Schema.org: 00:00 to 00:00 means closed that day.
  if (opens === '00:00' && closes === '00:00') {
    spans[day] ??= []
    return
  }
  // The open-now check compares minutes within one day, so a midnight close
  // is stored as 23:59.
  const close = closes === '00:00' || closes === '24:00' ? '23:59' : closes
  ;(spans[day] ??= []).push({ open: opens, close })
}

function daysFrom(value: unknown): WeekDay[] {
  return strings(value)
    .map((d) => d.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase())
    .map((d) => DAY_NAMES[d])
    .filter((d): d is WeekDay => Boolean(d))
}

function expandDayRange(token: string): WeekDay[] {
  const parts = token.split(/\s*-\s*/)
  const start = DAY_NAMES[parts[0]!.toLowerCase()]
  const end = parts[1] ? DAY_NAMES[parts[1].toLowerCase()] : start
  if (!start || !end) return []
  const out: WeekDay[] = []
  let i = WEEK_DAYS.indexOf(start)
  for (let guard = 0; guard < 7; guard++) {
    out.push(WEEK_DAYS[i]!)
    if (WEEK_DAYS[i] === end) break
    i = (i + 1) % 7
  }
  return out
}

function readHours(node: Json | null): WeeklyHours | null {
  if (!node) return null
  const spans: DaySpans = {}

  const specs = node.openingHoursSpecification
  for (const spec of Array.isArray(specs) ? specs : specs ? [specs] : []) {
    if (!spec || typeof spec !== 'object') continue
    const s = spec as Json
    // Holiday or seasonal hours are not the regular week.
    if (s.validFrom || s.validThrough) continue
    const opens = normalizeTime(s.opens)
    const closes = normalizeTime(s.closes)
    if (!opens || !closes) continue
    for (const day of daysFrom(s.dayOfWeek)) addSpan(spans, day, opens, closes)
  }

  // The short text form: "Mo-Fr 09:00-17:00", "Sa,Su 10:00-14:00".
  const DAY = '(?:Mo|Tu|We|Th|Fr|Sa|Su)'
  const pattern = new RegExp(
    `(${DAY}(?:\\s*[-,]\\s*${DAY})*)\\s+(\\d{1,2}:\\d{2})\\s*-\\s*(\\d{1,2}:\\d{2})`,
    'gi',
  )
  for (const text of strings(node.openingHours)) {
    for (const m of text.matchAll(pattern)) {
      const opens = normalizeTime(m[2])
      const closes = normalizeTime(m[3])
      if (!opens || !closes) continue
      for (const token of m[1]!.split(/\s*,\s*/)) {
        for (const day of expandDayRange(token)) addSpan(spans, day, opens, closes)
      }
    }
  }

  return weekFromSpans(spans)
}

function weekFromSpans(spans: DaySpans): WeeklyHours | null {
  if (!Object.values(spans).some((list) => list && list.length > 0)) return null
  const week = {} as WeeklyHours
  for (const day of WEEK_DAYS) {
    const list = spans[day] ?? []
    if (list.length === 0) {
      week[day] = { open: '09:00', close: '17:00', closed: true }
      continue
    }
    // A split day (9 to 12, then 1 to 5) shows as one span, earliest to latest.
    const open = list.map((s) => s.open).sort()[0]!
    const close = list.map((s) => s.close).sort().at(-1)!
    week[day] = { open, close, closed: false } satisfies DayHours
  }
  return week
}

// ── Images ──────────────────────────────────────────────────────────────────

function largestFromSrcset(srcset: string | undefined): { url: string; width: number } | null {
  if (!srcset) return null
  let best: { url: string; width: number } | null = null
  for (const part of srcset.split(',')) {
    const [url, descriptor] = part.trim().split(/\s+/)
    const width = descriptor?.endsWith('w') ? Number(descriptor.slice(0, -1)) : NaN
    if (url && Number.isFinite(width) && (!best || width > best.width)) best = { url, width }
  }
  return best
}

function isRasterCandidate(url: URL): boolean {
  return !/\.(svg|gif|ico)(\?|$)/i.test(url.pathname)
}

/**
 * The pixel width an image host was asked for, read from the URL, or null.
 * Website builders often say nothing else about an image's size.
 */
export function widthFromUrl(raw: string): number | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const full = decodeURIComponent(url.href)
  const n = (v: string | undefined): number | null => {
    const w = Number(v)
    return Number.isFinite(w) && w > 0 && w < 20000 ? w : null
  }
  // Web.com / FatCow / builderservices: methods=crop,…|resize,900,5000
  const methods = url.searchParams.get('methods')
  if (methods) {
    const all = [...methods.matchAll(/resize,(\d+)/g)]
    const last = all.at(-1)?.[1]
    if (last) return n(last)
  }
  // Wix: /v1/fill/w_980,h_600,…
  const wix = /\/(?:fill|fit|crop)\/w_(\d+),/.exec(full)
  if (wix) return n(wix[1])
  // GoDaddy: /:/rs=w:1200,h:600
  const godaddy = /\/rs=w:(\d+)/.exec(full)
  if (godaddy) return n(godaddy[1])
  // Squarespace: ?format=1500w
  const format = /^(\d+)w$/.exec(url.searchParams.get('format') ?? '')
  if (format) return n(format[1])
  // Shopify: name_800x.jpg or name_800x600.jpg
  const shopify = /_(\d+)x\d*\.(?:jpe?g|png|webp)$/i.exec(url.pathname)
  if (shopify) return n(shopify[1])
  return n(url.searchParams.get('w') ?? url.searchParams.get('width') ?? undefined)
}

/** Photos on a CDN wrap the real file in `url=`; the same file in two sizes is one photo. */
function photoKey(href: string): string {
  try {
    const inner = new URL(href).searchParams.get('url')
    return inner ?? href
  } catch {
    return href
  }
}

const NOT_A_PHOTO = /icon|avatar|sprite|placeholder|spinner|loading|badge|emoji|flag/i

// ── Website builder data ────────────────────────────────────────────────────

interface BuilderData {
  name: string | null
  address: FoundAddress | null
  hours: WeeklyHours | null
  phone: string | null
  email: string | null
}

const BUILDER_DAYS: Record<string, WeekDay> = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
}

/** The largest `window._site` we will parse. Real ones are about 20 KB. */
const MAX_BUILDER_JSON = 500_000

/**
 * Web.com, FatCow and other builders on the same platform put the site's
 * settings in `window._site = {…}`: company name, address and opening hours.
 */
function readBuilderData(root: HTMLElement): BuilderData | null {
  for (const script of root.querySelectorAll('script')) {
    const text = script.rawText
    const at = text.indexOf('window._site')
    if (at === -1) continue
    const start = text.indexOf('{', at)
    if (start === -1 || text.length - start > MAX_BUILDER_JSON) continue
    const end = text.lastIndexOf('}')
    let data: Json
    try {
      data = JSON.parse(text.slice(start, end + 1)) as Json
    } catch {
      continue
    }
    const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
    const metadata = obj(data.metadata)
    const binding = obj(data.globalBinding)
    const name = cleanText(metadata.siteName ?? metadata.companyName ?? binding.companyName, 120)

    const a = obj(binding.address)
    const address: FoundAddress = {
      street: cleanText(a.street, 200),
      city: cleanText(a.city, 120),
      state: cleanText(a.state, 60),
      zip: cleanText(typeof a.zip === 'number' ? String(a.zip) : a.zip, 20),
    }

    const spans: DaySpans = {}
    for (const [key, list] of Object.entries(obj(binding.openingHours))) {
      const day = BUILDER_DAYS[key.toLowerCase()]
      if (!day || !Array.isArray(list)) continue
      spans[day] ??= []
      for (const item of list) {
        const span = obj(item)
        const opens = normalizeTime(span.opening)
        const closes = normalizeTime(span.closing)
        if (opens && closes) addSpan(spans, day, opens, closes)
      }
    }

    const phone = typeof binding.phone === 'string' ? binding.phone.replace(/[\u200e\u200f\u202a-\u202e]/g, '') : null
    return {
      name,
      address: address.street || address.city || address.state || address.zip ? address : null,
      hours: weekFromSpans(spans),
      phone,
      email: typeof binding.email === 'string' ? binding.email : null,
    }
  }
  return null
}

// ── Visible text ────────────────────────────────────────────────────────────

const HIDDEN_TEXT = new Set(['nav', 'header', 'footer', 'script', 'style', 'form', 'noscript', 'template', 'svg', 'button'])

function isHiddenText(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentNode as HTMLElement | null) {
    const tag = node.rawTagName?.toLowerCase()
    if (tag && HIDDEN_TEXT.has(tag)) return true
    if (node.getAttribute?.('aria-hidden') === 'true') return true
    const role = node.getAttribute?.('role')
    if (role === 'navigation' || role === 'banner' || role === 'contentinfo') return true
  }
  return false
}

/** Headings, paragraphs and list items a visitor reads, once each, at most MAX_SITE_TEXT characters. */
function readSiteText(root: HTMLElement): string | null {
  const seen = new Set<string>()
  const lines: string[] = []
  let size = 0
  for (const el of root.querySelectorAll('h1, h2, h3, p, li')) {
    if (isHiddenText(el)) continue
    // A list item that wraps paragraphs is read through them.
    if (el.rawTagName.toLowerCase() === 'li' && el.querySelector('p, h1, h2, h3')) continue
    const line = el.text.replace(/\s+/g, ' ').trim()
    if (line.length < 3 || !/[a-z]/i.test(line)) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (size + line.length + 1 > MAX_SITE_TEXT) break
    lines.push(line)
    size += line.length + 1
  }
  const text = lines.join('\n').trim()
  return text.length >= 40 ? text : null
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * Reads `html` (fetched from `pageUrl`, after redirects) into draft
 * suggestions. Never throws on odd markup; missing data comes back empty.
 */
export function readSite(html: string, pageUrl: string): SiteFindings {
  const page = new URL(pageUrl)
  const sourceHost = bareHost(page.hostname)
  const isLinkInBio = LINK_IN_BIO_HOSTS.has(sourceHost)
  const root = parse(html)
  const ld = readJsonLd(root)

  const meta = (selector: string): string | null =>
    root.querySelector(selector)?.getAttribute('content')?.trim() || null

  const builder = readBuilderData(root)

  // Name
  const titleText = root.querySelector('title')?.text ?? ''
  const siteName = meta('meta[property="og:site_name"]')
  const logoTitle = root
    .querySelector('[class*="logo-title"], [class*="site-title"], [class*="site-name"]')
    ?.text.trim()
  const heading = root.querySelector('h1')?.text.trim()
  // Only names the site gives itself break a tie between title parts. The main
  // heading is often a tagline that is also in the title, so it never does.
  const hints = [siteName, builder?.name, logoTitle]
  const ldName = typeof ld?.name === 'string' ? ld.name : null
  const ogTitle = meta('meta[property="og:title"]')
  const rawName = ldName ?? siteName ?? ogTitle ?? (titleText ? titleText : null)
  let name = rawName ? cleanText(titleName(rawName, hints), 120) : null
  // A title that only names the page ("Home") is no name at all.
  if ((!name || GENERIC_SEGMENT.test(name)) && builder?.name) name = cleanText(titleName(builder.name, hints), 120)
  if (name && GENERIC_SEGMENT.test(name)) name = null
  if (name && isLinkInBio) name = name.replace(/^@/, '')
  const nameOptions = nameChoices(name, [ldName, siteName, builder?.name, logoTitle, ogTitle, titleText, heading], isLinkInBio)

  // About
  const aboutCandidates = [
    ld?.description,
    meta('meta[property="og:description"]'),
    meta('meta[name="description"]'),
  ]
  let about: string | null = null
  for (const candidate of aboutCandidates) {
    const text = cleanText(candidate)
    if (text && !JUNK_ABOUT.test(text)) {
      about = text
      break
    }
  }

  // No description in the page's tags: the first real paragraph a visitor reads.
  const siteText = isLinkInBio ? null : readSiteText(root)
  if (!about && siteText) {
    const lead = siteText.split('\n').find((line) => line.length >= 60 && /[.!?]$/.test(line) && !JUNK_ABOUT.test(line))
    if (lead) about = lead
  }

  // Phones and emails
  const phones: string[] = []
  const emails: string[] = []
  for (const tel of strings(ld?.telephone).flatMap(splitPhones)) pushUnique(phones, formatPhone(tel), (p) => phoneKey(p)!)
  for (const mail of strings(ld?.email)) pushUnique(emails, cleanEmail(mail), (e) => e)
  if (builder?.phone) pushUnique(phones, formatPhone(builder.phone), (p) => phoneKey(p)!)
  if (builder?.email) pushUnique(emails, cleanEmail(builder.email), (e) => e)

  // Links: tel, mailto, socials, and (on link-in-bio pages) the website
  const socials: Partial<SocialLinks> = {}
  let website: string | null = isLinkInBio ? null : `${page.origin}/`
  const considerSocial = (url: URL): boolean => {
    const key = SOCIAL_HOSTS[bareHost(url.hostname)]
    if (!key) return false
    if (!SOCIAL_JUNK_PATH.test(url.pathname) && url.pathname.length > 1 && !socials[key]) {
      url.hash = ''
      url.search = ''
      socials[key] = url.toString()
    }
    return true
  }
  for (const sameAs of strings(ld?.sameAs)) {
    const url = toUrl(sameAs, pageUrl)
    if (url) considerSocial(url)
  }
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')?.trim() ?? ''
    if (/^tel:/i.test(href)) {
      pushUnique(phones, formatPhone(decodeURIComponent(href.slice(4))), (p) => phoneKey(p)!)
      continue
    }
    if (/^mailto:/i.test(href)) {
      pushUnique(emails, cleanEmail(href), (e) => e)
      continue
    }
    const url = toUrl(href, pageUrl)
    if (!url) continue
    if (considerSocial(url)) continue
    const host = bareHost(url.hostname)
    if (
      isLinkInBio &&
      !website &&
      host !== sourceHost &&
      !LINK_IN_BIO_HOSTS.has(host) &&
      !NOT_A_WEBSITE_HOSTS.has(host)
    ) {
      website = url.toString()
    }
  }

  // Photos
  const photos: PhotoCandidate[] = []
  const addPhoto = (raw: string | null | undefined, kind: PhotoCandidate['kind'], width: number | null, alt: string | null): void => {
    if (photos.length >= MAX_PHOTO_CANDIDATES) return
    const url = toUrl(raw, pageUrl)
    if (!url || !isRasterCandidate(url)) return
    // An http image on an https page is blocked in the browser. Most hosts serve both.
    if (url.protocol === 'http:' && page.protocol === 'https:') url.protocol = 'https:'
    const href = url.toString()
    const key = photoKey(href)
    const existing = photos.find((p) => photoKey(p.url) === key)
    if (existing) {
      if (kind === 'logo') existing.kind = 'logo'
      return
    }
    photos.push({ url: href, kind, width: width ?? widthFromUrl(href), alt })
  }

  for (const logo of strings(ld?.logo)) addPhoto(logo, 'logo', null, null)
  const ogImage = meta('meta[property="og:image"]') ?? meta('meta[property="og:image:url"]')
  const ogWidth = Number(meta('meta[property="og:image:width"]') ?? NaN)
  const ogHeight = Number(meta('meta[property="og:image:height"]') ?? NaN)
  // Many sites share their wordmark: a file named "logo", or a thin banner.
  const ogIsLogo =
    /logo/i.test(ogImage ?? '') || (ogWidth > 0 && ogHeight > 0 && ogWidth / ogHeight > 4)
  addPhoto(ogImage, ogIsLogo ? 'logo' : 'photo', Number.isFinite(ogWidth) ? ogWidth : null, null)
  for (const image of strings(ld?.image)) addPhoto(image, 'photo', null, null)

  for (const img of root.querySelectorAll('img')) {
    const alt = img.getAttribute('alt')?.trim() || null
    const hint = `${alt ?? ''} ${img.getAttribute('class') ?? ''} ${img.getAttribute('id') ?? ''} ${img.getAttribute('src') ?? ''}`
    const looksLikeLogo = /logo/i.test(hint)
    const fromSrcset = largestFromSrcset(img.getAttribute('srcset') ?? img.getAttribute('data-srcset'))
    const src = img.getAttribute('src') ?? img.getAttribute('data-src') ?? null
    const attrWidth = Number(img.getAttribute('width') ?? NaN)
    const dims = /^(\d+)x(\d+)$/.exec(img.getAttribute('data-image-dimensions') ?? '')
    const fromAttrs = Math.max(
      fromSrcset?.width ?? 0,
      Number.isFinite(attrWidth) ? attrWidth : 0,
      dims ? Number(dims[1]) : 0,
    )
    const url = fromSrcset && fromSrcset.width >= fromAttrs ? fromSrcset.url : src
    if (!url || url.startsWith('data:')) continue
    const width = fromAttrs || (toUrl(url, pageUrl) ? widthFromUrl(toUrl(url, pageUrl)!.href) ?? 0 : 0)
    if (looksLikeLogo) addPhoto(url, 'logo', width || null, alt)
    else if (width >= MIN_PHOTO_WIDTH) addPhoto(url, 'photo', width, alt)
  }

  // Images that are not <img>: website builders lazy-load gallery photos into
  // divs (data-src, with larger copies in data-src-normal and -retina) or
  // paint them as CSS backgrounds.
  const lazy = root.querySelectorAll(
    '[data-src-retina], [data-src-normal], [data-src], [data-bg], [data-background-image], [style*="background-image"]',
  )
  for (const el of lazy) {
    if (photos.length >= MAX_PHOTO_CANDIDATES) break
    if (el.rawTagName.toLowerCase() === 'img') continue
    const marks = `${el.getAttribute('class') ?? ''} ${el.getAttribute('id') ?? ''}`
    if (NOT_A_PHOTO.test(marks)) continue
    const styleUrl = /background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(el.getAttribute('style') ?? '')?.[1]
    const options = [
      el.getAttribute('data-src-retina'),
      el.getAttribute('data-src-normal'),
      el.getAttribute('data-src'),
      el.getAttribute('data-bg'),
      el.getAttribute('data-background-image'),
      styleUrl,
    ]
      .map((raw) => (raw && !raw.startsWith('data:') ? toUrl(raw, pageUrl) : null))
      .filter((u): u is URL => u !== null)
      .map((u) => ({ href: u.href, width: widthFromUrl(u.href) }))
    if (options.length === 0) continue
    const best = options.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a))
    const alt = el.getAttribute('aria-label')?.trim() || el.getAttribute('title')?.trim() || null
    if (/logo/i.test(`${marks} ${alt ?? ''}`)) addPhoto(best.href, 'logo', best.width, alt)
    else if ((best.width ?? 0) >= MIN_PHOTO_WIDTH) addPhoto(best.href, 'photo', best.width, alt)
  }

  const suggestedLogo = photos.find((p) => p.kind === 'logo')?.url ?? null
  // The first photo wide enough to stay sharp across the top of the page.
  const suggestedCover = pickBannerPhoto(photos)?.url ?? null

  return {
    sourceHost,
    isLinkInBio,
    name,
    nameOptions,
    about,
    phones,
    emails,
    address: readAddress(ld?.address) ?? builder?.address ?? null,
    hours: readHours(ld) ?? builder?.hours ?? null,
    socials,
    website,
    photos,
    suggestedLogo,
    suggestedCover,
    siteText,
  }
}

/**
 * True when the page gave us something beyond a title. A name alone is not
 * worth a "From your site" screen: parked domains and error pages have one.
 */
export function hasUsefulFindings(f: SiteFindings): boolean {
  return Boolean(
    f.about ||
      f.phones.length ||
      f.emails.length ||
      f.address ||
      f.hours ||
      Object.keys(f.socials).length ||
      f.photos.length ||
      (f.isLinkInBio && f.website),
  )
}
