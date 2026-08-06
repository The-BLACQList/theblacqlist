import { Resend } from 'resend'
import type { ReactElement } from 'react'

// Lazy: the Resend SDK throws in its constructor when the key is undefined,
// which used to fail `next build` at import time. Constructed on first send.
let client: Resend | undefined

const FROM = process.env.RESEND_FROM_EMAIL ?? 'The BLACQList <noreply@theblacqlist.com>'

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
    return
  }
  client ??= new Resend(process.env.RESEND_API_KEY)
  try {
    await client.emails.send({ from: FROM, to, subject, react })
  } catch (err) {
    console.error('[email] Failed to send:', subject, '→', to, err)
  }
}
