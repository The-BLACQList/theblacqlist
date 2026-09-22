import { NextRequest, NextResponse } from 'next/server'

import { codeMatches } from '@/lib/auth/flyer-code'
import { TESTER_FLYER_CODE } from '@/lib/env'

// Self-serve tester admission: the link printed on the flyer / behind the QR.
//
//   GET /join?code=<flyer code>
//
// A correct code sets the same `bl_preview` cookie the coming-soon gate in
// proxy.ts already honors (same name, same value, same attributes), plus a
// non-secret `bl_src=flyer` cookie so signUp can record where the account came
// from, then lands the person on /sign-up. Anything else lands on /coming-soon
// with no hint about why, so the route cannot be used to probe the code.
//
// Why a separate secret from COMING_SOON_BYPASS_TOKEN: the flyer is a physical
// object that can be photographed and passed on. It needs to be revocable on
// its own (delete TESTER_FLYER_CODE in Vercel) without cutting off everyone who
// was invited by email. Existing cookies keep working until they expire (30
// days); revocation only closes the door to new visits, and the runbook says so.
//
// This route is on COMING_SOON_ALLOWED_PATHS, so it is reachable while the
// gate is up. It does the compare itself rather than forwarding the code to
// the proxy so the flyer code never appears in a URL the proxy logs or sets.

export const dynamic = 'force-dynamic'

const PREVIEW_COOKIE = 'bl_preview'
const SOURCE_COOKIE = 'bl_src'
const THIRTY_DAYS = 60 * 60 * 24 * 30

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { origin, searchParams } = request.nextUrl
  const candidate = searchParams.get('code') ?? ''

  if (!codeMatches(candidate, TESTER_FLYER_CODE)) {
    return NextResponse.redirect(`${origin}/coming-soon`)
  }

  const response = NextResponse.redirect(`${origin}/sign-up`)

  // Same cookie the proxy sets on a valid ?preview= visit. If the bypass token
  // is unset the gate cannot be open anyway, so there is nothing to store.
  const bypassToken = process.env.COMING_SOON_BYPASS_TOKEN
  if (bypassToken) {
    response.cookies.set(PREVIEW_COOKIE, bypassToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: THIRTY_DAYS,
    })
  }
  response.cookies.set(SOURCE_COOKIE, 'flyer', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  })

  return response
}
