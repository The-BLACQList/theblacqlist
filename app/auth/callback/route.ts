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

  // A token_hash link belongs to the /auth/confirm interstitial, not here. The
  // Supabase email templates build their link from {{ .RedirectTo }}, which is
  // this route (signUp passes emailRedirectTo = <app url>/auth/callback), so a
  // template that switches to token_hash still arrives at this path. Forward it
  // with the query intact and let the interstitial verify on its POST — a GET
  // here must never consume the one-time token, or mail link-scanners will.
  if (searchParams.has('token_hash')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/confirm'
    return NextResponse.redirect(url)
  }

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

  // Do NOT sign out an existing session here: the recovery flow is PKCE, and
  // supabase.auth.signOut() → _removeSession() deletes the code_verifier cookie
  // that exchangeCodeForSession needs, which breaks the reset. The exchange
  // simply overwrites whatever session is present with the recovery session.
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(failRedirect)
  }

  const destination = isSafeRedirect(next) ? next : '/onboarding'
  return NextResponse.redirect(`${origin}${destination}`)
}
