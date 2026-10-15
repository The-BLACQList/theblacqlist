import { parse, type HTMLElement } from 'node-html-parser'
import { WEEK_DAYS, type WeekDay } from '@/lib/listings/hours'
import type { DayHours, SocialLinks, WeeklyHours } from '@/types'

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
//   4. <img> tags at least 400px wide (attributes, srcset or data dimensions),
//      24 candidates at most
//   5. Link-in-bio pages (Linktree and similar): outbound links become the
//      website and socials
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
}

export const MAX_PHOTO_CANDIDATES = 24
export const MIN_PHOTO_WIDTH = 400

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

/** "Glow Salon | Atlanta Hair" becomes "Glow Salon". Hyphenated names survive. */
function firstTitleSegment(title: string): string {
  return title.split(/\s+[|–—·•:]\s+|\s+-\s+/)[0]!.trim()
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
  if (typeof first === 'string') {
    const street = cleanText(first, 200)
    return street ? { street, city: null, state: null, zip: null } : null
  }
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

  if (Object.keys(spans).length === 0) return null
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

  // Name
  const titleText = root.querySelector('title')?.text ?? ''
  const rawName =
    (typeof ld?.name === 'string' ? ld.name : null) ??
    meta('meta[property="og:site_name"]') ??
    meta('meta[property="og:title"]') ??
    (titleText ? titleText : null)
  let name = rawName ? cleanText(firstTitleSegment(rawName), 120) : null
  if (name && isLinkInBio) name = name.replace(/^@/, '')

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

  // Phones and emails
  const phones: string[] = []
  const emails: string[] = []
  for (const tel of strings(ld?.telephone)) pushUnique(phones, formatPhone(tel), (p) => phoneKey(p)!)
  for (const mail of strings(ld?.email)) pushUnique(emails, cleanEmail(mail), (e) => e)

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
    const href = url.toString()
    const existing = photos.find((p) => p.url === href)
    if (existing) {
      if (kind === 'logo') existing.kind = 'logo'
      return
    }
    photos.push({ url: href, kind, width, alt })
  }

  for (const logo of strings(ld?.logo)) addPhoto(logo, 'logo', null, null)
  const ogImage = meta('meta[property="og:image"]') ?? meta('meta[property="og:image:url"]')
  const ogWidth = Number(meta('meta[property="og:image:width"]') ?? NaN)
  addPhoto(ogImage, 'photo', Number.isFinite(ogWidth) ? ogWidth : null, null)
  for (const image of strings(ld?.image)) addPhoto(image, 'photo', null, null)

  for (const img of root.querySelectorAll('img')) {
    const alt = img.getAttribute('alt')?.trim() || null
    const hint = `${alt ?? ''} ${img.getAttribute('class') ?? ''} ${img.getAttribute('id') ?? ''} ${img.getAttribute('src') ?? ''}`
    const looksLikeLogo = /logo/i.test(hint)
    const fromSrcset = largestFromSrcset(img.getAttribute('srcset') ?? img.getAttribute('data-srcset'))
    const src = img.getAttribute('src') ?? img.getAttribute('data-src') ?? null
    const attrWidth = Number(img.getAttribute('width') ?? NaN)
    const dims = /^(\d+)x(\d+)$/.exec(img.getAttribute('data-image-dimensions') ?? '')
    const width = Math.max(
      fromSrcset?.width ?? 0,
      Number.isFinite(attrWidth) ? attrWidth : 0,
      dims ? Number(dims[1]) : 0,
    )
    const url = fromSrcset && fromSrcset.width >= width ? fromSrcset.url : src
    if (!url || url.startsWith('data:')) continue
    if (looksLikeLogo) addPhoto(url, 'logo', width || null, alt)
    else if (width >= MIN_PHOTO_WIDTH) addPhoto(url, 'photo', width, alt)
  }

  const suggestedLogo = photos.find((p) => p.kind === 'logo')?.url ?? null
  const suggestedCover = photos.find((p) => p.kind === 'photo')?.url ?? null

  return {
    sourceHost,
    isLinkInBio,
    name,
    about,
    phones,
    emails,
    address: readAddress(ld?.address),
    hours: readHours(ld),
    socials,
    website,
    photos,
    suggestedLogo,
    suggestedCover,
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
