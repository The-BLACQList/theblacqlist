'use server'

import { render } from '@react-email/components'

import { getAdminSession } from '@/lib/admin/guard'
import {
  TesterInviteEmail,
  type TesterInviteAudience,
  type TesterInviteVariant,
} from '@/lib/email/templates/tester-invite'
import { TesterUpdateEmail } from '@/lib/email/templates/tester-update'
import { isWellFormedTesterToken } from '@/lib/tester/links'

// A 'use server' file may export only async functions (and types). Constants
// stay module-private.

export type TesterInvitePreviewState =
  | { html: string; text: string; subject: string; shareable: boolean }
  | { error: string }
  | null

/** Which tester email: the first invite, or the update for people already testing. */
export type TesterEmailKind = 'invite' | 'update'

const INVITE_SUBJECT: Record<TesterInviteAudience, string> = {
  owner: "You're in early. Add your business to The BLACQList",
  supporter: "You're in early. Explore The BLACQList before anyone else",
  shared: "You're in early. Try The BLACQList before anyone else",
}

const UPDATE_SUBJECT = 'Before we open: finish your walk and see The Collective'

/** Long enough for "Tuesday, 17 November", short enough to stay one line. */
const OPENING_DATE_MAX = 40

const MAKE_A_LINK = 'Make a link on the Testers page and paste it here.'

function parseAudience(raw: string): TesterInviteAudience | null {
  return raw === 'owner' || raw === 'supporter' || raw === 'shared' ? raw : null
}

function parseKind(raw: string): TesterEmailKind | null {
  return raw === 'invite' || raw === 'update' ? raw : null
}

/**
 * Checks the pasted link is a one-tap tester link: https, path /t, and a
 * well-formed token in the fragment. Returns an error string, or null when it
 * is fine. Shape only: a well-formed token can still be spent or expired, and
 * /t says so to the tester. Checking it here would mean a database read keyed
 * on a live token for a page that only renders.
 */
function checkTesterLink(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return 'That is not a full link. It must start with https://.'
  }

  // https only, always. An http:// link is redirected, and a redirect is
  // exactly where a careless client drops the fragment.
  if (parsed.protocol !== 'https:') {
    return 'Use the https:// version of the link, not http://.'
  }
  if (parsed.searchParams.has('preview')) {
    return `That is an old ?preview= link. Testers now start from a one-tap link. ${MAKE_A_LINK}`
  }
  if (parsed.pathname !== '/t') {
    return `That is not a tester link. It should end in /t#… ${MAKE_A_LINK}`
  }
  if (!isWellFormedTesterToken(parsed.hash.replace(/^#/, ''))) {
    return `That link is missing its code, or the code got cut off. ${MAKE_A_LINK}`
  }
  return null
}

/**
 * Render a tester email for the founder to look at and copy into Gmail.
 *
 * This is a server ACTION, not a GET route, on purpose. The one-tap link
 * carries a live token, and Vercel logs request URLs. A `?link=` query string
 * would put the token in the platform logs of every request; a POSTed form
 * body does not appear there.
 *
 * For the same reason there is no audit-log write here: `writeAuditLog`
 * persists an `afterState` blob, and the only interesting thing to record
 * would be the token. Rendering a preview changes nothing, so there is
 * nothing worth auditing at the cost of storing a live token in a table.
 *
 * Nothing is sent from this page. Sending is GATE-COMMS and happens from the
 * founder's own mailbox, one recipient at a time.
 */
export async function renderTesterInviteAction(
  _prev: TesterInvitePreviewState,
  formData: FormData
): Promise<TesterInvitePreviewState> {
  // The /admin layout already calls requireAdmin(), but a server action is its
  // own POST endpoint. It does not inherit a layout's guard.
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const kind = parseKind(formData.get('email_kind')?.toString() ?? '')
  const testerLink = formData.get('tester_link')?.toString().trim() ?? ''
  const firstName = formData.get('first_name')?.toString().trim() ?? ''
  const openingDate = formData.get('opening_date')?.toString().trim() ?? ''
  const audience = parseAudience(formData.get('audience')?.toString() ?? '')

  // No silent defaults. The wrong email, or the owner copy sent to a
  // supporter, is the mistake this page exists to prevent.
  if (!kind) return { error: 'Pick which email this is.' }
  if (!testerLink) return { error: 'Paste the tester link first.' }
  if (!audience) return { error: 'Pick who this email is for.' }
  // The update thanks one person for testing they have already done, and its
  // owner lines depend on which they are. A shared link has no one person.
  if (kind === 'update' && audience === 'shared') {
    return { error: 'The tester update goes to one tester. Pick business owner or supporter.' }
  }

  const linkError = checkTesterLink(testerLink)
  if (linkError) return { error: linkError }

  if (kind === 'update' && openingDate.length > OPENING_DATE_MAX) {
    return {
      error: `Keep the opening date short, like "Tuesday, 17 November" (${OPENING_DATE_MAX} characters at most).`,
    }
  }

  const email =
    kind === 'invite'
      ? TesterInviteEmail({ variant: audience, testerLink, firstName: firstName || null })
      : TesterUpdateEmail({
          // Narrowed by the 'shared' check above.
          variant: audience as TesterInviteVariant,
          testerLink,
          firstName: firstName || null,
          openingDate: openingDate || null,
        })

  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })])

  return {
    html,
    text,
    subject: kind === 'invite' ? INVITE_SUBJECT[audience] : UPDATE_SUBJECT,
    shareable: audience === 'shared',
  }
}
