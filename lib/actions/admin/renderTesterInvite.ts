'use server'

import { render } from '@react-email/components'

import { getAdminSession } from '@/lib/admin/guard'
import { TesterInviteEmail } from '@/lib/email/templates/tester-invite'

export type TesterInvitePreviewState =
  | { html: string; text: string; subject: string }
  | { error: string }
  | null

const SUBJECT = "You're in early. Add your business to The BLACQList"

/**
 * Render the tester invite for the founder to look at and copy into Gmail.
 *
 * This is a server ACTION, not a GET route, on purpose. The preview link
 * carries the coming-soon bypass token, and Vercel logs request URLs — a
 * `?link=` query string would put the token in the platform logs of every
 * request. A POSTed form body does not appear there.
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
  // own POST endpoint — it does not inherit a layout's guard.
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const previewLink = formData.get('preview_link')?.toString().trim() ?? ''
  const firstName = formData.get('first_name')?.toString().trim() ?? ''

  if (!previewLink) return { error: 'Paste the preview link first.' }

  let parsed: URL
  try {
    parsed = new URL(previewLink)
  } catch {
    return { error: 'That is not a full URL. It must start with https://.' }
  }

  // https only, always. A tester who opens an http:// link gets redirected,
  // and a redirect is exactly where a query string gets dropped.
  if (parsed.protocol !== 'https:') {
    return { error: 'Use the https:// version of the link, not http://.' }
  }
  if (!parsed.searchParams.get('preview')) {
    return {
      error:
        'That link has no ?preview= on it. Without the token it is just a link to the coming-soon page.',
    }
  }

  const email = TesterInviteEmail({
    previewLink,
    firstName: firstName || null,
  })

  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ])

  return { html, text, subject: SUBJECT }
}
