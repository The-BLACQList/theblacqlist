import type { Metadata } from 'next'
import { Suspense } from 'react'
import localFont from 'next/font/local'
import './globals.css'
import { PublicHeader } from '@/components/nav/public-header'
import { PublicFooter } from '@/components/nav/public-footer'
import { ChromeGate } from '@/components/layout/chrome-gate'
import { PreviewBanner } from '@/components/layout/PreviewBanner'
import { TourRailMount } from '@/components/tour/TourRailMount'
import { ReportProblemMount } from '@/components/feedback/ReportProblemMount'
import { AssistantMount } from '@/components/assistant/AssistantMount'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Both faces are self-hosted from app/fonts (latin subset, variable weight,
// SIL Open Font License, see the OFL files beside them). next/font/google
// downloads them on every dev server start and build, and one Google Fonts
// hiccup on 2026-10-08 timed out the CI e2e job.

// Display / wordmark / headlines — geometric, refined, set light–medium with wide tracking.
const jost = localFont({
  src: './fonts/jost-latin-wght.woff2',
  weight: '300 500',
  variable: '--font-jost',
  display: 'swap',
})

// UI / body / everything functional.
const inter = localFont({
  src: './fonts/inter-latin-wght.woff2',
  weight: '400 600',
  variable: '--font-inter',
  display: 'swap',
})

/**
 * Site-wide fallback share card. First-party brand artwork, generated from the
 * SVG masters by `pnpm brand:assets` — never a licensed photograph, which Canva
 * restriction 3 forbids on anything this close to a brand mark
 * (docs/blacqlist/design/editorial-image-licenses.md).
 *
 * Routes with their own imagery override this: a listing page builds its card
 * from the owner-uploaded cover in generateMetadata. This is what every other
 * route gets, and before it existed they got a blank card.
 *
 * The path is relative on purpose — `metadataBase` below resolves it to an
 * absolute URL, which is what crawlers require.
 */
const OG_IMAGE = {
  url: '/og-default.png',
  width: 1200,
  height: 630,
  alt: 'The BLACQList',
}

export const metadata: Metadata = {
  title: {
    default: 'The BLACQList',
    template: '%s | The BLACQList',
  },
  description: 'Discover and support Black-owned businesses.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'),
  openGraph: {
    type: 'website',
    siteName: 'The BLACQList',
    title: 'The BLACQList: Discover Black-Owned Businesses',
    description: 'Find, save, and support Black-owned businesses near you.',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The BLACQList',
    description: 'Discover and support Black-owned businesses.',
    images: [OG_IMAGE],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jost.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-foreground flex flex-col">
        {/* Skip link — first focusable element; becomes visible on focus */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-amber-gold focus:text-brand-black focus:px-4 focus:py-2 focus:rounded-md focus:font-subhead focus:font-bold"
        >
          Skip to main content
        </a>
        <PreviewBanner />
        {/* ChromeGate hides the public header/footer on standalone routes
            (the /coming-soon gate); every other route renders them as before. */}
        <ChromeGate header={<PublicHeader />} footer={<PublicFooter />}>
          {children}
        </ChromeGate>
        {/* Tester Tour rail — renders nothing unless the flag is on AND the
            viewer is a signed-in, enrolled tester. Suspense lets it stream in
            after the page shell instead of blocking it. */}
        <Suspense fallback={null}>
          <TourRailMount />
        </Suspense>
        {/* Report a problem button — renders nothing unless the viewer is
            signed in. Same streaming treatment as the rail. */}
        <Suspense fallback={null}>
          <ReportProblemMount />
        </Suspense>
        {/* Site assistant (ticket 147) — renders nothing unless its flag is
            on; hides itself on non-public pages. */}
        <AssistantMount />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
