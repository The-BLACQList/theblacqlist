'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { checkUrl, safeFetch, SafeFetchError } from '@/lib/import/safe-fetch'
import { MAX_PHOTOS_PER_IMPORT } from '@/lib/import/limits'
import { isAllowedByRobots } from '@/lib/import/robots'
import { decodeHtml, hasUsefulFindings, readSite, type SiteFindings } from '@/lib/import/read-site'
import { importRemoteImage, type ImportImageFailure } from '@/lib/media/importRemoteImage'
import type { ListingImageRole } from '@/lib/media/storeListingImage'

// =============================================================================
// Step 0 of /add-business: "Bring in what you already have" (ticket 127)
// =============================================================================
// Two actions, both behind FEATURE_SITE_IMPORT:
//
//   readSiteAction        reads one public page, once, when the owner asks.
//                         Nothing is saved. The owner confirms every field.
//   importSitePhotosAction brings in only the photos the owner picked, through
//                         the same path as an upload (EXIF dropped, plan limit).
//
// robots.txt is honored for the page. The photos are not checked against it:
// the owner picked each one from their own site and confirmed they may use it.
// =============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Windows stay at an hour or less (prune_rate_limit_counters).
const WINDOW_SECONDS = 60 * 60
const READS_PER_USER = 5
const READS_PER_IP = 15
const PHOTO_CALLS_PER_USER = 20

const ROBOTS_MAX_BYTES = 64 * 1024
const ROBOTS_TIMEOUT_MS = 4000

const READ_ERRORS = {
  off: 'Bringing in a site is not open yet. Skip this and type your details instead.',
  signedOut: 'Sign in to bring in your site.',
  busy: 'You have tried this a few times. Wait a bit, or skip this and type your details.',
  invalid: 'Check the web address. It should look like yoursite.com.',
  notFound: 'We could not find that site. Check the address, or skip this and type your details.',
  slow: 'Your site took too long to answer. Try again, or skip this and type your details.',
  robots: 'Your site asks tools like ours not to read it, so we did not. Skip this and type your details instead.',
  notHtml: 'That address is not a web page we can read. Skip this and type your details instead.',
  nothing: 'We could not find anything useful on that page. Skip this and type your details instead.',
  failed: 'We could not read that site. Skip this and type your details instead.',
} as const

export type ReadSiteResult = { ok: true; findings: SiteFindings } | { ok: false; error: string }

/**
 * "glowsalon.com" and "www.glowsalon.com/about" become full https addresses.
 * Another scheme ("ftp://...") is refused, not wrapped into "https://ftp://...",
 * and a host with no dot is not a public site.
 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2048 || /\s/.test(trimmed)) return null
  if (trimmed.includes('://') && !/^https?:\/\//i.test(trimmed)) return null
  const full = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    if (!new URL(full).hostname.includes('.')) return null
  } catch {
    return null
  }
  return full
}

/**
 * True when robots.txt at `origin` lets us read `path`. A missing file allows
 * everything (RFC 9309). A site we cannot reach for robots.txt is treated as a
 * site we cannot read, so the caller reports it as slow or unreachable.
 */
async function robotsAllow(origin: string, path: string): Promise<boolean> {
  try {
    const res = await safeFetch(`${origin}/robots.txt`, {
      maxBytes: ROBOTS_MAX_BYTES,
      timeoutMs: ROBOTS_TIMEOUT_MS,
      accept: 'text/plain',
    })
    return isAllowedByRobots(res.body.toString('utf8'), path)
  } catch (err) {
    if (err instanceof SafeFetchError && (err.code === 'not_found' || err.code === 'http_error')) {
      return true
    }
    // A robots.txt over the cap is not worth refusing the page over.
    if (err instanceof SafeFetchError && err.code === 'too_large') return true
    throw err
  }
}

function readErrorFor(err: unknown): string {
  if (!(err instanceof SafeFetchError)) return READ_ERRORS.failed
  switch (err.code) {
    case 'invalid_url':
    case 'blocked_address':
      return READ_ERRORS.invalid
    case 'not_found':
      return READ_ERRORS.notFound
    case 'timeout':
      return READ_ERRORS.slow
    case 'robots_blocked':
      return READ_ERRORS.robots
    case 'unsupported_type':
      return READ_ERRORS.notHtml
    default:
      return READ_ERRORS.failed
  }
}

