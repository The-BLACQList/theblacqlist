'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { writeSystemAuditLog } from '@/lib/audit/system'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { revalidateChanged, parseOwnerPlanSync } from '@/lib/services/billing/planPages'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Ticket 238: "Pages on Your Plan". The owner chooses which of their pages the
// plan covers. The database function set_plan_page_coverage applies the
// choice in one transaction (removals first, so a move never trips the cap),
// checks every page against the owner and the plan, and resets every page's
// tier. This action only checks the request, calls it, and records it.

export type PlanPagesResult = { ok: true } | { ok: false; error: string }

const ids = z.array(z.uuid()).max(3)
const inputSchema = z
  .object({ add: ids.optional(), remove: ids.optional() })
  .strict()
  .refine((v) => (v.add?.length ?? 0) + (v.remove?.length ?? 0) > 0)

const TRY_AGAIN = 'We couldn’t save that. Please try again.'
const NOT_FOUND = 'Page not found, or you can’t edit it.'
const PLAN_PAGES_RATE_LIMIT = 20

/** The database's refusals, in the owner's words. */
function refusal(error: { code?: string | null; message?: string | null }): string {
  if (error.message === 'NO_PLAN') return 'Choosing pages comes with a paid plan.'
  if (error.code === '23514') {
    return error.message?.startsWith('Your plan already covers')
      ? 'Your plan already covers as many pages as it can. Remove one first.'
      : 'That page can’t be put on your plan.'
  }
  return TRY_AGAIN
}

export async function setPlanPagesAction(raw: {
  add?: string[]
  remove?: string[]
}): Promise<PlanPagesResult> {
  const session = await getOwnerSession()
  if (!session) return { ok: false, error: 'Please sign in again.' }

  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: NOT_FOUND }
  const add = [...new Set(parsed.data.add ?? [])]
  const remove = [...new Set(parsed.data.remove ?? [])].filter((id) => !add.includes(id))
  const userId = session.user.id

  const allowed = await checkRateLimit({
    bucket: 'plan_pages',
    identifier: userId,
    limit: PLAN_PAGES_RATE_LIMIT,
  })
  if (!allowed) return { ok: false, error: 'Too many changes. Please wait a minute and try again.' }

  // Pages being added must be the owner's own (the database checks again).
  if (add.length > 0) {
    const supabase = await createClient()
    const { data: owned, error } = await supabase
      .from('listings')
      .select('id')
      .in('id', add)
      .eq('owner_user_id', userId)
      .is('deleted_at', null)
    if (error) return { ok: false, error: TRY_AGAIN }
    if ((owned ?? []).length !== add.length) return { ok: false, error: NOT_FOUND }
  }

  const service = createServiceClient()
  const { data, error } = await service.rpc('set_plan_page_coverage', {
    p_owner: userId,
    p_add: add,
    p_remove: remove,
  })
  if (error) {
    const message = refusal(error)
    if (message === TRY_AGAIN) console.error('[setPlanPagesAction] rpc failed:', error.message)
    return { ok: false, error: message }
  }

  let result
  try {
    result = parseOwnerPlanSync(data)
  } catch (err) {
    console.error('[setPlanPagesAction] unexpected result:', err)
    return { ok: false, error: TRY_AGAIN }
  }

  const after = result.skipped
    ? { tier_write: `skipped_${result.skipped}` }
    : { owner_tier: result.tier, cap: result.cap, pages: result.covered, changes: result.changes }
  for (const id of add) {
    await writeSystemAuditLog({
      actorUserId: userId,
      action: 'plan_page_covered',
      targetTable: 'plan_covered_pages',
      targetId: id,
      afterState: after,
    })
  }
  for (const id of remove) {
    await writeSystemAuditLog({
      actorUserId: userId,
      action: 'plan_page_uncovered',
      targetTable: 'plan_covered_pages',
      targetId: id,
      afterState: after,
    })
  }

  if (!result.skipped) await revalidateChanged(service, result.changes)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/upgrade')
  return { ok: true }
}
