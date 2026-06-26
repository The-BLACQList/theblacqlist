import Link from 'next/link'
import { Search } from 'lucide-react'
import { Container } from '@/components/layout/container'
import { MobileNav } from '@/components/nav/mobile-nav'
import { BrandMark } from '@/components/ui/brand-mark'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/lib/actions/auth/signOut'

const desktopNavLinks = [
  { label: 'Discover', href: '/discover' },
  { label: 'Search', href: '/search' },
  { label: 'Cities', href: '/cities' },
  { label: 'For Business', href: '/for-business' },
] as const

export async function PublicHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isSignedIn = !!user

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-deep-bg h-14 md:h-16">
      <Container className="h-full">
        <nav
          aria-label="Main navigation"
          className="flex h-full items-center justify-between gap-4"
        >
          {/* Logo: node-Q mark + Jost wordmark */}
          <Link
            href="/"
            aria-label="The BLACQList — home"
            className="group flex items-center gap-2 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
          >
            <BrandMark className="h-7 w-7 md:h-8 md:w-8 text-gold transition-colors" />
            <span className="font-headline text-base md:text-lg font-medium tracking-[0.14em] text-white group-hover:text-gold transition-colors">
              THE BLACQLIST
            </span>
          </Link>

          {/* Desktop nav links */}
          <ul className="hidden md:flex items-center gap-6 flex-1 ml-8">
            {desktopNavLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-subhead text-sm text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg rounded-sm"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop right zone */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center rounded-md text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>

            {isSignedIn ? (
              <>
                <Link
                  href="/account"
                  className="font-subhead text-sm text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg rounded-sm px-2 py-1"
                >
                  My Account
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center h-9 px-4 rounded-md font-subhead text-sm font-bold border border-amber-gold text-gold hover:bg-amber-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
                  >
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="font-subhead text-sm text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg rounded-sm px-2 py-1"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md font-subhead text-sm font-bold bg-amber-gold text-brand-black hover:bg-amber-gold/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile right zone */}
          <div className="flex md:hidden items-center gap-1">
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-11 w-11 items-center justify-center rounded-md text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
            <MobileNav isSignedIn={isSignedIn} />
          </div>
        </nav>
      </Container>
    </header>
  )
}
