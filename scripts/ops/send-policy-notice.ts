/**
 * Send the October 2026 policy update notice (ticket 139) to every account
 * with a confirmed email. The update took effect on October 16, 2026, the day
 * it was posted (founder approved 2026-10-16, counsel review to follow), so
 * send this promptly to tell people what changed.
 *
 * ONLY THE FOUNDER RUNS THIS. An email cannot be unsent.
 *
 * Usage (dry run, the default: prints how many people would get it, nothing else):
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/ops/send-policy-notice.ts
 *
 * Real send (the count must match what the dry run just printed):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... \
 *   npx tsx scripts/ops/send-policy-notice.ts --send --confirm=<count>
 *
 * Safe to re-run. Each sent account is recorded (by user id, never by address)
 * in a progress file in the system temp folder, and a re-run skips them. So if
 * it stops part way, run the dry run again and send to the rest.
 *
 * Never prints or saves an email address.
 */
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { POLICY_UPDATE } from '../../lib/legal/policyUpdate'
import {
  PolicyUpdateNoticeEmail,
  policyUpdateNoticeSubject,
} from '../../lib/email/templates/policy-update-notice'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const RESEND_API_KEY = process.env['RESEND_API_KEY']
const FROM = process.env['RESEND_FROM_EMAIL'] ?? 'The BLACQList <noreply@theblacqlist.com>'
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://theblacqlist.com'

// Resend allows about 2 requests a second by default. Stay under it.
const GAP_MS = 600
const PAGE_SIZE = 1000

const PROGRESS_FILE = join(
  tmpdir(),
  `blacqlist-policy-notice-${POLICY_UPDATE.effectiveAt.slice(0, 10)}.json`
)

interface Recipient {
  id: string
  email: string
}

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

function readSentIds(): Set<string> {
  if (!existsSync(PROGRESS_FILE)) return new Set()
  const parsed: unknown = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'))
  return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
}

function writeSentIds(ids: Set<string>): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify([...ids]))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function listRecipients(): Promise<Recipient[]> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const seen = new Set<string>()
  const recipients: Recipient[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) fail(`could not list accounts: ${error.message}`)
    for (const user of data.users) {
      // Registered users only, and only addresses they have confirmed.
      if (!user.email || !user.email_confirmed_at) continue
      const key = user.email.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      recipients.push({ id: user.id, email: user.email.trim() })
    }
    if (data.users.length < PAGE_SIZE) break
  }
  return recipients
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (values are in .env.local, never commit them).')
  }

  const send = process.argv.includes('--send')

  const all = await listRecipients()
  const sentIds = readSentIds()
  const remaining = all.filter((r) => !sentIds.has(r.id))

  console.log(`Notice: "${policyUpdateNoticeSubject()}"`)
  console.log(`Took effect: ${POLICY_UPDATE.effectiveOnLabel}.`)
  console.log(`Confirmed accounts: ${all.length}. Already sent: ${all.length - remaining.length}. Left to send: ${remaining.length}.`)

  if (!send) {
    console.log(`Dry run. Nothing sent. To send: --send --confirm=${remaining.length}`)
    return
  }

  if (!RESEND_API_KEY) fail('RESEND_API_KEY must be set for a real send.')
  if (argValue('confirm') !== String(remaining.length)) {
    fail(`--confirm must equal the number left to send (${remaining.length}). Run the dry run first.`)
  }

  const resend = new Resend(RESEND_API_KEY)
  const subject = policyUpdateNoticeSubject()
  const react = PolicyUpdateNoticeEmail({ siteUrl: SITE_URL })

  let sent = 0
  let failed = 0
  for (const recipient of remaining) {
    try {
      const { error } = await resend.emails.send({ from: FROM, to: recipient.email, subject, react })
      if (error) {
        failed++
      } else {
        sent++
        sentIds.add(recipient.id)
        writeSentIds(sentIds)
      }
    } catch {
      failed++
    }
    if ((sent + failed) % 25 === 0) console.log(`Progress: ${sent} sent, ${failed} failed, of ${remaining.length}.`)
    await sleep(GAP_MS)
  }

  console.log(`Done: ${sent} sent, ${failed} failed.`)
  if (failed > 0) console.log('Run the dry run again to see how many are left, then send to the rest.')
}

main().catch((err: unknown) => {
  // The message only. A provider error object can carry the request, which
  // includes an address.
  fail(err instanceof Error ? err.message : 'unexpected failure')
})
