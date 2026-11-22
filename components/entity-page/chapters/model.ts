import type {
  DayHours,
  EntityPageData,
  HoursOverride,
  ReviewCriterion,
  TrustTier,
  WeeklyHours,
} from '@/types'
import { toTitleCase } from '@/lib/text/title-case'
import type { ItemHelp } from '@/lib/ai/itemHelp'
import { reviewReplyHelp } from '@/lib/ai/itemHelpServer'
import { TIER_MEANING } from '@/components/ui/status-badge'
import {
  getCtaHref,
  getEntityCtaLabel,
  getSecondaryMessageHref,
  isMessagingUnavailable,
} from '@/components/entity-page/templates/cta'
import { messageButtonLabel, postingKind } from '@/lib/messaging/postings'
import { directionsUrl } from '@/lib/listings/directions'
import { locationPins, type LocationPin } from '@/lib/listings/locationPins'
import { resolveEntityCover } from '@/lib/listings/exampleAssets'
import { normalizeSocialUrl, SOCIAL_PLATFORMS } from '@/lib/listings/social'

/**
 * The chapters layout's view model (ticket 204). Pure and server-side: the
 * page turns an EntityPageData into the plain strings and numbers Creative's
 * approved prototype renders, so the components stay simple and the same
 * model can later be fed from a live listing.
 *
 * Opening status, today's row and the holiday list are worked out in the
 * listing's own time zone (Atlanta for the sample), not the server's, so a
 * render on a UTC server at 9 pm Atlanta time still says "Closed, opens 7 am
 * tomorrow". Listings carry no time zone yet, so live pages (ticket 231) use
 * the same Eastern default as today's OpenStatus.
 *
 * Two modes. The sample pages pass no viewer, and every action stays a held
 * `data-off` button. A live listing page (ticket 231) passes the viewer, and
 * the model adds `live`: real hrefs and the viewer state the action
 * components need. Sections that wait for pass 2 (booking, shop, jobs, events,
 * related listings) are left empty in live mode, so they do not render.
 */

export const LISTING_TIME_ZONE = 'America/New_York'

export const pad = (n: number) => String(n).padStart(2, '0')

