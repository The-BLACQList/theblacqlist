import type { PhotoCandidate, SiteFindings, SocialKey } from '@/lib/import/read-site'
import { summarizeHours } from '@/lib/messaging/quickReplies'
import type { WeeklyHours } from '@/types'

// =============================================================================
// "Import from my website" on the edit page: what to offer (part C, 2026-11-13)
// =============================================================================
// Pure and client-safe. Turns what the reader found into one row per field,
// next to what the page has now. The owner ticks rows; `pairsFor` gives the
// form fields for the ticked ones, which go to updateListingContentAction like
// a card's own Save. A field that already has a value is never ticked for the
// owner, and nothing the page already says is offered again.
// =============================================================================

/** What the page has now, from FinishData. */
export interface PageNow {
  name: string
  description: string | null
  phone: string | null
  email: string | null
  websiteUrl: string | null
  addressLine1: string | null
  state: string | null
  zip: string | null
  hours: WeeklyHours | null
  socials: Record<SocialKey, string | null>
  /** "Atlanta, GA": the page's city, which an import never changes. */
  locationLabel: string | null
}

export interface ImportOptions {
  /** The plan's About limit in characters, or null for none. */
  aboutLimit: number | null
  /** False on Free (social links are a Starter feature, free on creator pages). */
  socialsAllowed: boolean
  /** False on creator pages, which have no hours card. */
  hasHours: boolean
}

/** The card a row lands in, by anchor id, so it can be refreshed after saving. */
export type ImportCard = 'basics' | 'about' | 'contact' | 'hours' | 'social'

export interface ImportRow {
  key: string
  label: string
  /** What would be saved, as the owner reads it. */
  found: string
  /** What the page says now, or null when empty. */
  current: string | null
  card: ImportCard
  pairs: [string, string][]
  defaultChecked: boolean
  /** Why it can't be ticked, or null. */
  locked: string | null
  /** A short extra line, e.g. that the text was shortened. */
  note: string | null
}

export const SOCIAL_FIELDS: Record<SocialKey, string> = {
  instagram: 'social_instagram',
  facebook: 'social_facebook',
  twitter: 'social_twitter',
  tiktok: 'social_tiktok',
  linkedin: 'social_linkedin',
  youtube: 'social_youtube',
}

const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

const NAME_MAX = 200

