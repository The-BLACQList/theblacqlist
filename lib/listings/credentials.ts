import { canAccess } from '@/lib/stripe/features'
import type { CredentialItem } from '@/types'

// Credentials, awards and press (ticket 192): the rules shared by the owner's
// actions, the dashboard and the page loader. Pure.

export type CredentialKind = CredentialItem['kind']

export const CREDENTIAL_KINDS: readonly CredentialKind[] = [
  'license',
  'certification',
  'award',
  'press',
]

/** The form's choices, singular. The page's group headings live in the section. */
export const CREDENTIAL_KIND_LABEL: Record<CredentialKind, string> = {
  license: 'License',
  certification: 'Certification',
  award: 'Award',
  press: 'Press',
}

export const CREDENTIAL_TITLE_MAX = 80
export const CREDENTIAL_ISSUER_MAX = 80
export const CREDENTIAL_URL_MAX = 500
export const CREDENTIAL_YEAR_MIN = 1900
/** Items a page, whatever the plan: a bound on the owner's list, not a plan limit. */
export const CREDENTIALS_SAVED_MAX = 30

export const CREDENTIAL_COLUMNS = 'id, kind, title, issuer, year, url, sort_order'

/** A row as the owner's editor and the page loader read it. */
export interface OwnerCredential {
  id: string
  kind: CredentialKind
  title: string
  issuer: string | null
  year: number | null
  url: string | null
  sort_order: number
}

/** Credentials show on Starter and up, on business pages. */
export function credentialsShowOn(listing: { tier: string | null; entity_type: string }): boolean {
  if (listing.entity_type === 'job' || listing.entity_type === 'event') return false
  return canAccess(listing.tier, 'credentials')
}

/** Adding one item. Editing, reordering and removing are always allowed. */
export function checkCredentialAdd(tier: string | null, savedCount: number): string | null {
  if (!canAccess(tier, 'credentials')) {
    return 'Credentials and press come with Starter. Upgrade to add yours.'
  }
  if (savedCount >= CREDENTIALS_SAVED_MAX) {
    return `You have ${CREDENTIALS_SAVED_MAX} items saved. Remove one to add another.`
  }
  return null
}

function isKind(value: unknown): value is CredentialKind {
  return typeof value === 'string' && (CREDENTIAL_KINDS as readonly string[]).includes(value)
}

/** Rows from the database, checked and in the owner's order. Bad rows are dropped. */
export function toOwnerCredentials(rows: unknown): OwnerCredential[] {
  if (!Array.isArray(rows)) return []
  const out: OwnerCredential[] = []
  for (const r of rows as Record<string, unknown>[]) {
    if (typeof r?.id !== 'string' || !isKind(r.kind)) continue
    if (typeof r.title !== 'string' || !r.title.trim()) continue
    out.push({
      id: r.id,
      kind: r.kind,
      title: r.title,
      issuer: typeof r.issuer === 'string' && r.issuer.trim() ? r.issuer : null,
      year: typeof r.year === 'number' && Number.isInteger(r.year) ? r.year : null,
      url: typeof r.url === 'string' && safeHttpsUrl(r.url) ? r.url : null,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : 0,
    })
  }
  return out.sort((a, b) => a.sort_order - b.sort_order)
}

/** The page's items, in the owner's order. The section groups them by kind. */
export function toPublicCredentials(items: OwnerCredential[]): CredentialItem[] {
  return items.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title.trim(),
    issuer: c.issuer?.trim() || null,
    year: c.year,
    href: c.url,
  }))
}

/**
 * An https link the page may open, or null: a real host with a dot, no user
 * name or password in it, and no longer than the table allows.
 */
export function safeHttpsUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw || raw.length > CREDENTIAL_URL_MAX) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) return null
  const href = url.toString()
  return href.length <= CREDENTIAL_URL_MAX ? href : null
}

export type ParsedCredential =
  | {
      ok: true
      value: {
        kind: CredentialKind
        title: string
        issuer: string | null
        year: number | null
        url: string | null
      }
    }
  | { ok: false; error: string }

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/**
 * The owner's form, checked the way the table's CHECKs will check it, plus
 * what a CHECK can't: a year after this one is refused.
 */
export function parseCredential(
  input: { kind: unknown; title: unknown; issuer: unknown; year: unknown; url: unknown },
  thisYear: number = new Date().getFullYear()
): ParsedCredential {
  if (!isKind(input.kind)) return { ok: false, error: 'Choose what kind it is.' }
  const title = oneLine(input.title)
  const issuer = oneLine(input.issuer)
  if (!title) return { ok: false, error: 'Add a title.' }
  if (title.length > CREDENTIAL_TITLE_MAX) {
    return { ok: false, error: `Keep the title to ${CREDENTIAL_TITLE_MAX} characters.` }
  }
  if (issuer.length > CREDENTIAL_ISSUER_MAX) {
    return { ok: false, error: `Keep the issuer to ${CREDENTIAL_ISSUER_MAX} characters.` }
  }

  let year: number | null = null
  const rawYear =
    typeof input.year === 'number' ? String(input.year) : oneLine(input.year as unknown)
  if (rawYear) {
    if (!/^\d{4}$/.test(rawYear)) return { ok: false, error: 'Enter the year as four digits.' }
    year = Number(rawYear)
    if (year < CREDENTIAL_YEAR_MIN) {
      return { ok: false, error: `Enter a year from ${CREDENTIAL_YEAR_MIN} on.` }
    }
    if (year > thisYear) return { ok: false, error: 'The year can’t be in the future.' }
  }

  let url: string | null = null
  const rawUrl = typeof input.url === 'string' ? input.url.trim() : ''
  if (rawUrl) {
    url = safeHttpsUrl(rawUrl)
    if (!url) {
      return { ok: false, error: 'Use a full link that starts with https://' }
    }
  }

  return { ok: true, value: { kind: input.kind, title, issuer: issuer || null, year, url } }
}
