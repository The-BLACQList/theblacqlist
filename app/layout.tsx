import type { Metadata } from 'next'
import { Lato, Quicksand } from 'next/font/google'
import './globals.css'
import { PublicHeader } from '@/components/nav/public-header'
import { PublicFooter } from '@/components/nav/public-footer'

const lato = Lato({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-lato',
  display: 'swap',
})

const quicksand = Quicksand({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The BLACQList',
  description: 'Discover and support Black-owned businesses.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${lato.variable} ${quicksand.variable} h-full antialiased`}>
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
      </body>
    </html>
  )
}
