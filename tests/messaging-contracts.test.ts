// =============================================================================
// Customer → business messaging (2026-11-13): source contracts.
// =============================================================================
// vitest runs with env: node and no database, so the security-relevant wiring
// is pinned by source text: the migration's RLS and grants, and each action's
// flag check, rate limit and write path. The rules themselves are in
// tests/messaging-rules.test.ts. Run the RLS check against a local Supabase
// before applying the migration (see the migration header).
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { VALID_CTA_TYPES } from '@/lib/constants/listing'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

const SQL = source('supabase/migrations/20261113000002_messaging.sql')
/** SQL with -- comments stripped, so prose can't satisfy or trip a check. */
const CODE = SQL.replace(/--.*$/gm, '')

describe('migration 20261113000002_messaging.sql', () => {
  it('adds the inbox switch, closed by default', () => {
    expect(CODE).toMatch(/messaging_enabled\s+boolean\s+NOT NULL\s+DEFAULT\s+false/i)
  })

  it('enables RLS on every new table', () => {
    for (const t of ['conversations', 'messages', 'message_blocks', 'messaging_suspensions']) {
      expect(CODE).toMatch(new RegExp(`ALTER TABLE\\s+public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`, 'i'))
    }
  })

  it('gives clients read-only policies: no INSERT, UPDATE or DELETE policy anywhere', () => {
    const policies = CODE.match(/CREATE POLICY[\s\S]*?;/gi) ?? []
    expect(policies.length).toBeGreaterThan(0)
    for (const p of policies) {
      expect(p).toMatch(/FOR SELECT/i)
      expect(p).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/i)
    }
  })

  it('never grants writes to anon or authenticated', () => {
    expect(CODE).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE|ALL)[^;]*TO[^;]*\b(anon|authenticated)\b/i)
  })

  it('gives messaging_suspensions no client policy at all (service role only)', () => {
    expect(CODE).not.toMatch(/CREATE POLICY[^;]*ON\s+public\.messaging_suspensions/i)
  })

  it('keeps one thread per customer per business', () => {
    expect(CODE).toMatch(/UNIQUE\s*\(\s*listing_id\s*,\s*customer_user_id\s*\)/i)
  })

  it('caps message bodies at 2000 characters in the database too', () => {
    expect(CODE).toMatch(/char_length\(body\)\s+BETWEEN\s+1\s+AND\s+2000/i)
  })

  it('widens the queue_type CHECK with message_report and keeps every earlier value', () => {
    const check = CODE.match(/moderation_queue_queue_type_check\s+CHECK\s*\(([\s\S]*?)\)\s*;/i)?.[1] ?? ''
    for (const v of ['claim', 'correction', 'review', 'flagged_listing', 'verification', 'new_submission', 'message_report']) {
      expect(check).toContain(`'${v}'`)
    }
  })

  it('runs the unread count as the caller (SECURITY INVOKER), so RLS still applies', () => {
    const fn = CODE.match(/FUNCTION public\.unread_message_count[\s\S]*?\$\$;/i)?.[0] ?? ''
    expect(fn).toMatch(/SECURITY INVOKER/i)
    expect(fn).not.toMatch(/SECURITY DEFINER/i)
  })

  it('pins search_path on the definer helper and only answers about the caller', () => {
    const fn = CODE.match(/FUNCTION public\.messaging_restricted[\s\S]*?\$\$;/i)?.[0] ?? ''
    expect(fn).toMatch(/SECURITY DEFINER/i)
    expect(fn).toMatch(/SET search_path/i)
    expect(fn).toMatch(/auth\.uid\(\)/)
  })

  it('writes out a down plan', () => {
    expect(SQL).toMatch(/down/i)
  })
})

const ACTIONS = {
  start: 'lib/actions/messaging/startConversation.ts',
  send: 'lib/actions/messaging/sendMessage.ts',
  read: 'lib/actions/messaging/markConversationRead.ts',
  inbox: 'lib/actions/messaging/setInboxOpen.ts',
  block: 'lib/actions/messaging/blockUser.ts',
  report: 'lib/actions/messaging/reportConversation.ts',
} as const

describe('messaging server actions', () => {
  it.each(Object.entries(ACTIONS))('%s is a server action behind FEATURE_MESSAGING', (_name, file) => {
    const src = source(file)
    expect(src.startsWith("'use server'")).toBe(true)
    expect(src).toContain("isFeatureEnabled('messaging')")
  })

  it('rate-limits starting, sending and reporting in their own buckets', () => {
    expect(source(ACTIONS.start)).toContain("bucket: 'message_start'")
    expect(source(ACTIONS.send)).toContain("bucket: 'message_send'")
    expect(source(ACTIONS.report)).toContain("bucket: 'message_report'")
  })

  it('puts new conversations behind Turnstile', () => {
    expect(source(ACTIONS.start)).toContain('verifyTurnstileFormData')
  })

  it('checks the inbox switch only when starting, never on replies', () => {
    expect(source(ACTIONS.start)).toContain('messaging_enabled')
    expect(source(ACTIONS.send)).not.toContain('messaging_enabled')
  })

  it('checks blocks and suspensions before every send', () => {
    for (const file of [ACTIONS.start, ACTIONS.send]) {
      const src = source(file)
      expect(src).toContain('isMessagingSuspended')
      expect(src).toContain('isBlocked')
    }
  })

  it('scopes the inbox switch to the caller’s own, live listing', () => {
    const src = source(ACTIONS.inbox)
    expect(src).toContain(".eq('owner_user_id'")
    expect(src).toContain(".is('deleted_at', null)")
  })

  it('files reports into the admin queue as message_report', () => {
    expect(source(ACTIONS.report)).toContain("queue_type: 'message_report'")
  })

  it('suspends by the user named in the report, never a user id from the form', () => {
    const src = source('lib/actions/admin/suspendMessaging.ts')
    const suspend = src.slice(src.indexOf('export async function suspendMessagingAction'), src.indexOf('export async function liftMessagingSuspensionAction'))
    expect(suspend).toContain('getAdminSession')
    expect(suspend).toContain('details.reported_user_id')
    expect(suspend).not.toContain("formData.get('user_id')")
  })
})

