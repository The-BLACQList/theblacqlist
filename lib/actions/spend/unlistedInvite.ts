'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServiceClient } from '@/lib/supabase/server'
import { getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { sendEmail } from '@/lib/email/resend'
import { BusinessInviteEmail } from '@/lib/email/templates/business-invite'
import { normalizeBusinessName } from '@/lib/spend/business-name'
import { BUSINESS_INVITE_SUBJECT } from '@/lib/spend/unlisted'

// The founder's "Email this business" on /admin/receipts/unlisted (ticket 168,
// O2 B). One send per click, to an address the founder types. A business that
// has been emailed before needs an explicit confirm, and one that said STOP
// can't be emailed at all.
//
// business_invite_sends has no write policy, so these service-role actions
// (after the admin check) are the only way a row changes. The typed address
// is used for the one send and never stored or logged.

const PAGE = '/admin/receipts/unlisted'
const NO_PERMISSION = 'You do not have permission to perform this action.'

export type SendBusinessInviteState =
  | { success: true; emailedAt: string; note?: string }
  | { needsConfirm: true; emailedAt: string }
  | { error: string }
  | null

export type MarkOptedOutState = { success: true } | { error: string } | null

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email())

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
}

function readBusinessName(formData: FormData): { name: string; normalized: string } | null {
  const name = formData.get('business_name')?.toString().trim().replace(/\s+/g, ' ') ?? ''
  if (!name || name.length > 200) return null
  const normalized = normalizeBusinessName(name)
  return normalized ? { name, normalized } : null
}

export async function sendBusinessInviteAction(
  _prev: SendBusinessInviteState,
  formData: FormData
): Promise<SendBusinessInviteState> {
  const admin = await getAdminSession()
  if (!admin) return { error: NO_PERMISSION }

  const business = readBusinessName(formData)
  if (!business) return { error: 'Missing business name.' }

  const email = emailSchema.safeParse(formData.get('email')?.toString() ?? '')
  if (!email.success) return { error: 'Enter a valid email address.' }

  const confirmed = formData.get('confirm')?.toString() === 'yes'
  const serviceClient = createServiceClient()

  const { data: existing, error: readError } = await serviceClient
    .from('business_invite_sends')
    .select('id, emailed_at, email_count, opted_out')
    .eq('normalized_name', business.normalized)
    .is('city', null)
    .maybeSingle()

  if (readError) return { error: "Couldn't check this business. Nothing was sent. Try again." }
  if (existing?.opted_out) {
    return { error: 'This business asked us to stop emailing. Nothing was sent.' }
  }
  if (existing?.emailed_at && !confirmed) {
    return { needsConfirm: true, emailedAt: existing.emailed_at }
  }

  await sendEmail({
    to: email.data,
    subject: BUSINESS_INVITE_SUBJECT,
    react: BusinessInviteEmail({ businessName: business.name, siteUrl: siteUrl() }),
    // One-to-one from the founder: a reply, STOP included, reaches them.
    replyTo: admin.user.email ?? undefined,
  })

  const emailedAt = new Date().toISOString()
  const emailCount = (existing?.email_count ?? 0) + 1
  const write = existing
    ? await serviceClient
        .from('business_invite_sends')
        .update({
          emailed_at: emailedAt,
          email_count: emailCount,
          sent_by: admin.user.id,
          business_name: business.name,
        })
        .eq('id', existing.id)
        .select('id')
        .single()
    : await serviceClient
        .from('business_invite_sends')
        .insert({
          normalized_name: business.normalized,
          city: null,
          business_name: business.name,
          emailed_at: emailedAt,
          email_count: emailCount,
          sent_by: admin.user.id,
        })
        .select('id')
        .single()

  if (write.error || !write.data) {
    revalidatePath(PAGE)
    return {
      success: true,
      emailedAt,
      note: "Sent, but we couldn't save the date. Refresh before sending again.",
    }
  }

  await writeAuditLog({
    adminUserId: admin.user.id,
    action: 'business_invite.sent',
    targetTable: 'business_invite_sends',
    targetId: write.data.id,
    beforeState: existing
      ? { emailed_at: existing.emailed_at, email_count: existing.email_count }
      : null,
    afterState: {
      normalized_name: business.normalized,
      emailed_at: emailedAt,
      email_count: emailCount,
    },
  })

  revalidatePath(PAGE)
  return { success: true, emailedAt }
}

/** The business replied STOP. Turns "Email this business" off for good. */
export async function markBusinessOptedOutAction(
  _prev: MarkOptedOutState,
  formData: FormData
): Promise<MarkOptedOutState> {
  const admin = await getAdminSession()
  if (!admin) return { error: NO_PERMISSION }

  const business = readBusinessName(formData)
  if (!business) return { error: 'Missing business name.' }

  const serviceClient = createServiceClient()
  const now = new Date().toISOString()
  // The group key is unique on (normalized_name, coalesce(city, '')), an
  // expression PostgREST can't upsert on, so read then write.
  const { data: existing, error: readError } = await serviceClient
    .from('business_invite_sends')
    .select('id')
    .eq('normalized_name', business.normalized)
    .is('city', null)
    .maybeSingle()
  if (readError) return { error: "Couldn't save that. Try again." }

  const { data, error } = existing
    ? await serviceClient
        .from('business_invite_sends')
        .update({ opted_out: true, opted_out_at: now })
        .eq('id', existing.id)
        .select('id')
        .single()
    : await serviceClient
        .from('business_invite_sends')
        .insert({
          normalized_name: business.normalized,
          city: null,
          business_name: business.name,
          opted_out: true,
          opted_out_at: now,
        })
        .select('id')
        .single()

  if (error || !data) return { error: "Couldn't save that. Try again." }

  await writeAuditLog({
    adminUserId: admin.user.id,
    action: 'business_invite.opted_out',
    targetTable: 'business_invite_sends',
    targetId: data.id,
    afterState: { normalized_name: business.normalized, opted_out_at: now },
  })

  revalidatePath(PAGE)
  return { success: true }
}
