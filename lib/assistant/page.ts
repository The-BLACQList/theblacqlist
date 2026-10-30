/**
 * What page the visitor is on, for Cue (ticket 148).
 *
 * The client sends only its path (with the query string). The server works out
 * the page type from it, reads that page's public facts itself, and builds the
 * list of things Cue may do there. Nothing the client says about the page is
 * trusted beyond the path.
 *
 * Actions by risk (founder pick, 2026-10-30):
 * - scroll: Cue jumps to a section on this page on its own.
 * - link, external, ask: a button. Leaving the page or changing filters waits
 *   for a tap. Cue never fills in forms, signs anyone in, or touches checkout.
 *
 * The model only ever sees short action codes. Every href is built here.
 */

import type { AssistantAction } from '@/lib/ai/assistant-limits'
import { VALID_ENTITY_TYPES } from '@/lib/constants/listing'
import { directionsUrl } from '@/lib/listings/directions'

/** First path segments that are routes of their own, never a city. */
const TOP_ROUTES = new Set([
  'about',
  'account',
  'add-business',
  'add-event',
  'add-job',
  'admin',
  'api',
  'auth',
  'blacqlight',
  'cities',
  'claim',
  'collections',
  'coming-soon',
  'contact',
  'cookies',
  'corrections',
  'dashboard',
  'discover',
  'events',
  'flow-map',
  'for-business',
  'for-sponsors',
  'for-vendors',
  'guides',
  'how-ranking-works',
  'join',
  'jobs',
  'login',
  'map',
  'marketplace',
  'onboarding',
  'pricing',
  'privacy',
  'search',
  'signup',
  'soon',
  't',
  'terms',
  'vendors',
])

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/
const STORY_SECTIONS = new Set(['blacqlight', 'guides', 'collections'])
const PRICING_PATHS = new Set(['/pricing', '/for-business', '/for-vendors'])
const DISCOVER_PATHS = new Set(['/discover', '/search', '/map'])

export type PageRef =
  | { kind: 'business'; citySlug: string; entityType: string; listingSlug: string }
  | {
      kind: 'discover'
      path: string
      q: string | null
      category: string | null
      city: string | null
      openNow: boolean
      search: string
    }
  | { kind: 'pricing'; path: string }
  | { kind: 'story'; section: string; slug: string }
  | { kind: 'other'; path: string }

function slugParam(value: string | null): string | null {
  return value && SLUG.test(value) ? value : null
}

/**
 * Reads a page path the client sent. Returns null for anything that is not a
 * plain path on this site.
 */
export function parsePagePath(raw: string | null | undefined): PageRef | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  let url: URL
  try {
    url = new URL(raw, 'https://page.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://page.invalid') return null

  const path = url.pathname.replace(/\/+$/, '') || '/'
  const parts = path.split('/').filter(Boolean)
  if (parts.some((p) => !SLUG.test(p))) return { kind: 'other', path: '/' }

  const [first, second, third] = parts
  if (
    parts.length === 3 &&
    first &&
    second &&
    third &&
    !TOP_ROUTES.has(first) &&
    (VALID_ENTITY_TYPES as readonly string[]).includes(second)
  ) {
    return { kind: 'business', citySlug: first, entityType: second, listingSlug: third }
  }

  if (DISCOVER_PATHS.has(path) || (first === 'discover' && parts.length === 2)) {
    const p = url.searchParams
    const q = p.get('q')?.replace(/\s+/g, ' ').trim().slice(0, 60) || null
    const openRaw = p.get('open_now')
    return {
      kind: 'discover',
      path,
      q,
      category: slugParam(p.get('category')),
      city: first === 'discover' && second ? second : slugParam(p.get('city')),
      openNow: openRaw === '1' || openRaw === 'true',
      search: url.search,
    }
  }

  if (PRICING_PATHS.has(path)) return { kind: 'pricing', path }

  if (parts.length === 2 && first && second && STORY_SECTIONS.has(first)) {
    return { kind: 'story', section: first, slug: second }
  }

  return { kind: 'other', path }
}

/** The public facts of a business page, read by the server. */
export interface BusinessPageFacts {
  id: string
  name: string
  entityType: string
  claimed: boolean
  avgRating: number | null
  reviewCount: number
  categoryName: string | null
  cityName: string | null
  stateCode: string | null
  street: string | null
  zip: string | null
  phone: string | null
  website: string | null
  hasHours: boolean
  lat: number | null
  lng: number | null
}

/** What Cue knows about the page and may do on it. */
export interface PageContext {
  /** One short line for the prompt. */
  facts: string
  /** Names the opener may use. */
  names: string[]
  /** Numbers the opener may use. */
  numbers: string[]
  /** Action code to the built action. Codes are what the model sees. */
  actions: Record<string, AssistantAction>
}

export const NO_PAGE: PageContext = { facts: 'none', names: [], numbers: [], actions: {} }

function words(slug: string): string {
  return slug.replace(/-/g, ' ')
}

function scroll(ids: string[], label: string): AssistantAction {
  return { kind: 'scroll', ids, label }
}

/** A tel: link with digits only, or null. */
export function telHref(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits.length >= 7 && digits.length <= 15 ? `tel:${digits}` : null
}

