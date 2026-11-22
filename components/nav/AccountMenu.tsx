'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { NavLink } from '@/components/nav/nav-links'
import { cn } from '@/lib/utils'

/**
 * The header's My Account button (ticket 252). It opens a short list: My
 * Business for owners, then My Account, Saved, Messages and Settings. Closes on
 * Esc (focus goes back to the button), a click outside, or a new page.
 */
export function AccountMenu({ links }: { links: NavLink[] }) {
  const pathname = usePathname()
  // Open only on the page it was opened on, so a new page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null)
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenOn(null)
        buttonRef.current?.focus()
      }
    }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenOn(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative" data-testid="account-menu">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 font-subhead text-sm text-cream hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg rounded-sm px-2 py-1"
      >
        My Account
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          id={listId}
          className="absolute right-0 top-full mt-2 min-w-52 rounded-xl border border-charcoal/40 bg-deep-bg p-1.5 shadow-xl"
        >
          {links.map((link) => {
            const current = pathname === link.href
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center rounded-lg px-3 font-subhead text-sm transition-colors',
                    'text-cream hover:bg-white/5 hover:text-gold',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold',
                    current && 'text-gold'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
