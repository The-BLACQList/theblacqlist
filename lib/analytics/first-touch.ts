// Ticket 234: where a sign-up came from.
//
// The first time a signed-out visitor arrives from outside (a link with
// utm_source / utm_medium / utm_campaign tags, or a click from another site),
// proxy.ts keeps that in a small first-party cookie. signUpAction reads it and
// saves it with the new account and on the sign_up_completed event, so the
// weekly numbers can say which outreach brought people in.
//
// What is kept, on purpose, is small:
//   - the three campaign tags, cleaned to a short safe alphabet;
//   - the referring site's host name only (instagram.com), never the full
//     address, which can carry search terms or someone's profile path.
// First touch wins: once the cookie is set, later visits do not replace it.
//
// Pure functions and no Node APIs, so the Edge proxy, the server action and the
// tests all share it.

export const FIRST_TOUCH_COOKIE = 'bl_ft'
export const FIRST_TOUCH_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/** Bumped if the stored shape ever changes; an unknown version reads as nothing. */
const VERSION = 'v1'
const TAG_MAX = 64
const HOST_MAX = 100

export interface FirstTouch {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  /** The referring site's host, lowercased, without a leading www. */
  referrer?: string
}

/** Our own hosts. A click from one of our pages is not where someone came from. */
const OWN_DOMAIN = 'theblacqlist.com'

/**
 * A campaign tag as we store it: lowercased, spaces and anything outside
 * [a-z0-9._~+-] turned into "-", runs of "-" collapsed, at most 64 characters.
 * Empty after cleaning reads as absent.
 */
export function cleanTag(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const v = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._~+-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, TAG_MAX)
  return v || undefined
}

/** A host name as we store it, or undefined when it isn't a plain host name. */
function cleanHost(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
  if (!host || host.length > HOST_MAX || !/^[a-z0-9.-]+$/.test(host) || !host.includes('.'))
    return undefined
  return host
}

const isOwnHost = (host: string, requestHost: string): boolean => {
  const own = requestHost.toLowerCase().replace(/^www\./, '')
  return host === own || host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`)
}

/**
 * The referring site's host from a Referer header, or undefined when there is
 * none, it isn't http(s), or it is one of our own pages.
 */
export function referrerHost(
  referer: string | null | undefined,
  requestHost: string
): string | undefined {
  if (!referer) return undefined
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  const host = cleanHost(url.hostname)
  if (!host || isOwnHost(host, requestHost)) return undefined
  return host
}

/** What this request says about where the visitor came from, or null when it says nothing. */
export function firstTouchFrom(
  searchParams: URLSearchParams,
  referer: string | null | undefined,
  requestHost: string
): FirstTouch | null {
  const touch: FirstTouch = {
    utm_source: cleanTag(searchParams.get('utm_source')),
    utm_medium: cleanTag(searchParams.get('utm_medium')),
    utm_campaign: cleanTag(searchParams.get('utm_campaign')),
    referrer: referrerHost(referer, requestHost),
  }
  return compact(touch)
}

function compact(t: FirstTouch): FirstTouch | null {
  const out: FirstTouch = {}
  if (t.utm_source) out.utm_source = t.utm_source
  if (t.utm_medium) out.utm_medium = t.utm_medium
  if (t.utm_campaign) out.utm_campaign = t.utm_campaign
  if (t.referrer) out.referrer = t.referrer
  return Object.keys(out).length ? out : null
}

/**
 * The cookie value: `v1|source|medium|campaign|referrer`. Every field is
 * already limited to characters that are safe in a cookie and never contain "|".
 */
export function encodeFirstTouch(t: FirstTouch): string {
  return [
    VERSION,
    t.utm_source ?? '',
    t.utm_medium ?? '',
    t.utm_campaign ?? '',
    t.referrer ?? '',
  ].join('|')
}

/**
 * Reads the cookie back. The browser can send anything, so every field is
 * cleaned again; a value that doesn't parse reads as null.
 */
export function decodeFirstTouch(raw: string | null | undefined): FirstTouch | null {
  if (!raw) return null
  const parts = raw.split('|')
  if (parts.length !== 5 || parts[0] !== VERSION) return null
  const [, s, m, c, r] = parts
  return compact({
    utm_source: cleanTag(s),
    utm_medium: cleanTag(m),
    utm_campaign: cleanTag(c),
    referrer: cleanHost(r),
  })
}