/** An https website, or null. */
export function httpsHref(raw: string | null): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function businessPage(b: BusinessPageFacts): PageContext {
  const place = [b.cityName, b.stateCode].filter(Boolean).join(', ')
  const rating =
    b.avgRating !== null && b.reviewCount > 0 ? b.avgRating.toFixed(1) : null
  const shows = [
    b.hasHours ? 'hours' : null,
    b.phone ? 'phone' : null,
    b.website ? 'website' : null,
    b.street ? 'address' : null,
  ].filter(Boolean)

  const facts = [
    `Business page: ${b.name}${b.categoryName ? `, ${b.categoryName}` : ''}${place ? ` in ${place}` : ''}.`,
    rating ? `Rated ${rating} from ${b.reviewCount} reviews.` : 'No reviews yet.',
    shows.length ? `Shows ${shows.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const actions: Record<string, AssistantAction> = {}
  const timed = b.entityType === 'event' || b.entityType === 'job'
  if (timed) {
    actions.details = scroll(['details'], 'the details')
  } else {
    if (b.hasHours) actions.hours = scroll(['visit'], 'their hours')
    actions.location = scroll(['visit'], 'where to find them')
    actions.services = scroll(['offerings', 'services', 'capabilities'], 'what they offer')
    actions.about = scroll(['about', 'overview'], 'their story')
    actions.contact = scroll(['inquire', 'visit'], 'how to reach them')
  }
  if (b.entityType !== 'job') actions.reviews = scroll(['reviews'], 'the reviews')
  actions.photos = scroll(['gallery', 'portfolio'], 'their photos')

  const directions = directionsUrl({
    name: b.name,
    street: b.street,
    city: b.cityName,
    state: b.stateCode,
    zip: b.zip,
    lat: b.lat,
    lng: b.lng,
  })
  if (directions) actions.directions = { kind: 'external', href: directions, label: 'Get directions' }
  const tel = telHref(b.phone)
  if (tel) actions.call = { kind: 'external', href: tel, label: 'Call them' }
  const site = httpsHref(b.website)
  if (site) actions.website = { kind: 'external', href: site, label: 'Visit their website' }
  if (b.categoryName && b.cityName) {
    actions.similar = {
      kind: 'ask',
      text: `More ${b.categoryName.toLowerCase()} in ${b.cityName}`,
      label: 'More like this',
    }
  }
  if (!b.claimed) actions.claim = { kind: 'link', href: `/claim/${b.id}`, label: 'Claim this page' }

  return {
    facts,
    names: [b.name, b.categoryName, b.cityName].filter((n): n is string => Boolean(n)),
    numbers: rating ? [rating, String(b.reviewCount)] : [],
    actions,
  }
}

export function discoverPage(ref: Extract<PageRef, { kind: 'discover' }>): PageContext {
  const parts = [
    ref.q ? `search "${ref.q}"` : null,
    ref.category ? `category ${words(ref.category)}` : null,
    ref.city ? `city ${words(ref.city)}` : null,
    ref.openNow ? 'open now only' : null,
  ].filter(Boolean)
  const facts = `Search results page${parts.length ? `: ${parts.join(', ')}` : ''}.`

  const actions: Record<string, AssistantAction> = {}
  if (!ref.openNow) {
    const params = new URLSearchParams(ref.search)
    params.delete('open')
    params.delete('page')
    params.set('open_now', '1')
    actions.open_now = {
      kind: 'link',
      href: `${ref.path}?${params.toString()}`,
      label: 'Show only open now',
    }
  }
  return { facts, names: [], numbers: [], actions }
}

export function pricingPage(ref: Extract<PageRef, { kind: 'pricing' }>): PageContext {
  const actions: Record<string, AssistantAction> = {}
  if (ref.path === '/pricing') actions.plans = scroll(['plans'], 'the plans')
  else actions.compare = { kind: 'link', href: '/pricing', label: 'Compare plans' }
  actions.add_business = { kind: 'link', href: '/add-business', label: 'Add your business' }
  return {
    facts: 'Plans page for business owners. Listing a business is free; paid plans add more.',
    names: [],
    numbers: [],
    actions,
  }
}

export function storyPage(ref: Extract<PageRef, { kind: 'story' }>): PageContext {
  const kind = ref.section === 'guides' ? 'Guide' : ref.section === 'collections' ? 'Collection' : 'Story'
  return { facts: `${kind} page: ${words(ref.slug)}.`, names: [], numbers: [], actions: {} }
}

/** Page context for every page kind except a business page, which needs a read. */
export function staticPage(ref: PageRef): PageContext {
  switch (ref.kind) {
    case 'discover':
      return discoverPage(ref)
    case 'pricing':
      return pricingPage(ref)
    case 'story':
      return storyPage(ref)
    case 'other':
      return ref.path === '/' ? NO_PAGE : { ...NO_PAGE, facts: `Page: ${words(ref.path.slice(1).replace(/\//g, ' '))}.` }
    case 'business':
      return NO_PAGE
  }
}

/** The built actions for the codes the model picked, in its order. */
export function resolvePageActions(page: PageContext, codes: readonly string[]): AssistantAction[] {
  const out: AssistantAction[] = []
  for (const code of codes) {
    const action = page.actions[code]
    if (action) out.push(action)
  }
  return out
}
