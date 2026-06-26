import type { Metadata } from 'next'
import { Jost, Inter } from 'next/font/google'
import './globals.css'
import { PublicHeader } from '@/components/nav/public-header'
import { PublicFooter } from '@/components/nav/public-footer'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Display / wordmark / headlines — geometric, refined, set light–medium with wide tracking.
const jost = Jost({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
})

// UI / body / everything functional.
const inter = Inter({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

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
    title: 'The BLACQList — Discover Black-Owned Businesses',
    description: 'Find, save, and support Black-owned businesses near you.',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The BLACQList',
    description: 'Discover and support Black-owned businesses.',
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
        <PublicHeader />
        {/* pt offsets the fixed header: 56px mobile / 64px desktop */}
        <main id="main-content" className="flex-1 pt-14 md:pt-16">
          {children}
        </main>
        <PublicFooter />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
