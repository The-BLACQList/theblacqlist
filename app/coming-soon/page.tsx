import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'

import { BrandMark } from '@/components/ui/brand-mark'
import { ComingSoonForm } from './coming-soon-form'

export const metadata: Metadata = {
  title: 'Launching soon',
  description: 'The BLACQList is launching soon. Find & Be Found — the directory for Black-owned businesses.',
}

// Inline social glyphs for platforms not in this lucide-react version (mirrors the footer).
function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.21 8.21 0 0 0 4.79 1.53V6.77a4.85 4.85 0 0 1-1.02-.08z" />
    </svg>
  )
}

const socials = [
  { label: 'Instagram', href: 'https://instagram.com/theblacqlist', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com/theblacqlist', Icon: () => <X className="h-5 w-5" aria-hidden="true" /> },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/theblacqlist', Icon: LinkedInIcon },
  { label: 'TikTok', href: 'https://tiktok.com/@theblacqlist', Icon: TikTokIcon },
]

export default function ComingSoonPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-deep-bg px-6 py-16 text-white">
      {/* subtle gold glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-amber-gold/10 blur-[120px]"
      />

      <div className="relative z-10 w-full max-w-xl text-center">
        {/* Wordmark */}
        <div className="mb-12 flex items-center justify-center gap-2.5">
          <BrandMark className="h-9 w-9 text-gold" title="The BLACQList" />
          <span className="font-headline text-lg font-medium tracking-[0.18em] text-white">THE BLACQLIST</span>
        </div>

        <p className="mb-4 font-subhead text-xs uppercase tracking-[0.25em] text-gold">Launching soon</p>
        <h1 className="mb-5 font-headline text-5xl leading-[1.05] text-white md:text-6xl">Find &amp; Be Found.</h1>
        <p className="mx-auto mb-9 max-w-md font-subhead text-base leading-relaxed text-pale-lavender/80 md:text-lg">
          The directory for Black-owned businesses. Drop your email and we&apos;ll let you know the moment we go live.
        </p>

        <div className="mx-auto max-w-md">
          <ComingSoonForm />
        </div>

        {/* Social */}
        <div className="mt-14 flex items-center justify-center gap-6">
          {socials.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`The BLACQList on ${label}`}
              className="text-pale-lavender/60 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg rounded-sm"
            >
              <Icon />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
