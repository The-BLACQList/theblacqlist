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

  if (errorParam) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
  }

  const destination = isSafeRedirect(next) ? next : '/onboarding'
  return NextResponse.redirect(`${origin}${destination}`)
}
