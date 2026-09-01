import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import type { ReactElement } from 'react'

import { IS_PRODUCTION } from '@/lib/env'

// Lazy: the Resend SDK throws in its constructor when the key is undefined,
// which used to fail `next build` at import time. Constructed on first send.
let client: Resend | undefined

// The missing-key warning is a configuration fact, not an event — it would be
// true for every send in the process. Report it once and stay quiet after.
let missingKeyReported = false

const FROM = process.env.RESEND_FROM_EMAIL ?? 'The BLACQList <noreply@theblacqlist.com>'

/**
 * Send a transactional email. Never throws — a failed claim-status email must
 * not fail the action that triggered it.
 *
 * WHY THIS REPORTS TO SENTRY. Every failure path here used to end in a
 * `console.log` or `console.error` and nothing else, which means a production
 * outage in transactional email (claim status, verification, password reset)
 * was invisible: no error surface, no alert, and the calling action still
 * returned success. Going public without a Resend deliverability warm-up while
 * also being blind to send failures is a compounding risk, so the silence is
 * fixed first. Behavior is otherwise unchanged.
 */
export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: ReactElement
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`)
    // Locally and in preview this is the expected, intended path. In production
    // it means transactional email is silently off for every user.
    if (IS_PRODUCTION && !missingKeyReported) {
      missingKeyReported = true
      Sentry.captureMessage('RESEND_API_KEY is not set — transactional email is disabled', {
        level: 'warning',
      })
    }
    return
  }

  client ??= new Resend(process.env.RESEND_API_KEY)

  try {
    // The Resend SDK RESOLVES with `{ data, error }` on an API-level failure —
    // it does not throw. A try/catch alone therefore catches only transport
    // errors and would have let every rejected recipient, bad `from` domain, and
    // rate-limit response pass as a success.
    const { error } = await client.emails.send({ from: FROM, to, subject, react })
    if (error) {
      console.error('[email] Send rejected:', subject, '→', to, error)
      Sentry.captureException(new Error(`Resend rejected "${subject}": ${error.message}`), {
        // `to` is a recipient address. It is tagged, not logged as a message
        // body, and Sentry PII scrubbing is configured in sentry-scrub.ts.
        tags: { email_subject: subject, resend_error: error.name },
      })
    }
  } catch (err) {
    console.error('[email] Failed to send:', subject, '→', to, err)
    Sentry.captureException(err, { tags: { email_subject: subject } })
  }
}
