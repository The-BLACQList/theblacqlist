'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ShieldCheck } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/ui/brand-mark'
import { cn } from '@/lib/utils'
import { signOutAction } from '@/lib/actions/auth/signOut'

const navLinks = [
  { label: 'Discover', href: '/discover' },
  { label: 'Map', href: '/map' },
  { label: 'Search', href: '/search' },
  { label: 'Cities', href: '/cities' },
  { label: 'For Business', href: '/for-business' },
] as const

interface Props {
  isSignedIn: boolean
  /** Resolved server-side in PublicHeader. Gates the link only — /admin still guards itself. */
  isAdmin: boolean
}

export function MobileNav({ isSignedIn, isAdmin }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const prevPathname = useRef(pathname)

  // Close the drawer when the route changes (e.g. browser back/forward)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setIsOpen(false)
    }
  }, [pathname])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-md text-cream',
            'hover:text-gold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg'
          )}
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="bg-deep-bg border-charcoal/30 p-0 w-4/5 max-w-sm">
        {/* Visually hidden title + description for screen reader accessibility */}
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SheetDescription className="sr-only">
          Browse The BLACQList and access your account.
        </SheetDescription>

        <div className="flex flex-col h-full px-6 py-6">
          {/* Logo: node-Q mark + Jost wordmark */}
          <Link
            href="/"
            aria-label="The BLACQList — home"
            className="group flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
            onClick={() => setIsOpen(false)}
          >
            <BrandMark className="h-7 w-7 text-gold" />
            <span className="font-headline text-base font-medium tracking-[0.14em] text-white group-hover:text-gold transition-colors">
              THE BLACQLIST
            </span>
          </Link>

          <Separator className="my-6 bg-charcoal/40" />

          {/* Nav links */}
          <nav aria-label="Mobile navigation">
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className={cn(
                      'flex items-center min-h-[48px] px-2 rounded-md font-subhead text-base transition-colors',
                      'text-cream hover:text-gold hover:bg-white/5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold',
                      pathname === link.href && 'text-gold'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <Separator className="my-6 bg-charcoal/40" />

          {/* Auth actions */}
          <div className="flex flex-col gap-3">
            {isSignedIn ? (
              <>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full h-12 border-amber-gold/50 text-gold bg-transparent hover:bg-amber-gold/10 hover:text-gold font-subhead"
                    asChild
                  >
                    <Link href="/admin" onClick={() => setIsOpen(false)}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Admin
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-12 border-cream/50 text-cream bg-transparent hover:bg-white/5 hover:text-cream font-subhead"
                  asChild
                >
                  <Link href="/account" onClick={() => setIsOpen(false)}>
                    My Account
                  </Link>
                </Button>
                <form action={signOutAction} onSubmit={() => setIsOpen(false)}>
                  <Button
                    type="submit"
                    className="w-full h-12 border border-amber-gold text-gold bg-transparent hover:bg-amber-gold/10 font-subhead font-bold"
                    variant="outline"
                  >
                    Sign Out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full h-12 border-cream/50 text-cream bg-transparent hover:bg-white/5 hover:text-cream font-subhead"
                  asChild
                >
                  <Link href="/sign-in" onClick={() => setIsOpen(false)}>
                    Sign In
                  </Link>
                </Button>
                <Button
                  className="w-full h-12 bg-amber-gold text-brand-black hover:bg-amber-gold/90 font-subhead font-bold"
                  asChild
                >
                  <Link href="/sign-up" onClick={() => setIsOpen(false)}>
                    Sign Up
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