export async function readSiteAction(rawUrl: string): Promise<ReadSiteResult> {
  if (!isFeatureEnabled('siteImport')) return { ok: false, error: READ_ERRORS.off }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: READ_ERRORS.signedOut }

  const normalized = typeof rawUrl === 'string' ? normalizeUrl(rawUrl) : null
  if (!normalized) return { ok: false, error: READ_ERRORS.invalid }

  let target: URL
  try {
    target = checkUrl(normalized)
  } catch {
    return { ok: false, error: READ_ERRORS.invalid }
  }

  const ip = getClientIp(await headers())
  const [userOk, ipOk] = await Promise.all([
    checkRateLimit({ bucket: 'site_import', identifier: `read:${user.id}`, limit: READS_PER_USER, windowSeconds: WINDOW_SECONDS }),
    checkRateLimit({ bucket: 'site_import', identifier: `read-ip:${ip}`, limit: READS_PER_IP, windowSeconds: WINDOW_SECONDS }),
  ])
  if (!userOk || !ipOk) return { ok: false, error: READ_ERRORS.busy }

  try {
    if (!(await robotsAllow(target.origin, target.pathname + target.search))) {
      return { ok: false, error: READ_ERRORS.robots }
    }

    const page = await safeFetch(target.href)
    if (page.contentType !== 'text/html' && page.contentType !== 'application/xhtml+xml') {
      return { ok: false, error: READ_ERRORS.notHtml }
    }

    // A redirect to another host (glowsalon.com to glowsalon.square.site)
    // answers to that host's robots.txt too.
    const landed = new URL(page.url)
    if (landed.origin !== target.origin && !(await robotsAllow(landed.origin, landed.pathname + landed.search))) {
      return { ok: false, error: READ_ERRORS.robots }
    }

    const findings = readSite(decodeHtml(page.body), page.url)
    if (!hasUsefulFindings(findings)) return { ok: false, error: READ_ERRORS.nothing }
    return { ok: true, findings }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'warn',
        op: 'site_import_read',
        code: err instanceof SafeFetchError ? err.code : 'unexpected',
      })
    )
    return { ok: false, error: readErrorFor(err) }
  }
}

// ── Photos ──────────────────────────────────────────────────────────────────

export interface PhotoPick {
  url: string
  role: ListingImageRole
}

export type PhotoImportOutcome =
  | { url: string; role: ListingImageRole; ok: true; path: string }
  | { url: string; role: ListingImageRole; ok: false; reason: ImportImageFailure | 'skipped'; message: string }

export type ImportSitePhotosResult =
  | { ok: true; photos: PhotoImportOutcome[] }
  | { ok: false; error: string }

const PHOTO_ERRORS = {
  off: READ_ERRORS.off,
  signedOut: 'Sign in to bring in your photos.',
  rights: 'Confirm you own these photos or have permission to use them.',
  invalid: 'Something went wrong with those photos. Pick them again.',
  tooMany: `Pick up to ${MAX_PHOTOS_PER_IMPORT} photos at a time.`,
  busy: 'You have brought in a lot of photos in the last hour. Upload the rest instead.',
} as const

const ROLES: ReadonlySet<string> = new Set(['logo', 'cover', 'gallery'])

function parsePicks(value: unknown): PhotoPick[] | null {
  if (!Array.isArray(value)) return null
  const picks: PhotoPick[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const { url, role } = item as Record<string, unknown>
    if (typeof url !== 'string' || typeof role !== 'string' || !ROLES.has(role)) return null
    if (url.length > 2048) return null
    // One logo and one cover; a photo picked twice comes in once.
    if (role !== 'gallery' && picks.some((p) => p.role === role)) return null
    const key = `${role}:${url}`
    if (seen.has(key)) continue
    seen.add(key)
    picks.push({ url, role: role as ListingImageRole })
  }
  return picks
}

export async function importSitePhotosAction(input: {
  listingId: string
  picks: PhotoPick[]
  rightsConfirmed: boolean
}): Promise<ImportSitePhotosResult> {
  if (!isFeatureEnabled('siteImport')) return { ok: false, error: PHOTO_ERRORS.off }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: PHOTO_ERRORS.signedOut }

  if (input?.rightsConfirmed !== true) return { ok: false, error: PHOTO_ERRORS.rights }

  const listingId = typeof input.listingId === 'string' ? input.listingId : ''
  const picks = parsePicks(input.picks)
  if (!UUID_RE.test(listingId) || !picks) return { ok: false, error: PHOTO_ERRORS.invalid }
  if (picks.length === 0) return { ok: true, photos: [] }
  if (picks.length > MAX_PHOTOS_PER_IMPORT) return { ok: false, error: PHOTO_ERRORS.tooMany }

  if (
    !(await checkRateLimit({
      bucket: 'site_import',
      identifier: `photos:${user.id}`,
      limit: PHOTO_CALLS_PER_USER,
      windowSeconds: WINDOW_SECONDS,
    }))
  ) {
    return { ok: false, error: PHOTO_ERRORS.busy }
  }

  // One at a time, in the owner's order: the plan limit counts as it goes, and
  // a full plan or a refused page stops the rest rather than repeating itself.
  const photos: PhotoImportOutcome[] = []
  let stopped: { reason: ImportImageFailure; message: string } | null = null
  for (const pick of picks) {
    if (stopped && (stopped.reason === 'forbidden' || pick.role === 'gallery')) {
      photos.push({ ...pick, ok: false, reason: 'skipped', message: stopped.message })
      continue
    }

    try {
      checkUrl(pick.url)
    } catch {
      photos.push({ ...pick, ok: false, reason: 'unreachable', message: 'We could not get this photo from your site.' })
      continue
    }

    const result = await importRemoteImage({ supabase, userId: user.id, listingId, role: pick.role, url: pick.url })
    if (result.ok) {
      photos.push({ ...pick, ok: true, path: result.path })
    } else {
      photos.push({ ...pick, ok: false, reason: result.reason, message: result.message })
      if (result.reason === 'plan_limit' || result.reason === 'forbidden') stopped = result
    }
  }

  return { ok: true, photos }
}
