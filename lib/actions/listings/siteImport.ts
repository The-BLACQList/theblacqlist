'use server'

import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { MAX_PHOTOS_PER_IMPORT } from '@/lib/import/limits'
import type { SiteFindings } from '@/lib/import/read-site'
import {
  importPhotosFor,
  readSiteFor,
  type PhotoFailure,
  type PhotoImportOutcome,
  type PhotoPick,
  type ReadFailure,
} from '@/lib/import/siteImportCore'

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
// The work is in lib/import/siteImportCore.ts, shared with "Import from my
// website" on the edit page. Here: the flag, sign-in, and step 0's wording.
// =============================================================================

export type { PhotoImportOutcome, PhotoPick }

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
} as const satisfies Record<ReadFailure | 'off' | 'signedOut', string>

export type ReadSiteResult = { ok: true; findings: SiteFindings } | { ok: false; error: string }

export async function readSiteAction(rawUrl: string): Promise<ReadSiteResult> {
  if (!isFeatureEnabled('siteImport')) return { ok: false, error: READ_ERRORS.off }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: READ_ERRORS.signedOut }

  const result = await readSiteFor(user.id, rawUrl)
  return result.ok ? result : { ok: false, error: READ_ERRORS[result.reason] }
}

// ── Photos ──────────────────────────────────────────────────────────────────

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
} as const satisfies Record<PhotoFailure | 'off' | 'signedOut', string>

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

  const result = await importPhotosFor({
    supabase,
    userId: user.id,
    listingId: input?.listingId,
    picks: input?.picks,
    rightsConfirmed: input?.rightsConfirmed,
  })
  return result.ok ? result : { ok: false, error: PHOTO_ERRORS[result.reason] }
}
