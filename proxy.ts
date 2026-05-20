import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

// Route prefixes that require a valid session.
// Admin role checks (admin vs super_admin) are performed server-side
// inside each /admin page — the Edge Runtime cannot make DB queries.
const AUTH_REQUIRED_PREFIXES = [
  "/dashboard",
  "/account",
  "/claim",
  "/add-business",
  "/onboarding",
  "/admin",
]

// Auth pages redirect to /dashboard when the user is already signed in.
const AUTH_PAGES = ["/sign-in", "/sign-up"]

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
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

  // Unauthenticated access to protected routes → redirect to sign-in
  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )
  if (requiresAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated user visiting sign-in or sign-up → redirect to account
  // (Redirects to /dashboard once the owner dashboard is built)
  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/account"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals, static assets, and the
    // Supabase health check so it never blocks non-page requests.
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
}
