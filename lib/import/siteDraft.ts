import type { FoundAddress, SiteFindings } from '@/lib/import/read-site'
import { aboutMax, NAME_MAX, type QuickStartAnswers, type QuickStep } from '@/lib/listings/quickStart'
import type { SocialLinks, WeeklyHours } from '@/types'

// =============================================================================
// From "what we found on your site" to the quick start draft (ticket 127)
// =============================================================================
// Pure and client-safe. Step 0 calls `applyFindings` once the owner taps "Use
// this"; QuickStart keeps the returned SiteDraft beside the answers and adds
// `siteFormFields` to the createListing form on "Save my draft".
//
// The owner's own typing always wins: a field they already filled is never
// overwritten, and a disagreement becomes a "Which is right?" choice first.
// =============================================================================

/** What step 0 hands to the rest of the flow. Kept in the saved draft. */
export interface SiteDraft {
  sourceHost: string
  /** The listing id the photos were stored under; createListing reuses it. */
  tempId: string
  phone: string | null
  /** The page's contact email, when the owner chose the one from their site. */
  email: string | null
  website: string | null
  address: FoundAddress | null
  hours: WeeklyHours | null
  socials: Partial<SocialLinks>
  logoPath: string | null
  coverPath: string | null
  /** Steps whose answer came from the site, for the "From your site" tag. */
  fromSite: QuickStep[]
}

// Personal mail providers. A sign-in on any other domain is probably the
// business's own, so step 0 starts with that domain filled in.
const PERSONAL_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com',
  'gmx.us', 'mail.com', 'zoho.com', 'yandex.com', 'hey.com', 'fastmail.com',
  'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net', 'bellsouth.net',
  'cox.net', 'charter.net', 'earthlink.net', 'optonline.net', 'juno.com',
])

/** "maya@glowsalon.com" gives "glowsalon.com"; a personal or school address gives "". */
export function businessDomainFromEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return ''
  const domain = email.slice(at + 1).trim().toLowerCase()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return ''
  if (PERSONAL_MAIL.has(domain) || domain.endsWith('.edu')) return ''
  return domain
}

/** Where the site and the draft disagree, before anything is applied. */
export interface SiteConflicts {
  /** The owner already typed a different name. */
  name: { typed: string; site: string } | null
  /** Two or more phones on the site. */
  phones: string[]
  /** The site's email differs from the sign-in email. */
  email: { signIn: string; site: string } | null
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function findConflicts(
  findings: SiteFindings,
  answers: QuickStartAnswers,
  signInEmail: string
): SiteConflicts {
  const siteName = findings.name?.trim() ?? ''
  const typed = answers.name.trim()
  const siteEmail = findings.emails[0] ?? ''
  return {
    name: siteName && typed && !same(siteName, typed) ? { typed, site: siteName } : null,
    phones: findings.phones.length > 1 ? findings.phones : [],
    email: siteEmail && signInEmail && !same(siteEmail, signInEmail) ? { signIn: signInEmail, site: siteEmail } : null,
  }
}

/** The owner's answers to the "Which is right?" card. */
export interface ConflictChoices {
  name: 'typed' | 'site'
  phone: string | null
  email: 'signIn' | 'site'
}

export interface CityMatch {
  id: string
  name: string
  stateCode: string | null
}

/** Cuts long about text at the last sentence that fits. */
function fitAbout(text: string): string {
  const max = aboutMax()
  const clean = text.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (stop > max / 2 ? cut.slice(0, stop + 1) : cut).trim()
}

/**
 * The answers patch and SiteDraft for what the owner accepted. Photo paths are
 * filled in by the caller after the import, since they depend on the server.
 */
export function applyFindings(args: {
  findings: SiteFindings
  answers: QuickStartAnswers
  choices: ConflictChoices
  cities: readonly CityMatch[]
  tempId: string
}): { patch: Partial<QuickStartAnswers>; site: SiteDraft } {
  const { findings, answers, choices, cities, tempId } = args
  const patch: Partial<QuickStartAnswers> = {}
  const fromSite: QuickStep[] = []

  const siteName = findings.name?.trim().slice(0, NAME_MAX) ?? ''
  if (siteName && (!answers.name.trim() || choices.name === 'site')) {
    patch.name = siteName
    fromSite.push('name')
  }

  if (findings.about && !answers.about.trim()) {
    patch.about = fitAbout(findings.about)
    fromSite.push('about')
  }

  // A city the owner has not picked yet: one of ours when it matches, else typed.
  const addr = findings.address
  if (addr?.city && !answers.cityId && !answers.cityText.trim()) {
    const match = cities.find(
      (c) => same(c.name, addr.city!) && (!addr.state || !c.stateCode || same(c.stateCode, addr.state))
    )
    if (match) patch.cityId = match.id
    else {
      patch.cityText = addr.city
      patch.stateText = addr.state ?? ''
    }
    fromSite.push('where')
  }

  const phone = choices.phone ?? findings.phones[0] ?? null
  const siteEmail = findings.emails[0] ?? null
  const website = findings.website && /^https:\/\//i.test(findings.website) ? findings.website : null

  return {
    patch,
    site: {
      sourceHost: findings.sourceHost,
      tempId,
      phone,
      email: siteEmail && choices.email === 'site' ? siteEmail : null,
      website,
      address: addr,
      hours: findings.hours,
      socials: findings.socials,
      logoPath: null,
      coverPath: null,
      fromSite,
    },
  }
}

const SOCIAL_FIELDS: Record<keyof SocialLinks, string> = {
  instagram: 'social_instagram',
  facebook: 'social_facebook',
  twitter: 'social_twitter',
  tiktok: 'social_tiktok',
  linkedin: 'social_linkedin',
  youtube: 'social_youtube',
}

/**
 * The extra createListing fields from the site. Phone is left to the caller,
 * since a "Call" button's number wins over the site's.
 */
export function siteFormFields(site: SiteDraft): [string, string][] {
  const out: [string, string][] = [
    ['imported_from', site.sourceHost],
    ['temp_entity_id', site.tempId],
  ]
  if (site.website) out.push(['website_url', site.website])
  if (site.address?.street) out.push(['address_line_1', site.address.street])
  if (site.address?.street && site.address.zip) out.push(['zip', site.address.zip])
  if (site.hours) out.push(['hours', JSON.stringify(site.hours)])
  for (const [key, field] of Object.entries(SOCIAL_FIELDS) as [keyof SocialLinks, string][]) {
    const url = site.socials[key]
    if (url) out.push([field, url])
  }
  if (site.logoPath) out.push(['logo_path', site.logoPath])
  if (site.coverPath) out.push(['cover_image_path', site.coverPath])
  return out
}
