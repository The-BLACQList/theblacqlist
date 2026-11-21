import type Stripe from 'stripe'

import { writeSystemAuditLog } from '@/lib/audit/system'
import { stripe } from '@/lib/stripe/client'
import type { createServiceClient } from '@/lib/supabase/server'

import { revalidateChanged, syncOwnerPlan } from './planPages'

// Ticket 243. Terms 13.9: "If you delete your account, your paid plan is
// cancelled at the same time and no further charges are made." This runs
// BEFORE the auth user is deleted, for two reasons:
//   - deleting the user CASCADE-deletes `subscriptions`, our only record of
//     which Stripe subscriptions and customers are theirs;
//   - it SET NULLs `listings.owner_user_id`, and the tier sync is keyed on the
//     owner, so pages orphaned while still paid would keep a paid tier forever.
// Any failure throws, and the caller keeps the account: a half-done deletion
// that leaves a live subscription nobody can reach is the worst outcome.

type ServiceClient = ReturnType<typeof createServiceClient>

/** Stripe statuses that can still charge, or come back and charge. */
const CANCELABLE = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
])

/** Our rows that still hold a plan (the same three the tier sync reads). */
const LIVE_DB_STATUSES = ['active', 'trialing', 'past_due'] as const

export interface AccountPlanCancelResult {
  /** Stripe subscription ids cancelled now. */
  canceled: string[]
  /** Pages whose tier changed (all to free). */
  pagesChanged: number
}

function isMissing(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'resource_missing'
}

async function cancelOne(id: string): Promise<boolean> {
  try {
    await stripe.subscriptions.cancel(
      id,
      {
        // Ends now: no proration credit, no final invoice (Terms 13.5, 13.9).
        prorate: false,
        invoice_now: false,
        cancellation_details: { comment: 'account deleted' },
      },
      { idempotencyKey: `account-delete:${id}` }
    )
    return true
  } catch (err) {
    if (isMissing(err)) return false
    // Already over (e.g. cancelled a moment ago in the portal) counts as done.
    const sub = await stripe.subscriptions.retrieve(id).catch(() => null)
    if (sub && (sub.status === 'canceled' || sub.status === 'incomplete_expired')) return false
    throw err
  }
}

export async function cancelPlansForDeletedAccount(
  service: ServiceClient,
  user: { id: string; email?: string | null }
): Promise<AccountPlanCancelResult> {
  const userId = user.id

  const { data: rows, error: rowsError } = await service
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, status')
    .eq('user_id', userId)
  if (rowsError) throw new Error(`subscriptions read failed: ${rowsError.message}`)

  const { count: ownedPages, error: pagesError } = await service
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', userId)
  if (pagesError) throw new Error(`owned pages read failed: ${pagesError.message}`)

  const subRows = rows ?? []
  // Only owners can buy a plan (checkout needs a page). Someone with no rows
  // and no pages has nothing to cancel, so Stripe isn't called at all.
  if (subRows.length === 0 && !ownedPages) return { canceled: [], pagesChanged: 0 }

  const ours = new Set(
    subRows.map((r) => r.stripe_subscription_id).filter((id): id is string => Boolean(id))
  )
  const customers = new Set(
    subRows.map((r) => r.stripe_customer_id).filter((id): id is string => Boolean(id))
  )
  // Checkout without an earlier subscription, and the tester trial, create the
  // customer from the email, so one person can have several customers. This
  // also catches a subscription whose webhook hasn't landed yet.
  if (user.email) {
    const found = await stripe.customers.list({ email: user.email, limit: 100 })
    for (const c of found.data) customers.add(c.id)
  }

  const toCancel = new Set<string>()
  const seen = new Set<string>()
  for (const customer of customers) {
    const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 })
    for (const sub of subs.data) {
      seen.add(sub.id)
      // Every checkout stamps metadata.user_id; a customer found by email
      // could hold someone else's plan, so it must be ours by row or stamp.
      const mine = ours.has(sub.id) || sub.metadata?.user_id === userId
      if (mine && CANCELABLE.has(sub.status)) toCancel.add(sub.id)
    }
  }
  // A row whose customer we couldn't list (no customer id stored).
  for (const id of ours) {
    if (seen.has(id)) continue
    const sub = await stripe.subscriptions.retrieve(id).catch((err: unknown) => {
      if (isMissing(err)) return null
      throw err
    })
    if (sub && CANCELABLE.has(sub.status)) toCancel.add(sub.id)
  }

  const canceled: string[] = []
  for (const id of toCancel) {
    if (await cancelOne(id)) canceled.push(id)
  }

  // The account is going: every row stops holding a plan, whatever Stripe said.
  const { error: updateError } = await service
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', [...LIVE_DB_STATUSES])
  if (updateError) throw new Error(`subscriptions cancel write failed: ${updateError.message}`)

  // Drop the pages to free while they still have an owner the sync can find.
  const sync = await syncOwnerPlan(service, userId, { fill: false })
  const changes = sync.skipped ? [] : sync.changes

  if (canceled.length > 0 || changes.length > 0) {
    // Before deleteUser: the actor FK can't point at a deleted user.
    await writeSystemAuditLog({
      actorUserId: userId,
      action: 'subscription_canceled_account_deleted',
      targetTable: 'subscriptions',
      targetId: null,
      afterState: {
        canceled_subscriptions: canceled,
        pages_to_free: changes.map((c) => c.id),
      },
    })
  }

  try {
    await revalidateChanged(service, changes)
  } catch (err) {
    console.error('[accountDeletion] revalidate failed:', err)
  }

  return { canceled, pagesChanged: changes.length }
}
