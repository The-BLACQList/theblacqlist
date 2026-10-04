// =============================================================================
// Launch-list attribution: UTM values, referrer, and the optional signup role
// =============================================================================
// Pre-launch requests R2, R3 and R5 (marketing OS, WF-034 capture.md section 9).
//
// Shared by three places that must agree on the same keys and the same rules:
//   * proxy.ts             keeps the UTM keys through the / -> /coming-soon redirect
//   * the capture forms    read them from the address bar and post them on submit
//   * subscribeLaunch.ts   sanitizes them again before they reach the database
//
// The server never trusts the posted values. Everything a browser posts is
// re-validated here, and anything that does not fit becomes null rather than
// an error: a signup with lost attribution is still a signup.
//
// PRIVACY. No value here identifies a person. The referrer is reduced to its
// origin (scheme + host) because a full referring URL can carry a search query,
// a profile path or a token. UTM values are campaign labels we write ourselves;
// anything outside a short, plain character set is dropped.
// =============================================================================

/** The four UTM keys stored on launch_subscribers (R2). */
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const
export type UtmKey = (typeof UTM_KEYS)[number]

/**
 * Query keys the coming-soon redirect keeps (R5). utm_term is not stored, but
 * it is a standard UTM key and analytics tools read it from the landing URL, so
 * the redirect should not be the thing that drops it.
 */
export const REDIRECT_PRESERVED_KEYS: readonly string[] = [...UTM_KEYS, 'utm_term']

/** Optional self-declared role (R3). Must match the CHECK in the migration. */
export const SIGNUP_ROLES = ['owner', 'supporter'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

export interface LaunchAttribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer: string | null
}

export const EMPTY_ATTRIBUTION: LaunchAttribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  referrer: null,
}

const UTM_MAX = 100
const REFERRER_MAX = 255
// Letters, digits, and the separators campaign labels actually use
// (story-1005, owner-headsup-email, w1-share). No angle brackets, quotes,
// slashes or control characters.
const UTM_VALUE_RE = /^[A-Za-z0-9 ._~+-]+$/

/** A UTM value safe to store, or null. */
export function sanitizeUtmValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || value.length > UTM_MAX || !UTM_VALUE_RE.test(value)) return null
  return value
}

/** The referrer reduced to its origin (https://l.instagram.com), or null. */
export function referrerOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const origin = url.origin
    return origin.length <= REFERRER_MAX ? origin : null
  } catch {
    return null
  }
}

/** Reads attribution from a query string (client side, on page load). */
export function attributionFromSearch(search: string, referrer: string): LaunchAttribution {
  const params = new URLSearchParams(search)
  return {
    utm_source: sanitizeUtmValue(params.get('utm_source')),
    utm_medium: sanitizeUtmValue(params.get('utm_medium')),
    utm_campaign: sanitizeUtmValue(params.get('utm_campaign')),
    utm_content: sanitizeUtmValue(params.get('utm_content')),
    referrer: referrerOrigin(referrer),
  }
}

/** Reads attribution from the posted form (server side). Never trusts the client. */
export function attributionFromFormData(formData: FormData): LaunchAttribution {
  const get = (key: string) => formData.get(key)?.toString()
  return {
    utm_source: sanitizeUtmValue(get('utm_source')),
    utm_medium: sanitizeUtmValue(get('utm_medium')),
    utm_campaign: sanitizeUtmValue(get('utm_campaign')),
    utm_content: sanitizeUtmValue(get('utm_content')),
    referrer: referrerOrigin(get('referrer')),
  }
}

/** The optional role, or null when absent or not one of the two options. */
export function parseSignupRole(raw: unknown): SignupRole | null {
  return typeof raw === 'string' && (SIGNUP_ROLES as readonly string[]).includes(raw)
    ? (raw as SignupRole)
    : null
}

/**
 * The query string to carry through the coming-soon redirect: the UTM keys and
 * nothing else. Everything else is still dropped on purpose. A stray ?preview=
 * with a wrong token, an ?error= meant for /sign-in, or any other parameter has
 * no meaning on /coming-soon and should not ride along.
 */
export function preservedRedirectSearch(params: URLSearchParams): string {
  const kept = new URLSearchParams()
  for (const key of REDIRECT_PRESERVED_KEYS) {
    const value = params.get(key)
    if (value !== null && value !== '') kept.set(key, value)
  }
  const query = kept.toString()
  return query ? `?${query}` : ''
}

/**
 * The thank-you share link (R4), verbatim from capture.md section 6. It carries
 * utm_campaign=pre-launch and utm_source=share so shared signups are counted
 * apart from every other source.
 */
export const PRE_LAUNCH_SHARE_URL =
  'https://theblacqlist.com/?utm_source=share&utm_medium=referral&utm_campaign=pre-launch&utm_content=thankyou-share'

/**
 * The current page's attribution, read in the browser at the moment it is
 * needed (page view, form submit). Reading at submit time instead of
 * rendering hidden inputs keeps server HTML and client HTML identical, so
 * there is nothing to mismatch on hydration. Empty on the server.
 */
export function readBrowserAttribution(): LaunchAttribution {
  if (typeof window === 'undefined') return EMPTY_ATTRIBUTION
  return attributionFromSearch(window.location.search, document.referrer)
}

/** Copies the non-null attribution values onto the outgoing form data. */
export function appendAttribution(formData: FormData, attribution: LaunchAttribution): FormData {
  for (const [key, value] of Object.entries(attribution)) {
    if (value) formData.set(key, value)
  }
  return formData
}
