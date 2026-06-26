'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Routes that render full-bleed, WITHOUT the public header/footer chrome.
// The coming-soon gate is standalone so its page never exposes product nav.
const BARE_ROUTES = ['/coming-soon']

interface ChromeGateProps {
  header: ReactNode
  footer: ReactNode
  children: ReactNode
}

/**
 * Renders the public header/footer around the page — except on "bare" routes
 * (the coming-soon gate), which render standalone. `header`/`footer` are passed
 * in as already-rendered server components, so they stay in the server tree.
 */
export function ChromeGate({ header, footer, children }: ChromeGateProps) {
  const pathname = usePathname()
  const isBare = BARE_ROUTES.includes(pathname)

  if (isBare) {
    return (
      <main id="main-content" className="flex-1">
        {children}
      </main>
    )
  }

  return (
    <>
      {header}
      {/* pt offsets the fixed header: 56px mobile / 64px desktop */}
      <main id="main-content" className="flex-1 pt-14 md:pt-16">
        {children}
      </main>
      {footer}
    </>
  )
}
