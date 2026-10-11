'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getAdminRole, writeAuditLog } from '@/lib/admin/guard'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  redeemTesterInvite,
  testerLinkStart,
  type RedeemDeps,
  type TesterLinkStart,
} from '@/lib/tester/redeem'

export type RedeemTesterLinkState = { error: string; needEmail?: boolean } | null

const PREVIEW_COOKIE = 'bl_preview'
const SOURCE_COOKIE = 'bl_src'
const THIRTY_DAYS = 60 * 60 * 24 * 30

async function sessionUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser()
  return user?.id ?? null
}

const isAdmin: RedeemDeps['isAdmin'] = async (userId) => (await getAdminRole(userId)) !== null

/**
 * Runs when /t loads, to decide whether to show the email box. Read only, so
 * it spends no use. It has its own rate limit bucket so page loads never eat
 * into the Start budget.
 */
export async function testerLinkStartAction(token: string): Promise<TesterLinkStart> {
  const allowed = await checkRateLimit({
    bucket: 'tester_link_peek',
    identifier: getClientIp(await headers()),
    limit: 30,
    windowSeconds: 600,
  })
  if (!allowed) return 'ready'
  return testerLinkStart(String(token ?? '').trim(), {
    service: createServiceClient(),
    isAdmin,
    sessionUserId,
  })
}

/**
 * The Start button on /t. Runs only on this POST, never on page load, so a
 * link preview or scanner that fetches /t cannot spend a use. The token comes
 * from the hidden input the page filled from the URL fragment.
 *
 * `email` is only sent for a supporter link made without one; redeem uses it to
 * make a new account and never to sign in to an existing one.
 *
 * Do not log `token` or `email`. lib/tester/redeem.ts holds the logic and the rules for
 * what may be logged.
 */
export async function redeemTesterLinkAction(
  _prev: RedeemTesterLinkState,
  formData: FormData
): Promise<RedeemTesterLinkState> {
  const token = formData.get('token')?.toString().trim() ?? ''
  const typedEmail = formData.get('email')?.toString() ?? ''
  const requestHeaders = await headers()
  const sessionClient = await createClient()

  const result = await redeemTesterInvite(
    token,
    {
      service: createServiceClient(),
      allowAttempt: () =>
        checkRateLimit({
          bucket: 'tester_link',
          identifier: getClientIp(requestHeaders),
          limit: 10,
          windowSeconds: 600,
        }),
      isAdmin,
      signIn: async (tokenHash) => {
        const { error } = await sessionClient.auth.verifyOtp({
          type: 'email',
          token_hash: tokenHash,
        })
        return { error }
      },
      sessionUserId,
    },
    typedEmail
  )

  if (!result.ok) return { error: result.error, needEmail: result.needEmail }

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