/** "Amara Johnson" → "AJ". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Minutes after midnight → "7 am", "6:30 pm". */
export function t12(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${((h + 11) % 12) + 1}${m ? `:${pad(m)}` : ''}${h < 12 ? ' am' : ' pm'}`
}

/** "HH:MM" → minutes after midnight. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 4 → "4 days ago". */
export function ago(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

/**
 * Wall-clock "now" in `timeZone`, as a Date whose local getters (getDay,
 * getHours, getDate) read that zone's wall time. Only for calendar maths.
 */
export function zonedNow(now: Date, timeZone = LISTING_TIME_ZONE): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute)
  )
}

const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

/** Date-key ("2026-11-26") → a local Date at midnight. */
function fromKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', o).format(d)

/** "Mon, Nov 24". */
export const dayLabel = (d: Date) => fmt(d, { weekday: 'short', month: 'short', day: 'numeric' })

const WEEK = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
] as const

type Span = { open: number; close: number } | null

function spanOf(h: DayHours | undefined | null): Span {
  if (!h || h.closed) return null
  return { open: minutesOf(h.open), close: minutesOf(h.close) }
}

/** Monday-first index of a JS day (Sunday 0). */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

function hoursOn(week: WeeklyHours, overrides: readonly HoursOverride[], d: Date): Span {
  const o = overrides.find((x) => x.date === dateKey(d))
  if (o) {
    if (o.closed || !o.open || !o.close) return null
    return { open: minutesOf(o.open), close: minutesOf(o.close) }
  }
  return spanOf(week[WEEK[mondayIndex(d)]?.[0] ?? 'monday'])
}

export interface StatusView {
  open: boolean
  text: string
  sub: string
}

/** "Open Now · until 6 pm", or "Closed · opens 7 am tomorrow". Overrides win over the week. */
export function statusFor(
  week: WeeklyHours,
  overrides: readonly HoursOverride[],
  zoned: Date
): StatusView | null {
  const nowMin = zoned.getHours() * 60 + zoned.getMinutes()
  const today = hoursOn(week, overrides, zoned)
  if (today && nowMin >= today.open && nowMin < today.close)
    return { open: true, text: 'Open Now', sub: `until ${t12(today.close)}` }
  if (today && nowMin < today.open)
    return { open: false, text: 'Closed', sub: `opens ${t12(today.open)} today` }
  for (let i = 1; i <= 7; i++) {
    const d = addDays(zoned, i)
    const h = hoursOn(week, overrides, d)
    if (h)
      return {
        open: false,
        text: 'Closed',
        sub:
          i === 1
            ? `opens ${t12(h.open)} tomorrow`
            : `opens ${WEEK[mondayIndex(d)]?.[1] ?? ''} at ${t12(h.open)}`,
      }
  }
  return null
}

export interface HoursRow {
  day: string
  hours: string
  today: boolean
}

export function hoursRows(week: WeeklyHours, zoned: Date): HoursRow[] {
  const ti = mondayIndex(zoned)
  return WEEK.map(([key, day], i) => {
    const s = spanOf(week[key])
    return { day, hours: s ? `${t12(s.open)} – ${t12(s.close)}` : 'Closed', today: i === ti }
  })
}

export interface OverrideRow {
  key: string
  label: string
  hours: string
}

/** Special hours after today and within 30 days, soonest first. */
export function overrideRows(overrides: readonly HoursOverride[], zoned: Date): OverrideRow[] {
  const from = dateKey(zoned)
  const to = dateKey(addDays(zoned, 30))
  return [...overrides]
    .filter((o) => o.date > from && o.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => ({
      key: o.date,
      label: `${dayLabel(fromKey(o.date))} · ${o.label}`,
      hours:
        o.closed || !o.open || !o.close
          ? 'Closed'
          : `${t12(minutesOf(o.open))} – ${t12(minutesOf(o.close))}`,
    }))
}

// ─── The view model ────────────────────────────────────────────────────────────

export interface ChapterDef {
  id: string
  nav: string
  title: string
}

export interface Photo {
  src: string
  alt: string
}

export interface GlidePhoto extends Photo {
  album: string
  ar: string
}

export interface FindRow {
  id: string
  name: string
  where: string
  /** Live pages only: where the row's action goes. No href, no action. */
  href?: string | null
}

export interface EventRow {
  id: string
  day: string
  month: string
  title: string
  when: string
  where: string
}

export interface DealView {
  id: string
  title: string
  desc: string
  code: string | null
  terms: string | null
}

export interface MenuGroup {
  name: string
  items: { id: string; name: string; price: string; desc: string }[]
}

export interface ReviewView {
  id: string
  who: string
  rating: number
  ago: string
  verified: boolean
  title: string
  body: string
  response: string | null
  photos: Photo[]
}

export interface PersonView {
  id: string
  name: string
  role: string
  bio: string
  photo: Photo | null
}

export interface HappeningView {
  id: string
  title: string
  body: string
  image: Photo | null
  button: string | null
}

/** A hero badge. `tier` set means a trust tier: a round TrustMark (DR-004). */
export interface BadgeView {
  label: string
  tier: 0 | 1 | 2 | 3 | null
}

/** A footer link. Null href on the sample pages, where links are held. */
export interface LinkView {
  label: string
  href: string | null
}

/** What a live page's actions need: real destinations and the viewer's state. */
export interface LiveView {
  listingId: string
  listingSlug: string
  listingName: string
  cityName: string | null
  categoryName: string
  initialSaved: boolean
  cta: { href: string; label: string } | null
  message: { href: string; label: string } | null
  /** "Message" is the main CTA and the inbox is closed. */
  messagingClosed: boolean
  directionsHref: string | null
  pins: LocationPin[]
  lat: number | null
  lng: number | null
  /** 'write' shows the review form; 'sign_in' links to sign-in; null hides it. */
  review: 'write' | 'sign_in' | null
  signInHref: string
  reviewCriteria: ReviewCriterion[]
  hasReviews: boolean
  isOwner: boolean
  /** Ticket 242: AI help under the owner's reply box. Null for everyone else. */
  replyHelp?: ItemHelp
  claimHref: string | null
}

/** The viewer, for a live listing page. Absent on the sample pages. */
export interface LiveInput {
  initialSaved: boolean
  userId: string | null
  isOwner: boolean
  hasReviewed: boolean
  /** The page's own path, for the sign-in return. */
  path: string
}

export interface ChapterData {
  name: string
  logo: Photo | null
  cover: Photo | null
  category: string
  tagline: string
  rating: number
  reviewCount: number
  facts: string[]
  badges: BadgeView[]
  /** The city, for "More Like This in Atlanta"; null leaves the place out. */
  place: string | null
  /** The trust line under reviews and its short form in the footer; null hides both. */
  trust: { line: string; short: string } | null
  glance: string[]
  status: StatusView | null
  address: string[]
  phone: string | null
  cta: string
  chapters: ChapterDef[]
  story: string[]
  happening: HappeningView[]
  highlights: { id: string; title: string; text: string }[]
  /** The highlights the owner marked as steps: "how we work". */
  steps: { id: string; title: string; text: string }[]
  /** Reasons with a client's words lifted verbatim from a review (preset.why). */
  why: { id: string; title: string; text: string; quote: string; who: string }[]
  founded: number | null
  founder: PersonView | null
  team: PersonView[]
  hours: HoursRow[]
  overrides: OverrideRow[]
  locations: FindRow[]
  findUs: FindRow[]
  orderOn: FindRow[]
  events: EventRow[]
  deals: DealView[]
  menu: MenuGroup[]
  booking: string | null
  shop: {
    total: number
    items: (Photo & { id: string; name: string; price: string; kind: string })[]
  } | null
  gallery: GlidePhoto[]
  videos: { id: string; title: string; source: string; note: string; href: string | null }[]
  reviews: ReviewView[]
  pull: { quote: string; who: string } | null
  criteria: { name: string; average: number }[]
  credentials: { id: string; kind: string; title: string; issuer: string; year: number | null }[]
  faq: { id: string; q: string; a: string }[]
  attributes: { group: string; values: string[] }[]
  links: LinkView[]
  jobs: { id: string; title: string; type: string; pay: string; desc: string }[]
  related: { id: string; name: string; tagline: string; rating: number; reviews: number }[]
  /** Set on a live listing page; null on the sample pages. */
  live: LiveView | null
}

/** Per-layout choices the listing data does not carry (see presets.ts). */
export interface ChapterPreset {
  chapters: ChapterDef[]
  /** Photo aspect ratios in the gallery, by file name; the rest are 3/2. */
  aspect: Record<string, string>
  glance: string[]
  neighbourhood: string
  cta: string
  coverAlt: string
  /** The city line under the name on the sample pages. Live pages use the listing's city. */
  place?: string
  /** The pull quote: a review id and a sentence lifted verbatim from its body. */
  pull?: { reviewId: string; sentence: string }
  /** Why People Come: each reason quotes a sentence lifted verbatim from a review. */
  why?: { title: string; text: string; reviewId: string; sentence: string }[]
}

const file = (src: string) =>
  src
    .split('/')
    .pop()
    ?.replace(/\.\w+$/, '') ?? src

const LINK_LABEL: Record<string, string> = {
  website: 'Website',
  booking: 'Book Now',
  menu: 'Menu',
  order: 'Order Online',
}

const EMPLOYMENT: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}

function payLabel(min: number | null, max: number | null, period: string | null): string {
  if (min == null || max == null) return ''
  const n = (v: number) => v.toLocaleString('en-US')
  return `$${n(min)}–${n(max)}/${period === 'hour' ? 'hr' : 'yr'}`
}

const VIDEO_SOURCE = (url: string | null) =>
  !url ? 'Video' : /vimeo\.com/.test(url) ? 'Vimeo' : /youtu/.test(url) ? 'YouTube' : 'Video'

/** Trust tier → the round mark's level and its name (status-badge labels). */
const TIER_BADGE: Record<Exclude<TrustTier, 'unclaimed'>, BadgeView> = {
  claimed: { label: 'Claimed', tier: 1 },
  verified: { label: 'Verified', tier: 2 },
  certified: { label: 'BLACQList Certified', tier: 3 },
}

/** The line under the reviews. Verified and Certified only: they are the checked tiers. */
function trustFor(tier: TrustTier): ChapterData['trust'] {
  if (tier === 'verified')
    return {
      line: `Verified by The BLACQList. ${TIER_MEANING.verified}`,
      short: 'Verified by The BLACQList',
    }
  if (tier === 'certified')
    return { line: `BLACQList Certified. ${TIER_MEANING.certified}`, short: 'BLACQList Certified' }
  return null
}

/** Real destinations for the footer's Links column: links, extra buttons, documents, socials. */
function liveLinks(entity: EntityPageData): LinkView[] {
  const out: LinkView[] = []
  const seen = new Set<string>()
  const add = (label: string, href: string | null | undefined) => {
    const t = toTitleCase(label)
    if (!href || seen.has(t.toLowerCase())) return
    seen.add(t.toLowerCase())
    out.push({ label: t, href })
  }
  for (const l of entity.links ?? []) add(l.label?.trim() || LINK_LABEL[l.type] || 'Link', l.url)
  for (const b of entity.buttons ?? []) add(b.label, b.href)
  for (const doc of entity.documents ?? []) add(doc.label, doc.href)
  const social = entity.details.social
  for (const { key, label } of SOCIAL_PLATFORMS) {
    const v = social?.[key]
    if (v) add(label, normalizeSocialUrl(key, v))
  }
  return out
}

function liveView(entity: EntityPageData, viewer: LiveInput): LiveView {
  const d = entity.details
  const ctaHref = getCtaHref(entity)
  const messageHref = getSecondaryMessageHref(entity)
  const canReview = !viewer.isOwner && !viewer.hasReviewed
  return {
    listingId: entity.id,
    replyHelp: viewer.isOwner ? reviewReplyHelp(entity.tier) : null,
    listingSlug: entity.slug,
    listingName: entity.name,
    cityName: entity.city?.name ?? null,
    categoryName: entity.category.name,
    initialSaved: viewer.initialSaved,
    cta: ctaHref ? { href: ctaHref, label: getEntityCtaLabel(entity) } : null,
    message: messageHref
      ? {
          href: messageHref,
          label: toTitleCase(
            messageButtonLabel(entity.messaging?.mode, postingKind(entity.entity_type))
          ),
        }
      : null,
    messagingClosed: isMessagingUnavailable(entity),
    directionsHref:
      d.address && d.city_name && d.state_abbr
        ? directionsUrl({
            name: entity.name,
            street: [d.address, d.address_line2].filter(Boolean).join(' '),
            city: d.city_name,
            state: d.state_abbr,
            zip: d.zip,
          })
        : null,
    pins: locationPins(entity),
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    review: !canReview ? null : viewer.userId ? 'write' : 'sign_in',
    signInHref: `/sign-in?next=${encodeURIComponent(`${viewer.path}#reviews`)}`,
    reviewCriteria: entity.reviewCriteria ?? [],
    hasReviews: entity.reviews.length > 0,
    isOwner: viewer.isOwner,
    claimHref: entity.trust_tier === 'unclaimed' ? `/claim/${entity.id}` : null,
  }
}

export function buildChapterData(
  entity: EntityPageData,
  preset: ChapterPreset,
  now: Date,
  /** The viewer on a live listing page (ticket 231). Omitted on the sample pages. */
  viewer?: LiveInput
): ChapterData {
  const live = viewer ? liveView(entity, viewer) : null
  const zoned = zonedNow(now)
  const d = entity.details
  const week = d?.hours ?? null
  const overrides = entity.hoursOverrides ?? []
  const team = entity.team ?? []
  const founder = team.find((t) => t.isFounder) ?? null
  const person = (t: (typeof team)[number]): PersonView => ({
    id: t.id,
    name: t.name,
    role: t.role ?? '',
    bio: t.bio ?? '',
    photo: t.photo ? { src: t.photo.src, alt: t.photo.alt } : null,
  })

  const groups = new Map<string, MenuGroup>()
  for (const s of d?.services ?? []) {
    const name = toTitleCase(s.group ?? 'More')
    const g = groups.get(name) ?? { name, items: [] }
    g.items.push({ id: s.id, name: s.name, price: s.price ?? '', desc: s.description ?? '' })
    groups.set(name, g)
  }

  const reviewDays = (iso: string) =>
    Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 86_400_000))

  const reviews = entity.reviews.map<ReviewView>((r) => ({
    id: r.id,
    who: r.reviewer_display_name ?? 'A Customer',
    rating: r.rating,
    ago: r.published_at ? ago(reviewDays(r.published_at)) : '',
    verified: r.is_verified_purchase,
    title: r.title ?? '',
    body: r.body ?? '',
    response: r.owner_response,
    photos: r.photos.map((p) => ({ src: p.src, alt: p.alt })),
  }))

  /** A sentence from a review, only while the review still says it word for word. */
  const quoteFrom = (reviewId: string, sentence: string) => {
    const r = reviews.find((x) => x.id === reviewId)
    return r && r.body.includes(sentence) ? { quote: sentence, who: r.who } : null
  }
  const pull = preset.pull ? quoteFrom(preset.pull.reviewId, preset.pull.sentence) : null
  const why = (preset.why ?? []).flatMap((w, i) => {
    const q = quoteFrom(w.reviewId, w.sentence)
    return q ? [{ id: `why-${i + 1}`, title: w.title, text: w.text, ...q }] : []
  })

  // Sample pages: labels only, the links are held. Live pages: real hrefs.
  const links: LinkView[] = []
  if (live) links.push(...liveLinks(entity))
  else {
    const seen = new Set<string>()
    const addLink = (label: string) => {
      const t = toTitleCase(label)
      if (seen.has(t.toLowerCase())) return
      seen.add(t.toLowerCase())
      links.push({ label: t, href: null })
    }
    for (const l of entity.links ?? []) addLink(l.label?.trim() || LINK_LABEL[l.type] || 'Link')
    for (const b of entity.buttons ?? []) addLink(b.label)
    for (const doc of entity.documents ?? []) addLink(doc.label)
  }

  const cover = live
    ? resolveEntityCover(entity.cover_image_path, entity.entity_type, entity.id, 'live').src
    : entity.cover_image_path
  const place = live ? (entity.city?.name ?? null) : (preset.place ?? 'Atlanta')

  const badges: BadgeView[] = [
    ...(entity.ownership_label === 'black_owned' ? [{ label: 'Black-Owned', tier: null }] : []),
    ...(live
      ? entity.trust_tier !== 'unclaimed'
        ? [TIER_BADGE[entity.trust_tier]]
        : []
      : entity.trust_tier === 'verified'
        ? [TIER_BADGE.verified]
        : []),
  ]

  return {
    name: entity.name,
    logo: entity.logo ? { src: entity.logo.src, alt: '' } : null,
    cover: cover ? { src: cover, alt: preset.coverAlt } : null,
    category: [entity.category?.name, preset.neighbourhood].filter(Boolean).join(' · '),
    tagline: entity.tagline ?? '',
    rating: entity.avg_rating ?? 0,
    reviewCount: entity.review_count ?? 0,
    facts: d?.price_range ? [d.price_range] : [],
    badges,
    place,
    trust: live
      ? trustFor(entity.trust_tier)
      : {
          line: 'Verified by The BLACQList: ownership and business details checked.',
          short: 'Verified by The BLACQList',
        },
    glance: preset.glance,
    status: week ? statusFor(week, overrides, zoned) : null,
    address: [
      [d?.address, d?.address_line2].filter(Boolean).join(', '),
      `${d?.city_name ?? ''}, ${d?.state_abbr ?? ''} ${d?.zip ?? ''}`.trim(),
    ].filter((x) => x && x !== ',' && x !== ', '),
    phone: d?.phone ?? null,
    cta: live ? (live.cta?.label ?? '') : preset.cta,
    chapters: preset.chapters,
    story: (d?.description ?? '').split(/\n\s*\n/).filter(Boolean),
    happening: (entity.happeningNow ?? []).map((p) => ({
      id: p.id,
      title: p.headline,
      body: p.body ?? '',
      image: p.imageUrl ? { src: p.imageUrl, alt: '' } : null,
      // A live post's button has no destination in the page read yet; it waits for pass 2.
      button: !live && p.buttonLabel ? toTitleCase(p.buttonLabel) : null,
    })),
    highlights: (entity.highlights ?? [])
      .filter((h) => h.kind !== 'step')
      .map((h) => ({ id: h.id, title: h.title, text: h.text ?? '' })),
    steps: (entity.highlights ?? [])
      .filter((h) => h.kind === 'step')
      .map((h) => ({ id: h.id, title: h.title, text: h.text ?? '' })),
    why,
    founded: d?.founded_year ?? null,
    founder: founder ? person(founder) : null,
    team: team.filter((t) => t !== founder).map(person),
    hours: week ? hoursRows(week, zoned) : [],
    overrides: overrideRows(overrides, zoned),
    locations: (entity.locations ?? []).map((l) => ({
      id: l.id,
      name: l.label,
      // A location shown by appointment may have no street address.
      where: [l.addressLine, l.cityName].filter(Boolean).join(', '),
      href: live ? l.href : null,
    })),
    findUs: (entity.findUsAt ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      where: s.nationwide ? 'Nationwide' : s.cities.join(' and '),
      href: null,
    })),
    orderOn: (entity.orderLinks ?? []).map((o) => ({
      id: o.platform,
      name: o.label,
      where: 'Delivery',
      href: live ? o.url : null,
    })),
    // Pass 2 on live pages: events, booking, shop, jobs and related listings.
    events: live
      ? []
      : (entity.organizerEvents ?? []).map((e) => {
          const at = zonedNow(new Date(e.starts_at))
          return {
            id: e.id,
            day: String(at.getDate()),
            month: fmt(at, { month: 'short' }),
            title: e.name,
            when: `${dayLabel(at)}, ${t12(at.getHours() * 60 + at.getMinutes())}`,
            where: e.is_online ? 'Online' : (e.venue_name ?? e.city_name ?? ''),
          }
        }),
    deals: (entity.deals ?? []).map((x) => ({
      id: x.id,
      title: x.title,
      desc: x.description ?? '',
      code: x.code,
      terms: x.terms,
    })),
    menu: [...groups.values()],
    booking: live ? null : (entity.booking?.prompt ?? null),
    shop:
      !live && entity.shop
        ? {
            total: entity.shop.total,
            items: entity.shop.items.map((s) => ({
              id: s.id,
              name: s.name,
              price: s.priceLabel ?? '',
              kind: s.kind === 'service' ? 'Service' : 'Product',
              src: s.image?.src ?? '',
              alt: s.image?.alt ?? '',
            })),
          }
        : null,
    gallery: entity.images.map((g) => ({
      src: g.src,
      alt: g.alt,
      album: g.album ?? '',
      ar: preset.aspect[file(g.src)] ?? '3/2',
    })),
    videos: live
      ? (d?.videos ?? []).flatMap((v, i) => {
          const href = v.embed_url ?? v.file_url
          return href
            ? [
                {
                  id: v.id,
                  title: `Video ${i + 1}`,
                  source: VIDEO_SOURCE(v.embed_url),
                  note: '',
                  href,
                },
              ]
            : []
        })
      : (d?.videos ?? []).slice(0, 2).map((v, i) => ({
          id: v.id,
          title: `Sample Video ${i + 1}`,
          source: VIDEO_SOURCE(v.embed_url),
          note: 'Stand-in for the business’s own video',
          href: null,
        })),
    reviews,
    pull,
    criteria: entity.reviewCriteriaAverages.map((c) => ({ name: c.name, average: c.average })),
    credentials: (entity.credentials ?? []).map((c) => ({
      id: c.id,
      kind: toTitleCase(c.kind),
      title: c.title,
      issuer: c.issuer ?? '',
      year: c.year ?? null,
    })),
    faq: entity.faqs.map((f) => ({ id: f.id, q: f.question, a: f.answer })),
    attributes: entity.attributes.map((a) => ({
      group: a.group,
      values: a.values.map((v) => v.name),
    })),
    links,
    jobs: live
      ? []
      : (entity.hiring?.roles ?? []).map((r) => {
          const j = r.job_details
          return {
            id: r.id,
            title: r.name,
            type: [
              j?.employmentType ? EMPLOYMENT[j.employmentType] : null,
              j?.workplaceType ?? null,
            ]
              .filter(Boolean)
              .join(', '),
            pay: payLabel(j?.salaryMin ?? null, j?.salaryMax ?? null, j?.salaryPeriod ?? null),
            desc: r.tagline ?? '',
          }
        }),
    related: live
      ? []
      : entity.related.map((r) => ({
          id: r.id,
          name: r.name,
          tagline: r.tagline ?? '',
          rating: r.avg_rating ?? 0,
          reviews: r.review_count ?? 0,
        })),
    live,
  }
}
