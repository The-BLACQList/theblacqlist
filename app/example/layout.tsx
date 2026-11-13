import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ExampleLinkGuard } from '@/components/example/ExampleLinkGuard'

/**
 * Everything under /example is a sample, never a page to index (ticket 184).
 * Preview already answers with X-Robots-Tag: noindex and robots.ts disallows
 * the prefix; this is the in-document copy of the same rule, so the three
 * agree even if one of the others is ever relaxed.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function ExampleLayout({ children }: { children: ReactNode }) {
  return <ExampleLinkGuard>{children}</ExampleLinkGuard>
}