const blank = (v: string | null | undefined): boolean => !v || !v.trim()
const same = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (a ?? '').trim().toLowerCase().replace(/\s+/g, ' ') === (b ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const digits = (v: string | null | undefined): string => (v ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')

/** Cuts text at the last sentence that fits, or at the limit when none does. */
export function fitText(text: string, max: number | null): string {
  const clean = text.trim()
  if (max === null || clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (stop > max / 2 ? cut.slice(0, stop + 1) : cut).trim()
}

function hoursText(hours: WeeklyHours | null): string | null {
  return hours ? summarizeHours(hours) : null
}

export function importRows(f: SiteFindings, now: PageNow, opts: ImportOptions): ImportRow[] {
  const rows: ImportRow[] = []
  const add = (row: Omit<ImportRow, 'defaultChecked' | 'locked' | 'note'> & { locked?: string | null; note?: string | null }) => {
    const locked = row.locked ?? null
    rows.push({
      ...row,
      locked,
      note: row.note ?? null,
      defaultChecked: row.current === null && locked === null,
    })
  }

  const name = f.name?.trim().slice(0, NAME_MAX) ?? ''
  if (name && !same(name, now.name)) {
    add({ key: 'name', label: 'Name', found: name, current: blank(now.name) ? null : now.name, card: 'basics', pairs: [['name', name]] })
  }

  if (f.about?.trim()) {
    const about = fitText(f.about, opts.aboutLimit)
    if (about && !same(about, now.description)) {
      add({
        key: 'about',
        label: 'About',
        found: about,
        current: blank(now.description) ? null : now.description,
        card: 'about',
        pairs: [['description', about]],
        note:
          about.length < f.about.trim().length && opts.aboutLimit !== null
            ? `Shortened to fit your plan’s ${opts.aboutLimit} characters.`
            : null,
      })
    }
  }

  const phone = f.phones[0]?.trim()
  if (phone && digits(phone) !== digits(now.phone)) {
    add({ key: 'phone', label: 'Phone', found: phone, current: blank(now.phone) ? null : now.phone, card: 'contact', pairs: [['phone', phone]] })
  }

  const email = f.emails[0]?.trim()
  if (email && !same(email, now.email)) {
    add({ key: 'email', label: 'Email', found: email, current: blank(now.email) ? null : now.email, card: 'contact', pairs: [['email', email]] })
  }

  const website = f.website && /^https:\/\//i.test(f.website) ? f.website : null
  if (website && !same(website.replace(/\/$/, ''), (now.websiteUrl ?? '').replace(/\/$/, ''))) {
    add({
      key: 'website',
      label: 'Website',
      found: website,
      current: blank(now.websiteUrl) ? null : now.websiteUrl,
      card: 'contact',
      pairs: [['website_url', website]],
    })
  }

  // Street, state and zip. The page's city is chosen when the page is made
  // and doesn't change here; a different city on the site gets a note.
  const street = f.address?.street?.trim()
  if (street && !same(street, now.addressLine1)) {
    const state = f.address?.state?.trim() || now.state || ''
    const zip = f.address?.zip?.trim() || now.zip || ''
    const city = f.address?.city?.trim()
    const otherCity = city && now.locationLabel && !now.locationLabel.toLowerCase().includes(city.toLowerCase())
    add({
      key: 'address',
      label: 'Address',
      found: [street, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      current: blank(now.addressLine1)
        ? null
        : [now.addressLine1, [now.state, now.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      card: 'contact',
      pairs: [
        ['address_line_1', street],
        ['state', state],
        ['zip', zip],
      ],
      note: otherCity ? `Your site says ${city}. Your page stays in ${now.locationLabel}.` : null,
    })
  }

  if (opts.hasHours && f.hours) {
    const found = hoursText(f.hours)
    const current = hoursText(now.hours)
    if (found && found !== current) {
      add({ key: 'hours', label: 'Hours', found, current, card: 'hours', pairs: [['hours', JSON.stringify(f.hours)]] })
    }
  }

  for (const key of Object.keys(SOCIAL_FIELDS) as SocialKey[]) {
    const url = f.socials[key]
    if (!url || !/^https:\/\//i.test(url) || same(url, now.socials[key])) continue
    add({
      key: `social:${key}`,
      label: SOCIAL_LABELS[key],
      found: url,
      current: blank(now.socials[key]) ? null : now.socials[key],
      card: 'social',
      pairs: [[SOCIAL_FIELDS[key], url]],
      locked: opts.socialsAllowed ? null : 'Social links are part of Starter.',
    })
  }

  return rows
}

/** The form fields for the ticked rows. A locked row is never sent. */
export function pairsFor(rows: readonly ImportRow[], ticked: ReadonlySet<string>): [string, string][] {
  return rows.filter((r) => ticked.has(r.key) && r.locked === null).flatMap((r) => r.pairs)
}

/** The cards the ticked rows land in, to refresh after saving. */
export function cardsFor(rows: readonly ImportRow[], ticked: ReadonlySet<string>): ImportCard[] {
  return [...new Set(rows.filter((r) => ticked.has(r.key) && r.locked === null).map((r) => r.card))]
}

/**
 * Photos worth offering, the site's suggested cover first, then its photos,
 * then logos, without repeats.
 */
export function photoChoices(f: SiteFindings): PhotoCandidate[] {
  const rank = (p: PhotoCandidate) => (p.url === f.suggestedCover ? 0 : p.kind === 'photo' ? 1 : 2)
  const seen = new Set<string>()
  return [...f.photos]
    .sort((a, b) => rank(a) - rank(b))
    .filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)))
}

/** How many photos the owner can bring in now: the plan's room, at most one import's worth. */
export function photoRoom(limit: number | null, count: number, perImport: number): number {
  return Math.max(0, Math.min(perImport, limit === null ? perImport : limit - count))
}
