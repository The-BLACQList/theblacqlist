import { sendEmail } from '@/lib/email/resend'
import {
  LAUNCH_W0_SUBJECT,
  LaunchW0OnTheListEmail,
} from '@/lib/email/templates/launch-w0-on-the-list'

/**
 * W0, the automatic "You're on the list" confirmation for a new launch-list
 * signup (marketing OS, pre-launch waitlist sequence).
 *
 * OFF BY DEFAULT. Three things must all be true before anything is sent:
 *
 *   LAUNCH_CONFIRMATION_EMAIL_ENABLED === 'true'
 *       The send_email approval is the founder's (GATE-COMMS). Shipping this
 *       code changes nothing until the flag is set in the environment.
 *   SENDER_POSTAL_ADDRESS is set
 *       Required in the footer of every commercial email (CAN-SPAM / CASL).
 *       Business Operations supplies it; it is not in the repo.
 *   LAUNCH_UNSUBSCRIBE_URL is set
 *       The app has no unsubscribe handler. Broadcasts get Resend's own
 *       {{{RESEND_UNSUBSCRIBE_URL}}}, but a transactional send through
 *       emails.send does not, so the URL has to be configured.
 *
 * If the flag is on but either value is missing, the send is skipped with a
 * warning rather than going out without a legal footer.
 *
 * Flags are read at call time, not at import, so a change in the environment
 * takes effect on the next request and tests can set them per case.
 */

export type LaunchConfirmationResult = 'disabled' | 'missing_config' | 'sent'

export function isLaunchConfirmationEnabled(): boolean {
  return process.env.LAUNCH_CONFIRMATION_EMAIL_ENABLED === 'true'
}

export async function sendLaunchConfirmation(email: string): Promise<LaunchConfirmationResult> {
  if (!isLaunchConfirmationEnabled()) return 'disabled'

  const postalAddress = process.env.SENDER_POSTAL_ADDRESS?.trim()
  const unsubscribeUrl = process.env.LAUNCH_UNSUBSCRIBE_URL?.trim()
  if (!postalAddress || !unsubscribeUrl) {
    console.warn(
      '[launch-confirmation] LAUNCH_CONFIRMATION_EMAIL_ENABLED is on, but SENDER_POSTAL_ADDRESS ' +
        'and LAUNCH_UNSUBSCRIBE_URL must both be set. W0 was not sent.'
    )
    return 'missing_config'
  }

  // sendEmail never throws; a failed confirmation must not fail the signup.
  await sendEmail({
    to: email,
    subject: LAUNCH_W0_SUBJECT,
    react: LaunchW0OnTheListEmail({ unsubscribeUrl, postalAddress }),
  })
  return 'sent'
}
