'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getAdminRole, writeAuditLog } from '@/lib/admin/guard'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redeemTesterInvite } from '@/lib/tester/redeem'

export type RedeemTesterLinkState = { error: string } | null

const PREVIEW_COOKIE = 'bl_preview'
const SOURCE_COOKIE = 'bl_src'
const THIRTY_DAYS = 60 * 60 * 24 * 30

/**
 * The Start button on /t. Runs only on this POST, never on page load, so a
 * link preview or scanner that fetches /t cannot spend a use. The token comes
 * from the hidden input the page filled from the URL fragment.
 *
 * Do not log `token`. lib/tester/redeem.ts holds the logic and the rules for
 * what may be logged.
 */
export async function redeemTesterLinkAction(
  _prev: RedeemTesterLinkState,
  formData: FormData
): Promise<RedeemTesterLinkState> {
  const token = formData.get('token')?.toString().trim() ?? ''
  const requestHeaders = await headers()
  const sessionClient = await createClient()

  const result = await redeemTesterInvite(token, {
    service: createServiceClient(),
    allowAttempt: () =>
      checkRateLimit({
        bucket: 'tester_link',
        identifier: getClientIp(requestHeaders),
        limit: 10,
        windowSeconds: 600,
      }),
    isAdmin: async (userId) => (await getAdminRole(userId)) !== null,
    signIn: async (tokenHash) => {
      const { error } = await sessionClient.auth.verifyOtp({ type: 'email', token_hash: tokenHash })
      return { error }
    },
  })

  if (!result.ok) return { error: result.error }

  const cookieStore = await cookies()
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: THIRTY_DAYS }
  // A signed-in session already passes the coming-soon gate. The preview
  // cookie keeps the tester in if they sign out during the tester window.
  const bypassToken = process.env.COMING_SOON_BYPASS_TOKEN
  if (bypassToken) cookieStore.set(PREVIEW_COOKIE, bypassToken, cookieOptions)
  cookieStore.set(SOURCE_COOKIE, 'tester_link', cookieOptions)

  if (result.createdBy) {
    void writeAuditLog({
      adminUserId: result.createdBy,
      action: 'redeem_tester_link',
      targetTable: 'tester_invites',
      targetId: result.inviteId,
      afterState: { tester_user_id: result.testerUserId },
    })
  }

  // Outside any try/catch: redirect() works by throwing.
  redirect('/search')
}
