import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isSafeRedirect(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const errorParam = searchParams.get('error')

  // The password-reset email points back here with next=/reset-password. A reset
  // link must act on its own account no matter who is currently signed in, so the
  // recovery path is handled specially below. Its failures get a distinct error
  // code so the sign-in page can show a "request a new link" message.
  const isRecovery = next === '/reset-password'
  const failRedirect = `${origin}/sign-in?error=${
    isRecovery ? 'reset_link_expired' : 'auth_callback_failed'
  }`

  if (errorParam) {
    return NextResponse.redirect(failRedirect)
  }

  if (!code) {
    return NextResponse.redirect(failRedirect)
  }

  const supabase = await createClient()

  // Clear any session already present in this browser before establishing the
  // recovery session — otherwise account A's reset collides with account B's
  // session and the single-use link is consumed/expired. Local scope only: it
  // drops this browser's cookie without revoking the other account elsewhere and
  // makes no network call. It does not touch the PKCE code_verifier cookie that
  // exchangeCodeForSession needs (separate cookie key).
  if (isRecovery) {
    await supabase.auth.signOut({ scope: 'local' })
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(failRedirect)
  }

  const destination = isSafeRedirect(next) ? next : '/onboarding'
  return NextResponse.redirect(`${origin}${destination}`)
}