describe('inbox pages', () => {
  it.each([
    'app/account/messages/page.tsx',
    'app/account/messages/[conversationId]/page.tsx',
    'app/dashboard/messages/page.tsx',
    'app/dashboard/messages/[conversationId]/page.tsx',
    'app/dashboard/messages/settings/page.tsx',
  ])('%s 404s while the flag is off', (file) => {
    expect(source(file)).toMatch(/if \(!isFeatureEnabled\('messaging'\)\) notFound\(\)/)
  })

  it('guards the admin report page', () => {
    expect(source('app/admin/reports/messages/page.tsx')).toContain('await requireAdmin()')
  })
})

// ── Owner-experience round 2, part A ────────────────────────────────────────

const SEND_AS = source('supabase/migrations/20261113000003_messaging_send_as.sql').replace(/--.*$/gm, '')
const MESSAGE_TO_EMAIL = source('supabase/migrations/20261113000004_cta_message_to_email.sql').replace(/--.*$/gm, '')

describe('migration 20261113000003_messaging_send_as.sql', () => {
  it('adds the sending page as a nullable column that survives the page being deleted', () => {
    expect(SEND_AS).toMatch(
      /ADD COLUMN IF NOT EXISTS customer_listing_id uuid NULL\s+REFERENCES public\.listings\(id\) ON DELETE SET NULL/i
    )
  })

  it('keeps one thread per person per business', () => {
    expect(SEND_AS).not.toMatch(/DROP CONSTRAINT[^;]*conversations_listing_customer_key/i)
  })

  it('allows the email button type and keeps every earlier type', () => {
    const check = SEND_AS.match(/CHECK \(cta_type IN \(([^)]*)\)\)/i)?.[1] ?? ''
    for (const t of VALID_CTA_TYPES) expect(check).toContain(`'${t}'`)
  })

  it('changes no data (the backfill is its own migration, applied after the deploy)', () => {
    expect(SEND_AS).not.toMatch(/\bUPDATE\b/i)
    expect(SEND_AS).not.toMatch(/\bDELETE\s+FROM\b/i)
  })

  it('touches no RLS policy or grant', () => {
    expect(SEND_AS).not.toMatch(/POLICY|GRANT/i)
  })
})

describe('migration 20261113000004_cta_message_to_email.sql', () => {
  it('only rewrites message buttons that hold an email address or an https link', () => {
    const updates = MESSAGE_TO_EMAIL.match(/UPDATE[\s\S]*?;/gi) ?? []
    expect(updates).toHaveLength(2)
    for (const u of updates) expect(u).toMatch(/WHERE cta_type = 'message'\s+AND cta_url ~/i)
    expect(updates[0]).toMatch(/SET cta_type = 'email'/)
    expect(updates[1]).toMatch(/SET cta_type = 'contact'/)
  })
})

describe('send as a page', () => {
  const start = source('lib/actions/messaging/startConversation.ts')

  it('only lets the sender use their own live page', () => {
    const check = start.slice(start.indexOf('if (asListingId) {'), start.indexOf(".insert({"))
    expect(check).toContain(".eq('owner_user_id', user.id)")
    expect(check).toContain(".eq('status', 'published')")
    expect(check).toContain(".is('deleted_at', null)")
  })

  it('stores the page only when a new thread is created', () => {
    expect(start).toMatch(/insert\(\{ listing_id: listingId, customer_user_id: user\.id, customer_listing_id: asListingId \}\)/)
    const code = start.replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, '')
    expect(code.match(/customer_listing_id/g)).toHaveLength(1)
  })

  it('names other pages only for conversations RLS already returned', () => {
    const loaders = source('lib/messaging/loaders.ts')
    const inbox = loaders.slice(loaders.indexOf('export async function listInbox'), loaders.indexOf('async function readListingsAsService'))
    // Conversations come from the request client; only then are names read.
    expect(inbox).toContain("supabase\n          .from('conversations')")
    expect(inbox.indexOf('readListingsAsService(')).toBeGreaterThan(inbox.indexOf("from('conversations')"))
  })
})

describe('message composer on the listing page', () => {
  it('stays mounted after the first send flips the mode to thread', () => {
    const page = source('app/[citySlug]/[entityType]/[listingSlug]/page.tsx')
    expect(page).toContain('composerMounted(messaging?.mode)')
    expect(page).toContain('{showComposer && (')
    expect(page).not.toMatch(/mode === 'compose' &&/)
  })

  it('names the business in the confirmation', () => {
    const composer = source('components/messaging/MessageComposer.tsx')
    expect(composer).toContain('Message sent to {businessName}')
  })
})
