import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Route prefixes that require a valid session.
// Admin role checks (admin vs super_admin) are performed server-side
// inside each /admin page — the Edge Runtime cannot make DB queries.
const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/account',
  '/claim',
  '/add-business',
  '/onboarding',
  '/admin',
]

// Auth pages redirect to /dashboard when the user is already signed in.
const AUTH_PAGES = ['/sign-in', '/sign-up']

// Cookie that persists a coming-soon bypass once the secret ?preview token is used.
const COMING_SOON_COOKIE = 'bl_preview'

export async function proxy(request: NextRequest) {
  // supabaseResponse must be mutated — not replaced — so cookies are forwarded
  // correctly between the browser, the middleware, and the Server Components.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() is required here — it refreshes the session token in the cookie.
  // Do not add any code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ─── Coming-soon gate ──────────────────────────────────────────────────────
  // While COMING_SOON_MODE is on, the public is redirected to /coming-soon.
  // Founder + testers bypass with ?preview=<token> (which sets a persistent
  // cookie) or with any authenticated session. Server-only env vars — the token
  // never reaches the client.
  if (process.env.COMING_SOON_MODE === 'true') {
    const token = process.env.COMING_SOON_BYPASS_TOKEN
    const queryToken = request.nextUrl.searchParams.get('preview')
    const cookieToken = request.cookies.get(COMING_SOON_COOKIE)?.value
    const hasValidToken = !!token && (queryToken === token || cookieToken === token)

    // First visit with a valid ?preview token → persist the bypass for next time.
    if (token && queryToken === token) {
      supabaseResponse.cookies.set(COMING_SOON_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    const bypass = hasValidToken || !!user
    const isAllowed =
      pathname === '/coming-soon' ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/auth')

    if (!bypass && !isAllowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/coming-soon'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Unauthenticated access to protected routes → redirect to sign-in
  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (requiresAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated user visiting sign-in or sign-up → redirect to account
  // (Redirects to /dashboard once the owner dashboard is built).
  // Exception: when the URL carries an ?error (e.g. an auth-callback failure
  // redirected here), let the page render so the error is shown rather than
  // swallowed by a bounce to /account.
  if (user && AUTH_PAGES.includes(pathname) && !request.nextUrl.searchParams.has('error')) {
    const url = request.nextUrl.clone()
    url.pathname = '/account'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals, static assets, and the
    // Supabase health check so it never blocks non-page requests.
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
}
